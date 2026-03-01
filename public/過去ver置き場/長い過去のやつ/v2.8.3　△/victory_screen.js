// public/victory_screen.js
// v1.10.2 - COMPLETE
// - FIX: win/lose judgment uses seat/winner (result param is fallback)  [kept]
// - FIX: btnDeck fallback to index.html if goToDeck fails              [kept]
// - NEW: If turnSeq/kills/infil params are missing/0, fetch from Firestore game/state and compute infil
//
// v1.10.0 - Victory/Defeat screen + Winner deck radar/recipe (no libs) : confetti + fireworks + stats + buttons
// NOTE: game.js から URL パラメータを渡して使う
//
// Added:
// - Fetch winner player's deck from Firestore
// - Evaluate deck (deck_radar.js) + show radar
// - Show deck recipe list + copy button
// - Show EX card (if exists)
//
// Keep:
// - Original layout/FX/buttons intact as much as possible

import { goToDeck, computeInfil } from "./game_state.js?v=20260126g";
import { evaluateDeck, drawRadar } from "./deck_radar.js?v=20260129c";

// Firebase (same style as game.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);

const roomId = params.get("room") || "";
const playerId = params.get("player") || "";

// ===== 勝敗は seat/winner で確定（resultはfallback） =====
const seat = (params.get("seat") || "").toUpperCase();          // A/B
const winner = (params.get("winner") || "").toUpperCase();      // A/B
const resultParam = (params.get("result") || "").toLowerCase(); // win/lose (fallback)
const reason = params.get("reason") || "";

// seat/winner が揃ってるならそれを正として勝敗を決める
const seatOK = (seat === "A" || seat === "B");
const winnerOK = (winner === "A" || winner === "B");
const result = (seatOK && winnerOK)
  ? (seat === winner ? "win" : "lose")
  : resultParam;

const isWin = result === "win";
const isLose = result === "lose";

const turnSeq = Number(params.get("turnSeq") || "0");
const killsA = Number(params.get("killsA") || "0");
const killsB = Number(params.get("killsB") || "0");
const infilA = Number(params.get("infilA") || "0");
const infilB = Number(params.get("infilB") || "0");

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// =====================
// Firebase init
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const matchRef = doc(db, "rooms", roomId, "game", "match");
const stateRef = doc(db, "rooms", roomId, "game", "state");
const playerRef = (pid) => doc(db, "rooms", roomId, "players", pid);

// =====================
// Card defs cache
// =====================
let cardDefs = {};
async function loadCards(){
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach(d => (m[d.id] = d.data()));
  cardDefs = m;
}
function cardName(cardId){
  return cardDefs?.[cardId]?.name || cardId || "?";
}
function isSupportCardLike(c){
  if (!c) return false;
  if (String(c.kind || "").toLowerCase() === "support") return true;
  const hasEffect = !!c.effect;
  const acts = Array.isArray(c.actions) ? c.actions : [];
  if (hasEffect && acts.length === 0) return true;
  return false;
}

