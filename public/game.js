// public/game.js
// v20260725_dark_illusion_gen1
// ...

import { createGameUI } from "./game_ui.js?v=20260919_hand_fan3";
import { FAIRY_TALE_CARDS } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { JEWEL_CARDS } from "./jewel_cards.js?v=20260828_jewel_art1";
import { STARTER_SUPPORT_CARD_MAP } from "./starter_support_cards.js?v=20260706_starter_support_all1";
import { cardArtImgHtml } from "./card_art.js?v=20260828_jewel_art1";

import { ensureSignedIn } from "./auth.js?v=20260627_user1";
import {
  ensureUserProfile,
  recordMatchResult,
  YOU_CARD_ID,
  normalizeYouCard,
} from "./user_store.js?v=20260723_starter_series1";

import { createCpuDriver } from "./cpu_driver.js?v=20260626_deckui_ai2";

import { setBgmMode } from "./sfx.js?v=20260626";
// ===== Support core (Support + EX) =====
import {
  applySupport,
  isSupportCard,
  resolveSupportEffect,
  applyExSupport,
} from "./support_core.js?v=20260904_status_rules1";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  nowMs,
  normalizeMana,
  spendMana,
  getManaConsts,
} from "./game_core.js?v=20260627_mana1";

import { createEvolveSystem } from "./evolve_system.js?v=20260727_evolve_inline_btn_off1";

import {
  W,
  H,
  DRAW_PER_TURN,
  summonArea,
  computeInfil,
  checkWin,
  drawCards,
  uid,
  shuffle,
  isPanic,
  getStatus,
  formatStatusList,
  applyStatusesOnHit,
  expireTurnBuffsAll, // ターン終了時の一時強化を解除
  calcHitRateWithStatus,
  checkEvade,
  isMoveBlockedByStatus,
  applyBleedOnMove,
  applySmellOnTurnEnd,
  applyPowerUpToHpDamage,
  applyArmorToHpDamage,
  parseAddStatus,
  parseTags,
  clearFatigue,
  clearStatuses,
  isAlive,
  getKnockbackDistFromAct,
  applyKnockback,
  hasSeal,
  isOffensiveAction,
  canUseActionByStatus,
  getActionCostWithStatus,
  applyRageFailurePenalty,
  checkCounter,
  hasBrainwash,
  checkBrainwashSuccess,
  applyPoisonOnTurnStart,
  isTaimanDamageAllowed,
  blocksAssist,
  isAssistAction,
  normalizeStatusKey,
} from "./game_state.js?v=20260904_status_rules1";

// ===== Field system =====
import {
  TYPE_RGB,
  hexToRgba,
  typeColorStrong,
  typeColorSoft,
  typeColor,
  ensureFieldThemeCss,
  applyFieldThemeFromState,
  ensureHandCss,
  ensureActionPickerCss,
  ensureBoardUnitCss,
  ensureBoardAssistCss,
} from "./ui_styles.js?v=20260822_hand_fit1";

import {
  normalizeFieldId,
  fieldNameJa,
  ensureFieldState,
  applyFieldMoveRule,
  applyFieldOnStepAfterMove,
  applyFieldOnTurnStart,
} from "./field_system.js?v=20260727_room_field_fix1";

import { supportEffectTextJa } from "./support_text.js?v=20260827_jewel1";
import { actionEffectTextJa } from "./action_text.js?v=20260827_jewel1";

let didGoVictory = false;

let render = (st) => {}; // Replaced when the UI renderer is installed.

function normSeat(t) {
  const s = String(t ?? "").toUpperCase();
  return s === "A" || s === "B" ? s : null;
}

// settings (optional)
let initSettings = null;
try {
  const mod = await import("./settings.js?v=20260627_rarity1");
  initSettings = mod?.initSettings || null;
} catch {}

const CORE = getManaConsts();
const MAX_MANA_UI = CORE.MAX_MANA ?? 20;
const STANDARD_MAX_MANA_UI = 6;

// 笘・ｿｽ蜉・壼ｴ縺ｮ荳企剞
const MAX_UNITS_PER_PLAYER = 5;

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com")
    ? "tcg-0bato"
    : "tcg-0bato",
};
console.log("[firebaseConfig]", firebaseConfig);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const authUser = await ensureSignedIn();
const authUid = authUser?.uid || "";
console.log("[game] auth ok", authUid);
// =====================
// DOM
// =====================

// 2026/03/13霑ｽ蜉
const enemySupportToastEl = document.getElementById("enemySupportToast");
const enemySupportToastTitleEl = document.getElementById(
  "enemySupportToastTitle",
);
const enemySupportToastBodyEl = document.getElementById(
  "enemySupportToastBody",
);
const enemySupportToastCloseEl = document.getElementById(
  "enemySupportToastClose",
);

// Score UI: replace legacy kill/infil text with meters while keeping old IDs.
const killMeterA = document.getElementById("killMeterA");
const killMeterB = document.getElementById("killMeterB");
const infilMeterA = document.getElementById("infilMeterA");
const infilMeterB = document.getElementById("infilMeterB");

const killTextA = document.getElementById("killTextA");
const killTextB = document.getElementById("killTextB");
const infilTextA = document.getElementById("infilTextA");
const infilTextB = document.getElementById("infilTextB");
const boardEl = document.getElementById("board");
const youEl = document.getElementById("you");
const turnEl = document.getElementById("turn");
const manaEl = document.getElementById("mana");
const manaGaugeEl = document.getElementById("manaGauge");
const deckCountEl = document.getElementById("deckCount");
const handEl = document.getElementById("hand");
const cardPreviewEl = document.getElementById("cardPreview");
const actionPickerEl = document.getElementById("actionPicker");
const detailEl = document.getElementById("detail");
const diceEl = document.getElementById("dice");
const logEl = document.getElementById("log");
const MOBILE_LAYOUT_QUERY = "(max-width: 760px)";

const killsEl = document.getElementById("kills");
const infilEl = document.getElementById("infil");
const modeHintEl = document.getElementById("modeHint");

const btnSummon = document.getElementById("modeSummon");
const btnMove = document.getElementById("modeMove");
const btnAttack = document.getElementById("modeAttack");
const btnEvolve = document.getElementById("modeEvolve");
const btnSupport = document.getElementById("modeSupport");
const btnDoEvolve = document.getElementById("doEvolve");
const btnEnd = document.getElementById("endTurn");
const turnBanner = document.getElementById("turnBanner");

const quickActionsEl = document.getElementById("quickActions");
const btnQuickMove = document.getElementById("quickMove");
const btnQuickAttack = document.getElementById("quickAttack");
const quickMsgEl = document.getElementById("quickMsg");

// Pinch + EX UI
const pinchFxEl = document.getElementById("pinchFx");
const exWrapEl = document.getElementById("exWrap");
const exBtnEl = document.getElementById("exBtn");
const exInfoEl = document.getElementById("exInfo");

// FX
const fxFlashEl = document.getElementById("fxFlash");

function setupCollapsiblePanel(panelEl, storageKey, collapseOnMobile = false) {
  if (!panelEl?.id) return;
  const titleEl = panelEl.previousElementSibling;
  if (!titleEl || titleEl.dataset.collapseReady === "1") return;

  titleEl.dataset.collapseReady = "1";
  titleEl.classList.add("collapsibleTitle");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "collapseToggle";
  btn.setAttribute("aria-controls", panelEl.id);
  titleEl.appendChild(btn);

  const media = window.matchMedia?.(MOBILE_LAYOUT_QUERY);
  const readStored = () => {
    try {
      return window.localStorage?.getItem(storageKey);
    } catch {
      return null;
    }
  };
  const writeStored = (value) => {
    try {
      window.localStorage?.setItem(storageKey, value ? "1" : "0");
    } catch {}
  };

  const apply = (collapsed, persist = false) => {
    const v = !!collapsed;
    panelEl.classList.toggle("isCollapsed", v);
    titleEl.classList.toggle("isCollapsed", v);
    btn.textContent = v ? "開く" : "閉じる";
    btn.setAttribute("aria-expanded", v ? "false" : "true");
    if (persist) writeStored(v);
  };

  const stored = readStored();
  apply(stored == null ? collapseOnMobile && !!media?.matches : stored === "1");

  btn.addEventListener("click", () => {
    apply(!panelEl.classList.contains("isCollapsed"), true);
  });

  media?.addEventListener?.("change", (ev) => {
    if (readStored() != null) return;
    apply(collapseOnMobile && !!ev.matches);
  });
}

function setupBattleCollapsibles() {
  setupCollapsiblePanel(detailEl, "tcgBattleDetailCollapsed", true);
  setupCollapsiblePanel(logEl, "tcgBattleLogCollapsed", true);
}

setupBattleCollapsibles();
ensureBattleCardPreviewCss();

// =====================
// v2.0.9: 荵ｱ謨ｰ隱ｿ謨ｴ繝懊ち繝ｳ・郁ｦ九◆逶ｮ縺縺托ｼ・// =====================
let rngMsgUntil = 0;
function ensureRngButton() {
  if (!logEl) return null;
  let btn = document.getElementById("btnRngReset");
  if (btn) return btn;

  btn = document.createElement("button");
  btn.id = "btnRngReset";
  btn.type = "button";
  btn.textContent = "乱数調整";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.title = "見た目だけの演出です（乱数は実際には変わりません）";

  const parent = logEl.parentNode;
  if (parent) parent.insertBefore(btn, logEl);

  btn.addEventListener("click", () => {
    rngMsgUntil = nowMs() + 2200;
    render(currentState);
  });

  return btn;
}

// Optional Settings button auto-mount (if settings.js exists)
function ensureSettingsButton() {
  if (!initSettings) return null;
  let btn = document.getElementById("btnSettings");
  if (btn) return btn;

  const left = document.getElementById("leftPane");
  if (!left) return null;

  btn = document.createElement("button");
  btn.id = "btnSettings";
  btn.type = "button";
  btn.textContent = "設定";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";

  const controls = left.querySelector(".controls");
  if (controls && controls.parentNode)
    controls.parentNode.insertBefore(btn, controls);
  else left.appendChild(btn);

  btn.addEventListener("click", () => {
    try {
      initSettings?.({ db, roomId, playerId });
    } catch {}
  });

  return btn;
}
// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
const roomId = params.get("room");
const playerId = params.get("player");
const isSoloMode = params.get("solo") === "1" || params.get("mode") === "solo";
const fieldIdFromUrl = normalizeFieldId(params.get("field") || "grass");
console.log("[field param]", params.get("field"), "=>", fieldIdFromUrl);

if (!roomId || !playerId) {
  alert("URLに room / player がありません。デッキ画面から入り直してください。");
  throw new Error("missing room/player");
}

const matchRef = doc(db, "rooms", roomId, "game", "match");
const stateRef = doc(db, "rooms", roomId, "game", "state");
const playerRef = (pid) => doc(db, "rooms", roomId, "players", pid);

// =====================
// Load card defs
// =====================
let cardDefs = {};
async function loadCards() {
  const m = {};

  async function loadCardCollection(name, forcedKind = "") {
    try {
      const snap = await getDocs(collection(db, name));
      snap.forEach((d) => {
        const data = d.data() || {};
        m[d.id] = {
          ...data,
          id: data.id || d.id,
          ...(forcedKind ? { kind: data.kind || forcedKind, type: data.type || forcedKind } : {}),
        };
      });
    } catch (e) {
      console.warn("[game] card collection skipped:", name, e?.message || e);
    }
  }

  await loadCardCollection("cards");
  await loadCardCollection("support_cards", "support");
  await loadCardCollection("supports", "support");
  await loadCardCollection("supportCards", "support");
  await loadCardCollection("ex_support_cards", "ex_support");
  await loadCardCollection("ex_supports", "ex_support");
  await loadCardCollection("exSupportCards", "ex_support");
  await loadCardCollection("ex_support", "ex_support");
  let youCard = null;
  try {
    const profile = await ensureUserProfile();
    youCard = normalizeYouCard(profile?.data?.youCard, profile?.uid || authUid);
  } catch (e) {
    console.warn("[game] YOU card skipped:", e?.message || e);
  }
  const starterSupportDefs = { ...STARTER_SUPPORT_CARD_MAP };
  for (const [id, def] of Object.entries(STARTER_SUPPORT_CARD_MAP || {})) {
    const rawId = String(id || "").trim();
    if (!rawId) continue;
    starterSupportDefs[rawId] = def;
    starterSupportDefs[rawId.toLowerCase()] = def;
    starterSupportDefs[rawId.toUpperCase()] = def;
  }

  // Starter support cards are canonical locally, including S/s ID aliases.
  cardDefs = { ...m, ...starterSupportDefs, ...FAIRY_TALE_CARDS, ...JEWEL_CARDS };
  if (youCard) cardDefs[YOU_CARD_ID] = youCard;
}
await loadCards();

function normalizeActionsForDef(def) {
  const actsRaw = def?.actions;

  // Leave non-array action data untouched.
  if (!Array.isArray(actsRaw)) return;

  // Stable duplicate key.
  const keyOf = (a) =>
    [
      String(a?.name ?? ""),
      String(a?.cost ?? ""),
      String(a?.range ?? ""),
      String(a?.dmg ?? a?.damage ?? ""),
      String(a?.heal ?? ""),
      String(a?.hpDelta ?? ""),
      String(a?.spDelta ?? ""),
      String(a?.dmgType ?? a?.damageType ?? ""),
      String(a?.rate ?? a?.successRate ?? a?.hitRate ?? a?.prob ?? a?.p ?? ""),
    ].join("|");

  const seen = new Set();
  const out = [];
  for (const a of actsRaw) {
    const k = keyOf(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  def.actions = out;
}

function normalizeAllCardDefs() {
  for (const id of Object.keys(cardDefs || {})) {
    const d = cardDefs[id];
    if (!d || typeof d !== "object") continue;
    normalizeActionsForDef(d);
  }
}

  // loadCards 後に1回だけ normalizeAllCardDefs();

function cardName(cardId) {
  return cardDefs?.[cardId]?.name || cardId;
}
function shortLabel(s, max = 6) {
  s = String(s ?? "");
  return s.length > max ? s.slice(0, max) : s;
}

/* =====================
   陦ｨ遉ｺ逕ｨ繝倥Ν繝代・
===================== */
function safeStatusText(u) {
  const t = formatStatusList(u);
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.join(",");
  if (t && typeof t === "object") {
    const keys = Object.keys(t);
    return keys.length ? keys.join(",") : "なし";
  }
  return "なし";
}

// =====================
// 笘・irestore(map)/驟榊・/譁・ｭ怜・縺ｧ繧ょ｣翫ｌ縺ｪ縺・addStatus & tags 蜷ｸ蜿主ｱ､
// =====================
function addStatusListFromAny(addStatus) {
  const norm = (v) => {
    const s = String(v || "").trim();
    if (!s) return "";
    try {
      return normalizeStatusKey?.(s) || s;
    } catch {
      return s;
    }
  };
  if (!addStatus) return [];
  if (Array.isArray(addStatus)) {
    return addStatus.map(norm).filter(Boolean);
  }
  if (typeof addStatus === "string") {
    return (parseAddStatus(addStatus) || []).map(norm).filter(Boolean);
  }
  if (typeof addStatus === "object") {
    const out = [];
    const t =
      addStatus.target && typeof addStatus.target === "object"
        ? addStatus.target
        : null;
    if (t) out.push(...Object.keys(t));
    return out.map(norm).filter(Boolean);
  }
  return [];
}

function hasAddStatusKey(act, key) {
  const list = addStatusListFromAny(act?.addStatus).map((s) =>
    String(s || "").trim(),
  );
  return list.includes(key);
}

function getTagInt(act, key, defVal = 0) {
  const tags = tagMapFromAny(act?.tags);
  const v = Number(tags?.[key]);
  return Number.isFinite(v) ? Math.trunc(v) : defVal;
}

function tagMapFromAny(tags) {
  if (!tags) return {};
  if (typeof tags === "string") return parseTags(tags) || {};
  if (Array.isArray(tags)) return parseTags(tags.join(",")) || {};
  if (typeof tags === "object") return tags;
  return {};
}

const ACTION_UI_HIDDEN_KEYS = new Set([
  "attr",
  "attrIn",
  "attrs",
  "attribute",
  "attributes",
  "cond",
  "condition",
  "conditions",
  "existing",
  "existingSkill",
  "fromExisting",
  "internal",
  "kind",
  "note",
  "owner",
  "ownerType",
  "raw",
  "role",
  "roles",
  "source",
  "sourceCard",
  "sourceCardId",
  "sourceId",
  "src",
  "tag",
  "theme",
  "type",
  "既存技",
]);

function isHiddenActionUiKey(key) {
  const k = String(key || "").trim();
  if (!k) return true;
  return ACTION_UI_HIDDEN_KEYS.has(k) || ACTION_UI_HIDDEN_KEYS.has(k.toLowerCase());
}

function sanitizeActionUiText(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const chunks = raw
    .split(/\s*\/\s*|\n+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const power = x.match(/^power\s*[:：=+]?\s*(-?\d+)\s*$/i);
      if (power) return `威力${Number(power[1]) >= 0 ? "+" : ""}${Math.trunc(Number(power[1]))}`;
      const kb = x.match(/^(?:knockback|knockBack|kb|ノックバック)\s*[:：=+]?\s*(\d+)?\s*$/i);
      if (kb) return kb[1] ? `ノックバック${Math.trunc(Number(kb[1]))}` : "ノックバック";
      return x;
    })
    .filter((x) => {
      const m = x.match(/^([^:：=+\s]+)\s*[:：=]/);
      if (m && isHiddenActionUiKey(m[1])) return false;
      if (/^(attr|role|source|raw|theme|type|kind|owner|cond|condition)\b/i.test(x)) return false;
      if (/(?:^|[^A-Za-z0-9_])(attr|role|source|raw|theme|type|kind|owner|cond|condition)(?:[:：=]|\b)/i.test(x)) return false;
      if (/既存技|カード内蔵技|元カード/.test(x)) return false;
      return true;
    });
  return chunks.join(" / ");
}

function describeSpecialEffects(act) {
  const list = addStatusListFromAny(act?.addStatus).map((s) =>
    String(s || "").trim(),
  );

  const tags = tagMapFromAny(act?.tags);

  const out = [];
  const has = (...names) => names.some((n) => list.includes(n) || tags[n] != null);

  const getVal = (name, defVal) => {
    let v = Number(
      tags[name] ??
        tags[`${name}Up`] ??
        tags[`${name}_up`] ??
        tags[`${name}Plus`] ??
        tags[`${name}_plus`],
    );
    if (!Number.isFinite(v)) v = defVal;
    return Math.trunc(v);
  };

  // 蛟､縺ｮ蜿悶ｊ譁ｹ・壹∪縺・act.bonus・域焚蛟､・俄・辟｡縺代ｌ縺ｰ tags
  const getBonusOrTag = (name, defVal) => {
    // 謾ｹ險・SV・喘onus 縺後梧焚蛟､縲阪・繧ｱ繝ｼ繧ｹ
    const b = Number(act?.bonus);
    if (Number.isFinite(b)) return Math.trunc(b);

    // 蠕捺擂莠呈鋤・嗾ags 縺ｮ謨ｰ蛟､
    let v = Number(
      tags[name] ??
        tags[`${name}Up`] ??
        tags[`${name}_up`] ??
        tags[`${name}Plus`] ??
        tags[`${name}_plus`],
    );
    if (!Number.isFinite(v)) v = defVal;
    return Math.trunc(v);
  };

  if (has("aim", "命中", "hitUp"))
    out.push(`命中+${getBonusOrTag("aim", 10)}%`);
  if (has("jinx", "命中低下"))
    out.push(`命中-${getBonusOrTag("jinx", 10)}%`);

  if (has("powerUp", "power")) out.push(`威力+${getBonusOrTag("powerUp", 10)}`);
  if (has("armor", "装甲")) out.push(`装甲+${getBonusOrTag("armor", 10)}`);
  if (has("bleed", "出血")) out.push(`出血付与(${getVal("bleed", 10)})`);
  if (has("fracture", "骨折")) out.push("骨折（移動不可）");
  if (has("smell", "におい")) out.push(`におい付与(${getVal("smell", 10)})`);
  if (has("lostSoul", "失魂")) out.push("失魂");
  if (has("blind", "盲目")) out.push("盲目");
  if (has("evade", "回避")) out.push(`回避+${getVal("evade", 10)}`);
  if (has("combo", "コンボ")) out.push("コンボ");
  if (has("followUp", "追撃")) out.push("追撃");
  if (has("knockback", "ノックバック")) {
    const kb =
      Number(tags.knockback ?? tags.knockBack ?? tags.kb ?? act?.knockback ?? act?.knockBack);
    out.push(Number.isFinite(kb) && kb > 0 ? `ノックバック${Math.trunc(kb)}` : "ノックバック");
  }

  if (has("recoverFatigue", "疲労回復", "fatigueHeal", "fatigueClear"))
    out.push("疲労回復");
  if (
    has(
      "recoverMove",
      "moveReset",
      "refreshMove",
      "遘ｻ蜍募屓蠕ｩ",
      "遘ｻ蜍募宛髯仙屓蠕ｩ",
      "遘ｻ蜍募屓謨ｰ蝗槫ｾｩ",
    )
  )
    out.push("移動回数回復");

  return out;
}

function displayAddStatus(act) {
  const list = addStatusListFromAny(act?.addStatus);
  const hidden = new Set([
    "pierce",
    "aoe",
    "all",
    "knockback",
    "貫通",
    "全体",
    "ノックバック",
  ]);
  const shown = list
    .map((s) => String(s || "").trim())
    .filter((s) => s && !hidden.has(s) && !isHiddenActionUiKey(s));
  return shown.length ? shown.join(" / ") : "";
}

// =====================
// 笘・actFlags: 謚繝輔Λ繧ｰ謚ｽ蜃ｺ・・OE / 雋ｫ騾夲ｼ・//  - addStatus / tags 縺ｮ荳｡譁ｹ縺九ｉ諡ｾ縺・// =====================
function actFlags(act) {
  const list = addStatusListFromAny(act?.addStatus);
  const tags = tagMapFromAny(act?.tags);

  const has = (...names) => names.some((n) => list.includes(n));

  const aoe =
    has("aoe", "all", "全体") ||
    !!tags.aoe ||
    !!tags.AOE ||
    !!tags.all ||
    !!tags["全体"];

  const pierce =
    has("pierce", "貫通") ||
    !!tags.pierce ||
    !!tags.PIERCE ||
    !!tags.penetrate ||
    !!tags["貫通"];

  return { aoe: !!aoe, pierce: !!pierce };
}

// =====================
// 射程表示は、自分視点の前後で矢印を出す。
// =====================

function forwardDyUI(unitOwner) {
  return unitOwner === seat ? -1 : 1;
}
function arrowByForwardUI(unitOwner) {
  return forwardDyUI(unitOwner) === -1 ? "↑" : "↓";
}
function arrowByBackUI(unitOwner) {
  return forwardDyUI(unitOwner) === -1 ? "↓" : "↑";
}

function rangeTokenToArrow(tok, unitOwner) {
  const t = String(tok || "").trim();
  if (!t) return "";
  if (t.toLowerCase() === "adj4") return "周囲";

  const m = t.match(/^(front|back|side|rf|lf|rb|lb|r|l|f)(\d+)$/i);
  if (!m) return t;

  const kind = m[1].toLowerCase();
  const n = Math.max(1, Math.trunc(Number(m[2] || 1)));

  const f = arrowByForwardUI(unitOwner);
  const b = arrowByBackUI(unitOwner);

  const dyF = forwardDyUI(unitOwner);
  const rf = dyF === -1 ? "↗" : "↙";
  const lf = dyF === -1 ? "↖" : "↘";
  const rb = dyF === -1 ? "↘" : "↖";
  const lb = dyF === -1 ? "↙" : "↗";

  if (kind === "front" || kind === "f") return f + n;
  if (kind === "back") return b + n;
  if (kind === "side") return "←" + n + " / →" + n;
  if (kind === "rf") return rf + n;
  if (kind === "lf") return lf + n;
  if (kind === "rb") return rb + n;
  if (kind === "lb") return lb + n;
  if (kind === "r") return "→" + n;
  if (kind === "l") return "←" + n;
  return t;
}

function rangeSpecToArrow(rangeSpec, unitOwner) {
  const n = Number(rangeSpec);
  if (Number.isFinite(n)) return "距離" + Math.max(0, Math.trunc(n));

  const s = String(rangeSpec ?? "")
    .replaceAll('"', "")
    .trim();
  if (!s) return "";

  return s
    .split("+")
    .map((x) => rangeTokenToArrow(x.trim(), unitOwner))
    .filter(Boolean)
    .join("+");
}

function actRangeLabel(act, unitOwner) {
  const base =
    rangeSpecToArrow(act?.range, unitOwner) || String(act?.range ?? "?");
  const flags = actFlags(act);
  const suffix = (flags.aoe ? "全" : "") + (flags.pierce ? "貫" : "");
  return String(base) + suffix;
}

// =====================
// Seat
// =====================
let seat = null;
let opponentSeat = null;
let seatAPlayerId = null;
let seatBPlayerId = null;

async function resolveSeat() {
  const ms = await getDoc(matchRef);
  if (!ms.exists()) {
    alert("matchがありません。battleで両者準備OKになったか確認してください。");
    throw new Error("match missing");
  }
  const m = ms.data();
  seatAPlayerId = m.seatA;
  seatBPlayerId = m.seatB;

  if (playerId === seatAPlayerId) seat = "A";
  else if (playerId === seatBPlayerId) seat = "B";
  else {
    alert("あなたはこのマッチの参加者ではありません。");
    throw new Error("not participant");
  }

  opponentSeat = seat === "A" ? "B" : "A";
  if (youEl) youEl.textContent = seat;
}
await resolveSeat();

// =====================
// CPU 蛻晄悄蛹厄ｼ育援蛛ｴ縺靴PU縺ｮ縺ｨ縺阪・縺ｿ・・// =====================
let cpuDriver = null;
let cpuSeat = null;

function isCpuSeat(s) {
  // 萓具ｼ嗔layerId 縺・"CPU" 縺ｪ繧韻PU謇ｱ縺・↑縺ｩ
  // battle.js 蛛ｴ莉墓ｧ倥↓蜷医ｏ縺帙※縺薙％隱ｿ謨ｴ
  return s === "B" && seat !== "B"; // 莉ｮ・夊・蛻・′A縺ｪ繧隠縺靴PU
}

if (isSoloMode) {
  cpuSeat = seat === "A" ? "B" : "A";
  cpuDriver = createCpuDriver({
    db,
    stateRef,
    matchRef,
    cardDefs,
    W,
    H,
  });
}

function isMatchedGame() {
  // seatA/seatB が両方埋まっていたら対戦成立。
  return !!seatAPlayerId && !!seatBPlayerId && seatAPlayerId !== seatBPlayerId;
}

function forceHideSoloUI() {
  // solo_debug のRootを隠す。
  const el =
    document.getElementById("soloDebugRoot") ||
    document.getElementById("soloDebugPanel") ||
    document.getElementById("soloDebug");
  if (el) el.style.display = "none";

  // toggle を残さない。
  try {
    delete window.toggleSoloConsole;
  } catch {}
}

// =====================
// View transform・亥ｸｸ縺ｫ閾ｪ蛻・′謇句燕縺ｫ隕九∴繧具ｼ・// - state蠎ｧ讓吶・蝗ｺ螳夲ｼ・=荳・ B=荳奇ｼ・// - 陦ｨ遉ｺ縺縺・B 縺ｮ縺ｨ縺堺ｸ贋ｸ句渚霆｢
// =====================
function viewFlipY() {
  return seat === "B";
}

function toViewXY(x, y) {
  if (!viewFlipY()) return { x, y };
  return { x, y: H - 1 - y };
}

function toModelXY(x, y) {
  if (!viewFlipY()) return { x, y };
  return { x, y: H - 1 - y };
}

function onCellClickView(vx, vy) {
  const m = toModelXY(vx, vy);
  onCellClick(m.x, m.y);
}

// =====================
// Solo Debug Panel (externalized)
// =====================
// internal note.
if (isSoloMode) {
  (async () => {
    try {
      const mod = await import("./solo_debug.js?v=20260626");
      const init = mod?.initSoloDebug;
      if (typeof init === "function") {
        init({
          db,
          roomId,
          playerId,
          seat,
          stateRef,
          matchRef,
          playerRef: playerRef(playerId),
          cardDefsRef: null,
          render,
        });
      }
    } catch (e) {
      console.warn("[solo_debug] module not loaded", e);
    }
  })();
}

// =====================
// Solo Console (open/close on demand)
// =====================
let soloConsoleInited = false;
let soloConsoleVisible = false;
window.__soloConsoleReady = false;

function findSoloConsoleEl() {
  return (
    document.getElementById("soloDebugRoot") ||
    document.getElementById("soloDebugPanel") ||
    document.getElementById("soloDebug")
  );
}

function setSoloConsoleVisible(v) {
  soloConsoleVisible = !!v;
  const el = findSoloConsoleEl();
  if (el) el.style.display = soloConsoleVisible ? "block" : "none";
}

async function initSoloConsoleOnce() {
  const existingPanel = findSoloConsoleEl();
  if (soloConsoleInited || (window.__soloDebugInitialized && existingPanel)) {
    soloConsoleInited = true;
    return;
  }

  try {
    const mod = await import("./solo_debug.js?v=20260626");
    const init = mod?.initSoloDebug;
    if (typeof init !== "function") throw new Error("initSoloDebug not found");

    init({
      db,
      roomId,
      playerId,
      seat,
      stateRef,
      matchRef,
      playerRef: playerRef(playerId),
      cardDefsRef: null,
      render,
    });

    soloConsoleInited = true;

    // init逶ｴ蠕後↓DOM縺後∪縺逕溘∴縺ｦ縺ｪ縺・こ繝ｼ繧ｹ縺後≠繧九・縺ｧ1蝗槫ｾ・▽
    queueMicrotask(() => {
      // 蛻晄悄陦ｨ遉ｺ・嘖olo=1縺ｪ繧蛾幕縺・※縺翫￥
      const p = new URLSearchParams(location.search);
      const isSolo = p.get("solo") === "1" || p.get("mode") === "solo";
      setSoloConsoleVisible(isSolo);
    });
  } catch (e) {
    console.warn("[solo console] init failed", e);
    alert("solo_debug.jsを読み込めませんでした。");
  }
}

// game.html のボタンから呼ぶトグル。
window.toggleSoloConsole = async function () {
  await initSoloConsoleOnce();

  // init後にDOM生成が遅延する場合があるので少し待って再取得する。
  let el = findSoloConsoleEl();
  if (!el) {
    await new Promise((r) => setTimeout(r, 0));
    el = findSoloConsoleEl();
  }
  if (!el) {
    alert("コンソールDOMが見つかりません。solo_debug.js側のidを確認してください。");
    return;
  }

  setSoloConsoleVisible(!soloConsoleVisible);
};

window.__soloConsoleReady = true;
window.dispatchEvent(new Event("solo-console-ready"));

// URLで solo=1 なら自動で初期化する。
(async () => {
  const p = new URLSearchParams(location.search);
  const isSolo = p.get("solo") === "1" || p.get("mode") === "solo";
  if (isSolo) await initSoloConsoleOnce();
})();

// =====================
// Evolve system (separated) 2026/02/18
// =====================
const evolveSys = createEvolveSystem({
  db,
  stateRef,
  getSeat: () => seat,
  canControl,
  normalizeMana,
  spendManaMut,
  nowMs,
  round10,
  clampUnitStats10,
  cardDefsRef: () => cardDefs,
  cardName,
  logPush,
  checkWinLocal,
  isPanic,
  fireCardEffects,
});

// =====================
// 笘・ｾｵ蜈･/蜍晏茜蛻､螳夲ｼ域悴螳夂ｾｩ縺ｧ關ｽ縺｡繧九・繧剃ｿｮ蠕ｩ・・// =====================
const WIN_KILL_COUNT = 3;
const WIN_INFIL_COUNT = 3;

function ensureInfilObj(s) {
  if (!s) return { A: 0, B: 0 };
  if (!s.infil || typeof s.infil !== "object") s.infil = { A: 0, B: 0 };
  s.infil.A = Math.max(0, Math.trunc(Number(s.infil.A ?? 0) || 0));
  s.infil.B = Math.max(0, Math.trunc(Number(s.infil.B ?? 0) || 0));
  return s.infil;
}

// 現在の侵入数（累積しない）
function calcInfilNow(s) {
  const units = Array.isArray(s?.units) ? s.units : [];
  const alive = units.filter((u) => u && Number(u.hp) > 0 && !u.panic);

  const a = alive.filter(
    (u) => normSeat(u.owner) === "A" && Number(u.y) <= 1,
  ).length;
  const b = alive.filter(
    (u) => normSeat(u.owner) === "B" && Number(u.y) >= H - 2,
  ).length;
  return { A: a, B: b };
}

// 譌｢蟄・checkWin 縺後≠繧九↑繧牙ｰ企㍾縺励▽縺､縲∵怙菴朱剞・・ills/infil・峨〒繧ょ享閠・ｒ霑斐○繧九ｈ縺・↓
function checkWinLocal(s) {
  if (!s) return null;

  const killsA = Math.trunc(Number(s?.kills?.A ?? 0) || 0);
  const killsB = Math.trunc(Number(s?.kills?.B ?? 0) || 0);
  if (killsA >= WIN_KILL_COUNT) return "A";
  if (killsB >= WIN_KILL_COUNT) return "B";

  const now = calcInfilNow(s);
  if (Math.trunc(Number(now.A ?? 0)) >= WIN_INFIL_COUNT) return "A";
  if (Math.trunc(Number(now.B ?? 0)) >= WIN_INFIL_COUNT) return "B";

  try {
    if (typeof checkWin === "function") {
      const w = normSeat(checkWin(s));
      if (w) return w;
    }
  } catch {}
  return null;
}

// =====================
// Init state once
// =====================
async function ensureStateInitialized() {
  await runTransaction(db, async (tx) => {
    const st = await tx.get(stateRef);
    if (st.exists()) {
      const s = st.data() || {};

      // フィールド状態を補完する。
      try {
        ensureFieldState(s, W, H, fieldIdFromUrl);
        tx.set(
          stateRef,
          { fieldId: s.fieldId, field: s.field },
          { merge: true },
        );
      } catch {}

      const mana = normalizeMana(s.mana);
      if (s.schema !== "mana_v3")
        tx.set(stateRef, { mana, schema: "mana_v3" }, { merge: true });

      if (typeof s.turnSeq !== "number")
        tx.set(stateRef, { turnSeq: 1 }, { merge: true });
      if (s.lastSupportRoll === undefined)
        tx.set(stateRef, { lastSupportRoll: null }, { merge: true });

      if (!s.ex)
        tx.set(stateRef, { ex: { A: null, B: null } }, { merge: true });
      if (!s.exUsed)
        tx.set(stateRef, { exUsed: { A: false, B: false } }, { merge: true });

      if (s.lastSummon === undefined)
        tx.set(stateRef, { lastSummon: null }, { merge: true });
      if (s.lastEvolve === undefined)
        tx.set(stateRef, { lastEvolve: null }, { merge: true });

      ensureInfilObj(s);
      tx.set(stateRef, { infil: s.infil }, { merge: true });

      if (!s.kills || typeof s.kills !== "object")
        tx.set(stateRef, { kills: { A: 0, B: 0 } }, { merge: true });

      return;
    }

    const pA = await tx.get(playerRef(seatAPlayerId));
    const pB = await tx.get(playerRef(seatBPlayerId));
    if (!pA.exists() || !pB.exists()) throw new Error("players missing");

    const deckA_simple = pA.data().deck || {};
    const deckB_simple = pB.data().deck || {};

    const exA = pA.data().exCardId || null;
    const exB = pB.data().exCardId || null;

    function buildDeck(simple) {
      const arr = [];
      for (const id of Object.keys(simple)) {
        const cntRaw = Number(simple[id] || 0);
        const cnt = Math.max(0, Math.min(4, Math.trunc(cntRaw)));
        for (let i = 0; i < cnt; i++) arr.push(id);
      }
      return shuffle(arr);
    }

    const deckA = buildDeck(deckA_simple);
    const deckB = buildDeck(deckB_simple);

    const hands = { A: [], B: [] };
    for (let i = 0; i < 5; i++) {
      if (deckA.length) hands.A.push(deckA.pop());
    }
    for (let i = 0; i < 5; i++) {
      if (deckB.length) hands.B.push(deckB.pop());
    }

    const mana = {
      A: { cur: CORE.START_CUR, max: CORE.START_MAX },
      B: { cur: CORE.START_CUR, max: CORE.START_MAX },
    };

    tx.set(stateRef, {
      turn: "A",
      turnSeq: 1,

      fieldId: fieldIdFromUrl,
      field: { id: fieldIdFromUrl },

      mana,
      decks: { A: deckA, B: deckB },
      hands,
      discards: { A: [], B: [] },
      units: [],
      kills: { A: 0, B: 0 },
      infil: { A: 0, B: 0 },
      winner: null,
      log: ["--- Aターン ---"],
      lastRoll: null,
      lastHit: null,
      lastSupportRoll: null,
      lastSummon: null,
      lastEvolve: null,
      ex: { A: exA, B: exB },
      exUsed: { A: false, B: false },
      startedAtMs: Date.now(),
      createdAt: serverTimestamp(),
      schema: "mana_v3",
    });
  });
}
await ensureStateInitialized();

// =====================
// drawCards のシグネチャ差異を吸収する
// =====================
function safeDrawCards(s, who, n) {
  const cnt = Math.max(0, Math.trunc(Number(n ?? 0)));
  if (!s || !who || !cnt) return;

  s.decks = s.decks || { A: [], B: [] };
  s.hands = s.hands || { A: [], B: [] };

  const beforeH = Array.isArray(s.hands[who]) ? s.hands[who].length : 0;

  try {
    const fn = drawCards;
    if (typeof fn === "function") {
      const L = fn.length;
      let ret;

      if (L >= 4) ret = fn(s, who, cnt, cardDefs);
      else if (L === 3) ret = fn(s, who, cnt);
      else if (L === 2) ret = fn(s, who);
      else ret = fn(s);

      if (ret && typeof ret === "object") {
        if (ret.decks || ret.hands) {
          if (ret.decks) s.decks = ret.decks;
          if (ret.hands) s.hands = ret.hands;
        }
        if (ret.state && (ret.state.decks || ret.state.hands)) {
          if (ret.state.decks) s.decks = ret.state.decks;
          if (ret.state.hands) s.hands = ret.state.hands;
        }
      }
    }
  } catch {}

  s.decks = s.decks || { A: [], B: [] };
  s.hands = s.hands || { A: [], B: [] };

  const afterH = Array.isArray(s.hands[who]) ? s.hands[who].length : 0;

  // 笨・drawCards縺・譫壹□縺大ｼ輔￥螳溯｣・〒繧ゅ∵欠螳壽椢謨ｰ縺ｫ縺ｪ繧九∪縺ｧ陬懷｡ｫ縺吶ｋ
  const drawn = afterH - beforeH;
  const need = Math.max(0, cnt - (Number.isFinite(drawn) ? drawn : 0));

  if (need > 0) {
    const dk = Array.isArray(s.decks[who]) ? s.decks[who] : [];
    const hd = Array.isArray(s.hands[who]) ? s.hands[who] : [];
    for (let i = 0; i < need; i++) {
      if (!dk.length) break;
      hd.push(dk.pop());
    }
    s.decks[who] = dk;
    s.hands[who] = hd;
  }

  s.hands[who] = Array.isArray(s.hands[who]) ? s.hands[who] : [];
  s.decks[who] = Array.isArray(s.decks[who]) ? s.decks[who] : [];
}

function otherSeatOf(side) {
  const s = normSeat(side);
  if (s === "A") return "B";
  if (s === "B") return "A";
  return null;
}

function normalizeHandEffectType(type) {
  const t = String(type || "").trim().toLowerCase();
  if (
    t === "discardhand" ||
    t === "handdiscard" ||
    t === "discard" ||
    t === "gravehand" ||
    t === "trashhand" ||
    t === "手札を墓地へ"
  ) return "discardHand";
  if (
    t === "sethand" ||
    t === "setcard" ||
    t === "facedown" ||
    t === "cardset" ||
    t === "cardlock" ||
    t === "hidecard" ||
    t === "伏せる" ||
    t === "カード伏せ"
  ) return "setHand";
  return "";
}

function handEffectSeat(actorSeat, eff = {}) {
  const actor = normSeat(actorSeat);
  const raw = String(eff.targetSeat ?? eff.target ?? eff.seat ?? "enemy").trim().toLowerCase();
  if (raw === "self" || raw === "own" || raw === "owner" || raw === "ally") return actor;
  if (raw === "enemy" || raw === "opponent") return otherSeatOf(actor);
  return normSeat(raw) || actor;
}

function actionHandEffects(act = {}) {
  const list = [];
  const push = (eff) => {
    if (!eff || typeof eff !== "object") return;
    const type = normalizeHandEffectType(eff.type);
    if (!type) return;
    list.push({ ...eff, type });
  };
  if (Array.isArray(act.handEffects)) act.handEffects.forEach(push);
  push(act.handEffect);
  if (act.discardHand || act.handDiscard) {
    list.push({
      type: "discardHand",
      targetSeat: act.discardHandTarget || act.handTarget || "enemy",
      count: act.discardHandCount ?? act.handDiscard ?? 1,
    });
  }
  if (act.setHand || act.handSet) {
    list.push({
      type: "setHand",
      targetSeat: act.setHandTarget || act.handTarget || "enemy",
      count: act.setHandCount ?? act.handSet ?? 1,
    });
  }
  return list;
}

function actionWantsSwapTarget(act = {}) {
  if (!act || typeof act !== "object") return false;
  if (act.swapTarget === true || act.swap === true || act.positionSwap === true) return true;
  const list = addStatusListFromAny(act.addStatus).map((v) => String(v || "").trim());
  if (list.some((v) => ["swapTarget", "swapPos", "positionSwap", "位置入替"].includes(v))) return true;
  const tags = tagMapFromAny(act.tags);
  return !!(tags.swapTarget || tags.swapPos || tags.positionSwap || tags.swap || tags["位置入替"]);
}

function ensureDiscardPile(s, side) {
  const seat0 = normSeat(side);
  s.discards = s.discards && typeof s.discards === "object" ? s.discards : {};
  s.discards.A = Array.isArray(s.discards.A) ? s.discards.A : [];
  s.discards.B = Array.isArray(s.discards.B) ? s.discards.B : [];
  return seat0 ? s.discards[seat0] : [];
}

function decrementHandLockForCard(st, side, cardId, count = 1) {
  const seat0 = normSeat(side);
  if (!st || !seat0 || !cardId || count <= 0) return;
  const locks = normalizedHandLocks(st);
  let left = Math.max(1, Math.trunc(Number(count) || 1));
  locks[seat0] = locks[seat0].flatMap((lock) => {
    if (left <= 0 || String(lock?.cardId || "") !== String(cardId)) return [lock];
    const n = Math.max(1, Math.trunc(Number(lock?.count ?? 1)) || 1);
    const used = Math.min(left, n);
    left -= used;
    const remain = n - used;
    return remain > 0 ? [{ ...lock, count: remain }] : [];
  });
  st.handLocks = locks;
}

function randomHandIndexes(hand, count, allowIndex) {
  const pool = [];
  for (let i = 0; i < hand.length; i += 1) {
    if (!allowIndex || allowIndex(i)) pool.push(i);
  }
  const picked = [];
  while (pool.length && picked.length < count) {
    const p = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(p, 1)[0]);
  }
  return picked.sort((a, b) => b - a);
}

