// public/game.js
// v20260131_v2.1.1_full_fix_powerup_refresh
// v20260131_v2.1.2_patch
// v20260201_fix
// v20260201_hand_ui_simple
// v20260201_summon_fix
//
// v20260201_board_ui_and_summon_strict
// - 召喚エリアを厳密固定（A=手前2列 / B=奥側2列）
// - 召喚可能セルの緑枠表示（summonOk）を維持
// - 場ユニット見た目を 4行レイアウトへ（左上=コスト / 右上=属性 / 名前 / HP-SP / 状態アイコン）
//
// ※ 既存機能は削らない（UI/EX/Support/FX/Range 等は維持）

function normSeat(t){
  const s = String(t ?? "").toUpperCase();
  return (s === "A" || s === "B") ? s : null;
}

// ===== Support core (Support + EX) =====
// ※ 既存 support_core があるなら優先して使う（互換のため import は維持）
import { applySupport, isSupportCard, resolveSupportEffect, applyExSupport } from "./support_core.js?v=20260129a";

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
  spendMana,
  getManaConsts
} from "./game_core.js?v=20260126g";

import {
  W, H,
  DRAW_PER_TURN,
  summonArea,        // ※importは維持（互換のため）。ただし本ファイルでは“厳密固定”を優先
  computeInfil,
  checkWin,
  drawCards,
  uid,
  shuffle,
  isPanic,
  getStatus,
  formatStatusList,
  applyStatusesOnHit,
  calcHitRateWithStatus,
  checkEvade,
  isMoveBlockedByStatus,
  applyBleedOnMove,
  applySmellOnTurnEnd,

  // parse helpers (v1.7.x)
  parseAddStatus,
  parseTags,
} from "./game_state.js?v=20260131_v1_7_2";

import { supportEffectTextJa } from "./support_text.js?v=20260129b";

// settings (optional)
let initSettings = null;
try{
  const mod = await import("./settings.js?v=20260130_v2");
  initSettings = mod?.initSettings || null;
}catch{}

const CORE = getManaConsts();
const MAX_MANA_UI = CORE.MAX_MANA ?? 20;

// ★追加：場の上限
const MAX_UNITS_PER_PLAYER = 5;

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com")
    ? "tcg-0bato"
    : "tcg-0bato"
};
console.log("[firebaseConfig]", firebaseConfig);
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
const btnSupport = document.getElementById("modeSupport");
const btnDoEvolve = document.getElementById("doEvolve");
const btnEnd = document.getElementById("endTurn");
const turnBanner = document.getElementById("turnBanner");

const quickActionsEl = document.getElementById("quickActions");
const btnQuickMove = document.getElementById("quickMove");
const btnQuickAttack = document.getElementById("quickAttack");
const quickMsgEl = document.getElementById("quickMsg");

// Pinch + EX UI
const pinchFxEl = document.getElementById("pinchFx");
const exWrapEl = document.getElementById("exWrap");
const exBtnEl  = document.getElementById("exBtn");
const exInfoEl = document.getElementById("exInfo");

// FX
const fxFlashEl = document.getElementById("fxFlash");

// =====================
// Hand UI: inject CSS (game.html いじらなくても見た目改善)
// =====================
function ensureHandCss(){
  if (document.getElementById("handCss_v20260201_simple")) return;

  const css = document.createElement("style");
  css.id = "handCss_v20260201_simple";
  css.textContent = `
    #hand{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      align-items:stretch;
      justify-content:flex-start;
      padding:8px 6px;
    }

    .handCard{
      width: 250px;
      min-height: 88px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 14px;
      background: rgba(255,255,255,.05);
      position: relative;
      overflow:hidden;
      cursor:pointer;
      user-select:none;
      padding: 10px 10px 8px;
      box-shadow: 0 6px 16px rgba(0,0,0,.25);
      transition: transform .06s ease, border-color .06s ease, background .06s ease;
    }
    .handCard:hover{
      transform: translateY(-1px);
      border-color: rgba(255,255,255,.26);
      background: rgba(255,255,255,.06);
    }
    .handCard.selected{
      border-color: rgba(255,255,255,.65);
      box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 10px 20px rgba(0,0,0,.35);
    }
    .handCard.evoCandidate{
      outline: 2px solid rgba(120, 255, 170, .45);
      outline-offset: 0px;
    }

    .hcBar{
      position:absolute;
      left:0; top:0; bottom:0;
      width:8px;
      opacity:.55;
    }

    .hcRow1{
      display:flex;
      gap:10px;
      align-items:center;
    }

    .hcDiamond{
      width:28px;
      height:28px;
      transform: rotate(45deg);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.22);
      background: rgba(0,0,0,.18);
      display:flex;
      align-items:center;
      justify-content:center;
      flex: 0 0 auto;
    }
    .hcDiamond span{
      transform: rotate(-45deg);
      font-weight: 800;
      font-size: 13px;
      line-height: 1;
    }

    .hcMain{
      flex: 1 1 auto;
      min-width: 0;
      display:flex;
      flex-direction:column;
      gap:2px;
    }
    .hcName{
      font-weight: 800;
      font-size: 14px;
      line-height: 1.15;
      word-break: break-word;
    }
    .hcType{
      font-size: 12px;
      opacity: .85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hcRow2{
      margin-top: 8px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    }
    .hcStats{
      font-size:12px;
      opacity:.92;
      display:flex;
      gap:10px;
      align-items:center;
      flex-wrap:wrap;
    }

    .hcDetailBtn{
      font-size:12px;
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.20);
      background: rgba(0,0,0,.18);
      color:#fff;
      cursor:pointer;
      flex: 0 0 auto;
    }
    .hcDetailBtn:hover{
      background: rgba(255,255,255,.08);
    }

    .hcSupport{
      font-size:12px;
      opacity:.92;
    }
  `;
  document.head.appendChild(css);
}

// =====================
// Board Unit UI: inject CSS（場のカード見た目）
// =====================
function ensureBoardUnitCss(){
  if (document.getElementById("boardUnitCss_v20260201")) return;
  const css = document.createElement("style");
  css.id = "boardUnitCss_v20260201";
  css.textContent = `
    .unitBox{
      display:flex;
      flex-direction:column;
      gap:4px;
      padding:8px 8px 7px;
      border-radius:14px;
      background: rgba(0,0,0,.14);
    }
    .uTop{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      font-size:12px;
      opacity:.95;
      line-height:1;
    }
    .uCost{
      font-weight:900;
      padding:2px 6px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.18);
      display:inline-flex;
      align-items:center;
      gap:4px;
      min-width: 18px;
      justify-content:center;
    }
    .uType{
      padding:2px 6px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.10);
      opacity:.95;
      white-space:nowrap;
    }
    .uName{
      font-weight:900;
      font-size:13px;
      line-height:1.05;
      word-break:break-word;
    }
    .uHP{
      font-size:12px;
      opacity:.95;
      line-height:1.05;
      white-space:nowrap;
    }
    .uIcons{
      font-size:12px;
      opacity:.98;
      line-height:1.05;
      min-height: 14px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
  `;
  document.head.appendChild(css);
}

// =====================
// v2.0.9: 乱数調整ボタン（見た目だけ）
// =====================
let rngMsgUntil = 0;
function ensureRngButton(){
  if (!logEl) return null;
  let btn = document.getElementById("btnRngReset");
  if (btn) return btn;

  btn = document.createElement("button");
  btn.id = "btnRngReset";
  btn.type = "button";
  btn.textContent = "🎲 乱数調整";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.title = "見た目だけ（乱数は実際には変わりません）";

  const parent = logEl.parentNode;
  if (parent) parent.insertBefore(btn, logEl);

  btn.addEventListener("click", ()=>{
    rngMsgUntil = nowMs() + 2200;
    render(currentState);
  });

  return btn;
}

// Optional Settings button auto-mount (if settings.js exists)
function ensureSettingsButton(){
  if (!initSettings) return null;
  let btn = document.getElementById("btnSettings");
  if (btn) return btn;

  const left = document.getElementById("leftPane");
  if (!left) return null;

  btn = document.createElement("button");
  btn.id = "btnSettings";
  btn.type = "button";
  btn.textContent = "⚙️ 設定";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";

  const controls = left.querySelector(".controls");
  if (controls && controls.parentNode) controls.parentNode.insertBefore(btn, controls);
  else left.appendChild(btn);

  btn.addEventListener("click", ()=>{
    try{ initSettings?.({ db, roomId, playerId }); }catch{}
  });

  return btn;
}

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