// =====================
// UI
// =====================
function injectBaseStyles() {
  const css = `
  :root{
    --bg1:#0b0f1a;
    --bg2:#101a33;
    --card: rgba(255,255,255,0.08);
    --card2: rgba(255,255,255,0.12);
    --txt: rgba(255,255,255,0.92);
    --muted: rgba(255,255,255,0.68);
    --accent: ${isWin ? "#6cffb6" : "#ff6c87"};
    --accent2: ${isWin ? "#4aa3ff" : "#7b8cff"};
    --shadow: 0 18px 60px rgba(0,0,0,0.55);
    --radius: 20px;
  }
  *{box-sizing:border-box;}
  html,body{height:100%;}
  body{
    margin:0;
    color:var(--txt);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    overflow:hidden;
    background: radial-gradient(1200px 700px at 20% 15%, rgba(80,140,255,0.18), transparent 55%),
                radial-gradient(900px 700px at 90% 10%, rgba(120,255,190,0.12), transparent 50%),
                linear-gradient(180deg, var(--bg1), var(--bg2));
  }
  .wrap{
    position:relative;
    height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:18px;
  }
  .panel{
    position:relative;
    width:min(980px, 96vw);
    border-radius: var(--radius);
    background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
    box-shadow: var(--shadow);
    border: 1px solid rgba(255,255,255,0.16);
    overflow:hidden;
  }
  .topGlow{
    position:absolute; inset:-120px -120px auto -120px;
    height:240px;
    background: radial-gradient(circle at 30% 60%, rgba(108,255,182,0.30), transparent 60%),
                radial-gradient(circle at 80% 40%, rgba(74,163,255,0.22), transparent 65%);
    filter: blur(12px);
    opacity:${isWin ? 1 : 0.6};
    pointer-events:none;
  }
  .row{
    display:grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap:16px;
    padding:18px;
  }
  @media (max-width: 820px){
    .row{ grid-template-columns:1fr; }
  }
  .hero{
    padding:16px;
    border-radius: var(--radius);
    background: linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.10));
    border: 1px solid rgba(255,255,255,0.12);
    position:relative;
    overflow:hidden;
  }
  .badge{
    display:inline-flex; align-items:center; gap:10px;
    padding:10px 14px;
    border-radius: 999px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.18);
    color: var(--muted);
    font-size: 12px;
  }
  .title{
    margin:14px 0 6px;
    font-size: clamp(34px, 4vw, 56px);
    letter-spacing: 0.04em;
    font-weight: 900;
    line-height: 1.02;
    text-shadow: 0 10px 30px rgba(0,0,0,0.55);
  }
  .title .accent{
    color: var(--accent);
    text-shadow: 0 0 18px rgba(108,255,182,0.28);
  }
  .sub{
    margin:0 0 8px;
    color: var(--muted);
    font-size: 14px;
  }
  .reason{
    margin-top:10px;
    color: rgba(255,255,255,0.80);
    font-size: 13px;
  }
  .stats{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:12px;
    margin-top:14px;
  }
  .card{
    border-radius: 16px;
    padding:12px 12px;
    background: var(--card);
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 8px 24px rgba(0,0,0,0.22);
  }
  .k{ font-size:12px; color: var(--muted); }
  .v{ font-size:20px; font-weight:800; margin-top:4px; }
  .mini{ font-size:12px; color: rgba(255,255,255,0.76); margin-top:4px; }

  .right{
    padding:16px;
    border-radius: var(--radius);
    background: linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0.12));
    border: 1px solid rgba(255,255,255,0.12);
    position:relative;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    gap:12px;
    max-height: calc(100vh - 80px);
  }
  .trophy{
    width:100%;
    aspect-ratio: 1.15 / 0.78;
    border-radius: 18px;
    background: radial-gradient(circle at 50% 35%, rgba(255,255,255,0.12), transparent 55%),
                linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.12);
    display:flex;
    align-items:center;
    justify-content:center;
    position:relative;
  }
  .trophy .emoji{
    font-size: clamp(56px, 6vw, 88px);
    filter: drop-shadow(0 16px 18px rgba(0,0,0,0.45));
    transform: translateY(0);
    animation: float 2.3s ease-in-out infinite;
  }
  @keyframes float{
    0%,100%{ transform: translateY(0); }
    50%{ transform: translateY(-10px); }
  }

  .buttons{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
  }
  button{
    appearance:none;
    border:none;
    cursor:pointer;
    border-radius: 14px;
    padding:12px 14px;
    font-weight: 800;
    color: rgba(255,255,255,0.95);
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.16);
    box-shadow: 0 10px 24px rgba(0,0,0,0.22);
    transition: transform .12s ease, background .12s ease;
  }
  button:hover{ transform: translateY(-1px); background: rgba(255,255,255,0.14); }
  button.primary{
    background: linear-gradient(90deg, rgba(108,255,182,0.22), rgba(74,163,255,0.18));
    border-color: rgba(255,255,255,0.20);
  }
  button.danger{
    background: rgba(255,108,135,0.16);
  }
  .hint{
    font-size:12px;
    color: rgba(255,255,255,0.65);
  }

  /* ===== Winner deck section ===== */
  .deckBox{
    border-radius: 16px;
    padding:12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
  }
  .deckHead{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    margin-bottom:10px;
  }
  .deckTitle{
    font-weight: 900;
    letter-spacing: .04em;
  }
  .deckSub{
    font-size:12px;
    color: rgba(255,255,255,0.75);
    margin-top:2px;
  }
  .deckGrid{
    display:grid;
    grid-template-columns: 1fr;
    gap:10px;
  }
  .radarWrap{
    display:flex;
    align-items:center;
    gap:12px;
    flex-wrap:wrap;
  }
  .radarCanvas{
    width: 210px;
    height: 210px;
    border-radius: 14px;
    background:#fff;
    border: 1px solid rgba(0,0,0,0.12);
    overflow:hidden;
  }
  .deckText{
    min-width: 180px;
    flex:1;
    font-size:12px;
    color: rgba(255,255,255,0.80);
    line-height:1.45;
  }
  .recipe{
    margin-top:8px;
    max-height: 160px;
    overflow:auto;
    padding:10px;
    border-radius: 14px;
    background: rgba(0,0,0,0.22);
    border: 1px solid rgba(255,255,255,0.10);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 12px;
    white-space: pre;
  }

  canvas.fx{
    position:fixed;
    inset:0;
    width:100vw;
    height:100vh;
    pointer-events:none;
  }
  .veil{
    position:fixed; inset:0;
    background: radial-gradient(1000px 600px at 60% 10%, rgba(255,255,255,0.08), transparent 55%),
                radial-gradient(900px 700px at 20% 80%, rgba(255,255,255,0.06), transparent 60%);
    opacity:${isWin ? 1 : 0.7};
    pointer-events:none;
    mix-blend-mode: screen;
  }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

function mountLayout() {
  document.body.innerHTML = `
    <canvas id="bgFx" class="fx"></canvas>
    <canvas id="confettiFx" class="fx"></canvas>
    <canvas id="fireFx" class="fx"></canvas>
    <div class="veil"></div>
    <div class="wrap">
      <div class="panel">
        <div class="topGlow"></div>
        <div class="row">
          <div class="hero">
            <div class="badge">
              <span>ROOM</span><b>${escapeHtml(roomId || "-")}</b>
              <span style="opacity:.65;">/</span>
              <span>YOU</span><b>${escapeHtml(seat || "-")}</b>
              <span style="opacity:.65;">/</span>
              <span>WINNER</span><b>${escapeHtml(winner || "-")}</b>
            </div>

            <div class="title">
              ${isWin ? `<span class="accent">VICTORY</span>!!` : `DEFEAT...`}
            </div>

            <div class="sub">
              ${isWin ? "勝利おめでとう。派手に祝うぞ。" : "次は勝てる。リベンジしよう。"}
            </div>

            <div class="reason">${escapeHtml(reason || "")}</div>

            <div class="stats">
              <div class="card">
                <div class="k">ターン数</div>
                <div class="v" id="turnV">0</div>
                <div class="mini">turnSeq</div>
              </div>
              <div class="card">
                <div class="k">撃破数</div>
                <div class="v" id="killV">0</div>
                <div class="mini">A:${killsA} / B:${killsB}</div>
              </div>
              <div class="card">
                <div class="k">侵入度</div>
                <div class="v" id="infilV">0</div>
                <div class="mini">A:${infilA} / B:${infilB}</div>
              </div>
              <div class="card">
                <div class="k">結果</div>
                <div class="v">${isWin ? "WIN" : "LOSE"}</div>
                <div class="mini">${isWin ? "🎉" : "💥"}</div>
              </div>
            </div>
          </div>

          <div class="right">
            <div class="trophy">
              <div class="emoji">${isWin ? "🏆" : "☔"}</div>
            </div>

            <div class="deckBox" id="winnerDeckBox">
              <div class="deckHead">
                <div>
                  <div class="deckTitle">勝者デッキ</div>
                  <div class="deckSub" id="winnerDeckSub">読み込み中...</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                  <button id="btnCopyWinnerDeck">レシピコピー</button>
                </div>
              </div>

              <div class="deckGrid">
                <div class="radarWrap">
                  <canvas id="winnerRadar" class="radarCanvas" width="260" height="260"></canvas>
                  <div class="deckText" id="winnerDeckText">（評価を取得中）</div>
                </div>
                <div class="recipe" id="winnerRecipe">（レシピを取得中）</div>
              </div>
            </div>

            <div class="buttons">
            <button class="primary" id="btnBackDeck">編成に戻る</button>
              <button class="primary" id="btnDeck">デッキへ戻る</button>
              <button id="btnRematch">もう一戦（待機へ）</button>
              <button id="btnCopy">URLコピー</button>
              <button class="danger" id="btnTop">トップへ</button>
            </div>

            <div class="hint">
              ※音は端末によって自動再生できないことがあります（タップ後に鳴ります）
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function animateCount(el, to, ms=650){
  if (!el) return;
  const from = 0;
  const t0 = performance.now();
  function tick(t){
    const p = clamp((t - t0) / ms, 0, 1);
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    el.textContent = String(v);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* =========================
   FX : background stars
========================= */
function fitCanvas(c){
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  c.width = Math.floor(innerWidth * dpr);
  c.height = Math.floor(innerHeight * dpr);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}

function startBg() {
  const c = $("#bgFx");
  const ctx = fitCanvas(c);

  const stars = [];
  const N = Math.floor(Math.min(160, (innerWidth * innerHeight) / 9000));
  for (let i=0;i<N;i++){
    stars.push({
      x: Math.random()*innerWidth,
      y: Math.random()*innerHeight,
      r: Math.random()*1.8 + 0.2,
      a: Math.random()*0.6 + 0.2,
      s: Math.random()*0.5 + 0.15,
    });
  }

  function loop(){
    ctx.clearRect(0,0,innerWidth, innerHeight);

    // soft haze
    ctx.fillStyle = isWin ? "rgba(108,255,182,0.03)" : "rgba(255,108,135,0.03)";
    ctx.fillRect(0,0,innerWidth,innerHeight);

    for (const st of stars){
      st.y += st.s * (isWin ? 0.7 : 1.1);
      if (st.y > innerHeight + 10) { st.y = -10; st.x = Math.random()*innerWidth; }
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
   FX : confetti / fireworks
========================= */
function startConfettiAndFireworks() {
  const conf = $("#confettiFx");
  const fire = $("#fireFx");
  const ctxC = fitCanvas(conf);
  const ctxF = fitCanvas(fire);

  let confetti = [];
  let sparks = [];

  function spawnConfettiBurst(cx, cy, n=120){
    const cols = isWin
      ? ["rgba(108,255,182,.95)","rgba(74,163,255,.95)","rgba(255,255,255,.95)","rgba(255,215,0,.95)"]
      : ["rgba(255,108,135,.92)","rgba(123,140,255,.92)","rgba(255,255,255,.85)"];

    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = Math.random()*6 + 2;
      confetti.push({
        x: cx, y: cy,
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp - (Math.random()*3),
        g: 0.12 + Math.random()*0.06,
        w: 4 + Math.random()*6,
        h: 6 + Math.random()*10,
        rot: Math.random()*Math.PI*2,
        vr: (Math.random()-0.5)*0.25,
        life: 220 + Math.random()*120,
        col: cols[(Math.random()*cols.length)|0],
        shape: Math.random()<0.5 ? "rect" : "tri",
      });
    }
  }

  function spawnFirework(cx, cy){
    const cols = isWin
      ? ["rgba(108,255,182,.9)","rgba(74,163,255,.9)","rgba(255,215,0,.9)","rgba(255,255,255,.9)"]
      : ["rgba(255,108,135,.85)","rgba(123,140,255,.85)","rgba(255,255,255,.75)"];

    const base = cols[(Math.random()*cols.length)|0];
    const n = 90 + ((Math.random()*60)|0);
    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const sp = Math.random()*6 + 2;
      sparks.push({
        x: cx, y: cy,
        vx: Math.cos(a)*sp,
        vy: Math.sin(a)*sp,
        g: 0.06 + Math.random()*0.03,
        life: 90 + Math.random()*40,
        col: base,
      });
    }
  }

  function step(){
    // confetti
    ctxC.clearRect(0,0,innerWidth,innerHeight);
    confetti = confetti.filter(p => p.life > 0);
    for (const p of confetti){
      p.life--;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctxC.save();
      ctxC.translate(p.x, p.y);
      ctxC.rotate(p.rot);
      ctxC.fillStyle = p.col;
      if (p.shape === "tri"){
        ctxC.beginPath();
        ctxC.moveTo(-p.w/2, p.h/2);
        ctxC.lineTo(0, -p.h/2);
        ctxC.lineTo(p.w/2, p.h/2);
        ctxC.closePath();
        ctxC.fill();
      } else {
        ctxC.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      }
      ctxC.restore();
    }

    // fireworks
    ctxF.clearRect(0,0,innerWidth,innerHeight);
    sparks = sparks.filter(s => s.life > 0);
    for (const s of sparks){
      s.life--;
      s.vy += s.g;
      s.x += s.vx;
      s.y += s.vy;

      ctxF.beginPath();
      ctxF.strokeStyle = s.col;
      ctxF.globalAlpha = Math.max(0, Math.min(1, s.life / 90));
      ctxF.moveTo(s.x, s.y);
      ctxF.lineTo(s.x - s.vx*0.5, s.y - s.vy*0.5);
      ctxF.stroke();
      ctxF.globalAlpha = 1;
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  // 勝利なら自動演出
  if (isWin) {
    spawnConfettiBurst(innerWidth*0.5, innerHeight*0.28, 160);
    spawnFirework(innerWidth*0.25, innerHeight*0.25);
    spawnFirework(innerWidth*0.75, innerHeight*0.22);

    // 追い花火
    let t = 0;
    const timer = setInterval(()=>{
      t++;
      spawnFirework(
        innerWidth*(0.2 + Math.random()*0.6),
        innerHeight*(0.18 + Math.random()*0.22)
      );
      if (t >= 9) clearInterval(timer);
    }, 320);
  } else {
    // 敗北でも控えめに一発
    spawnFirework(innerWidth*0.5, innerHeight*0.22);
  }

  // タップで追い演出
  window.addEventListener("pointerdown", (e)=>{
    if (isWin) spawnConfettiBurst(e.clientX, e.clientY, 80);
    spawnFirework(e.clientX, e.clientY);
    tryBeep(isWin ? 880 : 220, 0.05);
  });

  addEventListener("resize", ()=>{
    fitCanvas(conf);
    fitCanvas(fire);
  });
}

/* =========================
   tiny sound (safe)
========================= */
let audioCtx = null;
function tryBeep(freq=660, sec=0.06){
  try{
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = freq;

    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + sec);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + sec + 0.02);
  } catch {}
}

/* =========================
   Buttons
========================= */
function wireButtons(){
  $("#btnDeck")?.addEventListener("click", ()=>{
    // ★修正: goToDeckが壊れてても必ずデッキに戻る
    if (!roomId || !playerId) { location.href = "index.html"; return; }

    const url = `index.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;

    if (typeof goToDeck === "function") {
      try {
        goToDeck(roomId, playerId);
        return;
      } catch (e) {
        console.warn("goToDeck failed, fallback to url", e);
      }
    }
    location.href = url;
  });

    $("#btnBackDeck")?.addEventListener("click", ()=>{
    // ルームとプレイヤーがあるなら「デッキ編成画面」へ
    if (roomId && playerId) {
      // goToDeck は RETURN_URL(=deck.html) に戻す想定なのでそれを使う
      if (typeof goToDeck === "function") {
        try { goToDeck(roomId, playerId); return; } catch (e) { console.warn(e); }
      }
      location.href = `deck.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
      return;
    }
    // 無い場合は最低限 deck.html へ
    location.href = "deck.html";
  });

  $("#btnRematch")?.addEventListener("click", ()=>{
    if (!roomId || !playerId) { location.href = "index.html"; return; }
    // battleへ戻す（今までの導線を壊さない）
    location.href = `battle.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}&action=join`;
  });

  $("#btnTop")?.addEventListener("click", ()=>{
    location.href = "index.html";
  });

  $("#btnCopy")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(location.href);
      tryBeep(988, 0.06);
      $("#btnCopy").textContent = "コピーした！";
      setTimeout(()=> $("#btnCopy").textContent = "URLコピー", 900);
    } catch {
      alert("コピーできませんでした（端末設定）");
    }
  });

  $("#btnCopyWinnerDeck")?.addEventListener("click", async ()=>{
    const txt = $("#winnerRecipe")?.textContent || "";
    if (!txt || txt.includes("取得中") || txt.includes("失敗")) {
      tryBeep(220, 0.06);
      return;
    }
    try{
      await navigator.clipboard.writeText(txt.trim());
      tryBeep(988, 0.06);
      $("#btnCopyWinnerDeck").textContent = "コピーした！";
      setTimeout(()=> $("#btnCopyWinnerDeck").textContent = "レシピコピー", 900);
    } catch {
      alert("コピーできませんでした（端末設定）");
    }
  });
}

