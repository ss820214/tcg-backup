// public/deck.js
// v20260202_full_pack_complete
// - 詳細：閉じる(×)対応、邪魔にならない
// - EX：デッキ内 support から「EXにする/解除」、EX欄(exLabel)へ反映、クリア動作
// - デッキ名：ローカル + Firestore playerDoc.deckName に同期
// - みんなのデッキは community_decks.js が担当（このJSは受け口だけ）
// - ルーム作成/参加：注入ボタンは自前ハンドラ直呼び、disabledも同期
// - デッキ枚数：x / 30（残りy）を表示

import { TutorialSystem } from "./tutorial.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
// Const
// =====================
const DECK_SIZE = 30;
const MAX_SAME = 4;

const LOCAL_KEY = "tcg_deck_local_v20260202_30";
const NAME_KEY  = "tcg_player_name_v20260202_30";
const EX_KEY    = "tcg_ex_support_v20260202_30";
const DECKNAME_KEY = "tcg_deck_name_v20260202_30";
const NAMED_SAVES_KEY = "tcg_deck_named_saves_v20260202_30"; // local slots

// ★30分で期限切れ
const ROOM_TTL_MIN = 30;
const ROOM_TTL_MS = ROOM_TTL_MIN * 60 * 1000;

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
let roomId = params.get("room");
let playerId = params.get("player");

function newRoomCode4(){ return String(Math.floor(1000 + Math.random() * 9000)); }
function newPlayerId(){ return (crypto.randomUUID?.() ?? ("p" + Math.random().toString(16).slice(2))); }

if (!roomId) roomId = newRoomCode4();
if (!playerId) playerId = newPlayerId();

params.set("room", roomId);
params.set("player", playerId);
history.replaceState(null, "", `${location.pathname}?${params.toString()}`);

// =====================
// DOM
// =====================
const $ = (id)=> document.getElementById(id);

const roomIdLabel = $("roomIdLabel");
const playerIdLabel = $("playerIdLabel");

// filters
const typeSelect = $("typeSelect");
const searchEl = $("search");
const shownCountEl = $("shownCount");
const cardSectionsEl = $("cardSections");

// deck
const deckListEl = $("deckList");
const deckCountEl = $("deckCount");
const deckCountTopMirrorEl = $("deckCountTopMirror");

// msg/detail
const msgEl = $("msg") || $("deckMsg");
const detailEl = $("detail");

// buttons
const btnSave = $("btnSave");
const randomDeckBtn = $("randomDeckBtn");
const btnClearDeck = $("btnClearDeck") || $("btnClear");

// room
const createBtn = $("createBtn");
const joinBtn = $("joinBtn");
const joinCodeInput = $("joinCodeInput") || $("joinRoomId") || $("joinRoomCode");

// tutorial/rule/settings
const btnRule = $("btnRule");
const btnTutorial = $("btnTutorial");
const btnSettings = $("btnSettings") || document.querySelector?.('button[data-action="settings"]');

// name
const playerNameInput = $("playerNameInput") || $("playerName");
const btnSaveName = $("btnSaveName");
const nameHintEl = $("nameHint") || $("nameMsg");

// deck name + local slots
const deckNameInput = $("deckNameInput");
const btnSaveNamed = $("btnSaveNamed");
const slotSelect = $("deckSaveSlotSelect");
const btnLoadNamed = $("btnLoadNamed");
const btnDeleteNamed = $("btnDeleteNamed");

// EX box
const exLabelEl = $("exLabel");
const exPickBtn = $("exPickBtn");
const exClearBtn = $("exClearBtn");

// community
let btnCommunityDecks = $("btnCommunityDecks"); // あるなら使う（無ければ注入）

// =====================
// Firestore refs
// =====================
const roomRef   = (rid)=> doc(db, "rooms", rid);
const playerRef = (rid, pid)=> doc(db, "rooms", rid, "players", pid);
const playersCol = (rid)=> collection(db, "rooms", rid, "players");

const matchRef  = (rid)=> doc(db, "rooms", rid, "game", "match");
const stateRef  = (rid)=> doc(db, "rooms", rid, "game", "state");

// =====================
// State
// =====================
let cardDefs = {};
let cardIdsSorted = [];
let deckMap = {};
let filterType = "ALL";
let filterName = "";

let selectedExSupportId = "";
let currentDeckName = "";

// injected header buttons
let injectedCreateBtn = null;
let injectedJoinBtn = null;

