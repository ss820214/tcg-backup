// public/game.p2.js
// (auto-split) Depends on game.p1.js exports
import * as P1 from "./game.p1.js";
const {
    CORE,
    DRAW_PER_TURN,
    H,
    MAX_MANA_UI,
    MAX_UNITS_PER_PLAYER,
    TYPE_RGB,
    W,
    WIN_INFIL_COUNT,
    WIN_KILL_COUNT,
    actFlags,
    actRangeLabel,
    actionPickerEl,
    addStatusListFromAny,
    app,
    applyArmorToHpDamage,
    applyBleedOnMove,
    applyExSupport,
    applyPowerUpToHpDamage,
    applySmellOnTurnEnd,
    applyStatusesOnHit,
    applySupport,
    arrowByBack,
    arrowByForward,
    boardEl,
    btnAttack,
    btnDoEvolve,
    btnEnd,
    btnEvolve,
    btnMove,
    btnQuickAttack,
    btnQuickMove,
    btnSummon,
    btnSupport,
    calcHitRateWithStatus,
    calcInfilAddAtTurnEnd,
    canControl,
    cardDefs,
    cardName,
    checkEvade,
    checkWin,
    checkWinLocal,
    collection,
    computeInfil,
    countMyAliveUnits,
    db,
    deckCountEl,
    describeSpecialEffects,
    detailEl,
    diceEl,
    displayAddStatus,
    doc,
    drawCards,
    ensureActionPickerCss,
    ensureBoardUnitCss,
    ensureHandCss,
    ensureInfilObj,
    ensureRngButton,
    ensureSelectedActionIndex,
    ensureSettingsButton,
    ensureStateInitialized,
    evoBaseId,
    evoCandidates,
    exBtnEl,
    exInfoEl,
    exWrapEl,
    expandTokenToOffsets,
    firebaseConfig,
    formatInfilText,
    formatStatusList,
    forwardDy,
    fxFlashEl,
    getActRate,
    getDoc,
    getDocs,
    getFirestore,
    getManaConsts,
    getSelectedTarget,
    getSelectedUnit,
    getStatus,
    handEl,
    hexToRgba,
    inActionRange,
    infilEl,
    initSettings,
    initializeApp,
    isMoveBlockedByStatus,
    isPanic,
    isSupportCard,
    killsEl,
    lastSelectedUnitId,
    loadCards,
    logEl,
    manaEl,
    manaGaugeEl,
    matchRef,
    mode,
    modeHintEl,
    moveUsedThisTurn,
    normSeat,
    normalizeMana,
    nowMs,
    onSelectMyUnit,
    onSnapshot,
    opponentSeat,
    params,
    parseAddStatus,
    parseRangeSpecToOffsets,
    parseTags,
    pinchFxEl,
    playerId,
    playerRef,
    quickActionsEl,
    quickMsgEl,
    rangeSpecMaxDist,
    rangeSpecToArrow,
    rangeTokenToArrow,
    resetSupportPicks,
    resolveSeat,
    resolveSupportEffect,
    rngMsgUntil,
    roomId,
    runTransaction,
    safeDrawCards,
    safeStatusText,
    seat,
    seatAPlayerId,
    seatBPlayerId,
    selectedActionIndex,
    selectedHandCardId,
    selectedHandDef,
    selectedHandIndex,
    selectedIsSupport,
    selectedTargetId,
    selectedUnitId,
    serverTimestamp,
    shuffle,
    spendMana,
    stateRef,
    summonArea,
    supportEffectSummary,
    supportEffectTextJa,
    supportHintText,
    supportPlan,
    supportReadyByPlan,
    supportTarget1Id,
    supportTarget2Id,
    supportTargetCell,
    tagMapFromAny,
    turnBanner,
    turnEl,
    typeColor,
    typeColorSoft,
    typeColorStrong,
    uid,
    youEl
  } = P1;

function showDiceRoll(lastRoll, lastSupportRoll){
  if (!diceEl) return;

  const lines = [];

  if (lastRoll) {
    const age = nowMs() - (lastRoll.at || 0);
    if (age <= 2600) {
      lines.push(`🎲 ${lastRoll.r} / ${lastRoll.rate}%  ${lastRoll.hit ? "✅ 成功" : "❌ 失敗"}  (${lastRoll.actionName})`);
    }
  }

  if (lastSupportRoll) {
    const age2 = nowMs() - (lastSupportRoll.at || 0);
    if (age2 <= 2600) {
      const ok = lastSupportRoll.ok ? "✅ 成功" : "❌ 失敗";
      lines.push(`🎲 ${lastSupportRoll.r} / ${lastSupportRoll.label}  ${ok}  (Support:${lastSupportRoll.cardName})`);
    }
  }

  diceEl.textContent = lines.join("\n");
}

function flashTurnBanner(){
  if (!turnBanner) return;
  turnBanner.style.display = "block";
  turnBanner.style.opacity = "1";
  setTimeout(()=>{ turnBanner.style.opacity = "0"; }, 900);
  setTimeout(()=>{ turnBanner.style.display = "none"; }, 1400);
}

function renderManaGauge(manaObj){
  if (!manaGaugeEl) return;
  manaGaugeEl.innerHTML = "";
  const m = normalizeMana(manaObj);
  const my = m[seat];

  for (let i=0;i<my.max;i++){
    const pip = document.createElement("div");
    pip.className = "manaPip max";
    if (i < my.cur) pip.classList.add("on");
    manaGaugeEl.appendChild(pip);
  }
  for (let i=my.max;i<MAX_MANA_UI;i++){
    const pip = document.createElement("div");
    pip.className = "manaPip";
    manaGaugeEl.appendChild(pip);
  }
}

