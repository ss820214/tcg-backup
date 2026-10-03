"use strict";

/**
 * 0バト デッキティア表
 * v20260508_3_shared
 *
 * 変更内容:
 * - 保存先を localStorage から Firestore に変更
 * - 全員が同じ tierBoards/main を見る
 * - 参考写真を Firebase Storage に保存
 * - Firestore onSnapshot でほぼリアルタイム同期
 * - 既存 localStorage データがあれば初回だけ移行
 *
 * 重要:
 * tier.html 側は <script type="module" src="./tier.js?v=20260508_3"></script> に変更すること。
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/**
 * ここだけ自分のFirebase設定に差し替え。
 * Firebase Console → プロジェクトの設定 → 全般 → マイアプリ → SDK設定と構成 → Config
 */
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
  storageBucket: "tcg-0bato.firebasestorage.app",
  messagingSenderId: "440001841840",
  appId: "1:440001841840:web:d77a9bdb80f3d8d8c10975",
  measurementId: "G-2BS37RDG7F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const BOARD_DOC_REF = doc(db, "tierBoards", "main");
const OLD_STORAGE_KEY_V2 = "zero_bato_deck_tier_v2";
const OLD_STORAGE_KEY_V1 = "zero_bato_deck_tier_v1";

const DEFAULT_DECKS = [
  "火アグロ",
  "水耐久",
  "雷テンポ",
  "風侵入",
  "鋼要塞",
  "光エース",
  "闇ピンチ逆転",
  "幻トリック",
  "無グッドスタッフ",
  "狂ハイリスク"
];

const ATTRIBUTES = [
  { key: "火", color: "#ff5a6d" },
  { key: "水", color: "#49b8ff" },
  { key: "雷", color: "#ffe45e" },
  { key: "風", color: "#55f0b0" },
  { key: "鋼", color: "#b7c4d8" },
  { key: "光", color: "#fff2a8" },
  { key: "闇", color: "#9b62ff" },
  { key: "幻", color: "#ff73df" },
  { key: "無", color: "#d8d8d8" },
  { key: "狂", color: "#ff2d2d" }
];

const ATTR_LABELS = {
  0: "なし",
  1: "少し",
  2: "多め",
  3: "主軸"
};

const RADAR_AXES = [
  "攻撃力",
  "耐久性",
  "安定性",
  "展開力",
  "扱いやすさ",
  "制圧力"
];

const ATTR_PROFILE = {
  火: { atk: 95, dur: 40, stab: 55, exp: 70, use: 80, ctl: 60 },
  水: { atk: 40, dur: 95, stab: 85, exp: 55, use: 75, ctl: 50 },
  雷: { atk: 75, dur: 55, stab: 65, exp: 95, use: 65, ctl: 65 },
  風: { atk: 55, dur: 50, stab: 70, exp: 100, use: 90, ctl: 55 },
  鋼: { atk: 35, dur: 100, stab: 85, exp: 35, use: 80, ctl: 70 },
  光: { atk: 65, dur: 80, stab: 95, exp: 60, use: 60, ctl: 55 },
  闇: { atk: 90, dur: 55, stab: 45, exp: 75, use: 40, ctl: 95 },
  幻: { atk: 60, dur: 45, stab: 55, exp: 85, use: 35, ctl: 100 },
  無: { atk: 65, dur: 65, stab: 90, exp: 65, use: 100, ctl: 45 },
  狂: { atk: 100, dur: 35, stab: 25, exp: 90, use: 25, ctl: 90 }
};

