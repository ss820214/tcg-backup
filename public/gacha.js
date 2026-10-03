

// public/gacha.js
// v20260723_starter_series1
//
// Firestore前提：
// - cards (全カード定義) : { name, type, cost, rarity? }  ※ rarityが無い場合は "R" 扱い
// - users/{playerId} : { gems:number, pity:number, updatedAt }
// - users/{playerId}/owned/{cardId} : { count:number, firstAt, lastAt }
//
// URL: gacha.html?player=xxxx

import {
  doc,
  collection,
  getDocs,
  setDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { db } from "./auth.js?v=20260627_perm1";
import {
  ensureUserProfile,
  ensureStarterOwnedCards,
  isStarterCardDef,
  profileRef,
} from "./user_store.js?v=20260723_starter_series1";
import { FAIRY_TALE_CARD_LIST } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { JEWEL_CARD_LIST } from "./jewel_cards.js?v=20260829_jewel_gacha1";
import { STARTER_SUPPORT_CARDS } from "./starter_support_cards.js?v=20260706_starter_support_all1";

// =====================
// Firebase config（game.jsと揃える）
// =====================
// =====================
// DOM
// =====================
const $ = (id) => document.getElementById(id);

const gemsEl = $("gems");
const pityEl = $("pity");
const btnBack = $("btnBack");

const btnSingle = $("btnSingle");
const btnTen = $("btnTen");
const btnUnitBanner = $("btnUnitBanner");
const btnSupportBanner = $("btnSupportBanner");
const btnClear = $("btnClear");
const themeDeck = $("themeDeck");

const cost1El = $("cost1");
const cost10El = $("cost10");
const miniInfo = $("miniInfo");

const bannerNote = $("bannerNote");
const bannerStamp = $("bannerStamp");
const rateBox = $("rateBox");
const bannerTitleEl = document.querySelector(".bannerArt .title .big");
const bannerSubEl = document.querySelector(".bannerArt .title .small");

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
const REVEAL_SPIN_MS = 8000;

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
const legacyPlayerId = params.get("player") || "";
const profile = await ensureUserProfile();
const playerId = profile.uid;
const THEME_ALL_KEY = "mix";
const THEME_STORAGE_KEY = "tcg_gacha_theme_v1";
const ATTR_LABELS = ["火", "水", "雷", "草", "風", "鋼", "光", "闇", "幻", "呪"];
const ATTR_COLORS = {
  火: "#ff5d66",
  水: "#62a8ff",
  雷: "#facc15",
  草: "#58df8f",
  風: "#85e7c6",
  鋼: "#b7c0cc",
  光: "#ffe58a",
  闇: "#b889ff",
  幻: "#f0abfc",
  呪: "#c084fc",
  支援: "#b8bec8",
};
let currentThemeKey =
  params.get("theme") ||
  (() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) || THEME_ALL_KEY;
      return saved === "__all__" ? THEME_ALL_KEY : saved;
    } catch {
      return THEME_ALL_KEY;
    }
  })();

if (false && !playerId) {
  alert("URLに player がありません: gacha.html?player=XXXX");
  throw new Error("missing player");
}
playerTag.textContent = legacyPlayerId && legacyPlayerId !== playerId
  ? `uid:${playerId.slice(0, 8)} / room:${legacyPlayerId}`
  : `uid:${playerId.slice(0, 8)}`;

// 戻る（とりあえず index.html へ。必要なら battle/menu に変更してOK）
btnBack?.addEventListener("click", () => {
  location.href = "./index.html";
});

// =====================
// 設定（確率 / コスト / 天井）
// =====================
const COST_SINGLE = 120;
const COST_TEN = 1200;
const GROWTH_GAIN_TEN = 20;

// 例：SSR 3%, SR 12%, R 85%
const RATE_BY_RARITY = {
  SSR: 3,
  SR: 12,
  R: 85,
};
const MIRACLE_DOUBLE_SSR_RATE = 0.005;
const SECRET_UR_RATE = 0.002;

// 10連で最低1枚SR以上保証
const TEN_GUARANTEE_SR = true;

// “大当たり”扱い演出
const JACKPOT_RARITY = "SSR";
const PITY_MAX = 90;
const PITY_ENABLED = true;

// =====================
// Firestore refs
// =====================
const userRef = profileRef(playerId);

// =====================
// Local cache
// =====================
let allCards = []; // active banner cards: [{id, ...data}]
let cardCatalog = []; // starter付与判定用: Firestore + local cards
let cardsByRarity = { UR: [], SSR: [], SR: [], R: [] };
let currentBanner = "unit";
let bannerThemes = [];
let bannerPools = {
  unit: { cards: [], byRarity: { UR: [], SSR: [], SR: [], R: [] } },
  support: { cards: [], byRarity: { UR: [], SSR: [], SR: [], R: [] } },
};

let liveUser = { gems: 0, pity: 0, gachaPity: 0 };
let liveOwned = new Map(); // cardId -> count

// 表示中の結果
let lastResults = []; // [{cardId, rarity, isNew, name}]
let revealTimer = null;
let revealPendingResults = null;
let revealPendingMeta = null;

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
  if (r === "UR" || r === "SSR" || r === "SR" || r === "R") return r;
  return "R";
}

