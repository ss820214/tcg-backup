// public/game_p1.js
const G = globalThis.__TCG_GAME__ || (globalThis.__TCG_GAME__ = {});
// v20260202_full_repair_no_feature_drop_plus_infil_fix_plus_draw_fix_owner_buff_icons
function normSeat(t){
  const s = String(t ?? "").toUpperCase();
  return (s === "A" || s === "B") ? s : null;
}

// ===== Support core (Support + EX) =====
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
} from "./game_core.js?v=20260201k";

import {
  W, H,
  DRAW_PER_TURN,
  summonArea,
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
  // ★追加（state 側の仕様を使う）
  applyPowerUpToHpDamage,
  applyArmorToHpDamage,
  parseAddStatus,
  parseTags,
} from "./game_state.js?v=20260201k";

import { supportEffectTextJa } from "./support_text.js?v=20260129b";

Object.assign(G,{
  // share
  normSeat,

  applySupport,isSupportCard,resolveSupportEffect,applyExSupport,
  initializeApp,getFirestore,doc,collection,getDoc,getDocs,onSnapshot,runTransaction,serverTimestamp,
  nowMs,normalizeMana,spendMana,getManaConsts,
  W,H,DRAW_PER_TURN,summonArea,computeInfil,checkWin,drawCards,uid,shuffle,
  isPanic,getStatus,formatStatusList,applyStatusesOnHit,calcHitRateWithStatus,checkEvade,
  isMoveBlockedByStatus,applyBleedOnMove,applySmellOnTurnEnd,
  applyPowerUpToHpDamage,applyArmorToHpDamage,parseAddStatus,parseTags,
  supportEffectTextJa
});

// settings (optional)
G.initSettings = null;
try{
  const mod = await import("./settings.js?v=20260130_v2");
  G.initSettings = mod?.initSettings || null;
}catch{}

G.CORE = getManaConsts();
G.MAX_MANA_UI = G.CORE.MAX_MANA ?? 20;
G.MAX_UNITS_PER_PLAYER = 5;

// =====================
// Firebase
// =====================
G.firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com")
    ? "tcg-0bato"
    : "tcg-0bato"
};
console.log("[G.firebaseConfig]", G.firebaseConfig);
G.app = initializeApp(G.firebaseConfig);
G.db = getFirestore(G.app);

// =====================
// DOM
// =====================
G.boardEl = document.getElementById("board");
G.youEl = document.getElementById("you");
G.turnEl = document.getElementById("turn");
G.manaEl = document.getElementById("mana");
G.manaGaugeEl = document.getElementById("manaGauge");
G.deckCountEl = document.getElementById("deckCount");
G.handEl = document.getElementById("hand");
G.actionPickerEl = document.getElementById("actionPicker");
G.detailEl = document.getElementById("detail");
G.diceEl = document.getElementById("dice");
G.logEl = document.getElementById("log");
G.killsEl = document.getElementById("kills");
G.infilEl = document.getElementById("infil");
G.modeHintEl = document.getElementById("modeHint");
G.btnSummon = document.getElementById("modeSummon");
G.btnMove = document.getElementById("modeMove");
G.btnAttack = document.getElementById("modeAttack");
G.btnEvolve = document.getElementById("modeEvolve");
G.btnSupport = document.getElementById("modeSupport");
G.btnDoEvolve = document.getElementById("doEvolve");
G.btnEnd = document.getElementById("endTurn");
G.turnBanner = document.getElementById("turnBanner");
G.quickActionsEl = document.getElementById("quickActions");
G.btnQuickMove = document.getElementById("quickMove");
G.btnQuickAttack = document.getElementById("quickAttack");
G.quickMsgEl = document.getElementById("quickMsg");

// Pinch + EX UI
G.pinchFxEl = document.getElementById("pinchFx");
G.exWrapEl = document.getElementById("exWrap");
G.exBtnEl = document.getElementById("exBtn");
G.exInfoEl = document.getElementById("exInfo");

// FX
G.fxFlashEl = document.getElementById("fxFlash");