// ===== Status icon helpers =====
const STATUS_ICON = {
  armor: "🛡️",
  bleed: "🩸",
  fracture: "🦴",
  smell: "👃",
  lostSoul: "👻",
  blind: "🙈",
  evade: "💨",
  combo: "🔗",
  followUp: "⚡",
  aim: "🎯",
  jinx: "🍀",
  powerUp: "💥",
  power: "💥",
};

// ★表示用 status 取得（getStatusが壊れても status/statuses から拾える）
function getStatusLocal(unit){
  try{
    if (typeof getStatus === "function"){
      const st = getStatus(unit);
      if (st && typeof st === "object") return st;
    }
  }catch{}
  const a = (unit && unit.status && typeof unit.status === "object") ? unit.status : null;
  const b = (unit && unit.statuses && typeof unit.statuses === "object") ? unit.statuses : null;
  if (!a && !b) return {};
  return Object.assign({}, b || {}, a || {});
}

function statusIconsText(unit){
  const st = getStatusLocal(unit);
  const keys = Object.keys(st || {});
  const order = ["armor","bleed","fracture","smell","lostSoul","blind","evade","combo","followUp","aim","jinx","powerUp","power"];

  if (keys.length){
    keys.sort((a,b)=> (order.indexOf(a)===-1?999:order.indexOf(a)) - (order.indexOf(b)===-1?999:order.indexOf(b)));
  }

  const parts = [];

  // ✅ パニック表示を盤面に出す（先頭）
  if (isPanic(unit)) parts.push("😱PANIC");

  for (const k of keys){
    const icon = STATUS_ICON[k] || "❔";
    const v = st[k]?.v;

    if (k === "armor") parts.push(`${icon}${Number(v ?? 0)}`);
    else if (k === "evade") parts.push(`${icon}${Number(v ?? 0)}`);
    else if (k === "bleed") parts.push(`${icon}${Number(v ?? 10)}`);
    else if (k === "smell") parts.push(`${icon}${Number(v ?? 10)}`);
    else if (k === "aim") parts.push(`${icon}+${Number(v ?? 0)}`);
    else if (k === "jinx") parts.push(`${icon}-${Number(v ?? 0)}`);
    else if (k === "powerUp") parts.push(`${icon}+${Number(v ?? 0)}`);
    else if (k === "power") parts.push(`${icon}+${Number(v ?? 0)}`);
    else parts.push((v != null && v !== true) ? `${icon}${v}` : `${icon}`);
  }

  return parts.join(" ");
}

function setMode(m){
  mode = m;

  if (m !== "support") resetSupportPicks();

  if (modeHintEl) {
    modeHintEl.textContent =
      m === "summon" ? "召喚：手札→フィールド（自陣2列のみ）" :
      m === "move"   ? "移動：自軍を選択→移動先をクリック（マナ-1 / ターン中2マスまで）" :
      m === "attack" ? "行動：攻撃対象をクリックで選択 → 「行動実行」ボタンで確定" :
      m === "evolve" ? "進化：進化元を選択→手札候補が光る→手札選択→進化実行（疲労でも可）" :
      m === "support"? "サポート：対象をクリックで選択 → 「サポート実行」ボタンで確定" :
      "ユニット選択→🏃移動 / ⚔️行動 を選択";
  }
  render(currentState);
}

btnSummon && (btnSummon.onclick = () => setMode("summon"));
btnMove   && (btnMove.onclick   = () => setMode("move"));
btnEvolve && (btnEvolve.onclick = () => setMode("evolve"));
btnSupport && (btnSupport.onclick = () => setMode("support"));
btnAttack && (btnAttack.onclick = () => setMode("attack"));

btnQuickMove?.addEventListener("click", ()=> setMode("move"));
btnQuickAttack?.addEventListener("click", async ()=> {
  // ✅ いきなり殴らない：攻撃モードにして「対象選択→行動実行」
  setMode("attack");
  render(currentState);
});

// =====================
// ★追加：撃破カウント（panicも撃破扱い）
// =====================
function countKillIfNeeded(target, killerSeat, kills, logLines, reason="撃破"){
  if (!target || !kills) return;
  if (target.countedAsKill) return;

  target.countedAsKill = true;
  kills[killerSeat] = (kills[killerSeat] ?? 0) + 1;
  if (logLines) logLines.push(`[${killerSeat}] ${reason}：${cardName(target.cardId)}`);
}

function setPanicAndCountIfNeeded(target, killerSeat, kills, logLines, reason="パニック撃破"){
  if (!target) return;
  if (Number(target.sp) <= 0 && Number(target.hp) > 0) {
    const was = !!target.panic;
    target.panic = true;
    if (!was) {
      target.panicKillSeat = killerSeat;
      countKillIfNeeded(target, killerSeat, kills, logLines, reason);
    }
  }
}

function reviveFromPanicIfHealed(u, kills, logLines){
  if (!u || !u.panic) return false;
  if (Number(u.hp) > 0 && Number(u.sp) > 0) {
    u.panic = false;

    const ks = normSeat(u.panicKillSeat);
    if (ks && kills && typeof kills[ks] === "number") {
      kills[ks] = Math.max(0, Math.trunc(Number(kills[ks] ?? 0)) - 1);
    }

    u.countedAsKill = false;
    u.panicKillSeat = null;

    if (logLines) logLines.push(`[${u.owner}] 復帰：${cardName(u.cardId)}（パニック解除）`);
    return true;
  }
  return false;
}

