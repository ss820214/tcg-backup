// public/battle.js
// v20260210_fieldpick_fix_keep_all
// - Keep all existing features
// - FieldPick UI fixed (no undefined btn / no UI wiring inside transaction)

let __audioCtx = null;

function ensureAudio() {
  if (!__audioCtx) {
    __audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // iOS/Safari対策：suspendedならresume
  if (__audioCtx.state === "suspended") {
    __audioCtx.resume().catch(() => {});
  }
}

function beep(freq = 880, ms = 70, gain = 0.04) {
  if (!__audioCtx) return; // まだ解禁されてない時は鳴らさない
  const ctx = __audioCtx;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.value = gain;

  o.connect(g);
  g.connect(ctx.destination);

  const t0 = ctx.currentTime;
  o.start(t0);
  o.stop(t0 + ms / 1000);
}


import { ensureSignedIn } from "./auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  updateDoc, // ← 使わなくなるなら消してOK
  setDoc, // ★追加
  getDoc,
  query,
  where,
  limit,
  runTransaction,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { renderDeckRadar } from "./deck_radar.js?v=20260914_radar_readable1";
import { grantGems } from "./user_store.js?v=20260730_user_support30";

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

const authUser = await ensureSignedIn();
const authUid = authUser?.uid || "";
console.log("[battle] auth ok", authUid);
// =====================
// URL params
// =====================
const qs = new URLSearchParams(location.search);

function newRoomCode4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
function newPlayerId() {
  return crypto.randomUUID?.() ?? "p" + Math.random().toString(16).slice(2);
}
function isValidRoomCode4(v) {
  const s = String(v || "").trim();
  return /^\d{4}$/.test(s) && s !== "0000";
}
function sanitizeRoomId(v) {
  const s = String(v || "").trim();
  return isValidRoomCode4(s) ? s : newRoomCode4();
}
function normalizeFieldId(f, opts = {}) {
  const fallback = opts.fallback ?? "grass";
  const raw = String(f ?? "").trim();
  const t = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (t === "danger" || t === "dangerzone" || raw.includes("危険")) return "danger";
  if (t === "swamp" || raw.includes("沼")) return "swamp";
  if (t === "grass" || raw.includes("草")) return "grass";
  return fallback;
}

const rawRoomId = qs.get("room");
const rawPlayerId = qs.get("player");
let roomId = sanitizeRoomId(rawRoomId);
let playerId = rawPlayerId || newPlayerId();
const action = (qs.get("action") || "join").toLowerCase();

const isSolo =
  qs.get("solo") === "1" || (qs.get("mode") || "").toLowerCase() === "solo";

const fieldIdParam = normalizeFieldId(qs.get("field"), { fallback: "" });

if (roomId !== rawRoomId || playerId !== rawPlayerId) {
  const fixedUrl = new URL(location.href);
  fixedUrl.searchParams.set("room", roomId);
  fixedUrl.searchParams.set("player", playerId);
  history.replaceState(null, "", fixedUrl.toString());
}

if (!roomId || !playerId) {
  alert("URLに room / player がありません");
  throw new Error("missing room/player");
}

// mode=solo だけで来た場合も solo=1 を自動付与して統一
if (!qs.get("solo") && (qs.get("mode") || "").toLowerCase() === "solo") {
  const u = new URL(location.href);
  u.searchParams.set("solo", "1");
  history.replaceState(null, "", u.toString());
}

// =====================
// DOM
// =====================
const roomIdEl = document.getElementById("roomId");
const statusEl = document.getElementById("status");
const playersUl = document.getElementById("players");
const readyBtn = document.getElementById("readyBtn");
const readyNote = document.getElementById("readyNote");

const myDeckEl = document.getElementById("myDeck");
const deckDetailEl = document.getElementById("deckDetail");

const p1NameEl = document.getElementById("p1Name");
const p2NameEl = document.getElementById("p2Name");
const p1ReadyEl = document.getElementById("p1Ready");
const p2ReadyEl = document.getElementById("p2Ready");
const p1YouEl = document.getElementById("p1You");
const p2YouEl = document.getElementById("p2You");

const attrDistEl = document.getElementById("attrDist");

const fieldPickEl = document.getElementById("fieldPick");
const fieldPickNoteEl = document.getElementById("fieldPickNote");
let selectedFieldId = fieldIdParam || "";
let lastDeckVisualSignature = null;

roomIdEl.textContent = roomId;

const aiToggle = document.getElementById("aiToggle");
// battle.js
const CPU_ID = "cpu";
let cpuBooted = false;

// =====================
// Firestore refs
// =====================
const cpuRef = doc(db, "rooms", roomId, "players", CPU_ID);
const playersRef = collection(db, "rooms", roomId, "players");
const myRef = doc(db, "rooms", roomId, "players", playerId);
const matchRef = doc(db, "rooms", roomId, "game", "match");

// =====================
// Field pick helpers（A/B希望 → matchで確定）
// =====================
const FIELD_META = {
  grass: { label: "草原", code: "grass" },
  danger: { label: "危険地帯", code: "danger" },
  swamp: { label: "沼地", code: "swamp" },
};
const FIELD_LIST = Object.keys(FIELD_META);

function randField() {
  return FIELD_LIST[Math.floor(Math.random() * FIELD_LIST.length)];
}
function dice1to6() {
  return 1 + Math.floor(Math.random() * 6);
}

// このブラウザ(自分)の「希望フィールド」
// - URLに field があればそれを優先
// - 無ければランダム
function myDesiredField() {
  if (selectedFieldId) return normalizeFieldId(selectedFieldId);
  if (fieldIdParam) return normalizeFieldId(fieldIdParam);
  return randField();
}

// =====================
// FieldPick UI（トップレベル）
// =====================
function prettyFieldJP(f) {
  const t = normalizeFieldId(f, { fallback: "" });
  return FIELD_META[t]?.label || t || "---";
}

function renderFieldPick(current) {
  if (!fieldPickEl) return;
  const cur = normalizeFieldId(current, { fallback: "" });
  if (cur) selectedFieldId = cur;
  fieldPickEl.dataset.field = cur || "";

  fieldPickEl.querySelectorAll("button[data-field]").forEach((btn) => {
    const f = String(btn.dataset.field || "").toLowerCase();
    btn.classList.toggle("on", !!cur && f === cur);
  });

  if (fieldPickNoteEl) {
    fieldPickNoteEl.textContent = cur
      ? `希望：${prettyFieldJP(cur)} (${FIELD_META[cur]?.code || cur})`
      : "未選択";
  }
}

async function setDesiredField(f) {
  const v = normalizeFieldId(f, { fallback: "" });
  if (!v) return;
  selectedFieldId = v;

  try {
    await setDoc(
      myRef,
      { desiredField: v, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.warn("[fieldPick] set failed", e);
  }

  renderFieldPick(v);
}

function wireFieldPickButtons() {
  if (!fieldPickEl) return;

  fieldPickEl.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-field]");
    if (!btn) return;
    setDesiredField(btn.dataset.field);
  });
}
if (aiToggle) {
  // ソロならデフォルトONにしてもいい（好み）
  if (isSolo) aiToggle.checked = true;

  aiToggle.addEventListener("change", async () => {
    cpuBooted = false; // ONにした瞬間にbootし直せるように
    if (isSolo && aiToggle.checked) {
      await bootCpuIfEnabled();
      // 表示更新したいなら軽く
      statusEl.textContent = "AI対戦：CPUを準備しています…";
    } else {
      statusEl.textContent = "AI対戦OFF：相手の入室を待っています…";
    }
  });
}
wireFieldPickButtons();

