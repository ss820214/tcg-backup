// public/match_intro.js
// v20260202_match_intro
// - battle(wait) -> game(battle) 間のVS演出
// - room/player から seat を特定（Firestore match 参照）
// - player名も players doc から補完
// - 最低限: 3..2..1..GO で game.html に遷移
//
// URL params:
//   room, player
// optional:
//   next=game.html (default)
//   seat=A|B (渡ってきたら優先)
//   force=1 (演出即スキップ扱い)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (id)=> document.getElementById(id);
const params = new URLSearchParams(location.search);

const roomId   = params.get("room")   || "";
const playerId = params.get("player") || "";
const nextPage = params.get("next")   || "game.html";
const forceSkip = params.get("force") === "1";

let seat = (params.get("seat") || "").toUpperCase(); // A/B (optional)
let seatAPlayerId = null;
let seatBPlayerId = null;

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const matchRef  = doc(db, "rooms", roomId, "game", "match");
const playerRef = (pid)=> doc(db, "rooms", roomId, "players", pid);

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function safeText(s){ return String(s ?? "").slice(0, 48); }

function setBadge(txt){
  const el = $("badgeTxt");
  if (el) el.textContent = txt;
}
function setHint(txt){
  const el = $("hintTxt");
  if (el) el.textContent = txt;
}

function goGame(){
  const url =
    `${nextPage}` +
    `?room=${encodeURIComponent(roomId)}` +
    `&player=${encodeURIComponent(playerId)}`;
  location.replace(url);
}