function kindOf(cardData) {
  const k = String(cardData?.kind || "unit").toLowerCase();
  if (k === "card") return "unit";
  if (k === "exsupport") return "ex_support";
  return k || "unit";
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function attrOf(cardData) {
  const candidates = [cardData?.attr, cardData?.attribute, cardData?.type, cardData?.element]
    .map((v) => cleanText(v));
  for (const attr of candidates) {
    if (ATTR_LABELS.includes(attr)) return attr;
  }
  return kindOf(cardData) === "support" ? "支援" : "";
}

function attrsFromEffect(effect, out = new Set()) {
  if (!effect) return out;
  if (Array.isArray(effect)) {
    for (const item of effect) attrsFromEffect(item, out);
    return out;
  }
  if (typeof effect !== "object") return out;
  const add = (value) => {
    if (Array.isArray(value)) {
      for (const x of value) add(x);
      return;
    }
    const attr = cleanText(value);
    if (ATTR_LABELS.includes(attr)) out.add(attr);
  };
  add(effect.attr);
  add(effect.attribute);
  add(effect.attrs);
  add(effect.attrIn);
  if (effect.cond) {
    add(effect.cond.attr);
    add(effect.cond.attrIn);
  }
  attrsFromEffect(effect.effect, out);
  attrsFromEffect(effect.drawback, out);
  attrsFromEffect(effect.table, out);
  return out;
}

function attrsOfCard(cardData) {
  const set = new Set();
  const own = attrOf(cardData);
  if (own && own !== "支援") set.add(own);
  attrsFromEffect(cardData?.effect, set);
  attrsFromEffect(cardData?.effects, set);
  if (!set.size && kindOf(cardData) === "support") set.add("支援");
  return [...set];
}

function attrsOfCards(cards) {
  const set = new Set();
  for (const card of cards || []) {
    for (const attr of attrsOfCard(card)) set.add(attr);
  }
  return [...ATTR_LABELS.filter((attr) => set.has(attr)), ...(set.has("支援") ? ["支援"] : [])];
}

function attrSummaryText(attrs) {
  return (attrs && attrs.length) ? attrs.join(" / ") : "属性なし";
}

function attrChipsHtml(attrs) {
  const list = (attrs && attrs.length) ? attrs : ["属性なし"];
  return list
    .map((attr) => {
      const c = ATTR_COLORS[attr] || "rgba(255,255,255,.68)";
      return `<span class="themeAttrChip" style="--attr-c:${escapeHtml(c)}">${escapeHtml(attr)}</span>`;
    })
    .join("");
}

function themeLabelOf(cardData) {
  if (isJewelCard(cardData)) return "\u5b9d\u77f3";
  if (isFairyCard(cardData)) return "\u7ae5\u8a71";
  if (isTokioriCard(cardData)) return "\u6642\u7e54";
  return "\u95c7\u934b";
}

function themeKeyOf(label) {
  const s = cleanText(label).toLowerCase();
  if (!s || s === "\u95c7\u934b" || s === "__all__" || s === "mix") return "mix";
  if (s.includes("\u5b9d\u77f3") || s.includes("jewel") || s.includes("gem")) return "jewel";
  if (s.includes("\u6642\u7e54") || s.includes("tokiori")) return "tokiori";
  if (s.includes("\u7ae5\u8a71") || s.includes("fairy")) return "fairy";
  return "mix";
}

function selectedTheme() {
  return bannerThemes.find((t) => t.key === currentThemeKey) || bannerThemes[0] || null;
}

function isThemeMatch(card) {
  if (currentThemeKey === "jewel") return isJewelCard(card);
  if (currentThemeKey === "tokiori") return isTokioriCard(card) && kindOf(card) !== "support";
  if (currentThemeKey === "fairy") return isFairyCard(card) && kindOf(card) !== "support";
  return true;
}

function byRarityFor(cards) {
  const byRarity = { UR: [], SSR: [], SR: [], R: [] };
  for (const c of cards) byRarity[rarityOf(c)]?.push(c);
  return byRarity;
}

function searchTextOf(card) {
  return [
    card?.id,
    card?.name,
    card?.theme,
    card?.pack,
    card?.series,
    card?.source,
    card?.set,
    card?.collection,
  ]
    .map((v) => String(v || ""))
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}

function isFairyCard(card) {
  const text = searchTextOf(card);
  return text.includes("fairy_tale") || text.includes("fairy") || text.includes("\u7ae5\u8a71") || String(card?.id || "").startsWith("ft_");
}

function isTokioriCard(card) {
  const text = searchTextOf(card);
  return text.includes("\u6642\u7e54") || text.includes("tokiori") || text.includes("timeweave");
}

function isJewelCard(card) {
  const text = searchTextOf(card);
  return (
    text.includes("\u5b9d\u77f3") ||
    text.includes("jewel") ||
    text.includes("gem_") ||
    String(card?.id || "").startsWith("gem_")
  );
}

function gachaEligibleCards() {
  return cardCatalog.filter(
    (c) => !isStarterCardDef(c.id, c) && kindOf(c) !== "ex_support",
  );
}

function rebuildBannerPools() {
  const eligible = gachaEligibleCards();
  let cards = eligible.filter(isThemeMatch);
  const themeAllowsSupport = currentThemeKey === "mix" || currentThemeKey === "jewel";
  if (!themeAllowsSupport) cards = cards.filter((c) => kindOf(c) !== "support");
  const supportCards = themeAllowsSupport ? cards.filter((c) => kindOf(c) === "support") : [];

  bannerPools = {
    unit: {
      cards,
      byRarity: { UR: [], SSR: [], SR: [], R: [] },
    },
    support: {
      cards: supportCards,
      byRarity: { UR: [], SSR: [], SR: [], R: [] },
    },
  };
  bannerPools.unit.byRarity = byRarityFor(bannerPools.unit.cards);
  bannerPools.support.byRarity = byRarityFor(bannerPools.support.cards);
}

function buildBannerThemes() {
  const eligible = gachaEligibleCards();
  const makeStats = (key, label, cards, kicker, desc) => {
    const s = { key, label, kicker, desc, attrs: attrsOfCards(cards), total: cards.length, unit: 0, support: 0, ur: 0, ssr: 0, sr: 0, r: 0 };
    for (const c of cards) {
    if (kindOf(c) === "support") s.support += 1;
    else s.unit += 1;
    const rar = rarityOf(c).toLowerCase();
      if (rar === "ur") s.ur += 1;
      else if (rar === "ssr") s.ssr += 1;
    else if (rar === "sr") s.sr += 1;
    else s.r += 1;
    }
    return s;
  };

  const tokioriCards = eligible.filter((c) => isTokioriCard(c) && kindOf(c) !== "support");
  const fairyCards = eligible.filter((c) => isFairyCard(c) && kindOf(c) !== "support");
  const jewelCards = eligible.filter((c) => isJewelCard(c));

  bannerThemes = [
    makeStats("mix", "\u95c7\u934b", eligible, "MIXED BANNER", "\u30ad\u30e3\u30e9\u3082\u30b5\u30dd\u30fc\u30c8\u3082\u5168\u90e8\u3054\u3061\u3083\u307e\u305c\u3002"),
    makeStats("jewel", "\u5b9d\u77f3", jewelCards, "JEWEL POOL", "\u5b9d\u77f3\u30b7\u30ea\u30fc\u30ba\u5168\u822c\u3002\u30ad\u30e3\u30e9\u3068\u30b5\u30dd\u30fc\u30c8\u3092\u307e\u3068\u3081\u3066\u6392\u51fa\u3002"),
    makeStats("tokiori", "\u6642\u7e54", tokioriCards, "THEME BANNER", "\u6642\u7e54\u30b7\u30ea\u30fc\u30ba\u306e\u30ad\u30e3\u30e9\u3060\u3051\u3002"),
    makeStats("fairy", "\u7ae5\u8a71", fairyCards, "FAIRY TALE", "\u7ae5\u8a71\u30b7\u30ea\u30fc\u30ba\u306e\u30ad\u30e3\u30e9\u3060\u3051\u3002"),
  ];
  if (!bannerThemes.some((x) => x.key === currentThemeKey)) currentThemeKey = THEME_ALL_KEY;
}

function themeDeckSubtitle(t) {
  if (!t) return "";
  return `${t.desc || ""}\n排出属性: ${attrSummaryText(t.attrs)}\n\u30ad\u30e3\u30e9 ${t.unit} / \u30b5\u30dd\u30fc\u30c8 ${t.support} / SSR ${t.ssr}${t.ur ? ` / UR ${t.ur}` : ""}`;
}

function themeDeckSubtitleSimple(t) {
  if (!t) return "";
  const counts = [
    t.unit ? `\u30ad\u30e3\u30e9${t.unit}` : "",
    t.support ? `\u30b5\u30dd\u30fc\u30c8${t.support}` : "",
    t.ssr ? `SSR${t.ssr}` : "",
    t.ur ? `UR${t.ur}` : "",
  ].filter(Boolean).join(" / ");
  return `${t.desc || ""} / \u5c5e\u6027:${attrSummaryText(t.attrs)} / ${counts}`;
}

function renderThemeDeck() {
  if (!themeDeck) return;
  themeDeck.innerHTML = "";
  let activeButton = null;
  for (const t of bannerThemes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `themeCard theme-${escapeHtml(t.key)}` + (t.key === currentThemeKey ? " active" : "");
    btn.dataset.themeKey = t.key;
    btn.innerHTML = `
      <span class="themeKicker">${escapeHtml(t.kicker || (t.key === THEME_ALL_KEY ? "MIXED BANNER" : "THEME BANNER"))}</span>
      <span class="themeName">${escapeHtml(t.label)}</span>
      <span class="themeAttrRail" aria-label="排出属性">${attrChipsHtml(t.attrs)}</span>
      <span class="themeMeta">${escapeHtml(themeDeckSubtitleSimple(t))}</span>
      <span class="themeCount">${t.total}</span>
    `;
    btn.addEventListener("click", () => setActiveTheme(t.key));
    themeDeck.appendChild(btn);
    if (t.key === currentThemeKey) activeButton = btn;
  }
  if (activeButton && matchMedia("(max-width: 720px)").matches) {
    requestAnimationFrame(() => {
      activeButton.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }
}

function setActiveTheme(key) {
  currentThemeKey = key || THEME_ALL_KEY;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentThemeKey);
  } catch {}
  rebuildBannerPools();
  currentBanner = "unit";
  renderThemeDeck();
  setActiveBanner(currentBanner);
}

function bannerLabel(kind = currentBanner) {
  const theme = selectedTheme();
  if (theme?.key === "mix") return "\u95c7\u934b\u30ac\u30c1\u30e3";
  return `${theme?.label || "\u30c6\u30fc\u30de"}\u30ac\u30c1\u30e3`;
}

function setActiveBanner(kind) {
  currentBanner = "unit";
  const pool = bannerPools[currentBanner] || bannerPools.unit;
  allCards = pool.cards || [];
  cardsByRarity = pool.byRarity || { UR: [], SSR: [], SR: [], R: [] };
  if (btnUnitBanner) {
    btnUnitBanner.classList.add("active");
    btnUnitBanner.textContent = "\u6392\u51fa\u5bfe\u8c61";
  }
  if (btnSupportBanner) {
    const theme = selectedTheme();
    btnSupportBanner.classList.remove("active");
    btnSupportBanner.textContent = theme?.key === "jewel"
      ? "\u5b9d\u77f3\u30b5\u30dd\u30fc\u30c8\u542b\u3080"
      : theme?.key === "mix"
        ? "\u30b5\u30dd\u30fc\u30c8\u3082\u6392\u51fa"
        : "\u30ad\u30e3\u30e9\u306e\u307f";
  }
  renderThemeDeck();
  renderRateBox();
  renderBannerInfo();
  renderUserBar();
}

function prettyRatesText() {
  const ssr = RATE_BY_RARITY.SSR ?? 0;
  const sr = RATE_BY_RARITY.SR ?? 0;
  const r = RATE_BY_RARITY.R ?? 0;
  const sum = ssr + sr + r;
  const theme = selectedTheme();
  const supportLine = theme?.key === "mix" || theme?.key === "jewel"
    ? "\n\u30b5\u30dd\u30fc\u30c8\u30ab\u30fc\u30c9\u3082\u6392\u51fa\u5bfe\u8c61"
    : "\n\u30b5\u30dd\u30fc\u30c8\u306f\u6392\u51fa\u3057\u307e\u305b\u3093";
  const hasSecretUr = (cardsByRarity.UR || []).length || (cardsByRarity.SSR || []).length;
  const urLine = hasSecretUr
    ? `\n\u96a0\u3057UR:${(SECRET_UR_RATE * 100).toFixed(1)}%\uff08\u8d64\u6f14\u51fa\uff09`
    : "";
  return `${theme?.label || "\u95c7\u934b"} / ${bannerLabel()}\n\u6392\u51fa\u7387\uff08\u5408\u8a08${sum}%\uff09\nSSR:${ssr}% / SR:${sr}% / R:${r}%${urLine}\n10\u9023SR\u4ee5\u4e0a\u4fdd\u8a3c:${TEN_GUARANTEE_SR ? "ON" : "OFF"}\n\u5929\u4e95:${PITY_ENABLED ? `${PITY_MAX}\uff08SSR\u78ba\u5b9a\uff09` : "OFF"}${supportLine}\nSSR\u4e8c\u679a\u6f14\u51fa:${(MIRACLE_DOUBLE_SSR_RATE * 100).toFixed(1)}%`;
}

function setStatus(msg, kind = "normal") {
  statusTag.textContent = `\u72b6\u614b: ${msg}`;
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
    const value = typeof v === "number" ? `${v}%` : String(v);
    el.innerHTML = `${label} <b>${escapeHtml(value)}</b>`;
    return el;
  };
  if ((cardsByRarity.UR || []).length || (cardsByRarity.SSR || []).length) rateBox.appendChild(mk("ur", "UR", "SECRET"));
  rateBox.appendChild(mk("ssr", "SSR", RATE_BY_RARITY.SSR ?? 0));
  rateBox.appendChild(mk("sr", "SR", RATE_BY_RARITY.SR ?? 0));
  rateBox.appendChild(mk("r", "R", RATE_BY_RARITY.R ?? 0));
}

