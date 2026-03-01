// public/p2.js
// v20260203_p2_battle_lobby_start_match_safe
//
// - battle.html（ロビー）用
// - 両者 Ready になったら match を作成し、game.html へ遷移
// - 既存UIが欠けてても落ちない（要素がなければ自動生成）
// - G.__TCG_GAME__ の Firebase / refs を優先利用（無ければ初期化を試みる）
//
// 想定URL: battle.html?room=xxx&player=yyy
// 遷移先: game.html?room=xxx&player=yyy

const G = globalThis.__TCG_GAME__ || (globalThis.__TCG_GAME__ = {});

// ---------------------
// Firebase / refs 準備
// ---------------------
async function ensureCoreReady(){
  if (G.db && G.roomId && G.playerId && G.matchRef && G.playerRef) return;

  // game.js を経由してない場合に備えて、最低限の初期化を試みる
  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  const playerId = params.get("player");
  if (!roomId || !playerId) {
    alert("URLに room / player がありません");
    throw new Error("missing room/player");
  }
  G.roomId = G.roomId || roomId;
  G.playerId = G.playerId || playerId;

  // 既に game.js で initializeApp 済みならそれを使う
  if (!G.db){
    // Firebase modular imports（battle.html が module で動いてる前提）
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js");
    const {
      getFirestore, doc, collection, getDoc, getDocs,
      onSnapshot, runTransaction, serverTimestamp
    } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js");

    // expose
    Object.assign(G, { initializeApp, getFirestore, doc, collection, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp });

    // config（game.js と同じ）
    G.firebaseConfig = G.firebaseConfig || {
      apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
      authDomain: "tcg-0bato.firebaseapp.com",
      projectId: "tcg-0bato"
    };

    G.app = G.app || initializeApp(G.firebaseConfig);
    G.db = G.db || getFirestore(G.app);
  }

  // refs
  const { doc } = G;
  G.matchRef = G.matchRef || doc(G.db, "rooms", G.roomId, "game", "match");
  G.stateRef = G.stateRef || doc(G.db, "rooms", G.roomId, "game", "state");
  G.playerRef = G.playerRef || ((pid)=> doc(G.db, "rooms", G.roomId, "players", pid));
}

await ensureCoreReady();

// ---------------------
// DOM（無ければ生やす）
// ---------------------
function el(id){ return document.getElementById(id); }

function ensureLobbyUi(){
  // 最低限：ステータス表示と Ready ボタンとリンク
  let root = el("lobbyRoot");
  if (!root){
    root = document.createElement("div");
    root.id = "lobbyRoot";
    root.style.padding = "14px";
    root.style.color = "#fff";
    root.style.fontFamily = "sans-serif";
    document.body.appendChild(root);
    document.body.style.background = "#222";
  }

  const need = [
    ["lobbyTitle", "h2", "Battle Lobby"],
    ["lobbyRoom", "div", ""],
    ["lobbyYou", "div", ""],
    ["lobbyStatus", "pre", ""],
    ["btnReady", "button", "✅ 準備OK（切替）"],
    ["btnCopyBattleUrl", "button", "🔗 招待URLコピー"],
    ["btnGoGame", "button", "▶ gameへ（強制）"],
  ];

  for (const [id, tag, text] of need){
    if (el(id)) continue;
    const node = document.createElement(tag);
    node.id = id;
    node.textContent = text;
    if (tag === "button"){
      node.type = "button";
      node.style.marginRight = "8px";
      node.style.marginTop = "8px";
      node.style.border = "1px solid #555";
      node.style.background = "#262626";
      node.style.color = "#fff";
      node.style.padding = "10px 12px";
      node.style.borderRadius = "10px";
      node.style.cursor = "pointer";
      node.style.fontWeight = "900";
      node.style.fontSize = "13px";
    }else if (tag === "pre"){
      node.style.background = "rgba(255,255,255,.06)";
      node.style.border = "1px solid rgba(255,255,255,.14)";
      node.style.borderRadius = "12px";
      node.style.padding = "10px";
      node.style.whiteSpace = "pre-wrap";
      node.style.marginTop = "10px";
    }
    root.appendChild(node);
  }

  // ヒント
  const hintId = "lobbyHint";
  if (!el(hintId)){
    const p = document.createElement("div");
    p.id = hintId;
    p.textContent = "両者が準備OKになると自動で対戦画面へ移動します。";
    p.style.opacity = ".9";
    p.style.marginTop = "8px";
    root.appendChild(p);
  }
}
ensureLobbyUi();

