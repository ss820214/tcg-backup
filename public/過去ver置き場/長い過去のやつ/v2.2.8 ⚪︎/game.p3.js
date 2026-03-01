// public/game.p3.js
// (auto-split) Entry module: imports p1+p2 then runs render/subscriptions
import * as P1 from "./game.p1.js";
import * as P2 from "./game.p2.js";
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
  const {
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
  } = P2;

// =====================
// Render board + hand
// =====================
function renderBoard(st){
  if (!boardEl) return;
  ensureBoardGrid();
  ensureBoardAssistCss();
  ensureBoardUnitCss();

  const rangeMap = buildRangeMap(st);
  const supportMap = buildSupportMap(st);

  const cells = boardEl.children;
  for (let i=0;i<cells.length;i++){
    const cell = cells[i];
    cell.innerHTML = "";
    cell.classList.remove(
      "summonOk",
      "rangeOk","rangeNo",
      "supportOk",
      "selUnit","selTarget",
      "hitFlash"
    );

    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);

    // summon highlight
    if (mode === "summon" && canControl(st) && inSummonAreaForSeat(x,y,seat) && isEmptyCell(st,x,y)) {
      cell.classList.add("summonOk");
    }

    // range highlight
    const rk = rangeMap.get(`${x},${y}`);
    if (rk) cell.classList.add(rk.ok ? "rangeOk" : "rangeNo");

    // support highlight
    const sk = supportMap.get(`${x},${y}`);
    if (sk?.ok) cell.classList.add("supportOk");

    const u = unitAt(st, x, y);
    if (!u) continue;

    // selection highlight
    if (u.id === selectedUnitId) cell.classList.add("selUnit");
    if (u.id === selectedTargetId) cell.classList.add("selTarget");

    const def = cardDefs[u.cardId] || {};
    const t = def.type || "?";
    const strong = typeColorStrong(t);
    const soft = typeColorSoft(t, 0.18);

    const box = document.createElement("div");
    box.className = "unitBox";
    box.style.borderColor = hexToRgba(strong, 0.45);
    box.style.background = soft;

    // panic badge
    if (isPanic(u)) {
      const pb = document.createElement("div");
      pb.className = "panicBadge";
      pb.textContent = "😱PANIC";
      box.appendChild(pb);
    }

    // top row
    const top = document.createElement("div");
    top.className = "uTop";

    const cost = document.createElement("div");
    cost.className = "uCost";
    cost.textContent = String(def.cost ?? "?");

    const typeEl = document.createElement("div");
    typeEl.className = "uType";
    typeEl.style.borderColor = hexToRgba(strong, 0.35);
    typeEl.textContent = String(t);

    top.appendChild(cost);
    top.appendChild(typeEl);
    box.appendChild(top);

    // name
    const nm = document.createElement("div");
    nm.className = "uName";
    nm.textContent = cardName(u.cardId);
    box.appendChild(nm);

    // hp/sp
    const hp = document.createElement("div");
    hp.className = "uHP";
    hp.textContent = `HP ${u.hp} / SP ${u.sp}`;
    box.appendChild(hp);

    // icons
    const ic = document.createElement("div");
    ic.className = "uIcons";
    ic.textContent = statusIconsText(u) || "";
    box.appendChild(ic);

    // owner ribbon
    const owner = document.createElement("div");
    owner.className = "uOwner " + (u.owner === seat ? "you" : "enemy");

    const left = document.createElement("div");
    left.textContent = (u.owner === seat) ? "YOU" : "ENEMY";

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.textContent = (u.owner === seat) ? "ALLY" : "FOE";

    owner.appendChild(left);
    owner.appendChild(tag);
    box.appendChild(owner);

    // click
    box.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      onCellClick(x,y);
    });

    cell.appendChild(box);
  }
}

function renderHand(st){
  if (!handEl) return;
  ensureHandCss();

  handEl.innerHTML = "";

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  for (let i=0;i<hand.length;i++){
    const cid = hand[i];
    const def = cardDefs[cid] || {};
    const t = def.type || "?";
    const strong = typeColorStrong(t);

    const card = document.createElement("div");
    card.className = "handCard" + (i === selectedHandIndex ? " selected" : "");
    card.style.setProperty("--accent", hexToRgba(strong, 0.55));
    card.style.setProperty("--accentSoft", hexToRgba(strong, 0.22));

    // evo candidate highlight
    if (mode === "evolve" && evoCandidates?.has(i)) card.classList.add("evoCandidate");

    const bar = document.createElement("div");
    bar.className = "hcBar";
    bar.style.background = `linear-gradient(180deg, ${hexToRgba(strong, 0.75)} 0%, rgba(0,0,0,.0) 140%)`;
    card.appendChild(bar);

    const r1 = document.createElement("div");
    r1.className = "hcRow1";

    const diamond = document.createElement("div");
    diamond.className = "hcDiamond";
    const sp = document.createElement("span");
    sp.textContent = String(def.cost ?? "?");
    diamond.appendChild(sp);

    const main = document.createElement("div");
    main.className = "hcMain";
    const name = document.createElement("div");
    name.className = "hcName";
    name.textContent = cardName(cid);
    const type = document.createElement("div");
    type.className = "hcType";
    type.textContent = isSupportCard(def) ? "Support" : (String(def.type ?? "?"));
    main.appendChild(name);
    main.appendChild(type);

    r1.appendChild(diamond);
    r1.appendChild(main);
    card.appendChild(r1);

    const r2 = document.createElement("div");
    r2.className = "hcRow2";

    const stats = document.createElement("div");
    stats.className = "hcStats";
    if (isSupportCard(def)){
      stats.innerHTML = `<span class="badge">SUPPORT</span>`;
    }else{
      stats.textContent = `HP ${def.hp ?? "?"} / SP ${def.sp ?? "?"}`;
    }

    const btn = document.createElement("button");
    btn.className = "hcDetailBtn";
    btn.textContent = "詳細";
    btn.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      showCardDetail(cid);
    });

    r2.appendChild(stats);
    r2.appendChild(btn);
    card.appendChild(r2);

    // click select
    card.addEventListener("click", ()=>{
      selectedHandIndex = i;
      showCardDetail(cid);

      // サポート選択したらサポートモードに寄せる（任意）
      if (selectedIsSupport(st)) setMode("support");

      render(st);
    });

    handEl.appendChild(card);
  }
}