function normalizePanicForAll(units, kills, logLines){
  const arr = Array.isArray(units) ? units : [];
  for (const u of arr){
    reviveFromPanicIfHealed(u, kills, logLines);
  }
}

// =====================
// v1.8.0: 射程ハイライト
// =====================
function buildRangeMap(st){
  const map = new Map();
  if (!st) return map;
  if (mode !== "attack") return map;

  ensureSelectedActionIndex(st);

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return map;

  const def = cardDefs[su.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;
  if (!act) return map;

  const units = Array.isArray(st.units) ? st.units : [];
  const flags = actFlags(act);

  if (isSelfRange(act.range)) {
    map.set(`${su.x},${su.y}`, { ok:true, self:true });
    return map;
  }

  if (flags.aoe) {
    const r = rangeSpecMaxDist(su, act.range);
    for (let y=0;y<H;y++){
      for (let x=0;x<W;x++){
        if (x === su.x && y === su.y) continue;
        const dist = Math.abs(su.x - x) + Math.abs(su.y - y);
        if (dist <= r) map.set(`${x},${y}`, { ok:true });
      }
    }
    return map;
  }

  const offs = parseRangeSpecToOffsets(act.range, su.owner);
  for (const o of offs){
    const x = su.x + o.dx;
    const y = su.y + o.dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;

    if (!flags.pierce) {
      const pseudo = { x, y };
      if (isLineBlocked(units, su, pseudo)) {
        map.set(`${x},${y}`, { ok:false, reason:"blocked" });
        continue;
      }
    }
    map.set(`${x},${y}`, { ok:true });
  }
  return map;
}

// ✅ Support用ハイライト（対象ユニット/対象マス）
function buildSupportMap(st){
  const map = new Map();
  if (!st) return map;
  if (mode !== "support") return map;
  if (!canControl(st)) return map;

  const def = selectedHandDef(st);
  if (!def || !isSupportCard(def)) return map;

  const plan = supportPlan(def);
  const units = Array.isArray(st.units) ? st.units : [];

  // unit: 全ユニットを候補に
  if (plan.need === "unit"){
    for (const u of units){
      if (!u || Number(u.hp) <= 0) continue;
      map.set(`${u.x},${u.y}`, { ok:true, kind:"unit" });
    }
    return map;
  }

  // unit2: 1体目選択後に2体目候補
  if (plan.need === "unit2"){
    for (const u of units){
      if (!u || Number(u.hp) <= 0) continue;
      if (supportTarget1Id && u.id === supportTarget1Id) continue;
      map.set(`${u.x},${u.y}`, { ok:true, kind:"unit2" });
    }
    return map;
  }

  // unitCell: まずユニット、選ばれたら空マス候補を出す
  if (plan.need === "unitCell"){
    if (!supportTarget1Id){
      for (const u of units){
        if (!u || Number(u.hp) <= 0) continue;
        map.set(`${u.x},${u.y}`, { ok:true, kind:"pickUnit" });
      }
      return map;
    }
    // 空マス候補（全域）
    for (let y=0;y<H;y++){
      for (let x=0;x<W;x++){
        const occ = units.find(v => v && Number(v.hp)>0 && v.x===x && v.y===y);
        if (occ) continue;
        map.set(`${x},${y}`, { ok:true, kind:"pickCell" });
      }
    }
    return map;
  }

  return map;
}

// =====================
// 詳細（敵も見れる）
// =====================
function getActDeltas(act){
  const hpDeltaRaw = (act && act.hpDelta !== undefined) ? Number(act.hpDelta) : undefined;
  const spDeltaRaw = (act && act.spDelta !== undefined) ? Number(act.spDelta) : undefined;

  let hpDelta = Number.isFinite(hpDeltaRaw) ? Math.trunc(hpDeltaRaw) : 0;
  let spDelta = Number.isFinite(spDeltaRaw) ? Math.trunc(spDeltaRaw) : 0;

  if ((!hpDeltaRaw && !spDeltaRaw) && act){
    const dmg = Number(act.dmg ?? act.damage ?? 0);
    const heal = Number(act.heal ?? 0);
    const dmgType = String(act.dmgType ?? act.damageType ?? "HP").toUpperCase();
    const healType = String(act.healType ?? "HP").toUpperCase();

    if (Number.isFinite(dmg) && dmg !== 0){
      if (dmgType === "SP") spDelta -= Math.trunc(dmg);
      else hpDelta -= Math.trunc(dmg);
    }
    if (Number.isFinite(heal) && heal !== 0){
      if (healType === "SP") spDelta += Math.trunc(heal);
      else hpDelta += Math.trunc(heal);
    }
  }

  // ★HP/SPは10単位の世界：ここで丸め（安全側）
  hpDelta = Math.trunc(hpDelta / 10) * 10;
  spDelta = Math.trunc(spDelta / 10) * 10;

  return { hpDelta, spDelta };
}

function fmtDamageEffect(act){
  const { hpDelta, spDelta } = getActDeltas(act);
  const parts = [];
  if (hpDelta < 0) parts.push(`HPダメージ:${Math.abs(hpDelta)}`);
  if (spDelta < 0) parts.push(`SPダメージ:${Math.abs(spDelta)}`);
  if (hpDelta > 0) parts.push(`HP回復:+${hpDelta}`);
  if (spDelta > 0) parts.push(`SP回復:+${spDelta}`);
  if (act?.draw !== undefined) parts.push(`ドロー:+${Math.trunc(Number(act.draw ?? 0))}`);
  return parts.length ? parts.join(" / ") : "（変化なし）";
}

function showCardDetail(cardId){
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  let html = `<b>${cardName(cardId)}</b> <span class="small">(${cardId})</span><br>`;
  html += `属性:${d.type ?? "?"} / コスト:${d.cost ?? "?"}<br>`;
  html += `HP:${d.hp ?? "?"} SP:${d.sp ?? "?"}<br>`;

  if (isSupportCard(d)) {
    html += `<br><b>サポート</b><br>`;
    html += `<span class="small">コスト:${d.cost ?? "?"}</span><br>`;
    html += `<span class="small">${supportEffectSummary(d)}</span>`;
    detailEl.innerHTML = html;
    return;
  }

  html += `<br><b>技（行動）</b><br>`;

  const acts = d.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  acts.forEach((a)=>{
    const rangeLbl = actRangeLabel(a, seat);
    const addS = displayAddStatus(a);
    const rate = getActRate(a);
    const warn = (a.range === "?" || a.range === "" || a.range == null)
      ? `<span style="color:#ff6;"> ※range未設定</span>`
      : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${rate}%)${addS}${warn}<br>`;
    html += `<span class="small">ダメージ/回復:${fmtDamageEffect(a)}</span><br>`;

    const specials = describeSpecialEffects(a);
    if (specials.length) {
      html += `<span class="small">特殊:${specials.join(" / ")}</span><br>`;
    }

    try{
      const tags = tagMapFromAny(a?.tags);
      const withRaw = String(tags.synergyWith ?? "").trim();
      if (withRaw) {
        const need = Math.max(1, Math.trunc(Number(tags.synergyNeed ?? 1)));
        const r = Math.trunc(Number(tags.synergyRate ?? 0));
        const p = Math.trunc(Number(tags.synergyPower ?? 0));
        const side = String(tags.synergySide ?? "ally");
        html += `<span class="small">シナジー: ${withRaw} x${need} (${side}) → 成功+${r}% / 威力+${p}</span><br>`;
      }
    }catch{}

    html += `<br>`;
  });

  detailEl.innerHTML = html;
}

function showUnitDetail(u, st=currentState){
  if (!detailEl) return;

  const def = cardDefs[u.cardId] || {};
  let html = `<b>${cardName(u.cardId)}</b> <span class="small">(${u.cardId})</span><br>`;
  html += `属性:${def.type ?? "?"} / 所有:${u.owner}<br>`;
  html += `HP:${u.hp} SP:${u.sp}<br>`;
  html += `疲労:${u.fatigue ? "あり" : "なし"}<br>`;

  const used = moveUsedThisTurn(u, st);
  html += `移動:${used}/2（ターン中）<br>`;

  html += `状態:${isPanic(u) ? "パニック（死亡扱い/行動不能）" : "通常"}<br>`;
  const icons = statusIconsText(u);
  html += `状態異常:${icons || "なし"}<br><br>`;

  const acts = def.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  html += `<b>技（行動）</b><br>`;

  acts.forEach((a)=>{
    const addS = displayAddStatus(a);
    const rangeLbl = actRangeLabel(a, u.owner);
    const rate = getActRate(a);
    const warn = (a.range === "?" || a.range === "" || a.range == null)
      ? `<span style="color:#ff6;"> ※range未設定</span>`
      : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${rate}%)${addS}${warn}<br>`;
    html += `<span class="small">ダメージ/回復:${fmtDamageEffect(a)}</span><br>`;

    const specials = describeSpecialEffects(a);
    if (specials.length) {
      html += `<span class="small">特殊:${specials.join(" / ")}</span><br>`;
    }

    html += `<br>`;
  });

  detailEl.innerHTML = html;
}

