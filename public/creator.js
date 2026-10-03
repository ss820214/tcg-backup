// public/creator.js
// v20260726_actions_canonical1

import { db } from "./auth.js?v=20260627_perm1";
import { ensureUserProfile } from "./user_store.js?v=20260723_starter_series1";
import { cardArtImgHtml } from "./card_art.js?v=20260828_jewel_art1";
import { FAIRY_TALE_CARD_LIST } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { JEWEL_CARD_LIST } from "./jewel_cards.js?v=20260828_jewel_art1";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const LOCAL_SKILLS_KEY = "tcg_creator_skills_v1";
const LOCAL_CARDS_KEY = "tcg_creator_cards_v1";
const LOCAL_THEME_KEY = "tcg_creator_theme_v1";
const LOCAL_THEME_TEMPLATES_KEY = "tcg_creator_theme_templates_v1";
const LOCAL_SYNC_QUEUE_KEY = "tcg_creator_sync_queue_v1";
const CREATOR_SKILL_DECK_PREFIX = "creator_skill_";

const state = {
  uid: "",
  isAdmin: false,
  tab: "card",
  skills: new Map(),
  cards: new Map(),
  selectedSkills: [],
  cardSearch: "",
  skillSearch: "",
  actionSearch: "",
  editingCardId: "",
  editingCardCollection: "",
  editingCardSource: "",
  editingSkillOrigin: null,
  editingSupportEffectRaw: null,
  supportEffectDirty: false,
  publicActionCount: 0,
  rangeDir: "front",
  cardEffects: [],
  syncing: false,
};

const ATTRS = new Set(["火", "水", "雷", "草", "風", "鋼", "光", "闇", "幻", "呪"]);
const ATTR_COLORS = {
  火: "#ff6b6b",
  水: "#7dd3fc",
  雷: "#facc15",
  草: "#78e3ad",
  風: "#9de7c5",
  鋼: "#b8c0cc",
  光: "#ffe29b",
  闇: "#b889ff",
  幻: "#f0abfc",
  呪: "#c084fc",
};
const ATTR_TRAITS = {
  火: "高火力と反動。HPを削る圧で勝つ。",
  水: "耐久とSP操作。長期戦が得意。",
  雷: "命中補正と展開。テンポを取りやすい。",
  草: "回復と状態異常。じわじわ盤面を作る。",
  風: "移動と回避。位置取りで勝つ。",
  鋼: "防御と反撃。正面戦闘に強い。",
  光: "安定感と支援。失敗しにくい。",
  闇: "妨害とリスク。相手の計画を崩す。",
  幻: "ランダムとコンボ。上振れで突破する。",
  呪: "SP攻撃と呪圧。火力と耐久は控えめ。",
};
const ROLE_LABELS = {
  balanced: "バランス",
  aggro: "速攻",
  control: "妨害",
  sustain: "耐久",
  combo: "コンボ",
};
const CARD_EFFECT_TRIGGERS = {
  onEnter: "場に出た時",
  onSummon: "召喚時",
  onEvolve: "進化時",
  onTurnStart: "自分ターン開始時",
  onOwnFieldTurnStart: "自陣にいる時",
  onEnemyFieldTurnStart: "敵陣にいる時",
  onCrossCenter: "中央線突破時",
};
const CARD_EFFECT_TYPES = {
  heal: "回復",
  dmg: "ダメージ",
  draw: "ドロー",
  manaUp: "マナ増加",
  addStatus: "状態付与",
  powerUp: "威力強化",
  modRate: "命中補正",
  cleanse: "状態異常クリア",
};
const CARD_EFFECT_TARGETS = {
  self: "自身",
  allies: "味方全体",
  enemies: "敵全体",
  randomEnemy: "ランダム敵",
  randomAlly: "ランダム味方",
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function text(id) {
  return String($(id)?.value ?? "").trim();
}

function num(id, fallback = 0) {
  const n = Number($(id)?.value ?? fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function seriesSource(series, fallback = "creator") {
  const value = String(series || "").trim();
  if (value === "初期") return "starter_creator";
  if (value === "時織") return "tokiori_creator";
  if (value === "童話") return "fairy_creator";
  if (value === "ガチャ") return "creator";
  return fallback || "creator";
}

function syncSeriesPreset() {
  const preset = $("seriesPreset");
  if (!preset) return;
  const value = text("series") || "ガチャ";
  const known = ["ガチャ", "初期", "時織", "童話"].includes(value);
  preset.value = known ? value : "カスタム";
}

function setSeriesValue(value) {
  const input = $("series");
  if (input) input.value = value || "ガチャ";
  syncSeriesPreset();
}

function setMsg(id, message, ok = true) {
  const el = $(id);
  if (!el) return;
  el.textContent = message || "";
  el.className = `msg ${ok ? "" : "bad"}`;
}

function normalizeId(value, prefix = "card") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-:.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || `${prefix}_${Date.now().toString(36)}`;
}

function slug(value, fallback = "theme") {
  const raw = String(value || "").trim().toLowerCase();
  const roman = raw
    .replace(/[火]/g, "fire")
    .replace(/[水]/g, "water")
    .replace(/[雷]/g, "thunder")
    .replace(/[草]/g, "grass")
    .replace(/[風]/g, "wind")
    .replace(/[鋼]/g, "steel")
    .replace(/[光]/g, "light")
    .replace(/[闇]/g, "dark")
    .replace(/[幻]/g, "dream")
    .replace(/[呪]/g, "curse");
  return normalizeId(roman, fallback).toLowerCase();
}

function safeJson(raw, fallback = {}) {
  const s = String(raw || "").trim();
  if (!s) return fallback;
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (e) {
    throw new Error(`JSONが正しくありません: ${e.message}`);
  }
}

function localSkills() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SKILLS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSkills() {
  try {
    localStorage.setItem(LOCAL_SKILLS_KEY, JSON.stringify([...state.skills.values()]));
  } catch {}
}

function localCards() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CARDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCards() {
  try {
    localStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify([...state.cards.values()]));
  } catch {}
}

function syncQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SYNC_QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue) {
  try {
    localStorage.setItem(LOCAL_SYNC_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
  } catch {}
  renderSyncStatus();
}

function localThemeTemplates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_THEME_TEMPLATES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
}

