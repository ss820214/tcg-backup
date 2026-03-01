// public/match_intro.js
// v20260209_2_match_intro_plus_dice_view

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

let matchFieldId = ""; // gameへ渡す最終フィールド

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
  projectId: "tcg-0bato", // ★ここだけ直す（.firebaseapp.com 付けない）
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const matchRef  = doc(db, "rooms", roomId, "game", "match");
const playerRef = (pid) => doc(db, "rooms", roomId, "players", pid);

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function safeText(s) { return String(s ?? "").slice(0, 48); }

function setBadge(txt) {
  const el = $("badgeTxt");
  if (el) el.textContent = txt;
}
function setHint(txt) {
  const el = $("hintTxt");
  if (el) el.textContent = txt;
}

function goGame() {
  const url = new URL(nextPage, location.href);
  url.searchParams.set("room", roomId);
  url.searchParams.set("player", playerId);

  // ★保険：match取れなかったら grass を渡す
  url.searchParams.set("field", matchFieldId || "grass");

  location.replace(url.toString());
}

function prettyField(f) {
  const t = String(f || "").trim().toLowerCase();
  if (!t) return "---";
  if (t === "grass") return "草原";
  if (t === "danger") return "危険地帯";
  if (t === "swamp") return "沼地";
  return t.toUpperCase();
}

// ★追加：フィールド/ダイス表示
function renderMatchMeta(m){
  const cardA = document.querySelector(".pCard.a");
const cardB = document.querySelector(".pCard.b");
cardA?.classList.toggle("win", !!finalField && finalField === fieldA);
cardB?.classList.toggle("win", !!finalField && finalField === fieldB);

  const fieldA = String(m.fieldA || "").trim().toLowerCase();
  const fieldB = String(m.fieldB || "").trim().toLowerCase();
  const finalField = String(m.field || "").trim().toLowerCase();

  const diceA = Number(m.diceA || 0);
  const diceB = Number(m.diceB || 0);

  if ($("fieldATxt")) $("fieldATxt").textContent = `FIELD: ${prettyField(fieldA)} (${fieldA || "--"})`;
  if ($("fieldBTxt")) $("fieldBTxt").textContent = `FIELD: ${prettyField(fieldB)} (${fieldB || "--"})`;

  // 同フィールドならbattle側はdiceが0のままになりやすい → “一致”に寄せる
  if (fieldA && fieldB && fieldA === fieldB) {
    if ($("diceATxt")) $("diceATxt").textContent = "一致";
    if ($("diceBTxt")) $("diceBTxt").textContent = "一致";
  } else {
    if ($("diceATxt")) $("diceATxt").textContent = diceA ? String(diceA) : "--";
    if ($("diceBTxt")) $("diceBTxt").textContent = diceB ? String(diceB) : "--";
  }

  if ($("finalFieldTxt")) $("finalFieldTxt").textContent = `FIELD: ${prettyField(finalField)} (${finalField || "--"})`;
}

/* =========================
   Background FX (simple stars)
========================= */
let suctionFactor = 0;
function easeInOut(t){ return t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
function easeIn(t){ return t*t; }
function easeOut(t){ return 1 - (1-t)*(1-t); }

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
        const dx = st.x - cx;
        const dy = st.y - cy;
        const d = Math.max(12, Math.hypot(dx,dy));
        const tx = -dy / d;
        const ty =  dx / d;
        const ix = -dx / d;
        const iy = -dy / d;

        const pull = (0.45 + 2.1*suck) * st.s * 6;
        const swirl = (0.25 + 1.6*suck) * st.s * 5;

        st.x += tx * swirl + ix * pull;
        st.y += ty * swirl + iy * pull;

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
   Firestore: seat + names + match meta
========================= */
async function resolveSeatAndNames(){
  if (!roomId || !playerId) {
    setBadge("ERROR");
    setHint("room/player がありません（battle から入ってね）");
    return;
  }

  if ($("roomTxt")) $("roomTxt").textContent = roomId;

  setBadge("SYNC");
  setHint("マッチ情報を取得中…");

  let matchData = null;

  try{
    const ms = await getDoc(matchRef);
    if (ms.exists()){
      const m = ms.data() || {};
      matchData = m;

      seatAPlayerId = m.seatA || null;
      seatBPlayerId = m.seatB || null;

      matchFieldId = String(m.field || "").trim().toLowerCase();

      // ★追加：表示反映
      renderMatchMeta(m);

      if (seat !== "A" && seat !== "B") {
        if (seatAPlayerId === playerId) seat = "A";
        else if (seatBPlayerId === playerId) seat = "B";
      }
    }
  }catch(e){
    console.warn("[intro] match fetch failed", e);
  }

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

  if ($("nameA")) $("nameA").textContent = nameA || "---";
  if ($("nameB")) $("nameB").textContent = nameB || "---";

  if (seat === "A") $("youA")?.classList.add("on");
  if (seat === "B") $("youB")?.classList.add("on");

  // matchが無い/古い場合の保険（表示を崩さない）
  if (!matchData){
    if ($("finalFieldTxt")) $("finalFieldTxt").textContent = "FIELD: ---";
    if ($("fieldATxt")) $("fieldATxt").textContent = "FIELD: ---";
    if ($("fieldBTxt")) $("fieldBTxt").textContent = "FIELD: ---";
    if ($("diceATxt")) $("diceATxt").textContent = "--";
    if ($("diceBTxt")) $("diceBTxt").textContent = "--";
  }

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
  const totalMs = 5000;
  const startCount = 5;

  function tick(t){
    const p = clamp((t - t0) / totalMs, 0, 1);

    if (bar) bar.style.width = `${Math.round(p*100)}%`;

    const step = Math.floor(p * startCount);
    const v = Math.max(0, startCount - step);
    if (countEl) countEl.textContent = (v >= 1) ? String(v) : "GO";
    if (subEl) subEl.textContent = (v >= 1) ? "まもなく開始…" : "START!";

    const suckRaw = clamp((p - 0.5) / 0.5, 0, 1);
    const suck = easeInOut(suckRaw);
    suctionFactor = suck;

    if (panel){
      const s1 = 1 - 0.16*easeIn(suck);
      const rot = (-3 * suck);
      panel.style.transform = `translateY(0) scale(${s1}) rotate(${rot}deg)`;
      panel.style.filter = `blur(${(6*easeIn(suck)).toFixed(2)}px)`;
      panel.style.opacity = String(1 - 0.30*easeIn(suck));
    }
    if (vs){
      const wob = Math.sin(t/120) * 0.6 * suck;
      vs.style.transform = `translateX(${wob}px) translateY(${(-2*suck).toFixed(2)}px)`;
    }

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
$("skipBtn")?.addEventListener("click", () => goGame());

if (forceSkip) goGame();
else {
  await resolveSeatAndNames();
  if (!matchFieldId) {
    setBadge("WAIT");
    setHint("マッチ確定待ち…（相手の準備を待っています）");
    // ここで止める（または setTimeout で再取得）
  } else {
    playCountdown();
  }
}