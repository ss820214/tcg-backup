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

let didGoVictory = false;

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

import { createEvolveSystem } from "./evolve_system.js?v=20260204a";

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
          .hcEvoBtn{
      position:absolute;
      right:10px;
      top:10px;
      font-size:12px;
      padding:7px 10px;
      border-radius:12px;
      border:1px solid rgba(120,255,170,.35);
      background: rgba(120,255,170,.14);
      color:#fff;
      font-weight: 950;
      cursor:pointer;
      box-shadow: 0 0 0 2px rgba(0,0,0,.10) inset;
    }
    .hcEvoBtn:hover{
      background: rgba(120,255,170,.20);
      border-color: rgba(120,255,170,.55);
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
// Evolve system (separated)
// =====================
const evolveSys = createEvolveSystem({
  db,
  stateRef,
  getSeat: ()=> seat,
  canControl,
  normalizeMana,
  spendManaMut,
  nowMs,
  round10,
  clampUnitStats10,
  cardDefsRef: ()=> cardDefs,
  cardName,
  logPush,
  checkWinLocal,
  isPanic
});

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

const killsA = Math.trunc(Number(s?.kills?.A ?? 0) || 0);
const killsB = Math.trunc(Number(s?.kills?.B ?? 0) || 0);
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

// ✅ drawCardsが1枚だけ引く実装でも、指定枚数になるまで補填する
const drawn = afterH - beforeH;
const need = Math.max(0, cnt - (Number.isFinite(drawn) ? drawn : 0));

if (need > 0) {
  const dk = Array.isArray(s.decks[who]) ? s.decks[who] : [];
  const hd = Array.isArray(s.hands[who]) ? s.hands[who] : [];
  for (let i=0;i<need;i++){
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

function setMode(m){
  mode = m;

  if (m !== "support") resetSupportPicks();

  // ✅ 進化の選択状態はモード変更のたびに安全にリセット
  try { evolveSys.reset(); } catch (e) {}

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
  return arr.filter(u => u && u.hp > 0 && !u.panic && u.owner === owner).length;
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
    
        // 進化候補なら「進化」ボタンを追加（別JS）
    evolveSys.decorateHandCard({
      cardEl: card,
      index: i,
      cardId: cid,
      st,
      onShowDetail: (id)=> showCardDetail(id)
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

  // ✅ table抽選と成功判定は独立ロール
const tableRoll = Math.floor(Math.random() * 100) + 1;
const hitRoll   = Math.floor(Math.random() * 100) + 1;

// table があるなら内容決定
const eff = pickEffectByTable(eff0, tableRoll);
const type = String(eff?.type ?? "").trim();

// rate（drawは強制成功）
const rate = Math.max(0, Math.min(100, Math.trunc(Number(eff?.rate ?? eff0?.rate ?? 100))));
const alwaysOk = supportAlwaysSuccessForDraw(eff);
const hit = alwaysOk ? true : (hitRoll <= rate);

// 表示用（tableRoll/hitRoll 両方残す）
const label =
  `tbl:${tableRoll} / hit:${hitRoll} / ` + (alwaysOk ? "DRAW(強制)" : `${rate}%`);
  if (!hit) return { ok:false, label, eff, hitRoll, tableRoll };

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

  return { ok:true, label, eff, hitRoll, tableRoll };
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
let metaRoll = null; // ✅ 実際に使った判定rollを入れる

try{
  if (typeof applySupport === "function"){
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

    if (ret && typeof ret === "object"){
      if (ret.state && typeof ret.state === "object") {
        const ns = ret.state;
        for (const k of Object.keys(ns)) s[k] = ns[k];
      }
      if (ret.ok != null) ok = !!ret.ok;
      if (ret.label) label = String(ret.label);
      // core側が roll を返す設計なら拾える（無ければnullのまま）
      const rr = Number(ret?.roll ?? ret?.r ?? null);
      if (Number.isFinite(rr)) metaRoll = Math.trunc(rr);
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

  // ✅ fallback が返した実際のrollを拾う（hitRoll優先）
  const hr = Number(r?.hitRoll);
  const tr = Number(r?.tableRoll);
  if (Number.isFinite(hr)) metaRoll = Math.trunc(hr);
  else if (Number.isFinite(tr)) metaRoll = Math.trunc(tr);
  else metaRoll = null;
}

s.lastSupportRoll = {
  at: nowMs(),
  r: metaRoll ?? Math.floor(Math.random()*100)+1, // ✅ 実判定rollがあればそれを表示
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

  // evolve: ベース選択（別JS）
  if (mode === "evolve" && canControl(st) && u.owner === seat && !isPanic(u) && Number(u.hp) > 0){
    evolveSys.onPickBaseUnit(u, st);
    render(st);
    return;
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
btnDoEvolve && btnDoEvolve.addEventListener("click", async ()=>{
  const st = currentState;
  if (!st) return;
  if (selectedHandIndex == null) return;
  if (!evolveSys.canExec(st, selectedHandIndex)) return;
  await evolveSys.execEvolveFromHandIndex(selectedHandIndex);
});

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

    // =====================
  // ✅ 勝敗確定で victory.html へ遷移（1回だけ）
  // =====================
  try{
    const w = normSeat(st?.winner);
    if (!didGoVictory && w && roomId && playerId && seat){
      didGoVictory = true;

      // infil は state の infil を優先（無ければ 0）
      const inf = ensureInfilObj(st);

      const ka = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
      const kb = Math.trunc(Number(st?.kills?.B ?? 0) || 0);

      const qs = new URLSearchParams();
      qs.set("room", roomId);
      qs.set("player", playerId);
      qs.set("seat", seat);      // 自分(A/B)
      qs.set("winner", w);       // 勝者(A/B)

      qs.set("turnSeq", String(Math.trunc(Number(st?.turnSeq ?? 0) || 0)));
      qs.set("killsA", String(ka));
      qs.set("killsB", String(kb));
      qs.set("infilA", String(Math.trunc(Number(inf?.A ?? 0) || 0)));
      qs.set("infilB", String(Math.trunc(Number(inf?.B ?? 0) || 0)));

      // もし理由も出したいなら（任意）
      // qs.set("reason", w === "A" ? "Aが勝利条件達成" : "Bが勝利条件達成");

      location.href = `victory.html?${qs.toString()}`;
      return; // 遷移するので以降の render は不要
    }
  }catch(e){
    console.warn("[victory redirect] failed", e);
  }

  render(st);
}, (err)=>{
  console.error("[onSnapshot] error", err);
  if (logEl) logEl.textContent = String(err?.message ?? err);
});