const state = {
  decks: [],
  selectedDeckId: null,
  draggingDeckId: null,
  toastTimer: null,
  unsubscribe: null,
  isSaving: false,
  lastSaveTimer: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const addDeckBtn = $("#addDeckBtn");
const resetBtn = $("#resetBtn");
const deckPool = $("#deckPool");

const drawer = $("#drawer");
const closeDrawerBtn = $("#closeDrawerBtn");
const drawerTitle = $("#drawerTitle");
const deckNameInput = $("#deckNameInput");
const deckMemoInput = $("#deckMemoInput");

const attributeControls = $("#attributeControls");
const radarCanvas = $("#deckRadarCanvas");
const radarNote = $("#radarNote");

const imageDropArea = $("#imageDropArea");
const imageFileInput = $("#imageFileInput");
const imagePreviewWrap = $("#imagePreviewWrap");
const imagePreview = $("#imagePreview");
const deleteImageBtn = $("#deleteImageBtn");

const saveDeckBtn = $("#saveDeckBtn");
const deleteDeckBtn = $("#deleteDeckBtn");
const toast = $("#toast");

function createId() {
  return `deck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

function createEmptyAttrs() {
  const attrs = {};
  ATTRIBUTES.forEach((attr) => {
    attrs[attr.key] = 0;
  });
  return attrs;
}

function normalizeAttrs(attrs) {
  const base = createEmptyAttrs();

  if (!attrs || typeof attrs !== "object") {
    return base;
  }

  ATTRIBUTES.forEach((attr) => {
    const value = Number(attrs[attr.key] ?? 0);
    base[attr.key] = clamp(value, 0, 3);
  });

  return base;
}

function guessAttrsFromName(name) {
  const attrs = createEmptyAttrs();

  ATTRIBUTES.forEach((attr) => {
    if (String(name).includes(attr.key)) {
      attrs[attr.key] = 3;
    }
  });

  return attrs;
}

function createDeck(name) {
  return {
    id: createId(),
    name,
    tier: "pool",
    memo: "",
    image: "",
    imagePath: "",
    attrs: guessAttrsFromName(name)
  };
}

function createDefaultState() {
  return DEFAULT_DECKS.map((name) => createDeck(name));
}

function normalizeDeck(deck) {
  const name = String(deck?.name || "名前なしデッキ");
  const image = typeof deck?.image === "string" ? deck.image : "";

  // localStorage時代のbase64画像はFirestoreに入れると容量超過しやすいので共有移行時は捨てる。
  // 共有画像はStorageに再アップロードしてURL保存する。
  const isDataUrl = image.startsWith("data:");

  return {
    id: deck?.id || createId(),
    name,
    tier: deck?.tier || "pool",
    memo: deck?.memo || "",
    image: isDataUrl ? "" : image,
    imagePath: deck?.imagePath || "",
    attrs: normalizeAttrs(deck?.attrs || guessAttrsFromName(name))
  };
}

function getDeckById(id) {
  return state.decks.find((deck) => deck.id === id) || null;
}

function makeBoardPayload() {
  return {
    version: 3,
    decks: state.decks.map(normalizeDeck),
    updatedAt: serverTimestamp()
  };
}

async function ensureBoardExists() {
  const snap = await getDoc(BOARD_DOC_REF);

  if (snap.exists()) {
    const data = snap.data() || {};
    state.decks = Array.isArray(data.decks)
      ? data.decks.map(normalizeDeck)
      : createDefaultState();
    render();
    return;
  }

  state.decks = loadInitialDecksFromLocalStorage();
  await setDoc(BOARD_DOC_REF, makeBoardPayload());
  render();
}

function loadInitialDecksFromLocalStorage() {
  const keys = [OLD_STORAGE_KEY_V2, OLD_STORAGE_KEY_V1];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.decks)) {
        return parsed.decks.map(normalizeDeck);
      }
    } catch (error) {
      console.warn("旧保存データの読み込みに失敗しました", error);
    }
  }

  return createDefaultState();
}

function subscribeBoard() {
  if (state.unsubscribe) {
    state.unsubscribe();
  }

  state.unsubscribe = onSnapshot(
    BOARD_DOC_REF,
    (snap) => {
      if (!snap.exists()) return;

      const data = snap.data() || {};
      state.decks = Array.isArray(data.decks)
        ? data.decks.map(normalizeDeck)
        : createDefaultState();

      render();

      if (state.selectedDeckId) {
        const selected = getDeckById(state.selectedDeckId);
        if (selected) {
          refreshDrawer(selected);
        } else {
          closeDrawer();
        }
      }
    },
    (error) => {
      console.error("Firestore同期エラー", error);
      showToast("同期エラー。ルールかFirebase設定を確認してね");
    }
  );
}

async function saveState(showToastFlag = true) {
  try {
    state.isSaving = true;
    await setDoc(BOARD_DOC_REF, makeBoardPayload(), { merge: true });

    if (showToastFlag) {
      showToast("保存完了！");
    }
  } catch (error) {
    console.error("保存失敗", error);
    showToast("保存失敗。Firebase設定を確認してね");
  } finally {
    state.isSaving = false;
  }
}

function scheduleSave(delay = 350) {
  if (state.lastSaveTimer) {
    clearTimeout(state.lastSaveTimer);
  }

  state.lastSaveTimer = setTimeout(() => {
    saveState(false);
  }, delay);
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }

  state.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1500);
}

function render() {
  const zones = $$(".tier-dropzone");
  zones.forEach((zone) => {
    zone.innerHTML = "";
  });

  deckPool.innerHTML = "";

  state.decks.forEach((deck) => {
    const chip = createDeckChip(deck);

    if (deck.tier === "pool") {
      deckPool.appendChild(chip);
      return;
    }

    const zone = $(`.tier-dropzone[data-tier="${deck.tier}"]`);
    if (zone) {
      zone.appendChild(chip);
    } else {
      deck.tier = "pool";
      deckPool.appendChild(chip);
    }
  });
}

function createDeckChip(deck) {
  const chip = document.createElement("div");
  chip.className = "deck-chip";
  chip.draggable = true;
  chip.dataset.deckId = deck.id;

  if (deck.image) {
    chip.classList.add("has-image");
  }

  applyChipColor(chip, deck);

  const nameEl = document.createElement("span");
  nameEl.className = "chip-name";
  nameEl.textContent = deck.name;
  chip.appendChild(nameEl);

  const attrText = getTopAttributeText(deck);
  if (attrText) {
    const sub = document.createElement("span");
    sub.className = "chip-sub";
    sub.textContent = attrText;
    chip.appendChild(sub);
  }

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-mini";
  deleteBtn.type = "button";
  deleteBtn.textContent = "×";
  deleteBtn.title = "削除";

  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteDeck(deck.id);
  });

  chip.appendChild(deleteBtn);

  chip.addEventListener("click", () => {
    openDrawer(deck.id);
  });

  chip.addEventListener("dragstart", (event) => {
    state.draggingDeckId = deck.id;
    chip.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", deck.id);
  });

  chip.addEventListener("dragend", () => {
    state.draggingDeckId = null;
    chip.classList.remove("dragging");
    clearDragOver();
  });

  return chip;
}

function applyChipColor(chip, deck) {
  const top = getTopAttribute(deck);

  if (!top || top.value <= 0) {
    chip.style.setProperty("--chip-glow", "rgba(255,255,255,0.06)");
    chip.style.setProperty("--chip-border", "rgba(255,255,255,0.16)");
    chip.style.setProperty("--chip-base", "rgba(255,255,255,0.075)");
    return;
  }

  const alpha = 0.1 + top.value * 0.11;
  const softAlpha = 0.05 + top.value * 0.07;
  const rgb = hexToRgb(top.color);

  chip.style.setProperty("--chip-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
  chip.style.setProperty("--chip-border", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.25 + top.value * 0.14})`);
  chip.style.setProperty("--chip-base", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${softAlpha})`);
}

function getTopAttribute(deck) {
  let top = null;

  ATTRIBUTES.forEach((attr) => {
    const value = Number(deck.attrs?.[attr.key] || 0);
    if (!top || value > top.value) {
      top = {
        key: attr.key,
        color: attr.color,
        value
      };
    }
  });

  return top;
}

function getTopAttributeText(deck) {
  const active = ATTRIBUTES
    .map((attr) => ({
      key: attr.key,
      value: Number(deck.attrs?.[attr.key] || 0)
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  if (!active.length) return "";

  return active
    .map((item) => `${item.key}${"★".repeat(item.value)}`)
    .join(" / ");
}

function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  const value = parseInt(clean, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

async function addDeck() {
  const name = window.prompt("追加するデッキテーマ名を入力してね", "新しいデッキテーマ");

  if (!name || !name.trim()) return;

  const deck = createDeck(name.trim());

  state.decks.push(deck);
  await saveState();
  render();
  openDrawer(deck.id);
}

async function deleteDeck(id) {
  const deck = getDeckById(id);
  if (!deck) return;

  const ok = window.confirm(`「${deck.name}」を削除する？`);
  if (!ok) return;

  if (deck.imagePath) {
    deleteStorageObjectQuietly(deck.imagePath);
  }

  state.decks = state.decks.filter((item) => item.id !== id);

  if (state.selectedDeckId === id) {
    closeDrawer();
  }

  await saveState();
  render();
}

async function resetAll() {
  const ok = window.confirm("ティア表とデッキテーマを全部リセットする？\n※Storage内の古い画像ファイルは参照されなくなります。");
  if (!ok) return;

  state.decks = createDefaultState();
  state.selectedDeckId = null;

  await saveState();
  render();
  closeDrawer();
}

function setupDropZones() {
  const dropTargets = [...$$(".tier-dropzone"), deckPool];

  dropTargets.forEach((target) => {
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      target.classList.add("drag-over");
    });

    target.addEventListener("dragleave", () => {
      target.classList.remove("drag-over");
    });

    target.addEventListener("drop", async (event) => {
      event.preventDefault();

      const deckId =
        event.dataTransfer.getData("text/plain") || state.draggingDeckId;

      if (!deckId) return;

      const deck = getDeckById(deckId);
      if (!deck) return;

      deck.tier = target.dataset.tier || "pool";

      clearDragOver();
      await saveState(false);
      render();
    });
  });
}

function clearDragOver() {
  $$(".tier-dropzone").forEach((zone) => zone.classList.remove("drag-over"));
  deckPool.classList.remove("drag-over");
}

function openDrawer(deckId) {
  const deck = getDeckById(deckId);
  if (!deck) return;

  state.selectedDeckId = deckId;
  refreshDrawer(deck);
  drawer.classList.add("active");
}

function refreshDrawer(deck) {
  drawerTitle.textContent = deck.name;

  if (document.activeElement !== deckNameInput) {
    deckNameInput.value = deck.name;
  }

  if (document.activeElement !== deckMemoInput) {
    deckMemoInput.value = deck.memo || "";
  }

  renderAttributeControls(deck);
  renderRadar(deck);
  renderImagePreview(deck.image);
}

function closeDrawer() {
  drawer.classList.remove("active");
  state.selectedDeckId = null;
}

async function saveSelectedDeck() {
  const deck = getDeckById(state.selectedDeckId);
  if (!deck) return;

  const name = deckNameInput.value.trim();

  if (!name) {
    window.alert("テーマ名は空にできません。");
    return;
  }

  deck.name = name;
  deck.memo = deckMemoInput.value.trim();

  await saveState();
  render();
  openDrawer(deck.id);
}

function deleteSelectedDeck() {
  if (!state.selectedDeckId) return;
  deleteDeck(state.selectedDeckId);
}

function renderAttributeControls(deck) {
  attributeControls.innerHTML = "";

  ATTRIBUTES.forEach((attr) => {
    const value = Number(deck.attrs?.[attr.key] || 0);
    const rgb = hexToRgb(attr.color);

    const row = document.createElement("div");
    row.className = "attr-control";
    row.style.setProperty("--attr-color", attr.color);
    row.style.setProperty("--attr-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.06 + value * 0.06})`);

    const name = document.createElement("div");
    name.className = "attr-name";

    const dot = document.createElement("span");
    dot.className = "attr-dot";

    const label = document.createElement("span");
    label.textContent = attr.key;

    name.appendChild(dot);
    name.appendChild(label);

    const range = document.createElement("input");
    range.className = "attr-range";
    range.type = "range";
    range.min = "0";
    range.max = "3";
    range.step = "1";
    range.value = String(value);

    const level = document.createElement("div");
    level.className = "attr-level";
    level.textContent = ATTR_LABELS[value];

    range.addEventListener("input", () => {
      const selectedDeck = getDeckById(state.selectedDeckId);
      if (!selectedDeck) return;

      const nextValue = Number(range.value);
      selectedDeck.attrs[attr.key] = nextValue;

      level.textContent = ATTR_LABELS[nextValue];
      row.style.setProperty("--attr-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.06 + nextValue * 0.06})`);

      renderRadar(selectedDeck);
      render();
      scheduleSave(450);
    });

    range.addEventListener("change", () => {
      saveState();
    });

    row.appendChild(name);
    row.appendChild(range);
    row.appendChild(level);

    attributeControls.appendChild(row);
  });
}

