// public/game.js
// v1.5.2 - ドロー復活(毎ターン) + 進化実装 + turn判定をnormSeatで統一（相手だけエンド不可対策）
// - ターンエンドで nextTurn のマナ更新 → nextTurn がドロー（DRAW_PER_TURN）
// - 進化：同属性かつコスト上昇、差額マナを支払い、手札カード消費、ユニットを差し替え（疲労付与）
// - clickCell/turnEnd の turn判定を全部 normSeat() で統一

function normSeat(t){
  const s = String(t ?? "").toUpperCase();
  return (s === "A" || s === "B") ? s : null;
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  nowMs,
  normalizeMana,
  startTurnMana,
  spendMana,
  getManaConsts
} from "./game_core.js?v=20260125b";

import {
  W, H,
  DRAW_PER_TURN,
  summonArea,
  computeInfil,
  checkWin,
  drawCards,
  goToDeck,
  uid,
  shuffle,
  isPanic,
  isAlive,
  // status helpers
  getStatus,
  clearStatuses,
  formatStatusList,
  applyStatusesOnHit,
  calcHitRateWithStatus,
  checkEvade,
  canCombo,
  hasFollowUp,
  isMoveBlockedByStatus,
  applyBleedOnMove,
  applySmellOnTurnEnd,
} from "./game_state.js?v=20260125b";

import { isInRange } from "./game_range.js?v=20260125b";

const CORE = getManaConsts();
const MAX_MANA_UI = CORE.MAX_MANA ?? 20;

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// DOM
// =====================
const boardEl = document.getElementById("board");
const youEl = document.getElementById("you");
const turnEl = document.getElementById("turn");
const manaEl = document.getElementById("mana");
const manaGaugeEl = document.getElementById("manaGauge");
const deckCountEl = document.getElementById("deckCount");
const handEl = document.getElementById("hand");
const actionPickerEl = document.getElementById("actionPicker");
const detailEl = document.getElementById("detail");
const diceEl = document.getElementById("dice");
const logEl = document.getElementById("log");
const killsEl = document.getElementById("kills");
const infilEl = document.getElementById("infil");
const modeHintEl = document.getElementById("modeHint");

const btnSummon = document.getElementById("modeSummon");
const btnMove = document.getElementById("modeMove");
const btnAttack = document.getElementById("modeAttack");
const btnEvolve = document.getElementById("modeEvolve");
const btnDoEvolve = document.getElementById("doEvolve");
const btnEnd = document.getElementById("endTurn");
const turnBanner = document.getElementById("turnBanner");

const quickActionsEl = document.getElementById("quickActions");
const btnQuickMove = document.getElementById("quickMove");
const btnQuickAttack = document.getElementById("quickAttack");
const quickMsgEl = document.getElementById("quickMsg");

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
const roomId = params.get("room");
const playerId = params.get("player");

if (!roomId || !playerId) {
  alert("URLに room / player がありません（battleから入ってね）");
  throw new Error("missing room/player");
}

const matchRef = doc(db, "rooms", roomId, "game", "match");
const stateRef = doc(db, "rooms", roomId, "game", "state");
const playerRef = (pid) => doc(db, "rooms", roomId, "players", pid);

// =====================
// Load card defs
// =====================
let cardDefs = {};
async function loadCards() {
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach(d => (m[d.id] = d.data()));
  cardDefs = m;
}
await loadCards();

function cardName(cardId){
  return cardDefs?.[cardId]?.name || cardId;
}

// =====================
// Seat
// =====================
let seat = null;
let opponentSeat = null;
let seatAPlayerId = null;
let seatBPlayerId = null;

async function resolveSeat() {
  const ms = await getDoc(matchRef);
  if (!ms.exists()) {
    alert("matchがありません（battleで両者準備OKになった？）");
    throw new Error("match missing");
  }
  const m = ms.data();
  seatAPlayerId = m.seatA;
  seatBPlayerId = m.seatB;

  if (playerId === seatAPlayerId) seat = "A";
  else if (playerId === seatBPlayerId) seat = "B";
  else {
    alert("あなたはこのマッチの参加者ではありません");
    throw new Error("not participant");
  }

  opponentSeat = (seat === "A") ? "B" : "A";
  youEl.textContent = seat;
}
await resolveSeat();