/* =====================
   表示用ヘルパー
===================== */
function safeStatusText(u){
  const t = formatStatusList(u);
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.join(",");
  if (t && typeof t === "object") {
    const keys = Object.keys(t);
    return keys.length ? keys.join(",") : "なし";
  }
  return "なし";
}

// =====================
// ★追加：Firestore(map)/配列/文字列でも壊れない addStatus & tags 吸収層
// =====================
function addStatusListFromAny(addStatus){
  if (!addStatus) return [];
  if (Array.isArray(addStatus)) {
    return addStatus.map(x=>String(x||"").trim()).filter(Boolean);
  }
  if (typeof addStatus === "string") {
    return parseAddStatus(addStatus) || [];
  }
  if (typeof addStatus === "object") {
    const out = [];
    const t = addStatus.target && typeof addStatus.target === "object" ? addStatus.target : null;
    if (t) out.push(...Object.keys(t));
    return out.map(x=>String(x||"").trim()).filter(Boolean);
  }
  return [];
}

function tagMapFromAny(tags){
  if (!tags) return {};
  if (typeof tags === "string") return parseTags(tags) || {};
  if (Array.isArray(tags)) return parseTags(tags.join(",")) || {};
  if (typeof tags === "object") return tags;
  return {};
}

function describeSpecialEffects(act){
  const list = addStatusListFromAny(act?.addStatus).map(s=>String(s||"").trim());
  if (!list.length) return [];

  const tags = tagMapFromAny(act?.tags);

  const out = [];
  const has = (...names)=> names.some(n=>list.includes(n));

  const getVal = (name, defVal)=>{
    let v = Number(
      tags[name] ??
      tags[`${name}Up`] ??
      tags[`${name}_up`] ??
      tags[`${name}Plus`] ??
      tags[`${name}_plus`]
    );
    if (!Number.isFinite(v)) v = defVal;
    return Math.trunc(v);
  };

  if (has("aim","命中")) out.push(`命中+${getVal("aim",10)}%`);
  if (has("jinx","不運","命中低下")) out.push(`命中-${getVal("jinx",10)}%`);

  if (has("powerUp")) out.push(`威力+${getVal("powerUp",10)}`);
  if (has("power") && !has("powerUp")) out.push(`威力+${getVal("power",10)}`);

  if (has("armor","装甲")) out.push(`装甲+${getVal("armor",10)}`);

  if (has("bleed","出血")) out.push(`出血付与(${getVal("bleed",10)})`);
  if (has("fracture","骨折")) out.push(`骨折（移動不可）`);
  if (has("smell","におい")) out.push(`におい付与(${getVal("smell",10)})`);
  if (has("lostSoul","ロストソウル")) out.push(`ロストソウル`);
  if (has("blind","盲目")) out.push(`盲目`);
  if (has("evade","回避")) out.push(`回避+${getVal("evade",10)}`);
  if (has("combo","コンボ")) out.push(`コンボ`);
  if (has("followUp","追撃")) out.push(`追撃`);

  if (has("recoverFatigue","疲労回復","fatigueHeal","fatigueClear")) out.push(`疲労回復`);
  if (has("recoverMove","moveReset","refreshMove","移動回復","移動制限回復","移動回数回復")) out.push(`移動回復（2マス）`);

  return out;
}

function displayAddStatus(act){
  const list = addStatusListFromAny(act?.addStatus);
  const hidden = new Set([
    "pierce","aoe","all","knockback",
    "貫通","全体","ノックバック"
  ]);
  const shown = list
    .map(s => String(s || "").trim())
    .filter(s => s && !hidden.has(s));
  return shown.length ? ` / add:${shown.join(",")}` : "";
}

// =====================
// ★射程表記（矢印）：陣営の前方向に合わせて出す
// =====================
function forwardDy(owner){
  return owner === "A" ? -1 : 1;
}
function arrowByForward(owner){
  return (forwardDy(owner) === -1) ? "↑" : "↓";
}
function arrowByBack(owner){
  return (forwardDy(owner) === -1) ? "↓" : "↑";
}

function rangeTokenToArrow(tok, owner){
  const t = String(tok||"").trim();
  if (!t) return "";
  if (t.toLowerCase() === "adj4") return "＋1";

  const m = t.match(/^(front|back|side|rf|lf|f)(\d+)$/i);
  if (!m) return t;

  const kind = m[1].toLowerCase();
  const n = Math.max(1, Math.trunc(Number(m[2] || 1)));

  const f = arrowByForward(owner);
  const b = arrowByBack(owner);

  const rf = (forwardDy(owner) === -1) ? "↗" : "↘";
  const lf = (forwardDy(owner) === -1) ? "↖" : "↙";

  if (kind === "front" || kind === "f") return `${f}${n}`;
  if (kind === "back")  return `${b}${n}`;
  if (kind === "side")  return `←${n}→${n}`;
  if (kind === "rf")    return `${rf}${n}`;
  if (kind === "lf")    return `${lf}${n}`;
  return t;
}

function rangeSpecToArrow(rangeSpec, owner){
  const n = Number(rangeSpec);
  if (Number.isFinite(n)) return `距離${Math.max(0, Math.trunc(n))}`;

  const s = String(rangeSpec ?? "").replaceAll('"','').trim();
  if (!s) return "";

  return s
    .split("+")
    .map(x=>rangeTokenToArrow(x.trim(), owner))
    .filter(Boolean)
    .join("+");
}

function actFlags(act){
  const add = addStatusListFromAny(act?.addStatus);
  const tags = tagMapFromAny(act?.tags);

  const has = (x)=> add.includes(x);
  const tagTrue = (k)=> tags?.[k] === true || tags?.[k] === "true" || tags?.[k] === 1 || tags?.[k] === "1";

  return {
    pierce: has("pierce") || has("貫通") || tagTrue("pierce"),
    aoe: has("aoe") || has("all") || has("全体") || tagTrue("aoe") || tagTrue("all"),
    knockback: has("knockback") || has("ノックバック") || tagTrue("knockback"),
  };
}

function actRangeLabel(act, owner){
  const base = rangeSpecToArrow(act?.range, owner) || String(act?.range ?? "?");
  const flags = actFlags(act);
  const suffix = `${flags.aoe ? "全" : ""}${flags.pierce ? "貫" : ""}`;
  return `${base}${suffix}`;
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
  if (youEl) youEl.textContent = seat;
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
      if (typeof s.turnSeq !== "number") tx.set(stateRef, { turnSeq: 1 }, { merge:true });
      if (s.lastSupportRoll === undefined) tx.set(stateRef, { lastSupportRoll: null }, { merge:true });

      if (!s.ex) tx.set(stateRef, { ex: {A:null, B:null} }, { merge:true });
      if (!s.exUsed) tx.set(stateRef, { exUsed: {A:false, B:false} }, { merge:true });

      if (s.lastSummon === undefined) tx.set(stateRef, { lastSummon: null }, { merge:true });
      if (s.lastEvolve === undefined) tx.set(stateRef, { lastEvolve: null }, { merge:true });

      return;
    }

    const pA = await tx.get(playerRef(seatAPlayerId));
    const pB = await tx.get(playerRef(seatBPlayerId));
    if (!pA.exists() || !pB.exists()) throw new Error("players missing");

    const deckA_simple = pA.data().deck || {};
    const deckB_simple = pB.data().deck || {};

    const exA = pA.data().exCardId || null;
    const exB = pB.data().exCardId || null;

    function buildDeck(simple) {
      const arr = [];
      for (const id of Object.keys(simple)) {
        const cntRaw = Number(simple[id] || 0);
        const cnt = Math.max(0, Math.min(4, Math.trunc(cntRaw)));
        for (let i=0;i<cnt;i++) arr.push(id);
      }
      return shuffle(arr);
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
      turnSeq: 1,
      mana,
      decks: { A:deckA, B:deckB },
      hands,
      units: [],
      kills: { A:0, B:0 },
      winner: null,
      log: ["--- Aターン ---"],
      lastRoll: null,
      lastHit: null,
      lastSupportRoll: null,
      lastSummon: null,
      lastEvolve: null,
      ex: { A: exA, B: exB },
      exUsed: { A:false, B:false },
      createdAt: serverTimestamp(),
      schema: "mana_v3"
    });
  });
}
await ensureStateInitialized();