function getEvoCandidates(st, baseUnit){
  const res = new Set();
  const hand = st.hands?.[seat] || [];
  const baseDef = cardDefs[baseUnit.cardId];
  if (!baseDef) return res;

  const mana = normalizeMana(st.mana);
  for (let i=0;i<hand.length;i++){
    const cid = hand[i];
    const tDef = cardDefs[cid];
    if (!tDef) continue;
    if (tDef.type !== baseDef.type) continue;
    if (!(Number(tDef.cost) > Number(baseDef.cost))) continue;

    const extra = Number(tDef.cost) - Number(baseDef.cost);
    if (mana[seat].cur < extra) continue;
    res.add(i);
  }
  return res;
}

// =====================
// Quick actions
// =====================
function updateQuickActions(st){
  if (!quickActionsEl) return;

  const myTurn = canControl(st);
  const su = getSelectedUnit(st);

  if (!myTurn || !su || su.owner !== seat) { quickActionsEl.style.display = "none"; return; }
  quickActionsEl.style.display = "block";

  ensureSelectedActionIndex(st);

  const mana = normalizeMana(st.mana);
  const fatigued = !!su.fatigue;
  const def = cardDefs[su.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;

  const used = moveUsedThisTurn(su, st);

  if (btnQuickMove) {
    btnQuickMove.disabled = isPanic(su) || isMoveBlockedByStatus(su) || used >= 2;
  }

  const canPay = act ? (mana[seat].cur >= Number(act.cost ?? 0)) : false;
  if (btnQuickAttack) {
    // ✅ いきなり実行しないので「attackへ移動」用途に（押せる条件は緩く）
    btnQuickAttack.disabled = !act || isPanic(su) || !canPay;
  }

  if (!quickMsgEl) return;

  if (isPanic(su)) quickMsgEl.textContent = "パニック中：死亡扱い＆行動不能（回復で復帰）";
  else if (isMoveBlockedByStatus(su)) quickMsgEl.textContent = "骨折：移動不可";
  else if (used >= 2) quickMsgEl.textContent = "移動上限：このターンはもう動けません";
  else if (!act) quickMsgEl.textContent = "行動がないカードです";
  else if (fatigued) quickMsgEl.textContent = "疲労中：行動できません（移動はOK）";
  else if (!canPay) quickMsgEl.textContent = "マナ不足：行動できません";
  else if (mode === "attack") quickMsgEl.textContent = "対象を選んで「行動実行」で確定！";
  else quickMsgEl.textContent = "";
}

// =====================
// FX helpers
// =====================
function cellIndex(x,y){ return y*W + x; }

function fxFlash(kind="hit"){
  if (!fxFlashEl) return;
  fxFlashEl.classList.remove("on","kill");
  void fxFlashEl.offsetWidth;
  fxFlashEl.classList.add("on");
  if (kind === "kill") fxFlashEl.classList.add("kill");
  setTimeout(()=> fxFlashEl.classList.remove("on","kill"), 220);
}

let lastHitAtSeen = 0;
function fxOnHit(st){
  const lh = st?.lastHit;
  if (!lh?.at || lh.at === lastHitAtSeen) return;
  lastHitAtSeen = lh.at;

  if (!lh?.targetId || !Array.isArray(st.units)) return;

  const tu = st.units.find(u => u.id === lh.targetId) || null;
  if (!tu) return;

  const idx = cellIndex(tu.x, tu.y);
  const cell = boardEl?.children?.[idx];
  if (!cell) return;

  cell.classList.add("hitFlash");
  setTimeout(()=>cell.classList.remove("hitFlash"), 600);

  const items = Array.isArray(lh.items) ? lh.items : [];
  for (const it of items){
    const kind = String(it.kind || "");
    const delta = Number(it.delta ?? 0);
    if (!delta) continue;

    const el = document.createElement("div");
    el.className = "floatDmg";
    const k = (kind === "SP") ? "SP" : "HP";
    el.textContent = `${k}${delta>0?"+":""}${delta}`;
    cell.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 1000);
  }

  const kill = (Number(tu.hp) <= 0) || !!tu.panic;
  fxFlash(kill ? "kill" : "hit");
}

