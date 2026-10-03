// public/match_intro.js
// v20260724_vs_profile1

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

let matchFieldId = ""; // gameへ渡す最終フィールド

const roomId   = params.get("room")   || "";
const playerId = params.get("player") || "";
const nextPage = params.get("next")   || "game.html";
const forceSkip = params.get("force") === "1";
const isSolo = params.get("solo") === "1";

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
const stateRef  = doc(db, "rooms", roomId, "state", "main");
const playersRef = collection(db, "rooms", roomId, "players");
const playerRef = (pid) => doc(db, "rooms", roomId, "players", pid);

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function safeText(s) { return String(s ?? "").slice(0, 48); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function normalizeFieldId(f) {
  const raw = String(f || "").trim();
  const t = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (t === "danger" || t === "dangerzone" || raw.includes("危険")) return "danger";
  if (t === "swamp" || raw.includes("沼")) return "swamp";
  if (t === "grass" || raw.includes("草")) return "grass";
  return "grass";
}

function hashString(s) {
  let h = 2166136261;
  const text = String(s || "");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function diceFromSeed(seed) {
  return (hashString(seed) % 6) + 1;
}

function decideFieldDeterministic(fieldA, fieldB, seed) {
  const a = normalizeFieldId(fieldA);
  const b = normalizeFieldId(fieldB);
  if (a === b) return { field: a, diceA: 0, diceB: 0 };

  let diceA = 1;
  let diceB = 1;
  for (let i = 0; i < 10; i++) {
    diceA = diceFromSeed(`${seed}|A|${i}`);
    diceB = diceFromSeed(`${seed}|B|${i}`);
    if (diceA !== diceB) break;
  }
  return { field: diceA >= diceB ? a : b, diceA, diceB };
}

async function buildMatchMetaFromPlayers() {
  const snap = await getDocs(playersRef);
  const players = [];
  snap.forEach((d) => players.push({ id: d.id, data: d.data() || {} }));
  players.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  if (!players.length) return null;

  const a = players[0];
  const b = players[1] || players[0];
  const fieldA = normalizeFieldId(a.data.desiredField || params.get("field") || "grass");
  const fieldB = normalizeFieldId(b.data.desiredField || fieldA);
  const decided = decideFieldDeterministic(fieldA, fieldB, `${roomId}|${a.id}|${b.id}`);

  return {
    seatA: a.id,
    seatB: b.id,
    fieldA,
    fieldB,
    diceA: decided.diceA,
    diceB: decided.diceB,
    field: decided.field,
    fieldRule: "fallback_players",
  };
}

async function getDocWithRetry(ref, tries = 5, delayMs = 180) {
  let lastSnap = null;
  for (let i = 0; i < tries; i++) {
    lastSnap = await getDoc(ref);
    if (lastSnap.exists()) return lastSnap;
    if (i < tries - 1) await sleep(delayMs);
  }
  return lastSnap;
}

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
  const t = normalizeFieldId(f);
  if (!t) return "---";
  if (t === "grass") return "草原";
  if (t === "danger") return "危険地帯";
  if (t === "swamp") return "沼地";
  if (t === "grass") return "草原";
  if (t === "danger") return "危険地帯";
  if (t === "swamp") return "沼地";
  return t.toUpperCase();
}

const ATTR_COLOR = {
  火: "#ff6b6b",
  水: "#7dd3fc",
  雷: "#facc15",
  草: "#78e3ad",
  風: "#9de7c5",
  鋼: "#b8c0cc",
  光: "#ffe29b",
  闇: "#b889ff",
  幻: "#f0abfc",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function inferAttrFromCardId(id) {
  const s = String(id || "").toLowerCase();
  if (/fire|_hi|火/.test(s)) return "火";
  if (/water|mizu|水/.test(s)) return "水";
  if (/thunder|lightning|rai|雷|plug/.test(s)) return "雷";
  if (/grass|kusa|heal|drug|草/.test(s)) return "草";
  if (/wind|kaze|ninja|風/.test(s)) return "風";
  if (/steel|rock|hagane|鋼/.test(s)) return "鋼";
  if (/light|hikari|光/.test(s)) return "光";
  if (/dark|yami|闇/.test(s)) return "闇";
  if (/phantom|illusion|gen|幻/.test(s)) return "幻";
  return "";
}

function prettyCardId(id) {
  return String(id || "")
    .replace(/^ft_/, "")
    .replace(/^s0+/, "S")
    .replace(/_/g, " ")
    .slice(0, 18);
}

function deckProfileFromPlayerData(p = {}) {
  const deck = p.deck && typeof p.deck === "object" ? p.deck : {};
  const total = Object.values(deck).reduce((a, b) => a + Math.max(0, Number(b) || 0), 0);
  const attrs = {};
  for (const [id, n] of Object.entries(deck)) {
    const attr = inferAttrFromCardId(id);
    if (!attr) continue;
    attrs[attr] = (attrs[attr] || 0) + Math.max(0, Number(n) || 0);
  }
  const top = Object.entries(attrs).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const featured = Object.entries(deck)
    .map(([id, n]) => ({ id, count: Math.max(0, Number(n) || 0), attr: inferAttrFromCardId(id) || "混" }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || String(a.id).localeCompare(String(b.id), "ja"))
    .slice(0, 3);
  return {
    title: safeText(p.deckTitle || p.title || "未保存デッキ"),
    total,
    field: prettyField(p.desiredField || p.field || ""),
    attrs: top,
    featured,
  };
}

function renderDeckProfile(slot, data) {
  const el = $(`deckProfile${slot}`);
  if (!el) return;
  const profile = deckProfileFromPlayerData(data || {});
  const meta = el.querySelector(".matchDeckMeta");
  const rail = el.querySelector(".matchAttrRail");
  const featured = el.querySelector(".matchFeaturedCards");
  if (meta) {
    meta.innerHTML = `${esc(profile.title)}<br><span style="color:rgba(255,255,255,.58)">枚数 ${esc(profile.total || "--")} / 希望 ${esc(profile.field || "---")}</span>`;
  }
  if (rail) {
    rail.innerHTML = profile.attrs.length
      ? profile.attrs.map(([a, c]) => `<span class="matchAttrDot" style="--attr-c:${ATTR_COLOR[a] || "#7dd3fc"}">${esc(a)}${esc(c)}</span>`).join("")
      : `<span class="matchAttrDot">混</span>`;
  }
  if (featured) {
    featured.innerHTML = profile.featured.length
      ? profile.featured.map((c) => `
          <span class="matchFeaturedCard" style="--attr-c:${ATTR_COLOR[c.attr] || "#7dd3fc"}">
            <b>${esc(prettyCardId(c.id))}</b><em>x${esc(c.count)}</em>
          </span>
        `).join("")
      : `<span class="matchFeaturedEmpty">主力カード未設定</span>`;
  }
}

// ★追加：フィールド/ダイス表示
function renderMatchMeta(m){
  const fieldA = m?.fieldA ? normalizeFieldId(m.fieldA) : "";
  const fieldB = m?.fieldB ? normalizeFieldId(m.fieldB) : "";
  const finalField = m?.field ? normalizeFieldId(m.field) : "";

  const cardA = document.querySelector(".pCard.a");
  const cardB = document.querySelector(".pCard.b");
  cardA?.classList.toggle("win", !!finalField && finalField === fieldA);
  cardB?.classList.toggle("win", !!finalField && finalField === fieldB);

  const diceA = Number(m?.diceA || 0);
  const diceB = Number(m?.diceB || 0);

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

  if ($("finalFieldTxt")) $("finalFieldTxt").textContent =
    `FIELD: ${prettyField(finalField)} (${finalField || "--"})`;
  const plate = $("fieldPlate");
  if (plate) {
    plate.innerHTML = `<b>${esc(prettyField(finalField))}</b><span>${esc(finalField || "--")}</span>`;
  }
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
    const ms = await getDocWithRetry(matchRef);
    if (ms.exists()){
      const m = ms.data() || {};
      matchData = m;

      seatAPlayerId = m.seatA || null;
      seatBPlayerId = m.seatB || null;

      matchFieldId = m.field ? normalizeFieldId(m.field) : "";

      // ★追加：表示反映
      renderMatchMeta(m);

      if (seat !== "A" && seat !== "B") {
        if (seatAPlayerId === playerId) seat = "A";
        else if (seatBPlayerId === playerId) seat = "B";
      }
    }
    }catch(e){
    console.warn("[intro] match fetch failed", e);
    setBadge("SYNC");
    setHint("フィールド情報を補完中…");
  }

  if (!matchData) {
    try {
      const ss = await getDoc(stateRef);
      if (ss.exists()) {
        const s = ss.data() || {};
        const field = normalizeFieldId(s.fieldId ?? s.field?.id ?? params.get("field") ?? "grass");
        matchFieldId = field;
        matchData = {
          seatA: s.seatA || s.seatAPlayerId || null,
          seatB: s.seatB || s.seatBPlayerId || null,
          fieldA: field,
          fieldB: field,
          field,
          diceA: 0,
          diceB: 0,
        };
        seatAPlayerId = matchData.seatA;
        seatBPlayerId = matchData.seatB;
        renderMatchMeta(matchData);
      }
    } catch (e) {
      console.warn("[intro] state fallback failed", e);
    }
  }

  if (!matchData && params.get("field")) {
    matchFieldId = normalizeFieldId(params.get("field"));
    matchData = {
      fieldA: matchFieldId,
      fieldB: matchFieldId,
      field: matchFieldId,
      diceA: 0,
      diceB: 0,
    };
    renderMatchMeta(matchData);
  }

  if (!matchData) {
    try {
      matchData = await buildMatchMetaFromPlayers();
      if (matchData) {
        seatAPlayerId = matchData.seatA || null;
        seatBPlayerId = matchData.seatB || null;
        matchFieldId = normalizeFieldId(matchData.field);
        renderMatchMeta(matchData);
      }
    } catch (e) {
      console.warn("[intro] players fallback failed", e);
    }
  }

  if (!matchData) {
    matchFieldId = normalizeFieldId(params.get("field") || "grass");
    matchData = {
      seatA: playerId || null,
      seatB: null,
      fieldA: matchFieldId,
      fieldB: matchFieldId,
      field: matchFieldId,
      diceA: 0,
      diceB: 0,
      fieldRule: "fallback_default",
    };
    seatAPlayerId = matchData.seatA;
    renderMatchMeta(matchData);
  }

  async function loadPlayer(pid){
    if (!pid) return { name: "---", data: {} };
    try{
      const ps = await getDoc(playerRef(pid));
      if (!ps.exists()) return { name: "---", data: {} };
      const p = ps.data() || {};
      return { name: safeText(p.name || p.playerName || pid), data: p };
    }catch{
      return { name: "---", data: {} };
    }
  }

  const playerA = await loadPlayer(seatAPlayerId);
  const playerB = await loadPlayer(seatBPlayerId);

  if ($("nameA")) $("nameA").textContent = playerA.name || "---";
  if ($("nameB")) $("nameB").textContent = playerB.name || "---";
  renderDeckProfile("A", playerA.data);
  renderDeckProfile("B", playerB.data);

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

if (forceSkip) {
  goGame();
} else if (isSolo) {
  setBadge("SOLO");
  setHint("ソロモード開始準備中…");
  matchFieldId = matchFieldId || "grass";
  setTimeout(() => playCountdown(), 120);
} else {
  await resolveSeatAndNames();

  if (!matchFieldId) {
    // 対人なら少し待ってもいいが、完全停止は避ける
    matchFieldId = "grass";
    renderMatchMeta({
      fieldA: matchFieldId,
      fieldB: matchFieldId,
      field: matchFieldId,
      diceA: 0,
      diceB: 0,
    });
    setBadge("READY");
    setHint("準備中…");
    setTimeout(() => playCountdown(), 300);
  } else {
    playCountdown();
  }
}