function saveLocalThemeTemplates(list) {
  try {
    localStorage.setItem(LOCAL_THEME_TEMPLATES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch {}
}

function queueKey(item) {
  return `${item?.kind || ""}:${item?.collection || ""}:${item?.id || ""}`;
}

function enqueueSync(item) {
  const now = new Date().toISOString();
  const next = {
    ...item,
    queuedAt: item.queuedAt || now,
    updatedAtClient: now,
    tries: Number(item.tries || 0),
  };
  const key = queueKey(next);
  const queue = syncQueue().filter((x) => queueKey(x) !== key);
  queue.push(next);
  saveSyncQueue(queue);
  return next;
}

function removeQueuedSync(match) {
  const queue = syncQueue();
  const next = queue.filter((item) => !match(item));
  if (next.length !== queue.length) saveSyncQueue(next);
}

function applyQueuedItemsToState() {
  let touchedCards = false;
  for (const item of syncQueue()) {
    if (item.kind === "skill" && item.payload?.id) {
      state.skills.set(item.payload.id, {
        ...item.payload,
        cloudScope: "queued",
        source: item.payload.source || "creator_queued",
      });
    } else if (item.kind === "card" && item.payload?.id) {
      const col = item.collection || item.options?.collection || collectionForKind(item.payload.kind);
      state.cards.set(item.payload.id, {
        ...item.payload,
        _cloudCollection: col,
        _syncQueued: true,
      });
      touchedCards = true;
    }
  }
  if (touchedCards) saveLocalCards();
}

function onlineStateText() {
  if (typeof navigator === "undefined") return "状態不明";
  return navigator.onLine ? "オンライン" : "オフライン";
}

function renderSyncStatus() {
  const el = $("syncStatus");
  if (!el) return;
  const queue = syncQueue();
  el.textContent = `${onlineStateText()} / 未同期 ${queue.length}件`;
  el.className = `syncStatus ${queue.length ? "warn" : "ok"}`;
  const btn = $("btnSyncNow");
  if (btn) btn.disabled = state.syncing || queue.length === 0 || (typeof navigator !== "undefined" && navigator.onLine === false);
}

function profileDocRef(uid = state.uid) {
  return doc(db, "users", uid);
}

function skillCloudPayload(skill, scope = "global") {
  return {
    ...skill,
    cloudScope: scope,
    ownerUid: state.uid,
    updatedAtClient: new Date().toISOString(),
  };
}

function creatorSkillDeckId(skillId) {
  return `${CREATOR_SKILL_DECK_PREFIX}${normalizeId(skillId, "skill").slice(0, 120)}`;
}

function deckMirrorSkillPayload(skill) {
  return {
    type: "creator_skill_template",
    visibility: "public",
    title: `技テンプレ: ${skill.name || skill.id}`,
    deck: {},
    deckCount: 0,
    skillId: skill.id,
    skillName: skill.name || skill.id,
    ownerUid: state.uid,
    ownerName: "creator",
    skill: skillCloudPayload(skill, "deck_public"),
    updatedAtClient: new Date().toISOString(),
  };
}

async function saveSkillPublicMirror(skill) {
  await setDoc(doc(db, "decks", creatorSkillDeckId(skill.id)), {
    ...deckMirrorSkillPayload(skill),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function saveSkillUserCloud(skill) {
  await setDoc(profileDocRef(), {
    creatorSkills: {
      [skill.id]: skillCloudPayload(skill, "user"),
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function uploadSkillToCloud(skill) {
  await setDoc(doc(db, "card_skills", skill.id), {
    ...skillCloudPayload(skill, "global"),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  try {
    await saveSkillPublicMirror(skill);
  } catch (mirrorErr) {
    console.warn("[creator] global skill mirror save failed", mirrorErr?.message || mirrorErr);
  }
  return { mode: "global" };
}

async function uploadSkillWithFallback(skill) {
  try {
    return await uploadSkillToCloud(skill);
  } catch (e) {
    try {
      await saveSkillPublicMirror(skill);
      try {
        await saveSkillUserCloud(skill);
      } catch (userErr) {
        console.warn("[creator] user skill cloud save failed", userErr?.message || userErr);
      }
      return { mode: "mirror", error: e };
    } catch (e2) {
      try {
        await saveSkillUserCloud(skill);
        return { mode: "user", error: e2 };
      } catch (e3) {
        e3._creatorErrors = { primary: e, mirror: e2 };
        throw e3;
      }
    }
  }
}

async function uploadCardToCloud(card, options = {}) {
  const col = options.collection || collectionForKind(card.kind);
  await setDoc(doc(db, col, card.id), {
    ...card,
    updatedAt: serverTimestamp(),
    ownerUid: state.uid,
  }, { merge: true });

  if (options.isOverwrite && options.oldCollection && options.oldCollection !== col) {
    try {
      await deleteDoc(doc(db, options.oldCollection, card.id));
    } catch (deleteErr) {
      console.warn("[creator] old card collection cleanup failed", deleteErr?.message || deleteErr);
    }
  }

  if (options.giveSelf) {
    await setDoc(doc(db, "users", state.uid), {
      ownedCounts: { [card.id]: increment(4) },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  return { collection: col };
}

async function flushSyncQueue({ silent = false } = {}) {
  if (state.syncing) return { synced: 0, failed: syncQueue().length };
  const queue = syncQueue();
  if (!queue.length) {
    renderSyncStatus();
    return { synced: 0, failed: 0 };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    if (!silent) setMsg("cardMsg", "オフラインです。未同期キューに保存されています。", false);
    renderSyncStatus();
    return { synced: 0, failed: queue.length };
  }

  state.syncing = true;
  renderSyncStatus();
  const remaining = [];
  let synced = 0;

  for (const item of queue) {
    try {
      if (item.kind === "skill") {
        await uploadSkillWithFallback(item.payload);
        synced += 1;
      } else if (item.kind === "card") {
        const result = await uploadCardToCloud(item.payload, item.options || {});
        const col = result.collection || item.collection || collectionForKind(item.payload?.kind);
        state.cards.set(item.payload.id, { ...item.payload, _cloudCollection: col });
        saveLocalCards();
        synced += 1;
      } else {
        remaining.push({ ...item, tries: Number(item.tries || 0) + 1, lastError: "unknown queue item" });
      }
    } catch (e) {
      remaining.push({
        ...item,
        tries: Number(item.tries || 0) + 1,
        lastError: String(e?.message || e),
        lastTriedAt: new Date().toISOString(),
      });
    }
  }

  state.syncing = false;
  saveSyncQueue(remaining);
  renderAll();
  if (!silent) {
    const msg = remaining.length
      ? `同期 ${synced}件 / 未同期 ${remaining.length}件。次回オンライン時に再試行します。`
      : `未同期データをすべてクラウド同期しました（${synced}件）`;
    setMsg(state.tab === "skill" ? "skillMsg" : "cardMsg", msg, remaining.length === 0);
  }
  return { synced, failed: remaining.length };
}

async function loadMirroredSkills() {
  try {
    const snap = await getDocs(query(collection(db, "decks"), where("type", "==", "creator_skill_template"), limit(300)));
    let count = 0;
    snap.forEach((d) => {
      const data = d.data() || {};
      if (data.type !== "creator_skill_template") return;
      if (String(data.visibility || "public") !== "public") return;
      const skill = data.skill && typeof data.skill === "object" ? data.skill : data;
      const id = skill.id || data.skillId || d.id.replace(CREATOR_SKILL_DECK_PREFIX, "");
      if (!id) return;
      state.skills.set(id, { id, ...skill, cloudScope: "deck_public", source: skill.source || "creator_public" });
      count += 1;
    });
    return count;
  } catch (e) {
    console.warn("[creator] public skill mirror load failed", e?.message || e);
    return 0;
  }
}

function actionSummary(a) {
  const parts = [];
  parts.push(`[${a.cost ?? 0}] ${a.name || "技"}`);
  parts.push(a.range || "front1");
  parts.push(`${a.rate ?? 0}%`);
  if (a.hpDelta) parts.push(`HP${a.hpDelta > 0 ? "+" : ""}${a.hpDelta}`);
  if (a.spDelta) parts.push(`SP${a.spDelta > 0 ? "+" : ""}${a.spDelta}`);
  if (a.draw) parts.push(`ドロー${a.draw}`);
  if (a.addStatus) {
    parts.push(typeof a.addStatus === "object" ? JSON.stringify(a.addStatus) : `${a.addStatus}`);
  }
  const handEff = Array.isArray(a.handEffects) ? a.handEffects[0] : a.handEffect;
  if (handEff && typeof handEff === "object") {
    const ht = String(handEff.type || "");
    const target = String(handEff.targetSeat || handEff.target || "enemy") === "self" ? "自分" : "相手";
    const count = Math.max(1, Math.trunc(Number(handEff.count ?? handEff.n ?? 1)) || 1);
    if (ht === "discardHand") parts.push(`${target}手札墓地${count}`);
    else if (ht === "setHand" || ht === "setCard") parts.push(`${target}手札ふせ${count}`);
  }
  return parts.join(" / ");
}

function rangeTokens(range) {
  return String(range || "")
    .toLowerCase()
    .split("+")
    .map((v) => v.trim())
    .filter(Boolean);
}

const RANGE_DIR_LABELS = {
  lf: "↖",
  front: "↑",
  rf: "↗",
  l: "←",
  self: "自",
  r: "→",
  lb: "↙",
  back: "↓",
  rb: "↘",
};

function rangePartLabel(part) {
  const p = String(part || "").trim();
  if (p === "self") return "自分";
  const m = p.match(/^(front|back|rf|lf|rb|lb|r|l)(\d+)$/i);
  if (!m) return p;
  return `${RANGE_DIR_LABELS[m[1]] || m[1]}${m[2]}`;
}

function rangePartsFromInput() {
  return rangeTokens(text("skillRange"))
    .filter((v) => v && v !== "0")
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function setRangeParts(parts) {
  const clean = (parts || [])
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  $("skillRange").value = clean.join("+");
  renderSkillPreview();
}

function selectRangeDir(dir) {
  state.rangeDir = RANGE_DIR_LABELS[dir] ? dir : "front";
  document.querySelectorAll("[data-range-dir]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-range-dir") === state.rangeDir);
  });
}

function addRangePartFromBuilder() {
  const dir = state.rangeDir || "front";
  const dist = Math.max(1, Math.min(4, num("skillRangeDistance", 1)));
  const part = dir === "self" ? "self" : `${dir}${dist}`;
  if (part === "self") {
    setRangeParts(["self"]);
    return;
  }
  const parts = rangePartsFromInput().filter((v) => v !== "self");
  parts.push(part);
  setRangeParts(parts);
}

function setTagEnabled(tag, enabled) {
  const input = $("skillTags");
  if (!input) return;
  const tags = cleanSkillTags(String(input.value || ""));
  const lower = tag.toLowerCase();
  const next = tags.filter((v) => v.toLowerCase() !== lower);
  if (enabled) next.push(tag);
  input.value = next.filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i).join("+");
}

const CREATOR_INTERNAL_TAG_KEYS = new Set([
  "attr",
  "attrin",
  "attrs",
  "attribute",
  "attributes",
  "cond",
  "condition",
  "conditions",
  "existing",
  "existingskill",
  "fromexisting",
  "internal",
  "kind",
  "owner",
  "ownertype",
  "power",
  "raw",
  "role",
  "roles",
  "source",
  "sourcecard",
  "sourcecardid",
  "sourceid",
  "src",
  "theme",
  "type",
]);

function splitSkillTags(value) {
  return Array.isArray(value)
    ? value.map((v) => String(v || "").trim())
    : String(value || "")
        .split(/[,+\s]+/)
        .map((v) => v.trim());
}

function isInternalSkillTag(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return true;
  if (raw === "既存技" || raw === "カード内蔵技" || raw === "元カード") return true;
  const key = raw.split(/[:：=]/)[0].trim().toLowerCase();
  return CREATOR_INTERNAL_TAG_KEYS.has(key);
}

function cleanSkillTags(value) {
  const out = [];
  for (const tag of splitSkillTags(value)) {
    if (!tag || isInternalSkillTag(tag)) continue;
    if (out.findIndex((x) => x.toLowerCase() === tag.toLowerCase()) === -1) out.push(tag);
  }
  return out;
}

function normalizeStoredSkillTags() {
  let changed = false;
  for (const [id, skill] of state.skills.entries()) {
    const cleaned = cleanSkillTags(skill?.tags || []);
    const before = splitSkillTags(skill?.tags || []).filter(Boolean);
    if (
      cleaned.length !== before.length ||
      cleaned.some((tag, i) => tag !== before[i])
    ) {
      state.skills.set(id, { ...skill, tags: cleaned });
      changed = true;
    }
  }
  if (changed) saveLocalSkills();
  return changed;
}

function hasSkillTag(tag) {
  const lower = String(tag || "").toLowerCase();
  return cleanSkillTags(String($("skillTags")?.value || ""))
    .some((v) => v.toLowerCase() === lower);
}

function toggleSkillFlag(tag) {
  setTagEnabled(tag, !hasSkillTag(tag));
  renderSkillPreview();
}

function addRangePoint(points, x, y, label = "●") {
  if (x < -2 || x > 2 || y < -2 || y > 2) return;
  points.set(`${x},${y}`, { x, y, label });
}

function rangePoints(range) {
  const tokens = rangeTokens(range);
  const points = new Map();
  for (const token of tokens) {
    if (token === "self") addRangePoint(points, 0, 0, "自");
    else if (token === "side1") {
      addRangePoint(points, -1, 0, "←");
      addRangePoint(points, 1, 0, "→");
    } else if (token === "side2") {
      addRangePoint(points, -2, 0, "←");
      addRangePoint(points, 2, 0, "→");
    } else if (token === "adj4") {
      addRangePoint(points, 0, -1, "↑");
      addRangePoint(points, -1, 0, "←");
      addRangePoint(points, 1, 0, "→");
      addRangePoint(points, 0, 1, "↓");
    } else {
      const m = token.match(/^(front|back|f|b|rf|lf|rb|lb|r|l)(\d)$/);
      if (!m) continue;
      const dir = m[1];
      const n = Number(m[2] || 1);
      const y = dir.includes("back") || dir === "b" ? n : dir === "r" || dir === "l" ? 0 : -n;
      const x = dir.startsWith("r") ? n : dir.startsWith("l") ? -n : 0;
      const yy = dir === "rf" || dir === "lf" || dir === "rb" || dir === "lb" ? (dir.endsWith("b") ? n : -n) : y;
      const label =
        x < 0 && yy < 0 ? "↖" :
        x > 0 && yy < 0 ? "↗" :
        x < 0 && yy > 0 ? "↙" :
        x > 0 && yy > 0 ? "↘" :
        yy < 0 ? "↑" : yy > 0 ? "↓" : x < 0 ? "←" : x > 0 ? "→" : "●";
      addRangePoint(points, x, yy, label);
    }
  }
  if (!points.size && String(range || "").trim()) addRangePoint(points, 0, -1, "↑");
  return points;
}

function rangeVizHtml(range) {
  const pts = rangePoints(range);
  let html = `<div class="rangeViz" title="${esc(range || "未設定")}">`;
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const p = pts.get(`${x},${y}`);
      const self = x === 0 && y === 0;
      html += `<span class="rangeCell ${self ? "self" : ""} ${p ? "hit" : ""}">${esc(self ? "自" : p?.label || "")}</span>`;
    }
  }
  html += `</div>`;
  return html;
}

function renderSkillRangePreview() {
  const box = $("skillRangeViz");
  if (!box) return;
  const rawRange = text("skillRange");
  box.outerHTML = rangeVizHtml(rawRange).replace("<div", `<div id="skillRangeViz" aria-label="射程プレビュー"`);
  const label = $("skillRangeLabel");
  const parts = rangePartsFromInput();
  const flagText = [hasSkillTag("aoe") ? "全体" : "", hasSkillTag("pierce") ? "貫通" : ""].filter(Boolean).join(" / ");
  if (label) label.textContent = `${rawRange || "未設定（保存時はfront1）"}${flagText ? ` / ${flagText}` : ""} / 自分は中央、上が敵側`;
  const chips = $("rangeChips");
  if (chips) {
    chips.innerHTML = parts.length
      ? parts.map((p) => `<span class="rangeChip">${esc(rangePartLabel(p))}</span>`).join("")
      : `<span class="hint">射程なし</span>`;
  }
  $("skillFlagAoe")?.classList.toggle("active", hasSkillTag("aoe"));
  $("skillFlagPierce")?.classList.toggle("active", hasSkillTag("pierce"));
  selectRangeDir(state.rangeDir || "front");
}

function localTheme() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_THEME_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalTheme(theme) {
  try {
    localStorage.setItem(LOCAL_THEME_KEY, JSON.stringify(theme));
  } catch {}
}

function parseCsv(textValue) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  const src = String(textValue || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v || "").trim()));
}

function csvNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function publicActionToSkill(row) {
  const actionId = normalizeId(row.actionId || row.id || row.name || "action", "action");
  const tags = cleanSkillTags(row.tags || "");
  const skill = {
    id: `act_${actionId}`,
    name: row.name || actionId,
    cost: csvNumber(row.cost, 1),
    range: row.range || "front1",
    rate: csvNumber(row.rate, 75),
    hpDelta: csvNumber(row.hpDelta, 0),
    spDelta: csvNumber(row.spDelta, 0),
    theme: `既存技${row.ownerType ? `:${row.ownerType}` : ""}`,
    source: "actions_public",
    actionId,
    role: row.role || "",
    power: row.power || "",
    ownerType: row.ownerType || "",
    tags,
  };
  const draw = csvNumber(row.draw, 0);
  if (draw) skill.draw = draw;
  if (row.addStatus) {
    skill.addStatus = row.addStatus;
    skill.statusValue = 1;
    skill.statusTurns = 2;
  }
  return skill;
}

function updateActionSourceState() {
  const badge = $("actionSourceState");
  if (!badge) return;
  const publicCount = [...state.skills.values()].filter((s) => s.source === "actions_public").length;
  const cardActionCount = [...state.skills.values()].filter((s) => s.source === "card_action").length;
  state.publicActionCount = publicCount;
  badge.textContent = `既存技 ${publicCount} / カード技 ${cardActionCount}`;
}

async function loadPublicActions({ overwrite = false, quiet = false } = {}) {
  const badge = $("actionSourceState");
  try {
    const res = await fetch("./actions_public.csv?v=20260726_actions_canonical1", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const rows = parseCsv(csv);
    const headers = rows.shift()?.map((h) => String(h || "").trim()) || [];
    let added = 0;
    for (const values of rows) {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = String(values[i] ?? "").trim(); });
      if (!obj.actionId && !obj.name) continue;
      const skill = publicActionToSkill(obj);
      if (!overwrite && state.skills.has(skill.id)) continue;
      state.skills.set(skill.id, skill);
      added += 1;
    }
    if (state.cards.size) {
      upsertCardActionSkillsFromCards(state.cards.values());
      normalizeStoredSkillTags();
      saveLocalSkills();
    }
    updateActionSourceState();
    if (!quiet) setMsg("cardMsg", `既存技を読み込みました: ${state.publicActionCount}件`, true);
    renderAll();
    return added;
  } catch (e) {
    if (badge) badge.textContent = "既存技: 読込失敗";
    if (!quiet) setMsg("cardMsg", `既存技の読み込みに失敗しました: ${e?.message || e}`, false);
    return 0;
  }
}

function currentTheme() {
  const attr = ATTRS.has(text("themeAttr")) ? text("themeAttr") : "火";
  const name = text("themeName") || `${attr}の新テーマ`;
  const prefix = slug(text("themePrefix") || name || attr, `${attr}_theme`);
  return {
    name,
    prefix,
    attr,
    role: text("themeRole") || "balanced",
    series: text("themeSeries") || "ガチャ",
    power: text("themePower") || "standard",
    memo: text("themeMemo"),
  };
}

function applyThemeToForms() {
  const t = currentTheme();
  saveLocalTheme(t);
  $("theme").value = t.name;
  setSeriesValue(t.series);
  $("attr").value = t.attr;
  $("skillTheme").value = t.name;
  document.documentElement.style.setProperty("--accent", ATTR_COLORS[t.attr] || "#7dd3fc");
  setMsg("themeMsg", `${t.name} をカード/技フォームへ反映しました。`, true);
  renderAll();
}

function fillThemeForm(theme = {}) {
  $("themeName").value = theme.name || "";
  $("themePrefix").value = theme.prefix || "";
  $("themeAttr").value = theme.attr || "火";
  $("themeRole").value = theme.role || "balanced";
  $("themeSeries").value = theme.series || "ガチャ";
  $("themePower").value = theme.power || "standard";
  $("themeMemo").value = theme.memo || "";
}

function saveCurrentThemeTemplate() {
  const theme = currentTheme();
  const list = localThemeTemplates();
  const key = String(theme.prefix || theme.name || "").trim();
  const item = {
    ...theme,
    savedAt: new Date().toISOString(),
  };
  const idx = list.findIndex((x) => String(x.prefix || x.name || "") === key);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  saveLocalThemeTemplates(list.slice(0, 18));
  setMsg("themeMsg", `${theme.name} をテーマテンプレに保存しました。`, true);
  renderThemeTemplates();
}

function applyThemeTemplate(index) {
  const list = localThemeTemplates();
  const item = list[index];
  if (!item) return;
  fillThemeForm(item);
  applyThemeToForms();
  setMsg("themeMsg", `${item.name || "テンプレ"} を読み込みました。`, true);
}

function deleteThemeTemplate(index) {
  const list = localThemeTemplates();
  const item = list[index];
  if (!item) return;
  list.splice(index, 1);
  saveLocalThemeTemplates(list);
  setMsg("themeMsg", `${item.name || "テンプレ"} を削除しました。`, true);
  renderThemeTemplates();
}

function powerScale(power) {
  if (power === "starter") return 0.82;
  if (power === "premium") return 1.12;
  return 1;
}

function statusForTheme(attr, role) {
  if (role === "control") {
    if (attr === "闇") return "brainwash";
    if (attr === "雷") return "sludge";
    if (attr === "幻") return "blind";
    if (attr === "呪") return "smell";
    return "silence";
  }
  if (role === "sustain") return attr === "鋼" ? "counter" : "evade";
  if (role === "aggro") return attr === "火" ? "rage" : "bleed";
  if (role === "combo") return attr === "幻" ? "brainwash" : attr === "呪" ? "lostSoul" : "sludge";
  if (attr === "草") return "poison";
  if (attr === "風") return "evade";
  return "";
}

function themeSkillDrafts(theme) {
  const scale = powerScale(theme.power);
  const status = statusForTheme(theme.attr, theme.role);
  const prefix = theme.prefix;
  const hpMain = Math.round(-14 * scale);
  const hpHeavy = Math.round(-22 * scale);
  const spCut = Math.round(-10 * scale);
  const base = [
    {
      id: `${prefix}_strike`,
      name: `${theme.name}の一撃`,
      cost: theme.role === "aggro" ? 1 : 2,
      range: theme.attr === "風" ? "front1+side1" : "front1",
      rate: theme.role === "aggro" ? 82 : 75,
      hpDelta: hpMain,
      spDelta: 0,
      theme: theme.name,
      tags: [theme.attr, theme.role],
    },
    {
      id: `${prefix}_break`,
      name: `${theme.name}の崩し`,
      cost: theme.role === "control" ? 1 : 2,
      range: "front1",
      rate: theme.role === "control" ? 78 : 70,
      hpDelta: theme.role === "control" ? 0 : Math.round(-8 * scale),
      spDelta: theme.role === "control" ? Math.round(spCut * 1.6) : spCut,
      theme: theme.name,
      tags: [theme.attr, theme.role, "sp"],
    },
    {
      id: `${prefix}_signature`,
      name: `${theme.name}の切り札`,
      cost: theme.role === "combo" ? 3 : 2,
      range: theme.role === "aggro" ? "front1+side1" : "rf1+lf1",
      rate: theme.power === "premium" ? 70 : 64,
      hpDelta: hpHeavy,
      spDelta: theme.role === "combo" ? Math.round(-10 * scale) : 0,
      theme: theme.name,
      tags: [theme.attr, theme.role, "signature"],
    },
  ];
  if (status) {
    base[1].addStatus = status;
    base[1].statusValue = status === "counter" ? 40 : 1;
    base[1].statusTurns = status === "rage" ? 1 : 2;
  }
  if (theme.role === "sustain") {
    base[2].name = `${theme.name}の立て直し`;
    base[2].range = "self";
    base[2].rate = 85;
    base[2].hpDelta = Math.round(16 * scale);
    base[2].spDelta = Math.round(6 * scale);
  }
  if (theme.role === "combo") {
    base[2].draw = 1;
  }
  return base;
}

function upsertThemeSkills(setActive = true) {
  const theme = currentTheme();
  const drafts = themeSkillDrafts(theme);
  drafts.forEach((skill) => state.skills.set(skill.id, { ...skill, updatedAtClient: new Date().toISOString() }));
  saveLocalSkills();
  if (setActive) state.selectedSkills = drafts.map((s) => s.id);
  saveLocalTheme(theme);
  setMsg("themeMsg", `${theme.name} の技テンプレを${drafts.length}件作りました。技タブで調整して保存できます。`, true);
  renderAll();
  return drafts;
}

function nextThemeCardId(kind = "unit") {
  const theme = currentTheme();
  const base = kind === "unit" ? `${theme.prefix}_unit` : `${theme.prefix}_${kind}`;
  let n = 1;
  while (state.cards.has(`${base}_${String(n).padStart(2, "0")}`)) n += 1;
  return `${base}_${String(n).padStart(2, "0")}`;
}

function autoCardId() {
  const kind = normalizeKind(text("cardKind"));
  $("cardId").value = nextThemeCardId(kind);
  renderCardPreview();
}

function autoSkillId() {
  const theme = currentTheme();
  const name = slug(text("skillName") || "skill", "skill");
  $("skillId").value = `${theme.prefix}_${name}`;
  renderSkillPreview();
}

function draftThemeUnit() {
  const theme = currentTheme();
  const skills = upsertThemeSkills(true);
  const scale = powerScale(theme.power);
  $("cardKind").value = "unit";
  $("cardId").value = nextThemeCardId("unit");
  $("cardName").value = `${theme.name}の先導者`;
  $("rarity").value = theme.power === "premium" ? "SR" : "R";
  $("attr").value = theme.attr;
  $("cost").value = theme.role === "aggro" ? 2 : 3;
  $("hp").value = Math.round((theme.role === "sustain" ? 50 : 40) * scale);
  $("sp").value = Math.round((theme.role === "combo" ? 40 : 20) * scale);
  $("theme").value = theme.name;
  $("series").value = theme.series;
  $("desc").value = `${ATTR_TRAITS[theme.attr] || ""} ${ROLE_LABELS[theme.role] || "バランス"}型のテーマ中核。`.trim();
  state.selectedSkills = skills.map((s) => s.id).slice(0, 3);
  updateKindUi();
  setTab("card");
  setMsg("cardMsg", "テーマキャラ草案を作りました。数値を確認してから保存してください。", true);
  renderAll();
}

function draftThemeSupport() {
  const theme = currentTheme();
  $("cardKind").value = "support";
  $("cardId").value = nextThemeCardId("support");
  $("cardName").value = `${theme.name}の号令`;
  $("rarity").value = "R";
  $("attr").value = theme.attr;
  $("cost").value = theme.role === "combo" ? 2 : 1;
  $("theme").value = theme.name;
  $("series").value = theme.series;
  $("desc").value = `${ROLE_LABELS[theme.role] || "バランス"}型テーマの補助カード。`;
  $("effectRate").value = theme.role === "control" ? 75 : 80;
  $("effectN").value = theme.role === "combo" ? 1 : 10;
  $("effectHp").value = theme.role === "sustain" ? 12 : 0;
  $("effectSp").value = 0;
  $("effectCardId").value = "";
  $("effectKind").value = theme.role === "combo" ? "unit" : "";
  $("effectStatus").value = statusForTheme(theme.attr, theme.role) || "";
  if (theme.role === "control") $("effectType").value = "setCard";
  else if (theme.role === "combo") $("effectType").value = "search";
  else if (theme.role === "sustain") $("effectType").value = "heal";
  else if (theme.role === "aggro") $("effectType").value = "powerUp";
  else $("effectType").value = "draw";
  state.selectedSkills = [];
  updateKindUi();
  setTab("card");
  setMsg("cardMsg", "テーマサポート草案を作りました。効果を確認してから保存してください。", true);
  renderAll();
}

function setThemePreset(role) {
  const attrByRole = {
    balanced: "光",
    aggro: "火",
    control: "闇",
    sustain: "水",
    combo: "幻",
  };
  const nameByRole = {
    balanced: "星灯ギルド",
    aggro: "紅蓮急襲隊",
    control: "影縫い劇場",
    sustain: "深海救護班",
    combo: "夢幻仕掛け箱",
  };
  const attr = attrByRole[role] || "火";
  const name = nameByRole[role] || "新テーマ";
  $("themeName").value = name;
  $("themePrefix").value = slug(name, "theme");
  $("themeAttr").value = attr;
  $("themeRole").value = role || "balanced";
  $("themeSeries").value = "ガチャ";
  $("themePower").value = role === "balanced" ? "standard" : "starter";
  $("themeMemo").value = `${ROLE_LABELS[role] || "バランス"}の試作用プリセット。ここから名前と数値を調整。`;
  applyThemeToForms();
}

async function copyThemeJson() {
  const raw = $("themeJson")?.textContent || "";
  try {
    await navigator.clipboard.writeText(raw);
    setMsg("themeMsg", "テーマJSONをコピーしました。", true);
  } catch {
    setMsg("themeMsg", "コピーできませんでした。JSON欄から手動で選択してください。", false);
  }
}

function showCardDiagnosis() {
  const advice = currentCardAdvice();
  setMsg("cardMsg", `診断スコア: ${advice.score}\n${advice.text}`, advice.cls !== "bad");
}

function collectionForKind(kind) {
  if (kind === "support") return "support_cards";
  if (kind === "ex_support") return "ex_support_cards";
  return "cards";
}

function normalizeKind(kind) {
  const k = String(kind || "unit").toLowerCase();
  if (k === "card") return "unit";
  if (k === "exsupport" || k === "ex") return "ex_support";
  if (k === "support") return "support";
  return "unit";
}

function buildSkillFromForm() {
  const id = normalizeId(text("skillId"), "skill");
  const extra = safeJson(text("skillExtraJson"), {});
  const status = text("skillStatus");
  const statusPair = text("skillStatusValue").split(",").map((v) => Number(v.trim()));
  const value = Number.isFinite(statusPair[0]) ? statusPair[0] : 1;
  const turns = Number.isFinite(statusPair[1]) ? statusPair[1] : 2;
  const tags = cleanSkillTags(text("skillTags"));

  const skill = {
    id,
    name: text("skillName") || "新しい技",
    cost: num("skillCost", 1),
    range: text("skillRange"),
    rate: num("skillRate", 75),
    hpDelta: num("skillHpDelta", 0),
    spDelta: num("skillSpDelta", 0),
    theme: text("skillTheme"),
    tags,
    updatedAtClient: new Date().toISOString(),
    ...extra,
  };
  const originList = mergeOrigins(state.editingSkillOrigin?.origins, []);
  if (originList.length) {
    skill.originActions = originList;
    Object.assign(skill, singleOriginFields(originList));
    skill.source = state.editingSkillOrigin.source || "card_action";
    skill.sourceLabel = state.editingSkillOrigin.sourceLabel || (skill.source === "actions_public" ? "既存技" : "カード技");
  }

  if (status) {
    skill.addStatus = status;
    skill.statusValue = value;
    skill.statusTurns = turns;
  }
  const draw = num("skillDraw", 0);
  if (draw) skill.draw = draw;
  const handType = text("skillHandEffect");
  if (handType) {
    skill.handEffect = {
      type: handType,
      targetSeat: text("skillHandTarget") || "enemy",
      count: Math.max(1, num("skillHandCount", 1)),
    };
  }
  return skill;
}

function skillToAction(skill) {
  const tags = cleanSkillTags(skill.tags);
  const statuses = [];
  const action = {
    name: skill.name || "技",
    cost: Number(skill.cost || 0),
    range: skill.range || "front1",
    rate: Number(skill.rate || 0),
    hpDelta: Number(skill.hpDelta || 0),
    spDelta: Number(skill.spDelta || 0),
  };
  if (skill.addStatus) {
    statuses.push(skill.addStatus);
    tags.push(`${skill.addStatus}:${Number(skill.statusValue || 1)}`);
    tags.push(`turns:${Number(skill.statusTurns || 2)}`);
  }
  if (skill.draw) {
    const draw = Number(skill.draw);
    action.draw = draw;
    statuses.push("draw");
    tags.push(`draw:${draw}`);
  }
  if (statuses.length) action.addStatus = statuses.join("+");
  if (tags.length) action.tags = tags;
  for (const [k, v] of Object.entries(skill)) {
    if ([
      "id",
      "theme",
      "source",
      "sourceLabel",
      "actionId",
      "role",
      "power",
      "ownerType",
      "originCardId",
      "originCardName",
      "originCardKind",
      "originCardCollection",
      "originActionIndex",
      "originActions",
      "cloudScope",
      "ownerUid",
      "updatedAt",
      "updatedAtClient",
    ].includes(k)) continue;
    if (action[k] === undefined && !["tags", "addStatus"].includes(k)) action[k] = v;
  }
  return action;
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function skillToActionCsvObject(skill = {}) {
  const action = skillToAction(skill);
  const actionId = normalizeId(skill.actionId || skill.id || action.name || "action", "action").replace(/^act_/, "");
  const tags = Array.isArray(action.tags) ? action.tags.join("+") : String(action.tags || skill.tags || "");
  const addStatus = typeof action.addStatus === "string" ? action.addStatus : String(skill.addStatus || "");
  const ownerType = String(skill.ownerType || "");
  return {
    actionId,
    name: action.name || skill.name || actionId,
    cost: action.cost ?? 1,
    range: action.range || "front1",
    hpDelta: action.hpDelta ?? 0,
    spDelta: action.spDelta ?? 0,
    rate: action.rate ?? 75,
    draw: action.draw ?? skill.draw ?? "",
    role: skill.role || "",
    power: skill.power || "",
    tags,
    addStatus,
    ownerType,
    bonus: "",
  };
}

function skillToPublicCsvLine(skill) {
  const r = skillToActionCsvObject(skill);
  return [
    r.actionId,
    r.name,
    r.cost,
    r.range,
    r.hpDelta,
    r.spDelta,
    r.rate,
    r.draw,
    r.role,
    r.power,
    r.tags,
    r.addStatus,
    r.ownerType,
  ].map(csvCell).join(",");
}

function skillToScriptsCsvLine(skill) {
  const r = skillToActionCsvObject(skill);
  return [
    r.actionId,
    r.name,
    r.cost,
    r.range,
    r.hpDelta,
    r.spDelta,
    r.rate,
    r.role,
    r.power,
    r.tags,
    r.addStatus,
    r.ownerType,
    r.bonus,
  ].map(csvCell).join(",");
}

async function copyCurrentSkillCsv() {
  try {
    const skill = buildSkillFromForm();
    const text = [
      "# scripts/actions.csv",
      skillToScriptsCsvLine(skill),
      "",
      "# public/actions_public.csv",
      skillToPublicCsvLine(skill),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setMsg("skillMsg", "現在の技をCSV行としてコピーしました。scripts/actions.csv と public/actions_public.csv に追記できます。", true);
  } catch (e) {
    setMsg("skillMsg", `CSVコピーに失敗しました: ${e?.message || e}`, false);
  }
}

function skillOriginList(skill = {}) {
  const list = mergeOrigins(skill.originActions, []);
  if (list.length) return list;
  if (!skill.originCardId) return [];
  return mergeOrigins([], [{
    cardId: skill.originCardId,
    cardName: skill.originCardName || skill.originCardId,
    cardKind: skill.originCardKind || "unit",
    cardCollection: skill.originCardCollection || "cards",
    actionIndex: skill.originActionIndex || 0,
  }]);
}

async function applySkillToOneOrigin(skill, origin) {
  const cardId = origin?.cardId;
  if (!cardId) return { applied: false, warning: "元カードIDがありません" };
  const card = state.cards.get(cardId);
  if (!card) return { applied: false, warning: `元カード ${cardId} が見つかりません` };
  const actionIndex = Math.max(0, Math.trunc(Number(origin.actionIndex || 0)));
  const actions = Array.isArray(card.actions) ? card.actions.map((a) => ({ ...a })) : [];
  while (actions.length <= actionIndex) actions.push({ name: `技${actions.length + 1}`, cost: 1, range: "front1", rate: 75, hpDelta: -10, spDelta: 0 });
  actions[actionIndex] = skillToAction(skill);

  const updatedCard = {
    ...card,
    actions,
    updatedAtClient: new Date().toISOString(),
  };
  const col = origin.cardCollection || card._cloudCollection || collectionForKind(card.kind);
  state.cards.set(cardId, { ...updatedCard, _cloudCollection: col });
  saveLocalCards();

  try {
    await uploadCardToCloud(updatedCard, { collection: col, isOverwrite: true, oldCollection: card._cloudCollection || col });
    removeQueuedSync((item) => item.kind === "card" && item.id === cardId);
    return { applied: true, cloudSaved: true, cardName: updatedCard.name || cardId };
  } catch (e) {
    enqueueSync({
      kind: "card",
      id: cardId,
      collection: col,
      payload: updatedCard,
      options: { collection: col, isOverwrite: true, oldCollection: card._cloudCollection || col },
      message: updatedCard.name || cardId,
      lastError: String(e?.message || e),
    });
    state.cards.set(cardId, { ...updatedCard, _cloudCollection: col, _syncQueued: true });
    saveLocalCards();
    return { applied: true, cloudSaved: false, cardName: updatedCard.name || cardId };
  }
}

async function applySkillToOriginCards(skill) {
  const origins = skillOriginList(skill);
  if (!origins.length) return { applied: false };
  const results = [];
  for (const origin of origins) {
    results.push(await applySkillToOneOrigin(skill, origin));
  }
  const applied = results.filter((r) => r.applied);
  const warnings = results.map((r) => r.warning).filter(Boolean);
  return {
    applied: applied.length > 0,
    count: applied.length,
    cloudSaved: applied.length > 0 && applied.every((r) => r.cloudSaved),
    cardName: applied.length === 1 ? applied[0].cardName : `${applied.length}枚のカード`,
    warning: warnings[0] || "",
  };
}

function buildSupportEffect() {
  const type = text("effectType") || "draw";
  const rate = num("effectRate", 80);
  const hp = num("effectHp", 0);
  const sp = num("effectSp", 0);
  const n = num("effectN", 1);
  const status = text("effectStatus");
  const effect = { type, rate };

  if (type === "draw") effect.n = Math.max(1, n);
  else if (type === "heal" || type === "dmg") {
    effect.hp = Math.max(0, Math.abs(hp));
    effect.sp = Math.max(0, Math.abs(sp));
  } else if (type === "modRate" || type === "powerUp") effect.delta = n;
  else if (type === "manaUp") {
    effect.kind = "cur";
    effect.amount = n;
  } else if (type === "moveTo" || type === "swapPos") effect.maxDist = Math.max(1, n);
  else if (type === "addStatus") {
    effect.status = status || "bleed";
    effect.v = 1;
    effect.turns = Math.max(1, n);
  } else if (type === "search") {
    const cardId = text("effectCardId");
    const kind = text("effectKind");
    if (cardId) effect.cardId = cardId;
    if (kind) effect.kind = kind;
  } else if (type === "discardHand") {
    effect.targetSeat = "enemy";
    effect.count = Math.max(1, n);
  } else if (type === "setCard") {
    const cardId = text("effectCardId");
    const kind = text("effectKind");
    if (cardId) effect.cardId = cardId;
    if (kind) effect.kind = kind;
    effect.targetSeat = "enemy";
    effect.releaseSeat = "self";
    effect.count = Math.max(1, n);
  }
  return effect;
}

function normalizeSupportEffectType(type) {
  const t = String(type || "").trim();
  const l = t.toLowerCase();
  if (l === "decksearch" || l === "tutor") return "search";
  if (l === "discardhand" || l === "handdiscard" || l === "discard" || l === "gravehand" || l === "trashhand") return "discardHand";
  if (l === "setcard" || l === "sethand" || l === "facedown" || l === "cardset" || l === "cardlock" || l === "hidecard") return "setCard";
  if (l === "manamaxup" || l === "manaupmax" || l === "manamax") return "manaUp";
  return t || "draw";
}

function fillSupportEffectForm(effect = {}) {
  const eff = effect && typeof effect === "object" ? effect : {};
  const type = normalizeSupportEffectType(eff.type);
  if ($("effectType")) {
    const hasType = [...$("effectType").options].some((opt) => opt.value === type);
    $("effectType").value = hasType ? type : "draw";
  }
  if ($("effectRate")) $("effectRate").value = eff.rate ?? 80;
  if ($("effectHp")) $("effectHp").value = eff.hp ?? eff.heal ?? eff.damage ?? 0;
  if ($("effectSp")) $("effectSp").value = eff.sp ?? 0;
  if ($("effectStatus")) $("effectStatus").value = eff.status || eff.addStatus || "";
  if ($("effectCardId")) $("effectCardId").value = eff.cardId || eff.id || eff.searchId || "";
  if ($("effectKind")) $("effectKind").value = eff.kind || eff.cardKind || "";

  let n = eff.n ?? eff.count ?? eff.delta ?? eff.amount ?? eff.maxDist ?? eff.v ?? 1;
  if (type === "draw") n = eff.n ?? eff.draw ?? 1;
  if (type === "heal" || type === "dmg") n = eff.n ?? 1;
  if ($("effectN")) $("effectN").value = n;
}

function skillFromAction(action = {}, cardId = "card", index = 0) {
  const baseId = action.id || action.actionId || action.name || `action_${index + 1}`;
  const id = normalizeId(`edit_${cardId}_${index + 1}_${baseId}`, `edit_${index + 1}`);
  const skill = {
    ...action,
    id,
    name: action.name || `技${index + 1}`,
    cost: Number(action.cost ?? 1),
    range: action.range || "front1",
    rate: Number(action.rate ?? 75),
    hpDelta: Number(action.hpDelta ?? action.hp ?? 0),
    spDelta: Number(action.spDelta ?? action.sp ?? 0),
    theme: action.theme || "編集中カード",
    source: "card_edit",
  };
  if (!Array.isArray(skill.tags)) {
    skill.tags = String(skill.tags || "")
      .split(/[,+\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  skill.tags = cleanSkillTags(skill.tags);
  return skill;
}

function actionSharedKey(action = {}) {
  const actionId = action.actionId || action.id || "";
  if (actionId) return `id:${normalizeId(actionId, "action").toLowerCase()}`;
  return `name:${normalizeId(action.name || "action", "action").toLowerCase()}`;
}

function publicSkillIdForAction(action = {}) {
  const actionId = action.actionId || action.id || "";
  return actionId ? `act_${normalizeId(actionId, "action")}` : "";
}

function sharedCardActionSkillId(action = {}) {
  return normalizeId(`sharedact_${actionSharedKey(action).replace(":", "_")}`, "sharedact");
}

function originFromCardAction(card = {}, index = 0) {
  return {
    cardId: card.id || "",
    cardName: card.name || card.id || "カード",
    cardKind: normalizeKind(card.kind),
    cardCollection: card._cloudCollection || collectionForKind(card.kind),
    actionIndex: Math.max(0, Math.trunc(Number(index || 0))),
  };
}

function mergeOrigins(current = [], next = []) {
  const map = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(next) ? next : [])].forEach((origin) => {
    if (!origin?.cardId && origin?.cardName !== "カード") return;
    const key = `${origin.cardId || origin.cardName}:${Math.max(0, Math.trunc(Number(origin.actionIndex || 0)))}`;
    map.set(key, {
      cardId: origin.cardId || "",
      cardName: origin.cardName || origin.cardId || "カード",
      cardKind: normalizeKind(origin.cardKind),
      cardCollection: origin.cardCollection || collectionForKind(origin.cardKind),
      actionIndex: Math.max(0, Math.trunc(Number(origin.actionIndex || 0))),
    });
  });
  return [...map.values()];
}

function singleOriginFields(origins = []) {
  const first = Array.isArray(origins) && origins.length ? origins[0] : null;
  if (!first) return {};
  return {
    originCardId: first.cardId || "",
    originCardName: first.cardName || "",
    originCardKind: first.cardKind || "unit",
    originCardCollection: first.cardCollection || "cards",
    originActionIndex: first.actionIndex || 0,
  };
}

function cardActionSkillId(card = {}, action = {}, index = 0) {
  return sharedCardActionSkillId(action);
}

function cardActionToSkill(card = {}, action = {}, index = 0) {
  const skill = skillFromAction(action, card.id || card.name || "card", index);
  const origins = [originFromCardAction(card, index)];
  return {
    ...skill,
    id: cardActionSkillId(card, action, index),
    theme: action.theme || card.theme || card.series || card.source || "カード内蔵技",
    source: "card_action",
    sourceLabel: "カード技",
    originActions: origins,
    ...singleOriginFields(origins),
    tags: Array.isArray(skill.tags) ? skill.tags : [],
  };
}

function findSharedSkillForAction(action = {}) {
  const publicId = publicSkillIdForAction(action);
  if (publicId && state.skills.has(publicId)) return state.skills.get(publicId);
  const sharedId = sharedCardActionSkillId(action);
  if (state.skills.has(sharedId)) return state.skills.get(sharedId);
  const name = String(action.name || "").trim();
  if (!name) return null;
  return [...state.skills.values()].find((skill) => String(skill.name || "").trim() === name) || null;
}

function removeLegacyPerCardActionSkills() {
  let removed = 0;
  for (const [id, skill] of [...state.skills.entries()]) {
    if (skill?.source !== "card_action") continue;
    state.skills.delete(id);
    removed += 1;
  }
  return removed;
}

function upsertCardActionSkillsFromCards(cards = []) {
  removeLegacyPerCardActionSkills();
  let added = 0;
  for (const card of cards) {
    if (!card || normalizeKind(card.kind) !== "unit") continue;
    const actions = Array.isArray(card.actions) ? card.actions : [];
    actions.forEach((action, index) => {
      if (!action || typeof action !== "object") return;
      const origin = originFromCardAction(card, index);
      const current = findSharedSkillForAction(action);
      if (current) {
        const origins = mergeOrigins(current.originActions, [origin]);
        state.skills.set(current.id, {
          ...current,
          originActions: origins,
          ...singleOriginFields(origins),
        });
        return;
      }
      const skill = cardActionToSkill(card, action, index);
      state.skills.set(skill.id, skill);
      added += 1;
    });
  }
  return added;
}

function loadCardForEdit(card = {}) {
  const kind = normalizeKind(card.kind);
  state.editingCardId = card.id || "";
  state.editingCardCollection = card._cloudCollection || collectionForKind(kind);
  state.editingCardSource = card.source || "creator";
  fillCardForm(card, { editing: true });
  setTab("card");
  setMsg("cardMsg", `${card.name || card.id || "カード"} を編集モードで開きました。同じIDで保存すると上書きします。`, true);
}

function duplicateEditingCard() {
  const oldId = text("cardId");
  const oldName = text("cardName");
  if (!oldId) return;
  $("cardId").value = normalizeId(`${oldId}_copy`, "copy");
  $("cardName").value = `${oldName || oldId} コピー`;
  state.editingCardId = "";
  state.editingCardCollection = "";
  setMsg("cardMsg", "複製モードにしました。IDを調整して保存すると別カードとして作成します。", true);
  renderAll();
}

function normalizeCardEffect(eff = {}) {
  if (!eff || typeof eff !== "object") return null;
  const trigger = CARD_EFFECT_TRIGGERS[eff.trigger] ? eff.trigger : (CARD_EFFECT_TRIGGERS[eff.when] ? eff.when : "onSummon");
  const type = CARD_EFFECT_TYPES[eff.type] ? eff.type : "heal";
  const target = CARD_EFFECT_TARGETS[eff.target] ? eff.target : "self";
  const out = {
    trigger,
    type,
    target,
    rate: Math.max(0, Math.min(100, Math.trunc(Number(eff.rate ?? 100)))),
  };
  const hp = Number(eff.hp ?? eff.heal ?? eff.damage ?? 0);
  const sp = Number(eff.sp ?? 0);
  const n = Number(eff.n ?? eff.amount ?? eff.delta ?? eff.v ?? 0);
  if (Number.isFinite(hp) && hp) out.hp = Math.trunc(hp);
  if (Number.isFinite(sp) && sp) out.sp = Math.trunc(sp);
  if (Number.isFinite(n) && n) {
    if (type === "draw") out.n = Math.max(1, Math.trunc(Math.abs(n)));
    else if (type === "manaUp") out.amount = Math.trunc(n);
    else if (type === "powerUp" || type === "modRate") out.delta = Math.trunc(n);
    else if (type === "addStatus") {
      out.v = Math.trunc(n);
      out.turns = Math.max(1, Math.trunc(Number(eff.turns ?? 2)));
    }
  }
  if (type === "addStatus") out.status = eff.status || "bleed";
  if (eff.name || eff.label) out.name = String(eff.name || eff.label);
  return out;
}

function buildCardEffectFromForm() {
  const type = text("cardEffectType") || "heal";
  const eff = {
    trigger: text("cardEffectTrigger") || "onSummon",
    type,
    target: text("cardEffectTarget") || "self",
    rate: num("cardEffectRate", 100),
  };
  const hp = num("cardEffectHp", 0);
  const sp = num("cardEffectSp", 0);
  const n = num("cardEffectN", 1);
  if (type === "heal" || type === "dmg") {
    if (hp) eff.hp = Math.abs(hp);
    if (sp) eff.sp = Math.abs(sp);
  } else if (type === "draw") {
    eff.n = Math.max(1, Math.abs(n));
  } else if (type === "manaUp") {
    eff.amount = n;
  } else if (type === "powerUp" || type === "modRate") {
    eff.delta = n;
  } else if (type === "addStatus") {
    eff.status = text("cardEffectStatus") || "bleed";
    eff.v = Math.max(1, Math.abs(n));
    eff.turns = 2;
  }
  return normalizeCardEffect(eff);
}

function cardEffectSummary(eff) {
  const e = normalizeCardEffect(eff);
  if (!e) return "";
  const parts = [
    CARD_EFFECT_TRIGGERS[e.trigger] || e.trigger,
    CARD_EFFECT_TYPES[e.type] || e.type,
    CARD_EFFECT_TARGETS[e.target] || e.target,
  ];
  if (e.hp) parts.push(`HP${e.type === "heal" ? "+" : "-"}${Math.abs(e.hp)}`);
  if (e.sp) parts.push(`SP${e.type === "heal" ? "+" : "-"}${Math.abs(e.sp)}`);
  if (e.n) parts.push(`+${e.n}枚`);
  if (e.amount) parts.push(`マナ${e.amount >= 0 ? "+" : ""}${e.amount}`);
  if (e.delta) parts.push(`${e.type === "modRate" ? "命中" : "威力"}${e.delta >= 0 ? "+" : ""}${e.delta}`);
  if (e.status) parts.push(e.status);
  if (e.rate !== 100) parts.push(`${e.rate}%`);
  return parts.join(" / ");
}

function setCardEffects(effects = []) {
  state.cardEffects = (Array.isArray(effects) ? effects : [])
    .map(normalizeCardEffect)
    .filter(Boolean);
  renderCardEffects();
  renderCardPreview();
}

function addCardEffectFromForm() {
  const eff = buildCardEffectFromForm();
  if (!eff) return;
  state.cardEffects = [...state.cardEffects, eff];
  renderCardEffects();
  renderCardPreview();
}

function renderCardEffects() {
  const box = $("cardEffectList");
  if (!box) return;
  box.innerHTML = state.cardEffects.length
    ? state.cardEffects.map((eff, i) => `
      <span class="cardEffectChip">
        ${esc(cardEffectSummary(eff))}
        <button type="button" data-remove-card-effect="${i}" style="padding:0 4px;border:0;background:transparent">×</button>
      </span>
    `).join("")
    : `<span class="hint">誘発効果なし</span>`;
  box.querySelectorAll("[data-remove-card-effect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove-card-effect"));
      state.cardEffects = state.cardEffects.filter((_, i) => i !== idx);
      renderCardEffects();
      renderCardPreview();
    });
  });
}

function buildCardFromForm() {
  const kind = normalizeKind(text("cardKind"));
  const id = normalizeId(text("cardId"), kind === "support" ? "support" : "unit");
  const name = text("cardName") || "新しいカード";
  const attr = ATTRS.has(text("attr")) ? text("attr") : "火";
  const extra = safeJson(text("extraJson"), {});
  const series = text("series") || "ガチャ";
  const base = {
    id,
    name,
    kind,
    type: kind === "unit" ? attr : "support",
    attr: kind === "unit" ? attr : "",
    rarity: text("rarity") || "R",
    cost: num("cost", 1),
    theme: text("theme"),
    series,
    source: seriesSource(series, state.editingCardSource || "creator"),
    desc: text("desc"),
    hidden: $("hidden")?.checked === true,
    updatedAtClient: new Date().toISOString(),
    ...extra,
  };

  if (kind === "unit") {
    base.hp = num("hp", 30);
    base.sp = num("sp", 20);
    const formEffects = state.cardEffects.map(normalizeCardEffect).filter(Boolean);
    if (formEffects.length) base.cardEffects = formEffects;
    base.actions = state.selectedSkills
      .map((sid) => state.skills.get(sid))
      .filter(Boolean)
      .map(skillToAction);
    if (!base.actions.length) {
      base.actions = [{
        name: "通常攻撃",
        cost: 1,
        range: "front1",
        rate: 75,
        hpDelta: -10,
        spDelta: 0,
      }];
    }
  } else {
    base.effect = state.editingSupportEffectRaw && !state.supportEffectDirty
      ? state.editingSupportEffectRaw
      : buildSupportEffect();
  }

  return base;
}

function fillSkillForm(skill = {}) {
  const origins = skillOriginList(skill);
  state.editingSkillOrigin = origins.length ? {
    origins,
    source: skill.source || "card_action",
    sourceLabel: skill.sourceLabel || (skill.source === "actions_public" ? "既存技" : "カード技"),
  } : null;
  $("skillId").value = skill.id || "";
  $("skillName").value = skill.name || "";
  $("skillCost").value = skill.cost ?? 1;
  $("skillRate").value = skill.rate ?? 75;
  $("skillRange").value = skill.range || "front1";
  $("skillTheme").value = skill.theme || "";
  $("skillHpDelta").value = skill.hpDelta ?? -10;
  $("skillSpDelta").value = skill.spDelta ?? 0;
  $("skillStatus").value = skill.addStatus || skill.status || "";
  $("skillStatusValue").value = skill.addStatus ? `${skill.statusValue || 1},${skill.statusTurns || 2}` : "";
  $("skillDraw").value = skill.draw ?? 0;
  const handEffect = Array.isArray(skill.handEffects) ? skill.handEffects[0] : skill.handEffect;
  $("skillHandEffect").value = handEffect?.type || "";
  $("skillHandTarget").value = handEffect?.targetSeat || handEffect?.target || "enemy";
  $("skillHandCount").value = handEffect?.count ?? handEffect?.n ?? 1;
  $("skillTags").value = cleanSkillTags(skill.tags).join("+");
  $("skillExtraJson").value = "";
  renderSkillPreview();
}

function fillCardForm(card = {}, opts = {}) {
  const kind = normalizeKind(card.kind);
  if (!opts.editing) {
    state.editingCardId = "";
    state.editingCardCollection = "";
    state.editingCardSource = "";
  }
  state.editingSupportEffectRaw = null;
  state.supportEffectDirty = false;
  $("cardId").value = card.id || "";
  $("cardName").value = card.name || "";
  $("cardKind").value = kind;
  $("rarity").value = card.rarity || "R";
  $("attr").value = card.attr || card.type || "火";
  $("cost").value = card.cost ?? 2;
  $("hp").value = card.hp ?? 30;
  $("sp").value = card.sp ?? 20;
  $("theme").value = card.theme || card.pack || "";
  setSeriesValue(card.series || card.source || "ガチャ");
  $("desc").value = card.desc || card.note || "";
  $("hidden").checked = card.hidden === true;
  $("giveSelf").checked = false;
  $("extraJson").value = "";
  state.selectedSkills = [];
  if (kind === "unit") {
    const actions = Array.isArray(card.actions) ? card.actions : [];
    state.selectedSkills = actions.map((action, i) => {
      const skill = skillFromAction(action, card.id || "card", i);
      state.skills.set(skill.id, skill);
      return skill.id;
    });
  } else {
    state.editingSupportEffectRaw = card.effect && typeof card.effect === "object" ? card.effect : null;
    fillSupportEffectForm(card.effect || {});
  }
  state.cardEffects = (Array.isArray(card.cardEffects) ? card.cardEffects : Array.isArray(card.effects) ? card.effects : [])
    .map(normalizeCardEffect)
    .filter(Boolean);
  updateKindUi();
  renderAll();
}

function renderCardFace(card) {
  const face = $("cardFace");
  if (!face) return;
  const actions = Array.isArray(card.actions) ? card.actions : [];
  const cardEffects = (Array.isArray(card.cardEffects) ? card.cardEffects : Array.isArray(card.effects) ? card.effects : [])
    .map(normalizeCardEffect)
    .filter(Boolean);
  const effectText = card.effect ? JSON.stringify(card.effect) : "";
  const kind = card.kind || "unit";
  const isSupport = kind !== "unit";
  const attr = card.attr || card.type || (isSupport ? "補" : "-");
  face.innerHTML = `
    <div class="creatorCardFaceTop">
      <div class="creatorCardVisual">
        ${cardArtImgHtml(card.id || "preview_card", card, "creatorCardArtImg")}
        <span class="creatorCardCost">${esc(card.cost ?? 0)}</span>
      </div>
      <div class="creatorCardInfo">
        <div class="creatorCardBadges">
          <span class="pill">${esc(card.rarity || "R")}</span>
          <span class="pill">${esc(isSupport ? "サポート" : "キャラ")}</span>
          ${card.hidden ? `<span class="pill" style="color:var(--bad)">非公開</span>` : ""}
        </div>
        <h2>${esc(card.name || "新しいカード")}</h2>
        <div class="meta">
          ${esc(card.theme || "テーマ未設定")} / ${esc(card.series || "ガチャ")}<br>
          ${isSupport ? `cost:${esc(card.cost)} / ${esc(effectText || "効果未設定")}` : `${esc(attr)} / cost:${esc(card.cost)} / HP:${esc(card.hp)} SP:${esc(card.sp)}`}
        </div>
      </div>
    </div>
    <div class="creatorCardLines">
      ${cardEffects.map((e) => `<div class="skillLine">効果: ${esc(cardEffectSummary(e))}</div>`).join("")}
      ${actions.map((a) => `<div class="skillLine">${esc(actionSummary(a))}</div>`).join("")}
      ${!cardEffects.length && !actions.length && !effectText ? `<div class="skillLine">効果・技は未設定です。</div>` : ""}
    </div>
  `;
}

function renderCardPreview() {
  let card;
  try {
    card = buildCardFromForm();
    $("cardJson").textContent = JSON.stringify(card, null, 2);
    renderCardFace(card);
  } catch (e) {
    $("cardJson").textContent = String(e?.message || e);
  }
}

function renderSkillPreview() {
  try {
    const skill = buildSkillFromForm();
    $("skillJson").textContent = JSON.stringify(skill, null, 2);
    renderSkillRangePreview();
  } catch (e) {
    $("skillJson").textContent = String(e?.message || e);
    renderSkillRangePreview();
  }
}

function renderSkillPicker() {
  const box = $("skillPicker");
  if (!box) return;
  const q = state.actionSearch.toLowerCase();
  const list = [...state.skills.values()]
    .filter((s) => !q || `${s.id} ${s.actionId || ""} ${s.name} ${s.theme} ${s.role || ""} ${s.ownerType || ""} ${s.originCardName || ""} ${s.originCardId || ""} ${(s.originActions || []).map((o) => `${o.cardName} ${o.cardId}`).join(" ")} ${Array.isArray(s.tags) ? s.tags.join(" ") : ""}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const as = a.source === "actions_public" ? 1 : 0;
      const bs = b.source === "actions_public" ? 1 : 0;
      return as - bs || String(a.name).localeCompare(String(b.name), "ja");
    });
  if (!list.length) {
    box.innerHTML = `<div class="hint">条件に合う技がありません。検索を変えるか、既存技を再読込してください。</div>`;
    return;
  }
  box.innerHTML = list.map((s) => {
    const active = state.selectedSkills.includes(s.id);
    const sourceLabel = s.source === "actions_public" ? "既存" : s.source === "card_action" ? "カード技" : "作成";
    const origins = skillOriginList(s);
    return `
      <button class="skillChip ${active ? "active" : ""}" type="button" data-pick-skill="${esc(s.id)}">
        <span class="pill" style="padding:2px 6px;margin-bottom:5px">${esc(sourceLabel)}</span>
        ${s.ownerType ? `<span class="pill" style="padding:2px 6px;margin-bottom:5px">${esc(s.ownerType)}</span>` : ""}
        ${origins.length ? `<span class="pill" style="padding:2px 6px;margin-bottom:5px">使用 ${origins.length}枚</span>` : ""}
        <b>${esc(s.name || s.id)}</b><br>
        <span class="hint">${esc(actionSummary(s))}</span>
        <div class="rangeInline">${rangeVizHtml(s.range || "front1")}<span class="rangeLabel">${esc(s.range || "front1")}</span></div>
      </button>
    `;
  }).join("");
  box.querySelectorAll("[data-pick-skill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pick-skill");
      if (state.selectedSkills.includes(id)) {
        state.selectedSkills = state.selectedSkills.filter((x) => x !== id);
      } else {
        state.selectedSkills.push(id);
      }
      renderAll();
    });
  });
}

function renderSkillList() {
  const box = $("skillList");
  if (!box) return;
  const q = state.skillSearch.toLowerCase();
  const list = [...state.skills.values()]
    .filter((s) => !q || `${s.id} ${s.actionId || ""} ${s.name} ${s.theme} ${s.role || ""} ${s.ownerType || ""} ${s.originCardName || ""} ${s.originCardId || ""} ${(s.originActions || []).map((o) => `${o.cardName} ${o.cardId}`).join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => String(a.theme || "").localeCompare(String(b.theme || ""), "ja") || String(a.name).localeCompare(String(b.name), "ja"));
  box.innerHTML = list.length ? list.map((s) => `
    <div class="item" data-skill-id="${esc(s.id)}">
      <div class="itemTitle">
        ${esc(s.name || s.id)}
        ${s.source === "actions_public" ? `<span class="pill">既存技</span>` : ""}
        ${s.source === "card_action" ? `<span class="pill">カード技</span>` : ""}
        ${skillOriginList(s).length ? `<span class="pill">使用 ${skillOriginList(s).length}枚</span>` : ""}
        ${s.cloudScope === "queued" ? `<span class="pill">未同期</span>` : ""}
      </div>
      <div class="itemMeta">${esc(s.theme || "テーマなし")} / ${esc(actionSummary(s))}</div>
    </div>
  `).join("") : `<div class="hint">技テンプレはまだありません。</div>`;
  box.querySelectorAll("[data-skill-id]").forEach((el) => {
    el.addEventListener("click", () => fillSkillForm(state.skills.get(el.getAttribute("data-skill-id"))));
  });
}

function renderCardList() {
  const box = $("cardList");
  if (!box) return;
  const q = state.cardSearch.toLowerCase();
  const list = [...state.cards.values()]
    .filter((c) => !q || `${c.id} ${c.name} ${c.theme} ${c.series} ${c.attr} ${c.type}`.toLowerCase().includes(q))
    .sort((a, b) => String(a.theme || "").localeCompare(String(b.theme || ""), "ja") || String(a.name).localeCompare(String(b.name), "ja"));
  box.innerHTML = list.length ? list.slice(0, 80).map((c) => `
    <div class="item ${state.editingCardId === c.id ? "active" : ""}" data-card-id="${esc(c.id)}">
      <div class="itemTitle">
        ${esc(c.name || c.id)}
        ${state.editingCardId === c.id ? `<span class="pill">編集中</span>` : ""}
        ${c._syncQueued ? `<span class="pill">未同期</span>` : ""}
      </div>
      <div class="itemMeta">${esc(c.kind || "unit")} / ${esc(c.attr || c.type || "")} / ${esc(c.theme || c.series || "テーマなし")}<br>ID: ${esc(c.id)} / ${esc(c._cloudCollection || collectionForKind(c.kind))}</div>
      <div class="itemTools">
        <button type="button" data-edit-card="${esc(c.id)}">編集</button>
        <button type="button" data-copy-card="${esc(c.id)}">複製</button>
      </div>
    </div>
  `).join("") : `<div class="hint">既存カードはまだ読み込めていません。</div>`;
  box.querySelectorAll("[data-card-id]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      if (ev.target?.closest?.("button")) return;
      loadCardForEdit(state.cards.get(el.getAttribute("data-card-id")));
    });
  });
  box.querySelectorAll("[data-edit-card]").forEach((btn) => {
    btn.addEventListener("click", () => loadCardForEdit(state.cards.get(btn.getAttribute("data-edit-card"))));
  });
  box.querySelectorAll("[data-copy-card]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadCardForEdit(state.cards.get(btn.getAttribute("data-copy-card")));
      duplicateEditingCard();
    });
  });
}

