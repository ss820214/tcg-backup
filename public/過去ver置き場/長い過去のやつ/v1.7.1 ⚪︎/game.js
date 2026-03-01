// public/game.js
// v1.7.0
// 追加：
// - 疲労でも進化OK（進化後疲労なし）
// - 移動制限：1体につきターン中2マスまで
// - knockback（addStatus=knockback, tags=knockback:2 など）
// - 射程3の自動貫通を廃止、通常攻撃は直線時に遮蔽物（前のユニット）で止まる
// - 攻撃属性：pierce/aoe を addStatus に書く（貫通/全体）
// - lastHit FX 維持

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
} from "./game_core.js?v=20260126a";

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

  // NEW: parse helpers (v1.7.0)
  parseAddStatus,
  parseTags,
} from "./game_state.js?v=20260126a";

import { isInRange } from "./game_range.js?v=20260126a";

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
   表示用ヘルパー（追加）
   - [object Object]対策
   - addStatus表示の整形（tagsは表示しない）
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

// addStatusは「状態異常だけ」表示したい
function displayAddStatus(act){
  const list = parseAddStatus(act?.addStatus) || [];

  // 仕様上 addStatus に書かれてる “攻撃属性” はUI表示しない
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
      // v1.7.0: turnSeq が無ければ補完（移動制限のリセットに使う）
      if (typeof s.turnSeq !== "number") tx.set(stateRef, { turnSeq: 1 }, { merge:true });
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
      turnSeq: 1, // ★v1.7.0: ターン通し番号
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
function forwardDy(owner){
  // Aは下側→上に進む想定（必要ならここだけ反転）
  return owner === "A" ? -1 : 1;
}

// "front3" を 1..3 の直線射程として展開
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
      else if (kind === "rf") res.push({dx:k, dy:dyF*k});   // 斜め前右
      else if (kind === "lf") res.push({dx:-k, dy:dyF*k});  // 斜め前左
    }
    return res;
  }

  if (t.toLowerCase() === "adj4") {
    return [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
  }

  return []; // 未対応
}

function parseRangeSpecToOffsets(rangeSpec, owner){
  // 数値ならマンハッタン距離として展開（半径）
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

  // "front1+side1" など
  const s = String(rangeSpec || "").replaceAll('"','').trim();
  if (!s) return [];

  const parts = s.split("+").map(x=>x.trim()).filter(Boolean);
  let res = [];
  for (const p of parts){
    res = res.concat(expandTokenToOffsets(p, owner));
  }
  // 重複除去
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

// aoe/pierce の “range数値” が必要なとき用（最大距離を拾う）
function rangeSpecMaxDist(attacker, rangeSpec){
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  let mx = 0;
  for (const o of offs){
    mx = Math.max(mx, Math.abs(o.dx) + Math.abs(o.dy));
  }
  return mx;
}

function showDiceRoll(lastRoll){
  if (!diceEl) return;
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
  if (modeHintEl) {
    modeHintEl.textContent =
      m === "summon" ? "召喚：手札→フィールド（召喚エリアのみ）" :
      m === "move"   ? "移動：自軍を選択→移動先をクリック（マナ-1 / ターン中2マスまで）" :
      m === "attack" ? "行動：自軍を選択→技を選択→敵をクリック（攻撃後は疲労）" :
      m === "evolve" ? "進化：進化元を選択→手札候補が光る→手札選択→進化実行（疲労でも可）" :
      "ユニット選択→🏃移動 / ⚔️行動 を選択";
  }
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
  if (!d || !detailEl) return;

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

      // ★ tagsは表示しない / addStatusは状態異常だけ（無ければ何も出さない）
      const addS = displayAddStatus(a);

      html += `【${a.cost}】${a.name}<br>`;
      html += `射程:${a.range} / 成功:${a.rate}%${addS}<br>`;
      html += `効果:${effect}<br><br>`;
    });
  }
  detailEl.innerHTML = html;
}

