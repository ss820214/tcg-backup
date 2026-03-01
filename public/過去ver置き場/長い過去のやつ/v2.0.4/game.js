// public/game.js
// v20260129_exfull_fixed - v2.0.0 + Support cards + EX(1) panic/pinch FX
// FIX:
// - fxOnHit(): el未定義クラッシュ修正
// - EX armed中に通常クリック処理へ落ちる穴を塞ぐ（誤爆防止）
// - firebaseConfig の projectId 二重＆誤設定修正
//
// ※機能は削らず、挙動は「より安全に」なる方向で修正しています。

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

  // parse helpers (v1.7.0)
  parseAddStatus,
  parseTags,
} from "./game_state.js?v=20260126g";

import { isInRange } from "./game_range.js?v=20260126g";
import { supportEffectTextJa } from "./support_text.js?v=20260129b";

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
// ★射程表記を日本語に
// =====================
function rangeTokenToJa(tok){
  const t = String(tok||"").trim();
  if (!t) return "";

  if (t.toLowerCase() === "adj4") return "隣接(上下左右)";

  const m = t.match(/^(front|back|side|rf|lf|f)(\d+)$/i);
  if (!m) return t;

  const kind = m[1].toLowerCase();
  const n = Number(m[2] || 1);

  const k =
    (kind === "front" || kind === "f") ? "前" :
    (kind === "back") ? "後" :
    (kind === "side") ? "横" :
    (kind === "rf") ? "右前" :
    (kind === "lf") ? "左前" :
    t;

  return `${k}${n}`;
}

function rangeSpecToJa(rangeSpec){
  const n = Number(rangeSpec);
  if (Number.isFinite(n)) return `距離${Math.max(0, Math.trunc(n))}`;

  const s = String(rangeSpec ?? "").replaceAll('"','').trim();
  if (!s) return "";

  return s.split("+").map(x=>rangeTokenToJa(x.trim())).filter(Boolean).join("+");
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
  if (types.some(t => ["dmg","heal","modRate","bounce","powerUp","cleanse"].includes(t))) return { need:"unit" };
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
// Range helpers
// =====================
function forwardDy(owner){
  return owner === "A" ? -1 : 1;
}

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
  bleed: "🩸",
  fracture: "🦴",
  smell: "👃",
  lostSoul: "👻",
  blind: "🙈",
  evade: "💨",
  combo: "🔗",
  followUp: "⚡",
  aim: "🎯",     // support modRate(+)
  jinx: "🍀",    // support modRate(-) ※見た目だけ
  power: "💥",   // support powerUp
};