// =====================
// Action picker (Attack/Support exec buttons)
// =====================
let execAttackBtn = null;
let execSupportBtn = null;

function renderActionPicker(st){
  if (!actionPickerEl) return;
  ensureActionPickerCss();

  actionPickerEl.innerHTML = "";
  if (!st) return;

  const myTurn = canControl(st);
  const su = getSelectedUnit(st);

  // タイトル
  const title = document.createElement("div");
  title.className = "apTitle";

  const b = document.createElement("b");
  b.textContent = "行動パネル";

  const small = document.createElement("div");
  small.className = "small";
  small.textContent = myTurn ? "あなたのターン" : "相手のターン";

  title.appendChild(b);
  title.appendChild(small);
  actionPickerEl.appendChild(title);

  // 進化ボタンの活性（外のボタン）
  try{
    if (btnDoEvolve){
      btnDoEvolve.disabled = !(myTurn && mode === "evolve" && evoBaseId && selectedHandIndex != null && evoCandidates?.has(selectedHandIndex));
    }
  }catch{}

  // ---- Support panel ----
  const handDef = selectedHandDef(st);
  if (mode === "support" && myTurn && handDef && isSupportCard(handDef)) {
    const plan = supportPlan(handDef);
    const ready = supportReadyByPlan(plan);

    const panel = document.createElement("div");
    panel.className = "apPanel";

    const row = document.createElement("div");
    row.className = "row";

    const left = document.createElement("div");
    left.innerHTML = `<div class="title">Support</div><div class="small">${cardName(selectedHandCardId(st))}</div>`;

    const right = document.createElement("div");
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = ready ? "準備OK" : "対象選択中";
    right.appendChild(pill);

    row.appendChild(left);
    row.appendChild(right);
    panel.appendChild(row);

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = supportHintText(st);
    panel.appendChild(hint);

    const footer = document.createElement("div");
    footer.className = "apFooter";

    execSupportBtn = document.createElement("button");
    execSupportBtn.className = "btnExec";
    execSupportBtn.textContent = "サポート実行";
    execSupportBtn.disabled = !ready;
    execSupportBtn.addEventListener("click", ()=> execSupport(st));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btnGhost";
    cancelBtn.textContent = "選択クリア";
    cancelBtn.addEventListener("click", ()=>{
      resetSupportPicks();
      render(st);
    });

    footer.appendChild(execSupportBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(footer);
    actionPickerEl.appendChild(panel);
    return;
  }

  // ---- Attack panel ----
  if (mode === "attack" && myTurn && su && su.owner === seat) {
    const def = cardDefs[su.cardId] || {};
    const acts = Array.isArray(def.actions) ? def.actions : [];
    ensureSelectedActionIndex(st);

    const wrap = document.createElement("div");
    wrap.className = "actWrap";

    for (let i=0;i<acts.length;i++){
      const act = acts[i];
      const btn = document.createElement("button");
      btn.className = "actBtn" + (i === selectedActionIndex ? " selected" : "");
      const rate = calcHitRateAdapter(su, act);
      const rng = actRangeLabel(act, su.owner);

      btn.innerHTML = `<span class="actText">
        <span class="badge">${act.cost ?? "?"}</span>
        ${act.name ?? "?"}
        <span class="badge">命中${rate}%</span>
        <span class="badge">${rng}</span>
      </span>`;

      btn.addEventListener("click", ()=>{
        selectedActionIndex = i;
        render(st);
      });

      wrap.appendChild(btn);
    }

    actionPickerEl.appendChild(wrap);

    const panel = document.createElement("div");
    panel.className = "apPanel";

    const hint = document.createElement("div");
    hint.className = "hint";

    const tgt = getSelectedTarget(st);
    hint.textContent =
            `選択ユニット：${cardName(su.cardId)}\n` +
      `技：${(acts[selectedActionIndex]?.name ?? "?")}（コスト:${acts[selectedActionIndex]?.cost ?? "?"}）\n` +
      `対象：${getSelectedTarget(st) ? cardName(getSelectedTarget(st).cardId) : "未選択"}\n` +
      `手順：対象ユニットをクリック → 「行動実行」\n` +
      (su.fatigue ? `\n※疲労中：行動できません` : "");

    panel.appendChild(hint);

    const footer = document.createElement("div");
    footer.className = "apFooter";

    execAttackBtn = document.createElement("button");
    execAttackBtn.className = "btnExec";
    execAttackBtn.textContent = "行動実行";

    const act = acts[selectedActionIndex] || acts[0] || null;
    const mana = normalizeMana(st.mana);
    const canPay = act ? (mana?.[seat]?.cur >= Math.max(0, Math.trunc(Number(act.cost ?? 0)))) : false;

    // 対象が必要か？（self は不要 / aoe はクリック対象無しでもOKにするが、基本は選択推奨）
    const needTarget = act ? !isSelfRange(act.range) : true;
    const hasTarget = !!getSelectedTarget(st);

    // 実行可否
    execAttackBtn.disabled =
      !act ||
      isPanic(su) ||
      !!su.fatigue ||
      !canPay ||
      (needTarget && !hasTarget);

    execAttackBtn.addEventListener("click", ()=> execAttack(st));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btnGhost";
    cancelBtn.textContent = "対象クリア";
    cancelBtn.addEventListener("click", ()=>{
      selectedTargetId = null;
      render(st);
    });

    footer.appendChild(execAttackBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(footer);
    actionPickerEl.appendChild(panel);
    return;
  }

  // それ以外（デフォルト）
  const p = document.createElement("div");
  p.className = "apPanel";
  p.innerHTML = `<div class="small">ユニット選択→モードを選んで操作してね</div>`;
  actionPickerEl.appendChild(p);
}

// =====================
// Support / Attack / Evolve / EX 実行コア
// =====================

// 10単位丸め
function round10(n){
  const v = Math.trunc(Number(n ?? 0));
  return Math.trunc(v / 10) * 10;
}

// 状態付与ヘルパ（status/statuses両対応）
function addOrSetStatus(unit, key, deltaOrValue){
  if (!unit) return;
  unit.status = (unit.status && typeof unit.status === "object") ? unit.status : {};
  unit.statuses = (unit.statuses && typeof unit.statuses === "object") ? unit.statuses : {};
  const st = getStatusLocal(unit);

  const cur = st?.[key]?.v;
  const base = Number.isFinite(Number(cur)) ? Number(cur) : 0;
  const add = Number.isFinite(Number(deltaOrValue)) ? Number(deltaOrValue) : 0;

  const v = base + add;

  unit.status[key] = { v };
  unit.statuses[key] = { v };
}

// powerUp/armor 適用アダプタ（state側実装差異吸収）
function applyPowerUpAdapter(attacker, hpDamageAbs, act){
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try{
    if (typeof applyPowerUpToHpDamage !== "function") return dmg;
    const n = applyPowerUpToHpDamage.length;
    if (n >= 3) return Math.max(0, Math.trunc(Number(applyPowerUpToHpDamage(attacker, dmg, act) ?? dmg)));
    if (n === 2) return Math.max(0, Math.trunc(Number(applyPowerUpToHpDamage(attacker, dmg) ?? dmg)));
    if (n === 1) return Math.max(0, Math.trunc(Number(applyPowerUpToHpDamage(attacker) ?? dmg)));
    return dmg;
  }catch{
    return dmg;
  }
}

function applyArmorAdapter(defender, hpDamageAbs){
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try{
    if (typeof applyArmorToHpDamage !== "function") return dmg;
    const n = applyArmorToHpDamage.length;
    if (n >= 2) return Math.max(0, Math.trunc(Number(applyArmorToHpDamage(defender, dmg) ?? dmg)));
    if (n === 1) return Math.max(0, Math.trunc(Number(applyArmorToHpDamage(defender) ?? dmg)));
    return dmg;
  }catch{
    return dmg;
  }
}

function clampUnitStats10(u){
  if (!u) return;
  u.hp = round10(u.hp);
  u.sp = round10(u.sp);
  if (u.hp < 0) u.hp = 0;
  if (u.sp < 0) u.sp = 0;
}

// 命中ロール
function rollHit(rate){
  const r = Math.floor(Math.random() * 100) + 1; // 1..100
  return { r, hit: (r <= Math.max(0, Math.min(100, Math.trunc(rate)))) };
}

// 範囲内ターゲット列挙（AOE用）
function listTargetsForAoe(s, attacker, act){
  const units = Array.isArray(s?.units) ? s.units : [];
  const flags = actFlags(act);
  const r = rangeSpecMaxDist(attacker, act.range);

  const isAll = flags.aoe && (addStatusListFromAny(act?.addStatus).includes("all") || addStatusListFromAny(act?.addStatus).includes("全体"));
  const out = [];

  for (const u of units){
    if (!u || Number(u.hp) <= 0) continue;
    if (u.id === attacker.id) continue;

    const dist = Math.abs(u.x - attacker.x) + Math.abs(u.y - attacker.y);
    if (dist > r) continue;

    if (isAll) out.push(u);
    else {
      // 通常は敵だけ
      if (normSeat(u.owner) !== normSeat(attacker.owner)) out.push(u);
    }
  }
  return out;
}

async function execAttack(st){
  if (!st) return;
  if (!canControl(st)) return;

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return;

  const def = cardDefs[su.cardId] || {};
  const acts = Array.isArray(def.actions) ? def.actions : [];
  if (!acts.length) return;

  ensureSelectedActionIndex(st);
  const act = acts[selectedActionIndex] || acts[0];
  if (!act) return;

  const needTarget = !isSelfRange(act.range);
  const target = getSelectedTarget(st);

  // 対象が必要なのに無い
  if (needTarget && !target && !actFlags(act).aoe) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = (s.kills && typeof s.kills === "object") ? s.kills : {A:0,B:0};
    ensureInfilObj(s);

    const attacker = s.units.find(u => u.id === su.id) || null;
    if (!attacker || attacker.owner !== seat) return;
    if (Number(attacker.hp) <= 0) return;
    if (isPanic(attacker)) return;
    if (attacker.fatigue) return;

    const def2 = cardDefs[attacker.cardId] || {};
    const acts2 = Array.isArray(def2.actions) ? def2.actions : [];
    const act2 = acts2[selectedActionIndex] || acts2[0] || null;
    if (!act2) return;

    // マナ支払い
    const cost = Math.max(0, Math.trunc(Number(act2.cost ?? 0)));
    const mana = normalizeMana(s.mana);
    if (mana?.[seat]?.cur < cost) return;
    s.mana = spendManaMut(s.mana, seat, cost);

    // 対象群
    const flags = actFlags(act2);

    let targets = [];
    if (isSelfRange(act2.range)){
      targets = [attacker];
    } else if (flags.aoe){
      targets = listTargetsForAoe(s, attacker, act2);
      // AOEでもクリック対象があれば log の見た目用に保持
    } else {
      const tid = normSeat(target?.owner) ? (target?.id) : selectedTargetId;
      const tUnit = s.units.find(u => u.id === tid) || null;
      if (!tUnit || Number(tUnit.hp) <= 0) return;

      // 射程チェック
      if (!inActionRange(attacker, tUnit.x, tUnit.y, act2.range)) return;

      // ブロック（pierceでなければ）
      if (!flags.pierce){
        if (isLineBlocked(s.units, attacker, tUnit)) return;
      }

      targets = [tUnit];
    }

    // 命中率（状態込み）
    const rate = calcHitRateAdapter(attacker, act2);
    const rr = rollHit(rate);

    // 回避（ターゲット単体のとき）
    let evaded = false;
    if (rr.hit && targets.length === 1 && targets[0] && targets[0].id !== attacker.id){
      try{
        evaded = checkEvadeAdapter(targets[0]);
      }catch{}
    }

    const logLines = [];
    const actName = String(act2.name ?? "?");
    const label = `${cardName(attacker.cardId)}:${actName}`;

    s.lastRoll = {
      at: nowMs(),
      r: rr.r,
      rate,
      hit: rr.hit && !evaded,
      actionName: actName
    };

    if (!rr.hit){
      logLines.push(`[${seat}] 行動失敗：${label}（命中${rate}%）`);
      attacker.fatigue = true; // 行動した扱い
      // ターン内の復帰（パニック解除）など
      normalizePanicForAll(s.units, s.kills, logLines);
      // 反映
      for (const ln of logLines) logPush(s, ln);
      tx.set(stateRef, s, { merge:true });
      return;
    }

    if (evaded){
      logLines.push(`[${seat}] 回避！：${label} → ${cardName(targets[0]?.cardId)}`);
      attacker.fatigue = true;
      normalizePanicForAll(s.units, s.kills, logLines);
      for (const ln of logLines) logPush(s, ln);
      tx.set(stateRef, s, { merge:true });
      return;
    }

    // 成功時：効果適用
    const { hpDelta, spDelta } = getActDeltas(act2);

    // lastHit FX 用
    const hitItems = [];

    // 複数ターゲットにも対応
    for (const t of targets){
      if (!t || Number(t.hp) <= 0) continue;

      // HPダメージ（powerUp/armor）
      if (hpDelta < 0){
        let dmg = Math.abs(hpDelta);
        dmg = applyPowerUpAdapter(attacker, dmg, act2);
        dmg = applyArmorAdapter(t, dmg);

        t.hp = round10(Number(t.hp) - dmg);
        hitItems.push({ kind:"HP", delta: -dmg });

      } else if (hpDelta > 0){
        t.hp = round10(Number(t.hp) + hpDelta);
        hitItems.push({ kind:"HP", delta: +hpDelta });
      }

      // SP変化
      if (spDelta < 0){
        const dmgSp = Math.abs(spDelta);
        t.sp = round10(Number(t.sp) - dmgSp);
        hitItems.push({ kind:"SP", delta: -dmgSp });
      } else if (spDelta > 0){
        t.sp = round10(Number(t.sp) + spDelta);
        hitItems.push({ kind:"SP", delta: +spDelta });
      }

      clampUnitStats10(t);

      // 付与（target側に入る想定：state側仕様吸収）
      try{ applyStatusesOnHitAdapter(t, act2); }catch{}

      // パニック（SP<=0 & HP>0）を死亡扱いに
      setPanicAndCountIfNeeded(t, seat, s.kills, logLines);

      // HP<=0 の撃破
      if (Number(t.hp) <= 0){
        countKillIfNeeded(t, seat, s.kills, logLines, "撃破");
      }
    }

    // 行動者は疲労
    attacker.fatigue = true;

    // ログ
    const tgtName =
      (targets.length === 1 && targets[0])
        ? cardName(targets[0].cardId)
        : (flags.aoe ? `複数(${targets.length})` : "なし");

    logLines.push(`[${seat}] 行動成功：${label} → ${tgtName}`);

    // lastHit（FX）
    const primaryTargetId =
      (targets.length === 1 && targets[0]) ? targets[0].id
      : (getSelectedTarget(s)?.id ?? (selectedTargetId ?? null));

    s.lastHit = {
      at: nowMs(),
      attackerId: attacker.id,
      targetId: primaryTargetId || (targets[0]?.id ?? null),
      items: hitItems.slice(0, 6)
    };

    // パニック解除（回復で復帰したケース）
    normalizePanicForAll(s.units, s.kills, logLines);

    // 勝利判定
    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      logLines.push(`🏁 勝者：${w}`);
    }

    for (const ln of logLines) logPush(s, ln);
    tx.set(stateRef, s, { merge:true });
  });
}

