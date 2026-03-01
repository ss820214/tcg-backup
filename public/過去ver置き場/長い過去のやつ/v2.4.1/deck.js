// public/deck.js
// v20260204_full_with_cloud_library
// - 詳細(DETAIL)が確実に出るように修正（display:block）＋EX付近に寄せる
// - デッキ名 input を「デッキ保存」行に自動注入（ID: deckTitle）
// - deck_library.js を追加して「自分/みんなのデッキ」クラウド機能を実装
// - 既存の機能（作成/参加/保存/EX/チュートリアル/ルール等）は削らない
import { supportEffectTextJa } from "./support_text.js?v=20260205_2";

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

import { initDeckLibrary } from "./deck_library.js?v=20260204_2";

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com") ? "tcg-0bato" : "tcg-0bato",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// Const
// =====================
const DECK_SIZE = 30;
const MAX_SAME = 4;

const LOCAL_KEY = "tcg_deck_local_v20260202_30";
const OPEN_TYPE_KEY = "tcg_deck_open_type_v20260202_30";
const NAME_KEY = "tcg_player_name_v20260202_30";
const EX_KEY = "tcg_ex_support_v20260202_30";

// ★追加: デッキ名（ローカル）
const DECK_TITLE_KEY = "tcg_deck_title_v20260204";

const ROOM_TTL_MIN = 30;
const ROOM_TTL_MS = ROOM_TTL_MIN * 60 * 1000;

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
let roomId = params.get("room");
let playerId = params.get("player");

function newRoomCode4() { return String(Math.floor(1000 + Math.random() * 9000)); }
function newPlayerId() { return (crypto.randomUUID?.() ?? ("p" + Math.random().toString(16).slice(2))); }

if (!roomId) roomId = newRoomCode4();
if (!playerId) playerId = newPlayerId();

params.set("room", roomId);
params.set("player", playerId);
history.replaceState(null, "", `${location.pathname}?${params.toString()}`);

// =====================
// DOM (互換)
// =====================
const $ = (id) => document.getElementById(id);

function ensureDetailDom(){
  let wrap = document.getElementById("detailWrap");
  let close = document.getElementById("detailClose");
  let body = document.getElementById("detail");

  if (!wrap){
    wrap = document.createElement("div");
    wrap.id = "detailWrap";
    wrap.className = "isHidden";
    document.body.appendChild(wrap);
  }

  let head = document.getElementById("detailHead");
  if (!head){
    head = document.createElement("div");
    head.id = "detailHead";
    head.innerHTML = `<b>DETAIL</b>`;
    wrap.appendChild(head);
  }

  if (!close){
    close = document.createElement("button");
    close.id = "detailClose";
    close.type = "button";
    close.title = "詳細を閉じる";
    close.textContent = "✕";
  }
  head.appendChild(close);

  if (!body){
    body = document.createElement("div");
    body.id = "detail";
    body.textContent = "カード詳細がここに表示されます。";
    wrap.appendChild(body);
  } else if (!wrap.contains(body)){
    wrap.appendChild(body);
  }

  return { wrap, close, body };
}

// ★DOMを先に保証
ensureDetailDom();

// そのあとに拾う（これが大事）
const detailWrap = $("detailWrap");
const detailClose = $("detailClose");
const detailEl = $("detail");

function openDetail(){
  if (!detailWrap) return;
  detailWrap.classList.remove("isHidden");

  try{
    const dl = document.getElementById("deckList");
    if (dl){
      const r = dl.getBoundingClientRect();
      const w = Math.min(560, Math.max(340, Math.floor(r.width)));
      detailWrap.style.position = "fixed";
      detailWrap.style.width = `${w}px`;

      const left = Math.max(14, Math.min(r.left, window.innerWidth - w - 14));
      detailWrap.style.left = `${left}px`;
      detailWrap.style.right = "auto";

      const bottomGap = Math.max(14, window.innerHeight - r.bottom + 14);
      detailWrap.style.bottom = `${bottomGap}px`;
      detailWrap.style.top = "auto";
    }
  }catch{}
}