// =====================
// Init state once
// =====================
async function ensureStateInitialized() {
  await runTransaction(db, async (tx) => {
    const st = await tx.get(stateRef);
    if (st.exists()) {
      const s = st.data() || {};
      const mana = normalizeMana(s.mana);
      if (s.schema !== "mana_v3") tx.set(stateRef, { mana, schema:"mana_v3" }, { merge:true });
      return;
    }

    const pA = await tx.get(playerRef(seatAPlayerId));
    const pB = await tx.get(playerRef(seatBPlayerId));
    if (!pA.exists() || !pB.exists()) throw new Error("players missing");

    const deckA_simple = pA.data().deck || {};
    const deckB_simple = pB.data().deck || {};

    function buildDeck(simple) {
      const arr = [];
      for (const id of Object.keys(simple)) {
        const cnt = Number(simple[id] || 0);
        for (let i=0;i<cnt;i++) arr.push(id);
      }
      return shuffle(arr.concat(arr)); // 40
    }

    const deckA = buildDeck(deckA_simple);
    const deckB = buildDeck(deckB_simple);

    const hands = { A:[], B:[] };
    for (let i=0;i<5;i++){ if(deckA.length) hands.A.push(deckA.pop()); }
    for (let i=0;i<5;i++){ if(deckB.length) hands.B.push(deckB.pop()); }

    const mana = {
      A:{cur:CORE.START_CUR, max:CORE.START_MAX},
      B:{cur:CORE.START_CUR, max:CORE.START_MAX}
    };

    tx.set(stateRef, {
      turn: "A",
      mana,
      decks: { A:deckA, B:deckB },
      hands,
      units: [],
      kills: { A:0, B:0 },
      winner: null,
      log: ["--- Aターン ---"],
      lastRoll: null,
      lastHit: null,
      createdAt: serverTimestamp(),
      schema: "mana_v3"
    });
  });
}
await ensureStateInitialized();

// =====================
// Local selection
// =====================
let mode = null; // summon/move/attack/evolve/null
let selectedUnitId = null;
let selectedHandIndex = null;
let selectedActionIndex = 0;

let evoBaseId = null;
let evoCandidates = new Set();

function canControl(st){
  return st && normSeat(st.turn) === seat && !st.winner;
}

function getSelectedUnit(st){
  if (!st || !selectedUnitId) return null;
  return (st.units || []).find(u => u.id === selectedUnitId) || null;
}