function skillPower(skill) {
  const hp = Math.abs(Number(skill.hpDelta || 0));
  const sp = Math.abs(Number(skill.spDelta || 0)) * 2;
  const rate = Math.max(20, Number(skill.rate || 75)) / 100;
  const cost = Math.max(0, Number(skill.cost || 0));
  let score = (hp + sp) * rate - cost * 4;
  if (skill.draw) score += Number(skill.draw) * 10;
  if (skill.addStatus || skill.status) score += 8;
  return Math.round(score);
}

function cardPower(card) {
  if (card.kind !== "unit") {
    const effect = card.effect || {};
    let score = Number(effect.rate || 80) / 10 - Number(card.cost || 0) * 3;
    if (effect.type === "draw") score += Number(effect.n || 1) * 8;
    if (effect.type === "search") score += 16;
    if (effect.type === "setCard") score += 14;
    if (effect.type === "heal") score += (Number(effect.hp || 0) + Number(effect.sp || 0) * 2) / 2;
    if (effect.type === "dmg") score += (Number(effect.hp || 0) + Number(effect.sp || 0) * 2) / 2;
    return Math.round(score);
  }
  const base = Number(card.hp || 0) * 0.35 + Number(card.sp || 0) * 0.45 - Number(card.cost || 0) * 3;
  const actions = Array.isArray(card.actions) ? card.actions : [];
  const actionScore = actions.reduce((sum, a) => sum + skillPower(a), 0);
  return Math.round(base + actionScore);
}