// =====================
// Winner deck rendering
// =====================
function formatRecipeLine(cardId, cnt){
  const d = cardDefs?.[cardId] || {};
  const type = d.type ?? "?";
  const cost = (d.cost ?? "?");
  const name = cardName(cardId);
  const sup = isSupportCardLike(d) ? "（サポ）" : "";
  return `x${cnt}  [${type}]  【${cost}】 ${name}${sup}`;
}

function deckObjToLines(deckObj){
  const ids = Object.keys(deckObj || {}).filter(id => Number(deckObj[id]) > 0);

  // sort: support last? / cost asc / name
  ids.sort((a,b)=>{
    const da = cardDefs?.[a] || {};
    const db = cardDefs?.[b] || {};
    const sa = isSupportCardLike(da) ? 1 : 0;
    const sb = isSupportCardLike(db) ? 1 : 0;
    if (sa !== sb) return sa - sb;

    const ca = Number(da.cost ?? 999);
    const cb = Number(db.cost ?? 999);
    if (ca !== cb) return ca - cb;

    const na = cardName(a);
    const nb = cardName(b);
    return String(na).localeCompare(String(nb), "ja");
  });

  const lines = [];
  let total = 0;
  for (const id of ids){
    const cnt = Math.max(0, Math.trunc(Number(deckObj[id] || 0)));
    if (!cnt) continue;
    total += cnt;
    lines.push(formatRecipeLine(id, cnt));
  }
  return { lines, total };
}