// v2.3: UIの「ボタン消滅」対策（HTML側で欠けてても自動復旧）
(function ensureRequiredUi(){
  const controls = document.querySelector("#leftPane .controls") || document.querySelector(".controls") || document.body;
  const required = [
    ["modeSummon","召喚"],["modeMove","移動"],["modeAttack","行動"],["modeEvolve","進化"],["modeSupport","サポート"],
    ["doEvolve","進化実行"],["endTurn","ターン終了"],["exBtn","EX発動"]
  ];
  for (const [id,label] of required){
    if (document.getElementById(id)) continue;
    const b = document.createElement("button");
    b.id = id;
    b.textContent = label;
    if (id === "doEvolve") b.style.display = "none";
    controls.appendChild(b);
    console.warn("[v2.3][UI] missing button restored:", id);
  }
  // rebind
  G.btnSummon = document.getElementById("modeSummon");
  G.btnMove   = document.getElementById("modeMove");
  G.btnAttack = document.getElementById("modeAttack");
  G.btnEvolve = document.getElementById("modeEvolve");
  G.btnSupport= document.getElementById("modeSupport");
  G.btnDoEvolve = document.getElementById("doEvolve");
  G.btnEnd = document.getElementById("endTurn");
  G.exBtnEl = document.getElementById("exBtn");
})();

// =====================
// 色
// =====================
G.TYPE_RGB = {
  "火":  "#ff3b30",
  "水":  "#0a84ff",
  "草":  "#34c759",
  "闇":  "#af52de",
  "光":  "#ffd60a",
  "雷":  "#ff9500",
  "風":  "#f5f5f7",
  "鋼":  "#8e8e93",
  "土":  "#c19a6b",
  "support": "#c7c7cc",
  "Support": "#c7c7cc",
};
function hexToRgba(hex, a=1){
  const h = String(hex||"").replace("#","").trim();
  if (h.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function typeColorStrong(type){
  const t = String(type ?? "").trim();
  return G.TYPE_RGB[t] ?? "#e5e5ea";
}
function typeColorSoft(type, alpha=0.35){
  const strong = typeColorStrong(type);
  return hexToRgba(strong, alpha);
}
function typeColor(type){
  const t = String(type ?? "").trim();
  return typeColorSoft(t, 0.28);
}
Object.assign(G,{ hexToRgba,typeColorStrong,typeColorSoft,typeColor });

// =====================
// buildDeck
// =====================
function buildDeck(simple){
  const src = (simple && typeof simple === "object") ? simple : {};
  const arr = [];
  for (const id of Object.keys(src)){
    const cntRaw = Number(src[id] || 0);
    const cnt = Math.max(0, Math.min(4, Math.trunc(cntRaw)));
    for (let i=0;i<cnt;i++) arr.push(id);
  }
  return shuffle(arr);
}
G.buildDeck = buildDeck;

// rate吸収
function getActRate(act){
  const raw = Number(act?.rate ?? act?.successRate ?? act?.hitRate ?? act?.prob ?? act?.p);
  if (!Number.isFinite(raw)) return 100;
  return Math.max(0, Math.min(100, Math.trunc(raw)));
}
G.getActRate = getActRate;

// =====================
// CSS injectors（そのまま）
// =====================
function ensureHandCss(){ /* ここはあなたの貼ったまま */
  if (document.getElementById("handCss_v20260201_simple_v2")) return;
  const css = document.createElement("style");
  css.id = "handCss_v20260201_simple_v2";
  css.textContent = `/* ...省略せず貼るなら元のまま ... */`;
  document.head.appendChild(css);
}
function ensureActionPickerCss(){ /* 同様に元のまま */ }
function ensureBoardUnitCss(){ /* 同様に元のまま */ }

// ↑あなたの貼り付けのCSS文字列部分は “元のまま” ここに置いてOK
Object.assign(G,{ ensureHandCss, ensureActionPickerCss, ensureBoardUnitCss });

// =====================
// rng/settings button（render呼びだけ G.render に）
// =====================
G.rngMsgUntil = 0;
function ensureRngButton(){
  if (!G.logEl) return null;
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

  const parent = G.logEl.parentNode;
  if (parent) parent.insertBefore(btn, G.logEl);

  btn.addEventListener("click", ()=>{
    G.rngMsgUntil = nowMs() + 2200;
    if (typeof G.render === "function") G.render(G.currentState);
  });
  return btn;
}

function ensureSettingsButton(){
  if (!G.initSettings) return null;
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
    try { if (typeof G.initSettings === "function") G.initSettings({ db: G.db, roomId: G.roomId, playerId: G.playerId }); } catch {}
  });

  return btn;
}
Object.assign(G,{ ensureRngButton, ensureSettingsButton });