// =====================
// Utils
// =====================
function esc(s){
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function sumDeck(m){
  let total = 0;
  for (const v of Object.values(m || {})) {
    const n = Number(v || 0);
    total += Number.isFinite(n) ? n : 0;
  }
  return total;
}
function setMsg(text, ok=false){
  if (!msgEl) return;
  msgEl.style.color = ok ? "#9cff9c" : "#ff8080";
  msgEl.textContent = text || "";
}
function setHint(el, text, ok=true){
  if (!el) return;
  el.style.color = ok ? "#9cff9c" : "#ff8080";
  el.textContent = text || "";
}
function shuffleInPlace(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function clampStr(s, n){ return String(s ?? "").trim().slice(0, n); }
function safeJsonParse(s, fallback){
  try { return JSON.parse(s); } catch { return fallback; }
}

// kind helpers
function kindLabel(kind){
  const k = String(kind || "");
  if (!k) return "";
  if (k === "card") return "カード";
  if (k === "support") return "サポート";
  if (k === "ex_support" || k === "exSupport") return "EXサポート";
  return k;
}
function isExSupport(def){
  const k = String(def?.kind || "").toLowerCase();
  return (k === "ex_support" || k === "exsupport" || k === "ex");
}
function isSupport(def){
  const k = String(def?.kind || "").toLowerCase();
  return (k === "support");
}
// EXにできるもの：support OR ex_support
function isExSelectable(def){
  return isSupport(def) || isExSupport(def);
}

// effect parser
function parseEffect(effect){
  if (!effect) return null;
  if (typeof effect === "object") return effect;
  if (typeof effect === "string") {
    const s = effect.trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch { return { raw: s }; }
  }
  return null;
}
function effectSummary(def){
  const eff = parseEffect(def?.effect);
  if (!eff) return "";
  if (eff.raw) return String(eff.raw).slice(0, 40);
  if (eff.type) {
    const bits = [String(eff.type)];
    if (eff.rate !== undefined) bits.push(`${eff.rate}%`);
    if (eff.n !== undefined) bits.push(`x${eff.n}`);
    if (eff.delta !== undefined) bits.push(`${eff.delta}`);
    return bits.join(" ");
  }
  return JSON.stringify(eff).slice(0, 40);
}
function firstActionLine(def){
  const a = def?.actions?.[0];
  if (!a) {
    const s = effectSummary(def);
    return s ? `効果: ${s}` : "行動: なし";
  }
  return `行動: ${a.name} / 程:${a.range} / ${a.rate}%`;
}

// =====================
// Local storage helpers
// =====================
function loadSelectedEx(){ try { return localStorage.getItem(EX_KEY) || ""; } catch { return ""; } }
function saveSelectedEx(id){ try { localStorage.setItem(EX_KEY, String(id || "")); } catch {} }

function loadDeckName(){ try { return localStorage.getItem(DECKNAME_KEY) || ""; } catch { return ""; } }
function saveDeckNameLocal(name){ try { localStorage.setItem(DECKNAME_KEY, String(name || "")); } catch {} }

function loadNamedSaves(){
  try{
    const raw = localStorage.getItem(NAMED_SAVES_KEY) || "";
    const obj = raw ? safeJsonParse(raw, null) : null;
    if (obj && typeof obj === "object") return obj;
  }catch{}
  return { list: [] }; // {list:[{name, deck, exSupport, deckName, savedAt}]}
}
function saveNamedSaves(obj){
  try{ localStorage.setItem(NAMED_SAVES_KEY, JSON.stringify(obj || {list:[]})); }catch{}
}

// =====================
// Deck ops
// =====================
function canAdd(cardId){
  const def = cardDefs[cardId] || {};
  // ex_support はデッキに入れない（従来維持）
  if (isExSupport(def)) {
    return { ok:false, reason:"EXサポート(kind:ex_support)はデッキに入れません（デッキ内サポートをEXに指定してね）" };
  }
  const total = sumDeck(deckMap);
  if (total >= DECK_SIZE) return { ok:false, reason:`${DECK_SIZE}枚ちょうどにしてください` };
  const c = Number(deckMap[cardId] || 0);
  if (c >= MAX_SAME) return { ok:false, reason:"同名は最大4枚までです" };
  return { ok:true };
}
function addToDeck(cardId){
  const chk = canAdd(cardId);
  if (!chk.ok) return setMsg(chk.reason, false);
  setMsg("", true);
  deckMap[cardId] = Number(deckMap[cardId] || 0) + 1;
  renderAll();
}
function removeFromDeck(cardId){
  setMsg("", true);
  const c = Number(deckMap[cardId] || 0);
  if (c <= 0) return;
  const next = c - 1;
  if (next <= 0) delete deckMap[cardId];
  else deckMap[cardId] = next;

  // EXに指定してたサポートを完全に抜いたら解除
  if (selectedExSupportId === cardId && !deckMap[cardId]) {
    selectedExSupportId = "";
    saveSelectedEx("");
    syncExToFirestore().catch(()=>{});
  }
  renderAll();
}
function clearDeck(){
  deckMap = {};
  selectedExSupportId = "";
  saveSelectedEx("");
  renderAll();
  setMsg("デッキを全消ししました", true);
  setTimeout(() => setMsg("", true), 800);
}

// =====================
// EX ops
// =====================
function selectExSupport(cardId){
  const def = cardDefs[cardId];
  if (!def) return;

  if (!isExSelectable(def)) {
    setMsg("このカードはEXにできません（サポートのみ）", false);
    return;
  }
  // ★「デッキ内のサポート」からの指定が目的
  if (isSupport(def) && !deckMap[cardId]) {
    setMsg("EXにするには、そのサポートをデッキに入れてね", false);
    return;
  }

  selectedExSupportId = cardId;
  saveSelectedEx(cardId);
  syncExToFirestore().catch(()=>{});
  updateExBoxUI();
  renderAll();
}
function clearExSupport(){
  selectedExSupportId = "";
  saveSelectedEx("");
  syncExToFirestore().catch(()=>{});
  updateExBoxUI();
  renderAll();
}

// =====================
// Player name
// =====================
function loadName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } }
function saveName(name) { try { localStorage.setItem(NAME_KEY, String(name || "")); } catch {} }
function normalizeName(name) { const s = String(name || "").trim(); return s ? s.slice(0, 16) : ""; }

