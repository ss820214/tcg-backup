// public/game_state.js
// v1.7.1 (compat)
// - v1.7.0ベース
// - ★後方互換：Firestoreに残ってる "map形式 addStatus" / "配列 tags" を吸収
// - addStatusに pierce/aoe/knockback が書かれても「付与はしない」（攻撃属性扱い）

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
// unit.status はオブジェクト想定： { bleed:{v:10}, fracture:{v:1}, ... } みたいに保持
export function getStatus(u){
  if (!u) return {};
  if (!u.status || typeof u.status !== "object") u.status = {};
  return u.status;
}

export function clearStatuses(u){
  if (!u) return;
  u.status = {}; // 「基本全部解除」(panicは別なので消えない)
}

// =========================
// Compat helpers
// =========================
function _isPlainObject(x){
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/**
 * tags:
 * - 新: "evade:30,bleed:10 combo" みたいな文字列
 * - 旧: ["combo","bleed:10"] みたいな配列（importが配列にしてた場合）
 * - 旧2: { combo:true, bleed:10 } みたいなmap（万一）
 */
export function parseTags(tags){
  // --- object(map)ならそのまま返す ---
  if (_isPlainObject(tags)) return { ...tags };

  // --- arrayなら join ---
  if (Array.isArray(tags)) {
    const joined = tags.map(x=>String(x ?? "").trim()).filter(Boolean).join(",");
    return _parseTagsString(joined);
  }

  // --- string ---
  return _parseTagsString(tags);
}

function _parseTagsString(tags){
  const out = {};
  if (!tags) return out;
  const s = String(tags);

  // まず , と | で分割（空白も軽く許容）
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
 * addStatus:
 * - 新: "bleed,blind" / "pierce" みたいな文字列
 * - 旧: { target:{bleed:true, blind:true}, self:{followUp:true} } みたいなmap
 *   → display/判定用に ["bleed","blind","self.followUp"] へ正規化
 */
export function parseAddStatus(addStatus){
  if (!addStatus) return [];

  // 旧 map 形式
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
        // self側は "self.xxx" として残す（UI/将来拡張用）
        out.push(`self.${String(k)}`);
      }
    }

    // 一応、直下に "bleed:true" みたいなのがいたら拾う
    for (const k of Object.keys(addStatus)) {
      if (k === "target" || k === "self") continue;
      if (addStatus[k]) out.push(String(k));
    }

    return out.map(x=>x.trim()).filter(Boolean);
  }

  // 新 文字列
  const s = String(addStatus).trim();
  if (!s) return [];
  return s.split(/[,\| ]/).map(x=>x.trim()).filter(Boolean);
}

/**
 * 成功時に target に状態付与
 * - 状態の強さ/値は tags 側から取る（例: evade:30 / bleed:10）
 * - 無ければデフォルト値
 *
 * v1.7.x: pierce/aoe/knockback は「攻撃属性」なので付与しない
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

    // self.xxx は target に付けない（将来拡張用）
    if (name.startsWith("self.")) continue;
    if (name.startsWith("target.")) name = name.slice("target.".length);

    // ★攻撃属性（付与しない）
    if (name === "pierce" || name === "aoe" || name === "all" || name === "knockback") continue;
    if (name === "貫通" || name === "全体" || name === "ノックバック") continue;

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

/**
 * smell：ターン終了時に SP を削る（ターン終了タイミング）
 * - v を見て減らす（デフォは10）
 */
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

    // 攻撃属性（表示だけ：付与はしない）
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
    if (k === "bleed") return `${name}(移動時HP-${Number(v ?? 10)})`;
    if (k === "smell") return `${name}(終了時SP-${Number(v ?? 10)})`;
    return v != null && v !== true ? `${name}(${v})` : `${name}`;
  }).join(" / ");
}