async function loadWinnerDeckAndRender(){
  const subEl = $("#winnerDeckSub");
  const textEl = $("#winnerDeckText");
  const recEl = $("#winnerRecipe");
  const radar = $("#winnerRadar");

  if (!roomId || !winner) {
    if (subEl) subEl.textContent = "（room/winnerが無くて取得できない）";
    if (textEl) textEl.textContent = "—";
    if (recEl) recEl.textContent = "—";
    return;
  }

  try{
    // load card defs first (needed for recipe + evaluation)
    await loadCards();

    // match → winner playerId を引く
    const ms = await getDoc(matchRef);
    if (!ms.exists()) throw new Error("match missing");
    const m = ms.data() || {};
    const seatA = m.seatA;
    const seatB = m.seatB;
    const winnerPid = (winner === "A") ? seatA : (winner === "B") ? seatB : null;
    if (!winnerPid) throw new Error("winnerPid missing");

    const ps = await getDoc(playerRef(winnerPid));
    if (!ps.exists()) throw new Error("winner player missing");
    const p = ps.data() || {};

    const deckObj = p.deck || {};
    const exId = p.exCardId || null;

    const { lines, total } = deckObjToLines(deckObj);

    // EX行（あれば）
    const exLine = exId ? `EX  [${cardDefs?.[exId]?.type ?? "?"}]  【${cardDefs?.[exId]?.cost ?? "?"}】 ${cardName(exId)}（サポ）` : "";

    if (subEl) {
      subEl.textContent = `WINNER:${winner} / 枚数:${total}${exId ? " / EXあり" : ""}`;
    }

    // recipe
    const out = [];
    if (exLine) {
      out.push(exLine);
      out.push("----");
    }
    out.push(...lines);
    if (!lines.length) out.push("（デッキが空 or 取得できません）");
    if (recEl) recEl.textContent = out.join("\n");

    // evaluate + radar
    if (radar && radar.getContext) {
      const res = evaluateDeck(deckObj, cardDefs);

      // drawRadar は白背景で描くのでそのままOK
      drawRadar(radar, res.scores);

      const axes = ["攻撃","耐久","安定","展開","扱い","制圧"];
      const nums = res.scores.map(x=>Math.round(Number(x)||0));
      const line = axes.map((k,i)=>`${k}:${nums[i]}`).join(" / ");

      if (textEl) {
        textEl.textContent =
          `${res.note}\n${line}\n` +
          `${exId ? `EX: ${cardName(exId)}\n` : ""}` +
          `※勝者デッキの指標（ざっくり）`;
      }
    } else {
      if (textEl) textEl.textContent = "（レーダー描画不可：canvas）";
    }
  } catch (e){
    console.warn("[winnerDeck] failed", e);
    if (subEl) subEl.textContent = "（勝者デッキの取得に失敗）";
    if (textEl) textEl.textContent = "（取得に失敗）";
    if (recEl) recEl.textContent = "（取得に失敗）";
  }
}