function closeDetail(){
  if (!detailWrap) return;
  detailWrap.classList.add("isHidden");
}

detailClose?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeDetail();
});
window.addEventListener("keydown", (e)=>{
  if (e.key === "Escape" && detailWrap && !detailWrap.classList.contains("isHidden")) {
    closeDetail();
  }
});

const roomIdLabel = $("roomIdLabel");
const playerIdLabel = $("playerIdLabel");

const typeSelect = $("typeSelect");
const searchEl = $("search");
const shownCountEl = $("shownCount");
const cardSectionsEl = $("cardSections");

const cardListEl = $("cardList");
const deckListEl = $("deckList");
const deckCountEl = $("deckCount");

const msgEl = $("msg") || $("deckMsg");

const btnSave = $("btnSave");
const randomDeckBtn = $("randomDeckBtn");
const btnClearDeck = $("btnClearDeck") || $("btnClear");

const createBtn = $("createBtn");
const joinBtn = $("joinBtn");
const joinCodeInput = $("joinCodeInput") || $("joinRoomId") || $("joinRoomCode");

const btnRule = $("btnRule");
const btnTutorial = $("btnTutorial");
const btnSettings = $("btnSettings") || document.querySelector?.('button[data-action="settings"]');

const playerNameInput = $("playerNameInput") || $("playerName");
const btnSaveName = $("btnSaveName");
const nameHintEl = $("nameHint") || $("nameMsg");

const tabEls = Array.from(document.querySelectorAll?.("[data-tab]") || []);
const tabCreateBody = $("tabBodyCreate") || $("tab-create");
const tabJoinBody = $("tabBodyJoin") || $("tab-join");

// =====================
// Firestore refs
// =====================
const roomRef = (rid) => doc(db, "rooms", rid);
const playerRef = (rid, pid) => doc(db, "rooms", rid, "players", pid);
const playersCol = (rid) => collection(db, "rooms", rid, "players");

const matchRef = (rid) => doc(db, "rooms", rid, "game", "match");
const stateRef = (rid) => doc(db, "rooms", rid, "game", "state");

// =====================
// State
// =====================
let cardDefs = {};
let cardIdsSorted = [];
let deckMap = {};
let filterType = "ALL";
let filterName = "";

let selectedExSupportId = "";

// =====================
// Utils
// =====================
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function sumDeck(m) {
  let total = 0;
  for (const v of Object.values(m || {})) {
    const n = Number(v || 0);
    total += Number.isFinite(n) ? n : 0;
  }
  return total;
}
function setMsg(text, ok = false) {
  if (!msgEl) return;
  msgEl.style.color = ok ? "#9cff9c" : "#ff8080";
  msgEl.textContent = text || "";
}
function setHint(el, text, ok = true) {
  if (!el) return;
  el.style.color = ok ? "#9cff9c" : "#ff8080";
  el.textContent = text || "";
}
function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== deck title =====
function loadDeckTitle(){
  try{ return localStorage.getItem(DECK_TITLE_KEY) || ""; }catch{ return ""; }
}
function saveDeckTitle(t){
  try{ localStorage.setItem(DECK_TITLE_KEY, String(t||"")); }catch{}
}
function normalizeDeckTitle(t){
  const s = String(t||"").trim();
  return s ? s.slice(0, 32) : "";
}

// ===== inject deck title input under save row =====
function ensureDeckTitleInput(){
  const btn = document.getElementById("btnSave");
  if (!btn) return null;
  const row = btn.closest(".roomRow") || btn.parentElement;
  if (!row) return null;

  let input = document.getElementById("deckTitle");
  if (input) return input;

  input = document.createElement("input");
  input.id = "deckTitle";
  input.className = "input";
  input.placeholder = "デッキ名（例：雷速攻）";
  input.maxLength = 32;
  input.style.flex = "1 1 220px";

  // btnSave の手前に差し込む
  row.insertBefore(input, btn);

  // restore
  const saved = normalizeDeckTitle(loadDeckTitle());
  if (saved) input.value = saved;

  input.addEventListener("input", ()=>{
    saveDeckTitle(normalizeDeckTitle(input.value));
  });

  return input;
}