function ensureNameInUI() {
  if (!playerNameInput) return;
  const saved = normalizeName(loadName());
  if (saved && !playerNameInput.value.trim()) playerNameInput.value = saved;
}
function askNameIfNeeded() {
  if (playerNameInput) {
    let n = normalizeName(playerNameInput.value);
    if (!n) n = normalizeName(loadName());
    if (!n) n = "player";
    playerNameInput.value = n;
    saveName(n);
    return n;
  }
  let name = normalizeName(loadName());
  if (!name) {
    name = prompt("ニックネームを入力してね", "")?.trim() || "";
    name = normalizeName(name) || "player";
    saveName(name);
  }
  return name;
}
async function syncNameToFirestore(name){
  try {
    await setDoc(playerRef(roomId, playerId), {
      name: name || "player",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn("syncNameToFirestore skipped:", e?.message || e);
  }
}
btnSaveName?.addEventListener("click", async () => {
  if (!playerNameInput) return;
  const n = normalizeName(playerNameInput.value);
  if (!n) return setHint(nameHintEl, "名前が空です", false);
  saveName(n);
  await syncNameToFirestore(n);
  setHint(nameHintEl, `保存しました：${n}`, true);
  setTimeout(() => setHint(nameHintEl, "", true), 1200);
});

// =====================
// Deck name
// =====================
function normalizeDeckName(name){
  return clampStr(name, 24);
}
function ensureDeckNameInUI(){
  if (!deckNameInput) return;
  const saved = normalizeDeckName(loadDeckName());
  if (saved && !deckNameInput.value.trim()) deckNameInput.value = saved;
  currentDeckName = normalizeDeckName(deckNameInput.value);
}
async function syncDeckNameToFirestore(){
  try{
    await setDoc(playerRef(roomId, playerId), {
      deckName: currentDeckName || "",
      updatedAt: serverTimestamp(),
    }, { merge:true });
  }catch(e){
    console.warn("syncDeckNameToFirestore skipped:", e?.message || e);
  }
}
deckNameInput?.addEventListener("input", () => {
  currentDeckName = normalizeDeckName(deckNameInput.value);
  saveDeckNameLocal(currentDeckName);
  // 入力中は頻繁すぎるので即Firestoreはしない（保存時/作成参加時に同期）
});

// =====================
// TTL / Reset
// =====================
function expiresAtFromNow() { return Timestamp.fromMillis(Date.now() + ROOM_TTL_MS); }
function isExpiredRoomDoc(roomDocData) {
  const exp = roomDocData?.expiresAt;
  const ms = (exp && typeof exp.toMillis === "function") ? exp.toMillis() : null;
  return !!(ms && ms < Date.now());
}
async function touchRoom(rid, extra = {}) {
  await setDoc(roomRef(rid), {
    lastActiveAt: serverTimestamp(),
    expiresAt: expiresAtFromNow(),
    ...extra,
  }, { merge: true });
}
async function resetRoomHardish(rid) {
  try {
    const ps = await getDocs(playersCol(rid));
    for (const d of ps.docs) await deleteDoc(d.ref);
  } catch (e) {
    console.warn("resetRoom: players delete failed", e);
  }
  try { await deleteDoc(matchRef(rid)); } catch {}
  try { await deleteDoc(stateRef(rid)); } catch {}
}

// =====================
// Data load
// =====================
async function loadCollectionSafe(colName, kindLabel) {
  try {
    const snap = await getDocs(collection(db, colName));
    const m = {};
    snap.forEach((d) => {
      const data = d.data() || {};
      if (!data.kind && kindLabel) data.kind = kindLabel;
      data.id = d.id;
      m[d.id] = data;
    });
    return m;
  } catch (e) {
    // コレクションが無い等は無視
    console.warn("loadCollectionSafe skip:", colName, e?.message || e);
    return {};
  }
}

async function loadCards() {
  const base = await loadCollectionSafe("cards", "card");

  const supportsA = await loadCollectionSafe("support_cards", "support");
  const supportsB = await loadCollectionSafe("supports", "support");
  const supportsC = await loadCollectionSafe("supportCards", "support");

  const exA = await loadCollectionSafe("ex_support_cards", "ex_support");
  const exB = await loadCollectionSafe("ex_supports", "ex_support");
  const exC = await loadCollectionSafe("exSupportCards", "ex_support");
  const exD = await loadCollectionSafe("ex_support", "ex_support");

  cardDefs = { ...supportsA, ...supportsB, ...supportsC, ...exA, ...exB, ...exC, ...exD, ...base };

  cardIdsSorted = Object.keys(cardDefs).sort((a, b) => {
    const A = cardDefs[a] || {};
    const B = cardDefs[b] || {};
    const kA = String(A.kind || "");
    const kB = String(B.kind || "");
    if (kA !== kB) return kA.localeCompare(kB, "ja");

    const tA = String(A.type || "");
    const tB = String(B.type || "");
    if (tA !== tB) return tA.localeCompare(tB, "ja");

    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;

    return String(A.name || a).localeCompare(String(B.name || b), "ja");
  });

  // typeSelect options
  setupTypeSelectOptions();
}

async function loadDeckPreferFirestore(rid, pid) {
  try {
    const ps = await getDoc(playerRef(rid, pid));
    if (ps.exists()) {
      const d = ps.data() || {};
      const dm = d.deck || {};
      if (dm && typeof dm === "object" && !Array.isArray(dm)) deckMap = dm;

      if (d.exSupport) selectedExSupportId = String(d.exSupport || "");
      if (d.deckName) {
        currentDeckName = normalizeDeckName(d.deckName);
        saveDeckNameLocal(currentDeckName);
        if (deckNameInput) deckNameInput.value = currentDeckName;
      }
      return;
    }
  } catch (e) {
    console.warn("loadDeckPreferFirestore fallback to local", e);
  }

  // local fallback
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    deckMap = raw ? (JSON.parse(raw) || {}) : {};
  } catch {
    deckMap = {};
  }
}

function saveLocalDeck() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(deckMap || {})); } catch {} }