function renderBannerInfo() {
  const theme = selectedTheme();
  const unitCount = allCards.filter((c) => kindOf(c) !== "support").length;
  const supportCount = allCards.filter((c) => kindOf(c) === "support").length;
  if (bannerNote) {
    const attrs = attrsOfCards(allCards);
    bannerNote.textContent =
      `${theme?.label || "\u95c7\u934b"} / ${bannerLabel()}: ${allCards.length}\u679a\n` +
      `排出属性: ${attrSummaryText(attrs)}\n` +
      `UR:${cardsByRarity.UR.length} / SSR:${cardsByRarity.SSR.length} / SR:${cardsByRarity.SR.length} / R:${cardsByRarity.R.length}\n` +
      `\u30ad\u30e3\u30e9:${unitCount} / \u30b5\u30dd\u30fc\u30c8:${supportCount}\n` +
      `\u672a\u6240\u6301\u3082\u51fa\u307e\u3059\u3002\u51fa\u305f\u77ac\u9593\u306b\u30b3\u30ec\u30af\u30b7\u30e7\u30f3\u306b\u8ffd\u52a0\u3002`;
  }
  if (bannerStamp) {
    bannerStamp.textContent = `${theme?.label || "\u95c7\u934b"} / ${PITY_ENABLED ? `\u5929\u4e95 ${PITY_MAX}` : "NO PITY"}`;
  }
  if (bannerTitleEl) {
    bannerTitleEl.textContent = `${theme?.label || "\u95c7\u934b"}\u30d0\u30ca\u30fc`;
  }
  if (bannerSubEl) {
    bannerSubEl.textContent = `${bannerLabel()} / 排出属性: ${attrSummaryText(attrsOfCards(allCards))}`;
  }
}