const deckTitleInput = ensureDeckTitleInput();

// =====================
// Labels
// =====================
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
function isExSelectable(def){
  return isExSupport(def) || isSupport(def);
}

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

function firstActionLine(def) {
  const a = def?.actions?.[0];
  const badge = String(def?.badge || "").trim(); // ★追加

  let base = "";
  if (!a) {
    const t = supportEffectTextJa(def?.effect);
    base = t ? `効果: ${t}` : "行動: なし";
  } else {
    base = `行動: ${a.name} / 程:${a.range} / ${a.rate}%`;
  }

  return badge ? `${base}  ${badge}` : base;
}

// =====================
// Deck ops
// =====================
function canAdd(cardId) {
  const def = cardDefs[cardId] || {};
  if (isExSupport(def)) {
    return { ok: false, reason: "EXサポート(kind:ex_support)はデッキに入れません（EX枠で指定）" };
  }
  const total = sumDeck(deckMap);
  if (total >= DECK_SIZE) return { ok: false, reason: `${DECK_SIZE}枚ちょうどにしてください` };
  const c = Number(deckMap[cardId] || 0);
  if (c >= MAX_SAME) return { ok: false, reason: "同名は最大4枚までです" };
  return { ok: true };
}

function clampDeckMap(input){
  const src = (input && typeof input === "object" && !Array.isArray(input)) ? input : {};
  const out = {};
  let total = 0;

  // 安定順（ID順）でクランプ
  const ids = Object.keys(src).sort();

  for (const id of ids){
    const def = cardDefs[id] || {};

    // EXサポートはデッキに入れない
    if (isExSupport(def)) continue;

    let n = Number(src[id] || 0);
    if (!Number.isFinite(n) || n <= 0) continue;

    // 同名上限
    n = Math.min(MAX_SAME, Math.floor(n));

    // デッキ上限
    const room = DECK_SIZE - total;
    if (room <= 0) break;

    n = Math.min(n, room);
    if (n <= 0) continue;

    out[id] = n;
    total += n;
  }

  return out;
}

function clampExSupportId(exId, deck){
  const id = String(exId || "");
  if (!id) return "";
  const def = cardDefs[id];
  if (!def) return "";
  if (!isExSelectable(def)) return "";

  // EXが「サポートの中から選ぶ」設計なら deck内にある必要がある
  // その設計を崩したくないので、無ければ外す
  if (!deck || !deck[id]) return "";
  return id;
}

function addToDeck(cardId) {
  const chk = canAdd(cardId);
  if (!chk.ok) return setMsg(chk.reason, false);
  setMsg("", true);
  deckMap[cardId] = Number(deckMap[cardId] || 0) + 1;
  renderAll();
}
function removeFromDeck(cardId) {
  setMsg("", true);
  const c = Number(deckMap[cardId] || 0);
  if (c <= 0) return;
  const next = c - 1;
  if (next <= 0) delete deckMap[cardId];
  else deckMap[cardId] = next;

  if (selectedExSupportId === cardId && !deckMap[cardId]) {
    selectedExSupportId = "";
    saveSelectedEx("");
  }

  renderAll();
}
function clearDeck() {
  deckMap = {};
  selectedExSupportId = "";
  saveSelectedEx("");
  renderAll();
  setMsg("デッキを全消ししました", true);
  setTimeout(() => setMsg("", true), 800);
}

// ===== EX =====
function loadSelectedEx(){ try { return localStorage.getItem(EX_KEY) || ""; } catch { return ""; } }
function saveSelectedEx(id){ try { localStorage.setItem(EX_KEY, String(id || "")); } catch {} }