// =====================
// Firestore sync small pieces
// =====================
async function syncExToFirestore(){
  try{
    await setDoc(playerRef(roomId, playerId), {
      exSupport: selectedExSupportId || "",
      updatedAt: serverTimestamp(),
    }, { merge:true });
  }catch(e){
    console.warn("syncExToFirestore skipped:", e?.message || e);
  }
}

// =====================
// Detail UI (close)
// =====================
let injectedDetailCloseBtn = null;

function ensureDetailCloseButton(){
  if (!detailEl) return;

  // 既にDOMにあるならそれ使う
  if (document.getElementById("detailCloseBtn")) return;

  // detailBox内に注入（邪魔にならない右上）
  const parent = detailEl.parentElement;
  if (!parent) return;

  parent.style.position = parent.style.position || "relative";

  const btn = document.createElement("button");
  btn.id = "detailCloseBtn";
  btn.type = "button";
  btn.textContent = "×";
  btn.title = "閉じる";
  btn.style.position = "absolute";
  btn.style.top = "8px";
  btn.style.right = "8px";
  btn.style.width = "34px";
  btn.style.height = "34px";
  btn.style.borderRadius = "12px";
  btn.style.border = "1px solid rgba(255,255,255,0.14)";
  btn.style.background = "rgba(0,0,0,0.22)";
  btn.style.color = "rgba(255,255,255,0.92)";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "22px";
  btn.style.lineHeight = "30px";

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    closeDetail();
  });

  parent.appendChild(btn);
  injectedDetailCloseBtn = btn;
}

function showDetail(html){
  if (!detailEl) return;
  ensureDetailCloseButton();
  detailEl.innerHTML = html;
  // スクロールしても邪魔にならんよう、detailにフォーカスだけ
  detailEl.scrollIntoView?.({ behavior:"smooth", block:"nearest" });
}
function closeDetail(){
  if (!detailEl) return;
  detailEl.innerHTML = "左の「詳細」ボタンでカード詳細が表示されます。";
}

// =====================
// EX box UI
// =====================
function updateExBoxUI(){
  if (!exLabelEl) return;

  const selId = selectedExSupportId || "";
  if (!selId) {
    exLabelEl.innerHTML = `<span class="badge">ピンチ時のみ</span><br>未選択`;
    if (exClearBtn) exClearBtn.disabled = true;
    return;
  }

  const def = cardDefs[selId] || {};
  const nm = def.name || selId;
  const eff = effectSummary(def);
  exLabelEl.innerHTML =
    `<span class="badge">ピンチ時のみ</span><br>` +
    `<b>${esc(nm)}</b>` +
    (eff ? `<div class="small" style="opacity:.85;margin-top:6px;">効果: ${esc(eff)}</div>` : "");

  if (exClearBtn) exClearBtn.disabled = false;
}

// =====================
// Detail content
// =====================
function showCardDetail(cardId) {
  const d = cardDefs[cardId];
  if (!d) return;

  let html = `<div style="padding-right:40px;">`; // ×のスペース確保
  html += `<b style="font-size:15px;">${esc(d.name || cardId)}</b> <span class="small">(${esc(cardId)})</span><br>`;
  if (d.kind) html += `種別:${esc(kindLabel(d.kind))}<br>`;
  if (d.type) html += `属性:${esc(d.type)}<br>`;
  if (d.cost !== undefined) html += `コスト:${esc(d.cost)}<br>`;
  if (d.hp !== undefined || d.sp !== undefined) html += `HP:${esc(d.hp)} SP:${esc(d.sp)}<br>`;
  html += `<br>`;

  const eff = parseEffect(d.effect);
  if (eff) {
    html += `<b>効果</b><br>`;
    if (eff.raw) html += `${esc(eff.raw)}<br><br>`;
    else html += `<pre style="margin:8px 0;white-space:pre-wrap;opacity:.92;">${esc(JSON.stringify(eff, null, 2))}</pre>`;
  }

  const acts = d.actions || [];
  if (acts.length) {
    html += `<b>行動</b><br>`;
    acts.forEach((a) => {
      const parts = [];
      if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
      if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
      if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
      const effect = parts.length ? parts.join(" / ") : "効果";

      html += `【${esc(a.cost)}】${esc(a.name)}<br>`;
      html += `射程:${esc(a.range)} / 成功:${esc(a.rate)}%<br>`;
      html += `効果:${esc(effect)}<br><br>`;
    });
  } else if (!eff) {
    html += `（詳細情報なし）`;
  }

  // EX状態（support/ex_supportのみ）
  if (isExSelectable(d)) {
    const isSel = (selectedExSupportId === cardId);
    html += `<hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:10px 0;">`;
    html += isSel ? `<b>このカードは現在EX指定中</b>` : `<b>このカードはEX未指定</b>`;
  }

  html += `</div>`;
  showDetail(html);
}