// =====================
// UI helpers
// =====================
function showDiceRoll(lastRoll){
  if (!lastRoll) { diceEl.textContent = ""; return; }
  const age = nowMs() - (lastRoll.at || 0);
  if (age > 2600) { diceEl.textContent = ""; return; }
  diceEl.textContent = `🎲 ${lastRoll.r} / ${lastRoll.rate}%  ${lastRoll.hit ? "✅ 成功" : "❌ 失敗"}  (${lastRoll.actionName})`;
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

function setMode(m){
  mode = m;
  modeHintEl.textContent =
    m === "summon" ? "召喚：手札→フィールド（召喚エリアのみ）" :
    m === "move"   ? "移動：自軍を選択→移動先をクリック（マナ-1 / 疲労なし）" :
    m === "attack" ? "行動：自軍を選択→技を選択→敵をクリック（攻撃後は疲労）" :
    m === "evolve" ? "進化：進化元を選択→手札の候補が光る→手札選択→進化実行" :
    "ユニット選択→🏃移動 / ⚔️行動 を選択";
  render(currentState);
}

btnSummon.onclick = () => setMode("summon");
btnMove.onclick   = () => setMode("move");
btnAttack.onclick = () => setMode("attack");
btnEvolve.onclick = () => setMode("evolve");
btnQuickMove?.addEventListener("click", ()=> setMode("move"));
btnQuickAttack?.addEventListener("click", ()=> setMode("attack"));

// ===== 詳細（敵も見れる）=====
function showCardDetail(cardId){
  const d = cardDefs[cardId];
  if (!d) return;

  let html = `<b>${cardName(cardId)}</b> <span class="small">(${cardId})</span><br>`;
  html += `属性:${d.type} / コスト:${d.cost}<br>`;
  html += `HP:${d.hp} SP:${d.sp}<br><br>`;

  const acts = d.actions || [];
  if (!acts.length) html += "行動なし";
  else {
    acts.forEach((a)=>{
      const parts = [];
      if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
      if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
      if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
      const effect = parts.length ? parts.join(" / ") : "効果";

      const addS = a.addStatus ? ` / 付与:${a.addStatus}` : "";
      const tags = a.tags ? ` / tags:${a.tags}` : "";

      html += `【${a.cost}】${a.name}<br>`;
      html += `射程:${a.range} / 成功:${a.rate}%${addS}${tags}<br>`;
      html += `効果:${effect}<br><br>`;
    });
  }
  detailEl.innerHTML = html;
}

function showUnitDetail(u){
  const def = cardDefs[u.cardId] || {};
  let html = `<b>${cardName(u.cardId)}</b> <span class="small">(${u.cardId})</span><br>`;
  html += `属性:${def.type ?? "?"} / 所有:${u.owner}<br>`;
  html += `HP:${u.hp} SP:${u.sp}<br>`;
  html += `疲労:${u.fatigue ? "あり" : "なし"}<br>`;
  html += `状態:${isPanic(u) ? "パニック（死亡判定/行動不能）" : "通常"}<br>`;
  html += `状態異常:${formatStatusList(u)}<br><br>`;

  const acts = def.actions || [];
  if (!acts.length) {
    html += "行動なし";
  } else {
    html += `<b>行動</b><br>`;
    acts.forEach((a)=>{
      const parts = [];
      if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
      if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
      if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
      const effect = parts.length ? parts.join(" / ") : "効果";

      const addS = a.addStatus ? ` / 付与:${a.addStatus}` : "";

      html += `【${a.cost}】${a.name} (射程:${a.range} 成功:${a.rate}%)${addS}<br>`;
      html += `<span class="small">効果:${effect}</span><br>`;
    });
  }
  detailEl.innerHTML = html;
}

// 進化候補
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

// クイック
function updateQuickActions(st){
  if (!quickActionsEl) return;

  const myTurn = canControl(st);
  const su = getSelectedUnit(st);

  if (!myTurn || !su || su.owner !== seat) { quickActionsEl.style.display = "none"; return; }
  quickActionsEl.style.display = "block";

  const mana = normalizeMana(st.mana);
  const fatigued = !!su.fatigue;
  const def = cardDefs[su.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;

  if (btnQuickMove) btnQuickMove.disabled = isPanic(su) || isMoveBlockedByStatus(su);

  const canPay = act ? (mana[seat].cur >= Number(act.cost ?? 0)) : false;
  if (btnQuickAttack) btnQuickAttack.disabled = !act || fatigued || !canPay || isPanic(su);

  if (!quickMsgEl) return;
  if (isPanic(su)) quickMsgEl.textContent = "パニック中：行動不能（死亡判定）";
  else if (isMoveBlockedByStatus(su)) quickMsgEl.textContent = "骨折：移動不可";
  else if (!act) quickMsgEl.textContent = "行動がないカードです";
  else if (fatigued) quickMsgEl.textContent = "疲労中：行動できません（移動はOK）";
  else if (!canPay) quickMsgEl.textContent = "マナ不足：行動できません";
  else quickMsgEl.textContent = "";
}

// =====================
// Render
// =====================
let currentState = null;
let lastTurnSeen = null;
let finishedOnce = false;

function render(st){
  if (!st) return;

  const mana = normalizeMana(st.mana);
  const myTurn = canControl(st);

  btnSummon.disabled = !myTurn;
  btnMove.disabled   = !myTurn;
  btnAttack.disabled = !myTurn;
  btnEvolve.disabled = !myTurn;
  btnEnd.disabled    = !myTurn;
  document.body.classList.toggle("myTurnGlow", myTurn);

  if (lastTurnSeen !== st.turn) {
    if (normSeat(st.turn) === seat) flashTurnBanner();
    lastTurnSeen = st.turn;
  }

  turnEl.textContent = st.turn;
  manaEl.textContent = `A ${mana.A.cur}/${mana.A.max} | B ${mana.B.cur}/${mana.B.max} (MAX ${MAX_MANA_UI})`;
  renderManaGauge(st.mana);

  deckCountEl.textContent = `残り A:${(st.decks?.A||[]).length} / B:${(st.decks?.B||[]).length}`;
  killsEl.textContent = `${st.kills?.A ?? 0} / ${st.kills?.B ?? 0}`;

  const { infilA, infilB } = computeInfil(st);
  infilEl.textContent = `${infilA} / ${infilB}`;

  logEl.textContent = (st.log || []).slice(-70).join("\n");
  showDiceRoll(st.lastRoll);

  const canDoEvo =
    myTurn &&
    mode === "evolve" &&
    evoBaseId &&
    selectedHandIndex != null &&
    evoCandidates.has(selectedHandIndex);

  btnDoEvolve.style.display = (mode==="evolve") ? "inline-block" : "none";
  btnDoEvolve.disabled = !canDoEvo;

  // ===== 手札（指定フォーマット）=====
  handEl.innerHTML = "";
  const myHand = st.hands?.[seat] || [];
  myHand.forEach((cardId, idx) => {
    const def = cardDefs[cardId];
    const acts = def?.actions || [];
    const actLine = acts.length
      ? `行動: ${acts[0].name} / 射程:${acts[0].range} / ${acts[0].rate}%`
      : `行動: なし`;

    const d = document.createElement("div");
    d.className = "card";
    if (idx === selectedHandIndex) d.classList.add("selected");

    // 進化モードなら候補を光らせる（見た目崩さずclassだけ）
    if (mode === "evolve" && evoCandidates.has(idx)) d.classList.add("summon");

    d.innerHTML = `
      <div class="cardRow">
        <div>
          <b>【${def?.cost ?? "?"}】 ${cardName(cardId)} ${def?.type ?? "?"}</b>
        </div>
        <div><button data-detail="${cardId}">詳細</button></div>
      </div>
      <div class="small">HP:${def?.hp ?? "?"} / SP:${def?.sp ?? "?"}</div>
      <div class="small">${actLine}</div>
    `;

    d.onclick = (e) => {
      const btn = e.target?.closest?.("button");
      if (btn && btn.dataset.detail) return;
      selectedHandIndex = idx;
      showCardDetail(cardId);
      render(st);
    };
    d.querySelector("button[data-detail]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showCardDetail(cardId);
    });

    handEl.appendChild(d);
  });

  const su = getSelectedUnit(st);
  if (su) showUnitDetail(su);

  // 行動ピッカー（自軍のみ）
  actionPickerEl.innerHTML = "";
  if (su && su.owner === seat) {
    const def = cardDefs[su.cardId];
    const acts = def?.actions || [];
    if (!acts.length) actionPickerEl.textContent = "このカードは行動がありません";
    else {
      acts.forEach((a, idx) => {
        const b = document.createElement("button");
        b.textContent = `【${a.cost}】${a.name}`;
        if (idx === selectedActionIndex) b.style.outline = "2px solid yellow";
        b.onclick = () => { selectedActionIndex = idx; render(st); };
        actionPickerEl.appendChild(b);

        const s2 = document.createElement("div");
        s2.className = "small";
        const parts = [];
        if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
        if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
        if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
        const addS = a.addStatus ? ` / 付与:${a.addStatus}` : "";
        s2.textContent = `射程:${a.range} 成功:${a.rate}%${addS} 効果:${parts.length ? parts.join(" / ") : "効果"}`;
        actionPickerEl.appendChild(s2);
      });
    }
  } else {
    actionPickerEl.textContent = "自軍キャラを選ぶと行動が出ます";
  }

  // ===== 盤面 =====
  boardEl.innerHTML = "";

  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.onclick = () => clickCell(x,y);

      const u = (st.units || []).find(u => u.x===x && u.y===y && u.hp>0) || null;

      if (u) {
        cell.classList.add(u.owner==="A" ? "unitA" : "unitB");
        const def = cardDefs[u.cardId] || {};
        if (u.fatigue) cell.classList.add("fatigued");

        const stText = formatStatusList(u);
        const statusTag = (stText !== "なし") ? `<div class="fatigueTag" style="top:34px;">${stText}</div>` : "";

        cell.innerHTML = `
          ${u.fatigue ? `<div class="fatigueTag">疲労</div>` : ""}
          ${u.panic ? `<div class="fatigueTag" style="top:18px;">パニック</div>` : ""}
          ${statusTag}
          <div class="attr">${def.type ?? "?"}</div>
          <div class="unitName">${cardName(u.cardId)}</div>
          <div class="status">HP${u.hp} SP${u.sp}</div>
        `;
        if (u.id === selectedUnitId) cell.classList.add("selected");
      } else {
        const manaNow = normalizeMana(st.mana);
        if (!st.winner && myTurn && mode==="summon" && selectedHandIndex!=null) {
          const cid = (st.hands?.[seat] || [])[selectedHandIndex];
          const def = cardDefs[cid];
          if (def && summonArea(seat, y) && manaNow[seat].cur >= Number(def.cost ?? 0)) {
            cell.classList.add("summon");
          }
        }
      }

      boardEl.appendChild(cell);
    }
  }

  updateQuickActions(st);
}