// ---- Support 実行（applySupport が壊れても最低限動く） ----

function pickEffectByTable(eff, roll){
  const table = Array.isArray(eff?.table) ? eff.table : null;
  if (!table || !table.length) return eff;

  // row.rate を「重み」扱い（合計100想定）。無ければ均等。
  const weights = table.map(r=>{
    const w = Number(r?.rate ?? r?.p ?? r?.prob ?? 0);
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const sum = weights.reduce((a,b)=>a+b,0);

  if (sum <= 0){
    // 均等
    const idx = Math.min(table.length-1, Math.max(0, Math.trunc((roll-1)/100 * table.length)));
    const row = table[idx];
    return row?.effect ? row.effect : row;
  }

  let acc = 0;
  for (let i=0;i<table.length;i++){
    acc += weights[i];
    if (roll <= Math.ceil(acc / sum * 100)){
      const row = table[i];
      return row?.effect ? row.effect : row;
    }
  }
  const last = table[table.length-1];
  return last?.effect ? last.effect : last;
}

function supportAlwaysSuccessForDraw(eff){
  const e = eff?.effect ? eff.effect : eff;
  if (!e) return false;
  const t = String(e.type ?? "").trim();
  return t === "draw";
}

function applySupportFallback(s, who, def, plan){
  const eff0 = def?.effect || null;
  if (!eff0) return { ok:false, label:"効果なし" };

  const roll = Math.floor(Math.random() * 100) + 1;

  // table があるなら内容決定
  const eff = pickEffectByTable(eff0, roll);
  const type = String(eff?.type ?? "").trim();

  // rate（drawは強制成功）
  const rate = Math.max(0, Math.min(100, Math.trunc(Number(eff?.rate ?? eff0?.rate ?? 100))));
  const alwaysOk = supportAlwaysSuccessForDraw(eff);
  const hit = alwaysOk ? true : (roll <= rate);

  const label = `${roll} / ${alwaysOk ? "DRAW(強制)" : `${rate}%`}`;

  if (!hit) return { ok:false, label, eff };

  const units = Array.isArray(s.units) ? s.units : [];
  const u1 = supportTarget1Id ? units.find(u=>u.id===supportTarget1Id) : null;
  const u2 = supportTarget2Id ? units.find(u=>u.id===supportTarget2Id) : null;

  const curSeq = Number(s.turnSeq ?? 1);

  // 効果適用（最低限）
  if (type === "draw"){
    const n = Math.max(1, Math.trunc(Number(eff?.n ?? eff?.draw ?? 1)));
    safeDrawCards(s, who, n);
    logPush(s, `[${who}] Support: ドロー +${n}`);
  }
  else if (type === "heal"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    const hp = round10(Number(eff?.hp ?? eff?.heal ?? eff?.amount ?? 10));
    const sp = round10(Number(eff?.sp ?? 0));
    u1.hp = round10(Number(u1.hp) + hp);
    u1.sp = round10(Number(u1.sp) + sp);
    clampUnitStats10(u1);
    logPush(s, `[${who}] Support: 回復 ${cardName(u1.cardId)} HP+${hp}${sp?` SP+${sp}`:""}`);
  }
  else if (type === "dmg"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    const hp = round10(Number(eff?.hp ?? eff?.dmg ?? eff?.damage ?? eff?.amount ?? 10));
    u1.hp = round10(Number(u1.hp) - Math.abs(hp));
    clampUnitStats10(u1);
    // 撃破
    if (Number(u1.hp) <= 0) countKillIfNeeded(u1, who, s.kills, s.log, "Support撃破");
    logPush(s, `[${who}] Support: ダメージ ${cardName(u1.cardId)} HP-${Math.abs(hp)}`);
  }
  else if (type === "modRate"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    const d = Math.trunc(Number(eff?.delta ?? eff?.d ?? 10));
    if (d >= 0) addOrSetStatus(u1, "aim", d);
    else addOrSetStatus(u1, "jinx", Math.abs(d));
    logPush(s, `[${who}] Support: 命中${d>=0?"+":"-"}${Math.abs(d)}% → ${cardName(u1.cardId)}`);
  }
  else if (type === "powerUp"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    const d = Math.trunc(Number(eff?.delta ?? eff?.d ?? 10));
    addOrSetStatus(u1, "powerUp", d);
    logPush(s, `[${who}] Support: 威力+${d} → ${cardName(u1.cardId)}`);
  }
  else if (type === "cleanse"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    u1.status = {};
    u1.statuses = {};
    logPush(s, `[${who}] Support: 状態異常クリア → ${cardName(u1.cardId)}`);
  }
  else if (type === "recoverFatigue" || type === "fatigueHeal" || type === "fatigueClear"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    u1.fatigue = false;
    logPush(s, `[${who}] Support: 疲労回復 → ${cardName(u1.cardId)}`);
  }
  else if (type === "recoverMove" || type === "moveReset" || type === "refreshMove"){
    if (!u1) return { ok:false, label, eff, needs:"unit" };
    u1.moveTurnSeq = curSeq;
    u1.moveUsed = 0;
    logPush(s, `[${who}] Support: 移動回復（2マス） → ${cardName(u1.cardId)}`);
  }
  else if (type === "swapPos"){
    if (!u1 || !u2) return { ok:false, label, eff, needs:"unit2" };
    const ax = u1.x, ay = u1.y;
    u1.x = u2.x; u1.y = u2.y;
    u2.x = ax;   u2.y = ay;
    logPush(s, `[${who}] Support: 位置入替 ${cardName(u1.cardId)} ⇄ ${cardName(u2.cardId)}`);
  }
  else if (type === "moveTo"){
    if (!u1 || !supportTargetCell) return { ok:false, label, eff, needs:"unitCell" };
    const {x,y} = supportTargetCell;
    // 空マスでなければ中止
    const occ = units.find(v => v && Number(v.hp)>0 && v.x===x && v.y===y);
    if (occ) return { ok:false, label, eff, needs:"unitCell" };
    u1.x = x; u1.y = y;
    logPush(s, `[${who}] Support: 強制移動 ${cardName(u1.cardId)} → (${x},${y})`);
  }
  else {
    // 未対応は何もしないが成功扱い（落ちないこと優先）
    logPush(s, `[${who}] Support: ${type || "unknown"}（fallback適用なし）`);
  }

  // 回復で復帰
  normalizePanicForAll(s.units, s.kills, s.log);

  return { ok:true, label, eff };
}

async function execSupport(st){
  if (!st) return;
  if (!canControl(st)) return;

  const cid = selectedHandCardId(st);
  const def = selectedHandDef(st);
  if (!cid || !def || !isSupportCard(def)) return;

  const plan = supportPlan(def);
  if (!supportReadyByPlan(plan)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.hands = s.hands || {A:[],B:[]};
    s.decks = s.decks || {A:[],B:[]};
    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = (s.kills && typeof s.kills === "object") ? s.kills : {A:0,B:0};
    ensureInfilObj(s);

    const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];
    const idx = selectedHandIndex;
    if (idx == null || idx < 0 || idx >= hand.length) return;
    if (hand[idx] !== cid) return;

    const mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    if (mana?.[seat]?.cur < cost) return;

    // 支払い＆手札消費
    s.mana = spendManaMut(s.mana, seat, cost);
    hand.splice(idx, 1);
    s.hands[seat] = hand;

    // まずは support_core を試す（壊れても fallback）
    let ok = false;
    let label = "??";
    try{
      if (typeof applySupport === "function"){
        // シグネチャ差異吸収：applySupport(s, who, def, ctx?) など
        const n = applySupport.length;
        let ret;
        const ctx = {
          seat,
          target1Id: supportTarget1Id,
          target2Id: supportTarget2Id,
          targetCell: supportTargetCell,
          cardId: cid
        };
        if (n >= 4) ret = applySupport(s, seat, def, ctx);
        else if (n === 3) ret = applySupport(s, seat, def);
        else if (n === 2) ret = applySupport(s, seat);
        else ret = applySupport(s);

        // ret が {ok,label,state} 等の場合を吸う
        if (ret && typeof ret === "object"){
          if (ret.state && typeof ret.state === "object") {
            // state差し替え方式を吸収
            const ns = ret.state;
            for (const k of Object.keys(ns)) s[k] = ns[k];
          }
          if (ret.ok != null) ok = !!ret.ok;
          if (ret.label) label = String(ret.label);
        } else {
          ok = true;
          label = "core";
        }
      } else {
        throw new Error("applySupport missing");
      }
    }catch{
      const r = applySupportFallback(s, seat, def, plan);
      ok = !!r.ok;
      label = String(r.label ?? "fallback");
    }

    s.lastSupportRoll = {
      at: nowMs(),
      r: Math.floor(Math.random()*100)+1, // 表示用（fallback/coreでズレてもOK）
      ok,
      label,
      cardName: cardName(cid)
    };

    logPush(s, `[${seat}] Support使用：${cardName(cid)}（${ok ? "成功" : "失敗"}）`);

    // 勝利判定
    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      logPush(s, `🏁 勝者：${w}`);
    }

    tx.set(stateRef, s, { merge:true });
  });

  // UIクリア
  selectedHandIndex = null;
  resetSupportPicks();
}

