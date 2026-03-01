// public/game.js
// v20260131_v2.1.1_full_fix_powerup_refresh
// - powerUp を「%」ではなく「固定値(+10など)」として扱う
// - 疲労回復 / 移動回数(2マス)回復 のサポート(=addStatus)を game.js 側でも拾えるように
// - calcHitRateWithStatus / checkEvade / applyStatusesOnHit の呼び出し署名を現行 game_state.js に合わせて修正
// - 既存機能は削らない（UI/EX/Support/FX/Range 等は維持）

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
  startTurnMana,
  spendMana,
  getManaConsts
} from "./game_core.js?v=20260126g";

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

  // parse helpers (v1.7.x)
  parseAddStatus,
  parseTags,
} from "./game_state.js?v=20260131_v1_7_2"; // ← game_state の更新版を使う想定

import { isInRange } from "./game_range.js?v=20260126g";
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
  projectId: "tcg-0bato",
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

  // logの直前に差し込む（近くに出す）
  const parent = logEl.parentNode;
  if (parent) parent.insertBefore(btn, logEl);

  btn.addEventListener("click", ()=>{
    rngMsgUntil = nowMs() + 2200;
    // 見た目だけのログ表示（stateには触らない）
    render(currentState);
  });

  return btn;
}

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

// Optional Settings button auto-mount (if settings.js exists)
function ensureSettingsButton(){
  if (!initSettings) return null;
  let btn = document.getElementById("btnSettings");
  if (btn) return btn;

  // create a small button in left pane header area
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

  // insert near controls top
  const controls = left.querySelector(".controls");
  if (controls && controls.parentNode) controls.parentNode.insertBefore(btn, controls);
  else left.appendChild(btn);

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

  // ===== バフ/デバフ（数値付き）=====
  if (has("aim","命中")) out.push(`命中+${getVal("aim",10)}%`);
  if (has("jinx","不運","命中低下")) out.push(`命中-${getVal("jinx",10)}%`);

  // powerUp（固定値）
  if (has("powerUp")) out.push(`威力+${getVal("powerUp",10)}`);
  // 互換：power が来たら powerUp として表示
  if (has("power") && !has("powerUp")) out.push(`威力+${getVal("power",10)}`);

  if (has("armor","装甲")) out.push(`装甲+${getVal("armor",10)}`);

  // ===== 状態異常系（必要なら数値も）=====
  if (has("bleed","出血")) out.push(`出血付与(${getVal("bleed",10)})`);
  if (has("fracture","骨折")) out.push(`骨折（移動不可）`);
  if (has("smell","におい")) out.push(`におい付与(${getVal("smell",10)})`);
  if (has("lostSoul","ロストソウル")) out.push(`ロストソウル`);
  if (has("blind","盲目")) out.push(`盲目`);
  if (has("evade","回避")) out.push(`回避+${getVal("evade",10)}`);
  if (has("combo","コンボ")) out.push(`コンボ`);
  if (has("followUp","追撃")) out.push(`追撃`);

  // ===== 即時回復（状態として残さない）=====
  if (has("recoverFatigue","疲労回復","fatigueHeal","fatigueClear")) out.push(`疲労回復`);
  if (has("recoverMove","moveReset","refreshMove","移動回復","移動制限回復","移動回数回復")) out.push(`移動回復（2マス）`);

  return out;
}

// addStatusは「状態異常だけ」表示（攻撃属性は隠す）
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
  // Aは上(↑)が前、Bは下(↓)が前
  return (forwardDy(owner) === -1) ? "↑" : "↓";
}
function arrowByBack(owner){
  return (forwardDy(owner) === -1) ? "↓" : "↑";
}

function rangeTokenToArrow(tok, owner){
  const t = String(tok||"").trim();
  if (!t) return "";

  // 隣接（上下左右）
  if (t.toLowerCase() === "adj4") return "＋1";

  const m = t.match(/^(front|back|side|rf|lf|f)(\d+)$/i);
  if (!m) return t;

  const kind = m[1].toLowerCase();
  const n = Math.max(1, Math.trunc(Number(m[2] || 1)));

  const f = arrowByForward(owner);
  const b = arrowByBack(owner);

  // 斜めは向きで変わる（A=↗↖ / B=↘↙）
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
  // 数値レンジ（マンハッタン距離）＝「距離n」
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

// 射程ラベルに「全」「貫」を付ける（例：↑2全 / ↑3貫 / ↑2全貫）
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
      if (typeof s.turnSeq !== "number") tx.set(stateRef, { turnSeq: 1 }, { merge:true });
      if (s.lastSupportRoll === undefined) tx.set(stateRef, { lastSupportRoll: null }, { merge:true });

      // EX fields補完
      if (!s.ex) tx.set(stateRef, { ex: {A:null, B:null} }, { merge:true });
      if (!s.exUsed) tx.set(stateRef, { exUsed: {A:false, B:false} }, { merge:true });

      // v2.0.8: summon fx field (optional)
      if (s.lastSummon === undefined) tx.set(stateRef, { lastSummon: null }, { merge:true });

      // ★追加：evolve fx field（optional）
      if (s.lastEvolve === undefined) tx.set(stateRef, { lastEvolve: null }, { merge:true });

      return;
    }

    const pA = await tx.get(playerRef(seatAPlayerId));
    const pB = await tx.get(playerRef(seatBPlayerId));
    if (!pA.exists() || !pB.exists()) throw new Error("players missing");

    const deckA_simple = pA.data().deck || {};
    const deckB_simple = pB.data().deck || {};

    // ★EX (support card 1)
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

      // v2.0.8 summon fx
      lastSummon: null,

      // ★追加：evolve fx
      lastEvolve: null,

      // ★EX
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
let mode = null; // summon/move/attack/evolve/support/null
let selectedUnitId = null;      // 自軍ユニット（攻撃者/移動者/進化元）
let selectedTargetId = null;    // ターゲット（敵/味方/自分）
let selectedHandIndex = null;
let selectedActionIndex = 0;

// support picks
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

// ===== support helpers =====
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

// support effect summary for UI
function supportEffectSummary(def){
  if (!def?.effect) return "効果なし";
  return supportEffectTextJa(def.effect);
}

// decide target plan without needing roll (max requirement)
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

  if (has("swapPos")) return { need:"unit2" };        // 2体
  if (has("moveTo")) return { need:"unitCell" };      // 対象+マス

  // ※support_core側の type が増えても、ここは「unit」扱いなら操作できるように寄せる
  if (types.some(t => [
    "dmg","heal","modRate","bounce",
    "powerUp","cleanse",
    // 追加想定
    "recoverFatigue","recoverMove","refreshMove"
  ].includes(t))) return { need:"unit" };

  return { need:"none" };
}

// ★場の数カウント
function countMyAliveUnits(units, owner){
  const arr = Array.isArray(units) ? units : [];
  return arr.filter(u => u && u.hp > 0 && u.owner === owner).length;
}

// ★不具合対策：ターン中移動使用回数は turnSeq を見て判定する
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

  // 既存（命中/不運）
  aim: "🎯",
  jinx: "🍀",

  // ★変更：power(%) → powerUp(固定+)
  powerUp: "💥",

  // 互換（古いデータが power を持ってても表示だけはする）
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

    // ★powerUp は固定値
    if (k === "powerUp") return `${icon}+${Number(v ?? 0)}`;
    // 互換 power は %っぽく入ってるかもだが、表示だけは「+値」に寄せる
    if (k === "power") return `${icon}+${Number(v ?? 0)}`;

    return (v != null && v !== true) ? `${icon}${v}` : `${icon}`;
  }).join(" ");
}

function setMode(m){
  mode = m;

  // support mode reset behavior
  if (m !== "support") resetSupportPicks();

  if (modeHintEl) {
    modeHintEl.textContent =
      m === "summon" ? "召喚：手札→フィールド（召喚エリアのみ）" :
      m === "move"   ? "移動：自軍を選択→移動先をクリック（マナ-1 / ターン中2マスまで）" :
      m === "attack" ? "行動：自軍を選択→緑枠の敵/味方をクリックで実行（攻撃後は疲労）" :
      m === "evolve" ? "進化：進化元を選択→手札候補が光る→手札選択→進化実行（疲労でも可）" :
      m === "support"? "サポート：手札のサポカを選択→指示に従って対象をクリック（失敗でも消費）" :
      "ユニット選択→🏃移動 / ⚔️行動 を選択";
  }
  render(currentState);
}

btnSummon.onclick = () => setMode("summon");
btnMove.onclick   = () => setMode("move");
btnEvolve.onclick = () => setMode("evolve");
btnSupport.onclick = () => setMode("support");
btnQuickMove?.addEventListener("click", ()=> setMode("move"));

// ★UX：quickAttack は「実行ボタン」にする（モードも attack に寄せる）
btnQuickAttack?.addEventListener("click", async ()=> {
  setMode("attack");
  await tryExecuteAttack();
});

// Attackボタンも attack モードへ
if (btnAttack) btnAttack.onclick = () => setMode("attack");

// =====================
// ★追加：撃破カウント（panicも撃破扱い）
// - countedAsKill を持たせて二重加算を防ぐ
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
    if (!was) countKillIfNeeded(target, killerSeat, kills, logLines, reason);
  }
}

