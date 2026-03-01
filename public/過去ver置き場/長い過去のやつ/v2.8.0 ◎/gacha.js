

// public/gacha.js
// v20260213_gacha_v1_dark_reveal
//
// Firestore前提：
// - cards (全カード定義) : { name, type, cost, rarity? }  ※ rarityが無い場合は "R" 扱い
// - users/{playerId} : { gems:number, pity:number, updatedAt }
// - users/{playerId}/owned/{cardId} : { count:number, firstAt, lastAt }
//
// URL: gacha.html?player=xxxx

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  increment,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =====================
// Firebase config（game.jsと揃える）
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com")
    ? "tcg-0bato"
    : "tcg-0bato",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// DOM
// =====================
const $ = (id) => document.getElementById(id);

const gemsEl = $("gems");
const pityEl = $("pity");
const btnBack = $("btnBack");

const btnSingle = $("btnSingle");
const btnTen = $("btnTen");
const btnAddGems = $("btnAddGems");
const btnClear = $("btnClear");

const cost1El = $("cost1");
const cost10El = $("cost10");
const miniInfo = $("miniInfo");

const bannerNote = $("bannerNote");
const bannerStamp = $("bannerStamp");
const rateBox = $("rateBox");

const playerTag = $("playerTag");
const statusTag = $("statusTag");
const resultGrid = $("resultGrid");
const toast = $("toast");

// overlay
const overlay = $("overlay");
const revealHeadline = $("revealHeadline");
const revealBig = $("revealBig");
const revealSub = $("revealSub");
const revealGrid = $("revealGrid");
const btnRevealClose = $("btnRevealClose");
const btnRevealSkip = $("btnRevealSkip");

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
const playerId = params.get("player");

if (!playerId) {
  alert("URLに player がありません: gacha.html?player=XXXX");
  throw new Error("missing player");
}
playerTag.textContent = `player:${playerId}`;

// 戻る（とりあえず index.html へ。必要なら battle/menu に変更してOK）
btnBack?.addEventListener("click", () => {
  location.href = "./index.html";
});

// =====================
// 設定（確率 / コスト / 天井）
// =====================
const COST_SINGLE = 120;
const COST_TEN = 1200;

// 例：SSR 3%, SR 12%, R 85%
const RATE_BY_RARITY = {
  SSR: 3,
  SR: 12,
  R: 85,
};

// 10連で最低1枚SR以上保証
const TEN_GUARANTEE_SR = true;

// “大当たり”扱い演出
const JACKPOT_RARITY = "SSR";

// pity（天井）例：SSRが出るまでカウント。90到達でSSR確定
const PITY_MAX = 90; // 0..89 は通常抽選、90到達でSSR確定
const PITY_ENABLED = true;

// =====================
// Firestore refs
// =====================
const userRef = doc(db, "users", playerId);
const ownedCol = collection(db, "users", playerId, "owned");

// =====================
// Local cache
// =====================
let allCards = []; // [{id, ...data}]
let cardsByRarity = { SSR: [], SR: [], R: [] };

let liveUser = { gems: 0, pity: 0 };
let liveOwned = new Map(); // cardId -> count

// 表示中の結果
let lastResults = []; // [{cardId, rarity, isNew, name}]

let busy = false;

// =====================
// Helpers
// =====================
function clampInt(n, min, max) {
  n = Math.trunc(Number(n ?? 0));
  if (!Number.isFinite(n)) n = 0;
  return Math.max(min, Math.min(max, n));
}

function rarityOf(cardData) {
  const r = String(cardData?.rarity ?? "R").toUpperCase().trim();
  if (r === "SSR" || r === "SR" || r === "R") return r;
  return "R";
}

function prettyRatesText() {
  const ssr = RATE_BY_RARITY.SSR ?? 0;
  const sr = RATE_BY_RARITY.SR ?? 0;
  const r = RATE_BY_RARITY.R ?? 0;
  const sum = ssr + sr + r;
  return `排出率（合計${sum}%）\nSSR:${ssr}% / SR:${sr}% / R:${r}%\n10連SR以上保証:${TEN_GUARANTEE_SR ? "ON" : "OFF"}\n天井:${PITY_ENABLED ? `${PITY_MAX}（SSR確定）` : "OFF"}`;
}

function setStatus(msg, kind = "normal") {
  statusTag.textContent = `状態: ${msg}`;
  statusTag.className =
    "tag" + (kind === "good" ? " good" : kind === "bad" ? " bad" : "");
}