// =====================
// Subscribe
// =====================
onSnapshot(stateRef, (snap) => {
  if (!snap.exists()) return;
  currentState = snap.data();
  render(currentState);

  if (currentState.winner && !finishedOnce) {
    finishedOnce = true;
    alert(`勝者：${currentState.winner}`);
    goToDeck(roomId, playerId);
  }
});

// =====================
// Click handler
// =====================
async function clickCell(x,y){
  const st = currentState;
  if (!st || st.winner) return;

  const uHereLocal = (st.units || []).find(u => u.x===x && u.y===y && u.hp>0) || null;
  const suLocal = getSelectedUnit(st);

  const willTryAttack =
    canControl(st) &&
    uHereLocal &&
    suLocal &&
    suLocal.owner === seat &&
    uHereLocal.owner !== seat &&
    (mode === "attack" || mode === null);

  if (uHereLocal && !willTryAttack) {
    selectedUnitId = uHereLocal.id;
    if (mode === "evolve" && uHereLocal.owner === seat) {
      evoBaseId = uHereLocal.id;
      evoCandidates = getEvoCandidates(st, uHereLocal);
    }
    showUnitDetail(uHereLocal);
    render(st);
    return;
  }

  if (!canControl(st)) return;

  await runTransaction(db, async (tx) => {
    const stSnap = await tx.get(stateRef);
    if (!stSnap.exists()) return;

    const s = stSnap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;

    let mana = normalizeMana(s.mana);
    const units = (Array.isArray(s.units) ? s.units : []).map(u => ({...u}));

    const hands = { ...(s.hands || {A:[],B:[]}) };
    hands.A = Array.isArray(hands.A) ? [...hands.A] : [];
    hands.B = Array.isArray(hands.B) ? [...hands.B] : [];

    const decks = { ...(s.decks || {A:[],B:[]}) };
    decks.A = Array.isArray(decks.A) ? [...decks.A] : [];
    decks.B = Array.isArray(decks.B) ? [...decks.B] : [];

    const logLines = [...(s.log || [])];

    const uHere = units.find(u => u.x===x && u.y===y && u.hp>0) || null;
    const su = selectedUnitId ? (units.find(u => u.id === selectedUnitId) || null) : null;

    // ===== 攻撃 =====
    if (uHere && su && su.owner === seat && uHere.owner !== seat && (mode === "attack" || mode === null)) {
      if (isPanic(su) || su.fatigue) return;
      if (isPanic(uHere)) return;

      const def = cardDefs[su.cardId];
      const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0];
      if (!act) return;

      const cost = Number(act.cost ?? 0);
      if (mana[seat].cur < cost) return;

      if (!isInRange(su, x, y, act.range)) return;

      const pay = spendMana(mana, seat, cost);
      if (!pay.ok) return;
      mana = pay.mana;

      const baseRate = Number(act.rate ?? 0);
      const rate1 = calcHitRateWithStatus(su, baseRate);

      const r1 = Math.floor(Math.random() * 100) + 1;
      let hit1 = (r1 <= rate1);

      if (hit1 && checkEvade(uHere, ()=>Math.random())) {
        hit1 = false;
        logLines.push(`[${seat}] 回避発動：${cardName(uHere.cardId)} が攻撃を回避`);
      }

      const lastRoll = { at: nowMs(), r: r1, rate: rate1, hit: hit1, actionName: act.name || "action", fromId: su.id, toId: uHere.id };

      if (!hit1) {
        su.fatigue = true;
        if (hasFollowUp(su)) su.fatigue = false;

        logLines.push(`[${seat}] 攻撃失敗：${act.name} (-${cost})`);
        const winner = checkWin({ ...s, units, kills: (s.kills || {A:0,B:0}) });
        tx.set(stateRef, { mana, units, winner: winner || null, log: logLines.slice(-200), lastRoll, lastHit:null }, { merge:true });
        return;
      }

      const applyDamageAndStatus = (target, actObj, labelSuffix="") => {
        const items = [];
        const hpD = Number(actObj.dmg ?? 0);
        const spD = Number(actObj.spDmg ?? 0);

        if (hpD > 0) { target.hp = Math.max(0, Number(target.hp) - hpD); items.push({kind:"HP", amount: hpD}); }
        if (spD > 0) { target.sp = Math.max(0, Number(target.sp) - spD); items.push({kind:"SP", amount: spD}); }

        const added = applyStatusesOnHit(target, actObj);
        if (added.length) {
          const sTxt = added.map(x=>{
            if (x.name === "evade") return `回避${Number(x.v)}%`;
            if (x.name === "bleed") return `出血(移動時HP-${Number(x.v)})`;
            if (x.name === "smell") return `匂い(終了時SP-${Number(x.v)})`;
            return x.name;
          }).join(",");
          logLines.push(`[${seat}] 状態付与${labelSuffix}：${cardName(target.cardId)} ← ${sTxt}`);
        }

        if (Number(target.sp) <= 0 && Number(target.hp) > 0) target.panic = true;

        return { items };
      };

      const hitItems1 = applyDamageAndStatus(uHere, act, "");
      const lastHit = { at: nowMs(), targetId: uHere.id, items: hitItems1.items };

      const kills = { ...(s.kills || {A:0,B:0}) };
      if (uHere.hp <= 0) kills[seat] = (kills[seat] ?? 0) + 1;

      su.fatigue = true;

      logLines.push(
        uHere.hp <= 0
          ? `[${seat}] 攻撃成功：${act.name} → ${cardName(uHere.cardId)} 撃破！ (-${cost})`
          : `[${seat}] 攻撃成功：${act.name} → ${cardName(uHere.cardId)} (-${cost})`
      );

      if (canCombo(su, act) && uHere.hp > 0 && !isPanic(uHere)) {
        const rate2 = Math.max(0, rate1 - 10);
        const r2 = Math.floor(Math.random() * 100) + 1;
        let hit2 = (r2 <= rate2);

        if (hit2 && checkEvade(uHere, ()=>Math.random())) {
          hit2 = false;
          logLines.push(`[${seat}] 回避発動：${cardName(uHere.cardId)} がコンボ追撃を回避`);
        }

        logLines.push(`[${seat}] コンボ判定：${r2}/${rate2}% → ${hit2 ? "成功" : "失敗"}`);

        if (hit2) {
          const hitItems2 = applyDamageAndStatus(uHere, act, "(コンボ)");
          lastHit.items = (lastHit.items || []).concat(hitItems2.items || []);

          if (uHere.hp <= 0) {
            kills[seat] = (kills[seat] ?? 0) + 1;
            logLines.push(`[${seat}] コンボ成功：追加撃破！`);
          }
        }
      }

      if (hasFollowUp(su)) {
        su.fatigue = false;
        logLines.push(`[${seat}] 追撃：疲労解除`);
      }

      const winner = checkWin({ ...s, units, kills });

      tx.set(stateRef, {
        mana, units, kills,
        winner: winner || null,
        log: logLines.slice(-200),
        lastRoll, lastHit
      }, { merge:true });
      return;
    }

    // ===== 召喚 =====
    if (mode === "summon" && selectedHandIndex != null && !uHere) {
      const hand = hands[seat] || [];
      const cid = hand[selectedHandIndex];
      const def = cardDefs[cid];
      if (!def) return;

      if (!summonArea(seat, y)) return;

      const cost = Number(def.cost ?? 0);
      const pay = spendMana(mana, seat, cost);
      if (!pay.ok) return;
      mana = pay.mana;

      hand.splice(selectedHandIndex, 1);
      selectedHandIndex = null;

      units.push({
        id: uid(),
        owner: seat,
        cardId: cid,
        x, y,
        hp: Number(def.hp ?? 0),
        sp: Number(def.sp ?? 0),
        fatigue: false,
        panic: false,
        status: {}
      });

      logLines.push(`[${seat}] 召喚：${cardName(cid)} (-${cost})`);
      const winner = checkWin({ ...s, units, kills:(s.kills||{A:0,B:0}) });

      tx.set(stateRef, { mana, hands, units, winner: winner || null, log: logLines.slice(-200) }, { merge:true });
      return;
    }

    // ===== 移動 =====
    if ((mode === "move" || mode === null) && selectedUnitId && !uHere) {
      const su2 = units.find(u => u.id === selectedUnitId);
      if (!su2) return;
      if (su2.owner !== seat) return;
      if (isPanic(su2)) return;
      if (isMoveBlockedByStatus(su2)) return;

      const dist = Math.abs(su2.x - x) + Math.abs(su2.y - y);
      if (dist !== 1) return;

      const pay = spendMana(mana, seat, 1);
      if (!pay.ok) return;
      mana = pay.mana;

      su2.x = x;
      su2.y = y;

      const bleedDmg = applyBleedOnMove(su2);
      if (bleedDmg > 0) {
        logLines.push(`[${seat}] 出血：${cardName(su2.cardId)} HP-${bleedDmg}`);
      }

      logLines.push(`[${seat}] 移動：${cardName(su2.cardId)} (-1)`);

      const winner = checkWin({ ...s, units, kills: (s.kills || { A:0, B:0 }) });

      tx.set(stateRef, {
        mana,
        units,
        winner: winner || null,
        log: logLines.slice(-200)
      }, { merge:true });
      return;
    }

    // 何もしない
  });
}

