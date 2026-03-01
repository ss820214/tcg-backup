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

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { renderDeckRadar } from "./deck_radar.js";

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
// URL params
// =====================
const qs = new URLSearchParams(location.search);

const roomId = qs.get("room");
const playerId = qs.get("player");
const action = (qs.get("action") || "join").toLowerCase();

const fieldIdParam = (qs.get("field") || "").trim().toLowerCase();

if (!roomId || !playerId) {
  alert("URLに room / player がありません");
  throw new Error("missing room/player");
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

roomIdEl.textContent = roomId;

// =====================
// Firestore refs
// =====================
const playersRef = collection(db, "rooms", roomId, "players");
const myRef = doc(db, "rooms", roomId, "players", playerId);
const matchRef = doc(db, "rooms", roomId, "game", "match");

// =====================
// Field pick helpers（A/B希望 → matchで確定）
// =====================
const FIELD_LIST = ["grass", "danger", "swamp"];

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
  if (fieldIdParam) return fieldIdParam;
  return randField();
}

// =====================
// FieldPick UI（トップレベル）
// =====================
function prettyFieldJP(f) {
  const t = String(f || "")
    .trim()
    .toLowerCase();
  if (t === "grass") return "草原";
  if (t === "danger") return "危険地帯";
  if (t === "swamp") return "沼地";
  return t || "---";
}

function renderFieldPick(current) {
  if (!fieldPickEl) return;
  const cur = String(current || "")
    .trim()
    .toLowerCase();

  fieldPickEl.querySelectorAll("button[data-field]").forEach((btn) => {
    const f = String(btn.dataset.field || "").toLowerCase();
    btn.classList.toggle("on", !!cur && f === cur);
  });

  if (fieldPickNoteEl) {
    fieldPickNoteEl.textContent = cur
      ? `希望：${prettyFieldJP(cur)} (${cur})`
      : "未選択";
  }
}

async function setDesiredField(f) {
  const v = String(f || "")
    .trim()
    .toLowerCase();
  if (!v) return;
  try {
    await updateDoc(myRef, { desiredField: v, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn("[fieldPick] update failed", e);
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
wireFieldPickButtons();

// =====================
// Match intro (between lobby -> game)
// =====================
function goToMatchIntro() {
  const url = new URL("./match_intro.html", location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set("player", playerId);
  url.searchParams.set("next", "game.html");
  location.href = url.toString();
}

// =====================
// Helpers
// =====================
function safeObj(o) {
  return o && typeof o === "object" && !Array.isArray(o) ? o : {};
}

function autoName(pid) {
  const s = String(pid || "");
  return "Player-" + s.slice(0, 4);
}

function isSupportCard(def) {
  return String(def?.kind || "").toLowerCase() === "support";
}

function displayType(def) {
  if (!def) return "unknown";
  if (isSupportCard(def)) return "サポート";
  return String(def?.type ?? "unknown");
}

// --- Local fallback keys (align with deck.js v2.x + older keys)
const LOCAL_DECK_KEYS = [
  "tcg_deck_local_v15b",
  "tcg_deck_local_v1",
  "tcg_deck_local",
];

const LOCAL_EX_KEYS = ["tcg_ex_local_v20260129"];

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

  if (!p1 && !p2) {
    p1NameEl.textContent = "---";
    p2NameEl.textContent = "---";
    setReadyBadge(p1ReadyEl, false);
    setReadyBadge(p2ReadyEl, false);
    p1YouEl.textContent = "";
    p2YouEl.textContent = "";
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
  for (const it of entries) {
    const def = cardDefs[it.id];
    const type = displayType(def);
    map.set(type, (map.get(type) || 0) + it.count);
  }

  const rows = Array.from(map.entries())
    .map(([type, cnt]) => ({ type, cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  attrDistEl.innerHTML = "";
  for (const r of rows) {
    const pct = Math.round((r.cnt / total) * 100);
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
        exCardId: localEx || null,
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

    if (!me.desiredField) patch.desiredField = myDesiredField();
    if (!hasDeck && Object.keys(localDeck).length) patch.deck = localDeck;
    if (!me.exCardId && localEx) patch.exCardId = localEx;

    tx.set(myRef, patch, { merge: true });
  });
}

await ensureMyPlayerDoc();

// =====================
// 自分の情報監視
// =====================
onSnapshot(myRef, (snap) => {
  if (!snap.exists()) {
    statusEl.textContent = "プレイヤー情報が見つからない（joinから入り直して）";
    readyBtn.disabled = true;
    return;
  }
  const me = snap.data();

  renderFieldPick(me.desiredField || "");

  readyBtn.disabled = false;
  readyBtn.textContent = me.ready ? "準備解除" : "準備完了";
  readyNote.textContent = me.ready
    ? "✅ 準備OK（解除もできます）"
    : "⏳ 準備中";
  statusEl.textContent = me.ready
    ? "準備OK！相手の準備を待っています…"
    : "相手の入室を待っています…";

  renderMyDeck(me.deck, me.exCardId || null);
  renderDeckRadar(
    "battleDeckRadar",
    "battleDeckRadarText",
    me.deck || {},
    cardDefs,
  );
  renderAttrDist(me.deck || {});
});

// =====================
// 参加者一覧監視（両readyでmatch作成→introへ）
// =====================
let prevIds = new Set();
let prevReadyMap = new Map();
let alreadyMoved = false;

onSnapshot(playersRef, async (snap) => {
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

      const fieldA =
        String(aData.desiredField || "")
          .trim()
          .toLowerCase() || randField();
      const fieldB =
        String(bData.desiredField || "")
          .trim()
          .toLowerCase() || randField();

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
  ensureAudio(); // ★ここが超重要（これがないと相手READY音が鳴らないこと多い）
  beep(880, 60, 0.04); // ★自分が押した音（任意）

  const me = await getDoc(myRef);
  if (!me.exists()) return;
  await updateDoc(myRef, { ready: !me.data().ready });
};

// =====================
// ピンポン（オフライン）
// =====================
const ball = document.getElementById("ball");
const pingBtn = document.getElementById("pingBtn");
const pingResetBtn = document.getElementById("pingResetBtn");
const pingStatus = document.getElementById("pingStatus");

let x = 320;
let vx = -3.8;
let score = 0;
let miss = 0;

function resetPong() {
  x = 320;
  vx = -3.8;
  score = 0;
  miss = 0;
  pingStatus.textContent = "スタート！ 左端付近で「打ち返す！」";
}
resetPong();

function tick() {
  x += vx;

  if (x <= 0) {
    miss++;
    pingStatus.textContent = `ミス！ score=${score} / miss=${miss}`;
    vx = Math.abs(vx);
  }

  if (x >= 320) {
    vx = -Math.abs(vx);
  }

  ball.style.left = `${x}px`;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

pingBtn.onclick = () => {
  if (x <= 45) {
    score++;
    vx = Math.abs(vx) * 1.06;
    pingStatus.textContent = `ナイス！ score=${score} / miss=${miss}`;
  } else {
    pingStatus.textContent = `早押し！ score=${score} / miss=${miss}`;
  }
};
pingResetBtn.onclick = resetPong;
