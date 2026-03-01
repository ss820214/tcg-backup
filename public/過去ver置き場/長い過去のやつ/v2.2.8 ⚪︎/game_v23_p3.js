const G = globalThis.__TCG_GAME__ || (globalThis.__TCG_GAME__ = {});
const {actFlags,actRangeLabel,addStatusListFromAny,arrowByBack,arrowByForward,buildDeck,buildRangeMap,buildSupportMap,calcInfilAddAtTurnEnd,canControl,cardName,checkWinLocal,countKillIfNeeded,countMyAliveUnits,describeSpecialEffects,displayAddStatus,ensureActionPickerCss,ensureBoardUnitCss,ensureHandCss,ensureInfilObj,ensureRngButton,ensureSelectedActionIndex,ensureSettingsButton,ensureStateInitialized,expandTokenToOffsets,flashTurnBanner,formatInfilText,forwardDy,getActRate,getSelectedTarget,getSelectedUnit,getStatusLocal,hexToRgba,inActionRange,loadCards,moveUsedThisTurn,normSeat,normalizePanicForAll,onSelectMyUnit,parseRangeSpecToOffsets,rangeSpecMaxDist,rangeSpecToArrow,rangeTokenToArrow,renderManaGauge,resetSupportPicks,resolveSeat,reviveFromPanicIfHealed,safeDrawCards,safeStatusText,selectedHandCardId,selectedHandDef,selectedIsSupport,setMode,setPanicAndCountIfNeeded,showDiceRoll,statusIconsText,supportEffectSummary,supportHintText,supportPlan,supportReadyByPlan,tagMapFromAny,typeColor,typeColorSoft,typeColorStrong,applyStatusesOnHitAdapter,calcHitRateAdapter,cellIndex,checkEvadeAdapter,ensureBoardAssistCss,ensureBoardGrid,fmtDamageEffect,fxFlash,fxOnHit,gainManaPlus2OnReceiveTurn,getActDeltas,getEvoCandidates,inSummonAreaForSeat,isEmptyCell,isLineBlocked,isSelfRange,logPush,onCellClick,pickDefaultSummonCell,renderBoard,renderHand,safeInfilText,setTurnUI,showCardDetail,showUnitDetail,spendManaMut,unitAt,updateQuickActions} = G;

// =====================
// Action picker (Attack/Support exec buttons)
// =====================
G.execAttackBtn = null;
G.execSupportBtn = null;