function powerClass(score) {
  if (score >= 72) return "bad";
  if (score >= 54) return "warn";
  return "good";
}

function currentCardAdvice() {
  let card;
  try {
    card = buildCardFromForm();
  } catch (e) {
    return { score: 0, text: `カード診断不可: ${e?.message || e}`, cls: "bad" };
  }
  const score = cardPower(card);
  const tips = [];
  if (card.kind === "unit") {
    const actions = Array.isArray(card.actions) ? card.actions : [];
    const hasSp = actions.some((a) => Number(a.spDelta || 0) < 0);
    const hasHp = actions.some((a) => Number(a.hpDelta || 0) < 0);
    const hasStatus = actions.some((a) => a.addStatus || a.status);
    if (!hasHp) tips.push("HPへ触る技がない");
    if (!hasSp) tips.push("SP干渉がない");
    if (!hasStatus && actions.length >= 3) tips.push("3技構成なら状態異常を1つ入れると個性が出る");
    if (score >= 72) tips.push("強すぎ注意。HP/SPか技威力を少し落とすと安全");
  } else if (card.effect?.type === "search" && Number(card.cost || 0) <= 1) {
    tips.push("サーチは強いのでコスト2以上か成功率低めが無難");
  }
  if (!tips.length) tips.push("このまま試作してよさそう");
  return { score, text: tips.join(" / "), cls: powerClass(score) };
}

