// public/battle.js
// v20260206_add_field_select_lobby
// - Keep all existing features
// - NEW: Field select in lobby, saved per player to Firestore
// - NEW: Show both players' field picks in lobby UI
// - NEW: When creating match, store both picks into match doc (fieldPick: {A,B})
// - Intro can read from match doc or players doc to display both picks

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
const params = new URLSearchParams(location.search);
const roomId = params.get("room");
const playerId = params.get("player");
const action = (params.get("action") || "join").toLowerCase(); // create/join/solo など

if (!roomId || !playerId) {
  alert("URLに room / player がありません");
  throw new Error("missing room/player");
}

// =====================
// DOM
// =====================
const fieldPickerEl = document.getElementById("fieldPicker");
const myFieldTxtEl  = document.getElementById("myFieldTxt");
const oppFieldTxtEl = document.getElementById("oppFieldTxt");
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

// NEW: field UI
const fieldSelectEl = document.getElementById("fieldSelect");
const fieldDescEl = document.getElementById("fieldDesc");
const myFieldPillEl = document.getElementById("myFieldPill");
const enemyFieldPillEl = document.getElementById("enemyFieldPill");
const p1FieldEl = document.getElementById("p1Field");
const p2FieldEl = document.getElementById("p2Field");

const attrDistEl = document.getElementById("attrDist");

roomIdEl.textContent = roomId;

// =====================
// Firestore refs
// =====================
const playersRef = collection(db, "rooms", roomId, "players");
const myRef = doc(db, "rooms", roomId, "players", playerId);
const matchRef = doc(db, "rooms", roomId, "game", "match");

// =====================
// Field defs (lobby)
// =====================
const FIELD_LIST = [
  { id:"grass",  label:"🌿 草原",  desc:"標準。特殊ギミックなし（ベース）" },
  { id:"danger", label:"💣 危険地帯", desc:"💣爆弾などのギミックが出る想定（field_systemで反映）" },
  { id:"swamp",  label:"🫧 沼地",  desc:"移動が阻害される/失敗する等の想定（field_systemで反映）" },
];

function normalizeFieldIdLocal(x){
  const s = String(x ?? "").trim().toLowerCase();
  if (FIELD_LIST.some(f=>f.id===s)) return s;
  return "grass";
}

function fieldLabel(id){
  const f = FIELD_LIST.find(x=>x.id===normalizeFieldIdLocal(id));
  return f ? `${f.label}（${f.id}）` : `grass`;
}

function fieldDesc(id){
  const f = FIELD_LIST.find(x=>x.id===normalizeFieldIdLocal(id));
  return f ? f.desc : "";
}

function setFieldUiForMe(fieldId){
  const fid = normalizeFieldIdLocal(fieldId);
  if (fieldSelectEl) fieldSelectEl.value = fid;
  if (myFieldPillEl) myFieldPillEl.textContent = `選択：${fieldLabel(fid)}`;
  if (fieldDescEl) fieldDescEl.textContent = `説明：${fieldDesc(fid)}`;
}