// =====================
// 判定吸収
// =====================
function isSelfRange(r){
  const s = String(r ?? "").trim().toLowerCase();
  return s === "self" || s === "0" || s === "me" || s === "自身";
}

// 直線＆斜め（従来互換の簡易ブロック）
function isLineBlocked(units, attacker, target){
  if (!attacker || !target) return false;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;

  const step = (v)=> v===0 ? 0 : (v>0 ? 1 : -1);
  let sx = step(dx);
  let sy = step(dy);

  const straight = (dx === 0 || dy === 0);
  const diag = (Math.abs(dx) === Math.abs(dy));
  if (!straight && !diag) return false;

  let x = attacker.x + sx;
  let y = attacker.y + sy;

  while (!(x === target.x && y === target.y)){
    const hit = (units || []).find(u => Number(u.hp) > 0 && u.x === x && u.y === y);
    if (hit) return true;
    x += sx; y += sy;
    if (x<0||x>=W||y<0||y>=H) break;
  }
  return false;
}

// ★修正：命中率は「baseRate」を必ず渡す（0%バグ/NaN吸収）
function calcHitRateAdapter(attacker, act){
  const base = getActRate(act); // 未設定なら100
  try{
    if (typeof calcHitRateWithStatus !== "function") return base;

    const n = calcHitRateWithStatus.length;
    let r;
    if (n >= 2) r = calcHitRateWithStatus(attacker, base);
    else if (n === 1) r = calcHitRateWithStatus(attacker);
    else r = base;

    const rr = Number(r);
    if (!Number.isFinite(rr)) return base;
    return Math.max(0, Math.min(100, Math.trunc(rr)));
  }catch{
    return base;
  }
}

// ★修正：checkEvade は defender + rng で呼ぶ
function checkEvadeAdapter(defender){
  try{
    if (typeof checkEvade !== "function") return false;

    const rng01 = ()=> Math.random(); // 0..1
    const n = checkEvade.length;

    if (n >= 2) return !!checkEvade(defender, rng01);
    if (n === 1) return !!checkEvade(defender);
    return false;
  }catch{
    return false;
  }
}

// ★修正：applyStatusesOnHit は (target, act) で呼ぶ
function applyStatusesOnHitAdapter(target, act){
  try{
    if (typeof applyStatusesOnHit !== "function") return [];
    const n = applyStatusesOnHit.length;
    if (n >= 2) return applyStatusesOnHit(target, act);
    if (n === 1) return applyStatusesOnHit(target);
    return [];
  }catch{
    return [];
  }
}

// =====================
// Snapshot + main loop
// =====================
let currentState = null;
let lastSeenTurnSeq = null;
let lastSeenTurn = null;