function showUnitDetail(u){
  if (!detailEl) return;

  const def = cardDefs[u.cardId] || {};
  let html = `<b>${cardName(u.cardId)}</b> <span class="small">(${u.cardId})</span><br>`;
  html += `属性:${def.type ?? "?"} / 所有:${u.owner}<br>`;
  html += `HP:${u.hp} SP:${u.sp}<br>`;
  html += `疲労:${u.fatigue ? "あり" : "なし"}<br>`;

  const curSeq = Number(currentState?.turnSeq ?? 1);
  const used = (Number(u.moveTurnSeq ?? 0) === curSeq) ? Number(u.moveUsed ?? 0) : 0;
  html += `移動:${used}/2（ターン中）<br>`;

  html += `状態:${isPanic(u) ? "パニック（死亡判定/行動不能）" : "通常"}<br>`;
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

    // ★ tagsは表示しない / addStatusは状態異常だけ
    const addS = displayAddStatus(a);

    const rangeLabel = (a.range ?? "?");
    const warn = (rangeLabel === "?" || rangeLabel === "" || rangeLabel == null)
      ? `<span style="color:#ff6;"> ※range未設定</span>`
      : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLabel} 成功:${a.rate ?? "?"}%)${addS}${warn}<br>`;
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

  // 骨折/パニックは移動不可
  if (btnQuickMove) {
    const used = Number(su.moveUsed ?? 0);
    btnQuickMove.disabled = isPanic(su) || isMoveBlockedByStatus(su) || used >= 2;
  }

  const canPay = act ? (mana[seat].cur >= Number(act.cost ?? 0)) : false;
  if (btnQuickAttack) btnQuickAttack.disabled = !act || fatigued || !canPay || isPanic(su);

  if (!quickMsgEl) return;
  if (isPanic(su)) quickMsgEl.textContent = "パニック中：行動不能（死亡判定）";
  else if (isMoveBlockedByStatus(su)) quickMsgEl.textContent = "骨折：移動不可";
  else if ((Number(su.moveUsed ?? 0) >= 2)) quickMsgEl.textContent = "移動上限：このターンはもう動けません";
  else if (!act) quickMsgEl.textContent = "行動がないカードです";
  else if (fatigued) quickMsgEl.textContent = "疲労中：行動できません（移動はOK）";
  else if (!canPay) quickMsgEl.textContent = "マナ不足：行動できません";
  else quickMsgEl.textContent = "";
}

// =====================
// FX helpers
// =====================
function cellIndex(x,y){ return y*W + x; }

function fxFlash(kind="hit"){
  if (!fxFlashEl) return;
  fxFlashEl.classList.remove("on","kill");
  void fxFlashEl.offsetWidth; // reflow
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
    const amt = Number(it.amount || 0);
    if (!amt) continue;

    const el = document.createElement("div");
    el.className = "floatDmg";
    el.textContent = `${kind === "SP" ? "SP" : "HP"}-${amt}`;
    cell.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 1000);
  }

  const kill = Number(tu.hp) <= 0;
  fxFlash(kill ? "kill" : "hit");
}

// =====================
// NEW helpers: 攻撃属性/遮蔽/ノックバック/ターゲット列挙
// =====================
function actFlags(act){
  const list = parseAddStatus(act?.addStatus);
  const has = (s) => list.includes(s);

  const pierce = has("pierce") || has("貫通");
  const aoe    = has("aoe") || has("全体") || has("all");
  const knock  = has("knockback") || has("ノックバック");

  const tags = parseTags(act?.tags);
  const knockAmt = Number(tags.knockback ?? tags.kb ?? 1);

  return { pierce, aoe, knock, knockAmt: (Number.isFinite(knockAmt) ? knockAmt : 1) };
}

function isOccupied(units, x, y){
  return !!units.find(u => u.hp > 0 && u.x === x && u.y === y);
}

// 直線遮蔽（同じ行or列のときのみ判定）
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
  // 斜め/非直線は「遮蔽判定しない」（仕様が曖昧になるため）
  return false;
}

function collectPierceTargets(units, attacker, firstTarget, range){
  const res = [];
  if (!attacker || !firstTarget) return res;

  const ax = attacker.x, ay = attacker.y;
  const tx = firstTarget.x, ty = firstTarget.y;

  // 直線じゃない → 単体
  if (!(ax === tx || ay === ty)) return [firstTarget];

  const dx = (tx === ax) ? 0 : (tx > ax ? 1 : -1);
  const dy = (ty === ay) ? 0 : (ty > ay ? 1 : -1);

  for (let d = 1; d <= range; d++){
    const x = ax + dx * d;
    const y = ay + dy * d;
    if (x < 0 || x >= W || y < 0 || y >= H) break;

    const u = units.find(u => u.hp > 0 && u.x === x && u.y === y);
    if (!u) continue;
    if (u.owner !== attacker.owner) res.push(u);
  }
  return res;
}


// aoe用：距離<=range の敵を全員
function collectAoeTargets(units, attacker, range){
  const res = [];
  for (const u of units){
    if (!u || u.hp <= 0) continue;
    if (u.owner === attacker.owner) continue;
    if (isPanic(u)) continue;

    const dist = Math.abs(attacker.x - u.x) + Math.abs(attacker.y - u.y);
    if (dist <= range) res.push(u);
  }
  return res;
}

// knockback：攻撃者から見て「遠ざかる方向」に N マス押す（塞がってたら止まる）
function applyKnockback(units, attacker, target, amount){
  if (!attacker || !target) return 0;
  if (target.hp <= 0) return 0; // 死んでたら動かさない
  let n = Math.max(0, Math.trunc(Number(amount ?? 0)));
  if (n <= 0) return 0;

  const ax = attacker.x, ay = attacker.y;
  const tx = target.x, ty = target.y;

  let dx = 0, dy = 0;
  const diffX = tx - ax;
  const diffY = ty - ay;

  // 優先軸：大きい方（同値ならx）
  if (Math.abs(diffX) >= Math.abs(diffY)) dx = (diffX === 0 ? 0 : (diffX > 0 ? 1 : -1));
  else dy = (diffY === 0 ? 0 : (diffY > 0 ? 1 : -1));

  // 両方0なら押せない
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

  // ===== 手札 =====
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

        // ★tags表示しない / addStatusは状態異常だけ
        const addS = displayAddStatus(a);

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

        // ★ [object Object]対策
        const stText = safeStatusText(u);
        const statusTag = (stText !== "なし") ? `<div class="fatigueTag" style="top:34px;">${stText}</div>` : "";

        // ★ 左上にコスト表示（CSS .unitCost に合わせる）
        const costLabel = (def.cost ?? "?");

        cell.innerHTML = `
          ${u.fatigue ? `<div class="fatigueTag">疲労</div>` : ""}
          ${u.panic ? `<div class="fatigueTag" style="top:18px;">パニック</div>` : ""}
          ${statusTag}
          <div class="unitCost">${costLabel}</div>
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
let lastHitSeenAt = 0;