// ---- 進化 ----
async function execEvolve(){
  const st = currentState;
  if (!st || !canControl(st)) return;
  if (mode !== "evolve") return;
  if (!evoBaseId) return;
  if (selectedHandIndex == null) return;
  if (!evoCandidates?.has(selectedHandIndex)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.hands = s.hands || {A:[],B:[]};

    const base = s.units.find(u=>u.id===evoBaseId) || null;
    if (!base || base.owner !== seat) return;
    if (Number(base.hp) <= 0) return;
    if (isPanic(base)) return;

    const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];
    const idx = selectedHandIndex;
    if (idx == null || idx < 0 || idx >= hand.length) return;

    const evoCardId = hand[idx];
    const baseDef = cardDefs[base.cardId];
    const evoDef = cardDefs[evoCardId];
    if (!baseDef || !evoDef) return;

    // 同属性＆コスト増の条件（UIと一致）
    if (String(evoDef.type) !== String(baseDef.type)) return;
    if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

    const extra = Math.max(0, Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)));
    const mana = normalizeMana(s.mana);
    if (mana?.[seat]?.cur < extra) return;

    // 支払い
    s.mana = spendManaMut(s.mana, seat, extra);

    // 進化：差分加算（ダメージ維持感）
    const hpDiff = round10(Number(evoDef.hp ?? 0) - Number(baseDef.hp ?? 0));
    const spDiff = round10(Number(evoDef.sp ?? 0) - Number(baseDef.sp ?? 0));

    base.cardId = evoCardId;
    base.hp = round10(Number(base.hp) + hpDiff);
    base.sp = round10(Number(base.sp) + spDiff);

    clampUnitStats10(base);

    // 手札から消費
    hand.splice(idx, 1);
    s.hands[seat] = hand;

    // ログ
    logPush(s, `[${seat}] 進化：${cardName(baseDef?.id ?? "") || "base"} → ${cardName(evoCardId)}（追加マナ:${extra}）`);
    s.lastEvolve = { at: nowMs(), owner: seat, baseId: evoBaseId, to: evoCardId };

    // 復帰チェック（回復でパニック解除する仕様に合わせる）
    normalizePanicForAll(s.units, s.kills, s.log);

    // 勝利判定
    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      logPush(s, `🏁 勝者：${w}`);
    }

    tx.set(stateRef, s, { merge:true });
  });

  // UIリセット
  evoBaseId = null;
  evoCandidates = new Set();
  selectedHandIndex = null;
  render(currentState);
}