function renderUserBar() {
  if (gemsEl) gemsEl.textContent = String(clampInt(liveUser.gems, 0, 999999));
  if (pityEl) pityEl.textContent = String(clampInt(liveUser.pity, 0, 999999));
  if (cost1El) cost1El.textContent = String(COST_SINGLE);
  if (cost10El) cost10El.textContent = String(COST_TEN);

  const can1 = liveUser.gems >= COST_SINGLE;
  const can10 = liveUser.gems >= COST_TEN;

  const hasPool = allCards.length > 0;
  if (btnSingle) btnSingle.disabled = busy || !can1 || !hasPool;
  if (btnTen) btnTen.disabled = busy || !can10 || !hasPool;
  if (btnUnitBanner) btnUnitBanner.disabled = busy;
  if (btnSupportBanner) btnSupportBanner.disabled = true;

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

function revealMetaFor(results) {
  const hasSSR = results.some((r) => r.rarity === "SSR");
  const hasSR = results.some((r) => r.rarity === "SR");
  const hasUR = results.some((r) => r.rarity === "UR");
  const miracle = results.some((r) => r.from === "miracle") && results.filter((r) => r.rarity === "SSR").length >= 2;
  let tier = "r";
  if (hasUR) tier = "ur";
  else if (hasSSR) tier = "ssr";
  else if (hasSR) tier = "sr";
  return { hasSSR, hasSR, hasUR, miracle, tier };
}

function setRevealResultText(meta) {
  if (revealHeadline) revealHeadline.className = `headline ${meta.tier}`;
  if (revealBig) revealBig.className = `bigmsg ${meta.tier}`;

  if (meta.miracle) {
    if (revealHeadline) revealHeadline.textContent = "BLACKOUT REVEAL";
    if (revealBig) revealBig.textContent = "SSR DOUBLE!!";
    if (revealSub) revealSub.textContent = "\u4e00\u77ac\u3077\u3061\u3085\u3093\u3068\u6b62\u307e\u3063\u3066\u3001\u4e8c\u3064\u306e\u91d1\u5149\u304c\u843d\u3061\u308b\u3002";
  } else if (meta.hasUR) {
    if (revealHeadline) revealHeadline.textContent = "SECRET REVEAL";
    if (revealBig) revealBig.textContent = "UR!!";
    if (revealSub) revealSub.textContent = "\u8d64\u3044\u5149\u3002\u96a0\u3057\u30ec\u30a2\u3092\u7372\u5f97\u3002";
  } else if (meta.hasSSR) {
    if (revealHeadline) revealHeadline.textContent = "GOLD REVEAL";
    if (revealBig) revealBig.textContent = "\u5927\u5f53\u305f\u308a\uff01\uff01";
    if (revealSub) revealSub.textContent = "SSR\u6392\u51fa\uff01\n\u30ab\u30fc\u30c9\u304c\u91d1\u8272\u306b\u8f1d\u304d\u307e\u3059\u3002";
  } else if (meta.hasSR) {
    if (revealHeadline) revealHeadline.textContent = "REVEAL";
    if (revealBig) revealBig.textContent = "\u5f53\u305f\u308a\uff01";
    if (revealSub) revealSub.textContent = "SR\u4ee5\u4e0a\u3092\u7372\u5f97\uff01";
  } else {
    if (revealHeadline) revealHeadline.textContent = "REVEAL";
    if (revealBig) revealBig.textContent = "\u7d50\u679c";
    if (revealSub) revealSub.textContent = "\u9752\u3044\u5149\u306e\u30ab\u30fc\u30c9\u304c\u7740\u5730\u3002";
  }
}

function renderRevealSpin(results, meta) {
  if (!revealGrid) return;
  revealGrid.innerHTML = "";
  const count = results.length;
  const board = document.createElement("div");
  board.className = `gachaSpinBoard cinematic ${count >= 10 ? "ten" : "single"} ${meta.tier || "r"}`;
  board.style.setProperty("--spin-count", String(count));
  const gate = document.createElement("div");
  gate.className = "gachaSpinGate";
  gate.innerHTML = `
    <span class="gateRing ringA"></span>
    <span class="gateRing ringB"></span>
    <span class="gateCore"></span>
    <span class="gateLabel">${escapeHtml(count >= 10 ? "TEN DRAW" : "SINGLE DRAW")}</span>
  `;
  board.appendChild(gate);
  const compactSpin = matchMedia("(max-width: 720px)").matches;
  const spreadX = count >= 10 ? (compactSpin ? 34 : 48) : 0;
  results.forEach((it, idx) => {
    const rar = String(it.rarity || "R").toLowerCase();
    const slot = document.createElement("div");
    slot.className = `gachaSpinSlot ${rar}`;
    slot.style.setProperty("--idx", String(idx));
    slot.style.setProperty("--drop-delay", `${idx * (count >= 10 ? 92 : 0)}ms`);
    slot.style.setProperty("--x", `${(idx - (count - 1) / 2) * spreadX}px`);
    slot.style.setProperty("--y", `${count >= 10 ? ((idx % 2) * 34 - 16) : 0}px`);
    slot.style.setProperty("--float", `${idx % 2 ? -10 : 10}px`);
    slot.style.setProperty("--tilt", `${(idx - (count - 1) / 2) * (count >= 10 ? 4 : 0)}deg`);
    slot.style.setProperty("--spin-speed", `${680 + (idx % 5) * 75}ms`);
    const card = document.createElement("div");
    card.className = `gachaSpinCard ${rar}`;
    card.innerHTML = `
      <span class="spinRarity">${escapeHtml(it.rarity || "R")}</span>
      <span class="spinFace"></span>
      <span class="spinBack"></span>
    `;
    slot.appendChild(card);
    board.appendChild(slot);
  });
  revealGrid.appendChild(board);

  if (revealHeadline) {
    revealHeadline.className = `headline ${meta.tier}`;
    revealHeadline.textContent = meta.miracle ? "BLACKOUT CHECK" : "SUMMONING";
  }
  if (revealBig) {
    revealBig.className = `bigmsg ${meta.tier}`;
    revealBig.textContent = "SPINNING";
  }
  if (revealSub) {
    revealSub.textContent = "カードが降ってきて回転中。光の色でレア度を示唆します。";
  }
}

function renderRevealResults(results, meta) {
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  revealPendingResults = null;
  revealPendingMeta = null;
  overlay?.classList.add("revealed");
  setRevealResultText(meta);

  if (revealGrid) {
    revealGrid.innerHTML = "";
    const count = results.length;
    results.forEach((it, idx) => {
      const c = document.createElement("div");
      c.className = `card revealCard ${String(it.rarity || "R").toLowerCase()}`;
      c.style.minHeight = "95px";
      c.style.setProperty("--delay", `${idx * (count >= 10 ? 55 : 120)}ms`);
      c.style.setProperty("--fall-x", `${(idx - (count - 1) / 2) * (count >= 10 ? 12 : 34)}px`);
      c.style.setProperty("--spin", `${720 + Math.random() * 720}deg`);

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
    });
  }

  if (meta.hasSSR || meta.hasUR || meta.miracle) {
    const box = overlay?.querySelector(".reveal");
    box?.animate(
      [
        { transform: "translateY(0px) scale(1)", filter: "brightness(1)" },
        {
          transform: `translateY(-${meta.miracle ? 6 : 2}px) scale(${meta.miracle ? 1.025 : 1.01})`,
          filter: `brightness(${meta.miracle ? 1.32 : 1.12})`,
        },
        { transform: "translateY(0px) scale(1)", filter: "brightness(1)" },
      ],
      { duration: meta.miracle ? 920 : 520, iterations: 1, easing: "cubic-bezier(.2,.9,.2,1)" },
    );
  }
  launchConfetti(meta.miracle ? 86 : meta.hasUR ? 74 : meta.hasSSR ? 46 : meta.hasSR ? 26 : 12);
}

function openRevealOverlay(results) {
  if (!overlay) return;

  overlay.className = "overlay";
  overlay.querySelector(".confetti")?.remove();
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  const meta = revealMetaFor(results);

  overlay.classList.add("on", results.length >= 10 ? "pull-ten" : "pull-single");
  if (meta.miracle) overlay.classList.add("miracle");
  if (meta.hasUR) overlay.classList.add("has-ur");
  revealPendingResults = results;
  revealPendingMeta = meta;
  renderRevealSpin(results, meta);
  revealTimer = setTimeout(() => {
    renderRevealResults(results, meta);
  }, REVEAL_SPIN_MS);
}

function closeRevealOverlay() {
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = null;
  }
  revealPendingResults = null;
  revealPendingMeta = null;
  overlay?.classList.remove("on", "pull-single", "pull-ten", "miracle", "has-ur", "revealed");
  overlay?.querySelector(".confetti")?.remove();
}