// =====================
// Filters
// =====================
function setupTypeSelectOptions(){
  if (!typeSelect) return;
  const types = new Set();
  for (const id of cardIdsSorted) {
    const t = String(cardDefs[id]?.type || "");
    if (t) types.add(t);
  }
  const list = ["ALL", ...Array.from(types).sort((a,b)=>a.localeCompare(b,"ja"))];
  typeSelect.innerHTML = "";
  for (const v of list) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = (v === "ALL") ? "すべて" : v;
    typeSelect.appendChild(opt);
  }
  typeSelect.value = filterType || "ALL";
}

// =====================
// Enable/disable
// =====================
function updatePlayButtons() {
  const total = sumDeck(deckMap);
  const okDeck = (total === DECK_SIZE);
  const left = Math.max(0, DECK_SIZE - total);

  if (createBtn) createBtn.disabled = !okDeck;

  let okJoin = okDeck;
  if (joinCodeInput) {
    const code = (joinCodeInput.value || "").trim();
    okJoin = okJoin && /^\d{4}$/.test(code);
  }
  if (joinBtn) joinBtn.disabled = !okJoin;

  // injected button sync
  if (injectedCreateBtn) injectedCreateBtn.disabled = !okDeck;
  if (injectedJoinBtn) injectedJoinBtn.disabled = !okJoin;

  if (!okDeck) setMsg(`${DECK_SIZE}枚ちょうどにしてください（あと${left}枚）`, false);
  else setMsg("", true);
}

// =====================
// Render
// =====================
function renderDeckCountMirrors(){
  const total = sumDeck(deckMap);
  if (deckCountEl) deckCountEl.textContent = String(total);

  if (deckCountTopMirrorEl) {
    const left = Math.max(0, DECK_SIZE - total);
    deckCountTopMirrorEl.textContent = `${total} / ${DECK_SIZE}（残り${left}）`;
  }
}

function renderDeck() {
  renderDeckCountMirrors();

  if (!deckListEl) return;
  deckListEl.innerHTML = "";

  const idsInDeck = Object.keys(deckMap).sort((a, b) => {
    const A = cardDefs[a] || {};
    const B = cardDefs[b] || {};
    const kA = String(A.kind || "");
    const kB = String(B.kind || "");
    if (kA !== kB) return kA.localeCompare(kB, "ja");
    const tA = String(A.type || "");
    const tB = String(B.type || "");
    if (tA !== tB) return tA.localeCompare(tB, "ja");
    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;
    return String(A.name || a).localeCompare(String(B.name || b), "ja");
  });

  for (const cardId of idsInDeck) {
    const def = cardDefs[cardId] || {};
    const cnt = Number(deckMap[cardId] || 0);

    const isSupportRow = isSupport(def);
    const isSelEx = (selectedExSupportId === cardId);

    const exBtnHtml = isSupportRow
      ? `<button class="ghost" data-ex="${esc(cardId)}">${isSelEx ? "EX解除" : "EXにする"}</button>`
      : ``;

    const row = document.createElement("div");
    row.className = "cardRow";
    row.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";

    row.innerHTML = `
      <div>
        <div class="name">【${esc(def.cost)}】${esc(def.name || cardId)} ${def.type ? esc(def.type) : ""}</div>
        <div class="sub" style="opacity:.85;font-size:12px;margin-top:4px;">
          ${def.kind ? esc(kindLabel(def.kind)) + " / " : ""}
          ${(def.hp!==undefined||def.sp!==undefined) ? `HP:${esc(def.hp)} SP:${esc(def.sp)} / ` : ""}
          ${esc(firstActionLine(def))}
        </div>
      </div>
      <div class="btns" style="display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;">
        ${exBtnHtml}
        <button class="ghost" data-minus="${esc(cardId)}">-</button>
        <div class="count" style="min-width:52px;text-align:center;opacity:.9;">${cnt}枚</div>
        <button class="ghost" data-plus="${esc(cardId)}">+</button>
        <button class="ghost" data-detail="${esc(cardId)}">詳細</button>
      </div>
    `;

    row.querySelector("[data-minus]")?.addEventListener("click", (e) => { e.stopPropagation?.(); removeFromDeck(cardId); });
    row.querySelector("[data-plus]")?.addEventListener("click", (e) => { e.stopPropagation?.(); addToDeck(cardId); });
    row.querySelector("[data-detail]")?.addEventListener("click", (e) => { e.stopPropagation?.(); showCardDetail(cardId); });

    row.querySelector("[data-ex]")?.addEventListener("click", (e) => {
      e.stopPropagation?.();
      if (isSelEx) clearExSupport();
      else selectExSupport(cardId);
    });

    row.addEventListener("click", () => showCardDetail(cardId));
    deckListEl.appendChild(row);
  }

  updatePlayButtons();
}

