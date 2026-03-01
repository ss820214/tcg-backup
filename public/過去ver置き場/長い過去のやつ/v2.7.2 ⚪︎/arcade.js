
// public/arcade.js
// v20260213a - Arcade UI + Path Map (一本道+分岐の双六)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =====================
// Log (safe: works before DOM is ready)
// =====================
let logEl = null;
let logs = [];
function log(s) {
  logs.push(String(s ?? ""));
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  if (logEl) logEl.textContent = logs.slice(-28).join("\n");
  console.log("[arcade]", s);
}

// =====================
// Firebase (same style as game.js)
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// DOM
// =====================
const $ = (id) => document.getElementById(id);

const posText = $("posText");
const floorText = $("floorText");
const hpText = $("hpText");
const spText = $("spText");
const goldText = $("goldText");

logEl = $("log");
const objectiveText = $("objectiveText");

const mapCanvas = $("mapCanvas");
const bigMapCanvas = $("bigMapCanvas");
const mapOverlay = $("mapOverlay");

const chipBiome = $("chipBiome");
const chipThreat = $("chipThreat");
const chipTip = $("chipTip");

const btnRoll = $("btnRoll");
const btnExplore = $("btnExplore");
const btnRest = $("btnRest");
const btnResetStage = $("btnResetStage");
const btnMap = $("btnMap");
const btnCloseMap = $("btnCloseMap");

const eventCard = $("eventCard");
const eventTitle = $("eventTitle");
const eventBody = $("eventBody");
const eventActions = $("eventActions");

const btnGoBattle = $("btnGoBattle");
const battleText = $("battleText");

const hpBar = $("hpBar");
const spBar = $("spBar");
const statGrid = $("statGrid");

// =====================
// Cards from cloud
// =====================
let cardDefs = {};
async function loadCardsFromCloud() {
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach((d) => (m[d.id] = d.data()));
  cardDefs = m;
  log(`🗂️ cards loaded: ${Object.keys(cardDefs).length}`);
}
await loadCardsFromCloud();

// =====================
// Arcade Save (localStorage)
// =====================
const SAVE_KEY = "tcg_arcade_save_v2_path";

function loadSave() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function saveNow(st) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(st));
  } catch {}
}

// =====================
// State (Path-map)
// =====================
// node.type: 1 event, 2 battle, 3 shop, 4 boss, 5 heal
const MAP_W = 13; // layout hint only
const MAP_H = 9;

function makePathMap(seed) {
  // simple deterministic-ish RNG from seed
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return (s >>> 0) / 4294967296;
  };

  // Main line with occasional branches that re-join.
  // Layout uses normalized coordinates [0..1] so canvas can scale.
  const nodes = [];
  const edges = [];

  const addNode = (id, x, y, type) => {
    nodes.push({ id, x, y, type });
    return id;
  };
  const link = (a, b) => edges.push([a, b]);

  // Start
  addNode("S", 0.06, 0.70, 1);

  // Main line length (10..13)
  const mainLen = 10 + Math.floor(rnd() * 4);

  let prev = "S";
  for (let i = 1; i <= mainLen; i++) {
    const id = String(i);
    const x = 0.06 + (0.88 * (i / (mainLen + 1)));
    const y = 0.70 + (rnd() - 0.5) * 0.06;

    let t = 1;
    const r = rnd();
    if (i === mainLen) t = 4;          // boss at end
    else if (r < 0.12) t = 3;          // shop
    else if (r < 0.24) t = 5;          // heal
    else if (r < 0.58) t = 1;          // event
    else t = 2;                         // battle

    addNode(id, x, y, t);
    link(prev, id);
    prev = id;

    // branch chance (avoid too early/late)
    const canBranch = i >= 2 && i <= mainLen - 3;
    if (canBranch && rnd() < 0.28) {
      const b1 = `B${i}a`;
      const b2 = `B${i}b`;
      const join = `J${i}`;

      const yUp = 0.38 + rnd() * 0.10;
      const yDn = 0.86 - rnd() * 0.10;
      const x1 = x + 0.06;
      const x2 = x + 0.12;

      const pickType = () => {
        const rr = rnd();
        if (rr < 0.15) return 3;
        if (rr < 0.30) return 5;
        if (rr < 0.62) return 1;
        return 2;
      };

      addNode(b1, x1, yUp, pickType());
      addNode(b2, x1, yDn, pickType());
      addNode(join, x2, 0.70 + (rnd() - 0.5) * 0.04, pickType());

      link(id, b1);
      link(id, b2);
      link(b1, join);
      link(b2, join);

      // placeholder: join -> next main (i+1)
      edges.push([join, `__NEXT_MAIN_${i}__`]);
    }
  }

  // Patch placeholder edges
  for (let k = 0; k < edges.length; k++) {
    const [a, b] = edges[k];
    if (typeof b === "string" && b.startsWith("__NEXT_MAIN_")) {
      const i = Number(b.replace("__NEXT_MAIN_", "").replace("__", ""));
      edges[k] = [a, String(i + 1)];
    }
  }

  // Build lookup maps
  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;

  const nextMap = {};
  for (const [a, b] of edges) {
    if (!nextMap[a]) nextMap[a] = [];
    nextMap[a].push(b);
  }

  return { nodes, edges, nodeById, nextMap };
}