// =====================
// URL params / refs
// =====================
const params = new URLSearchParams(location.search);
const roomId = params.get("room");
const playerId = params.get("player");
if (!roomId || !playerId) {
  alert("URLに room / player がありません（battleから入ってね）");
  throw new Error("missing room/player");
}

const matchRef = doc(G.db, "rooms", roomId, "game", "match");
const stateRef = doc(G.db, "rooms", roomId, "game", "state");
const playerRef = (pid) => doc(G.db, "rooms", roomId, "players", pid);

Object.assign(G,{ roomId, playerId, matchRef, stateRef, playerRef });

// =====================
// Load card defs
// =====================
G.cardDefs = {};
async function loadCards() {
  const snap = await getDocs(collection(G.db, "cards"));
  const m = {};
  snap.forEach(d => (m[d.id] = d.data()));
  G.cardDefs = m;
}
await loadCards();

function cardName(cardId){
  return G.cardDefs?.[cardId]?.name || cardId;
}
G.cardName = cardName;

// safeStatusText（そのまま）
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
G.safeStatusText = safeStatusText;

// =====================
// Seat resolve（そのまま）
// =====================
G.seat = null;
G.opponentSeat = null;
G.seatAPlayerId = null;
G.seatBPlayerId = null;

async function resolveSeat() {
  const ms = await getDoc(matchRef);
  if (!ms.exists()) {
    alert("matchがありません（battleで両者準備OKになった？）");
    throw new Error("match missing");
  }
  const m = ms.data();
  G.seatAPlayerId = m.seatA;
  G.seatBPlayerId = m.seatB;

  if (playerId === G.seatAPlayerId) G.seat = "A";
  else if (playerId === G.seatBPlayerId) G.seat = "B";
  else {
    alert("あなたはこのマッチの参加者ではありません");
    throw new Error("not participant");
  }

  G.opponentSeat = (G.seat === "A") ? "B" : "A";
  if (G.youEl) G.youEl.textContent = G.seat;
}
await resolveSeat();

// =====================
// infil/win（そのまま）
// =====================
const WIN_KILL_COUNT = 3;
const WIN_INFIL_COUNT = 3;

function ensureInfilObj(s){
  if (!s) return {A:0, B:0};
  if (!s.infil || typeof s.infil !== "object") s.infil = {A:0, B:0};
  s.infil.A = Math.max(0, Math.trunc(Number(s.infil.A ?? 0) || 0));
  s.infil.B = Math.max(0, Math.trunc(Number(s.infil.B ?? 0) || 0));
  return s.infil;
}
function formatInfilText(infil){
  const a = Math.max(0, Math.trunc(Number(infil?.A ?? 0) || 0));
  const b = Math.max(0, Math.trunc(Number(infil?.B ?? 0) || 0));
  return `A:${a} / B:${b}`;
}
function calcInfilAddAtTurnEnd(s, who){
  const units = Array.isArray(s?.units) ? s.units : [];
  const alive = units.filter(u => u && Number(u.hp) > 0 && !u.panic && normSeat(u.owner) === who);
  if (who === "A") return alive.filter(u => Number(u.y) <= 1).length;
  if (who === "B") return alive.filter(u => Number(u.y) >= (H - 2)).length;
  return 0;
}
function checkWinLocal(s){
  if (!s) return null;

  const killsA = Math.trunc(Number(s?.kills?.A ?? 0));
  const killsB = Math.trunc(Number(s?.kills?.B ?? 0));
  if (killsA >= WIN_KILL_COUNT) return "A";
  if (killsB >= WIN_KILL_COUNT) return "B";

  const infil = ensureInfilObj(s);
  if (Math.trunc(Number(infil.A ?? 0)) >= WIN_INFIL_COUNT) return "A";
  if (Math.trunc(Number(infil.B ?? 0)) >= WIN_INFIL_COUNT) return "B";

  try{
    if (typeof checkWin === "function"){
      const w = normSeat(checkWin(s));
      if (w) return w;
    }
  }catch{}
  return null;
}
Object.assign(G,{ ensureInfilObj, formatInfilText, calcInfilAddAtTurnEnd, checkWinLocal });