// =====================
// v1.8.0: 射程ハイライト
// =====================
function buildRangeMap(st){
  const map = new Map();
  if (!st) return map;
  if (mode !== "attack") return map;

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return map;

  const def = cardDefs[su.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;
  if (!act) return map;

  const units = Array.isArray(st.units) ? st.units : [];
  const flags = actFlags(act);

  // ===== FIX: self は自分マスもハイライト =====
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
function showCardDetail(cardId){
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  let html = `<b>${cardName(cardId)}</b> <span class="small">(${cardId})</span><br>`;
  html += `属性:${d.type ?? "?"} / コスト:${d.cost ?? "?"}<br>`;
  html += `HP:${d.hp ?? "?"} SP:${d.sp ?? "?"}<br>`;
  if (isSupportCard(d)) {
    html += `<br><b>サポート</b><br>`;
    html += `<span class="small">${supportEffectSummary(d)}</span>`;
    detailEl.innerHTML = html;
    return;
  }
  html += `<br>`;

  const acts = d.actions || [];
  if (!acts.length) html += "行動なし";
  else {
    acts.forEach((a)=>{
      const parts = [];
if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);

const { hpDelta, spDelta } = getActDeltas(a);
if (hpDelta !== 0) parts.push(`HP${hpDelta>0?"+":""}${hpDelta}`);
if (spDelta !== 0) parts.push(`SP${spDelta>0?"+":""}${spDelta}`);

const effect = parts.length ? parts.join(" / ") : "効果";
html += `効果:${effect}<br>`;

// ★追加：特殊効果（バフ/デバフ/回復）を文章で出す
const specials = describeSpecialEffects(a);
if (specials.length) {
  html += `<span class="small">特殊:${specials.join(" / ")}</span><br>`;
}

      // v2.1.1: シナジー表示（威力は固定+に寄せる）
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
  }
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

  const stt = getStatus(u);
  const aim = Math.trunc(Number(stt?.aim?.v ?? 0));
  const jinx = Math.trunc(Number(stt?.jinx?.v ?? 0));
  const powerUp = Math.trunc(Number(stt?.powerUp?.v ?? 0));
  const armor = Math.trunc(Number(stt?.armor?.v ?? 0));

  // 互換 power(%) が残ってたら powerUp に寄せて表示（見た目だけ）
  const legacyPower = Math.trunc(Number(stt?.power?.v ?? 0));
  const shownPowerUp = powerUp || legacyPower;

  if (aim || jinx || shownPowerUp || armor) {
    html += `強化：命中+${aim}% / 命中-${jinx}% / 威力+${shownPowerUp} / 装甲${armor}<br>`;
  }

  html += `状態:${isPanic(u) ? "パニック（撃破扱い/行動不能）" : "通常"}<br>`;
  const icons = statusIconsText(u);
  html += `状態異常:${icons || "なし"}<br><br>`;

  const acts = def.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  html += `<b>行動</b><br>`;

  acts.forEach((a)=>{
    const parts = [];
    if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
    const { hpDelta, spDelta } = getActDeltas(a);
    if (hpDelta !== 0) parts.push(`HP${hpDelta>0?"+":""}${hpDelta}`);
    if (spDelta !== 0) parts.push(`SP${spDelta>0?"+":""}${spDelta}`);

    const effect = parts.length ? parts.join(" / ") : "効果";
    const addS = displayAddStatus(a);

    const rangeLbl = actRangeLabel(a, u.owner); // ★ユニット本人視点の矢印
    const warn = (a.range === "?" || a.range === "" || a.range == null)
    ? `<span style="color:#ff6;"> ※range未設定</span>`
    : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${a.rate ?? "?"}%)${addS}${warn}<br>`;
    html += `<span class="small">効果:${effect}</span><br>`;

    // v2.1.1: シナジー表示（威力は固定+に寄せる）
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
  });

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

// =====================
// Quick actions
// =====================
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

  const used = moveUsedThisTurn(su, st);

  if (btnQuickMove) {
    btnQuickMove.disabled = isPanic(su) || isMoveBlockedByStatus(su) || used >= 2;
  }

  const canPay = act ? (mana[seat].cur >= Number(act.cost ?? 0)) : false;
  if (btnQuickAttack) {
    btnQuickAttack.disabled = !act || fatigued || !canPay || isPanic(su);
  }

  if (!quickMsgEl) return;

  if (isPanic(su)) quickMsgEl.textContent = "パニック中：撃破扱い＆行動不能";
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

function fxOnHit(st){
  const lh = st?.lastHit;
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
// ★hpDelta/spDelta 吸収層 + ターゲット判定
// =====================
function getActDeltas(act){
  const hpDeltaRaw = (act && act.hpDelta !== undefined) ? Number(act.hpDelta) : undefined;
  const spDeltaRaw = (act && act.spDelta !== undefined) ? Number(act.spDelta) : undefined;

  const dmgRaw = (act && act.dmg !== undefined) ? Number(act.dmg) : undefined;
  const spDmgRaw = (act && act.spDmg !== undefined) ? Number(act.spDmg) : undefined;

  let hpDelta = Number.isFinite(hpDeltaRaw) ? Math.trunc(hpDeltaRaw) : undefined;
  let spDelta = Number.isFinite(spDeltaRaw) ? Math.trunc(spDeltaRaw) : undefined;

  // 旧 → 新
  if (hpDelta === undefined && Number.isFinite(dmgRaw)) hpDelta = -Math.trunc(dmgRaw);
  if (spDelta === undefined && Number.isFinite(spDmgRaw)) spDelta = -Math.trunc(spDmgRaw);

  return {
    hpDelta: (hpDelta === undefined ? 0 : hpDelta),
    spDelta: (spDelta === undefined ? 0 : spDelta),
  };
}

function actHarmBenef(act){
  const { hpDelta, spDelta } = getActDeltas(act);
  const harmful = (hpDelta < 0) || (spDelta < 0);
  const beneficial = (hpDelta > 0) || (spDelta > 0);
  return { hpDelta, spDelta, harmful, beneficial };
}

function actTargetMode(act){
  const { harmful, beneficial } = actHarmBenef(act);
  if (harmful && !beneficial) return "enemy";
  if (!harmful && beneficial) return "ally";
  if (harmful && beneficial) return "any";
  return "enemy";
}

function isSelfRange(rangeSpec){
  const t = String(rangeSpec ?? "").trim().toLowerCase();
  return t === "self";
}

function clamp(n, lo, hi){
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function maxHpSpOfUnit(u){
  const def = cardDefs?.[u?.cardId] || {};
  const mh = Math.max(0, Math.trunc(Number(def.hp ?? 9999)));
  const ms = Math.max(0, Math.trunc(Number(def.sp ?? 9999)));
  return { maxHp: mh || 9999, maxSp: ms || 9999 };
}

// AOE/Pierce の対象収集：敵or味方を切り替え
function collectAoeTargetsByMode(units, attacker, range, mode){
  const res = [];
  for (const u of units){
    if (!u || u.hp <= 0) continue;
    const dist = Math.abs(attacker.x - u.x) + Math.abs(attacker.y - u.y);
    if (dist > range) continue;

    const sameSide = (u.owner === attacker.owner);
    if (mode === "enemy" && sameSide) continue;
    if (mode === "ally" && !sameSide) continue;
    if (mode === "enemy" && isPanic(u)) continue;

    res.push(u);
  }
  return res;
}

function collectPierceTargetsByMode(units, attacker, firstTarget, range, mode){
  if (!attacker || !firstTarget) return [];
  const res = [];

  const ax = attacker.x, ay = attacker.y;
  const tx = firstTarget.x, ty = firstTarget.y;

  if (!(ax === tx || ay === ty)) return [firstTarget];

  const dx = (tx === ax) ? 0 : (tx > ax ? 1 : -1);
  const dy = (ty === ay) ? 0 : (ty > ay ? 1 : -1);

  for (let d = 1; d <= range; d++){
    const x = ax + dx * d;
    const y = ay + dy * d;
    if (x < 0 || x >= W || y < 0 || y >= H) break;

    const u = units.find(u => u.hp > 0 && u.x === x && u.y === y);
    if (!u) continue;

    const sameSide = (u.owner === attacker.owner);
    if (mode === "enemy" && sameSide) continue;
    if (mode === "ally" && !sameSide) continue;
    if (mode === "enemy" && isPanic(u)) continue;

    res.push(u);
  }
  return res.length ? res : [firstTarget];
}

// =====================
// 攻撃属性/遮蔽/ノックバック/ターゲット列挙
// =====================
function actFlags(act){
  const list = addStatusListFromAny(act?.addStatus);
  const has = (s) => list.includes(s);

  const pierce = has("pierce") || has("貫通");
  const aoe    = has("aoe") || has("全体") || has("all");
  const knock  = has("knockback") || has("ノックバック");

  const tags = tagMapFromAny(act?.tags);
  const knockAmt = Number(tags.knockback ?? tags.kb ?? 1);

  return { pierce, aoe, knock, knockAmt: (Number.isFinite(knockAmt) ? knockAmt : 1) };
}

// =====================
// v2.1.1: シナジー（他カードがいれば成功率/威力UP）
// ★威力UPは「固定値(+N)」として扱う（%は使わない）
// =====================
function synergyBonus(units, attacker, act){
  const tags = tagMapFromAny(act?.tags);
  const withRaw = String(tags.synergyWith ?? "").trim();
  if (!withRaw) return { ok:false, rate:0, power:0, found:0, need:0, label:"" };

  const need = Math.max(1, Math.trunc(Number(tags.synergyNeed ?? 1)));
  const side = String(tags.synergySide ?? "ally").trim().toLowerCase();

  const rate = Math.trunc(Number(tags.synergyRate ?? 0));
  const power = Math.trunc(Number(tags.synergyPower ?? 0)); // ←固定値(+)

  const [kind, value] = withRaw.split(":").map(s=>String(s||"").trim());
  if (!kind || !value) return { ok:false, rate:0, power:0, found:0, need, label:withRaw };

  const pool = (Array.isArray(units) ? units : []).filter(u=>{
    if (!u || u.hp <= 0) return false;
    if (side === "enemy") return u.owner !== attacker.owner;
    return u.owner === attacker.owner;
  });

  let found = 0;

  if (kind === "type") {
    found = pool.filter(u=>{
      const def = cardDefs?.[u.cardId];
      return String(def?.type ?? "") === value;
    }).length;
  } else if (kind === "card") {
    found = pool.filter(u=> String(u.cardId) === value).length;
  } else if (kind === "tag") {
    found = pool.filter(u=>{
      const def = cardDefs?.[u.cardId] || {};
      const t = tagMapFromAny(def?.tags);
      return !!t?.[value];
    }).length;
  } else {
    return { ok:false, rate:0, power:0, found:0, need, label:withRaw };
  }

  const ok = found >= need;
  return { ok, rate: ok ? rate : 0, power: ok ? power : 0, found, need, label: withRaw };
}

// =====================
// v2.1.1: バフ付与を game.js 側でも確実に反映（aim/powerUp/armor/jinx + 即時回復）
// - powerUp は固定値(+10など)
// - 疲労回復 / 移動回数回復：addStatus に含めたら即時反映
//   * "recoverFatigue" / "疲労回復"
//   * "recoverMove" / "moveReset" / "移動回復" / "移動制限回復"
// =====================
function applyBuffStatusesLocal(target, actObj, stForTurnSeq){
  const list = addStatusListFromAny(actObj?.addStatus).map(s=>String(s||"").trim());
  if (!list.length) return [];

  const tags = tagMapFromAny(actObj?.tags);

  const st = (target.status && typeof target.status === "object") ? target.status : {};
  const added = [];

  const applyAdd = (name, defVal)=>{
    if (!list.includes(name)) return;
    let v = Number(
      tags[name] ??
      tags[`${name}Up`] ??
      tags[`${name}_up`] ??
      tags[`${name}Plus`] ??
      tags[`${name}_plus`]
    );
    if (!Number.isFinite(v)) v = defVal;
    v = Math.trunc(v);

    const cur = Math.trunc(Number(st?.[name]?.v ?? 0));
    const next = cur + v;

    if (next !== 0) st[name] = { v: next };
    else delete st[name];

    added.push({ name, v: v, next });
  };

  // 命中は%のまま
  applyAdd("aim", 10);
  applyAdd("jinx", 10);

  // ★威力は固定値 (+10) に統一
  applyAdd("powerUp", 10);

  // 装甲は固定吸収
  applyAdd("armor", 10);

  // 互換：もし古い power が来たら powerUp に寄せる（%前提の値でも、とにかく固定+として扱う）
  if (list.includes("power") && !list.includes("powerUp")) {
    let v = Number(tags.power ?? tags.powerUp ?? 10);
    if (!Number.isFinite(v)) v = 10;
    v = Math.trunc(v);
    const cur = Math.trunc(Number(st?.powerUp?.v ?? 0));
    const next = cur + v;
    if (next !== 0) st.powerUp = { v: next };
    else delete st.powerUp;
    added.push({ name:"powerUp", v, next });
  }

  // ===== 即時回復（状態として残さない）=====
  const hasAny = (arr)=> arr.some(x=>list.includes(x));
  const isRecoverFatigue = hasAny(["recoverFatigue","疲労回復","fatigueHeal","fatigueClear"]);
  const isRecoverMove = hasAny(["recoverMove","moveReset","refreshMove","移動回復","移動制限回復","移動回数回復"]);

  if (isRecoverFatigue) {
    if (target.fatigue) {
      target.fatigue = false;
      added.push({ name:"recoverFatigue", v:1, next:1 });
    } else {
      added.push({ name:"recoverFatigue", v:0, next:0 });
    }
  }

  if (isRecoverMove) {
    const curSeq = Math.trunc(Number(stForTurnSeq?.turnSeq ?? 1));
    // 「このターンの移動回数」を確実にリセット
    target.moveTurnSeq = curSeq;
    target.moveUsed = 0;
    added.push({ name:"recoverMove", v:2, next:2 });
  }

  target.status = st;
  return added;
}

function isOccupied(units, x, y){
  return !!units.find(u => u.hp > 0 && u.x === x && u.y === y);
}

function isLineBlocked(units, from, to){
  if (!from || !to) return false;
  const fx = from.x, fy = from.y, tx = to.x, ty = to.y;
  if (fx === tx){
    const step = (ty > fy) ? 1 : -1;
    for (let y = fy + step; y !== ty; y += step){
      if (isOccupied(units, fx, y)) return true;
    }
    return false;
  }
  if (fy === ty){
    const step = (tx > fx) ? 1 : -1;
    for (let x = fx + step; x !== tx; x += step){
      if (isOccupied(units, x, fy)) return true;
    }
    return false;
  }
  return false;
}

function applyKnockback(units, attacker, target, amount){
  if (!attacker || !target) return 0;
  if (target.hp <= 0) return 0;
  let n = Math.max(0, Math.trunc(Number(amount ?? 0)));
  if (n <= 0) return 0;

  const ax = attacker.x, ay = attacker.y;
  const tx = target.x, ty = target.y;

  let dx = 0, dy = 0;
  const diffX = tx - ax;
  const diffY = ty - ay;

  if (Math.abs(diffX) >= Math.abs(diffY)) dx = (diffX === 0 ? 0 : (diffX > 0 ? 1 : -1));
  else dy = (diffY === 0 ? 0 : (diffY > 0 ? 1 : -1));

  if (dx === 0 && dy === 0) return 0;

  let moved = 0;
  for (let i=0;i<n;i++){
    const nx = target.x + dx;
    const ny = target.y + dy;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) break;
    if (isOccupied(units, nx, ny)) break;
    target.x = nx;
    target.y = ny;
    moved++;
  }
  return moved;
}

// =====================
// Pinch + EX
// =====================
const WIN_KILLS = 5;
const WIN_INFIL = 3;
const PINCH_KILLS_LEFT = 1;
const PINCH_INFIL_LEFT = 1;

let pinchWasOn = false;

// EX state (local)
let exArmed = false;     // EX対象選択モード
let exTarget1Id = null;
let exTarget2Id = null;
let exTargetCell = null;

function resetExPicks(){
  exTarget1Id = null;
  exTarget2Id = null;
  exTargetCell = null;
}

function playPinchFx(){
  if (!pinchFxEl) return;
  pinchFxEl.classList.remove("on");
  void pinchFxEl.offsetWidth;
  pinchFxEl.classList.add("on");
  setTimeout(()=> pinchFxEl.classList.remove("on"), 650);
}

function isPinchForSeat(st, mySeat){
  if (!st || st.winner) return false;
  const op = (mySeat === "A") ? "B" : "A";

  const k = Number(st.kills?.[op] ?? 0);
  const { infilA, infilB } = computeInfil(st);
  const inf = (op === "A") ? infilA : infilB;

  const killPinch = k >= (WIN_KILLS - PINCH_KILLS_LEFT);
  const infilPinch = inf >= (WIN_INFIL - PINCH_INFIL_LEFT);
  return killPinch || infilPinch;
}

function updatePinchUI(st){
  const pinch = isPinchForSeat(st, seat);
  document.body.classList.toggle("pinchGlow", pinch);
  if (exWrapEl) exWrapEl.classList.toggle("pinch", pinch);

  if (!pinchWasOn && pinch) playPinchFx();
  pinchWasOn = pinch;
}

function renderEx(st){
  if (!exBtnEl || !exInfoEl) return;

  const myTurn = canControl(st);
  const pinch = isPinchForSeat(st, seat);

  const exId = st?.ex?.[seat] || null;
  const used = !!st?.exUsed?.[seat];

  if (!exId) {
    exInfoEl.textContent = used ? "EX使用済み" : "EXなし";
    exBtnEl.disabled = true;
    exBtnEl.classList.remove("pinchReady");
    return;
  }

  const def = cardDefs?.[exId];
  const cost = Number(def?.cost ?? 0);
  const manaNow = normalizeMana(st.mana);
  const canPay = (manaNow?.[seat]?.cur ?? 0) >= cost;

  exInfoEl.textContent =
    `EX: ${cardName(exId)} / コスト:${cost} / ${used ? "使用済み" : (pinch ? "ピンチ時のみ使用可" : "通常時は使用不可")}`;

  const canUse = myTurn && pinch && !used && canPay;

  exBtnEl.disabled = !canUse;
  exBtnEl.classList.toggle("pinchReady", canUse);
}

// =====================
// v2.0.8+: Summon/Evolve FX (local)
// =====================
let summonFxLocal = null; // { at, x, y, cls, until }
let evolveFxLocal = null; // { at, x, y, cls, until }

function attrToFxClass(type){
  const t = String(type || "").trim();
  if (t === "火") return "fire";
  if (t === "水") return "water";
  if (t === "風") return "wind";
  if (t === "雷") return "thunder";
  if (t === "光") return "light";
  if (t === "闇") return "dark";
  if (t === "鋼") return "steel";
  if (t === "草") return "grass";
  return "light";
}

// =====================
// Support execute
// =====================
async function tryExecuteSupport(){
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;

  const cid = selectedHandCardId(st);
  if (!cid) return;
  const def = cardDefs?.[cid];
  if (!def || !isSupportCard(def)) return;

  const plan = supportPlan(def);
  if (plan.need === "unit" && !supportTarget1Id) return;
  if (plan.need === "unit2" && (!supportTarget1Id || !supportTarget2Id)) return;
  if (plan.need === "unitCell" && (!supportTarget1Id || !supportTargetCell)) return;

  await runTransaction(db, async (tx) => {
    const stSnap = await tx.get(stateRef);
    if (!stSnap.exists()) return;

    const s = stSnap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;

    const res = applySupport({
      s,
      seat,
      cardDefs,
      supportCardId: cid,
      supportHandIndex: selectedHandIndex,
      targetUnitId: supportTarget1Id,
      targetUnitId2: supportTarget2Id,
      targetCell: supportTargetCell,
      rand: Math.random,
    });

    if (!res.ok) {
      const logLines = [...(s.log || [])];
      logLines.push(`[${seat}] サポート不可：${res.reason || "unknown"}`);
      tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
      return;
    }

    const winner = checkWin({ ...s, units: res.units, kills: res.kills });

    tx.set(stateRef, {
      mana: res.mana,
      hands: res.hands,
      decks: res.decks,
      units: res.units,
      kills: res.kills,
      winner: winner || null,
      log: res.log,
      lastSupportRoll: res.lastSupportRoll || null,
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });

  // local reset after attempt
  selectedHandIndex = null;
  resetSupportPicks();

  // v2.0.8 UX: support後にモード戻す（フリーズ感対策）
  selectedTargetId = null;
  setMode(null);
}

// =====================
// EX execute
// =====================
async function tryExecuteEx(){
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;
  if (!isPinchForSeat(st, seat)) return;

  const exId = st?.ex?.[seat] || null;
  if (!exId) return;

  const def = cardDefs?.[exId];
  if (!def || !isSupportCard(def)) return;

  const plan = supportPlan(def);
  if (plan.need === "unit" && !exTarget1Id) return;
  if (plan.need === "unit2" && (!exTarget1Id || !exTarget2Id)) return;
  if (plan.need === "unitCell" && (!exTarget1Id || !exTargetCell)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;
    if (!isPinchForSeat(s, seat)) return;

    const used = !!s?.exUsed?.[seat];
    if (used) return;

    const exId2 = s?.ex?.[seat] || null;
    const def2 = exId2 ? cardDefs?.[exId2] : null;
    if (!def2 || !isSupportCard(def2)) return;

    const res = applyExSupport({
      s,
      seat,
      cardDefs,
      exCardId: exId2,
      targetUnitId: exTarget1Id,
      targetUnitId2: exTarget2Id,
      targetCell: exTargetCell,
      rand: Math.random,
    });

    if (!res.ok) {
      const logLines = [...(s.log || [])];
      logLines.push(`[${seat}] EX不可：${res.reason || "unknown"}`);
      tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
      return;
    }

    const winner = checkWin({ ...s, units: res.units, kills: res.kills });

    tx.set(stateRef, {
      mana: res.mana,
      hands: res.hands,
      decks: res.decks,
      units: res.units,
      kills: res.kills,
      ex: res.ex,
      exUsed: res.exUsed,
      winner: winner || null,
      log: res.log,
      lastSupportRoll: res.lastSupportRoll || null,
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });

  exArmed = false;
  resetExPicks();

  // v2.0.8 UX: EX後にモード戻す（フリーズ感対策）
  selectedTargetId = null;
  setMode(null);
}

exBtnEl?.addEventListener("click", ()=>{
  const st = currentState;
  if (!st) return;

  const exId = st?.ex?.[seat] || null;
  const def = exId ? cardDefs?.[exId] : null;
  if (!def) return;

  const plan = supportPlan(def);
  if (plan.need === "none") {
    tryExecuteEx();
    return;
  }

  exArmed = true;
  resetExPicks();
  resetSupportPicks();
  render(currentState);
});

// =====================
// Render
// =====================
let currentState = null;
let lastTurnSeen = null;
let finishedOnce = false;

ensureRngButton();
ensureSettingsButton();

function render(st){
  if (!st) return;

  const mana = normalizeMana(st.mana);
  const myTurn = canControl(st);

  btnSummon.disabled = !myTurn;
  btnMove.disabled   = !myTurn;
  btnAttack.disabled = !myTurn;
  btnEvolve.disabled = !myTurn;
  btnSupport.disabled = !myTurn;
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
  if (nowMs() < rngMsgUntil) {
    logEl.textContent += `\n[local] 乱数データリセット（ダミー）`;
  }
  showDiceRoll(st.lastRoll, st.lastSupportRoll);

  const canDoEvo =
    myTurn &&
    mode === "evolve" &&
    evoBaseId &&
    selectedHandIndex != null &&
    evoCandidates.has(selectedHandIndex);

  btnDoEvolve.style.display = (mode==="evolve") ? "inline-block" : "none";
  btnDoEvolve.disabled = !canDoEvo;

  // ===== EX armed UI (優先で出す) =====
  if (exArmed) {
    actionPickerEl.innerHTML = "";
    const exId = st?.ex?.[seat] || null;
    const def = exId ? cardDefs?.[exId] : null;

    if (!def) {
      actionPickerEl.innerHTML = `<div class="small">EXがありません。</div>`;
    } else {
      const plan = supportPlan(def);
      const needText =
        plan.need === "unit" ? "対象ユニットを1体クリック" :
        plan.need === "unit2" ? "対象ユニットを2体クリック（swap）" :
        plan.need === "unitCell" ? "対象ユニット→移動先マスをクリック（moveTo）" :
        "対象不要（そのまま実行可）";

      const pickText = (() => {
        if (plan.need === "unit") return exTarget1Id ? "✅ 対象OK → 実行できる" : "⏳ 対象待ち";
        if (plan.need === "unit2") {
          if (!exTarget1Id) return "⏳ 1体目待ち";
          if (!exTarget2Id) return "⏳ 2体目待ち";
          return "✅ 2体OK → 実行できる";
        }
        if (plan.need === "unitCell") {
          if (!exTarget1Id) return "⏳ 対象ユニット待ち";
          if (!exTargetCell) return "⏳ 移動先マス待ち";
          return "✅ 対象+マスOK → 実行できる";
        }
        return "✅ 実行できる";
      })();

      const manaNow = normalizeMana(st.mana);
      const cost = Number(def.cost ?? 0);
      const canPay = manaNow?.[seat]?.cur >= cost;

      actionPickerEl.innerHTML = `
        <div><b>EX：</b>${cardName(exId)}</div>
        <div class="small">コスト：${cost} / ${needText}</div>
        <div class="small">${pickText}</div>
        <div style="margin-top:8px;">
          <button id="doEx" ${(!myTurn || !canPay) ? "disabled" : ""}>EX実行</button>
          <button id="cancelEx">キャンセル</button>
          <button id="resetEx">対象リセット</button>
        </div>
        <div class="small" style="margin-top:6px; opacity:.85;">
          ※1回きり / 失敗でもコスト支払い＆EX消費
        </div>
      `;

      actionPickerEl.querySelector("#cancelEx")?.addEventListener("click", ()=>{
        exArmed = false;
        resetExPicks();
        render(currentState);
      });

      actionPickerEl.querySelector("#resetEx")?.addEventListener("click", ()=>{
        resetExPicks();
        render(currentState);
      });

      actionPickerEl.querySelector("#doEx")?.addEventListener("click", async ()=>{
        if (!myTurn) return;
        if (!canPay) return;

        const p = supportPlan(def);
        if (p.need === "unit" && !exTarget1Id) return;
        if (p.need === "unit2" && (!exTarget1Id || !exTarget2Id)) return;
        if (p.need === "unitCell" && (!exTarget1Id || !exTargetCell)) return;

        await tryExecuteEx();
      });
    }
  }

  // ===== 手札 =====
  handEl.innerHTML = "";
  const myHand = st.hands?.[seat] || [];
  myHand.forEach((cardId, idx) => {
    const def = cardDefs[cardId];
    const isSup = isSupportCard(def);

    const acts = def?.actions || [];
    const actLine = isSup
      ? `サポート: ${supportEffectSummary(def)}`
      : (acts.length
      ? `行動: ${acts[0].name} / 射程:${actRangeLabel(acts[0], seat)} / ${acts[0].rate}%`
      : `行動: なし`);

    const d = document.createElement("div");
    d.className = "card";
    if (idx === selectedHandIndex) d.classList.add("selected");
    if (mode === "evolve" && evoCandidates.has(idx)) d.classList.add("summon");

    d.innerHTML = `
      <div class="cardRow">
        <div>
          <b>【${def?.cost ?? "?"}】 ${cardName(cardId)} ${isSup ? "（サポ）" : (def?.type ?? "?")}</b>
        </div>
        <div><button data-detail="${cardId}">詳細</button></div>
      </div>
      <div class="small">HP:${def?.hp ?? "?"} / SP:${def?.sp ?? "?"}</div>
      <div class="small">${actLine}</div>
    `;

    d.onclick = async (e) => {
      const btn = e.target?.closest?.("button");
      if (btn && btn.dataset.detail) return;

      selectedHandIndex = idx;
      showCardDetail(cardId);

      if (myTurn && mode === "support" && isSup) {
        resetSupportPicks();
      }
      render(st);
    };

    d.querySelector("button[data-detail]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      showCardDetail(cardId);
    });

    handEl.appendChild(d);
  });

  const su = getSelectedUnit(st);
  if (su) showUnitDetail(su, st);

  // 行動ピッカー（EX armed でなければ）
  if (!exArmed) {
    actionPickerEl.innerHTML = "";

    if (mode === "support") {
      const cid = selectedHandCardId(st);
      const def = cid ? cardDefs?.[cid] : null;

      if (!cid) {
        actionPickerEl.innerHTML = `<div class="small">手札のサポートカードを選択してください。</div>`;
      } else if (!def || !isSupportCard(def)) {
        actionPickerEl.innerHTML = `手札選択中：<b>${cardName(cid)}</b><br><span class="small">これはサポートカードではありません。</span>`;
      } else {
        const plan = supportPlan(def);
        const needText =
          plan.need === "unit" ? "対象ユニットを1体クリック" :
          plan.need === "unit2" ? "対象ユニットを2体クリック（swap）" :
          plan.need === "unitCell" ? "対象ユニット→移動先マスをクリック（moveTo）" :
          "対象不要（そのまま実行可）";

        const pickText = (() => {
          if (plan.need === "unit") return supportTarget1Id ? "✅ 対象OK → 実行できる" : "⏳ 対象待ち";
          if (plan.need === "unit2") {
            if (!supportTarget1Id) return "⏳ 1体目待ち";
            if (!supportTarget2Id) return "⏳ 2体目待ち";
            return "✅ 2体OK → 実行できる";
          }
          if (plan.need === "unitCell") {
            if (!supportTarget1Id) return "⏳ 対象ユニット待ち";
            if (!supportTargetCell) return "⏳ 移動先マス待ち";
            return "✅ 対象+マスOK → 実行できる";
          }
          return "✅ 実行できる";
        })();

        const manaNow = normalizeMana(st.mana);
        const cost = Number(def.cost ?? 0);
        const canPay = manaNow?.[seat]?.cur >= cost;

        actionPickerEl.innerHTML = `
          <div><b>サポート：</b>${cardName(cid)}</div>
          <div class="small">コスト：${cost} / ${needText}</div>
          <div class="small">${pickText}</div>
          <div class="small" style="margin-top:6px;">${supportEffectSummary(def)}</div>
          <div style="margin-top:8px;">
            <button id="doSupport" ${(!myTurn || !canPay) ? "disabled" : ""}>サポート実行</button>
            <button id="resetSupport">対象リセット</button>
          </div>
          <div class="small" style="margin-top:6px; opacity:.85;">
            ※失敗してもコスト支払い＆手札から消費します
          </div>
        `;

        actionPickerEl.querySelector("#resetSupport")?.addEventListener("click", ()=>{
          resetSupportPicks();
          render(currentState);
        });

        actionPickerEl.querySelector("#doSupport")?.addEventListener("click", async ()=>{
          if (!myTurn) return;
          if (!canPay) return;

          const p = supportPlan(def);
          if (p.need === "unit" && !supportTarget1Id) return;
          if (p.need === "unit2" && (!supportTarget1Id || !supportTarget2Id)) return;
          if (p.need === "unitCell" && (!supportTarget1Id || !supportTargetCell)) return;

          await tryExecuteSupport();
        });
      }
    } else if (su && su.owner === seat) {
      const def = cardDefs[su.cardId];
      const acts = def?.actions || [];

      if (!acts.length) {
        actionPickerEl.textContent = "このカードは行動がありません";
      } else {
        acts.forEach((a, idx) => {
          const b = document.createElement("button");
          b.textContent = `【${a.cost}】${a.name}`;
          if (idx === selectedActionIndex) b.style.outline = "2px solid yellow";
          b.onclick = () => { selectedActionIndex = idx; render(st); };
          actionPickerEl.appendChild(b);

          const s2 = document.createElement("div");
          s2.className = "small";

          const parts = [];
          if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
          const { hpDelta, spDelta } = getActDeltas(a);
          if (hpDelta !== 0) parts.push(`HP${hpDelta>0?"+":""}${hpDelta}`);
          if (spDelta !== 0) parts.push(`SP${spDelta>0?"+":""}${spDelta}`);
          const addS = displayAddStatus(a);
          const rangeLbl = actRangeLabel(a, su.owner);
          s2.textContent = `射程:${rangeLbl} 成功:${a.rate}%${addS} 効果:${parts.length ? parts.join(" / ") : "効果"}`;
          actionPickerEl.appendChild(s2);
        });
      }
    } else {
      actionPickerEl.textContent = "自軍キャラを選ぶと行動が出ます";
    }
  }

  updatePinchUI(st);
  renderEx(st);

  // ===== 盤面 =====
  boardEl.innerHTML = "";

  const rangeMap = buildRangeMap(st);

  const supDef = (mode === "support") ? selectedHandDef(st) : null;
  const supOn  = (mode === "support" && myTurn && supDef && isSupportCard(supDef));
  const supPlan = supOn ? supportPlan(supDef) : { need:"none" };

  const exId = st?.ex?.[seat] || null;
  const exDef = (exArmed && exId) ? (cardDefs?.[exId] || null) : null;
  const exOn = !!(exArmed && myTurn && exDef && isSupportCard(exDef));
  const exPlan = exOn ? supportPlan(exDef) : { need:"none" };

  const unitsArr = Array.isArray(st.units) ? st.units : [];

  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.onclick = () => clickCell(x,y);

      const u = unitsArr.find(u => u.x===x && u.y===y && u.hp>0) || null;

      const isEmpty = !u;
      const isUnit  = !!u;

      const isSupportUnitCandidate = supOn && (
        supPlan.need === "unit" ||
        supPlan.need === "unit2" ||
        supPlan.need === "unitCell"
      ) && isUnit;

      const isSupportCellCandidate =
        supOn &&
        supPlan.need === "unitCell" &&
        !!supportTarget1Id &&
        isEmpty;

      const isPick1 = supOn && isUnit && supportTarget1Id && u.id === supportTarget1Id;
      const isPick2 = supOn && isUnit && supportTarget2Id && u.id === supportTarget2Id;
      const isPickedCell = supOn && isEmpty && supportTargetCell && supportTargetCell.x===x && supportTargetCell.y===y;

      const isExUnitCandidate = exOn && (
        exPlan.need === "unit" ||
        exPlan.need === "unit2" ||
        exPlan.need === "unitCell"
      ) && isUnit;

      const isExCellCandidate =
        exOn &&
        exPlan.need === "unitCell" &&
        !!exTarget1Id &&
        isEmpty;

      const isExPick1 = exOn && isUnit && exTarget1Id && u.id === exTarget1Id;
      const isExPick2 = exOn && isUnit && exTarget2Id && u.id === exTarget2Id;
      const isExPickedCell = exOn && isEmpty && exTargetCell && exTargetCell.x===x && exTargetCell.y===y;

      if (u) {
        cell.classList.add(u.owner==="A" ? "unitA" : "unitB");
        const def = cardDefs[u.cardId] || {};
        if (u.fatigue) cell.classList.add("fatigued");

        const icons = statusIconsText(u);
        const iconLine = icons ? `<div class="statusIcons">${icons}</div>` : "";

        const costLabel = (def.cost ?? "?");

        // enemy target outline (legacy)
        if (selectedTargetId && u.id === selectedTargetId && u.owner !== seat) {
          cell.classList.add("targetOk");
        }

        if (u.id === selectedUnitId) cell.classList.add("selected");

        if (isSupportUnitCandidate) cell.classList.add("supportOk");
        if (isPick1) cell.classList.add("supportPick1");
        if (isPick2) cell.classList.add("supportPick2");

        if (isExUnitCandidate) cell.classList.add("supportOk");
        if (isExPick1) cell.classList.add("supportPick1");
        if (isExPick2) cell.classList.add("supportPick2");

        cell.innerHTML = `
          ${u.fatigue ? `<div class="fatigueTag">疲労</div>` : ""}
          ${u.panic ? `<div class="fatigueTag" style="top:18px;">パニック</div>` : ""}

          <div class="unitCost">${costLabel}</div>
          <div class="attr">${def.type ?? "?"}</div>
          <div class="unitName">${cardName(u.cardId)}</div>

          ${iconLine}

          <div class="status">HP${u.hp} SP${u.sp}</div>
        `;
      } else {
        const manaNow = normalizeMana(st.mana);
        if (!st.winner && myTurn && mode==="summon" && selectedHandIndex!=null) {
          const cid = (st.hands?.[seat] || [])[selectedHandIndex];
          const def = cardDefs[cid];
          const onField = countMyAliveUnits(st.units, seat);
          if (def && summonArea(seat, y) && manaNow[seat].cur >= Number(def.cost ?? 0) && onField < MAX_UNITS_PER_PLAYER) {
            cell.classList.add("summon");
          }
        }

        if (isSupportCellCandidate) cell.classList.add("supportCellOk");
        if (isPickedCell) cell.classList.add("targetOk");

        if (isExCellCandidate) cell.classList.add("supportCellOk");
        if (isExPickedCell) cell.classList.add("targetOk");
      }

      const rm = rangeMap.get(`${x},${y}`);
      if (rm) {
        cell.classList.add("rangeOk");
        if (rm.ok === false) cell.classList.add("rangeBlocked");
      }

      // v2.0.8+: summon fx overlay（7+は big）
      if (summonFxLocal && nowMs() < summonFxLocal.until && summonFxLocal.x === x && summonFxLocal.y === y) {
        const fx = document.createElement("div");
        fx.className = `summonFx ${summonFxLocal.cls}`;
        cell.appendChild(fx);
      }

      // ★追加：evolve fx overlay（7+は big）
      if (evolveFxLocal && nowMs() < evolveFxLocal.until && evolveFxLocal.x === x && evolveFxLocal.y === y) {
        const fx2 = document.createElement("div");
        fx2.className = `evolveFx ${evolveFxLocal.cls}`;
        cell.appendChild(fx2);
      }

      boardEl.appendChild(cell);
    }
  }

  updateQuickActions(st);
}

// =====================
// Subscribe
// =====================
let lastHitSeenAt = 0;

onSnapshot(stateRef, (snap) => {
  if (!snap.exists()) return;
  currentState = snap.data();

  // v2.0.8+: Summon FX trigger（7+ big）
  try{
    const ls = currentState?.lastSummon;
    const at = Number(ls?.at ?? 0);
    if (at && (!summonFxLocal || summonFxLocal.at !== at)) {
      const x = Math.trunc(Number(ls.x ?? -1));
      const y = Math.trunc(Number(ls.y ?? -1));
      const cls = attrToFxClass(ls.type);
      const big = Number(ls.cost ?? 0) >= 7;
      summonFxLocal = { at, x, y, cls: cls + (big ? " big" : ""), until: nowMs() + 900 };
    }
  } catch {}

  // ★追加：Evolve FX trigger（7+ big）
  try{
    const le = currentState?.lastEvolve;
    const at2 = Number(le?.at ?? 0);
    if (at2 && (!evolveFxLocal || evolveFxLocal.at !== at2)) {
      const x2 = Math.trunc(Number(le.x ?? -1));
      const y2 = Math.trunc(Number(le.y ?? -1));
      const cls2 = attrToFxClass(le.type);
      const big2 = Number(le.cost ?? 0) >= 7;
      evolveFxLocal = { at: at2, x: x2, y: y2, cls: cls2 + (big2 ? " big" : ""), until: nowMs() + 1050 };
    }
  } catch {}

  if (lastTurnSeen && currentState.turn !== lastTurnSeen) {
    selectedTargetId = null;
    resetSupportPicks();

    exArmed = false;
    resetExPicks();
  }

  render(currentState);

  const lhAt = Number(currentState?.lastHit?.at ?? 0);
  if (lhAt && lhAt !== lastHitSeenAt) {
    lastHitSeenAt = lhAt;
    setTimeout(()=> fxOnHit(currentState), 0);
  }

  if (currentState.winner && !finishedOnce) {
    finishedOnce = true;

    const wSeat = String(currentState.winner || "").toUpperCase();
    const result = (seat === wSeat) ? "win" : "lose";

    const turnSeq = Number(currentState.turnSeq ?? 0);
    const killsA = Number(currentState.kills?.A ?? 0);
    const killsB = Number(currentState.kills?.B ?? 0);

    const { infilA, infilB } = computeInfil(currentState);

    let reason = "勝利";
    try{
      const wk = Number(currentState.kills?.[wSeat] ?? 0);
      const winByKills = wk >= WIN_KILLS;
      const winByInfil = (wSeat === "A" ? infilA : infilB) >= WIN_INFIL;
      reason = winByKills ? "撃破勝利" : winByInfil ? "侵入勝利" : "勝利";
    } catch {}

    const q = new URLSearchParams({
      room: roomId,
      player: playerId,
      winner: wSeat,
      seat: seat || "",
      result,
      reason,
      turnSeq: String(turnSeq),
      killsA: String(killsA),
      killsB: String(killsB),
      infilA: String(infilA),
      infilB: String(infilB),
    });

    location.href = `victory.html?${q.toString()}`;
  }
});

// =====================
// Click handler
// =====================
async function clickCell(x,y){
  const st = currentState;
  if (!st || st.winner) return;

  const uHereLocal = (st.units || []).find(u => u.x===x && u.y===y && u.hp>0) || null;

  // =====================
  // ★EX armed: まずEXの対象選択を最優先
  // =====================
  if (exArmed && canControl(st)) {
    const exId = st?.ex?.[seat] || null;
    const def = exId ? cardDefs?.[exId] : null;

    if (def && isSupportCard(def)) {
      const plan = supportPlan(def);

      if (uHereLocal) {
        if (plan.need === "unit") {
          exTarget1Id = uHereLocal.id;
          render(st);
          return;
        } else if (plan.need === "unit2") {
          if (!exTarget1Id) exTarget1Id = uHereLocal.id;
          else if (!exTarget2Id && exTarget1Id !== uHereLocal.id) exTarget2Id = uHereLocal.id;
          else if (exTarget1Id === uHereLocal.id) exTarget1Id = null;
          else if (exTarget2Id === uHereLocal.id) exTarget2Id = null;
          render(st);
          return;
        } else if (plan.need === "unitCell") {
          exTarget1Id = uHereLocal.id;
          render(st);
          return;
        }
      } else {
        if (plan.need === "unitCell" && exTarget1Id) {
          const occ = (st.units || []).find(u => u.hp>0 && u.x===x && u.y===y);
          if (!occ) {
            exTargetCell = { x, y };
            render(st);
            return;
          }
        }
      }
    }

    return;
  }

  // ===== 敵クリック：いつでも詳細見れる =====
  if (uHereLocal && uHereLocal.owner !== seat) {
    selectedTargetId = uHereLocal.id;
    showUnitDetail(uHereLocal, st);

    if (mode === "support" && canControl(st) && selectedIsSupport(st)) {
      const def = selectedHandDef(st);
      const plan = supportPlan(def);

      if (plan.need === "unit") {
        supportTarget1Id = uHereLocal.id;
      } else if (plan.need === "unit2") {
        if (!supportTarget1Id) supportTarget1Id = uHereLocal.id;
        else if (!supportTarget2Id && supportTarget1Id !== uHereLocal.id) supportTarget2Id = uHereLocal.id;
        else if (supportTarget1Id === uHereLocal.id) supportTarget1Id = null;
        else if (supportTarget2Id === uHereLocal.id) supportTarget2Id = null;
      } else if (plan.need === "unitCell") {
        supportTarget1Id = uHereLocal.id;
      }

      render(st);
      return;
    }

    render(st);

    if (mode === "attack" && canControl(st)) {
      const su = getSelectedUnit(st);
      const def = su ? cardDefs?.[su.cardId] : null;
      const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;
      const tMode = act ? actTargetMode(act) : "enemy";

      // self なら敵クリックしても self に寄せる
      if (act && isSelfRange(act.range)) {
        selectedTargetId = su?.id || null;
        await tryExecuteAttack();
        return;
      }

      const okBySide = (tMode === "enemy" || tMode === "any");
      if (okBySide) {
        const rm = buildRangeMap(st).get(`${x},${y}`);
        if (rm && rm.ok !== false) {
          await tryExecuteAttack();
        }
      }
    }
    return;
  }

  // 自軍クリック：操作対象として選択 or self 即実行
  if (mode === "attack" && canControl(st) && selectedUnitId && uHereLocal && uHereLocal.owner === seat) {
    const attacker = getSelectedUnit(st);
    const aDef = attacker ? cardDefs?.[attacker.cardId] : null;
    const act = aDef?.actions?.[selectedActionIndex] || aDef?.actions?.[0] || null;

    if (act) {
      // ===== FIX: self は必ず自分に寄せる（選択残りで失敗しない） =====
      if (isSelfRange(act.range)) {
        selectedTargetId = attacker?.id || null;
        render(st);
        await tryExecuteAttack();
        return;
      }

      const tMode = actTargetMode(act);

      if (tMode === "ally" || tMode === "any") {
        selectedTargetId = uHereLocal.id;
        showUnitDetail(uHereLocal, st);
        render(st);

        const rm = buildRangeMap(st).get(`${x},${y}`);
        if (rm && rm.ok !== false) {
          await tryExecuteAttack();
        }
        return;
      }
    }
  }

  if (uHereLocal && uHereLocal.owner === seat) {
    selectedUnitId = uHereLocal.id;

    if (mode === "evolve") {
      evoBaseId = uHereLocal.id;
      evoCandidates = getEvoCandidates(st, uHereLocal);
    }

    if (mode === "support" && canControl(st) && selectedIsSupport(st)) {
      const def = selectedHandDef(st);
      const plan = supportPlan(def);

      if (plan.need === "unit") {
        supportTarget1Id = uHereLocal.id;
      } else if (plan.need === "unit2") {
        if (!supportTarget1Id) supportTarget1Id = uHereLocal.id;
        else if (!supportTarget2Id && supportTarget1Id !== uHereLocal.id) supportTarget2Id = uHereLocal.id;
        else if (supportTarget1Id === uHereLocal.id) supportTarget1Id = null;
        else if (supportTarget2Id === uHereLocal.id) supportTarget2Id = null;
      } else if (plan.need === "unitCell") {
        supportTarget1Id = uHereLocal.id;
      }

      showUnitDetail(uHereLocal, st);
      render(st);
      return;
    }

    showUnitDetail(uHereLocal, st);
    render(st);
    return;
  }

  // 空マスクリック：support の unitCell 用
  if (mode === "support" && canControl(st) && selectedIsSupport(st)) {
    const def = selectedHandDef(st);
    const plan = supportPlan(def);
    if (plan.need === "unitCell" && supportTarget1Id) {
      const occ = (st.units || []).find(u => u.hp>0 && u.x===x && u.y===y);
      if (!occ) {
        supportTargetCell = { x, y };
        render(st);
        return;
      }
    }
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
    const kills = { ...(s.kills || {A:0,B:0}) };

    const uHere = units.find(u => u.x===x && u.y===y && u.hp>0) || null;
    if (uHere) return;

    // ===== 召喚 =====
    if (mode === "summon" && selectedHandIndex != null) {
      const onField = countMyAliveUnits(units, seat);
      if (onField >= MAX_UNITS_PER_PLAYER) {
        logLines.push(`[${seat}] 召喚不可：場の上限(${MAX_UNITS_PER_PLAYER})`);
        tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
        return;
      }

      const hand = hands[seat] || [];
      const cid = hand[selectedHandIndex];
      const def = cardDefs[cid];
      if (!def) return;

      if (isSupportCard(def)) {
        logLines.push(`[${seat}] 召喚不可：サポートカードです（supportモードで使用）`);
        tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
        return;
      }

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
        status: {},
        moveUsed: 0,
        moveTurnSeq: s.turnSeq ?? 1,
        countedAsKill: false,
      });

      logLines.push(`[${seat}] 召喚：${cardName(cid)} (-${cost})`);
      const winner = checkWin({ ...s, units, kills });

      const summonAt = nowMs();

      tx.set(stateRef, {
        mana,
        hands,
        units,
        kills,
        winner: winner || null,
        log: logLines.slice(-200),

        // v2.0.8+: 召喚FX用（cost追加で7+ big）
        lastSummon: { at: summonAt, x, y, type: def.type || "", cost: Number(def.cost ?? 0) },
      }, { merge:true });
      return;
    }

    // ===== 移動 =====
    if ((mode === "move" || mode === null) && selectedUnitId) {
      const su2 = units.find(u => u.id === selectedUnitId);
      if (!su2) return;
      if (su2.owner !== seat) return;
      if (isPanic(su2)) return;
      if (isMoveBlockedByStatus(su2)) return;

      const curSeq = Number(s.turnSeq ?? 1);
      if (Number(su2.moveTurnSeq ?? 0) !== curSeq) {
        su2.moveTurnSeq = curSeq;
        su2.moveUsed = 0;
      }

      const used = Number(su2.moveUsed ?? 0);
      if (used >= 2) return;

      const dist = Math.abs(su2.x - x) + Math.abs(su2.y - y);
      if (dist !== 1) return;

      const pay = spendMana(mana, seat, 1);
      if (!pay.ok) return;
      mana = pay.mana;

      su2.x = x;
      su2.y = y;
      su2.moveUsed = used + 1;

      const bleedDmg = applyBleedOnMove(su2);
      if (bleedDmg > 0) {
        logLines.push(`[${seat}] 出血：${cardName(su2.cardId)} HP-${bleedDmg}`);
      }

      if (Number(su2.hp) <= 0) {
        su2.hp = 0;
        countKillIfNeeded(su2, opponentSeat, kills, logLines, "撃破(出血)");
      }

      logLines.push(`[${seat}] 移動：${cardName(su2.cardId)} (-1) [${su2.moveUsed}/2]`);

      const winner = checkWin({ ...s, units, kills });

      tx.set(stateRef, {
        mana,
        units,
        kills,
        winner: winner || null,
        log: logLines.slice(-200)
      }, { merge:true });
      return;
    }
  });
}

// =====================
// ★UX：攻撃は「ボタン押下」 or 「緑枠クリック」で実行
// =====================
async function tryExecuteAttack(){
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;

  const suLocal = getSelectedUnit(st);
  if (!suLocal || suLocal.owner !== seat) return;

  const defLocal = cardDefs[suLocal.cardId];
  const actLocal = defLocal?.actions?.[selectedActionIndex] || defLocal?.actions?.[0];
  if (!actLocal) return;

  // ===== FIX: self は常に自分をターゲットに固定（選択残りで失敗しない） =====
  if (isSelfRange(actLocal.range)) {
    selectedTargetId = suLocal.id;
  } else {
    // self 以外：ターゲット未選択なら何もしない
    const tgtLocal = getSelectedTarget(st);
    if (!tgtLocal) return;
  }

  await runTransaction(db, async (tx) => {
    const stSnap = await tx.get(stateRef);
    if (!stSnap.exists()) return;

    const s = stSnap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;

    let mana = normalizeMana(s.mana);
    const units = (Array.isArray(s.units) ? s.units : []).map(u => ({...u}));
    const logLines = [...(s.log || [])];
    const kills = { ...(s.kills || {A:0,B:0}) };

    const su = units.find(u => u.id === selectedUnitId) || null;
    if (!su) return;
    if (su.owner !== seat) return;

    const def = cardDefs[su.cardId];
    const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0];
    if (!act) return;

    // ===== FIX: TX内でも self は必ず自分 =====
    const target =
      isSelfRange(act.range)
        ? su
        : (units.find(u => u.id === selectedTargetId) || null);

    const fail = (msg) => {
      logLines.push(`[${seat}] 行動不可：${msg}`);
      tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
    };

    if (!target) { fail("対象が取れない"); return; }
    if (isPanic(su) || su.fatigue) { fail("行動者がパニック or 疲労"); return; }

    const cost = Number(act.cost ?? 0);
    if (mana[seat].cur < cost) { fail(`マナ不足 cur=${mana[seat].cur} cost=${cost}`); return; }

    const mode2 = actTargetMode(act); // enemy/ally/any
    const { hpDelta, spDelta, harmful } = actHarmBenef(act);

    if (mode2 === "enemy" && target.owner === seat) { fail("この行動は敵のみ対象"); return; }
    if (mode2 === "ally"  && target.owner !== seat) { fail("この行動は味方のみ対象"); return; }
    if (mode2 !== "ally" && target.owner !== seat && isPanic(target)) { fail("対象がパニック"); return; }

    const rangeSpec = act.range;
    const flags = actFlags(act);
    const range = rangeSpecMaxDist(su, rangeSpec);

    // 射程チェック
    if (isSelfRange(rangeSpec)) {
      if (target.id !== su.id) { fail("射程:self は自分のみ対象"); return; }
    } else {
      if (flags.aoe) {
        const dist = Math.abs(su.x - target.x) + Math.abs(su.y - target.y);
        if (dist > range) { fail(`射程外(aoe) range=${range} dist=${dist}`); return; }
      } else if (flags.pierce) {
        const dist = Math.abs(su.x - target.x) + Math.abs(su.y - target.y);
        if (dist > range) { fail(`射程外(pierce) range=${range} dist=${dist}`); return; }
        // pierce は直線前提じゃないカードもあるので、ここでは厳密線形チェックはしない
      } else {
        if (!inActionRange(su, target.x, target.y, rangeSpec)) { fail("射程外"); return; }
        if (isLineBlocked(units, su, target)) { fail("遮蔽でブロック"); return; }
      }
    }

    // マナ支払い（命中/失敗に関係なく消費）
    {
      const pay = spendMana(mana, seat, cost);
      if (!pay.ok) { fail("支払い失敗"); return; }
      mana = pay.mana;
    }

    // シナジー
    const syn = synergyBonus(units, su, act);
    if (syn.ok) {
      logLines.push(`[${seat}] シナジー発動：${syn.label} (${syn.found}/${syn.need}) → 成功+${syn.rate}% / 威力+${syn.power}`);
    }

    // 命中率計算（aim/jinx + game_state の blind/hitUp 等）
    let rate = Math.trunc(Number(act.rate ?? 0)) + Math.trunc(Number(syn.rate ?? 0));

    const atkSt = getStatus(su) || {};
    const aim = Math.trunc(Number(atkSt?.aim?.v ?? 0));
    const jinx = Math.trunc(Number(atkSt?.jinx?.v ?? 0));
    rate += aim;
    rate -= jinx;

    try{
      rate = calcHitRateWithStatus(su, rate);
    }catch{
      // 署名違いでも落とさない
      rate = clamp(rate, 0, 100);
    }
    rate = clamp(rate, 0, 100);

    // ダイス
    const r = 1 + Math.floor(Math.random() * 100);
    let hit = (r <= rate);

    // 回避（成功後に回避判定）
    let evaded = false;
    if (hit) {
      try{
        evaded = !!checkEvade(target, Math.random);
      }catch{
        // 署名違いでも落とさない（回避なし扱い）
        evaded = false;
      }
      if (evaded) hit = false;
    }

    const actionName = act.name ?? "行動";
    const rollAt = nowMs();

    // 対象リスト（aoe/pierce/単体/self）
    let targets = [];
    if (isSelfRange(rangeSpec)) {
      targets = [su];
    } else if (flags.aoe) {
      targets = collectAoeTargetsByMode(units, su, range, mode2);
      // 明示クリック対象が含まれないケースを避ける
      if (!targets.find(t=>t.id===target.id)) targets.push(target);
    } else if (flags.pierce) {
      targets = collectPierceTargetsByMode(units, su, target, range, mode2);
    } else {
      targets = [target];
    }

    const lastHitItems = [];
    const lastHitTargetId = (targets[0]?.id || target.id || su.id);

    // ★威力固定値：attacker.status.powerUp + synergy.power
    const powerUp = Math.trunc(Number(atkSt?.powerUp?.v ?? 0));
    // 互換 power を持ってたら powerUp として足す（%運用はしない）
    const legacyPower = Math.trunc(Number(atkSt?.power?.v ?? 0));
    const powerFlat = (powerUp || 0) + (legacyPower || 0) + Math.trunc(Number(syn.power ?? 0));

    const applyOne = (tgt) => {
      if (!tgt || tgt.hp <= 0) return;

      // self のとき、外部で target が変でもここで su に寄せる
      if (isSelfRange(rangeSpec) && tgt.id !== su.id) return;

      let dHp = Math.trunc(Number(hpDelta ?? 0));
      let dSp = Math.trunc(Number(spDelta ?? 0));

      // ★威力(固定)は「ダメージ側」だけ増幅（HP/SP どちらも）
      if (harmful && powerFlat !== 0) {
        if (dHp < 0) dHp -= powerFlat;
        if (dSp < 0) dSp -= powerFlat;
      }

      // 装甲(armor)は HPダメージだけ吸収
      if (harmful && dHp < 0) {
        const stt = getStatus(tgt) || {};
        let armor = Math.trunc(Number(stt?.armor?.v ?? 0));
        if (armor > 0) {
          const absorb = Math.min(armor, Math.abs(dHp));
          armor -= absorb;
          dHp += absorb; // ダメージ減少（負が0方向へ）
          // 反映
          if (!tgt.status || typeof tgt.status !== "object") tgt.status = {};
          if (armor > 0) tgt.status.armor = { v: armor };
          else delete tgt.status.armor;

          logLines.push(`[${seat}] 装甲吸収：${cardName(tgt.cardId)} ${absorb}`);
        }
      }

      // 反映
      if (dHp !== 0) tgt.hp = Math.trunc(Number(tgt.hp) + dHp);
      if (dSp !== 0) tgt.sp = Math.trunc(Number(tgt.sp) + dSp);

      // clamp
      const { maxHp, maxSp } = maxHpSpOfUnit(tgt);
      tgt.hp = clamp(tgt.hp, 0, maxHp);
      tgt.sp = clamp(tgt.sp, 0, maxSp);

      if (dHp !== 0) lastHitItems.push({ kind:"HP", delta:dHp, targetId:tgt.id });
      if (dSp !== 0) lastHitItems.push({ kind:"SP", delta:dSp, targetId:tgt.id });

      // addStatus（状態異常/バフ）
      try{
        const added = applyStatusesOnHit(tgt, act) || [];
        // 軽くログ（必要最低限）
        for (const a of added){
          if (!a?.name) continue;
          if (a.name === "armor") logLines.push(`[${seat}] 装甲+${a.v}：${cardName(tgt.cardId)}`);
          else if (a.name === "powerUp") logLines.push(`[${seat}] 威力+${a.v}：${cardName(tgt.cardId)}`);
          else if (a.name === "hitUp") logLines.push(`[${seat}] 命中+${a.v}%：${cardName(tgt.cardId)}`);
        }
      }catch{}

      // バフ系は game.js 側でも確実に（aim/jinx/powerUp/armor + 即時回復）
      try{
        const added2 = applyBuffStatusesLocal(tgt, act, s);
        for (const a of added2){
          if (!a?.name) continue;
          if (a.name === "armor" && a.v) logLines.push(`[${seat}] 装甲+${a.v}：${cardName(tgt.cardId)}`);
          else if (a.name === "aim" && a.v) logLines.push(`[${seat}] 命中+${a.v}%：${cardName(tgt.cardId)}`);
          else if (a.name === "jinx" && a.v) logLines.push(`[${seat}] 命中-${a.v}%：${cardName(tgt.cardId)}`);
          else if (a.name === "powerUp" && a.v) logLines.push(`[${seat}] 威力+${a.v}：${cardName(tgt.cardId)}`);
          else if (a.name === "recoverFatigue") logLines.push(`[${seat}] 疲労回復：${cardName(tgt.cardId)}`);
          else if (a.name === "recoverMove") logLines.push(`[${seat}] 移動回復：${cardName(tgt.cardId)}（2マス復活）`);
        }
      }catch{}

      // 処理後死亡/パニック
      if (Number(tgt.hp) <= 0) {
        tgt.hp = 0;
        const killer = (tgt.owner === su.owner) ? opponentSeat : seat;
        countKillIfNeeded(tgt, killer, kills, logLines, "撃破");
      } else {
        const killer = (tgt.owner === su.owner) ? opponentSeat : seat;
        setPanicAndCountIfNeeded(tgt, killer, kills, logLines);
      }

      // ノックバック（命中かつ harmful のときだけ）
      if (flags.knock && harmful && tgt.hp > 0 && !isPanic(tgt) && (dHp < 0 || dSp < 0)) {
        const moved = applyKnockback(units, su, tgt, flags.knockAmt);
        if (moved > 0) logLines.push(`[${seat}] ノックバック：${cardName(tgt.cardId)} x${moved}`);
      }
    };

    // ログ
    if (!hit) {
      if (evaded) logLines.push(`[${seat}] 回避：${cardName(target.cardId)}（${actionName}）`);
      else logLines.push(`[${seat}] 失敗：${cardName(su.cardId)} → ${cardName(target.cardId)}（${actionName}）`);
    } else {
      const tgtLabel =
        flags.aoe ? "（全体）" :
        flags.pierce ? "（貫通）" :
        isSelfRange(rangeSpec) ? "（self）" : "";
      logLines.push(`[${seat}] 成功：${cardName(su.cardId)} → ${cardName(target.cardId)}${tgtLabel}（${actionName}）`);
    }

    // 命中時だけ効果適用（支払い・疲労は確定）
    if (hit) {
      for (const t of targets) applyOne(t);
    }

    // ドロー（命中に関係なく発動させたいならここを外へ）
    if (hit) {
      const drawN = Math.trunc(Number(act.draw ?? 0));
      if (drawN > 0) {
        try{
          drawCards({ decks: s.decks, hands: s.hands }, seat, drawN); // 互換用の呼び出しに失敗しても落とさない
        }catch{}
        // このプロジェクトでは drawCards が (decks,hands,seat,n) の想定が多いのでこちらも試す
        try{
          drawCards(s.decks, s.hands, seat, drawN);
          logLines.push(`[${seat}] ドロー+${drawN}`);
        }catch{}
      }
    }

    // 疲労付与（followUp があるなら即解除＝「疲労回復サポート」の土台にもなる）
    su.fatigue = true;

    try{
      if (hasFollowUp(su)) {
        su.fatigue = false;
        // 1回使い切りにしたいなら消す（消さない運用もOK）
        if (su.status && typeof su.status === "object") delete su.status.followUp;
        logLines.push(`[${seat}] 追撃：疲労解除`);
      }
    }catch{}

    // 勝利判定
    const winner = checkWin({ ...s, units, kills });

    tx.set(stateRef, {
      mana,
      units,
      kills,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll: { at: rollAt, r, rate, hit, actionName },
      lastHit: { at: rollAt, targetId: lastHitTargetId, items: lastHitItems },
    }, { merge:true });
  });

  // local: self のときはターゲット残しでOKだけど、他は実行後に外す（誤爆防止）
  const defLocal2 = cardDefs?.[getSelectedUnit(currentState)?.cardId || ""];
  const actLocal2 = defLocal2?.actions?.[selectedActionIndex] || defLocal2?.actions?.[0];
  if (actLocal2 && !isSelfRange(actLocal2.range)) selectedTargetId = null;

  render(currentState);
}

// =====================
// 進化 実行
// =====================
btnDoEvolve?.addEventListener("click", async ()=>{
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;
  if (mode !== "evolve") return;
  if (!evoBaseId) return;
  if (selectedHandIndex == null) return;
  if (!evoCandidates.has(selectedHandIndex)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;

    let mana = normalizeMana(s.mana);
    const units = (Array.isArray(s.units) ? s.units : []).map(u=>({ ...u }));
    const hands = { ...(s.hands || {A:[],B:[]}) };
    hands.A = Array.isArray(hands.A) ? [...hands.A] : [];
    hands.B = Array.isArray(hands.B) ? [...hands.B] : [];
    const logLines = [...(s.log || [])];

    const base = units.find(u=>u.id===evoBaseId) || null;
    if (!base) return;
    if (base.owner !== seat) return;

        const baseDef = cardDefs?.[base.cardId];
    if (!baseDef) return;

    const hand = hands[seat] || [];
    const evoCid = hand[selectedHandIndex];
    const evoDef = evoCid ? cardDefs?.[evoCid] : null;
    if (!evoDef) return;

    // 進化条件（同属性 / コスト増）
    if (String(evoDef.type ?? "") !== String(baseDef.type ?? "")) return;
    if (!(Number(evoDef.cost ?? 0) > Number(baseDef.cost ?? 0))) return;

    // 追加コスト = 差分
    const extra = Math.max(0, Math.trunc(Number(evoDef.cost ?? 0) - Number(baseDef.cost ?? 0)));
    if (mana?.[seat]?.cur < extra) return;

    // 支払い（差分のみ）
    if (extra > 0) {
      const pay = spendMana(mana, seat, extra);
      if (!pay.ok) return;
      mana = pay.mana;
    }

    // 手札から進化カード消費
    hand.splice(selectedHandIndex, 1);

    // 進化反映（原則：進化先のHP/SPに更新、fatigueは維持）
    base.cardId = evoCid;
    base.panic = false; // 進化でパニック解除（演出的にも扱いやすい）
    base.countedAsKill = false;

    // HP/SPは進化先の最大値へ（フル回復）
    base.hp = Math.max(0, Math.trunc(Number(evoDef.hp ?? 0)));
    base.sp = Math.max(0, Math.trunc(Number(evoDef.sp ?? 0)));

    // 進化ログ
    logLines.push(
      `[${seat}] 進化：${cardName(baseDef?.id || baseDef?.cardId || base.cardId)} → ${cardName(evoCid)} (-${extra})`
    );

    // 進化FX
    const evoAt = nowMs();

    // 勝利判定
    const winner = checkWin({ ...s, units, kills: s.kills });

    tx.set(stateRef, {
      mana,
      hands,
      units,
      winner: winner || null,
      log: logLines.slice(-200),

      // ★追加：evolve fx
      lastEvolve: { at: evoAt, x: base.x, y: base.y, type: evoDef.type || "", cost: Number(evoDef.cost ?? 0) },
    }, { merge:true });
  });

  // local cleanup
  selectedHandIndex = null;
  evoBaseId = null;
  evoCandidates = new Set();
  setMode(null);
});

// =====================
// ターン終了
// =====================
btnEnd?.addEventListener("click", async ()=>{
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;

  await runTransaction(db, async (tx)=>{
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;

    const s = snap.data();
    if (s.winner || normSeat(s.turn) !== seat) return;

    // clone
    let mana = normalizeMana(s.mana);
    const units = (Array.isArray(s.units) ? s.units : []).map(u=>({ ...u }));

    const hands = { ...(s.hands || {A:[],B:[]}) };
    hands.A = Array.isArray(hands.A) ? [...hands.A] : [];
    hands.B = Array.isArray(hands.B) ? [...hands.B] : [];

    const decks = { ...(s.decks || {A:[],B:[]}) };
    decks.A = Array.isArray(decks.A) ? [...decks.A] : [];
    decks.B = Array.isArray(decks.B) ? [...decks.B] : [];

    const logLines = [...(s.log || [])];
    const nextTurn = (seat === "A") ? "B" : "A";
    const nextSeq = Math.trunc(Number(s.turnSeq ?? 1)) + 1;

    // ===== ターン終了時処理（smell等）=====
    try{
      // 署名違い吸収
      applySmellOnTurnEnd(units, seat, logLines);
    }catch{
      try{
        for (const u of units) applySmellOnTurnEnd(u, seat, logLines);
      }catch{}
    }

    // これ以上進める前に、死亡/パニック撃破の整合だけ軽く確認
    // （move/attack側で基本カウントしてるが、念のため）
    // ※ここでは kills をいじらない（多重加算回避のため）

    // ===== ターン切替 =====
    // 先に次ターンのマナ更新
    try{
      mana = startTurnMana(mana, nextTurn);
    }catch{
      try{ mana = startTurnMana(mana, nextTurn, CORE); }catch{}
    }

    // 次ターン開始時：次プレイヤーの疲労を回復（行動可能に）
    for (const u of units){
      if (!u || u.hp <= 0) continue;
      if (u.owner === nextTurn) {
        u.fatigue = false;
      }
      // 移動回数は turnSeq で判定するので、ここでは触らない
      // （moveUsedThisTurn で自動的に新ターン扱いになる）
    }

    // 次ターン開始：ドロー
    const drawN = Math.max(0, Math.trunc(Number(DRAW_PER_TURN ?? 0)));
    if (drawN > 0) {
      let drew = false;
      try{
        drawCards({ decks, hands }, nextTurn, drawN);
        drew = true;
      }catch{}
      try{
        drawCards(decks, hands, nextTurn, drawN);
        drew = true;
      }catch{}
      if (drew) logLines.push(`[${nextTurn}] ドロー+${drawN}`);
    }

    logLines.push(`--- ${nextTurn}ターン ---`);

    // 勝利判定（ターン終了でも勝ちが確定するケースがある）
    const winner = checkWin({ ...s, units, kills: s.kills });

    tx.set(stateRef, {
      turn: nextTurn,
      turnSeq: nextSeq,
      mana,
      hands,
      decks,
      units,
      winner: winner || null,
      log: logLines.slice(-200),

      // 見た目系はリセット
      lastRoll: null,
      lastHit: null,
      lastSupportRoll: null,
    }, { merge:true });
  });

  // local: 選択解除（誤爆防止）
  selectedTargetId = null;
  resetSupportPicks();
  exArmed = false;
  resetExPicks();
  // modeは維持したい場合もあるが、フリーズ感/誤爆を避けるためニュートラルへ
  setMode(null);
});

// =====================
// その他：初期表示
// =====================
render(currentState);