// =====================
// 進化（★新規実装）
// =====================
btnDoEvolve.onclick = async () => {
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;

  // UI側条件（候補以外は弾く）
  if (mode !== "evolve") return;
  if (!evoBaseId) return;
  if (selectedHandIndex == null) return;
  if (!evoCandidates.has(selectedHandIndex)) return;

  await runTransaction(db, async (tx) => {
    const stSnap = await tx.get(stateRef);
    if (!stSnap.exists()) return;

    const s = stSnap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;

    let mana = normalizeMana(s.mana);
    const units = (Array.isArray(s.units) ? s.units : []).map(u => ({...u}));

    const hands = { ...(s.hands || {A:[],B:[]}) };
    hands.A = Array.isArray(hands.A) ? [...hands.A] : [];
    hands.B = Array.isArray(hands.B) ? [...hands.B] : [];

    const decks = { ...(s.decks || {A:[],B:[]}) };
    decks.A = Array.isArray(decks.A) ? [...decks.A] : [];
    decks.B = Array.isArray(decks.B) ? [...decks.B] : [];

    const logLines = [...(s.log || [])];

    const base = units.find(u => u.id === evoBaseId) || null;
    if (!base) return;
    if (base.owner !== seat) return;
    if (isPanic(base)) return; // パニックは進化不可（仕様として）

    const baseDef = cardDefs[base.cardId];
    if (!baseDef) return;

    const hand = hands[seat] || [];
    const cid = hand[selectedHandIndex];
    const evoDef = cardDefs[cid];
    if (!cid || !evoDef) return;

    // 条件：同属性＆コスト上昇
    if (String(evoDef.type) !== String(baseDef.type)) return;
    if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

    const extra = Number(evoDef.cost) - Number(baseDef.cost);
    if (mana[seat].cur < extra) return;

    const pay = spendMana(mana, seat, extra);
    if (!pay.ok) return;
    mana = pay.mana;

    // 手札から消費
    hand.splice(selectedHandIndex, 1);

    // 進化：カード差し替え＋ステータス更新（扱い簡単に、進化先の素値に）
    base.cardId = cid;
    base.hp = Number(evoDef.hp ?? base.hp);
    base.sp = Number(evoDef.sp ?? base.sp);
    base.panic = false;
    clearStatuses(base);      // 進化で状態異常リセット（安定）
    base.fatigue = true;      // 進化＝疲労（あなたの設計に合わせる）

    logLines.push(`[${seat}] 進化：${cardName(baseDef?.id ?? "") || cardName(baseDef?.name ?? "") || cardName(base.cardId)} → ${cardName(cid)} (-${extra})`);

    const winner = checkWin({ ...s, units, kills:(s.kills||{A:0,B:0}) });

    tx.set(stateRef, {
      mana,
      units,
      hands,
      decks,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });
};

// =====================
// ターンエンド（★ドロー復活）
// =====================
btnEnd.onclick = async () => {
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;

  await runTransaction(db, async (tx) => {
    const stSnap = await tx.get(stateRef);
    if (!stSnap.exists()) return;

    const s = stSnap.data();
    if (s.winner) return;

    const curTurn = normSeat(s.turn);
    if (curTurn !== seat) return;

    const nextTurn = (curTurn === "A") ? "B" : "A";

    const logLines = [...(s.log || [])];

    const unitsSrc = Array.isArray(s.units) ? s.units : [];
    const handsSrcA = Array.isArray(s.hands?.A) ? s.hands.A : [];
    const handsSrcB = Array.isArray(s.hands?.B) ? s.hands.B : [];
    const decksSrcA = Array.isArray(s.decks?.A) ? s.decks.A : [];
    const decksSrcB = Array.isArray(s.decks?.B) ? s.decks.B : [];

    const hands = { A: [...handsSrcA], B: [...handsSrcB] };
    const decks = { A: [...decksSrcA], B: [...decksSrcB] };

    // ① 現手番の「ターン終了時」処理（匂い/状態解除）
    const units = unitsSrc.map(u => {
      const nu = { ...u };

      if (nu.owner === curTurn) {
        const smellDmg = applySmellOnTurnEnd(nu);
        if (smellDmg > 0) {
          logLines.push(`[${curTurn}] 匂い：${cardName(nu.cardId)} SP-${smellDmg}`);
        }
        clearStatuses(nu);
      }

      // ② 次手番のターン開始準備：疲労解除
      if (nu.owner === nextTurn) {
        nu.fatigue = false;
      }

      return nu;
    });

    // ③ 次手番のマナ更新（回復＆成長）
    let mana = normalizeMana(s.mana);
    mana = startTurnMana(mana, nextTurn);

    // ④ ★次手番のドロー（復活）
    const before = (decks[nextTurn] || []).length;
    drawCards(decks, hands, nextTurn, DRAW_PER_TURN);
    const after = (decks[nextTurn] || []).length;

    if (before !== after) {
      const drew = hands[nextTurn][hands[nextTurn].length - 1];
      logLines.push(`[${nextTurn}] ドロー：${cardName(drew)}`);
    } else {
      logLines.push(`[${nextTurn}] ドロー：山札なし`);
    }

    // ログ区切りは最後に
        // ログ区切りは最後に
    logLines.push(`--- ${nextTurn}ターン ---`);

    // 勝利判定（ターン移行後でもOKだが、基本は変化ないのでここで）
    const winner = checkWin({ ...s, units, kills: (s.kills || {A:0,B:0}) });

    tx.set(stateRef, {
      turn: nextTurn,
      mana,
      units,
      hands,
      decks,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });

  // UI側の進化選択をクリア（事故防止）
  evoBaseId = null;
  evoCandidates = new Set();
  selectedHandIndex = null;
  // modeは維持でもいいけど、誤操作減らすならnullへ
  // mode = null;
};

// =====================
// 初期の「先行ドロー差」(必要なら)
// =====================
// もし「先行はドローしない」ルールなら、上のターンエンド側ドローで必ず
// “次の手番が1枚引く”ため、先行Aの最初のターン開始時にはドローが発生しません。
// 逆に「先行も引く」なら、初期化時にAへ1枚引く必要がある。
// 今回は要望が「両者ドローできてない」なので、
// ルールは「各自のターン開始で1ドロー」＝ turnEndで nextTurnにドロー で統一。
// なので ensureStateInitialized の初手配り(5枚)はそのままでOKです。

// =====================
// 進化モード時：盤面クリックで候補更新
// =====================
// （既に clickCell のローカル選択で更新してるので追加不要だが、
//   モード切り替え時に候補が古いままになるのを防ぐ）
btnEvolve.onclick = () => {
  setMode("evolve");
  const st = currentState;
  if (!st) return;
  const su = getSelectedUnit(st);
  if (su && su.owner === seat) {
    evoBaseId = su.id;
    evoCandidates = getEvoCandidates(st, su);
  } else {
    evoBaseId = null;
    evoCandidates = new Set();
  }
  render(st);
};

// 召喚/移動/攻撃に切り替えたら進化選択はリセット（誤爆防止）
function clearEvoUI(){
  evoBaseId = null;
  evoCandidates = new Set();
  // selectedHandIndex は残してもいいが、進化実行ボタンの誤爆防止で消すのが安全
  // selectedHandIndex = null;
}
btnSummon.onclick = () => { clearEvoUI(); setMode("summon"); };
btnMove.onclick   = () => { clearEvoUI(); setMode("move"); };
btnAttack.onclick = () => { clearEvoUI(); setMode("attack"); };

// =====================
// クリック以外の安全策：ターンが変わったらローカル選択を軽く整理
// =====================
onSnapshot(stateRef, (snap) => {
  if (!snap.exists()) return;
  const next = snap.data();
  currentState = next;

  // ターンが変わったら手札選択は残してもいいけど、事故が多いので解除
  if (lastTurnSeen != null && normSeat(lastTurnSeen) !== normSeat(next.turn)) {
    selectedHandIndex = null;
    selectedActionIndex = 0;
    // 進化UIも解除
    evoBaseId = null;
    evoCandidates = new Set();
  }

  render(currentState);

  if (currentState.winner && !finishedOnce) {
    finishedOnce = true;
    alert(`勝者：${currentState.winner}`);
    goToDeck(roomId, playerId);
  }
});

// =====================
// （任意）デバッグ：手番ボタンが押せない時に原因が分かるログ
// =====================
window.__dbg = {
  normSeat,
  get seat(){ return seat; },
  get state(){ return currentState; },
  canControl: () => canControl(currentState),
};