"use strict";

/**
 * 0バト デッキティア表
 * v20260906_curse_nav1
 *
 * 修正内容:
 * - tendencyGrid の25マス生成を復旧
 * - 初心者おすすめ度 / ゲームスピードのスライダー反応を復旧
 * - 旧JSの insertBefore 依存を完全撤去
 * - 概要 / 回し方 / メモ / 属性 / レーダー / 画像 / Firestore共有を維持
 * - 閲覧モード / 編集モードを維持
 * - 同一ティア内の左右並び替えを維持
 *
 * tier.html:
 * <script type="module" src="./tier.js?v=20260906_curse_nav1"></script>
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
  storageBucket: "tcg-0bato.firebasestorage.app",
  messagingSenderId: "440001841840",
  appId: "1:440001841840:web:d77a9bdb80f3d8d8c10975",
  measurementId: "G-2BS37RDG7F",
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
  "草回復",
  "雷テンポ",
  "風侵入",
  "鋼要塞",
  "光エース",
  "闇ピンチ逆転",
  "幻トリック",
  "呪SP圧",
  "無グッドスタッフ",
  "狂ハイリスク",
];

const ATTRIBUTES = [
  { key: "火", color: "#ff5a6d" },
  { key: "水", color: "#49b8ff" },
  { key: "草", color: "#75e36b" },
  { key: "雷", color: "#ffe45e" },
  { key: "風", color: "#55f0b0" },
  { key: "鋼", color: "#b7c4d8" },
  { key: "光", color: "#fff2a8" },
  { key: "闇", color: "#9b62ff" },
  { key: "幻", color: "#ff73df" },
  { key: "呪", color: "#c084fc" },
  { key: "無", color: "#d8d8d8" },
  { key: "狂", color: "#ff2d2d" },
];

const ATTR_LABELS = {
  0: "なし",
  1: "少し",
  2: "多め",
  3: "主軸",
};

const RADAR_AXES = [
  "攻撃力",
  "展開力",
  "耐久性",
  "安定性",
  "扱いやすさ",
  "制圧力",
];

const DECK_ROLES = [
  { key: "展開", desc: "盤面を広げて手数で押す" },
  { key: "妨害", desc: "状態異常や手札干渉で相手を止める" },
  { key: "耐久", desc: "回復や高HPで長期戦に持ち込む" },
  { key: "戦略", desc: "配置と読み合いで勝ち筋を作る" },
  { key: "制圧", desc: "相手の行動範囲を狭めて盤面を支配する" },
  { key: "奇襲", desc: "射程や入れ替えで意外な角度から攻める" },
  { key: "突進", desc: "移動や侵入を狙って早く勝つ" },
];

const TIER_ORDER = ["S", "A", "B", "C", "D", "pool"];
const TIER_LABELS = {
  S: "S",
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  pool: "未配置",
};
const COMPACT_VIEW_KEY = "zero_bato_tier_compact_v1";
const SEARCH_COLLAPSED_KEY = "zero_bato_tier_search_collapsed_v1";
const DRAWER_HISTORY_KEY = "zeroBatoTierDrawer";

/**
 * +++++:100 / +++:80 / ++:70 / +:60 / 無印:50 / -:40 / --:30 / ---:20
 */
const ATTR_PROFILE = {
  火: { atk: 70, exp: 60, dur: 40, stab: 60, use: 60, ctl: 40 },
  水: { atk: 40, exp: 40, dur: 70, stab: 40, use: 70, ctl: 30 },
  草: { atk: 30, exp: 30, dur: 70, stab: 80, use: 40, ctl: 30 },
  雷: { atk: 50, exp: 80, dur: 30, stab: 80, use: 40, ctl: 30 },
  風: { atk: 40, exp: 40, dur: 40, stab: 70, use: 80, ctl: 50 },
  鋼: { atk: 20, exp: 20, dur: 80, stab: 60, use: 70, ctl: 40 },
  光: { atk: 50, exp: 70, dur: 60, stab: 80, use: 30, ctl: 40 },
  闇: { atk: 70, exp: 60, dur: 40, stab: 20, use: 30, ctl: 80 },
  幻: { atk: 30, exp: 70, dur: 40, stab: 60, use: 20, ctl: 80 },
  呪: { atk: 32, exp: 42, dur: 34, stab: 52, use: 48, ctl: 88 },
  無: { atk: 50, exp: 50, dur: 50, stab: 50, use: 50, ctl: 50 },
  狂: { atk: 80, exp: 20, dur: 70, stab: 20, use: 20, ctl: 100 },
};

const SCORE_KEYS = ["atk", "exp", "dur", "stab", "use", "ctl"];

