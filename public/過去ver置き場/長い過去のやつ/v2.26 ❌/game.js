// public/game.js
// v20260203_full_repair_no_feature_drop_plus_ui_square_jp_plus_sp_plus_status_icons_plus_ownerTopColor_plus_cardLayout_v2
//
// ✅ カード見た目ルール（要望反映）
// - 所有者表示は削除
// - プレイヤーA：カード上端を赤 / B：青（上端バー）
// - カード縁（枠色）は属性色のまま維持
// - レイアウト固定：
//   1) 左上=マナ 右上=属性
//   2) 名前
//   3) HP / SP（手札サポートは出さない）
//   4) 状態異常（疲労・パニックは常に記載）
//
// ✅ 相手ターンでも敵/味方ユニットクリックで詳細閲覧できる（行動実行は従来通り自分ターンのみ）
//
// ※ 既存機能は削らない（UI/EX/Support/FX/Range 等は維持）
// ★このファイルは「置き換え前提」です。重複宣言が起きないよう同名関数を作っていません。

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
// 色（属性：濃い色を枠として使う）
// =====================
const TYPE_RGB = {
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
const OWNER_TOPBAR = { A:"#ff3b30", B:"#0a84ff" };

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
  return TYPE_RGB[t] ?? "#e5e5ea";
}
function typeColorSoft(type, alpha=0.28){
  const strong = typeColorStrong(type);
  return hexToRgba(strong, alpha);
}
// 旧名互換
function typeColor(type){
  return typeColorSoft(type, 0.28);
}
function ownerTopBarColor(owner){
  const o = normSeat(owner);
  return OWNER_TOPBAR[o] ?? "rgba(255,255,255,.18)";
}

// =====================
// rate(成功率) 吸収（0%バグ対策）
// =====================
function getActRate(act){
  const raw = Number(act?.rate ?? act?.successRate ?? act?.hitRate ?? act?.prob ?? act?.p);
  if (!Number.isFinite(raw)) return 100;
  return Math.max(0, Math.min(100, Math.trunc(raw)));
}