function toastMsg(msg, isErr = false) {
  if (!toast) return;
  toast.innerHTML = isErr
    ? `<span class="err">${escapeHtml(msg)}</span>`
    : escapeHtml(msg);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRateBox() {
  if (!rateBox) return;
  rateBox.innerHTML = "";
  const mk = (cls, label, v) => {
    const el = document.createElement("div");
    el.className = `rate ${cls}`;
    el.innerHTML = `${label} <b>${v}%</b>`;
    return el;
  };
  rateBox.appendChild(mk("ssr", "SSR", RATE_BY_RARITY.SSR ?? 0));
  rateBox.appendChild(mk("sr", "SR", RATE_BY_RARITY.SR ?? 0));
  rateBox.appendChild(mk("r", "R", RATE_BY_RARITY.R ?? 0));
}

function renderUserBar() {
  if (gemsEl) gemsEl.textContent = String(clampInt(liveUser.gems, 0, 999999));
  if (pityEl) pityEl.textContent = String(clampInt(liveUser.pity, 0, 999999));
  if (cost1El) cost1El.textContent = String(COST_SINGLE);
  if (cost10El) cost10El.textContent = String(COST_TEN);

  const can1 = liveUser.gems >= COST_SINGLE;
  const can10 = liveUser.gems >= COST_TEN;

  if (btnSingle) btnSingle.disabled = busy || !can1 || allCards.length === 0;
  if (btnTen) btnTen.disabled = busy || !can10 || allCards.length === 0;

  if (miniInfo) miniInfo.textContent = prettyRatesText();
}

function renderResultsGrid(results) {
  if (!resultGrid) return;
  resultGrid.innerHTML = "";
  if (!results || !results.length) return;

  for (const it of results) {
    const card = document.createElement("div");
    const rar = it.rarity;
    card.className = `card ${rar.toLowerCase()}`;

    const rarEl = document.createElement("div");
    rarEl.className = "rar";
    rarEl.textContent = rar;
    card.appendChild(rarEl);

    if (it.isNew) {
      const nw = document.createElement("div");
      nw.className = "new";
      nw.textContent = "NEW!";
      card.appendChild(nw);
    }

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = it.name || it.cardId;
    card.appendChild(name);

    const id = document.createElement("div");
    id.className = "id";
    id.textContent = it.cardId;
    card.appendChild(id);

    resultGrid.appendChild(card);
  }
}

function openRevealOverlay(results) {
  if (!overlay) return;

  const hasSSR = results.some((r) => r.rarity === "SSR");
  const hasSR = results.some((r) => r.rarity === "SR");

  overlay.classList.add("on");

  let tier = "r";
  if (hasSSR) tier = "ssr";
  else if (hasSR) tier = "sr";

  if (revealHeadline) revealHeadline.className = `headline ${tier}`;
  if (revealBig) revealBig.className = `bigmsg ${tier}`;

  if (hasSSR) {
    if (revealHeadline) revealHeadline.textContent = "DARK REVEAL";
    if (revealBig) revealBig.textContent = "大当たり！！";
    if (revealSub)
      revealSub.textContent = "SSR排出！\n（暗転→スポットライト演出）";
  } else if (hasSR) {
    if (revealHeadline) revealHeadline.textContent = "REVEAL";
    if (revealBig) revealBig.textContent = "当たり！";
    if (revealSub) revealSub.textContent = "SR以上を獲得！";
  } else {
    if (revealHeadline) revealHeadline.textContent = "REVEAL";
    if (revealBig) revealBig.textContent = "結果";
    if (revealSub) revealSub.textContent = "次で引き寄せろ。";
  }

  if (revealGrid) {
    revealGrid.innerHTML = "";
    for (const it of results) {
      const c = document.createElement("div");
      c.className = `card ${it.rarity.toLowerCase()}`;
      c.style.minHeight = "95px";

      const rarEl = document.createElement("div");
      rarEl.className = "rar";
      rarEl.textContent = it.rarity;
      c.appendChild(rarEl);

      if (it.isNew) {
        const nw = document.createElement("div");
        nw.className = "new";
        nw.textContent = "NEW!";
        c.appendChild(nw);
      }

      const nm = document.createElement("div");
      nm.className = "name";
      nm.textContent = it.name || it.cardId;
      c.appendChild(nm);

      const id = document.createElement("div");
      id.className = "id";
      id.textContent = it.cardId;
      c.appendChild(id);

      revealGrid.appendChild(c);
    }
  }

  if (hasSSR) {
    const box = overlay.querySelector(".reveal");
    box?.animate(
      [
        { transform: "translateY(0px) scale(1)", filter: "brightness(1)" },
        {
          transform: "translateY(-2px) scale(1.01)",
          filter: "brightness(1.12)",
        },
        { transform: "translateY(0px) scale(1)", filter: "brightness(1)" },
      ],
      { duration: 520, iterations: 1, easing: "cubic-bezier(.2,.9,.2,1)" },
    );
  }
}

function closeRevealOverlay() {
  overlay?.classList.remove("on");
}

btnRevealClose?.addEventListener("click", closeRevealOverlay);
btnRevealSkip?.addEventListener("click", closeRevealOverlay);
overlay?.addEventListener("click", (e) => {
  if (e.target === overlay) closeRevealOverlay();
});

// =====================
// 抽選
// =====================
function pickRarityWeighted(onlyAtLeastSR = false) {
  const ssr = clampInt(RATE_BY_RARITY.SSR ?? 0, 0, 100);
  const sr = clampInt(RATE_BY_RARITY.SR ?? 0, 0, 100);
  const r = clampInt(RATE_BY_RARITY.R ?? 0, 0, 100);

  let table = [];
  if (onlyAtLeastSR) table = [{ k: "SSR", w: ssr }, { k: "SR", w: sr }];
  else table = [{ k: "SSR", w: ssr }, { k: "SR", w: sr }, { k: "R", w: r }];

  table = table.filter((x) => x.w > 0);
  const sum = table.reduce((a, b) => a + b.w, 0);
  if (sum <= 0) return onlyAtLeastSR ? "SR" : "R";

  const roll = Math.random() * sum;
  let acc = 0;
  for (const row of table) {
    acc += row.w;
    if (roll < acc) return row.k;
  }
  return table[table.length - 1].k;
}

function pickCardIdByRarity(rar) {
  const pool = cardsByRarity[rar] || [];
  if (!pool.length) {
    if (rar === "SSR") return pickCardIdByRarity("SR");
    if (rar === "SR") return pickCardIdByRarity("R");
    const any = allCards;
    const c = any[Math.floor(Math.random() * any.length)];
    return c?.id ?? null;
  }
  const c = pool[Math.floor(Math.random() * pool.length)];
  return c?.id ?? null;
}

function buildResultItem(cardId, ownedMapForJudge) {
  const data = allCards.find((c) => c.id === cardId) || null;
  const rar = rarityOf(data);
  const name = data?.name ?? cardId;
  const ownedCount = Number(ownedMapForJudge.get(cardId) ?? 0);
  const isNew = !(ownedCount > 0);
  return { cardId, rarity: rar, name, isNew };
}

// =====================
// データ読み込み
// =====================
async function loadAllCards() {
  const snap = await getDocs(collection(db, "cards"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

  allCards = list;
  cardsByRarity = { SSR: [], SR: [], R: [] };
  for (const c of allCards) {
    const r = rarityOf(c);
    cardsByRarity[r].push(c);
  }

  if (bannerNote) {
    bannerNote.textContent =
      `カード図鑑: ${allCards.length}枚\n` +
      `SSR:${cardsByRarity.SSR.length} / SR:${cardsByRarity.SR.length} / R:${cardsByRarity.R.length}\n` +
      `未所持も出る：出た瞬間にコレクションに追加`;
  }

  if (bannerStamp) bannerStamp.textContent = PITY_ENABLED ? `天井 ${PITY_MAX}` : "NO PITY";

  renderRateBox();
}

function watchUser() {
  onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) {
      await setDoc(
        userRef,
        { gems: 0, pity: 0, createdAt: serverTimestamp() },
        { merge: true },
      );
      return;
    }
    const d = snap.data() || {};
    liveUser.gems = clampInt(d.gems ?? 0, 0, 999999);
    liveUser.pity = clampInt(d.pity ?? 0, 0, 999999);
    renderUserBar();
  });
}

