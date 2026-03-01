
// public/support_core.js
// v2.0.0-b - Support Card Core
// - effect table (1-20:A, 21-50:B...) supported
// - fail also consumes + pays
// - swapPos: needs 2 units
// - moveTo: needs unit + cell (optional maxDist)
// - IMPORTANT: panic is treated as kill progress (anti-double via countedAsKill)

import { drawCards, clearStatuses } from "./game_state.js?v=20260126g";
import { normalizeMana, spendMana } from "./game_core.js?v=20260126g";

export function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
export function roll1to100(rand = Math.random){
  return Math.floor(rand() * 100) + 1;
}
function safeArr(a){ return Array.isArray(a) ? a : []; }
function safeObj(o){ return (o && typeof o === "object" && !Array.isArray(o)) ? o : {}; }

export function isSupportCard(def){
  return String(def?.kind || "").toLowerCase() === "support";
}

function cardNameFromDefs(cardDefs, cardId){
  return cardDefs?.[cardId]?.name || cardId;
}

function findUnit(units, id){
  return safeArr(units).find(u => u && u.id === id) || null;
}
function isAlive(u){
  return !!u && Number(u.hp) > 0;
}
function isOccupied(units, x, y){
  return safeArr(units).some(u => isAlive(u) && Number(u.x) === x && Number(u.y) === y);
}

// --- kill helpers (panic counts as kill) ---
function countKillIfNeeded(target, killerSeat, kills, logLines, cardDefs, reason="撃破"){
  if (!target || !kills) return;
  if (target.countedAsKill) return;
  target.countedAsKill = true;
  kills[killerSeat] = (kills[killerSeat] ?? 0) + 1;
  if (logLines) logLines.push(`[${killerSeat}] ${reason}：${cardNameFromDefs(cardDefs, target.cardId)}`);
}
function setPanicAndCountIfNeeded(target, killerSeat, kills, logLines, cardDefs, reason="パニック撃破"){
  if (!target) return;
  if (Number(target.sp) <= 0 && Number(target.hp) > 0) {
    const was = !!target.panic;
    target.panic = true;
    if (!was) countKillIfNeeded(target, killerSeat, kills, logLines, cardDefs, reason);
  }
}