function selectExSupport(cardId){
  const def = cardDefs[cardId];
  if (!def) return;

  if (!isExSelectable(def)) {
    setMsg("このカードはEXにできません（サポートのみ）", false);
    return;
  }

  selectedExSupportId = cardId;
  saveSelectedEx(cardId);
  setMsg(`EXを選択：${def.name || cardId}`, true);
  setTimeout(()=>setMsg("", true), 900);
  renderAll();
}
function clearExSupport(){
  selectedExSupportId = "";
  saveSelectedEx("");
  setMsg("EXを解除しました", true);
  setTimeout(()=>setMsg("", true), 900);
  renderAll();
}

// ===== 名前 =====
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
}

async function loadDeckPreferFirestore(rid, pid) {
  // 1) Firestore優先
  try {
    const ps = await getDoc(playerRef(rid, pid));
    if (ps.exists()) {
      const d = ps.data() || {};
      const dm = d.deck || {};

      deckMap = (dm && typeof dm === "object" && !Array.isArray(dm)) ? dm : {};
      deckMap = clampDeckMap(deckMap);

      selectedExSupportId = clampExSupportId(String(d.exSupport || ""), deckMap);

      // タイトル
      if (typeof d.deckTitle === "string" && d.deckTitle.trim()) {
        const t = normalizeDeckTitle(d.deckTitle);
        if (t) {
        saveDeckTitle(t);
        const dt = document.getElementById("deckTitle");
        if (dt) dt.value = t;
        }
      }

      // localへ反映
      saveSelectedEx(selectedExSupportId || "");
      saveLocalDeck();

      return;
    }
  } catch (e) {
    console.warn("loadDeckPreferFirestore fallback to local", e);
  }

  // 2) Firestore無理なら local
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    deckMap = raw ? (JSON.parse(raw) || {}) : {};
  } catch {
    deckMap = {};
  }

  // ✅ ここで local を正規化（この位置が正解）
  deckMap = clampDeckMap(deckMap);
  selectedExSupportId = clampExSupportId(loadSelectedEx(), deckMap);
  saveSelectedEx(selectedExSupportId || "");
  saveLocalDeck();

  // local title
  const t = normalizeDeckTitle(loadDeckTitle());
  const dt = document.getElementById("deckTitle");
  if (dt && t) dt.value = t;
}

function saveLocalDeck() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(deckMap || {})); } catch {} }

// =====================
// Detail
// =====================
function showCardDetail(cardId) {
  openDetail();
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  let html = `<b>${esc(d.name || cardId)}</b> <span class="small">(${esc(cardId)})</span><br>`;
  if (d.kind) html += `種別:${esc(kindLabel(d.kind))}<br>`;
  if (d.type) html += `属性:${esc(d.type)}<br>`;
  if (d.cost !== undefined) html += `コスト:${esc(d.cost)}<br>`;
  if (d.hp !== undefined || d.sp !== undefined) html += `HP:${esc(d.hp)} SP:${esc(d.sp)}<br>`;
  html += `<br>`;
  const badge = String(d.badge || "").trim();
  const note  = String(d.note  || "").trim();
  if (badge) html += `<b>条件</b><br>${esc(badge)}<br><br>`;
  if (note)  html += `<b>説明</b><br>${esc(note)}<br><br>`;

  // ★効果（support/effect）表示
  const effText = supportEffectTextJa(d.effect);
  if (effText) {
    html += `<b>効果</b><br>`;
    html += `${esc(effText)}<br><br>`;
  }

  // ★行動（actions）表示
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
  } else if (!effText) {
    // ★ここがバグってた：eff は存在しないので effText で判定する
    html += `（詳細情報なし）`;
  }

  if (isExSelectable(d)) {
    const isSel = (selectedExSupportId === cardId);
    html += `<hr style="border:0;border-top:1px solid rgba(255,255,255,.15);margin:10px 0;">`;
    html += isSel ? `<b>このカードは現在EXに指定中</b>` : `<b>このカードはEX未指定</b>`;
  }

  detailEl.innerHTML = html;
}

