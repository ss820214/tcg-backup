// public/match_intro.js
// v20260202_match_intro_10s_warp_plus_deck_names
// - 演出を約10秒に延長
// - 最後に吸い込まれる（ワープ）演出
// - players doc から deckName も表示（互換で複数キーを拾う）
// - カウントダウンは最後の3秒だけ

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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

/* =========================
   Background FX (warp stars)
========================= */
function fitCanvas(c){
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  c.width = Math.floor(innerWidth * dpr);
  c.height = Math.floor(innerHeight * dpr);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

let bg = {
  stars: [],
  warp: 0,     // 0..1
  ctx: null,
  canvas: null,
};

function startBg(){
  const c = $("bgFx");
  if (!c) return;

  const ctx = fitCanvas(c);
  bg.ctx = ctx;
  bg.canvas = c;

  const stars = [];
  const N = Math.floor(Math.min(260, (innerWidth * innerHeight) / 6500));
  for (let i=0;i<N;i++){
    stars.push({
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      r: Math.random()*1.6 + 0.2,
      a: Math.random()*0.55 + 0.15,
      // 通常時のドリフト
      vx: (Math.random()*0.25 - 0.125),
      vy: (Math.random()*0.55 + 0.20),
      // ワープ用
      jitter: Math.random()*0.8 + 0.2,
    });
  }
  bg.stars = stars;

  function loop(){
    const ctx = bg.ctx;
    if (!ctx) return;

    ctx.clearRect(0,0,innerWidth, innerHeight);

    // うっすら暗幕
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(0,0,innerWidth,innerHeight);

    const cx = innerWidth/2, cy = innerHeight/2;
    const w = bg.warp;

    for (const st of bg.stars){
      if (w <= 0.001){
        // 通常：下へ流す
        st.x += st.vx;
        st.y += st.vy;
        if (st.y > innerHeight + 20) { st.y = -20; st.x = Math.random()*innerWidth; }
        if (st.x < -20) st.x = innerWidth + 20;
        if (st.x > innerWidth + 20) st.x = -20;
      } else {
        // ワープ：中心へ吸い込む
        const dx = cx - st.x;
        const dy = cy - st.y;
        const pull = 0.012 + 0.24 * w;          // 吸引強度
        st.x += dx * pull + (Math.random()-0.5)*st.jitter*(0.8*w);
        st.y += dy * pull + (Math.random()-0.5)*st.jitter*(0.8*w);

        // 中心近くに集まったら再配置してワープ線っぽく
        const dist = Math.hypot(dx,dy);
        if (dist < 18){
          const ang = Math.random()*Math.PI*2;
          const rad = Math.max(innerWidth, innerHeight) * (0.45 + Math.random()*0.65);
          st.x = cx + Math.cos(ang)*rad;
          st.y = cy + Math.sin(ang)*rad;
        }
      }

      // 描画（ワープ時は伸び感）
      const stretch = 1 + 10*w;
      const rr = st.r * (1 + 2.2*w);
      const aa = clamp(st.a + 0.25*w, 0, 1);

      ctx.save();
      ctx.translate(st.x, st.y);
      if (w > 0.02){
        const ang = Math.atan2(cy - st.y, cx - st.x);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${aa})`;
        ctx.roundRect(-rr*stretch*0.9, -rr*0.6, rr*stretch*1.8, rr*1.2, rr);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${aa})`;
        ctx.arc(0, 0, rr, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  addEventListener("resize", ()=>{
    fitCanvas(c);
  });
}

/* =========================
   Firestore: seat + names + deckName
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

  async function loadPlayerInfo(pid){
    if (!pid) return { name:"---", deckName:"未設定" };
    try{
      const ps = await getDoc(playerRef(pid));
      if (!ps.exists()) return { name:"---", deckName:"未設定" };
      const p = ps.data() || {};

      const name = safeText(p.name || p.playerName || pid);

      // いろんな命名揺れを拾う（deck builder 側の実装がまだ固まってない前提）
      const dn =
        p.deckName ??
        p.deck_name ??
        p.deckTitle ??
        p.deck_title ??
        p.title ??
        "";

      const deckName = safeText(dn || "未設定");
      return { name, deckName };
    }catch{
      return { name:"---", deckName:"未設定" };
    }
  }

  const A = await loadPlayerInfo(seatAPlayerId);
  const B = await loadPlayerInfo(seatBPlayerId);

  $("nameA").textContent = A.name || "---";
  $("nameB").textContent = B.name || "---";

  // デッキ名表示（追加）
  const deckA = $("deckA");
  const deckB = $("deckB");
  if (deckA) deckA.textContent = `Deck: ${A.deckName || "未設定"}`;
  if (deckB) deckB.textContent = `Deck: ${B.deckName || "未設定"}`;

  // YOUタグ
  if (seat === "A") $("youA")?.classList.add("on");
  if (seat === "B") $("youB")?.classList.add("on");

  setBadge("READY");
  setHint("演出中…");
}

/* =========================
   Countdown + warp timeline (10s)
========================= */
function playCountdown10s(){
  const countEl = $("countTxt");
  const subEl = $("subTxt");
  const bar = $("barFill");
  const body = document.body;

  const totalMs = 10000;        // ★ 10秒
  const warpStartMs = 7800;     // ★ ここから吸い込み開始（残り約2.2秒）
  const countStartMs = 7000;    // ★ 最後の3秒だけ 3..2..1..GO

  let t0 = performance.now();

  function tick(t){
    const elapsed = t - t0;
    const p = clamp(elapsed / totalMs, 0, 1);

    if (bar) bar.style.width = `${Math.round(p*100)}%`;

    // ワープ進行
    const w = clamp((elapsed - warpStartMs) / (totalMs - warpStartMs), 0, 1);
    bg.warp = w;
    body.classList.toggle("warp", w > 0.02);

    // 表示：カウントは最後の3秒
    if (elapsed < countStartMs){
      if (countEl) countEl.textContent = "VS";
      if (subEl) subEl.textContent = "対戦準備中…";
    } else {
      const remain = clamp((totalMs - elapsed) / 1000, 0, 3.5); // 秒
      const v = Math.ceil(remain); // 3,2,1,0
      if (countEl) countEl.textContent = (v >= 1) ? String(v) : "GO";
      if (subEl) subEl.textContent = (v >= 1) ? "まもなく開始…" : "START!";
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
  playCountdown10s();
}