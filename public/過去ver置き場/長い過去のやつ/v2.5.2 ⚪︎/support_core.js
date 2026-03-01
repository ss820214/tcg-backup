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

import { drawCards, clearStatuses } from "./game_state.js?v=20260126g";
import { normalizeMana, spendMana } from "./game_core.js?v=20260126g";

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
  return asStr(def?.type, "");
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
        countKillIfNeeded(payer, enemy, kills, logLines, cardDefs, "撃破(自傷)");
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
  if (mana[seat].cur < baseCost) return { ok: false, reason: "mana 부족" };

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
  const typeForRules = asStr(effForRules.type, "");

  const needUnit = new Set([
    "dmg",
    "heal",
    "modRate",
    "bounce",
    "powerUp",
    "cleanse",
    "moveTo",
    "manaUp",
    "grantEvade",
    "addStatus",
    "lostSoul",
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
    if (!isAlive(t1)) return { ok: false, reason: "対象が必要" };
  }

  if (needCell.has(typeForRules)) {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c || !Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y))) {
      return { ok: false, reason: "移動先マスが必要" };
    }
  }

  // ===== Restrictions (generic) =====
  // Apply on the resolved chosen effect (table can change chosen)
  const cond = getEffectCond(res.chosen || def.effect);

  const cc = checkCondForCaster({ cond, cardDefs, casterUnit: caster });
  if (!cc.ok) return { ok: false, reason: `条件未達：${cc.reason}` };

  const c1 = checkCondForTarget({ cond, cardDefs, mana, targetUnit: t1 });
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
      units,
      kills,
      log: logLines.slice(-200),
      lastSupportRoll,
    };
  }

  const eff = safeObj(res.chosen);
  const type = asStr(eff.type, "");

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
  } else if (type === "dmg") {
    const hp = Math.max(0, asInt(eff.hp, 0));
    const sp = Math.max(0, asInt(eff.sp, 0));

    if (hp > 0) t1.hp = Math.max(0, asInt(t1.hp, 0) - hp);
    if (sp > 0) t1.sp = Math.max(0, asInt(t1.sp, 0) - sp);

    // panic / kill count
    setPanicAndCountIfNeeded(
      t1,
      seat,
      kills,
      logLines,
      cardDefs,
      "パニック撃破(サポート)",
    );
    if (asInt(t1.hp, 0) <= 0) {
      t1.hp = 0;
      countKillIfNeeded(t1, seat, kills, logLines, cardDefs, "撃破(サポート)");
    }

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} に HP-${hp} SP-${sp}`,
    );
  } else if (type === "heal") {
    const hp = Math.max(0, asInt(eff.hp, 0));
    const sp = Math.max(0, asInt(eff.sp, 0));
    const maxHP = Math.max(0, asInt(cardDefs?.[t1.cardId]?.hp, 0));
    const maxSP = Math.max(0, asInt(cardDefs?.[t1.cardId]?.sp, 0));

    if (hp > 0) t1.hp = clamp(asInt(t1.hp, 0) + hp, 0, maxHP || 9999);
    if (sp > 0) t1.sp = clamp(asInt(t1.sp, 0) + sp, 0, maxSP || 9999);

    // 回復でpanic解除したいならON（不要ならここ消してOK）
    if (asInt(t1.sp, 0) > 0) t1.panic = false;

    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を HP+${hp} SP+${sp}`,
    );
  } else if (type === "modRate") {
    const delta = asInt(eff.delta ?? eff.rateDelta, 0);
    if (delta >= 0)
      t1.status.aim = { v: clamp(asInt(t1.status?.aim?.v, 0) + delta, 0, 80) };
    else
      t1.status.jinx = {
        v: clamp(asInt(t1.status?.jinx?.v, 0) + Math.abs(delta), 0, 80),
      };
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 命中${delta >= 0 ? `+${delta}` : `-${Math.abs(delta)}`}%`,
    );
  } else if (type === "powerUp") {
    // ★固定値: status.powerUp
    const delta = asInt(eff.delta ?? eff.power, 0);
    t1.status.powerUp = {
      v: clamp(asInt(t1.status?.powerUp?.v, 0) + delta, 0, 200),
    };
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 威力+${delta}`,
    );
  } else if (type === "grantEvade") {
    const delta = Math.max(0, asInt(eff.delta ?? eff.evade, 10));
    t1.status.evade = {
      v: clamp(asInt(t1.status?.evade?.v, 0) + delta, 0, 80),
    };
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 回避+${delta}`,
    );
  } else if (type === "manaUp") {
    // By default: raise target owner's mana.cur
    const amt = Math.max(0, asInt(eff.delta ?? 1, 1));
    const which = asStr(eff.which, "cur").toLowerCase(); // cur|max
    const whoRaw = asStr(eff.targetSeat, "").toUpperCase();
    const who =
      whoRaw === "A" || whoRaw === "B" ? whoRaw : asStr(t1.owner, seat);

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
      if (mana2[who].cur > mana2[who].max) mana2[who].cur = mana2[who].max;
      logLines.push(
        `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナmax+${amt}`,
      );
    } else {
      mana2[who].cur = clamp(asInt(mana2[who].cur, 0) + amt, 0, 99);
      if (mana2[who].cur > mana2[who].max) mana2[who].cur = mana2[who].max;
      logLines.push(
        `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナcur+${amt}`,
      );
    }
  } else if (type === "addStatus" || type === "lostSoul") {
    // addStatus: t1.status[key] = { v, turns }
    // lostSoul: 互換。key="lostSoul" として扱う
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

    // 上書き更新（重ね掛けルールはここで調整できる）
    const prev = safeObj(t1.status[key]);
  t1.status[key] = {
  v: clamp(asInt(prev.v, 0) + v, 0, 999),
  turns: Math.max(asInt(prev.turns, 0), turns),
};
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} に ${key}(${v}) ${turns}T`,
    );
  } else if (type === "cleanse") {
    clearStatuses(t1);
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 状態異常回復`,
    );
  } else if (type === "bounce") {
    const owner = t1.owner;
    const idx = units.findIndex((u) => u.id === t1.id);
    if (idx >= 0) units.splice(idx, 1);
    hands[owner] = safeArr(hands[owner]).concat([t1.cardId]);
    logLines.push(
      `[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を手札に戻した`,
    );
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
    units,
    kills,
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

  // EXは support kind 前提
  if (!isSupportCard(def))
    return { ok: false, reason: "EX card is not support-kind" };

  const baseCost = asInt(def.cost, 0);
  if (mana[seat].cur < baseCost) return { ok: false, reason: "mana 부족" };

  const t1 = targetUnitId ? findUnit(units, targetUnitId) : null;
  const t2 = targetUnitId2 ? findUnit(units, targetUnitId2) : null;
  const caster = casterUnitId ? findUnit(units, casterUnitId) : null;

  // pre-roll
  const roll = roll1to100(rand);
  const res = resolveSupportEffect(def.effect, roll);

  const supportName = cardNameFromDefs(cardDefs, exCardId);

  // EX is consumed regardless of success/fail
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
  const typeForRules = asStr(effForRules.type, "");

  const needUnit = new Set([
    "dmg",
    "heal",
    "modRate",
    "bounce",
    "powerUp",
    "cleanse",
    "moveTo",
    "manaUp",
    "grantEvade",
    "addStatus","lostSoul",
  ]);
  const needTwoUnits = new Set(["swapPos"]);
  const needCell = new Set(["moveTo"]);

  if (needTwoUnits.has(typeForRules)) {
    if (!isAlive(t1) || !isAlive(t2) || (t1 && t2 && t1.id === t2.id))
      return { ok: false, reason: "対象2体が必要" };
  } else if (needUnit.has(typeForRules)) {
    if (!isAlive(t1)) return { ok: false, reason: "対象が必要" };
  }
  if (needCell.has(typeForRules)) {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c || !Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y)))
      return { ok: false, reason: "移動先マスが必要" };
  }

  // ===== Restrictions =====
  const cond = getEffectCond(res.chosen || def.effect);

  // ★ caster 条件（発動者属性など）
  const cc = checkCondForCaster({ cond, cardDefs, casterUnit: caster });
  if (!cc.ok) return { ok: false, reason: `条件未達：${cc.reason}` };
  const c1 = checkCondForTarget({ cond, cardDefs, mana, targetUnit: t1 });
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

  // pay mana ALWAYS
  const pay = spendMana(mana, seat, baseCost);
  if (!pay.ok) return { ok: false, reason: "mana spend failed" };
  const mana2 = pay.mana;

  // apply drawback ALWAYS
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

  // fail path
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
  const type = asStr(eff.type, "");
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
    const hp = Math.max(0, asInt(eff.hp, 0));
    const sp = Math.max(0, asInt(eff.sp, 0));

    if (hp > 0) t1.hp = Math.max(0, asInt(t1.hp, 0) - hp);
    if (sp > 0) t1.sp = Math.max(0, asInt(t1.sp, 0) - sp);

    setPanicAndCountIfNeeded(
      t1,
      seat,
      kills,
      logLines,
      cardDefs,
      "パニック撃破(EX)",
    );
    if (asInt(t1.hp, 0) <= 0) {
      t1.hp = 0;
      countKillIfNeeded(t1, seat, kills, logLines, cardDefs, "撃破(EX)");
    }
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} に HP-${hp} SP-${sp}`,
    );
  } else if (type === "heal") {
    const hp = Math.max(0, asInt(eff.hp, 0));
    const sp = Math.max(0, asInt(eff.sp, 0));
    const maxHP = Math.max(0, asInt(cardDefs?.[t1.cardId]?.hp, 0));
    const maxSP = Math.max(0, asInt(cardDefs?.[t1.cardId]?.sp, 0));

    if (hp > 0) t1.hp = clamp(asInt(t1.hp, 0) + hp, 0, maxHP || 9999);
    if (sp > 0) t1.sp = clamp(asInt(t1.sp, 0) + sp, 0, maxSP || 9999);
    if (asInt(t1.sp, 0) > 0) t1.panic = false;

    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を HP+${hp} SP+${sp}`,
    );
  } else if (type === "modRate") {
    const delta = asInt(eff.delta ?? eff.rateDelta, 0);
    if (delta >= 0)
      t1.status.aim = { v: clamp(asInt(t1.status?.aim?.v, 0) + delta, 0, 80) };
    else
      t1.status.jinx = {
        v: clamp(asInt(t1.status?.jinx?.v, 0) + Math.abs(delta), 0, 80),
      };
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 命中${delta >= 0 ? `+${delta}` : `-${Math.abs(delta)}`}%`,
    );
  } else if (type === "powerUp") {
    const delta = asInt(eff.delta ?? eff.power, 0);
    t1.status.powerUp = {
      v: clamp(asInt(t1.status?.powerUp?.v, 0) + delta, 0, 200),
    };
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 威力+${delta}`,
    );
  } else if (type === "grantEvade") {
    const delta = Math.max(0, asInt(eff.delta ?? eff.evade, 10));
    t1.status.evade = {
      v: clamp(asInt(t1.status?.evade?.v, 0) + delta, 0, 80),
    };
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 回避+${delta}`,
    );
  } else if (type === "manaUp") {
    const amt = Math.max(0, asInt(eff.delta ?? 1, 1));
    const which = asStr(eff.which, "cur").toLowerCase();
    const whoRaw = asStr(eff.targetSeat, "").toUpperCase();
    const who =
      whoRaw === "A" || whoRaw === "B" ? whoRaw : asStr(t1.owner, seat);

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
      if (mana2[who].cur > mana2[who].max) mana2[who].cur = mana2[who].max;
      logLines.push(
        `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナmax+${amt}`,
      );
    } else {
      mana2[who].cur = clamp(asInt(mana2[who].cur, 0) + amt, 0, 99);
      if (mana2[who].cur > mana2[who].max) mana2[who].cur = mana2[who].max;
      logLines.push(
        `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${who}のマナcur+${amt}`,
      );
    }
  } else if (type === "cleanse") {
    clearStatuses(t1);
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 状態異常回復`,
    );
  } else if (type === "bounce") {
    const owner = t1.owner;
    const idx = units.findIndex((u) => u.id === t1.id);
    if (idx >= 0) units.splice(idx, 1);
    hands[owner] = safeArr(hands[owner]).concat([t1.cardId]);
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を手札に戻した`,
    );
  } else if (type === "swapPos") {
    if (!isAlive(t2) || t1.id === t2.id) {
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
    const ax = asInt(t1.x, 0),
      ay = asInt(t1.y, 0);
    t1.x = asInt(t2.x, 0);
    t1.y = asInt(t2.y, 0);
    t2.x = ax;
    t2.y = ay;
    logLines.push(
      `[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → 位置入替：${sayTarget(t1)} ⇄ ${sayTarget(t2)}`,
    );
  } else if (type === "moveTo") {
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
        logLines.push(`[${seat}] EX不発：距離制限 max=${maxDist} dist=${dist}`);
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