function launchConfetti(count = 24) {
  const box = overlay?.querySelector(".reveal");
  if (!box) return;
  box.querySelector(".confetti")?.remove();
  const layer = document.createElement("div");
  layer.className = "confetti";
  const colors = ["#ffd166", "#7dd3fc", "#a78bfa", "#7cffb2", "#fb7185", "#ffffff"];
  const width = Math.max(260, box.clientWidth || 720);
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement("i");
    const start = Math.random() * width;
    const dx = Math.round((Math.random() - 0.5) * 260);
    const dy = Math.round(190 + Math.random() * 250);
    p.style.left = `${start}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", `${dx}px`);
    p.style.setProperty("--dy", `${dy}px`);
    p.style.setProperty("--rot", `${180 + Math.random() * 720}deg`);
    p.style.animationDelay = `${Math.random() * 180}ms`;
    p.style.animationDuration = `${850 + Math.random() * 750}ms`;
    layer.appendChild(p);
  }
  box.appendChild(layer);
}

btnRevealClose?.addEventListener("click", closeRevealOverlay);
btnRevealSkip?.addEventListener("click", () => {
  if (revealPendingResults && revealPendingMeta) {
    renderRevealResults(revealPendingResults, revealPendingMeta);
  } else {
    closeRevealOverlay();
  }
});
overlay?.addEventListener("click", (e) => {
  if (e.target === overlay) closeRevealOverlay();
});

// =====================
// 抽選
// =====================
function pickRarityWeighted(onlyAtLeastSR = false) {
  if (
    !onlyAtLeastSR &&
    ((cardsByRarity.UR || []).length || (cardsByRarity.SSR || []).length) &&
    Math.random() < SECRET_UR_RATE
  ) {
    return "UR";
  }

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
    if (rar === "UR") return pickCardIdByRarity("SSR");
    if (rar === "SSR") return pickCardIdByRarity("SR");
    if (rar === "SR") return pickCardIdByRarity("R");
    const any = allCards;
    const c = any[Math.floor(Math.random() * any.length)];
    return c?.id ?? null;
  }
  const c = pool[Math.floor(Math.random() * pool.length)];
  return c?.id ?? null;
}

function buildResultItem(pick, ownedMapForJudge) {
  const cardId = typeof pick === "string" ? pick : pick?.cardId;
  const data = cardCatalog.find((c) => c.id === cardId) || allCards.find((c) => c.id === cardId) || null;
  const rar = String(pick?.rarity || rarityOf(data)).toUpperCase();
  const name = data?.name ?? cardId;
  const ownedCount = Number(ownedMapForJudge.get(cardId) ?? 0);
  const isNew = !(ownedCount > 0);
  return { cardId, rarity: rar, name, isNew, from: pick?.from || "rate" };
}

// =====================
// データ読み込み
// =====================
async function loadAllCards() {
  const loadCollectionSafe = async (colName, kind = "") => {
    try {
      const snap = await getDocs(collection(db, colName));
      const list = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...(d.data() || {}) };
        if (!data.kind && kind) data.kind = kind;
        list.push(data);
      });
      return list;
    } catch (e) {
      console.warn("[gacha] collection skipped", colName, e?.message || e);
      return [];
    }
  };

  const loadLocalCreatorCards = () => {
    try {
      const raw = localStorage.getItem("tcg_creator_cards_v1") || "[]";
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list
        .filter((c) => c && c.id)
        .map((c) => ({ ...c, source: c.source || "creator_local" }));
    } catch (e) {
      console.warn("[gacha] local creator cards skipped", e?.message || e);
      return [];
    }
  };

  const list = [
    ...STARTER_SUPPORT_CARDS,
    ...(await loadCollectionSafe("cards", "unit")),
    ...(await loadCollectionSafe("support_cards", "support")),
    ...(await loadCollectionSafe("supports", "support")),
    ...(await loadCollectionSafe("supportCards", "support")),
    ...(await loadCollectionSafe("ex_support_cards", "ex_support")),
    ...(await loadCollectionSafe("ex_supports", "ex_support")),
    ...(await loadCollectionSafe("exSupportCards", "ex_support")),
    ...(await loadCollectionSafe("ex_support", "ex_support")),
    ...loadLocalCreatorCards(),
  ];

  const byId = new Map(list.map((c) => [c.id, c]));
  for (const c of FAIRY_TALE_CARD_LIST) {
    byId.set(c.id, { ...c });
  }
  for (const c of JEWEL_CARD_LIST) {
    byId.set(c.id, { ...c });
  }

  cardCatalog = [...byId.values()].filter((c) => !c.hidden);
  buildBannerThemes();
  setActiveTheme(currentThemeKey);
}

function watchUser() {
  onSnapshot(userRef, async (snap) => {
    if (!snap.exists()) {
      await setDoc(
        userRef,
        { gems: 0, pity: 0, gachaPity: 0, createdAt: serverTimestamp() },
        { merge: true },
      );
      return;
    }
    const d = snap.data() || {};
    liveUser.gems = clampInt(d.gems ?? 0, 0, 999999);
    liveUser.pity = clampInt(d.pity ?? 0, 0, 999999);
    liveUser.gachaPity = clampInt(d.gachaPity ?? 0, 0, 999999);
    renderUserBar();
  });
}

function watchOwned() {
  onSnapshot(userRef, (snap) => {
    const m = new Map();
    const counts = snap.exists() ? (snap.data()?.ownedCounts || {}) : {};
    for (const [cardId, count] of Object.entries(counts)) {
      const c = clampInt(count, 0, 999999);
      if (c > 0) m.set(cardId, c);
    }
    liveOwned = m;
  });
  return;
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
  if (PITY_ENABLED && pity >= PITY_MAX - 1) {
    return { rarity: "SSR", from: "pity" };
  }

  const rar = pickRarityWeighted(guaranteeAtLeastSR);
  return { rarity: rar, from: guaranteeAtLeastSR ? "guarantee" : "rate" };
}

function buildPullPlan(n, pityStart) {
  const plan = [];
  const miracle = n >= 10 && Math.random() < MIRACLE_DOUBLE_SSR_RATE;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    if (miracle && i >= n - 2) {
      plan.push({ rarity: "SSR", from: "miracle" });
      continue;
    }
    const guarantee = n >= 10 && TEN_GUARANTEE_SR && isLast;
    const pick = computeOnePull({ pity: pityStart + i, guaranteeAtLeastSR: guarantee });
    plan.push({ ...pick });
  }
  return plan;
}

function applyPityAfterResults(pityStart, results) {
  if (!PITY_ENABLED) return 0;
  const gotSSR = results.some((r) => r.rarity === "SSR" || r.rarity === "UR");
  if (gotSSR) return 0;
  // SSRが出なければ「引いた回数」だけ進める
  return pityStart + results.length;
}

async function doGacha(n) {
  if (busy) return;
  if (!allCards.length) {
    toastMsg(bannerLabel() + " pool is empty", true);
    return;
  }

  const cost = n === 10 ? COST_TEN : COST_SINGLE;
  if (liveUser.gems < cost) {
    toastMsg("not enough gems", true);
    return;
  }

  busy = true;
  setStatus("drawing...", "normal");
  renderUserBar();

  try {
    const ownedBefore = new Map(liveOwned);

    const outResults = await runTransaction(db, async (tx) => {
      const us = await tx.get(userRef);
      if (!us.exists()) {
        tx.set(userRef, { gems: 0, pity: 0, gachaPity: 0, createdAt: serverTimestamp() }, { merge: true });
      }
      const u = (us.exists() ? us.data() : {}) || {};
      const gems = clampInt(u.gems ?? 0, 0, 999999);
      const pityPoint0 = clampInt(u.pity ?? 0, 0, 999999);
      const gachaPity0 = clampInt(u.gachaPity ?? 0, 0, 999999);

      if (gems < cost) throw new Error("not enough gems");

      const plan = buildPullPlan(n, gachaPity0);
      const picks = [];
      for (const p of plan) {
        const cardId = pickCardIdByRarity(p.rarity);
        if (!cardId) throw new Error("empty gacha pool");
        picks.push({ cardId, rarity: p.rarity, from: p.from });
      }

      const now = serverTimestamp();
      const addCounts = new Map();
      for (const it of picks) {
        addCounts.set(it.cardId, (addCounts.get(it.cardId) || 0) + 1);
      }
      const ownedCounts = { ...(u.ownedCounts || {}) };
      for (const [cardId, add] of addCounts) {
        ownedCounts[cardId] = clampInt(ownedCounts[cardId] ?? 0, 0, 999999) + add;
      }

      const nextGachaPity = applyPityAfterResults(gachaPity0, picks);
      const pointGain = n >= 10 ? GROWTH_GAIN_TEN : 0;

      tx.set(
        userRef,
        {
          gems: gems - cost,
          pity: pityPoint0 + pointGain,
          gachaPity: nextGachaPity,
          ownedCounts,
          updatedAt: now,
        },
        { merge: true },
      );

      return {
        picks,
        pity0: pityPoint0,
        nextPity: pityPoint0 + pointGain,
        pityGain: pointGain,
        gachaPity0,
        nextGachaPity,
        gems0: gems,
        gems1: gems - cost,
      };
    });

    const picks = outResults?.picks || [];
    const results = picks.map((p) => buildResultItem(p, ownedBefore));

    lastResults = results;
    renderResultsGrid(results);
    openRevealOverlay(results);

    const hasJackpot = results.some((r) => r.rarity === JACKPOT_RARITY);
    setStatus(hasJackpot ? "jackpot" : "done", hasJackpot ? "good" : "normal");

    const gainText = outResults?.pityGain ? " (+" + outResults.pityGain + ")" : "";
    toastMsg(
      "-" + cost + " gems / growth:" + (outResults?.pity0 ?? "?") + "->" + (outResults?.nextPity ?? "?") + gainText + " / gachaPity:" + (outResults?.gachaPity0 ?? "?") + "->" + (outResults?.nextGachaPity ?? "?"),
      false,
    );
  } catch (e) {
    console.error(e);
    setStatus("failed", "bad");
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
btnUnitBanner?.addEventListener("click", () => setActiveBanner("unit"));
btnSupportBanner?.addEventListener("click", () => setActiveTheme("mix"));

btnClear?.addEventListener("click", async () => {
  // 注意：owned の全削除は権限が必要なので、ここでは “pityだけリセット” にする
  try {
    await setDoc(
      userRef,
      { gachaPity: 0, updatedAt: serverTimestamp() },
      { merge: true },
    );
    toastMsg("gachaPity reset");
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
    await ensureStarterOwnedCards(
      playerId,
      Object.fromEntries(cardCatalog.map((c) => [c.id, c])),
    );
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