// =====================
// Tabs
// =====================
function setTab(key) {
  if (tabEls.length) {
    for (const el of tabEls) {
      const k = String(el.dataset.tab || "");
      el.classList.toggle("active", k === key);
    }
  }
  if (tabCreateBody) tabCreateBody.hidden = (key !== "create");
  if (tabJoinBody) tabJoinBody.hidden = (key !== "join");
}
function initTabs() {
  if (!tabEls.length && !tabCreateBody && !tabJoinBody) return;
  for (const el of tabEls) el.addEventListener("click", () => setTab(String(el.dataset.tab || "create")));
  setTab("create");
}

// =====================
// Enable/disable
// =====================
let injectedCreateBtn = null;
let injectedJoinBtn = null;

function updatePlayButtons() {
  const total = sumDeck(deckMap);
  const okDeck = (total === DECK_SIZE);

  if (createBtn) createBtn.disabled = !okDeck;

  let okJoin = okDeck;
  if (joinCodeInput) {
    const code = (joinCodeInput.value || "").trim();
    okJoin = okJoin && /^\d{4}$/.test(code);
  }
  if (joinBtn) joinBtn.disabled = !okJoin;

  if (!okDeck) setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);
  else setMsg("", true);

  if (injectedCreateBtn) injectedCreateBtn.disabled = !okDeck;
  if (injectedJoinBtn) injectedJoinBtn.disabled = !okJoin;
}

// =====================
// Render
// =====================
function renderDeck() {
  const total = sumDeck(deckMap);
  if (deckCountEl) deckCountEl.textContent = String(total);

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
      ? `<button class="miniBtn" data-ex="${esc(cardId)}">${isSelEx ? "EX解除" : "EXにする"}</button>`
      : ``;

    const row = document.createElement("div");
    row.className = (cardListEl ? "cardRow" : "card");
    row.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";

    if (cardListEl) {
      row.innerHTML = `
        <div>
          <div class="name">【${esc(def.cost)}】${esc(def.name || cardId)} ${def.type ? esc(def.type) : ""}</div>
          <div class="sub">
            ${def.kind ? esc(kindLabel(def.kind)) + " / " : ""}
            ${(def.hp!==undefined||def.sp!==undefined) ? `HP:${esc(def.hp)} SP:${esc(def.sp)} / ` : ""}
            ${esc(firstActionLine(def))}
          </div>
        </div>
        <div class="btns">
          ${exBtnHtml}
          <button class="miniBtn" data-minus="${esc(cardId)}">-</button>
          <div class="count">${cnt}</div>
          <button class="miniBtn" data-plus="${esc(cardId)}">+</button>
          <button class="miniBtn" data-detail="${esc(cardId)}">詳細</button>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="cardHead">
          <div>
            <b>【${esc(def.cost)}】 ${esc(def.name || cardId)} ${def.type ? esc(def.type) : ""}</b>
            <div class="small">${def.kind ? `種別:${esc(kindLabel(def.kind))} / ` : ""}${(def.hp!==undefined||def.sp!==undefined)?`HP:${esc(def.hp)} / SP:${esc(def.sp)}`:""}</div>
            <div class="small">${esc(firstActionLine(def))}</div>
          </div>
          <div class="btns">
            ${exBtnHtml.replaceAll('class="miniBtn"', "")}
            <button data-minus="${esc(cardId)}">-</button>
            <div class="cnt">${cnt} 枚</div>
            <button data-plus="${esc(cardId)}">+</button>
            <button data-detail="${esc(cardId)}">詳細</button>
          </div>
        </div>
      `;
    }

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

  // EXまとめ表示
  const box = document.createElement("div");
  box.style.marginTop = "10px";
  box.style.padding = "10px";
  box.style.border = "1px solid rgba(255,255,255,.15)";
  box.style.borderRadius = "12px";
  box.style.background = "rgba(0,0,0,.18)";
  const selName = selectedExSupportId ? (cardDefs[selectedExSupportId]?.name || selectedExSupportId) : "未選択";
  box.innerHTML = `
    <div style="font-weight:900;">EX：${esc(selName)}</div>
    <div style="opacity:.8;font-size:12px;margin-top:4px;">
      ※デッキ内のサポートから「EXにする」で指定できます（1枚だけ）
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <button ${selectedExSupportId ? "" : "disabled"} data-ex-clear>EX解除</button>
    </div>
  `;
  box.querySelector("[data-ex-clear]")?.addEventListener("click", clearExSupport);
  deckListEl.appendChild(box);

  updatePlayButtons();
}

