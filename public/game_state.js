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
  if (!u.status || typeof u.status !== "object") {
    if (u.statuses && typeof u.statuses === "object") {
      u.status = { ...u.statuses };
    } else {
      u.status = {};
    }
  }
  return u.status;
}

export function clearStatuses(u){
  if (!u) return;
  u.status = {};
  if (u.statuses && typeof u.statuses === "object") u.statuses = {};
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
  return s.split(/[,\|\+\s]+/).map(x=>x.trim()).filter(Boolean);
}

export function normalizeStatusKey(name){
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  const aliases = {
    blind: "blind",
    "盲目": "blind",
    poison: "poison",
    "毒": "poison",
    smell: "smell",
    odor: "smell",
    stink: "smell",
    "におい": "smell",
    "匂い": "smell",
    "臭い": "smell",
    seal: "seal",
    silence: "seal",
    "封印": "seal",
    "沈黙": "seal",
    evade: "evade",
    dodge: "evade",
    "回避": "evade",
    armor: "armor",
    guard: "armor",
    "装甲": "armor",
    powerup: "powerUp",
    powerUp: "powerUp",
    power: "powerUp",
    "攻撃増加": "powerUp",
    hitup: "hitUp",
    hitUp: "hitUp",
    aim: "hitUp",
    "命中増加": "hitUp",
    angry: "rage",
    fury: "rage",
    "激怒": "rage",
    mindcontrol: "brainwash",
    mindControl: "brainwash",
    charm: "brainwash",
    control: "brainwash",
    "洗脳": "brainwash",
    mud: "sludge",
    mire: "sludge",
    slime: "sludge",
    "ヘドロ": "sludge",
    counterattack: "counter",
    counterAtk: "counter",
    reflect: "counter",
    "カウンター": "counter",
    broken: "fracture",
    fracture: "fracture",
    "膝根": "fracture",
    "骨折": "fracture",
    lostsoul: "lostSoul",
    lostSoul: "lostSoul",
    "失魂": "lostSoul",
    taiman: "taiman",
    duel: "taiman",
    "タイマン": "taiman",
  };
  return aliases[raw] || aliases[key] || raw;
}

// ===== Turn-buff rules =====
// 「次のターンに消える」バフ群（必要なら増減してOK）
export const TURN_BUFF_KEYS = new Set([
  "hitUp",
  "powerUp",
  "armor",
  "evade",
  "combo",
  "followUp",
]);

export function applyTurnScopedStatus(unit, name, v, turnSeq, opts = {}) {
  if (!unit) return { applied: false };

  const st = getStatus(unit);
  const prev = st?.[name];

  const num = Number(v ?? 0);
  const isNum = Number.isFinite(num);

  const stackSameTurn = !!opts.stackSameTurn;

  // turnSeq が無い場合は「ターン管理なし」扱い：上書きだけ（安全側）
  if (turnSeq == null) {
    st[name] = { v: isNum ? num : (v ?? 1) };
    return { applied: true, stacked: false, total: st[name]?.v };
  }

  const prevTurn = prev?.turnSeq;
  const prevV = Number(prev?.v ?? 0);

  // ★同ターンだけ加算、それ以外は上書き
  if (stackSameTurn && prev && prevTurn === turnSeq && isNum) {
    const base = Number.isFinite(prevV) ? prevV : 0;
    const total = base + num;
    st[name] = { v: total, turnSeq };
    return { applied: true, stacked: true, total };
  } else {
    st[name] = { v: isNum ? num : (v ?? 1), turnSeq };
    return { applied: true, stacked: false, total: st[name]?.v };
  }
}

// =====================
// Knockback helpers (game_state.js)
// =====================