function safeInfilText(infil){
  if (infil == null) return "A:0 / B:0";
  if (typeof infil === "number") return `A:${Math.trunc(infil)} / B:0`;
  if (typeof infil === "string") {
    const s = infil.trim();
    if (!s) return "A:0 / B:0";
    if (s.includes("A") || s.includes("B")) return s;
    const n = Number(s);
    if (Number.isFinite(n)) return `A:${Math.trunc(n)} / B:0`;
    return s;
  }
  if (typeof infil === "object") {
    const a = Math.trunc(Number(infil.A ?? infil.a ?? 0));
    const b = Math.trunc(Number(infil.B ?? infil.b ?? 0));
    return `A:${Number.isFinite(a)?a:0} / B:${Number.isFinite(b)?b:0}`;
  }
  return "A:0 / B:0";
}

function logPush(st, line){
  if (!st) return;
  if (!Array.isArray(st.log)) st.log = [];
  st.log.push(String(line ?? ""));
  if (st.log.length > 200) st.log.splice(0, st.log.length - 200);
}

// ★致命バグ修正：spendMana() の戻りは {ok, mana} なので res.mana を使う
function spendManaMut(manaObj, who, cost){
  const m = normalizeMana(manaObj);
  const c = Math.max(0, Math.trunc(Number(cost ?? 0)));
  if (!c) return m;

  try{
    const res = spendMana(m, who, c);
    if (res && typeof res === "object" && res.mana) return normalizeMana(res.mana);
    // 万一古い実装で mana を直接返すタイプなら吸収
    return normalizeMana(res ?? m);
  }catch{
    m[who].cur = Math.max(0, Math.trunc(Number(m[who].cur ?? 0)) - c);
    return normalizeMana(m);
  }
}

function gainManaPlus2OnReceiveTurn(manaObj, who){
  const m = normalizeMana(manaObj);
  const maxCap = Math.trunc(Number(CORE.MAX_MANA ?? 999));
  const add = 2;

  const curMax = Math.trunc(Number(m?.[who]?.max ?? 0));
  const nextMax = Math.min(maxCap, curMax + add);

  m[who] = m[who] || {cur:0,max:0};
  m[who].max = nextMax;
  m[who].cur = nextMax;

  return normalizeMana(m);
}

function setTurnUI(st){
  if (!st) return;
  const t = normSeat(st.turn) || "?";
  if (turnEl) turnEl.textContent = t;

  const mana = normalizeMana(st.mana);
  const a = mana.A, b = mana.B;
  if (manaEl) manaEl.textContent = `A ${a.cur}/${a.max} | B ${b.cur}/${b.max}`;
  renderManaGauge(mana);

  if (deckCountEl) {
    const da = Array.isArray(st?.decks?.A) ? st.decks.A.length : 0;
    const db = Array.isArray(st?.decks?.B) ? st.decks.B.length : 0;
    deckCountEl.textContent = `残り A:${da} / B:${db}`;
  }

  if (killsEl) {
    const ka = Math.trunc(Number(st?.kills?.A ?? 0));
    const kb = Math.trunc(Number(st?.kills?.B ?? 0));
    killsEl.textContent = `A:${ka} / B:${kb}`;
  }

  // ★infil 表示：computeInfil が壊れても落ちない / 既存stateもOK
  try{
    const infilObj = ensureInfilObj(st);
    let infilRaw = null;
    try{ infilRaw = computeInfil(st); }catch{}
    if (infilEl) infilEl.textContent = (infilRaw != null) ? safeInfilText(infilRaw) : formatInfilText(infilObj);
  }catch{
    if (infilEl) infilEl.textContent = "A:0 / B:0";
  }

  showDiceRoll(st.lastRoll, st.lastSupportRoll);

  // EX表示（あれば）
  try{
    if (exInfoEl){
      const exId = st?.ex?.[seat] ?? null;
      const used = !!st?.exUsed?.[seat];
      exInfoEl.textContent = exId ? `EX: ${cardName(exId)} ${used ? "（使用済）" : ""}` : "EX: なし";
    }
    if (exBtnEl){
      const exId = st?.ex?.[seat] ?? null;
      const used = !!st?.exUsed?.[seat];
      exBtnEl.disabled = !canControl(st) || !exId || used;
    }
  }catch{}
}

// =====================
// Board init
// =====================
function ensureBoardGrid(){
  if (!boardEl) return;
  if (boardEl.children && boardEl.children.length === W*H) return;

  boardEl.innerHTML = "";
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.addEventListener("click", ()=> onCellClick(x,y));
      boardEl.appendChild(cell);
    }
  }
}

function unitAt(st, x, y){
  const units = Array.isArray(st?.units) ? st.units : [];
  return units.find(u => Number(u.hp) > 0 && u.x === x && u.y === y) || null;
}
function isEmptyCell(st, x, y){
  return !unitAt(st, x, y);
}

// =====================
// ★召喚エリア（厳密固定）
// 先行(A) = 手前側2列（下2列）
// 後攻(B) = 奥側2列（上2列）
// =====================
function inSummonAreaForSeat(x,y, who){
  if (who === "A") return y >= (H - 2);
  if (who === "B") return y <= 1;
  return false;
}

/**
 * 召喚エリア内の「おすすめ空きマス」を選ぶ
 */