function renderCardSections() {
  if (!cardSectionsEl) return;

  cardSectionsEl.innerHTML = "";

  const nameQ = (filterName || "").trim().toLowerCase();
  const matches = cardIdsSorted.filter((id) => {
    const def = cardDefs[id] || {};
    // ex_supportは一覧には出すけど、デッキに入らない仕様なので「カード探し」を邪魔するなら除外したければここで外せるuration
    if (filterType !== "ALL" && String(def.type) !== filterType) return false;
    if (nameQ) {
      const nm = String(def.name || id).toLowerCase();
      if (!nm.includes(nameQ)) return false;
    }
    return true;
  });

  if (shownCountEl) shownCountEl.textContent = String(matches.length);

  // type ごとにまとめる
  const byType = new Map();
  for (const id of matches) {
    const t = String(cardDefs[id]?.type || "その他");
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(id);
  }
  const typesOrdered = Array.from(byType.keys()).sort((a, b) => a.localeCompare(b, "ja"));

  for (const t of typesOrdered) {
    const ids = byType.get(t) || [];
    const wrap = document.createElement("details");
    wrap.open = (filterType === "ALL") || (filterType === t);

    const summary = document.createElement("summary");
    summary.textContent = `${t}（${ids.length}枚）`;
    wrap.appendChild(summary);

    const inner = document.createElement("div");
    inner.className = "sectionInner";

    for (const cardId of ids) {
      const def = cardDefs[cardId] || {};
      const cnt = Number(deckMap[cardId] || 0);
      const exOnly = isExSupport(def); // 一覧側はEX専用のものだけ「選択」扱い
      const isSelEx = exOnly && (selectedExSupportId === cardId);

      const div = document.createElement("div");
      div.className = "card";
      div.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";
      div.innerHTML = `
        <div class="cardHead">
          <div>
            <b>【${esc(def.cost)}】 ${esc(def.name || cardId)} ${def.type ? esc(def.type) : ""}</b>
            <div class="small" style="opacity:.85;">
              ${def.kind ? `種別:${esc(kindLabel(def.kind))} / ` : ""}
              ${(def.hp!==undefined||def.sp!==undefined)?`HP:${esc(def.hp)} / SP:${esc(def.sp)}`:""}
            </div>
            <div class="small" style="opacity:.85;">${esc(firstActionLine(def))}</div>
          </div>
          <div class="btns">
            ${
              exOnly
                ? `<button data-expick>${isSelEx ? "選択中" : "選択"}</button>`
                : `
                  <button data-minus="${esc(cardId)}" ${cnt <= 0 ? "disabled" : ""}>-</button>
                  <div class="cnt">${cnt || 0} / ${MAX_SAME}</div>
                  <button data-plus="${esc(cardId)}">+</button>
                `
            }
            <button data-detail="${esc(cardId)}">詳細</button>
          </div>
        </div>
      `;

      div.querySelector("[data-minus]")?.addEventListener("click", () => removeFromDeck(cardId));
      div.querySelector("[data-plus]")?.addEventListener("click", () => addToDeck(cardId));
      div.querySelector("[data-detail]")?.addEventListener("click", () => showCardDetail(cardId));

      div.querySelector("[data-expick]")?.addEventListener("click", () => {
        if (isSelEx) clearExSupport();
        else {
          // ex_support はデッキに入らないが、EXとしては指定できる（ただし表示目的程度）
          selectedExSupportId = cardId;
          saveSelectedEx(cardId);
          syncExToFirestore().catch(()=>{});
          updateExBoxUI();
          renderAll();
        }
      });

      inner.appendChild(div);
    }

    wrap.appendChild(inner);
    cardSectionsEl.appendChild(wrap);
  }

  if (!typesOrdered.length) {
    cardSectionsEl.innerHTML = `<div class="small" style="opacity:0.85;">該当するカードがありません</div>`;
  }
}

function renderAll(){
  renderCardSections();
  renderDeck();
  updateExBoxUI();
  renderDeckCountMirrors();
}