function statusIconsText(unit){
  const st = getStatus(unit);
  const keys = Object.keys(st || {});
  if (!keys.length) return "";

  const order = ["bleed","fracture","smell","lostSoul","blind","evade","combo","followUp","aim","jinx","power"];
  keys.sort((a,b)=> (order.indexOf(a)===-1?999:order.indexOf(a)) - (order.indexOf(b)===-1?999:order.indexOf(b)));

  return keys.map(k=>{
    const icon = STATUS_ICON[k] || "❔";
    const v = st[k]?.v;
    if (k === "evade") return `${icon}${Number(v ?? 0)}`;
    if (k === "bleed") return `${icon}${Number(v ?? 10)}`;
    if (k === "smell") return `${icon}${Number(v ?? 10)}`;
    if (k === "aim") return `${icon}+${Number(v ?? 0)}`;
    if (k === "jinx") return `${icon}-${Number(v ?? 0)}`;
    if (k === "power") return `${icon}+${Number(v ?? 0)}%`;
    return (v != null && v !== true) ? `${icon}${icon}${v}` : `${icon}`;
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
      m === "attack" ? "行動：自軍を選択→緑枠の敵をクリックで攻撃（攻撃後は疲労）" :
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

// ※Attackボタンは後半で「押すだけで実行」に統一して付ける（重複防止）
if (btnAttack) btnAttack.onclick = null;

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
      if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
      if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
      if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
      const effect = parts.length ? parts.join(" / ") : "効果";

      const addS = displayAddStatus(a);
      const rangeJa = rangeSpecToJa(a.range);

      html += `【${a.cost}】${a.name}<br>`;
      html += `射程:${rangeJa || a.range} / 成功:${a.rate}%${addS}<br>`;
      html += `効果:${effect}<br><br>`;
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
  const aim = Number(stt?.aim?.v ?? 0);
  const jinx = Number(stt?.jinx?.v ?? 0);
  const power = Number(stt?.power?.v ?? 0);
  if (aim || jinx || power) {
    html += `支援：命中+${aim}% / 命中-${jinx}% / 威力+${power}%<br>`;
  }

  html += `状態:${isPanic(u) ? "パニック（撃破扱い/行動不能）" : "通常"}<br>`;
  html += `状態異常:${safeStatusText(u)}<br><br>`;

  const acts = def.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  html += `<b>行動</b><br>`;

  acts.forEach((a)=>{
    const parts = [];
    if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
    if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
    if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);

    const effect = parts.length ? parts.join(" / ") : "効果";
    const addS = displayAddStatus(a);

    const rangeLabel = (a.range ?? "?");
    const rangeJa = rangeSpecToJa(rangeLabel);

    const warn = (rangeLabel === "?" || rangeLabel === "" || rangeLabel == null)
      ? `<span style="color:#ff6;"> ※range未設定</span>`
      : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeJa || rangeLabel} 成功:${a.rate ?? "?"}%)${addS}${warn}<br>`;
    html += `<span class="small">効果:${effect}</span><br>`;
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
  else if (mode === "attack" && !selectedTargetId) quickMsgEl.textContent = "緑枠の敵をクリックで攻撃！";
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

    // FIX: el未定義だった
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
// - hpDelta/spDelta（回復:+ / ダメ:-）を正とする
// - 旧 dmg/spDmg（ダメ:+）しか無い場合は自動変換する
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

  // 無ければ0扱い
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

// 機械判定：
// - harmfulのみ → enemy
// - beneficialのみ → ally
// - 両方 → any（ほぼ使わない想定だが保険）
// - どっちも0 → enemy（既存互換。ドロー専用などは今後別途対応でもOK）
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
    if (mode === "enemy" && isPanic(u)) continue; // 既存互換：敵パニックは対象外

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
      // サポートは lastRoll/lastHit は消しておく（混ざると見づらい）
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });

  // local reset after attempt
  selectedHandIndex = null;
  resetSupportPicks();
  render(currentState);
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

  const plan = supportPlan(def); // same rule
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
  render(currentState);
}

exBtnEl?.addEventListener("click", ()=>{
  const st = currentState;
  if (!st) return;

  // 対象不要なら即実行、必要なら armed
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
  // EX中は support側も事故防止でリセット
  resetSupportPicks();
  render(currentState);
});

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
        ? `行動: ${acts[0].name} / 射程:${rangeSpecToJa(acts[0].range) || acts[0].range} / ${acts[0].rate}%`
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

      // サポートカードを選んだ状態で support モードなら「対象選択へ」誘導
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

  // 行動ピッカー（自軍のみ / サポは別 / EX armed のときはすでに描画済み）
  if (!exArmed) {
    actionPickerEl.innerHTML = "";

    if (mode === "support") {
      // サポート説明
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
      // 通常行動
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
          const rangeJa = rangeSpecToJa(a.range) || a.range;
          s2.textContent = `射程:${rangeJa} 成功:${a.rate}%${addS} 効果:${parts.length ? parts.join(" / ") : "効果"}`;
          actionPickerEl.appendChild(s2);
        });
      }
    } else {
      actionPickerEl.textContent = "自軍キャラを選ぶと行動が出ます";
    }
  }

  // ===== ピンチ / EX UI 更新（毎render） =====
  updatePinchUI(st);
  renderEx(st);

  // ===== 盤面 =====
  boardEl.innerHTML = "";

  // attack range
  const rangeMap = buildRangeMap(st);

  // support plan
  const supDef = (mode === "support") ? selectedHandDef(st) : null;
  const supOn  = (mode === "support" && myTurn && supDef && isSupportCard(supDef));
  const supPlan = supOn ? supportPlan(supDef) : { need:"none" };

  // EX plan (armed)
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

      // ===== support ハイライト候補 =====
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

      // ===== EX ハイライト候補（CSS追加なしで support系クラス流用） =====
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

        // 敵ターゲット選択枠（モード問わず）
        if (selectedTargetId && u.id === selectedTargetId && u.owner !== seat) {
          cell.classList.add("targetOk");
        }

        // 自軍選択枠
        if (u.id === selectedUnitId) cell.classList.add("selected");

        // support候補/選択
        if (isSupportUnitCandidate) cell.classList.add("supportOk");
        if (isPick1) cell.classList.add("supportPick1");
        if (isPick2) cell.classList.add("supportPick2");

        // EX候補/選択（support系クラス流用）
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
        // summon候補
        const manaNow = normalizeMana(st.mana);
        if (!st.winner && myTurn && mode==="summon" && selectedHandIndex!=null) {
          const cid = (st.hands?.[seat] || [])[selectedHandIndex];
          const def = cardDefs[cid];
          const onField = countMyAliveUnits(st.units, seat);
          if (def && summonArea(seat, y) && manaNow[seat].cur >= Number(def.cost ?? 0) && onField < MAX_UNITS_PER_PLAYER) {
            cell.classList.add("summon");
          }
        }

        // support moveTo 空マス候補 & 選択マス
        if (isSupportCellCandidate) cell.classList.add("supportCellOk");
        if (isPickedCell) cell.classList.add("targetOk");

        // EX moveTo 空マス候補 & 選択マス（流用）
        if (isExCellCandidate) cell.classList.add("supportCellOk");
        if (isExPickedCell) cell.classList.add("targetOk");
      }

      // attack range
      const rm = rangeMap.get(`${x},${y}`);
      if (rm) {
        cell.classList.add("rangeOk");
        if (rm.ok === false) cell.classList.add("rangeBlocked");
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

  if (lastTurnSeen && currentState.turn !== lastTurnSeen) {
    selectedTargetId = null;
    resetSupportPicks();

    // ★ターンが変わったら EX armed は解除（誤爆防止）
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

    const winner = encodeURIComponent(currentState.winner);
    const room   = encodeURIComponent(roomId);
    const player = encodeURIComponent(playerId);
    const mySeat = encodeURIComponent(seat || "");

    location.href =
      `victory.html?room=${room}&player=${player}&winner=${winner}&seat=${mySeat}`;
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
        // ユニット選択
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
        // 空マス選択（unitCell）
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

    // FIX: EX armed中は下へ落とさない（誤爆防止）
    return;
  }

  // ===== 敵クリック：いつでも詳細見れる =====
  if (uHereLocal && uHereLocal.owner !== seat) {
    selectedTargetId = uHereLocal.id;
    showUnitDetail(uHereLocal, st);

    // support の対象に敵もOK（カード効果次第なので制限しない）
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

    // attack モード：有効ターゲットならクリックで即実行
    if (mode === "attack" && canControl(st)) {
      const su = getSelectedUnit(st);
      const def = su ? cardDefs?.[su.cardId] : null;
      const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;
      const tMode = act ? actTargetMode(act) : "enemy";

      // 敵クリックで成立する行動だけ
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

  // 自軍クリック：操作対象として選択
  // ★攻撃モード時：行動が「味方対象」なら味方クリックをターゲットとして扱う
  if (mode === "attack" && canControl(st) && selectedUnitId && uHereLocal && uHereLocal.owner === seat) {
    const attacker = getSelectedUnit(st);
    const aDef = attacker ? cardDefs?.[attacker.cardId] : null;
    const act = aDef?.actions?.[selectedActionIndex] || aDef?.actions?.[0] || null;

    if (act) {
      const tMode = actTargetMode(act);

      // 味方対象(or any) のとき：クリックした味方をターゲットにする
      if (tMode === "ally" || tMode === "any") {
        selectedTargetId = uHereLocal.id;
        showUnitDetail(uHereLocal, st);
        render(st);

        const rm = buildRangeMap(st).get(`${x},${y}`);
        if (isSelfRange(act.range) || (rm && rm.ok !== false)) {
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

    // support ターゲット選択
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
      // 空きだけ許可
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

      // サポートカードは召喚不可
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

      tx.set(stateRef, { mana, hands, units, kills, winner: winner || null, log: logLines.slice(-200) }, { merge:true });
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

    // 何もしない
  });
}

// =====================
// ★UX：攻撃は「ボタン押下」 or 「緑枠の敵クリック」で実行
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

  // selfレンジなら target 未選択でも自分を対象にできる
  let tgtLocal = getSelectedTarget(st);
  if (!tgtLocal && isSelfRange(actLocal.range)) {
    tgtLocal = suLocal;
    selectedTargetId = suLocal.id;
  }
  if (!tgtLocal) return;

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
    const target = units.find(u => u.id === selectedTargetId) || null;

    if (!su || !target) return;
    if (su.owner !== seat) return;

    const fail = (msg) => {
      logLines.push(`[${seat}] 行動不可：${msg}`);
      tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
    };

    if (isPanic(su) || su.fatigue) { fail("行動者がパニック or 疲労"); return; }

    const def = cardDefs[su.cardId];
    const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0];
    if (!act) { fail("行動(act)が取れない"); return; }

    const cost = Number(act.cost ?? 0);
    if (mana[seat].cur < cost) { fail(`マナ不足 cur=${mana[seat].cur} cost=${cost}`); return; }

    // ★hpDelta/spDelta でターゲット判定
    const mode2 = actTargetMode(act); // enemy/ally/any
    const { hpDelta, spDelta, harmful } = actHarmBenef(act);

    if (mode2 === "enemy" && target.owner === seat) { fail("この行動は敵のみ対象"); return; }
    if (mode2 === "ally"  && target.owner !== seat) { fail("この行動は味方のみ対象"); return; }

    // enemy行動のときだけ「パニック対象不可」維持（既存互換）
    if (mode2 !== "ally" && target.owner !== seat && isPanic(target)) { fail("対象がパニック"); return; }

    const rangeSpec = act.range;
    const flags = actFlags(act);
    const range = rangeSpecMaxDist(su, rangeSpec);

    // selfレンジ
    if (isSelfRange(rangeSpec)) {
      if (target.id !== su.id) { fail("射程:self は自分のみ対象"); return; }
    } else {
      // AOE / 通常
      if (flags.aoe) {
        const dist = Math.abs(su.x - target.x) + Math.abs(su.y - target.y);
        if (dist > range) { fail(`射程外(aoe) range=${range} dist=${dist}`); return; }
      } else {
        if (!inActionRange(su, target.x, target.y, rangeSpec)) { fail(`射程外 range=${String(rangeSpec)}`); return; }
      }

      if (!flags.aoe && !flags.pierce) {
        if (isLineBlocked(units, su, target)) { fail("前にユニットがいて届かない（遮蔽）"); return; }
      }
    }

    const pay = spendMana(mana, seat, cost);
    if (!pay.ok) return;
    mana = pay.mana;

    // ★support powerUp は「威力%」扱い：回復/ダメ両方に乗せる
    const stt = getStatus(su);
    const powerUp = Math.max(0, Number(stt?.power?.v ?? 0));
    const mul = 1 + (powerUp / 100);

    // 命中率（回復でも「成功率」は必要：今まで通り判定）
    const baseRate = Number(act.rate ?? 0);
    const aim = Math.max(0, Number(stt?.aim?.v ?? 0));
    const jinx = Math.max(0, Number(stt?.jinx?.v ?? 0));
    const rateBuffed = baseRate + aim - jinx;
    const rate1 = calcHitRateWithStatus(su, rateBuffed);

    const r1 = Math.floor(Math.random() * 100) + 1;
    let hit1 = (r1 <= rate1);

    const lastRoll = { at: nowMs(), r: r1, rate: rate1, hit: hit1, actionName: act.name || "action", fromId: su.id, toId: target.id };

    if (!hit1) {
      su.fatigue = true;
      if (hasFollowUp(su)) su.fatigue = false;

      logLines.push(`[${seat}] 行動失敗：${act.name} (-${cost})`);
      const winner = checkWin({ ...s, units, kills });

      tx.set(stateRef, {
        mana, units, kills,
        winner: winner || null,
        log: logLines.slice(-200),
        lastRoll,
        lastHit: null
      }, { merge:true });
      return;
    }

    // 対象列挙
    let targets = [target];

    if (flags.aoe) {
      targets = collectAoeTargetsByMode(units, su, range, mode2);
      logLines.push(`[${seat}] 全体行動：対象 ${targets.length}体`);
    } else if (flags.pierce && !isSelfRange(rangeSpec)) {
      targets = collectPierceTargetsByMode(units, su, target, range, mode2);
      logLines.push(`[${seat}] 貫通行動：対象 ${targets.length}体`);
    }

    const applyDeltaAndStatus = (tgt, actObj, labelSuffix="") => {
      const items = [];

      const { hpDelta: h0, spDelta: s0 } = getActDeltas(actObj);

      // 威力倍率
      const h = Math.trunc(h0 * mul);
      const sp = Math.trunc(s0 * mul);

      const { maxHp, maxSp } = maxHpSpOfUnit(tgt);

      if (h !== 0) {
        tgt.hp = clamp(Number(tgt.hp) + h, 0, maxHp);
        items.push({ kind:"HP", delta: h });
      }
      if (sp !== 0) {
        tgt.sp = clamp(Number(tgt.sp) + sp, 0, maxSp);
        items.push({ kind:"SP", delta: sp });
      }

      // 状態異常/付与は今まで通り（回復でも“付与”したいケースがあるので維持）
      const added = applyStatusesOnHit(tgt, actObj);
      if (added.length) {
        const sTxt = added.map(x=>{
          if (x.name === "evade") return `回避${Number(x.v)}%`;
          if (x.name === "bleed") return `出血(移動時HP-${Number(x.v)})`;
          if (x.name === "smell") return `匂い(終了時SP-${Number(x.v)})`;
          return x.name;
        }).join(",");
        logLines.push(`[${seat}] 状態付与${labelSuffix}：${cardName(tgt.cardId)} ← ${sTxt}`);
      }

      // ★敵へのダメージ行動だけ：パニック＆撃破カウント
      if (mode2 !== "ally" && tgt.owner !== seat) {
        setPanicAndCountIfNeeded(tgt, seat, kills, logLines, "パニック撃破");
      }

      // ★味方対象でSPを回復してパニック解除（撃破カウントは戻さない）
      if (tgt.owner === seat && tgt.panic && Number(tgt.hp) > 0 && Number(tgt.sp) > 0) {
        tgt.panic = false;
        logLines.push(`[${seat}] パニック解除：${cardName(tgt.cardId)}`);
      }

      return { items };
    };

    let lastHit = null;

    for (const tgt of targets) {
      if (!tgt || tgt.hp <= 0) continue;

      // 回避/コンボ/ノックバックは “害がある行動” のみ（既存感を壊さない）
      if (harmful && tgt.owner !== seat) {
        if (isPanic(tgt)) continue;

        if (checkEvade(tgt, ()=>Math.random())) {
          logLines.push(`[${seat}] 回避発動：${cardName(tgt.cardId)} が攻撃を回避`);
          continue;
        }
      }

      const hitItems = applyDeltaAndStatus(
        tgt,
        act,
        flags.aoe ? "(全体)" : flags.pierce ? "(貫通)" : ""
      );

      if (!lastHit) lastHit = { at: nowMs(), targetId: tgt.id, items: hitItems.items };

      // コンボ（害がある行動のみ）
      if (harmful && tgt.owner !== seat && canCombo(su, act) && tgt.hp > 0 && !isPanic(tgt)) {
        const rate2 = Math.max(0, rate1 - 10);
        const r2 = Math.floor(Math.random() * 100) + 1;
        let hit2 = (r2 <= rate2);

        if (hit2 && checkEvade(tgt, ()=>Math.random())) {
          hit2 = false;
          logLines.push(`[${seat}] 回避発動：${cardName(tgt.cardId)} がコンボ追撃を回避`);
        }

        logLines.push(`[${seat}] コンボ判定：${r2}/${rate2}% → ${hit2 ? "成功" : "失敗"}`);

        if (hit2) {
          const hitItems2 = applyDeltaAndStatus(
            tgt,
            act,
            flags.aoe ? "(全体/コンボ)" : flags.pierce ? "(貫通/コンボ)" : "(コンボ)"
          );

          if (lastHit && lastHit.targetId === tgt.id) {
            lastHit.items = (lastHit.items || []).concat(hitItems2.items || []);
          } else if (!lastHit) {
            lastHit = { at: nowMs(), targetId: tgt.id, items: hitItems2.items };
          }

          if (tgt.hp <= 0) {
            countKillIfNeeded(tgt, seat, kills, logLines, "撃破(コンボ)");
          }
        }
      }

      // ノックバック（害がある行動のみ）
      if (harmful && tgt.owner !== seat && flags.knock) {
        const moved = applyKnockback(units, su, tgt, flags.knockAmt);
        if (moved > 0) logLines.push(`[${seat}] ノックバック：${cardName(tgt.cardId)} を ${moved}マス後退`);
        else logLines.push(`[${seat}] ノックバック：後退できない（壁/ユニット/端）`);
      }

      // 撃破カウント（害がある行動のみ）
      if (harmful && tgt.owner !== seat && tgt.hp <= 0) {
        countKillIfNeeded(tgt, seat, kills, logLines, "撃破");
      }
    }

    // 行動者疲労（回復でも疲労は今まで通り付ける）
    su.fatigue = true;
    if (hasFollowUp(su)) {
      su.fatigue = false;
      logLines.push(`[${seat}] 追撃：疲労解除`);
    }

    const kindLabel =
      (hpDelta > 0 || spDelta > 0) && !(hpDelta < 0 || spDelta < 0) ? "回復/支援" : "攻撃";

    logLines.push(`[${seat}] ${kindLabel}成功：${act.name} (-${cost})`);

    const winner = checkWin({ ...s, units, kills });

    tx.set(stateRef, {
      mana,
      units,
      kills,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll,
      lastHit: lastHit || null
    }, { merge:true });
  });
}

// ★UX：攻撃モードの「攻撃ボタン」も実行に寄せる（押すだけで殴る）
btnAttack?.addEventListener("click", async ()=> {
  setMode("attack");
  await tryExecuteAttack();
});

// =====================
// 進化（ダメージ引き継ぎ）
// =====================
btnDoEvolve.onclick = async () => {
  const st = currentState;
  if (!st || st.winner) return;
  if (!canControl(st)) return;

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
    const kills = { ...(s.kills || {A:0,B:0}) };

    const base = units.find(u => u.id === evoBaseId) || null;
    if (!base) return;
    if (base.owner !== seat) return;
    if (isPanic(base)) return;

    const baseDef = cardDefs[base.cardId];
    if (!baseDef) return;

    const hand = hands[seat] || [];
    const cid = hand[selectedHandIndex];
    const evoDef = cardDefs[cid];
    if (!cid || !evoDef) return;

    // サポートカードは進化不可
    if (isSupportCard(evoDef)) return;

    if (String(evoDef.type) !== String(baseDef.type)) return;
    if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

    const extra = Number(evoDef.cost) - Number(baseDef.cost);
    if (mana[seat].cur < extra) return;

    const pay = spendMana(mana, seat, extra);
    if (!pay.ok) return;
    mana = pay.mana;

    hand.splice(selectedHandIndex, 1);

    const beforeName = cardName(base.cardId);
    const afterName = cardName(cid);

    const baseMaxHP = Math.max(0, Number(baseDef.hp ?? 0));
    const baseMaxSP = Math.max(0, Number(baseDef.sp ?? 0));
    const curHP = Math.max(0, Number(base.hp ?? 0));
    const curSP = Math.max(0, Number(base.sp ?? 0));
    const takenHP = Math.max(0, baseMaxHP - curHP);
    const takenSP = Math.max(0, baseMaxSP - curSP);

    const evoMaxHP = Math.max(0, Number(evoDef.hp ?? 0));
    const evoMaxSP = Math.max(0, Number(evoDef.sp ?? 0));

    const newHP = Math.max(0, Math.min(evoMaxHP, evoMaxHP - takenHP));
    const newSP = Math.max(0, Math.min(evoMaxSP, evoMaxSP - takenSP));

    base.cardId = cid;
    base.hp = newHP;
    base.sp = newSP;

    base.panic = false;
    clearStatuses(base);
    base.fatigue = false;

    setPanicAndCountIfNeeded(base, opponentSeat, kills, logLines, "パニック撃破(進化後)");
    if (Number(base.hp) <= 0) {
      base.hp = 0;
      countKillIfNeeded(base, opponentSeat, kills, logLines, "撃破(進化後)");
    }

    logLines.push(`[${seat}] 進化：${beforeName} → ${afterName} (-${extra})`);
    logLines.push(`[${seat}] 進化引継：HP欠損${takenHP} / SP欠損${takenSP}`);

    const winner = checkWin({ ...s, units, kills });

    tx.set(stateRef, {
      mana,
      units,
      hands,
      decks,
      kills,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });
};

// =====================
// ターンエンド（既存 + 状態異常解除）
// - 匂いでSP<=0になったら「パニック撃破」を相手に加算
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
    const kills = { ...(s.kills || {A:0,B:0}) };

    const units = unitsSrc.map(u => {
      const nu = { ...u };

      if (nu.panic) nu.fatigue = true;

      if (nu.owner === curTurn) {
        const smellDmg = applySmellOnTurnEnd(nu);
        if (smellDmg > 0) logLines.push(`[${curTurn}] 匂い：${cardName(nu.cardId)} SP-${smellDmg}`);

        const killer = (curTurn === "A") ? "B" : "A";
        setPanicAndCountIfNeeded(nu, killer, kills, logLines, "パニック撃破(匂い)");

        clearStatuses(nu);
      }

      if (nu.owner === nextTurn) {
        if (!nu.panic) nu.fatigue = false;
      }

      return nu;
    });

    let mana = normalizeMana(s.mana);
    mana = startTurnMana(mana, nextTurn);

    const before = (decks[nextTurn] || []).length;
    drawCards(decks, hands, nextTurn, DRAW_PER_TURN);
    const after = (decks[nextTurn] || []).length;

    if (before !== after) {
      const drew = hands[nextTurn][hands[nextTurn].length - 1];
      logLines.push(`[${nextTurn}] ドロー：${cardName(drew)}`);
    } else {
      logLines.push(`[${nextTurn}] ドロー：山札なし`);
    }

    logLines.push(`--- ${nextTurn}ターン ---`);

    const nextSeq = Number(s.turnSeq ?? 1) + 1;
    const winner = checkWin({ ...s, units, kills });

    tx.set(stateRef, {
      turn: nextTurn,
      turnSeq: nextSeq,
      mana,
      decks,
      hands,
      units,
      kills,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });
};