const state = {
  decks: [],
  selectedDeckId: null,
  draggingDeckId: null,
  filterText: "",
  toastTimer: null,
  drawerHistoryActive: false,
  unsubscribe: null,
  isSaving: false,
  lastSaveTimer: null,
  editMode: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const addDeckBtn = $("#addDeckBtn");
const resetBtn = $("#resetBtn");
const deckPool = $("#deckPool");
const tierSearchInput = $("#tierSearchInput");
const clearSearchBtn = $("#clearSearchBtn");
const toggleSearchBtn = $("#toggleSearchBtn");
const compactViewBtn = $("#compactViewBtn");
const sortByTierBtn = $("#sortByTierBtn");
const poolCount = $("#poolCount");

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

let overviewInput = null;
let guideInput = null;
let beginnerRange = null;
let speedRange = null;
let beginnerValue = null;
let speedValue = null;
let tendencyGrid = null;
let tendencyNote = null;
let roleControls = null;

let editModeBtn = null;
let modeHint = null;

function createId() {
  return `deck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

function clampTendencyValue(value) {
  return clamp(value || 3, 1, 5);
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

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];

  const known = new Set(DECK_ROLES.map((role) => role.key));
  return [...new Set(roles.map((role) => String(role).trim()).filter(Boolean))]
    .filter((role) => known.has(role));
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
    overview: "",
    guide: "",
    beginner: 3,
    speed: 3,
    roles: [],
    image: "",
    imagePath: "",
    attrs: guessAttrsFromName(name),
  };
}

function createDefaultState() {
  return DEFAULT_DECKS.map((name) => createDeck(name));
}

function normalizeDeck(deck) {
  const name = String(deck?.name || "名前なしデッキ");
  const image = typeof deck?.image === "string" ? deck.image : "";
  const isDataUrl = image.startsWith("data:");

  return {
    id: deck?.id || createId(),
    name,
    tier: deck?.tier || "pool",
    memo: deck?.memo || "",
    overview: deck?.overview || "",
    guide: deck?.guide || "",
    beginner: clampTendencyValue(deck?.beginner),
    speed: clampTendencyValue(deck?.speed),
    roles: normalizeRoles(deck?.roles),
    image: isDataUrl ? "" : image,
    imagePath: deck?.imagePath || "",
    attrs: normalizeAttrs(deck?.attrs || guessAttrsFromName(name)),
  };
}

function getDeckById(id) {
  return state.decks.find((deck) => deck.id === id) || null;
}

function getSelectedDeck() {
  return getDeckById(state.selectedDeckId);
}

function makeBoardPayload() {
  return {
    version: 9,
    decks: state.decks.map(normalizeDeck),
    updatedAt: serverTimestamp(),
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
    },
  );
}

async function saveState(showToastFlag = true) {
  if (!state.editMode && showToastFlag) {
    showToast("閲覧モードです。編集モードに切り替えてね");
    return;
  }

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
  if (!state.editMode) return;

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

function ensureDetailLayout() {
  overviewInput = document.getElementById("deckOverviewInput");
  guideInput = document.getElementById("deckGuideInput");
  beginnerRange = document.getElementById("beginnerInput");
  speedRange = document.getElementById("speedInput");
  beginnerValue = document.getElementById("beginnerValueText");
  speedValue = document.getElementById("speedValueText");
  tendencyGrid = document.getElementById("tendencyGrid");
  tendencyNote = document.getElementById("tendencyNote");
  roleControls = document.getElementById("roleControls");

  const requiredIds = [
    "deckOverviewInput",
    "beginnerInput",
    "beginnerValueText",
    "speedInput",
    "speedValueText",
    "tendencyGrid",
    "roleControls",
    "deckGuideInput",
    "deckMemoInput",
    "imageDropArea",
    "imagePreviewWrap",
    "attributeControls",
    "deckRadarCanvas",
  ];

  const missing = requiredIds.filter((id) => !document.getElementById(id));

  if (missing.length) {
    console.warn("詳細レイアウトの要素が不足しています:", missing);
  }
}

function setupTendencyControls() {
  if (beginnerRange && beginnerRange.dataset.bound !== "1") {
    beginnerRange.dataset.bound = "1";

    beginnerRange.addEventListener("input", () => {
      const deck = getSelectedDeck();
      if (!deck) return;

      if (!state.editMode) {
        beginnerRange.value = String(clampTendencyValue(deck.beginner));
        showToast("編集モードにすると変更できます");
        return;
      }

      deck.beginner = clampTendencyValue(beginnerRange.value);
      renderTendencyUI(deck);
    });

    beginnerRange.addEventListener("change", () => {
      const deck = getSelectedDeck();
      if (!deck || !state.editMode) return;

      deck.beginner = clampTendencyValue(beginnerRange.value);
      saveState();
      render();
    });
  }

  if (speedRange && speedRange.dataset.bound !== "1") {
    speedRange.dataset.bound = "1";

    speedRange.addEventListener("input", () => {
      const deck = getSelectedDeck();
      if (!deck) return;

      if (!state.editMode) {
        speedRange.value = String(clampTendencyValue(deck.speed));
        showToast("編集モードにすると変更できます");
        return;
      }

      deck.speed = clampTendencyValue(speedRange.value);
      renderTendencyUI(deck);
    });

    speedRange.addEventListener("change", () => {
      const deck = getSelectedDeck();
      if (!deck || !state.editMode) return;

      deck.speed = clampTendencyValue(speedRange.value);
      saveState();
      render();
    });
  }
}

function renderTendencyUI(deck) {
  if (!deck) return;

  const beginner = clampTendencyValue(deck.beginner);
  const speed = clampTendencyValue(deck.speed);

  if (beginnerRange) {
    beginnerRange.value = String(beginner);
    beginnerRange.disabled = !state.editMode;
  }

  if (speedRange) {
    speedRange.value = String(speed);
    speedRange.disabled = !state.editMode;
  }

  if (beginnerValue) beginnerValue.textContent = `${beginner} / 5`;
  if (speedValue) speedValue.textContent = `${speed} / 5`;

  renderTendencyGrid(deck);
}

function renderTendencyGrid(deck) {
  if (!tendencyGrid || !deck) return;

  const beginner = clampTendencyValue(deck.beginner);
  const speed = clampTendencyValue(deck.speed);

  tendencyGrid.innerHTML = "";

  for (let y = 5; y >= 1; y -= 1) {
    for (let x = 1; x <= 5; x += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "tendency-cell";
      cell.dataset.speed = String(x);
      cell.dataset.beginner = String(y);
      cell.title = `初心者おすすめ度 ${y} / 5・ゲームスピード ${x} / 5`;
      cell.disabled = !state.editMode;

      if (x === speed && y === beginner) {
        cell.classList.add("active");
      }

      cell.addEventListener("click", () => {
        if (!assertEditMode()) return;

        const selectedDeck = getSelectedDeck();
        if (!selectedDeck) return;

        selectedDeck.speed = x;
        selectedDeck.beginner = y;

        renderTendencyUI(selectedDeck);
        render();
        saveState();
      });

      tendencyGrid.appendChild(cell);
    }
  }

  if (tendencyNote) {
    const beginnerText = [
      "",
      "かなり玄人向け",
      "やや玄人向け",
      "普通",
      "初心者にも比較的おすすめ",
      "初心者おすすめ",
    ];
    const speedText = ["", "かなり低速", "低速", "中速", "高速", "超高速"];

    tendencyNote.textContent =
      `初心者おすすめ度：${beginnerText[beginner]} / ゲームスピード：${speedText[speed]}`;
  }
}

function setupModeToggle() {
  const heroActions = document.querySelector(".hero-actions");
  if (!heroActions) return;

  const wrap = document.createElement("div");
  wrap.className = "mode-toggle-wrap";

  editModeBtn = document.createElement("button");
  editModeBtn.type = "button";
  editModeBtn.className = "mode-toggle-btn";
  editModeBtn.addEventListener("click", () => {
    setEditMode(!state.editMode);
  });

  modeHint = document.createElement("p");
  modeHint.className = "mode-hint";

  wrap.appendChild(editModeBtn);
  wrap.appendChild(modeHint);
  heroActions.prepend(wrap);

  setEditMode(false);
}

function setEditMode(enabled) {
  state.editMode = !!enabled;
  document.body.classList.toggle("is-edit-mode", state.editMode);
  document.body.classList.toggle("is-view-mode", !state.editMode);

  if (editModeBtn) {
    editModeBtn.textContent = state.editMode
      ? "✏️ 編集モード ON"
      : "👁 閲覧モード";
    editModeBtn.setAttribute("aria-pressed", String(state.editMode));
  }

  if (modeHint) {
    modeHint.textContent = state.editMode
      ? "編集・移動・削除できます"
      : "安全表示中。変更する時は編集モードへ";
  }

  [addDeckBtn, resetBtn, saveDeckBtn, deleteDeckBtn, deleteImageBtn].forEach(
    (btn) => {
      if (!btn) return;
      btn.disabled = !state.editMode;
    },
  );

  if (deckNameInput) deckNameInput.readOnly = !state.editMode;
  if (overviewInput) overviewInput.readOnly = !state.editMode;
  if (guideInput) guideInput.readOnly = !state.editMode;
  if (deckMemoInput) deckMemoInput.readOnly = !state.editMode;
  if (beginnerRange) beginnerRange.disabled = !state.editMode;
  if (speedRange) speedRange.disabled = !state.editMode;
  if (imageFileInput) imageFileInput.disabled = !state.editMode;

  render();

  if (state.selectedDeckId) {
    const deck = getDeckById(state.selectedDeckId);
    if (deck) refreshDrawer(deck);
  }
}

function assertEditMode() {
  if (state.editMode) return true;
  showToast("閲覧モードです。編集モードに切り替えてね");
  return false;
}

function render() {
  const zones = $$(".tier-dropzone");
  zones.forEach((zone) => {
    zone.innerHTML = "";
  });

  if (deckPool) deckPool.innerHTML = "";

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

  updateTierCounts();
}

function createDeckChip(deck) {
  const chip = document.createElement("div");
  chip.className = "deck-chip";
  chip.draggable = state.editMode;
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

  const roles = normalizeRoles(deck.roles);
  if (roles.length) {
    const roleWrap = document.createElement("div");
    roleWrap.className = "chip-roles";

    roles.slice(0, 3).forEach((role) => {
      const badge = document.createElement("span");
      badge.className = "chip-role";
      badge.textContent = role;
      roleWrap.appendChild(badge);
    });

    if (roles.length > 3) {
      const more = document.createElement("span");
      more.className = "chip-role chip-role-more";
      more.textContent = `+${roles.length - 3}`;
      roleWrap.appendChild(more);
    }

    chip.appendChild(roleWrap);
  }

  if (!deckMatchesFilter(deck)) {
    chip.classList.add("is-filtered-out");
  }

  const tools = createChipTools(deck);
  chip.appendChild(tools);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-mini";
  deleteBtn.type = "button";
  deleteBtn.textContent = "×";
  deleteBtn.title = "削除";
  deleteBtn.disabled = !state.editMode;

  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteDeck(deck.id);
  });

  chip.appendChild(deleteBtn);

  chip.addEventListener("click", () => {
    openDrawer(deck.id);
  });

  chip.addEventListener("dragstart", (event) => {
    if (!state.editMode) {
      event.preventDefault();
      return;
    }

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

function createChipTools(deck) {
  const tools = document.createElement("div");
  tools.className = "chip-tools";

  const currentTier = deck.tier || "pool";
  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "chip-tool-btn";
  upBtn.textContent = "↑";
  upBtn.title = "同じティア内で上へ";
  upBtn.disabled = !state.editMode || !canMoveWithinTier(deck.id, -1);

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "chip-tool-btn";
  downBtn.textContent = "↓";
  downBtn.title = "同じティア内で下へ";
  downBtn.disabled = !state.editMode || !canMoveWithinTier(deck.id, 1);

  const tierSelect = document.createElement("select");
  tierSelect.className = "chip-tier-select";
  tierSelect.title = "ティアを変更";
  tierSelect.disabled = !state.editMode;

  TIER_ORDER.forEach((tier) => {
    const option = document.createElement("option");
    option.value = tier;
    option.textContent = TIER_LABELS[tier] || tier;
    option.selected = tier === currentTier;
    tierSelect.appendChild(option);
  });

  upBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!assertEditMode()) return;
    if (!moveDeckWithinTier(deck.id, -1)) return;
    await saveState(false);
    render();
  });

  downBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!assertEditMode()) return;
    if (!moveDeckWithinTier(deck.id, 1)) return;
    await saveState(false);
    render();
  });

  tierSelect.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  tierSelect.addEventListener("change", async (event) => {
    event.stopPropagation();
    if (!assertEditMode()) {
      tierSelect.value = currentTier;
      return;
    }
    moveDeckToTier(deck.id, tierSelect.value || "pool");
    await saveState(false);
    render();
  });

  tools.appendChild(upBtn);
  tools.appendChild(downBtn);
  tools.appendChild(tierSelect);
  return tools;
}

function deckMatchesFilter(deck) {
  const q = String(state.filterText || "").trim().toLowerCase();
  if (!q) return true;

  const attrs = ATTRIBUTES.filter((attr) => Number(deck.attrs?.[attr.key] || 0) > 0)
    .map((attr) => attr.key)
    .join(" ");
  const text = [
    deck.name,
    deck.overview,
    deck.guide,
    deck.memo,
    TIER_LABELS[deck.tier || "pool"],
    ...(normalizeRoles(deck.roles)),
    attrs,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(q);
}

function updateTierCounts() {
  const visibleByTier = new Map();
  const totalByTier = new Map();
  for (const tier of TIER_ORDER) {
    visibleByTier.set(tier, 0);
    totalByTier.set(tier, 0);
  }

  for (const deck of state.decks) {
    const tier = deck.tier || "pool";
    totalByTier.set(tier, (totalByTier.get(tier) || 0) + 1);
    if (deckMatchesFilter(deck)) {
      visibleByTier.set(tier, (visibleByTier.get(tier) || 0) + 1);
    }
  }

  $$(".tier-row").forEach((row) => {
    const tier = row.dataset.tier || "";
    const label = row.querySelector(".tier-label");
    if (!label) return;

    let count = label.querySelector(".tier-count");
    if (!count) {
      count = document.createElement("span");
      count.className = "tier-count";
      label.appendChild(count);
    }

    count.textContent = countText(visibleByTier.get(tier) || 0, totalByTier.get(tier) || 0);
  });

  if (poolCount) {
    poolCount.textContent = countText(
      visibleByTier.get("pool") || 0,
      totalByTier.get("pool") || 0,
    );
  }
}

function countText(visible, total) {
  return state.filterText ? `${visible}/${total}` : String(total);
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

  chip.style.setProperty(
    "--chip-glow",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`,
  );
  chip.style.setProperty(
    "--chip-border",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.25 + top.value * 0.14})`,
  );
  chip.style.setProperty(
    "--chip-base",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${softAlpha})`,
  );
}