function makeNewRun() {
  const seed = Math.floor(Math.random() * 1e9);
  const map = makePathMap(seed);

  return {
    floor: 1,
    nodeId: "S",
    hp: 100,
    sp: 100,
    hpMax: 100,
    spMax: 100,
    gold: 0,
    threat: 1,
    biome: "NEON RUINS",
    visited: {}, // visited nodes by id
    map,
    pendingBattle: null, // { enemyId, seed }
    pendingMove: null,   // { stepsLeft }
    pendingBranch: null, // { options: [id...], stepsLeft }
    seed,
  };
}

// Helper to build a new stage while keeping player stats
function makeNextStage(prev) {
  const nextFloor = (prev.floor || 1) + 1;
  const nextSeed = Math.floor(Math.random() * 1e9);
  const nextMap = makePathMap(nextSeed);

  return {
    ...prev,
    floor: nextFloor,
    nodeId: "S",
    visited: {},
    map: nextMap,
    pendingBattle: null,
    pendingMove: null,
    pendingBranch: null,
    seed: nextSeed,
    // difficulty scaling (simple): threat slowly rises
    threat: clamp((prev.threat || 1) + 1, 1, 99),
    // biome can change later; for now keep or rotate
    biome: String(prev.biome || "NEON RUINS"),
  };
}

let state = loadSave();

// migrate old save (grid based) -> new run
if (!state || !state.map || !state.nodeId) state = makeNewRun();

// ensure derived maps exist (if older save stored nodes/edges only)
if (state.map && (!state.map.nodeById || !state.map.nextMap)) {
  const nodes = state.map.nodes || [];
  const edges = state.map.edges || [];
  const nodeById = {};
  for (const n of nodes) nodeById[n.id] = n;
  const nextMap = {};
  for (const [a, b] of edges) {
    if (!nextMap[a]) nextMap[a] = [];
    nextMap[a].push(b);
  }
  state.map = { ...state.map, nodes, edges, nodeById, nextMap };
}

// =====================
// UI Update
// =====================
function setBars() {
  const hpP = state.hpMax > 0 ? Math.max(0, Math.min(1, state.hp / state.hpMax)) : 0;
  const spP = state.spMax > 0 ? Math.max(0, Math.min(1, state.sp / state.spMax)) : 0;
  if (hpBar) hpBar.style.width = `${Math.round(hpP * 100)}%`;
  if (spBar) spBar.style.width = `${Math.round(spP * 100)}%`;
}

function setStatsPanel() {
  if (!statGrid) return;
  statGrid.innerHTML = "";
  const items = [
    ["Threat", String(state.threat)],
    ["Biome", String(state.biome)],
    ["Seed", String(state.seed)],
    ["Visited", String(Object.keys(state.visited || {}).length)],
    ["Node", String(state.nodeId)],
  ];
  for (const [k, v] of items) {
    const box = document.createElement("div");
    box.className = "statBox";
    box.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    statGrid.appendChild(box);
  }
}

