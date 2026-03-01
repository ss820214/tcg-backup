// public/game.js
// v20260202_full_repair_no_feature_drop_plus_infil_fix_plus_draw_fix_owner_buff_icons
//
// - 未定義で落ちる箇所を修復（infil / win判定 / evolveログなど）
// - ✅ ドローが増えない問題を完全修正：safeDrawCards() を導入して endTurn / Support(draw) を強制成功
// - ✅ バフ/デバフのアイコン表示を強化：status/statuses 両対応 + 表示安定化
// - ✅ 所有者表示をわかりやすく：OWNER表示を「YOU/ENEMY + 色リボン」
// - ※ 既存機能は削らない（UI/EX/Support/FX/Range 等は維持）

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
function typeColorSoft(type, alpha=0.35){
  const strong = typeColorStrong(type);
  return hexToRgba(strong, alpha);
}

// 旧名互換
function typeColor(type){
  const t = String(type ?? "").trim();
  return typeColorSoft(t, 0.28);
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
// Hand UI: inject CSS
// =====================
function ensureHandCss(){
  if (document.getElementById("handCss_v20260201_simple_v2")) return;

  const css = document.createElement("style");
  css.id = "handCss_v20260201_simple_v2";
  css.textContent = `
    #hand{ display:flex; flex-wrap:wrap; gap:10px; align-items:stretch; justify-content:flex-start; padding:8px 6px; }
    .handCard{
      --accent: rgba(255,255,255,.55);
      --accentSoft: rgba(255,255,255,.22);
      width:250px; min-height:92px;
      border:1px solid rgba(255,255,255,.16); border-color:var(--accentSoft);
      border-radius:14px;
      background:rgba(255,255,255,.05);
      position:relative; overflow:hidden; cursor:pointer; user-select:none;
      padding:10px 10px 8px;
      box-shadow: 0 6px 16px rgba(0,0,0,.25), 0 0 0 2px rgba(0,0,0,.10) inset;
      transition: transform .06s ease, border-color .06s ease, background .06s ease, box-shadow .06s ease;
    }
    .handCard:hover{
      transform: translateY(-1px);
      border-color: var(--accent);
      background: rgba(255,255,255,.06);
      box-shadow: 0 8px 18px rgba(0,0,0,.28), 0 0 0 2px rgba(0,0,0,.10) inset;
    }
    .handCard.selected{
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(255,255,255,.12), 0 0 0 2px var(--accentSoft) inset, 0 10px 20px rgba(0,0,0,.35);
    }
    .handCard.evoCandidate{ outline:2px solid rgba(120,255,170,.45); outline-offset:0px; }

    .hcBar{ position:absolute; left:0; top:0; bottom:0; width:10px; opacity:1;
      background: linear-gradient(180deg, var(--accent) 0%, rgba(0,0,0,.0) 140%); }
    .hcRow1{ display:flex; gap:10px; align-items:center; }
    .hcDiamond{
      width:28px; height:28px; transform: rotate(45deg);
      border-radius:6px; border:1px solid rgba(255,255,255,.22); border-color: var(--accentSoft);
      background: rgba(0,0,0,.18);
      display:flex; align-items:center; justify-content:center; flex:0 0 auto;
      box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
    }
    .hcDiamond span{ transform: rotate(-45deg); font-weight:900; font-size:13px; line-height:1; }
    .hcMain{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .hcName{ font-weight:900; font-size:14px; line-height:1.15; word-break: break-word; }
    .hcType{ font-size:12px; opacity:.88; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .hcRow2{ margin-top:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .hcStats{ font-size:12px; opacity:.92; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .hcDetailBtn{
      font-size:12px; padding:6px 10px;
      border-radius:10px; border:1px solid rgba(255,255,255,.20); border-color: var(--accentSoft);
      background: rgba(0,0,0,.18); color:#fff; cursor:pointer; flex:0 0 auto;
    }
    .hcDetailBtn:hover{ background: rgba(255,255,255,.08); border-color: var(--accent); }
    .hcSupport{ font-size:12px; opacity:.92; }
  `;
  document.head.appendChild(css);
}

// =====================
// Action Picker UI: inject CSS
// =====================
function ensureActionPickerCss(){
  if (document.getElementById("actionPickerCss_v20260201")) return;
  const css = document.createElement("style");
  css.id = "actionPickerCss_v20260201";
  css.textContent = `
    #actionPicker{
      border-radius:14px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.04);
      padding:10px 10px 12px;
      box-shadow: 0 8px 18px rgba(0,0,0,.28);
    }
    .apTitle{ display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
    .apTitle b{ font-size:14px; font-weight:900; }
    .apTitle .small{ opacity:.86; font-size:12px; }
    .actWrap{ display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }

    .actBtn{
      --fill: 0;
      position:relative; overflow:hidden;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.18);
      color:#fff;
      padding:8px 10px;
      font-size:12px;
      cursor:pointer;
      min-width:160px;
      box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
      transition: transform .06s ease, border-color .06s ease, background .06s ease;
    }
    .actBtn:hover{
      transform: translateY(-1px);
      border-color: rgba(255,255,255,.30);
      background: rgba(255,255,255,.06);
    }
    .actBtn::before{
      content:"";
      position:absolute;
      left:0; right:0; bottom:0;
      height:100%;
      transform-origin: bottom;
      transform: scaleY(var(--fill));
      transition: transform .22s ease;
      background: linear-gradient(180deg,
        rgba(90,170,255,.08) 0%,
        rgba(90,170,255,.18) 40%,
        rgba(90,170,255,.28) 100%);
    }
    .actBtn.selected{
      border-color: rgba(90,170,255,.55);
      box-shadow: 0 0 0 2px rgba(90,170,255,.18), 0 0 0 2px rgba(0,0,0,.12) inset;
    }
    .actBtn.selected::before{ transform: scaleY(1); }
    .actBtn .actText{ position:relative; z-index:2; display:flex; align-items:center; gap:8px; white-space:nowrap; }
    .actBtn .badge{
      display:inline-flex; align-items:center; justify-content:center;
      padding:2px 6px; border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.16);
      font-weight:800; font-size:11px; opacity:.95;
    }
    .apFooter{ margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
  `;
  document.head.appendChild(css);
}

// =====================
// Board Unit UI: inject CSS
// =====================
function ensureBoardUnitCss(){
  if (document.getElementById("boardUnitCss_v20260202_owner_ribbon")) return;
  const css = document.createElement("style");
  css.id = "boardUnitCss_v20260202_owner_ribbon";
  css.textContent = `
    .unitBox{
      --accent: rgba(255,255,255,.55);
      --accentSoft: rgba(255,255,255,.22);
      display:flex; flex-direction:column; gap:4px;
      padding:8px 8px 7px;
      border-radius:14px;
      background: rgba(0,0,0,.14);
      border: 2px solid var(--accentSoft);
      box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
      position:relative;
      overflow:hidden;
    }
    .uTop{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; opacity:.96; line-height:1; }
    .uCost{
      font-weight:900; padding:2px 6px; border-radius:10px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.18);
      display:inline-flex; align-items:center; gap:4px;
      min-width:18px; justify-content:center;
    }
    .uType{
      padding:2px 6px; border-radius:10px;
      border:1px solid var(--accentSoft);
      background: rgba(0,0,0,.10);
      opacity:.95; white-space:nowrap;
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
      min-height:14px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    /* OWNER ribbon */
    .uOwner{
      margin-top: 4px;
      padding: 5px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .10em;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.16);
    }
    .uOwner .tag{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:2px 7px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.14);
      font-weight:900;
      font-size:10px;
      letter-spacing:.18em;
    }
    .uOwner.you{ border-color: rgba(120,255,170,.25); }
    .uOwner.enemy{ border-color: rgba(255,120,120,.20); }
    .uOwner.you .tag{ border-color: rgba(120,255,170,.25); }
    .uOwner.enemy .tag{ border-color: rgba(255,120,120,.20); }
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
// ★Firestore(map)/配列/文字列でも壊れない addStatus & tags 吸収層
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

// ターン終了時に侵入を加算する（相手側2列に侵入している自軍ユニット数）
function calcInfilAddAtTurnEnd(s, who){
  const units = Array.isArray(s?.units) ? s.units : [];
  const alive = units.filter(u => u && Number(u.hp) > 0 && !u.panic && normSeat(u.owner) === who);
  if (who === "A") return alive.filter(u => Number(u.y) <= 1).length;          // A→上2列
  if (who === "B") return alive.filter(u => Number(u.y) >= (H - 2)).length;     // B→下2列
  return 0;
}

// 既存 checkWin があるなら尊重しつつ、最低限（kills/infil）でも勝者を返せるように
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

      // ★infil補完（既存部屋で endTurn が落ちるのを防ぐ）
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

  // 1) drawCards を色んな呼び方で試す（返り値も吸う）
  try{
    const fn = drawCards;
    if (typeof fn === "function"){
      const L = fn.length;
      let ret;

      if (L >= 4) ret = fn(s, who, cnt, cardDefs);
      else if (L === 3) ret = fn(s, who, cnt);
      else if (L === 2) ret = fn(s, who);
      else ret = fn(s);

      // ret が state/partial を返す実装を吸う
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

  // 2) ここまでで増えてなかったら手動ドロー（最終保険）
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
    .cell.moveOk{ outline:3px solid rgba(120,255,170,.45); outline-offset:-3px; }
    .cell.rangeOk{ outline:3px solid rgba(120,255,170,.42); outline-offset:-3px; }
    .cell.rangeBad{ outline:3px solid rgba(255,120,120,.35); outline-offset:-3px; }
    .cell.sel{ box-shadow:0 0 0 3px rgba(255,255,255,.25) inset; }
    .cell.myUnit{ box-shadow:0 0 0 2px rgba(120,255,170,.18) inset; }
    .cell.enemyUnit{ box-shadow:0 0 0 2px rgba(255,120,120,.16) inset; }
    .cell.panic{ filter:grayscale(0.35); opacity:.85; }
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

    const key = isSup ? "support" : type;
    wrap.style.setProperty("--accent", typeColorSoft(key, 0.72));
    wrap.style.setProperty("--accentSoft", typeColorSoft(key, 0.28));

    const bar = document.createElement("div");
    bar.className = "hcBar";
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
      selectedHandIndex = (selectedHandIndex === i) ? null : i;

      if (mode === "evolve" && evoBaseId && evoCandidates.has(i)){
        tryExecuteEvolve(i);
        return;
      }

      // summonモードで選んだら「おすすめマス」を一応詳細に出す（落ちない）
      if (mode === "summon" && selectedHandIndex != null && myTurn){
        const p = pickDefaultSummonCell(st, seat);
        if (p) { /* noop */ }
      }

      render(st);
    });

    if (!myTurn) wrap.style.opacity = "0.85";

    handEl.appendChild(wrap);
  }
}

// =====================
// Action picker
// =====================
function renderActionPicker(st){
  ensureActionPickerCss();

  if (!actionPickerEl) return;
  actionPickerEl.innerHTML = "";

  const su = getSelectedUnit(st);
  if (!su) return;

  const def = cardDefs?.[su.cardId];
  const acts = Array.isArray(def?.actions) ? def.actions : [];
  if (!acts.length) return;

  ensureSelectedActionIndex(st);

  const title = document.createElement("div");
  title.className = "apTitle";
  title.innerHTML = `<b>${cardName(su.cardId)}</b> <span class="small">行動</span>`;
  actionPickerEl.appendChild(title);

  const wrap = document.createElement("div");
  wrap.className = "actWrap";

  for (let i=0;i<acts.length;i++){
    const a = acts[i];

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "actBtn";

    const isSel = (i === selectedActionIndex);
    if (isSel) btn.classList.add("selected");
    btn.style.setProperty("--fill", isSel ? "1" : "0");

    const cost = Math.trunc(Number(a?.cost ?? 0));
    const rangeLbl = actRangeLabel(a, su.owner);

    const text = document.createElement("span");
    text.className = "actText";

    const badgeCost = document.createElement("span");
    badgeCost.className = "badge";
    badgeCost.textContent = `${cost}`;

    const name = document.createElement("span");
    name.textContent = `${a?.name ?? "?"}`;

    const badgeRange = document.createElement("span");
    badgeRange.className = "badge";
    badgeRange.textContent = `${rangeLbl}`;

    text.appendChild(badgeCost);
    text.appendChild(name);
    text.appendChild(badgeRange);

    btn.appendChild(text);

    btn.addEventListener("click", ()=>{
      selectedActionIndex = i;
      render(st);
    });

    wrap.appendChild(btn);
  }

  actionPickerEl.appendChild(wrap);

  const footer = document.createElement("div");
  footer.className = "apFooter";

  const detailBtn = document.createElement("button");
  detailBtn.type = "button";
  detailBtn.className = "btnSmall";
  detailBtn.textContent = "ユニット詳細";
  detailBtn.addEventListener("click", ()=> showUnitDetail(su, st));
  footer.appendChild(detailBtn);

  actionPickerEl.appendChild(footer);
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

  if (isSupportCard(def)) return map;
  if (!canControl(st)) return map;

  const myAlive = countMyAliveUnits(st.units, seat);
  if (myAlive >= MAX_UNITS_PER_PLAYER) return map;

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

      if (summonMap.has(`${x},${y}`)) cell.classList.add("summonOk");
      if (moveMap.has(`${x},${y}`)) cell.classList.add("moveOk");
      if (rangeMap.has(`${x},${y}`)){
        const it = rangeMap.get(`${x},${y}`);
        if (it?.ok) cell.classList.add("rangeOk");
        else cell.classList.add("rangeBad");
      }

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

      box.style.setProperty("--accent", typeColorSoft(type, 0.78));
      box.style.setProperty("--accentSoft", typeColorSoft(type, 0.35));

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

      const name = document.createElement("div");
      name.className = "uName";
      name.textContent = cardName(u.cardId);

      const hp = document.createElement("div");
      hp.className = "uHP";
      hp.textContent = `HP:${Math.trunc(Number(u.hp ?? 0))}  SP:${Math.trunc(Number(u.sp ?? 0))}`;

      const icons = document.createElement("div");
      icons.className = "uIcons";
      icons.textContent = statusIconsText(u) || "";

      const owner = document.createElement("div");
      owner.className = "uOwner";
      const isYou = (u.owner === seat);
      owner.classList.add(isYou ? "you" : "enemy");

      const left = document.createElement("span");
      left.textContent = isYou ? "YOU" : "ENEMY";

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = `P${u.owner}`;

      owner.appendChild(left);
      owner.appendChild(tag);

      box.appendChild(top);
      box.appendChild(name);
      box.appendChild(hp);
      box.appendChild(icons);
      box.appendChild(owner);

      box.addEventListener("click", async (ev)=>{
        ev.stopPropagation();

        // ★Support中：ユニットクリックを「サポート対象クリック」として扱う
        if (mode === "support") {
          await tryExecuteSupportOnClickUnitOrCell(u.x, u.y);
          return;
        }

        // ★Evolve中：自軍ユニットクリックで「進化元」にする（候補を光らせる）
        if (mode === "evolve") {
          if (u.owner !== seat) {
            showUnitDetail(u, st);
            return;
          }
          evoBaseId = u.id;
          evoCandidates = getEvoCandidates(st, u);

          selectedUnitId = u.id;
          selectedTargetId = null;
          selectedActionIndex = 0;

          render(st);
          return;
        }

        // 通常挙動（従来）
        if (u.owner === seat) {
          onSelectMyUnit(u.id, st);
        } else {
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

  if (!inSummonAreaForSeat(x,y,seat)) return;
  if (!isEmptyCell(st,x,y)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    ensureInfilObj(s);

    const hand = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    if (selectedHandIndex == null || selectedHandIndex < 0 || selectedHandIndex >= hand.length) return;

    const cid = hand[selectedHandIndex];
    const def = cardDefs?.[cid];
    if (!def || isSupportCard(def)) return;

    if (!inSummonAreaForSeat(x,y,seat)) return;
    const occupied = (Array.isArray(s.units)?s.units:[]).find(u=>Number(u.hp)>0 && u.x===x && u.y===y);
    if (occupied) return;

    const myAlive = countMyAliveUnits(s.units, seat);
    if (myAlive >= MAX_UNITS_PER_PLAYER) return;

    const mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    if (mana[seat].cur < cost) return;

    s.mana = spendManaMut(mana, seat, cost);

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
      panicKillSeat: null,
      status: {},
      statuses: {}
    };

    // status/statuses を同一参照にしておく（表示安定）
    nu.statuses = nu.status;

    if (!Array.isArray(s.units)) s.units = [];
    s.units.push(nu);

    hand.splice(selectedHandIndex, 1);
    s.hands = s.hands || {A:[],B:[]};
    s.hands[seat] = hand;

    s.lastSummon = { at: nowMs(), who: seat, cardId: cid, x, y };

    logPush(s, `[${seat}] 召喚：${cardName(cid)} @(${x},${y})`);

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

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

    ensureInfilObj(s);

    const units = Array.isArray(s.units) ? s.units : [];
    const idx = units.findIndex(u => u && u.id === selectedUnitId);
    if (idx < 0) return;

    const u = units[idx];
    if (!u || u.owner !== seat) return;
    if (isPanic(u)) return;
    if (isMoveBlockedByStatus(u)) return;

    const dist = Math.abs(Number(u.x) - x) + Math.abs(Number(u.y) - y);
    if (dist !== 1) return;

    const occupied = units.find(v => Number(v.hp) > 0 && v.x === x && v.y === y);
    if (occupied) return;

    const usedNow = moveUsedThisTurn(u, s);
    if (usedNow >= 2) return;

    const mana = normalizeMana(s.mana);
    if (mana[seat].cur < 1) return;

    s.mana = spendManaMut(mana, seat, 1);

    const from = { x: u.x, y: u.y };
    u.x = x; u.y = y;

    const curSeq = Number(s.turnSeq ?? 1);
    if (Number(u.moveTurnSeq ?? 0) !== curSeq) {
      u.moveTurnSeq = curSeq;
      u.moveUsed = 0;
    }
    u.moveUsed = Math.trunc(Number(u.moveUsed ?? 0)) + 1;

    // ★修正：applyBleedOnMove は unit だけ渡す（戻り値=ダメ）
    try{
      const bd = applyBleedOnMove?.(u) ?? 0;
      if (bd) logPush(s, `[${seat}] 出血：${cardName(u.cardId)} 移動時HP-${Math.abs(Math.trunc(bd))}`);
      if (Number(u.hp) <= 0) countKillIfNeeded(u, opponentSeat, s.kills, s.log, "出血撃破");
    }catch{}

    logPush(s, `[${seat}] 移動：${cardName(u.cardId)} (${from.x},${from.y}) → (${x},${y}) (-1 mana)`);

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  render(currentState);
}

// =====================
// Attack / Support / Evolve / EndTurn / Snapshot / Render
// =====================
//
// ここ以降は「あなたが前に貼ってた v20260202 の後半」と同じ構造です。
// すでにあなたのファイルに後半があるなら、その後半に対して以下の3点だけ反映してね：
//  1) Support draw / endTurn draw を safeDrawCards() に差し替え
//  2) setStatus/delStatus を status/statuses 両方へ（表示安定）
//  3) renderBoard の owner 表示（YOU/ENEMY）
//
// ただ、あなたが「続きから」を求めてるので、後半を全部このまま貼れる形で続けます。
// （※この先がまだ貼れてない状態なら、このまま追記でOK）
//
// =====================

// ---------- 10単位丸め ----------
function round10(n){
  const v = Math.trunc(Number(n ?? 0));
  return Math.trunc(v / 10) * 10;
}

// applyPowerUpToHpDamage / applyArmorToHpDamage の吸収
function applyPowerUpToHpDamageAdapter(attacker, baseHpDmg, act){
  const d = Math.max(0, round10(baseHpDmg));
  try{
    if (typeof applyPowerUpToHpDamage !== "function") return d;
    const n = applyPowerUpToHpDamage.length;
    const r = (n >= 3) ? applyPowerUpToHpDamage(attacker, d, act)
            : (n === 2) ? applyPowerUpToHpDamage(attacker, d)
            : applyPowerUpToHpDamage(attacker);
    const rr = Number(r);
    return Number.isFinite(rr) ? Math.max(0, round10(rr)) : d;
  }catch{
    return d;
  }
}

function applyArmorToHpDamageAdapter(defender, hpDmg){
  const d = Math.max(0, round10(hpDmg));
  try{
    if (typeof applyArmorToHpDamage !== "function") return d;
    const n = applyArmorToHpDamage.length;
    const r = (n >= 2) ? applyArmorToHpDamage(defender, d)
            : applyArmorToHpDamage(defender);
    const rr = Number(r);
    return Number.isFinite(rr) ? Math.max(0, round10(rr)) : d;
  }catch{
    return d;
  }
}

// ---------- status setter（status/statuses 両対応で表示も安定） ----------
function getUnitStatusObj(u){
  if (!u) return null;

  const a = (u.status && typeof u.status === "object") ? u.status : null;
  const b = (u.statuses && typeof u.statuses === "object") ? u.statuses : null;

  // どちらも無ければ作る
  if (!a && !b){
    u.status = {};
    u.statuses = u.status;
    return u.status;
  }

  // 片方だけならもう片方へリンク
  if (a && !b){ u.statuses = a; return a; }
  if (!a && b){ u.status = b; return b; }

  // 両方あるが別オブジェクトなら統合（status を正として寄せる）
  if (a !== b){
    u.status = Object.assign({}, b, a);
    u.statuses = u.status;
    return u.status;
  }
  return a;
}

function setStatus(u, key, v=true){
  const st = getUnitStatusObj(u);
  if (!st) return;

  if (v === false || v == null){
    delete st[key];
    return;
  }
  if (typeof v === "object") st[key] = v;
  else if (v === true) st[key] = { v:true };
  else st[key] = { v: Math.trunc(Number(v)) };
}

function delStatus(u, key){
  const st = getUnitStatusObj(u);
  if (!st) return;
  delete st[key];
}

// =====================
// Attack 実行（クリック or クイック）
// =====================
function canAttackNow(st, attacker, act){
  if (!st || !attacker || !act) return { ok:false, reason:"no state/act" };
  if (!canControl(st)) return { ok:false, reason:"not your turn" };
  if (attacker.owner !== seat) return { ok:false, reason:"not yours" };
  if (isPanic(attacker)) return { ok:false, reason:"panic" };
  if (attacker.fatigue) return { ok:false, reason:"fatigue" };

  const mana = normalizeMana(st.mana);
  const cost = Math.max(0, Math.trunc(Number(act.cost ?? 0)));
  if (mana[seat].cur < cost) return { ok:false, reason:"mana" };

  return { ok:true, cost };
}

async function tryExecuteAttack(){
  const st = currentState;
  if (!st) return;
  if (mode !== "attack") return;

  const attacker = getSelectedUnit(st);
  if (!attacker || attacker.owner !== seat) return;

  ensureSelectedActionIndex(st);
  const def = cardDefs?.[attacker.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;
  if (!act) return;

  const self = isSelfRange(act.range);
  const target = self ? attacker : getSelectedTarget(st);
  if (!target) return;

  if (!self){
    const ok = inActionRange(attacker, target.x, target.y, act.range);
    if (!ok) return;

    const flags = actFlags(act);
    if (!flags.pierce){
      if (isLineBlocked(st.units, attacker, target)) return;
    }
  }

  const chk = canAttackNow(st, attacker, act);
  if (!chk.ok) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    ensureInfilObj(s);

    const units = Array.isArray(s.units) ? s.units : [];
    const aIdx = units.findIndex(u => u && u.id === attacker.id);
    if (aIdx < 0) return;

    const a = units[aIdx];
    if (!a || a.owner !== seat) return;
    if (isPanic(a) || a.fatigue) return;

    const defA = cardDefs?.[a.cardId];
    const acts = Array.isArray(defA?.actions) ? defA.actions : [];
    const act2 = acts[selectedActionIndex] || acts[0] || null;
    if (!act2) return;

    let t = null;
    if (isSelfRange(act2.range)) t = a;
    else {
      const tid = selectedTargetId;
      t = units.find(u => u && u.id === tid) || null;
      if (!t) return;
    }

    const mana = normalizeMana(s.mana);
    const cost = Math.max(0, Math.trunc(Number(act2.cost ?? 0)));
    if (mana[seat].cur < cost) return;
    s.mana = spendManaMut(mana, seat, cost);

    const rate = calcHitRateAdapter(a, act2);
    const r = 1 + Math.floor(Math.random() * 100);
    let hit = (r <= rate);

    if (hit) {
      const evaded = checkEvadeAdapter(t);
      if (evaded) hit = false;
    }

    s.lastRoll = {
      at: nowMs(),
      who: seat,
      r,
      rate,
      hit,
      actionName: String(act2.name ?? "act"),
      attackerId: a.id,
      targetId: t.id
    };

    const items = [];

    if (hit) {
      const { hpDelta, spDelta } = getActDeltas(act2);

      if (hpDelta < 0) {
        let dmg = Math.abs(hpDelta);
        dmg = applyPowerUpToHpDamageAdapter(a, dmg, act2);
        dmg = applyArmorToHpDamageAdapter(t, dmg);
        dmg = Math.max(0, round10(dmg));

        if (dmg > 0) {
          t.hp = round10(Number(t.hp ?? 0) - dmg);
          items.push({ kind:"HP", delta:-dmg });
        }
      }

      if (spDelta < 0) {
        const dmg = Math.max(0, Math.abs(round10(spDelta)));
        if (dmg > 0) {
          t.sp = round10(Number(t.sp ?? 0) - dmg);
          items.push({ kind:"SP", delta:-dmg });
        }
      }

      if (hpDelta > 0) {
        const heal = Math.max(0, round10(hpDelta));
        if (heal > 0) {
          t.hp = round10(Number(t.hp ?? 0) + heal);
          items.push({ kind:"HP", delta:+heal });
        }
      }

      if (spDelta > 0) {
        const heal = Math.max(0, round10(spDelta));
        if (heal > 0) {
          t.sp = round10(Number(t.sp ?? 0) + heal);
          items.push({ kind:"SP", delta:+heal });
        }
      }

      const adds = applyStatusesOnHitAdapter(t, act2) || [];
      if (Array.isArray(adds) && adds.length){
        for (const k of adds){
          const kk = String(k||"").trim();
          if (!kk) continue;

          const tags = tagMapFromAny(act2?.tags);
          const v = Number(tags?.[kk]?.v ?? tags?.[kk] ?? null);

          if (kk === "aim") setStatus(t, "aim", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "jinx") setStatus(t, "jinx", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "powerUp" || kk === "power") setStatus(t, "powerUp", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "armor") setStatus(t, "armor", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "bleed") setStatus(t, "bleed", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "smell") setStatus(t, "smell", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "fracture") setStatus(t, "fracture", true);
          else if (kk === "lostSoul") setStatus(t, "lostSoul", true);
          else if (kk === "blind") setStatus(t, "blind", true);
          else if (kk === "evade") setStatus(t, "evade", Math.trunc(Number.isFinite(v)?v:10));
          else if (kk === "combo") setStatus(t, "combo", true);
          else if (kk === "followUp") setStatus(t, "followUp", true);
          else setStatus(t, kk, true);
        }
      }

      if (Number(t.sp) <= 0 && Number(t.hp) > 0) {
        setPanicAndCountIfNeeded(t, seat, s.kills, s.log, "パニック撃破");
      }

      if (Number(t.hp) <= 0) {
        countKillIfNeeded(t, seat, s.kills, s.log, "撃破");
      }

      normalizePanicForAll(units, s.kills, s.log);

      a.fatigue = true;

      logPush(s, `[${seat}] 行動：${cardName(a.cardId)} → ${cardName(t.cardId)} / ${String(act2.name ?? "act")} ✅`);
    } else {
      logPush(s, `[${seat}] 行動：${cardName(a.cardId)} → ${cardName(t.cardId)} / ${String(act2.name ?? "act")} ❌`);
      a.fatigue = true;
    }

    s.lastHit = {
      at: nowMs(),
      attackerId: a.id,
      targetId: t.id,
      items
    };

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  render(currentState);
}

// =====================
// Support（drawを safeDrawCards に変更済み）
// =====================
async function tryExecuteSupportOnClickUnitOrCell(x,y){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;
  if (mode !== "support") return;

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (selectedHandIndex == null || selectedHandIndex < 0 || selectedHandIndex >= hand.length) return;

  const cid = hand[selectedHandIndex];
  const def = cardDefs?.[cid];
  if (!def || !isSupportCard(def)) return;

  const plan = supportPlan(def);
  const u = unitAt(st,x,y);

  if (plan.need === "unit") {
    if (!u) return;
    supportTarget1Id = u.id;
    await executeSupportNow();
    return;
  }
  if (plan.need === "unit2") {
    if (!u) return;
    if (!supportTarget1Id) {
      supportTarget1Id = u.id;
      render(st);
      return;
    }
    if (supportTarget1Id === u.id) return;
    supportTarget2Id = u.id;
    await executeSupportNow();
    return;
  }
  if (plan.need === "unitCell") {
    if (u && !supportTarget1Id) {
      supportTarget1Id = u.id;
      render(st);
      return;
    }
    if (!supportTarget1Id) return;
    supportTargetCell = {x,y};
    await executeSupportNow();
    return;
  }

  await executeSupportNow();
}

function pickEffectFromSupportDef(effectDef){
  if (!effectDef) return { rate:100, eff:null, label:"100%" };

  if (Array.isArray(effectDef.table) && effectDef.table.length){
    const r = 1 + Math.floor(Math.random()*100);
    let acc = 0;
    for (const row of effectDef.table){
      const rr = Math.max(0, Math.trunc(Number(row?.rate ?? row?.p ?? 0)));
      acc += rr;
      if (r <= acc){
        const e = row?.effect ?? null;
        return { rate: rr, eff: e, label:`table(${r})` };
      }
    }
    const last = effectDef.table[effectDef.table.length-1];
    return { rate: Math.max(0, Math.trunc(Number(last?.rate ?? 0))), eff:last?.effect ?? null, label:"table(last)" };
  }

  const rate = Math.max(0, Math.min(100, Math.trunc(Number(effectDef.rate ?? 100))));
  return { rate, eff: effectDef, label:`${rate}%` };
}

function supportRoll(rate){
  const r = 1 + Math.floor(Math.random()*100);
  return { r, ok: (r <= rate) };
}

function removeSupportCardFromHand(s){
  const hand = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
  if (selectedHandIndex == null || selectedHandIndex < 0 || selectedHandIndex >= hand.length) return null;
  const cid = hand[selectedHandIndex];
  hand.splice(selectedHandIndex, 1);
  s.hands = s.hands || {A:[],B:[]};
  s.hands[seat] = hand;
  selectedHandIndex = null;
  return cid;
}

async function executeSupportNow(){
  const st = currentState;
  if (!st) return;

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (selectedHandIndex == null || selectedHandIndex < 0 || selectedHandIndex >= hand.length) return;

  const cardId = hand[selectedHandIndex];
  const def = cardDefs?.[cardId];
  if (!def || !isSupportCard(def)) return;

  const mana = normalizeMana(st.mana);
  const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
  if (mana[seat].cur < cost) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    ensureInfilObj(s);

    const mana2 = normalizeMana(s.mana);
    if (mana2[seat].cur < cost) return;
    s.mana = spendManaMut(mana2, seat, cost);

    const units = Array.isArray(s.units) ? s.units : [];
    const t1 = supportTarget1Id ? (units.find(u=>u && u.id===supportTarget1Id) || null) : null;
    const t2 = supportTarget2Id ? (units.find(u=>u && u.id===supportTarget2Id) || null) : null;
    const cell = supportTargetCell ? {x:supportTargetCell.x, y:supportTargetCell.y} : null;

    const picked = pickEffectFromSupportDef(def.effect);
    const rate = Math.max(0, Math.min(100, Math.trunc(Number(picked.rate ?? 100))));
    const roll = supportRoll(rate);

    s.lastSupportRoll = {
      at: nowMs(),
      who: seat,
      r: roll.r,
      ok: roll.ok,
      label: picked.label,
      cardId: cardId,
      cardName: cardName(cardId)
    };

    const consumedCardId = removeSupportCardFromHand(s);
    if (!consumedCardId) return;

    const eff = picked.eff;
    const t = (eff && typeof eff.type === "string") ? eff.type : null;

    if (!roll.ok || !t){
      logPush(s, `[${seat}] Support失敗：${cardName(consumedCardId)} (${roll.r}/${rate}%)`);
      resetSupportPicks();
      tx.set(stateRef, s);
      return;
    }

    const logLines = [];

    // まず support_core があれば優先で試す（既存機能維持）
    let handledByCore = false;
    try{
      if (typeof resolveSupportEffect === "function"){
        const n = resolveSupportEffect.length;
        let res;
        if (n >= 5) res = resolveSupportEffect(s, seat, eff, { t1, t2, cell }, cardDefs);
        else if (n >= 4) res = resolveSupportEffect(s, seat, eff, { t1, t2, cell });
        else if (n >= 3) res = resolveSupportEffect(s, seat, eff);
        if (res && typeof res === "object") {
          handledByCore = !!res.ok || !!res.handled;
        }
      } else if (typeof applySupport === "function"){
        const n = applySupport.length;
        if (n >= 6) handledByCore = !!applySupport(s, seat, consumedCardId, eff, { t1, t2, cell }, cardDefs);
        else if (n >= 5) handledByCore = !!applySupport(s, seat, consumedCardId, eff, { t1, t2, cell });
        else if (n >= 4) handledByCore = !!applySupport(s, seat, consumedCardId, eff);
      }
    }catch{
      handledByCore = false;
    }

    // coreで処理されていなければ、このファイル側の既存switchで処理
    if (!handledByCore){
      const applyHeal = (u, hp, sp)=>{
        if (!u) return;
        if (Number.isFinite(hp) && hp) u.hp = round10(Number(u.hp ?? 0) + round10(hp));
        if (Number.isFinite(sp) && sp) u.sp = round10(Number(u.sp ?? 0) + round10(sp));
        reviveFromPanicIfHealed(u, s.kills, logLines);
      };
      const applyDmg = (u, hp, sp)=>{
        if (!u) return;
        if (Number.isFinite(hp) && hp) u.hp = round10(Number(u.hp ?? 0) - Math.max(0, round10(hp)));
        if (Number.isFinite(sp) && sp) u.sp = round10(Number(u.sp ?? 0) - Math.max(0, round10(sp)));

        if (Number(u.sp) <= 0 && Number(u.hp) > 0) setPanicAndCountIfNeeded(u, seat, s.kills, logLines, "パニック撃破");
        if (Number(u.hp) <= 0) countKillIfNeeded(u, seat, s.kills, logLines, "撃破");
      };

      if (t === "draw"){
        const n = Math.max(0, Math.trunc(Number(eff.n ?? eff.draw ?? 1)));
        safeDrawCards(s, seat, n);
        logLines.push(`[${seat}] Support：ドロー +${n}`);
      }
      else if (t === "heal"){
        const hp = Math.trunc(Number(eff.hp ?? eff.heal ?? 0));
        const sp = Math.trunc(Number(eff.sp ?? 0));
        applyHeal(t1, hp, sp);
        logLines.push(`[${seat}] Support：回復 ${cardName(t1?.cardId)} HP+${round10(hp)} SP+${round10(sp)}`);
      }
      else if (t === "dmg"){
        const dmg = Math.trunc(Number(eff.hp ?? eff.dmg ?? eff.damage ?? 0));
        const dmgType = String(eff.dmgType ?? eff.damageType ?? "HP").toUpperCase();
        if (dmgType === "SP") {
          applyDmg(t1, 0, dmg);
          logLines.push(`[${seat}] Support：SPダメ ${cardName(t1?.cardId)} SP-${round10(dmg)}`);
        } else {
          applyDmg(t1, dmg, 0);
          logLines.push(`[${seat}] Support：HPダメ ${cardName(t1?.cardId)} HP-${round10(dmg)}`);
        }
      }
      else if (t === "modRate"){
        const delta = Math.trunc(Number(eff.delta ?? 0));
        if (delta >= 0) setStatus(t1, "aim", delta);
        else setStatus(t1, "jinx", Math.abs(delta));
        logLines.push(`[${seat}] Support：命中 ${delta>=0?"+":"-"}${Math.abs(delta)}% → ${cardName(t1?.cardId)}`);
      }
      else if (t === "powerUp"){
        const v = Math.trunc(Number(eff.delta ?? eff.power ?? 10));
        setStatus(t1, "powerUp", v);
        logLines.push(`[${seat}] Support：威力+${v} → ${cardName(t1?.cardId)}`);
      }
      else if (t === "cleanse"){
        if (t1){
          for (const k of ["bleed","fracture","smell","lostSoul","blind","jinx"]) delStatus(t1, k);
        }
        logLines.push(`[${seat}] Support：浄化 → ${cardName(t1?.cardId)}`);
      }
      else if (t === "recoverFatigue" || t === "fatigueHeal" || t === "fatigueClear"){
        if (t1) t1.fatigue = false;
        logLines.push(`[${seat}] Support：疲労回復 → ${cardName(t1?.cardId)}`);
      }
      else if (t === "recoverMove" || t === "moveReset" || t === "refreshMove"){
        if (t1){
          const curSeq = Number(s.turnSeq ?? 1);
          t1.moveTurnSeq = curSeq;
          t1.moveUsed = 0;
        }
        logLines.push(`[${seat}] Support：移動回復（2マス） → ${cardName(t1?.cardId)}`);
      }
      else if (t === "swapPos"){
        if (t1 && t2){
          const ax=t1.x, ay=t1.y;
          t1.x=t2.x; t1.y=t2.y;
          t2.x=ax;   t2.y=ay;
          logLines.push(`[${seat}] Support：位置交換 ${cardName(t1.cardId)} ⇄ ${cardName(t2.cardId)}`);
        }
      }
      else if (t === "moveTo"){
        if (t1 && cell){
          const occ = units.find(v => Number(v.hp)>0 && v.x===cell.x && v.y===cell.y);
          if (!occ){
            t1.x = cell.x; t1.y = cell.y;
            logLines.push(`[${seat}] Support：移動 ${cardName(t1.cardId)} → (${cell.x},${cell.y})`);
          }
        }
      }
      else if (t === "bounce"){
        if (t1){
          t1.hp = 0;
          logLines.push(`[${seat}] Support：バウンス（簡易） ${cardName(t1.cardId)}`);
        }
      }
      else {
        logLines.push(`[${seat}] Support：未実装効果 type=${t}（とりあえず成功扱い）`);
      }
    }

    for (const ln of logLines) logPush(s, ln);

    resetSupportPicks();

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  render(currentState);
}

// =====================
// Evolve（fromCardId保持 & ログ修正）
// =====================
async function tryExecuteEvolve(handIdx){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;
  if (mode !== "evolve") return;
  if (!evoBaseId) return;

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  if (handIdx == null || handIdx < 0 || handIdx >= hand.length) return;

  const evoCardId = hand[handIdx];
  const evoDef = cardDefs?.[evoCardId];
  if (!evoDef || isSupportCard(evoDef)) return;

  const baseUnit = (st.units || []).find(u => u && u.id === evoBaseId) || null;
  if (!baseUnit || baseUnit.owner !== seat) return;

  const baseDef = cardDefs?.[baseUnit.cardId];
  if (!baseDef) return;

  if (String(evoDef.type) !== String(baseDef.type)) return;
  if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

  const extra = Math.max(0, Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)));
  const mana = normalizeMana(st.mana);
  if (mana[seat].cur < extra) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    ensureInfilObj(s);

    const units = Array.isArray(s.units) ? s.units : [];
    const u = units.find(v => v && v.id === evoBaseId) || null;
    if (!u || u.owner !== seat) return;

    const fromCardId = u.cardId;

    const baseDef2 = cardDefs?.[fromCardId];
    const evoDef2  = cardDefs?.[evoCardId];
    if (!baseDef2 || !evoDef2) return;

    if (String(evoDef2.type) !== String(baseDef2.type)) return;
    if (!(Number(evoDef2.cost) > Number(baseDef2.cost))) return;

    const extra2 = Math.max(0, Math.trunc(Number(evoDef2.cost) - Number(baseDef2.cost)));
    const mana2 = normalizeMana(s.mana);
    if (mana2[seat].cur < extra2) return;

    s.mana = spendManaMut(mana2, seat, extra2);

    const h = Array.isArray(s?.hands?.[seat]) ? s.hands[seat] : [];
    if (handIdx < 0 || handIdx >= h.length) return;
    const cid = h[handIdx];
    if (cid !== evoCardId) {
      const j = h.findIndex(z=>z===evoCardId);
      if (j < 0) return;
      h.splice(j,1);
    } else {
      h.splice(handIdx,1);
    }
    s.hands = s.hands || {A:[],B:[]};
    s.hands[seat] = h;

    u.cardId = evoCardId;
    u.hp = round10(Number(evoDef2.hp ?? u.hp ?? 0));
    u.sp = round10(Number(evoDef2.sp ?? u.sp ?? 0));

    s.lastEvolve = { at: nowMs(), who: seat, fromCardId, toCardId: evoCardId, unitId: u.id };

    logPush(s, `[${seat}] 進化：${cardName(fromCardId)} → ${cardName(evoCardId)} (-${extra2} mana)`);

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });

  evoCandidates = new Set();
  selectedHandIndex = null;
  render(currentState);
}

btnDoEvolve && (btnDoEvolve.onclick = ()=>{
  if (!currentState) return;
  setMode("evolve");
});

// =====================
// ターン終了（ドローは safeDrawCards）
// =====================
function clearFatigueForSeat(units, who){
  const arr = Array.isArray(units) ? units : [];
  for (const u of arr){
    if (!u) continue;
    if (normSeat(u.owner) !== who) continue;
    u.fatigue = false;
  }
}

function applySmellOnTurnEndAdapter(s){
  try{
    if (typeof applySmellOnTurnEnd !== "function") return;
    const n = applySmellOnTurnEnd.length;
    if (n >= 2) applySmellOnTurnEnd(s.units, s.turn);
    else if (n === 1) applySmellOnTurnEnd(s.units);
    else applySmellOnTurnEnd();
  }catch{}
}

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
    if (!cur) return;

    const infil = ensureInfilObj(s);

    const add = calcInfilAddAtTurnEnd(s, cur);
    if (add > 0){
      infil[cur] = Math.trunc(Number(infil[cur] ?? 0)) + add;
      logPush(s, `[${cur}] 侵入 +${add} → infil ${formatInfilText(infil)}`);
    }

    applySmellOnTurnEndAdapter(s);

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    if (s.winner){
      tx.set(stateRef, s);
      return;
    }

    const next = (cur === "A") ? "B" : "A";
    s.turn = next;
    s.turnSeq = Math.trunc(Number(s.turnSeq ?? 1)) + 1;

    s.mana = gainManaPlus2OnReceiveTurn(s.mana, next);

    clearFatigueForSeat(s.units, next);

    // ★ドロー（確実に増やす）
    const n = Math.max(0, Math.trunc(Number(DRAW_PER_TURN ?? 1)));
    safeDrawCards(s, next, n);

    logPush(s, `--- ${next}ターン ---`);

    tx.set(stateRef, s);
  });
}

// =====================
// EX（使えるなら1回だけ）
// =====================
async function tryUseEx(){
  const st = currentState;
  if (!st) return;
  if (!canControl(st)) return;

  const exId = st?.ex?.[seat] ?? null;
  if (!exId) return;
  if (st?.exUsed?.[seat]) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (!canControl(s)) return;

    s.ex = s.ex || {A:null,B:null};
    s.exUsed = s.exUsed || {A:false,B:false};

    const exCardId = s.ex[seat];
    if (!exCardId) return;
    if (s.exUsed[seat]) return;

    // 既存コアがあるならそっちに投げる（安全吸収）
    let ok = false;
    try{
      if (typeof applyExSupport === "function"){
        const L = applyExSupport.length;
        if (L >= 4) ok = !!applyExSupport(s, seat, exCardId, cardDefs);
        else if (L === 3) ok = !!applyExSupport(s, seat, exCardId);
        else ok = !!applyExSupport(s, seat);
      } else if (typeof applySupport === "function"){
        // fallback: Support扱いで適用を試す
        ok = !!applySupport(s, seat, exCardId, cardDefs);
      }
    }catch{
      ok = false;
    }

    // 少なくとも「使用済み」にはする（既存仕様維持）
    s.exUsed[seat] = true;
    logPush(s, `[${seat}] EX使用：${cardName(exCardId)} ${ok ? "✅" : ""}`);

    try{
      const w = checkWinLocal(s);
      if (w) s.winner = w;
    }catch{}

    tx.set(stateRef, s);
  });
}

exBtnEl && exBtnEl.addEventListener("click", ()=>{ tryUseEx(); });

// =====================
// セルクリック（モード別）
// =====================
async function onCellClick(x,y){
  const st = currentState;
  if (!st) return;

  // support は空マスでも拾う（moveTo用）
  if (mode === "support") {
    await tryExecuteSupportOnClickUnitOrCell(x,y);
    return;
  }

  if (mode === "summon") {
    await trySummonAt(x,y);
    return;
  }

  if (mode === "move") {
    await tryMoveTo(x,y);
    return;
  }

  if (mode === "attack") {
    const u = unitAt(st, x, y);
    if (!u) return;

    // 自軍なら選択、敵ならターゲット選択→実行
    if (u.owner === seat) {
      onSelectMyUnit(u.id, st);
      return;
    } else {
      selectedTargetId = u.id;
      await tryExecuteAttack();
      return;
    }
  }

  // evolve中は cell クリックは無視（ユニットクリックでbase指定）
}

// =====================
// ログ描画
// =====================
function renderLog(st){
  if (!logEl) return;
  const lines = Array.isArray(st?.log) ? st.log : [];
  const tail = lines.slice(-120);
  let txt = tail.join("\n");

  if (nowMs() < rngMsgUntil) {
    txt += (txt ? "\n" : "") + "🎲 乱数調整（演出のみ）";
  }

  logEl.textContent = txt;
  // スクロール追従
  try{ logEl.scrollTop = logEl.scrollHeight; }catch{}
}

// =====================
// 勝者表示
// =====================
function renderWinner(st){
  if (!st?.winner) return;
  const w = normSeat(st.winner) || st.winner;
  if (modeHintEl) modeHintEl.textContent = `🏁 勝者：${w}`;
}

// =====================
// 全体render
// =====================
function render(st){
  if (!st) return;

  // safety補完（途中参加でも落ちない）
  if (!st.kills || typeof st.kills !== "object") st.kills = {A:0,B:0};
  ensureInfilObj(st);
  if (!st.ex) st.ex = {A:null,B:null};
  if (!st.exUsed) st.exUsed = {A:false,B:false};
  if (!Array.isArray(st.units)) st.units = [];
  if (!st.hands) st.hands = {A:[],B:[]};
  if (!st.decks) st.decks = {A:[],B:[]};

  setTurnUI(st);
  renderBoard(st);
  renderHand(st);
  renderActionPicker(st);
  updateQuickActions(st);
  renderLog(st);
  renderWinner(st);
  fxOnHit(st);

  // settings / rng ボタン
  ensureRngButton();
  ensureSettingsButton();
}

// =====================
// Firestore snapshot
// =====================
onSnapshot(stateRef, (snap)=>{
  if (!snap.exists()) return;

  const st = snap.data() || {};

  // 表示上落ちないようにローカル補完（DB書き換えはしない）
  if (!st.kills || typeof st.kills !== "object") st.kills = {A:0,B:0};
  ensureInfilObj(st);
  if (!st.ex) st.ex = {A:null,B:null};
  if (!st.exUsed) st.exUsed = {A:false,B:false};
  if (!Array.isArray(st.units)) st.units = [];
  if (!st.hands) st.hands = {A:[],B:[]};
  if (!st.decks) st.decks = {A:[],B:[]};
  if (!Array.isArray(st.log)) st.log = [];

  currentState = st;

  const ts = Number(st.turnSeq ?? 0);
  const t = String(st.turn ?? "");

  if (lastSeenTurnSeq !== null && ts !== lastSeenTurnSeq) {
    flashTurnBanner();
  } else if (lastSeenTurn && t && t !== lastSeenTurn) {
    flashTurnBanner();
  }
  lastSeenTurnSeq = ts;
  lastSeenTurn = t;

  render(currentState);
}, (err)=>{
  console.error("[onSnapshot] error", err);
});

// =====================
// 初期イベント
// =====================
btnEnd && (btnEnd.onclick = ()=> endTurn());

// 初期描画
ensureBoardGrid();
render({ turn:"A sees", mana:{A:{cur:0,max:0},B:{cur:0,max:0}}, decks:{A:[],B:[]}, hands:{A:[],B:[]}, units:[], kills:{A:0,B:0}, infil:{A:0,B:0}, log:[] }); 