// public/game_state.js
// v1.5.0 状態異常入り（A案：panicは盤面残し/死亡判定）

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
 * → 侵入判定/勝利判定/行動可否で dead 扱いにしたいので
 *    生存条件は「HP>0 かつ panicではない」
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
// unit.status はオブジェクト想定： { bleed:{v:10}, fracture:{v:1}, ... } みたいに保持
export function getStatus(u){
  if (!u) return {};
  if (!u.status || typeof u.status !== "object") u.status = {};
  return u.status;
}

export function clearStatuses(u){
  if (!u) return;
  u.status = {}; // 「基本全部解除」
}

/**
 * tags文字列 → map化
 * 例: "evade:30,bleed:10 combo" みたいなのを許容
 */
export function parseTags(tags){
  const out = {};
  if (!tags) return out;
  const s = String(tags);

  // 区切りは , | 空白 など広めに許容
  const parts = s.split(/[,\|]/).map(x=>x.trim()).filter(Boolean);
  for (const p of parts){
    // "combo" だけのタグ
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

/**
 * addStatus文字列 → ["bleed","blind"] みたいに
 * 区切りは , | 空白 など許容
 */
export function parseAddStatus(addStatus){
  if (!addStatus) return [];
  const s = String(addStatus).trim();
  if (!s) return [];
  return s.split(/[,\| ]/).map(x=>x.trim()).filter(Boolean);
}

/**
 * 成功時に target に状態付与
 * - 状態の強さ/値は tags 側から取る（例: evade:30 / bleed:10）
 * - 無ければデフォルト値
 */
export function applyStatusesOnHit(targetUnit, act){
  if (!targetUnit || !act) return [];
  const added = [];

  const list = parseAddStatus(act.addStatus);
  if (!list.length) return added;

  const tagMap = parseTags(act.tags);

  const st = getStatus(targetUnit);
  for (const nameRaw of list){
    const name = String(nameRaw).trim();
    if (!name) continue;

    let v = tagMap?.[name];
    // デフォルト
    if (name === "bleed") v = Number.isFinite(v) ? v : 10;      // 移動時HP-10
    else if (name === "smell") v = Number.isFinite(v) ? v : 10; // ターン終了SP-10
    else if (name === "evade") v = Number.isFinite(v) ? v : 20; // 20% default
    else v = (v === undefined) ? 1 : v;

    st[name] = { v };
    added.push({ name, v });
  }
  return added;
}

/**
 * 攻撃側の blind → 命中率半減
 */
export function calcHitRateWithStatus(attacker, baseRate){
  let rate = Number(baseRate ?? 0);
  if (!Number.isFinite(rate)) rate = 0;
  rate = Math.max(0, Math.min(100, Math.trunc(rate)));

  const st = getStatus(attacker);
  if (st.blind) {
    rate = Math.floor(rate / 2);
  }
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
 * コンボ条件：
 * - attacker に status.combo が付いている
 * - 技の tags に "combo" がある
 */
export function canCombo(attacker, act){
  if (!attacker || !act) return false;
  const st = getStatus(attacker);
  const t = parseTags(act.tags);
  return !!st.combo && !!t.combo;
}

/**
 * followUp：攻撃後の疲労解除
 */
export function hasFollowUp(attacker){
  const st = getStatus(attacker);
  return !!st.followUp;
}

/**
 * fracture：移動不可
 */
export function isMoveBlockedByStatus(unit){
  const st = getStatus(unit);
  return !!st.fracture;
}

/**
 * bleed：移動したらHP減る（移動タイミング）
 */
export function applyBleedOnMove(unit){
  const st = getStatus(unit);
  if (!st.bleed) return 0;
  const v = Number(st.bleed?.v ?? 10);
  const dmg = Number.isFinite(v) ? v : 10;
  unit.hp = Math.max(0, Number(unit.hp) - dmg);
  return dmg;
}

// 匂い：ターン終了時に SP を削る（旧実装が「units配列」を想定しても落ちないように互換対応）
export function applySmellOnTurnEnd(unitsOrUnit) {
  // --- 互換：配列が来たら全部処理（undefinedでも落ちない） ---
  if (Array.isArray(unitsOrUnit)) {
    let total = 0;
    for (const u of unitsOrUnit) total += applySmellOnTurnEnd(u);
    return total;
  }

  // --- 単体ユニット想定 ---
  const u = unitsOrUnit;
  if (!u || typeof u !== "object") return 0;

  // status の持ち方が揺れても落ちないように
  // 例: u.statuses.smell / u.status.smell / u.smell みたいな揺れに一応対応
  const hasSmell =
    !!(u.statuses && u.statuses.smell) ||
    !!(u.status && u.status.smell) ||
    !!u.smell;

  if (!hasSmell) return 0;

  const dmg = 10; // ←仕様どおり SP-10
  const cur = Number(u.sp || 0);
  u.sp = Math.max(0, cur - dmg);
  return dmg;
}

/**
 * lostSoul：フラグ保持（今回は抑止先なし）
 * → 何もしない（保持だけ）
 */
export function hasLostSoul(unit){
  const st = getStatus(unit);
  return !!st.lostSoul;
}

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
    if (k === "bleed") return `${name}(移動時HP-${Number(v ?? 10)})`;
    if (k === "smell") return `${name}(終了時SP-${Number(v ?? 10)})`;
    return v != null && v !== true ? `${name}(${v})` : `${name}`;
  }).join(" / ");
}