// =====================
// Match intro (between lobby -> game)
// =====================
function goToMatchIntro() {
  const url = new URL("./match_intro.html?v=20260727_room_field_fix1", location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set("player", playerId);
  url.searchParams.set("field", normalizeFieldId(selectedFieldId || fieldIdParam, { fallback: "grass" }));

  // ソロ時は URL を人間がいじらなくて済むように solo=1 を引き回す
  if (isSolo) {
    url.searchParams.set("solo", "1");
    url.searchParams.set("mode", "solo");
    url.searchParams.set("next", "game.html?v=20260727_evolve_inline_btn_off1&solo=1");
  } else {
    url.searchParams.set("next", "game.html?v=20260727_evolve_inline_btn_off1");
  }

  location.href = url.toString();
}

// =====================
// Helpers
// =====================
async function ensureCpuPlayerDocFromMe() {
  const meSnap = await getDoc(myRef);
  if (!meSnap.exists()) return;
  const me = meSnap.data() || {};

  const cpuSnap = await getDoc(cpuRef);
  const patch = {
    name: "CPU",
    ready: true,
    isCpu: true,
    deck: safeObj(me.deck),
    exSupport: me.exSupport || "",
    desiredField: me.desiredField || myDesiredField(),
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  };

  if (!cpuSnap.exists()) {
    await setDoc(cpuRef, patch, { merge: true });
  } else {
    await setDoc(cpuRef, patch, { merge: true });
  }
}

async function loadRandomPublicDeck() {
  const decksCol = collection(db, "decks");

  const q1 = query(
    decksCol,
    where("visibility", "==", "public"),
    limit(100),
  );

  const snap = await getDocs(q1);
  const items = [];

  snap.forEach((d) => {
    const v = d.data() || {};
    if (v.deck && typeof v.deck === "object" && !Array.isArray(v.deck)) {
      items.push({
        id: d.id,
        ...v,
      });
    }
  });

  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

async function ensureCpuPlayerDocFromPublicDeck({ db, cpuRef }) {
  const picked = await loadRandomPublicDeck();

  // 公開デッキが1件も無い時だけ、自分のデッキコピーにフォールバック
  if (!picked) {
    await ensureCpuPlayerDocFromMe();
    return;
  }

  const patch = {
    name: picked?.title
      ? `CPU:${picked.title}${picked?.ownerName ? ` (${picked.ownerName})` : ""}`
      : "CPU",
    ready: true,
    isCpu: true,
    deck: safeObj(picked?.deck),
    exSupport: picked?.exSupport || "",
    desiredField: picked?.desiredField || myDesiredField(),
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  };

  await setDoc(cpuRef, patch, { merge: true });
}

async function bootCpuIfEnabled() {
  // ソロ以外は何もしない
  if (!isSolo) return;
  // UIが無い/未チェックなら何もしない（=従来通り人待ち）
  if (!aiToggle || !aiToggle.checked) return;

  if (cpuBooted) return;
  cpuBooted = true;

  try {
    await ensureCpuPlayerDocFromPublicDeck({ db, cpuRef });
  } catch (e) {
    console.warn("[cpu] boot failed", e);
  }
}

function safeObj(o) {
  return o && typeof o === "object" && !Array.isArray(o) ? o : {};
}

function deckVisualSignature(deckObj) {
  const dObj = safeObj(deckObj);
  return Object.keys(dObj)
    .filter((id) => Number(dObj[id] || 0) > 0)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => `${id}:${Number(dObj[id] || 0)}`)
    .join("|");
}

function renderDeckAnalysisIfChanged(deckObj) {
  const sig = deckVisualSignature(deckObj);
  if (sig === lastDeckVisualSignature) return;
  lastDeckVisualSignature = sig;
  renderDeckRadar(
    "battleDeckRadar",
    "battleDeckRadarText",
    deckObj || {},
    cardDefs,
  );
  renderAttrDist(deckObj || {});
}

function autoName(pid) {
  const s = String(pid || "");
  return "Player-" + s.slice(0, 4);
}

function isSupportCard(def) {
  if (!def) return false;
  const kind = String(def?.kind || "").toLowerCase();
  if (kind === "support" || kind === "ex_support" || kind === "exsupport") return true;
  const type = String(def?.type || "").toLowerCase();
  if (type === "support" || type === "サポート") return true;
  const hasEffect = def.effect != null;
  const acts = Array.isArray(def.actions) ? def.actions : [];
  return hasEffect && acts.length === 0;
}

function displayType(def) {
  if (!def) return "unknown";
  if (isSupportCard(def)) return "サポート";
  return String(def?.type ?? "unknown");
}

// --- Local fallback keys (align with deck.js v2.x + older keys)
const LOCAL_DECK_KEYS = [
  "tcg_deck_local_v20260202_30",
  "tcg_deck_local_v15b",
  "tcg_deck_local_v1",
  "tcg_deck_local",
];

const LOCAL_EX_KEYS = [
  "tcg_ex_support_v20260202_30", // ← deck.js と同じ（EX_KEY）
  "tcg_ex_local_v20260129",
];

function loadLocalDeckFallback() {
  for (const k of LOCAL_DECK_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const d = safeObj(obj);
      if (Object.keys(d).some((id) => Number(d[id] || 0) > 0)) return d;
    } catch {}
  }
  return {};
}