// =====================
// UI CSS（四角／枠いっぱい／カードレイアウトv2）
// =====================
function ensureSquareUiCss(){
  if (document.getElementById("squareUiCss_v20260203_cardLayout_v2")) return;
  const css = document.createElement("style");
  css.id = "squareUiCss_v20260203_cardLayout_v2";
  css.textContent = `
    #hand{
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:8px 6px;
    }

    /* 共通：カード箱 */
    .handCard, .unitBox{
      --accent: rgba(255,255,255,.50);
      --accentSoft: rgba(255,255,255,.20);
      border: 2px solid var(--accentSoft);
      border-radius: 6px;
      background: rgba(0,0,0,.14);
      box-shadow: 0 0 0 2px rgba(0,0,0,.10) inset;
      position:relative;
      overflow:hidden;
      color:#fff;
    }

    /* 上端バー（A赤 / B青） */
    .topEdge{
      position:absolute;
      left:0; top:0; right:0;
      height:8px;
      background: rgba(255,255,255,.18);
      pointer-events:none;
    }

    /* 手札 */
    .handCard{
      width: 100%;
      min-height: 86px;
      cursor:pointer;
      user-select:none;
      padding: 14px 10px 10px; /* 上端バー分 */
      transition: border-color .06s ease, background .06s ease;
    }
    .handCard:hover{
      border-color: var(--accent);
      background: rgba(255,255,255,.05);
    }
    .handCard.selected{
      border-color: var(--accent);
      background: rgba(255,255,255,.06);
    }

    /* 盤面ユニット */
    .unitBox{
      width: 100%;
      height: 100%;
      padding: 14px 8px 8px; /* 上端バー分 */
      display:flex;
      flex-direction:column;
      gap:6px;
    }

    /* カードレイアウト（固定） */
    .cRow1{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      font-size:12px;
      font-weight:900;
      letter-spacing:.06em;
      opacity:.96;
    }
    .cPill{
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.14);
      font-weight:900;
      white-space:nowrap;
    }
    .cName{
      font-weight: 900;
      font-size: 14px;
      line-height: 1.15;
      word-break: break-word;
    }
    .cStats{
      font-size:12px;
      opacity:.96;
      line-height:1.1;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }
    .cStatus{
      font-size:12px;
      opacity:.96;
      line-height:1.25;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .cStatus .off{
      opacity:.55;
    }

    /* 手札のボタン列（既存機能維持） */
    .hcBottom{
      display:flex;
      justify-content:flex-end;
      align-items:center;
      gap:8px;
      margin-top: 2px;
    }
    .hcDetailBtn{
      font-size:12px;
      padding:6px 10px;
      border-radius:6px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.16);
      color:#fff;
      cursor:pointer;
      font-weight:900;
    }
    .hcDetailBtn:hover{
      background: rgba(255,255,255,.06);
      border-color: rgba(255,255,255,.30);
    }
    .hcEvoPickBtn{
      font-size:12px;
      padding:6px 10px;
      border-radius:6px;
      border:1px solid rgba(120,255,170,.35);
      background: rgba(120,255,170,.14);
      color:#fff;
      cursor:pointer;
      font-weight:900;
    }
    .hcEvoPickBtn.picked{
      border-color: rgba(120,255,170,.60);
      background: rgba(120,255,170,.22);
    }
    .hcEvoPickBtn:disabled{
      opacity:.45;
      cursor:not-allowed;
      background: rgba(0,0,0,.16);
      border-color: rgba(255,255,255,.14);
    }

    /* PANICバッジ（既存演出維持） */
    .panicBadge{
      position:absolute;
      right:8px;
      top:10px;
      padding:3px 7px;
      border-radius: 6px;
      font-size:10px;
      font-weight:900;
      letter-spacing:.10em;
      border: 1px solid rgba(255,120,120,.40);
      background: rgba(255,120,120,.16);
      color:#fff;
      pointer-events:none;
    }

    /* Action Picker：英語排除 */
    #actionPicker{
      border-radius:6px;
      border:2px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.04);
      padding:10px 10px 12px;
      box-shadow: 0 0 0 2px rgba(0,0,0,.10) inset;
    }
    .apTitle{ display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
    .apTitle b{ font-size:14px; font-weight:900; }
    .apTitle .small{ opacity:.86; font-size:12px; }
    .actWrap{ display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
    .actBtn{
      position:relative; overflow:hidden;
      border-radius:6px;
      border:2px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.16);
      color:#fff;
      padding:8px 10px;
      font-size:12px;
      cursor:pointer;
      min-width: 170px;
      font-weight: 900;
    }
    .actBtn:hover{
      border-color: rgba(255,255,255,.30);
      background: rgba(255,255,255,.06);
    }
    .actBtn.selected{
      border-color: rgba(90,170,255,.55);
      background: rgba(90,170,255,.10);
    }
    .actBtn .badge{
      display:inline-flex; align-items:center; justify-content:center;
      padding:2px 6px; border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.14);
      font-weight:900; font-size:11px; opacity:.95;
      margin-left: 6px;
    }
    .apPanel{
      margin-top: 10px;
      padding: 10px 10px;
      border-radius: 6px;
      border: 2px solid rgba(255,255,255,.12);
      background: rgba(0,0,0,.14);
    }
    .apPanel .row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
    .apPanel .small{ font-size:12px; opacity:.86; }
    .apPanel .hint{
      margin-top: 8px;
      font-size: 12px;
      opacity: .92;
      line-height: 1.35;
      white-space: pre-wrap;
    }
    .btnExec{
      border-radius: 6px;
      border: 2px solid rgba(255,255,255,.16);
      background: rgba(90,170,255,.16);
      color: #fff;
      font-weight: 900;
      padding: 9px 12px;
      cursor: pointer;
    }
    .btnExec:hover{ background: rgba(90,170,255,.22); }
    .btnExec:disabled{
      opacity: .45;
      cursor: not-allowed;
      background: rgba(0,0,0,.16);
    }
    .btnGhost{
      border-radius: 6px;
      border: 2px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.14);
      color: #fff;
      font-weight: 900;
      padding: 9px 12px;
      cursor: pointer;
    }
    .btnGhost:hover{ background: rgba(255,255,255,.06); }
    .btnGhost:disabled{ opacity:.45; cursor:not-allowed; }
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
  btn.style.border = "2px solid rgba(255,255,255,.14)";
  btn.style.background = "rgba(0,0,0,.14)";
  btn.style.color = "#fff";
  btn.style.borderRadius = "6px";
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
  btn.style.border = "2px solid rgba(255,255,255,.14)";
  btn.style.background = "rgba(0,0,0,.14)";
  btn.style.color = "#fff";
  btn.style.borderRadius = "6px";
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

// =====================
// ★Firestore(map)/配列/文字列でも壊れない addStatus & tags 吸収層
// =====================
function addStatusListFromAny(addStatus){
  if (!addStatus) return [];
  if (Array.isArray(addStatus)) {
    return addStatus.map(x=>String(x||"").trim()).filter(Boolean);
  }
  if (typeof addStatus === "string") {
    return parseAddStatus?.(addStatus) || [];
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
  if (typeof tags === "string") return parseTags?.(tags) || {};
  if (Array.isArray(tags)) return parseTags?.(tags.join(",")) || {};
  if (typeof tags === "object") return tags;
  return {};
}

// =====================
// ★射程表記（矢印）：陣営の前方向に合わせて出す
// =====================
function forwardDy(owner){ return owner === "A" ? -1 : 1; }
function arrowByForward(owner){ return (forwardDy(owner) === -1) ? "↑" : "↓"; }
function arrowByBack(owner){ return (forwardDy(owner) === -1) ? "↓" : "↑"; }
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
  return s.split("+").map(x=>rangeTokenToArrow(x.trim(), owner)).filter(Boolean).join("+");
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
// ★侵入/勝利判定（未定義で落ちるのを修復）
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

      ensureInfilObj(s);
      tx.set(stateRef, { infil: s.infil }, { merge:true });

      if (!s.kills || typeof s.kills !== "object") tx.set(stateRef, { kills:{A:0,B:0} }, { merge:true });
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

// =====================
// ★ドロー吸収（drawCardsのシグネチャ/返り値の違いを全部吸う）
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
      if (L >= 4) ret = fn(s, who, cnt, cardDefs);
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

// =====================
// Local selection
// =====================
let lastSelectedUnitId = null;

function onSelectMyUnit(newUnitId, st){
  if (!newUnitId) return;
  const changed = (lastSelectedUnitId && lastSelectedUnitId !== newUnitId);
  lastSelectedUnitId = newUnitId;

  selectedUnitId = newUnitId;

  // 攻撃フロー：選び直したら対象は一旦クリア
  selectedTargetId = null;

  if (changed) selectedActionIndex = 0;

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

// ===== evolve selection state =====
let evoBaseId = null;                 // 進化元ユニットID（盤面ユニット）
let evoCandidates = new Set();        // 進化可能な手札index集合（毎renderで再計算）
let evoPickHandIndex = null;          // 「進化決定」ボタンで確定した手札index（これが進化先）

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

  if (types.some(t => ["draw","drawCards"].includes(t))) return { need:"none" };

  return { need:"none" };
}
function supportReadyByPlan(plan){
  const need = plan?.need || "none";
  if (need === "none") return true;
  if (need === "unit") return !!supportTarget1Id;
  if (need === "unit2") return !!supportTarget1Id && !!supportTarget2Id && supportTarget1Id !== supportTarget2Id;
  if (need === "unitCell") return !!supportTarget1Id && !!supportTargetCell;
  return false;
}

// =====================
// 状態異常 表示（疲労・パニックは常に出す）
// =====================
const STATUS_ICON = {
  panic: "😱",
  bleed: "🩸",
  fracture: "🦴",
  smell: "🦨",
  blind: "🙈",
  lostSoul: "👻",
  aim: "🎯",
  jinx: "🍀",
  evade: "💨",
  armor: "🛡️",
  powerUp: "💪",
  power: "💪",
  combo: "🔁",
  followUp: "⚔️",
  recoverFatigue: "😌",
  fatigue: "😫",
  recoverMove: "👣",
  moveReset: "👣",
};
const STATUS_JA = {
  panic: "パニック",
  fatigue: "疲労",
  recoverFatigue: "疲労回復",
  bleed: "出血",
  fracture: "骨折",
  smell: "におい",
  blind: "盲目",
  lostSoul: "喪失",
  aim: "狙い",
  jinx: "ジンクス",
  evade: "回避",
  armor: "装甲",
  powerUp: "強化",
  power: "強化",
  combo: "連撃",
  followUp: "追撃",
  recoverMove: "移動回復",
  moveReset: "移動回復",
};

function unitStatusKeys(u){
  const out = new Set();

  // panic
  if (u?.panic || isPanic?.(u)) out.add("panic");

  const pushObj = (obj)=>{
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj)){
      if (obj[k]) out.add(String(k));
    }
  };
  const pushArr = (arr)=>{
    if (!Array.isArray(arr)) return;
    for (const x of arr){
      const k = String(x||"").trim();
      if (k) out.add(k);
    }
  };
  const pushStr = (str)=>{
    const list = parseAddStatus?.(String(str||"")) || [];
    for (const k of list) out.add(String(k));
  };

  const s1 = u?.status;
  const s2 = u?.statuses;

  if (typeof s1 === "string") pushStr(s1);
  else if (Array.isArray(s1)) pushArr(s1);
  else pushObj(s1);

  if (typeof s2 === "string") pushStr(s2);
  else if (Array.isArray(s2)) pushArr(s2);
  else pushObj(s2);

  const tags = tagMapFromAny(u?.tags);
  for (const k of Object.keys(tags || {})){
    if (tags[k] === true || tags[k] === "true" || tags[k] === 1 || tags[k] === "1"){
      out.add(String(k));
    }
  }

  const add = addStatusListFromAny(u?.addStatus);
  for (const k of add) out.add(String(k));

  // fatigue をそれっぽく拾う（表現ゆれ保険）
  if (u?.fatigue === true) out.add("fatigue");

  return Array.from(out);
}

function statusLineForUnit(u){
  const keys = unitStatusKeys(u);
  const has = (k)=> keys.includes(k) || keys.includes(STATUS_JA[k]);

  const fatigueOn = has("fatigue");
  const panicOn = has("panic");

  // 必ず記載
  const parts = [];
  parts.push(fatigueOn ? "😫疲労" : "😌疲労なし");
  parts.push(panicOn ? "😱パニック" : "🙂パニックなし");

  // それ以外（有効なものだけ）
  for (const k of keys){
    const kk = String(k||"").trim();
    if (!kk) continue;
    if (kk === "fatigue" || kk === "panic") continue;
    if (kk === "疲労" || kk === "パニック") continue;

    const icon = STATUS_ICON[kk] || "";
    const ja = STATUS_JA[kk] || kk;
    // recover系は並びが増えやすいので、必要最低限
    parts.push(`${icon}${ja}`);
  }

  // 長すぎると潰れるので、ここは1行のまま
  return parts.join(" / ");
}

function statusLineForCardNoUnit(){
  // 手札サポートなど、ユニット状態がないカード用（要求の「必ず記載」を満たす）
  return "😌疲労なし / 🙂パニックなし";
}

// =====================
// SP吸収（unit/cardDef の表現ゆれを吸う）
// =====================
function getSpFromUnit(u){
  const v = Number(u?.sp ?? u?.SP ?? u?.msp ?? u?.mp ?? 0);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}
function getMaxSpFromUnit(u){
  const v = Number(u?.maxSp ?? u?.maxSP ?? u?.mspMax ?? u?.maxMp ?? u?.spMax ?? u?.SPMax ?? u?.baseSp ?? 0);
  return Number.isFinite(v) ? Math.trunc(v) : null;
}
function getSpFromCardDef(def){
  const v = Number(def?.sp ?? def?.SP ?? def?.baseSp ?? def?.mp ?? def?.MP ?? 0);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

// =====================
// ★場のユニット上限チェック
// =====================
function countUnitsOf(s, who){
  return (s?.units || []).filter(u => u && normSeat(u.owner) === who && Number(u.hp) > 0).length;
}

// =====================
// Firestore購読
// =====================
let unsub = null;
let currentState = null;

function mount(){
  ensureSquareUiCss();
  ensureRngButton();
  ensureSettingsButton();

  if (unsub) try{ unsub(); }catch{}
  unsub = onSnapshot(stateRef, (snap)=>{
    if (!snap.exists()) return;
    const s = snap.data() || {};
    currentState = s;
    render(s);
  });
}
mount();

// =====================
// ログ
// =====================
function renderLog(st){
  if (!logEl) return;
  logEl.innerHTML = "";
  const list = Array.isArray(st?.log) ? st.log : [];
  for (const ln of list){
    const div = document.createElement("div");
    div.textContent = String(ln ?? "");
    logEl.appendChild(div);
  }
}

// =====================
// 詳細（要望どおり：コスト HP SP / 行動）
// ※ 手札サポートはHP/SPを出さない（見た目ルール合わせ）
// =====================
function renderDetail(st){
  if (!detailEl) return;

  // 優先：選択ユニット → 選択ターゲット（相手ターンでもOK）
  const u = getSelectedUnit(st) || getSelectedTarget(st);
  if (u){
    const def = cardDefs?.[u.cardId] || null;
    const cost = Math.trunc(Number(def?.cost ?? u?.cost ?? 0) || 0);
    const hp = Math.trunc(Number(u?.hp ?? 0) || 0);

    const spCur = getSpFromUnit(u);
    const spMax = getMaxSpFromUnit(u);
    const spText = (spMax != null) ? `${spCur}/${spMax}` : `${spCur}`;

    const acts = Array.isArray(def?.actions) ? def.actions : [];
    const owner = normSeat(u.owner) || "?";
    const type = String(def?.type ?? u?.type ?? "");

    const lines = [];
    lines.push(`プレイヤー ${owner}`);
    lines.push(`コスト ${cost} / HP ${hp} / SP ${spText}`);
    lines.push(`属性 ${type}`);
    lines.push(`状態：${statusLineForUnit(u)}`);
    lines.push(`行動`);
    if (!acts.length){
      lines.push("・なし");
    }else{
      for (const a of acts){
        const nm = String(a?.name ?? "行動");
        const rate = getActRate(a);
        const dmg = Math.trunc(Number(a?.dmg ?? a?.damage ?? 0) || 0);
        const range = actRangeLabel(a, owner);
        lines.push(`・${nm}（威力${dmg} / 成功${rate}% / 射程${range}）`);
      }
    }
    detailEl.textContent = lines.join("\n");
    return;
  }

  // 手札の詳細
  const cid = selectedHandCardId(st);
  const def = cid ? (cardDefs?.[cid] || null) : null;
  if (def){
    const cost = Math.trunc(Number(def?.cost ?? 0) || 0);
    const type = String(def?.type ?? "");

    const lines = [];
    lines.push(`プレイヤー ${seat}`);
    lines.push(`コスト ${cost}`);
    lines.push(`属性 ${type}`);
    lines.push(`状態：${statusLineForCardNoUnit()}`);

    if (isSupportCard(def)){
      lines.push(`行動`);
      lines.push(`・サポート：${supportEffectSummary(def)}`);
    }else{
      const hp = Math.trunc(Number(def?.hp ?? def?.HP ?? 0) || 0);
      const sp = getSpFromCardDef(def);
      const acts = Array.isArray(def?.actions) ? def.actions : [];
      lines.splice(2, 0, `HP ${hp} / SP ${sp}`); // 非サポートだけHP/SPを差し込む

      lines.push(`行動`);
      if (!acts.length){
        lines.push("・なし");
      }else{
        for (const a of acts){
          const nm = String(a?.name ?? "行動");
          const rate = getActRate(a);
          const dmg = Math.trunc(Number(a?.dmg ?? a?.damage ?? 0) || 0);
          const range = actRangeLabel(a, seat);
          lines.push(`・${nm}（威力${dmg} / 成功${rate}% / 射程${range}）`);
        }
      }
    }

    detailEl.textContent = lines.join("\n");
    return;
  }

  detailEl.textContent = "（選択してください）";
}

// =====================
// 上部情報
// =====================
function renderTopInfo(st){
  if (turnEl) turnEl.textContent = `ターン：${String(st?.turn ?? "?")}`;
  if (manaEl){
    const m = normalizeMana(st?.mana);
    const cur = Math.trunc(Number(m?.[seat]?.cur ?? 0) || 0);
    const max = Math.trunc(Number(m?.[seat]?.max ?? 0) || 0);
    manaEl.textContent = `${cur}/${max}`;
  }
  if (manaGaugeEl){
    const m = normalizeMana(st?.mana);
    const cur = Math.trunc(Number(m?.[seat]?.cur ?? 0) || 0);
    const max = Math.trunc(Number(m?.[seat]?.max ?? 0) || 0);
    const ratio = (max>0) ? Math.max(0, Math.min(1, cur/max)) : 0;
    manaGaugeEl.style.width = `${Math.trunc(ratio*100)}%`;
  }
  if (deckCountEl){
    const dk = Array.isArray(st?.decks?.[seat]) ? st.decks[seat] : [];
    deckCountEl.textContent = String(dk.length);
  }
  if (killsEl){
    const a = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
    const b = Math.trunc(Number(st?.kills?.B ?? 0) || 0);
    killsEl.textContent = `A:${a} / B:${b}`;
  }
  if (infilEl){
    const inf = ensureInfilObj(st);
    infilEl.textContent = formatInfilText(inf);
  }
  if (modeHintEl){
    const jp = { summon:"召喚", move:"移動", attack:"行動", evolve:"進化", support:"サポート", null:"なし" };
    const m = mode ?? null;
    const myTurn = (normSeat(st?.turn) === seat);
    const w = st?.winner ? ` / 勝者：${st.winner}` : "";
    modeHintEl.textContent = `モード：${jp[m] ?? "なし"}${myTurn ? "" : "（相手ターン）"}${w}`;
  }

  // EX表示（英語禁止）
  if (exWrapEl && exInfoEl && exBtnEl){
    const exCid = st?.ex?.[seat] ?? null;
    exInfoEl.textContent = exCid ? `EX：${cardName(exCid)}` : "EX：なし";
    const used = !!st?.exUsed?.[seat];
    exBtnEl.disabled = !canControl(st) || used || !exCid;
    exBtnEl.textContent = used ? "EX使用済み" : "EX発動";
  }

  if (turnBanner){
    const myTurn = (normSeat(st?.turn) === seat);
    turnBanner.textContent = st?.winner ? `勝者：${st.winner}` : (myTurn ? "あなたのターン" : "相手のターン");
    turnBanner.style.opacity = st?.winner ? "1" : "0.95";
  }
}

// =====================
// 盤面レンダリング（カード見た目ルールv2）
// =====================
function cellIndex(x,y){ return `${x},${y}`; }

function buildBoardGrid(){
  if (!boardEl) return;
  boardEl.innerHTML = "";

  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      cell.addEventListener("click", (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        if (!currentState) return;
        onBoardCellClick(currentState, x, y);
      });

      boardEl.appendChild(cell);
    }
  }
}

function findCellEl(x,y){
  if (!boardEl) return null;
  return boardEl.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function renderUnits(st){
  if (!boardEl) return;
  if (!boardEl.querySelector(".cell")) buildBoardGrid();

  for (const el of boardEl.querySelectorAll(".cell")){
    el.innerHTML = "";
    el.classList.remove("selectable","selected","targetable");
  }

  const units = Array.isArray(st?.units) ? st.units : [];
  for (const u of units){
    if (!u || Number(u.hp) <= 0) continue;

    const x = Math.trunc(Number(u.x ?? 0) || 0);
    const y = Math.trunc(Number(u.y ?? 0) || 0);
    const cell = findCellEl(x,y);
    if (!cell) continue;

    const def = cardDefs?.[u.cardId] || {};
    const owner = normSeat(u.owner) || "?";
    const isMine = (owner === seat);

    const type = String(def?.type ?? u?.type ?? "");
    const accent = typeColorStrong(type);
    const accentSoft = typeColorSoft(type, 0.22);

    const box = document.createElement("div");
    box.className = "unitBox";
    box.style.setProperty("--accent", accent);
    box.style.setProperty("--accentSoft", accentSoft);

    // 上端バー（A赤/B青）
    const topEdge = document.createElement("div");
    topEdge.className = "topEdge";
    topEdge.style.background = ownerTopBarColor(owner);
    box.appendChild(topEdge);

    // 1) 左上=マナ 右上=属性
    const row1 = document.createElement("div");
    row1.className = "cRow1";

    const cost = Math.trunc(Number(def?.cost ?? u?.cost ?? 0) || 0);
    const pillMana = document.createElement("span");
    pillMana.className = "cPill";
    pillMana.textContent = String(cost);

    const pillType = document.createElement("span");
    pillType.className = "cPill";
    pillType.textContent = type || "？";

    row1.appendChild(pillMana);
    row1.appendChild(pillType);

    // 2) 名前
    const nameEl = document.createElement("div");
    nameEl.className = "cName";
    nameEl.textContent = String(def?.name ?? u.cardId ?? "ユニット");

    // 3) HP / SP
    const hp = Math.trunc(Number(u.hp ?? 0) || 0);
    const spCur = getSpFromUnit(u);
    const spMax = getMaxSpFromUnit(u);
    const spText = (spMax != null) ? `${spCur}/${spMax}` : `${spCur}`;

    const stats = document.createElement("div");
    stats.className = "cStats";
    stats.textContent = `HP ${hp} / SP ${spText}`;

    // 4) 状態異常（疲労・パニック必須）
    const stLine = document.createElement("div");
    stLine.className = "cStatus";
    stLine.textContent = statusLineForUnit(u);

    box.appendChild(row1);
    box.appendChild(nameEl);
    box.appendChild(stats);
    box.appendChild(stLine);

    // 既存演出維持
    if (u?.panic || isPanic?.(u)){
      const p = document.createElement("div");
      p.className = "panicBadge";
      p.textContent = "😱PANIC";
      box.appendChild(p);
    }

    // 選択表示
    if (u.id === selectedUnitId) cell.classList.add("selected");
    if (u.id === selectedTargetId) cell.classList.add("targetable");

    // クリック（ユニット選択/詳細）
    box.addEventListener("click", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      if (!currentState) return;
      onUnitClick(currentState, u);
    });

    cell.appendChild(box);

    if (isMine) cell.classList.add("selectable");
  }
}

// =====================
// 手札レンダリング（カード見た目ルールv2）
// - サポートはHP/SP行を出さない
// =====================
function renderHand(st){
  if (!handEl) return;
  handEl.innerHTML = "";

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  evoCandidates = new Set();

  for (let i=0;i<hand.length;i++){
    const cid = hand[i];
    const def = cardDefs?.[cid] || {};
    const isSup = isSupportCard(def);

    const type = String(def?.type ?? (isSup ? "Support" : "") ?? "");
    const accent = typeColorStrong(type);
    const accentSoft = typeColorSoft(type, 0.22);

    const wrap = document.createElement("div");
    wrap.className = "handCard";
    wrap.style.setProperty("--accent", accent);
    wrap.style.setProperty("--accentSoft", accentSoft);
    if (i === selectedHandIndex) wrap.classList.add("selected");

    // 上端バー（手札は自分の席色）
    const topEdge = document.createElement("div");
    topEdge.className = "topEdge";
    topEdge.style.background = ownerTopBarColor(seat);
    wrap.appendChild(topEdge);

    // 1) 左上=マナ 右上=属性
    const row1 = document.createElement("div");
    row1.className = "cRow1";

    const cost = Math.trunc(Number(def?.cost ?? 0) || 0);
    const pillMana = document.createElement("span");
    pillMana.className = "cPill";
    pillMana.textContent = String(cost);

    const pillType = document.createElement("span");
    pillType.className = "cPill";
    pillType.textContent = type || "？";

    row1.appendChild(pillMana);
    row1.appendChild(pillType);

    // 2) 名前
    const name = document.createElement("div");
    name.className = "cName";
    name.textContent = String(def?.name ?? cid);

    wrap.appendChild(row1);
    wrap.appendChild(name);

    // 3) HP / SP（サポートは出さない）
    if (!isSup){
      const hp = Math.trunc(Number(def?.hp ?? def?.HP ?? 0) || 0);
      const sp = getSpFromCardDef(def);
      const stats = document.createElement("div");
      stats.className = "cStats";
      stats.textContent = `HP ${hp} / SP ${sp}`;
      wrap.appendChild(stats);
    }

    // 4) 状態異常（疲労・パニック必須：手札は常に「なし」）
    const stLine = document.createElement("div");
    stLine.className = "cStatus";
    stLine.textContent = statusLineForCardNoUnit();
    wrap.appendChild(stLine);

    // 下段：詳細 / 進化決定（既存機能維持）
    const bottom = document.createElement("div");
    bottom.className = "hcBottom";

    const btnDetail = document.createElement("button");
    btnDetail.className = "hcDetailBtn";
    btnDetail.type = "button";
    btnDetail.textContent = "詳細";
    btnDetail.addEventListener("click", (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      selectedHandIndex = i;
      render(currentState);
    });
    bottom.appendChild(btnDetail);

    // 進化候補判定（盤面の evoBaseId がある場合だけ）
    const canPickEvo = (() => {
      if (mode !== "evolve") return false;
      if (!evoBaseId) return false;
      const base = (st?.units || []).find(u => u?.id === evoBaseId);
      if (!base) return false;
      if (cid === base.cardId) return false;
      if (isSup) return false;
      return true;
    })();
    if (canPickEvo) evoCandidates.add(i);

    if (mode === "evolve"){
      const pick = document.createElement("button");
      pick.className = "hcEvoPickBtn";
      pick.type = "button";
      pick.textContent = (evoPickHandIndex === i) ? "進化決定済み" : "進化決定";
      if (evoPickHandIndex === i) pick.classList.add("picked");
      pick.disabled = !canPickEvo;

      pick.addEventListener("click", (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        if (!canPickEvo) return;
        evoPickHandIndex = i;
        selectedHandIndex = i;
        render(currentState);
      });

      bottom.appendChild(pick);
    }

    wrap.appendChild(bottom);

    wrap.addEventListener("click", ()=>{
      selectedHandIndex = i;
      if (mode !== "support") resetSupportPicks();
      if (mode !== "evolve") evoPickHandIndex = null;
      render(currentState);
    });

    handEl.appendChild(wrap);
  }
}

// =====================
// クリック処理：盤面セル / ユニット
// =====================
function onBoardCellClick(st, x, y){
  if (!st) return;

  // サポート moveTo：セル選択
  if (mode === "support"){
    const def = selectedHandDef(st);
    if (!def || !isSupportCard(def)) return;
    const plan = supportPlan(def);
    if (plan.need === "unitCell"){
      supportTargetCell = { x, y };
      render(st);
    }
    return;
  }

  // 召喚：空セルに召喚（ただし Support は召喚できない）
  if (mode === "summon"){
    if (!canControl(st)) return;
    const cid = selectedHandCardId(st);
    const def = selectedHandDef(st);
    if (!cid || !def) return;
    if (isSupportCard(def)) return;

    try{
      const ok = summonArea?.(seat, x, y);
      if (!ok) return;
    }catch{
      if (seat === "A" && y > Math.floor(H/2)-1) return;
      if (seat === "B" && y < Math.ceil(H/2)) return;
    }

    const units = Array.isArray(st.units) ? st.units : [];
    if (units.some(u => u && Number(u.hp) > 0 && Number(u.x) === x && Number(u.y) === y)) return;

    if (countUnitsOf(st, seat) >= MAX_UNITS_PER_PLAYER) return;

    summonTx(st, cid, def, x, y);
    return;
  }

  // 移動：自ユニット選択中のとき、セルを移動先に
  if (mode === "move"){
    if (!canControl(st)) return;
    const su = getSelectedUnit(st);
    if (!su || normSeat(su.owner) !== seat) return;

    const dx = Math.abs((Number(su.x)||0) - x);
    const dy = Math.abs((Number(su.y)||0) - y);
    if (dx + dy !== 1) return;

    const units = Array.isArray(st.units) ? st.units : [];
    if (units.some(u => u && Number(u.hp) > 0 && Number(u.x) === x && Number(u.y) === y)) return;

    try{
      if (isMoveBlockedByStatus?.(su)) return;
    }catch{}

    moveTx(st, su.id, x, y);
    return;
  }
}

function onUnitClick(st, u){
  if (!st || !u) return;

  const owner = normSeat(u.owner);
  const isMine = (owner === seat);

  // ✅ 相手ターンでも「情報閲覧のための選択」はできるようにする
  if (!canControl(st)){
    // 自分/相手どちらでも、クリックしたユニットを詳細対象にする
    selectedUnitId = u.id;
    selectedTargetId = u.id;
    render(st);
    return;
  }

  // サポート：対象選択
  if (mode === "support"){
    const def = selectedHandDef(st);
    if (!def || !isSupportCard(def)) return;
    const plan = supportPlan(def);

    if (plan.need === "unit"){
      supportTarget1Id = u.id;
      render(st);
      return;
    }
    if (plan.need === "unit2"){
      if (!supportTarget1Id) supportTarget1Id = u.id;
      else if (!supportTarget2Id && u.id !== supportTarget1Id) supportTarget2Id = u.id;
      else if (u.id === supportTarget1Id) supportTarget1Id = null;
      else if (u.id === supportTarget2Id) supportTarget2Id = null;
      render(st);
      return;
    }
    if (plan.need === "unitCell"){
      supportTarget1Id = u.id;
      render(st);
      return;
    }
    return;
  }

  // 攻撃：自ユニット/敵ユニットの選択
  if (mode === "attack"){
    if (isMine){
      onSelectMyUnit(u.id, st);
    }else{
      selectedTargetId = u.id;
      render(st);
    }
    return;
  }

  // 進化：まず盤面の自ユニットを進化元に
  if (mode === "evolve"){
    if (!isMine) {
      // 敵クリックでも詳細は見せる
      selectedTargetId = u.id;
      render(st);
      return;
    }
    evoBaseId = u.id;
    evoPickHandIndex = null;
    render(st);
    return;
  }

  // それ以外：クリックしたユニットを詳細対象に
  selectedUnitId = u.id;
  selectedTargetId = u.id;
  render(st);
}

// =====================
// 行動ピッカー（日本語・確定ボタン）
// =====================
function clearActionPicker(){
  if (!actionPickerEl) return;
  actionPickerEl.innerHTML = "";
}

function renderActionPicker(st){
  if (!actionPickerEl) return;
  clearActionPicker();

  const jpMode = {
    summon: "召喚",
    move: "移動",
    attack: "行動",
    evolve: "進化",
    support: "サポート",
    null: "なし"
  };

  const title = document.createElement("div");
  title.className = "apTitle";
  const b = document.createElement("b");
  b.textContent = "行動";
  const small = document.createElement("span");
  small.className = "small";
  small.textContent = canControl(st) ? `モード：${jpMode[mode] ?? "なし"}` : "相手のターン";
  title.appendChild(b);
  title.appendChild(small);
  actionPickerEl.appendChild(title);

  const panel = document.createElement("div");
  panel.className = "apPanel";

  if (mode === "summon"){
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent =
      "手札を選び、召喚可能エリア（自陣）をクリック。\n※Supportは召喚できません。";
    panel.appendChild(hint);
    actionPickerEl.appendChild(panel);
    return;
  }

  if (mode === "move"){
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent =
      "自分ユニットをクリックして選択 → 隣のマスをクリックして移動。";
    panel.appendChild(hint);
    actionPickerEl.appendChild(panel);
    return;
  }

  if (mode === "evolve"){
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent =
      "進化元（盤面の自ユニット）をクリック。\n手札の「進化決定」で進化先を選び、下の「進化実行」を押す。";
    panel.appendChild(hint);

    const row = document.createElement("div");
    row.className = "row";
    const info = document.createElement("div");
    info.className = "small";
    info.textContent =
      `進化元：${evoBaseId ? "選択中" : "未選択"} / 進化先：${(evoPickHandIndex!=null) ? "決定済み" : "未決定"}`;

    const btn = document.createElement("button");
    btn.className = "btnExec";
    btn.type = "button";
    btn.textContent = "進化実行";
    btn.disabled = !canControl(st) || !evoBaseId || (evoPickHandIndex == null);
    btn.addEventListener("click", ()=>{
      if (!currentState) return;
      evolveTx_v20260203(currentState);
    });

    row.appendChild(info);
    row.appendChild(btn);
    panel.appendChild(row);

    actionPickerEl.appendChild(panel);
    return;
  }

  if (mode === "support"){
    const def = selectedHandDef(st);
    const isOk = def && isSupportCard(def);

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = isOk
      ? `サポート：${supportEffectSummary(def)}\n対象を選んで「サポート実行」。`
      : "手札からSupportを選んでください。";
    panel.appendChild(hint);

    const row = document.createElement("div");
    row.className = "row";

    const plan = isOk ? supportPlan(def) : {need:"none"};
    const ready = isOk ? supportReadyByPlan(plan) : false;

    const info = document.createElement("div");
    info.className = "small";
    const t1 = supportTarget1Id ? "選択" : "未選択";
    const t2 = supportTarget2Id ? "選択" : "未選択";
    const tc = supportTargetCell ? `(${supportTargetCell.x},${supportTargetCell.y})` : "未選択";
    if (plan.need === "unit") info.textContent = `対象：${t1}`;
    else if (plan.need === "unit2") info.textContent = `対象1：${t1} / 対象2：${t2}`;
    else if (plan.need === "unitCell") info.textContent = `対象：${t1} / 移動先：${tc}`;
    else info.textContent = `対象：不要`;

    const btnExec = document.createElement("button");
    btnExec.className = "btnExec";
    btnExec.type = "button";
    btnExec.textContent = "サポート実行";
    btnExec.disabled = !canControl(st) || !isOk || !ready;
    btnExec.addEventListener("click", ()=>{
      if (!currentState) return;
      supportTx_v20260203(currentState);
    });

    const btnClr = document.createElement("button");
    btnClr.className = "btnGhost";
    btnClr.type = "button";
    btnClr.textContent = "選択解除";
    btnClr.disabled = !isOk;
    btnClr.addEventListener("click", ()=>{
      resetSupportPicks();
      render(currentState);
    });

    row.appendChild(info);
    row.appendChild(btnExec);
    row.appendChild(btnClr);
    panel.appendChild(row);

    actionPickerEl.appendChild(panel);
    return;
  }

  // （続き）public/game.js

  if (mode === "attack"){
    const su = getSelectedUnit(st);
    const can = !!(su && normSeat(su.owner) === seat);
    const def = su ? (cardDefs?.[su.cardId] || null) : null;
    const acts = def?.actions;

    if (!can){
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "自分ユニットをクリックして選択。";
      panel.appendChild(hint);
      actionPickerEl.appendChild(panel);
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "actWrap";

    const list = Array.isArray(acts) ? acts : [];
    if (!list.length){
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = "このユニットは行動を持っていません。";
      panel.appendChild(hint);
      actionPickerEl.appendChild(panel);
      return;
    }

    ensureSelectedActionIndex(st);

    list.forEach((a, idx)=>{
      const btn = document.createElement("button");
      btn.className = "actBtn" + (idx === selectedActionIndex ? " selected" : "");
      btn.type = "button";

      const nm = String(a?.name ?? `行動${idx+1}`);
      const rate = getActRate(a);
      const dmg = Math.trunc(Number(a?.dmg ?? a?.damage ?? 0) || 0);
      const range = actRangeLabel(a, normSeat(su.owner));

      btn.innerHTML =
        `<span class="actText">${nm}` +
        `<span class="badge">成功${rate}%</span>` +
        `<span class="badge">威力${dmg}</span>` +
        `<span class="badge">射程${range}</span>` +
        `</span>`;

      btn.addEventListener("click", ()=>{
        selectedActionIndex = idx;
        render(currentState);
      });
      wrap.appendChild(btn);
    });

    actionPickerEl.appendChild(wrap);

    const row = document.createElement("div");
    row.className = "row";

    const tgt = getSelectedTarget(st);
    const info = document.createElement("div");
    info.className = "small";
    info.textContent = `対象：${tgt ? "選択中" : "未選択（敵ユニットをクリック）"}`;

    const btnExec = document.createElement("button");
    btnExec.className = "btnExec";
    btnExec.type = "button";
    btnExec.textContent = "行動実行";
    btnExec.disabled = !canControl(st) || !tgt;
    btnExec.addEventListener("click", ()=>{
      if (!currentState) return;
      attackTx_v20260203(currentState);
    });

    row.appendChild(info);
    row.appendChild(btnExec);

    panel.appendChild(row);
    actionPickerEl.appendChild(panel);
    return;
  }

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "モードを選んでください。";
  panel.appendChild(hint);
  actionPickerEl.appendChild(panel);
}

// =====================
// モードボタン（日本語のまま）
// =====================
function setMode(m){
  mode = m;
  if (m !== "attack") selectedTargetId = null;
  if (m !== "support") resetSupportPicks();
  if (m !== "evolve"){ evoBaseId = null; evoPickHandIndex = null; }
  render(currentState);
}

function wireButtons(){
  if (btnSummon) btnSummon.addEventListener("click", ()=> setMode("summon"));
  if (btnMove) btnMove.addEventListener("click", ()=> setMode("move"));
  if (btnAttack) btnAttack.addEventListener("click", ()=> setMode("attack"));
  if (btnEvolve) btnEvolve.addEventListener("click", ()=> setMode("evolve"));
  if (btnSupport) btnSupport.addEventListener("click", ()=> setMode("support"));

  if (btnEnd) btnEnd.addEventListener("click", ()=>{
    if (!currentState) return;
    endTurnTx_v20260203(currentState);
  });

  if (btnDoEvolve) btnDoEvolve.addEventListener("click", ()=>{
    if (!currentState) return;
    evolveTx_v20260203(currentState);
  });

  if (exBtnEl) exBtnEl.addEventListener("click", ()=>{
    if (!currentState) return;
    exTx_v20260203(currentState);
  });

  if (btnQuickMove) btnQuickMove.addEventListener("click", ()=> setMode("move"));
  if (btnQuickAttack) btnQuickAttack.addEventListener("click", ()=> setMode("attack"));
}
wireButtons();

// =====================
// render
// =====================
function render(st){
  if (!st) return;

  ensureSquareUiCss();
  renderTopInfo(st);
  renderUnits(st);
  renderHand(st);
  renderActionPicker(st);
  renderDetail(st);
  renderLog(st);

  if (quickMsgEl){
    const now = nowMs();
    quickMsgEl.textContent = (now < rngMsgUntil) ? "🎲 乱数調整中…" : "";
  }
}

// =====================
// 共通：ログ追記
// =====================
function appendLog(s, line){
  s.log = Array.isArray(s.log) ? s.log : [];
  s.log.push(String(line ?? ""));
  if (s.log.length > 120) s.log = s.log.slice(s.log.length - 120);
}

// =====================
// 召喚Tx
// =====================
async function summonTx(st, cardId, def, x, y){
  if (!st || !cardId || !def) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};

    if (!canControl(s)) return;

    const hand = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    const idx = hand.indexOf(cardId);
    if (idx < 0) return;

    s.mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0) || 0));
    try{
      if (!spendMana(s.mana, seat, cost)) return;
    }catch{
      const cur = Math.trunc(Number(s.mana?.[seat]?.cur ?? 0) || 0);
      if (cur < cost) return;
      s.mana[seat].cur = cur - cost;
    }

    if (countUnitsOf(s, seat) >= MAX_UNITS_PER_PLAYER) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    if (s.units.some(u => u && Number(u.hp) > 0 && Number(u.x)===x && Number(u.y)===y)) return;

    const u = {
      id: uid?.() || String(Math.random()).slice(2),
      owner: seat,
      cardId,
      x: Math.trunc(x),
      y: Math.trunc(y),
      hp: Math.trunc(Number(def.hp ?? def.HP ?? 0) || 0),
      sp: Math.trunc(Number(def.sp ?? def.SP ?? def.baseSp ?? 0) || 0),
      status: {},
      tags: {},
      panic: false,
    };

    hand.splice(idx, 1);
    s.hands[seat] = hand;

    s.units.push(u);

    s.lastSummon = { who: seat, cardId, x, y, at: nowMs() };
    appendLog(s, `【召喚】${seat}：${cardName(cardId)}（コスト${cost}）`);

    tx.set(stateRef, s);
  });
}

// =====================
// 移動Tx
// =====================
async function moveTx(st, unitId, x, y){
  if (!st || !unitId) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s)) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    const u = s.units.find(z => z && z.id === unitId);
    if (!u) return;
    if (normSeat(u.owner) !== seat) return;

    try{ if (isMoveBlockedByStatus?.(u)) return; }catch{}

    if (s.units.some(o => o && Number(o.hp) > 0 && Number(o.x)===x && Number(o.y)===y)) return;

    const dx = Math.abs((Number(u.x)||0) - x);
    const dy = Math.abs((Number(u.y)||0) - y);
    if (dx + dy !== 1) return;

    const from = {x: u.x, y: u.y};
    u.x = Math.trunc(x);
    u.y = Math.trunc(y);

    try{ applyBleedOnMove?.(u); }catch{}
    try{ applySmellOnTurnEnd?.(u); }catch{}

    appendLog(s, `【移動】${seat}：${cardName(u.cardId)}（${from.x},${from.y} → ${x},${y}）`);
    tx.set(stateRef, s);
  });
}

// =====================
// 攻撃Tx（対象選択→行動実行）
// =====================
async function attackTx_v20260203(st){
  if (!st) return;

  const su = getSelectedUnit(st);
  const tgt = getSelectedTarget(st);
  if (!su || !tgt) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s)) return;

    s.units = Array.isArray(s.units) ? s.units : [];

    const aU = s.units.find(z => z && z.id === su.id);
    const tU = s.units.find(z => z && z.id === tgt.id);
    if (!aU || !tU) return;
    if (normSeat(aU.owner) !== seat) return;
    if (normSeat(tU.owner) === seat) return;
    if (Number(aU.hp) <= 0 || Number(tU.hp) <= 0) return;

    const def = cardDefs?.[aU.cardId] || null;
    const acts = Array.isArray(def?.actions) ? def.actions : [];
    if (!acts.length) return;

    const act = acts[Math.max(0, Math.min(acts.length-1, selectedActionIndex))] || acts[0];
    const rate = getActRate(act);

    const rNum = Number(act?.range);
    if (Number.isFinite(rNum)){
      const dist =
        Math.abs((Number(aU.x)||0) - (Number(tU.x)||0)) +
        Math.abs((Number(aU.y)||0) - (Number(tU.y)||0));
      if (dist > Math.trunc(rNum)) return;
    }

    let hit = false;
    try{
      const hr = calcHitRateWithStatus?.(aU, tU, rate);
      const finalRate = Number.isFinite(hr) ? Math.max(0, Math.min(100, Math.trunc(hr))) : rate;
      hit = (Math.random() * 100) < finalRate;
      try{
        if (hit && checkEvade?.(aU, tU)) hit = false;
      }catch{}
    }catch{
      hit = (Math.random() * 100) < rate;
    }

    s.lastRoll = rate;
    s.lastHit = hit;

    const actName = String(act?.name ?? "行動");
    if (!hit){
      appendLog(s, `【行動】${seat}：${cardName(aU.cardId)}「${actName}」→ 失敗`);
      tx.set(stateRef, s);
      return;
    }

    let dmg = Math.trunc(Number(act?.dmg ?? act?.damage ?? 0) || 0);

    try{ dmg = applyPowerUpToHpDamage?.(aU, dmg) ?? dmg; }catch{}
    try{ dmg = applyArmorToHpDamage?.(tU, dmg) ?? dmg; }catch{}

    tU.hp = Math.max(0, Math.trunc(Number(tU.hp)||0) - Math.max(0, dmg));

    try{
      applyStatusesOnHit?.(aU, tU, act);
    }catch{
      const add = addStatusListFromAny(act?.addStatus);
      if (add.length){
        if (!tU.status || typeof tU.status !== "object") tU.status = {};
        for (const k of add){
          const kk = String(k||"").trim();
          if (!kk) continue;
          tU.status[kk] = true;
        }
      }
    }

    appendLog(s, `【行動】${seat}：${cardName(aU.cardId)}「${actName}」→ 命中（-${dmg}）`);

    if (Number(tU.hp) <= 0){
      if (!s.kills || typeof s.kills !== "object") s.kills = {A:0,B:0};
      s.kills[seat] = Math.trunc(Number(s.kills[seat] ?? 0) || 0) + 1;
      appendLog(s, `【撃破】${seat}：${cardName(tU.cardId)}`);

      const w = checkWinLocal(s);
      if (w){
        s.winner = w;
        appendLog(s, `【勝利】${w}`);
      }
    }

    tx.set(stateRef, s);
  });
}

// =====================
// サポートTx（対象選択→サポート実行）
// =====================
async function supportTx_v20260203(st){
  if (!st) return;
  const cid = selectedHandCardId(st);
  const def = selectedHandDef(st);
  if (!cid || !def || !isSupportCard(def)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s)) return;

    const hand = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    const idx = hand.indexOf(cid);
    if (idx < 0) return;

    s.mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0) || 0));
    try{
      if (!spendMana(s.mana, seat, cost)) return;
    }catch{
      const cur = Math.trunc(Number(s.mana?.[seat]?.cur ?? 0) || 0);
      if (cur < cost) return;
      s.mana[seat].cur = cur - cost;
    }

    s.units = Array.isArray(s.units) ? s.units : [];
    const t1 = supportTarget1Id ? s.units.find(u => u && u.id === supportTarget1Id) : null;
    const t2 = supportTarget2Id ? s.units.find(u => u && u.id === supportTarget2Id) : null;

    let ok = false;
    try{
      const ret = applySupport?.(s, seat, def, { t1, t2, cell: supportTargetCell, cardDefs });
      if (ret && typeof ret === "object") {
        ok = true;
        if (ret.units) s.units = ret.units;
        if (ret.hands) s.hands = ret.hands;
        if (ret.decks) s.decks = ret.decks;
        if (ret.mana)  s.mana  = ret.mana;
        if (ret.log)   s.log   = ret.log;
        if (ret.state && typeof ret.state === "object"){
          Object.assign(s, ret.state);
        }
      }else{
        ok = true;
      }
    }catch{
      const eff = def?.effect;
      const types = [];
      if (eff?.type) types.push(String(eff.type));
      if (Array.isArray(eff?.table)){
        for (const r of eff.table){
          if (r?.effect?.type) types.push(String(r.effect.type));
        }
      }
      if (types.includes("draw") || types.includes("drawCards")){
        const n = Math.trunc(Number(eff?.n ?? 1) || 1);
        safeDrawCards(s, seat, n);
        ok = true;
      }
    }

    if (ok){
      hand.splice(idx, 1);
      s.hands[seat] = hand;

      appendLog(s, `【サポート】${seat}：${cardName(cid)}（コスト${cost}）`);

      const w = checkWinLocal(s);
      if (w){
        s.winner = w;
        appendLog(s, `【勝利】${w}`);
      }

      tx.set(stateRef, s);
    }
  });

  resetSupportPicks();
  render(currentState);
}

// =====================
// 進化Tx（進化元=盤面 / 進化先=「進化決定」済みのみ）
// =====================
async function evolveTx_v20260203(st){
  if (!st) return;
  if (!evoBaseId) return;
  if (evoPickHandIndex == null) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s)) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    const base = s.units.find(u => u && u.id === evoBaseId);
    if (!base) return;
    if (normSeat(base.owner) !== seat) return;

    const hand = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    const cid = hand[evoPickHandIndex];
    if (!cid) return;

    const def = cardDefs?.[cid] || null;
    if (!def || isSupportCard(def)) return;

    s.mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0) || 0));
    try{
      if (!spendMana(s.mana, seat, cost)) return;
    }catch{
      const cur = Math.trunc(Number(s.mana?.[seat]?.cur ?? 0) || 0);
      if (cur < cost) return;
      s.mana[seat].cur = cur - cost;
    }

    const beforeName = cardName(base.cardId);
    base.cardId = cid;
    base.hp = Math.trunc(Number(def.hp ?? def.HP ?? base.hp ?? 0) || 0);
    base.sp = Math.trunc(Number(def.sp ?? def.SP ?? def.baseSp ?? base.sp ?? 0) || 0);

    base.status = (base.status && typeof base.status === "object") ? base.status : {};
    base.tags   = (base.tags   && typeof base.tags   === "object") ? base.tags   : {};

    hand.splice(evoPickHandIndex, 1);
    s.hands[seat] = hand;

    s.lastEvolve = { who: seat, from: beforeName, to: cardName(cid), at: nowMs() };
    appendLog(s, `【進化】${seat}：${beforeName} → ${cardName(cid)}（コスト${cost}）`);

    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      appendLog(s, `【勝利】${w}`);
    }

    tx.set(stateRef, s);
  });

  evoPickHandIndex = null;
  render(currentState);
}

// =====================
// EX Tx（1回のみ）
// =====================
async function exTx_v20260203(st){
  if (!st) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s)) return;

    if (!s.exUsed) s.exUsed = {A:false,B:false};
    if (s.exUsed[seat]) return;

    const exCid = s?.ex?.[seat] ?? null;
    if (!exCid) return;

    const def = cardDefs?.[exCid] || null;
    if (!def) return;

    let ok = false;
    try{
      const ret = applyExSupport?.(s, seat, def, { cardDefs });
      if (ret && typeof ret === "object"){
        ok = true;
        if (ret.state && typeof ret.state === "object") Object.assign(s, ret.state);
        if (ret.units) s.units = ret.units;
        if (ret.hands) s.hands = ret.hands;
        if (ret.decks) s.decks = ret.decks;
        if (ret.mana)  s.mana  = ret.mana;
        if (ret.log)   s.log   = ret.log;
      }else{
        ok = true;
      }
    }catch{
      ok = false;
    }

    if (!ok) return;

    s.exUsed[seat] = true;
    appendLog(s, `【EX】${seat}：${cardName(exCid)}`);

    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      appendLog(s, `【勝利】${w}`);
    }

    tx.set(stateRef, s);
  });
}

// =====================
// ターン終了Tx（ドロー強制成功 + 侵入加算 + 勝利判定）
// =====================
async function endTurnTx_v20260203(st){
  if (!st) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s)) return;

    const curTurn = normSeat(s.turn);
    if (curTurn !== seat) return;

    ensureInfilObj(s);
    const add = calcInfilAddAtTurnEnd(s, seat);
    s.infil[seat] = Math.trunc(Number(s.infil[seat] ?? 0) || 0) + Math.max(0, Math.trunc(add));

    safeDrawCards(s, seat, Math.trunc(Number(DRAW_PER_TURN ?? 1) || 1));

    try{
      const units = Array.isArray(s.units) ? s.units : [];
      for (const u of units){
        if (!u || Number(u.hp) <= 0) continue;
        try{ applySmellOnTurnEnd?.(u); }catch{}
      }
    }catch{}

    const next = (seat === "A") ? "B" : "A";
    s.turn = next;
    s.turnSeq = (typeof s.turnSeq === "number") ? (s.turnSeq + 1) : 1;
    appendLog(s, `--- ${next}ターン ---`);

    const w = checkWinLocal(s);
    if (w){
      s.winner = w;
      appendLog(s, `【勝利】${w}`);
    }

    tx.set(stateRef, s);
  });

  selectedTargetId = null;
  if (mode === "support") resetSupportPicks();
  if (mode === "evolve"){ evoPickHandIndex = null; }
  render(currentState);
}

// =====================
// 初期：盤面グリッド
// =====================
try{ buildBoardGrid(); }catch{}

// 初期描画（購読後に上書きされる）
render(currentState);