function renderCardListNewUI() {
  if (!cardListEl) return;
  cardListEl.innerHTML = "";

  for (const cardId of cardIdsSorted) {
    const def = cardDefs[cardId] || {};
    const cnt = Number(deckMap[cardId] || 0);

    const exOnly = isExSupport(def);
    const isSelEx = exOnly && (selectedExSupportId === cardId);

    const row = document.createElement("div");
    row.className = "cardRow";
    row.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";
    row.innerHTML = `
      <div>
        <div class="name">【${esc(def.cost)}】${esc(def.name || cardId)} ${def.type ? esc(def.type) : ""}</div>
        <div class="sub">
          ${def.kind ? esc(kindLabel(def.kind)) + " / " : ""}
          ${(def.hp!==undefined||def.sp!==undefined) ? `HP:${esc(def.hp)} SP:${esc(def.sp)} / ` : ""}
          ${esc(firstActionLine(def))}
        </div>
      </div>
      <div class="btns">
        ${
          exOnly
            ? `<button class="miniBtn" data-expick>${isSelEx ? "選択中" : "選択"}</button>`
            : `
              <button class="miniBtn" data-minus="${esc(cardId)}" ${cnt <= 0 ? "disabled" : ""}>-</button>
              <div class="count">${cnt} / ${MAX_SAME}</div>
              <button class="miniBtn" data-plus="${esc(cardId)}">+</button>
            `
        }
        <button class="miniBtn" data-detail="${esc(cardId)}">詳細</button>
      </div>
    `;

    row.querySelector("[data-minus]")?.addEventListener("click", (e) => { e.stopPropagation(); removeFromDeck(cardId); });
    row.querySelector("[data-plus]")?.addEventListener("click", (e) => { e.stopPropagation(); addToDeck(cardId); });
    row.querySelector("[data-detail]")?.addEventListener("click", (e) => { e.stopPropagation(); showCardDetail(cardId); });

    row.querySelector("[data-expick]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isSelEx) clearExSupport();
      else selectExSupport(cardId);
    });

    row.addEventListener("click", () => showCardDetail(cardId));
    cardListEl.appendChild(row);
  }
}

