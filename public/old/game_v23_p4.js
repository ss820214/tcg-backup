const G = globalThis.__TCG_GAME__ || (globalThis.__TCG_GAME__ = {});
const {actFlags,actRangeLabel,addStatusListFromAny,arrowByBack,arrowByForward,buildDeck,buildRangeMap,buildSupportMap,calcInfilAddAtTurnEnd,canControl,cardName,checkWinLocal,countKillIfNeeded,countMyAliveUnits,describeSpecialEffects,displayAddStatus,ensureActionPickerCss,ensureBoardUnitCss,ensureHandCss,ensureInfilObj,ensureRngButton,ensureSelectedActionIndex,ensureSettingsButton,ensureStateInitialized,expandTokenToOffsets,flashTurnBanner,formatInfilText,forwardDy,getActRate,getSelectedTarget,getSelectedUnit,getStatusLocal,hexToRgba,inActionRange,loadCards,moveUsedThisTurn,normSeat,normalizePanicForAll,onSelectMyUnit,parseRangeSpecToOffsets,rangeSpecMaxDist,rangeSpecToArrow,rangeTokenToArrow,renderManaGauge,resetSupportPicks,resolveSeat,reviveFromPanicIfHealed,safeDrawCards,safeStatusText,selectedHandCardId,selectedHandDef,selectedIsSupport,setMode,setPanicAndCountIfNeeded,showDiceRoll,statusIconsText,supportEffectSummary,supportHintText,supportPlan,supportReadyByPlan,tagMapFromAny,typeColor,typeColorSoft,typeColorStrong,applyStatusesOnHitAdapter,calcHitRateAdapter,cellIndex,checkEvadeAdapter,ensureBoardAssistCss,ensureBoardGrid,fmtDamageEffect,fxFlash,fxOnHit,gainManaPlus2OnReceiveTurn,getActDeltas,getEvoCandidates,inSummonAreaForSeat,isEmptyCell,isLineBlocked,isSelfRange,logPush,pickDefaultSummonCell,renderBoard,renderHand,safeInfilText,setTurnUI,showCardDetail,showUnitDetail,spendManaMut,unitAt,updateQuickActions,addOrSetStatus,applyArmorAdapter,applyPowerUpAdapter,applySupportFallback,clampUnitStats10,execAttack,execSupport,listTargetsForAoe,pickEffectByTable,renderActionPicker,rollHit,round10,supportAlwaysSuccessForDraw} = G;

// ---- 進化 ----
async function execEvolve(){
  const st = G.currentState;
  if (!st || !canControl(st)) return;
  if (G.mode !== "evolve") return;
  if (!G.evoBaseId) return;
  if (G.selectedHandIndex == null) return;
  if (!G.evoCandidates?.has(G.selectedHandIndex)) return;

  await G.runTransaction(G.db, async (tx)=>{
    const snap = await tx.get(G.stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.hands = s.hands || {A:[],B:[]};

    const base = s.units.find(u=>u.id===G.evoBaseId) || null;
    if (!base || base.owner !== G.seat) return;
    if (Number(base.hp) <= 0) return;
    if (G.isPanic(base)) return;

    const hand = Array.isArray(s.hands[G.seat]) ? s.hands[G.seat] : [];
    const idx = G.selectedHandIndex;
    if (idx == null || idx < 0 || idx >= hand.length) return;

    const evoCardId = hand[idx];
    const baseDef = G.cardDefs[base.cardId];
    const evoDef = G.cardDefs[evoCardId];
    if (!baseDef || !evoDef) return;

    // 同属性＆コスト増の条件（UIと一致）
    if (String(evoDef.type) !== String(baseDef.type)) return;
    if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

    const extra = Math.max(0, Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)));
    const mana = G.normalizeMana(s.mana);
    if (mana?.[G.seat]?.cur < extra) return;

    // 支払い
    s.mana = spendManaMut(s.mana, G.seat, extra);

    // 進化：差分加算（ダメージ維持感）
    const hpDiff = round10(Number(evoDef.hp ?? 0) - Number(baseDef.hp ?? 0));
    const spDiff = round10(Number(evoDef.sp ?? 0) - Number(baseDef.sp ?? 0));

    base.cardId = evoCardId;
    base.hp = round10(Number(base.hp) + hpDiff);
    base.sp = round10(Number(base.sp) + spDiff);

    clampUnitStats10(base);

    // 手札から消費
    hand.splice(idx, 1);
    s.hands[G.seat] = hand;

    // ログ
    logPush(s, `[${G.seat}] 進化：${cardName(baseDef?.id ?? "") || "base"} → ${cardName(evoCardId)}（追加マナ:${extra}）`);
    s.lastEvolve = { at: G.nowMs(), owner: G.seat, baseId: G.evoBaseId, to: evoCardId };

    // 復帰チェック（回復でパニック解除する仕様に合わせる）
    normalizePanicForAll(s.units, s.kills, s.log);

    // 勝利判定
    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      logPush(s, `🏁 勝者：${w}`);
    }

    tx.set(G.stateRef, s, { merge:true });
  });

  // UIリセット
  G.evoBaseId = null;
  G.evoCandidates = new Set();
  G.selectedHandIndex = null;
  render(G.currentState);
}

