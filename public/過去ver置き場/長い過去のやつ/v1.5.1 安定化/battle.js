// public/battle.js
// v20260124f - action=create/join 対応 + myRef無ければ自動作成 + ローカルデッキ救済

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
  setDoc,
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
const roomIdEl = document.getElementById("roomId");
const statusEl = document.getElementById("status");
const playersUl = document.getElementById("players");
const readyBtn = document.getElementById("readyBtn");
const readyNote = document.getElementById("readyNote");

const myDeckEl = document.getElementById("myDeck");
const deckDetailEl = document.getElementById("deckDetail");

roomIdEl.textContent = roomId;

// =====================
// Firestore refs
// =====================
const playersRef = collection(db, "rooms", roomId, "players");
const myRef = doc(db, "rooms", roomId, "players", playerId);
const matchRef = doc(db, "rooms", roomId, "game", "match");

// =====================
// Helpers
// =====================
function safeObj(o) {
  return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
}
function loadLocalDeckFallback() {
  // deck.js のローカル保存キーに合わせる（違っても落ちない）
  const keys = ["tcg_deck_local_v1", "tcg_deck_local"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = JSON.parse(raw);
      const d = safeObj(obj);
      // 0枚は無視
      if (Object.keys(d).length) return d;
    } catch {}
  }
  return {};
}
function autoName(pid) {
  const s = String(pid || "");
  return "Player-" + s.slice(0, 4);
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

function effectText(a){
  const parts = [];
  if (a?.dmg !== undefined) parts.push(`HP-${a.dmg}`);
  if (a?.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
  if (a?.draw !== undefined) parts.push(`ドロー+${a.draw}`);
  return parts.length ? parts.join(" / ") : "効果";
}

function renderCardDetail(cardId) {
  const c = cardDefs[cardId];
  if (!c) {
    deckDetailEl.textContent = "カード定義が見つからない（cardsコレクション確認）";
    return;
  }
  const actions = Array.isArray(c.actions) ? c.actions : [];

  let html = `<b>${cardId}：${c.name ?? "?"}</b><br>`;
  html += `属性：${c.type ?? "?"} / コスト：${c.cost ?? "?"}<br>`;
  html += `HP：${c.hp ?? "?"} / SP：${c.sp ?? "?"}<br><br>`;

  html += `<b>行動</b><br>`;
  if (actions.length === 0) {
    html += `行動なし`;
  } else {
    actions.forEach((a) => {
      html += `【${a.cost ?? "?"}】${a.name ?? "?"}<br>`;
      html += `射程：${a.range ?? "?"} / 成功：${a.rate ?? "?"}% / 効果：${effectText(a)}<br><br>`;
    });
  }

  deckDetailEl.innerHTML = html;
}

function renderMyDeck(deckObj) {
  myDeckEl.innerHTML = "";

  const dObj = safeObj(deckObj);
  const items = Object.keys(dObj)
    .map(id => ({ id, count: Number(dObj[id] || 0) }))
    .filter(x => x.count > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (items.length === 0) {
    myDeckEl.textContent = "デッキが空です（deck.htmlで保存してから来てね）";
    return;
  }

  items.forEach(x => {
    const btn = document.createElement("button");
    const name = cardDefs[x.id]?.name ?? x.id;
    btn.textContent = `${name} (${x.id}) x${x.count}`;
    btn.onclick = () => renderCardDetail(x.id);
    myDeckEl.appendChild(btn);
  });

  renderCardDetail(items[0].id);
}

// =====================
// ★ 参加処理（ここが今回の本命）
// - myRef が無ければ自動作成
// - deck が空ならローカル保存から救済
// - action=create/join どっちでも確実に入れる
// =====================
async function ensureMyPlayerDoc() {
  const localDeck = loadLocalDeckFallback();

  // 先に部屋の人数を見て、3人目を弾く（任意：今は2人対戦前提）
  const pSnap = await getDocs(playersRef);
  const ids = pSnap.docs.map(d => d.id);
  const alreadyIn = ids.includes(playerId);
  const count = ids.length;

  // join の場合、満員(2人)で自分が未参加なら弾く
  if (action === "join" && count >= 2 && !alreadyIn) {
    alert("このルームは満員です（2人参加済み）");
    throw new Error("room full");
  }

  // create の場合：既に人がいてもOK（実質 join と同じ）
  // solo の場合：1人でもOK

  await runTransaction(db, async (tx) => {
    const meSnap = await tx.get(myRef);

    if (!meSnap.exists()) {
      tx.set(myRef, {
        name: autoName(playerId),
        ready: false,
        deck: Object.keys(localDeck).length ? localDeck : {},
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // 既存でも deck が空なら救済（battleに来た時点で助ける）
    const me = meSnap.data() || {};
    const deck = safeObj(me.deck);
    const hasDeck = Object.keys(deck).some(k => Number(deck[k] || 0) > 0);

    if (!hasDeck && Object.keys(localDeck).length) {
      tx.set(myRef, { deck: localDeck, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      // 触った証跡だけ更新
      tx.set(myRef, { updatedAt: serverTimestamp() }, { merge: true });
    }
  });
}

await ensureMyPlayerDoc();

// =====================
// 自分の情報監視（readyトグル + デッキ表示 + レーダー）
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

  renderMyDeck(me.deck);

  renderDeckRadar("battleDeckRadar", "battleDeckRadarText", me.deck || {}, cardDefs);
});

// =====================
// 参加者一覧監視（入室通知 + 両readyでmatch作成→gameへ）
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
    li.textContent = `${p.name} ${p.ready ? "✅ 準備OK" : "⏳ 準備中"}`;
    playersUl.appendChild(li);

    if (p.ready) readyCount++;
  });

  // 入室通知（増えたIDを検出）
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

  // 2人揃ってなければ開始しない（soloは例外にしたいならここ変える）
  if (players.length < 2) return;

  // 両方readyなら match を作る（1回だけ）
  if (readyCount >= 2 && !alreadyMoved) {
    alreadyMoved = true;

    await runTransaction(db, async (tx) => {
      const m = await tx.get(matchRef);
      if (m.exists()) return;

      const ids = players.map(p => p.id).sort();
      tx.set(matchRef, {
        seatA: ids[0],
        seatB: ids[1],
        startedAt: serverTimestamp()
      });
    });

    location.href = `game.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
  }
});

// 準備トグル（存在しない場合でも落とさない）
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