function renderCardSectionsOldUI() {
  if (!cardSectionsEl) return;
  cardSectionsEl.innerHTML = "";

  const nameQ = (filterName || "").trim().toLowerCase();
  const matches = cardIdsSorted.filter((id) => {
    const def = cardDefs[id] || {};
    if (filterType !== "ALL" && String(def.type) !== filterType) return false;
    if (nameQ) {
      const nm = String(def.name || id).toLowerCase();
      if (!nm.includes(nameQ)) return false;
    }
    return true;
  });

  if (shownCountEl) shownCountEl.textContent = String(matches.length);

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

      const exOnly = isExSupport(def);
      const isSelEx = exOnly && (selectedExSupportId === cardId);

      const div = document.createElement("div");
      div.className = "card";
      div.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";
      div.innerHTML = `
        <div class="cardHead">
          <div>
            <b>【${esc(def.cost)}】 ${esc(def.name || cardId)} ${def.type ? esc(def.type) : ""}</b>
            <div class="small">${def.kind ? `種別:${esc(kindLabel(def.kind))} / ` : ""}${(def.hp!==undefined||def.sp!==undefined)?`HP:${esc(def.hp)} / SP:${esc(def.sp)}`:""}</div>
            <div class="small">${esc(firstActionLine(def))}</div>
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
        else selectExSupport(cardId);
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

function renderAll() {
  if (cardListEl) renderCardListNewUI();
  if (cardSectionsEl) renderCardSectionsOldUI();
  renderDeck();
}

// =====================
// Save / Create / Join
// =====================
async function ensurePlayerDoc(rid, pid, name) {
  await setDoc(playerRef(rid, pid), {
    name: name || "player",
    deck: deckMap || {},
    exSupport: selectedExSupportId || "",
    deckTitle: normalizeDeckTitle(deckTitleInput?.value || loadDeckTitle() || ""),
    ready: false,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function saveDeckOnly(rid, pid) {
  try {
    deckMap = clampDeckMap(deckMap);
    selectedExSupportId = clampExSupportId(selectedExSupportId, deckMap);
    const name = askNameIfNeeded();

    const title = normalizeDeckTitle(deckTitleInput?.value || loadDeckTitle() || "");
    if (title) saveDeckTitle(title);

    await setDoc(playerRef(rid, pid), {
      name,
      deck: deckMap || {},
      exSupport: selectedExSupportId || "",
      deckTitle: title || "",
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

// 既存ボタンにも付ける（あってもなくてもOK）
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

typeSelect?.addEventListener("change", () => {
  filterType = typeSelect.value || "ALL";
  renderAll();
});
searchEl?.addEventListener("input", () => {
  filterName = searchEl.value || "";
  renderAll();
});
joinCodeInput?.addEventListener("input", updatePlayButtons);

const tutorial = new TutorialSystem();
btnTutorial?.addEventListener("click", () => tutorial.openMenu());
btnRule?.addEventListener("click", () => (location.href = `./rule.html`));

function injectRoomButtonsNearSettings(){
  if (document.getElementById("createBtn") || document.getElementById("joinBtn")) return;
  if (document.querySelector?.('[data-injected="roomButtons"]')) return;

  const wrap = document.createElement("span");
  wrap.dataset.injected = "roomButtons";
  wrap.style.display = "inline-flex";
  wrap.style.gap = "8px";
  wrap.style.alignItems = "center";

  const c = document.createElement("button");
  c.textContent = "ルーム作成";
  c.addEventListener("click", () => handleCreateRoom());

  const j = document.createElement("button");
  j.textContent = "ルーム参加";
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

function setupRoomDrawer(){
  const drawer = document.getElementById("roomDrawer");
  const openBtn = document.getElementById("roomDrawerToggle");
  const closeBtn = document.getElementById("roomDrawerClose");
  const overlay = document.getElementById("roomDrawerOverlay");
  if (!drawer || !openBtn) return;

  const open = ()=>{
    drawer.classList.add("open");
    overlay?.classList?.add("open");
    drawer.setAttribute("aria-hidden","false");
    overlay?.setAttribute?.("aria-hidden","false");
    if (openBtn) openBtn.textContent = "◀";
  };
  const close = ()=>{
    drawer.classList.remove("open");
    overlay?.classList?.remove("open");
    drawer.setAttribute("aria-hidden","true");
    overlay?.setAttribute?.("aria-hidden","true");
    if (openBtn) openBtn.textContent = "▶";
  };

  openBtn.addEventListener("click", ()=> drawer.classList.contains("open") ? close() : open());
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  addEventListener("keydown", (e)=>{ if (e.key === "Escape") close(); });
}
setupRoomDrawer();

// =====================
// Boot
// =====================
if (roomIdLabel) roomIdLabel.textContent = roomId;
if (playerIdLabel) playerIdLabel.textContent = playerId;

ensureNameInUI();

// load title to input
{
  const t = normalizeDeckTitle(loadDeckTitle());
  const dt = document.getElementById("deckTitle");
  if (dt && t && !dt.value.trim()) dt.value = t;
}

await loadCards();
await loadDeckPreferFirestore(roomId, playerId);



// Firestore優先を反映した値をlocalにも
saveSelectedEx(selectedExSupportId || "");
saveLocalDeck();

renderAll();
initTabs();
injectRoomButtonsNearSettings();

touchRoom(roomId, { createdAt: serverTimestamp() }).catch(() => {});

// =====================
// Cloud Deck Library init
// =====================

function getPlayerNameForLibrary(){
  return normalizeName(playerNameInput?.value || loadName() || "") || "player";
}
function getSnapshotForLibrary(){
  const title = normalizeDeckTitle(deckTitleInput?.value || loadDeckTitle() || "") || "無題デッキ";
  return { title, deck: deckMap || {}, exSupport: selectedExSupportId || "" };
}
function applySnapshotFromLibrary(snap){
  const rawDeck = (snap?.deck && typeof snap.deck === "object") ? snap.deck : {};
  const nextDeck = clampDeckMap(rawDeck);

  // ★コピー時は「今作ってた編成は消してOK」＝置き換え運用
  deckMap = nextDeck;

  // EXも正規化（deck内に無いなら外す）
  selectedExSupportId = clampExSupportId(snap?.exSupport, deckMap);
  saveSelectedEx(selectedExSupportId || "");

  const title = normalizeDeckTitle(snap?.title || "");
if (title){
  saveDeckTitle(title);
  const dt = document.getElementById("deckTitle");
  if (dt) dt.value = title;
}

  renderAll();

  const size = sumDeck(deckMap);
  if (size !== DECK_SIZE){
    setMsg(`クラウドデッキをロードしました（自動補正：${size}/${DECK_SIZE}枚）`, false);
  }else{
    setMsg("クラウドデッキをロードしました", true);
  }
  setTimeout(()=> setMsg("", true), 1200);
}

initDeckLibrary({
  db,
  getSnapshot: getSnapshotForLibrary,
  applySnapshot: applySnapshotFromLibrary,
  getPlayerName: getPlayerNameForLibrary,
  getCardDefs: ()=> cardDefs,
  deckTitleInputId: "deckTitle",
});

function prettyEffect(eff){
  if (!eff) return "";
  if (typeof eff === "string") {
    const s = eff.trim();
    if (!s) return "";
    try { eff = JSON.parse(s); } catch { return s; }
  }
  if (typeof eff !== "object") return String(eff);

  // よく使うフィールドを拾う
  const t = String(eff.type || eff.kind || eff.action || "").toLowerCase();
  const rate = (eff.rate !== undefined) ? `成功${eff.rate}%` : "";
  const target = eff.target ? `対象:${eff.target}` : "";
  const tag = eff.tag ? `タグ:${eff.tag}` : "";

  const join = (...xs)=> xs.filter(Boolean).join(" / ");

  // type別に日本語化（必要に応じて増やしていく）
  switch (t) {
    case "draw":   return join("ドロー", eff.n ? `+${eff.n}枚` : "", rate, target);
    case "heal":   return join("回復", eff.hp ? `HP+${eff.hp}` : "", eff.sp ? `SP+${eff.sp}` : "", rate, target);
    case "dmg":    return join("ダメージ", eff.hp ? `HP-${eff.hp}` : "", eff.sp ? `SP-${eff.sp}` : "", rate, target);
    case "modrate":return join("成功率補正", eff.delta!==undefined ? `${eff.delta>0?"+":""}${eff.delta}%` : "", rate, target);
    case "addstatus":
    case "status": return join("状態付与", eff.name || eff.status || "", eff.turn ? `${eff.turn}T` : "", rate, target, tag);
    case "moveto": return join("移動", eff.to!==undefined ? `to:${eff.to}` : "", rate, target);
    case "recover":
    case "rest":   return join("回復(行動回数/疲労)", eff.delta!==undefined ? `${eff.delta>0?"+":""}${eff.delta}`:"", rate, target);

    default: {
      // 分からないやつは「キー=値」で軽く見せる（JSON丸出しよりマシ）
      const keys = Object.keys(eff);
      const compact = keys
        .filter(k => k !== "type")
        .slice(0, 8)
        .map(k => `${k}:${String(eff[k])}`);
      return join(`効果:${eff.type || "?"}`, compact.join(" / "));
    }
  }
}