function applyHandEffectsFromAction(s, actorSeat, act, logLines = []) {
  const actor = normSeat(actorSeat);
  if (!s || !actor) return 0;
  const effects = actionHandEffects(act);
  if (!effects.length) return 0;

  s.hands = s.hands || { A: [], B: [] };
  s.handLocks = normalizedHandLocks(s);
  let applied = 0;

  for (const eff of effects) {
    const targetSeat = handEffectSeat(actor, eff);
    if (!targetSeat) continue;
    const hand = Array.isArray(s.hands[targetSeat]) ? s.hands[targetSeat] : [];
    s.hands[targetSeat] = hand;
    const count = Math.max(1, Math.trunc(Number(eff.count ?? eff.n ?? 1)) || 1);
    const labelSeat = targetSeat === actor ? "自分" : "相手";

    if (eff.type === "discardHand") {
      const picked = randomHandIndexes(hand, count);
      const removed = [];
      for (const idx of picked) {
        const [cardId] = hand.splice(idx, 1);
        if (!cardId) continue;
        removed.push(cardId);
        ensureDiscardPile(s, targetSeat).push(cardId);
        decrementHandLockForCard(s, targetSeat, cardId, 1);
      }
      if (removed.length) {
        applied += removed.length;
        logLines.push("  > " + labelSeat + "手札を墓地へ " + removed.length + "枚");
      }
    } else if (eff.type === "setHand") {
      const picked = randomHandIndexes(hand, count, (idx) => !isHandCardLocked(s, idx, targetSeat));
      for (const idx of picked) {
        const cardId = hand[idx];
        if (!cardId) continue;
        s.handLocks[targetSeat].push({
          cardId,
          count: 1,
          releaseSeat: actor,
          by: "action",
          source: act?.name || "",
          turnSeq: Math.trunc(Number(s.turnSeq ?? 1)),
        });
      }
      if (picked.length) {
        applied += picked.length;
        logLines.push("  > " + labelSeat + "手札を伏せる " + picked.length + "枚");
      }
    }
  }

  return applied;
}

function clearCommandSelectionUI(opts = {}) {
  const keepUnit = !!opts.keepUnit;

  selectedTargetId = null;
  selectedHandIndex = null;
  selectedActionIndex = 0;

  resetSupportPicks();
  mode = null;

  if (!keepUnit) {
    selectedUnitId = null;
    lastSelectedUnitId = null;
  }

  // UI譖ｴ譁ｰ
  render(currentState);
}
// =====================
// Local selection
// =====================
let lastSelectedUnitId = null;

function onSelectMyUnit(newUnitId, st) {
  if (!newUnitId) return;
  const changed = lastSelectedUnitId && lastSelectedUnitId !== newUnitId;
  lastSelectedUnitId = newUnitId;

  selectedUnitId = newUnitId;

  // 謾ｻ謦・ヵ繝ｭ繝ｼ・夐∈縺ｳ逶ｴ縺励◆繧牙ｯｾ雎｡縺ｯ荳譌ｦ繧ｯ繝ｪ繧｢
  selectedTargetId = null;

  if (changed) selectedActionIndex = 0;

  ensureSelectedActionIndex(st);
  try {
    if (isMatchedGame()) forceHideSoloUI();
  } catch {}
  render(st);
}

let mode = null; // summon/move/attack/evolve/support/null
let selectedUnitId = null;
let selectedTargetId = null;
let selectedHandIndex = null;
let selectedActionIndex = 0;

let supportTarget1Id = null;
let supportTarget2Id = null;
let supportTargetCell = null;
let supportSearchCardId = "";

function canControl(st) {
  return st && normSeat(st.turn) === seat && !st.winner;
}

function getSelectedUnit(st) {
  if (!st || !selectedUnitId) return null;
  return (st.units || []).find((u) => u.id === selectedUnitId) || null;
}
function getSelectedTarget(st) {
  if (!st || !selectedTargetId) return null;
  return (st.units || []).find((u) => u.id === selectedTargetId) || null;
}

function effectiveActionCost(unit, act) {
  try {
    if (typeof getActionCostWithStatus === "function") {
      return getActionCostWithStatus(unit, act);
    }
  } catch {}
  return Math.max(0, Math.trunc(Number(act?.cost ?? 0)));
}

function unitActionChoices(unit, st) {
  if (!unit) return [];
  const ownDef = cardDefs?.[unit.cardId] || {};
  const ownActs = Array.isArray(ownDef.actions) ? ownDef.actions : [];
  const out = ownActs.map((a, i) => ({ ...a, __source: "own", __sourceIndex: i }));

  let brainwashed = false;
  try {
    brainwashed = typeof hasBrainwash === "function"
      ? !!hasBrainwash(unit)
      : !!getStatusLocal(unit)?.brainwash;
  } catch {
    brainwashed = !!getStatusLocal(unit)?.brainwash;
  }
  if (!brainwashed) return out;
  const units = Array.isArray(st?.units) ? st.units : [];
  const enemies = units.filter(
    (u) =>
      u &&
      u.id !== unit.id &&
      normSeat(u.owner) !== normSeat(unit.owner) &&
      Number(u.hp) > 0 &&
      !isPanic(u),
  );

  for (const enemy of enemies) {
    const ed = cardDefs?.[enemy.cardId] || {};
    const acts = Array.isArray(ed.actions) ? ed.actions : [];
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      out.push({
        ...a,
        name: "[洗脳] " + cardName(enemy.cardId) + ":" + (a?.name ?? "技"),
        __source: "brainwash",
        __sourceCardId: enemy.cardId,
        __sourceUnitId: enemy.id,
        __sourceIndex: i,
      });
    }
  }

  return out;
}

function ensureSelectedActionIndex(st) {
  const su = getSelectedUnit(st);
  if (!su) {
    selectedActionIndex = 0;
    return;
  }
  const acts = unitActionChoices(su, st);
  if (!Array.isArray(acts) || acts.length <= 0) {
    selectedActionIndex = 0;
    return;
  }
  if (selectedActionIndex < 0 || selectedActionIndex >= acts.length)
    selectedActionIndex = 0;
}

function selectedHandCardId(st) {
  const hand = st?.hands?.[seat] || [];
  if (selectedHandIndex == null) return null;
  return hand[selectedHandIndex] || null;
}
function normalizedHandLocks(st) {
  const src = st?.handLocks && typeof st.handLocks === "object" ? st.handLocks : {};
  return {
    A: Array.isArray(src.A) ? src.A : [],
    B: Array.isArray(src.B) ? src.B : [],
  };
}
function handCardOccurrence(hand, index) {
  const cardId = hand?.[index];
  if (!cardId) return 0;
  let n = 0;
  for (let i = 0; i <= index; i += 1) {
    if (hand[i] === cardId) n += 1;
  }
  return n;
}
function isHandCardLocked(st, index, who = seat) {
  const side = normSeat(who);
  if (!st || !side || index == null || index < 0) return false;
  const hand = Array.isArray(st?.hands?.[side]) ? st.hands[side] : [];
  const cardId = hand[index];
  if (!cardId) return false;
  const occ = handCardOccurrence(hand, index);
  const locked = normalizedHandLocks(st)[side]
    .filter((x) => String(x?.cardId || "") === String(cardId))
    .reduce((sum, x) => sum + Math.max(1, Math.trunc(Number(x?.count ?? 1)) || 1), 0);
  return occ > 0 && occ <= locked;
}
function selectedHandLocked(st) {
  return selectedHandIndex != null && isHandCardLocked(st, selectedHandIndex, seat);
}
function selectedHandDef(st) {
  const cid = selectedHandCardId(st);
  if (!cid) return null;
  return cardDefs?.[cid] || null;
}
function selectedIsSupport(st) {
  const def = selectedHandDef(st);
  return !!def && isSupportCard(def);
}
function resetSupportPicks() {
  supportTarget1Id = null;
  supportTarget2Id = null;
  supportTargetCell = null;
  supportTargetIds = [];
  supportSearchCardId = "";
}
function setMode(m) {
  mode = m;

  if (m !== "support") resetSupportPicks();

  // 笨・騾ｲ蛹悶・驕ｸ謚樒憾諷九・繝｢繝ｼ繝牙､画峩縺ｮ縺溘・縺ｫ螳牙・縺ｫ繝ｪ繧ｻ繝・ヨ
  try {
    evolveSys.reset();
  } catch (e) {}

  if (modeHintEl) {
    modeHintEl.textContent =
      m === "summon"
        ? "召喚: 手札を開いてカードを選択 → 自陣の召喚可能マスをクリック"
        : m === "move"
          ? "移動: 自軍を選択 → 移動先をクリック（マナ-1 / ターン中2マスまで）"
          : m === "attack"
            ? "行動: 攻撃対象をクリックで選択 → 「行動実行」で確定"
            : m === "evolve"
              ? "進化: 進化元を選択 → 手札候補を選択 → 進化実行（疲労中でも可）"
              : m === "support"
                ? "サポート: 対象をクリックで選択 → 「サポート実行」で確定"
                : "ユニット選択: 移動 / 行動 / 進化 / サポートを選択";
  }

  render(currentState);
}

// =====================
// 笘・action_text.js 繧｢繝繝励ち・亥他縺ｳ譁ｹ蟾ｮ逡ｰ繧貞精蜿趣ｼ・// =====================
function actionEffectTextAdapter(act, unitOwner = seat) {
  if (!act) return "";

  const fn =
    (typeof actionEffectTextJa === "function" && actionEffectTextJa) ||
    (typeof window !== "undefined" &&
    typeof window.actionEffectTextJa === "function"
      ? window.actionEffectTextJa
      : null);

  if (!fn) return "";

  const normalizeText = (t) => {
    if (t == null) return "";
    // Ignore object/array return values so card details do not show raw JSON.
    if (typeof t === "object") return "";
    const s = String(t).trim();
    if (!s) return "";
    if (s.startsWith("{") || s.startsWith("[")) return "";
    return sanitizeActionUiText(s);
  };

  try {
    let t = "";
    try {
      t = fn(act, unitOwner);
      t = normalizeText(t);
      if (t) return t;
    } catch {}

    try {
      t = fn(act, { owner: unitOwner });
      t = normalizeText(t);
      if (t) return t;
    } catch {}

    try {
      t = fn(act, { unitOwner });
      t = normalizeText(t);
      if (t) return t;
    } catch {}

    t = normalizeText(fn(act));
    return t;
  } catch {
    return "";
  }
}

function supportEffectSummary(def) {
  const eff = def?.effect;
  if (!eff) return "効果なし";

  try {
    const t = supportEffectTextJa(eff);
    if (t && typeof t === "string") return t;
  } catch {}

  // Fallback display for simple JSON effects.
  const t2 = prettyEffect(eff);
  if (t2 && t2 !== "[object Object]") return t2;

  return String(eff);
}

function supportTypeOf(e) {
  const t = String(e?.type || "").trim().toLowerCase();
  if (t === "decksearch" || t === "tutor") return "search";
  if (
    t === "discardhand" ||
    t === "handdiscard" ||
    t === "discard" ||
    t === "gravehand" ||
    t === "trashhand" ||
    t === "手札を墓地へ"
  ) return "discardHand";
  if (
    t === "setcard" ||
    t === "sethand" ||
    t === "facedown" ||
    t === "cardset" ||
    t === "cardlock" ||
    t === "hidecard" ||
    t === "伏せる" ||
    t === "カード伏せ"
  ) return "setCard";
  return String(e?.type || "").trim();
}

function supportPlan(def) {
  const eff = def?.effect;
  const types = [];
  if (eff?.type) types.push(eff);
  if (Array.isArray(eff?.table)) {
    for (const r of eff.table) {
      if (r?.effect?.type) types.push(r.effect);
    }
  }

  const hasType = (t) => types.some((e) => String(e?.type || "") === t);
  const hasNormType = (t) => types.some((e) => supportTypeOf(e) === t);
  const maxCount = Math.max(
    1,
    ...types.map((e) => Math.max(1, Number(e?.count ?? 1) || 1)),
  );
  const anySelectedPick = types.some(
    (e) => String(e?.pick ?? "").toLowerCase() === "selected",
  );

  if (hasNormType("search")) {
    const e = types.find((x) => supportTypeOf(x) === "search") || {};
    const fixedCardId = String(e.cardId ?? e.id ?? e.searchId ?? "").trim();
    return { need: "search", fixedCardId };
  }
  if (hasType("swapPos")) return { need: "unit2" };
  if (hasType("moveTo")) return { need: "unitCell" };
  if (hasType("shiftGroup") && anySelectedPick)
    return { need: "units", count: maxCount };

  if (
    types.some((e) =>
      [
        "dmg",
        "heal",
        "modRate",
        "bounce",
        "powerUp",
        "cleanse",
        "grantEvade",
        "addStatus",
        "lostSoul",
        "shiftGroup",
      ].includes(String(e?.type || "")),
    )
  ) {
    if (anySelectedPick && maxCount > 1)
      return { need: "units", count: maxCount };
    return { need: "unit" };
  }

  return { need: "none" };
}

// =====================
// 笘・upport: target(ally/enemy/any) + rate陦ｨ遉ｺ
// =====================
function getSupportTargetMode(def) {
  const eff0 = def?.effect;
  const t0 = String(eff0?.target ?? "")
    .trim()
    .toLowerCase();

  const table = Array.isArray(eff0?.table) ? eff0.table : null;
  const ts = [];
  if (t0) ts.push(t0);
  if (table) {
    for (const r of table) {
      const te = String(r?.effect?.target ?? r?.target ?? "")
        .trim()
        .toLowerCase();
      if (te) ts.push(te);
    }
  }

  if (!ts.length) return "any";
  if (ts.includes("any")) return "any";
  if (ts.includes("ally")) return "ally";
  if (ts.includes("enemy")) return "enemy";
  return "any";
}

function supportCanPickUnit(unit, who, targetMode) {
  if (!unit || Number(unit.hp) <= 0) return false;
  const owner = normSeat(unit.owner);
  const me = normSeat(who);
  if (!owner || !me) return false;

  const mode = String(targetMode || "any");
  if (mode === "any") return true;
  if (mode === "ally") return owner === me;
  if (mode === "enemy") return owner !== me;
  return true;
}

function supportRateText(def) {
  const eff0 = def?.effect;
  if (!eff0) return "謌仙粥邇・?";

  const table = Array.isArray(eff0?.table) ? eff0.table : null;
  if (table && table.length) {
    const rates = [];
    for (const r of table) {
      const e = r?.effect || r;
      const t = String(e?.type ?? "").trim();
      if (t === "draw") {
        rates.push(100);
        continue;
      }
      const rr = Number(e?.rate ?? eff0?.rate);
      if (Number.isFinite(rr))
        rates.push(Math.max(0, Math.min(100, Math.trunc(rr))));
    }
    if (rates.length) {
      const mn = Math.min(...rates),
        mx = Math.max(...rates);
      return mn === mx
        ? "成功率 " + mn + "%（表選択）"
        : "成功率 " + mn + "-" + mx + "%（表選択）";
    }
    return "成功率（表選択）";
  }

  const t = String(eff0?.type ?? "").trim();
  if (t === "draw") return "成功率100%（ドロー）";
  const rate = Number(eff0?.rate);
  if (Number.isFinite(rate))
    return "成功率" + Math.max(0, Math.min(100, Math.trunc(rate))) + "%";
  return "謌仙粥邇・100%";
}

function supportTargetText(def) {
  const m = getSupportTargetMode(def);
  if (m === "ally") return "対象: 味方";
  if (m === "enemy") return "対象: 敵";
  return "対象: 任意";
}

function supportReadyByPlan(plan) {
  const need = plan?.need || "none";
  if (need === "none") return true;
  if (need === "unit") return !!supportTarget1Id;
  if (need === "unit2") {
    return (
      !!supportTarget1Id &&
      !!supportTarget2Id &&
      supportTarget1Id !== supportTarget2Id
    );
  }
  if (need === "unitCell") return !!supportTarget1Id && !!supportTargetCell;
  if (need === "units") {
    const cnt = Math.max(1, Number(plan?.count ?? 1) || 1);
    return Array.isArray(supportTargetIds) && supportTargetIds.length >= cnt;
  }
  if (need === "search") return true;
  return false;
}

function supportHintText(st) {
  const def = selectedHandDef(st);
  if (!def || !isSupportCard(def)) return "サポート: 手札のサポートカードを選択してね";
  const plan = supportPlan(def);

  const parts = [];
  parts.push("選択中: " + cardName(selectedHandCardId(st)));
  parts.push("効果: " + supportEffectSummary(def));
  parts.push(supportTargetText(def) + " / " + supportRateText(def));

  if (plan.need === "unit") {
    parts.push("手順: 対象ユニットをクリック > サポート実行");
    parts.push("対象: " + (supportTarget1Id ? "選択済み" : "未選択"));
  } else if (plan.need === "unit2") {
    parts.push("手順: ユニット1 > ユニット2 > サポート実行");
    parts.push("1体目:" + (supportTarget1Id ? "OK" : "未") + " / 2体目:" + (supportTarget2Id ? "OK" : "未"));
  } else if (plan.need === "unitCell") {
    parts.push("手順: 移動させるユニット > 移動先マス > サポート実行");
    parts.push("ユニット:" + (supportTarget1Id ? "OK" : "未") + " / マス:" + (supportTargetCell ? "OK(" + supportTargetCell.x + "," + supportTargetCell.y + ")" : "未"));
  } else if (plan.need === "units") {
    const cnt = Math.max(1, Number(plan?.count ?? 1) || 1);
    parts.push("手順: 対象ユニットを" + cnt + "体クリック > サポート実行");
    parts.push("選択: " + (Array.isArray(supportTargetIds) ? supportTargetIds.length : 0) + "/" + cnt);
  } else if (plan.need === "search") {
    const opts = supportSearchOptions(st, def);
    parts.push("手順: デッキからカードを選択 → サポート実行");
    parts.push(plan.fixedCardId ? "対象: " + cardName(plan.fixedCardId) : "候補: " + opts.length + "種類");
  } else {
    parts.push("手順: サポート実行で発動");
  }

  return parts.join("\n");
}

function countMyAliveUnits(units, owner) {
  // 蜿ｬ蝟壼宛髯舌き繧ｦ繝ｳ繝茨ｼ嗔anic縺ｯ逶､髱｢縺ｫ谿九☆險ｭ險医↑縺ｮ縺ｧ縲悟ｴ縺ｮ繝ｦ繝九ャ繝医阪→縺励※謨ｰ縺医ｋ
  const arr = Array.isArray(units) ? units : [];
  return arr.filter(
    (u) => u && u.owner === owner && (Number(u.hp) > 0 || !!u.panic),
  ).length;
}

function moveUsedThisTurn(u, st) {
  const curSeq = Number(st?.turnSeq ?? 1);
  if (!u) return 0;
  return Number(u.moveTurnSeq ?? 0) === curSeq ? Number(u.moveUsed ?? 0) : 0;
}

// Owner A moves upward, owner B moves downward.
function ownerForwardDy(owner) {
  return String(owner).toUpperCase() === "A" ? -1 : 1;
}