// ---- EX ----
async function execEx(){
  const st = currentState;
  if (!st || !canControl(st)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.ex = s.ex || {A:null,B:null};
    s.exUsed = s.exUsed || {A:false,B:false};
    const exId = s?.ex?.[seat] ?? null;
    const used = !!s?.exUsed?.[seat];
    if (!exId || used) return;

    let ok = false;
    try{
      if (typeof applyExSupport === "function"){
        const n = applyExSupport.length;
        let ret;
        if (n >= 3) ret = applyExSupport(s, seat, exId);
        else if (n === 2) ret = applyExSupport(s, seat);
        else ret = applyExSupport(s);

        if (ret && typeof ret === "object" && ret.state){
          const ns = ret.state;
          for (const k of Object.keys(ns)) s[k] = ns[k];
        }
        ok = true;
      } else {
        // EXが無い場合でも落ちない
        ok = true;
        logPush(s, `[${seat}] EX：${cardName(exId)}（適用関数なし）`);
      }
    }catch{
      ok = false;
      logPush(s, `[${seat}] EX失敗：${cardName(exId)}`);
    }

    if (ok){
      s.exUsed[seat] = true;
      logPush(s, `[${seat}] EX使用：${cardName(exId)}`);
    }

    tx.set(stateRef, s, { merge:true });
  });
}

