// public/match_intro.js
// v20260206_field_decision_from_match_doc
// - Show both players' chosen field in intro (from match.fieldPick or players.fieldId)
// - IMPORTANT: Do NOT re-roll dice here. Use match.diceA/diceB + match.fieldFinal.
// - Dice roll is only "visual animation" then lands on stored values.
// - Big center field reveal -> suction -> go next
//
// URL params:
//   room, player
// optional:
//   next=game.html (default)
//   seat=A|B (if passed, prefer)
//   force=1 (skip everything)

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
function sleep(ms){ return new Promise(r=> setTimeout(r, ms)); }

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
   Field labels (MUST match battle.js)
========================= */
const FIELD_LIST = [
  { id:"grass",  label:"🌿 草原",  desc:"標準。特殊ギミックなし（ベース）" },
  { id:"danger", label:"💣 危険地帯", desc:"💣爆弾などのギミックが出る想定（field_systemで反映）" },
  { id:"swamp",  label:"🫧 沼地",  desc:"移動が阻害される/失敗する等の想定（field_systemで反映）" },
];

function normField(x){
  const s = String(x ?? "").trim().toLowerCase();
  return FIELD_LIST.some(f=>f.id===s) ? s : "grass";
}
function fieldLabel(id){
  const f = FIELD_LIST.find(x=>x.id===normField(id));
  return f ? `${f.label}（${f.id}）` : "🌿 草原（grass）";
}
function fieldDesc(id){
  const f = FIELD_LIST.find(x=>x.id===normField(id));
  return f ? f.desc : "";
}
function safeDice(n){
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.floor(v);
  return (i>=1 && i<=6) ? i : null;
}

/* =========================
   Background FX (simple stars)
========================= */
let suctionFactor = 0; // 0..1
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
  const N = Math.floor(Math.min(200, (innerWidth * innerHeight) / 8500));
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
   Firestore: seat + names + fields + match decision