// =====================
// Save / Create / Join
// =====================
async function ensurePlayerDoc(rid, pid, name) {
  await setDoc(playerRef(rid, pid), {
    name: name || "player",
    deck: deckMap || {},
    exSupport: selectedExSupportId || "",
    deckName: currentDeckName || "",
    ready: false,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function saveDeckOnly(rid, pid) {
  try {
    const name = askNameIfNeeded();
    currentDeckName = normalizeDeckName(deckNameInput?.value || currentDeckName || "");
    saveDeckNameLocal(currentDeckName);

    await setDoc(playerRef(rid, pid), {
      name,
      deck: deckMap || {},
      exSupport: selectedExSupportId || "",
      deckName: currentDeckName || "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    saveLocalDeck();
    saveSelectedEx(selectedExSupportId || "");

    setMsg("保存しました。", true);
    setTimeout(() => setMsg("", true), 900);
  } catch (e) {
    console.error(e);
    saveLocalDeck();
    saveSelectedEx(selectedExSupportId || "");
    setMsg("保存に失敗（ローカル保存はOK）", false);
  }
}
btnSave?.addEventListener("click", async () => {
  await saveDeckOnly(roomId, playerId);
});

function updateUrlAndLabels() {
  const p = new URLSearchParams(location.search);
  p.set("room", roomId);
  p.set("player", playerId);
  history.replaceState(null, "", `${location.pathname}?${p.toString()}`);
  if (roomIdLabel) roomIdLabel.textContent = roomId;
  if (playerIdLabel) playerIdLabel.textContent = playerId;
}

function readJoinCode() {
  if (joinCodeInput) return (joinCodeInput.value || "").trim();
  return prompt("参加する部屋番号（4桁）を入力", "")?.trim() || "";
}

async function handleCreateRoom(){
  const total = sumDeck(deckMap);
  if (total !== DECK_SIZE) return setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);

  const name = askNameIfNeeded();
  currentDeckName = normalizeDeckName(deckNameInput?.value || currentDeckName || "");
  saveDeckNameLocal(currentDeckName);

  roomId = newRoomCode4();
  playerId = newPlayerId();
  updateUrlAndLabels();

  try {
    const rs = await getDoc(roomRef(roomId));
    if (rs.exists()) await resetRoomHardish(roomId);
  } catch {}

  await touchRoom(roomId, { createdAt: serverTimestamp() });
  await ensurePlayerDoc(roomId, playerId, name);

  saveLocalDeck();
  saveSelectedEx(selectedExSupportId || "");

  location.href = `./battle.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
}

async function handleJoinRoom(){
  const total = sumDeck(deckMap);
  if (total !== DECK_SIZE) return setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);

  const name = askNameIfNeeded();
  currentDeckName = normalizeDeckName(deckNameInput?.value || currentDeckName || "");
  saveDeckNameLocal(currentDeckName);

  const code = readJoinCode();
  if (!/^\d{4}$/.test(code)) return setMsg("部屋番号は4桁（例：1234）で入力してね", false);

  roomId = code;
  playerId = newPlayerId();
  updateUrlAndLabels();

  try {
    const rs = await getDoc(roomRef(roomId));
    if (rs.exists()) {
      const d = rs.data() || {};
      if (isExpiredRoomDoc(d)) await resetRoomHardish(roomId);
    }
  } catch {}

  await touchRoom(roomId, { createdAt: serverTimestamp() });
  await ensurePlayerDoc(roomId, playerId, name);

  saveLocalDeck();
  saveSelectedEx(selectedExSupportId || "");

  location.href = `./battle.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
}

createBtn?.addEventListener("click", handleCreateRoom);
joinBtn?.addEventListener("click", handleJoinRoom);

// ランダムデッキ（ex_supportは混ぜない）
randomDeckBtn?.addEventListener("click", () => {
  setMsg("", true);
  const ids = [...cardIdsSorted].filter((id)=> !isExSupport(cardDefs[id]));
  if (!ids.length) return;

  const next = {};
  shuffleInPlace(ids);

  let guard = 9999;
  while (sumDeck(next) < DECK_SIZE && guard-- > 0) {
    for (const id of ids) {
      if (sumDeck(next) >= DECK_SIZE) break;
      const c = Number(next[id] || 0);
      if (c >= MAX_SAME) continue;
      next[id] = c + 1;
      if (sumDeck(next) >= DECK_SIZE) break;
    }
  }

  deckMap = next;
  renderAll();
  setMsg(`ランダムデッキを作成しました（保存は「保存」ボタン）`, true);
});

btnClearDeck?.addEventListener("click", clearDeck);

// =====================
// Named saves (local slots)
// =====================
function refreshNamedSlotsUI(){
  if (!slotSelect) return;
  const store = loadNamedSaves();
  const list = Array.isArray(store.list) ? store.list : [];

  slotSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "保存デッキを選ぶ…";
  slotSelect.appendChild(opt0);

  for (const item of list) {
    const opt = document.createElement("option");
    opt.value = item.name || "";
    opt.textContent = item.name || "(no name)";
    slotSelect.appendChild(opt);
  }

  const hasSel = !!slotSelect.value;
  if (btnLoadNamed) btnLoadNamed.disabled = !hasSel;
  if (btnDeleteNamed) btnDeleteNamed.disabled = !hasSel;
}

function setSlotButtonsBySelect(){
  const hasSel = !!(slotSelect && slotSelect.value);
  if (btnLoadNamed) btnLoadNamed.disabled = !hasSel;
  if (btnDeleteNamed) btnDeleteNamed.disabled = !hasSel;
}
slotSelect?.addEventListener("change", setSlotButtonsBySelect);

btnSaveNamed?.addEventListener("click", () => {
  const name = normalizeDeckName(deckNameInput?.value || "");
  if (!name) {
    setMsg("デッキ名を入力してから保存してね", false);
    return;
  }
  currentDeckName = name;
  saveDeckNameLocal(currentDeckName);

  const store = loadNamedSaves();
  const list = Array.isArray(store.list) ? store.list : [];

  // 同名は上書き
  const nextItem = {
    name,
    deckName: currentDeckName,
    deck: deckMap || {},
    exSupport: selectedExSupportId || "",
        savedAt: Date.now(),
  };
  const idx = list.findIndex(x => x?.name === name);
  if (idx >= 0) list[idx] = nextItem;
  else list.unshift(nextItem);

  store.list = list.slice(0, 24); // 24個まで
  saveNamedSaves(store);

  refreshNamedSlotsUI();
  // 保存直後に選択しておく
  if (slotSelect) slotSelect.value = name;
  setSlotButtonsBySelect();

  setMsg(`保存しました：${name}`, true);
  setTimeout(()=>setMsg("", true), 900);
});

btnLoadNamed?.addEventListener("click", () => {
  const key = slotSelect?.value || "";
  if (!key) return;

  const store = loadNamedSaves();
  const list = Array.isArray(store.list) ? store.list : [];
  const item = list.find(x => x?.name === key);
  if (!item) return;

  deckMap = (item.deck && typeof item.deck === "object") ? item.deck : {};
  selectedExSupportId = String(item.exSupport || "");
  saveSelectedEx(selectedExSupportId);

  currentDeckName = normalizeDeckName(item.deckName || item.name || "");
  saveDeckNameLocal(currentDeckName);
  if (deckNameInput) deckNameInput.value = currentDeckName;

  // EXが「デッキ内サポート」じゃない場合は解除（不整合防止）
  if (selectedExSupportId) {
    const def = cardDefs[selectedExSupportId];
    if (def && isSupport(def) && !deckMap[selectedExSupportId]) {
      selectedExSupportId = "";
      saveSelectedEx("");
    }
  }

  updateExBoxUI();
  renderAll();

  setMsg(`読み込み：${key}`, true);
  setTimeout(()=>setMsg("", true), 900);
});

btnDeleteNamed?.addEventListener("click", () => {
  const key = slotSelect?.value || "";
  if (!key) return;

  const store = loadNamedSaves();
  const list = Array.isArray(store.list) ? store.list : [];
  store.list = list.filter(x => x?.name !== key);

  saveNamedSaves(store);
  refreshNamedSlotsUI();
  setSlotButtonsBySelect();

  setMsg(`削除：${key}`, true);
  setTimeout(()=>setMsg("", true), 900);
});

// =====================
// EX box buttons
// =====================
exClearBtn?.addEventListener("click", () => clearExSupport());

exPickBtn?.addEventListener("click", () => {
  // このUIでは「デッキ内サポートの行でEXにする」が正規
  setMsg("EXはデッキ内のサポート行から「EXにする」で指定できます", true);
  setTimeout(()=>setMsg("", true), 1400);
  deckListEl?.scrollIntoView?.({ behavior:"smooth", block:"start" });
});

// =====================
// Filters events
// =====================
typeSelect?.addEventListener("change", () => {
  filterType = typeSelect.value || "ALL";
  renderAll();
});
searchEl?.addEventListener("input", () => {
  filterName = searchEl.value || "";
  renderAll();
});
joinCodeInput?.addEventListener("input", updatePlayButtons);

// =====================
// Tutorial/Rule
// =====================
const tutorial = new TutorialSystem();
btnTutorial?.addEventListener("click", () => tutorial.openMenu());
btnRule?.addEventListener("click", () => (location.href = `./rule.html`));

// =====================
// 「設定」の左に ルーム参加/作成 を追加（DOM注入）
// =====================
function injectRoomButtonsNearSettings(){
  if (document.querySelector?.('[data-injected="roomButtons"]')) return;

  const wrap = document.createElement("span");
  wrap.dataset.injected = "roomButtons";
  wrap.style.display = "inline-flex";
  wrap.style.gap = "8px";
  wrap.style.alignItems = "center";

  const c = document.createElement("button");
  c.textContent = "ルーム作成";
  c.className = "ghost";
  c.type = "button";
  c.addEventListener("click", () => handleCreateRoom());

  const j = document.createElement("button");
  j.textContent = "ルーム参加";
  j.className = "ghost";
  j.type = "button";
  j.addEventListener("click", () => handleJoinRoom());

  injectedCreateBtn = c;
  injectedJoinBtn = j;

  wrap.appendChild(c);
  wrap.appendChild(j);

  if (btnSettings && btnSettings.parentElement) {
    btnSettings.parentElement.insertBefore(wrap, btnSettings);
  } else if (btnRule && btnRule.parentElement) {
    btnRule.parentElement.insertBefore(wrap, btnRule);
  } else {
    document.querySelector?.("header")?.appendChild(wrap);
  }
}

// =====================
// Community decks button (receiver only)
// =====================
function ensureCommunityDecksButton(){
  if (btnCommunityDecks) return;

  // btnSaveNamedの近くに注入したい
  if (!btnSaveNamed) return;

  const b = document.createElement("button");
  b.id = "btnCommunityDecks";
  b.className = "ghost";
  b.type = "button";
  b.textContent = "みんなのデッキ";

  b.addEventListener("click", async ()=>{
    // community_decks.js 側に委譲
    if (window.CommunityDecks?.open) {
      window.CommunityDecks.open({
        roomId,
        playerId,
        deck: deckMap,
        exSupport: selectedExSupportId,
        deckName: currentDeckName,
      });
      return;
    }

    // CustomEvent fallback
    document.dispatchEvent(new CustomEvent("openCommunityDecks", {
      detail: { roomId, playerId, deck: deckMap, exSupport: selectedExSupportId, deckName: currentDeckName }
    }));

    setMsg("community_decks.js が未読み込みです", false);
    setTimeout(()=>setMsg("", true), 1200);
  });

  // 「名前で保存」の右に置く
  btnSaveNamed.insertAdjacentElement("afterend", b);
  btnCommunityDecks = b;
}

// =====================
// Boot
// =====================
if (roomIdLabel) roomIdLabel.textContent = roomId;
if (playerIdLabel) playerIdLabel.textContent = playerId;

ensureNameInUI();
ensureDeckNameInUI();

selectedExSupportId = loadSelectedEx() || "";
currentDeckName = normalizeDeckName(loadDeckName());

// 先に detail close を注入（detailElがあるなら）
ensureDetailCloseButton();

await loadCards();
await loadDeckPreferFirestore(roomId, playerId);

// Firestore優先をlocalにも反映
saveSelectedEx(selectedExSupportId || "");
saveDeckNameLocal(currentDeckName || "");

// 初回UI反映
updateExBoxUI();
renderAll();

// named saves ui
refreshNamedSlotsUI();
setSlotButtonsBySelect();

// inject buttons
injectRoomButtonsNearSettings();
ensureCommunityDecksButton();

// touch room
touchRoom(roomId, { createdAt: serverTimestamp() }).catch(() => {});