function pickDefaultSummonCell(st, who){
  if (!st) return null;

  const xs = [];
  const center = (W - 1) / 2;
  for (let x=0;x<W;x++) xs.push(x);
  xs.sort((a,b)=> Math.abs(a-center) - Math.abs(b-center));

  const yStart = (who === "A") ? (H-1) : 0;
  const yEnd   = (who === "A") ? -1 : H;
  const yStep  = (who === "A") ? -1 : 1;

  for (let y=yStart; y!==yEnd; y+=yStep){
    for (const x of xs){
      if (!inSummonAreaForSeat(x,y,who)) continue;
      if (!isEmptyCell(st,x,y)) continue;
      return {x,y};
    }
  }
  return null;
}

// =====================
// Board assist CSS（召喚緑枠/射程など）
// =====================
function ensureBoardAssistCss(){
  if (document.getElementById("boardAssistCss_v20260201")) return;
  const css = document.createElement("style");
  css.id = "boardAssistCss_v20260201";
  css.textContent = `
    .cell{ position:relative; box-sizing:border-box; }
        .cell.summonOk{ outline:3px solid rgba(120,255,170,.55); outline-offset:-3px; }
    .cell.summonOk::after{
      content:"＋";
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:18px;
      color: rgba(120,255,170,.9);
      text-shadow: 0 2px 10px rgba(0,0,0,.65);
      pointer-events:none;
    }

    /* range highlight */
    .cell.rangeOk{ outline:3px solid rgba(90,170,255,.45); outline-offset:-3px; }
    .cell.rangeNo{ outline:3px dashed rgba(255,170,90,.35); outline-offset:-3px; }

    /* support highlight */
    .cell.supportOk{ outline:3px solid rgba(170,120,255,.45); outline-offset:-3px; }
    .cell.supportOk::after{
      content:"★";
      position:absolute; right:6px; bottom:4px;
      font-weight:900; font-size:14px;
      color: rgba(190,150,255,.95);
      text-shadow: 0 2px 10px rgba(0,0,0,.65);
      pointer-events:none;
    }

    /* selection */
    .cell.selUnit{ box-shadow: inset 0 0 0 3px rgba(120,255,170,.55); }
    .cell.selTarget{ box-shadow: inset 0 0 0 3px rgba(255,120,120,.45); }

    /* hit FX */
    .cell.hitFlash::before{
      content:"";
      position:absolute; inset:-2px;
      border-radius:10px;
      box-shadow: 0 0 0 3px rgba(255,255,255,.15), 0 0 20px rgba(255,255,255,.18);
      animation: hitFlash .6s ease both;
      pointer-events:none;
    }
    @keyframes hitFlash{
      0%{ opacity:0; transform: scale(.98); }
      20%{ opacity:1; transform: scale(1); }
      100%{ opacity:0; transform: scale(1.02); }
    }

    .floatDmg{
      position:absolute;
      left:50%; top:50%;
      transform: translate(-50%,-50%);
      padding:4px 8px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.22);
      background: rgba(0,0,0,.28);
      font-weight:900;
      font-size:12px;
      pointer-events:none;
      animation: floatUp 1s ease both;
      white-space:nowrap;
    }
    @keyframes floatUp{
      0%{ opacity:0; transform: translate(-50%,-20%); }
      15%{ opacity:1; }
      100%{ opacity:0; transform: translate(-50%,-120%); }
    }
  `;
  document.head.appendChild(css);
}