function syncHud() {
  if (posText) posText.textContent = `${state.nodeId}`;
  if (floorText) floorText.textContent = `${state.floor}`;
  if (hpText) hpText.textContent = `${state.hp}/${state.hpMax}`;
  if (spText) spText.textContent = `${state.sp}/${state.spMax}`;
  if (goldText) goldText.textContent = `${state.gold}`;

  if (chipBiome) chipBiome.textContent = `🌌 ${state.biome}`;
  if (chipThreat) chipThreat.textContent = `⚠️ THREAT ${state.threat}`;
  if (chipTip) chipTip.textContent = `🎲で前進 / Enter・Spaceでも🎲 / MAPで全体`;

  setBars();
  setStatsPanel();

  if (btnGoBattle) btnGoBattle.disabled = !state.pendingBattle;
  if (battleText) {
    battleText.textContent = state.pendingBattle
      ? `戦闘準備OK：enemy=${state.pendingBattle.enemyId}`
      : "まだ戦闘は起きてない";
  }

  if (objectiveText) {
    objectiveText.textContent = `STAGE ${state.floor}：☠に到達 → クリア（仮）`;
  }
}

// =====================
// Map rendering (canvas resize safe)
// =====================
function setupCanvas(canvas) {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(10, Math.floor(rect.width * dpr));
  const h = Math.max(10, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { ctx, dpr };
}

function tileColor(t) {
  if (t === 4) return "rgba(255, 59, 48, .95)";
  if (t === 3) return "rgba(255, 149, 0, .85)";
  if (t === 5) return "rgba(52, 199, 89, .85)";
  if (t === 2) return "rgba(124, 92, 255, .78)";
  return "rgba(0, 212, 255, .58)";
}
function tileIcon(t) {
  if (t === 4) return "☠";
  if (t === 3) return "🛒";
  if (t === 5) return "➕";
  if (t === 2) return "⚔";
  return "❓";
}

function drawMap(canvas, focus = false) {
  if (!canvas) return;
  const { ctx } = setupCanvas(canvas);

  const cw = canvas.width;
  const ch = canvas.height;

  // 背景：シンプル
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.fillRect(0, 0, cw, ch);

  const pad = focus ? 24 : 14;
  const gw = cw - pad * 2;
  const gh = ch - pad * 2;

  const map = state.map;
  const nodes = map?.nodes || [];
  const edges = map?.edges || [];
  const nodeById = map?.nodeById || {};

  const tx = (nx) => Math.floor(pad + nx * gw);
  const ty = (ny) => Math.floor(pad + ny * gh);

  // 枠
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad - 10, pad - 10, gw + 20, gh + 20);

  // 道（線） ※派手にしない
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = focus ? 3 : 2;
  for (const [a, b] of edges) {
    const na = nodeById[a];
    const nb = nodeById[b];
    if (!na || !nb) continue;
    ctx.beginPath();
    ctx.moveTo(tx(na.x), ty(na.y));
    ctx.lineTo(tx(nb.x), ty(nb.y));
    ctx.stroke();
  }
  ctx.restore();

  // タイルサイズ
  const sBase = Math.max(18, Math.floor(Math.min(gw, gh) * (focus ? 0.040 : 0.032)));

  // タイル描画（四角）
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const n of nodes) {
    const visited = !!state.visited?.[n.id];
    const cx = tx(n.x);
    const cy = ty(n.y);

    const size = sBase + (n.type === 4 ? 6 : 0);
    const half = Math.floor(size / 2);
    const x0 = cx - half;
    const y0 = cy - half;

    // 影（疑似3D）
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(x0 + 5, y0 + 6, size, size);

    // 面
    ctx.fillStyle = tileColor(n.type);
    ctx.globalAlpha = visited ? 0.92 : 0.40;
    ctx.fillRect(x0, y0, size, size);
    ctx.globalAlpha = 1;

    // 枠
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, size, size);

    // 上ハイライト（立体っぽく）
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath();
    ctx.moveTo(x0 + 1, y0 + 1);
    ctx.lineTo(x0 + size - 1, y0 + 1);
    ctx.stroke();

    // アイコン
    ctx.font = `${Math.floor(size * 0.55)}px ui-sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.globalAlpha = visited ? 0.95 : 0.65;
    ctx.fillText(tileIcon(n.type), cx, cy + 1);
    ctx.globalAlpha = 1;

    // IDは全体MAPの時だけ
    if (focus) {
      ctx.font = `${Math.floor(size * 0.26)}px ui-sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.fillText(n.id, cx, y0 - Math.floor(size * 0.22));
    }
  }

  // プレイヤー（リング）
  const cur = nodeById[state.nodeId];
  if (cur) {
    const px = tx(cur.x);
    const py = ty(cur.y);
    const rr = Math.max(10, Math.floor(sBase * 0.60));

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 4;
    ctx.arc(px, py, rr, 0, Math.PI * 2);
    ctx.stroke();

    // 移動中のパルス
    if (state.pendingMove && state.pendingMove.stepsLeft > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(124,92,255,.70)";
      ctx.lineWidth = 3;
      ctx.arc(px, py, rr + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = `${Math.floor(sBase * 0.34)}px ui-sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.fillText("YOU", px, py - rr - 12);
  }
}

function renderAll() {
  syncHud();
  drawMap(mapCanvas, false);
  if (mapOverlay && !mapOverlay.classList.contains("hidden")) {
    drawMap(bigMapCanvas, true);
  }
  saveNow(state);
}

// Resize observer
const ro = new ResizeObserver(() => {
  renderAll();
});
if (mapCanvas) ro.observe(mapCanvas);
if (bigMapCanvas) ro.observe(bigMapCanvas);
window.addEventListener("resize", () => renderAll());

// =====================
// Game logic
// =====================
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function openEvent(title, body, actions) {
  if (!eventCard) return;
  eventTitle.textContent = title;
  eventBody.textContent = body;
  eventActions.innerHTML = "";

  for (const a of actions) {
    const b = document.createElement("button");
    b.className = `btn ${a.kind || ""}`.trim();
    b.textContent = a.label;
    b.addEventListener("click", () => {
      try { a.onClick?.(); } finally { closeEvent(); renderAll(); }
    });
    eventActions.appendChild(b);
  }

  eventCard.classList.remove("hidden");
}
function closeEvent() {
  eventCard?.classList.add("hidden");
}

function markVisited() {
  state.visited = state.visited || {};
  state.visited[state.nodeId] = true;
}

function nodeTypeAt(id) {
  const n = state.map?.nodeById?.[id];
  return n?.type ?? 1;
}

function triggerCellEvent() {
  markVisited();
  const t = nodeTypeAt(state.nodeId);

  if (t === 5) {
    openEvent("➕ 休息ポイント", "HP/SPを少し回復できる。", [
      {
        label: "回復する",
        kind: "primary",
        onClick: () => {
          state.hp = clamp(state.hp + 30, 0, state.hpMax);
          state.sp = clamp(state.sp + 30, 0, state.spMax);
          log("➕ 回復した（+30/+30）");
        }
      },
      { label: "やめる", kind: "ghost", onClick: () => log("…何もしなかった") }
    ]);
    return;
  }

  if (t === 3) {
    openEvent("🛒 ショップ（仮）", "ゴールドで補給できる（仮）。", [
      {
        label: "HP最大+10（50G）",
        kind: "primary",
        onClick: () => {
          if (state.gold < 50) return log("💸 ゴールド不足");
          state.gold -= 50;
          state.hpMax += 10;
          state.hp = state.hpMax;
          log("🛒 HP最大+10");
        }
      },
      {
        label: "Threat-1（40G）",
        onClick: () => {
          if (state.gold < 40) return log("💸 ゴールド不足");
          state.gold -= 40;
          state.threat = clamp(state.threat - 1, 1, 99);
          log("🛒 Threat-1");
        }
      },
      { label: "閉じる", kind: "ghost", onClick: () => {} }
    ]);
    return;
  }

  if (t === 4) {
    // boss / stage goal
    const bossEnemy = pickEnemyId(true);
    state.pendingBattle = { enemyId: bossEnemy, seed: Math.floor(Math.random() * 1e9) };

    openEvent(
      `☠ STAGE ${state.floor} BOSS`,
      "ボス到達！\nここは必ずボス戦。準備できたら戦闘へ。",
      [
        { label: "戦闘へ", kind: "primary", onClick: () => goBattle() },
        { label: "あとで", kind: "ghost", onClick: () => log("BOSSを保留にした") }
      ]
    );
    return;
  }

  if (t === 2) {
    state.pendingBattle = { enemyId: pickEnemyId(false), seed: Math.floor(Math.random() * 1e9) };
    openEvent("⚔️ 戦闘", "敵影を発見した。戦闘に入る？", [
      { label: "戦闘へ", kind: "primary", onClick: () => goBattle() },
      { label: "回避（Threat+1）", onClick: () => { state.threat += 1; log("🏃 回避した（Threat+1）"); } },
    ]);
    return;
  }

  // event
  const r = Math.random();
  if (r < 0.33) {
    openEvent("💰 宝箱", "ゴールドを入手した。", [
      { label: "開ける", kind: "primary", onClick: () => { const g = 20 + Math.floor(Math.random() * 40); state.gold += g; log(`💰 +${g}G`); } },
    ]);
  } else if (r < 0.66) {
    openEvent("⚡ 異常気象", "SPが削られるが、報酬もある。", [
      { label: "突っ込む", kind: "primary", onClick: () => { state.sp = clamp(state.sp - 20, 0, state.spMax); state.gold += 30; log("⚡ SP-20 / +30G"); } },
      { label: "やめる", kind: "ghost", onClick: () => log("…回避した") },
    ]);
  } else {
    openEvent("🧠 研究端末", "強化を選べる（仮）。", [
      { label: "HP最大+10", kind: "primary", onClick: () => { state.hpMax += 10; state.hp += 10; log("🧠 HP最大+10"); } },
      { label: "SP最大+10", onClick: () => { state.spMax += 10; state.sp += 10; log("🧠 SP最大+10"); } },
    ]);
  }
}

// enemy id selection: cards collectionから “敵っぽい” ものを拾う（なければダミー）
function pickEnemyId(isBoss) {
  const ids = Object.keys(cardDefs || {});
  if (!ids.length) return isBoss ? "ENEMY_BOSS" : "ENEMY";
  const enemyLike = ids.filter(id => /enemy|mob|boss/i.test(id));
  const pool = enemyLike.length ? enemyLike : ids;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

// =====================
// Sugoroku movement
// =====================
function canMoveNow() {
  return !state.pendingBranch && !state.pendingMove;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 1歩進む or 分岐で停止
function stepOnceOrBranch() {
  const nexts = state.map?.nextMap?.[state.nodeId] || [];

  if (!nexts.length) {
    log("🚧 これ以上進めない");
    state.pendingMove = null;
    return "end";
  }

  if (nexts.length === 1) {
    state.nodeId = nexts[0];
    markVisited();
    return "moved";
  }

  // 分岐：ここで止める
  state.pendingBranch = { options: nexts.slice(0, 4) };

  openEvent(
    "🧭 分かれ道",
    "どっちへ進む？（選ぶと移動を続行）",
    nexts.slice(0, 4).map((id, idx) => {
      const n = state.map?.nodeById?.[id];
      const label = n ? `${idx + 1}. ${tileIcon(n.type)} ルート${idx + 1}` : `${idx + 1}. ルート${idx + 1}`;
      return {
        label,
        kind: idx === 0 ? "primary" : "",
        onClick: () => {
          state.nodeId = id;
          state.pendingBranch = null;
          markVisited();
          continueMoveAnimated();
        },
      };
    })
  );

  return "branch";
}

async function continueMoveAnimated() {
  if (!state.pendingMove) return;

  while (state.pendingMove && state.pendingMove.stepsLeft > 0) {
    state.pendingMove.stepsLeft -= 1;

    const r = stepOnceOrBranch();
    renderAll();

    if (r === "branch") return; // 分岐選択を待つ

    // ここが「止まりながら進む」テンポ
    await sleep(260);
  }

  state.pendingMove = null;
  triggerCellEvent(); // 止まったマスのイベント発火
  renderAll();
}

function rollDice() {
  if (!canMoveNow()) {
    if (!state.__movingWarned) {
      state.__movingWarned = true;
      log("⏳ 移動中/分岐中");
      setTimeout(() => (state.__movingWarned = false), 600);
    }
    return;
  }

  const r = 1 + Math.floor(Math.random() * 6);
  log(`🎲 サイコロ: ${r}`);

  state.pendingMove = { stepsLeft: r };
  continueMoveAnimated();
}

// =====================
// Extra actions
// =====================
function explore() {
  log("🔍 探索した");
  const r = Math.random();
  if (r < 0.5) { state.gold += 10; log("🔍 +10G"); }
  else { state.sp = clamp(state.sp + 10, 0, state.spMax); log("🔍 SP+10"); }
  renderAll();
}

function rest() {
  log("🛌 休憩した");
  state.hp = clamp(state.hp + 15, 0, state.hpMax);
  state.sp = clamp(state.sp + 15, 0, state.spMax);
  renderAll();
}

function resetStage() {
  log("☠ ステージを戻す（仮）");
  state.floor = Math.max(1, (state.floor || 1) - 1);
  // regenerate a fresh map for the (reduced) floor
  state.seed = Math.floor(Math.random() * 1e9);
  state.map = makePathMap(state.seed);
  state.visited = {};
  state.threat = clamp(state.threat - 1, 1, 99);
  state.nodeId = "S";
  state.pendingBattle = null;
  state.pendingMove = null;
  state.pendingBranch = null;
  renderAll();
}

// =====================
// Battle transition
// =====================
async function goBattle() {
  if (!state.pendingBattle) return;

  const enemyId = state.pendingBattle.enemyId;
  const seed = state.pendingBattle.seed;

  log(`⚔️ 戦闘開始: enemy=${enemyId} seed=${seed}`);

  let roomId = "";
  try {
    const roomData = {
      mode: "arcade",
      status: "waiting",
      createdAt: serverTimestamp(),
      enemyId,
      seed,
      floor: state.floor,
      pos: { nodeId: state.nodeId },
      threat: state.threat,
      biome: state.biome,
      players: {
        A: { name: "YOU", hp: state.hp, sp: state.sp, hpMax: state.hpMax, spMax: state.spMax },
        B: null,
      },
    };

    const ref = await addDoc(collection(db, "rooms"), roomData);
    roomId = ref.id;

    try {
      localStorage.setItem(
        "tcg_arcade_pending_battle",
        JSON.stringify({ roomId, seat: "A", enemyId, seed, at: Date.now() })
      );
    } catch {}

    log(`🏠 room created: ${roomId}`);
  } catch (e) {
    log(`⚠️ room create failed -> fallback: ${String(e?.message || e)}`);
  }

  const qs = new URLSearchParams();
  qs.set("from", "arcade");
  qs.set("enemy", enemyId);
  qs.set("seed", String(seed));
  if (roomId) {
    qs.set("roomId", roomId);
    qs.set("seat", "A");
  }

  location.href = `battle.html?${qs.toString()}`;
}

// =====================
// Buttons
// =====================
btnRoll?.addEventListener("click", rollDice);
btnExplore?.addEventListener("click", explore);
btnRest?.addEventListener("click", rest);
btnResetStage?.addEventListener("click", resetStage);

btnGoBattle?.addEventListener("click", () => { goBattle(); });

btnMap?.addEventListener("click", () => {
  mapOverlay?.classList.remove("hidden");
  drawMap(bigMapCanvas, true);
});
btnCloseMap?.addEventListener("click", () => {
  mapOverlay?.classList.add("hidden");
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    mapOverlay?.classList.add("hidden");
    closeEvent();
    renderAll();
    return;
  }

  const k = e.key.toLowerCase();
  if (k === " " || k === "enter") rollDice();
});

// 初回
log("✅ Arcade 起動");
markVisited();
triggerCellEvent();
renderAll();