function expandTokenToOffsets(token, owner) {
  const t = String(token || "").trim();

  // 笨・attacker.owner 蝓ｺ貅悶・ forward
  const dyF = ownerForwardDy(owner);

  // 笨・r/l 霑ｽ蜉
  const m = t.match(/^(front|back|side|rf|lf|rb|lb|r|l|f)(\d+)$/i);
  if (m) {
    const kind = m[1].toLowerCase();
    const n = Math.max(1, Math.trunc(Number(m[2])));
    const res = [];
    for (let k = 1; k <= n; k++) {
      if (kind === "front" || kind === "f") res.push({ dx: 0, dy: dyF * k });
      else if (kind === "back") res.push({ dx: 0, dy: -dyF * k });
      else if (kind === "side") {
        res.push({ dx: k, dy: 0 });
        res.push({ dx: -k, dy: 0 });
      } else if (kind === "rf") res.push({ dx: k, dy: dyF * k });
      else if (kind === "lf") res.push({ dx: -k, dy: dyF * k });
      else if (kind === "rb") res.push({ dx: k, dy: -dyF * k });
      else if (kind === "lb") res.push({ dx: -k, dy: -dyF * k });
      else if (kind === "r") res.push({ dx: k, dy: 0 });
      else if (kind === "l") res.push({ dx: -k, dy: 0 });
    }
    return res;
  }

  if (t.toLowerCase() === "adj4") {
    return [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
  }
  return [];
}

function parseRangeSpecToOffsets(rangeSpec, owner) {
  const n = Number(rangeSpec);
  if (Number.isFinite(n)) {
    const r = Math.max(0, Math.trunc(n));
    const res = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx) + Math.abs(dy) <= r) res.push({ dx, dy });
      }
    }
    return res;
  }

  const s = String(rangeSpec || "")
    .replaceAll('"', "")
    .trim();
  if (!s) return [];

  const parts = s
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);
  let res = [];
  for (const p of parts) {
    res = res.concat(expandTokenToOffsets(p, owner));
  }
  const uniq = new Map();
  for (const o of res) uniq.set(String(o.dx) + "," + String(o.dy), o);
  return [...uniq.values()];
}

function inActionRange(attacker, targetX, targetY, rangeSpec) {
  if (!attacker) return false;
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  if (!offs.length) return false;
  const dx = targetX - attacker.x;
  const dy = targetY - attacker.y;
  return offs.some((o) => o.dx === dx && o.dy === dy);
}

function rangeSpecMaxDist(attacker, rangeSpec) {
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  let mx = 0;
  for (const o of offs) {
    mx = Math.max(mx, Math.abs(o.dx) + Math.abs(o.dy));
  }
  return mx;
}

let enemySupportToastTimer = null;
let lastEnemySupportToastAt = 0;

function hideEnemySupportToast() {
  if (!enemySupportToastEl) return;
  enemySupportToastEl.classList.remove("show", "ok", "bad");
  enemySupportToastEl.setAttribute("aria-hidden", "true");
}

function showEnemySupportToast({ title, body, ok }) {
  if (
    !enemySupportToastEl ||
    !enemySupportToastBodyEl ||
    !enemySupportToastTitleEl
  )
    return;

  enemySupportToastTitleEl.textContent = title || "相手がサポート発動";
  enemySupportToastBodyEl.textContent = body || "";

  enemySupportToastEl.classList.remove("ok", "bad");
  enemySupportToastEl.classList.add(ok ? "ok" : "bad");
  enemySupportToastEl.classList.add("show");
  enemySupportToastEl.setAttribute("aria-hidden", "false");

  if (enemySupportToastTimer) clearTimeout(enemySupportToastTimer);
  enemySupportToastTimer = setTimeout(() => {
    hideEnemySupportToast();
  }, 5000);
}

enemySupportToastCloseEl?.addEventListener("click", () => {
  hideEnemySupportToast();
});

// =====================
// UI helpers
// =====================
let diceRollAnimKey = "";
let diceRollAnimTimer = null;
let diceRollAnimDoneTimer = null;

function isDopagakiModeOn() {
  try {
    return (
      document.body?.classList?.contains("dopagaki-mode") ||
      localStorage.getItem("tcg_dopagaki_mode_v1") === "1"
    );
  } catch {
    return false;
  }
}

function diceRollLine(lastRoll) {
  if (!lastRoll) return "";
  return (
    "ROLL " +
    lastRoll.r +
    " / " +
    lastRoll.rate +
    "%  " +
    (lastRoll.hit ? "成功" : "失敗") +
    "  (" +
    lastRoll.actionName +
    ")"
  );
}

function supportRollLine(lastSupportRoll) {
  if (!lastSupportRoll) return "";
  const ok = lastSupportRoll.ok ? "成功" : "失敗";
  return (
    "ROLL " +
    lastSupportRoll.r +
    " / " +
    lastSupportRoll.label +
    "  " +
    ok +
    "  (Support:" +
    lastSupportRoll.cardName +
    ")"
  );
}

function currentDiceLines(lastRoll, lastSupportRoll) {
  const lines = [];
  if (lastRoll) {
    const age = nowMs() - (lastRoll.at || 0);
    if (age <= 2600) lines.push(diceRollLine(lastRoll));
  }
  if (lastSupportRoll) {
    const age2 = nowMs() - (lastSupportRoll.at || 0);
    if (age2 <= 2600) lines.push(supportRollLine(lastSupportRoll));
  }
  return lines;
}

function latestRollForAnimation(lastRoll, lastSupportRoll) {
  const candidates = [];
  if (lastRoll?.at) {
    candidates.push({
      key: "action:" + lastRoll.at,
      at: Number(lastRoll.at || 0),
      final: Math.trunc(Number(lastRoll.r ?? 0) || 0),
      label: String(lastRoll.actionName || "Action"),
      ok: !!lastRoll.hit,
      type: "action",
    });
  }
  if (lastSupportRoll?.at) {
    candidates.push({
      key: "support:" + lastSupportRoll.at,
      at: Number(lastSupportRoll.at || 0),
      final: Math.trunc(Number(lastSupportRoll.r ?? 0) || 0),
      label: String(lastSupportRoll.cardName || "Support"),
      ok: !!lastSupportRoll.ok,
      type: "support",
    });
  }
  candidates.sort((a, b) => b.at - a.at);
  const picked = candidates[0] || null;
  if (!picked) return null;
  if (nowMs() - picked.at > 760) return null;
  return picked;
}

function startDiceRollAnimation(primary, finalLines) {
  if (!diceEl || !primary) return;
  if (diceRollAnimTimer) clearInterval(diceRollAnimTimer);
  if (diceRollAnimDoneTimer) clearTimeout(diceRollAnimDoneTimer);

  const dopa = isDopagakiModeOn();
  const maxTicks = dopa ? 36 : 9;
  const tickMs = dopa ? 45 : 55;
  const revealMs = dopa ? 520 : 360;

  let tick = 0;
  diceEl.classList.remove("diceReveal", "ok", "bad", "diceDopaRolling");
  diceEl.classList.add("diceRolling");
  if (dopa) diceEl.classList.add("diceDopaRolling");
  diceEl.innerHTML =
    '<div class="diceRollBox' + (dopa ? ' diceRollBoxDopa' : '') + '">' +
    '<span class="diceRollLabel">' + (dopa ? "ARE YOU READY!!" : "ROLLING") + "</span>" +
    '<span class="diceRollNum">--</span>' +
    '<span class="diceRollSub">' + escapeBattleHtml(primary.label) + "</span>" +
    (dopa ? '<span class="diceRollPhase">3</span>' : "") +
    "</div>";

  const writeTick = (value) => {
    const num = diceEl.querySelector(".diceRollNum");
    if (num) num.textContent = String(value).padStart(2, "0");
  };

  const writeDopaPhase = () => {
    if (!dopa) return;
    const label = diceEl.querySelector(".diceRollLabel");
    const phase = diceEl.querySelector(".diceRollPhase");
    if (!label || !phase) return;
    if (tick < 8) {
      label.textContent = "ARE YOU READY!!";
      phase.textContent = "3";
    } else if (tick < 16) {
      label.textContent = "COUNT DOWN";
      phase.textContent = "2";
    } else if (tick < 24) {
      label.textContent = "COUNT DOWN";
      phase.textContent = "1";
    } else {
      label.textContent = "ROLL!";
      phase.textContent = "ROLL!";
    }
  };

  writeDopaPhase();
  diceRollAnimTimer = setInterval(() => {
    tick += 1;
    writeDopaPhase();
    writeTick(1 + Math.floor(Math.random() * 100));
    if (tick >= maxTicks) {
      clearInterval(diceRollAnimTimer);
      diceRollAnimTimer = null;
      writeTick(primary.final || 0);
      diceEl.classList.remove("diceRolling");
      diceEl.classList.add("diceReveal", primary.ok ? "ok" : "bad");
      diceRollAnimDoneTimer = setTimeout(() => {
        diceRollAnimDoneTimer = null;
        diceEl.classList.remove("diceReveal", "ok", "bad", "diceDopaRolling");
        diceEl.textContent = finalLines.join("\n");
      }, revealMs);
    }
  }, tickMs);
}

function showDiceRoll(lastRoll, lastSupportRoll) {
  if (!diceEl) return;

  const lines = currentDiceLines(lastRoll, lastSupportRoll);
  const primary = latestRollForAnimation(lastRoll, lastSupportRoll);

  if (primary && primary.key !== diceRollAnimKey) {
    diceRollAnimKey = primary.key;
    startDiceRollAnimation(primary, lines);
    return;
  }

  if (diceRollAnimTimer || diceRollAnimDoneTimer) return;
  diceEl.textContent = lines.join("\n");
}

function flashTurnBanner() {
  if (!turnBanner) return;
  clearTimeout(flashTurnBanner._fadeTimer);
  clearTimeout(flashTurnBanner._hideTimer);

  turnBanner.textContent = "あなたの番です";
  turnBanner.style.display = "block";
  turnBanner.style.opacity = "1";
  turnBanner.classList.remove("show");
  void turnBanner.offsetWidth;
  turnBanner.classList.add("show");
  document.body?.classList.add("myTurnGlow");

  flashTurnBanner._fadeTimer = setTimeout(() => {
    turnBanner.classList.remove("show");
    turnBanner.style.opacity = "0";
    document.body?.classList.remove("myTurnGlow");
  }, 1450);
  flashTurnBanner._hideTimer = setTimeout(() => {
    turnBanner.style.display = "none";
  }, 1750);
}

function renderManaGauge(manaObj, stForGauge = currentState) {
  if (!manaGaugeEl) return;
  manaGaugeEl.innerHTML = "";
  const m = normalizeMana(manaObj);
  const my = m[seat];
  const cur = Math.max(0, Math.min(Math.trunc(Number(my.cur ?? 0)), MAX_MANA_UI));
  const max = Math.max(0, Math.min(Math.trunc(Number(my.max ?? 0)), MAX_MANA_UI));
  const bonusMaxCount = Math.max(
    0,
    Math.min(
      max,
      Math.trunc(Number(stForGauge?.manaBonusMax?.[seat] ?? 0) || 0),
    ),
  );
  const bonusMaxStart = Math.max(0, max - bonusMaxCount);
  const visibleTotal = Math.max(cur, max);
  const spent = Math.max(0, max - cur);

  manaGaugeEl.dataset.cur = String(cur);
  manaGaugeEl.dataset.max = String(max);
  manaGaugeEl.dataset.spent = String(spent);
  manaGaugeEl.title = "Mana " + cur + "/" + max + (spent ? " / spent " + spent : "");

  for (let i = 0; i < max; i++) {
    const pip = document.createElement("div");
    const classes = ["manaPip", "max"];
    if (i >= bonusMaxStart && bonusMaxCount > 0) classes.push("bonusMax");
    if (i < cur) classes.push("on");
    else classes.push("spent");
    pip.className = classes.join(" ");
    pip.title =
      i < cur
        ? "Available mana " + (i + 1) + "/" + max
        : "Spent mana " + (i + 1) + "/" + max;
    manaGaugeEl.appendChild(pip);
  }
  for (let i = max; i < cur; i++) {
    const pip = document.createElement("div");
    pip.className = "manaPip temp on";
    pip.title = "Temporary mana " + (i + 1);
    manaGaugeEl.appendChild(pip);
  }
  for (let i = visibleTotal; i < MAX_MANA_UI; i++) {
    const pip = document.createElement("div");
    pip.className =
      i >= STANDARD_MAX_MANA_UI ? "manaPip locked bonusSlot" : "manaPip locked";
    pip.title =
      i >= STANDARD_MAX_MANA_UI
        ? "Bonus mana slot " + (i + 1)
        : "Locked mana slot " + (i + 1);
    manaGaugeEl.appendChild(pip);
  }
}

// bonus: [{ when:"<=40", addStatus:"bleed", v:10 }, ...]
function bonusUiText(a) {
  const bonus = Array.isArray(a?.bonus) ? a.bonus : [];
  if (!bonus.length) return "";

  const parts = [];
  for (const b of bonus) {
    const whenRaw = String(b?.when ?? "").trim();
    const add = String(b?.addStatus ?? "").trim();
    if (!whenRaw || !add) continue;

    const m = whenRaw.match(/^(<=|>=|<|>|==)\s*(\d+)$/);
    let whenText = whenRaw;
    if (m) {
      const op = m[1];
      const n = Math.max(1, Math.min(100, Math.trunc(Number(m[2]))));
      if (op === "<=")
        whenText = "<" + n + "%";
      else if (op === "<") whenText = "<" + n + "%";
      else if (op === ">=") whenText = ">=" + n + "%";
      else if (op === ">") whenText = ">" + n + "%";
      else if (op === "==") whenText = "=" + n + "%";
    } else {
      whenText = whenRaw.includes("%") ? whenRaw : whenRaw + "%";
    }

    parts.push(whenText + " " + bonusIcon(add));
  }

  return parts.length ? parts.join(" ") : "";
}

function getStatusLocal(unit) {
  try {
    if (typeof getStatus === "function") {
      const st = getStatus(unit);
      if (st && typeof st === "object" && !Array.isArray(st)) return st;
    }
  } catch {}

  const out = {};

  const a =
    unit &&
    unit.status &&
    typeof unit.status === "object" &&
    !Array.isArray(unit.status)
      ? unit.status
      : null;
  const b =
    unit &&
    unit.statuses &&
    typeof unit.statuses === "object" &&
    !Array.isArray(unit.statuses)
      ? unit.statuses
      : null;

  if (b) Object.assign(out, b);
  if (a) Object.assign(out, a);

  const arr1 = Array.isArray(unit?.status) ? unit.status : null;
  const arr2 = Array.isArray(unit?.statuses) ? unit.statuses : null;

  for (const k of arr2 || []) {
    const kk = String(k || "").trim();
    if (!kk) continue;
    if (!out[kk]) out[kk] = { v: true };
  }
  for (const k of arr1 || []) {
    const kk = String(k || "").trim();
    if (!kk) continue;
    if (!out[kk]) out[kk] = { v: true };
  }

  const tags = Array.isArray(unit?.tags) ? unit.tags : null;
  for (const k of tags || []) {
    const kk = String(k || "").trim();
    if (!kk) continue;
    if (STATUS_ICON[kk] && !out[kk]) out[kk] = { v: true };
  }

  return out;
}

function statusIconsText(unit) {
  const items = statusIconItems(unit);
  return items.map((it) => String(it.icon || "") + String(it.text || "")).join(" ");
}

function statusIconItems(unit) {
  const st = getStatusLocal(unit);
  const keys = Object.keys(st || {});
  const order = [
    "panic",
    "fatigue",
    "armor",
    "bleed",
    "poison",
    "fracture",
    "smell",
    "lostSoul",
    "blind",
    "evade",
    "combo",
    "followUp",
    "aim",
    "hitUp",
    "jinx",
    "powerUp",
    "power",
    "rage",
    "brainwash",
    "sludge",
    "counter",
    "seal",
  ];

  if (keys.length) {
    keys.sort(
      (a, b) =>
        (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) -
        (order.indexOf(b) === -1 ? 999 : order.indexOf(b)),
    );
  }

  const parts = [];
  const labelMap = {
    panic: "PANIC",
    fatigue: "疲労",
    armor: "装甲",
    bleed: "出血",
    poison: "毒",
    fracture: "骨折",
    smell: "におい",
    lostSoul: "失魂",
    blind: "盲目",
    evade: "回避",
    combo: "連撃",
    followUp: "追撃",
    aim: "命中増加",
    hitUp: "命中増加",
    jinx: "命中",
    powerUp: "攻撃増加",
    power: "威力",
    rage: "激怒",
    brainwash: "洗脳",
    sludge: "ヘドロ",
    counter: "カウンター",
    seal: "封印",
    taiman: "タイマン",
  };

  const statusPart = (label, v, sign = "") => {
    if (v == null || v === true || v === "") return label;
    const n = Number(v);
    if (Number.isFinite(n)) return label + sign + Math.trunc(n);
    return label + String(v);
  };

  if (isPanic(unit)) {
    parts.push({
      key: "panic",
      icon: "!",
      label: "PANIC",
      text: "PANIC",
      value: "",
      title: "PANIC: 戦闘不能扱い / 行動不可",
      tone: "bad",
    });
  }
  if (unit?.fatigue) {
    parts.push({
      key: "fatigue",
      icon: "F",
      label: "疲労",
      text: "疲労",
      value: "",
      title: "疲労: このターン行動不可",
      tone: "warn",
    });
  }

  for (const k of keys) {
    const icon = STATUS_ICON[k] || "!";
    const v = st[k]?.v;
    const label = labelMap[k] || k;
    let text = "";
    let value = "";
    let title = "";
    let tone = "neutral";

    if (k === "armor") {
      value = String(Math.trunc(Number(v ?? 0)));
      text = statusPart(label, v ?? 0);
      title = "装甲: ダメージ吸収 " + value;
      tone = "good";
    } else if (k === "evade") {
      value = Math.trunc(Number(v ?? 0)) + "%";
      text = statusPart(label, v ?? 0);
      title = "回避: " + value + "で攻撃を無効化";
      tone = "good";
    } else if (k === "bleed") {
      value = String(Math.trunc(Number(v ?? 10)));
      text = statusPart(label, v ?? 10);
      title = "出血: 移動時 HP-" + value;
      tone = "bad";
    } else if (k === "poison") {
      value = String(Math.trunc(Number(v ?? 10)));
      text = statusPart(label, v ?? 10);
      title = "毒: ターン開始時に50%で解除。失敗時 HP-" + value;
      tone = "bad";
    } else if (k === "smell") {
      value = String(Math.trunc(Number(v ?? 10)));
      text = statusPart(label, v ?? 10);
      title = "におい: ターン終了時 SP-" + value;
      tone = "bad";
    } else if (k === "aim" || k === "hitUp") {
      value = "+" + Math.trunc(Number(v ?? 0));
      text = statusPart(label, v ?? 0, "+");
      title = "命中強化: 命中" + value + "%";
      tone = "good";
    } else if (k === "jinx") {
      value = "-" + Math.trunc(Number(v ?? 0));
      text = statusPart(label, v ?? 0, "-");
      title = "命中低下: 命中" + value + "%";
      tone = "bad";
    } else if (k === "powerUp" || k === "power") {
      value = "+" + Math.trunc(Number(v ?? 0));
      text = statusPart(label, v ?? 0, "+");
      title = "攻撃増加: HPダメージ" + value;
      tone = "good";
    } else if (k === "rage") {
      value = String(Math.trunc(Number(v ?? 20)));
      text = statusPart(label, v ?? 20);
      title = "激怒: 技失敗時 HP-" + value;
      tone = "bad";
    } else if (k === "sludge") {
      value = "+" + Math.trunc(Number(v ?? 1));
      text = statusPart(label, v ?? 1);
      title = "ヘドロ: 技コスト" + value;
      tone = "bad";
    } else if (k === "counter") {
      value = Math.trunc(Number(v ?? 30)) + "%";
      text = statusPart(label, v ?? 30);
      title = "カウンター: " + value + "でダメージ0、10反撃";
      tone = "good";
    } else if (k === "brainwash") {
      text = label;
      title = "洗脳: 50%で成功。相手の技をマナを払って使用可能";
      tone = "bad";
    } else if (k === "blind") {
      text = label;
      title = "盲目: 使用する技の成功率半減";
      tone = "bad";
    } else if (k === "fracture") {
      text = label;
      title = "骨折: 移動不可";
      tone = "bad";
    } else if (k === "lostSoul") {
      text = label;
      title = "失魂: サポート・技による補助を受けない";
      tone = "bad";
    } else if (k === "seal") {
      text = label;
      title = "封印: 攻撃技を使用不可";
      tone = "bad";
    } else {
      text = statusPart(label, v);
      value = v != null && v !== true ? String(v) : "";
      title = label + (value ? ": " + value : "");
    }

    parts.push({ key: k, icon, label, text, value, title, tone });
  }

  return parts;
}

function escapeStatusHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusIconClassName(key) {
  const k = String(key || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return k || "fallback";
}

function statusIconSketchHtml(key, fallback) {
  const cls = statusIconClassName(key);
  return (
    '<span class="statusDoodle statusDoodle-' +
    escapeStatusHtml(cls) +
    '" aria-hidden="true"><i></i><b></b><em></em><strong></strong><span>' +
    escapeStatusHtml(fallback || "!") +
    "</span></span>"
  );
}

function statusIconsHtml(unit, opts = {}) {
  const items = statusIconItems(unit);
  if (!items.length) return "";
  const compact = opts.compact !== false;
  return items
    .map((it) => {
      const title = escapeStatusHtml(it.title || it.text || it.label || it.key);
      const value = compact ? "" : '<span class="statusChipText">' + escapeStatusHtml(it.text) + "</span>";
      return '<span class="statusChip ' + escapeStatusHtml(it.tone || "neutral") + '" title="' + title + '" aria-label="' + title + '">' +
        '<span class="statusChipIcon">' + statusIconSketchHtml(it.key, it.icon) + "</span>" + value +
        "</span>";
    })
    .join("");
}

btnSummon && (btnSummon.onclick = () => setMode("summon"));
btnMove && (btnMove.onclick = () => setMode("move"));
btnEvolve && (btnEvolve.onclick = () => setMode("evolve"));
btnSupport && (btnSupport.onclick = () => setMode("support"));
btnAttack && (btnAttack.onclick = () => setMode("attack"));

btnQuickMove?.addEventListener("click", () => setMode("move"));
btnQuickAttack?.addEventListener("click", async () => {
  // クイック攻撃は攻撃モードへ切り替えて、対象選択から実行する。
  setMode("attack");
  render(currentState);
});

function isAttackCancelIgnoredTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return !!target.closest(
    [
      "#board",
      "#actionPicker",
      "#hand",
      "#handDrawer",
      "#handDrawerToggle",
      "#detail",
      "#quickActions",
      ".actionOrbit",
      "button",
      "input",
      "select",
      "textarea",
      "a",
    ].join(","),
  );
}

document.addEventListener("click", (ev) => {
  if (mode !== "attack") return;
  const st = currentState;
  if (!canControl(st)) return;
  if (isAttackCancelIgnoredTarget(ev.target)) return;
  clearCommandSelectionUI({ keepUnit: true });
});

// =====================
// 笘・ｿｽ蜉・壽茶遐ｴ繧ｫ繧ｦ繝ｳ繝茨ｼ・anic繧よ茶遐ｴ謇ｱ縺・ｼ・// =====================
function countKillIfNeeded(
  target,
  killerSeat,
  kills,
  logLines,
  reason = "破壊",
) {
  if (!target || !kills) return;
  if (target.countedAsKill) return;

  target.countedAsKill = true;
  kills[killerSeat] = (kills[killerSeat] ?? 0) + 1;
  if (logLines)
    logLines.push("[" + killerSeat + "] " + reason + ": " + cardName(target.cardId));
}

function setPanicAndCountIfNeeded(
  target,
  killerSeat,
  kills,
  logLines,
  reason = "パニック破壊",
) {
  if (!target) return;
  if (Number(target.sp) <= 0 && Number(target.hp) > 0) {
    const was = !!target.panic;
    target.panic = true;
    if (!was) {
      target.panicKillSeat = killerSeat;
      countKillIfNeeded(target, killerSeat, kills, logLines, reason);
    }
  }
}

function reviveFromPanicIfHealed(u, kills, logLines) {
  if (!u || !u.panic) return false;
  if (Number(u.hp) > 0 && Number(u.sp) > 0) {
    u.panic = false;

    const ks = normSeat(u.panicKillSeat);
    if (ks && kills && typeof kills[ks] === "number") {
      kills[ks] = Math.max(0, Math.trunc(Number(kills[ks] ?? 0)) - 1);
    }

    u.countedAsKill = false;
    u.panicKillSeat = null;

    if (logLines)
      logLines.push("[" + u.owner + "] 復帰: " + cardName(u.cardId) + "（パニック解除）");
    return true;
  }
  return false;
}

function normalizePanicForAll(units, kills, logLines) {
  const arr = Array.isArray(units) ? units : [];
  for (const u of arr) {
    reviveFromPanicIfHealed(u, kills, logLines);
  }
}

// =====================
// v1.8.0: 蟆・ｨ九ワ繧､繝ｩ繧､繝・// =====================
function buildRangeMap(st) {
  const map = new Map();
  if (!st) return map;
  if (mode !== "attack") return map;

  ensureSelectedActionIndex(st);

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return map;

  const acts = unitActionChoices(su, st);
  const act = acts[selectedActionIndex] || acts[0] || null;
  if (!act) return map;

  const units = Array.isArray(st.units) ? st.units : [];
  const flags = actFlags(act);

  if (isSelfRange(act.range)) {
    map.set(String(su.x) + "," + String(su.y), { ok: true, self: true });
    return map;
  }

  if (flags.aoe) {
    const offs = parseRangeSpecToOffsets(act.range, su.owner);

    for (const o of offs) {
      const x = su.x + o.dx;
      const y = su.y + o.dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;

      // AOE は現在ブロック判定を通さない
      //   const pseudo = { x, y };
      //   if (isLineBlocked(units, su, pseudo)) {
      //     map.set(String(x) + "," + String(y), { ok: false, reason: "blocked" });
      //     continue;
      //   }
      // }

      map.set(String(x) + "," + String(y), { ok: true });
    }
    return map;
  }

  const offs = parseRangeSpecToOffsets(act.range, su.owner);
  for (const o of offs) {
    const x = su.x + o.dx;
    const y = su.y + o.dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;

    if (!flags.pierce) {
      const pseudo = { x, y };
      if (isLineBlocked(units, su, pseudo)) {
        map.set(String(x) + "," + String(y), { ok: false, reason: "blocked" });
        continue;
      }
    }
    map.set(String(x) + "," + String(y), { ok: true });
  }
  return map;
}

function buildSupportMap(st) {
  const map = new Map();
  if (!st) return map;
  if (mode !== "support") return map;
  if (!canControl(st)) return map;

  const def = selectedHandDef(st);
  if (!def || !isSupportCard(def)) return map;

  const plan = supportPlan(def);
  const tMode = getSupportTargetMode(def);
  const units = Array.isArray(st.units) ? st.units : [];

  // unit: 対象ユニット
  if (plan.need === "unit") {
    for (const u of units) {
      if (!u || Number(u.hp) <= 0) continue;
      if (!supportCanPickUnit(u, seat, tMode)) continue;
      map.set(String(u.x) + "," + String(u.y), { ok: true, kind: "unit" });
    }
    return map;
  }

  // unit2: 1体目の後に2体目を選ぶ
  if (plan.need === "unit2") {
    for (const u of units) {
      if (!u || Number(u.hp) <= 0) continue;
      if (supportTarget1Id && u.id === supportTarget1Id) continue;
      if (!supportCanPickUnit(u, seat, tMode)) continue;
      map.set(String(u.x) + "," + String(u.y), { ok: true, kind: "unit2" });
    }
    return map;
  }
  if (plan.need === "units") {
    for (const u of units) {
      if (!u || Number(u.hp) <= 0) continue;
      if (!supportCanPickUnit(u, seat, tMode)) continue;
      map.set(String(u.x) + "," + String(u.y), { ok: true, kind: "units" });
    }
    return map;
  }

  // unitCell: ユニットを選んだ後、空きマスを選ぶ
  if (plan.need === "unitCell") {
    if (!supportTarget1Id) {
      for (const u of units) {
        if (!u || Number(u.hp) <= 0) continue;
        if (!supportCanPickUnit(u, seat, tMode)) continue;
        map.set(String(u.x) + "," + String(u.y), { ok: true, kind: "pickUnit" });
      }
      return map;
    }
    // 空きマス候補
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const occ = units.find(
          (v) => v && Number(v.hp) > 0 && v.x === x && v.y === y,
        );
        if (occ) continue;
        map.set(String(x) + "," + String(y), { ok: true, kind: "pickCell" });
      }
    }
    return map;
  }

  return map;
}

// =====================
// 隧ｳ邏ｰ・域雰繧りｦ九ｌ繧具ｼ・// =====================
function getActDeltas(act) {
  const hpDeltaRaw =
    act && act.hpDelta !== undefined ? Number(act.hpDelta) : undefined;
  const spDeltaRaw =
    act && act.spDelta !== undefined ? Number(act.spDelta) : undefined;

  let hpDelta = Number.isFinite(hpDeltaRaw) ? Math.trunc(hpDeltaRaw) : 0;
  let spDelta = Number.isFinite(spDeltaRaw) ? Math.trunc(spDeltaRaw) : 0;

  if (!hpDeltaRaw && !spDeltaRaw && act) {
    const dmg = Number(act.dmg ?? act.damage ?? 0);
    const heal = Number(act.heal ?? 0);
    const dmgType = String(act.dmgType ?? act.damageType ?? "HP").toUpperCase();
    const healType = String(act.healType ?? "HP").toUpperCase();

    if (Number.isFinite(dmg) && dmg !== 0) {
      if (dmgType === "SP") spDelta -= Math.trunc(dmg);
      else hpDelta -= Math.trunc(dmg);
    }
    if (Number.isFinite(heal) && heal !== 0) {
      if (healType === "SP") spDelta += Math.trunc(heal);
      else hpDelta += Math.trunc(heal);
    }
  }

  // 笘・P/SP縺ｯ10蜊倅ｽ阪・荳也阜・壹％縺薙〒荳ｸ繧・ｼ亥ｮ牙・蛛ｴ・・  hpDelta = Math.trunc(hpDelta / 10) * 10;
  spDelta = Math.trunc(spDelta / 10) * 10;

  return { hpDelta, spDelta };
}

function getActChangeAttr(act) {
  if (!act || typeof act !== "object") return "";
  const direct = act.changeAttr ?? act.setAttr ?? act.attrChange ?? act.attributeChange;
  if (direct && typeof direct === "object") {
    return String(direct.attr ?? direct.to ?? direct.value ?? "").trim();
  }
  if (direct != null) return String(direct).trim();
  const effs = Array.isArray(act.effects)
    ? act.effects
    : Array.isArray(act.effect)
      ? act.effect
      : [];
  for (const eff of effs) {
    if (!eff || typeof eff !== "object") continue;
    const type = String(eff.type ?? "").toLowerCase();
    if (
      type === "changeattr" ||
      type === "setattr" ||
      type === "attrchange" ||
      type === "attributechange"
    ) {
      return String(eff.attr ?? eff.to ?? eff.value ?? eff.targetAttr ?? "").trim();
    }
  }
  return "";
}

function getBattleUnitAttr(unit) {
  const def = cardDefs?.[unit?.cardId] || {};
  return String(unit?.attrOverride || unit?.attr || unit?.type || def.attr || def.type || "").trim();
}

function applyBattleAttrChange(unit, nextAttr) {
  if (!unit || !nextAttr) return "";
  const before = getBattleUnitAttr(unit);
  unit.attrOverride = nextAttr;
  unit.attr = nextAttr;
  unit.status = unit.status && typeof unit.status === "object" ? unit.status : {};
  unit.status.attrChange = { attr: nextAttr, v: nextAttr, from: before, turns: 0 };
  return before;
}