// =====================
// Local selection
// =====================
let lastSelectedUnitId = null;

function onSelectMyUnit(newUnitId, st){
  if (!newUnitId) return;
  const changed = (lastSelectedUnitId && lastSelectedUnitId !== newUnitId);
  lastSelectedUnitId = newUnitId;

  selectedUnitId = newUnitId;
  selectedTargetId = null;

  if (changed) selectedActionIndex = 0;

  // 「別コマンド挟まないと動けない」対策：ユニット切替時に index を正規化＆ターゲット解除
  ensureSelectedActionIndex(st);

  render(st);
}

let mode = null; // summon/move/attack/evolve/support/null
let selectedUnitId = null;
let selectedTargetId = null;
let selectedHandIndex = null;
let selectedActionIndex = 0;

let supportTarget1Id = null;
let supportTarget2Id = null;
let supportTargetCell = null;

let evoBaseId = null;
let evoCandidates = new Set();

function canControl(st){
  return st && normSeat(st.turn) === seat && !st.winner;
}

function getSelectedUnit(st){
  if (!st || !selectedUnitId) return null;
  return (st.units || []).find(u => u.id === selectedUnitId) || null;
}
function getSelectedTarget(st){
  if (!st || !selectedTargetId) return null;
  return (st.units || []).find(u => u.id === selectedTargetId) || null;
}

function ensureSelectedActionIndex(st){
  const su = getSelectedUnit(st);
  if (!su) { selectedActionIndex = 0; return; }
  const acts = cardDefs?.[su.cardId]?.actions || [];
  if (!Array.isArray(acts) || acts.length <= 0) { selectedActionIndex = 0; return; }
  if (selectedActionIndex < 0 || selectedActionIndex >= acts.length) selectedActionIndex = 0;
}

function selectedHandCardId(st){
  const hand = st?.hands?.[seat] || [];
  if (selectedHandIndex == null) return null;
  return hand[selectedHandIndex] || null;
}
function selectedHandDef(st){
  const cid = selectedHandCardId(st);
  if (!cid) return null;
  return cardDefs?.[cid] || null;
}
function selectedIsSupport(st){
  const def = selectedHandDef(st);
  return !!def && isSupportCard(def);
}
function resetSupportPicks(){
  supportTarget1Id = null;
  supportTarget2Id = null;
  supportTargetCell = null;
}

function supportEffectSummary(def){
  if (!def?.effect) return "効果なし";
  return supportEffectTextJa(def.effect);
}

function supportPlan(def){
  const eff = def?.effect;
  const types = [];
  if (eff?.type) types.push(String(eff.type));
  if (Array.isArray(eff?.table)){
    for (const r of eff.table){
      if (r?.effect?.type) types.push(String(r.effect.type));
    }
  }
  const has = (t)=> types.includes(t);

  if (has("swapPos")) return { need:"unit2" };
  if (has("moveTo")) return { need:"unitCell" };

  if (types.some(t => [
    "dmg","heal","modRate","bounce",
    "powerUp","cleanse",
    "recoverFatigue","recoverMove","refreshMove"
  ].includes(t))) return { need:"unit" };

  return { need:"none" };
}

function countMyAliveUnits(units, owner){
  const arr = Array.isArray(units) ? units : [];
  return arr.filter(u => u && u.hp > 0 && u.owner === owner).length;
}

function moveUsedThisTurn(u, st){
  const curSeq = Number(st?.turnSeq ?? 1);
  if (!u) return 0;
  return (Number(u.moveTurnSeq ?? 0) === curSeq) ? Number(u.moveUsed ?? 0) : 0;
}

// =====================
// Range helpers（戦闘判定用）
// =====================
function expandTokenToOffsets(token, owner){
  const t = String(token || "").trim();
  const dyF = forwardDy(owner);

  const m = t.match(/^(front|back|side|rf|lf|f)(\d+)$/i);
  if (m){
    const kind = m[1].toLowerCase();
    const n = Math.max(1, Math.trunc(Number(m[2])));
    const res = [];
    for (let k = 1; k <= n; k++){
      if (kind === "front" || kind === "f") res.push({dx:0, dy:dyF*k});
      else if (kind === "back") res.push({dx:0, dy:-dyF*k});
      else if (kind === "side") { res.push({dx:k, dy:0}); res.push({dx:-k, dy:0}); }
      else if (kind === "rf") res.push({dx:k, dy:dyF*k});
      else if (kind === "lf") res.push({dx:-k, dy:dyF*k});
    }
    return res;
  }

  if (t.toLowerCase() === "adj4") {
    return [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
  }
  return [];
}

function parseRangeSpecToOffsets(rangeSpec, owner){
  const n = Number(rangeSpec);
  if (Number.isFinite(n)){
    const r = Math.max(0, Math.trunc(n));
    const res = [];
    for (let dx = -r; dx <= r; dx++){
      for (let dy = -r; dy <= r; dy++){
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx)+Math.abs(dy) <= r) res.push({dx,dy});
      }
    }
    return res;
  }

  const s = String(rangeSpec || "").replaceAll('"','').trim();
  if (!s) return [];

  const parts = s.split("+").map(x=>x.trim()).filter(Boolean);
  let res = [];
  for (const p of parts){
    res = res.concat(expandTokenToOffsets(p, owner));
  }
  const uniq = new Map();
  for (const o of res) uniq.set(`${o.dx},${o.dy}`, o);
  return [...uniq.values()];
}

function inActionRange(attacker, targetX, targetY, rangeSpec){
  if (!attacker) return false;
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  if (!offs.length) return false;
  const dx = targetX - attacker.x;
  const dy = targetY - attacker.y;
  return offs.some(o => o.dx === dx && o.dy === dy);
}

function rangeSpecMaxDist(attacker, rangeSpec){
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  let mx = 0;
  for (const o of offs){
    mx = Math.max(mx, Math.abs(o.dx) + Math.abs(o.dy));
  }
  return mx;
}

// =====================
// UI helpers
// =====================
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

function statusIconsText(unit){
  const st = getStatus(unit);
  const keys = Object.keys(st || {});
  if (!keys.length) return "";

  const order = ["armor","bleed","fracture","smell","lostSoul","blind","evade","combo","followUp","aim","jinx","powerUp","power"];
  keys.sort((a,b)=> (order.indexOf(a)===-1?999:order.indexOf(a)) - (order.indexOf(b)===-1?999:order.indexOf(b)));

  return keys.map(k=>{
    const icon = STATUS_ICON[k] || "❔";
    const v = st[k]?.v;

    if (k === "armor") return `${icon}${Number(v ?? 0)}`;
    if (k === "evade") return `${icon}${Number(v ?? 0)}`;
    if (k === "bleed") return `${icon}${Number(v ?? 10)}`;
    if (k === "smell") return `${icon}${Number(v ?? 10)}`;
    if (k === "aim") return `${icon}+${Number(v ?? 0)}`;
    if (k === "jinx") return `${icon}-${Number(v ?? 0)}`;
    if (k === "powerUp") return `${icon}+${Number(v ?? 0)}`;
    if (k === "power") return `${icon}+${Number(v ?? 0)}`;

    return (v != null && v !== true) ? `${icon}${v}` : `${icon}`;
  }).join(" ");
}

function setMode(m){
  mode = m;

  if (m !== "support") resetSupportPicks();

  if (modeHintEl) {
    modeHintEl.textContent =
      m === "summon" ? "召喚：手札→フィールド（自陣2列のみ）" :
      m === "move"   ? "移動：自軍を選択→移動先をクリック（マナ-1 / ターン中2マスまで）" :
      m === "attack" ? "行動：自軍を選択→緑枠の敵/味方をクリックで実行（攻撃後は疲労）" :
      m === "evolve" ? "進化：進化元を選択→手札候補が光る→手札選択→進化実行（疲労でも可）" :
      m === "support"? "サポート：手札のサポカを選択→指示に従って対象をクリック（失敗でも消費）" :
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
  setMode("attack");
  await tryExecuteAttack();
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
    const warn = (a.range === "?" || a.range === "" || a.range == null)
      ? `<span style="color:#ff6;"> ※range未設定</span>`
      : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${a.rate ?? "?"}%)${addS}${warn}<br>`;
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
    const warn = (a.range === "?" || a.range === "" || a.range == null)
      ? `<span style="color:#ff6;"> ※range未設定</span>`
      : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${a.rate ?? "?"}%)${addS}${warn}<br>`;
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
    btnQuickAttack.disabled = !act || fatigued || !canPay || isPanic(su);
  }

  if (!quickMsgEl) return;

  if (isPanic(su)) quickMsgEl.textContent = "パニック中：死亡扱い＆行動不能（回復で復帰）";
  else if (isMoveBlockedByStatus(su)) quickMsgEl.textContent = "骨折：移動不可";
  else if (used >= 2) quickMsgEl.textContent = "移動上限：このターンはもう動けません";
  else if (!act) quickMsgEl.textContent = "行動がないカードです";
  else if (fatigued) quickMsgEl.textContent = "疲労中：行動できません（移動はOK）";
  else if (!canPay) quickMsgEl.textContent = "マナ不足：行動できません";
  else if (mode === "attack" && !selectedTargetId && !isSelfRange(act.range)) quickMsgEl.textContent = "緑枠の敵/味方をクリックで実行！";
  else if (mode === "attack" && isSelfRange(act.range)) quickMsgEl.textContent = "self：自分に即実行できます";
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