function renderThemePanel() {
  const title = $("themeTitle");
  if (!title) return;
  const theme = currentTheme();
  const accent = ATTR_COLORS[theme.attr] || "#7dd3fc";
  document.documentElement.style.setProperty("--accent", accent);
  title.textContent = theme.name;
  $("themePitch").textContent = `${theme.attr}属性 / ${ROLE_LABELS[theme.role] || "バランス"}型。${ATTR_TRAITS[theme.attr] || ""}`;
  const themeSkills = themeSkillDrafts(theme);
  const skillScores = themeSkills.map(skillPower);
  const avg = Math.round(skillScores.reduce((a, b) => a + b, 0) / Math.max(1, skillScores.length));
  const cardAdvice = currentCardAdvice();
  $("themeMetrics").innerHTML = `
    <div class="metric"><b>${esc(theme.attr)}</b><span>主属性</span></div>
    <div class="metric"><b>${esc(ROLE_LABELS[theme.role] || theme.role)}</b><span>得意役割</span></div>
    <div class="metric"><b class="score ${powerClass(avg)}">${esc(avg)}</b><span>技平均スコア</span></div>
    <div class="metric"><b class="score ${cardAdvice.cls}">${esc(cardAdvice.score)}</b><span>編集中カード</span></div>
  `;
  $("themeAdvice").innerHTML = `
    <b>制作メモ</b><br>
    ${esc(cardAdvice.text)}<br>
    ${esc(theme.memo || "まずは技セット生成、その後キャラ草案とサポート草案を1枚ずつ作るのがおすすめ。")}
  `;
  $("themeJson").textContent = JSON.stringify({
    theme,
    suggestedSkills: themeSkills,
    currentCardScore: cardAdvice.score,
    advice: cardAdvice.text,
  }, null, 2);
}