function fmtDamageEffect(act) {
  const { hpDelta, spDelta } = getActDeltas(act);
  const parts = [];
  if (hpDelta < 0) parts.push("HPダメージ:" + Math.abs(hpDelta));
  if (spDelta < 0) parts.push("SPダメージ:" + Math.abs(spDelta));
  if (hpDelta > 0) parts.push("HP回復:+" + hpDelta);
  if (spDelta > 0) parts.push("SP回復:+" + spDelta);
  return parts.length ? parts.join(" / ") : "変化なし";
}

function escapeBattleHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let graveyardOpen = false;
let graveyardSeatView = null;
let graveyardUi = null;

function normalizeDiscardsObj(st) {
  if (!st) return { A: [], B: [] };
  st.discards = st.discards && typeof st.discards === "object" ? st.discards : {};
  st.discards.A = Array.isArray(st.discards.A) ? st.discards.A : [];
  st.discards.B = Array.isArray(st.discards.B) ? st.discards.B : [];
  return st.discards;
}

function graveyardEntries(st, side) {
  const s = normSeat(side) || "A";
  const discards = normalizeDiscardsObj(st);
  const list = [];
  for (const cid of discards[s] || []) {
    if (!cid) continue;
    list.push({ cardId: String(cid), source: "墓地" });
  }
  const units = Array.isArray(st?.units) ? st.units : [];
  for (const u of units) {
    if (!u || normSeat(u.owner) !== s) continue;
    const destroyed = Number(u.hp) <= 0 || (!!u.countedAsKill && !!u.panic);
    if (!destroyed || !u.cardId) continue;
    list.push({ cardId: String(u.cardId), source: "破壊済み" });
  }
  return list;
}

function graveyardCount(st, side) {
  return graveyardEntries(st, side).length;
}

function renderGraveyardList(st) {
  if (!graveyardUi) return;
  const viewSeat = normSeat(graveyardSeatView) || seat || "A";
  const entries = graveyardEntries(st, viewSeat).slice().reverse();
  const label = viewSeat === seat ? "自分" : "相手";

  graveyardUi.panel.querySelectorAll(".gyTab").forEach((btn) => {
    const active = btn.dataset.seat === viewSeat;
    btn.classList.toggle("active", active);
    btn.textContent =
      (btn.dataset.seat === seat ? "自分" : "相手") +
      " " +
      graveyardCount(st, btn.dataset.seat);
  });

  graveyardUi.title.textContent = `${label}の墓地`;
  graveyardUi.sub.textContent = `墓地 ${entries.length}枚`;

  if (!entries.length) {
    graveyardUi.list.innerHTML = `<div class="graveyardEmpty">まだ墓地にカードはありません。</div>`;
    return;
  }

  graveyardUi.list.innerHTML = entries
    .map((entry, i) => {
      const def = cardDefs?.[entry.cardId] || {};
      const name = cardName(entry.cardId);
      const kind = isSupportCard(def) ? "サポート" : "ユニット";
      const attr = isSupportCard(def) ? "補" : cardPreviewSymbol(def.type || def.attr, def.kind);
      const cost = def.cost ?? "?";
      const stat = isSupportCard(def)
        ? supportEffectTextJa?.(def.effect ?? def.effects ?? def.effectText ?? def.desc) || "効果"
        : `HP ${def.hp ?? "?"} / SP ${def.sp ?? "?"}`;
      return `
        <button class="graveyardCard" type="button" data-card-id="${escapeBattleHtml(entry.cardId)}">
          <span class="gyNo">${entries.length - i}</span>
          <span class="gyMark">${escapeBattleHtml(attr)}</span>
          <span class="gyMain">
            <b>${escapeBattleHtml(name)}</b>
            <small>${escapeBattleHtml(kind)} / cost ${escapeBattleHtml(cost)} / ${escapeBattleHtml(entry.source)}</small>
            <em>${escapeBattleHtml(stat)}</em>
          </span>
        </button>
      `;
    })
    .join("");

  graveyardUi.list.querySelectorAll(".graveyardCard").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cid = btn.dataset.cardId || "";
      if (cid) showCardDetail(cid);
    });
  });
}

