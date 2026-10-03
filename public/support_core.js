// public/support_core.js
// v2.1.2 - Support Card Core (extended)
// - effect table (1-20:A, 21-50:B...) supported
// - fail also consumes + pays (kept)
// - swapPos: needs 2 units
// - moveTo: needs unit + cell (optional maxDist)
// - IMPORTANT: panic is treated as kill progress (anti-double via countedAsKill)
//
// Added in v2.1.2:
// - powerUp is "flat" stored in status.powerUp (match game.js v2.1.1)
// - new types: manaUp / grantEvade
// - generic use restrictions (conditions): attr / mana / hp/sp / status
// - generic drawbacks: discard / mill / selfHp/selfSp damage
//   * restrictions: if not satisfied => ok:false (no consume/pay)
//   * drawbacks: if playable => ALWAYS applied regardless of hit/fail

import {
  drawCards,
  clearStatuses,
  normalizeStatusKey,
  isTaimanDamageAllowed,
  blocksAssist,
  isAssistStatusKey,
} from "./game_state.js?v=20260904_status_rules1";
import { normalizeMana, spendMana } from "./game_core.js?v=20260627_mana1";

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
export function roll1to100(rand = Math.random) {
  return Math.floor(rand() * 100) + 1;
}
function safeArr(a) {
  return Array.isArray(a) ? a : [];
}
function safeObj(o) {
  return o && typeof o === "object" && !Array.isArray(o) ? o : {};
}
function asInt(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function asStr(x, def = "") {
  const s = x == null ? "" : String(x);
  return s.trim() || def;
}
function asBool(x, def = false) {
  if (x === true) return true;
  if (x === false) return false;
  if (x == null) return def;
  const s = String(x).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

export function isSupportCard(def) {
  return String(def?.kind || "").toLowerCase() === "support";
}

function cardNameFromDefs(cardDefs, cardId) {
  return cardDefs?.[cardId]?.name || cardId;
}

function statusKeyOf(key) {
  try {
    return normalizeStatusKey(key) || String(key ?? "").trim();
  } catch {
    return String(key ?? "").trim();
  }
}

function unitHasStatus(unit, key) {
  const want = statusKeyOf(key);
  if (!unit || !want) return false;
  const st = safeObj(unit.status);
  return Object.keys(st).some(
    (k) => statusKeyOf(k) === want && st[k] != null && st[k] !== false,
  );
}

function assistBlockedForTarget(unit) {
  try {
    return typeof blocksAssist === "function" && blocksAssist(unit);
  } catch {
    return unitHasStatus(unit, "lostSoul");
  }
}

function taimanBlocksDamage(target, caster) {
  if (!unitHasStatus(target, "taiman")) return false;
  if (!caster) return true;
  try {
    return !isTaimanDamageAllowed(target, caster);
  } catch {
    return true;
  }
}

function isAssistStatusForSupport(key) {
  const k = statusKeyOf(key);
  try {
    return typeof isAssistStatusKey === "function" && isAssistStatusKey(k);
  } catch {
    return ["armor", "evade", "hitUp", "aim", "powerUp", "power", "counter", "taiman"].includes(k);
  }
}

function logAssistBlocked(logLines, cardDefs, target) {
  logLines.push(
    `  → 失魂：${cardNameFromDefs(cardDefs, target?.cardId)} は補助効果を受けない`,
  );
}

function findUnit(units, id) {
  return safeArr(units).find((u) => u && u.id === id) || null;
}
function isAlive(u) {
  return !!u && Number(u.hp) > 0;
}
function isOccupied(units, x, y) {
  return safeArr(units).some(
    (u) => isAlive(u) && Number(u.x) === x && Number(u.y) === y,
  );
}

// pick a payer unit for self-damage drawback
function pickPayerUnit(units, seat, preferUnit = null) {
  if (preferUnit && isAlive(preferUnit) && preferUnit.owner === seat)
    return preferUnit;
  const list = safeArr(units).filter((u) => isAlive(u) && u.owner === seat);
  return list[0] || null;
}

// --- kill helpers (panic counts as kill) ---
function countKillIfNeeded(
  target,
  killerSeat,
  kills,
  logLines,
  cardDefs,
  reason = "撃破",
) {
  if (!target || !kills) return;
  if (target.countedAsKill) return;
  target.countedAsKill = true;
  kills[killerSeat] = (kills[killerSeat] ?? 0) + 1;
  if (logLines)
    logLines.push(
      `[${killerSeat}] ${reason}：${cardNameFromDefs(cardDefs, target.cardId)}`,
    );
}
function setPanicAndCountIfNeeded(
  target,
  killerSeat,
  kills,
  logLines,
  cardDefs,
  reason = "パニック撃破",
) {
  if (!target) return;
  if (Number(target.sp) <= 0 && Number(target.hp) > 0) {
    const was = !!target.panic;
    target.panic = true;
    if (!was)
      countKillIfNeeded(target, killerSeat, kills, logLines, cardDefs, reason);
  }
}

// ---------------------
// effect table resolver
// ---------------------
export function resolveSupportEffect(effectSpec, roll) {
  const spec = safeObj(effectSpec);
  const r = clamp(Number(roll), 1, 100);

  if (Array.isArray(spec.table)) {
    const rows = spec.table
      .map((x) => ({
        min: clamp(Number(x.min ?? 1), 1, 100),
        max: clamp(Number(x.max ?? 100), 1, 100),
        effect: x.effect ?? null,
        label: String(x.label ?? ""),
      }))
      .sort((a, b) => a.min - b.min);

    const hit = rows.find((x) => r >= x.min && r <= x.max) || null;
    const chosen = hit?.effect ?? null;
    const label = hit?.label || (hit ? `${hit.min}-${hit.max}` : "");
    const ok = !!chosen;
    return { ok, roll: r, chosen, label, mode: "table" };
  }

  const rate = clamp(Number(spec.rate ?? 100), 0, 100);
  const ok = r <= rate;
  return {
    ok,
    roll: r,
    chosen: ok ? spec : null,
    label: ok ? `成功(${rate}%)` : `失敗(${rate}%)`,
    mode: "rate",
  };
}

// =====================================================
// Restrictions (conditions) + Drawbacks (penalties)
// =====================================================
//
// effect.cond (alias: effect.condition / effect.restrict) supported
// effect.drawback (alias: effect.penalty / effect.cost2) supported
//
// cond supports (examples):
// {
//   "attr": "光"                 // target unit's attribute must be "光"
//   "attrIn": ["火","水"]        // OR
//   "mana": { "curMin":3 }       // target owner's mana.cur >= 3
//   "hp": { "min": 15 }          // target.hp >= 15
//   "hpPct": { "min": 50 }       // target.hp/maxHp >= 50 (%)
//   "status": { "hasAny":["bleed"], "lacksAll":["blind"] }
// }
//
// drawback supports:
// {
//   "discard": 1                 // discard N cards from caster hand (after playing this card)
//   "discardMode":"random|end"   // default random
//   "mill": 3                    // send top N from caster deck (banish)
//   "selfHp": 5                  // deal 5 HP damage to a payer unit (default: target if ally else first alive)
//   "selfSp": 5
// }
//
// Notes:
// - Restrictions are checked BEFORE consume/pay.
// - Drawbacks are checked for feasibility BEFORE consume/pay, then applied ALWAYS after consume/pay.

function getEffectCond(effectSpec) {
  const spec = safeObj(effectSpec);

  // よくある別名も吸収（CSV/手書きでブレるのを許す）
  return safeObj(
    spec.cond ||
      spec.condition ||
      spec.conditions || // ★追加
      spec.restrict ||
      spec.restriction || // ★追加
      spec.require || // ★追加
      spec.requires || // ★追加
      spec.req || // ★追加
      null,
  );
}
function getEffectDrawback(effectSpec) {
  const spec = safeObj(effectSpec);
  return safeObj(spec.drawback || spec.penalty || spec.cost2 || null);
}

function unitAttr(cardDefs, u) {
  const def = cardDefs?.[u?.cardId] || null;
  return asStr(u?.attrOverride ?? u?.attr ?? u?.type ?? def?.attr ?? def?.type, "");
}
function unitMaxHp(cardDefs, u) {
  const def = cardDefs?.[u?.cardId] || null;
  const n = asInt(def?.hp, 0);
  return n > 0 ? n : 9999;
}
function unitMaxSp(cardDefs, u) {
  const def = cardDefs?.[u?.cardId] || null;
  const n = asInt(def?.sp, 0);
  return n > 0 ? n : 9999;
}
function statusKeys(u) {
  const st = safeObj(u?.status);
  return Object.keys(st || {});
}

// Helper to read hp/sp values with common alias keys
function readHpSp(eff) {
  const e = safeObj(eff);
  // accept common key variations coming from CSV/manual edits
  const hpRaw =
    e.hp ?? e.HP ?? e.hpDmg ?? e.hpDamage ?? e.damageHp ?? e.dmgHp ?? 0;
  const spRaw =
    e.sp ?? e.SP ?? e.spDmg ?? e.spDamage ?? e.damageSp ?? e.dmgSp ?? 0;
  return {
    hp: Math.max(0, asInt(hpRaw, 0)),
    sp: Math.max(0, asInt(spRaw, 0)),
  };
}

function checkCondForTarget({ cond, cardDefs, mana, targetUnit }) {
  // If cond is empty => ok
  const c = safeObj(cond);
  if (!Object.keys(c).length) return { ok: true, reason: "" };

  const t = targetUnit || null;
  if (!t) {
    // Some cards might not need target, but conditions referencing target would fail safely
    // Allow condition that doesn't mention target-specific fields
    // If any target-specific condition exists, fail.
    const hasTargetSpecific =
      c.attr != null ||
      Array.isArray(c.attrIn) ||
      c.hp != null ||
      c.sp != null ||
      c.hpPct != null ||
      c.spPct != null ||
      c.status != null ||
      c.mana != null;
    if (hasTargetSpecific) return { ok: false, reason: "条件に対象が必要" };
    return { ok: true, reason: "" };
  }

  // ---- attribute restriction ----
  const attr = unitAttr(cardDefs, t);
  const needAttr = asStr(c.attr, "");
  const attrIn = Array.isArray(c.attrIn)
    ? c.attrIn.map((x) => asStr(x, "")).filter(Boolean)
    : [];
  if (needAttr && attr !== needAttr)
    return { ok: false, reason: `対象属性が${needAttr}ではない` };
  if (attrIn.length && !attrIn.includes(attr))
    return { ok: false, reason: `対象属性が範囲外` };

  // ---- mana restriction (based on target owner) ----
  if (c.mana && typeof c.mana === "object") {
    const m = safeObj(c.mana);
    const owner = asStr(m.seat, "targetOwner").toUpperCase();
    const who =
      owner === "A" || owner === "B"
        ? owner
        : owner === "CASTER"
          ? null
          : "targetOwner";

    const seatForMana =
      who === "A" || who === "B" ? who : owner === "CASTER" ? null : t.owner;

    // if CASTER is requested, we can't know here; caller will pass explicit seat check if needed.
    if (seatForMana) {
      const cur = asInt(mana?.[seatForMana]?.cur, 0);
      const max = asInt(mana?.[seatForMana]?.max, 0);
      const curMin = m.curMin == null ? null : asInt(m.curMin, 0);
      const curMax = m.curMax == null ? null : asInt(m.curMax, 0);
      const maxMin = m.maxMin == null ? null : asInt(m.maxMin, 0);
      const maxMax = m.maxMax == null ? null : asInt(m.maxMax, 0);

      if (curMin != null && cur < curMin)
        return {
          ok: false,
          reason: `対象マナ(cur)不足 cur=${cur} min=${curMin}`,
        };
      if (curMax != null && cur > curMax)
        return {
          ok: false,
          reason: `対象マナ(cur)超過 cur=${cur} max=${curMax}`,
        };
      if (maxMin != null && max < maxMin)
        return {
          ok: false,
          reason: `対象マナ(max)不足 max=${max} min=${maxMin}`,
        };
      if (maxMax != null && max > maxMax)
        return {
          ok: false,
          reason: `対象マナ(max)超過 max=${max} max=${maxMax}`,
        };
    }
  }

  // ---- hp/sp absolute restrictions ----
  if (c.hp && typeof c.hp === "object") {
    const hpC = safeObj(c.hp);
    const min = hpC.min == null ? null : asInt(hpC.min, 0);
    const max = hpC.max == null ? null : asInt(hpC.max, 0);
    const v = asInt(t.hp, 0);
    if (min != null && v < min)
      return { ok: false, reason: `対象HP不足 hp=${v} min=${min}` };
    if (max != null && v > max)
      return { ok: false, reason: `対象HP超過 hp=${v} max=${max}` };
  }
  if (c.sp && typeof c.sp === "object") {
    const spC = safeObj(c.sp);
    const min = spC.min == null ? null : asInt(spC.min, 0);
    const max = spC.max == null ? null : asInt(spC.max, 0);
    const v = asInt(t.sp, 0);
    if (min != null && v < min)
      return { ok: false, reason: `対象SP不足 sp=${v} min=${min}` };
    if (max != null && v > max)
      return { ok: false, reason: `対象SP超過 sp=${v} max=${max}` };
  }

  // ---- hp/sp percent restrictions ----
  if (c.hpPct && typeof c.hpPct === "object") {
    const p = safeObj(c.hpPct);
    const min = p.min == null ? null : asInt(p.min, 0);
    const max = p.max == null ? null : asInt(p.max, 100);
    const mh = unitMaxHp(cardDefs, t);
    const pct = mh > 0 ? Math.floor((asInt(t.hp, 0) * 100) / mh) : 0;
    if (min != null && pct < min)
      return { ok: false, reason: `対象HP%不足 hp%=${pct} min=${min}` };
    if (max != null && pct > max)
      return { ok: false, reason: `対象HP%超過 hp%=${pct} max=${max}` };
  }
  if (c.spPct && typeof c.spPct === "object") {
    const p = safeObj(c.spPct);
    const min = p.min == null ? null : asInt(p.min, 0);
    const max = p.max == null ? null : asInt(p.max, 100);
    const ms = unitMaxSp(cardDefs, t);
    const pct = ms > 0 ? Math.floor((asInt(t.sp, 0) * 100) / ms) : 0;
    if (min != null && pct < min)
      return { ok: false, reason: `対象SP%不足 sp%=${pct} min=${min}` };
    if (max != null && pct > max)
      return { ok: false, reason: `対象SP%超過 sp%=${pct} max=${max}` };
  }

  // ---- status restrictions ----
  if (c.status && typeof c.status === "object") {
    const sc = safeObj(c.status);
    const keys = statusKeys(t);

    const hasAny = Array.isArray(sc.hasAny)
      ? sc.hasAny.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    const hasAll = Array.isArray(sc.hasAll)
      ? sc.hasAll.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    const lacksAny = Array.isArray(sc.lacksAny)
      ? sc.lacksAny.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    const lacksAll = Array.isArray(sc.lacksAll)
      ? sc.lacksAll.map((x) => asStr(x, "")).filter(Boolean)
      : [];

    if (hasAny.length && !hasAny.some((k) => keys.includes(k)))
      return { ok: false, reason: `状態条件未達(hasAny)` };
    if (hasAll.length && !hasAll.every((k) => keys.includes(k)))
      return { ok: false, reason: `状態条件未達(hasAll)` };
    if (lacksAny.length && lacksAny.some((k) => keys.includes(k)))
      return { ok: false, reason: `状態条件未達(lacksAny)` };
    if (lacksAll.length && !lacksAll.every((k) => !keys.includes(k)))
      return { ok: false, reason: `状態条件未達(lacksAll)` };
  }

  return { ok: true, reason: "" };
}

function checkCondForTargetMany({ cond, cardDefs, mana, targetUnits }) {
  const list = safeArr(targetUnits).filter(Boolean);
  const c = safeObj(cond);

  // 条件が空なら常にOK
  if (!Object.keys(c).length) return { ok: true, reason: "" };

  // 対象依存の条件が無ければOK
  const hasTargetSpecific =
    c.attr != null ||
    Array.isArray(c.attrIn) ||
    c.hp != null ||
    c.sp != null ||
    c.hpPct != null ||
    c.spPct != null ||
    c.status != null ||
    c.mana != null;

  if (!list.length) {
    return hasTargetSpecific
      ? { ok: false, reason: "条件に対象が必要" }
      : { ok: true, reason: "" };
  }

  // 全対象が条件を満たす必要あり
  for (const u of list) {
    const r = checkCondForTarget({
      cond,
      cardDefs,
      mana,
      targetUnit: u,
    });
    if (!r.ok) {
      const name = cardNameFromDefs(cardDefs, u.cardId);
      return { ok: false, reason: `${name}: ${r.reason}` };
    }
  }

  return { ok: true, reason: "" };
}

function checkCondForCasterMana({ cond, mana, seat }) {
  // Optional: cond.mana.seat === "CASTER"
  const c = safeObj(cond);
  if (!c.mana || typeof c.mana !== "object") return { ok: true, reason: "" };
  const m = safeObj(c.mana);
  const owner = asStr(m.seat, "targetOwner").toUpperCase();
  if (owner !== "CASTER") return { ok: true, reason: "" };

  const cur = asInt(mana?.[seat]?.cur, 0);
  const max = asInt(mana?.[seat]?.max, 0);
  const curMin = m.curMin == null ? null : asInt(m.curMin, 0);
  const curMax = m.curMax == null ? null : asInt(m.curMax, 0);
  const maxMin = m.maxMin == null ? null : asInt(m.maxMin, 0);
  const maxMax = m.maxMax == null ? null : asInt(m.maxMax, 0);

  if (curMin != null && cur < curMin)
    return { ok: false, reason: `自分マナ(cur)不足 cur=${cur} min=${curMin}` };
  if (curMax != null && cur > curMax)
    return { ok: false, reason: `自分マナ(cur)超過 cur=${cur} max=${curMax}` };
  if (maxMin != null && max < maxMin)
    return { ok: false, reason: `自分マナ(max)不足 max=${max} min=${maxMin}` };
  if (maxMax != null && max > maxMax)
    return { ok: false, reason: `自分マナ(max)超過 max=${max} max=${maxMax}` };
  return { ok: true, reason: "" };
}

function checkDrawbackFeasible({
  drawback,
  hands,
  decks,
  seat,
  units,
  preferUnit,
}) {
  const d = safeObj(drawback);
  if (!Object.keys(d).length) return { ok: true, reason: "" };

  const discardN = Math.max(0, asInt(d.discard, 0));
  if (discardN > 0) {
    const myHand = safeArr(hands?.[seat]);
    // after consuming this card, remaining hand count must be >= discardN
    // (support card itself will be removed on play)
    if (myHand.length - 1 < discardN)
      return { ok: false, reason: `手札が足りない(捨てる:${discardN})` };
  }

  const millN = Math.max(0, asInt(d.mill, 0));
  if (millN > 0) {
    const myDeck = safeArr(decks?.[seat]);
    if (myDeck.length < millN)
      return { ok: false, reason: `山札が足りない(送る:${millN})` };
  }

  const selfHp = Math.max(0, asInt(d.selfHp, 0));
  const selfSp = Math.max(0, asInt(d.selfSp, 0));
  if (selfHp > 0 || selfSp > 0) {
    const payer = pickPayerUnit(units, seat, preferUnit);
    if (!payer)
      return { ok: false, reason: "自分ユニットがいない(自傷デメリット不可)" };
    // We allow reducing to 0 (may kill). If you want "must survive", add a flag later.
  }

  return { ok: true, reason: "" };
}

function otherSeat(seat) {
  return seat === "A" ? "B" : "A";
}

function normalizeHandLocks(raw) {
  const src = safeObj(raw);
  const out = { A: [], B: [] };
  for (const seatKey of ["A", "B"]) {
    const list = safeArr(src[seatKey]);
    out[seatKey] = list
      .map((x) => safeObj(x))
      .map((x) => ({
        cardId: asStr(x.cardId, ""),
        count: Math.max(1, asInt(x.count, 1)),
        releaseSeat: asStr(x.releaseSeat, ""),
        source: asStr(x.source, ""),
        at: asInt(x.at, Date.now()),
      }))
      .filter((x) => x.cardId && x.releaseSeat);
  }
  return out;
}

function lockCountForCard(handLocks, seatKey, cardId) {
  return safeArr(handLocks?.[seatKey])
    .filter((x) => asStr(x.cardId, "") === cardId)
    .reduce((sum, x) => sum + Math.max(1, asInt(x.count, 1)), 0);
}

function pickSeatFromEffect(eff, casterSeat, fallback = casterSeat) {
  const raw = asStr(
    eff?.targetSeat ?? eff?.seat ?? eff?.who ?? eff?.targetPlayer,
    fallback,
  ).toLowerCase();
  if (raw === "a") return "A";
  if (raw === "b") return "B";
  if (raw === "self" || raw === "caster" || raw === "you") return casterSeat;
  if (raw === "enemy" || raw === "opponent" || raw === "foe")
    return otherSeat(casterSeat);
  return fallback === "enemy" ? otherSeat(casterSeat) : fallback;
}

function searchDeckCard({ decks, hands, seat, cardDefs, eff, searchCardId }) {
  const deck = safeArr(decks[seat]).slice();
  const hand = safeArr(hands[seat]).slice();
  const wanted = asStr(searchCardId ?? eff?.cardId ?? eff?.id ?? eff?.searchId, "");
  const kind = asStr(eff?.kind ?? eff?.cardKind, "").toLowerCase();
  const attr = asStr(eff?.attr, "");
  const rarity = asStr(eff?.rarity, "").toUpperCase();
  const text = asStr(eff?.nameIncludes ?? eff?.query ?? eff?.q, "").toLowerCase();

  const matches = (cardId) => {
    if (!cardId) return false;
    if (wanted && cardId !== wanted) return false;
    const def = cardDefs?.[cardId] || {};
    if (kind) {
      const k = asStr(def.kind || "unit", "unit").toLowerCase();
      if (kind === "unit") {
        if (k === "support" || k === "ex_support" || k === "exsupport") return false;
      } else if (k !== kind) return false;
    }
    if (attr && asStr(def.attr || def.type, "") !== attr) return false;
    if (rarity && asStr(def.rarity || "R", "R").toUpperCase() !== rarity) return false;
    if (text) {
      const hay = `${cardId} ${def.name || ""} ${def.desc || ""}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  };

  let idx = -1;
  if (asStr(eff?.pick, "").toLowerCase() === "top") {
    for (let i = deck.length - 1; i >= 0; i -= 1) {
      if (matches(deck[i])) {
        idx = i;
        break;
      }
    }
  } else {
    idx = deck.findIndex(matches);
  }

  if (idx < 0) return { ok: false, decks, hands, cardId: "" };
  const [cardId] = deck.splice(idx, 1);
  hand.push(cardId);
  return {
    ok: true,
    cardId,
    decks: { ...decks, [seat]: deck },
    hands: { ...hands, [seat]: hand },
  };
}

function setHandCardFaceDown({ hands, handLocks, seat, cardDefs, eff, sourceName }) {
  const targetSeat = pickSeatFromEffect(eff, seat, "enemy");
  const releaseSeat = pickSeatFromEffect(
    { targetSeat: eff?.releaseSeat ?? eff?.untilSeat },
    seat,
    seat,
  );
  const hand = safeArr(hands[targetSeat]);
  if (!hand.length) return { ok: false, targetSeat, cardId: "" };

  const wanted = asStr(eff?.cardId ?? eff?.id ?? "", "");
  const kind = asStr(eff?.kind ?? eff?.cardKind, "").toLowerCase();
  const attr = asStr(eff?.attr, "");
  const candidates = [];

  for (let i = 0; i < hand.length; i += 1) {
    const cardId = hand[i];
    if (!cardId) continue;
    if (wanted && cardId !== wanted) continue;
    const def = cardDefs?.[cardId] || {};
    if (kind) {
      const k = asStr(def.kind || "unit", "unit").toLowerCase();
      if (kind === "unit") {
        if (k === "support" || k === "ex_support" || k === "exsupport") continue;
      } else if (k !== kind) continue;
    }
    if (attr && asStr(def.attr || def.type, "") !== attr) continue;
    candidates.push({ i, cardId });
  }

  if (!candidates.length) return { ok: false, targetSeat, cardId: "" };
  const pick =
    asStr(eff?.pick, "random").toLowerCase() === "first"
      ? candidates[0]
      : candidates[Math.floor(Math.random() * candidates.length)];
  const nextLocks = normalizeHandLocks(handLocks);
  nextLocks[targetSeat].push({
    cardId: pick.cardId,
    count: Math.max(1, asInt(eff?.count ?? 1, 1)),
    releaseSeat,
    source: sourceName,
    at: Date.now(),
  });
  return { ok: true, targetSeat, releaseSeat, cardId: pick.cardId, handLocks: nextLocks };
}

function decrementHandLockForCard(handLocks, seatKey, cardId, count = 1) {
  const locks = normalizeHandLocks(handLocks);
  let left = Math.max(1, asInt(count, 1));
  locks[seatKey] = safeArr(locks[seatKey]).flatMap((lock) => {
    if (left <= 0 || asStr(lock.cardId, "") !== cardId) return [lock];
    const n = Math.max(1, asInt(lock.count, 1));
    const used = Math.min(left, n);
    left -= used;
    const remain = n - used;
    return remain > 0 ? [{ ...lock, count: remain }] : [];
  });
  return locks;
}

function discardHandCards({ hands, handLocks, discards, seat, eff }) {
  const targetSeat = pickSeatFromEffect(eff, seat, "enemy");
  const hand = safeArr(hands[targetSeat]);
  if (!hand.length) return { ok: false, targetSeat, cardIds: [], handLocks };

  const count = Math.max(1, asInt(eff?.count ?? eff?.n ?? 1, 1));
  const pool = hand.map((cardId, i) => ({ cardId, i })).filter((x) => x.cardId);
  const picked = [];
  while (pool.length && picked.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  picked.sort((a, b) => b.i - a.i);

  const nextDiscards = { ...(discards || {}) };
  nextDiscards.A = safeArr(nextDiscards.A).slice();
  nextDiscards.B = safeArr(nextDiscards.B).slice();
  let nextLocks = normalizeHandLocks(handLocks);
  const cardIds = [];

  for (const p of picked) {
    const [cardId] = hand.splice(p.i, 1);
    if (!cardId) continue;
    cardIds.push(cardId);
    nextDiscards[targetSeat].push(cardId);
    nextLocks = decrementHandLockForCard(nextLocks, targetSeat, cardId, 1);
  }

  return { ok: cardIds.length > 0, targetSeat, cardIds, hands, handLocks: nextLocks, discards: nextDiscards };
}

function normalizeSupportType(rawType, eff) {
  const t = asStr(rawType, "").toLowerCase();

  // alias: max mana up
  if (t === "manamaxup" || t === "manaupmax" || t === "manamax")
    return "manaUp";
  if (t === "search" || t === "decksearch" || t === "tutor")
    return "search";
  if (
    t === "changeattr" ||
    t === "setattr" ||
    t === "attrchange" ||
    t === "attributechange" ||
    t === "typechange" ||
    t === "属性変更"
  )
    return "changeAttr";
  if (
    t === "discardhand" ||
    t === "handdiscard" ||
    t === "discard" ||
    t === "gravehand" ||
    t === "trashhand" ||
    t === "手札を墓地へ"
  )
    return "discardHand";
  if (
    t === "setcard" ||
    t === "facedown" ||
    t === "cardset" ||
    t === "cardlock" ||
    t === "hidecard" ||
    t === "伏せ" ||
    t === "カードふせ"
  )
    return "setCard";

  // ここ増やせる
  return rawType;
}

function manaUpKind(eff) {
  const rawType = asStr(eff?.type, "").toLowerCase();
  const which = asStr(eff?.which ?? eff?.mode ?? eff?.kind, "cur").toLowerCase();

  if (
    which === "max" ||
    which === "maximum" ||
    which === "cap" ||
    rawType === "manamaxup" ||
    rawType === "manaupmax" ||
    rawType === "manamax"
  ) {
    return "max";
  }

  return "cur";
}
// =====================
// v3 helpers: multi target / auto target / group move
// =====================

function uniqIds(arr) {
  const seen = new Set();
  const out = [];
  for (const x of safeArr(arr)) {
    const id = asStr(x, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function findUnits(units, ids) {
  const map = new Map(safeArr(units).map((u) => [u?.id, u]));
  return uniqIds(ids)
    .map((id) => map.get(id))
    .filter(Boolean);
}

function aliveUnits(units) {
  return safeArr(units).filter((u) => isAlive(u));
}

function boardSizeFromUnits(units, eff) {
  const W = Math.max(1, asInt(eff?.W, 5));
  const H = Math.max(1, asInt(eff?.H, 7));
  return { W, H };
}

function unitMaxHpFromDefs(cardDefs, u) {
  return Math.max(0, asInt(cardDefs?.[u?.cardId]?.hp, 0));
}

function unitMaxSpFromDefs(cardDefs, u) {
  return Math.max(0, asInt(cardDefs?.[u?.cardId]?.sp, 0));
}

function sortUnitsByPick(list, pick, seat, cardDefs) {
  const a = safeArr(list).slice();
  const p = asStr(pick, "first").toLowerCase();

  if (p === "random") {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  if (p === "lowesthp") {
    return a.sort((x, y) => asInt(x.hp, 0) - asInt(y.hp, 0));
  }
  if (p === "highesthp") {
    return a.sort((x, y) => asInt(y.hp, 0) - asInt(x.hp, 0));
  }
  if (p === "lowestsp") {
    return a.sort((x, y) => asInt(x.sp, 0) - asInt(y.sp, 0));
  }
  if (p === "highestsp") {
    return a.sort((x, y) => asInt(y.sp, 0) - asInt(x.sp, 0));
  }

  // front / back
  // A は y が小さいほど前、B は y が大きいほど前 とみなす
  if (p === "front") {
    return a.sort((x, y) => {
      const fx = x.owner === "A" ? asInt(x.y, 0) : -asInt(x.y, 0);
      const fy = y.owner === "A" ? asInt(y.y, 0) : -asInt(y.y, 0);
      return fx - fy;
    });
  }
  if (p === "back") {
    return a.sort((x, y) => {
      const fx = x.owner === "A" ? -asInt(x.y, 0) : asInt(x.y, 0);
      const fy = y.owner === "A" ? -asInt(y.y, 0) : asInt(y.y, 0);
      return fx - fy;
    });
  }

  if (p === "leftright") {
    return a.sort((x, y) => asInt(x.x, 0) - asInt(y.x, 0));
  }

  return a;
}

function filterUnitsByTargetGroup(units, seat, caster, targetGroup) {
  const g = asStr(targetGroup, "").toLowerCase();
  const all = aliveUnits(units);

  if (!g || g === "single") return all;

  if (g === "enemy" || g === "allenemy") {
    return all.filter((u) => u.owner && u.owner !== seat);
  }
  if (g === "ally" || g === "allally") {
    return all.filter((u) => u.owner === seat);
  }
  if (g === "self") {
    return caster ? all.filter((u) => u.id === caster.id) : [];
  }
  if (g === "otherself") {
    return caster
      ? all.filter((u) => u.owner === seat && u.id !== caster.id)
      : all.filter((u) => u.owner === seat);
  }
  if (g === "any" || g === "all") {
    return all;
  }

  return all;
}

function filterUnitsByCondLite(list, eff, cardDefs) {
  const out = [];
  const cond = safeObj(eff?.cond);

  for (const u of safeArr(list)) {
    let ok = true;

    const attr = asStr(unitAttr(cardDefs, u), "");
    const needAttr = asStr(cond.attr, "");
    const attrIn = Array.isArray(cond.attrIn)
      ? cond.attrIn.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    if (needAttr && attr !== needAttr) ok = false;
    if (attrIn.length && !attrIn.includes(attr)) ok = false;

    if (cond.hp && typeof cond.hp === "object") {
      const min = cond.hp.min == null ? null : asInt(cond.hp.min, 0);
      const max = cond.hp.max == null ? null : asInt(cond.hp.max, 0);
      const v = asInt(u.hp, 0);
      if (min != null && v < min) ok = false;
      if (max != null && v > max) ok = false;
    }

    if (cond.sp && typeof cond.sp === "object") {
      const min = cond.sp.min == null ? null : asInt(cond.sp.min, 0);
      const max = cond.sp.max == null ? null : asInt(cond.sp.max, 0);
      const v = asInt(u.sp, 0);
      if (min != null && v < min) ok = false;
      if (max != null && v > max) ok = false;
    }

    if (cond.hpPct && typeof cond.hpPct === "object") {
      const min = cond.hpPct.min == null ? null : asInt(cond.hpPct.min, 0);
      const max = cond.hpPct.max == null ? null : asInt(cond.hpPct.max, 100);
      const mh = unitMaxHp(cardDefs, u);
      const pct = mh > 0 ? Math.floor((asInt(u.hp, 0) * 100) / mh) : 0;
      if (min != null && pct < min) ok = false;
      if (max != null && pct > max) ok = false;
    }

    if (cond.spPct && typeof cond.spPct === "object") {
      const min = cond.spPct.min == null ? null : asInt(cond.spPct.min, 0);
      const max = cond.spPct.max == null ? null : asInt(cond.spPct.max, 100);
      const ms = unitMaxSpFromDefs(cardDefs, u);
      const pct = ms > 0 ? Math.floor((asInt(u.sp, 0) * 100) / ms) : 0;
      if (min != null && pct < min) ok = false;
      if (max != null && pct > max) ok = false;
    }

    const sc = safeObj(cond.status);
    const keys = Object.keys(safeObj(u.status));
    const hasAny = Array.isArray(sc.hasAny)
      ? sc.hasAny.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    const hasAll = Array.isArray(sc.hasAll)
      ? sc.hasAll.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    const lacksAny = Array.isArray(sc.lacksAny)
      ? sc.lacksAny.map((x) => asStr(x, "")).filter(Boolean)
      : [];
    const lacksAll = Array.isArray(sc.lacksAll)
      ? sc.lacksAll.map((x) => asStr(x, "")).filter(Boolean)
      : [];

    if (hasAny.length && !hasAny.some((k) => keys.includes(k))) ok = false;
    if (hasAll.length && !hasAll.every((k) => keys.includes(k))) ok = false;
    if (lacksAny.length && lacksAny.some((k) => keys.includes(k))) ok = false;
    if (lacksAll.length && !lacksAll.every((k) => !keys.includes(k)))
      ok = false;

    if (ok) out.push(u);
  }

  return out;
}

function resolveEffectTargets({
  units,
  seat,
  caster,
  cardDefs,
  eff,
  targetUnitId = null,
  targetUnitId2 = null,
  targetUnitIds = null,
}) {
  // 1) 明示複数指定が最優先
  const explicitMany = findUnits(units, targetUnitIds);
  if (explicitMany.length) return explicitMany;

  // 2) 従来の単体/2体
  const explicit = [];
  if (targetUnitId) {
    const u = findUnit(units, targetUnitId);
    if (u) explicit.push(u);
  }
  if (targetUnitId2) {
    const u = findUnit(units, targetUnitId2);
    if (u && !explicit.some((x) => x.id === u.id)) explicit.push(u);
  }
  if (explicit.length) return explicit;

  // 3) 自動選択
  const group = asStr(eff?.targetGroup, "");
  let pool = filterUnitsByTargetGroup(units, seat, caster, group);
  pool = filterUnitsByCondLite(pool, eff, cardDefs);

  const pick = asStr(eff?.pick, "first");
  pool = sortUnitsByPick(pool, pick, seat, cardDefs);

  const countRaw = eff?.count == null ? 1 : asInt(eff.count, 1);
  const count = Math.max(1, countRaw);

  return pool.slice(0, count);
}

function nextYByMode(u, mode, dist) {
  const d = Math.max(1, asInt(dist, 1));
  const m = asStr(mode, "retreat").toLowerCase();

  // Aは上に進軍(-y)、Bは下に進軍(+y)
  if (m === "retreat") {
    return u.owner === "A" ? asInt(u.y, 0) + d : asInt(u.y, 0) - d;
  }
  if (m === "advance") {
    return u.owner === "A" ? asInt(u.y, 0) - d : asInt(u.y, 0) + d;
  }

  return asInt(u.y, 0);
}

function canPlaceUnit(units, selfUnit, x, y, W, H) {
  if (x < 0 || x >= W || y < 0 || y >= H) return false;
  return !safeArr(units).some(
    (u) =>
      u &&
      u !== selfUnit &&
      isAlive(u) &&
      asInt(u.x, -999) === x &&
      asInt(u.y, -999) === y,
  );
}

function tryShiftUnitY(units, u, mode, dist, eff) {
  const { W, H } = boardSizeFromUnits(units, eff);
  const x = asInt(u.x, 0);
  let y = asInt(u.y, 0);
  let moved = 0;

  for (let i = 0; i < Math.max(1, asInt(dist, 1)); i++) {
    const nextY = nextYByMode({ ...u, y }, mode, 1);
    if (!canPlaceUnit(units, u, x, nextY, W, H)) break;
    y = nextY;
    moved++;
  }

  if (moved > 0) {
    u.y = y;
  }
  return moved;
}

function applyStatusEntry(target, key, v, turns = 1) {
  target.status = safeObj(target.status);
  const nk = statusKeyOf(key);
  if (!nk) return;
  const prev = safeObj(target.status[nk]);
  target.status[nk] = {
    v: clamp(asInt(prev.v, 0) + asInt(v, 1), 0, 999),
    turns: Math.max(asInt(prev.turns, 0), Math.max(1, asInt(turns, 1))),
  };
}

function applyDrawback({
  drawback,
  seat,
  hands,
  decks,
  units,
  cardDefs,
  logLines,
  rand,
  preferUnit = null,
  kills,
}) {
  const d = safeObj(drawback);
  if (!Object.keys(d).length) return;

  // discard
  const discardN = Math.max(0, asInt(d.discard, 0));
  if (discardN > 0) {
    const mode = asStr(d.discardMode, "random").toLowerCase(); // random|end
    const myHand = safeArr(hands?.[seat]).slice();

    // discard from current hand (support card already removed)
    const removed = [];
    for (let i = 0; i < discardN; i++) {
      if (!myHand.length) break;
      let idx = 0;
      if (mode === "end") idx = myHand.length - 1;
      else idx = Math.floor(rand() * myHand.length); // random
      const [cid] = myHand.splice(idx, 1);
      if (cid) removed.push(cid);
    }
    hands[seat] = myHand;

    if (removed.length) {
      const names = removed
        .map((id) => cardNameFromDefs(cardDefs, id))
        .join(",");
      logLines.push(
        `[${seat}] デメリット：手札を捨てた x${removed.length}（${names}）`,
      );
    }
  }

  // mill
  const millN = Math.max(0, asInt(d.mill, 0));
  if (millN > 0) {
    const myDeck = safeArr(decks?.[seat]).slice();
    const sent = [];
    for (let i = 0; i < millN; i++) {
      if (!myDeck.length) break;
      const top = myDeck.pop(); // your deck representation: pop() is "top" in many parts of your codebase
      if (top) sent.push(top);
    }
    decks[seat] = myDeck;

    if (sent.length) {
      logLines.push(
        `[${seat}] デメリット：山札の上から${sent.length}枚を送った`,
      );
    }
  }

  // self damage
  const selfHp = Math.max(0, asInt(d.selfHp, 0));
  const selfSp = Math.max(0, asInt(d.selfSp, 0));
  if (selfHp > 0 || selfSp > 0) {
    const payer = pickPayerUnit(units, seat, preferUnit);
    if (payer) {
      if (selfHp > 0) payer.hp = Math.max(0, asInt(payer.hp, 0) - selfHp);
      if (selfSp > 0) payer.sp = Math.max(0, asInt(payer.sp, 0) - selfSp);

      logLines.push(
        `[${seat}] デメリット：${cardNameFromDefs(cardDefs, payer.cardId)} に HP-${selfHp} SP-${selfSp}`,
      );

      // ★ここから追加：自傷でのパニック/死亡は「相手の撃破扱い」
      const enemy = otherSeat(seat);

      // SP0でHP>0 → パニック撃破（あなたの仕様だとキル進行）
      setPanicAndCountIfNeeded(
        payer,
        enemy,
        kills,
        logLines,
        cardDefs,
        "パニック撃破(自傷)",
      );

      // HP0 → 撃破
      if (asInt(payer.hp, 0) <= 0) {
        payer.hp = 0;
        countKillIfNeeded(
          payer,
          enemy,
          kills,
          logLines,
          cardDefs,
          "撃破(自傷)",
        );
      }
    }
  }
}

// ---------------------
// apply support (call inside transaction)
// ---------------------
export function applySupport({
  s,
  seat,
  cardDefs,
  supportCardId,
  supportHandIndex,
  casterUnitId = null,
  targetUnitId = null,
  targetUnitId2 = null,
  targetUnitIds = null,
  targetCell = null,
  searchCardId = null,
  rand = Math.random,
}) {
  const mana = normalizeMana(s.mana);

  const hands = { ...(s.hands || { A: [], B: [] }) };
  hands.A = safeArr(hands.A).slice();
  hands.B = safeArr(hands.B).slice();

  const decks = { ...(s.decks || { A: [], B: [] }) };
  decks.A = safeArr(decks.A).slice();
  decks.B = safeArr(decks.B).slice();
  let discards = { ...(s.discards || { A: [], B: [] }) };
  discards.A = safeArr(discards.A).slice();
  discards.B = safeArr(discards.B).slice();
  let handLocks = normalizeHandLocks(s.handLocks);

  const units = safeArr(s.units).map((u) => ({
    ...u,
    status: safeObj(u.status),
  }));
  const logLines = safeArr(s.log).slice();
  const kills = { ...(s.kills || { A: 0, B: 0 }) };

  const def = cardDefs?.[supportCardId];
  if (!def) return { ok: false, reason: "support card def missing" };
  if (!isSupportCard(def)) return { ok: false, reason: "not a support card" };

  // ensure hand index matches
  const myHand0 = hands[seat] || [];
  const cidAt = myHand0[supportHandIndex];
  if (cidAt !== supportCardId) {
    const alt = myHand0.findIndex((x) => x === supportCardId);
    if (alt < 0) return { ok: false, reason: "support card not in hand" };
    supportHandIndex = alt;
  }

  const baseCost = asInt(def.cost, 0);
  if (mana[seat].cur < baseCost) return { ok: false, reason: "マナ不足" };

  // roll target refs (for restrictions / drawbacks feasibility)
  const t1 = targetUnitId ? findUnit(units, targetUnitId) : null;
  const t2 = targetUnitId2 ? findUnit(units, targetUnitId2) : null;
  const caster = casterUnitId ? findUnit(units, casterUnitId) : null;
  // IMPORTANT: determine chosen effect type requirement (for target needs)
  // We need to know type for target requirement check, but for table we know after roll.
  // However, restrictions may depend on the final chosen effect.
  // Strategy:
  // - do a pre-roll "peek" by rolling now (still not consuming/paying)
  // - if fail => still playable; restrictions/drawbacks can still block, but chosen is null
  // - for table mode: chosen depends on roll; we can check restrictions against chosen effect
  const roll = roll1to100(rand);
  const res = resolveSupportEffect(def.effect, roll);

  const supportName = cardNameFromDefs(cardDefs, supportCardId);

  const lastSupportRoll = {
    at: Date.now(),
    r: res.roll,
    label: res.label,
    ok: !!res.ok,
    cardId: supportCardId,
    cardName: supportName,
    from: seat,
    targetId: targetUnitId || null,
    targetId2: targetUnitId2 || null,
    targetCell: targetCell || null,
  };

  // if chosen is null, we still allow play (it will fail and consume/pay)
  const effChosen = safeObj(res.chosen || {});
  const effForRules = res.chosen ? effChosen : safeObj(def.effect); // fallback to base spec
  const typeForRules = normalizeSupportType(
    asStr(effForRules.type, ""),
    effForRules,
  );
  const needUnit = new Set([
    "dmg",
    "heal",
    "modRate",
    "bounce",
    "powerUp",
    "cleanse",
    "moveTo",
    "grantEvade",
    "changeAttr",
    "addStatus",
    "lostSoul",
    "shiftGroup",
  ]);
  const needTwoUnits = new Set(["swapPos"]);
  const needCell = new Set(["moveTo"]);

  // Target requirement check should be based on type if chosen has type, otherwise fall back to "maybe needs target".
  // If it fails later (because chosen requires target), the play will still consume/pay (same as your existing design).
  if (needTwoUnits.has(typeForRules)) {
    if (!isAlive(t1) || !isAlive(t2) || (t1 && t2 && t1.id === t2.id)) {
      return { ok: false, reason: "対象2体が必要" };
    }
  } else if (needUnit.has(typeForRules)) {
    const previewTargets = resolveEffectTargets({
      units,
      seat,
      caster,
      cardDefs,
      eff: effForRules,
      targetUnitId,
      targetUnitId2,
      targetUnitIds,
    });
    if (!previewTargets.length) return { ok: false, reason: "対象が必要" };
  }

  if (needCell.has(typeForRules)) {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c || !Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y))) {
      return { ok: false, reason: "移動先マスが必要" };
    }
  }

  // ===== Restrictions (generic) =====
  // Apply on the resolved chosen effect (table can change chosen)
    // ===== Restrictions (generic) =====
  // Apply on the resolved chosen effect (table can change chosen)
  const cond = getEffectCond(res.chosen || def.effect);

  const cc = checkCondForCaster({ cond, cardDefs, casterUnit: caster });
  if (!cc.ok) return { ok: false, reason: `条件未達：${cc.reason}` };

  const condTargets = resolveEffectTargets({
    units,
    seat,
    caster,
    cardDefs,
    eff: effForRules,
    targetUnitId,
    targetUnitId2,
    targetUnitIds,
  });

  const c1 = checkCondForTargetMany({
    cond,
    cardDefs,
    mana,
    targetUnits: condTargets,
  });
  if (!c1.ok) return { ok: false, reason: `条件未達：${c1.reason}` };

  const c2 = checkCondForCasterMana({ cond, mana, seat });
  if (!c2.ok) return { ok: false, reason: `条件未達：${c2.reason}` };
  // ===== Drawback feasibility check =====
  const drawback = getEffectDrawback(res.chosen || def.effect);
  const df = checkDrawbackFeasible({
    drawback,
    hands,
    decks,
    seat,
    units,
    preferUnit: t1,
  });
  if (!df.ok) return { ok: false, reason: `デメリット不可：${df.reason}` };

  // ===== consume card ALWAYS (once playable) =====
  const myHand = hands[seat] || [];
  myHand.splice(supportHandIndex, 1);
  hands[seat] = myHand;
  discards[seat] = safeArr(discards[seat]).concat([supportCardId]);

  // ===== pay mana ALWAYS =====
  const pay = spendMana(mana, seat, baseCost);
  if (!pay.ok) return { ok: false, reason: "mana spend failed" };
  const mana2 = pay.mana;

  // ===== apply drawback ALWAYS (success or fail) =====
  applyDrawback({
    drawback,
    seat,
    hands,
    decks,
    units,
    cardDefs,
    logLines,
    rand,
    preferUnit: t1,
    kills,
  });

  // ===== handle fail (chosen null) =====
  if (!res.ok || !res.chosen) {
    logLines.push(
      `[${seat}] サポート失敗：${supportName} (-${baseCost}) 🎲${res.roll} / ${res.label}`,
    );
    return {
      ok: true,
      applied: false,
      mana: mana2,
      hands,
      decks,
      discards,
      units,
      kills,
      log: logLines.slice(-200),
      lastSupportRoll,
    };
  }

  const eff = safeObj(res.chosen);
  const type = normalizeSupportType(asStr(eff.type, ""), eff);

  const targets = resolveEffectTargets({
    units,
    seat,
    caster,
    cardDefs,
    eff,
    targetUnitId,
    targetUnitId2,
    targetUnitIds,
  });
  // refresh t1/t2 references (already exist)
  const tag = `🎲${res.roll} / ${res.label}`;
  const sayTarget = (u) =>
    `${cardNameFromDefs(cardDefs, u.cardId)}(${u.owner})`;

  if (type === "draw") {
    const n = clamp(asInt(eff.n ?? eff.draw, 1), 0, 10);
    const before = (decks[seat] || []).length;
    drawCards(decks, hands, seat, n);
    const after = (decks[seat] || []).length;
    const actual = before - after;
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ドロー${actual}`,
    );
  } else if (type === "search") {
    const found = searchDeckCard({
      decks,
      hands,
      seat,
      cardDefs,
      eff,
      searchCardId,
    });
    if (!found.ok) {
      logLines.push(
        `[${seat}] サポート不発：${supportName} → サーチ対象がデッキにありません`,
      );
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        handLocks,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }
    hands.A = found.hands.A;
    hands.B = found.hands.B;
    decks.A = found.decks.A;
    decks.B = found.decks.B;
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${cardNameFromDefs(cardDefs, found.cardId)}をサーチ`,
    );
  } else if (type === "setCard") {
    const locked = setHandCardFaceDown({
      hands,
      handLocks,
      seat,
      cardDefs,
      eff,
      sourceName: supportName,
    });
    if (!locked.ok) {
      logLines.push(
        `[${seat}] サポート不発：${supportName} → 伏せる手札がありません`,
      );
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        handLocks,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }
    handLocks = locked.handLocks;
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${locked.targetSeat}の${cardNameFromDefs(cardDefs, locked.cardId)}を伏せた（${locked.releaseSeat}ターン開始まで）`,
    );
  } else if (type === "discardHand") {
    const discarded = discardHandCards({
      hands,
      handLocks,
      discards,
      seat,
      eff,
    });
    if (!discarded.ok) {
      logLines.push(
        `[${seat}] サポート不発：${supportName} → 墓地へ送る手札がありません`,
      );
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        discards,
        units,
        kills,
        handLocks,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }
    handLocks = discarded.handLocks;
    discards = discarded.discards;
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${discarded.targetSeat}の手札${discarded.cardIds.length}枚を墓地へ`,
    );
  } else if (type === "dmg") {
    const { hp, sp } = readHpSp(eff);
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets) {
      if (taimanBlocksDamage(t, caster)) {
        logLines.push(`  → タイマン：${cardNameFromDefs(cardDefs, t.cardId)} は正面の敵以外からのダメージを受けない`);
        continue;
      }
      if (hp > 0) t.hp = Math.max(0, asInt(t.hp, 0) - hp);
      if (sp > 0) t.sp = Math.max(0, asInt(t.sp, 0) - sp);

      setPanicAndCountIfNeeded(
        t,
        seat,
        kills,
        logLines,
        cardDefs,
        "パニック撃破(サポート)",
      );
      if (asInt(t.hp, 0) <= 0) {
        t.hp = 0;
        countKillIfNeeded(t, seat, kills, logLines, cardDefs, "撃破(サポート)");
      }
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} に HP-${hp} SP-${sp}`,
    );
  } else if (type === "heal") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const { hp, sp } = readHpSp(eff);

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      const maxHP = Math.max(0, asInt(cardDefs?.[t.cardId]?.hp, 0));
      const maxSP = Math.max(0, asInt(cardDefs?.[t.cardId]?.sp, 0));

      if (hp > 0) t.hp = clamp(asInt(t.hp, 0) + hp, 0, maxHP || 9999);
      if (sp > 0) t.sp = clamp(asInt(t.sp, 0) + sp, 0, maxSP || 9999);

      if (asInt(t.sp, 0) > 0) t.panic = false;
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} を HP+${hp} SP+${sp}`,
    );
  } else if (type === "modRate") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const delta = asInt(eff.delta ?? eff.rateDelta, 0);

    for (const t of targets) {
      if (delta >= 0 && assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      if (delta >= 0) {
        t.status.hitUp = {
          v: clamp(asInt(t.status?.hitUp?.v, 0) + delta, 0, 80),
        };
      } else {
        t.status.jinx = {
          v: clamp(asInt(t.status?.jinx?.v, 0) + Math.abs(delta), 0, 80),
        };
      }
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 命中${delta >= 0 ? `+${delta}` : `-${Math.abs(delta)}`}%`,
    );
  } else if (type === "powerUp") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const delta = asInt(eff.delta ?? eff.power, 0);
    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      t.status.powerUp = {
        v: clamp(asInt(t.status?.powerUp?.v, 0) + delta, 0, 200),
      };
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 威力+${delta}`,
    );
  } else if (type === "changeAttr") {
    if (!targets.length) {
      logLines.push(`[${seat}] support failed: ${supportName} needs a target`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const nextAttr = asStr(
      eff.attr ?? eff.to ?? eff.value ?? eff.targetAttr ?? eff.typeTo,
      "",
    );
    if (!nextAttr) {
      logLines.push(`[${seat}] support failed: ${supportName} has no attr`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      const before = unitAttr(cardDefs, t) || "?";
      t.attrOverride = nextAttr;
      t.attr = nextAttr;
      t.status = safeObj(t.status);
      t.status.attrChange = {
        attr: nextAttr,
        v: nextAttr,
        from: before,
        turns: Math.max(0, asInt(eff.turns ?? eff.turn ?? 0, 0)),
      };
    }

    logLines.push(
      `[${seat}] support success: ${supportName} (-${baseCost}) ${tag} -> ${targets.map(sayTarget).join(" / ")} attr=${nextAttr}`,
    );
  } else if (type === "grantEvade") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const delta = Math.max(0, asInt(eff.delta ?? eff.evade ?? eff.v, 10));
    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      t.status.evade = {
        v: clamp(asInt(t.status?.evade?.v, 0) + delta, 0, 80),
      };
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 回避+${delta}`,
    );
  } else if (type === "addStatus" || type === "lostSoul") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const key = type === "lostSoul" ? "lostSoul" : asStr(eff.status, "");
    const v = asInt(eff.v ?? eff.delta ?? 1, 1);
    const turns = Math.max(1, asInt(eff.turns ?? 1, 1));

    if (!key) {
      logLines.push(`[${seat}] サポート不発：statusが空`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets) {
      if (isAssistStatusForSupport(key) && assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      applyStatusEntry(t, key, v, turns);
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} に ${key}(${v}) ${turns}T`,
    );
  } else if (type === "cleanse") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      clearStatuses(t);
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 状態異常回復`,
    );
  } else if (type === "bounce") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets.slice()) {
      const owner = t.owner;
      const idx = units.findIndex((u) => u.id === t.id);
      if (idx >= 0) units.splice(idx, 1);
      hands[owner] = safeArr(hands[owner]).concat([t.cardId]);
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} を手札に戻した`,
    );
  } else if (type === "shiftGroup") {
    if (!targets.length) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const mode = asStr(eff.mode, "retreat"); // retreat / advance
    const dist = Math.max(1, asInt(eff.dist, 1));
    let movedCount = 0;

    for (const t of targets) {
      movedCount += tryShiftUnitY(units, t, mode, dist, eff) > 0 ? 1 : 0;
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} を ${mode === "retreat" ? "後退" : "前進"} ${dist}マス (${movedCount}体成功)`,
    );
  } else if (type === "manaUp") {
    // By default: raise target owner's mana.cur
    const amt = Math.max(0, asInt(eff.delta ?? 1, 1));
    const which = manaUpKind(eff);
    const whoRaw = asStr(eff.targetSeat, "").toUpperCase();

    const who =
      whoRaw === "A" || whoRaw === "B"
        ? whoRaw
        : whoRaw === "CASTER" || whoRaw === "SELF"
          ? seat
          : targets[0]?.owner
            ? asStr(targets[0].owner, seat)
            : seat;
    if (!mana2?.[who]) {
      logLines.push(`[${seat}] サポート不発：targetSeat不正`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    if (which === "max") {
      mana2[who].max = clamp(asInt(mana2[who].max, 0) + amt, 0, 99);
      logLines.push(
        `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナmax+${amt}`,
      );
    } else {
      mana2[who].cur = clamp(asInt(mana2[who].cur, 0) + amt, 0, 99);
      logLines.push(
        `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナcur+${amt}`,
      );
    }
  } else if (type === "swapPos") {
    if (!isAlive(t2) || t1.id === t2.id) {
      logLines.push(`[${seat}] サポート不発：対象2体が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }
    const ax = asInt(t1.x, 0),
      ay = asInt(t1.y, 0);
    t1.x = asInt(t2.x, 0);
    t1.y = asInt(t2.y, 0);
    t2.x = ax;
    t2.y = ay;
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → 位置入替：${sayTarget(t1)} ⇄ ${sayTarget(t2)}`,
    );
  } else if (type === "moveTo") {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c) {
      logLines.push(`[${seat}] サポート不発：移動先マスが必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }
    const x = asInt(c.x, -1);
    const y = asInt(c.y, -1);
    const W = asInt(eff.W, 5);
    const H = asInt(eff.H, 7);

    if (x < 0 || x >= W || y < 0 || y >= H) {
      logLines.push(`[${seat}] サポート不発：盤外`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }
    if (isOccupied(units, x, y)) {
      logLines.push(`[${seat}] サポート不発：そのマスは埋まっている`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const maxDist =
      eff.maxDist == null ? null : Math.max(0, asInt(eff.maxDist, 0));
    if (maxDist != null) {
      const dist = Math.abs(asInt(t1.x, 0) - x) + Math.abs(asInt(t1.y, 0) - y);
      if (dist > maxDist) {
        logLines.push(
          `[${seat}] サポート不発：距離制限 max=${maxDist} dist=${dist}`,
        );
        return {
          ok: true,
          applied: false,
          mana: mana2,
          hands,
          decks,
          units,
          kills,
          log: logLines.slice(-200),
          lastSupportRoll,
        };
      }
    }

    t1.x = x;
    t1.y = y;
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を (${x},${y})へ移動`,
    );
  } else {
    logLines.push(`[${seat}] サポート不発：未対応type=${type}`);
    return {
      ok: true,
      applied: false,
      mana: mana2,
      hands,
      decks,
      units,
      kills,
      log: logLines.slice(-200),
      lastSupportRoll,
    };
  }

  return {
    ok: true,
    applied: true,
    mana: mana2,
    hands,
    decks,
    discards,
    units,
    kills,
    handLocks,
    log: logLines.slice(-200),
    lastSupportRoll,
  };
}

function checkCondForCaster({ cond, cardDefs, casterUnit }) {
  const c = safeObj(cond);
  if (!Object.keys(c).length) return { ok: true, reason: "" };

  // caster条件が無いならスルー
  const need = asStr(c.casterAttr, "");
  const inArr = Array.isArray(c.casterAttrIn)
    ? c.casterAttrIn.map((x) => asStr(x, "")).filter(Boolean)
    : [];
  if (!need && !inArr.length) return { ok: true, reason: "" };

  if (!casterUnit) return { ok: false, reason: "発動者が必要" };

  const attr = unitAttr(cardDefs, casterUnit);
  if (need && attr !== need)
    return { ok: false, reason: `発動者属性が${need}ではない` };
  if (inArr.length && !inArr.includes(attr))
    return { ok: false, reason: `発動者属性が範囲外` };

  return { ok: true, reason: "" };
}

// =====================
// EX support (1-shot) - consume ex instead of hand
// =====================
export function applyExSupport({
  s,
  seat,
  cardDefs,
  exCardId,
  casterUnitId = null,
  targetUnitId = null,
  targetUnitId2 = null,
  targetUnitIds = null,
  targetCell = null,
  rand = Math.random,
}) {
  const mana = normalizeMana(s.mana);

  const hands = { ...(s.hands || { A: [], B: [] }) };
  hands.A = safeArr(hands.A).slice();
  hands.B = safeArr(hands.B).slice();

  const decks = { ...(s.decks || { A: [], B: [] }) };
  decks.A = safeArr(decks.A).slice();
  decks.B = safeArr(decks.B).slice();

  const units = safeArr(s.units).map((u) => ({
    ...u,
    status: safeObj(u.status),
  }));
  const logLines = safeArr(s.log).slice();
  const kills = { ...(s.kills || { A: 0, B: 0 }) };

  const ex = safeObj(s.ex);
  const exUsed = safeObj(s.exUsed);

  if (exUsed?.[seat]) return { ok: false, reason: "EX already used" };
  if (!exCardId) return { ok: false, reason: "EX card missing" };

  const def = cardDefs?.[exCardId];
  if (!def) return { ok: false, reason: "EX card def missing" };
  if (!isSupportCard(def))
    return { ok: false, reason: "EX card is not support-kind" };

  const baseCost = asInt(def.cost, 0);
  if (mana[seat].cur < baseCost) return { ok: false, reason: "マナ不足" };

  const t1 = targetUnitId ? findUnit(units, targetUnitId) : null;
  const t2 = targetUnitId2 ? findUnit(units, targetUnitId2) : null;
  const caster = casterUnitId ? findUnit(units, casterUnitId) : null;

  const roll = roll1to100(rand);
  const res = resolveSupportEffect(def.effect, roll);
  const supportName = cardNameFromDefs(cardDefs, exCardId);

  // EXは成功失敗に関わらず消費
  const ex2 = { ...ex, [seat]: null };
  const exUsed2 = { ...exUsed, [seat]: true };

  const lastSupportRoll = {
    at: Date.now(),
    r: res.roll,
    label: res.label,
    ok: !!res.ok,
    cardId: exCardId,
    cardName: supportName,
    from: seat,
    targetId: targetUnitId || null,
    targetId2: targetUnitId2 || null,
    targetCell: targetCell || null,
    isEx: true,
  };

  const effForRules = res.chosen ? safeObj(res.chosen) : safeObj(def.effect);
  const typeForRules = normalizeSupportType(
    asStr(effForRules.type, ""),
    effForRules,
  );

  const needUnit = new Set([
    "dmg",
    "heal",
    "modRate",
    "bounce",
    "powerUp",
    "cleanse",
    "moveTo",
    "grantEvade",
    "changeAttr",
    "addStatus",
    "lostSoul",
    "shiftGroup",
  ]);
  const needTwoUnits = new Set(["swapPos"]);
  const needCell = new Set(["moveTo"]);

  if (needTwoUnits.has(typeForRules)) {
    if (!isAlive(t1) || !isAlive(t2) || (t1 && t2 && t1.id === t2.id)) {
      return { ok: false, reason: "対象2体が必要" };
    }
  } else if (needUnit.has(typeForRules)) {
    const previewTargets = resolveEffectTargets({
      units,
      seat,
      caster,
      cardDefs,
      eff: effForRules,
      targetUnitId,
      targetUnitId2,
      targetUnitIds,
    });
    if (!previewTargets.length) return { ok: false, reason: "対象が必要" };
  }

  if (needCell.has(typeForRules)) {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c || !Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y))) {
      return { ok: false, reason: "移動先マスが必要" };
    }
  }

  // ===== Restrictions =====
    // ===== Restrictions =====
  const cond = getEffectCond(res.chosen || def.effect);

  // ★ caster 条件（発動者属性など）
  const cc = checkCondForCaster({ cond, cardDefs, casterUnit: caster });
  if (!cc.ok) return { ok: false, reason: `条件未達：${cc.reason}` };

  const condTargets = resolveEffectTargets({
    units,
    seat,
    caster,
    cardDefs,
    eff: effForRules,
    targetUnitId,
    targetUnitId2,
    targetUnitIds,
  });

  const c1 = checkCondForTargetMany({
    cond,
    cardDefs,
    mana,
    targetUnits: condTargets,
  });
  if (!c1.ok) return { ok: false, reason: `条件未達：${c1.reason}` };

  const c2 = checkCondForCasterMana({ cond, mana, seat });
  if (!c2.ok) return { ok: false, reason: `条件未達：${c2.reason}` };
  // ===== Drawback feasibility =====
  const drawback = getEffectDrawback(res.chosen || def.effect);
  const df = checkDrawbackFeasible({
    drawback,
    hands,
    decks,
    seat,
    units,
    preferUnit: t1,
  });
  if (!df.ok) return { ok: false, reason: `デメリット不可：${df.reason}` };

  // ===== pay mana =====
  const pay = spendMana(mana, seat, baseCost);
  if (!pay.ok) return { ok: false, reason: "mana spend failed" };
  const mana2 = pay.mana;

  // ===== drawback =====
  applyDrawback({
    drawback,
    seat,
    hands,
    decks,
    units,
    cardDefs,
    logLines,
    rand,
    preferUnit: t1,
    kills,
  });

  // ===== fail =====
  if (!res.ok || !res.chosen) {
    logLines.push(
      `[${seat}] EX失敗：${supportName} (-${baseCost}) 🎲${res.roll} / ${res.label}`,
    );
    return {
      ok: true,
      applied: false,
      mana: mana2,
      hands,
      decks,
      units,
      kills,
      ex: ex2,
      exUsed: exUsed2,
      log: logLines.slice(-200),
      lastSupportRoll,
    };
  }

  const eff = safeObj(res.chosen);
  const type = normalizeSupportType(asStr(eff.type, ""), eff);

  const targets = resolveEffectTargets({
    units,
    seat,
    caster,
    cardDefs,
    eff,
    targetUnitId,
    targetUnitId2,
    targetUnitIds,
  });

  const tag = `🎲${res.roll} / ${res.label}`;
  const sayTarget = (u) =>
    `${cardNameFromDefs(cardDefs, u.cardId)}(${u.owner})`;

  if (type === "draw") {
    const n = clamp(asInt(eff.n ?? eff.draw, 1), 0, 10);
    const before = (decks[seat] || []).length;
    drawCards(decks, hands, seat, n);
    const after = (decks[seat] || []).length;
    const actual = before - after;

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ドロー${actual}`,
    );
  } else if (type === "dmg") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const { hp, sp } = readHpSp(eff);

    for (const t of targets) {
      if (taimanBlocksDamage(t, caster)) {
        logLines.push(`  → タイマン：${cardNameFromDefs(cardDefs, t.cardId)} は正面の敵以外からのダメージを受けない`);
        continue;
      }
      if (hp > 0) t.hp = Math.max(0, asInt(t.hp, 0) - hp);
      if (sp > 0) t.sp = Math.max(0, asInt(t.sp, 0) - sp);

      setPanicAndCountIfNeeded(
        t,
        seat,
        kills,
        logLines,
        cardDefs,
        "パニック撃破(EX)",
      );
      if (asInt(t.hp, 0) <= 0) {
        t.hp = 0;
        countKillIfNeeded(t, seat, kills, logLines, cardDefs, "撃破(EX)");
      }
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} に HP-${hp} SP-${sp}`,
    );
  } else if (type === "heal") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const { hp, sp } = readHpSp(eff);

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      const maxHP = Math.max(0, asInt(cardDefs?.[t.cardId]?.hp, 0));
      const maxSP = Math.max(0, asInt(cardDefs?.[t.cardId]?.sp, 0));

      if (hp > 0) t.hp = clamp(asInt(t.hp, 0) + hp, 0, maxHP || 9999);
      if (sp > 0) t.sp = clamp(asInt(t.sp, 0) + sp, 0, maxSP || 9999);

      if (asInt(t.sp, 0) > 0) t.panic = false;
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} を HP+${hp} SP+${sp}`,
    );
  } else if (type === "modRate") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const delta = asInt(eff.delta ?? eff.rateDelta, 0);

    for (const t of targets) {
      if (delta >= 0 && assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      t.status = safeObj(t.status);
      if (delta >= 0) {
        t.status.hitUp = {
          v: clamp(asInt(t.status?.hitUp?.v, 0) + delta, 0, 80),
        };
      } else {
        t.status.jinx = {
          v: clamp(asInt(t.status?.jinx?.v, 0) + Math.abs(delta), 0, 80),
        };
      }
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 命中${delta >= 0 ? `+${delta}` : `-${Math.abs(delta)}`}%`,
    );
  } else if (type === "powerUp") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const delta = asInt(eff.delta ?? eff.power, 0);

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      t.status = safeObj(t.status);
      t.status.powerUp = {
        v: clamp(asInt(t.status?.powerUp?.v, 0) + delta, 0, 200),
      };
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 威力+${delta}`,
    );
  } else if (type === "grantEvade") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const delta = Math.max(0, asInt(eff.delta ?? eff.evade ?? eff.v, 10));

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      t.status = safeObj(t.status);
      t.status.evade = {
        v: clamp(asInt(t.status?.evade?.v, 0) + delta, 0, 80),
      };
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 回避+${delta}`,
    );
  } else if (type === "addStatus" || type === "lostSoul") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const key = type === "lostSoul" ? "lostSoul" : asStr(eff.status, "");
    const v = asInt(eff.v ?? eff.delta ?? 1, 1);
    const turns = Math.max(1, asInt(eff.turns ?? 1, 1));

    if (!key) {
      logLines.push(`[${seat}] EX不発：statusが空`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets) {
      if (isAssistStatusForSupport(key) && assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      applyStatusEntry(t, key, v, turns);
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} に ${key}(${v}) ${turns}T`,
    );
  } else if (type === "cleanse") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets) {
      if (assistBlockedForTarget(t)) {
        logAssistBlocked(logLines, cardDefs, t);
        continue;
      }
      clearStatuses(t);
      t.status = safeObj(t.status);
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} 状態異常回復`,
    );
  } else if (type === "bounce") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    for (const t of targets.slice()) {
      const owner = t.owner;
      const idx = units.findIndex((u) => u.id === t.id);
      if (idx >= 0) units.splice(idx, 1);
      hands[owner] = safeArr(hands[owner]).concat([t.cardId]);
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} を手札に戻した`,
    );
  } else if (type === "shiftGroup") {
    if (!targets.length) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const mode = asStr(eff.mode, "retreat");
    const dist = Math.max(1, asInt(eff.dist, 1));
    let movedCount = 0;

    for (const t of targets) {
      movedCount += tryShiftUnitY(units, t, mode, dist, eff) > 0 ? 1 : 0;
    }

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${targets.map(sayTarget).join(" / ")} を ${mode === "retreat" ? "後退" : "前進"} ${dist}マス (${movedCount}体成功)`,
    );
  } else if (type === "manaUp") {
    const amt = Math.max(0, asInt(eff.delta ?? 1, 1));
    const which = manaUpKind(eff);
    const whoRaw = asStr(eff.targetSeat, "").toUpperCase();

    const who =
      whoRaw === "A" || whoRaw === "B"
        ? whoRaw
        : whoRaw === "CASTER" || whoRaw === "SELF"
          ? seat
          : targets[0]?.owner
            ? asStr(targets[0].owner, seat)
            : seat;

    if (!mana2?.[who]) {
      logLines.push(`[${seat}] EX不発：targetSeat不正`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    if (which === "max") {
      mana2[who].max = clamp(asInt(mana2[who].max, 0) + amt, 0, 99);
      logLines.push(
        `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナmax+${amt}`,
      );
    } else {
      mana2[who].cur = clamp(asInt(mana2[who].cur, 0) + amt, 0, 99);
      logLines.push(
        `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナcur+${amt}`,
      );
    }
  } else if (type === "swapPos") {
    if (!isAlive(t1) || !isAlive(t2) || t1.id === t2.id) {
      logLines.push(`[${seat}] EX不発：対象2体が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const ax = asInt(t1.x, 0);
    const ay = asInt(t1.y, 0);
    t1.x = asInt(t2.x, 0);
    t1.y = asInt(t2.y, 0);
    t2.x = ax;
    t2.y = ay;

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → 位置入替：${sayTarget(t1)} ⇄ ${sayTarget(t2)}`,
    );
  } else if (type === "moveTo") {
    if (!isAlive(t1)) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c) {
      logLines.push(`[${seat}] EX不発：移動先マスが必要`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const x = asInt(c.x, -1);
    const y = asInt(c.y, -1);
    const W = asInt(eff.W, 5);
    const H = asInt(eff.H, 7);

    if (x < 0 || x >= W || y < 0 || y >= H) {
      logLines.push(`[${seat}] EX不発：盤外`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    if (isOccupied(units, x, y)) {
      logLines.push(`[${seat}] EX不発：そのマスは埋まっている`);
      return {
        ok: true,
        applied: false,
        mana: mana2,
        hands,
        decks,
        units,
        kills,
        ex: ex2,
        exUsed: exUsed2,
        log: logLines.slice(-200),
        lastSupportRoll,
      };
    }

    const maxDist =
      eff.maxDist == null ? null : Math.max(0, asInt(eff.maxDist, 0));
    if (maxDist != null) {
      const dist = Math.abs(asInt(t1.x, 0) - x) + Math.abs(asInt(t1.y, 0) - y);
      if (dist > maxDist) {
        logLines.push(
          `[${seat}] EX不発：距離制限 max=${maxDist} dist=${dist}`,
        );
        return {
          ok: true,
          applied: false,
          mana: mana2,
          hands,
          decks,
          units,
          kills,
          ex: ex2,
          exUsed: exUsed2,
          log: logLines.slice(-200),
          lastSupportRoll,
        };
      }
    }

    t1.x = x;
    t1.y = y;

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を (${x},${y})へ移動`,
    );
  } else {
    logLines.push(`[${seat}] EX不発：未対応type=${type}`);
    return {
      ok: true,
      applied: false,
      mana: mana2,
      hands,
      decks,
      units,
      kills,
      ex: ex2,
      exUsed: exUsed2,
      log: logLines.slice(-200),
      lastSupportRoll,
    };
  }

  return {
    ok: true,
    applied: true,
    mana: mana2,
    hands,
    decks,
    units,
    kills,
    ex: ex2,
    exUsed: exUsed2,
    log: logLines.slice(-200),
    lastSupportRoll,
  };
}