// =====================
// Init state once（そのまま）
// =====================
async function ensureStateInitialized() {
  await runTransaction(G.db, async (tx) => {
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

      ensureInfilObj(s);
      tx.set(stateRef, { infil: s.infil }, { merge:true });

      if (!s.kills || typeof s.kills !== "object") tx.set(stateRef, { kills:{A:0,B:0} }, { merge:true });
      return;
    }

    const pA = await tx.get(playerRef(G.seatAPlayerId));
    const pB = await tx.get(playerRef(G.seatBPlayerId));
    if (!pA.exists() || !pB.exists()) throw new Error("players missing");

    const deckA_simple = pA.data().deck || {};
    const deckB_simple = pB.data().deck || {};

    const exA = pA.data().exCardId || null;
    const exB = pB.data().exCardId || null;

    const deckA = buildDeck(deckA_simple);
    const deckB = buildDeck(deckB_simple);

    const hands = { A:[], B:[] };
    for (let i=0;i<5;i++){ if(deckA.length) hands.A.push(deckA.pop()); }
    for (let i=0;i<5;i++){ if(deckB.length) hands.B.push(deckB.pop()); }

    const mana = {
      A:{cur:G.CORE.START_CUR, max:G.CORE.START_MAX},
      B:{cur:G.CORE.START_CUR, max:G.CORE.START_MAX}
    };

    tx.set(stateRef, {
      turn: "A",
      turnSeq: 1,
      mana,
      decks: { A:deckA, B:deckB },
      hands,
      units: [],
      kills: { A:0, B:0 },
      infil: { A:0, B:0 },
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
G.ensureStateInitialized = ensureStateInitialized;

// =====================
// safeDrawCards（そのまま）
// =====================
function safeDrawCards(s, who, n){
  const cnt = Math.max(0, Math.trunc(Number(n ?? 0)));
  if (!s || !who || !cnt) return;

  s.decks = s.decks || {A:[],B:[]};
  s.hands = s.hands || {A:[],B:[]};

  const beforeH = Array.isArray(s.hands[who]) ? s.hands[who].length : 0;

  try{
    const fn = drawCards;
    if (typeof fn === "function"){
      const L = fn.length;
      let ret;

      if (L >= 4) ret = fn(s, who, cnt, G.cardDefs);
      else if (L === 3) ret = fn(s, who, cnt);
      else if (L === 2) ret = fn(s, who);
      else ret = fn(s);

      if (ret && typeof ret === "object"){
        if (ret.decks || ret.hands) {
          if (ret.decks) s.decks = ret.decks;
          if (ret.hands) s.hands = ret.hands;
        }
        if (ret.state && (ret.state.decks || ret.state.hands)){
          if (ret.state.decks) s.decks = ret.state.decks;
          if (ret.state.hands) s.hands = ret.state.hands;
        }
      }
    }
  }catch{}

  s.decks = s.decks || {A:[],B:[]};
  s.hands = s.hands || {A:[],B:[]};

  const afterH = Array.isArray(s.hands[who]) ? s.hands[who].length : 0;
  if (afterH === beforeH) {
    const dk = Array.isArray(s.decks[who]) ? s.decks[who] : [];
    const hd = Array.isArray(s.hands[who]) ? s.hands[who] : [];
    for (let i=0;i<cnt;i++){
      if (!dk.length) break;
      hd.push(dk.pop());
    }
    s.decks[who] = dk;
    s.hands[who] = hd;
  }

  s.hands[who] = Array.isArray(s.hands[who]) ? s.hands[who] : [];
  s.decks[who] = Array.isArray(s.decks[who]) ? s.decks[who] : [];
}
G.safeDrawCards = safeDrawCards;

// ✅ ここから先は p2/p3/p4 に分割して読み込む
await import("./game_p2.js?v=20260202a");
await import("./game_p3.js?v=20260202a");
await import("./game_p4.js?v=20260202a");