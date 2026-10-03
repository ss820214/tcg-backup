// public/audit_core_20260825.js
// Shared read-only helpers for UI health/card audit pages.

export const AUDIT_VERSION = "20260825_audit1";

export const KNOWN_ATTRS = ["火", "水", "雷", "草", "風", "鋼", "光", "闇", "幻", "呪"];

const MODULES = [
  ["fairy_tale_cards", "./fairy_tale_cards.js?v=20260726_fairy_rate_down1"],
  ["starter_support_cards", "./starter_support_cards.js?v=20260706_starter_support_fallback1"],
  ["card_art_manifest", "./card_art_manifest.js?v=20260731_all_local_art1"],
  ["card_illustrations", "./card_illustrations.js?v=20260725_dark_illusion_gen1"],
];

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeKind(def = {}) {
  const kind = String(def.kind || "").toLowerCase();
  const type = String(def.type || "").toLowerCase();
  if (kind.includes("support") || type === "support" || type.includes("support") || def.effect) return "support";
  return "unit";
}

export function cardAttr(def = {}) {
  return String(def.attr || def.type || "").trim();
}

export function actionList(def = {}) {
  if (Array.isArray(def.actions)) return def.actions;
  if (Array.isArray(def.acts)) return def.acts;
  if (Array.isArray(def.skills)) return def.skills;
  return [];
}

function addCardsFromExport(bucket, source, value) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    if (!item.id && !item.name) continue;
    bucket.push({ ...item, __source: source });
  }
}

function collectModuleCards(name, mod) {
  const cards = [];
  for (const [key, value] of Object.entries(mod || {})) {
    addCardsFromExport(cards, `${name}.${key}`, value);
  }
  return cards;
}

export async function loadAuditData() {
  const loaded = {};
  const errors = [];
  for (const [name, path] of MODULES) {
    try {
      loaded[name] = await import(path);
    } catch (err) {
      errors.push({ name, path, message: err?.message || String(err) });
    }
  }

  const cards = [];
  for (const [name, mod] of Object.entries(loaded)) {
    cards.push(...collectModuleCards(name, mod));
  }

  const byId = new Map();
  const duplicates = new Map();
  for (const card of cards) {
    const id = String(card.id || "").trim();
    if (!id) continue;
    if (byId.has(id)) {
      if (!duplicates.has(id)) duplicates.set(id, [byId.get(id)]);
      duplicates.get(id).push(card);
    } else {
      byId.set(id, card);
    }
  }

  const artIds = loaded.card_art_manifest?.CARD_ART_IDS || new Set();
  const illustrations = loaded.card_illustrations?.CARD_ILLUSTRATIONS || {};
  return { loaded, errors, cards, byId, duplicates, artIds, illustrations };
}

export function inspectCard(card, ctx = {}) {
  const issues = [];
  const id = String(card.id || "").trim();
  const kind = normalizeKind(card);
  const attr = cardAttr(card);
  const actions = actionList(card);

  if (!id) issues.push({ level: "bad", label: "IDなし" });
  if (!String(card.name || "").trim()) issues.push({ level: "bad", label: "名前なし" });

  if (kind === "unit") {
    if (!KNOWN_ATTRS.includes(attr)) issues.push({ level: "warn", label: `属性未確認: ${attr || "なし"}` });
    if (!Number(card.hp)) issues.push({ level: "warn", label: "HPなし" });
    if (!Number(card.sp)) issues.push({ level: "warn", label: "SPなし" });
    if (!actions.length) issues.push({ level: "warn", label: "技なし" });
  } else {
    if (Number(card.hp) || Number(card.sp)) issues.push({ level: "warn", label: "サポートにHP/SP" });
    if (!card.effect && !actions.length) issues.push({ level: "warn", label: "効果なし" });
  }

  if (ctx.duplicates?.has(id)) issues.push({ level: "bad", label: "ID重複" });

  const hasArt = (ctx.artIds && ctx.artIds.has?.(id)) || Boolean(ctx.illustrations?.[id]);
  if (!hasArt) issues.push({ level: "note", label: "専用イラスト未確認" });

  const actionText = JSON.stringify(actions);
  if (/role:|attr:|\[object Object\]|__source|originActions/i.test(actionText)) {
    issues.push({ level: "bad", label: "内部タグ混入の疑い" });
  }

  return { id, kind, attr, actions, issues, hasArt };
}

export function summarizeAudit(ctx) {
  const rows = ctx.cards.map((card) => ({ card, ...inspectCard(card, ctx) }));
  const bad = rows.filter((r) => r.issues.some((i) => i.level === "bad")).length;
  const warn = rows.filter((r) => r.issues.some((i) => i.level === "warn")).length;
  const missingArt = rows.filter((r) => !r.hasArt).length;
  const units = rows.filter((r) => r.kind === "unit").length;
  const supports = rows.filter((r) => r.kind === "support").length;
  return { rows, bad, warn, missingArt, units, supports, total: rows.length };
}