function loadLocalExFallback() {
  for (const k of LOCAL_EX_KEYS) {
    try {
      const v = localStorage.getItem(k);
      if (v) return String(v);
    } catch {}
  }
  return null;
}

function effectText(a) {
  const parts = [];
  if (a?.dmg !== undefined) parts.push(`HP-${a.dmg}`);
  if (a?.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
  if (a?.draw !== undefined) parts.push(`ドロー+${a.draw}`);
  return parts.length ? parts.join(" / ") : "効果";
}

// =====================
// Cards definitions
// =====================
let cardDefs = {};
async function loadCards() {
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach((d) => (m[d.id] = d.data()));
  cardDefs = m;
}
await loadCards();

// =====================
// UI: VS Banner
// =====================
function setReadyBadge(el, isReady) {
  if (!el) return;
  el.classList.remove("ok", "ng");
  if (isReady) {
    el.textContent = "READY!";
    el.classList.add("ok");
  } else {
    el.textContent = "";
    el.classList.add("ng");
  }
}

function renderVs(players) {
  const ids = players.map((p) => p.id).sort();
  const p1 = players.find((p) => p.id === ids[0]);
  const p2 = players.find((p) => p.id === ids[1]);
  const readyAll = !!p1?.ready && !!p2?.ready;
  document.body.classList.toggle("lobbyReadyAll", readyAll);

  if (!p1 && !p2) {
    p1NameEl.textContent = "---";
    p2NameEl.textContent = "---";
    setReadyBadge(p1ReadyEl, false);
    setReadyBadge(p2ReadyEl, false);
    p1YouEl.textContent = "";
    p2YouEl.textContent = "";
    document.body.classList.remove("lobbyReadyAll");
    return;
  }

  p1NameEl.textContent = p1?.name || "---";
  p2NameEl.textContent = p2?.name || "（相手待ち）";

  setReadyBadge(p1ReadyEl, !!p1?.ready);
  setReadyBadge(p2ReadyEl, !!p2?.ready);

  p1YouEl.textContent = p1?.id === playerId ? "YOU" : "";
  p2YouEl.textContent = p2?.id === playerId ? "YOU" : "";
}

// =====================
// UI: 属性分布（自分のデッキ）
// =====================
function typeColor(type) {
  const t = String(type || "").toLowerCase();
  if (t.includes("fire") || t.includes("炎") || t.includes("火"))
    return "rgba(255,91,106,.85)";
  if (t.includes("water") || t.includes("水")) return "rgba(106,169,255,.85)";
  if (t.includes("wind") || t.includes("風")) return "rgba(61,255,141,.75)";
  if (t.includes("earth") || t.includes("土")) return "rgba(220,190,120,.85)";
  if (t.includes("dark") || t.includes("闇")) return "rgba(170,120,255,.85)";
  if (t.includes("light") || t.includes("光")) return "rgba(255,215,0,.85)";
  if (t.includes("steel") || t.includes("metal") || t.includes("鋼"))
    return "rgba(200,200,200,.65)";
  if (t.includes("thunder") || t.includes("雷")) return "rgba(255,230,120,.75)";
  if (t.includes("grass") || t.includes("草")) return "rgba(140,255,140,.65)";
  if (t.includes("support") || t.includes("サポート"))
    return "rgba(255,255,255,.35)";
  return "rgba(255,255,255,.45)";
}

function renderAttrDist(deckObj) {
  const dObj = safeObj(deckObj);
  const entries = Object.keys(dObj)
    .map((id) => ({ id, count: Number(dObj[id] || 0) }))
    .filter((x) => x.count > 0);

  const total = entries.reduce((a, b) => a + b.count, 0);
  if (!total) {
    attrDistEl.innerHTML = `<div class="muted">デッキが空です</div>`;
    return;
  }

  const map = new Map();
  let supportCount = 0;
  let unitTotal = 0;
  for (const it of entries) {
    const def = cardDefs[it.id];
    if (isSupportCard(def)) {
      supportCount += it.count;
      continue;
    }
    const type = displayType(def);
    if (!type || type === "unknown") continue;
    unitTotal += it.count;
    map.set(type, (map.get(type) || 0) + it.count);
  }

  const rows = Array.from(map.entries())
    .map(([type, cnt]) => ({ type, cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  attrDistEl.innerHTML = "";
  if (!unitTotal) {
    attrDistEl.innerHTML = `<div class="muted">キャラカードの属性がありません（サポート${supportCount}枚）</div>`;
    return;
  }
  for (const r of rows) {
    const pct = Math.round((r.cnt / unitTotal) * 100);
    const row = document.createElement("div");
    row.className = "attrRow";

    const name = document.createElement("div");
    name.className = "attrName";
    name.textContent = String(r.type);

    const bar = document.createElement("div");
    bar.className = "attrBar";

    const fill = document.createElement("div");
    fill.className = "attrFill";
    fill.style.width = `${pct}%`;
    fill.style.background = typeColor(r.type);

    bar.appendChild(fill);

    const pctEl = document.createElement("div");
    pctEl.className = "attrPct";
    pctEl.textContent = `${pct}%`;

    row.appendChild(name);
    row.appendChild(bar);
    row.appendChild(pctEl);

    attrDistEl.appendChild(row);
  }
  if (supportCount > 0) {
    const note = document.createElement("div");
    note.className = "muted small";
    note.style.marginTop = "8px";
    note.textContent = `サポート ${supportCount}枚は属性分布から除外して評価しています。`;
    attrDistEl.appendChild(note);
  }
}

// =====================
// Deck list + detail
// =====================
function renderCardDetail(cardId) {
  const c = cardDefs[cardId];
  if (!c) {
    deckDetailEl.textContent =
      "カード定義が見つからない（cardsコレクション確認）";
    return;
  }
  const actions = Array.isArray(c.actions) ? c.actions : [];

  let html = `<b>${cardId}：${c.name ?? "?"}</b><br>`;
  html += `分類：${displayType(c)} / コスト：${c.cost ?? "?"}<br>`;

  if (!isSupportCard(c)) {
    html += `HP：${c.hp ?? "?"} / SP：${c.sp ?? "?"}<br><br>`;
  } else {
    html += `<br>`;
  }

  if (isSupportCard(c)) {
    html += `<b>サポート</b><br>`;
    html += `<div class="muted small">（効果の実行は game 側で反映されます）</div>`;
    deckDetailEl.innerHTML = html;
    return;
  }

  html += `<b>行動</b><br>`;
  if (actions.length === 0) {
    html += `行動なし`;
  } else {
    actions.forEach((a) => {
      html += `【${a.cost ?? "?"}】${a.name ?? "?"}<br>`;
      html += `射程：${a.range ?? "?"} / 成功：${a.rate ?? "?"}% / 効果：${effectText(a)}<br>`;
      html += `<br>`;
    });
  }

  deckDetailEl.innerHTML = html;
}

function renderMyDeck(deckObj, exCardId) {
  myDeckEl.innerHTML = "";

  const dObj = safeObj(deckObj);
  const items = Object.keys(dObj)
    .map((id) => ({ id, count: Number(dObj[id] || 0) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (items.length === 0) {
    myDeckEl.textContent = "デッキが空です（deck画面で保存してから来てね）";
    return;
  }

  if (exCardId) {
    const exBtn = document.createElement("button");
    const name = cardDefs[exCardId]?.name ?? exCardId;
    exBtn.textContent = `EX: ${name} (${exCardId})`;
    exBtn.onclick = () => renderCardDetail(exCardId);
    myDeckEl.appendChild(exBtn);
  }

  items.forEach((x) => {
    const btn = document.createElement("button");
    const name = cardDefs[x.id]?.name ?? x.id;
    btn.textContent = `${name} (${x.id}) x${x.count}`;
    btn.onclick = () => renderCardDetail(x.id);
    myDeckEl.appendChild(btn);
  });

  renderCardDetail(exCardId || items[0].id);
}

// =====================
// 参加処理（維持）
// =====================
async function ensureMyPlayerDoc() {
  const localDeck = loadLocalDeckFallback();
  const localEx = loadLocalExFallback();

  const pSnap = await getDocs(playersRef);
  const ids = pSnap.docs.map((d) => d.id);
  const alreadyIn = ids.includes(playerId);
  const count = ids.length;

  if (action === "join" && count >= 2 && !alreadyIn) {
    alert("このルームは満員です（2人参加済み）");
    throw new Error("room full");
  }

  await runTransaction(db, async (tx) => {
    const meSnap = await tx.get(myRef);

    if (!meSnap.exists()) {
      tx.set(myRef, {
        name: autoName(playerId),
        ready: false,
        deck: Object.keys(localDeck).length ? localDeck : {},
        exSupport: localEx || "",
        desiredField: myDesiredField(),
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const me = meSnap.data() || {};
    const deck = safeObj(me.deck);
    const hasDeck = Object.keys(deck).some((k) => Number(deck[k] || 0) > 0);

    const patch = { updatedAt: serverTimestamp() };

    const normalizedDesired = normalizeFieldId(me.desiredField, { fallback: "" });
    if (!normalizedDesired) patch.desiredField = myDesiredField();
    else if (normalizedDesired !== String(me.desiredField || "").trim().toLowerCase()) {
      patch.desiredField = normalizedDesired;
    }
    if (!hasDeck && Object.keys(localDeck).length) patch.deck = localDeck;
    if (!me.exSupport && localEx) patch.exSupport = localEx;

    tx.set(myRef, patch, { merge: true });
  });
}

await ensureMyPlayerDoc();

// =====================
// 自分の情報監視
// =====================
onSnapshot(myRef, (snap) => {
  const me = snap.data();
  if (isSolo && aiToggle?.checked) {
    statusEl.textContent = me.ready
      ? "✅ 準備OK！CPU戦を開始します…"
      : "AI対戦：準備完了を押すと開始します";
  }

  if (!snap.exists()) {
    statusEl.textContent = "プレイヤー情報が見つからない（joinから入り直して）";
    readyBtn.disabled = true;
    return;
  }
  
  /// ソロ＆AI ONならCPUを用意（公開デッキから取得）
if (isSolo && aiToggle?.checked) {
    bootCpuIfEnabled().catch(() => {});
}

  renderFieldPick(me.desiredField || "");

  readyBtn.disabled = false;
  readyBtn.textContent = me.ready ? "準備解除" : "準備完了";
  readyNote.textContent = me.ready
    ? "✅ 準備OK（解除もできます）"
    : "⏳ 準備中";
  statusEl.textContent = me.ready
    ? "準備OK！相手の準備を待っています…"
    : "相手の入室を待っています…";

  renderMyDeck(me.deck, me.exSupport || null);
  renderDeckAnalysisIfChanged(me.deck || {});
});

// =====================
// 参加者一覧監視（両readyでmatch作成→introへ）
// =====================
let prevIds = new Set();
let prevReadyMap = new Map();
let alreadyMoved = false;

onSnapshot(playersRef, async (snap) => {
  // ソロ＆AI ONならCPUを部屋に入れてREADYにする（2人条件を満たす）
  await bootCpuIfEnabled();

  playersUl.innerHTML = "";

  const players = [];
  let readyCount = 0;

  snap.forEach((d) => {
    const p = d.data();
    players.push({ id: d.id, ...p });

    const li = document.createElement("li");
    li.textContent = `${p.name} ${p.ready ? "✅ 準備OK" : "⏳ 準備中"}`;
    playersUl.appendChild(li);

    if (p.ready) readyCount++;
  });

  renderVs(players);

  const nowIds = new Set(players.map((p) => p.id));
  for (const id of nowIds) {
    if (!prevIds.has(id)) {
      const name = players.find((x) => x.id === id)?.name || "誰か";
      if (id !== playerId) {
        beep(740, 70, 0.03);
        statusEl.textContent = `${name} が入室しました！`;
      }
    }
  }
  prevIds = nowIds;

  const nowReadyMap = new Map(players.map((p) => [p.id, !!p.ready]));
  for (const [id, nowReady] of nowReadyMap.entries()) {
    const prevReady = prevReadyMap.get(id);
    if (prevReady !== undefined && prevReady !== nowReady && id !== playerId) {
      // 相手がREADYになった/解除した瞬間だけ鳴らす
      if (nowReady)
        beep(660, 90, 0.035); // READY音（少し低め）
      else beep(440, 70, 0.03); // 解除音（さらに低め）

      // 画面表示だけ更新したいなら statusEl/readyNote を軽く変えるのが良い
      const name = players.find((x) => x.id === id)?.name || "相手";
      statusEl.textContent = nowReady
        ? `${name} が準備OK！`
        : `${name} が準備解除`;
    }
  }
  prevReadyMap = nowReadyMap;

  if (players.length < 2) return;

  // 先に match がもうあるなら、それを信じて intro へ（多端末同時の保険）
  try {
    const ms = await getDoc(matchRef);
    if (ms.exists()) {
      goToMatchIntro();
      return;
    }
  } catch (e) {
    console.warn("[battle] pre-check match failed", e);
  }

  if (readyCount >= 2 && !alreadyMoved) {
    alreadyMoved = true;

    await runTransaction(db, async (tx) => {
      const m = await tx.get(matchRef);
      if (m.exists()) return;

      const ids = players.map((p) => p.id).sort();
      const seatA = ids[0];
      const seatB = ids[1];

      const aRef = doc(db, "rooms", roomId, "players", seatA);
      const bRef = doc(db, "rooms", roomId, "players", seatB);

      const aSnap = await tx.get(aRef);
      const bSnap = await tx.get(bRef);

      const aData = aSnap.exists() ? aSnap.data() || {} : {};
      const bData = bSnap.exists() ? bSnap.data() || {} : {};

      const fieldA = normalizeFieldId(aData.desiredField, { fallback: randField() });
      const fieldB = normalizeFieldId(bData.desiredField, { fallback: randField() });

      let diceA = 0;
      let diceB = 0;
      let finalField = fieldA;

      if (fieldA === fieldB) {
        finalField = fieldA;
      } else {
        for (let i = 0; i < 10; i++) {
          diceA = dice1to6();
          diceB = dice1to6();
          if (diceA !== diceB) break;
        }
        finalField = diceA >= diceB ? fieldA : fieldB;
      }

      tx.set(matchRef, {
        seatA,
        seatB,
        fieldA,
        fieldB,
        diceA,
        diceB,
        field: finalField,
        fieldRule: "dice_if_diff",
        startedAt: serverTimestamp(),
      });
    });

    goToMatchIntro();
  }
});

// 準備トグル
readyBtn.onclick = async () => {
  ensureAudio();
  beep(880, 60, 0.04);

  const me = await getDoc(myRef);
  if (!me.exists()) return;

  await setDoc(
    myRef,
    { ready: !me.data().ready, updatedAt: serverTimestamp() },
    { merge: true },
  );
};

// =====================
// ピンポン（オフライン）
// =====================
const ball = document.getElementById("ball");
const pingBtn = document.getElementById("pingBtn");
const pingResetBtn = document.getElementById("pingResetBtn");
const pingStatus = document.getElementById("pingStatus");
const pongPanel = document.querySelector(".pongPanel");
const pongStage = document.querySelector(".pong");
const pongPaddle = document.querySelector(".paddle");
const pongScoreEl = document.getElementById("pongScore");
const pongComboEl = document.getElementById("pongCombo");
const pongRewardEl = document.getElementById("pongReward");

let x = 0;
let vx = -3.8;
let score = 0;
let combo = 0;
let miss = 0;
let rewardTotal = 0;
let lastRewardCombo = 0;
let rewardQueue = Promise.resolve();

function pongMaxX() {
  const stageW = pongStage?.clientWidth || 340;
  const ballW = ball?.offsetWidth || 18;
  return Math.max(70, stageW - ballW - 8);
}

function setPongText(text) {
  if (pingStatus) pingStatus.textContent = text;
}

function renderPongHud() {
  if (pongScoreEl) pongScoreEl.textContent = String(score);
  if (pongComboEl) pongComboEl.textContent = String(combo);
  if (pongRewardEl) pongRewardEl.textContent = `+${rewardTotal}`;
}

function resetPong() {
  x = pongMaxX();
  vx = -3.8;
  score = 0;
  combo = 0;
  miss = 0;
  rewardTotal = 0;
  lastRewardCombo = 0;
  setPongText("スタート！ 左端の光るラインで打ち返す！");
  renderPongHud();
}
resetPong();

function flashPongHit() {
  ball?.classList.remove("hitFlash");
  pongPaddle?.classList.remove("hitFlash");
  void ball?.offsetWidth;
  ball?.classList.add("hitFlash");
  pongPaddle?.classList.add("hitFlash");
  setTimeout(() => {
    ball?.classList.remove("hitFlash");
    pongPaddle?.classList.remove("hitFlash");
  }, 320);
}

function flashPongReward() {
  pongPanel?.classList.remove("rewardFlash");
  void pongPanel?.offsetWidth;
  pongPanel?.classList.add("rewardFlash");
  setTimeout(() => pongPanel?.classList.remove("rewardFlash"), 950);
}

function maybeRewardPongCombo() {
  if (!authUid || combo < 20 || combo % 20 !== 0 || combo === lastRewardCombo) return;
  lastRewardCombo = combo;
  rewardTotal += 10;
  renderPongHud();
  flashPongReward();
  setPongText(`${combo}コンボ！ +10 Gems 付与中...`);
  rewardQueue = rewardQueue
    .then(() => grantGems(authUid, 10, `pong_combo_${combo}`))
    .then(() => {
      setPongText(`${combo}コンボ達成！ +10 Gems を受け取りました`);
    })
    .catch((e) => {
      console.warn("[pong] gem reward failed", e);
      setPongText(`${combo}コンボ達成！ ジェム付与は通信後に再挑戦してね`);
    });
}

function tick() {
  if (!ball || !pongStage) return;
  x += vx;
  const maxX = pongMaxX();

  if (x <= 0) {
    miss++;
    combo = 0;
    setPongText(`ミス！ score=${score} / miss=${miss}`);
    renderPongHud();
    vx = Math.abs(vx);
  }

  if (x >= maxX) {
    x = maxX;
    vx = -Math.abs(vx);
  }

  ball.style.left = `${x}px`;
  pongStage.style.setProperty("--ball-x", `${Math.round((x / Math.max(maxX, 1)) * 100)}%`);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

if (pingBtn) pingBtn.onclick = () => {
  ensureAudio();
  const hitZone = 54;
  const canHit = vx < 0 && x <= hitZone;
  if (canHit) {
    score++;
    combo++;
    vx = Math.min(Math.abs(vx) * 1.055, 11);
    beep(720 + Math.min(combo, 30) * 16, 48, 0.035);
    flashPongHit();
    setPongText(`ナイス！ ${combo}コンボ / score=${score} / miss=${miss}`);
    renderPongHud();
    maybeRewardPongCombo();
  } else {
    beep(180, 60, 0.025);
    setPongText(`早押し！ 光るラインまで引きつけてね / score=${score}`);
  }
};
if (pingResetBtn) pingResetBtn.onclick = resetPong;