// =====================
// Board click handlers
// =====================
function onCellClick(x,y){
  const st = currentState;
  if (!st) return;

  // Support: unitCell の「移動先マス選択」
    // Support: unitCell の「移動先マス選択」
  if (mode === "support" && canControl(st)){
    const def = selectedHandDef(st);
    if (def && isSupportCard(def)){
      const plan = supportPlan(def);
      if (plan.need === "unitCell" && supportTarget1Id){
        const occ = unitAt(st, x, y);
        if (!occ){
          supportTargetCell = { x, y };
          render(st);
          return;
        }
      }
    }
  }

  const u = unitAt(st, x, y);

  // クリックがユニットなら：詳細表示＆（自軍なら）選択
  if (u){
    showUnitDetail(u, st);
    if (u.owner === seat) onSelectMyUnit(u.id, st);

    // Supportモード：対象ユニットの選択
    if (mode === "support" && canControl(st)){
      const def = selectedHandDef(st);
      if (def && isSupportCard(def)){
        const plan = supportPlan(def);

        if (plan.need === "unit"){
          supportTarget1Id = u.id;
          render(st);
          return;
        }
        if (plan.need === "unit2"){
          if (!supportTarget1Id) supportTarget1Id = u.id;
          else if (!supportTarget2Id && u.id !== supportTarget1Id) supportTarget2Id = u.id;
          else if (u.id === supportTarget1Id) {
            // 1体目を押し直したらリセット
            supportTarget1Id = u.id;
            supportTarget2Id = null;
          }
          render(st);
          return;
        }
        if (plan.need === "unitCell"){
          // まずユニットを選ぶ（どっちの陣営でもOK）
          supportTarget1Id = u.id;
          supportTargetCell = null;
          render(st);
          return;
        }
      }
    }

    // Attackモード：対象ユニットの選択（実行はボタン）
    if (mode === "attack" && canControl(st)){
      const su = getSelectedUnit(st);
      if (su && su.owner === seat){
        selectedTargetId = u.id;
        render(st);
        return;
      }
    }

    return;
  }

  // 空マスクリック：召喚/移動
  if (mode === "summon" && canControl(st)) {
    if (!inSummonAreaForSeat(x,y,seat)) return;

    const cid = selectedHandCardId(st);
    const def = selectedHandDef(st);
    if (!cid || !def) return;
    if (isSupportCard(def)) return;

    // 上限
    const myAlive = countMyAliveUnits(st.units, seat);
    if (myAlive >= MAX_UNITS_PER_PLAYER) {
      logPush(st, `[${seat}] 召喚失敗：場の上限(${MAX_UNITS_PER_PLAYER})`);
      render(st);
      return;
    }

    // コスト
    const mana = normalizeMana(st.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    if (mana[seat].cur < cost) return;

    // 召喚
    runTransaction(db, async (tx)=>{
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];
      if (unitAt(s, x, y)) return;

      if (!inSummonAreaForSeat(x,y,seat)) return;

      // hand remove
      s.hands = s.hands || {A:[],B:[]};
      const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];
      const idx = selectedHandIndex;
      if (idx == null || idx < 0 || idx >= hand.length) return;
      const cardId = hand[idx];
      if (cardId !== cid) return;

      const cd = cardDefs[cardId];
      if (!cd) return;
      if (isSupportCard(cd)) return;

      // pay
      s.mana = spendManaMut(s.mana, seat, cost);

      // create unit
      const unit = {
        id: uid(),
        cardId,
        owner: seat,
        x, y,
        hp: Math.trunc(Number(cd.hp ?? 0)),
        sp: Math.trunc(Number(cd.sp ?? 0)),
        fatigue: false,
        moveTurnSeq: Number(s.turnSeq ?? 1),
        moveUsed: 0,
        status: {},
        statuses: {},
        panic: false,
        countedAsKill: false,
        panicKillSeat: null,
      };

      // 10単位に正規化（念のため）
      unit.hp = Math.trunc(unit.hp/10)*10;
      unit.sp = Math.trunc(unit.sp/10)*10;

      s.units.push(unit);

      // remove from hand
      hand.splice(idx, 1);
      s.hands[seat] = hand;

      // log
      logPush(s, `[${seat}] 召喚：${cardName(cardId)} (${x},${y})`);
      s.lastSummon = { at: nowMs(), owner: seat, cardId };

      tx.set(stateRef, s, { merge:true });
    });

    return;
  }

  if (mode === "move" && canControl(st)) {
    const su = getSelectedUnit(st);
    if (!su || su.owner !== seat) return;
    if (isPanic(su)) return;
    if (isMoveBlockedByStatus(su)) return;

    const used = moveUsedThisTurn(su, st);
    if (used >= 2) return;

    // 1マス移動のみ（上下左右）
    const dx = Math.abs(x - su.x);
    const dy = Math.abs(y - su.y);
    if (dx + dy !== 1) return;

    // 移動先が空
    if (!isEmptyCell(st, x, y)) return;

    // マナ -1
    const mana = normalizeMana(st.mana);
    if (mana[seat].cur < 1) return;

    runTransaction(db, async (tx)=>{
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      const units = Array.isArray(s.units) ? s.units : [];
      const me = units.find(u=>u.id===su.id) || null;
      if (!me || me.owner !== seat) return;
      if (Number(me.hp) <= 0) return;
      if (isPanic(me)) return;
      if (isMoveBlockedByStatus(me)) return;

      // ターン内移動回数
      const curSeq = Number(s.turnSeq ?? 1);
      const usedNow = (Number(me.moveTurnSeq ?? 0) === curSeq) ? Number(me.moveUsed ?? 0) : 0;
      if (usedNow >= 2) return;

      // 目的地
      const dx2 = Math.abs(x - me.x);
      const dy2 = Math.abs(y - me.y);
      if (dx2 + dy2 !== 1) return;

      if (unitAt(s, x, y)) return;

      // pay
      s.mana = spendManaMut(s.mana, seat, 1);

      // bleed on move (仕様吸収)
      try{ applyBleedOnMove?.(me, s, seat); }catch{}

      // move
      const prev = { x: me.x, y: me.y };
      me.x = x; me.y = y;
      me.moveTurnSeq = curSeq;
      me.moveUsed = usedNow + 1;

      logPush(s, `[${seat}] 移動：${cardName(me.cardId)} (${prev.x},${prev.y})→(${x},${y})`);

      tx.set(stateRef, s, { merge:true });
    });

    return;
  }
}


// ===== module exports for splitting =====
export {
  STATUS_ICON,
  applyStatusesOnHitAdapter,
  buildRangeMap,
  buildSupportMap,
  calcHitRateAdapter,
  cellIndex,
  checkEvadeAdapter,
  countKillIfNeeded,
  currentState,
  ensureBoardAssistCss,
  ensureBoardGrid,
  flashTurnBanner,
  fmtDamageEffect,
  fxFlash,
  fxOnHit,
  gainManaPlus2OnReceiveTurn,
  getActDeltas,
  getEvoCandidates,
  getStatusLocal,
  inSummonAreaForSeat,
  isEmptyCell,
  isLineBlocked,
  isSelfRange,
  lastHitAtSeen,
  lastSeenTurn,
  lastSeenTurnSeq,
  logPush,
  normalizePanicForAll,
  onCellClick,
  pickDefaultSummonCell,
  renderManaGauge,
  reviveFromPanicIfHealed,
  safeInfilText,
  setMode,
  setPanicAndCountIfNeeded,
  setTurnUI,
  showCardDetail,
  showDiceRoll,
  showUnitDetail,
  spendManaMut,
  statusIconsText,
  unitAt,
  updateQuickActions
};
