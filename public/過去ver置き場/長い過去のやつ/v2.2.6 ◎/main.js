// public/deck.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { RULES_HTML } from "./rules.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const tutorialBtn = document.getElementById("tutorialBtn");
if (tutorialBtn) tutorialBtn.onclick = () => (location.href = "./tutorial.html");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let deck = {};      // {cardId: {name,type,cost,hp,sp,count}}
let totalCards = 0;

const cardList = document.getElementById("cardList");
const deckList = document.getElementById("deckList");
const deckCount = document.getElementById("deckCount");
const deckMessage = document.getElementById("deckMessage");

const soloBtn = document.getElementById("soloBtn");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");

// ===== レーダーUI（HTMLに置く要素） =====
const radarCanvas = document.getElementById("deckRadar");
const radarText = document.getElementById("deckRadarText");

// ===============================
// デッキ評価（レーダー）
// ===============================
const AXES = ["攻撃力", "耐久性", "安定性", "展開力", "扱いやすさ", "制圧力"];

const TYPE_BASE = {
  "火": { 攻撃力: 8, 耐久性: 3, 安定性: 4, 展開力: 5, 扱いやすさ: 7, 制圧力: 7 },
  "水": { 攻撃力: 4, 耐久性: 8, 安定性: 7, 展開力: 6, 扱いやすさ: 7, 制圧力: 4 },
  "草": { 攻撃力: 4, 耐久性: 7, 安定性: 8, 展開力: 5, 扱いやすさ: 6, 制圧力: 4 },
  "闇": { 攻撃力: 5, 耐久性: 4, 安定性: 4, 展開力: 7, 扱いやすさ: 4, 制圧力: 8 },
  "風": { 攻撃力: 4, 耐久性: 4, 安定性: 6, 展開力: 9, 扱いやすさ: 9, 制圧力: 4 },
  "雷": { 攻撃力: 6, 耐久性: 5, 安定性: 7, 展開力: 9, 扱いやすさ: 6, 制圧力: 5 },
  "光": { 攻撃力: 6, 耐久性: 6, 安定性: 7, 展開力: 6, 扱いやすさ: 4, 制圧力: 3 },
  "鋼": { 攻撃力: 2, 耐久性: 9, 安定性: 6, 展開力: 3, 扱いやすさ: 7, 制圧力: 3 },
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function evaluateDeck(deckObj) {
  const sum = Object.fromEntries(AXES.map(a => [a, 0]));
  let n = 0;

  let highCost = 0; // cost>=5
  let totalCost = 0;
  let totalHp = 0;
  let totalSp = 0;

  const typeCount = {};

  for (const id in deckObj) {
    const c = deckObj[id];
    const cnt = Number(c.count || 0);
    if (!cnt) continue;

    const type = c.type || "不明";
    typeCount[type] = (typeCount[type] || 0) + cnt;

    const cost = Number(c.cost || 0);
    const hp = Number(c.hp || 0);
    const sp = Number(c.sp || 0);

    for (let i = 0; i < cnt; i++) {
      n++;
      totalCost += cost;
      totalHp += hp;
      totalSp += sp;
      if (cost >= 5) highCost++;

      const base = TYPE_BASE[type];
      if (base) {
        for (const k of AXES) sum[k] += base[k];
      } else {
        for (const k of AXES) sum[k] += 5;
      }
    }
  }

  if (n === 0) {
    return {
      score: Object.fromEntries(AXES.map(a => [a, 0])),
      meta: { n: 0, avgCost: 0, highRate: 0, typeKinds: 0, typeCount: {} }
    };
  }

  const avg = {};
  for (const k of AXES) avg[k] = sum[k] / n;

  const highRate = highCost / n;
  const avgCost = totalCost / n;
  const typeKinds = Object.keys(typeCount).filter(t => t !== "不明").length;

  // ---- 補正（あなたの方針）----
  // 安定性：高マナ(5以上)が多いと下がる
  avg["安定性"] -= highRate * 6;

  // 展開力：平均コストが低いほど上がる
  avg["展開力"] += clamp((4 - avgCost) * 0.8, -1.5, 2.5);

  // 耐久性：SP比率で少し補正（SP多いほど粘る）
  const spRate = totalSp / (totalHp + 1);
  avg["耐久性"] += clamp((spRate - 0.35) * 6, -1.5, 1.5);

  // 制圧力：平均コスト高めなら少し上げ（重い制圧想定）
  avg["制圧力"] += clamp((avgCost - 4) * 0.6, -1, 2);

  // 扱いやすさ：属性種類が増えると下がる（多色事故のノリ）
  avg["扱いやすさ"] -= clamp((typeKinds - 3) * 0.9, 0, 3);

  // 安定性：2〜4属性は対応力として少し上げる
  avg["安定性"] += clamp((Math.min(typeKinds, 4) - 1) * 0.6, 0, 1.8);

  const score = {};
  for (const k of AXES) score[k] = clamp(avg[k], 0, 10);

  return { score, meta: { n, avgCost, highRate, typeKinds, typeCount } };
}

function drawRadar(canvas, scores) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 6;
  const r = Math.min(w, h) * 0.34;
  const levels = 5;

  // grid
  for (let lv = 1; lv <= levels; lv++) {
    const rr = r * (lv / levels);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI / 2 + i * (Math.PI * 2 / 6);
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // axes + labels
  AXES.forEach((name, i) => {
    const ang = -Math.PI / 2 + i * (Math.PI * 2 / 6);
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.font = "12px sans-serif";
    const tx = cx + Math.cos(ang) * (r + 18);
    const ty = cy + Math.sin(ang) * (r + 18);
    ctx.fillText(name, tx - 24, ty + 4);
  });

  // polygon
  ctx.beginPath();
  AXES.forEach((name, i) => {
    const v = (scores[name] ?? 0) / 10;
    const ang = -Math.PI / 2 + i * (Math.PI * 2 / 6);
    const x = cx + Math.cos(ang) * r * v;
    const y = cy + Math.sin(ang) * r * v;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();

  ctx.fillStyle = "rgba(0,255,120,0.18)";
  ctx.strokeStyle = "rgba(0,255,120,0.72)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function updateDeckRadar() {
  if (!radarCanvas) return;

  const { score, meta } = evaluateDeck(deck);
  drawRadar(radarCanvas, score);

  if (radarText) {
    const types = Object.entries(meta.typeCount)
      .filter(([k]) => k !== "不明")
      .map(([k, v]) => `${k}:${v}`)
      .join(" / ");

    radarText.textContent =
      `枚数:${meta.n} 平均コスト:${meta.avgCost.toFixed(2)} 高コスト比率(>=5):${(meta.highRate * 100).toFixed(0)}% / 属性:${meta.typeKinds}種 (${types || "-"})`;
  }
}

// ===== モーダル共通 =====
function setupModal(modalId, closeBtnId) {
  const modal = document.getElementById(modalId);
  const closeBtn = document.getElementById(closeBtnId);

  const close = () => { if (modal) modal.style.display = "none"; };
  const open = () => { if (modal) modal.style.display = "block"; };

  if (closeBtn) closeBtn.onclick = close;
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  }
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  return { modal, open, close };
}

// ===== ルールモーダル =====
const rules = setupModal("rulesModal", "closeRules");
const rulesBtn = document.getElementById("rulesBtn");
const rulesContent = document.getElementById("rulesContent");

if (rulesBtn) {
  rulesBtn.onclick = () => {
    if (rulesContent) rulesContent.innerHTML = RULES_HTML;
    rules.open();
  };
}

// ===== カード詳細モーダル =====
const cardModal = setupModal("cardModal", "closeCard");
const cardContent = document.getElementById("cardContent");

// ★ 行動表示： 【cost】技名 / 射程 / 成功 / 効果（HP/SP/ドロー）
function actionLine(a) {
  const parts = [];
  if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
  if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
  if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
  const effect = parts.length ? parts.join(" / ") : "効果";

  return `【${a.cost}】${a.name} / 射程:${a.range} / 成功:${a.rate}% / 効果:${effect}`;
}

function showCardDetail(cardId, data) {
  if (!cardContent) return;

  const acts = Array.isArray(data.actions) ? data.actions : [];
  let html = `
    <div class="cardDetailHead">
      <div><b>${data.name ?? "?"}</b> <span class="small">(${cardId})</span></div>
      <div class="small">属性:${data.type ?? "?"} / コスト:${data.cost ?? "?"}</div>
      <div class="small">HP:${data.hp ?? "?"} SP:${data.sp ?? "?"}</div>
    </div>
    <h3 class="modalH3">行動</h3>
  `;

  if (!acts.length) {
    html += `<div class="small">行動なし（actions が空）</div>`;
  } else {
    html += `<ul class="actionList">`;
    for (const a of acts) {
      html += `<li class="small actionItem">${actionLine(a)}</li>`;
    }
    html += `</ul>`;
  }

  cardContent.innerHTML = html;
  cardModal.open();
}

// ===== デッキ保存 =====
function saveDeckToLocalStorage() {
  const simple = {};
  for (const id in deck) simple[id] = deck[id].count;

  // join.js / battle側で使う想定
  localStorage.setItem("deck_simple", JSON.stringify(simple));
  localStorage.setItem("deck_detail", JSON.stringify(deck));
}

// ===== 判定 =====
function validateDeck() {
  if (totalCards !== 20) return { ok: false, msg: "20枚ちょうどになるように調整してね（同名最大4枚）" };
  for (const id in deck) {
    if (deck[id].count > 4) return { ok: false, msg: "同名カードは最大4枚まで！" };
  }
  return { ok: true, msg: "" };
}

function updateButtons() {
  const v = validateDeck();
  if (soloBtn) soloBtn.disabled = !v.ok;
  if (createBtn) createBtn.disabled = !v.ok;
  if (joinBtn) joinBtn.disabled = !v.ok;
  if (deckMessage) deckMessage.textContent = v.msg;
}

// ===== デッキ表示 =====
function updateDeckView() {
  if (!deckList || !deckCount) return;

  deckList.innerHTML = "";
  for (const id in deck) {
    const c = deck[id];
    const item = document.createElement("div");
    item.className = "deckItem";
    item.textContent = `${c.name} [${c.type}] HP:${c.hp} SP:${c.sp} COST:${c.cost} x${c.count}`;
    deckList.appendChild(item);
  }

  deckCount.textContent = totalCards;
  updateButtons();
  saveDeckToLocalStorage();

  // ★ レーダー更新
  updateDeckRadar();
}

// ===== 追加/削除 =====
function addToDeck(cardId, data) {
  if (totalCards >= 20) return;

  if (!deck[cardId]) {
    deck[cardId] = {
      name: data.name,
      type: data.type,
      cost: data.cost,
      hp: data.hp,
      sp: data.sp,
      count: 0
    };
  }

  if (deck[cardId].count >= 4) return; // 同名4枚まで

  deck[cardId].count++;
  totalCards++;
  updateDeckView();
}

function removeFromDeck(cardId) {
  if (!deck[cardId]) return;

  deck[cardId].count--;
  totalCards--;

  if (deck[cardId].count <= 0) delete deck[cardId];
  updateDeckView();
}

// ===== カード一覧表示（詳細ボタンつき） =====
const snap = await getDocs(collection(db, "cards"));
snap.forEach(docSnap => {
  const data = docSnap.data();
  const cardId = docSnap.id;

  const cardDiv = document.createElement("div");
  cardDiv.className = "cardRowBox";

  const info = document.createElement("div");
  info.className = "cardInfoLine";
  info.textContent = `${data.name} [${data.type}] HP:${data.hp} SP:${data.sp} COST:${data.cost}`;

  const controls = document.createElement("div");
  controls.className = "cardControls";

  const minusBtn = document.createElement("button");
  minusBtn.textContent = "−";

  const countSpan = document.createElement("span");
  countSpan.textContent = "0";
  countSpan.className = "countBadge";

  const plusBtn = document.createElement("button");
  plusBtn.textContent = "＋";

  const detailBtn = document.createElement("button");
  detailBtn.textContent = "詳細";

  function refreshCount() {
    countSpan.textContent = deck[cardId]?.count || 0;
  }

  minusBtn.onclick = () => { removeFromDeck(cardId); refreshCount(); };
  plusBtn.onclick = () => { addToDeck(cardId, data); refreshCount(); };
  detailBtn.onclick = () => showCardDetail(cardId, data);

  controls.appendChild(minusBtn);
  controls.appendChild(countSpan);
  controls.appendChild(plusBtn);
  controls.appendChild(detailBtn);

  cardDiv.appendChild(info);
  cardDiv.appendChild(controls);

  if (cardList) cardList.appendChild(cardDiv);
});

updateDeckView();

// ===== 1人プレイ =====
if (soloBtn) {
  soloBtn.onclick = () => {
    const roomId = "S" + Math.floor(1000 + Math.random() * 9000).toString();
    const playerId = crypto.randomUUID();
    localStorage.setItem("solo_roomId", roomId);
    localStorage.setItem("solo_playerId", playerId);
    location.href = `game.html?room=${roomId}&player=${playerId}&solo=1`;
  };
}

// ===== 2人プレイ =====
if (createBtn) createBtn.onclick = () => location.href = "join.html?mode=create";
if (joinBtn) joinBtn.onclick = () => location.href = "join.html?mode=join";