function watchOwned() {
  // ownedは増えると重いので、本来は「図鑑の取得済みID一覧」等にするのが良い。
  // とりあえず今は onSnapshot でカウントだけ持つ。
  onSnapshot(ownedCol, (snap) => {
    const m = new Map();
    snap.forEach((d) => {
      const v = d.data() || {};
      const c = clampInt(v.count ?? 0, 0, 999999);
      if (c > 0) m.set(d.id, c);
    });
    liveOwned = m;
  });
}

// =====================
// ガチャ本体
// =====================
function computeOnePull({ pity, guaranteeAtLeastSR = false }) {
  // 天井判定
  if (PITY_ENABLED && pity >= PITY_MAX - 1) {
    return { rarity: "SSR", from: "pity" };
  }

  const rar = pickRarityWeighted(guaranteeAtLeastSR);
  return { rarity: rar, from: guaranteeAtLeastSR ? "guarantee" : "rate" };
}

function buildPullPlan(n, pityStart) {
  const plan = [];
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const guarantee = n >= 10 && TEN_GUARANTEE_SR && isLast;
    const pick = computeOnePull({ pity: pityStart + i, guaranteeAtLeastSR: guarantee });
    plan.push({ ...pick });
  }
  return plan;
}

function applyPityAfterResults(pityStart, results) {
  if (!PITY_ENABLED) return 0;
  const gotSSR = results.some((r) => r.rarity === "SSR");
  if (gotSSR) return 0;
  // SSRが出なければ「引いた回数」だけ進める
  return pityStart + results.length;
}