========================= */
async function loadPlayerName(pid){
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
async function loadPlayerField(pid){
  if (!pid) return "grass";
  try{
    const ps = await getDoc(playerRef(pid));
    if (!ps.exists()) return "grass";
    const p = ps.data() || {};
    return normField(p.fieldId ?? "grass");
  }catch{
    return "grass";
  }
}

async function resolveMatchInfo(){
  if (!roomId || !playerId) {
    setBadge("ERROR");
    setHint("room/player がありません（battle から入ってね）");
    throw new Error("missing params");
  }

  $("roomTxt").textContent = roomId;
  setBadge("SYNC");
  setHint("マッチ情報を取得中…");

  let pickA = null;
  let pickB = null;

  // decision
  let fieldRule = null;    // "same" | "dice"
  let diceA = null;
  let diceB = null;
  let fieldFinal = null;

  try{
    const ms = await getDoc(matchRef);
    if (ms.exists()){
      const m = ms.data() || {};
      seatAPlayerId = m.seatA || null;
      seatBPlayerId = m.seatB || null;

      // field picks
      const fp = (m.fieldPick && typeof m.fieldPick === "object") ? m.fieldPick : null;
      if (fp){
        pickA = normField(fp.A ?? "grass");
        pickB = normField(fp.B ?? "grass");
      }

      // decision (authoritative if exists)
      fieldRule = (m.fieldRule === "same" || m.fieldRule === "dice") ? m.fieldRule : null;
      diceA = safeDice(m.diceA);
      diceB = safeDice(m.diceB);
      fieldFinal = m.fieldFinal ? normField(m.fieldFinal) : null;

      // seat未指定なら match から判定
      if (seat !== "A" && seat !== "B") {
        if (seatAPlayerId === playerId) seat = "A";
        else if (seatBPlayerId === playerId) seat = "B";
      }
    }
  }catch(e){
    console.warn("[intro] match fetch failed", e);
  }

  // names
  const [nameA, nameB] = await Promise.all([
    loadPlayerName(seatAPlayerId),
    loadPlayerName(seatBPlayerId),
  ]);

  $("nameA").textContent = nameA || "---";
  $("nameB").textContent = nameB || "---";

  // fallback picks if missing
  if (!pickA) pickA = await loadPlayerField(seatAPlayerId);
  if (!pickB) pickB = await loadPlayerField(seatBPlayerId);

  pickA = normField(pickA);
  pickB = normField(pickB);

  $("fieldA").textContent = fieldLabel(pickA);
  $("fieldB").textContent = fieldLabel(pickB);

  // YOU tag
  if (seat === "A") $("youA")?.classList.add("on");
  if (seat === "B") $("youB")?.classList.add("on");

  // If decision missing, derive safely (NO dice here)
  if (!fieldRule || !fieldFinal){
    if (pickA === pickB){
      fieldRule = "same";
      fieldFinal = pickA;
      diceA = null; diceB = null;
    }else{
      // 古いmatchで決定が入ってない場合：表示上は「未確定」扱いにして
      // 最終は pickA を採用（ズレ防止のため intro で勝手に決めない）
      // ※ battle.js 側が新しいならここには来ない想定
      fieldRule = "dice";
      fieldFinal = pickA; // fallback
      diceA = null; diceB = null;
    }
  }

  setBadge("READY");
  setHint("フィールド決定を表示します…");

  return { pickA, pickB, nameA, nameB, fieldRule, diceA, diceB, fieldFinal };
}

/* =========================
   Dice animation (visual only)
========================= */
function rand1to6(){ return 1 + Math.floor(Math.random()*6); }

async function animateDiceToFinal(finalA, finalB){
  const diceRow = $("diceRow");
  const diceAEl = $("diceA");
  const diceBEl = $("diceB");
  const boxA = $("diceBoxA");
  const boxB = $("diceBoxB");

  if (diceRow) diceRow.style.display = "";

  const dur = 980;
  const tick = 55;
  const t0 = performance.now();

  while (performance.now() - t0 < dur){
    const a = rand1to6();
    const b = rand1to6();
    if (diceAEl) diceAEl.textContent = String(a);
    if (diceBEl) diceBEl.textContent = String(b);
    await sleep(tick);
  }

  // land on stored values (or "?" if missing)
  if (diceAEl) diceAEl.textContent = (finalA ? String(finalA) : "?");
  if (diceBEl) diceBEl.textContent = (finalB ? String(finalB) : "?");

  if (boxA){ boxA.classList.remove("diceFlash"); void boxA.offsetWidth; boxA.classList.add("diceFlash"); }
  if (boxB){ boxB.classList.remove("diceFlash"); void boxB.offsetWidth; boxB.classList.add("diceFlash"); }

  await sleep(420);
}

/* =========================
   Big field reveal -> suction -> go next
========================= */
function setBigField(finalField, extraText){
  const big = $("fieldBig");
  const rule = $("fieldRule");
  const title = $("fieldTitle");

  const f = normField(finalField);
  if (title) title.textContent = "FINAL FIELD";
  if (big){
    big.textContent = fieldLabel(f);
    big.classList.add("on");
  }
  if (rule){
    rule.textContent =
      `${extraText}\n` +
      `効果メモ：${fieldDesc(f)}`;
  }
}

function playSuctionCountdown(){
  const countEl = $("countTxt");
  const subEl = $("subTxt");
  const bar = $("barFill");
  const panel = document.querySelector(".panel");
  const vs = document.querySelector(".vs");

  let t0 = performance.now();

  const totalMs = 5200;
  const startCount = 3;

  function tick(t){
    const p = clamp((t - t0) / totalMs, 0, 1);

    if (bar) bar.style.width = `${Math.round(p*100)}%`;

    const step = Math.floor(p * startCount);
    const v = Math.max(0, startCount - step);
    if (countEl) countEl.textContent = (v >= 1) ? String(v) : "GO";
    if (subEl) subEl.textContent = (v >= 1) ? "フィールド確定… 転送開始…" : "START!";

    const suckRaw = clamp((p - 0.35) / 0.65, 0, 1);
    suctionFactor = easeInOut(suckRaw);

    if (panel){
      const s1 = 1 - 0.18*easeIn(suctionFactor);
      const rot = (-3.5 * suctionFactor);
      panel.style.transform = `translateY(0) scale(${s1}) rotate(${rot}deg)`;
      panel.style.filter = `blur(${(6.5*easeIn(suctionFactor)).toFixed(2)}px)`;
      panel.style.opacity = String(1 - 0.33*easeIn(suctionFactor));
    }
    if (vs){
      const wob = Math.sin(t/120) * 0.7 * suctionFactor;
      vs.style.transform = `translateX(${wob}px) translateY(${(-2.2*suctionFactor).toFixed(2)}px)`;
    }

    if (p >= 0.965 && panel){
      const k = clamp((p - 0.965) / 0.035, 0, 1);
      const s2 = 1 - 0.88*easeOut(k);
      panel.style.transform = `translateY(0) scale(${s2}) rotate(${(-4*suctionFactor).toFixed(2)}deg)`;
      panel.style.opacity = String(1 - 0.78*easeOut(k));
    }

    if (p < 1) requestAnimationFrame(tick);
    else setTimeout(goGame, 90);
  }

  requestAnimationFrame(tick);
}

/* =========================
   Boot sequence
========================= */
startBg();

$("skipBtn")?.addEventListener("click", ()=> goGame());

if (forceSkip) {
  goGame();
} else {
  setBadge("SYNC");
  $("countTxt").textContent = "--";
  $("subTxt").textContent = "マッチ情報を取得中…";
  $("fieldBig").textContent = "---";
  $("fieldRule").textContent = "お互いのフィールド希望を確認中…";

  const info = await resolveMatchInfo();

  // まず見せる
  setBadge("SHOW");
  $("subTxt").textContent = "フィールド希望を表示…";
  setHint("両者の希望を確認します。");
  await sleep(1100);

  // 決定表示（matchの結果を使う）
  if (info.fieldRule === "same" || info.pickA === info.pickB){
    $("subTxt").textContent = "両者同じフィールド希望！";
    setHint("フィールドは一致しています。");
    setBadge("SAME");
    await sleep(800);

  } else {
    // dice visual (landing on stored dice)
    $("subTxt").textContent = "フィールド希望が違う… ダイスロール！";
    setHint("※出目はサーバー側で確定済み（演出です）");
    setBadge("DICE");

    await animateDiceToFinal(info.diceA, info.diceB);

    const a = safeDice(info.diceA);
    const b = safeDice(info.diceB);

    // winnerSeat: smaller roll wins (if missing, show unknown)
    let winnerSeat = null;
    if (a && b && a !== b) winnerSeat = (a < b) ? "A" : "B";

    if (winnerSeat){
      $("subTxt").textContent =
        `SEAT ${winnerSeat} の出目が小さい！ → SEAT ${winnerSeat} のフィールド採用`;
      setHint(`A=${a} / B=${b} （小さい方のフィールドが採用）`);
    }else{
      $("subTxt").textContent = "結果を反映中…";
      setHint("（古いmatchの可能性：出目が未保存）");
    }

    await sleep(520);
  }

  // 真ん中にドーン（確定フィールド）
  setBadge("FIELD");

  const reasonText =
    (info.pickA === info.pickB || info.fieldRule === "same")
      ? "両者一致 → このフィールドに決定！"
      : "ダイス決定 → 小さい出目側のフィールドに決定！";

  setBigField(info.fieldFinal, reasonText);

  await sleep(1400);

  // 吸い込み＆遷移
  setBadge("WARP");
  setHint("転送中…");
  playSuctionCountdown();
}