// ---- EX ----
async function execEx(){
  const st = G.currentState;
  if (!st || !canControl(st)) return;

  await G.runTransaction(G.db, async (tx)=>{
    const snap = await tx.get(G.stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.ex = s.ex || {A:null,B:null};
    s.exUsed = s.exUsed || {A:false,B:false};
    const exId = s?.ex?.[G.seat] ?? null;
    const used = !!s?.exUsed?.[G.seat];
    if (!exId || used) return;

    let ok = false;
    try{
      if (typeof G.applyExSupport === "function"){
        const n = G.applyExSupport.length;
        let ret;
        if (n >= 3) ret = G.applyExSupport(s, G.seat, exId);
        else if (n === 2) ret = G.applyExSupport(s, G.seat);
        else ret = G.applyExSupport(s);

        if (ret && typeof ret === "object" && ret.state){
          const ns = ret.state;
          for (const k of Object.keys(ns)) s[k] = ns[k];
        }
        ok = true;
      } else {
        // EXが無い場合でも落ちない
        ok = true;
        logPush(s, `[${G.seat}] EX：${cardName(exId)}（適用関数なし）`);
      }
    }catch{
      ok = false;
      logPush(s, `[${G.seat}] EX失敗：${cardName(exId)}`);
    }

    if (ok){
      s.exUsed[G.seat] = true;
      logPush(s, `[${G.seat}] EX使用：${cardName(exId)}`);
    }

    tx.set(G.stateRef, s, { merge:true });
  });
}

// =====================
// ターン終了
// =====================
async function endTurn(){
  const st = G.currentState;
  if (!st || !canControl(st)) return;

  await G.runTransaction(G.db, async (tx)=>{
    const snap = await tx.get(G.stateRef);
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
    try{ G.applySmellOnTurnEnd?.(s, who); }catch{}
    // 他にも必要ならここに吸収処理を追加可能

    // 勝利判定（終了時）
    const w0 = checkWinLocal(s);
    if (w0){
      s.winner = w0;
      logPush(s, `🏁 勝者：${w0}`);
      tx.set(G.stateRef, s, { merge:true });
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
      safeDrawCards(s, next, G.DRAW_PER_TURN);
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

    tx.set(G.stateRef, s, { merge:true });
  });
}

// =====================
// モード別：クリック時の追加処理（進化ベース選択など）
// =====================
function onUnitClickedForMode(u, st){
  if (!u || !st) return;

  // evolve: ベース選択
  if (G.mode === "evolve" && canControl(st) && u.owner === G.seat && !G.isPanic(u) && Number(u.hp) > 0){
    G.evoBaseId = u.id;
    G.evoCandidates = getEvoCandidates(st, u);
    // 手札選択はユーザーが行う
    render(st);
  }
}

// 既存 onCellClick 内の u クリック処理にフック（落とさず後付け
const _oldOnCellClick = G.onCellClick;
G.onCellClick = function(x,y){
  const st = G.currentState;
  if (!st) return;

  const u = unitAt(st, x, y);
  if (u){
    try{ onUnitClickedForMode(u, st); }catch{}
  }
  return _oldOnCellClick ? _oldOnCellClick(x,y) : undefined;
};

// =====================
// Log render
// =====================
function renderLog(st){
  if (!G.logEl) return;
  const lines = Array.isArray(st?.log) ? st.log : [];
  const tail = lines.slice(-30);

  const extra = [];
  if (G.nowMs() < G.rngMsgUntil) extra.push("🎲 乱数調整（見た目だけ）");

  G.logEl.textContent = (extra.concat(tail)).join("\n");
}

// =====================
// Main render
// =====================
function render(st){
  G.currentState = st;

  ensureRngButton();
  ensureSettingsButton();

  if (!st) return;

  // ターン変化UI
  const t = normSeat(st.turn);
  if (t && (t !== G.lastSeenTurn || st.turnSeq !== G.lastSeenTurnSeq)){
    // 自分のターンが来たときだけ目立たせる
    if (t === G.seat) flashTurnBanner();
    G.lastSeenTurn = t;
    G.lastSeenTurnSeq = st.turnSeq;

    // 相手ターンに入ったら操作系の選択を弱くリセット
    if (t !== G.seat){
      G.selectedTargetId = null;
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
  if (G.detailEl && !G.detailEl.innerHTML){
    G.detailEl.innerHTML = `<span class="small">ユニットや手札をクリックすると詳細が出るよ</span>`;
  }
}

// =====================
// Buttons bind
// =====================
G.btnDoEvolve && G.btnDoEvolve.addEventListener("click", ()=> execEvolve());
G.btnEnd && G.btnEnd.addEventListener("click", ()=> endTurn());
G.exBtnEl && G.exBtnEl.addEventListener("click", ()=> execEx());

// =====================
// Snapshot
// =====================
if (!G.stateRef) {
  console.error("[v2.3] stateRef missing. loader order or p1 export broken.");
} else {
  G.onSnapshot(G.stateRef, (snap)=>{
    if (!snap.exists()) return;
    const st = snap.data() || {};

    st.units = Array.isArray(st.units) ? st.units : [];
    st.hands = st.hands || {A:[],B:[]};
    st.decks = st.decks || {A:[],B:[]};
    st.kills = (st.kills && typeof st.kills === "object") ? st.kills : {A:0,B:0};
    ensureInfilObj(st);

    if (!st.ex) st.ex = {A:null, B:null};
    if (!st.exUsed) st.exUsed = {A:false, B:false};

    render(st);
  }, (err)=>{
    console.error("[G.onSnapshot] error", err);
    if (G.logEl) G.logEl.textContent = String(err?.message ?? err);
  });
}