function getTopAttribute(deck) {
  let top = null;

  ATTRIBUTES.forEach((attr) => {
    const value = Number(deck.attrs?.[attr.key] || 0);
    if (!top || value > top.value) {
      top = {
        key: attr.key,
        color: attr.color,
        value,
      };
    }
  });

  return top;
}

function getTopAttributeText(deck) {
  const active = ATTRIBUTES.map((attr) => ({
    key: attr.key,
    value: Number(deck.attrs?.[attr.key] || 0),
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
    b: value & 255,
  };
}

async function addDeck() {
  if (!assertEditMode()) return;

  const name = window.prompt(
    "追加するデッキテーマ名を入力してね",
    "新しいデッキテーマ",
  );
  if (!name || !name.trim()) return;

  const deck = createDeck(name.trim());
  state.decks.push(deck);
  await saveState();
  render();
  openDrawer(deck.id);
}

async function deleteDeck(id) {
  if (!assertEditMode()) return;

  const deck = getDeckById(id);
  if (!deck) return;

  const ok = window.confirm(`「${deck.name}」を削除する？`);
  if (!ok) return;

  const oldPath = deck.imagePath;
  state.decks = state.decks.filter((item) => item.id !== id);

  if (state.selectedDeckId === id) {
    closeDrawer();
  }

  if (oldPath) {
    deleteStorageObjectQuietly(oldPath);
  }

  await saveState();
  render();
}

async function resetAll() {
  if (!assertEditMode()) return;

  const ok = window.confirm("ティア表とデッキテーマを全部リセットする？");
  if (!ok) return;

  state.decks = createDefaultState();
  state.selectedDeckId = null;

  await saveState();
  render();
  closeDrawer();
}

function setupDropZones() {
  const dropTargets = [...$$(".tier-dropzone"), deckPool].filter(Boolean);

  dropTargets.forEach((target) => {
    target.addEventListener("dragover", (event) => {
      if (!state.editMode) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      target.classList.add("drag-over");
    });

    target.addEventListener("dragleave", () => {
      target.classList.remove("drag-over");
    });

    target.addEventListener("drop", async (event) => {
      if (!state.editMode) return;
      event.preventDefault();

      const deckId =
        event.dataTransfer.getData("text/plain") || state.draggingDeckId;

      if (!deckId) return;

      const deck = getDeckById(deckId);
      if (!deck) return;

      const targetTier = target.dataset.tier || "pool";
      const beforeId = getBeforeDeckId(target, event, deckId);

      moveDeckToTier(deckId, targetTier, beforeId);

      clearDragOver();
      await saveState(false);
      render();
    });
  });
}

function getBeforeDeckId(target, event, draggingDeckId) {
  const chips = Array.from(target.querySelectorAll(".deck-chip")).filter(
    (chip) => chip.dataset.deckId !== draggingDeckId,
  );

  if (!chips.length) return null;

  for (const chip of chips) {
    const rect = chip.getBoundingClientRect();
    const inSameRow = event.clientY >= rect.top && event.clientY <= rect.bottom;
    const beforeHorizontally = event.clientX < rect.left + rect.width / 2;
    const beforeVertically = event.clientY < rect.top + rect.height / 2;

    if ((inSameRow && beforeHorizontally) || beforeVertically) {
      return chip.dataset.deckId;
    }
  }

  return null;
}

function moveDeckToTier(deckId, targetTier, beforeId = null) {
  const moving = getDeckById(deckId);
  if (!moving) return;

  state.decks = state.decks.filter((deck) => deck.id !== deckId);
  moving.tier = targetTier;

  if (beforeId) {
    const beforeIndex = state.decks.findIndex((deck) => deck.id === beforeId);
    if (beforeIndex >= 0) {
      state.decks.splice(beforeIndex, 0, moving);
      return;
    }
  }

  let insertIndex = -1;
  state.decks.forEach((deck, index) => {
    if ((deck.tier || "pool") === targetTier) {
      insertIndex = index;
    }
  });

  state.decks.splice(insertIndex + 1, 0, moving);
}

function canMoveWithinTier(deckId, delta) {
  const deck = getDeckById(deckId);
  if (!deck) return false;
  const tier = deck.tier || "pool";
  const sameTier = state.decks.filter((item) => (item.tier || "pool") === tier);
  const index = sameTier.findIndex((item) => item.id === deckId);
  const nextIndex = index + delta;
  return index >= 0 && nextIndex >= 0 && nextIndex < sameTier.length;
}

function moveDeckWithinTier(deckId, delta) {
  const deck = getDeckById(deckId);
  if (!deck || !canMoveWithinTier(deckId, delta)) return false;

  const tier = deck.tier || "pool";
  const sameTier = state.decks.filter((item) => (item.tier || "pool") === tier);
  const index = sameTier.findIndex((item) => item.id === deckId);
  const nextIndex = index + delta;
  const reordered = [...sameTier];
  const [moving] = reordered.splice(index, 1);
  reordered.splice(nextIndex, 0, moving);

  const queue = [...reordered];
  state.decks = state.decks.map((item) =>
    (item.tier || "pool") === tier ? queue.shift() : item,
  );

  return true;
}

function sortDecksByTierOrder() {
  const known = new Set(TIER_ORDER);
  const sorted = TIER_ORDER.flatMap((tier) =>
    state.decks.filter((deck) => (deck.tier || "pool") === tier),
  );
  const unknown = state.decks.filter((deck) => !known.has(deck.tier || "pool"));
  state.decks = [...sorted, ...unknown];
}

function clearDragOver() {
  $$(".tier-dropzone").forEach((zone) => zone.classList.remove("drag-over"));
  if (deckPool) deckPool.classList.remove("drag-over");
}

function openDrawer(deckId, options = {}) {
  const deck = getDeckById(deckId);
  if (!deck) return;

  const shouldPushHistory = options.pushHistory !== false;

  state.selectedDeckId = deckId;
  refreshDrawer(deck);

  if (drawer) {
    drawer.classList.add("active");
  }

  if (shouldPushHistory) {
    try {
      const historyState = {
        ...(history.state && typeof history.state === "object" ? history.state : {}),
        [DRAWER_HISTORY_KEY]: true,
        deckId,
      };

      if (state.drawerHistoryActive) {
        history.replaceState(historyState, "", window.location.href);
      } else {
        history.pushState(historyState, "", window.location.href);
        state.drawerHistoryActive = true;
      }
    } catch {}
  }
}

function refreshDrawer(deck) {
  if (!deck) return;

  if (drawerTitle) drawerTitle.textContent = deck.name;

  if (deckNameInput && document.activeElement !== deckNameInput) {
    deckNameInput.value = deck.name;
  }

  if (overviewInput && document.activeElement !== overviewInput) {
    overviewInput.value = deck.overview || "";
  }

  if (guideInput && document.activeElement !== guideInput) {
    guideInput.value = deck.guide || "";
  }

  if (deckMemoInput && document.activeElement !== deckMemoInput) {
    deckMemoInput.value = deck.memo || "";
  }

  if (deckNameInput) deckNameInput.readOnly = !state.editMode;
  if (overviewInput) overviewInput.readOnly = !state.editMode;
  if (guideInput) guideInput.readOnly = !state.editMode;
  if (deckMemoInput) deckMemoInput.readOnly = !state.editMode;

  renderImagePreview(deck.image);
  renderTendencyUI(deck);
  renderRoleControls(deck);
  renderAttributeControls(deck);
  renderRadar(deck);
}

function closeDrawer(options = {}) {
  const shouldUseHistory = options.useHistory !== false;
  const fromPopState = options.fromPopState === true;

  if (drawer) drawer.classList.remove("active");
  state.selectedDeckId = null;

  if (fromPopState) {
    state.drawerHistoryActive = false;
    return;
  }

  if (shouldUseHistory && state.drawerHistoryActive) {
    state.drawerHistoryActive = false;
    try {
      history.back();
    } catch {}
  }
}

async function saveSelectedDeck() {
  if (!assertEditMode()) return;

  const deck = getSelectedDeck();
  if (!deck) return;

  const name = deckNameInput?.value.trim() || "";

  if (!name) {
    window.alert("テーマ名は空にできません。");
    return;
  }

  deck.name = name;
  deck.overview = overviewInput ? overviewInput.value.trim() : deck.overview || "";
  deck.guide = guideInput ? guideInput.value.trim() : deck.guide || "";
  deck.beginner = clampTendencyValue(beginnerRange?.value ?? deck.beginner);
  deck.speed = clampTendencyValue(speedRange?.value ?? deck.speed);
  deck.roles = normalizeRoles(deck.roles);
  deck.memo = deckMemoInput ? deckMemoInput.value.trim() : deck.memo || "";

  await saveState();
  render();
  openDrawer(deck.id);
}

function deleteSelectedDeck() {
  if (!state.selectedDeckId) return;
  deleteDeck(state.selectedDeckId);
}

function renderRoleControls(deck) {
  if (!roleControls || !deck) return;

  roleControls.innerHTML = "";
  deck.roles = normalizeRoles(deck.roles);

  DECK_ROLES.forEach((role) => {
    const selected = deck.roles.includes(role.key);
    const item = document.createElement("div");
    item.className = "role-choice";
    item.classList.toggle("active", selected);

    const pickBtn = document.createElement("button");
    pickBtn.type = "button";
    pickBtn.className = "role-choice-main";
    pickBtn.disabled = !state.editMode;
    pickBtn.setAttribute("aria-pressed", String(selected));
    pickBtn.textContent = role.key;

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "role-desc-toggle";
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.setAttribute("aria-label", `${role.key}の説明を開く`);
    toggleBtn.textContent = "›";

    const desc = document.createElement("span");
    desc.className = "role-choice-desc";
    desc.textContent = role.desc;
    desc.hidden = true;

    pickBtn.addEventListener("click", () => {
      if (!assertEditMode()) return;

      const current = new Set(normalizeRoles(deck.roles));
      if (current.has(role.key)) {
        current.delete(role.key);
      } else {
        current.add(role.key);
      }

      deck.roles = normalizeRoles([...current]);
      renderRoleControls(deck);
      render();
      scheduleSave(300);
    });

    toggleBtn.addEventListener("click", () => {
      const nextOpen = !item.classList.contains("is-open");
      item.classList.toggle("is-open", nextOpen);
      desc.hidden = !nextOpen;
      toggleBtn.textContent = nextOpen ? "⌄" : "›";
      toggleBtn.setAttribute("aria-expanded", String(nextOpen));
      toggleBtn.setAttribute(
        "aria-label",
        nextOpen ? `${role.key}の説明を閉じる` : `${role.key}の説明を開く`,
      );
    });

    item.appendChild(pickBtn);
    item.appendChild(toggleBtn);
    item.appendChild(desc);
    roleControls.appendChild(item);
  });
}

function renderAttributeControls(deck) {
  if (!attributeControls) return;

  attributeControls.innerHTML = "";

  ATTRIBUTES.forEach((attr) => {
    const value = Number(deck.attrs?.[attr.key] || 0);
    const rgb = hexToRgb(attr.color);

    const row = document.createElement("div");
    row.className = "attr-control";
    row.style.setProperty("--attr-color", attr.color);
    row.style.setProperty(
      "--attr-soft",
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.06 + value * 0.06})`,
    );

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
    range.disabled = !state.editMode;

    const level = document.createElement("div");
    level.className = "attr-level";
    level.textContent = ATTR_LABELS[value];

    range.addEventListener("input", () => {
      if (!state.editMode) return;

      const selectedDeck = getSelectedDeck();
      if (!selectedDeck) return;

      const nextValue = Number(range.value);
      selectedDeck.attrs[attr.key] = nextValue;

      level.textContent = ATTR_LABELS[nextValue];
      row.style.setProperty(
        "--attr-soft",
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.06 + nextValue * 0.06})`,
      );

      renderRadar(selectedDeck);
      render();
      scheduleSave(450);
    });

    range.addEventListener("change", () => {
      if (!state.editMode) return;
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
    exp: 0,
    dur: 0,
    stab: 0,
    use: 0,
    ctl: 0,
  };

  let weight = 0;

  ATTRIBUTES.forEach((attr) => {
    const level = Number(deck.attrs?.[attr.key] || 0);
    if (level <= 0) return;

    const profile = ATTR_PROFILE[attr.key];
    if (!profile) return;

    const w = level;
    weight += w;

    SCORE_KEYS.forEach((key) => {
      totals[key] += profile[key] * w;
    });
  });

  if (weight <= 0) {
    return {
      scores: [0, 0, 0, 0, 0, 0],
      note: "属性を設定すると、ざっくり評価が表示されます。",
    };
  }

  const CONTRAST_GAIN = 1.28;
  const scores = SCORE_KEYS.map((key) => {
    const raw = totals[key] / weight;
    const emphasized = 50 + (raw - 50) * CONTRAST_GAIN;
    return clamp(Math.round(emphasized), 5, 100);
  });

  const note = RADAR_AXES.map((axis, index) => `${axis}:${scores[index]}`).join(
    " / ",
  );

  return {
    scores,
    note,
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
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
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
      index,
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
    ctx.fillStyle =
      point === peak ? "rgba(255, 230, 109, 0.96)" : "rgba(77, 232, 255, 0.92)";
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
  if (!assertEditMode()) return;

  const deck = getSelectedDeck();
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
  if (!assertEditMode()) return;

  const deck = getSelectedDeck();
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

async function deleteStorageObjectQuietly(path) {
  try {
    if (!path) return;
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn("Storage画像削除はスキップされました", error);
  }
}

function setupImageDrop() {
  if (!imageDropArea || !imageFileInput) return;

  imageDropArea.addEventListener("click", () => {
    if (!assertEditMode()) return;
    imageFileInput.click();
  });

  imageFileInput.addEventListener("change", (event) => {
    if (!state.editMode) return;

    const file = event.target.files && event.target.files[0];
    if (!file) return;

    uploadSelectedDeckImage(file);
    imageFileInput.value = "";
  });

  imageDropArea.addEventListener("dragover", (event) => {
    if (!state.editMode) return;
    event.preventDefault();
    imageDropArea.classList.add("drag-over");
  });

  imageDropArea.addEventListener("dragleave", () => {
    imageDropArea.classList.remove("drag-over");
  });

  imageDropArea.addEventListener("drop", (event) => {
    if (!state.editMode) return;
    event.preventDefault();
    imageDropArea.classList.remove("drag-over");

    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;

    uploadSelectedDeckImage(file);
  });
}

function setupTextAutoSave() {
  [overviewInput, guideInput, deckMemoInput].forEach((input) => {
    if (!input || input.dataset.bound === "1") return;
    input.dataset.bound = "1";

    input.addEventListener("input", () => {
      if (!state.editMode) return;

      const deck = getSelectedDeck();
      if (!deck) return;

      deck.overview = overviewInput ? overviewInput.value.trim() : deck.overview || "";
      deck.guide = guideInput ? guideInput.value.trim() : deck.guide || "";
      deck.memo = deckMemoInput ? deckMemoInput.value.trim() : deck.memo || "";

      scheduleSave(650);
    });
  });

  if (deckNameInput && deckNameInput.dataset.bound !== "1") {
    deckNameInput.dataset.bound = "1";

    deckNameInput.addEventListener("input", () => {
      if (!state.editMode) return;

      const deck = getSelectedDeck();
      if (!deck) return;

      deck.name = deckNameInput.value.trim() || deck.name;
      if (drawerTitle) drawerTitle.textContent = deck.name;

      scheduleSave(650);
    });
  }
}

function setupTierToolbar() {
  const updateSearchToggle = (collapsed) => {
    document.body.classList.toggle("is-tier-search-collapsed", collapsed);
    if (!toggleSearchBtn) return;

    const hasFilter = Boolean(String(state.filterText || "").trim());
    toggleSearchBtn.setAttribute("aria-expanded", String(!collapsed));
    toggleSearchBtn.classList.toggle("has-active-search", hasFilter);

    if (collapsed) {
      toggleSearchBtn.textContent = hasFilter ? "検索中" : "検索を開く";
    } else {
      toggleSearchBtn.textContent = "検索を閉じる";
    }
  };

  const setSearchCollapsed = (collapsed, shouldSave = true) => {
    updateSearchToggle(collapsed);
    if (!shouldSave) return;
    try {
      localStorage.setItem(SEARCH_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {}
  };

  let searchCollapsed = false;
  try {
    const stored = localStorage.getItem(SEARCH_COLLAPSED_KEY);
    if (stored === null) {
      searchCollapsed = window.matchMedia?.("(max-width: 780px)")?.matches || false;
    } else {
      searchCollapsed = stored === "1";
    }
  } catch {
    searchCollapsed = window.matchMedia?.("(max-width: 780px)")?.matches || false;
  }

  setSearchCollapsed(searchCollapsed, false);

  if (tierSearchInput) {
    tierSearchInput.value = state.filterText;
    tierSearchInput.addEventListener("input", () => {
      state.filterText = tierSearchInput.value || "";
      updateSearchToggle(document.body.classList.contains("is-tier-search-collapsed"));
      render();
    });
  }

  clearSearchBtn?.addEventListener("click", () => {
    state.filterText = "";
    if (tierSearchInput) {
      tierSearchInput.value = "";
      tierSearchInput.focus();
    }
    updateSearchToggle(false);
    render();
  });

  toggleSearchBtn?.addEventListener("click", () => {
    const nextCollapsed = !document.body.classList.contains("is-tier-search-collapsed");
    setSearchCollapsed(nextCollapsed);
    if (!nextCollapsed) {
      requestAnimationFrame(() => tierSearchInput?.focus());
    }
  });

  const applyCompact = (enabled) => {
    document.body.classList.toggle("is-compact-tier", enabled);
    if (compactViewBtn) {
      compactViewBtn.setAttribute("aria-pressed", String(enabled));
      compactViewBtn.textContent = enabled ? "通常表示" : "コンパクト";
    }
    try {
      localStorage.setItem(COMPACT_VIEW_KEY, enabled ? "1" : "0");
    } catch {}
  };

  let compact = false;
  try {
    compact = localStorage.getItem(COMPACT_VIEW_KEY) === "1";
  } catch {}
  applyCompact(compact);

  compactViewBtn?.addEventListener("click", () => {
    compact = !document.body.classList.contains("is-compact-tier");
    applyCompact(compact);
  });

  sortByTierBtn?.addEventListener("click", async () => {
    if (!assertEditMode()) return;
    sortDecksByTierOrder();
    await saveState(false);
    render();
    showToast("ティア順に整列しました");
  });
}

function setupEvents() {
  ensureDetailLayout();

  addDeckBtn?.addEventListener("click", addDeck);
  resetBtn?.addEventListener("click", resetAll);

  closeDrawerBtn?.addEventListener("click", () => closeDrawer());
  saveDeckBtn?.addEventListener("click", saveSelectedDeck);
  deleteDeckBtn?.addEventListener("click", deleteSelectedDeck);
  deleteImageBtn?.addEventListener("click", deleteSelectedDeckImage);

  drawer?.addEventListener("click", (event) => {
    if (event.target === drawer) {
      closeDrawer();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer?.classList.contains("active")) {
      closeDrawer();
    }
  });

  window.addEventListener("popstate", () => {
    if (state.drawerHistoryActive || drawer?.classList.contains("active")) {
      closeDrawer({ fromPopState: true, useHistory: false });
    }
  });

  setupTendencyControls();
  setupTextAutoSave();
  setupTierToolbar();
  setupModeToggle();
  setupDropZones();
  setupImageDrop();
}

async function boot() {
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