// =====================
// Match intro (between lobby -> game)
// =====================
function goToMatchIntro() {
  const url = new URL("./match_intro.html", location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set("player", playerId);
  url.searchParams.set("next", "game.html"); // 次に行くページ（将来差し替え可）
  location.href = url.toString();
}

// =====================
// Helpers
// =====================
function safeObj(o) {
  return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
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

const LOCAL_EX_KEYS = [
  "tcg_ex_local_v20260129",
];

function loadLocalDeckFallback() {
  for (const k of LOCAL_DECK_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const d = safeObj(obj);
      if (Object.keys(d).some(id => Number(d[id] || 0) > 0)) return d;
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

function effectText(a){
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
  snap.forEach(d => (m[d.id] = d.data()));
  cardDefs = m;
}
await loadCards();

// =====================
// UI: VS Banner
// =====================
function setReadyBadge(el, isReady){
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

function renderVs(players){
  const ids = players.map(p => p.id).sort();
  const p1 = players.find(p => p.id === ids[0]);
  const p2 = players.find(p => p.id === ids[1]);

  if (!p1 && !p2) {
    p1NameEl.textContent = "---";
    p2NameEl.textContent = "---";
    setReadyBadge(p1ReadyEl, false);
    setReadyBadge(p2ReadyEl, false);
    p1YouEl.textContent = "";
    p2YouEl.textContent = "";
    if (p1FieldEl) p1FieldEl.textContent = "";
    if (p2FieldEl) p2FieldEl.textContent = "";
    return;
  }

  p1NameEl.textContent = p1?.name || "---";
  p2NameEl.textContent = p2?.name || "（相手待ち）";

  setReadyBadge(p1ReadyEl, !!p1?.ready);
  setReadyBadge(p2ReadyEl, !!p2?.ready);

  p1YouEl.textContent = (p1?.id === playerId) ? "YOU" : "";
  p2YouEl.textContent = (p2?.id === playerId) ? "YOU" : "";

  // NEW: field small text
  const f1 = normalizeFieldIdLocal(p1?.fieldId ?? "grass");
  const f2 = normalizeFieldIdLocal(p2?.fieldId ?? "grass");
  if (p1FieldEl) p1FieldEl.textContent = p1 ? `FIELD: ${fieldLabel(f1)}` : "";
  if (p2FieldEl) p2FieldEl.textContent = p2 ? `FIELD: ${fieldLabel(f2)}` : "";
}

// =====================
// UI: 属性分布（自分のデッキ）
// =====================
function typeColor(type){
  const t = String(type || "").toLowerCase();
  if (t.includes("fire") || t.includes("炎") || t.includes("火")) return "rgba(255,91,106,.85)";
  if (t.includes("water") || t.includes("水")) return "rgba(106,169,255,.85)";
  if (t.includes("wind") || t.includes("風")) return "rgba(61,255,141,.75)";
  if (t.includes("earth") || t.includes("土")) return "rgba(220,190,120,.85)";
  if (t.includes("dark") || t.includes("闇")) return "rgba(170,120,255,.85)";
  if (t.includes("light") || t.includes("光")) return "rgba(255,215,0,.85)";
  if (t.includes("steel") || t.includes("metal") || t.includes("鋼")) return "rgba(200,200,200,.65)";
  if (t.includes("thunder") || t.includes("雷")) return "rgba(255,230,120,.75)";
  if (t.includes("grass") || t.includes("草")) return "rgba(140,255,140,.65)";
  if (t.includes("support") || t.includes("サポート")) return "rgba(255,255,255,.35)";
  return "rgba(255,255,255,.45)";
}

function renderAttrDist(deckObj){
  const dObj = safeObj(deckObj);
  const entries = Object.keys(dObj)
    .map(id => ({ id, count: Number(dObj[id] || 0) }))
    .filter(x => x.count > 0);

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
    .sort((a,b)=> b.cnt - a.cnt);

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
    deckDetailEl.textContent = "カード定義が見つからない（cardsコレクション確認）";
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
    .map(id => ({ id, count: Number(dObj[id] || 0) }))
    .filter(x => x.count > 0)
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

  items.forEach(x => {
    const btn = document.createElement("button");
    const name = cardDefs[x.id]?.name ?? x.id;
    btn.textContent = `${name} (${x.id}) x${x.count}`;
    btn.onclick = () => renderCardDetail(x.id);
    myDeckEl.appendChild(btn);
  });

  renderCardDetail(exCardId || items[0].id);
}

// =====================
// ensure player doc
// =====================
async function ensureMyPlayerDoc() {
  const localDeck = loadLocalDeckFallback();
  const localEx = loadLocalExFallback();

  // 先に部屋人数チェック
  const pSnap = await getDocs(playersRef);
  const ids = pSnap.docs.map(d => d.id);
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
        fieldId: "grass",              // ★初期フィールド
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const me = meSnap.data() || {};
    const deck = safeObj(me.deck);
    const hasDeck = Object.keys(deck).some(k => Number(deck[k] || 0) > 0);

    const patch = { updatedAt: serverTimestamp() };

    if (!hasDeck && Object.keys(localDeck).length) patch.deck = localDeck;
    if (!me.exCardId && localEx) patch.exCardId = localEx;
    if (!me.fieldId) patch.fieldId = "grass"; // ★古いデータ救済

    tx.set(myRef, patch, { merge: true });
  });
}

await ensureMyPlayerDoc();

// =====================
// Field selector events (NEW)
// =====================
if (fieldSelectEl) {
  fieldSelectEl.addEventListener("change", async ()=>{
    const fid = normalizeFieldIdLocal(fieldSelectEl.value);
    setFieldUiForMe(fid);
    try{
      await updateDoc(myRef, { fieldId: fid, updatedAt: serverTimestamp() });
    }catch(e){
      console.warn("[fieldSelect] update failed", e);
    }
  });
}

// =====================
// 自分の情報監視（readyトグル + デッキ表示 + レーダー + 属性分布 + Field）
// =====================
onSnapshot(myRef, (snap) => {
  if (!snap.exists()) {
    statusEl.textContent = "プレイヤー情報が見つからない（joinから入り直して）";
    readyBtn.disabled = true;
    return;
  }
  const me = snap.data();

  readyBtn.disabled = false;
  readyBtn.textContent = me.ready ? "準備解除" : "準備完了";
  readyNote.textContent = me.ready ? "✅ 準備OK（解除もできます）" : "⏳ 準備中";
  statusEl.textContent = me.ready ? "準備OK！相手の準備を待っています…" : "相手の入室を待っています…";

  renderMyDeck(me.deck, me.exCardId || null);
  renderDeckRadar("battleDeckRadar", "battleDeckRadarText", me.deck || {}, cardDefs);
  renderAttrDist(me.deck || {});

  // NEW: my field reflect
  const fid = normalizeFieldIdLocal(me.fieldId ?? "grass");
  setFieldUiForMe(fid);

  // （任意）テキスト欄があるなら
  if (myFieldTxtEl) myFieldTxtEl.textContent = fieldLabel(fid);
});

// =====================
// 参加者一覧監視（入室通知 + 両readyでmatch作成→introへ + Field表示）
// =====================
let prevIds = new Set();
let prevReadyMap = new Map();
let alreadyMoved = false;

onSnapshot(playersRef, async (snap) => {
  playersUl.innerHTML = "";

  const players = [];
  let readyCount = 0;

  snap.forEach(d => {
    const p = d.data();
    players.push({ id: d.id, ...p });

    const li = document.createElement("li");
    const f = normalizeFieldIdLocal(p.fieldId ?? "grass");
    li.textContent = `${p.name} ${p.ready ? "✅ 準備OK" : "⏳ 準備中"} / FIELD:${f}`;
    playersUl.appendChild(li);

    if (p.ready) readyCount++;
  });

  // VS表示
  renderVs(players);

  // 相手のフィールド表示（1回だけ）
  const enemy = players.find(p => p.id !== playerId) || null;
  const enemyField = normalizeFieldIdLocal(enemy?.fieldId ?? "grass");

  if (oppFieldTxtEl) {
    oppFieldTxtEl.textContent = enemy ? fieldLabel(enemyField) : "（相手待ち）";
  }

  if (enemyFieldPillEl) {
    enemyFieldPillEl.textContent = enemy
      ? `相手の選択：${fieldLabel(enemyField)}`
      : "相手の選択：---";
  }

  // 入室通知
  const nowIds = new Set(players.map(p => p.id));
  for (const id of nowIds) {
    if (!prevIds.has(id)) {
      const name = players.find(x => x.id === id)?.name || "誰か";
      if (id !== playerId) alert(`${name} が入室しました！`);
    }
  }
  prevIds = nowIds;

  // 準備ON/OFFの通知（相手のみ）
  const nowReadyMap = new Map(players.map(p => [p.id, !!p.ready]));
  for (const [id, nowReady] of nowReadyMap.entries()) {
    const prevReady = prevReadyMap.get(id);
    if (prevReady !== undefined && prevReady !== nowReady && id !== playerId) {
      const name = players.find(x => x.id === id)?.name || "相手";
      alert(`${name} が${nowReady ? "準備OK" : "準備解除"}しました`);
    }
  }
  prevReadyMap = nowReadyMap;

  if (players.length < 2) return;

  // 両方readyなら match を作る（1回だけ）
  if (readyCount >= 2 && !alreadyMoved) {
    alreadyMoved = true;

    await runTransaction(db, async (tx) => {
      const m = await tx.get(matchRef);
      if (m.exists()) return;

      const ids = players.map(p => p.id).sort();
      const seatA = ids[0];
      const seatB = ids[1];

      const pA = players.find(p => p.id === seatA) || {};
      const pB = players.find(p => p.id === seatB) || {};

      const fieldA = normalizeFieldIdLocal(pA.fieldId ?? "grass");
      const fieldB = normalizeFieldIdLocal(pB.fieldId ?? "grass");

      // 決定（同じならそのまま / 違うならダイスで小さい出目側採用）
      let fieldFinal = fieldA;
      let fieldRule = "same"; // "same" | "dice"
      let diceA = null, diceB = null;

      if (fieldA !== fieldB) {
        fieldRule = "dice";
        for (let k = 0; k < 10; k++) {
          diceA = 1 + Math.floor(Math.random() * 6);
          diceB = 1 + Math.floor(Math.random() * 6);
          if (diceA !== diceB) break;
        }
        fieldFinal = (diceA < diceB) ? fieldA : fieldB;
      }

      tx.set(matchRef, {
        seatA,
        seatB,
        startedAt: serverTimestamp(),
        fieldPick: { A: fieldA, B: fieldB },
        fieldRule,
        diceA,
        diceB,
        fieldFinal,
      });
    });

    goToMatchIntro();
  }
});

// 準備トグル
readyBtn.onclick = async () => {
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



