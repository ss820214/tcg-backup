// public/field_system.js
// v20260210_field_v1_1
//
// Fields:
// - grass  : normal
// - danger : center bomb, stepped 3 times -> 20 HP dmg (on the 3rd stepper), then bomb removed
//            bomb respawns at NEXT turn start
// - swamp  : moving INTO center row (4th row; y=3 when H=7) has 50% chance to succeed; fail -> stop (stay)

export function normalizeFieldId(id){
  const s = String(id ?? "").trim().toLowerCase();
  if (s === "danger" || s === "dangerzone") return "danger";
  if (s === "swamp") return "swamp";
  return "grass";
}

export function fieldNameJa(fieldId){
  const f = normalizeFieldId(fieldId);
  if (f === "danger") return "危険地帯";
  if (f === "swamp") return "沼地";
  return "草原";
}

// ---------------------
// internal: turn index
// ---------------------
function getTurnIndex(s){
  // game.js 側の実装差異に備えて候補を拾う
  const n =
    Number(s?.turnSeq ?? s?.turn ?? s?.turnNo ?? s?.turnCount ?? s?.turnIndex ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// stateにフィールド情報を生やす（既存部屋互換）
export function ensureFieldState(s, W, H, fieldId){
  if (!s || typeof s !== "object") return;

  const fid = normalizeFieldId(fieldId ?? s.fieldId ?? s.field?.id ?? "grass");
  s.fieldId = fid;
  s.field = s.field && typeof s.field === "object" ? s.field : { id: fid };
  s.field.id = fid;

  // bomb state
  if (fid === "danger"){
    const cx = Math.floor(W/2);
    const cy = Math.floor(H/2);

    if (!s.field.bomb || typeof s.field.bomb !== "object"){
      s.field.bomb = {
        x: cx, y: cy,
        steps: 0,
        alive: true,
        threshold: 3,
        dmg: 20,
        respawnTurn: null, // ★追加：次ターン復活用
      };
    }

    // 既存データの補完
    const b = s.field.bomb;
    b.x = Math.trunc(Number(b.x ?? cx));
    b.y = Math.trunc(Number(b.y ?? cy));
    b.steps = Math.max(0, Math.trunc(Number(b.steps ?? 0)));
    b.alive = (b.alive !== false);
    b.threshold = Math.max(1, Math.trunc(Number(b.threshold ?? 3)));
    b.dmg = Math.max(0, Math.trunc(Number(b.dmg ?? 20)));

    // respawnTurn 補完
    if (b.respawnTurn === undefined) b.respawnTurn = null;

    // ★重要：turn が進んでいて respawnTurn に達していたら復活させる
    const t = getTurnIndex(s);
    if (b.alive === false && b.respawnTurn != null && t >= Number(b.respawnTurn)){
      b.alive = true;
      b.steps = 0;
      b.respawnTurn = null;
    }
  }

  // swamp: no special persistent state needed
}

// ★追加：ターン開始時に呼ぶ（爆弾の復活を確実にする）
export function applyFieldOnTurnStart({ s, W, H, logPush }){
  const fid = normalizeFieldId(s?.fieldId ?? s?.field?.id ?? "grass");
  if (fid !== "danger") return;

  const bomb = s?.field?.bomb;
  if (!bomb) return;

  const t = getTurnIndex(s);
  if (bomb.alive === false && bomb.respawnTurn != null && t >= Number(bomb.respawnTurn)){
    bomb.alive = true;
    bomb.steps = 0;
    bomb.respawnTurn = null;
    try{
      logPush?.(s, `💣爆弾が補充された！（ターン${t}）`);
    }catch{}
  }
}

// moveにフィールド効果を適用（move前に呼ぶ）
export function applyFieldMoveRule({
  s, who,
  unit,
  from,
  to,
  W, H,
  round10,
  logPush
}){
  const fid = normalizeFieldId(s?.fieldId ?? s?.field?.id ?? "grass");
  if (!fid || fid === "grass") return { ok:true, to };

  // ---- swamp: moving INTO center ROW (4th row) is 50% success
  // 盤面：縦7横5 → 真ん中の1行 = y=3（0始まり）
  if (fid === "swamp"){
    const swampY = Math.floor(H/2); // H=7 -> 3
    const intoSwampRow = (to?.y === swampY);
    if (intoSwampRow){
      const r = Math.floor(Math.random()*100)+1; // 1..100
      const ok = (r <= 50);
      if (!ok){
        try{
          logPush?.(s, `[${who}] 沼地：ぬかるんだ！（移動失敗 r=${r}/50） → ${unit?.cardId ?? "unit"}`);
        }catch{}
        return { ok:false, to: from, blocked:true, label:`swamp r=${r}` };
      }
    }
    return { ok:true, to };
  }

  // ---- danger: bomb is handled AFTER movement (when stepped)
  return { ok:true, to };
}

// move後（実際にマスに入った後）に踏んだ処理
export function applyFieldOnStepAfterMove({
  s, who,
  unit,
  pos,
  round10,
  clampUnitStats10,
  countKillIfNeeded,
  setPanicAndCountIfNeeded,
  logPush
}){
  const fid = normalizeFieldId(s?.fieldId ?? s?.field?.id ?? "grass");
  if (fid !== "danger") return;

  const bomb = s?.field?.bomb;
  if (!bomb || bomb.alive === false) return;

  const bx = Math.trunc(Number(bomb.x));
  const by = Math.trunc(Number(bomb.y));
  if (pos?.x !== bx || pos?.y !== by) return;

  bomb.steps = Math.max(0, Math.trunc(Number(bomb.steps ?? 0))) + 1;

  // 1,2回目はカウントだけ
  const th = Math.max(1, Math.trunc(Number(bomb.threshold ?? 3)));
  if (bomb.steps < th){
    try{
      logPush?.(s, `[${who}] 💣踏んだ！ カウント ${bomb.steps}/${th}`);
    }catch{}
    return;
  }

  // 3回目：爆発（踏んだユニットが20ダメ）
  const dmg = Math.max(0, Math.trunc(Number(bomb.dmg ?? 20)));
  const taken = round10 ? round10(dmg) : dmg;

  try{
    logPush?.(s, `[${who}] 💥爆発！ ${taken}ダメージ（踏み：${unit?.cardId ?? "unit"}）`);
  }catch{}

  if (unit && Number(unit.hp) > 0){
    unit.hp = (round10 ? round10(Number(unit.hp) - taken) : (Number(unit.hp) - taken));
    try{ clampUnitStats10?.(unit); }catch{}
    try{
      setPanicAndCountIfNeeded?.(unit, who, s.kills, s.log, "爆弾パニック撃破");
      if (Number(unit.hp) <= 0) countKillIfNeeded?.(unit, who, s.kills, s.log, "爆弾撃破");
    }catch{}
  }

  // ★爆弾は消滅 → 次ターン開始で復活予約
  bomb.alive = false;
  bomb.steps = th;

  const t = getTurnIndex(s);
  bomb.respawnTurn = t + 1; // ★次ターン
  try{
    logPush?.(s, `💣爆弾が消滅…次ターンに補充予定（${t}→${t+1}）`);
  }catch{}
}