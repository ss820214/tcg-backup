import { db, ensureSignedIn } from "./auth.js?v=20260627_perm1";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { cardArtImgHtml } from "./card_art.js?v=20260828_jewel_art1";
import { FAIRY_TALE_CARDS } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { JEWEL_CARDS } from "./jewel_cards.js?v=20260828_jewel_art1";
import { STARTER_SUPPORT_CARD_MAP } from "./starter_support_cards.js?v=20260706_starter_support_all1";
import { supportEffectTextJa } from "./support_text.js?v=20260827_jewel1";
import {
  ensureStarterOwnedCards,
  getOwnedCounts,
  isFairyTaleCardId,
  isStarterCardDef,
  YOU_CARD_ID,
} from "./user_store.js?v=20260906_curse1";

const ATTR_COLORS = {
  火: "#ff5d65",
  水: "#58a8ff",
  雷: "#ffd84f",
  草: "#65e294",
  風: "#87dfbd",
  鋼: "#c2c9d0",
  光: "#ffe96b",
  闇: "#b876ff",
  幻: "#ff93ec",
  呪: "#7e5cff",
  支援: "#b9c2cc",
};

const state = {
  cards: [],
  owned: {},
  selectedId: "",
  filters: {
    q: "",
    kind: "all",
    attr: "all",
    owned: "all",
    series: "all",
  },
};

const els = {
  stats: document.getElementById("stats"),
  grid: document.getElementById("cardGrid"),
  gridNote: document.getElementById("gridNote"),
  detail: document.getElementById("detail"),
  detailNote: document.getElementById("detailNote"),
  search: document.getElementById("carddexSearch"),
  series: document.getElementById("seriesFilter"),
};

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return v.split(/[,+]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function normalizeKind(kind, def = {}) {
  const raw = String(kind || def.kind || def.type || "").toLowerCase();
  if (raw.includes("ex")) return "ex_support";
  if (raw.includes("support") || raw.includes("サポ")) return "support";
  return "unit";
}

function kindLabel(kind) {
  if (kind === "ex_support") return "EX";
  if (kind === "support") return "サポート";
  return "キャラ";
}

function attrOf(def = {}) {
  const kind = normalizeKind(def.kind, def);
  if (kind !== "unit") return "支援";
  return String(def.attr || def.element || def.type || "無").trim();
}

function seriesInfo(id, def = {}) {
  const seriesRaw = String(def.series || def.pack || def.theme || def.category || "").trim();
  if (id === YOU_CARD_ID) return { key: "starter", label: "YOU" };
  if (isFairyTaleCardId(id) || FAIRY_TALE_CARDS[id] || /童話|fairy/i.test(seriesRaw)) {
    return { key: "fairy", label: "童話" };
  }
  if (JEWEL_CARDS[id] || /宝石|jewel/i.test(seriesRaw)) {
    return { key: "jewel", label: "宝石" };
  }
  if (isStarterCardDef(id, def)) return { key: "starter", label: "初期" };
  if (normalizeKind(def.kind, def) !== "unit") return { key: "support", label: "サポート" };
  if (/ガチャ|gacha/i.test(seriesRaw) || !seriesRaw) return { key: "gacha", label: "ガチャ" };
  return { key: "custom", label: seriesRaw || "その他" };
}

function normalizeCard(id, def = {}) {
  const kind = normalizeKind(def.kind, def);
  const attr = attrOf({ ...def, kind });
  const series = seriesInfo(id, { ...def, kind });
  const actions = asArray(def.actions || def.skills || def.action || def.moves);
  const cost = Number(def.cost ?? def.mana ?? 0) || 0;
  const hp = Number(def.hp ?? def.HP ?? 0) || 0;
  const sp = Number(def.sp ?? def.SP ?? 0) || 0;
  const name = String(def.name || def.title || id);
  return {
    ...def,
    id,
    name,
    kind,
    attr,
    seriesKey: series.key,
    seriesLabel: series.label,
    actions,
    cost,
    hp,
    sp,
    rarity: String(def.rarity || def.rank || "R").toUpperCase(),
    hidden: !!def.hidden,
  };
}

async function loadCollectionSafe(name, forcedKind = "") {
  try {
    const snap = await getDocs(collection(db, name));
    const out = {};
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const id = String(data.id || doc.id);
      out[id] = { ...data, id, kind: normalizeKind(forcedKind || data.kind, data) };
    });
    return out;
  } catch (err) {
    console.warn(`[carddex] ${name} failed`, err);
    return {};
  }
}