export function getKnockbackDistFromAct(act){
  if (!act) return 0;

  const list = parseAddStatus(act.addStatus);
  const tags = parseTags(act.tags);

  const hasKb =
    list.includes("knockback") || list.includes("ノックバック") ||
    !!tags.knockback || !!tags.KNOCKBACK || !!tags.ノックバック;

  if (!hasKb) return 0;

  // numeric fields
  for (const k of ["kb", "knockback", "kbDist", "knockbackDist", "dist"]) {
    const v = Number(tags?.[k]);
    if (Number.isFinite(v) && v > 0) return Math.max(1, Math.trunc(v));
  }

  // kb2 / kb3 style
  for (const k of Object.keys(tags || {})) {
    const m = String(k).match(/^kb(\d+)$/i);
    if (m) {
      const n = Math.trunc(Number(m[1]));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  // raw string fallback
  if (typeof act.tags === "string") {
    const s = act.tags;
    const m = s.match(/kb\s*[:=]\s*(\d+)/i) || s.match(/\bkb(\d+)\b/i);
    if (m) {
      const n = Math.trunc(Number(m[1]));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  return 1;
}

function _unitAt(units, x, y, excludeUnit=null){
  return (units || []).find(u =>
    !!u &&
    typeof u === "object" &&
    u !== excludeUnit &&
    u.x === x &&
    u.y === y
  ) || null;
}

export function applyKnockback(st, attackerUnit, targetUnit, dist){
  if (!st || !attackerUnit || !targetUnit) return { moved: 0 };
  dist = Math.max(0, Math.trunc(Number(dist ?? 0)));
  if (dist <= 0) return { moved: 0 };

  // ✅ 味方は押さない（味方へのノックバック無効）
  if (attackerUnit.owner && targetUnit.owner && attackerUnit.owner === targetUnit.owner) {
    return { moved: 0 };
  }

  // 死亡/パニックは押さない（押される側が死んでるなら無効）
  if (!isAlive(targetUnit)) return { moved: 0 };

  const dx0 = targetUnit.x - attackerUnit.x;
  const dy0 = targetUnit.y - attackerUnit.y;
  if (dx0 === 0 && dy0 === 0) return { moved: 0 };

  const step = (v) => (v === 0 ? 0 : v > 0 ? 1 : -1);
  const sx = step(dx0);
  const sy = step(dy0);

  let x = targetUnit.x;
  let y = targetUnit.y;
  let moved = 0;

  for (let i=0;i<dist;i++){
    const nx = x + sx;
    const ny = y + sy;

    if (nx < 0 || nx >= W || ny < 0 || ny >= H) break;

    // ✅ 盤面に「誰か」いたら止まる（panic含む）
    if (_unitAt(st.units, nx, ny, targetUnit)) break;

    x = nx; y = ny;
    moved++;
  }

  if (moved > 0){
    targetUnit.x = x;
    targetUnit.y = y;
  }

  return { moved, to: { x, y } };
}

/**
 * state の units を直接更新してノックバックを適用する
 * - attacker/target は unit オブジェクトでも id でも良い（ここはあなたの units 仕様に合わせて）
 */

/**
 * 成功時に target に状態付与
 */
// ✅ 変更：turnSeq を第3引数に追加（省略OK）
export function applyStatusesOnHit(targetUnit, act, currentTurnSeq = null){
  if (!targetUnit || !act) return [];
  const added = [];

  const list = parseAddStatus(act.addStatus);
  if (!list.length) return added;

  const tagMap = parseTags(act.tags);
  const st = getStatus(targetUnit);

  const NON_STATUS = new Set(["draw","recoverMove","recoverFatigue","cleanse"]);

  for (const nameRaw of list){
    let name = String(nameRaw).trim();
    if (!name) continue;

    if (name.startsWith("self.")) continue;
    if (name.startsWith("target.")) name = name.slice("target.".length);
    name = normalizeStatusKey(name);

    if (NON_STATUS.has(name)) continue;

    // ★攻撃属性（付与しない）
    if (name === "pierce" || name === "aoe" || name === "all" || name === "knockback" || name === "swapTarget" || name === "swapPos" || name === "positionSwap") continue;
    if (name === "貫通" || name === "全体" || name === "ノックバック" || name === "位置入替") continue;

    // ★game.js側で直接処理する系（付与しない）
    if (name === "draw") continue;
    if (name === "recoverFatigue" || name === "recoverMove" || name === "cleanse") continue;

    let v = tagMap?.[name];

    if (name === "bleed") v = Number.isFinite(v) ? v : 10;
    else if (name === "smell") v = Number.isFinite(v) ? v : 10;
    else if (name === "poison") v = Number.isFinite(v) ? v : 10;
    else if (name === "evade") v = Number.isFinite(v) ? v : 20;
    else if (name === "hitUp") v = Number.isFinite(v) ? v : 10;
    else if (name === "powerUp") v = Number.isFinite(v) ? v : 10;
    else if (name === "armor") v = Number.isFinite(v) ? v : 10;
    else if (name === "rage") v = Number.isFinite(v) ? v : 20;
    else if (name === "sludge") v = Number.isFinite(v) ? v : 1;
    else if (name === "counter") v = Number.isFinite(v) ? v : 30;
    else if (name === "brainwash") v = Number.isFinite(v) ? v : 50;
    else if (name === "lostSoul") v = Number.isFinite(v) ? v : 1;
    else if (name === "taiman") v = Number.isFinite(v) ? v : 1;
    else v = (v === undefined) ? 1 : v;

    // ✅ 「同ターン重ね掛け」対象は TURN_BUFF_KEYS のみ
    // （bleed/smell等はバフじゃないので、ここでは従来どおり上書き推奨）
    if (TURN_BUFF_KEYS.has(name)) {
      const r = applyTurnScopedStatus(targetUnit, name, v, currentTurnSeq, { stackSameTurn: true });
      added.push({ name, v, total: r.total, stacked: r.stacked, turnSeq: currentTurnSeq });
    } else {
      // デバフ/DoT 等は通常上書き（必要なら別途設計）
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

  const hitUp = Number(st.hitUp?.v ?? 0);
  const aim = Number(st.aim?.v ?? 0);
  const jinx = Number(st.jinx?.v ?? 0);

  if (Number.isFinite(hitUp)) rate += hitUp;
  if (Number.isFinite(aim)) rate += aim;
  if (Number.isFinite(jinx)) rate -= jinx;

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

export function normSeat(t){
  const s = String(t ?? "").toUpperCase();
  return (s === "A" || s === "B") ? s : null;
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

export function getActionCostWithStatus(unit, act){
  const base = Math.max(0, Math.trunc(Number(act?.cost ?? 0)));
  const st = getStatus(unit);
  const sludge = Number(st.sludge?.v ?? 0);
  const extra = Number.isFinite(sludge) ? Math.max(0, Math.trunc(sludge)) : 0;
  return base + extra;
}

export function applyRageFailurePenalty(unit){
  const st = getStatus(unit);
  if (!st.rage) return 0;
  const raw = Number(st.rage?.v ?? 20);
  const dmg = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 20;
  if (dmg <= 0) return 0;
  unit.hp = Math.max(0, Number(unit.hp ?? 0) - dmg);
  return dmg;
}

export function checkCounter(defender, rng01){
  const st = getStatus(defender);
  if (!st.counter) return false;
  const p = Number(st.counter?.v ?? 30);
  if (!Number.isFinite(p) || p <= 0) return false;
  const roll = typeof rng01 === "function" ? rng01() : Math.random();
  return (roll * 100) < Math.max(0, Math.min(100, p));
}

export function hasBrainwash(unit){
  const st = getStatus(unit);
  return !!st.brainwash;
}

export function checkBrainwashSuccess(unit, rng01){
  const st = getStatus(unit);
  if (!st.brainwash) return true;
  const pRaw = Number(st.brainwash?.rate ?? st.brainwash?.p ?? st.brainwash?.v ?? 50);
  const p = Number.isFinite(pRaw) && pRaw > 1 ? pRaw : 50;
  const roll = typeof rng01 === "function" ? rng01() : Math.random();
  return (roll * 100) < Math.max(0, Math.min(100, p));
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

export function applyPoisonOnTurnStart(unit, rng01){
  if (!unit || typeof unit !== "object") return { active: false, cleared: false, damage: 0 };
  const st = getStatus(unit);
  if (!st.poison) return { active: false, cleared: false, damage: 0 };

  const roll = typeof rng01 === "function" ? rng01() : Math.random();
  if (roll < 0.5) {
    delete st.poison;
    return { active: true, cleared: true, damage: 0 };
  }

  const raw = Number(st.poison?.v ?? 10);
  const damage = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 10;
  unit.hp = Math.max(0, Number(unit.hp ?? 0) - damage);
  return { active: true, cleared: false, damage };
}

export function isTaimanDamageAllowed(defender, attacker){
  const st = getStatus(defender);
  if (!st.taiman) return true;
  if (!defender || !attacker || defender.id === attacker.id) return true;
  if (String(defender.owner || "") === String(attacker.owner || "")) return true;

  const dx = Number(attacker.x) - Number(defender.x);
  const dy = Number(attacker.y) - Number(defender.y);
  if (dx !== 0) return false;

  const owner = String(defender.owner || "").toUpperCase();
  if (owner === "A") return dy === -1;
  if (owner === "B") return dy === 1;
  return Math.abs(dy) === 1;
}

export const ASSIST_STATUS_KEYS = new Set([
  "armor",
  "evade",
  "hitUp",
  "aim",
  "powerUp",
  "power",
  "counter",
  "taiman",
]);

export function isAssistStatusKey(key){
  const k = normalizeStatusKey(key);
  return ASSIST_STATUS_KEYS.has(k);
}

export function blocksAssist(unit){
  return hasLostSoul(unit);
}

export function isAssistAction(act){
  if (!act) return false;
  const hp = Number(act.hpDelta ?? 0);
  const sp = Number(act.spDelta ?? 0);
  if ((Number.isFinite(hp) && hp > 0) || (Number.isFinite(sp) && sp > 0)) return true;
  if (act.changeAttr || act.attr || act.nextAttr) return true;
  const list = parseAddStatus(act.addStatus).map((s)=>normalizeStatusKey(String(s || "").replace(/^self\./i, "")));
  if (list.some((k)=>isAssistStatusKey(k))) return true;
  const tagMap = parseTags(act.tags);
  const tagKeys = Object.keys(tagMap || {}).map((k)=>normalizeStatusKey(k));
  return tagKeys.some((k)=>isAssistStatusKey(k));
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
    smell: "におい",
    poison: "毒",
    lostSoul: "失魂",
    blind: "盲目",
    evade: "回避",
    combo: "コンボ",
    followUp: "追撃",
    aim: "命中増加",
    hitUp: "命中増加",
    jinx: "命中低下",
    rage: "激怒",
    brainwash: "洗脳",
    sludge: "ヘドロ",
    counter: "カウンター",
    seal: "封印",
    powerUp: "攻撃増加",
    power: "攻撃増加",
    armor: "装甲",
    taiman: "タイマン",
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
    const nk = normalizeStatusKey(k);
    const entry = st[k] || st[nk] || {};
    const v = entry?.v;
    const name = m[nk] || m[k] || k;

    if (nk === "evade") return `${name}(${Number(v ?? 20)}%)`;
    if (nk === "hitUp" || nk === "aim") return `${name}(命中+${Number(v ?? 10)}%)`;
    if (nk === "powerUp" || nk === "power") return `${name}(HPダメ+${Number(v ?? 10)})`;
    if (nk === "armor") return `${name}(吸収${Number(v ?? 10)})`;
    if (nk === "jinx") return `${name}(命中-${Number(v ?? 10)}%)`;
    if (nk === "rage") return `${name}(失敗時HP-${Number(v ?? 20)})`;
    if (nk === "brainwash") return `${name}(50%)`;
    if (nk === "sludge") return `${name}(技コスト+${Number(v ?? 1)})`;
    if (nk === "counter") return `${name}(${Number(v ?? 30)}%/反撃10)`;
    if (nk === "seal") return `${name}`;
    if (nk === "bleed") return `${name}(移動時HP-${Number(v ?? 10)})`;
    if (nk === "smell") return `${name}(終了時SP-${Number(v ?? 10)})`;
    if (nk === "poison") return `${name}(開始時50%解除/失敗HP-${Number(v ?? 10)})`;
    if (nk === "fracture") return `${name}(移動不可)`;
    if (nk === "lostSoul") return `${name}(補助無効)`;
    if (nk === "taiman") return `${name}(正面限定)`;
    return v != null && v !== true ? `${name}(${v})` : `${name}`;
  }).join(" / ");
}
// game_state.js
export function isAllySupportAction(act){
  if (!act) return false;

  // 回復系
  const hp = Number(act.hpDelta ?? act.healHp ?? 0);
  const sp = Number(act.spDelta ?? act.healSp ?? 0);
  if (hp > 0 || sp > 0) return true;

  const list = parseAddStatus(act.addStatus);
  const tagMap = parseTags(act.tags);

  // 味方支援っぽいステータス
  const buffKeys = new Set(["hitUp","powerUp","armor","evade","followUp","combo"]);

  for (const nameRaw of list){
    let name = String(nameRaw).trim();
    if (!name) continue;
    if (name.startsWith("self.")) continue;
    if (name.startsWith("target.")) name = name.slice("target.".length);

    if (buffKeys.has(name)) return true;
  }

  // tagsで明示してたら最優先（将来拡張）
  if (tagMap?.target === "ally" || tagMap?.target === "friend") return true;

  return false;
}

// =====================
// ★追加：封印(seal) 判定
// - seal中は「攻撃技」を禁止
// - 攻撃技 = hpDelta/spDeltaがマイナス もしくは “デバフ付与”
// =====================

export function hasSeal(unit){
  const st = getStatus(unit);
  return !!st.seal; // {v:1} でも true でもOK
}

// CSV/ +区切りなどを配列化（parseAddStatus/parseTagsは既存を使う）
function _lowerKeysFromAct(act){
  const list = parseAddStatus(act?.addStatus).map(s=>String(s||"").trim().toLowerCase());
  const tagMap = parseTags(act?.tags);
  const tagKeys = Object.keys(tagMap || {}).map(k=>String(k||"").trim().toLowerCase());
  return { list, tagKeys };
}

export function isOffensiveAction(act){
  if (!act) return false;

  // ① 純粋ダメージ
  const hp = Number(act.hpDelta ?? 0);
  const sp = Number(act.spDelta ?? 0);
  if ((Number.isFinite(hp) && hp < 0) || (Number.isFinite(sp) && sp < 0)) return true;

  // ② デバフ付与（ここがあなたの「デバフは攻撃扱い」）
  // ここに“攻撃扱いにしたい状態”を列挙
  const DEBUFF = new Set([
    "jinx", "bleed", "fracture", "blind", "smell", "poison", "lostsoul",
    "knockback", "rage", "brainwash", "sludge",
  ]);

  const { list, tagKeys } = _lowerKeysFromAct(act);

  // addStatus にデバフが入ってたら攻撃扱い
  if (list.some(k => DEBUFF.has(k))) return true;

  // kb2/kb3…タグも攻撃扱い（あなたの方針）
  if (tagKeys.some(k => /^kb\d+$/i.test(k))) return true;

  // tags に debuff が明示されてる場合（例: "bleed" を tags で書く人用）
  if (tagKeys.some(k => DEBUFF.has(k))) return true;

  return false;
}

// 封印中にその技を使っていいか
export function canUseActionByStatus(unit, act){
  if (!hasSeal(unit)) return true;
  return !isOffensiveAction(act);
}

export function expireTurnBuffsAll(st, currentTurnSeq){
  if (!st) return 0;
  const units = st.units || [];
  let removed = 0;

  for (const u of units){
    if (!u || typeof u !== "object") continue;
    const s = getStatus(u);

    for (const key of TURN_BUFF_KEYS){
      const ent = s?.[key];
      if (!ent) continue;

      // ★付与ターンと違うなら削除（= 次ターン開始で消える）
      if (ent.turnSeq != null && currentTurnSeq != null && ent.turnSeq !== currentTurnSeq) {
        delete s[key];
        removed++;
      } else {
        // turnSeq が無い古いデータは「安全側」で消す（好みで）
        // 「次ターンで必ず消える」を厳密にしたいなら消す：
        // delete s[key]; removed++;
      }
    }
  }
  return removed;
}