let suctionFactor = 0; // 0..1（後半で吸い込み強さ）
function easeInOut(t){ return t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
function easeIn(t){ return t*t; }
function easeOut(t){ return 1 - (1-t)*(1-t); }

/* =========================
   Background FX (simple stars)
========================= */
function fitCanvas(c){
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  c.width = Math.floor(innerWidth * dpr);
  c.height = Math.floor(innerHeight * dpr);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}
function startBg(){
  const c = $("bgFx");
  if (!c) return;
  const ctx = fitCanvas(c);

  const stars = [];
  const N = Math.floor(Math.min(170, (innerWidth * innerHeight) / 9000));
  for (let i=0;i<N;i++){
    stars.push({
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      r: Math.random()*1.8 + 0.2,
      a: Math.random()*0.6 + 0.2,
      s: Math.random()*0.55 + 0.15,
    });
  }

  function loop(){
    ctx.clearRect(0,0,innerWidth, innerHeight);

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0,0,innerWidth,innerHeight);

    const cx = innerWidth/2, cy = innerHeight/2;
const suck = suctionFactor;

for (const st of stars){
  if (suck <= 0){
    st.y += st.s;
    if (st.y > innerHeight + 10) { st.y = -10; st.x = Math.random()*innerWidth; }
  }else{
    // swirl + pull to center
    const dx = st.x - cx;
    const dy = st.y - cy;
    const d = Math.max(12, Math.hypot(dx,dy));
    // tangential (swirl)
    const tx = -dy / d;
    const ty =  dx / d;
    // inward
    const ix = -dx / d;
    const iy = -dy / d;

    const pull = (0.45 + 2.1*suck) * st.s * 6;
    const swirl = (0.25 + 1.6*suck) * st.s * 5;

    st.x += tx * swirl + ix * pull;
    st.y += ty * swirl + iy * pull;

    // centerに吸われたら端へ再配置
    if (d < 20){
      const edge = Math.random();
      if (edge < 0.25){ st.x = -10; st.y = Math.random()*innerHeight; }
      else if (edge < 0.5){ st.x = innerWidth+10; st.y = Math.random()*innerHeight; }
      else if (edge < 0.75){ st.x = Math.random()*innerWidth; st.y = -10; }
      else { st.x = Math.random()*innerWidth; st.y = innerHeight+10; }
    }
  }

  ctx.beginPath();
  ctx.fillStyle = `rgba(255,255,255,${st.a})`;
  ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
  ctx.fill();
}
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  addEventListener("resize", ()=> fitCanvas(c));
}

/* =========================
   Firestore: seat + names
========================= */
async function resolveSeatAndNames(){
  if (!roomId || !playerId) {
    setBadge("ERROR");
    setHint("room/player がありません（battle から入ってね）");
    return;
  }

  $("roomTxt").textContent = roomId;

  setBadge("SYNC");
  setHint("マッチ情報を取得中…");

  try{
    const ms = await getDoc(matchRef);
    if (ms.exists()){
      const m = ms.data() || {};
      seatAPlayerId = m.seatA || null;
      seatBPlayerId = m.seatB || null;

      // seat 未指定なら match から判定
      if (seat !== "A" && seat !== "B") {
        if (seatAPlayerId === playerId) seat = "A";
        else if (seatBPlayerId === playerId) seat = "B";
      }
    }
  }catch(e){
    console.warn("[intro] match fetch failed", e);
  }

  // 名前取得（取れなくてもOK）
  async function loadName(pid){
    if (!pid) return "---";
    try{
      const ps = await getDoc(playerRef(pid));
      if (!ps.exists()) return "---";
      const p = ps.data() || {};
      return safeText(p.name || p.playerName || pid);
    }catch{
      return "---";
    }
  }

  const nameA = await loadName(seatAPlayerId);
  const nameB = await loadName(seatBPlayerId);

  $("nameA").textContent = nameA || "---";
  $("nameB").textContent = nameB || "---";

  // YOUタグ
  if (seat === "A") $("youA")?.classList.add("on");
  if (seat === "B") $("youB")?.classList.add("on");

  setBadge("READY");
  setHint("演出中…");
}

/* =========================
   Countdown + progress
========================= */
function playCountdown(){
  const countEl = $("countTxt");
  const subEl = $("subTxt");
  const bar = $("barFill");
  const panel = document.querySelector(".panel");
  const vs = document.querySelector(".vs");

  let t0 = performance.now();

  const totalMs = 10000; // ★10秒
  const startCount = 10; // ★10..9..1..GO

  function tick(t){
    const p = clamp((t - t0) / totalMs, 0, 1);

    // progress bar
    if (bar) bar.style.width = `${Math.round(p*100)}%`;

    // Countdown number
    const step = Math.floor(p * startCount); // 0..10
    const v = Math.max(0, startCount - step);
    if (countEl) countEl.textContent = (v >= 1) ? String(v) : "GO";
    if (subEl) subEl.textContent = (v >= 1) ? "まもなく開始…" : "START!";

    // suction phase: last 5 sec => p in [0.5..1]
    const suckRaw = clamp((p - 0.5) / 0.5, 0, 1);
    const suck = easeInOut(suckRaw);
    suctionFactor = suck;

    // UI suck-in transform（吸い込み：縮小＋回転＋ブラー）
    if (panel){
      const s1 = 1 - 0.16*easeIn(suck);     // shrink
      const rot = (-3 * suck);             // slight rotation
      panel.style.transform = `translateY(0) scale(${s1}) rotate(${rot}deg)`;
      panel.style.filter = `blur(${(6*easeIn(suck)).toFixed(2)}px)`;
      panel.style.opacity = String(1 - 0.30*easeIn(suck));
    }
    if (vs){
      const wob = Math.sin(t/120) * 0.6 * suck;
      vs.style.transform = `translateX(${wob}px) translateY(${(-2*suck).toFixed(2)}px)`;
    }

    // final snap: 点になる（最後の0.3秒くらい）
    if (p >= 0.97 && panel){
      const k = clamp((p - 0.97) / 0.03, 0, 1);
      const s2 = 1 - 0.85*easeOut(k);
      panel.style.transform = `translateY(0) scale(${s2}) rotate(${(-4*suck).toFixed(2)}deg)`;
      panel.style.opacity = String(1 - 0.75*easeOut(k));
    }

    if (p < 1) requestAnimationFrame(tick);
    else setTimeout(goGame, 80);
  }

  requestAnimationFrame(tick);
}

/* =========================
   Boot
========================= */
startBg();

$("skipBtn")?.addEventListener("click", ()=> goGame());

// 強制スキップ（デバッグ用）
if (forceSkip) goGame();
else {
  await resolveSeatAndNames();
  playCountdown();
}