function ensureGraveyardUi() {
  if (graveyardUi) return graveyardUi;
  const right = document.getElementById("rightPane");
  if (!right) return null;

  const openBtn = document.createElement("button");
  openBtn.id = "graveyardOpenBtn";
  openBtn.type = "button";
  openBtn.textContent = "墓地";

  const handTitle = [...right.querySelectorAll(".paneTitle")].find((el) =>
    String(el.textContent || "").includes("手札"),
  );
  if (handTitle) handTitle.insertAdjacentElement("afterend", openBtn);
  else right.insertBefore(openBtn, right.firstChild);

  const overlay = document.createElement("div");
  overlay.id = "graveyardOverlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="graveyardBackdrop"></div>
    <section class="graveyardPanel" role="dialog" aria-modal="true" aria-label="墓地">
      <header class="graveyardHead">
        <div>
          <b class="graveyardTitle">墓地</b>
          <span class="graveyardSub">0枚</span>
        </div>
        <button class="graveyardClose" type="button">閉じる</button>
      </header>
      <div class="graveyardTabs">
        <button class="gyTab" type="button" data-seat="A">A 0</button>
        <button class="gyTab" type="button" data-seat="B">B 0</button>
      </div>
      <div class="graveyardList"></div>
    </section>
  `;
  document.body.appendChild(overlay);

  graveyardUi = {
    openBtn,
    overlay,
    panel: overlay.querySelector(".graveyardPanel"),
    title: overlay.querySelector(".graveyardTitle"),
    sub: overlay.querySelector(".graveyardSub"),
    list: overlay.querySelector(".graveyardList"),
  };

  const close = () => {
    graveyardOpen = false;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  };
  const open = () => {
    graveyardSeatView = normSeat(graveyardSeatView) || seat || "A";
    graveyardOpen = true;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    renderGraveyardList(currentState);
  };

  openBtn.addEventListener("click", open);
  overlay.querySelector(".graveyardClose")?.addEventListener("click", close);
  overlay.querySelector(".graveyardBackdrop")?.addEventListener("click", close);
  overlay.querySelectorAll(".gyTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      graveyardSeatView = normSeat(btn.dataset.seat) || seat || "A";
      renderGraveyardList(currentState);
    });
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && graveyardOpen) close();
  });

  return graveyardUi;
}

function renderGraveyardUi(st) {
  const ui = ensureGraveyardUi();
  if (!ui) return;
  normalizeDiscardsObj(st);
  const mine = graveyardCount(st, seat);
  const enemy = graveyardCount(st, otherSeatOf(seat));
  ui.openBtn.textContent = `墓地 ${mine}`;
  ui.openBtn.title = `自分 ${mine}枚 / 相手 ${enemy}枚`;
  if (graveyardOpen) renderGraveyardList(st);
}

function ensureBattleCardPreviewCss() {
  if (document.getElementById("battleCardPreviewCss_repair1")) return;
  const css = document.createElement("style");
  css.id = "battleCardPreviewCss_repair1";
  css.textContent = [
    "#cardPreview.battleCardPreview{--card-accent:#7dd3fc;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:10px;margin-bottom:10px;background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.035));box-shadow:0 12px 32px rgba(0,0,0,.28);color:rgba(255,255,255,.94);overflow:hidden;}",
    ".battleCardPreview .bcEmpty{min-height:126px;display:grid;place-items:center;text-align:center;color:rgba(255,255,255,.62);font-size:12px;line-height:1.55;}",
    ".battleCardPreview .bcTop{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;align-items:stretch;}",
    ".battleCardPreview .bcArt{width:92px;aspect-ratio:5/7;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(150deg,var(--card-accent),#11141a 72%);position:relative;overflow:hidden;}",
    ".battleCardPreview .bcArtImg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;display:block;background:#f8f8f5;}",
    ".battleCardPreview .bcSymbol{position:absolute;inset:0;display:grid;place-items:center;font-size:30px;font-weight:1000;opacity:.42;text-shadow:0 8px 26px rgba(0,0,0,.45);}",
    ".battleCardPreview .bcCost{position:absolute;left:7px;top:7px;min-width:30px;height:30px;display:grid;place-items:center;border-radius:999px;border:1px solid rgba(255,255,255,.26);background:rgba(0,0,0,.42);font-weight:1000;font-size:15px;z-index:3;}",
    ".battleCardPreview .bcInfo{min-width:0;display:flex;flex-direction:column;gap:7px;}",
    ".battleCardPreview .bcName{font-size:15px;font-weight:1000;line-height:1.25;letter-spacing:0;word-break:break-word;}",
    ".battleCardPreview .bcSub{display:flex;gap:5px;flex-wrap:wrap;font-size:11px;color:rgba(255,255,255,.74);}",
    ".battleCardPreview .bcChip{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 7px;background:rgba(0,0,0,.22);white-space:nowrap;}",
    ".battleCardPreview .bcBars{display:grid;gap:5px;}",
    ".battleCardPreview .bcBar{display:grid;grid-template-columns:26px minmax(0,1fr) 58px;gap:6px;align-items:center;font-size:11px;color:rgba(255,255,255,.78);min-width:0;}",
    ".battleCardPreview .bcTrack{height:7px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;}",
    ".battleCardPreview .bcFill{display:block;height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,var(--card-accent),rgba(255,255,255,.76));}",
    ".battleCardPreview .bcActs{display:grid;gap:6px;margin-top:9px;}",
    ".battleCardPreview .bcAct{border:1px solid rgba(255,255,255,.11);border-radius:10px;padding:7px;background:rgba(0,0,0,.20);}",
    ".battleCardPreview .bcAct.active{border-color:rgba(125,211,252,.72);box-shadow:0 0 0 1px rgba(125,211,252,.28);background:rgba(125,211,252,.12);}",
    ".battleCardPreview .bcActHead{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12px;font-weight:950;}",
    ".battleCardPreview .bcActMeta{margin-top:4px;color:rgba(255,255,255,.68);font-size:11px;line-height:1.35;}",
    ".battleCardPreview .bcSupport{margin-top:9px;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px;background:rgba(0,0,0,.20);font-size:12px;line-height:1.45;}",
    "@media (max-width:760px){#cardPreview.battleCardPreview{margin:0 0 8px;padding:8px}.battleCardPreview .bcTop{grid-template-columns:74px minmax(0,1fr)}.battleCardPreview .bcArt{width:74px}.battleCardPreview .bcName{font-size:13px}}"
  ].join("\n");
  document.head.appendChild(css);
}

function cardPreviewSymbol(type, kind) {
  const t = String(type || "").trim();
  if (kind === "support") return "補";
  if (t.includes("火")) return "火";
  if (t.includes("水")) return "水";
  if (t.includes("雷")) return "雷";
  if (t.includes("草")) return "草";
  if (t.includes("風")) return "風";
  if (t.includes("鋼")) return "鋼";
  if (t.includes("光")) return "光";
  if (t.includes("闇")) return "闇";
  if (t.includes("幻")) return "幻";
  if (t.includes("呪")) return "呪";
  return "CARD";
}

function normalizeBattleAttr(v) {
  const raw = String(v ?? "").trim();
  const key = raw.toLowerCase();
  const map = {
    fire: "火",
    flame: "火",
    "炎": "火",
    "火": "火",
    water: "水",
    "水": "水",
    thunder: "雷",
    lightning: "雷",
    "雷": "雷",
    grass: "草",
    "草": "草",
    wind: "風",
    "風": "風",
    steel: "鋼",
    metal: "鋼",
    "鋼": "鋼",
    light: "光",
    "光": "光",
    dark: "闇",
    "闇": "闇",
    dream: "幻",
    illusion: "幻",
    "幻": "幻",
    curse: "呪",
    cursed: "呪",
    hex: "呪",
    "呪": "呪",
  };
  return map[raw] || map[key] || raw;
}

function pct(cur, max) {
  const a = Number(cur ?? 0);
  const b = Number(max ?? 0);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
}

function cardPreviewEffectText(act, owner) {
  const txt = actionEffectTextAdapter(act, owner);
  if (txt) return txt;
  const parts = [];
  const dmg = fmtDamageEffect(act);
  if (dmg) parts.push(dmg);
  const addS = displayAddStatus(act);
  if (addS) parts.push(addS);
  const specials = describeSpecialEffects(act);
  if (specials.length) parts.push(specials.join(" / "));
  const bonus = bonusUiText(act);
  if (bonus) parts.push(bonus);
  return parts.filter(Boolean).join(" / ");
}

function renderCardPreview(st) {
  if (!cardPreviewEl) return;
  ensureBattleCardPreviewCss();

  let source = "empty";
  let cardId = selectedHandCardId(st);
  let def = selectedHandDef(st);
  let unit = null;

  if (cardId && def) {
    source = "hand";
  } else {
    unit = getSelectedUnit(st) || getSelectedTarget(st);
    if (unit) {
      cardId = unit.cardId;
      def = cardDefs[cardId] || {};
      source = "unit";
    }
  }

  if (!cardId || !def) {
    cardPreviewEl.style.setProperty("--card-accent", "#7dd3fc");
    cardPreviewEl.innerHTML =
      '<div class="bcEmpty"><div><b>カード未選択</b><br>手札か盤面ユニットを選ぶと、ここにカード情報が出ます。</div></div>';
    return;
  }

  const kind = isSupportCard(def) ? "support" : "unit";
  const type = String(def.type || def.attr || "-");
  const accent = (() => {
    try {
      return typeColorStrong?.(type) || typeColor?.(type) || "#7dd3fc";
    } catch {
      return "#7dd3fc";
    }
  })();
  cardPreviewEl.style.setProperty("--card-accent", accent);

  const mana = normalizeMana(st?.mana);
  const curMana = seat ? Number(mana?.[seat]?.cur ?? 0) : 0;
  const baseCost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
  const title = cardName(cardId);
  const owner = unit?.owner || seat;
  const maxHp = round10(def?.hp ?? unit?.maxHp ?? unit?.hp ?? 0);
  const maxSp = round10(def?.sp ?? unit?.maxSp ?? unit?.sp ?? 0);
  const hpNow = unit ? round10(unit.hp) : maxHp;
  const spNow = unit ? round10(unit.sp) : maxSp;
  const costLabel = kind === "support" ? baseCost : unit ? "場" : baseCost;
  const canPay = source === "hand" ? curMana >= baseCost : true;

  const chipKind = kind === "support" ? "サポート" : "ユニット";
  const sourceChip = source === "hand"
    ? (canPay ? "使用可" : "マナ不足")
    : (unit?.owner ? "所有:" + unit.owner : "選択中");
  const chips = [
    '<span class="bcChip">' + escapeBattleHtml(chipKind) + '</span>',
    '<span class="bcChip">' + escapeBattleHtml(type) + '</span>',
    '<span class="bcChip">' + escapeBattleHtml(sourceChip) + '</span>',
  ].join("");

  const barHtml = (label, now, max) =>
    '<div class="bcBar"><span>' + escapeBattleHtml(label) + '</span>' +
    '<div class="bcTrack"><i class="bcFill" style="width:' + pct(now, max) + '%"></i></div>' +
    '<span>' + escapeBattleHtml(now) + '/' + escapeBattleHtml(max) + '</span></div>';

  const manaPct = curMana > 0
    ? Math.min(100, Math.round((baseCost / Math.max(curMana, baseCost || 1)) * 100))
    : 0;
  const statsHtml = kind === "support"
    ? '<div class="bcBars"><div class="bcBar"><span>MP</span><div class="bcTrack"><i class="bcFill" style="width:' +
      manaPct + '%"></i></div><span>' + escapeBattleHtml(baseCost) + '/' + escapeBattleHtml(curMana) +
      '</span></div></div>'
    : '<div class="bcBars">' + barHtml("HP", hpNow, maxHp) + barHtml("SP", spNow, maxSp) + '</div>';

  let body = "";
  if (kind === "support") {
    body = '<div class="bcSupport"><b>効果</b><br>' +
      escapeBattleHtml(supportEffectSummary(def) || "効果なし") +
      '</div>';
  } else {
    const acts = unit ? unitActionChoices(unit, st) : (Array.isArray(def.actions) ? def.actions : []);
    const shownActs = acts.slice(0, 4);
    const actionHtml = shownActs.length
      ? shownActs.map((a, i) => {
        const active = unit && i === selectedActionIndex;
        const cost = unit ? effectiveActionCost(unit, a) : Math.max(0, Math.trunc(Number(a?.cost ?? 0)));
        const rate = unit ? calcHitRateAdapter(unit, a) : getActRate(a);
        const rangeLbl = actRangeLabel(a, owner);
        const effect = cardPreviewEffectText(a, owner);
        return '<div class="bcAct ' + (active ? "active" : "") + '">' +
          '<div class="bcActHead"><span>' + escapeBattleHtml(a?.name || "技") +
          '</span><span>消費' + escapeBattleHtml(cost) + '</span></div>' +
          '<div class="bcActMeta">射程:' + escapeBattleHtml(rangeLbl) +
          ' / 成功:' + escapeBattleHtml(rate) + '%<br>' +
          escapeBattleHtml(effect || "追加効果なし") + '</div></div>';
      }).join("")
      : '<div class="bcSupport">技なし</div>';
    body = '<div class="bcActs">' + actionHtml + '</div>';
  }

  cardPreviewEl.innerHTML =
    '<div class="bcTop"><div class="bcArt" aria-hidden="true">' +
    cardArtImgHtml(cardId, def, "bcArtImg") +
    '<div class="bcCost">' + escapeBattleHtml(costLabel) + '</div>' +
    '<div class="bcSymbol">' + escapeBattleHtml(cardPreviewSymbol(type, kind)) + '</div></div>' +
    '<div class="bcInfo"><div class="bcName">' + escapeBattleHtml(title) + '</div>' +
    '<div class="bcSub">' + chips + '</div>' + statsHtml + '</div></div>' + body;
}

function showCardDetail(cardId) {
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  let html = '<b>' + escapeBattleHtml(cardName(cardId)) + '</b> <span class="small">(' +
    escapeBattleHtml(cardId) + ')</span><br>';
  html += '属性:' + escapeBattleHtml(d.type ?? "?") + ' / コスト:' +
    escapeBattleHtml(d.cost ?? "?") + '<br>';
  if (!isSupportCard(d)) {
    html += 'HP:' + escapeBattleHtml(d.hp ?? "?") + ' SP:' + escapeBattleHtml(d.sp ?? "?") + '<br>';
  }

  if (isSupportCard(d)) {
    html += '<br><b>サポート</b><br>';
    html += '<span class="small">コスト:' + escapeBattleHtml(d.cost ?? "?") + '</span><br>';
    html += '<span class="small">' + escapeBattleHtml(supportEffectSummary(d) || "効果なし") + '</span>';
    detailEl.innerHTML = html;
    return;
  }

  html += '<br><b>技（行動）</b><br>';

  const acts = d.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  acts.forEach((a) => {
    const rangeLbl = actRangeLabel(a, seat);
    const rate = getActRate(a);

    html += '【' + escapeBattleHtml(a.cost ?? "?") + '】' +
      escapeBattleHtml(a.name ?? "?") + ' (射程:' + escapeBattleHtml(rangeLbl) +
      ' 成功:' + escapeBattleHtml(rate) + '%)<br>';

    const txt = actionEffectTextAdapter(a, seat);
    if (txt) {
      html += '<span class="small">' + escapeBattleHtml(txt) + '</span><br>';
    } else {
      const addS = displayAddStatus(a);
      html += '<span class="small">ダメージ/回復:' +
        escapeBattleHtml(fmtDamageEffect(a) || "なし") +
        escapeBattleHtml(addS || "") + '</span><br>';

      const specials = describeSpecialEffects(a);
      if (specials.length)
        html += '<span class="small">特殊:' + escapeBattleHtml(specials.join(" / ")) + '</span><br>';

      const bonusText = bonusUiText(a);
      if (bonusText) html += '<span class="small">追加:' + escapeBattleHtml(bonusText) + '</span><br>';
    }

    html += '<br>';
  });

  detailEl.innerHTML = html;
}

function showUnitDetail(u, st = currentState) {
  if (!detailEl) return;

  const def = cardDefs[u.cardId] || {};
  let html = '<b>' + escapeBattleHtml(cardName(u.cardId)) + '</b> <span class="small">(' +
    escapeBattleHtml(u.cardId) + ')</span><br>';
  html += '属性:' + escapeBattleHtml(def.type ?? "?") + ' / 所有:' + escapeBattleHtml(u.owner) + '<br>';
  const maxHp = round10(def?.hp ?? u.hp);
  const maxSp = round10(def?.sp ?? u.sp);
  html += 'HP:' + escapeBattleHtml(round10(u.hp)) + '/' + escapeBattleHtml(maxHp) +
    ' SP:' + escapeBattleHtml(round10(u.sp)) + '/' + escapeBattleHtml(maxSp) + '<br>';
  html += '疲労:' + (u.fatigue ? "あり" : "なし") + '<br>';

  const used = moveUsedThisTurn(u, st);
  html += '移動:' + escapeBattleHtml(used) + '/2（ターン中）<br>';

  html += '状態:' + (isPanic(u) ? "パニック（死亡扱い・行動不可）" : "通常") + '<br>';
  const statusHtml = statusIconsHtml(u, { compact: false });
  html += '状態異常:' + (statusHtml ? '<div class="statusChipRow detail">' + statusHtml + '</div>' : "なし") + '<br><br>';

  const acts = def.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  html += '<b>技（行動）</b><br>';

  acts.forEach((a) => {
    const rangeLbl = actRangeLabel(a, u.owner);
    const rate = getActRate(a);

    html += '【' + escapeBattleHtml(a.cost ?? "?") + '】' +
      escapeBattleHtml(a.name ?? "?") + ' (射程:' + escapeBattleHtml(rangeLbl) +
      ' 成功:' + escapeBattleHtml(rate) + '%)<br>';

    const txt = actionEffectTextAdapter(a, u.owner);
    if (txt) {
      html += '<span class="small">' + escapeBattleHtml(txt) + '</span><br>';
    } else {
      const addS = displayAddStatus(a);
      html += '<span class="small">ダメージ/回復:' +
        escapeBattleHtml(fmtDamageEffect(a) || "なし") +
        escapeBattleHtml(addS || "") + '</span><br>';
      const specials = describeSpecialEffects(a);
      if (specials.length)
        html += '<span class="small">特殊:' + escapeBattleHtml(specials.join(" / ")) + '</span><br>';
    }

    html += '<br>';
  });

  detailEl.innerHTML = html;
}

// =====================
// Quick actions
// =====================
function updateQuickActions(st) {
  if (!quickActionsEl) return;

  const myTurn = canControl(st);
  const su = getSelectedUnit(st);

  if (!myTurn || !su || su.owner !== seat) {
    quickActionsEl.style.display = "none";
    return;
  }
  quickActionsEl.style.display = "block";

  ensureSelectedActionIndex(st);

  const mana = normalizeMana(st.mana);
  const fatigued = !!su.fatigue;
  const acts = unitActionChoices(su, st);
  const act = acts[selectedActionIndex] || acts[0] || null;

  const used = moveUsedThisTurn(su, st);

  if (btnQuickMove) {
    btnQuickMove.disabled =
      isPanic(su) || isMoveBlockedByStatus(su) || used >= 2;
  }

  const canPay = act ? mana[seat].cur >= effectiveActionCost(su, act) : false;
  if (btnQuickAttack) {
    // 疲労中でも移動はできるので、攻撃不可条件だけここで判定する。
    btnQuickAttack.disabled = !act || isPanic(su) || !canPay;
  }

  if (!quickMsgEl) return;

  if (isPanic(su))
    quickMsgEl.textContent = "パニック中: 死亡扱いで行動不可（回復で復帰）";
  else if (isMoveBlockedByStatus(su)) quickMsgEl.textContent = "骨折中: 移動できません";
  else if (used >= 2)
    quickMsgEl.textContent = "移動不可: このターンはもう動けません";
  else if (!act) quickMsgEl.textContent = "行動がないカードです";
  else if (fatigued)
    quickMsgEl.textContent = "疲労中: 行動できません（移動はOK）";
  else if (!canPay) quickMsgEl.textContent = "マナ不足: 行動できません";
  else if (mode === "attack")
    quickMsgEl.textContent = "対象を選んで「行動実行」で確定";
  else quickMsgEl.textContent = "";
}

// =====================
// FX helpers
// =====================
function cellIndex(x, y) {
  return y * W + x;
}

function fxFlash(kind = "hit") {
  if (!fxFlashEl) return;
  fxFlashEl.classList.remove("on", "kill", "hp", "sp", "mix");
  void fxFlashEl.offsetWidth;
  fxFlashEl.classList.add("on");
  if (kind === "kill") fxFlashEl.classList.add("kill");
  else if (kind === "hp") fxFlashEl.classList.add("hp");
  else if (kind === "sp") fxFlashEl.classList.add("sp");
  else if (kind === "mix") fxFlashEl.classList.add("mix");
  setTimeout(() => fxFlashEl.classList.remove("on", "kill", "hp", "sp", "mix"), 260);
}

let lastHitAtSeen = 0;
let lastMoveAtSeen = 0;

function cellForModelPos(pos) {
  if (!boardEl || !pos) return null;
  const mx = Math.trunc(Number(pos.x));
  const my = Math.trunc(Number(pos.y));
  if (!Number.isFinite(mx) || !Number.isFinite(my)) return null;
  const v = toViewXY(mx, my);
  return (
    boardEl.querySelector(`.cell[data-x="${v.x}"][data-y="${v.y}"]`) ||
    boardEl.children?.[cellIndex(v.x, v.y)] ||
    null
  );
}

function cellCenterInBoard(cell) {
  if (!boardEl || !cell) return null;
  const br = boardEl.getBoundingClientRect();
  const cr = cell.getBoundingClientRect();
  return {
    x: cr.left - br.left + cr.width / 2,
    y: cr.top - br.top + cr.height / 2,
  };
}

function hitFxKind(items) {
  const list = Array.isArray(items) ? items : [];
  const hpDmg = list.some((it) => String(it?.kind || "").toUpperCase() === "HP" && Number(it?.delta ?? 0) < 0);
  const spDmg = list.some((it) => String(it?.kind || "").toUpperCase() === "SP" && Number(it?.delta ?? 0) < 0);
  const heal = list.some((it) => Number(it?.delta ?? 0) > 0);
  if (heal && !hpDmg && !spDmg) return "heal";
  if (hpDmg && spDmg) return "mix";
  if (spDmg) return "sp";
  if (hpDmg) return "hp";
  return "hit";
}

function spawnBoardBeam(fromCell, toCell, kind = "hit") {
  if (!boardEl || !fromCell || !toCell) return;
  const from = cellCenterInBoard(fromCell);
  const to = cellCenterInBoard(toCell);
  if (!from || !to) return;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.max(18, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  const beam = document.createElement("div");
  beam.className = `battleBeam ${kind}`;
  beam.style.left = `${from.x}px`;
  beam.style.top = `${from.y}px`;
  beam.style.width = `${dist}px`;
  beam.style.transform = `rotate(${angle}deg)`;
  boardEl.appendChild(beam);

  const source = document.createElement("div");
  source.className = `battleFxRing source ${kind}`;
  source.style.left = `${from.x}px`;
  source.style.top = `${from.y}px`;
  boardEl.appendChild(source);

  const target = document.createElement("div");
  target.className = `battleFxRing target ${kind}`;
  target.style.left = `${to.x}px`;
  target.style.top = `${to.y}px`;
  boardEl.appendChild(target);

  setTimeout(() => {
    try { beam.remove(); source.remove(); target.remove(); } catch {}
  }, 1100);
}

function spawnMoveFx(fromCell, toCell) {
  if (!boardEl || !fromCell || !toCell) return;
  const from = cellCenterInBoard(fromCell);
  const to = cellCenterInBoard(toCell);
  if (!from || !to) return;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.max(18, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  const trail = document.createElement("div");
  trail.className = "moveTrailFx";
  trail.style.left = `${from.x}px`;
  trail.style.top = `${from.y}px`;
  trail.style.width = `${dist}px`;
  trail.style.transform = `rotate(${angle}deg)`;
  boardEl.appendChild(trail);

  const ghost = document.createElement("div");
  ghost.className = "moveGhostFx";
  ghost.style.left = `${from.x}px`;
  ghost.style.top = `${from.y}px`;
  ghost.style.setProperty("--moveDx", `${dx}px`);
  ghost.style.setProperty("--moveDy", `${dy}px`);
  boardEl.appendChild(ghost);

  toCell.classList.add("moveArrive");
  setTimeout(() => {
    try { trail.remove(); ghost.remove(); } catch {}
    try { toCell.classList.remove("moveArrive"); } catch {}
  }, 980);
}

function fxOnMove(st) {
  const lm = st?.lastMove;
  const at = Number(lm?.at || 0);
  if (!at || at === lastMoveAtSeen) return;
  lastMoveAtSeen = at;

  const fromCell = cellForModelPos(lm.from);
  const toCell = cellForModelPos(lm.to);
  if (!fromCell || !toCell) return;
  spawnMoveFx(fromCell, toCell);
}

function fxOnHit(st) {
  fxOnMove(st);

  const lh = st?.lastHit;
  if (!lh?.at || lh.at === lastHitAtSeen) return;
  lastHitAtSeen = lh.at;

  if (!lh?.targetId || !Array.isArray(st.units)) return;

  const tu = st.units.find((u) => u.id === lh.targetId) || null;
  if (!tu) return;

  const cell = cellForModelPos(lh.to || { x: tu.x, y: tu.y });
  if (!cell) return;

  const items = Array.isArray(lh.items) ? lh.items : [];
  const hasHpDamage = items.some(
    (it) => String(it?.kind || "").toUpperCase() === "HP" && Number(it?.delta ?? 0) < 0,
  );
  const hasSpDamage = items.some(
    (it) => String(it?.kind || "").toUpperCase() === "SP" && Number(it?.delta ?? 0) < 0,
  );
  const hitKind = hitFxKind(items);
  const hitClass =
    hitKind === "mix"
      ? "hitFlashMix"
      : hitKind === "sp"
        ? "hitFlashSp"
        : hitKind === "heal"
          ? "hitFlashHeal"
        : hitKind === "hp"
          ? "hitFlashHp"
          : "hitFlash";

  const fromCell = cellForModelPos(lh.from);
  if (fromCell) spawnBoardBeam(fromCell, cell, hitKind);

  cell.classList.add("hitFlash", hitClass, "hitPunch");
  setTimeout(
    () => cell.classList.remove("hitFlash", "hitFlashHp", "hitFlashSp", "hitFlashMix", "hitFlashHeal", "hitPunch"),
    640,
  );

  for (const it of items) {
    const kind = String(it.kind || "");
    const delta = Number(it.delta ?? 0);
    if (!delta) continue;

    const el = document.createElement("div");
    el.className = "floatDmg";
    const k = kind === "SP" ? "SP" : "HP";
    if (k === "SP") el.classList.add(delta < 0 ? "spDamage" : "spHeal");
    else el.classList.add(delta < 0 ? "hpDamage" : "hpHeal");
    const sign = delta > 0 ? "+" : "−";
    el.textContent = "♥" + sign + Math.abs(delta);
    cell.appendChild(el);
    setTimeout(() => {
      try {
        el.remove();
      } catch {}
    }, 1000);
  }

  if (items.some((it) => Number(it?.delta ?? 0) > 0)) {
    const cloud = document.createElement("div");
    cloud.className = "healHeartCloud";
    for (let i = 0; i < 7; i++) {
      const h = document.createElement("i");
      h.textContent = "♥";
      h.style.setProperty("--i", String(i));
      cloud.appendChild(h);
    }
    cell.appendChild(cloud);
    setTimeout(() => {
      try { cloud.remove(); } catch {}
    }, 1050);
  }

  const kill = Number(tu.hp) <= 0 || !!tu.panic;
  if (kill) cell.classList.add("killBurst");
  setTimeout(() => cell.classList.remove("killBurst"), 460);
  fxFlash(kill ? "kill" : hitKind);
}

// 技の成功率を安全に取得する。
function getActRate(act) {
  const v = Number(
    act?.rate ?? act?.successRate ?? act?.hitRate ?? act?.prob ?? act?.p ?? 100,
  );
  if (!Number.isFinite(v)) return 100;
  return Math.max(0, Math.min(100, Math.trunc(v)));
}

// =====================
// 蛻､螳壼精蜿・// =====================
function isSelfRange(r) {
  const s = String(r ?? "")
    .trim()
    .toLowerCase();
  return s === "self" || s === "0" || s === "me" || s === "閾ｪ霄ｫ";
}

function isLineBlocked(units, attacker, target) {
  if (!attacker || !target) return false;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;

  const step = (v) => (v === 0 ? 0 : v > 0 ? 1 : -1);
  let sx = step(dx);
  let sy = step(dy);

  const straight = dx === 0 || dy === 0;
  const diag = Math.abs(dx) === Math.abs(dy);
  if (!straight && !diag) return false;

  let x = attacker.x + sx;
  let y = attacker.y + sy;

  while (!(x === target.x && y === target.y)) {
    const hit = (units || []).find(
      (u) => Number(u.hp) > 0 && u.x === x && u.y === y,
    );
    if (hit) return true;
    x += sx;
    y += sy;
    if (x < 0 || x >= W || y < 0 || y >= H) break;
  }
  return false;
}

function calcHitRateAdapter(attacker, act) {
  const base = getActRate(act); // 譛ｪ險ｭ螳壹↑繧・00
  try {
    if (typeof calcHitRateWithStatus !== "function") return base;

    const n = calcHitRateWithStatus.length;
    let r;
    if (n >= 2) r = calcHitRateWithStatus(attacker, base);
    else if (n === 1) r = calcHitRateWithStatus(attacker);
    else r = base;

    const rr = Number(r);
    if (!Number.isFinite(rr)) return base;
    return Math.max(0, Math.min(100, Math.trunc(rr)));
  } catch {
    return base;
  }
}

// 笘・ｿｮ豁｣・喞heckEvade 縺ｯ defender + rng 縺ｧ蜻ｼ縺ｶ
function checkEvadeAdapter(defender) {
  try {
    if (typeof checkEvade !== "function") return false;

    const rng01 = () => Math.random(); // 0..1
    const n = checkEvade.length;

    if (n >= 2) return !!checkEvade(defender, rng01);
    if (n === 1) return !!checkEvade(defender);
    return false;
  } catch {
    return false;
  }
}

// 笘・ｿｮ豁｣・啾pplyStatusesOnHit 縺ｯ (target, act) 縺ｧ蜻ｼ縺ｶ
function applyStatusesOnHitAdapter(target, act, turnSeq) {
  try {
    if (typeof applyStatusesOnHit !== "function") return [];
    const n = applyStatusesOnHit.length;

    if (n >= 3) return applyStatusesOnHit(target, act, turnSeq); // 笨・    if (n >= 2) return applyStatusesOnHit(target, act);
    if (n === 1) return applyStatusesOnHit(target);
    return [];
  } catch {
    return [];
  }
}

// =====================
// Pinch (Emergency) FX + BGM
// =====================
let lastPinchLevel = -1;

function getPinchLevel(st) {
  const enemy = seat === "A" ? "B" : "A";

  const ek = Math.trunc(Number(st?.kills?.[enemy] ?? 0) || 0);

  // Use current infiltration values for the danger level.
  let now = { A: 0, B: 0 };
  try {
    now = calcInfilNow(st);
  } catch {}
  const ei = Math.trunc(Number(now?.[enemy] ?? 0) || 0);

  const danger = Math.max(ek, ei);
  if (danger >= 2) return 2;
  if (danger >= 1) return 1;
  return 0;
}

function applyPinchFxAndBgm(st) {
  if (!st || !seat) return;

  const lv = getPinchLevel(st);
  if (lv === lastPinchLevel) return;
  lastPinchLevel = lv;

  document.body.classList.toggle("pinch1", lv === 1);
  document.body.classList.toggle("pinch2", lv === 2);

  // Toggle pinch visual effects.
  if (pinchFxEl) pinchFxEl.classList.toggle("on", lv > 0);

  // HTML蛛ｴ縺ｫ逕溘ｄ縺呻ｼ嗹indow.setPinchBgmLevel(lv)
  try {
    window.setPinchBgmLevel?.(lv);
  } catch {}
}

// =====================
// Snapshot + main loop
// =====================
let currentState = null;
let dopaEventReady = false;
let lastDopaEvolveAt = 0;
let lastDopaScore = null;
let lastSeenTurnSeq = null;
let lastSeenTurn = null;
let supportTargetIds = [];

function releaseHandLocksAtTurnStart(st, nextSeat) {
  const side = normSeat(nextSeat);
  if (!st || !side) return 0;
  const locks = normalizedHandLocks(st);
  let released = 0;
  for (const s of ["A", "B"]) {
    const before = locks[s].length;
    locks[s] = locks[s].filter((x) => normSeat(x?.releaseSeat) !== side);
    released += before - locks[s].length;
  }
  st.handLocks = locks;
  return released;
}

function supportSearchEffect(def) {
  const eff = def?.effect;
  const list = [];
  if (eff?.type && supportTypeOf(eff) === "search") list.push(eff);
  if (Array.isArray(eff?.table)) {
    for (const r of eff.table) {
      const e = r?.effect || {};
      if (supportTypeOf(e) === "search") list.push(e);
    }
  }
  return list[0] || null;
}

function supportSearchOptions(st, def) {
  const eff = supportSearchEffect(def);
  if (!eff) return [];
  const deck = Array.isArray(st?.decks?.[seat]) ? st.decks[seat] : [];
  const seen = new Set();
  const wanted = String(eff.cardId ?? eff.id ?? eff.searchId ?? "").trim();
  const kind = String(eff.kind ?? eff.cardKind ?? "").trim().toLowerCase();
  const attr = String(eff.attr ?? "").trim();
  const rarity = String(eff.rarity ?? "").trim().toUpperCase();
  const query = String(eff.nameIncludes ?? eff.query ?? eff.q ?? "").trim().toLowerCase();
  const out = [];

  for (const cardId of deck) {
    if (!cardId || seen.has(cardId)) continue;
    if (wanted && cardId !== wanted) continue;
    const def0 = cardDefs?.[cardId] || {};
    if (kind) {
      const k = String(def0.kind || "unit").toLowerCase();
      if (kind === "unit") {
        if (k === "support" || k === "ex_support" || k === "exsupport") continue;
      } else if (k !== kind) continue;
    }
    if (attr && String(def0.attr || def0.type || "") !== attr) continue;
    if (rarity && String(def0.rarity || "R").toUpperCase() !== rarity) continue;
    if (query) {
      const hay = (String(cardId) + " " + String(def0.name || "") + " " + String(def0.desc || "")).toLowerCase();
      if (!hay.includes(query)) continue;
    }
    seen.add(cardId);
    out.push({ cardId, name: cardName(cardId), cost: def0.cost ?? "?", kind: def0.kind || "unit" });
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name), "ja"));
}

function logPush(st, line) {
  if (!st) return;
  if (!Array.isArray(st.log)) st.log = [];
  st.log.push(String(line ?? ""));
  if (st.log.length > 200) st.log.splice(0, st.log.length - 200);
}

// =====================
// Card trigger effects
// =====================
const CARD_EFFECT_TRIGGER_LABELS = {
  onEnter: "場に出た時",
  onSummon: "召喚時",
  onEvolve: "進化時",
  onTurnStart: "自分ターン開始時",
  onOwnFieldTurnStart: "自陣にいる時",
  onEnemyFieldTurnStart: "敵陣にいる時",
  onCrossCenter: "中央線突破時",
};

function normalizeCardEffectTrigger(trigger) {
  const raw = String(trigger || "").trim();
  const key = raw.toLowerCase();
  const aliases = {
    enter: "onEnter",
    onenter: "onEnter",
    deploy: "onEnter",
    "場に出たとき": "onEnter",
    "場に出た時": "onEnter",
    summon: "onSummon",
    onsummon: "onSummon",
    "召喚時": "onSummon",
    evolve: "onEvolve",
    onevolve: "onEvolve",
    "進化時": "onEvolve",
    turnstart: "onTurnStart",
    onturnstart: "onTurnStart",
    "ターン開始時": "onTurnStart",
    ownfield: "onOwnFieldTurnStart",
    onownfieldturnstart: "onOwnFieldTurnStart",
    "自陣": "onOwnFieldTurnStart",
    enemyfield: "onEnemyFieldTurnStart",
    onenemyfieldturnstart: "onEnemyFieldTurnStart",
    "敵陣": "onEnemyFieldTurnStart",
    crosscenter: "onCrossCenter",
    oncrosscenter: "onCrossCenter",
    "中央線突破": "onCrossCenter",
  };
  return aliases[raw] || aliases[key] || raw || "onEnter";
}

function cardEffectsForUnit(unit, trigger) {
  const def = cardDefs?.[unit?.cardId];
  const raw = Array.isArray(def?.cardEffects)
    ? def.cardEffects
    : Array.isArray(def?.effects)
      ? def.effects
      : [];
  const wanted = normalizeCardEffectTrigger(trigger);
  return raw
    .map((eff) => (eff && typeof eff === "object" ? eff : null))
    .filter(Boolean)
    .filter((eff) => normalizeCardEffectTrigger(eff.trigger || eff.when || eff.event) === wanted);
}

function isInOwnField(unit) {
  const owner = normSeat(unit?.owner);
  const y = Math.trunc(Number(unit?.y ?? -1));
  const center = Math.floor(H / 2);
  if (owner === "A") return y > center;
  if (owner === "B") return y < center;
  return false;
}

function isInEnemyField(unit) {
  const owner = normSeat(unit?.owner);
  const y = Math.trunc(Number(unit?.y ?? -1));
  const center = Math.floor(H / 2);
  if (owner === "A") return y < center;
  if (owner === "B") return y > center;
  return false;
}

function crossedCenterTowardEnemy(owner, fromY, toY) {
  const seat0 = normSeat(owner);
  const center = Math.floor(H / 2);
  const a = Math.trunc(Number(fromY));
  const b = Math.trunc(Number(toY));
  if (!seat0 || !Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (seat0 === "A") return a >= center && b < center;
  return a <= center && b > center;
}

function cardEffectSeat(source, eff, fallbackSeat = null) {
  const owner = normSeat(source?.owner) || normSeat(fallbackSeat);
  const targetSeat = String(eff?.targetSeat || eff?.seat || "").toLowerCase();
  if (targetSeat === "enemy" || targetSeat === "opponent") return owner === "A" ? "B" : "A";
  if (targetSeat === "a" || targetSeat === "b") return targetSeat.toUpperCase();
  return owner;
}

function cardEffectTargets(s, source, eff) {
  const units = Array.isArray(s?.units) ? s.units : [];
  const owner = normSeat(source?.owner);
  const enemy = owner === "A" ? "B" : "A";
  const target = String(eff?.target || eff?.to || "self").toLowerCase();
  const alive = (u) => u && Number(u.hp) > 0 && !u.panic;

  if (target === "self" || target === "source") return source ? [source] : [];
  if (target === "allyall" || target === "allallies" || target === "allies") {
    return units.filter((u) => alive(u) && normSeat(u.owner) === owner);
  }
  if (target === "enemyall" || target === "allenemies" || target === "enemies") {
    return units.filter((u) => alive(u) && normSeat(u.owner) === enemy);
  }
  if (target === "randomenemy") {
    const list = units.filter((u) => alive(u) && normSeat(u.owner) === enemy);
    return list.length ? [list[Math.floor(Math.random() * list.length)]] : [];
  }
  if (target === "randomally") {
    const list = units.filter((u) => alive(u) && normSeat(u.owner) === owner);
    return list.length ? [list[Math.floor(Math.random() * list.length)]] : [];
  }
  return source ? [source] : [];
}

function applyCardEffectStatus(target, key, value, turns, turnSeq) {
  if (!target || !key) return;
  const name = normalizeStatusKey?.(key) || key;
  const v = Number.isFinite(Number(value)) ? Number(value) : 1;
  const payload = { v };
  if (Number.isFinite(Number(turns)) && Number(turns) > 0) payload.turns = Math.trunc(Number(turns));
  if (turnSeq != null) payload.turnSeq = Math.trunc(Number(turnSeq));
  target.status = target.status && typeof target.status === "object" ? target.status : {};
  target.statuses = target.statuses && typeof target.statuses === "object" ? target.statuses : {};
  target.status[name] = { ...payload };
  target.statuses[name] = { ...payload };
}

function applyOneCardEffect(s, source, eff, logLines) {
  if (!s || !source || !eff) return false;
  const rate = Math.max(0, Math.min(100, Math.trunc(Number(eff.rate ?? 100))));
  if (rate < 100 && Math.floor(Math.random() * 100) + 1 > rate) {
    const missLabel = eff.name || eff.label || CARD_EFFECT_TRIGGER_LABELS[normalizeCardEffectTrigger(eff.trigger)] || "効果";
    logLines?.push?.("  → カード効果失敗：" + missLabel + "（" + rate + "%）");
    return false;
  }

  const type = String(eff.type || eff.kind || "heal").toLowerCase();
  const sourceSeat = normSeat(source.owner);
  const effectSeat = cardEffectSeat(source, eff, sourceSeat);
  const targets = cardEffectTargets(s, source, eff);
  const label = eff.name || eff.label || (cardName(source.cardId) + "の効果");
  let applied = false;

  if (type === "draw") {
    const n = Math.max(1, Math.trunc(Number(eff.n ?? eff.draw ?? eff.amount ?? 1)));
    safeDrawCards(s, effectSeat, n);
    logLines?.push?.("  → " + label + ": " + effectSeat + " ドロー+" + n);
    return true;
  }

  if (type === "mana" || type === "manaup") {
    const amount = Math.trunc(Number(eff.amount ?? eff.n ?? 1));
    const kind = String(eff.manaKind || eff.mode || eff.kind || "cur").toLowerCase();
    const mana = normalizeMana(s.mana);
    mana[effectSeat] = mana[effectSeat] || { cur: 0, max: 0 };
    const maxCap = Math.trunc(Number(CORE.MAX_MANA ?? 999));
    if (kind === "max" || kind === "permanent") {
      mana[effectSeat].max = Math.min(maxCap, Math.max(0, Number(mana[effectSeat].max || 0) + amount));
      mana[effectSeat].cur = Math.min(mana[effectSeat].max, Math.max(0, Number(mana[effectSeat].cur || 0) + amount));
      s.manaBonusMax =
        s.manaBonusMax && typeof s.manaBonusMax === "object"
          ? s.manaBonusMax
          : {};
      s.manaBonusMax[effectSeat] = Math.max(
        0,
        Math.min(
          mana[effectSeat].max,
          Math.trunc(Number(s.manaBonusMax[effectSeat] ?? 0) || 0) + amount,
        ),
      );
    } else {
      mana[effectSeat].cur = Math.min(maxCap, Math.max(0, Number(mana[effectSeat].cur || 0) + amount));
    }
    s.mana = normalizeMana(mana);
    logLines?.push?.("  → " + label + ": " + effectSeat + " マナ" + (amount >= 0 ? "+" : "") + amount);
    return true;
  }

  if (type === "cleanse") {
    for (const t of targets) {
      t.status = {};
      t.statuses = {};
      logLines?.push?.("  → " + label + ": " + cardName(t.cardId) + " 状態異常クリア");
      applied = true;
    }
    return applied;
  }

  for (const t of targets) {
    if (!t) continue;
    if (type === "heal") {
      const hp = Math.abs(round10(Number(eff.hp ?? eff.heal ?? 0)));
      const sp = Math.abs(round10(Number(eff.sp ?? 0)));
      if (hp) t.hp = round10(Number(t.hp) + hp);
      if (sp) t.sp = round10(Number(t.sp) + sp);
      clampUnitStats10(t);
      logLines?.push?.("  → " + label + ": " + cardName(t.cardId) + " 回復" +
        (hp ? " HP+" + hp : "") + (sp ? " SP+" + sp : ""));
      applied = true;
    } else if (type === "dmg" || type === "damage") {
      const hp = Math.abs(round10(Number(eff.hp ?? eff.damage ?? eff.dmg ?? 0)));
      const sp = Math.abs(round10(Number(eff.sp ?? 0)));
      if (hp) t.hp = round10(Number(t.hp) - hp);
      if (sp) t.sp = round10(Number(t.sp) - sp);
      clampUnitStats10(t);
      setPanicAndCountIfNeeded(t, sourceSeat, s.kills, logLines, label + "(パニック)");
      if (Number(t.hp) <= 0) countKillIfNeeded(t, sourceSeat, s.kills, logLines, label);
      logLines?.push?.("  → " + label + ": " + cardName(t.cardId) + " ダメージ" +
        (hp ? " HP-" + hp : "") + (sp ? " SP-" + sp : ""));
      applied = true;
    } else if (type === "addstatus" || type === "status") {
      const key = eff.status || eff.statusKey || "bleed";
      applyCardEffectStatus(t, key, eff.v ?? eff.value ?? 1, eff.turns, s.turnSeq);
      logLines?.push?.("  → " + label + ": " + cardName(t.cardId) + " " + key + "付与");
      applied = true;
    } else if (type === "powerup") {
      const d = Math.trunc(Number(eff.delta ?? eff.v ?? 10));
      addOrSetStatus(t, "powerUp", d);
      logLines?.push?.("  → " + label + ": " + cardName(t.cardId) + " 威力+" + d);
      applied = true;
    } else if (type === "modrate" || type === "hit") {
      const d = Math.trunc(Number(eff.delta ?? eff.v ?? 10));
      addOrSetStatus(t, d >= 0 ? "aim" : "jinx", Math.abs(d));
      logLines?.push?.("  → " + label + ": " + cardName(t.cardId) + " 命中" +
        (d >= 0 ? "+" : "-") + Math.abs(d) + "%");
      applied = true;
    }
  }
  return applied;
}

function fireCardEffects(s, trigger, source, opts = {}) {
  if (!s || !source) return 0;
  const normalized = normalizeCardEffectTrigger(trigger);
  const effects = cardEffectsForUnit(source, normalized);
  if (!effects.length) return 0;

  if (normalized === "onOwnFieldTurnStart" && !isInOwnField(source)) return 0;
  if (normalized === "onEnemyFieldTurnStart" && !isInEnemyField(source)) return 0;

  s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
  const logLines = [];
  let count = 0;
  for (const eff of effects) {
    if (applyOneCardEffect(s, source, eff, logLines)) count += 1;
  }
  if (count) {
    const label = CARD_EFFECT_TRIGGER_LABELS[normalized] || normalized;
    logPush(s, "[" + normSeat(source.owner) + "] カード効果：" + cardName(source.cardId) + " / " + label);
    for (const ln of logLines) logPush(s, ln);
    normalizePanicForAll(s.units, s.kills, null);
    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logPush(s, "勝者：" + w);
    }
  }
  return count;
}

function fireTurnStartCardEffects(s, who) {
  const seat0 = normSeat(who);
  if (!seat0 || !Array.isArray(s?.units)) return;
  const units = s.units.filter((u) => u && normSeat(u.owner) === seat0 && Number(u.hp) > 0 && !u.panic);
  for (const u of units) {
    fireCardEffects(s, "onTurnStart", u);
    fireCardEffects(s, "onOwnFieldTurnStart", u);
    fireCardEffects(s, "onEnemyFieldTurnStart", u);
  }
}

// spendMana() の戻り値が {ok, mana} の場合にも対応する。
function spendManaMut(manaObj, who, cost) {
  const m = normalizeMana(manaObj);
  const c = Math.max(0, Math.trunc(Number(cost ?? 0)));
  if (!c) return m;

  try {
    const res = spendMana(m, who, c);
    if (res && typeof res === "object" && res.mana)
      return normalizeMana(res.mana);
    return normalizeMana(res ?? m);
  } catch {
    m[who].cur = Math.max(0, Math.trunc(Number(m[who].cur ?? 0)) - c);
    return normalizeMana(m);
  }
}

function gainManaPlus2OnReceiveTurn(manaObj, who) {
  const m = normalizeMana(manaObj);
  const maxCap = Math.trunc(Number(CORE.MAX_MANA ?? 999));
  const add = 2;

  const curMax = Math.trunc(Number(m?.[who]?.max ?? 0));
  const nextMax = Math.min(maxCap, curMax + add);

  m[who] = m[who] || { cur: 0, max: 0 };
  m[who].max = nextMax;
  m[who].cur = nextMax;

  return normalizeMana(m);
}

function renderScoreMeter(meterEl, val, max) {
  if (!meterEl) return;
  const v = Math.max(0, Math.trunc(Number(val ?? 0) || 0));
  const m = Math.max(1, Math.trunc(Number(max ?? 1) || 1));

  meterEl.innerHTML = "";
  for (let i = 0; i < m; i++) {
    const pip = document.createElement("div");
    pip.className = "scorePip" + (i < v ? " on" : "");
    meterEl.appendChild(pip);
  }
}

function setTurnUI(st) {
  if (!st) return;
  const t = normSeat(st.turn) || "?";
  if (turnEl) turnEl.textContent = t;

  const mana = normalizeMana(st.mana);
  const a = mana.A,
    b = mana.B;
  if (manaEl) manaEl.textContent = "A " + a.cur + "/" + a.max + " | B " + b.cur + "/" + b.max;
  renderManaGauge(mana, st);

  if (deckCountEl) {
    const da = Array.isArray(st?.decks?.A) ? st.decks.A.length : 0;
    const db = Array.isArray(st?.decks?.B) ? st.decks.B.length : 0;
    deckCountEl.textContent = "残り A:" + da + " / B:" + db;
  }

  // ===== KILL =====
  const ka = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
  const kb = Math.trunc(Number(st?.kills?.B ?? 0) || 0);

  // 旧表示も残している場合は更新する。
  if (killsEl) killsEl.textContent = "A:" + ka + " / B:" + kb;

  // 譁ｰUI
  renderScoreMeter(killMeterA, ka, WIN_KILL_COUNT);
  renderScoreMeter(killMeterB, kb, WIN_KILL_COUNT);
  if (killTextA) killTextA.textContent = ka + "/" + WIN_KILL_COUNT;
  if (killTextB) killTextB.textContent = kb + "/" + WIN_KILL_COUNT;

  // ===== INFIL・井ｻ翫％縺ｮ迸ｬ髢難ｼ・====
  let now = { A: 0, B: 0 };
  try {
    now = calcInfilNow(st);
  } catch {}
  const ia = Math.trunc(Number(now?.A ?? 0) || 0);
  const ib = Math.trunc(Number(now?.B ?? 0) || 0);

  // 旧表示も残している場合は更新する。
  if (infilEl) infilEl.textContent = "A:" + ia + " / B:" + ib;

  // 譁ｰUI
  renderScoreMeter(infilMeterA, ia, WIN_INFIL_COUNT);
  renderScoreMeter(infilMeterB, ib, WIN_INFIL_COUNT);
  if (infilTextA) infilTextA.textContent = ia + "/" + WIN_INFIL_COUNT;
  if (infilTextB) infilTextB.textContent = ib + "/" + WIN_INFIL_COUNT;

  showDiceRoll(st.lastRoll, st.lastSupportRoll);

  try {
    if (exInfoEl) {
      const exId = st?.ex?.[seat] ?? null;
      const used = !!st?.exUsed?.[seat];
      exInfoEl.textContent = exId
        ? "EX: " + cardName(exId) + (used ? "（使用済み）" : "")
        : "EX: なし";
    }
    if (exBtnEl) {
      const exId = st?.ex?.[seat] ?? null;
      const used = !!st?.exUsed?.[seat];
      exBtnEl.disabled = !canControl(st) || !exId || used;
    }
  } catch {}

  // ===== Pinch 甯尖卿 竊・BGM mode 譖ｴ譁ｰ =====
  try {
    const ka = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
    const kb = Math.trunc(Number(st?.kills?.B ?? 0) || 0);

    const now = calcInfilNow(st);
    const ia = Math.trunc(Number(now?.A ?? 0) || 0);
    const ib = Math.trunc(Number(now?.B ?? 0) || 0);

    // 閾ｪ蛻・′雋縺代◎縺・ｼ晉嶌謇九・騾ｲ謐励ｒ隕九ｋ
    const oppKill = seat === "A" ? kb : ka;
    const oppInfil = seat === "A" ? ib : ia;

    const danger = Math.max(oppKill, oppInfil);

    // 萓具ｼ・繧ｫ繧ｦ繝ｳ繝亥叙繧峨ｌ縺溪・pinch1 / 2繧ｫ繧ｦ繝ｳ繝遺・pinch2
    if (danger >= 2) {
      document.body.classList.add("pinch2");
      document.body.classList.remove("pinch1");
      setBgmMode("alert2");
    } else if (danger >= 1) {
      document.body.classList.add("pinch1");
      document.body.classList.remove("pinch2");
      setBgmMode("alert1");
    } else {
      document.body.classList.remove("pinch1", "pinch2");
      setBgmMode("battle");
    }
  } catch {}
}

// =====================
// Board init
// =====================
function unitAt(st, x, y) {
  const units = Array.isArray(st?.units) ? st.units : [];
  return (
    units.find(
      (u) => u && (Number(u.hp) > 0 || !!u.panic) && u.x === x && u.y === y,
    ) || null
  );
}

function isEmptyCell(st, x, y) {
  return !unitAt(st, x, y);
}

// =====================
// 笘・小蝟壹お繝ｪ繧｢・亥宍蟇・崋螳夲ｼ・// 蜈郁｡・A) = 謇句燕蛛ｴ2蛻暦ｼ井ｸ・蛻暦ｼ・// 蠕梧判(B) = 螂･蛛ｴ2蛻暦ｼ井ｸ・蛻暦ｼ・// =====================
function inSummonAreaForSeat(x, y, who) {
  if (who === "A") return y >= H - 2;
  if (who === "B") return y <= 1;
  return false;
}

function shouldCancelByUnitClick(u, st) {
  if (!u || !st) return false;
  if (!canControl(st)) return false;

  // 竭 Support荳ｭ・壹％縺ｮ繝ｦ繝九ャ繝医′縲碁∈縺ｹ縺ｪ縺・阪↑繧峨く繝｣繝ｳ繧ｻ繝ｫ
  if (mode === "support") {
    const handDef = selectedHandDef(st);
    const isSupp = !!handDef && isSupportCard(handDef);
    if (!isSupp) return true; // support mode縺ｪ縺ｮ縺ｫ繧ｵ繝昴き驕ｸ繧薙〒縺ｪ縺・・螟峨↑縺ｮ縺ｧ隗｣髯､

    const plan = supportPlan(handDef);
    const tMode = getSupportTargetMode(handDef);

    // unitCell 縺ｧ縲檎ｩｺ繝槭せ驕ｸ謚樔ｸｭ縲阪↓縺励◆縺・凾縲√Θ繝九ャ繝域款縺励◆繧蛾壼ｸｸ縺ｯ 窶懊Θ繝九ャ繝磯∈謚樞・縺ｨ縺励※謌千ｫ九☆繧九・縺ｧ繧ｭ繝｣繝ｳ繧ｻ繝ｫ縺励↑縺・    // 竊・縺溘□縺励・∈縺ｹ縺ｪ縺・Θ繝九ャ繝医↑繧峨く繝｣繝ｳ繧ｻ繝ｫ
    const pickable = supportCanPickUnit(u, seat, tMode);

    if (plan.need === "unit") return !pickable;
    if (plan.need === "unit2") return !pickable;
    if (plan.need === "unitCell") return !pickable;

    return true;
  }

  // 竭｡ Attack荳ｭ・壹％縺ｮ繝ｦ繝九ャ繝医′縲後ち繝ｼ繧ｲ繝・ヨ縺ｨ縺励※謌千ｫ九＠縺ｪ縺・阪↑繧峨く繝｣繝ｳ繧ｻ繝ｫ
  if (mode === "attack") {
    const su = getSelectedUnit(st);
    if (!su || su.owner !== seat) return true;

    const acts = unitActionChoices(su, st);
    const act = acts[selectedActionIndex] || acts[0] || null;
    if (!act) return true;

    const flags = actFlags(act);
    if (isSelfRange(act.range) || flags.aoe) return true;

    const allowAlly = actAllowsAllyTarget(act);
    const isValidTarget = u.owner !== seat || allowAlly;

    return !isValidTarget;
  }

  return false;
}

/**
 * 蜿ｬ蝟壹お繝ｪ繧｢蜀・・縲後♀縺吶☆繧∫ｩｺ縺阪・繧ｹ縲阪ｒ驕ｸ縺ｶ
 */

// =====================
// Board click handlers
// =====================
function onCellClick(x, y) {
  const st = currentState;
  if (!st) return;

  const handDef = selectedHandDef(st);
  const isSupp = !!handDef && isSupportCard(handDef);

  // =========================
  // 1) Support: unitCell 縺ｮ縲檎ｧｻ蜍募・繝槭せ驕ｸ謚槭搾ｼ育ｩｺ繝槭せ縺ｮ縺ｿ・・  // =========================
  if (mode === "support" && canControl(st) && isSupp) {
    const plan = supportPlan(handDef);
    if (plan.need === "unitCell" && supportTarget1Id) {
      const occ = unitAt(st, x, y);
      if (!occ) {
        supportTargetCell = { x, y };
        render(st);
        return;
      }
      // occupied 縺ｪ繧我ｸ九↓豬√＠縺ｦ縲後Θ繝九ャ繝医け繝ｪ繝・け謇ｱ縺・阪↓縺吶ｋ
    }
  }
  // =========================
  // 2) 繝ｦ繝九ャ繝医け繝ｪ繝・け
  // =========================
  const u = unitAt(st, x, y);
  if (u) {
    if (shouldCancelByUnitClick(u, st)) {
      clearCommandSelectionUI({ keepUnit: true });

      showUnitDetail(u, st);
      if (u.owner === seat) onSelectMyUnit(u.id, st);
      return;
    }
    // ---- Support繝｢繝ｼ繝会ｼ壼ｯｾ雎｡繝ｦ繝九ャ繝医・驕ｸ謚槭ｒ譛蜆ｪ蜈茨ｼ域里蟄倥・縺ｾ縺ｾ・・---
    if (mode === "support" && canControl(st) && isSupp) {
      const plan = supportPlan(handDef);
      const tMode = getSupportTargetMode(handDef);

      if (!supportCanPickUnit(u, seat, tMode)) {
        render(st);
        return;
      }

      if (plan.need === "unit") {
        supportTarget1Id = u.id;
        render(st);
        return;
      }

      if (plan.need === "unit2") {
        if (!supportTarget1Id) supportTarget1Id = u.id;
        else if (!supportTarget2Id && u.id !== supportTarget1Id)
          supportTarget2Id = u.id;
        else if (u.id === supportTarget1Id) supportTarget2Id = null;
        render(st);
        return;
      }

      if (plan.need === "unitCell") {
        supportTarget1Id = u.id;
        supportTargetCell = null;
        render(st);
        return;
      }

      if (plan.need === "units") {
        const cnt = Math.max(1, Number(plan?.count ?? 1) || 1);
        const i = supportTargetIds.indexOf(u.id);
        if (i >= 0) {
          supportTargetIds.splice(i, 1);
        } else if (supportTargetIds.length < cnt) {
          supportTargetIds.push(u.id);
        }
        render(st);
        return;
      }
    }

    // ---- Attack繝｢繝ｼ繝会ｼ壹％縺薙ｒ譛蜆ｪ蜈医↓縺吶ｋ・遺・驥崎ｦ・ｼ・---
    // 蜻ｳ譁ｹ繧偵け繝ｪ繝・け縺励◆縺ｨ縺阪碁∈謚槭Θ繝九ャ繝亥・譖ｿ縲阪ｈ繧雁・縺ｫ繧ｿ繝ｼ繧ｲ繝・ヨ驕ｸ謚槭′襍ｰ繧九ｈ縺・↓縺吶ｋ
    if (mode === "attack" && canControl(st)) {
      const su = getSelectedUnit(st);
      if (su && su.owner === seat) {
        const acts = unitActionChoices(su, st);
        const act = acts[selectedActionIndex] || acts[0] || null;

        const allowAlly = actAllowsAllyTarget(act);

        // 謨ｵ縺ｯ蟶ｸ縺ｫ繧ｿ繝ｼ繧ｲ繝・ヨOK / 蜻ｳ譁ｹ縺ｯ縲悟袖譁ｹ蟇ｾ雎｡OK謚縲阪・縺ｨ縺阪□縺代ち繝ｼ繧ｲ繝・ヨOK
        if (u.owner !== seat || allowAlly) {
          selectedTargetId = u.id;
          showUnitDetail(u, st);
          render(st);
          return;
        }
      }
    }

    // ---- 縺昴・莉厄ｼ磯壼ｸｸ繧ｯ繝ｪ繝・け・会ｼ夊ｩｳ邏ｰ・玖・霆埼∈謚・----
    showUnitDetail(u, st);
    if (u.owner === seat) onSelectMyUnit(u.id, st);
    return;
  }

  // =========================
  // 3) 遨ｺ繝槭せ繧ｯ繝ｪ繝・け・壼小蝟・  // =========================
  if (mode === "summon" && canControl(st)) {
    if (!inSummonAreaForSeat(x, y, seat)) return;

    const cid = selectedHandCardId(st);
    const def = selectedHandDef(st);
    if (!cid || !def) return;
    if (selectedHandLocked(st)) {
      logPush(st, "[" + seat + "] 召喚失敗：" + cardName(cid) + "は伏せ中");
      render(st);
      return;
    }
    if (isSupportCard(def)) return;

    // 荳企剞
    const myAlive = countMyAliveUnits(st.units, seat);
    if (myAlive >= MAX_UNITS_PER_PLAYER) {
      logPush(st, "[" + seat + "] 召喚失敗：場の上限(" + MAX_UNITS_PER_PLAYER + ")");
      render(st);
      return;
    }

    // コスト
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    const mana = normalizeMana(st.mana);
    if (mana[seat].cur < cost) return;

    // Transaction中に参照が揺れないように固定する。
    const idxSnap = selectedHandIndex;
    const cidSnap = cid;

    runTransaction(db, async (tx) => {
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];
      if (unitAt(s, x, y)) return;
      if (!inSummonAreaForSeat(x, y, seat)) return;

      // hand remove
      s.hands = s.hands || { A: [], B: [] };
      const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];

      const idx = idxSnap;
      if (idx == null || idx < 0 || idx >= hand.length) return;

      const cardId = hand[idx];
      if (cardId !== cidSnap) return;
      if (isHandCardLocked(s, idx, seat)) {
        logPush(s, "[" + seat + "] 召喚失敗：" + cardName(cardId) + "は伏せ中");
        tx.set(stateRef, s, { merge: true });
        return;
      }

      const cd = cardDefs[cardId];
      if (!cd) return;
      if (isSupportCard(cd)) return;

      // pay
      s.mana = spendManaMut(s.mana, seat, cost);

      // create unit
      const baseHp = round10(cd.hp ?? 0);
      const baseSp = round10(cd.sp ?? 0);

      const unit = {
        id: uid(),
        cardId,
        owner: seat,
        x,
        y,

        hp: baseHp,
        sp: baseSp,

        // 笨・霑ｽ蜉・壽怙螟ｧ蛟､繧呈戟縺溘○繧・        maxHp: baseHp,
        maxSp: baseSp,

        fatigue: false,
        moveTurnSeq: Number(s.turnSeq ?? 1),
        moveUsed: 0,
        status: {},
        statuses: {},
        panic: false,
        countedAsKill: false,
        panicKillSeat: null,
      };

      // 10単位に正規化する。
      unit.hp = Math.trunc(unit.hp / 10) * 10;
      unit.sp = Math.trunc(unit.sp / 10) * 10;

      s.units.push(unit);

      // remove from hand
      hand.splice(idx, 1);
      s.hands[seat] = hand;

      // log
      logPush(s, "[" + seat + "] 召喚：" + cardName(cardId) + " (" + x + "," + y + ")");
      fireCardEffects(s, "onSummon", unit);
      fireCardEffects(s, "onEnter", unit);
      s.lastSummon = { at: nowMs(), owner: seat, cardId };
      tx.set(stateRef, s, { merge: true });
    });

    return;
  }

  // =========================
  // 4) 遨ｺ繝槭せ繧ｯ繝ｪ繝・け・夂ｧｻ蜍・  // =========================
  if (mode === "move" && canControl(st)) {
    const su = getSelectedUnit(st);
    if (!su || su.owner !== seat) return;
    if (isPanic(su)) return;
    if (isMoveBlockedByStatus(su)) return;

    const used = moveUsedThisTurn(su, st);
    if (used >= 2) return;

    // 1マス移動のみ（上下左右）
    const dx = Math.abs(x - su.x);
    const dy = Math.abs(y - su.y);
    if (dx + dy !== 1) return;

    // 遘ｻ蜍募・縺檎ｩｺ
    if (!isEmptyCell(st, x, y)) return;

    // 繝槭リ -1
    const mana = normalizeMana(st.mana);
    if (mana[seat].cur < 1) return;

    // Snapshot IDs before entering the transaction.
    const suIdSnap = su.id;
    const toSnap = { x, y };

    runTransaction(db, async (tx) => {
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];

      const units = s.units;
      const me = units.find((u) => u.id === suIdSnap) || null;
      if (!me || me.owner !== seat) return;
      if (Number(me.hp) <= 0) return;
      if (isPanic(me)) return;
      if (isMoveBlockedByStatus(me)) return;

      // 繧ｿ繝ｼ繝ｳ蜀・ｧｻ蜍募屓謨ｰ
      const curSeq = Number(s.turnSeq ?? 1);
      const usedNow =
        Number(me.moveTurnSeq ?? 0) === curSeq ? Number(me.moveUsed ?? 0) : 0;
      if (usedNow >= 2) return;

      // 目的地を再チェックする。
      const dx2 = Math.abs(toSnap.x - me.x);
      const dy2 = Math.abs(toSnap.y - me.y);
      if (dx2 + dy2 !== 1) return;

      if (unitAt(s, toSnap.x, toSnap.y)) return;

      // フィールド効果は移動前に判定する。
      const from = { x: me.x, y: me.y };
      let to = { x: toSnap.x, y: toSnap.y };

      try {
        ensureFieldState(s, W, H, s.fieldId ?? s.field?.id ?? fieldIdFromUrl);
        const r = applyFieldMoveRule({
          s,
          who: seat,
          unit: me,
          from,
          to,
          W,
          H,
          round10,
          logPush,
        });
        if (!r?.ok) {
          // 止められた場合もマナと移動回数は消費する。
          s.mana = spendManaMut(s.mana, seat, 1);

          me.moveTurnSeq = curSeq;
          me.moveUsed = usedNow + 1;

          logPush(
            s,
            "[" + seat + "] 移動失敗：" + cardName(me.cardId) + "（" + (r?.label ?? "field") + "）",
          );

          tx.set(stateRef, s, { merge: true });
          return;
        }
        to = r.to || to;
      } catch {}

      // pay
      s.mana = spendManaMut(s.mana, seat, 1);

      // 出血移動ダメージ
      const bleedLogLines = [];
      try {
        const bleedDmg = Number(applyBleedOnMove?.(me, s, seat) ?? 0);
        if (bleedDmg > 0) {
          bleedLogLines.push(
            "[" + seat + "] 出血：" + cardName(me.cardId) + " HP-" + Math.trunc(bleedDmg),
          );
        }
      } catch {}

      // move
      const prev = { x: me.x, y: me.y };
      me.x = to.x;
      me.y = to.y;
      me.moveTurnSeq = curSeq;
      me.moveUsed = usedNow + 1;
      s.lastMove = {
        at: nowMs(),
        unitId: me.id,
        owner: seat,
        cardId: me.cardId,
        from: prev,
        to: { x: me.x, y: me.y },
      };

      logPush(
        s,
        "[" + seat + "] 移動：" + cardName(me.cardId) + " (" + prev.x + "," + prev.y + ")→(" + to.x + "," + to.y + ")",
      );

      // フィールド効果は踏んだ後にも判定する。
      try {
        applyFieldOnStepAfterMove({
          s,
          who: seat,
          unit: me,
          pos: { x: me.x, y: me.y },
          round10,
          clampUnitStats10,
          countKillIfNeeded,
          setPanicAndCountIfNeeded,
          logPush,
        });
      } catch {}

      if (crossedCenterTowardEnemy(me.owner, prev.y, me.y)) {
        fireCardEffects(s, "onCrossCenter", me, { from: prev, to: { x: me.x, y: me.y } });
      }

      if (Number(me.hp) <= 0) {
        const killer = seat === "A" ? "B" : "A";
        setPanicAndCountIfNeeded(
          me,
          killer,
          s.kills,
          bleedLogLines,
          "出血による戦闘不能",
        );
        countKillIfNeeded(
          me,
          killer,
          s.kills,
          bleedLogLines,
          "出血による破壊",
        );
      }
      for (const ln of bleedLogLines) logPush(s, ln);

      const w = checkWinLocal(s);
      if (w) {
        s.winner = w;
        logPush(s, "勝者：" + w);
      }

      tx.set(stateRef, s, { merge: true });
    });

    return;
  }
}

// =====================
// Support / Attack / Evolve / EX 螳溯｡後さ繧｢
// =====================

// 10単位に丸める。
function round10(n) {
  const v = Math.trunc(Number(n ?? 0));
  return Math.trunc(v / 10) * 10;
}

// 状態異常の互換レイヤー（status/statuses両対応）
function addOrSetStatus(unit, key, deltaOrValue) {
  if (!unit) return;
  unit.status =
    unit.status && typeof unit.status === "object" ? unit.status : {};
  unit.statuses =
    unit.statuses && typeof unit.statuses === "object" ? unit.statuses : {};
  const st = getStatusLocal(unit);

  const cur = st?.[key]?.v;
  const base = Number.isFinite(Number(cur)) ? Number(cur) : 0;
  const add = Number.isFinite(Number(deltaOrValue)) ? Number(deltaOrValue) : 0;

  const v = base + add;

  unit.status[key] = { v };
  unit.statuses[key] = { v };
}

function applyPowerUpAdapter(attacker, hpDamageAbs, act) {
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try {
    if (typeof applyPowerUpToHpDamage !== "function") return dmg;
    const n = applyPowerUpToHpDamage.length;
    if (n >= 3)
      return Math.max(
        0,
        Math.trunc(Number(applyPowerUpToHpDamage(attacker, dmg, act) ?? dmg)),
      );
    if (n === 2)
      return Math.max(
        0,
        Math.trunc(Number(applyPowerUpToHpDamage(attacker, dmg) ?? dmg)),
      );
    if (n === 1)
      return Math.max(
        0,
        Math.trunc(Number(applyPowerUpToHpDamage(attacker) ?? dmg)),
      );
    return dmg;
  } catch {
    return dmg;
  }
}

function applyArmorAdapter(defender, hpDamageAbs) {
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try {
    if (typeof applyArmorToHpDamage !== "function") return dmg;

    const ret = applyArmorToHpDamage(defender, dmg);

    // 笨・game_state.js蝙具ｼ嘴 taken, absorbed, remainArmor }
    if (ret && typeof ret === "object" && Number.isFinite(Number(ret.taken))) {
      return Math.max(0, Math.trunc(Number(ret.taken)));
    }

    // Legacy numeric return value.
    const n = Number(ret);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));

    return dmg;
  } catch {
    return dmg;
  }
}

function clampUnitStats10(u) {
  if (!u) return;

  // Stats are always rounded to 10.
  u.hp = round10(u.hp);
  u.sp = round10(u.sp);

  // 荳矩剞
  if (u.hp < 0) u.hp = 0;
  if (u.sp < 0) u.sp = 0;

  // Clamp to maxHp/maxSp when they exist.
  const maxHp = Number.isFinite(Number(u.maxHp)) ? round10(u.maxHp) : null;
  const maxSp = Number.isFinite(Number(u.maxSp)) ? round10(u.maxSp) : null;

  if (maxHp != null) u.hp = Math.min(u.hp, maxHp);
  if (maxSp != null) u.sp = Math.min(u.sp, maxSp);

  // 蠢ｵ縺ｮ縺溘ａ譬ｼ邏阪ｂ10蜊倅ｽ阪↓
  if (maxHp != null) u.maxHp = maxHp;
  if (maxSp != null) u.maxSp = maxSp;
}

// 蜻ｽ荳ｭ繝ｭ繝ｼ繝ｫ
function rollHit(rate) {
  const r = Math.floor(Math.random() * 100) + 1; // 1..100
  return { r, hit: r <= Math.max(0, Math.min(100, Math.trunc(rate))) };
}

// =====================
// 繧ｯ繝ｪ繝・ぅ繧ｫ繝ｫ / 繝輔ぃ繝ｳ繝悶Ν・郁ｿｽ蜉・・// =====================
const CRIT_ROLL_MAX = 5; // 1..5 is critical.
const FUMBLE_ROLL_MIN = 95; // 95..100 is fumble.

// 範囲内ターゲット列挙（AOE用）
function listTargetsForAoe(s, attacker, act) {
  const units = Array.isArray(s?.units) ? s.units : [];
  const flags = actFlags(act);

  // rangeSpec を offsets（front1+rf1+lf1 など）に変換する。
  const offs = parseRangeSpecToOffsets(act.range, attacker.owner);
  if (!offs.length) return [];

  // all/全体指定なら味方も巻き込む
  const addList = addStatusListFromAny(act?.addStatus);
  const isAll =
    flags.aoe && (addList.includes("all") || addList.includes("全体"));

  // range蠖｢迥ｶ荳翫・縲後そ繝ｫ髮・粋縲阪ｒ菴懊ｋ
  const cells = new Set();
  for (const o of offs) {
    const x = attacker.x + o.dx;
    const y = attacker.y + o.dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;

    // Keep line blocking disabled for AOE for now.
    // if (!flags.pierce) {
    //   if (isLineBlocked(units, attacker, { x, y })) continue;
    // }

    cells.add(x + "," + y);
  }

  // セル上のユニットを拾う。
  const out = [];
  for (const u of units) {
    if (!u || Number(u.hp) <= 0) continue;
    if (u.id === attacker.id) continue;

    const key = u.x + "," + u.y;
    if (!cells.has(key)) continue;

    if (isAll) out.push(u);
    else {
      if (normSeat(u.owner) !== normSeat(attacker.owner)) out.push(u);
    }
  }
  return out;
}

// ===== Status icon helpers =====
const STATUS_ICON = {
  armor: "盾",
  bleed: "血",
  poison: "毒",
  fracture: "骨",
  smell: "臭",
  lostSoul: "魂",
  blind: "盲",
  evade: "避",
  combo: "連",
  followUp: "追",
  aim: "狙",
  hitUp: "命",
  jinx: "呪",
  powerUp: "強",
  power: "力",
  draw: "引",
  recoverFatigue: "疲",
  recoverMove: "移",
  rage: "怒",
  brainwash: "洗",
  sludge: "泥",
  counter: "反",
  seal: "封",
  taiman: "対",
  panic: "乱",
  fatigue: "疲",
};

function bonusIcon(name) {
  const m = {
    bleed: "血",
    fracture: "骨",
    smell: "臭",
    blind: "盲",
    aim: "狙",
    hitUp: "命",
    jinx: "呪",
    armor: "盾",
    powerUp: "強",
    recoverFatigue: "疲",
    fatigueHeal: "疲",
    fatigueClear: "疲",
    recoverMove: "移",
    moveReset: "移",
    refreshMove: "移",
    cleanse: "清",
    taiman: "対",
  };
  return m[name] || "補";
}

function isBonusTriggered(when, rollR) {
  const w = String(when || "").trim();
  if (!w) return false;

  // "<=40" ">=80" "<40" ">10" "==1" 縺ｿ縺溘＞縺ｪ縺ｮ繧定ｨｱ蜿ｯ
  const m = w.match(/^(<=|>=|<|>|==)\s*(\d+)$/);
  if (!m) return false;

  const op = m[1];
  const n = Math.max(1, Math.min(100, Math.trunc(Number(m[2]))));
  const r = Math.max(1, Math.min(100, Math.trunc(Number(rollR))));

  if (op === "<=") return r <= n;
  if (op === ">=") return r >= n;
  if (op === "<") return r < n;
  if (op === ">") return r > n;
  if (op === "==") return r === n;
  return false;
}

function applyBonusEffects({ attacker, target, act, rollR, logLines }) {
  const bonus = Array.isArray(act?.bonus) ? act.bonus : [];
  if (!bonus.length) return;

  for (const b of bonus) {
    const when = b?.when;
    if (!isBonusTriggered(when, rollR)) continue;

    const key = String(b?.addStatus || "").trim();
    if (!key) continue;

    const v = Number.isFinite(Number(b?.v)) ? Math.trunc(Number(b.v)) : 10;

    // status/statuses 両対応で付与する。
    addOrSetStatus(target, key, v);

    if (logLines) {
      logLines.push(
        "  → 追加効果 " + when + " " + bonusIcon(key) + key + (v ? "(" + v + ")" : ""),
      );
    }
  }
}

function getActFlatBonusValue(act, defVal = 10) {
  // bonus が数値（10,30など）で来る場合にも対応する。
  const b = Number(act?.bonus);
  if (Number.isFinite(b)) return Math.trunc(b);

  // 蠕捺擂莠呈鋤・嗾ags蛛ｴ
  try {
    const tags = tagMapFromAny(act?.tags);
    const v = Number(tags?.bonus ?? tags?.v ?? NaN);
    if (Number.isFinite(v)) return Math.trunc(v);
  } catch {}

  return defVal;
}

// addStatus を実処理へ落とし込む。
function applyActAddStatusDirect({ s, attacker, target, act, logLines }) {
  const list = addStatusListFromAny(act?.addStatus);
  if (!list.length || !target) return;

  const rawList = parseAddStatus(act?.addStatus) || [];
  const selfStatusDefaults = { rage: 20, brainwash: 50, sludge: 1, counter: 30 };
  for (const raw of rawList) {
    const text = String(raw || "").trim();
    if (!text.startsWith("self.")) continue;
    const keyRaw = text.slice("self.".length);
    const key = normalizeStatusKey?.(keyRaw) || keyRaw;
    if (!Object.prototype.hasOwnProperty.call(selfStatusDefaults, key)) continue;
    const v = getTagInt(act, key, selfStatusDefaults[key]);
    addOrSetStatus(attacker, key, v);
    logLines?.push?.("  → 自分に" + key + "+" + v);
  }

  const has = (...names) => names.some((n) => list.includes(n));

  // 旧CSV向けの直接バフ処理は、下の便利系処理に統合済み。

  // 便利系：CSVに入っている場合はここで処理する。
  if (has("recoverFatigue", "疲労回復", "fatigueHeal", "fatigueClear")) {
    try {
      clearFatigue(target);
    } catch {
      target.fatigue = false;
    }
    logLines?.push?.("  → 疲労回復");
  }

  if (
    has("recoverMove", "moveReset", "refreshMove", "移動回復", "移動回数回復")
  ) {
    const curSeq = Number(s?.turnSeq ?? 1);
    target.moveTurnSeq = curSeq;
    target.moveUsed = 0;
    logLines?.push?.("  → 移動回数回復");
  }

  if (has("cleanse", "状態異常クリア")) {
    try {
      clearStatuses(target);
    } catch {
      target.status = {};
    }
    target.statuses = {};
    logLines?.push?.("  → 状態異常クリア");
  }
}

async function execAttack(st) {
  let didConsume = false; // True once the action is actually consumed.
  if (!st) return;
  if (!canControl(st)) return;

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return;

  const acts = unitActionChoices(su, st);
  if (!acts.length) return;

  ensureSelectedActionIndex(st);
  const act = acts[selectedActionIndex] || acts[0];
  if (!act) return;

  const flags0 = actFlags(act);
  const needTarget = !isSelfRange(act.range) && !flags0.aoe;
  const target = getSelectedTarget(st); // 笨・譛ｪ螳夂ｾｩ繝舌げ蟇ｾ遲・
  if (needTarget && !target) return;

  // Snapshot selection before the transaction.
  const attackerIdSnap = su.id;
  const actionIndexSnap = selectedActionIndex;
  const targetIdSnap = selectedTargetId;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    const attacker = s.units.find((u) => u.id === attackerIdSnap) || null;
    if (!attacker || attacker.owner !== seat) return;
    if (Number(attacker.hp) <= 0) return;
    if (isPanic(attacker)) return;
    if (attacker.fatigue) return;

    const acts2 = unitActionChoices(attacker, s);
    const act2 = acts2[actionIndexSnap] || acts2[0] || null;
    if (!act2) return;

    // =====================
    // 笘・ｰ∝魂繝√ぉ繝・け・・ame_state.js 縺ｫ蟋碑ｭｲ・・    // =====================
    if (!canUseActionByStatus(attacker, act2)) {
      const actName = String(act2.name ?? "?");

      logPush(
        s,
        "[" + seat + "] 封じにより不発：" + cardName(attacker.cardId) + ":" + actName,
      );

      // 笆ｼ縺薙％縺ｯ螂ｽ縺ｿ
      // 蟆∝魂縺ｧ繧ゅさ繧ｹ繝域鴛縺・↑繧・true
      const CONSUME_COST_ON_SEAL = true;

      if (CONSUME_COST_ON_SEAL) {
        const cost = effectiveActionCost(attacker, act2);
        const mana = normalizeMana(s.mana);
        if (mana?.[seat]?.cur < cost) return;
        s.mana = spendManaMut(s.mana, seat, cost);
      }

      attacker.fatigue = true;
      didConsume = true;
      tx.set(stateRef, s, { merge: true });
      return;
    }

    // 繝槭リ謾ｯ謇輔＞
    const cost = effectiveActionCost(attacker, act2);
    const mana = normalizeMana(s.mana);
    if (mana?.[seat]?.cur < cost) return;
    s.mana = spendManaMut(s.mana, seat, cost);

    if (
      act2.__source === "brainwash" &&
      typeof checkBrainwashSuccess === "function" &&
      !checkBrainwashSuccess(attacker, () => Math.random())
    ) {
      const actName = String(act2.name ?? "?");
      const logLines = [
        "[" + seat + "] 洗脳失敗：" + cardName(attacker.cardId) + " は " + actName + " を奪えなかった",
      ];
      s.lastRoll = {
        at: nowMs(),
        r: "洗脳",
        rate: 50,
        hit: false,
        actionName: "洗脳:" + actName,
      };
      attacker.fatigue = true;
      for (const ln of logLines) logPush(s, ln);
      didConsume = true;
      tx.set(stateRef, s, { merge: true });
      return;
    }

    const flags = actFlags(act2);

    // 蟇ｾ雎｡鄒､
    let targets = [];
    if (isSelfRange(act2.range)) {
      targets = [attacker];
    } else if (flags.aoe) {
      targets = listTargetsForAoe(s, attacker, act2);
    } else {
      const tUnit = s.units.find((u) => u.id === targetIdSnap) || null;
      if (!tUnit || Number(tUnit.hp) <= 0) return;

      // 蟆・ｨ九メ繧ｧ繝・け
      if (!inActionRange(attacker, tUnit.x, tUnit.y, act2.range)) return;

      if (!flags.pierce) {
        if (isLineBlocked(s.units, attacker, tUnit)) return;
      }

      targets = [tUnit];
    }

    // 命中率（状態異常込み）
    const rate = calcHitRateAdapter(attacker, act2);
    const rr = rollHit(rate);

    const isCrit = rr.r <= CRIT_ROLL_MAX; // 1..5
    const isFumble = rr.r >= FUMBLE_ROLL_MIN; // 95..100

    let evaded = false;

    // 回避（単体攻撃のみ）
    if (
      rr.hit &&
      targets.length === 1 &&
      targets[0] &&
      targets[0].id !== attacker.id
    ) {
      evaded = checkEvadeAdapter(targets[0]);
    }

    const finalHit = rr.hit && !evaded;

    const logLines = [];
    const actName = String(act2.name ?? "?");
    const label = cardName(attacker.cardId) + ":" + actName;
    const attackFxFrom = { x: attacker.x, y: attacker.y };
    const attackFxTo =
      targets.length === 1 && targets[0]
        ? { x: targets[0].x, y: targets[0].y }
        : targetIdSnap
          ? (() => {
              const t = s.units.find((u) => u.id === targetIdSnap) || null;
              return t ? { x: t.x, y: t.y } : attackFxFrom;
            })()
          : attackFxFrom;

    s.lastRoll = {
      at: nowMs(),
      r: rr.r,
      rate,
      hit: rr.hit && !evaded,
      actionName: actName,
    };

    if (!finalHit) {
      // 失敗ログ（命中失敗 or 回避）
      if (!rr.hit) {
        logLines.push("[" + seat + "] 行動失敗：" + label + "（命中" + rate + "%）");
      } else {
        const evName = targets?.[0]?.cardId
          ? cardName(targets[0].cardId)
          : "対象";
        logLines.push("[" + seat + "] 回避：" + label + " → " + evName);
      }

      const rageDmg = Number(applyRageFailurePenalty?.(attacker) ?? 0);
      if (rageDmg > 0) {
        clampUnitStats10(attacker);
        logLines.push("  → 激怒：失敗反動 HP-" + rageDmg);
        s.lastHit = {
          at: nowMs(),
          attackerId: attacker.id,
          targetId: attacker.id,
          from: attackFxFrom,
          to: attackFxFrom,
          items: [{ kind: "HP", delta: -rageDmg }],
        };
        setPanicAndCountIfNeeded(attacker, opponentSeat, s.kills, logLines, "激怒反動(パニック)");
        if (Number(attacker.hp) <= 0) {
          countKillIfNeeded(attacker, opponentSeat, s.kills, logLines, "激怒反動");
        }
      }

      // 笘・ヵ繧｡繝ｳ繝悶Ν・郁ｿｽ蜉・会ｼ・5莉･荳翫〒螟ｱ謨励＠縺溘ｉ閾ｪ蛯ｷ
      if (isFumble) {
        const { hpDelta, spDelta } = getActDeltas(act2);

        const selfItems = [];
        // ダメージ成分だけ反映する（回復成分は無視）。
        if (hpDelta < 0) {
          let dmg = Math.abs(hpDelta);
          // 技の威力強化・自分の防御も反映する。
          dmg = applyPowerUpAdapter(attacker, dmg, act2);
          dmg = applyArmorAdapter(attacker, dmg);
          attacker.hp = round10(Number(attacker.hp) - dmg);
          selfItems.push({ kind: "HP", delta: -dmg });
        }
        if (spDelta < 0) {
          const dmgSp = Math.abs(spDelta);
          attacker.sp = round10(Number(attacker.sp) - dmgSp);
          selfItems.push({ kind: "SP", delta: -dmgSp });
        }

        clampUnitStats10(attacker);

        logLines.push("ファンブル：自分に反動ダメージ");

        // 閾ｪ辷・〒繝代ル繝・け/謦・ｴ縺励◆繧峨檎嶌謇九・繧ｭ繝ｫ縲阪↓縺吶ｋ
        const killer = opponentSeat;
        setPanicAndCountIfNeeded(
          attacker,
          killer,
          s.kills,
          logLines,
          "ファンブル自傷(パニック)",
        );
        if (Number(attacker.hp) <= 0) {
          countKillIfNeeded(
            attacker,
            killer,
            s.kills,
            logLines,
            "ファンブル自傷(破壊)",
          );
        }

        // 演出用に lastHit へ自傷を入れる。
        s.lastHit = {
          at: nowMs(),
          attackerId: attacker.id,
          targetId: attacker.id,
          from: attackFxFrom,
          to: attackFxFrom,
          items: selfItems.slice(0, 6),
        };
      }

      attacker.fatigue = true;
      normalizePanicForAll(s.units, s.kills, logLines);
      for (const ln of logLines) logPush(s, ln);

      const w = checkWinLocal(s);
      if (w) {
        s.winner = w;
        logPush(s, "勝者：" + w);
      }
      didConsume = true;
      tx.set(stateRef, s, { merge: true });
      return;
    }

    // 謌仙粥譎ゑｼ壼柑譫憺←逕ｨ
    const { hpDelta, spDelta } = getActDeltas(act2);
    const hitItems = [];
    const counterItems = [];

    if (isCrit) {
      logLines.push("クリティカル：ダメージ2倍");
    }

    for (const t of targets) {
      if (!t || Number(t.hp) <= 0) continue;

      const hasIncomingDamage = hpDelta < 0 || spDelta < 0;
      const damageBlockedByTaiman =
        hasIncomingDamage &&
        t.id !== attacker.id &&
        typeof isTaimanDamageAllowed === "function" &&
        !isTaimanDamageAllowed(t, attacker);
      if (damageBlockedByTaiman) {
        logLines.push(
          "  → タイマン：" + cardName(t.cardId) + " は正面の敵以外からのダメージを受けない",
        );
      }
      const countered =
        hasIncomingDamage &&
        !damageBlockedByTaiman &&
        t.id !== attacker.id &&
        !!checkCounter?.(t, () => Math.random());
      const assistBlocked =
        typeof blocksAssist === "function" &&
        typeof isAssistAction === "function" &&
        blocksAssist(t) &&
        isAssistAction(act2);
      let assistBlockLogged = false;
      const logAssistBlocked = () => {
        if (assistBlockLogged) return;
        assistBlockLogged = true;
        logLines.push("  → 失魂：" + cardName(t.cardId) + " は補助効果を受けない");
      };

      if (countered) {
        const retDmg = 10;
        attacker.hp = round10(Number(attacker.hp) - retDmg);
        clampUnitStats10(attacker);
        counterItems.push({ kind: "HP", delta: -retDmg });
        logLines.push("  → カウンター：" + cardName(t.cardId) + "がダメージを0にして HP-" + retDmg + " 反撃");
        setPanicAndCountIfNeeded(attacker, normSeat(t.owner), s.kills, logLines, "カウンター(パニック)");
        if (Number(attacker.hp) <= 0) {
          countKillIfNeeded(attacker, normSeat(t.owner), s.kills, logLines, "カウンター");
        }
        continue;
      }

      // HP
      if (hpDelta < 0) {
        if (!damageBlockedByTaiman) {
          let dmg = Math.abs(hpDelta);
          dmg = applyPowerUpAdapter(attacker, dmg, act2);

          // CRITはダメージだけ2倍（回復は増やさない）
          if (isCrit) dmg *= 2;

          dmg = applyArmorAdapter(t, dmg);
          t.hp = round10(Number(t.hp) - dmg);
          hitItems.push({ kind: "HP", delta: -dmg });
        }
      } else if (hpDelta > 0) {
        if (assistBlocked) {
          logAssistBlocked();
        } else {
          // 回復は2倍にしない。
          t.hp = round10(Number(t.hp) + hpDelta);
          hitItems.push({ kind: "HP", delta: +hpDelta });
        }
      }

      // SP
      if (spDelta < 0) {
        if (!damageBlockedByTaiman) {
          let dmgSp = Math.abs(spDelta);

          // CRITはダメージだけ2倍。
          if (isCrit) dmgSp *= 2;

          t.sp = round10(Number(t.sp) - dmgSp);
          hitItems.push({ kind: "SP", delta: -dmgSp });
        }
      } else if (spDelta > 0) {
        if (assistBlocked) {
          logAssistBlocked();
        } else {
          // 回復は2倍にしない。
          t.sp = round10(Number(t.sp) + spDelta);
          hitItems.push({ kind: "SP", delta: +spDelta });
        }
      }

      const nextAttr = getActChangeAttr(act2);
      if (nextAttr) {
        if (assistBlocked) {
          logAssistBlocked();
        } else {
          const beforeAttr = applyBattleAttrChange(t, nextAttr);
          hitItems.push({ kind: "ATTR", delta: `${beforeAttr || "?"}->${nextAttr}` });
          logLines.push(`  ATTR ${cardName(t.cardId)} ${beforeAttr || "?"} -> ${nextAttr}`);
        }
      }

      if (assistBlocked) {
        logAssistBlocked();
      } else {
        applyBonusEffects({
          attacker,
          target: t,
          act: act2,
          rollR: rr.r,
          logLines,
        });
      }

      clampUnitStats10(t);

      // 状態付与
      if (assistBlocked) {
        logAssistBlocked();
      } else {
        try {
          const ret = applyStatusesOnHitAdapter(t, act2, Number(s.turnSeq ?? 1));
          const added = Array.isArray(ret?.added)
            ? mergeAddedStatuses(ret.added)
            : [];
          void added;
        } catch {}

        applyActAddStatusDirect({ s, attacker, target: t, act: act2, logLines });
      }

      if (
        targets.length === 1 &&
        actionWantsSwapTarget(act2) &&
        t.id !== attacker.id &&
        Number(t.hp) > 0 &&
        Number(attacker.hp) > 0 &&
        !t.panic &&
        !attacker.panic
      ) {
        const ax = attacker.x;
        const ay = attacker.y;
        attacker.x = t.x;
        attacker.y = t.y;
        t.x = ax;
        t.y = ay;
        logLines.push("  → 位置入れ替え " + cardName(attacker.cardId) + " ⇔ " + cardName(t.cardId));
      }

      const kb = getKnockbackDistFromAct?.(act2) ?? 0;
      if (kb > 0) {
        const r = applyKnockback?.(s, attacker, t, kb);
        if (r?.moved > 0) logLines.push("  → ノックバック" + r.moved);
      }

      // 繝代ル繝・け/謦・ｴ
      setPanicAndCountIfNeeded(t, seat, s.kills, logLines);
      if (Number(t.hp) <= 0) {
        countKillIfNeeded(t, seat, s.kills, logLines, "破壊");
      }
    }

    // 笨・draw邨ｱ荳・啾ddStatus=draw + tags.draw=譫壽焚
    if (hasAddStatusKey(act2, "draw")) {
      const n = Math.max(1, getTagInt(act2, "draw", 1));
      const who = normSeat(attacker?.owner) || seat;
      safeDrawCards(s, who, n);
      logLines.push("  → ドロー+" + n);
    }

    applyHandEffectsFromAction(s, normSeat(attacker?.owner) || seat, act2, logLines);

    attacker.fatigue = true;

    const tgtName =
      targets.length === 1 && targets[0]
        ? cardName(targets[0].cardId)
        : flags.aoe
          ? "複数(" + targets.length + ")"
          : "なし";

    logLines.push("[" + seat + "] 行動成功：" + label + " → " + tgtName);

    const primaryTargetId =
      targets.length === 1 && targets[0]
        ? targets[0].id
        : (targetIdSnap ?? targets[0]?.id ?? null);

    s.lastHit = {
      at: nowMs(),
      attackerId: attacker.id,
      targetId: counterItems.length ? attacker.id : primaryTargetId || (targets[0]?.id ?? null),
      from: attackFxFrom,
      to: counterItems.length ? attackFxFrom : attackFxTo,
      items: (counterItems.length ? counterItems : hitItems).slice(0, 6),
    };

    normalizePanicForAll(s.units, s.kills, logLines);

    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logLines.push("勝者：" + w);
    }

    for (const ln of logLines) logPush(s, ln);
    didConsume = true;
    tx.set(stateRef, s, { merge: true });
  });
  // 行動が実際に処理された時だけ、コマンド選択を解除する。
  if (didConsume) clearCommandSelectionUI({ keepUnit: true });
}

function applySmellOnTurnEndAdapter(u, s, who) {
  try {
    const fn = applySmellOnTurnEnd;
    if (typeof fn !== "function") return;

    const n = fn.length;
    if (n >= 3) fn(u, s, who);
    else if (n === 2) fn(u, s);
    else fn(u);
  } catch {}
}

function applyPoisonOnTurnStartAdapter(u, s, who, logLines) {
  try {
    const fn = applyPoisonOnTurnStart;
    if (typeof fn !== "function") return null;

    const ret = fn(u, () => Math.random());
    if (!ret?.active) return ret;

    const name = cardName(u?.cardId);
    if (ret.cleared) {
      logLines?.push?.("  → 毒解除：" + name);
    } else if (Number(ret.damage) > 0) {
      logLines?.push?.("  → 毒：" + name + " HP-" + Number(ret.damage));
      const killer = who === "A" ? "B" : "A";
      setPanicAndCountIfNeeded(u, killer, s?.kills, logLines, "毒(パニック)");
      if (Number(u.hp) <= 0) {
        countKillIfNeeded(u, killer, s?.kills, logLines, "毒");
      }
    }
    return ret;
  } catch {
    return null;
  }
}

// ---- Support 螳溯｡鯉ｼ・pplySupport 縺悟｣翫ｌ縺ｦ繧よ怙菴朱剞蜍輔￥・・----

function pickEffectByTable(eff, roll) {
  const table = Array.isArray(eff?.table) ? eff.table : null;
  if (!table || !table.length) return eff;

  const weights = table.map((r) => {
    const w = Number(r?.rate ?? r?.p ?? r?.prob ?? 0);
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const sum = weights.reduce((a, b) => a + b, 0);

  if (sum <= 0) {
    const idx = Math.min(
      table.length - 1,
      Math.max(0, Math.trunc(((roll - 1) / 100) * table.length)),
    );
    const row = table[idx];
    return row?.effect ? row.effect : row;
  }

  let acc = 0;
  for (let i = 0; i < table.length; i++) {
    acc += weights[i];
    if (roll <= Math.ceil((acc / sum) * 100)) {
      const row = table[i];
      return row?.effect ? row.effect : row;
    }
  }
  const last = table[table.length - 1];
  return last?.effect ? last.effect : last;
}

function supportAlwaysSuccessForDraw(eff) {
  const e = eff?.effect ? eff.effect : eff;
  if (!e) return false;
  const t = String(e.type ?? "").trim();
  return t === "draw";
}

function applySupportFallback(s, who, def, plan, ctx) {
  const eff0 = def?.effect || null;
  if (!eff0) return { ok: false, label: "効果なし" };

  // 笨・table謚ｽ驕ｸ縺ｨ謌仙粥蛻､螳壹・迢ｬ遶九Ο繝ｼ繝ｫ
  const tableRoll = Math.floor(Math.random() * 100) + 1;
  const hitRoll = Math.floor(Math.random() * 100) + 1;

  // table がある場合は内容を決定する。
  const eff = pickEffectByTable(eff0, tableRoll);
  // caster条件がある場合は満たしていなければ失敗扱い。
  const cond = eff?.cond ?? eff0?.cond ?? null;
  if (!casterCondOkInState(s, ctx, cond, cardDefs)) {
    const label = "cond(caster) NG";
    return { ok: false, label, eff, hitRoll, tableRoll };
  }
  const type = supportTypeOf(eff);

  // draw は強制成功。
  const rate = Math.max(
    0,
    Math.min(100, Math.trunc(Number(eff?.rate ?? eff0?.rate ?? 100))),
  );
  const alwaysOk = supportAlwaysSuccessForDraw(eff);
  const hit = alwaysOk ? true : hitRoll <= rate;

  // 表示用。tableRoll/hitRoll 両方残す。
  const label =
    "tbl:" + tableRoll + " / hit:" + hitRoll + " / " +
    (alwaysOk ? "DRAW(強制)" : rate + "%");
  if (!hit) return { ok: false, label, eff, hitRoll, tableRoll };

  const units = Array.isArray(s.units) ? s.units : [];
  const u1 = ctx?.target1Id ? units.find((u) => u.id === ctx.target1Id) : null;
  const u2 = ctx?.target2Id ? units.find((u) => u.id === ctx.target2Id) : null;

  const curSeq = Number(s.turnSeq ?? 1);

  // 効果適用
  if (type === "draw") {
    const n = Math.max(1, Math.trunc(Number(eff?.n ?? eff?.draw ?? 1)));
    safeDrawCards(s, who, n);
    logPush(s, "[" + who + "] Support: ドロー +" + n);
  } else if (type === "heal") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const hp = round10(Number(eff?.hp ?? eff?.heal ?? eff?.amount ?? 10));
    const sp = round10(Number(eff?.sp ?? 0));
    u1.hp = round10(Number(u1.hp) + hp);
    u1.sp = round10(Number(u1.sp) + sp);
    clampUnitStats10(u1);
    logPush(
      s,
      "[" + who + "] Support: 回復 " + cardName(u1.cardId) + " HP+" + hp + (sp ? " SP+" + sp : ""),
    );
  } else if (type === "dmg") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const hp = round10(
      Number(eff?.hp ?? eff?.dmg ?? eff?.damage ?? eff?.amount ?? 10),
    );
    u1.hp = round10(Number(u1.hp) - Math.abs(hp));
    clampUnitStats10(u1);
    if (Number(u1.hp) <= 0)
      countKillIfNeeded(u1, who, s.kills, null, "Support破壊");
    logPush(
      s,
      "[" + who + "] Support: ダメージ " + cardName(u1.cardId) + " HP-" + Math.abs(hp),
    );
  } else if (type === "modRate") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const d = Math.trunc(Number(eff?.delta ?? eff?.d ?? 10));
    if (d >= 0) addOrSetStatus(u1, "aim", d);
    else addOrSetStatus(u1, "jinx", Math.abs(d));
    logPush(
      s,
      "[" + who + "] Support: 命中" + (d >= 0 ? "+" : "-") + Math.abs(d) + "% → " + cardName(u1.cardId),
    );
  } else if (type === "powerUp") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const d = Math.trunc(Number(eff?.delta ?? eff?.d ?? 10));
    addOrSetStatus(u1, "powerUp", d);
    logPush(s, "[" + who + "] Support: 威力+" + d + " → " + cardName(u1.cardId));
  } else if (type === "cleanse") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    u1.status = {};
    u1.statuses = {};
    logPush(s, "[" + who + "] Support: 状態異常クリア → " + cardName(u1.cardId));
  } else if (
    type === "recoverFatigue" ||
    type === "fatigueHeal" ||
    type === "fatigueClear"
  ) {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    u1.fatigue = false;
    logPush(s, "[" + who + "] Support: 疲労回復 → " + cardName(u1.cardId));
  } else if (
    type === "recoverMove" ||
    type === "moveReset" ||
    type === "refreshMove"
  ) {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    u1.moveTurnSeq = curSeq;
    u1.moveUsed = 0;
    logPush(s, "[" + who + "] Support: 移動回数回復 → " + cardName(u1.cardId));
  } else if (type === "swapPos") {
    if (!u1 || !u2) return { ok: false, label, eff, needs: "unit2" };
    const ax = u1.x,
      ay = u1.y;
    u1.x = u2.x;
    u1.y = u2.y;
    u2.x = ax;
    u2.y = ay;
    logPush(
      s,
      "[" + who + "] Support: 位置入れ替え " + cardName(u1.cardId) + " ⇔ " + cardName(u2.cardId),
    );
  } else if (type === "moveTo") {
    if (!u1 || !ctx?.targetCell)
      return { ok: false, label, eff, needs: "unitCell" };
    const { x, y } = ctx.targetCell;
    // 遨ｺ繝槭せ縺ｧ縺ｪ縺代ｌ縺ｰ荳ｭ豁｢
    const occ = units.find(
      (v) => v && Number(v.hp) > 0 && v.x === x && v.y === y,
    );
    if (occ) return { ok: false, label, eff, needs: "unitCell" };
    u1.x = x;
    u1.y = y;
    logPush(
      s,
      "[" + who + "] Support: 強制移動 " + cardName(u1.cardId) + " → (" + x + "," + y + ")",
    );
  } else if (type === "discardHand" || type === "setCard") {
    const logs = [];
    const applied = applyHandEffectsFromAction(s, who, {
      name: cardName(ctx?.cardId || ""),
      handEffect: {
        ...eff,
        type: type === "setCard" ? "setHand" : "discardHand",
        targetSeat: eff.targetSeat || "enemy",
        count: eff.count ?? eff.n ?? 1,
      },
    }, logs);
    logs.forEach((line) => logPush(s, "[" + who + "] Support:" + String(line).replace(/^\s*→\s*/, " ")));
    if (!applied) return { ok: false, label, eff, reason: "対象手札なし" };
  } else {
    // 未対応でも成功扱いにして詰まらせない。
    logPush(s, "[" + who + "] Support: " + (type || "unknown") + "（未対応効果）");
  }

  normalizePanicForAll(s.units, s.kills, null);

  return { ok: true, label, eff, hitRoll, tableRoll };
}

function mergeAddedStatuses(added) {
  const map = new Map(); // name -> {name, v, total, ...}
  for (const it of added || []) {
    const name = it?.name;
    if (!name) continue;

    const prev = map.get(name);

    // total がある場合はそちらを優先する。
    const val = Number(it.total ?? it.v ?? 0);

    if (!prev) {
      map.set(name, { ...it, v: val, total: val });
    } else {
      const base = Number(prev.total ?? prev.v ?? 0);
      const next = base + val;
      map.set(name, { ...prev, total: next, v: next, stacked: true });
    }
  }
  return [...map.values()];
}

function getUnitAttrByIdInState(s, unitId, cardDefs) {
  if (!s || !unitId) return null;
  const units = Array.isArray(s.units) ? s.units : [];
  const u = units.find((x) => x.id === unitId);
  if (!u || Number(u.hp) <= 0 || u.panic) return null;
  const cd = cardDefs?.[u.cardId];
  return String(u.attrOverride || u.attr || u.type || cd?.attr || cd?.type || "").trim() || null;
}

function casterCondOkInState(s, ctx, cond, cardDefs) {
  if (!cond || typeof cond !== "object") return true;

  const casterAttr = cond.casterAttr ? String(cond.casterAttr).trim() : null;
  const casterAttrIn = Array.isArray(cond.casterAttrIn)
    ? cond.casterAttrIn.map((x) => String(x).trim()).filter(Boolean)
    : null;

  if (!casterAttr && !(casterAttrIn && casterAttrIn.length)) return true;

  const casterAttrNow = getUnitAttrByIdInState(s, ctx?.casterUnitId, cardDefs);
  if (!casterAttrNow) return false;

  if (casterAttr && casterAttrNow !== casterAttr) return false;
  if (
    casterAttrIn &&
    casterAttrIn.length &&
    !casterAttrIn.includes(casterAttrNow)
  )
    return false;

  return true;
}

function pickCasterUnitIdSnapshot(st) {
  const units = Array.isArray(st?.units) ? st.units : [];
  const alive = (u) => u && Number(u.hp) > 0 && !u.panic;

  const su = units.find((u) => u.id === selectedUnitId);
  if (su && alive(su) && normSeat(su.owner) === seat) return su.id;

  const t1 = units.find((u) => u.id === supportTarget1Id);
  if (t1 && alive(t1) && normSeat(t1.owner) === seat) return t1.id;

  const first = units.find((u) => alive(u) && normSeat(u.owner) === seat);
  return first ? first.id : null;
}

async function execSupport(st) {
  if (!st) return;
  if (!canControl(st)) return;

  const cid = selectedHandCardId(st);
  const def = selectedHandDef(st);
  if (!cid || !def || !isSupportCard(def)) return;
  if (selectedHandLocked(st)) {
    logPush(st, "[" + seat + "] Support失敗：" + cardName(cid) + "は伏せ中");
    render(st);
    return;
  }

  const plan = supportPlan(def);
  if (!supportReadyByPlan(plan)) return;

  const idxSnap = selectedHandIndex;
  const cidSnap = cid;
  const t1Snap = supportTarget1Id;
  const t2Snap = supportTarget2Id;
  const casterUnitIdSnap = pickCasterUnitIdSnapshot(st);
  const cellSnap = supportTargetCell ? { ...supportTargetCell } : null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.hands = s.hands || { A: [], B: [] };
    s.decks = s.decks || { A: [], B: [] };
    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];
    const idx = idxSnap;
    if (idx == null || idx < 0 || idx >= hand.length) return;
    if (hand[idx] !== cidSnap) return;
    if (isHandCardLocked(s, idx, seat)) {
      logPush(s, "[" + seat + "] Support失敗：" + cardName(cidSnap) + "は伏せ中");
      tx.set(stateRef, s, { merge: true });
      return;
    }

    const defSnap = cardDefs?.[cidSnap] || null;
    if (!defSnap || !isSupportCard(defSnap)) return;

    let ret = null;
    let ok = false;
    let label = "??";

    try {
      ret = applySupport({
        s,
        seat,
        cardDefs,
        supportCardId: cidSnap,
        supportHandIndex: idx,
        casterUnitId: casterUnitIdSnap,
        targetUnitId: t1Snap,
        targetUnitId2: t2Snap,
        targetUnitIds: supportTargetIds,
        targetCell: cellSnap,
        searchCardId: supportSearchCardId,
        rand: Math.random,
      });

      if (!ret || ret.ok === false) {
        logPush(
          s,
          "[" + seat + "] Support失敗：" + cardName(cidSnap) + (ret?.reason ? " / " + ret.reason : ""),
        );
        tx.set(stateRef, s, { merge: true });
        return;
      }

      // core霑斐ｊ蛟､繧・state 縺ｫ蜿肴丐
      if (ret.mana) s.mana = ret.mana;
      if (ret.hands) s.hands = ret.hands;
      if (ret.decks) s.decks = ret.decks;
      if (ret.discards) s.discards = ret.discards;
      if (ret.units) s.units = ret.units;
      if (ret.kills) s.kills = ret.kills;
      if (ret.handLocks) s.handLocks = ret.handLocks;
      if (ret.log) s.log = ret.log;
      if ("lastSupportRoll" in ret) s.lastSupportRoll = ret.lastSupportRoll;

      ok = !!ret.applied;
      label = ret?.lastSupportRoll?.label || (ok ? "success" : "fail");
    } catch (e) {
      console.warn("[execSupport] core failed -> fallback", e);

      const r = applySupportFallback(s, seat, defSnap, plan, {
        seat,
        casterUnitId: casterUnitIdSnap,
        target1Id: t1Snap,
        target2Id: t2Snap,
        targetCell: cellSnap,
        cardId: cidSnap,
      });

      ok = !!r.ok;
      label = String(r.label ?? "fallback");
    }

    if (!s.lastSupportRoll) {
      s.lastSupportRoll = {
        at: nowMs(),
        r: Math.floor(Math.random() * 100) + 1,
        ok,
        label,
        cardName: cardName(cidSnap),
      };
    }

    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logPush(s, "勝者：" + w);
    }

    tx.set(stateRef, s, { merge: true });
  });

  clearCommandSelectionUI({ keepUnit: true });
}

// ---- 騾ｲ蛹・----

// ---- EX ----
async function execEx() {
  const st = currentState;
  if (!st || !canControl(st)) return;

  const casterUnitIdSnap = pickCasterUnitIdSnapshot(st);
  const t1Snap = supportTarget1Id;
  const t2Snap = supportTarget2Id;
  const cellSnap = supportTargetCell ? { ...supportTargetCell } : null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.ex = s.ex || { A: null, B: null };
    s.exUsed = s.exUsed || { A: false, B: false };
    const exId = s?.ex?.[seat] ?? null;
    const used = !!s?.exUsed?.[seat];
    if (!exId || used) return;

    let ret = null;

    try {
      ret = applyExSupport({
        s,
        seat,
        cardDefs,
        exCardId: exId,
        casterUnitId: casterUnitIdSnap,
        targetUnitId: t1Snap,
        targetUnitId2: t2Snap,
        targetUnitIds: supportTargetIds,
        targetCell: cellSnap,
        rand: Math.random,
      });

      if (!ret || ret.ok === false) {
        logPush(
          s,
          "[" + seat + "] EX失敗：" + cardName(exId) + (ret?.reason ? " / " + ret.reason : ""),
        );
        tx.set(stateRef, s, { merge: true });
        return;
      }

      if (ret.mana) s.mana = ret.mana;
      if (ret.hands) s.hands = ret.hands;
      if (ret.decks) s.decks = ret.decks;
      if (ret.discards) s.discards = ret.discards;
      if (ret.units) s.units = ret.units;
      if (ret.kills) s.kills = ret.kills;
      if (ret.ex) s.ex = ret.ex;
      if (ret.exUsed) s.exUsed = ret.exUsed;
      if (ret.log) s.log = ret.log;
      if ("lastSupportRoll" in ret) s.lastSupportRoll = ret.lastSupportRoll;

      logPush(s, "[" + seat + "] EX使用：" + cardName(exId));
      tx.set(stateRef, s, { merge: true });
    } catch (e) {
      console.warn("[execEx] failed", e);
      logPush(s, "[" + seat + "] EX失敗：" + cardName(exId));
      tx.set(stateRef, s, { merge: true });
    }
  });

  clearCommandSelectionUI({ keepUnit: true });
}

function clearFatigueAndStatusesAtTurnEnd(s, who) {
  const units = Array.isArray(s?.units) ? s.units : [];
  for (const u of units) {
    if (!u) continue;
    if (normSeat(u.owner) !== who) continue;
    if (Number(u.hp) <= 0) continue;

    try {
      clearFatigue(u);
    } catch {
      u.fatigue = false;
    }

    // 笨・迥ｶ諷狗焚蟶ｸ蜈ｨ蝗槫ｾｩ・喩ame_state.js縺ｮ豁｣隕擾ｼ・tatus・峨ｒ豸医☆
    try {
      clearStatuses(u);
    } catch {
      u.status = {};
    }

    u.statuses = {};
  }
}

// =====================
// 繧ｿ繝ｼ繝ｳ邨ゆｺ・// =====================
// =====================
// 繧ｿ繝ｼ繝ｳ邨ゆｺ・// =====================
async function endTurnForSeat(actorSeat) {
  const actor = normSeat(actorSeat);
  const st = currentState;
  if (!actor || !st || normSeat(st.turn) !== actor || st.winner) return false;

  let changed = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (normSeat(s.turn) !== actor || s.winner) return;

    const who = actor;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    // ---------------------
    // 2) 繧ｿ繝ｼ繝ｳ邨ゆｺ・凾・夂憾諷句・逅・ｼ亥撃縺・↑縺ｩ・・    // ---------------------
    try {
      const units = Array.isArray(s.units) ? s.units : [];
      for (const u of units) {
        if (!u) continue;
        if (normSeat(u.owner) !== who) continue;
        try {
          if (!isAlive(u)) continue;
        } catch {
          if (Number(u.hp) <= 0 || !!u.panic) continue;
        }
        applySmellOnTurnEndAdapter(u, s, who);
      }
    } catch {}

    // 莉悶↓繧ょｿ・ｦ√↑繧峨％縺薙↓蜷ｸ蜿主・逅・ｒ霑ｽ蜉蜿ｯ閭ｽ・育樟迥ｶ縺ｯ蛹ゅ＞縺縺醍｢ｺ螳溷喧・・
    // ---------------------
    // 3) 蜍晏茜蛻､螳夲ｼ育ｵゆｺ・凾・・    // ---------------------
    const w0 = checkWinLocal(s);
    if (w0) {
      s.winner = w0;
      logPush(s, "勝者：" + w0);
      tx.set(stateRef, s, { merge: true });
      return;
    }

    // ---------------------
    // 4) 笨・閾ｪ蛻・ち繝ｼ繝ｳ邨ゅｏ繧奇ｼ夂夢蜉ｴ・・憾諷狗焚蟶ｸ繧貞・蝗槫ｾｩ
    //    窶ｻ panic 縺ｯ迥ｶ諷狗焚蟶ｸ縺ｧ縺ｯ縺ｪ縺・・縺ｧ隗ｦ繧峨↑縺・    // ---------------------
    clearFatigueAndStatusesAtTurnEnd(s, who);
    logPush(s, "[" + who + "] ターン終了：疲労/状態異常を回復");

    // ---------------------
    // 5) 繧ｿ繝ｼ繝ｳ莠､莉｣
    // ---------------------
    const next = who === "A" ? "B" : "A";
    s.turn = next;
    s.turnSeq = Math.trunc(Number(s.turnSeq ?? 1)) + 1;

    // ターン進行後に期限切れバフを次ターン基準で消す。
    try {
      if (typeof expireTurnBuffsAll === "function") {
        expireTurnBuffsAll(s, s.turnSeq);
      }
    } catch {}

    // ターン開始時の状態異常処理。
    try {
      const poisonLogs = [];
      const units = Array.isArray(s.units) ? s.units : [];
      for (const u of units) {
        if (!u) continue;
        if (normSeat(u.owner) !== next) continue;
        try {
          if (!isAlive(u)) continue;
        } catch {
          if (Number(u.hp) <= 0 || !!u.panic) continue;
        }
        applyPoisonOnTurnStartAdapter(u, s, next, poisonLogs);
      }
      for (const ln of poisonLogs) logPush(s, ln);
    } catch {}

    const wPoison = checkWinLocal(s);
    if (wPoison) {
      s.winner = wPoison;
      logPush(s, "勝者：" + wPoison);
      tx.set(stateRef, s, { merge: true });
      return;
    }

    // ターン開始時フィールド処理。
    try {
      ensureFieldState(s, W, H, s.fieldId ?? s.field?.id ?? fieldIdFromUrl);
      applyFieldOnTurnStart?.({ s, who: next, W, H, logPush });
    } catch {}

    const releasedLocks = releaseHandLocksAtTurnStart(s, next);
    if (releasedLocks > 0) {
      logPush(s, "[" + next + "] 伏せカード解除：" + releasedLocks + "件");
    }

    // 受け手のマナ+2（仕様通り max=cur）
    s.mana = gainManaPlus2OnReceiveTurn(s.mana, next);

    // 受け手のドロー
    try {
      safeDrawCards(s, next, DRAW_PER_TURN);
    } catch {}

    fireTurnStartCardEffects(s, next);

    logPush(s, "--- " + next + "ターン ---");

    // 終了時点での勝利判定
    const w1 = checkWinLocal(s);
    if (w1) {
      s.winner = w1;
      logPush(s, "勝者：" + w1);
    }

    tx.set(stateRef, s, { merge: true });
    changed = true;
  });

  return changed;
}

async function endTurn() {
  return endTurnForSeat(seat);
}

// =====================
// 繝｢繝ｼ繝牙挨・壹け繝ｪ繝・け譎ゅ・霑ｽ蜉蜃ｦ逅・ｼ磯ｲ蛹悶・繝ｼ繧ｹ驕ｸ謚槭↑縺ｩ・・// =====================
function onUnitClickedForMode(u, st) {
  if (!u || !st) return;

  if (
    mode === "evolve" &&
    canControl(st) &&
    u.owner === seat &&
    !isPanic(u) &&
    Number(u.hp) > 0
  ) {
    evolveSys.onPickBaseUnit(u, st);
    render(st);
    return;
  }
}

function actAllowsAllyTarget(act) {
  if (!act) return false;

  const { hpDelta, spDelta } = getActDeltas(act);
  if (hpDelta > 0 || spDelta > 0) return true;

  const list = addStatusListFromAny(act?.addStatus);

  // 状態異常名を表示用に整える。
  const allyish = new Set([
    "aim",
    "hitUp",
    "命中",
    "powerUp",
    "power",
    "armor",
    "装甲",
    "cleanse",
    "状態異常クリア",
    "recoverFatigue",
    "疲労回復",
    "recoverMove",
    "moveReset",
    "refreshMove",
    "移動回復",
    "移動回数回復",
    "evade",
    "蝗樣∩",
  ]);
  if (list.some((s) => allyish.has(String(s || "").trim()))) return true;

  const tags = tagMapFromAny(act?.tags);
  const t = String(act?.target ?? tags?.target ?? "")
    .trim()
    .toLowerCase();
  if (t === "ally" || t === "any") return true;

  return false;
}

const _oldOnCellClick = onCellClick;
onCellClick = function (x, y) {
  const st = currentState;
  if (!st) return;

  const u = unitAt(st, x, y);
  if (u) {
    try {
      onUnitClickedForMode(u, st);
    } catch {}
  }
  return _oldOnCellClick(x, y);
};

// =====================
// Log render
// =====================
function renderLog(st) {
  if (!logEl) return;
  const lines = Array.isArray(st?.log) ? st.log : [];
  const compactLog = window.matchMedia?.("(max-width: 760px)")?.matches;
  const tail = lines.slice(compactLog ? -8 : -30).reverse();

  const extra = [];
  if (nowMs() < rngMsgUntil) extra.push("乱数調整中");

  logEl.textContent = extra.concat(tail).join("\n");
}

function prettyEffect(eff) {
  if (!eff) return "";
  if (typeof eff === "string") {
    const s = eff.trim();
    if (!s) return "";
    try {
      eff = JSON.parse(s);
    } catch {
      return s;
    }
  }
  if (typeof eff !== "object") return String(eff);

  const t = String(eff.type || eff.kind || eff.action || "").toLowerCase();
  const rate = eff.rate !== undefined ? "成功" + eff.rate + "%" : "";
  const target = eff.target ? "対象:" + eff.target : "";
  const tag = eff.tag ? "タグ:" + eff.tag : "";
  const join = (...xs) => xs.filter(Boolean).join(" / ");

  switch (t) {
    case "draw":
      return join("ドロー", eff.n ? "+" + eff.n + "枚" : "", rate, target);
    case "heal":
      return join("回復", eff.hp ? "HP+" + eff.hp : "", eff.sp ? "SP+" + eff.sp : "", rate, target);
    case "dmg":
    case "damage":
      return join("ダメージ", eff.hp ? "HP-" + eff.hp : "", eff.sp ? "SP-" + eff.sp : "", rate, target);
    case "modrate":
      return join("成功率補正", eff.delta !== undefined ? (eff.delta > 0 ? "+" : "") + eff.delta + "%" : "", rate, target);
    case "addstatus":
    case "status":
      return join("状態付与", eff.name || eff.status || "", eff.turn ? eff.turn + "T" : "", rate, target, tag);
    case "moveto":
      return join("移動", eff.to !== undefined ? "to:" + eff.to : "", rate, target);
    case "recover":
    case "rest":
      return join("回復(行動回数/疲労)", eff.delta !== undefined ? (eff.delta > 0 ? "+" : "") + eff.delta : "", rate, target);
    default: {
      const compact = Object.keys(eff)
        .filter((k) => k !== "type")
        .slice(0, 8)
        .map((k) => k + ":" + String(eff[k]));
      return join("効果:" + (eff.type || "?"), compact.join(" / "));
    }
  }
}

function applyFieldThemeToBody(fieldId) {
  const fid = String(fieldId || "grass").toLowerCase();
  document.body.classList.remove("field-grass", "field-danger", "field-swamp");
  document.body.classList.add("field-" + fid);
}

async function executeMove(unitId, to) {
  selectedUnitId = unitId;
  mode = "move";
  await onCellClick(to.x, to.y);
}

async function executeAttack(attackerId, actionIndex, targetId) {
  selectedUnitId = attackerId;
  selectedActionIndex = actionIndex;
  selectedTargetId = targetId;
  await execAttack(currentState);
}

async function finishCpuTurn() {
  const actor = cpuSeat || (seat === "A" ? "B" : "A");
  return endTurnForSeat(actor);
}

function listCpuLegalAttacks(st, u) {
  if (!st || !u || Number(u.hp) <= 0 || isPanic(u) || u.fatigue) return [];
  const actor = normSeat(u.owner);
  const def = cardDefs?.[u.cardId] || {};
  const acts = Array.isArray(def.actions) ? def.actions : [];
  const out = [];

  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    if (!act) continue;
    const flags = actFlags(act);

    if (isSelfRange(act.range)) {
      out.push({ attackerId: u.id, actionIndex: i, targetId: u.id, targets: [u.id] });
      continue;
    }

    if (flags.aoe) {
      const targets = listTargetsForAoe(st, u, act).map((t) => t.id);
      if (targets.length) out.push({ attackerId: u.id, actionIndex: i, targetId: targets[0], targets });
      continue;
    }

    for (const t of st.units || []) {
      if (!t || Number(t.hp) <= 0) continue;
      if (normSeat(t.owner) === actor) continue;
      if (!inActionRange(u, t.x, t.y, act.range)) continue;
      if (!flags.pierce && isLineBlocked(st.units || [], u, t)) continue;
      out.push({ attackerId: u.id, actionIndex: i, targetId: t.id, targets: [t.id] });
    }
  }

  return out;
}

async function executeCpuMove(actorSeat, unitId, toSnap) {
  const actor = normSeat(actorSeat);
  if (!actor || !unitId || !toSnap) return false;

  let didMove = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (normSeat(s.turn) !== actor || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    const me = s.units.find((u) => u && u.id === unitId) || null;
    if (!me || normSeat(me.owner) !== actor) return;
    if (Number(me.hp) <= 0 || isPanic(me) || isMoveBlockedByStatus(me)) return;

    const curSeq = Number(s.turnSeq ?? 1);
    const usedNow = Number(me.moveTurnSeq ?? 0) === curSeq ? Number(me.moveUsed ?? 0) : 0;
    if (usedNow >= 2) return;

    const txTo = { x: Math.trunc(Number(toSnap.x)), y: Math.trunc(Number(toSnap.y)) };
    if (!Number.isFinite(txTo.x) || !Number.isFinite(txTo.y)) return;
    if (txTo.x < 0 || txTo.x >= W || txTo.y < 0 || txTo.y >= H) return;
    if (Math.abs(txTo.x - me.x) + Math.abs(txTo.y - me.y) !== 1) return;
    if (unitAt(s, txTo.x, txTo.y)) return;

    const mana = normalizeMana(s.mana);
    if (mana?.[actor]?.cur < 1) return;

    const from = { x: me.x, y: me.y };
    let to = { ...txTo };
    try {
      ensureFieldState(s, W, H, s.fieldId ?? s.field?.id ?? fieldIdFromUrl);
      const r = applyFieldMoveRule({ s, who: actor, unit: me, from, to, W, H, round10, logPush });
      if (!r?.ok) {
        s.mana = spendManaMut(s.mana, actor, 1);
        me.moveTurnSeq = curSeq;
        me.moveUsed = usedNow + 1;
        logPush(s, "[" + actor + "] CPU move blocked: " + cardName(me.cardId));
        tx.set(stateRef, s, { merge: true });
        didMove = true;
        return;
      }
      to = r.to || to;
    } catch {}

    s.mana = spendManaMut(s.mana, actor, 1);

    const bleedLogLines = [];
    try {
      const bleedDmg = Number(applyBleedOnMove?.(me, s, actor) ?? 0);
      if (bleedDmg > 0) bleedLogLines.push("[" + actor + "] bleed: " + cardName(me.cardId) + " HP-" + Math.trunc(bleedDmg));
    } catch {}

    me.x = to.x;
    me.y = to.y;
    me.moveTurnSeq = curSeq;
    me.moveUsed = usedNow + 1;
    s.lastMove = {
      at: nowMs(),
      unitId: me.id,
      owner: actor,
      cardId: me.cardId,
      from,
      to: { x: me.x, y: me.y },
    };
    logPush(s, "[" + actor + "] CPU move: " + cardName(me.cardId) + " (" + from.x + "," + from.y + ") -> (" + to.x + "," + to.y + ")");

    try {
      applyFieldOnStepAfterMove({
        s,
        who: actor,
        unit: me,
        pos: { x: me.x, y: me.y },
        round10,
        clampUnitStats10,
        countKillIfNeeded,
        setPanicAndCountIfNeeded,
        logPush,
      });
    } catch {}

    if (crossedCenterTowardEnemy(me.owner, from.y, me.y)) {
      fireCardEffects(s, "onCrossCenter", me, { from, to: { x: me.x, y: me.y } });
    }

    if (Number(me.hp) <= 0) {
      const killer = actor === "A" ? "B" : "A";
      setPanicAndCountIfNeeded(me, killer, s.kills, bleedLogLines, "bleed");
      countKillIfNeeded(me, killer, s.kills, bleedLogLines, "bleed");
    }
    for (const ln of bleedLogLines) logPush(s, ln);

    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logPush(s, "Winner: " + w);
    }

    tx.set(stateRef, s, { merge: true });
    didMove = true;
  });

  return didMove;
}

async function executeCpuAttack(actorSeat, attackerId, actionIndex, targetId) {
  const actor = normSeat(actorSeat);
  if (!actor || !attackerId) return false;

  let didAttack = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (normSeat(s.turn) !== actor || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    const attacker = s.units.find((u) => u && u.id === attackerId) || null;
    if (!attacker || normSeat(attacker.owner) !== actor) return;
    if (Number(attacker.hp) <= 0 || isPanic(attacker) || attacker.fatigue) return;

    const def = cardDefs?.[attacker.cardId] || {};
    const acts = Array.isArray(def.actions) ? def.actions : [];
    const act = acts[Math.max(0, Math.trunc(Number(actionIndex ?? 0)))] || acts[0] || null;
    if (!act) return;

    if (!canUseActionByStatus(attacker, act)) {
      const cost = effectiveActionCost(attacker, act);
      const mana = normalizeMana(s.mana);
      if (mana?.[actor]?.cur < cost) return;
      s.mana = spendManaMut(s.mana, actor, cost);
      attacker.fatigue = true;
      logPush(s, "[" + actor + "] CPU action sealed: " + cardName(attacker.cardId));
      tx.set(stateRef, s, { merge: true });
      didAttack = true;
      return;
    }

    const cost = effectiveActionCost(attacker, act);
    const mana = normalizeMana(s.mana);
    if (mana?.[actor]?.cur < cost) return;

    const flags = actFlags(act);
    let targets = [];
    if (isSelfRange(act.range)) {
      targets = [attacker];
    } else if (flags.aoe) {
      targets = listTargetsForAoe(s, attacker, act);
    } else {
      const t = s.units.find((u) => u && u.id === targetId) || null;
      if (!t || Number(t.hp) <= 0) return;
      if (!inActionRange(attacker, t.x, t.y, act.range)) return;
      if (!flags.pierce && isLineBlocked(s.units, attacker, t)) return;
      targets = [t];
    }
    if (!targets.length) return;

    s.mana = spendManaMut(s.mana, actor, cost);

    const rate = calcHitRateAdapter(attacker, act);
    const rr = rollHit(rate);
    const isCrit = rr.r <= CRIT_ROLL_MAX;
    const isFumble = rr.r >= FUMBLE_ROLL_MIN;
    const actName = String(act.name ?? "action");
    const label = cardName(attacker.cardId) + ":" + actName;
    const logLines = [];
    const attackFxFrom = { x: attacker.x, y: attacker.y };
    const attackFxTo =
      targets.length === 1 && targets[0]
        ? { x: targets[0].x, y: targets[0].y }
        : attackFxFrom;

    s.lastRoll = { at: nowMs(), r: rr.r, rate, hit: rr.hit, actionName: actName };

    if (!rr.hit) {
      const rageDmg = Number(applyRageFailurePenalty?.(attacker) ?? 0);
      if (rageDmg > 0) {
        clampUnitStats10(attacker);
        logLines.push("[" + actor + "] rage recoil: " + cardName(attacker.cardId) + " HP-" + rageDmg);
        s.lastHit = {
          at: nowMs(),
          attackerId: attacker.id,
          targetId: attacker.id,
          from: attackFxFrom,
          to: attackFxFrom,
          items: [{ kind: "HP", delta: -rageDmg }],
        };
        const rageKiller = actor === "A" ? "B" : "A";
        setPanicAndCountIfNeeded(attacker, rageKiller, s.kills, logLines, "rage");
        if (Number(attacker.hp) <= 0) countKillIfNeeded(attacker, rageKiller, s.kills, logLines, "rage");
      }
      if (isFumble) {
        const { hpDelta, spDelta } = getActDeltas(act);
        if (hpDelta < 0) attacker.hp = round10(Number(attacker.hp) - applyArmorAdapter(attacker, applyPowerUpAdapter(attacker, Math.abs(hpDelta), act)));
        if (spDelta < 0) attacker.sp = round10(Number(attacker.sp) - Math.abs(spDelta));
        clampUnitStats10(attacker);
        const killer = actor === "A" ? "B" : "A";
        setPanicAndCountIfNeeded(attacker, killer, s.kills, logLines, "fumble");
        if (Number(attacker.hp) <= 0) countKillIfNeeded(attacker, killer, s.kills, logLines, "fumble");
      }
      attacker.fatigue = true;
      logLines.push("[" + actor + "] CPU attack miss: " + label + " (" + rr.r + "/" + rate + ")");
    } else {
      const { hpDelta, spDelta } = getActDeltas(act);
      const hitItems = [];
      const counterItems = [];
      for (const t of targets) {
        if (!t || Number(t.hp) <= 0) continue;
        const hasIncomingDamage = hpDelta < 0 || spDelta < 0;
        const damageBlockedByTaiman =
          hasIncomingDamage &&
          t.id !== attacker.id &&
          typeof isTaimanDamageAllowed === "function" &&
          !isTaimanDamageAllowed(t, attacker);
        if (damageBlockedByTaiman) {
          logLines.push("  → タイマン：" + cardName(t.cardId) + " は正面の敵以外からのダメージを受けない");
        }
        const assistBlocked =
          typeof blocksAssist === "function" &&
          typeof isAssistAction === "function" &&
          blocksAssist(t) &&
          isAssistAction(act);
        let assistBlockLogged = false;
        const logAssistBlocked = () => {
          if (assistBlockLogged) return;
          assistBlockLogged = true;
          logLines.push("  → 失魂：" + cardName(t.cardId) + " は補助効果を受けない");
        };
        const countered =
          hasIncomingDamage &&
          !damageBlockedByTaiman &&
          t.id !== attacker.id &&
          !!checkCounter?.(t, () => Math.random());
        if (countered) {
          const retDmg = 10;
          attacker.hp = round10(Number(attacker.hp) - retDmg);
          clampUnitStats10(attacker);
          counterItems.push({ kind: "HP", delta: -retDmg });
          logLines.push("[" + actor + "] counter: " + cardName(t.cardId) + " -> " + cardName(attacker.cardId) + " HP-" + retDmg);
          const killer = normSeat(t.owner);
          setPanicAndCountIfNeeded(attacker, killer, s.kills, logLines, "counter");
          if (Number(attacker.hp) <= 0) countKillIfNeeded(attacker, killer, s.kills, logLines, "counter");
          continue;
        }
        if (hpDelta < 0) {
          if (!damageBlockedByTaiman) {
            let dmg = applyPowerUpAdapter(attacker, Math.abs(hpDelta), act);
            if (isCrit) dmg *= 2;
            dmg = applyArmorAdapter(t, dmg);
            t.hp = round10(Number(t.hp) - dmg);
            hitItems.push({ kind: "HP", delta: -dmg });
          }
        } else if (hpDelta > 0) {
          if (assistBlocked) logAssistBlocked();
          else {
            t.hp = round10(Number(t.hp) + hpDelta);
            hitItems.push({ kind: "HP", delta: hpDelta });
          }
        }
        if (spDelta < 0) {
          if (!damageBlockedByTaiman) {
            const dmgSp = Math.abs(spDelta) * (isCrit ? 2 : 1);
            t.sp = round10(Number(t.sp) - dmgSp);
            hitItems.push({ kind: "SP", delta: -dmgSp });
          }
        } else if (spDelta > 0) {
          if (assistBlocked) logAssistBlocked();
          else {
            t.sp = round10(Number(t.sp) + spDelta);
            hitItems.push({ kind: "SP", delta: spDelta });
          }
        }

        const nextAttr = getActChangeAttr(act);
        if (nextAttr) {
          if (assistBlocked) logAssistBlocked();
          else {
            const beforeAttr = applyBattleAttrChange(t, nextAttr);
            hitItems.push({ kind: "ATTR", delta: `${beforeAttr || "?"}->${nextAttr}` });
            logLines.push("  ATTR " + cardName(t.cardId) + " " + (beforeAttr || "?") + " -> " + nextAttr);
          }
        }

        if (assistBlocked) logAssistBlocked();
        else applyBonusEffects({ attacker, target: t, act, rollR: rr.r, logLines });
        clampUnitStats10(t);
        if (assistBlocked) {
          logAssistBlocked();
        } else {
          try {
            applyStatusesOnHitAdapter(t, act, Number(s.turnSeq ?? 1));
          } catch {}
          applyActAddStatusDirect({ s, attacker, target: t, act, logLines });
        }

        const kb = getKnockbackDistFromAct?.(act) ?? 0;
        if (kb > 0) {
          const r = applyKnockback?.(s, attacker, t, kb);
          if (r?.moved > 0) logLines.push("  knockback " + r.moved);
        }

        setPanicAndCountIfNeeded(t, actor, s.kills, logLines);
        if (Number(t.hp) <= 0) countKillIfNeeded(t, actor, s.kills, logLines, "CPU attack");
      }

      if (hasAddStatusKey(act, "draw")) {
        const n = Math.max(1, getTagInt(act, "draw", 1));
        safeDrawCards(s, actor, n);
        logLines.push("  draw +" + n);
      }

      attacker.fatigue = true;
      const targetName = targets.length === 1 && targets[0] ? cardName(targets[0].cardId) : "targets:" + targets.length;
      logLines.push("[" + actor + "] CPU attack hit: " + label + " -> " + targetName);
      s.lastHit = {
        at: nowMs(),
        attackerId: attacker.id,
        targetId: counterItems.length ? attacker.id : targets[0]?.id ?? null,
        from: attackFxFrom,
        to: counterItems.length ? attackFxFrom : attackFxTo,
        items: (counterItems.length ? counterItems : hitItems).slice(0, 6),
      };
    }

    normalizePanicForAll(s.units, s.kills, logLines);
    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logLines.push("Winner: " + w);
    }
    for (const ln of logLines) logPush(s, ln);
    tx.set(stateRef, s, { merge: true });
    didAttack = true;
  });

  return didAttack;
}

// =====================
// Evolve confirm button (above detail)
// =====================
let evolveConfirmBtn = null;

function ensureEvolveConfirmBtn() {
  if (evolveConfirmBtn) return evolveConfirmBtn;

  const right = document.getElementById("rightPane");
  if (!right) return null;

  const titles = [...right.querySelectorAll(".paneTitle")];
  const detailTitle = titles.find((el) => el.textContent?.includes("詳細"));
  if (!detailTitle) return null;

  const btn = document.createElement("button");
  btn.id = "evolveConfirmBtn";
  btn.type = "button";
  btn.textContent = "進化確定";
  btn.style.margin = "8px 0 6px";
  btn.style.width = "100%";
  btn.style.borderRadius = "12px";
  btn.style.padding = "10px 12px";
  btn.style.border = "1px solid #666";
  btn.style.background = "#2a2a2a";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", async () => {
    const st = currentState;
    if (!st) return;
    if (!canControl(st)) return;
    if (mode !== "evolve") return;
    if (selectedHandIndex == null) return;
    if (isHandCardLocked(st, selectedHandIndex, seat)) return;

    try {
      if (!evolveSys.canExec(st, selectedHandIndex)) return;
      await evolveSys.execEvolveFromHandIndex(selectedHandIndex);
    } catch (e) {
      console.warn("[evolve confirm] failed", e);
    }
  });

  // 隧ｳ邏ｰ繧ｿ繧､繝医Ν縺ｮ逶ｴ蠕後↓蟾ｮ縺苓ｾｼ繧
  detailTitle.insertAdjacentElement("afterend", btn);
  evolveConfirmBtn = btn;
  return btn;
}

function updateEvolveConfirmBtn(st) {
  const btn = ensureEvolveConfirmBtn();
  if (!btn) return;

  // 陦ｨ遉ｺ譚｡莉ｶ・夐ｲ蛹悶Δ繝ｼ繝・& 閾ｪ蛻・・繧ｿ繝ｼ繝ｳ
  const show = !!st && mode === "evolve" && canControl(st);
  btn.style.display = show ? "block" : "none";

  if (!show) return;

  // 謚ｼ縺帙ｋ譚｡莉ｶ・啼volveSys縺ｮ蛻､螳壹↓螳悟・蟋比ｻｻ
  const ok =
    selectedHandIndex != null &&
    !isHandCardLocked(st, selectedHandIndex, seat) &&
    (() => {
      try {
        return evolveSys.canExec(st, selectedHandIndex);
      } catch {
        return false;
      }
    })();

  btn.disabled = !ok;
  btn.style.opacity = ok ? "1" : "0.5";
}

async function execCpuPlan(plan) {
  const actor = cpuSeat || (seat === "A" ? "B" : "A");

  if (!plan || plan.type === "end") {
    return finishCpuTurn();
  }

  if (plan.type === "move") {
    await executeCpuMove(actor, plan.unitId, plan.to);
    return finishCpuTurn();
  }

  if (plan.type === "attack") {
    await executeCpuAttack(actor, plan.attackerId, plan.actionIndex, plan.targetId);
    return finishCpuTurn();
  }

  if (plan.type === "support") {
    await executeSupport(plan);
    return finishCpuTurn();
  }

  return finishCpuTurn();
}

// =====================
// Main render
// =====================

// =====================
// Buttons bind
// =====================
async function execSelectedHandEvolve(st = currentState, index = selectedHandIndex) {
  if (!st) return false;
  if (!canControl(st)) return false;
  if (index == null) return false;
  if (isHandCardLocked(st, index, seat)) return false;
  setMode("evolve");
  selectedHandIndex = index;
  if (!evolveSys.canExec(st, index)) return false;
  await evolveSys.execEvolveFromHandIndex(index);
  return true;
}

btnDoEvolve &&
  btnDoEvolve.addEventListener("click", async () => {
    await execSelectedHandEvolve(currentState, selectedHandIndex);
  });

btnEnd && btnEnd.addEventListener("click", () => endTurn());
exBtnEl && exBtnEl.addEventListener("click", () => execEx());

// =====================
// UI install (split step-1)
// =====================
const ui = createGameUI({
  // left pane / log / fx
  setTurnUI,
  renderLog,
  fxOnHit,

  actFlags,
  isSelfRange,
  actAllowsAllyTarget,

  W,
  H,
  dom: { boardEl, handEl, actionPickerEl, detailEl },

  // styles
  ensureHandCss,
  ensureActionPickerCss,
  ensureBoardUnitCss,
  ensureBoardAssistCss,
  hexToRgba,
  typeColorStrong,
  typeColorSoft,

  // state/selection
  getSeat: () => seat,
  getMode: () => mode,
  setMode,
  canControl,

  getSelectedUnitId: () => selectedUnitId,
  getSelectedTargetId: () => selectedTargetId,
  setSelectedTargetId: (v) => {
    selectedTargetId = v;
  },

  getSelectedHandIndex: () => selectedHandIndex,
  setSelectedHandIndex: (v) => {
    selectedHandIndex = v;
  },
  isHandCardLocked,

  getSelectedActionIndex: () => selectedActionIndex,
  setSelectedActionIndex: (v) => {
    selectedActionIndex = v;
  },

  // card
  cardDefsRef: () => cardDefs,
  cardName,
  shortLabel,
  isSupportCard,

  // view/click
  toModelXY,
  toViewXY,
  onCellClickView,

  // board helpers
  unitAt,
  isEmptyCell,
  inSummonAreaForSeat,
  buildRangeMap,
  buildSupportMap,
  round10,
  statusIconsText,
  statusIconsHtml,
  normalizeFieldId,

  // detail
  showCardDetail,
  selectedIsSupport,
  actionDetailPartsJa:
    (typeof window !== "undefined" && window.actionDetailPartsJa) || null,
  actionSpecialTextJa:
    (typeof window !== "undefined" && window.actionSpecialTextJa) || null,

  // actionPicker deps
  getSelectedUnit,
  getSelectedTarget,
  ensureSelectedActionIndex,
  actRangeLabel,
  calcHitRateAdapter,
  selectedHandDef,
  selectedHandCardId,
  supportPlan,
  supportReadyByPlan,
  supportRateText,
  supportTargetText,
  supportHintText,
  supportSearchOptions,
  getSupportSearchCardId: () => supportSearchCardId,
  setSupportSearchCardId: (v) => {
    supportSearchCardId = String(v || "");
  },
  resetSupportPicks,
  normalizeMana,
  getActionChoices: unitActionChoices,
  getActionCost: effectiveActionCost,
  execAttack,
  execSupport,
  isPanic,

  // evolve hand decoration
  evolveDecorateHandCard: (args) => evolveSys.decorateHandCard(args),
  execSelectedHandEvolve,
  canSelectedHandEvolve: (st, index) => {
    try {
      if (evolveSys?.canExec?.(st, index)) return true;
  if (!st || !canControl(st)) return false;
  if (index == null) return false;
  if (isHandCardLocked(st, index, seat)) return false;

      const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
      const evoCardId = hand[index];
      const evoDef = evoCardId ? cardDefs?.[evoCardId] : null;
      if (!evoDef || isSupportCard(evoDef)) return false;

      const base = selectedUnitId
        ? (Array.isArray(st.units) ? st.units : []).find((u) => u?.id === selectedUnitId)
        : null;
      if (!base || base.owner !== seat) return false;
      if (Number(base.hp) <= 0 || isPanic(base)) return false;

      const baseDef = cardDefs?.[base.cardId];
      if (!baseDef) return false;
      if (normalizeBattleAttr(evoDef.type ?? evoDef.attr ?? "") !== normalizeBattleAttr(baseDef.type ?? baseDef.attr ?? "")) return false;
      if (!(Number(evoDef.cost) > Number(baseDef.cost))) return false;

      const extra = Math.max(
        0,
        Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)),
      );
      const mana = normalizeMana(st.mana);
      if ((mana?.[seat]?.cur ?? 0) < extra) return false;

      evolveSys?.onPickBaseUnit?.(base, st);
      return !!evolveSys?.canExec?.(st, index);
    } catch {
      return false;
    }
  },
});

function trackDopagakiBattleEvents(st) {
  const dopa = window.TCGDopagaki;
  let fired = false;
  const kills = {
    A: Math.trunc(Number(st?.kills?.A ?? 0) || 0),
    B: Math.trunc(Number(st?.kills?.B ?? 0) || 0),
  };
  let infil = { A: 0, B: 0 };
  try {
    infil = calcInfilNow(st);
    infil.A = Math.trunc(Number(infil.A ?? 0) || 0);
    infil.B = Math.trunc(Number(infil.B ?? 0) || 0);
  } catch {}

  const evolveAt = Math.trunc(Number(st?.lastEvolve?.at ?? 0) || 0);
  if (!dopaEventReady) {
    lastDopaEvolveAt = evolveAt;
    lastDopaScore = { kills, infil };
    dopaEventReady = true;
    return false;
  }

  if (evolveAt && evolveAt !== lastDopaEvolveAt) {
    lastDopaEvolveAt = evolveAt;
    dopa?.evolve?.({
      label: "EVOLVE!!",
      owner: st?.lastEvolve?.owner,
      cardId: st?.lastEvolve?.to,
    });
    fired = true;
  }

  const prev = lastDopaScore || { kills: { A: 0, B: 0 }, infil: { A: 0, B: 0 } };
  for (const who of ["A", "B"]) {
    if (kills[who] > Math.trunc(Number(prev.kills?.[who] ?? 0) || 0)) {
      dopa?.score?.("kill", { owner: who, current: kills[who], max: WIN_KILL_COUNT });
      fired = true;
    }
    if (infil[who] > Math.trunc(Number(prev.infil?.[who] ?? 0) || 0)) {
      dopa?.score?.("infil", { owner: who, current: infil[who], max: WIN_INFIL_COUNT });
      fired = true;
    }
  }
  lastDopaScore = { kills, infil };
  return fired;
}

render = (st) => {
  currentState = st;

  const t = normSeat(st.turn);
  if (t && (t !== lastSeenTurn || st.turnSeq !== lastSeenTurnSeq)) {
    if (t === seat) flashTurnBanner();
    lastSeenTurn = t;
    lastSeenTurnSeq = st.turnSeq;
    if (t !== seat) {
      selectedTargetId = null;
      resetSupportPicks();
    }
  }

  ui.render(st);
  renderCardPreview(st);
  renderGraveyardUi(st);
};

async function recordCurrentPlayerMatchHistory(st, winnerSeat) {
  try {
    const ps = await getDoc(playerRef(playerId));
    const pd = ps.exists() ? (ps.data() || {}) : {};
    const deck = pd.deck && typeof pd.deck === "object" ? pd.deck : {};
    const deckCount = Object.values(deck).reduce((a, b) => {
      const n = Math.trunc(Number(b || 0));
      return a + (Number.isFinite(n) ? Math.max(0, n) : 0);
    }, 0);
    const inf = calcInfilNow(st);
    const startedAtMs = Math.trunc(Number(st?.startedAtMs || 0));
    const endedAtMs = Date.now();
    const durationMs = startedAtMs > 0 ? Math.max(0, endedAtMs - startedAtMs) : 0;
    const result = seat === winnerSeat ? "win" : "lose";

    await recordMatchResult({
      uid: pd.uid || "",
      roomId,
      playerId,
      seat,
      winner: winnerSeat,
      result,
      reason: isSoloMode ? "solo" : "match",
      turnSeq: Math.trunc(Number(st?.turnSeq ?? 0) || 0),
      kills: Math.trunc(Number(st?.kills?.[seat] ?? 0) || 0),
      infil: Math.trunc(Number(inf?.[seat] ?? 0) || 0),
      deckTitle: pd.deckTitle || "",
      deckCount,
      mode: isSoloMode ? "solo" : "versus",
      startedAtMs,
      endedAtMs,
      durationMs,
    });
  } catch (e) {
    console.warn("[match history] failed", e);
  }
}

// =====================
// Snapshot
// =====================
onSnapshot(
  stateRef,
  async (snap) => {
    const st = snap.data() || {};

    st.units = Array.isArray(st.units) ? st.units : [];
    st.hands = st.hands || { A: [], B: [] };
    st.decks = st.decks || { A: [], B: [] };
    normalizeDiscardsObj(st);
    st.kills =
      st.kills && typeof st.kills === "object" ? st.kills : { A: 0, B: 0 };
    ensureInfilObj(st);

    try {
      ensureFieldState(st, W, H, st.fieldId ?? st.field?.id ?? fieldIdFromUrl);
    } catch {}

    if (!st.ex) st.ex = { A: null, B: null };
    if (!st.exUsed) st.exUsed = { A: false, B: false };

    const dopaEventFired = trackDopagakiBattleEvents(st);

    try {
      const w = normSeat(st?.winner);
      if (!didGoVictory && w && roomId && playerId && seat) {
        didGoVictory = true;
        await recordCurrentPlayerMatchHistory(st, w);
        const inf = calcInfilNow(st);
        const ka = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
        const kb = Math.trunc(Number(st?.kills?.B ?? 0) || 0);

        const qs = new URLSearchParams();
        qs.set("room", roomId);
        qs.set("player", playerId);
        qs.set("seat", seat);
        qs.set("winner", w);
        qs.set("turnSeq", String(Math.trunc(Number(st?.turnSeq ?? 0) || 0)));
        qs.set("killsA", String(ka));
        qs.set("killsB", String(kb));
        qs.set("infilA", String(Math.trunc(Number(inf?.A ?? 0) || 0)));
        qs.set("infilB", String(Math.trunc(Number(inf?.B ?? 0) || 0)));
        qs.set("returnTo", "deck.html?room=" + encodeURIComponent(roomId) + "&player=" + encodeURIComponent(playerId));

        const nextUrl = "victory.html?" + qs.toString();
        if (dopaEventFired && window.TCGDopagaki?.isOn?.()) {
          setTimeout(() => {
            location.href = nextUrl;
          }, 1100);
        } else {
          location.href = nextUrl;
        }
        return;
      }
    } catch (e) {
      console.warn("[victory redirect] failed", e);
    }

    // 先に描画する。
    render(st);

    try {
      const ls = st?.lastSupportRoll;
      const enemySeat = seat === "A" ? "B" : "A";

      if (
        ls &&
        Number(ls.at) > 0 &&
        Number(ls.at) !== Number(lastEnemySupportToastAt) &&
        normSeat(st.turn) === seat
      ) {
        // 逶ｸ謇九ち繝ｼ繝ｳ荳ｭ縺ｫ譖ｴ譁ｰ縺輔ｌ縺・support roll 繧帝夂衍蟇ｾ雎｡縺ｫ縺吶ｋ
        lastEnemySupportToastAt = Number(ls.at);

        const logLines = Array.isArray(st?.log) ? st.log : [];
        const latestSupportLine =
          [...logLines]
            .reverse()
            .find(
              (line) =>
                typeof line === "string" &&
                line.includes("[" + enemySeat + "] Support"),
            ) || "";

        let detailText = "";
        if (latestSupportLine) {
          detailText = latestSupportLine.replace(/^\[[AB]\]\s*/, "");
        } else {
          detailText = (ls.cardName || "サポート") + " / " + (ls.label || (ls.ok ? "成功" : "失敗"));
        }

        showEnemySupportToast({
          title: "相手がサポート使用：" + (ls.cardName || "不明"),
          body: (ls.ok ? "結果：成功" : "結果：失敗") + "\n" + detailText,
          ok: !!ls.ok,
        });
      }
    } catch (e) {
      console.warn("[enemy support toast] failed", e);
    }

    // CPUはソロモードのみ動かす。
    try {
      if (cpuDriver && cpuSeat && isSoloMode) {
        cpuDriver.tick(st, {
          cpuSeat,
          execCpuPlan,
          helpers: { listLegalAttacks: listCpuLegalAttacks },
        });
      }
    } catch (e) {
      console.warn("[cpuDriver.tick] failed", e);
    }
  },
  (err) => {
    console.error("[onSnapshot] error", err);
    if (logEl) logEl.textContent = String(err?.message ?? err);
  },
);
