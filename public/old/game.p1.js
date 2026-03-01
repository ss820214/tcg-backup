// public/game.js
// v20260202_full_repair_no_feature_drop_plus_infil_fix_plus_draw_fix_owner_buff_icons
//
// - 未定義で落ちる箇所を修復（infil / win判定 / evolveログなど）
// - ✅ ドローが増えない問題を完全修正：safeDrawCards() を導入して endTurn / Support(draw) を強制成功
// - ✅ バフ/デバフのアイコン表示を強化：status/statuses 両対応 + 表示安定化
// - ✅ 所有者表示をわかりやすく：OWNER表示を「YOU/ENEMY + 色リボン」
// - ✅ 攻撃：対象選択→「行動実行」ボタンで確定（即実行しない）
// - ✅ サポート：対象選択→「サポート実行」ボタンで確定（moveTo等を分かりやすく）
// - ✅ パニック：盤面表示に😱PANICを出す
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
    .apFooter{ margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }

    .apPanel{
      margin-top: 10px;
      padding: 10px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.16);
    }
    .apPanel .row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
    .apPanel .small{ font-size:12px; opacity:.86; }
    .apPanel .title{ font-weight:900; }
    .apPanel .pill{
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.14);
      font-size: 11px;
      font-weight: 900;
      opacity: .95;
    }
    .apPanel .hint{
      margin-top: 8px;
      font-size: 12px;
      opacity: .92;
      line-height: 1.35;
      white-space: pre-wrap;
    }
    .btnExec{
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.22);
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
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.18);
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

    .panicBadge{
      position:absolute;
      right:8px;
      top:8px;
      padding:3px 7px;
      border-radius:999px;
      font-size:10px;
      font-weight:900;
      letter-spacing:.12em;
      border:1px solid rgba(255,120,120,.35);
      background: rgba(255,120,120,.14);
      color:#fff;
      pointer-events:none;
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

// ★追加：Support選択状態の「準備OK」判定
function supportReadyByPlan(plan){
  const need = plan?.need || "none";
  if (need === "none") return true;
  if (need === "unit") return !!supportTarget1Id;
  if (need === "unit2") return !!supportTarget1Id && !!supportTarget2Id && supportTarget1Id !== supportTarget2Id;
  if (need === "unitCell") return !!supportTarget1Id && !!supportTargetCell;
  return false;
}

// ★追加：Support 操作ヒント文字列
function supportHintText(st){
  const def = selectedHandDef(st);
  if (!def || !isSupportCard(def)) return "サポート：手札のサポカを選択してね";
  const plan = supportPlan(def);

  const parts = [];
  parts.push(`選択中：${cardName(selectedHandCardId(st))}`);
  parts.push(`効果：${supportEffectSummary(def)}`);

  if (plan.need === "unit"){
    parts.push(`手順：対象ユニットをクリック → 「サポート実行」`);
    parts.push(`対象：${supportTarget1Id ? "✅選択済" : "未選択"}`);
  }else if (plan.need === "unit2"){
    parts.push(`手順：ユニット①クリック → ユニット②クリック → 「サポート実行」`);
    parts.push(`①:${supportTarget1Id ? "✅" : "未"} ②:${supportTarget2Id ? "✅" : "未"}`);
  }else if (plan.need === "unitCell"){
    parts.push(`手順：移動させるユニットをクリック → 移動先マスをクリック → 「サポート実行」`);
    parts.push(`ユニット:${supportTarget1Id ? "✅" : "未"} マス:${supportTargetCell ? `✅(${supportTargetCell.x},${supportTargetCell.y})` : "未"}`);
  }else{
    parts.push(`手順：「サポート実行」で発動`);
  }

  return parts.join("\n");
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

// ===== module exports for splitting =====
export {
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
};