function dedupe(rawMap) {
  const out = {};
  const supportKeys = new Set();
  for (const [rawId, rawDef] of Object.entries(rawMap || {})) {
    const id = String(rawDef?.id || rawId);
    const def = normalizeCard(id, rawDef);
    if (def.kind !== "unit") {
      const key = [
        def.name,
        def.cost,
        JSON.stringify(def.effect || def.effects || ""),
      ].join("::");
      if (supportKeys.has(key)) continue;
      supportKeys.add(key);
    }
    out[id] = def;
  }
  return Object.values(out).sort((a, b) => {
    const ka = a.kind === "unit" ? 0 : 1;
    const kb = b.kind === "unit" ? 0 : 1;
    if (ka !== kb) return ka - kb;
    const attr = String(a.attr).localeCompare(String(b.attr), "ja");
    if (attr) return attr;
    return (a.cost - b.cost) || a.name.localeCompare(b.name, "ja");
  });
}

async function loadCards() {
  const [
    base,
    supportsA,
    supportsB,
    supportsC,
    exA,
    exB,
    exC,
    exD,
  ] = await Promise.all([
    loadCollectionSafe("cards", "unit"),
    loadCollectionSafe("support_cards", "support"),
    loadCollectionSafe("supports", "support"),
    loadCollectionSafe("supportCards", "support"),
    loadCollectionSafe("ex_support_cards", "ex_support"),
    loadCollectionSafe("ex_supports", "ex_support"),
    loadCollectionSafe("exSupportCards", "ex_support"),
    loadCollectionSafe("ex_support", "ex_support"),
  ]);
  return dedupe({
    ...STARTER_SUPPORT_CARD_MAP,
    ...supportsA,
    ...supportsB,
    ...supportsC,
    ...exA,
    ...exB,
    ...exC,
    ...exD,
    ...base,
    ...FAIRY_TALE_CARDS,
    ...JEWEL_CARDS,
  });
}

function ownedCount(card) {
  return Number(state.owned?.[card.id] || 0);
}