const lobbyRoomEl = el("lobbyRoom");
const lobbyYouEl = el("lobbyYou");
const lobbyStatusEl = el("lobbyStatus");
const btnReady = el("btnReady");
const btnCopy = el("btnCopyBattleUrl");
const btnGoGame = el("btnGoGame");

if (lobbyRoomEl) lobbyRoomEl.textContent = `ROOM: ${G.roomId}`;
if (lobbyYouEl) lobbyYouEl.textContent = `YOU: ${G.playerId}`;

// ---------------------
// helpers
// ---------------------
function toGame(){
  const url = `game.html?room=${encodeURIComponent(G.roomId)}&player=${encodeURIComponent(G.playerId)}`;
  location.href = url;
}

function safeStr(v){ return String(v ?? ""); }

async function ensurePlayerDoc(){
  const { runTransaction, getDoc, serverTimestamp } = G;
  const meRef = G.playerRef(G.playerId);

  await runTransaction(G.db, async (tx)=>{
    const me = await tx.get(meRef);
    if (!me.exists()){
      tx.set(meRef, {
        ready: false,
        deck: {},
        exCardId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge:false });
      return;
    }
    // 最低限補完
    const d = me.data() || {};
    const patch = {};
    if (typeof d.ready !== "boolean") patch.ready = false;
    if (!d.deck || typeof d.deck !== "object") patch.deck = {};
    if (d.exCardId === undefined) patch.exCardId = null;
    patch.updatedAt = serverTimestamp();
    tx.set(meRef, patch, { merge:true });
  });
}

async function toggleReady(){
  const { runTransaction, serverTimestamp } = G;
  const meRef = G.playerRef(G.playerId);
  await runTransaction(G.db, async (tx)=>{
    const me = await tx.get(meRef);
    if (!me.exists()){
      tx.set(meRef, { ready:true, deck:{}, exCardId:null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge:false });
      return;
    }
    const cur = !!me.data()?.ready;
    tx.set(meRef, { ready: !cur, updatedAt: serverTimestamp() }, { merge:true });
  });
}

function fmtPlayers(players){
  // players: [{id, ready, deckCount}]
  const lines = [];
  for (const p of players){
    lines.push(`- ${p.id}${p.id===G.playerId ? " (YOU)" : ""} : ${p.ready ? "✅READY" : "…wait"} / deck:${p.deckCount}`);
  }
  return lines.join("\n");
}