// =====================
// Counts (turn/kills/infil) : URL params fallback -> Firestore state
// =====================
async function initAndAnimateCounts(){
  let tSeq = Number.isFinite(turnSeq) ? turnSeq : 0;
  let kA = Number.isFinite(killsA) ? killsA : 0;
  let kB = Number.isFinite(killsB) ? killsB : 0;
  let iA = Number.isFinite(infilA) ? infilA : 0;
  let iB = Number.isFinite(infilB) ? infilB : 0;

  const allZero = (!tSeq && !kA && !kB && !iA && !iB);
  const shouldFetch = allZero && !!roomId;

  if (shouldFetch) {
    try{
      const ss = await getDoc(stateRef);
      if (ss.exists()){
        const s = ss.data() || {};
        tSeq = Number(s.turnSeq ?? 0);
        kA = Number(s.kills?.A ?? 0);
        kB = Number(s.kills?.B ?? 0);

        // infil is computed
        const inf = computeInfil(s);
        iA = Number(inf?.infilA ?? 0);
        iB = Number(inf?.infilB ?? 0);
      }
    } catch(e){
      console.warn("[victory] state fetch failed", e);
    }
  }

  const myKills = (seat === "A") ? kA : (seat === "B") ? kB : 0;
  const myInfil = (seat === "A") ? iA : (seat === "B") ? iB : 0;

  animateCount($("#turnV"), Math.max(0, tSeq), 700);
  animateCount($("#killV"), Math.max(0, myKills), 700);
  animateCount($("#infilV"), Math.max(0, myInfil), 700);
}

/* =========================
   Boot
========================= */
injectBaseStyles();
mountLayout();
wireButtons();
startBg();
startConfettiAndFireworks();

// 初回ちょい音（失敗してもOK）
setTimeout(()=> tryBeep(isWin ? 784 : 196, 0.05), 30);

// counts (URL -> state fallback)
initAndAnimateCounts();

// Winner deck load (non-blocking)
loadWinnerDeckAndRender();