function matches(card) {
  const { q, kind, attr, owned, series } = state.filters;
  if (kind !== "all") {
    if (kind === "unit" && card.kind !== "unit") return false;
    if (kind === "support" && card.kind === "unit") return false;
  }
  if (attr !== "all" && card.attr !== attr) return false;
  if (series !== "all" && card.seriesKey !== series) return false;
  const count = ownedCount(card);
  if (owned === "owned" && count <= 0) return false;
  if (owned === "missing" && count > 0) return false;
  if (q) {
    const hay = `${card.name} ${card.id} ${card.seriesLabel} ${card.attr} ${card.rarity}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  return true;
}

function fallbackArt(card, className = "fallbackArt") {
  const color = ATTR_COLORS[card.attr] || ATTR_COLORS.支援;
  const label = card.kind === "unit" ? card.attr : "補";
  return `<div class="${className}" style="--attrGlow:${esc(color)}66">${esc(label)}</div>`;
}

function artHtml(card, wrapperClass = "cardThumb") {
  const img = cardArtImgHtml(card.id, card, "cardArtImg");
  return `<div class="${wrapperClass}" style="--attrGlow:${esc(ATTR_COLORS[card.attr] || ATTR_COLORS.支援)}66">${img || fallbackArt(card)}</div>`;
}

function actionTitle(action, i) {
  if (!action) return `技${i + 1}`;
  return action.name || action.label || action.title || `技${i + 1}`;
}

function rangeText(range) {
  const raw = String(range || "self");
  if (raw === "self" || raw === "自分") return "自分";
  return raw
    .replaceAll("front", "↑")
    .replaceAll("back", "↓")
    .replaceAll("side", "←→")
    .replaceAll("rf", "↗")
    .replaceAll("lf", "↖")
    .replaceAll("rb", "↘")
    .replaceAll("lb", "↙");
}

function actionSummary(action, i) {
  const cost = Number(action?.cost ?? action?.mana ?? 0) || 0;
  const rate = action?.rate ?? action?.success ?? action?.pct ?? "";
  const hp = Number(action?.hpDelta ?? action?.hp ?? 0) || 0;
  const sp = Number(action?.spDelta ?? action?.sp ?? 0) || 0;
  const draw = Number(action?.draw ?? action?.n ?? 0) || 0;
  const status = action?.status || action?.addStatus || "";
  const parts = [`[${cost}] ${actionTitle(action, i)}`];
  if (action?.range) parts.push(`射程 ${rangeText(action.range)}`);
  if (rate !== "") parts.push(`成功${rate}%`);
  if (hp) parts.push(`${hp < 0 ? "赤ハート" : "緑ハート"}${hp > 0 ? "+" : ""}${hp}`);
  if (sp) parts.push(`青ハート${sp > 0 ? "+" : ""}${sp}`);
  if (draw) parts.push(`ドロー+${draw}`);
  if (status) parts.push(`状態:${status}`);
  return parts.join(" / ");
}

function cardSummary(card) {
  if (card.kind !== "unit") {
    try {
      return supportEffectTextJa(card.effect || card.effects || card);
    } catch {
      return String(card.effectText || card.text || card.desc || "効果は詳細で確認");
    }
  }
  if (card.actions?.length) return actionSummary(card.actions[0], 0);
  return card.desc || "技なし";
}

function renderStats(list) {
  const owned = state.cards.filter((c) => ownedCount(c) > 0).length;
  const missing = state.cards.length - owned;
  els.stats.innerHTML = `
    <div class="stat"><span>表示</span><b>${list.length}</b></div>
    <div class="stat"><span>所持済み</span><b>${owned}</b></div>
    <div class="stat"><span>未所持</span><b>${missing}</b></div>
    <div class="stat"><span>総カード</span><b>${state.cards.length}</b></div>
  `;
}

function renderGrid() {
  const list = state.cards.filter(matches);
  renderStats(list);
  els.gridNote.textContent = `${list.length}件`;
  if (!list.length) {
    els.grid.innerHTML = `<div class="empty">条件に合うカードがありません。</div>`;
    return;
  }
  els.grid.innerHTML = list.map((card) => {
    const count = ownedCount(card);
    const color = ATTR_COLORS[card.attr] || ATTR_COLORS.支援;
    const active = card.id === state.selectedId ? " active" : "";
    const locked = count <= 0 ? " locked" : "";
    const support = card.kind !== "unit" ? " support" : "";
    const hpSp = card.kind === "unit" ? `<span class="pill">HP ${card.hp} / SP ${card.sp}</span>` : "";
    return `
      <button class="dexCard${active}${locked}${support}" type="button" data-card-id="${esc(card.id)}" style="border-left-color:${esc(color)}">
        ${artHtml(card)}
        <div class="dexName">${esc(card.name)}</div>
        <div class="dexMeta">
          <span class="pill">${esc(kindLabel(card.kind))}</span>
          <span class="pill">${esc(card.attr)}</span>
          <span class="pill">${esc(card.seriesLabel)}</span>
          <span class="pill ${count > 0 ? "owned" : "missing"}">x${count}</span>
        </div>
        <div class="dexSub" style="margin-top:7px">
          <span class="pill">${esc(card.rarity)}</span>
          <span class="pill">コスト ${card.cost}</span>
          ${hpSp}
        </div>
        <div class="dexText">${esc(cardSummary(card))}</div>
      </button>
    `;
  }).join("");
}

function renderDetail(card) {
  if (!card) {
    els.detailNote.textContent = "カードを選択";
    els.detail.innerHTML = `<div class="empty">左のカードを選ぶと、ここに図鑑情報が出ます。</div>`;
    return;
  }
  const count = ownedCount(card);
  const maxHp = Math.max(120, card.hp || 1);
  const maxSp = Math.max(60, card.sp || 1);
  const unitStats = card.kind === "unit" ? `
    <div class="bars">
      <div class="barRow"><span>HP</span><div class="bar"><i style="width:${Math.min(100, card.hp / maxHp * 100)}%"></i></div><b>${card.hp}</b></div>
      <div class="barRow"><span>SP</span><div class="bar"><i style="width:${Math.min(100, card.sp / maxSp * 100)}%"></i></div><b>${card.sp}</b></div>
    </div>
  ` : "";
  const actionHtml = card.kind === "unit"
    ? (card.actions?.length ? card.actions.map((a, i) => `
      <div class="actionItem">
        <div class="actionTop"><span>${esc(actionTitle(a, i))}</span><span>消費${esc(a?.cost ?? a?.mana ?? 0)}</span></div>
        <div class="actionText">${esc(actionSummary(a, i))}</div>
      </div>
    `).join("") : `<div class="actionItem"><div class="actionText">技なし</div></div>`)
    : `<div class="actionItem"><div class="actionText">${esc(cardSummary(card))}</div></div>`;
  els.detailNote.textContent = card.id;
  els.detail.innerHTML = `
    <div class="detailHero">
      ${artHtml(card, "detailArt")}
      <div>
        <h3 class="detailName">${esc(card.name)}</h3>
        <div class="detailId">${esc(card.id)}</div>
        <div class="chips">
          <span class="pill">${esc(kindLabel(card.kind))}</span>
          <span class="pill">${esc(card.attr)}</span>
          <span class="pill">${esc(card.rarity)}</span>
          <span class="pill">${esc(card.seriesLabel)}</span>
          <span class="pill ${count > 0 ? "owned" : "missing"}">所持 x${count}</span>
        </div>
        ${unitStats}
      </div>
    </div>
    ${card.desc ? `<div class="sectionTitle">説明</div><div class="actionItem"><div class="actionText">${esc(card.desc)}</div></div>` : ""}
    <div class="sectionTitle">${card.kind === "unit" ? "技" : "効果"}</div>
    <div class="actionList">${actionHtml}</div>
  `;
}

function selectCard(id) {
  state.selectedId = id;
  const card = state.cards.find((c) => c.id === id);
  renderGrid();
  renderDetail(card);
}

function setActive(groupSelector, attr, value, activeClass = "active") {
  document.querySelectorAll(`${groupSelector} [data-${attr}]`).forEach((btn) => {
    btn.classList.toggle(activeClass, btn.dataset[attr] === value);
  });
}

function bindFilters() {
  els.search?.addEventListener("input", () => {
    state.filters.q = els.search.value.trim();
    renderGrid();
  });
  els.series?.addEventListener("change", () => {
    state.filters.series = els.series.value;
    renderGrid();
  });
  document.querySelector("[data-kind-filters]")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-kind]");
    if (!btn) return;
    state.filters.kind = btn.dataset.kind;
    setActive("[data-kind-filters]", "kind", state.filters.kind);
    renderGrid();
  });
  document.querySelector("[data-attr-filters]")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-attr]");
    if (!btn) return;
    state.filters.attr = btn.dataset.attr;
    setActive("[data-attr-filters]", "attr", state.filters.attr, "attr-active");
    renderGrid();
  });
  document.querySelector("[data-owned-filters]")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-owned]");
    if (!btn) return;
    state.filters.owned = btn.dataset.owned;
    setActive("[data-owned-filters]", "owned", state.filters.owned);
    renderGrid();
  });
  els.grid?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-card-id]");
    if (!btn) return;
    selectCard(btn.dataset.cardId);
  });
}

async function init() {
  bindFilters();
  els.grid.innerHTML = `<div class="empty">カード図鑑を読み込んでいます...</div>`;
  const params = new URLSearchParams(location.search);
  const user = await ensureSignedIn().catch(() => null);
  const uid = params.get("player") || user?.uid || "";
  state.cards = await loadCards();
  const defs = Object.fromEntries(state.cards.map((c) => [c.id, c]));
  if (uid) {
    await ensureStarterOwnedCards(uid, defs).catch(() => {});
    state.owned = await getOwnedCounts(uid).catch(() => ({}));
  }
  renderGrid();
  const firstOwned = state.cards.find((c) => ownedCount(c) > 0);
  selectCard((firstOwned || state.cards[0])?.id || "");
}

init().catch((err) => {
  console.error("[carddex] init failed", err);
  els.grid.innerHTML = `<div class="empty">カード図鑑の読み込みに失敗しました。コンソールを確認してください。</div>`;
});