function renderThemeTemplates() {
  const box = $("themeTemplateList");
  if (!box) return;
  const list = localThemeTemplates();
  if (!list.length) {
    box.innerHTML = `<div class="hint">よく使うテーマを保存すると、初期カード・時織カードなどの追加が楽になります。</div>`;
    return;
  }
  box.innerHTML = list.map((t, i) => `
    <div class="themeTemplateItem">
      <div>
        <b>${esc(t.name || "無名テーマ")}</b>
        <span>${esc(t.attr || "-")} / ${esc(ROLE_LABELS[t.role] || t.role || "-")} / ${esc(t.series || "ガチャ")} / ${esc(t.prefix || "")}</span>
      </div>
      <div class="themeTemplateActions">
        <button type="button" data-theme-template-load="${i}">読込</button>
        <button type="button" data-theme-template-delete="${i}">削除</button>
      </div>
    </div>
  `).join("");
  box.querySelectorAll("[data-theme-template-load]").forEach((btn) => {
    btn.addEventListener("click", () => applyThemeTemplate(Number(btn.getAttribute("data-theme-template-load"))));
  });
  box.querySelectorAll("[data-theme-template-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteThemeTemplate(Number(btn.getAttribute("data-theme-template-delete"))));
  });
}

function renderAll() {
  renderSyncStatus();
  updateActionSourceState();
  renderSkillPicker();
  renderSkillList();
  renderCardList();
  renderCardEffects();
  renderCardPreview();
  renderSkillPreview();
  renderThemePanel();
  renderThemeTemplates();
}