onSnapshot(stateRef, (snap) => {
  if (!snap.exists()) return;
  currentState = snap.data();
  render(currentState);

  // lastHit FX（新しいものだけ）
  const lhAt = Number(currentState?.lastHit?.at ?? 0);
  if (lhAt && lhAt !== lastHitSeenAt) {
    lastHitSeenAt = lhAt;
    setTimeout(()=> fxOnHit(currentState), 0);
  }

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

  // 敵クリック：攻撃モード以外なら「選択だけ」
  if (uHereLocal && uHereLocal.owner !== seat && mode !== "attack") {
    selectedUnitId = uHereLocal.id;
    showUnitDetail(uHereLocal);
    render(st);
    return;
  }

  // 自軍クリックは常に選択
  if (uHereLocal && uHereLocal.owner === seat) {
    selectedUnitId = uHereLocal.id;
    if (mode === "evolve") {
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

    console.log("ATTEMPT", {
      mode,
      su: su?.id,
      target: uHere?.id,
      mana: mana[seat]?.cur
    });

    // ===== 攻撃 =====
    if (uHere && su && su.owner === seat && uHere.owner !== seat && (mode === "attack" || mode === null)) {
      const fail = (msg) => {
        console.log("ATTACK_FAIL", msg, {
          seat,
          mode,
          su: { id: su?.id, owner: su?.owner, fatigue: su?.fatigue, panic: su?.panic, hp: su?.hp, sp: su?.sp, x: su?.x, y: su?.y },
          target: { id: uHere?.id, owner: uHere?.owner, panic: uHere?.panic, hp: uHere?.hp, sp: uHere?.sp, x, y },
          mana: mana?.[seat]?.cur,
          selectedActionIndex
        });
        logLines.push(`[${seat}] 攻撃不可：${msg}`);
        tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
      };

      if (isPanic(su) || su.fatigue) { fail("攻撃者がパニック or 疲労"); return; }
      if (isPanic(uHere)) { fail("対象がパニック"); return; }

      const def = cardDefs[su.cardId];
      const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0];
      if (!act) { fail("行動(act)が取れない"); return; }

      const cost = Number(act.cost ?? 0);
      if (mana[seat].cur < cost) { fail(`マナ不足 cur=${mana[seat].cur} cost=${cost}`); return; }

      const rangeSpec = act.range;
      const flags = actFlags(act);
      const range = rangeSpecMaxDist(su, rangeSpec);

      // 射程判定
      if (flags.aoe) {
        const dist = Math.abs(su.x - x) + Math.abs(su.y - y);
        if (dist > range) {
          logLines.push(`[${seat}] 攻撃不可：射程外(aoe) range=${range} dist=${dist}`);
          tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
          return;
        }
      } else {
        if (!inActionRange(su, x, y, rangeSpec)) {
          logLines.push(`[${seat}] 攻撃不可：射程外 range=${String(rangeSpec)}`);
          tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
          return;
        }
      }

      // ★通常攻撃は直線時に遮蔽物で止まる
      if (!flags.aoe && !flags.pierce) {
        if (isLineBlocked(units, su, uHere)) {
          logLines.push(`[${seat}] 攻撃失敗：前にユニットがいて届かない（遮蔽）`);
          tx.set(stateRef, { log: logLines.slice(-200) }, { merge:true });
          return;
        }
      }

      const pay = spendMana(mana, seat, cost);
      if (!pay.ok) return;
      mana = pay.mana;

      const baseRate = Number(act.rate ?? 0);
      const rate1 = calcHitRateWithStatus(su, baseRate);

      const r1 = Math.floor(Math.random() * 100) + 1;
      let hit1 = (r1 <= rate1);

      const lastRoll = { at: nowMs(), r: r1, rate: rate1, hit: hit1, actionName: act.name || "action", fromId: su.id, toId: uHere.id };

      if (!hit1) {
        su.fatigue = true;
        if (hasFollowUp(su)) su.fatigue = false;

        logLines.push(`[${seat}] 攻撃失敗：${act.name} (-${cost})`);
        const winner = checkWin({ ...s, units, kills: (s.kills || {A:0,B:0}) });

        tx.set(stateRef, {
          mana, units,
          winner: winner || null,
          log: logLines.slice(-200),
          lastRoll,
          lastHit: null
        }, { merge:true });
        return;
      }

      // ===== 命中したので対象を決める =====
      let targets = [uHere];

      if (flags.aoe) {
        targets = collectAoeTargets(units, su, range);
        logLines.push(`[${seat}] 全体攻撃：対象 ${targets.length}体`);
      } else if (flags.pierce) {
        targets = collectPierceTargets(units, su, uHere, range);
        logLines.push(`[${seat}] 貫通攻撃：対象 ${targets.length}体`);
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

      const kills = { ...(s.kills || {A:0,B:0}) };
      let lastHit = null;

      for (const tgt of targets) {
        if (!tgt || tgt.hp <= 0) continue;
        if (isPanic(tgt)) continue;

        if (checkEvade(tgt, ()=>Math.random())) {
          logLines.push(`[${seat}] 回避発動：${cardName(tgt.cardId)} が攻撃を回避`);
          continue;
        }

        const hitItems = applyDamageAndStatus(tgt, act, flags.aoe ? "(全体)" : flags.pierce ? "(貫通)" : "");

        if (canCombo(su, act) && tgt.hp > 0 && !isPanic(tgt)) {
          const rate2 = Math.max(0, rate1 - 10);
          const r2 = Math.floor(Math.random() * 100) + 1;
          let hit2 = (r2 <= rate2);

          if (hit2 && checkEvade(tgt, ()=>Math.random())) {
            hit2 = false;
            logLines.push(`[${seat}] 回避発動：${cardName(tgt.cardId)} がコンボ追撃を回避`);
          }

          logLines.push(`[${seat}] コンボ判定：${r2}/${rate2}% → ${hit2 ? "成功" : "失敗"}`);

          if (hit2) {
            const hitItems2 = applyDamageAndStatus(
              tgt,
              act,
              flags.aoe ? "(全体/コンボ)" : flags.pierce ? "(貫通/コンボ)" : "(コンボ)"
            );

            if (!lastHit) {
              lastHit = { at: nowMs(), targetId: tgt.id, items: hitItems2.items };
            } else if (lastHit.targetId === tgt.id) {
              lastHit.items = (lastHit.items || []).concat(hitItems2.items || []);
            }

            if (tgt.hp <= 0) {
              kills[seat] = (kills[seat] ?? 0) + 1;
              logLines.push(`[${seat}] コンボ成功：追加撃破！`);
            }
          }
        }

        if (!lastHit) lastHit = { at: nowMs(), targetId: tgt.id, items: hitItems.items };

        if (flags.knock) {
          const moved = applyKnockback(units, su, tgt, flags.knockAmt);
          if (moved > 0) {
            logLines.push(`[${seat}] ノックバック：${cardName(tgt.cardId)} を ${moved}マス後退`);
          } else {
            logLines.push(`[${seat}] ノックバック：後退できない（壁/ユニット/端）`);
          }
        }

        if (tgt.hp <= 0) {
          kills[seat] = (kills[seat] ?? 0) + 1;
          logLines.push(`[${seat}] 撃破：${cardName(tgt.cardId)}`);
        }
      }

      su.fatigue = true;
      if (hasFollowUp(su)) {
        su.fatigue = false;
        logLines.push(`[${seat}] 追撃：疲労解除`);
      }

      logLines.push(`[${seat}] 攻撃成功：${act.name} (-${cost})`);

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
        status: {},
        moveUsed: 0,
        moveTurnSeq: s.turnSeq ?? 1,
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

      logLines.push(`[${seat}] 移動：${cardName(su2.cardId)} (-1) [${su2.moveUsed}/2]`);

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
// 進化（★v1.7.0: 疲労でもOK、進化後疲労なし）
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

    base.cardId = cid;
    base.hp = Number(evoDef.hp ?? base.hp);
    base.sp = Number(evoDef.sp ?? base.sp);
    base.panic = false;
    clearStatuses(base);

    base.fatigue = false;

    logLines.push(`[${seat}] 進化：${beforeName} → ${afterName} (-${extra})`);

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
// ターンエンド（turnSeq++ / 次手番開始処理）
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

    const units = unitsSrc.map(u => {
      const nu = { ...u };

      if (nu.owner === curTurn) {
        const smellDmg = applySmellOnTurnEnd(nu);
        if (smellDmg > 0) {
          logLines.push(`[${curTurn}] 匂い：${cardName(nu.cardId)} SP-${smellDmg}`);
        }
        clearStatuses(nu);
      }

      if (nu.owner === nextTurn) {
        nu.fatigue = false;
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

    const winner = checkWin({ ...s, units, kills:(s.kills||{A:0,B:0}) });

    tx.set(stateRef, {
      turn: nextTurn,
      turnSeq: nextSeq,
      mana,
      decks,
      hands,
      units,
      winner: winner || null,
      log: logLines.slice(-200),
      lastRoll: null,
      lastHit: null,
    }, { merge:true });
  });
};