async function doGacha(n) {
  if (busy) return;
  if (!allCards.length) {
    toastMsg("cards が空です（Firestore cards を用意してね）", true);
    return;
  }

  const cost = n === 10 ? COST_TEN : COST_SINGLE;
  if (liveUser.gems < cost) {
    toastMsg("ジェムが足りません", true);
    return;
  }

  busy = true;
  setStatus("抽選中...", "normal");
  renderUserBar();

  try {
    // 直前の所持状況を“NEW判定”に使う
    const ownedBefore = new Map(liveOwned);

    const outResults = await runTransaction(db, async (tx) => {
      // user
      const us = await tx.get(userRef);
      if (!us.exists()) {
        tx.set(userRef, { gems: 0, pity: 0, createdAt: serverTimestamp() }, { merge: true });
      }
      const u = (us.exists() ? us.data() : {}) || {};
      const gems = clampInt(u.gems ?? 0, 0, 999999);
      const pity0 = clampInt(u.pity ?? 0, 0, 999999);

      if (gems < cost) throw new Error("ジェム不足");

      // 抽選（クライアント乱数）
      const plan = buildPullPlan(n, pity0);
      const picks = [];
      for (const p of plan) {
        const cardId = pickCardIdByRarity(p.rarity);
        if (!cardId) throw new Error("カード抽選に失敗（プールが空？）");
        picks.push({ cardId, rarity: p.rarity, from: p.from });
      }

      // 所持数の参照（NEW判定はクライアント側でOK。tx内は加算だけ確実に。）
      const now = serverTimestamp();
      for (const it of picks) {
        const r = doc(db, "users", playerId, "owned", it.cardId);
        const os = await tx.get(r);
        if (!os.exists()) {
          tx.set(r, { count: 1, firstAt: now, lastAt: now }, { merge: true });
        } else {
          tx.set(r, { count: increment(1), lastAt: now }, { merge: true });
        }
      }

      // pity更新（SSR出たら0、出なければ進む）
      const nextPity = applyPityAfterResults(pity0, picks);

      // user更新
      tx.set(
        userRef,
        {
          gems: gems - cost,
          pity: nextPity,
          updatedAt: now,
        },
        { merge: true },
      );

      return { picks, pity0, nextPity, gems0: gems, gems1: gems - cost };
    });

    const picks = outResults?.picks || [];

    // NEW判定（トランザクション外：直前所持で判定）
    const results = picks.map((p) => buildResultItem(p.cardId, ownedBefore));

    lastResults = results;
    renderResultsGrid(results);
    openRevealOverlay(results);

    const hasJackpot = results.some((r) => r.rarity === JACKPOT_RARITY);
    setStatus(
      hasJackpot ? "大当たり！" : "完了",
      hasJackpot ? "good" : "normal",
    );

    toastMsg(
      `-${cost} gems / pity: ${outResults?.pity0 ?? "?"} → ${outResults?.nextPity ?? "?"}`,
      false,
    );
  } catch (e) {
    console.error(e);
    setStatus("失敗", "bad");
    toastMsg(String(e?.message ?? e), true);
  } finally {
    busy = false;
    renderUserBar();
  }
}

// =====================
// Buttons
// =====================
btnSingle?.addEventListener("click", () => doGacha(1));
btnTen?.addEventListener("click", () => doGacha(10));

btnAddGems?.addEventListener("click", async () => {
  try {
    // テスト用：+2000 gems
    await runTransaction(db, async (tx) => {
      const us = await tx.get(userRef);
      if (!us.exists()) {
        tx.set(userRef, { gems: 0, pity: 0, createdAt: serverTimestamp() }, { merge: true });
      }
      tx.set(
        userRef,
        {
          gems: increment(2000),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    toastMsg("+2000 gems（テスト）");
  } catch (e) {
    toastMsg(String(e?.message ?? e), true);
  }
});

btnClear?.addEventListener("click", async () => {
  // 注意：owned の全削除は権限が必要なので、ここでは “pityだけリセット” にする
  try {
    await setDoc(
      userRef,
      { pity: 0, updatedAt: serverTimestamp() },
      { merge: true },
    );
    toastMsg("pity を 0 にリセット");
  } catch (e) {
    toastMsg(String(e?.message ?? e), true);
  }
});

// =====================
// init
// =====================
(async function init() {
  try {
    setStatus("読み込み中...", "normal");
    await loadAllCards();
    watchUser();
    watchOwned();
    renderUserBar();
    setStatus("準備OK", "good");
  } catch (e) {
    console.error(e);
    setStatus("初期化失敗", "bad");
    toastMsg(String(e?.message ?? e), true);
  }
})();