function setTab(tab) {
  state.tab = tab === "skill" || tab === "theme" ? tab : "card";
  $("tabTheme")?.classList.toggle("active", state.tab === "theme");
  $("tabCard")?.classList.toggle("active", state.tab === "card");
  $("tabSkill")?.classList.toggle("active", state.tab === "skill");
  $("themePanel")?.classList.toggle("hidden", state.tab !== "theme");
  $("cardPanel")?.classList.toggle("hidden", state.tab !== "card");
  $("skillPanel")?.classList.toggle("hidden", state.tab !== "skill");
}

function updateKindUi() {
  const kind = normalizeKind(text("cardKind"));
  document.querySelectorAll(".unitOnly").forEach((el) => el.classList.toggle("hidden", kind !== "unit"));
  document.querySelectorAll(".supportOnly").forEach((el) => el.classList.toggle("hidden", kind === "unit"));
}

async function loadCards() {
  const embeddedCards = [
    ...FAIRY_TALE_CARD_LIST.map((card) => ({
      ...card,
      kind: normalizeKind(card.kind),
      _cloudCollection: "cards",
      _embeddedSource: "fairy_tale_cards",
    })),
    ...JEWEL_CARD_LIST.map((card) => ({
      ...card,
      kind: normalizeKind(card.kind),
      _cloudCollection: card.kind === "support" ? "support_cards" : "cards",
      _embeddedSource: "jewel_cards",
    })),
  ];
  const entries = [...embeddedCards, ...localCards()];
  const specs = [
    ["cards", "unit"],
    ["support_cards", "support"],
    ["supports", "support"],
    ["supportCards", "support"],
    ["ex_support_cards", "ex_support"],
    ["ex_supports", "ex_support"],
    ["exSupportCards", "ex_support"],
    ["ex_support", "ex_support"],
  ];
  for (const [col, kind] of specs) {
    try {
      const snap = await getDocs(collection(db, col));
      snap.forEach((d) => {
        const data = d.data() || {};
        entries.push({ id: data.id || d.id, kind: normalizeKind(data.kind || kind), ...data, _cloudCollection: col });
      });
    } catch {}
  }
  state.cards = new Map(entries.map((c) => [c.id, c]));
  applyQueuedItemsToState();
  upsertCardActionSkillsFromCards(state.cards.values());
  normalizeStoredSkillTags();
  saveLocalCards();
  saveLocalSkills();
}

async function loadSkills() {
  state.skills = new Map(localSkills().map((s) => [s.id, s]));
  let primarySharedOk = true;
  try {
    const snap = await getDocs(collection(db, "card_skills"));
    snap.forEach((d) => {
      const data = d.data() || {};
      state.skills.set(data.id || d.id, { id: data.id || d.id, ...data });
    });
  } catch {
    primarySharedOk = false;
  }
  const mirrorCount = await loadMirroredSkills();
  if (!primarySharedOk) {
    setMsg(
      "skillMsg",
      mirrorCount
        ? `全体共有DBは権限不足です。代替共有テンプレ ${mirrorCount}件を読み込みました。`
        : "全体共有DBは権限不足です。保存時は代替共有/ユーザー保存に切り替えます。",
      true,
    );
  }
  if (state.uid) {
    try {
      const userSnap = await getDoc(profileDocRef());
      const creatorSkills = userSnap.exists() ? userSnap.data()?.creatorSkills : null;
      if (creatorSkills && typeof creatorSkills === "object") {
        Object.entries(creatorSkills).forEach(([id, data]) => {
          if (!data || typeof data !== "object") return;
          state.skills.set(data.id || id, { id: data.id || id, ...data, cloudScope: data.cloudScope || "user" });
        });
      }
    } catch (e) {
      console.warn("[creator] user skill cloud load failed", e?.message || e);
    }
  }
  normalizeStoredSkillTags();
}