function renderActionPicker(st){
  if (!G.actionPickerEl) return;
  ensureActionPickerCss();

  G.actionPickerEl.innerHTML = "";
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
  G.actionPickerEl.appendChild(title);

  // 進化ボタンの活性（外のボタン）
  try{
    if (G.btnDoEvolve){
      G.btnDoEvolve.disabled = !(myTurn && G.mode === "evolve" && G.evoBaseId && G.selectedHandIndex != null && G.evoCandidates?.has(G.selectedHandIndex));
    }
  }catch{}

  // ---- Support panel ----
  const handDef = selectedHandDef(st);
  if (G.mode === "support" && myTurn && handDef && G.isSupportCard(handDef)) {
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

    G.execSupportBtn = document.createElement("button");
    G.execSupportBtn.className = "btnExec";
    G.execSupportBtn.textContent = "サポート実行";
    G.execSupportBtn.disabled = !ready;
    G.execSupportBtn.addEventListener("click", ()=> execSupport(st));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btnGhost";
    cancelBtn.textContent = "選択クリア";
    cancelBtn.addEventListener("click", ()=>{
      resetSupportPicks();
      render(st);
    });

    footer.appendChild(G.execSupportBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(footer);
    G.actionPickerEl.appendChild(panel);
    return;
  }

  // ---- Attack panel ----
  if (G.mode === "attack" && myTurn && su && su.owner === G.seat) {
    const def = G.cardDefs[su.cardId] || {};
    const acts = Array.isArray(def.actions) ? def.actions : [];
    ensureSelectedActionIndex(st);

    const wrap = document.createElement("div");
    wrap.className = "actWrap";

    for (let i=0;i<acts.length;i++){
      const act = acts[i];
      const btn = document.createElement("button");
      btn.className = "actBtn" + (i === G.selectedActionIndex ? " selected" : "");
      const rate = calcHitRateAdapter(su, act);
      const rng = actRangeLabel(act, su.owner);

      btn.innerHTML = `<span class="actText">
        <span class="badge">${act.cost ?? "?"}</span>
        ${act.name ?? "?"}
        <span class="badge">命中${rate}%</span>
        <span class="badge">${rng}</span>
      </span>`;

      btn.addEventListener("click", ()=>{
        G.selectedActionIndex = i;
        render(st);
      });

      wrap.appendChild(btn);
    }

    G.actionPickerEl.appendChild(wrap);

    const panel = document.createElement("div");
    panel.className = "apPanel";

    const hint = document.createElement("div");
    hint.className = "hint";

    const tgt = getSelectedTarget(st);
    hint.textContent =
            `選択ユニット：${cardName(su.cardId)}\n` +
      `技：${(acts[G.selectedActionIndex]?.name ?? "?")}（コスト:${acts[G.selectedActionIndex]?.cost ?? "?"}）\n` +
      `対象：${getSelectedTarget(st) ? cardName(getSelectedTarget(st).cardId) : "未選択"}\n` +
      `手順：対象ユニットをクリック → 「行動実行」\n` +
      (su.fatigue ? `\n※疲労中：行動できません` : "");

    panel.appendChild(hint);

    const footer = document.createElement("div");
    footer.className = "apFooter";

    G.execAttackBtn = document.createElement("button");
    G.execAttackBtn.className = "btnExec";
    G.execAttackBtn.textContent = "行動実行";

    const act = acts[G.selectedActionIndex] || acts[0] || null;
    const mana = G.normalizeMana(st.mana);
    const canPay = act ? (mana?.[G.seat]?.cur >= Math.max(0, Math.trunc(Number(act.cost ?? 0)))) : false;

    // 対象が必要か？（self は不要 / aoe はクリック対象無しでもOKにするが、基本は選択推奨）
    const needTarget = act ? !isSelfRange(act.range) : true;
    const hasTarget = !!getSelectedTarget(st);

    // 実行可否
    G.execAttackBtn.disabled =
      !act ||
      G.isPanic(su) ||
      !!su.fatigue ||
      !canPay ||
      (needTarget && !hasTarget);

    G.execAttackBtn.addEventListener("click", ()=> execAttack(st));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btnGhost";
    cancelBtn.textContent = "対象クリア";
    cancelBtn.addEventListener("click", ()=>{
      G.selectedTargetId = null;
      render(st);
    });

    footer.appendChild(G.execAttackBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(footer);
    G.actionPickerEl.appendChild(panel);
    return;
  }

  // それ以外（デフォルト）
  const p = document.createElement("div");
  p.className = "apPanel";
  p.innerHTML = `<div class="small">ユニット選択→モードを選んで操作してね</div>`;
  G.actionPickerEl.appendChild(p);
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
    if (typeof G.applyPowerUpToHpDamage !== "function") return dmg;
    const n = G.applyPowerUpToHpDamage.length;
    if (n >= 3) return Math.max(0, Math.trunc(Number(G.applyPowerUpToHpDamage(attacker, dmg, act) ?? dmg)));
    if (n === 2) return Math.max(0, Math.trunc(Number(G.applyPowerUpToHpDamage(attacker, dmg) ?? dmg)));
    if (n === 1) return Math.max(0, Math.trunc(Number(G.applyPowerUpToHpDamage(attacker) ?? dmg)));
    return dmg;
  }catch{
    return dmg;
  }
}

function applyArmorAdapter(defender, hpDamageAbs){
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try{
    if (typeof G.applyArmorToHpDamage !== "function") return dmg;
    const n = G.applyArmorToHpDamage.length;
    if (n >= 2) return Math.max(0, Math.trunc(Number(G.applyArmorToHpDamage(defender, dmg) ?? dmg)));
    if (n === 1) return Math.max(0, Math.trunc(Number(G.applyArmorToHpDamage(defender) ?? dmg)));
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
  if (!su || su.owner !== G.seat) return;

  const def = G.cardDefs[su.cardId] || {};
  const acts = Array.isArray(def.actions) ? def.actions : [];
  if (!acts.length) return;

  ensureSelectedActionIndex(st);
  const act = acts[G.selectedActionIndex] || acts[0];
  if (!act) return;

  const needTarget = !isSelfRange(act.range);
  const target = getSelectedTarget(st);

  // 対象が必要なのに無い
  if (needTarget && !target && !actFlags(act).aoe) return;

  await G.runTransaction(G.db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = (s.kills && typeof s.kills === "object") ? s.kills : {A:0,B:0};
    ensureInfilObj(s);

    const attacker = s.units.find(u => u.id === su.id) || null;
    if (!attacker || attacker.owner !== G.seat) return;
    if (Number(attacker.hp) <= 0) return;
    if (G.isPanic(attacker)) return;
    if (attacker.fatigue) return;

    const def2 = G.cardDefs[attacker.cardId] || {};
    const acts2 = Array.isArray(def2.actions) ? def2.actions : [];
    const act2 = acts2[G.selectedActionIndex] || acts2[0] || null;
    if (!act2) return;

    // マナ支払い
    const cost = Math.max(0, Math.trunc(Number(act2.cost ?? 0)));
    const mana = G.normalizeMana(s.mana);
    if (mana?.[G.seat]?.cur < cost) return;
    s.mana = spendManaMut(s.mana, G.seat, cost);

    // 対象群
    const flags = actFlags(act2);

    let targets = [];
    if (isSelfRange(act2.range)){
      targets = [attacker];
    } else if (flags.aoe){
      targets = listTargetsForAoe(s, attacker, act2);
      // AOEでもクリック対象があれば log の見た目用に保持
    } else {
      const tid = normSeat(target?.owner) ? (target?.id) : G.selectedTargetId;
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
      at: G.nowMs(),
      r: rr.r,
      rate,
      hit: rr.hit && !evaded,
      actionName: actName
    };

    if (!rr.hit){
      logLines.push(`[${G.seat}] 行動失敗：${label}（命中${rate}%）`);
      attacker.fatigue = true; // 行動した扱い
      // ターン内の復帰（パニック解除）など
      normalizePanicForAll(s.units, s.kills, logLines);
      // 反映
      for (const ln of logLines) logPush(s, ln);
      tx.set(stateRef, s, { merge:true });
      return;
    }

    if (evaded){
      logLines.push(`[${G.seat}] 回避！：${label} → ${cardName(targets[0]?.cardId)}`);
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
      setPanicAndCountIfNeeded(t, G.seat, s.kills, logLines);

      // HP<=0 の撃破
      if (Number(t.hp) <= 0){
        countKillIfNeeded(t, G.seat, s.kills, logLines, "撃破");
      }
    }

    // 行動者は疲労
    attacker.fatigue = true;

    // ログ
    const tgtName =
      (targets.length === 1 && targets[0])
        ? cardName(targets[0].cardId)
        : (flags.aoe ? `複数(${targets.length})` : "なし");

    logLines.push(`[${G.seat}] 行動成功：${label} → ${tgtName}`);

    // lastHit（FX）
    const primaryTargetId =
      (targets.length === 1 && targets[0]) ? targets[0].id
      : (getSelectedTarget(s)?.id ?? (G.selectedTargetId ?? null));

    s.lastHit = {
      at: G.nowMs(),
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

// ---- Support 実行（G.applySupport が壊れても最低限動く） ----

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
  const u1 = G.supportTarget1Id ? units.find(u=>u.id===G.supportTarget1Id) : null;
  const u2 = G.supportTarget2Id ? units.find(u=>u.id===G.supportTarget2Id) : null;

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
    if (!u1 || !G.supportTargetCell) return { ok:false, label, eff, needs:"unitCell" };
    const {x,y} = G.supportTargetCell;
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
  if (!cid || !def || !G.isSupportCard(def)) return;

  const plan = supportPlan(def);
  if (!supportReadyByPlan(plan)) return;

  await G.runTransaction(G.db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.hands = s.hands || {A:[],B:[]};
    s.decks = s.decks || {A:[],B:[]};
    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = (s.kills && typeof s.kills === "object") ? s.kills : {A:0,B:0};
    ensureInfilObj(s);

    const hand = Array.isArray(s.hands[G.seat]) ? s.hands[G.seat] : [];
    const idx = G.selectedHandIndex;
    if (idx == null || idx < 0 || idx >= hand.length) return;
    if (hand[idx] !== cid) return;

    const mana = G.normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    if (mana?.[G.seat]?.cur < cost) return;

    // 支払い＆手札消費
    s.mana = spendManaMut(s.mana, G.seat, cost);
    hand.splice(idx, 1);
    s.hands[G.seat] = hand;

    // まずは support_core を試す（壊れても fallback）
    let ok = false;
    let label = "??";
    try{
      if (typeof G.applySupport === "function"){
        // シグネチャ差異吸収：G.applySupport(s, who, def, ctx?) など
        const n = G.applySupport.length;
        let ret;
        const ctx = {
  seat: G.seat,
  target1Id: G.supportTarget1Id,
  target2Id: G.supportTarget2Id,
  targetCell: G.supportTargetCell,
  cardId: cid
};
        if (n >= 4) ret = G.applySupport(s, G.seat, def, ctx);
        else if (n === 3) ret = G.applySupport(s, G.seat, def);
        else if (n === 2) ret = G.applySupport(s, G.seat);
        else ret = G.applySupport(s);

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
        throw new Error("G.applySupport missing");
      }
    }catch{
      const r = applySupportFallback(s, G.seat, def, plan);
      ok = !!r.ok;
      label = String(r.label ?? "fallback");
    }

    s.lastSupportRoll = {
      at: G.nowMs(),
      r: Math.floor(Math.random()*100)+1, // 表示用（fallback/coreでズレてもOK）
      ok,
      label,
      cardName: cardName(cid)
    };

    logPush(s, `[${G.seat}] Support使用：${cardName(cid)}（${ok ? "成功" : "失敗"}）`);

    // 勝利判定
    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      logPush(s, `🏁 勝者：${w}`);
    }

    tx.set(stateRef, s, { merge:true });
  });

  // UIクリア
  G.selectedHandIndex = null;
  resetSupportPicks();
}
Object.assign(G,{addOrSetStatus,applyArmorAdapter,applyPowerUpAdapter,applySupportFallback,clampUnitStats10,execAttack,execSupport,listTargetsForAoe,pickEffectByTable,renderActionPicker,rollHit,round10,supportAlwaysSuccessForDraw});