// ---------------------
// effect table resolver
// ---------------------
export function resolveSupportEffect(effectSpec, roll){
  const spec = safeObj(effectSpec);
  const r = clamp(Number(roll), 1, 100);

  if (Array.isArray(spec.table)) {
    const rows = spec.table
      .map(x => ({
        min: clamp(Number(x.min ?? 1), 1, 100),
        max: clamp(Number(x.max ?? 100), 1, 100),
        effect: x.effect ?? null,
        label: String(x.label ?? "")
      }))
      .sort((a,b)=> a.min - b.min);

    const hit = rows.find(x => r >= x.min && r <= x.max) || null;
    const chosen = hit?.effect ?? null;
    const label = hit?.label || (hit ? `${hit.min}-${hit.max}` : "");
    const ok = !!chosen;
    return { ok, roll:r, chosen, label, mode:"table" };
  }

  const rate = clamp(Number(spec.rate ?? 100), 0, 100);
  const ok = (r <= rate);
  return { ok, roll:r, chosen: ok ? spec : null, label: ok ? `成功(${rate}%)` : `失敗(${rate}%)`, mode:"rate" };
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
  targetUnitId=null,
  targetUnitId2=null,
  targetCell=null,
  rand=Math.random,
}){
  const mana = normalizeMana(s.mana);

  const hands = { ...(s.hands || {A:[],B:[]}) };
  hands.A = safeArr(hands.A).slice();
  hands.B = safeArr(hands.B).slice();

  const decks = { ...(s.decks || {A:[],B:[]}) };
  decks.A = safeArr(decks.A).slice();
  decks.B = safeArr(decks.B).slice();

  const units = safeArr(s.units).map(u => ({...u, status: safeObj(u.status)}));
  const logLines = safeArr(s.log).slice();
  const kills = { ...(s.kills || {A:0,B:0}) };

  const def = cardDefs?.[supportCardId];
  if (!def) return { ok:false, reason:"support card def missing" };
  if (!isSupportCard(def)) return { ok:false, reason:"not a support card" };

  // ensure hand index matches
  const myHand = hands[seat] || [];
  const cidAt = myHand[supportHandIndex];
  if (cidAt !== supportCardId) {
    const alt = myHand.findIndex(x => x === supportCardId);
    if (alt < 0) return { ok:false, reason:"support card not in hand" };
    supportHandIndex = alt;
  }

  const baseCost = Number(def.cost ?? 0);
  if (mana[seat].cur < baseCost) return { ok:false, reason:"mana 부족" };

  // roll & resolve
  const roll = roll1to100(rand);
  const res = resolveSupportEffect(def.effect, roll);

  // consume card ALWAYS
  myHand.splice(supportHandIndex, 1);
  hands[seat] = myHand;

  // pay mana ALWAYS
  const pay = spendMana(mana, seat, baseCost);
  if (!pay.ok) return { ok:false, reason:"mana spend failed" };
  const mana2 = pay.mana;

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
    targetCell: targetCell || null
  };

  if (!res.ok || !res.chosen) {
    logLines.push(`[${seat}] サポート失敗：${supportName} (-${baseCost}) 🎲${res.roll} / ${res.label}`);
    return {
      ok:true, applied:false,
      mana: mana2, hands, decks, units, kills,
      log: logLines.slice(-200),
      lastSupportRoll
    };
  }

  const eff = safeObj(res.chosen);
  const type = String(eff.type || "").trim();

  const t1 = targetUnitId ? findUnit(units, targetUnitId) : null;
  const t2 = targetUnitId2 ? findUnit(units, targetUnitId2) : null;

  const needUnit = new Set(["dmg","heal","modRate","bounce","powerUp","cleanse","moveTo"]);
  const needTwoUnits = new Set(["swapPos"]);
  const needCell = new Set(["moveTo"]);

  if (needTwoUnits.has(type)) {
    if (!isAlive(t1) || !isAlive(t2) || t1.id === t2.id) {
      logLines.push(`[${seat}] サポート不発：対象2体が必要`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
    }
  } else if (needUnit.has(type)) {
    if (!isAlive(t1)) {
      logLines.push(`[${seat}] サポート不発：対象が必要`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
    }
  }

  if (needCell.has(type)) {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c || !Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y))) {
      logLines.push(`[${seat}] サポート不発：移動先マスが必要`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
    }
  }

  const tag = `🎲${res.roll} / ${res.label}`;
  const sayTarget = (u)=> `${cardNameFromDefs(cardDefs, u.cardId)}(${u.owner})`;

  if (type === "draw") {
    const n = clamp(Number(eff.n ?? eff.draw ?? 1), 0, 10);
    const before = (decks[seat] || []).length;
    drawCards(decks, hands, seat, n);
    const after = (decks[seat] || []).length;
    const actual = before - after;
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ドロー${actual}`);
  }

  else if (type === "dmg") {
    const hp = Math.max(0, Math.trunc(Number(eff.hp ?? 0)));
    const sp = Math.max(0, Math.trunc(Number(eff.sp ?? 0)));

    if (hp > 0) t1.hp = Math.max(0, Number(t1.hp) - hp);
    if (sp > 0) t1.sp = Math.max(0, Number(t1.sp) - sp);

    // panic / kill count
    setPanicAndCountIfNeeded(t1, seat, kills, logLines, cardDefs, "パニック撃破(サポート)");
    if (Number(t1.hp) <= 0) {
      t1.hp = 0;
      countKillIfNeeded(t1, seat, kills, logLines, cardDefs, "撃破(サポート)");
    }

    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} に HP-${hp} SP-${sp}`);
  }

  else if (type === "heal") {
    const hp = Math.max(0, Math.trunc(Number(eff.hp ?? 0)));
    const sp = Math.max(0, Math.trunc(Number(eff.sp ?? 0)));
    const maxHP = Math.max(0, Number(cardDefs?.[t1.cardId]?.hp ?? 0));
    const maxSP = Math.max(0, Number(cardDefs?.[t1.cardId]?.sp ?? 0));

    if (hp > 0) t1.hp = clamp(Number(t1.hp) + hp, 0, maxHP || 9999);
    if (sp > 0) t1.sp = clamp(Number(t1.sp) + sp, 0, maxSP || 9999);

    // 回復でpanic解除したいならON（不要ならここ消してOK）
    if (Number(t1.sp) > 0) t1.panic = false;

    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を HP+${hp} SP+${sp}`);
  }

  else if (type === "modRate") {
    const delta = Math.trunc(Number(eff.delta ?? eff.rateDelta ?? 0));
    if (delta >= 0) t1.status.aim = { v: clamp(Number(t1.status?.aim?.v ?? 0) + delta, 0, 80) };
    else t1.status.jinx = { v: clamp(Number(t1.status?.jinx?.v ?? 0) + Math.abs(delta), 0, 80) };
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 命中${delta>=0?`+${delta}`:`-${Math.abs(delta)}`}%`);
  }

  else if (type === "powerUp") {
    const delta = Math.trunc(Number(eff.delta ?? eff.power ?? 0));
    t1.status.power = { v: clamp(Number(t1.status?.power?.v ?? 0) + delta, 0, 200) };
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 威力+${delta}%`);
  }

  else if (type === "cleanse") {
    clearStatuses(t1);
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 状態異常回復`);
  }

  else if (type === "bounce") {
    const owner = t1.owner;
    const idx = units.findIndex(u => u.id === t1.id);
    if (idx >= 0) units.splice(idx, 1);
    hands[owner] = safeArr(hands[owner]).concat([t1.cardId]);
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を手札に戻した`);
  }

  else if (type === "swapPos") {
    const ax = Number(t1.x), ay = Number(t1.y);
    t1.x = Number(t2.x); t1.y = Number(t2.y);
    t2.x = ax; t2.y = ay;
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → 位置入替：${sayTarget(t1)} ⇄ ${sayTarget(t2)}`);
  }

  else if (type === "moveTo") {
    const x = Math.trunc(Number(targetCell.x));
    const y = Math.trunc(Number(targetCell.y));
    const W = Number(eff.W ?? 5);
    const H = Number(eff.H ?? 7);

    if (x < 0 || x >= W || y < 0 || y >= H) {
      logLines.push(`[${seat}] サポート不発：盤外`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
    }
    if (isOccupied(units, x, y)) {
      logLines.push(`[${seat}] サポート不発：そのマスは埋まっている`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
    }

    const maxDist = (eff.maxDist == null) ? null : Math.max(0, Math.trunc(Number(eff.maxDist)));
    if (maxDist != null) {
      const dist = Math.abs(Number(t1.x) - x) + Math.abs(Number(t1.y) - y);
      if (dist > maxDist) {
        logLines.push(`[${seat}] サポート不発：距離制限 max=${maxDist} dist=${dist}`);
        return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
      }
    }

    t1.x = x; t1.y = y;
    logLines.push(`[${seat}] サポート成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を (${x},${y})へ移動`);
  }

  else {
    logLines.push(`[${seat}] サポート不発：未対応type=${type}`);
    return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, log: logLines.slice(-200), lastSupportRoll };
  }

  return {
    ok:true, applied:true,
    mana: mana2, hands, decks, units, kills,
    log: logLines.slice(-200),
    lastSupportRoll
  };
}