// =====================
// ターン終了
// =====================
async function endTurn(){
  const st = currentState;
  if (!st || !canControl(st)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    const who = normSeat(s.turn);
    if (!who) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = (s.kills && typeof s.kills === "object") ? s.kills : {A:0,B:0};
    ensureInfilObj(s);

    // ターン終了時：侵入加算
    const add = calcInfilAddAtTurnEnd(s, who);
    if (add > 0){
      s.infil[who] = Math.max(0, Math.trunc(Number(s.infil[who] ?? 0)) + add);
      logPush(s, `[${who}] 侵入 +${add}（累計:${s.infil[who]}）`);
    }

    // ターン終了時の状態処理（仕様差異吸収）
    try{ applySmellOnTurnEnd?.(s, who); }catch{}
    // 他にも必要ならここに吸収処理を追加可能

    // 勝利判定（終了時）
    const w0 = checkWinLocal(s);
    if (w0){
      s.winner = w0;
      logPush(s, `🏁 勝者：${w0}`);
      tx.set(stateRef, s, { merge:true });
      return;
    }

    // ターン交代
    const next = (who === "A") ? "B" : "A";
    s.turn = next;
    s.turnSeq = Math.trunc(Number(s.turnSeq ?? 1)) + 1;

    // 受け手のマナ+2（仕様通り max=cur）
    s.mana = gainManaPlus2OnReceiveTurn(s.mana, next);

    // 受け手ドロー（必ず増える）
    try{
      safeDrawCards(s, next, DRAW_PER_TURN);
    }catch{
      // ここで落ちない
    }

    // 自軍ユニットの疲労は「自分のターン開始時に解除」式ならここで解除してもいいが、
    // 既存仕様を壊さないため、ここでは解除しない（必要なら state 側で処理）
    // move回数は turnSeq で自動的にリセットされる設計

    logPush(s, `--- ${next}ターン ---`);

    // 終了時点での勝利判定（侵入ドロー等の後）
    const w1 = checkWinLocal(s);
    if (w1){
      s.winner = w1;
      logPush(s, `🏁 勝者：${w1}`);
    }

    tx.set(stateRef, s, { merge:true });
  });
}

