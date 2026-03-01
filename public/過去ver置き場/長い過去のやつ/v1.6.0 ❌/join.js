// public/join.js
// v1.5.0-b (compatible) + 30min TTL + room reset/reuse + nickname store + deck key fallback
//
// - mode=create : 4桁を生成（既存があっても「掃除して再利用」OK）
// - mode=join   : 4桁入力（期限切れ/残骸があれば掃除して再利用OK）
// - deckは localStorage の "tcg_deck_local_v15b" を優先、無ければ旧 "deck_simple" も読む
// - room doc に expiresAt を30分後で保存（touch）
// - rooms/{room}/players 全削除 + rooms/{room}/game/{match,state} 削除（クライアントで可能な範囲）
//
// ※本気の自動掃除は Cloud Functions の recursiveDelete 推奨（あなたの方針通り）

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ====== Const ======
const DECK_SIZE = 20;
const ROOM_TTL_MIN = 30;
const ROOM_TTL_MS = ROOM_TTL_MIN * 60 * 1000;

// deck.js 側のキー（新）
const LOCAL_DECK_KEY = "tcg_deck_local_v15b";
// 旧join/index系が使ってたキー（互換）
const LEGACY_DECK_KEY = "deck_simple";

const NAME_KEY = "tcg_player_name_v15b";

// ====== URL params ======
const params = new URLSearchParams(location.search);
const mode = params.get("mode"); // create / join

// ====== DOM ======
const titleEl = document.getElementById("title");
const roomInputWrap = document.getElementById("roomInput");
const nameEl = document.getElementById("name");
const roomEl = document.getElementById("room");
const goBtn = document.getElementById("goBtn");

titleEl.textContent = mode === "create" ? "ルーム作成" : "ルーム参加";
if (mode === "create") roomInputWrap.style.display = "none";

// ニック初期値
try {
  const saved = localStorage.getItem(NAME_KEY) || "";
  if (saved && nameEl) nameEl.value = saved;
} catch {}

// ====== Helpers ======
function genRoomId4() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
function newPlayerId() {
  return (crypto.randomUUID?.() ?? ("p" + Math.random().toString(16).slice(2)));
}

function loadDeckFromLocal() {
  // 優先：deck.js が保存する map形式 {cardId: count}
  try {
    const raw = localStorage.getItem(LOCAL_DECK_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    }
  } catch {}

  // 互換：旧 "deck_simple"
  try {
    const raw = localStorage.getItem(LEGACY_DECK_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
    }
  } catch {}

  return null;
}

function sumDeck(deckObj) {
  return Object.values(deckObj || {}).reduce((a, b) => a + Number(b || 0), 0);
}

function expiresAtFromNow() {
  return Timestamp.fromMillis(Date.now() + ROOM_TTL_MS);
}

function isExpiredRoomDoc(roomData) {
  const exp = roomData?.expiresAt;
  if (!exp) return false;
  const ms = (typeof exp.toMillis === "function") ? exp.toMillis() : null;
  if (!ms) return false;
  return ms < Date.now();
}

async function touchRoom(roomId, extra = {}) {
  await setDoc(doc(db, "rooms", roomId), {
    lastActiveAt: serverTimestamp(),
    expiresAt: expiresAtFromNow(),
    ...extra,
  }, { merge: true });
}

async function resetRoomHardish(roomId) {
  // players 全消し
  try {
    const ps = await getDocs(collection(db, "rooms", roomId, "players"));
    for (const d of ps.docs) await deleteDoc(d.ref);
  } catch (e) {
    console.warn("resetRoom: players delete failed", e);
  }

  // match/state 消し
  try { await deleteDoc(doc(db, "rooms", roomId, "game", "match")); } catch {}
  try { await deleteDoc(doc(db, "rooms", roomId, "game", "state")); } catch {}
}

async function ensurePlayer(roomId, playerId, name, deckObj) {
  await setDoc(doc(db, "rooms", roomId, "players", playerId), {
    name,
    deck: deckObj,
    ready: false,
    joinedAt: serverTimestamp(),
  }, { merge: true });
}

// ====== Main ======
goBtn.onclick = async () => {
  const name = (nameEl?.value || "").trim();
  const deckObj = loadDeckFromLocal();

  if (!name) return alert("ニックネームを入れてね");
  try { localStorage.setItem(NAME_KEY, name); } catch {}

  if (!deckObj) return alert("デッキが見つからない（indexで20枚作ってね）");
  if (sumDeck(deckObj) !== DECK_SIZE) return alert("デッキは20枚ちょうどにしてね");

  let roomId;

  if (mode === "create") {
    // 4桁を生成（衝突しても「掃除して再利用」でOK）
    roomId = genRoomId4();

    // もし既に残ってたら掃除して再利用
    try {
      const exist = await getDoc(doc(db, "rooms", roomId));
      if (exist.exists()) {
        await resetRoomHardish(roomId);
      }
    } catch {}

    // roomメタ
    await touchRoom(roomId, { createdAt: serverTimestamp(), status: "waiting" });

  } else {
    roomId = (roomEl?.value || "").trim();
    if (!/^\d{4}$/.test(roomId)) return alert("ルームIDは4桁数字で！");

    // ルームが無ければ作って再利用OK / あれば期限チェック
    try {
      const snap = await getDoc(doc(db, "rooms", roomId));
      if (!snap.exists()) {
        // 無いなら新規作成OK
        await touchRoom(roomId, { createdAt: serverTimestamp(), status: "waiting" });
      } else {
        const data = snap.data() || {};
        if (isExpiredRoomDoc(data)) {
          await resetRoomHardish(roomId);
        }
        await touchRoom(roomId, { status: "waiting" });
      }
    } catch (e) {
      console.warn(e);
      // ここで落とすより進める（最悪battleで再試行）
      await touchRoom(roomId, { status: "waiting" }).catch(()=>{});
    }
  }

  const playerId = newPlayerId();
  await ensurePlayer(roomId, playerId, name, deckObj);

  // ★ここ重要：battle URL は “その人専用” なので共有しない前提
  location.href = `battle.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
};