async function saveSkill() {
  try {
    if (!state.isAdmin) throw new Error("管理者権限が必要です");
    const skill = buildSkillFromForm();
    state.skills.set(skill.id, skill);
    saveLocalSkills();
    try {
      const result = await uploadSkillWithFallback(skill);
      removeQueuedSync((item) => item.kind === "skill" && item.id === skill.id);
      const label = result.mode === "global" ? "クラウド保存" : result.mode === "mirror" ? "共有テンプレ保存" : "ユーザー側クラウド保存";
      const originResult = await applySkillToOriginCards(skill);
      const originNote = originResult.applied
        ? originResult.cloudSaved
          ? ` / 元カード${originResult.cardName}にも反映`
          : ` / 元カード${originResult.cardName}はローカル更新・未同期`
        : originResult.warning
          ? ` / ${originResult.warning}`
          : "";
      setMsg("skillMsg", `技を${label}しました: ${skill.name}${originNote}`, originResult.applied ? originResult.cloudSaved : true);
    } catch (e) {
      state.skills.set(skill.id, {
        ...skill,
        cloudScope: "queued",
        source: skill.source || "creator_queued",
      });
      saveLocalSkills();
      const originResult = await applySkillToOriginCards(skill);
      enqueueSync({
        kind: "skill",
        id: skill.id,
        collection: "card_skills",
        payload: skill,
        message: skill.name,
        lastError: String(e?.message || e),
      });
      const originNote = originResult.applied
        ? originResult.cloudSaved
          ? " / 元カードは更新済み"
          : " / 元カードもローカル更新・未同期"
        : "";
      setMsg("skillMsg", `クラウド保存は失敗。ローカル保存して未同期キューへ入れました: ${skill.name}${originNote}`, false);
    }
    renderAll();
  } catch (e) {
    setMsg("skillMsg", String(e?.message || e), false);
  }
}

async function deleteSkill() {
  try {
    if (!state.isAdmin) throw new Error("管理者権限が必要です");
    const id = normalizeId(text("skillId"), "");
    if (!id || !state.skills.has(id)) throw new Error("削除する技を選んでください");
    state.skills.delete(id);
    state.selectedSkills = state.selectedSkills.filter((x) => x !== id);
    saveLocalSkills();
    try {
      await deleteDoc(doc(db, "card_skills", id));
    } catch {}
    try {
      await deleteDoc(doc(db, "decks", creatorSkillDeckId(id)));
    } catch {}
    try {
      await setDoc(profileDocRef(), {
        creatorSkills: {
          [id]: null,
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch {}
    fillSkillForm({});
    setMsg("skillMsg", `技を削除しました: ${id}`, true);
    renderAll();
  } catch (e) {
    setMsg("skillMsg", String(e?.message || e), false);
  }
}

async function saveCard() {
  try {
    if (!state.isAdmin) throw new Error("管理者権限が必要です");
    const card = buildCardFromForm();
    const col = collectionForKind(card.kind);
    const isOverwrite = !!state.editingCardId && state.editingCardId === card.id;
    const oldCol = state.editingCardCollection;
    const giveSelf = $("giveSelf")?.checked === true;
    let cloudSaved = true;
    try {
      await uploadCardToCloud(card, { collection: col, isOverwrite, oldCollection: oldCol, giveSelf });
      removeQueuedSync((item) => item.kind === "card" && item.id === card.id);
    } catch (e) {
      cloudSaved = false;
      enqueueSync({
        kind: "card",
        id: card.id,
        collection: col,
        payload: card,
        options: { collection: col, isOverwrite, oldCollection: oldCol, giveSelf },
        message: card.name,
        lastError: String(e?.message || e),
      });
    }
    state.cards.set(card.id, { ...card, _cloudCollection: col, _syncQueued: !cloudSaved });
    saveLocalCards();
    state.editingCardId = card.id;
    state.editingCardCollection = col;
    state.editingCardSource = card.source || "creator";
    setMsg(
      "cardMsg",
      cloudSaved
        ? `${card.name} を ${col} に${isOverwrite ? "上書き" : "保存"}しました${giveSelf ? " / 自分に4枚付与しました" : ""}`
        : `${card.name} はローカル保存しました。未同期キューに入れたのでオンライン復帰後に同期します。`,
      cloudSaved,
    );
    renderAll();
  } catch (e) {
    setMsg("cardMsg", String(e?.message || e), false);
  }
}

function bindInputs() {
  document.querySelectorAll("input,select,textarea").forEach((el) => {
    el.addEventListener("input", () => {
      if (el.id === "cardKind") updateKindUi();
      if (el.id && el.id.startsWith("effect")) state.supportEffectDirty = true;
      if (el.id === "series") syncSeriesPreset();
      renderCardPreview();
      renderSkillPreview();
      if (el.id.startsWith("theme")) renderThemePanel();
    });
    el.addEventListener("change", () => {
      if (el.id === "cardKind") updateKindUi();
      if (el.id && el.id.startsWith("effect")) state.supportEffectDirty = true;
      if (el.id === "series") syncSeriesPreset();
      renderCardPreview();
      renderSkillPreview();
      if (el.id.startsWith("theme")) renderThemePanel();
    });
  });

  $("tabTheme")?.addEventListener("click", () => setTab("theme"));
  $("tabCard")?.addEventListener("click", () => setTab("card"));
  $("tabSkill")?.addEventListener("click", () => setTab("skill"));
  $("btnDeck")?.addEventListener("click", () => { location.href = "./index.html"; });
  $("btnProfile")?.addEventListener("click", () => { location.href = "./profile.html"; });
  $("btnApplyTheme")?.addEventListener("click", applyThemeToForms);
  $("btnSaveThemeTemplate")?.addEventListener("click", saveCurrentThemeTemplate);
  $("btnGenerateThemeSkills")?.addEventListener("click", () => upsertThemeSkills(true));
  $("btnDraftThemeUnit")?.addEventListener("click", draftThemeUnit);
  $("btnDraftThemeSupport")?.addEventListener("click", draftThemeSupport);
  $("btnCopyThemeJson")?.addEventListener("click", copyThemeJson);
  $("btnAutoCardId")?.addEventListener("click", autoCardId);
  $("btnAutoSkillId")?.addEventListener("click", autoSkillId);
  $("btnBalanceCard")?.addEventListener("click", showCardDiagnosis);
  $("btnDuplicateCard")?.addEventListener("click", duplicateEditingCard);
  $("btnReloadCards")?.addEventListener("click", async () => {
    await loadCards();
    renderAll();
    setMsg("cardMsg", `クラウドカードを再読込しました: ${state.cards.size}件`, true);
  });
  $("btnLoadPublicActions")?.addEventListener("click", () => loadPublicActions({ overwrite: true }));
  $("btnAddRangePart")?.addEventListener("click", addRangePartFromBuilder);
  $("btnClearRangeParts")?.addEventListener("click", () => setRangeParts([]));
  $("skillFlagAoe")?.addEventListener("click", () => toggleSkillFlag("aoe"));
  $("skillFlagPierce")?.addEventListener("click", () => toggleSkillFlag("pierce"));
  $("btnAddCardEffect")?.addEventListener("click", addCardEffectFromForm);
  $("btnClearCardEffects")?.addEventListener("click", () => setCardEffects([]));
  document.querySelectorAll("[data-range-dir]").forEach((btn) => {
    btn.addEventListener("click", () => selectRangeDir(btn.getAttribute("data-range-dir")));
  });
  $("btnSaveSkill")?.addEventListener("click", saveSkill);
  $("btnCopySkillCsv")?.addEventListener("click", copyCurrentSkillCsv);
  $("btnDeleteSkill")?.addEventListener("click", deleteSkill);
  $("btnSaveCard")?.addEventListener("click", saveCard);
  $("btnSyncNow")?.addEventListener("click", () => flushSyncQueue({ silent: false }));
  $("btnNewSkill")?.addEventListener("click", () => fillSkillForm({}));
  $("btnNewCard")?.addEventListener("click", () => fillCardForm({ series: "ガチャ" }));
  $("seriesPreset")?.addEventListener("change", () => {
    const value = $("seriesPreset")?.value || "ガチャ";
    if (value !== "カスタム") setSeriesValue(value);
    renderCardPreview();
  });
  $("cardSearch")?.addEventListener("input", (e) => {
    state.cardSearch = e.target.value || "";
    renderCardList();
  });
  $("skillSearch")?.addEventListener("input", (e) => {
    state.skillSearch = e.target.value || "";
    renderSkillList();
  });
  $("actionSearch")?.addEventListener("input", (e) => {
    state.actionSearch = e.target.value || "";
    renderSkillPicker();
  });
  document.querySelectorAll("[data-theme-preset]").forEach((btn) => {
    btn.addEventListener("click", () => setThemePreset(btn.getAttribute("data-theme-preset")));
  });
  window.addEventListener("online", () => {
    renderSyncStatus();
    flushSyncQueue({ silent: true }).catch((e) => console.warn("[creator] auto sync failed", e?.message || e));
  });
  window.addEventListener("offline", renderSyncStatus);
}

function seedStarterSkills() {
  if (state.skills.size) return;
  [
    { id: "basic_front_hit", name: "正面打撃", cost: 1, range: "front1", rate: 75, hpDelta: -10, spDelta: 0, theme: "基本" },
    { id: "basic_sp_cut", name: "集中崩し", cost: 1, range: "front1", rate: 70, hpDelta: 0, spDelta: -10, theme: "基本" },
    { id: "basic_wide_hit", name: "横薙ぎ", cost: 2, range: "rf1+lf1", rate: 60, hpDelta: -20, spDelta: 0, theme: "基本" },
    { id: "basic_self_heal", name: "立て直し", cost: 1, range: "self", rate: 85, hpDelta: 10, spDelta: 0, theme: "基本" },
  ].forEach((s) => state.skills.set(s.id, s));
  saveLocalSkills();
}

async function init() {
  bindInputs();
  const profile = await ensureUserProfile();
  state.uid = profile?.uid || "";
  state.isAdmin = profile?.data?.isAdmin === true;
  $("adminState").textContent = state.isAdmin ? "管理者: ON" : "管理者権限なし";
  $("adminState").style.color = state.isAdmin ? "var(--ok)" : "var(--bad)";
  $("btnSaveCard").disabled = !state.isAdmin;
  $("btnSaveSkill").disabled = !state.isAdmin;
  $("btnDeleteSkill").disabled = !state.isAdmin;

  await loadSkills();
  seedStarterSkills();
  await loadPublicActions({ quiet: true });
  await loadCards();
  fillThemeForm(localTheme());
  updateKindUi();
  fillSkillForm(state.skills.get("basic_front_hit") || {});
  fillCardForm({ series: "ガチャ", theme: "", kind: "unit" });
  renderAll();
  if (syncQueue().length && (typeof navigator === "undefined" || navigator.onLine !== false)) {
    flushSyncQueue({ silent: true }).catch((e) => console.warn("[creator] startup sync failed", e?.message || e));
  }
}

init().catch((e) => {
  console.error(e);
  setMsg("cardMsg", `カード工房の起動に失敗しました: ${e?.message || e}`, false);
});