// =====================
// EX support (1-shot) - consume ex instead of hand
// =====================
export function applyExSupport({
  s,
  seat,
  cardDefs,
  exCardId,
  targetUnitId=null,
  targetUnitId2=null,
  targetCell=null,
  rand=Math.random,
}){
  const mana = normalizeMana(s.mana);

  const hands = { ...(s.hands || {A:[],B:[]}) };
  hands.A = safeArr(hands.A).slice();
  hands.B = safeArr(hands.B).slice();

  const decks = { ...(s.decks || {A:[],B:[]}) };
  decks.A = safeArr(decks.A).slice();
  decks.B = safeArr(decks.B).slice();

  const units = safeArr(s.units).map(u => ({...u, status: safeObj(u.status)}));
  const logLines = safeArr(s.log).slice();
  const kills = { ...(s.kills || {A:0,B:0}) };

  const ex = safeObj(s.ex);
  const exUsed = safeObj(s.exUsed);

  if (exUsed?.[seat]) return { ok:false, reason:"EX already used" };
  if (!exCardId) return { ok:false, reason:"EX card missing" };

  const def = cardDefs?.[exCardId];
  if (!def) return { ok:false, reason:"EX card def missing" };

  // EXは中身的には support と同じ処理でいい（kindがsupportでもexでもOKにしたいならここ調整）
  // 今回は「supportカードとして登録」前提にしておくのが楽
  if (!isSupportCard(def)) return { ok:false, reason:"EX card is not support-kind" };

  const baseCost = Number(def.cost ?? 0);
  if (mana[seat].cur < baseCost) return { ok:false, reason:"mana 부족" };

  // roll & resolve
  const roll = roll1to100(rand);
  const res = resolveSupportEffect(def.effect, roll);

  // pay mana ALWAYS
  const pay = spendMana(mana, seat, baseCost);
  if (!pay.ok) return { ok:false, reason:"mana spend failed" };
  const mana2 = pay.mana;

  const supportName = cardNameFromDefs(cardDefs, exCardId);

  // EXは必ず消費（成功失敗問わず）
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

  if (!res.ok || !res.chosen) {
    logLines.push(`[${seat}] EX失敗：${supportName} (-${baseCost}) 🎲${res.roll} / ${res.label}`);
    return {
      ok:true, applied:false,
      mana: mana2, hands, decks, units, kills,
      ex: ex2, exUsed: exUsed2,
      log: logLines.slice(-200),
      lastSupportRoll
    };
  }

  const eff = safeObj(res.chosen);
  const type = String(eff.type || "").trim();

  const t1 = targetUnitId ? findUnit(units, targetUnitId) : null;
  const t2 = targetUnitId2 ? findUnit(units, targetUnitId2) : null;

  const needUnit = new Set(["dmg","heal","modRate","bounce","powerUp","cleanse","moveTo"]);
  const needTwoUnits = new Set(["swapPos"]);
  const needCell = new Set(["moveTo"]);

  if (needTwoUnits.has(type)) {
    if (!isAlive(t1) || !isAlive(t2) || t1.id === t2.id) {
      logLines.push(`[${seat}] EX不発：対象2体が必要`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
    }
  } else if (needUnit.has(type)) {
    if (!isAlive(t1)) {
      logLines.push(`[${seat}] EX不発：対象が必要`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
    }
  }

  if (needCell.has(type)) {
    const c = targetCell && typeof targetCell === "object" ? targetCell : null;
    if (!c || !Number.isFinite(Number(c.x)) || !Number.isFinite(Number(c.y))) {
      logLines.push(`[${seat}] EX不発：移動先マスが必要`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
    }
  }

  const tag = `🎲${res.roll} / ${res.label}`;
  const sayTarget = (u)=> `${cardNameFromDefs(cardDefs, u.cardId)}(${u.owner})`;

  if (type === "draw") {
    const n = clamp(Number(eff.n ?? eff.draw ?? 1), 0, 10);
    const before = (decks[seat] || []).length;
    drawCards(decks, hands, seat, n);
    const after = (decks[seat] || []).length;
    const actual = before - after;
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ドロー${actual}`);
  }
  else if (type === "dmg") {
    const hp = Math.max(0, Math.trunc(Number(eff.hp ?? 0)));
    const sp = Math.max(0, Math.trunc(Number(eff.sp ?? 0)));

    if (hp > 0) t1.hp = Math.max(0, Number(t1.hp) - hp);
    if (sp > 0) t1.sp = Math.max(0, Number(t1.sp) - sp);

    setPanicAndCountIfNeeded(t1, seat, kills, logLines, cardDefs, "パニック撃破(EX)");
    if (Number(t1.hp) <= 0) {
      t1.hp = 0;
      countKillIfNeeded(t1, seat, kills, logLines, cardDefs, "撃破(EX)");
    }
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} に HP-${hp} SP-${sp}`);
  }
  else if (type === "heal") {
    const hp = Math.max(0, Math.trunc(Number(eff.hp ?? 0)));
    const sp = Math.max(0, Math.trunc(Number(eff.sp ?? 0)));
    const maxHP = Math.max(0, Number(cardDefs?.[t1.cardId]?.hp ?? 0));
    const maxSP = Math.max(0, Number(cardDefs?.[t1.cardId]?.sp ?? 0));

    if (hp > 0) t1.hp = clamp(Number(t1.hp) + hp, 0, maxHP || 9999);
    if (sp > 0) t1.sp = clamp(Number(t1.sp) + sp, 0, maxSP || 9999);
    if (Number(t1.sp) > 0) t1.panic = false;

    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を HP+${hp} SP+${sp}`);
  }
  else if (type === "modRate") {
    const delta = Math.trunc(Number(eff.delta ?? eff.rateDelta ?? 0));
    if (delta >= 0) t1.status.aim = { v: clamp(Number(t1.status?.aim?.v ?? 0) + delta, 0, 80) };
    else t1.status.jinx = { v: clamp(Number(t1.status?.jinx?.v ?? 0) + Math.abs(delta), 0, 80) };
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 命中${delta>=0?`+${delta}`:`-${Math.abs(delta)}`}%`);
  }
  else if (type === "powerUp") {
    const delta = Math.trunc(Number(eff.delta ?? eff.power ?? 0));
    t1.status.power = { v: clamp(Number(t1.status?.power?.v ?? 0) + delta, 0, 200) };
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 威力+${delta}%`);
  }
  else if (type === "cleanse") {
    clearStatuses(t1);
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} 状態異常回復`);
  }
  else if (type === "bounce") {
    const owner = t1.owner;
    const idx = units.findIndex(u => u.id === t1.id);
    if (idx >= 0) units.splice(idx, 1);
    hands[owner] = safeArr(hands[owner]).concat([t1.cardId]);
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を手札に戻した`);
  }
  else if (type === "swapPos") {
    const ax = Number(t1.x), ay = Number(t1.y);
    t1.x = Number(t2.x); t1.y = Number(t2.y);
    t2.x = ax; t2.y = ay;
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → 位置入替：${sayTarget(t1)} ⇄ ${sayTarget(t2)}`);
  }
  else if (type === "moveTo") {
    const x = Math.trunc(Number(targetCell.x));
    const y = Math.trunc(Number(targetCell.y));
    const W = Number(eff.W ?? 5);
    const H = Number(eff.H ?? 7);

    if (x < 0 || x >= W || y < 0 || y >= H) {
      logLines.push(`[${seat}] EX不発：盤外`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
    }
    if (isOccupied(units, x, y)) {
      logLines.push(`[${seat}] EX不発：そのマスは埋まっている`);
      return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
    }

    const maxDist = (eff.maxDist == null) ? null : Math.max(0, Math.trunc(Number(eff.maxDist)));
    if (maxDist != null) {
      const dist = Math.abs(Number(t1.x) - x) + Math.abs(Number(t1.y) - y);
      if (dist > maxDist) {
        logLines.push(`[${seat}] EX不発：距離制限 max=${maxDist} dist=${dist}`);
        return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
      }
    }

    t1.x = x; t1.y = y;
    logLines.push(`[${seat}] EX成功：${supportName} (-${baseCost}) ${tag} → ${sayTarget(t1)} を (${x},${y})へ移動`);
  }
  else {
    logLines.push(`[${seat}] EX不発：未対応type=${type}`);
    return { ok:true, applied:false, mana: mana2, hands, decks, units, kills, ex: ex2, exUsed: exUsed2, log: logLines.slice(-200), lastSupportRoll };
  }

  return {
    ok:true, applied:true,
    mana: mana2, hands, decks, units, kills,
    ex: ex2, exUsed: exUsed2,
    log: logLines.slice(-200),
    lastSupportRoll
  };
}