function calcHitRateAdapter(attacker, target, act, st){
  try{
    if (typeof calcHitRateWithStatus !== "function") return Math.trunc(Number(act?.rate ?? 0));
    const n = calcHitRateWithStatus.length;
    if (n >= 4) return calcHitRateWithStatus(attacker, target, act, st);
    if (n === 3) return calcHitRateWithStatus(attacker, target, act);
    if (n === 2) return calcHitRateWithStatus(attacker, target);
    return calcHitRateWithStatus(attacker);
  }catch{
    return Math.trunc(Number(act?.rate ?? 0));
  }
}

function checkEvadeAdapter(attacker, target, act, st){
  try{
    if (typeof checkEvade !== "function") return false;
    const n = checkEvade.length;
    if (n >= 4) return checkEvade(attacker, target, act, st);
    if (n === 3) return checkEvade(attacker, target, act);
    if (n === 2) return checkEvade(attacker, target);
    return checkEvade(target);
  }catch{
    return false;
  }
}

function applyStatusesOnHitAdapter(attacker, target, act, st, logLines){
  try{
    if (typeof applyStatusesOnHit !== "function") return;
    const n = applyStatusesOnHit.length;
    if (n >= 5) return applyStatusesOnHit(attacker, target, act, st, logLines);
    if (n === 4) return applyStatusesOnHit(attacker, target, act, st);
    if (n === 3) return applyStatusesOnHit(attacker, target, act);
    if (n === 2) return applyStatusesOnHit(attacker, target);
    return applyStatusesOnHit(target);
  }catch{}
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

function spendManaMut(manaObj, who, cost){
  const m = normalizeMana(manaObj);
  const c = Math.max(0, Math.trunc(Number(cost ?? 0)));
  if (!c) return m;

  try{
    const res = spendMana(m, who, c);
    return normalizeMana(res ?? m);
  }catch{
    m[who].cur = Math.max(0, Math.trunc(Number(m[who].cur ?? 0)) - c);
    return m;
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

  try{
    const infilRaw = computeInfil(st);
    if (infilEl) infilEl.textContent = safeInfilText(infilRaw);
  }catch{
    if (infilEl) infilEl.textContent = "A:0 / B:0";
  }

  showDiceRoll(st.lastRoll, st.lastSupportRoll);
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

// =====================
// Hand UI helpers (属性の薄色)
// =====================
function typeColor(type){
  const t = String(type ?? "").trim();
  const m = {
    "火":"rgba(255, 90, 90, .22)",
    "水":"rgba(90, 170, 255, .22)",
    "雷":"rgba(255, 220, 90, .22)",
    "光":"rgba(255, 255, 255, .18)",
    "闇":"rgba(170, 120, 255, .20)",
    "風":"rgba(120, 255, 170, .18)",
    "土":"rgba(210, 170, 110, .20)",
    "support":"rgba(210, 210, 210, .18)",
    "Support":"rgba(210, 210, 210, .18)",
  };
  return m[t] ?? "rgba(255,255,255,.12)";
}

/**
 * 召喚エリア内の「おすすめ空きマス」を選ぶ
 * - A: 下から上へ（H-1→0）
 * - B: 上から下へ（0→H-1）
 * - x は中央寄り優先
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
    .cell{
      position:relative;
      box-sizing:border-box;
    }
    .cell.summonOk{
      outline: 3px solid rgba(120,255,170,.55);
      outline-offset: -3px;
    }
    .cell.moveOk{
      outline: 3px solid rgba(120,255,170,.45);
      outline-offset: -3px;
    }
    .cell.rangeOk{
      outline: 3px solid rgba(120,255,170,.42);
      outline-offset: -3px;
    }
    .cell.rangeBad{
      outline: 3px solid rgba(255,120,120,.35);
      outline-offset: -3px;
    }
    .cell.sel{
      box-shadow: 0 0 0 3px rgba(255,255,255,.25) inset;
    }
    .cell.myUnit{
      box-shadow: 0 0 0 2px rgba(120,255,170,.18) inset;
    }
    .cell.enemyUnit{
      box-shadow: 0 0 0 2px rgba(255,120,120,.16) inset;
    }
    .cell.panic{
      filter: grayscale(0.35);
      opacity: .85;
    }
  `;
  document.head.appendChild(css);
}

// =====================
// Hand render
// =====================
function renderHand(st){
  ensureHandCss();

  if (!handEl) return;
  handEl.innerHTML = "";

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  const myTurn = canControl(st);

  // evolve candidate set
  const evoCand = (mode === "evolve" && evoCandidates && evoCandidates.size) ? evoCandidates : new Set();

  for (let i=0;i<hand.length;i++){
    const cid = hand[i];
    const def = cardDefs?.[cid];

    const wrap = document.createElement("div");
    wrap.className = "handCard";
    wrap.dataset.idx = String(i);

    const selected = (selectedHandIndex === i);
    if (selected) wrap.classList.add("selected");
    if (evoCand.has(i)) wrap.classList.add("evoCandidate");

    const cost = Math.trunc(Number(def?.cost ?? 0));
    const type = String(def?.type ?? "");
    const isSup = !!def && isSupportCard(def);

    const bar = document.createElement("div");
    bar.className = "hcBar";
    bar.style.background = typeColor(isSup ? "support" : type);
    wrap.appendChild(bar);

    const row1 = document.createElement("div");
    row1.className = "hcRow1";

    const dia = document.createElement("div");
    dia.className = "hcDiamond";
    const diaText = document.createElement("span");
    diaText.textContent = String(cost);
    dia.appendChild(diaText);

    const main = document.createElement("div");
    main.className = "hcMain";

    const name = document.createElement("div");
    name.className = "hcName";
    name.textContent = cardName(cid);

    const typeEl = document.createElement("div");
    typeEl.className = "hcType";
    typeEl.textContent = `属性:${type || "?"}`;

    main.appendChild(name);
    main.appendChild(typeEl);

    row1.appendChild(dia);
    row1.appendChild(main);

    wrap.appendChild(row1);

    const row2 = document.createElement("div");
    row2.className = "hcRow2";

    if (!isSup){
      const hp = Math.trunc(Number(def?.hp ?? 0));
      const sp = Math.trunc(Number(def?.sp ?? 0));

      const stats = document.createElement("div");
      stats.className = "hcStats";
      stats.textContent = `HP:${hp}  SP:${sp}`;
      row2.appendChild(stats);
    }else{
      const sup = document.createElement("div");
      sup.className = "hcSupport";
      sup.textContent = "Support";
      row2.appendChild(sup);
    }

    const btn = document.createElement("button");
    btn.className = "hcDetailBtn";
    btn.type = "button";
    btn.textContent = "詳細";
    btn.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      showCardDetail(cid);
    });

    row2.appendChild(btn);
    wrap.appendChild(row2);

    wrap.addEventListener("click", ()=>{
      // 選択
      selectedHandIndex = (selectedHandIndex === i) ? null : i;

      // 進化モード：候補をクリックしたら即進化（base選択済みのとき）
      if (mode === "evolve" && evoBaseId && evoCandidates.has(i)){
        tryExecuteEvolve(i);
        return;
      }

      // サポート：サポカ選択でモード維持
      render(st);
    });

    // ターン外は薄くする（クリックはできるが実行は不可）
    if (!myTurn) wrap.style.opacity = "0.85";

    handEl.appendChild(wrap);
  }
}

// =====================
// Action picker
// =====================
function renderActionPicker(st){
  if (!actionPickerEl) return;
  actionPickerEl.innerHTML = "";

  const su = getSelectedUnit(st);
  if (!su) return;

  const def = cardDefs?.[su.cardId];
  const acts = Array.isArray(def?.actions) ? def.actions : [];
  if (!acts.length) return;

  ensureSelectedActionIndex(st);

  const title = document.createElement("div");
  title.innerHTML = `<b>${cardName(su.cardId)}</b> <span class="small">行動</span>`;
  actionPickerEl.appendChild(title);

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "6px";
  wrap.style.marginTop = "6px";

  for (let i=0;i<acts.length;i++){
    const a = acts[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btnSmall";
    const cost = Math.trunc(Number(a?.cost ?? 0));
    const rangeLbl = actRangeLabel(a, su.owner);
    btn.textContent = `${i===selectedActionIndex?"▶ ":""}${a?.name ?? "?"} [${cost}] ${rangeLbl}`;

    btn.addEventListener("click", ()=>{
      selectedActionIndex = i;
      render(st);
    });
    wrap.appendChild(btn);
  }

  actionPickerEl.appendChild(wrap);

  const detailBtn = document.createElement("button");
  detailBtn.type = "button";
  detailBtn.className = "btnSmall";
  detailBtn.style.marginTop = "8px";
  detailBtn.textContent = "ユニット詳細";
  detailBtn.addEventListener("click", ()=> showUnitDetail(su, st));
  actionPickerEl.appendChild(detailBtn);
}

// =====================
// Summon highlight map
// =====================
function buildSummonMap(st){
  const map = new Map();
  if (!st) return map;
  if (mode !== "summon") return map;

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (selectedHandIndex == null) return map;

  const cid = hand[selectedHandIndex];
  const def = cardDefs?.[cid];
  if (!def) return map;

  // サポートは召喚しない
  if (isSupportCard(def)) return map;

  // 自ターンのみ
  if (!canControl(st)) return map;

  // 場上限
  const myAlive = countMyAliveUnits(st.units, seat);
  if (myAlive >= MAX_UNITS_PER_PLAYER) return map;

  // マナ
  const mana = normalizeMana(st.mana);
  const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
  if (mana[seat].cur < cost) return map;

  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      if (!inSummonAreaForSeat(x,y,seat)) continue;
      if (!isEmptyCell(st,x,y)) continue;
      map.set(`${x},${y}`, { ok:true });
    }
  }

  return map;
}

// =====================
// Move highlight (隣接のみ / 2回まで)
// =====================
function buildMoveMap(st){
  const map = new Map();
  if (!st) return map;
  if (mode !== "move") return map;

  if (!canControl(st)) return map;
  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return map;
  if (isPanic(su)) return map;
  if (isMoveBlockedByStatus(su)) return map;

  const used = moveUsedThisTurn(su, st);
  if (used >= 2) return map;

  const cand = [
    {x:su.x+1,y:su.y},{x:su.x-1,y:su.y},{x:su.x,y:su.y+1},{x:su.x,y:su.y-1}
  ];
  for (const p of cand){
    if (p.x<0||p.x>=W||p.y<0||p.y>=H) continue;
    if (!isEmptyCell(st,p.x,p.y)) continue;
    map.set(`${p.x},${p.y}`, { ok:true });
  }
  return map;
}

// =====================
// Board render（ユニット4行UI + ハイライト）
// =====================
function renderBoard(st){
  ensureBoardGrid();
  ensureBoardUnitCss();
  ensureBoardAssistCss();

  if (!boardEl) return;

  const units = Array.isArray(st?.units) ? st.units : [];

  const summonMap = buildSummonMap(st);
  const moveMap = buildMoveMap(st);
  const rangeMap = buildRangeMap(st);

  const su = getSelectedUnit(st);

  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const idx = cellIndex(x,y);
      const cell = boardEl.children[idx];
      if (!cell) continue;

      cell.classList.remove(
        "summonOk","moveOk","rangeOk","rangeBad","sel","myUnit","enemyUnit","panic"
      );

      // ハイライト
      if (summonMap.has(`${x},${y}`)) cell.classList.add("summonOk");
      if (moveMap.has(`${x},${y}`)) cell.classList.add("moveOk");
      if (rangeMap.has(`${x},${y}`)){
        const it = rangeMap.get(`${x},${y}`);
        if (it?.ok) cell.classList.add("rangeOk");
        else cell.classList.add("rangeBad");
      }

      // 中身
      cell.innerHTML = "";

      const u = unitAt(st,x,y);
      if (!u) continue;

      if (u.owner === seat) cell.classList.add("myUnit");
      else cell.classList.add("enemyUnit");

      if (isPanic(u)) cell.classList.add("panic");
      if (su && su.id === u.id) cell.classList.add("sel");

      const def = cardDefs?.[u.cardId] || {};
      const type = String(def.type ?? "?");
      const cost = Math.trunc(Number(def.cost ?? 0));

      const box = document.createElement("div");
      box.className = "unitBox";

      // 1行目：左上マナ / 右上属性
      const top = document.createElement("div");
      top.className = "uTop";

      const costEl = document.createElement("div");
      costEl.className = "uCost";
      costEl.textContent = String(cost);

      const typeEl = document.createElement("div");
      typeEl.className = "uType";
      typeEl.textContent = type;

      top.appendChild(costEl);
      top.appendChild(typeEl);

      // 2行目：名前
      const name = document.createElement("div");
      name.className = "uName";
      name.textContent = cardName(u.cardId);

      // 3行目：HP SP
      const hp = document.createElement("div");
      hp.className = "uHP";
      hp.textContent = `HP:${Math.trunc(Number(u.hp ?? 0))}  SP:${Math.trunc(Number(u.sp ?? 0))}`;

      // 4行目：状態アイコン
      const icons = document.createElement("div");
      icons.className = "uIcons";
      const iconText = statusIconsText(u);
      icons.textContent = iconText || "";

      box.appendChild(top);
      box.appendChild(name);
      box.appendChild(hp);
      box.appendChild(icons);

      // クリック（ユニット選択/詳細）
      box.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        if (u.owner === seat) {
          onSelectMyUnit(u.id, st);
        } else {
          // 敵クリックで詳細（要求仕様：敵も詳細見れる）
          showUnitDetail(u, st);
          selectedTargetId = u.id;
          render(st);
        }
      });

      cell.appendChild(box);
    }
  }
}

// =====================
// Summon / Move / Attack / Support / Evolve 実行
// =====================
function canSummonNow(st, handIdx){
  if (!st) return { ok:false, reason:"no state" };
  if (!canControl(st)) return { ok:false, reason:"not your turn" };

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (handIdx == null || handIdx < 0 || handIdx >= hand.length) return { ok:false, reason:"no hand" };

  const cid = hand[handIdx];
  const def = cardDefs?.[cid];
  if (!def) return { ok:false, reason:"no def" };
  if (isSupportCard(def)) return { ok:false, reason:"support" };

  const myAlive = countMyAliveUnits(st.units, seat);
  if (myAlive >= MAX_UNITS_PER_PLAYER) return { ok:false, reason:"unit cap" };

  const mana = normalizeMana(st.mana);
  const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
  if (mana[seat].cur < cost) return { ok:false, reason:"mana" };

  return { ok:true, cid, def, cost };
}

async function trySummonAt(x,y){
  const st = currentState;
  if (!st) return;

  const chk = canSummonNow(st, selectedHandIndex);
  if (!chk.ok) return;

  // 厳密：自陣2列のみ
  if (!inSummonAreaForSeat(x,y,seat)) return;
  if (!isEmptyCell(st,x,y)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const hand = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    if (selectedHandIndex == null || selectedHandIndex < 0 || selectedHandIndex >= hand.length) return;

    const cid = hand[selectedHandIndex];
    const def = cardDefs?.[cid];
    if (!def || isSupportCard(def)) return;

    // 再チェック
    if (!inSummonAreaForSeat(x,y,seat)) return;
    const occupied = (Array.isArray(s.units)?s.units:[]).find(u=>Number(u.hp)>0 && u.x===x && u.y===y);
    if (occupied) return;

    const myAlive = countMyAliveUnits(s.units, seat);
    if (myAlive >= MAX_UNITS_PER_PLAYER) return;

    const mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    if (mana[seat].cur < cost) return;

    // マナ消費
    s.mana = spendManaMut(mana, seat, cost);

    // 召喚
    const nu = {
      id: uid(),
      owner: seat,
      cardId: cid,
      x, y,
      hp: Math.trunc(Number(def.hp ?? 0)),
      sp: Math.trunc(Number(def.sp ?? 0)),
      fatigue: false,
      moveUsed: 0,
      moveTurnSeq: Number(s.turnSeq ?? 1),
      countedAsKill: false,
      panic: false,
      panicKillSeat: null
    };

    if (!Array.isArray(s.units)) s.units = [];
    s.units.push(nu);

    // 手札から削除
    hand.splice(selectedHandIndex, 1);
    s.hands = s.hands || {A:[],B:[]};
    s.hands[seat] = hand;

    s.lastSummon = { at: nowMs(), who: seat, cardId: cid, x, y };

    logPush(s, `[${seat}] 召喚：${cardName(cid)} @(${x},${y})`);

    // 勝利判定
    try{
      const w = checkWin(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  // 選択維持：同じスロットのズレが出るので解除
  selectedHandIndex = null;
  render(currentState);
}

async function tryMoveTo(x,y){
  const st = currentState;
  if (!st) return;

  if (!canControl(st)) return;
  if (mode !== "move") return;

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return;
  if (isPanic(su)) return;
  if (isMoveBlockedByStatus(su)) return;

  // 隣接のみ
  const dist = Math.abs(su.x - x) + Math.abs(su.y - y);
  if (dist !== 1) return;
  if (!isEmptyCell(st,x,y)) return;

  const used = moveUsedThisTurn(su, st);
  if (used >= 2) return;

  const mana = normalizeMana(st.mana);
  if (mana[seat].cur < 1) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const units = Array.isArray(s.units) ? s.units : [];
    const u = units.find(uu=>uu.id===su.id) || null;
    if (!u || u.owner !== seat) return;

    if (isPanic(u)) return;
    if (isMoveBlockedByStatus(u)) return;

    const dist2 = Math.abs(u.x - x) + Math.abs(u.y - y);
    if (dist2 !== 1) return;
    const occ = units.find(uu=>Number(uu.hp)>0 && uu.x===x && uu.y===y);
    if (occ) return;

    // 2回/ターン
    const curSeq = Number(s.turnSeq ?? 1);
    const uUsed = (Number(u.moveTurnSeq ?? 0) === curSeq) ? Number(u.moveUsed ?? 0) : 0;
    if (uUsed >= 2) return;

    const mana2 = normalizeMana(s.mana);
    if (mana2[seat].cur < 1) return;

    // マナ-1
    s.mana = spendManaMut(mana2, seat, 1);

    // 状態異常：移動時出血など
    try{ applyBleedOnMove?.(u, s, (s.log||[])); }catch{}

    u.x = x;
    u.y = y;
    u.moveTurnSeq = curSeq;
    u.moveUsed = uUsed + 1;

    logPush(s, `[${seat}] 移動：${cardName(u.cardId)} → (${x},${y})`);

    // 勝利判定
    try{
      const w = checkWin(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  render(currentState);
}

function getSelectedAction(st){
  const su = getSelectedUnit(st);
  if (!su) return null;
  const def = cardDefs?.[su.cardId];
  const acts = Array.isArray(def?.actions) ? def.actions : [];
  if (!acts.length) return null;

  ensureSelectedActionIndex(st);
  return acts[selectedActionIndex] || acts[0] || null;
}

async function tryExecuteAttack(targetIdOverride=null){
  const st = currentState;
  if (!st) return;

  if (!canControl(st)) return;
  if (mode !== "attack") return;

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return;
  if (isPanic(su)) return;
  if (su.fatigue) return;

  const act = getSelectedAction(st);
  if (!act) return;

  const mana = normalizeMana(st.mana);
  const cost = Math.max(0, Math.trunc(Number(act.cost ?? 0)));
  if (mana[seat].cur < cost) return;

  const tid = targetIdOverride || selectedTargetId;
  let target = tid ? (st.units||[]).find(u=>u.id===tid) : null;

  // self
  const self = isSelfRange(act.range);
  if (self) target = su;
  if (!target) return;

  // 射程
  if (!self){
    if (!inActionRange(su, target.x, target.y, act.range)) return;

    // ブロック（非貫通）
    const flags = actFlags(act);
    if (!flags.pierce && isLineBlocked(st.units, su, target)) return;
  }

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const units = Array.isArray(s.units) ? s.units : [];
    const attacker = units.find(u=>u.id===su.id) || null;
    if (!attacker || attacker.owner !== seat) return;
    if (isPanic(attacker)) return;
    if (attacker.fatigue) return;

    const def = cardDefs?.[attacker.cardId];
    const acts = Array.isArray(def?.actions) ? def.actions : [];
    if (!acts.length) return;

    const aIdx = Math.max(0, Math.min(acts.length-1, Math.trunc(Number(selectedActionIndex ?? 0))));
    const a = acts[aIdx] || acts[0];
    const mana2 = normalizeMana(s.mana);
    const cost2 = Math.max(0, Math.trunc(Number(a.cost ?? 0)));
    if (mana2[seat].cur < cost2) return;

    let target2 = null;
    if (isSelfRange(a.range)) {
      target2 = attacker;
    } else {
      const tid2 = targetIdOverride || selectedTargetId;
      target2 = tid2 ? units.find(u=>u.id===tid2) : null;
      if (!target2) return;

      if (!inActionRange(attacker, target2.x, target2.y, a.range)) return;

      const flags = actFlags(a);
      if (!flags.pierce && isLineBlocked(units, attacker, target2)) return;
    }

    // マナ消費
    s.mana = spendManaMut(mana2, seat, cost2);

    // 命中判定（状態補正含む）
    const baseRate = Math.trunc(Number(a.rate ?? 0));
    let rate = baseRate;
    try{ rate = Math.trunc(Number(calcHitRateAdapter(attacker, target2, a, s) ?? baseRate)); }catch{}
    rate = Math.max(0, Math.min(100, rate));

    const r = Math.floor(Math.random()*100) + 1;
    const hit = (r <= rate);

    s.lastRoll = { at: nowMs(), r, rate, hit, actionName: a.name ?? "?" };

    const logLines = Array.isArray(s.log) ? s.log : (s.log = []);
    const items = [];

    if (!hit){
      logLines.push(`[${seat}] 失敗：${a.name ?? "?"} → ${cardName(target2.cardId)}（${r}/${rate}%）`);
      // 疲労は「行動したら」付与（成功/失敗どっちでも）
      attacker.fatigue = true;
      s.lastHit = { at: nowMs(), attackerId: attacker.id, targetId: target2.id, items: [] };
      tx.set(stateRef, s);
      return;
    }

    // 回避判定
    try{
      const evaded = !!checkEvadeAdapter(attacker, target2, a, s);
      if (evaded){
        logLines.push(`[${seat}] 回避：${a.name ?? "?"} → ${cardName(target2.cardId)}`);
        attacker.fatigue = true;
        s.lastHit = { at: nowMs(), attackerId: attacker.id, targetId: target2.id, items: [] };
        tx.set(stateRef, s);
        return;
      }
    }catch{}

    // 効果適用（hpDelta/spDelta or dmg/heal）
    const { hpDelta, spDelta } = getActDeltas(a);

    const beforeHp = Math.trunc(Number(target2.hp ?? 0));
    const beforeSp = Math.trunc(Number(target2.sp ?? 0));

    target2.hp = Math.trunc(Number(target2.hp ?? 0) + hpDelta);
    target2.sp = Math.trunc(Number(target2.sp ?? 0) + spDelta);

    // 0未満補正
    target2.hp = Math.trunc(target2.hp);
    target2.sp = Math.trunc(target2.sp);

    items.push({ kind:"HP", delta: Math.trunc(Number(target2.hp ?? 0) - beforeHp) });
    items.push({ kind:"SP", delta: Math.trunc(Number(target2.sp ?? 0) - beforeSp) });

    // 状態付与
    applyStatusesOnHitAdapter(attacker, target2, a, s, logLines);

    // 疲労
    attacker.fatigue = true;

    // 撃破/パニック（SP<=0 でパニック）
    const kills = s.kills || (s.kills = {A:0,B:0});

    if (Number(target2.hp) <= 0){
      // 本死亡
      logLines.push(`[${seat}] 命中：${a.name ?? "?"} → ${cardName(target2.cardId)}（撃破）`);
      countKillIfNeeded(target2, seat, kills, logLines, "撃破");
    } else {
      // SP<=0 でパニック撃破扱い
      setPanicAndCountIfNeeded(target2, seat, kills, logLines, "パニック撃破");
      logLines.push(`[${seat}] 命中：${a.name ?? "?"} → ${cardName(target2.cardId)}（${r}/${rate}%）`);
    }

    // パニック解除チェック（回復で戻る）
    normalizePanicForAll(units, kills, logLines);

    s.lastHit = { at: nowMs(), attackerId: attacker.id, targetId: target2.id, items };

    // 勝利判定
    try{
      const w = checkWin(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  render(currentState);
}

function planSupportTargets(def){
  const p = supportPlan(def);
  return p?.need || "none";
}

function tryCallSupportEngine(def, ctx){
  // ctx: { st, who, cardId, handIndex, target1, target2, cell }
  // 既存関数の署名が揺れてても壊れにくいように全部 try
  try{
    if (typeof applySupport === "function"){
      const n = applySupport.length;
      if (n >= 3) return applySupport(ctx.st, ctx.who, ctx);
      if (n === 2) return applySupport(ctx.st, ctx);
      if (n === 1) return applySupport(ctx.st);
      return applySupport();
    }
  }catch{}
  try{
    if (typeof resolveSupportEffect === "function"){
      const n = resolveSupportEffect.length;
      if (n >= 2) return resolveSupportEffect(def.effect, ctx);
      if (n === 1) return resolveSupportEffect(def.effect);
      return resolveSupportEffect();
    }
  }catch{}
  return null;
}

async function tryExecuteSupport(){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;
  if (mode !== "support") return;

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (selectedHandIndex == null) return;

  const cid = hand[selectedHandIndex];
  const def = cardDefs?.[cid];
  if (!def || !isSupportCard(def)) return;

  const need = planSupportTargets(def);

  // 必要な対象が揃っているか
  if (need === "unit" && !supportTarget1Id) return;
  if (need === "unit2" && (!supportTarget1Id || !supportTarget2Id)) return;
  if (need === "unitCell" && (!supportTarget1Id || !supportTargetCell)) return;

  const mana = normalizeMana(st.mana);
  const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
  if (mana[seat].cur < cost) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const hand2 = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    if (selectedHandIndex == null || selectedHandIndex < 0 || selectedHandIndex >= hand2.length) return;

    const cid2 = hand2[selectedHandIndex];
    const def2 = cardDefs?.[cid2];
    if (!def2 || !isSupportCard(def2)) return;

    const mana2 = normalizeMana(s.mana);
    const cost2 = Math.max(0, Math.trunc(Number(def2.cost ?? 0)));
    if (mana2[seat].cur < cost2) return;

    // マナ消費（成功/失敗問わず消費）
    s.mana = spendManaMut(mana2, seat, cost2);

    const units = Array.isArray(s.units) ? s.units : [];
    const t1 = supportTarget1Id ? units.find(u=>u.id===supportTarget1Id) : null;
    const t2 = supportTarget2Id ? units.find(u=>u.id===supportTarget2Id) : null;

    // サポート判定（成功率は support_core 側 or effect.rate を参照）
    let ok = true;
    let label = "";
    try{
      const eff = def2.effect || {};
      const rate = Math.trunc(Number(eff.rate ?? eff.successRate ?? 100));
      const r = Math.floor(Math.random()*100) + 1;
      ok = (r <= Math.max(0, Math.min(100, rate)));
      label = `${r} / ${rate}%`;
      s.lastSupportRoll = { at: nowMs(), r, ok, label, cardName: cardName(cid2) };
    }catch{
      s.lastSupportRoll = { at: nowMs(), r: 0, ok:true, label:"-", cardName: cardName(cid2) };
    }

    const logLines = Array.isArray(s.log) ? s.log : (s.log = []);

    if (!ok){
      logLines.push(`[${seat}] Support失敗：${cardName(cid2)}`);
      // 手札消費
      hand2.splice(selectedHandIndex, 1);
      s.hands[seat] = hand2;
      tx.set(stateRef, s);
      return;
    }

    // 効果適用（互換レイヤ）
    try{
      const ctx = {
        st: s,
        who: seat,
        cardId: cid2,
        handIndex: selectedHandIndex,
        target1: t1,
        target2: t2,
        cell: supportTargetCell
      };
      const res = tryCallSupportEngine(def2, ctx);

      // res が state を返すタイプもあるので吸収
      if (res && typeof res === "object"){
        // 直接 mutate の可能性もあるので両対応
        // res.units / res.mana などがあれば上書き
        if (res.units) s.units = res.units;
        if (res.mana) s.mana = res.mana;
        if (res.hands) s.hands = res.hands;
        if (res.decks) s.decks = res.decks;
        if (res.log) s.log = res.log;
      }
    }catch{}

    logLines.push(`[${seat}] Support成功：${cardName(cid2)}`);

    // 手札消費
    hand2.splice(selectedHandIndex, 1);
    s.hands[seat] = hand2;

    // パニック解除チェック（回復系で戻る）
    normalizePanicForAll(s.units, s.kills, logLines);

    // 勝利判定
    try{
      const w = checkWin(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  // 後片付け
  selectedHandIndex = null;
  resetSupportPicks();
  render(currentState);
}

async function tryExecuteEvolve(handIdx){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;
  if (mode !== "evolve") return;

  const base = evoBaseId ? (st.units||[]).find(u=>u.id===evoBaseId) : null;
  if (!base || base.owner !== seat) return;

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (handIdx == null || handIdx < 0 || handIdx >= hand.length) return;

  const cid = hand[handIdx];
  const toDef = cardDefs?.[cid];
  const fromDef = cardDefs?.[base.cardId];
  if (!toDef || !fromDef) return;

  if (toDef.type !== fromDef.type) return;
  if (!(Number(toDef.cost) > Number(fromDef.cost))) return;

  const extra = Math.max(0, Math.trunc(Number(toDef.cost) - Number(fromDef.cost)));
  const mana = normalizeMana(st.mana);
  if (mana[seat].cur < extra) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const units = Array.isArray(s.units) ? s.units : [];
    const b = units.find(u=>u.id===evoBaseId) || null;
    if (!b || b.owner !== seat) return;

    const hand2 = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    if (handIdx < 0 || handIdx >= hand2.length) return;

    const cid2 = hand2[handIdx];
    const toDef2 = cardDefs?.[cid2];
    const fromDef2 = cardDefs?.[b.cardId];
    if (!toDef2 || !fromDef2) return;

    if (toDef2.type !== fromDef2.type) return;
    if (!(Number(toDef2.cost) > Number(fromDef2.cost))) return;

    const extra2 = Math.max(0, Math.trunc(Number(toDef2.cost) - Number(fromDef2.cost)));
    const mana2 = normalizeMana(s.mana);
    if (mana2[seat].cur < extra2) return;

    // マナ差分消費
    s.mana = spendManaMut(mana2, seat, extra2);

    // 進化：座標/状態は引き継ぎ、HP/SPは新カード基準に置換（ここは仕様に合わせてOK）
    b.cardId = cid2;
    b.hp = Math.trunc(Number(toDef2.hp ?? b.hp ?? 0));
    b.sp = Math.trunc(Number(toDef2.sp ?? b.sp ?? 0));
    // 疲労は維持（仕様通り：疲労でも進化は可）
    // b.fatigue はそのまま

    s.lastEvolve = { at: nowMs(), who: seat, from: fromDef2?.name ?? b.cardId, to: toDef2?.name ?? cid2 };
    logPush(s, `[${seat}] 進化：${cardName(fromDef2?.id ?? "") || cardName(fromDef2?.cardId ?? b.cardId)} → ${cardName(cid2)}`);

    // 手札消費
    hand2.splice(handIdx, 1);
    s.hands[seat] = hand2;

    // 勝利判定
    try{
      const w = checkWin(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  // 後片付け
  selectedHandIndex = null;
  evoBaseId = null;
  evoCandidates = new Set();
  render(currentState);
}

// =====================
// EX（雑に互換：ボタンがあれば使えるように）
// =====================
async function tryUseEx(){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;

  const exId = st?.ex?.[seat] || null;
  if (!exId) return;

  const used = !!st?.exUsed?.[seat];
  if (used) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const exId2 = s?.ex?.[seat] || null;
    if (!exId2) return;
    s.exUsed = s.exUsed || {A:false,B:false};
    if (s.exUsed[seat]) return;

    // applyExSupport がある場合はそれを試す
    let ok = true;
    try{
      if (typeof applyExSupport === "function"){
        const n = applyExSupport.length;
        if (n >= 2) applyExSupport(s, seat);
        else if (n === 1) applyExSupport(s);
        else applyExSupport();
      }
    }catch{
      ok = false;
    }

    if (ok){
      s.exUsed[seat] = true;
      logPush(s, `[${seat}] EX使用：${cardName(exId2)}`);
      try{
        const w = checkWin(s);
        if (w) s.winner = w;
      }catch{}
      tx.set(stateRef, s);
    }
  });

  render(currentState);
}

function renderEx(st){
  if (!exWrapEl || !exBtnEl || !exInfoEl) return;

  const exId = st?.ex?.[seat] || null;
  if (!exId){
    exWrapEl.style.display = "none";
    return;
  }
  exWrapEl.style.display = "block";

  const used = !!st?.exUsed?.[seat];
  exBtnEl.disabled = !canControl(st) || used;

  exInfoEl.textContent = used ? `EX: ${cardName(exId)}（使用済）` : `EX: ${cardName(exId)}`;

  exBtnEl.onclick = ()=> tryUseEx();
}

// =====================
// End Turn
// =====================
async function endTurn(){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    const cur = normSeat(s.turn);
    const next = (cur === "A") ? "B" : "A";

    const logLines = Array.isArray(s.log) ? s.log : (s.log = []);

    // ターン終了時：におい処理など
    try{ applySmellOnTurnEnd?.(s, cur, logLines); }catch{}

    // 次ターン準備：ターン切替＆ターンSeq
    s.turn = next;
    s.turnSeq = Math.trunc(Number(s.turnSeq ?? 1)) + 1;

    // 次手番側：マナ+2（上限まで）＆満タン
    s.mana = gainManaPlus2OnReceiveTurn(s.mana, next);

    // 次手番側：疲労解除＆移動回数リセット
    if (Array.isArray(s.units)){
      for (const u of s.units){
        if (u.owner === next){
          u.fatigue = false;
          u.moveUsed = 0;
          u.moveTurnSeq = Number(s.turnSeq ?? 1);
        }
      }
    }

    // ドロー
    try{
      // drawCards が state を返す/ミューテートする両パターン対応
      const res = drawCards?.(s, next, DRAW_PER_TURN);
      if (res && typeof res === "object"){
        if (res.hands) s.hands = res.hands;
        if (res.decks) s.decks = res.decks;
        if (res.log) s.log = res.log;
      }
    }catch{
      // 最低限のドロー（落ちないように）
      try{
        s.decks = s.decks || {A:[],B:[]};
        s.hands = s.hands || {A:[],B:[]};
        const dk = Array.isArray(s.decks[next]) ? s.decks[next] : [];
        const hd = Array.isArray(s.hands[next]) ? s.hands[next] : [];
        for (let i=0;i<DRAW_PER_TURN;i++){
          if (!dk.length) break;
          hd.push(dk.pop());
        }
        s.decks[next] = dk;
        s.hands[next] = hd;
      }catch{}
    }

    logLines.push(`--- ${next}ターン ---`);
    tx.set(stateRef, s);
  });

  // UI側リセット
  setMode(null);
  selectedHandIndex = null;
  selectedTargetId = null;
  resetSupportPicks();
  evoBaseId = null;
  evoCandidates = new Set();

  render(currentState);
}

btnEnd && (btnEnd.onclick = ()=> endTurn());

// =====================
// onCellClick（モード分岐）
// =====================
function onCellClick(x,y){
  const st = currentState;
  if (!st) return;

  const u = unitAt(st,x,y);

  if (mode === "summon"){
    // 召喚（空きマスクリックで実行）
    if (!u) trySummonAt(x,y);
    else {
      // 置いてあるユニットクリック：詳細
      showUnitDetail(u, st);
    }
    return;
  }

  if (mode === "move"){
    if (u){
      if (u.owner === seat) onSelectMyUnit(u.id, st);
      else showUnitDetail(u, st);
      return;
    }
    tryMoveTo(x,y);
    return;
  }

  if (mode === "attack"){
    if (u){
      if (u.owner === seat){
        onSelectMyUnit(u.id, st);
        return;
      }
      // 敵クリックでターゲット選択→射程OKなら実行
      selectedTargetId = u.id;
      // 緑枠の相手だけ実行
      const rm = buildRangeMap(st);
      const key = `${x},${y}`;
      if (rm.has(key) && rm.get(key)?.ok){
        tryExecuteAttack(u.id);
      } else {
        render(st);
      }
      return;
    }
    // 空マスは何もしない
    return;
  }

  if (mode === "support"){
    if (!canControl(st)) return;

    const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
    if (selectedHandIndex == null) return;

    const cid = hand[selectedHandIndex];
    const def = cardDefs?.[cid];
    if (!def || !isSupportCard(def)) return;

    const need = planSupportTargets(def);

    if (need === "none"){
      tryExecuteSupport();
      return;
    }

    if (need === "unit"){
      if (!u) return;
      supportTarget1Id = u.id;
      showUnitDetail(u, st);
      tryExecuteSupport();
      render(st);
      return;
    }

    if (need === "unit2"){
      if (!u) return;
      if (!supportTarget1Id) {
        supportTarget1Id = u.id;
        showUnitDetail(u, st);
        render(st);
        return;
      }
      if (!supportTarget2Id && u.id !== supportTarget1Id){
        supportTarget2Id = u.id;
        showUnitDetail(u, st);
        tryExecuteSupport();
        render(st);
      }
      return;
    }

    if (need === "unitCell"){
      if (!supportTarget1Id){
        if (!u) return;
        supportTarget1Id = u.id;
        showUnitDetail(u, st);
        render(st);
        return;
      }
      // 移動先セル指定
      supportTargetCell = { x, y };
      tryExecuteSupport();
      render(st);
      return;
    }
    return;
  }

  if (mode === "evolve"){
    if (u && u.owner === seat){
      evoBaseId = u.id;
      evoCandidates = getEvoCandidates(st, u);
      showUnitDetail(u, st);
      render(st);
    } else if (u) {
      showUnitDetail(u, st);
    }
    return;
  }

  // モードなし：クリック対象に応じて選択
  if (u){
    if (u.owner === seat) onSelectMyUnit(u.id, st);
    else showUnitDetail(u, st);
  }
}

// =====================
// Render
// =====================
function renderLog(st){
  if (!logEl) return;
  const lines = Array.isArray(st?.log) ? st.log : [];
  const show = lines.slice(-14);
  const rng = (nowMs() < rngMsgUntil) ? "\n🎲 乱数調整！（見た目だけ）" : "";
  logEl.textContent = show.join("\n") + rng;
}

function render(st){
  if (!st) return;
  currentState = st;

  ensureRngButton();
  ensureSettingsButton();

  setTurnUI(st);
  renderEx(st);

  // hand
  renderHand(st);

  // board
  renderBoard(st);

  // picker
  renderActionPicker(st);

  // quick actions
  updateQuickActions(st);

  // log
  renderLog(st);

  // hit fx
  fxOnHit(st);

  // 進化候補更新（base選択済みで手札が変わったときのため）
  if (mode === "evolve" && evoBaseId){
    const base = (st.units||[]).find(u=>u.id===evoBaseId) || null;
    evoCandidates = base ? getEvoCandidates(st, base) : new Set();
  }
}

// =====================
// Snapshot subscribe
// =====================
ensureBoardGrid();

onSnapshot(stateRef, (snap)=>{
  if (!snap.exists()) return;
  const st = snap.data();

  // ターン切替演出
  const t = normSeat(st.turn);
  const seq = Number(st.turnSeq ?? 0);
  const changedTurn = (t && t !== lastSeenTurn);
  const changedSeq = (seq && seq !== lastSeenTurnSeq);

  if (changedTurn || changedSeq){
    lastSeenTurn = t;
    lastSeenTurnSeq = seq;
    flashTurnBanner();
  }

  // 勝者
  if (st.winner && modeHintEl){
    modeHintEl.textContent = `勝者：${st.winner}`;
  }

  render(st);
});

// =====================
// 初期モード
// =====================
setMode(null);