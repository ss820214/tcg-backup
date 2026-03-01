// public/game_state.js
// v1.7.2 (buff/shield helpers)

export const W = 5;
export const H = 7;

export const MAX_KILLS_WIN = 3;
export const MAX_INFIL_WIN = 3;

export const DRAW_PER_TURN = 1;      // 1ターン1ドロー
export const RETURN_URL = "./deck.html";

// ===== 基本ヘルパ =====
export function uid(){
  return (crypto.randomUUID?.() ?? (Math.random().toString(16).slice(2) + Date.now()));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function summonArea(owner, y) {
  return owner === "A" ? y >= H - 2 : y <= 1;
}

export function enemyBaseArea(owner, y) {
  return owner === "A" ? y <= 1 : y >= H - 2;
}

export function isPanic(u){
  return !!u?.panic;
}

/**
 * A案：panicは「盤面に残す」けど「死亡判定」
 * → 生存条件は「HP>0 かつ panicではない」
 */
export function isAlive(u){
  return !!u && Number(u.hp) > 0 && !u.panic;
}

export function computeInfil(st){
  const units = st.units || [];
  const infilA = units.filter(u => u.owner==="A" && enemyBaseArea("A", u.y) && isAlive(u)).length;
  const infilB = units.filter(u => u.owner==="B" && enemyBaseArea("B", u.y) && isAlive(u)).length;
  return { infilA, infilB };
}

export function checkWin(st){
  if ((st.kills?.A ?? 0) >= MAX_KILLS_WIN) return "A";
  if ((st.kills?.B ?? 0) >= MAX_KILLS_WIN) return "B";
  const { infilA, infilB } = computeInfil(st);
  if (infilA >= MAX_INFIL_WIN) return "A";
  if (infilB >= MAX_INFIL_WIN) return "B";
  return null;
}

export function drawCards(decks, hands, seatKey, n=1){
  for(let i=0;i<n;i++){
    if ((decks?.[seatKey] || []).length <= 0) break;
    const cardId = decks[seatKey].pop();
    hands[seatKey].push(cardId);
  }
}

export function goToDeck(roomId, playerId){
  const url = `${RETURN_URL}?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
  location.href = url;
}

// ===== 状態異常 =====
export function getStatus(u){
  if (!u) return {};
  if (!u.status || typeof u.status !== "object") u.status = {};
  return u.status;
}

export function clearStatuses(u){
  if (!u) return;
  u.status = {};
}

// =========================
// Compat helpers
// =========================
function _isPlainObject(x){
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export function parseTags(tags){
  if (_isPlainObject(tags)) return { ...tags };

  if (Array.isArray(tags)) {
    const joined = tags.map(x=>String(x ?? "").trim()).filter(Boolean).join(",");
    return _parseTagsString(joined);
  }

  return _parseTagsString(tags);
}

function _parseTagsString(tags){
  const out = {};
  if (!tags) return out;
  const s = String(tags);

  const parts = s.split(/[,\|]/).map(x=>x.trim()).filter(Boolean);

  for (const p of parts){
    if (!p.includes(":") && !p.includes("=")){
      out[p] = true;
      continue;
    }
    const m = p.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const valRaw = m[2].trim();
    const num = Number(valRaw);
    out[key] = Number.isFinite(num) ? num : valRaw;
  }
  return out;
}

export function parseAddStatus(addStatus){
  if (!addStatus) return [];

  if (_isPlainObject(addStatus)) {
    const out = [];

    const tgt = addStatus.target;
    const self = addStatus.self;

    if (_isPlainObject(tgt)) {
      for (const k of Object.keys(tgt)) {
        if (tgt[k]) out.push(String(k));
      }
    }
    if (_isPlainObject(self)) {
      for (const k of Object.keys(self)) {
        if (!self[k]) continue;
        out.push(`self.${String(k)}`);
      }
    }

    for (const k of Object.keys(addStatus)) {
      if (k === "target" || k === "self") continue;
      if (addStatus[k]) out.push(String(k));
    }

    return out.map(x=>x.trim()).filter(Boolean);
  }

  const s = String(addStatus).trim();
  if (!s) return [];
  return s.split(/[,\| ]/).map(x=>x.trim()).filter(Boolean);
}

/**
 * 成功時に target に状態付与
 */
export function applyStatusesOnHit(targetUnit, act){
  if (!targetUnit || !act) return [];
  const added = [];

  const list = parseAddStatus(act.addStatus);
  if (!list.length) return added;

  const tagMap = parseTags(act.tags);
  const st = getStatus(targetUnit);

  for (const nameRaw of list){
    let name = String(nameRaw).trim();
    if (!name) continue;

    if (name.startsWith("self.")) continue;
    if (name.startsWith("target.")) name = name.slice("target.".length);

    // ★攻撃属性（付与しない）
    if (name === "pierce" || name === "aoe" || name === "all" || name === "knockback") continue;
    if (name === "貫通" || name === "全体" || name === "ノックバック") continue;

    let v = tagMap?.[name];

    if (name === "bleed") v = Number.isFinite(v) ? v : 10;
    else if (name === "smell") v = Number.isFinite(v) ? v : 10;
    else if (name === "evade") v = Number.isFinite(v) ? v : 20;

    else if (name === "hitUp") v = Number.isFinite(v) ? v : 10;
    else if (name === "powerUp") v = Number.isFinite(v) ? v : 10;
    else if (name === "armor") v = Number.isFinite(v) ? v : 10;
    else v = (v === undefined) ? 1 : v;

    // ===== stacking rules =====
    // Buff系は「重ね掛け」できる方が面白いので、既存があれば加算。
    // ※状態の設計によっては上書きしたい物もあるので、ここで明示的に制御する。
    const STACKABLE = new Set(["hitUp", "powerUp", "armor", "evade", "bleed", "smell"]);

    const prev = st?.[name];
    const prevV = Number(prev?.v ?? 0);
    const nextV = Number(v ?? 0);

    if (STACKABLE.has(name) && Number.isFinite(nextV)) {
      // 既存が数値なら加算、それ以外は次の値で初期化
      const base = Number.isFinite(prevV) ? prevV : 0;
      st[name] = { v: base + nextV };
      added.push({ name, v: nextV, total: base + nextV, stacked: true });
    } else {
      // 非stack対象は従来通り上書き
      st[name] = { v };
      added.push({ name, v });
    }
  }
  return added;
}

/**
 * 攻撃側の blind → 命中率半減
 * 追加: attacker.status.hitUp → 命中率に加算（%）
 */
export function calcHitRateWithStatus(attacker, baseRate){
  let rate = Number(baseRate ?? 0);
  if (!Number.isFinite(rate)) rate = 0;

  const st = getStatus(attacker);

  if (st.hitUp) {
    const up = Number(st.hitUp?.v ?? 0);
    if (Number.isFinite(up)) rate += up;
  }

  // stackingで上がりすぎないよう、素の命中は上限95%（blind補正はこの後）
  rate = Math.max(0, Math.min(95, Math.trunc(rate)));

  if (st.blind) rate = Math.floor(rate / 2);

  return rate;
}

/**
 * 防御側の evade → 当たった判定をミス化する確率
 * 返り値: trueなら「回避でミス化」
 */
export function checkEvade(defender, rng01){
  const st = getStatus(defender);
  if (!st.evade) return false;
  const p = Number(st.evade?.v ?? 0);
  if (!Number.isFinite(p) || p <= 0) return false;
  const r = rng01(); // 0..1
  return (r * 100) < p;
}

/**
 * ★追加：攻撃力UP(+10) をHPダメに乗せる
 * powerUp は “固定+” として扱う
 */
export function applyPowerUpToHpDamage(attacker, baseHpDmg){
  let dmg = Number(baseHpDmg ?? 0);
  if (!Number.isFinite(dmg)) dmg = 0;

  const st = getStatus(attacker);
  if (st.powerUp) {
    const up = Number(st.powerUp?.v ?? 0);
    if (Number.isFinite(up) && up !== 0) dmg += up;
  }

  return Math.max(0, Math.trunc(dmg));
}

/**
 * ★追加：装甲(armor) でHPダメージを吸収する（消費する）
 */
export function applyArmorToHpDamage(defender, incomingHpDmg){
  let dmg = Number(incomingHpDmg ?? 0);
  if (!Number.isFinite(dmg)) dmg = 0;
  dmg = Math.max(0, Math.trunc(dmg));

  const st = getStatus(defender);
  const curArmor = Number(st.armor?.v ?? 0);
  if (!Number.isFinite(curArmor) || curArmor <= 0 || dmg <= 0) {
    return { taken: dmg, absorbed: 0, remainArmor: Math.max(0, Number.isFinite(curArmor) ? curArmor : 0) };
  }

  const absorbed = Math.min(curArmor, dmg);
  const taken = dmg - absorbed;
  const remain = curArmor - absorbed;

  if (remain > 0) st.armor = { v: remain };
  else delete st.armor;

  return { taken, absorbed, remainArmor: Math.max(0, remain) };
}

export function canCombo(attacker, act){
  if (!attacker || !act) return false;
  const st = getStatus(attacker);
  const t = parseTags(act.tags);
  return !!st.combo && !!t.combo;
}

export function hasFollowUp(attacker){
  const st = getStatus(attacker);
  return !!st.followUp;
}

export function isMoveBlockedByStatus(unit){
  const st = getStatus(unit);
  return !!st.fracture;
}

export function applyBleedOnMove(unit){
  const st = getStatus(unit);
  if (!st.bleed) return 0;
  const v = Number(st.bleed?.v ?? 10);
  const dmg = Number.isFinite(v) ? v : 10;
  unit.hp = Math.max(0, Number(unit.hp) - dmg);
  return dmg;
}

export function applySmellOnTurnEnd(unitsOrUnit) {
  if (Array.isArray(unitsOrUnit)) {
    let total = 0;
    for (const u of unitsOrUnit) total += applySmellOnTurnEnd(u);
    return total;
  }

  const u = unitsOrUnit;
  if (!u || typeof u !== "object") return 0;

  const st = getStatus(u);
  if (!st.smell) return 0;

  const v = Number(st.smell?.v ?? 10);
  const dmg = Number.isFinite(v) ? v : 10;

  const cur = Number(u.sp || 0);
  u.sp = Math.max(0, cur - dmg);
  return dmg;
}

export function hasLostSoul(unit){
  const st = getStatus(unit);
  return !!st.lostSoul;
}

// =====================
// ★追加：疲労回復 / 移動制限回復（安全ヘルパ）
// =====================
export function clearFatigue(unit){
  if (!unit || typeof unit !== "object") return false;

  const keys = [
    "fatigue", "fatigued", "tired", "exhausted",
    "didAttack", "attackedThisTurn", "acted", "actedThisTurn",
  ];

  let changed = false;
  for (const k of keys) {
    if (k in unit) {
      if (typeof unit[k] === "number") unit[k] = 0;
      else unit[k] = false;
      changed = true;
    }
  }
  return changed;
}

export function resetMoveLimit(unit){
  if (!unit || typeof unit !== "object") return false;

  const keys = [
    "moveUsed", "moveCount", "movedCount", "movedThisTurn",
    "moveLeft", "movesLeft", "moveRemain", "moveRemaining",
    "turnMoveUsed", "turnMoveCount", "turnMoved",
  ];

  let changed = false;
  for (const k of keys) {
    if (!(k in unit)) continue;

    if (typeof unit[k] === "number") unit[k] = 0;
    else unit[k] = false;

    changed = true;
  }
  return changed;
}

// ===== 表示用 =====
export function statusLabelMap(){
  return {
    bleed: "出血",
    fracture: "骨折",
    smell: "匂い",
    lostSoul: "失魂",
    blind: "盲目",
    evade: "回避",
    combo: "コンボ",
    followUp: "追撃",

    hitUp: "命中強化",
    powerUp: "攻撃強化",
    armor: "装甲",

    pierce: "貫通",
    aoe: "全体",
    knockback: "ノックバック",
  };
}

export function formatStatusList(u){
  const st = getStatus(u);
  const m = statusLabelMap();
  const keys = Object.keys(st || {});
  if (!keys.length) return "なし";

  return keys.map(k=>{
    const v = st[k]?.v;
    const name = m[k] || k;

    if (k === "evade") return `${name}(${Number(v ?? 0)}%)`;
    if (k === "hitUp") return `${name}(命中+${Number(v ?? 10)}%)`;
    if (k === "powerUp") return `${name}(HPダメ+${Number(v ?? 10)})`;
    if (k === "armor") return `${name}(吸収${Number(v ?? 10)})`;

    if (k === "bleed") return `${name}(移動時HP-${Number(v ?? 10)})`;
    if (k === "smell") return `${name}(終了時SP-${Number(v ?? 10)})`;
    return v != null && v !== true ? `${name}(${v})` : `${name}`;
  }).join(" / ");
}