async function ensureMatchIfBothReady(){
  const { runTransaction, getDocs, collection, getDoc, serverTimestamp } = G;

  await runTransaction(G.db, async (tx)=>{
    const matchSnap = await tx.get(G.matchRef);
    if (matchSnap.exists()){
      // 既に match があるなら何もしない
      return;
    }

    // players を読む（tx 内で getDocs はできないので、外側で作るのが理想だが、
    // ここは「落ちない優先」で、最小限：players 2人前提の確定座席を playerId 文字順で決める）
    // ただし tx では collection 全体取得できないので、座席は room doc がある場合に寄せるなどが理想。
    // → ここは安全に「match を作らない」方針でもOKだが、ゲーム進行のために簡易決定する。

    // ★簡易：rooms/{roomId} に seatA/seatB が書かれてるならそれを使う
    const roomDocRef = G.doc(G.db, "rooms", G.roomId);
    const roomSnap = await tx.get(roomDocRef);
    const roomData = roomSnap.exists() ? (roomSnap.data() || {}) : {};
    const seatA = roomData.seatA || roomData.playerA || null;
    const seatB = roomData.seatB || roomData.playerB || null;

    if (seatA && seatB){
      tx.set(G.matchRef, {
        seatA, seatB,
        startedAt: serverTimestamp(),
        schema: "match_v1"
      }, { merge:false });
      return;
    }

    // ★fallback：playersコレクションを外で拾った結果を G._playersCache に入れて使う
    const cache = Array.isArray(G._playersCache) ? G._playersCache : [];
    if (cache.length >= 2){
      // createdAt の早い順 → なければ id順
      const sorted = [...cache].sort((a,b)=>{
        const ta = Number(a.createdAtMs||0), tb = Number(b.createdAtMs||0);
        if (ta && tb && ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
      });
      tx.set(G.matchRef, {
        seatA: sorted[0].id,
        seatB: sorted[1].id,
        startedAt: serverTimestamp(),
        schema: "match_v1"
      }, { merge:false });
      return;
    }

    // 情報が足りない場合は作らない（次回 snapshot で cache が埋まったら再トライ）
  });
}

// ---------------------
// Snapshot subscriptions
// ---------------------
await ensurePlayerDoc();

let unsubPlayers = null;
let unsubMatch = null;

async function subscribeLobby(){
  const { onSnapshot, collection, getDocs, getDoc } = G;
  const playersCol = collection(G.db, "rooms", G.roomId, "players");

  // players list
  unsubPlayers = onSnapshot(playersCol, async (snap)=>{
    const players = [];
    snap.forEach(docu=>{
      const d = docu.data() || {};
      const deck = (d.deck && typeof d.deck === "object") ? d.deck : {};
      const deckCount = Object.values(deck).reduce((a,v)=>a + Math.max(0, Math.trunc(Number(v||0))), 0);
      // createdAt を ms に寄せたいが、serverTimestamp は即は取れない場合があるので適当に吸う
      let createdAtMs = 0;
      try{
        const ts = d.createdAt;
        if (ts?.toMillis) createdAtMs = ts.toMillis();
      }catch{}
      players.push({ id: docu.id, ready: !!d.ready, deckCount, createdAtMs });
    });

    // cache（match作成の fallback 用）
    G._playersCache = players;

    // 表示
    if (lobbyStatusEl){
      const you = players.find(p=>p.id===G.playerId);
      const youReady = !!you?.ready;
      const allReady = (players.length>=2) && players.slice(0,2).every(p=>p.ready);
      lobbyStatusEl.textContent =
`Players:
${fmtPlayers(players)}

YOU ready: ${youReady ? "✅" : "…"}
Both ready (first 2): ${allReady ? "✅" : "…"}
`;
    }

    // 両者 ready なら match 作成を試す
    if (players.length >= 2){
      const both = players.slice(0,2).every(p=>p.ready);
      if (both){
        await ensureMatchIfBothReady();
      }
    }
  });

  // match
  unsubMatch = onSnapshot(G.matchRef, (snap)=>{
    if (!snap.exists()) return;
    const m = snap.data() || {};
    const seatA = safeStr(m.seatA);
    const seatB = safeStr(m.seatB);
    if (lobbyStatusEl){
      lobbyStatusEl.textContent += `\nMatch: seatA=${seatA} seatB=${seatB}\n→ starting...`;
    }
    // できたら遷移
    toGame();
  });
}

await subscribeLobby();

// ---------------------
// Button binds
// ---------------------
if (btnReady){
  btnReady.addEventListener("click", async ()=>{
    try{
      await toggleReady();
    }catch(e){
      alert(`ready切替に失敗: ${String(e?.message||e)}`);
    }
  });
}

if (btnCopy){
  btnCopy.addEventListener("click", async ()=>{
    const url = location.href;
    try{
      await navigator.clipboard.writeText(url);
      btnCopy.textContent = "✅ コピーした！";
      setTimeout(()=>{ btnCopy.textContent = "🔗 招待URLコピー"; }, 1200);
    }catch{
      prompt("このURLをコピーして共有してね", url);
    }
  });
}

if (btnGoGame){
  btnGoGame.addEventListener("click", ()=>toGame());
}

// expose for debug
Object.assign(G, { toggleReady, ensureMatchIfBothReady, toGame });