function calculateRadarScores(deck) {
  const totals = {
    atk: 0,
    dur: 0,
    stab: 0,
    exp: 0,
    use: 0,
    ctl: 0
  };

  let weight = 0;
  let activeCount = 0;

  ATTRIBUTES.forEach((attr) => {
    const level = Number(deck.attrs?.[attr.key] || 0);
    if (level <= 0) return;

    const profile = ATTR_PROFILE[attr.key];
    if (!profile) return;

    const w = level;

    weight += w;
    activeCount += 1;

    totals.atk += profile.atk * w;
    totals.dur += profile.dur * w;
    totals.stab += profile.stab * w;
    totals.exp += profile.exp * w;
    totals.use += profile.use * w;
    totals.ctl += profile.ctl * w;
  });

  if (weight <= 0) {
    return {
      scores: [0, 0, 0, 0, 0, 0],
      note: "属性を設定すると、ざっくり評価が表示されます。"
    };
  }

  const rawScores = [
    totals.atk / weight,
    totals.dur / weight,
    totals.stab / weight,
    totals.exp / weight,
    totals.use / weight,
    totals.ctl / weight
  ];

  const deckAverage =
    rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length;

  const CONTRAST_GAIN = 2.3;

  let scores = rawScores.map((score) => {
    const diff = score - deckAverage;
    return 50 + diff * CONTRAST_GAIN;
  });

  if (activeCount >= 4) {
    scores[0] -= 6;
    scores[2] += 6;
    scores[4] += 8;
    scores[5] -= 5;
  }

  const mainAttrBonus = getTopAttribute(deck)?.value || 0;

  if (activeCount <= 1 && mainAttrBonus >= 3) {
    scores[2] -= 10;
    scores[4] -= 12;
  }

  scores = scores.map((score) => {
    let s = score;

    if (s >= 72) {
      s += 6;
    }

    if (s <= 42) {
      s -= 8;
    }

    return clamp(Math.round(s), 5, 100);
  });

  const note = RADAR_AXES
    .map((axis, index) => `${axis}:${scores[index]}`)
    .join(" / ");

  return {
    scores,
    note
  };
}