// =====================
// モード別：クリック時の追加処理（進化ベース選択など）
// =====================
function onUnitClickedForMode(u, st){
  if (!u || !st) return;

  // evolve: ベース選択
  if (mode === "evolve" && canControl(st) && u.owner === seat && !isPanic(u) && Number(u.hp) > 0){
    evoBaseId = u.id;
    evoCandidates = getEvoCandidates(st, u);
    // 手札選択はユーザーが行う
    render(st);
  }
}

// 既存 onCellClick 内の u クリック処理にフック（落とさず後付け）
const _oldOnCellClick = onCellClick;
onCellClick = function(x,y){
  const st = currentState;
  if (!st) return;

  const u = unitAt(st, x, y);
  if (u){
    try{ onUnitClickedForMode(u, st); }catch{}
  }
  return _oldOnCellClick(x,y);
};

// =====================
// Log render
// =====================
function renderLog(st){
  if (!logEl) return;
  const lines = Array.isArray(st?.log) ? st.log : [];
  const tail = lines.slice(-30);

  const extra = [];
  if (nowMs() < rngMsgUntil) extra.push("🎲 乱数調整（見た目だけ）");

  logEl.textContent = (extra.concat(tail)).join("\n");
}

// =====================
// Main render
// =====================
function render(st){
  currentState = st;

  ensureRngButton();
  ensureSettingsButton();

  if (!st) return;

  // ターン変化UI
  const t = normSeat(st.turn);
  if (t && (t !== lastSeenTurn || st.turnSeq !== lastSeenTurnSeq)){
    // 自分のターンが来たときだけ目立たせる
    if (t === seat) flashTurnBanner();
    lastSeenTurn = t;
    lastSeenTurnSeq = st.turnSeq;

    // 相手ターンに入ったら操作系の選択を弱くリセット
    if (t !== seat){
      selectedTargetId = null;
      resetSupportPicks();
    }
  }

  setTurnUI(st);

  // 盤面＆手札
  renderBoard(st);
  renderHand(st);

  // 行動パネル
  renderActionPicker(st);

  // クイック
  updateQuickActions(st);

  // FX（被弾）
  try{ fxOnHit(st); }catch{}

  // ログ
  renderLog(st);

  // detailが空なら軽く誘導
  if (detailEl && !detailEl.innerHTML){
    detailEl.innerHTML = `<span class="small">ユニットや手札をクリックすると詳細が出るよ</span>`;
  }
}

// =====================
// Buttons bind
// =====================
btnDoEvolve && btnDoEvolve.addEventListener("click", ()=> execEvolve());
btnEnd && btnEnd.addEventListener("click", ()=> endTurn());
exBtnEl && exBtnEl.addEventListener("click", ()=> execEx());

// =====================
// Snapshot
// =====================
onSnapshot(stateRef, (snap)=>{
  if (!snap.exists()) return;
  const st = snap.data() || {};

  // 最低限の補完（落ちない）
  st.units = Array.isArray(st.units) ? st.units : [];
  st.hands = st.hands || {A:[],B:[]};
  st.decks = st.decks || {A:[],B:[]};
  st.kills = (st.kills && typeof st.kills === "object") ? st.kills : {A:0,B:0};
  ensureInfilObj(st);

  // schema差分の最低補完
  if (!st.ex) st.ex = {A:null, B:null};
  if (!st.exUsed) st.exUsed = {A:false, B:false};

  render(st);
}, (err)=>{
  console.error("[onSnapshot] error", err);
  if (logEl) logEl.textContent = String(err?.message ?? err);
});