function renderRadar(deck) {
  if (!radarCanvas) return;

  const result = calculateRadarScores(deck);
  drawRadar(radarCanvas, result.scores);

  if (radarNote) {
    radarNote.textContent = result.note;
  }
}

function drawRadar(canvas, scores) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const cx = width * 0.5;
  const cy = height * 0.54;
  const radius = Math.min(width, height) * 0.34;

  ctx.save();

  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = 1;

  for (let ring = 1; ring <= 5; ring += 1) {
    const r = radius * (ring / 5);
    ctx.beginPath();

    for (let i = 0; i < RADAR_AXES.length; i += 1) {
      const angle = -Math.PI / 2 + i * ((Math.PI * 2) / RADAR_AXES.length);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.stroke();
  }

  for (let i = 0; i < RADAR_AXES.length; i += 1) {
    const angle = -Math.PI / 2 + i * ((Math.PI * 2) / RADAR_AXES.length);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius
    );
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(248,248,255,0.92)";
  ctx.font = "12px system-ui, sans-serif";

  for (let i = 0; i < RADAR_AXES.length; i += 1) {
    const angle = -Math.PI / 2 + i * ((Math.PI * 2) / RADAR_AXES.length);
    const label = RADAR_AXES[i];
    const x = cx + Math.cos(angle) * (radius + 28);
    const y = cy + Math.sin(angle) * (radius + 24);
    const textWidth = ctx.measureText(label).width;

    ctx.fillText(label, x - textWidth / 2, y + 4);
  }

  const values = scores.map((score) => clamp(score, 0, 100) / 100);
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / RADAR_AXES.length);
    return {
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
      value: scores[index],
      index
    };
  });

  ctx.beginPath();

  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });

  ctx.closePath();

  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
  gradient.addColorStop(0, "rgba(77, 232, 255, 0.32)");
  gradient.addColorStop(1, "rgba(255, 85, 218, 0.16)");

  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(77, 232, 255, 0.88)";
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();

  let peak = points[0];

  points.forEach((point) => {
    if (point.value > peak.value) {
      peak = point;
    }
  });

  points.forEach((point) => {
    ctx.beginPath();
    ctx.fillStyle = point === peak
      ? "rgba(255, 230, 109, 0.96)"
      : "rgba(77, 232, 255, 0.92)";
    ctx.arc(point.x, point.y, point === peak ? 5.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (peak) {
    ctx.save();
    ctx.shadowColor = "rgba(255, 230, 109, 0.7)";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(255, 230, 109, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(255, 230, 109, 0.96)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`PEAK: ${RADAR_AXES[peak.index]}`, 14, 22);
  }

  ctx.restore();
}

function renderImagePreview(imageSrc) {
  if (!imageSrc) {
    imagePreview.src = "";
    imagePreviewWrap.classList.remove("active");
    return;
  }

  imagePreview.src = imageSrc;
  imagePreviewWrap.classList.add("active");
}

async function uploadSelectedDeckImage(file) {
  const deck = getDeckById(state.selectedDeckId);
  if (!deck) return;

  if (!file.type.startsWith("image/")) {
    window.alert("画像ファイルを選んでください。");
    return;
  }

  const maxSize = 6 * 1024 * 1024;

  if (file.size > maxSize) {
    window.alert("画像が大きすぎます。6MB以下の画像にしてください。");
    return;
  }

  try {
    showToast("画像アップロード中...");

    if (deck.imagePath) {
      deleteStorageObjectQuietly(deck.imagePath);
    }

    const safeName = file.name.replace(/[\\/#?%*:|"<>]/g, "_");
    const path = `tier-images/${deck.id}/${Date.now()}_${safeName}`;
    const imageRef = ref(storage, path);

    await uploadBytes(imageRef, file);
    const url = await getDownloadURL(imageRef);

    deck.image = url;
    deck.imagePath = path;

    await saveState();
    render();
    renderImagePreview(deck.image);
  } catch (error) {
    console.error("画像アップロード失敗", error);
    showToast("画像アップロード失敗。Storage設定を確認してね");
  }
}

async function deleteSelectedDeckImage() {
  const deck = getDeckById(state.selectedDeckId);
  if (!deck) return;

  const oldPath = deck.imagePath;

  deck.image = "";
  deck.imagePath = "";

  if (oldPath) {
    deleteStorageObjectQuietly(oldPath);
  }

  await saveState();
  render();
  renderImagePreview("");
}

function deleteStorageObjectQuietly(path) {
  if (!path) return;

  deleteObject(ref(storage, path)).catch((error) => {
    console.warn("Storage画像削除に失敗しました", error);
  });
}

function setupImageDrop() {
  imageDropArea.addEventListener("click", () => {
    imageFileInput.click();
  });

  imageFileInput.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    uploadSelectedDeckImage(file);
    imageFileInput.value = "";
  });

  imageDropArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    imageDropArea.classList.add("drag-over");
  });

  imageDropArea.addEventListener("dragleave", () => {
    imageDropArea.classList.remove("drag-over");
  });

  imageDropArea.addEventListener("drop", (event) => {
    event.preventDefault();
    imageDropArea.classList.remove("drag-over");

    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;

    uploadSelectedDeckImage(file);
  });
}

function setupEvents() {
  addDeckBtn.addEventListener("click", addDeck);
  resetBtn.addEventListener("click", resetAll);

  closeDrawerBtn.addEventListener("click", closeDrawer);
  saveDeckBtn.addEventListener("click", saveSelectedDeck);
  deleteDeckBtn.addEventListener("click", deleteSelectedDeck);
  deleteImageBtn.addEventListener("click", deleteSelectedDeckImage);

  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) {
      closeDrawer();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("active")) {
      closeDrawer();
    }
  });

  setupDropZones();
  setupImageDrop();
}

async function boot() {
  if (firebaseConfig.apiKey.includes("ここに")) {
    showToast("tier.jsのfirebaseConfigを設定してね");
    console.warn("firebaseConfig が未設定です。Firebase ConsoleのConfigをtier.jsへ貼ってください。", firebaseConfig);
  }

  setupEvents();

  try {
    await ensureBoardExists();
    subscribeBoard();
  } catch (error) {
    console.error("初期化失敗", error);
    showToast("初期化失敗。Firebase設定を確認してね");
  }
}

boot();
