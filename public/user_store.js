// public/user_store.js
// v20260726_post1
// Shared user profile, owned-card, gem, and match-history helpers.

import { db, ensureSignedIn } from "./auth.js?v=20260627_perm1";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
  serverTimestamp,
  increment,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export const USER_STORE_VERSION = "20260906_curse1";
export const STARTER_GEMS = 2400;
export const REWARD_WIN = 300;
export const REWARD_LOSE = 120;
export const REWARD_PITY_WIN = 5;
export const REWARD_PITY_LOSE = 2;
export const STARTER_CARD_COUNT = 4;
export const YOU_CARD_ID = "you";
export const YOU_ATTRIBUTES = ["火", "水", "雷", "草", "風", "鋼", "光", "闇", "幻", "呪"];
export const YOU_UPGRADE_COSTS = {
  attr: 5,
  hp: 10,
  sp: 15,
  skill1: 25,
  skill2: 40,
  skill3: 60,
  ability: 50,
  perk1: 25,
  perk2: 40,
};
export const STARTER_OWNED_VERSION = "20260705_starter_support30_v1";
export const STARTER_CARD_IDS = [
  "kummernhei",
  "normal_arm",
  "rare_arm",
  "nabe_tate",
  "itou1",
  "mamoru_kun",
  "normal_bokusi",
  "sendousi",
  "sensei1",
  "sito",
  "list_cutter",
  "yami_denkyo",
  "rock1",
  "rock2",
  "rock3",
  "wind1",
  "ninja1",
  "nausika",
  "plug",
  "INV1",
  "sennpuuki",
  "kenkyuui",
  "yamiisya",
  "inazou",
  "s001",
  "s002",
  "s003",
  "s004",
  "s005",
  "s006",
  "s007",
  "s008",
  "s009",
  "s010",
  "s011",
  "s012",
  "S101",
  "S102",
  "S103",
  "S104",
  "S105",
  "S106",
  "S107",
  "S108",
  "S109",
  "S110",
  "S111",
  "S112",
  "S113",
  "S114",
  "S115",
  "S116",
  "S117",
  "S118",
];
const STARTER_CARD_ID_SET = new Set(
  STARTER_CARD_IDS.map((id) => String(id || "").trim().toLowerCase()),
);

export const profileRef = (uid) => doc(db, "users", uid);
export const ownedCol = (uid) => collection(db, "users", uid, "owned");
export const ownedRef = (uid, cardId) => doc(db, "users", uid, "owned", cardId);
export const historyCol = (uid) => collection(db, "users", uid, "history");
export const gachaHistoryCol = (uid) => collection(db, "users", uid, "gachaHistory");

const PLAYER_NAME_KEY = "tcg_player_name_v20260202_30";

function normalizePlayerName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function playerNameIndexKey(name) {
  const lower = normalizePlayerName(name).toLowerCase();
  if (!lower) return "";
  return `user_name_${encodeURIComponent(lower).replaceAll("%", "_").slice(0, 140)}`;
}

function namePatchFrom(name) {
  const clean = normalizePlayerName(name);
  if (!clean) return {};
  const lower = clean.toLowerCase();
  return {
    name: clean,
    nameLower: lower,
    playerName: clean,
    playerNameLower: lower,
    displayName: clean,
    displayNameLower: lower,
  };
}

function localPlayerNamePatch() {
  try {
    return namePatchFrom(localStorage.getItem(PLAYER_NAME_KEY) || "");
  } catch {
    return {};
  }
}

async function writeHistorySafe(uid, payload) {
  try {
    await setDoc(doc(historyCol(uid)), { ...payload, at: serverTimestamp() });
  } catch (e) {
    console.warn("[user_store] history write skipped:", e?.message || e);
  }
}

function isPermissionError(e) {
  const msg = String(e?.code || e?.message || e || "").toLowerCase();
  return msg.includes("permission") || msg.includes("insufficient");
}

async function assertAdminUid(uid) {
  const actor = String(uid || "").trim();
  if (!actor) throw new Error("admin uid missing");
  const snap = await getDoc(profileRef(actor));
  if (!snap.exists() || snap.data()?.isAdmin !== true) {
    throw new Error("admin permission required");
  }
  return actor;
}

async function queueAdminGrant({
  adminUid,
  targetUid,
  grantKind,
  amount = 0,
  cardId = "",
  count = 0,
  reason = "",
  directError = "",
}) {
  const actor = await assertAdminUid(adminUid);
  const target = String(targetUid || "").trim();
  if (!target) throw new Error("target uid missing");
  const grantId = safeId(`admin_grant_${target}_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const payload = {
    type: "admin_grant",
    visibility: "public",
    title: `admin grant ${target.slice(0, 8)}`,
    grantId,
    grantKind,
    targetUid: target,
    adminUid: actor,
    amount: clampInt(amount, -999999999, 999999999),
    cardId: String(cardId || "").trim(),
    count: clampInt(count, 0, 999999),
    reason: String(reason || "").trim().slice(0, 160),
    directError: String(directError || "").slice(0, 220),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "decks", grantId), payload, { merge: true });
  return { uid: target, queued: true, grantId, amount: payload.amount, cardId: payload.cardId, count: payload.count };
}

export async function syncPlayerNameIndex(uid, name) {
  const actualUid = String(uid || "").trim();
  const clean = normalizePlayerName(name);
  const id = playerNameIndexKey(clean);
  if (!actualUid || !id) return false;

  const lower = clean.toLowerCase();
  try {
    await setDoc(
      doc(db, "decks", id),
      {
        type: "user_name_index",
        visibility: "public",
        title: `@${clean}`,
        ownerUid: actualUid,
        targetUid: actualUid,
        ownerName: clean,
        ownerNameLower: lower,
        playerName: clean,
        playerNameLower: lower,
        deck: {},
        deckCount: 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (e) {
    console.warn("[user_store] name index write skipped:", e?.message || e);
    return false;
  }
}

async function resolveUserByNameIndex(name) {
  const id = playerNameIndexKey(name);
  if (!id) return "";
  try {
    const snap = await getDoc(doc(db, "decks", id));
    if (!snap.exists()) return "";
    const data = snap.data() || {};
    if (data.type !== "user_name_index") return "";
    const uid = String(data.targetUid || data.ownerUid || "").trim();
    return uid;
  } catch (e) {
    console.warn("[user_store] name index read skipped:", e?.message || e);
    return "";
  }
}

function safeId(v) {
  return String(v || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}

function clampInt(n, min = 0, max = 999999999) {
  const x = Math.trunc(Number(n ?? 0));
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function normalizeOwnedCounts(raw) {
  const out = {};
  for (const [cardId, countRaw] of Object.entries(raw || {})) {
    const id = String(cardId || "").trim();
    const count = clampInt(countRaw);
    if (id && count > 0) out[id] = count;
  }
  return out;
}

function ensureYouOwnedCounts(raw) {
  const out = normalizeOwnedCounts(raw);
  if (clampInt(out[YOU_CARD_ID] || 0) < 1) out[YOU_CARD_ID] = 1;
  return out;
}

function normalizeAction(raw = {}, fallback = {}) {
  return {
    id: String(raw.id || raw.actionId || fallback.id || "").trim(),
    name: String(raw.name || fallback.name || "ストライク").trim(),
    cost: clampInt(raw.cost ?? fallback.cost ?? 1, 0, 20),
    range: String(raw.range || fallback.range || "front1").trim(),
    rate: clampInt(raw.rate ?? raw.successRate ?? fallback.rate ?? 75, 0, 100),
    hpDelta: clampInt(raw.hpDelta ?? raw.hp ?? fallback.hpDelta ?? -10, -999, 999),
    spDelta: clampInt(raw.spDelta ?? raw.sp ?? fallback.spDelta ?? 0, -999, 999),
    addStatus: String(raw.addStatus || fallback.addStatus || "").trim(),
    statusValue: raw.statusValue ?? fallback.statusValue ?? "",
    tags: Array.isArray(raw.tags) ? raw.tags : Array.isArray(fallback.tags) ? fallback.tags : [],
  };
}

const YOU_BASE_ACTION = { id: "hataku", name: "はたく", cost: 1, range: "front1", rate: 40, hpDelta: -10, spDelta: 0 };

function youStatUpgradeCount(upgrades = {}) {
  return clampInt(upgrades.hp ?? 0) + clampInt(upgrades.sp ?? 0);
}

function youCostFromUpgrades(upgrades = {}) {
  return 1 + Math.floor(youStatUpgradeCount(upgrades) / 2);
}

function normalizePerkList(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [null, null];
  arr.slice(0, 2).forEach((p, i) => {
    if (!p || typeof p !== "object") return;
    const slot = clampInt(p.slot ?? i + 1, 1, 2);
    out[slot - 1] = {
      id: String(p.id || "").trim(),
      name: String(p.name || p.id || "パーク").trim(),
      slot,
      desc: String(p.desc || "").trim(),
    };
  });
  return out;
}

function migrateYouPerksToV3(actionsRaw, perksRaw, growthVersion = 3) {
  const actions = Array.isArray(actionsRaw) ? actionsRaw.map((a) => ({ ...a })) : [];
  if (clampInt(growthVersion) >= 3) return actions.slice(0, 3);
  const perks = normalizePerkList(perksRaw);
  for (const perk of perks) {
    if (!perk?.id) continue;
    const slotIndex = clampInt(perk.slot ?? 1, 1, 2) - 1;
    const target = actions[slotIndex];
    if (!target) continue;
    if (perk.id === "rate_hp") {
      target.rate = clampInt((target.rate ?? 0) - 5, 0, 100);
    } else if (perk.id === "power_sp") {
      target.rate = clampInt((target.rate ?? 0) - 5, 0, 100);
    } else if (perk.id === "cheap_rate") {
      target.cost = clampInt(target.cost ?? 1, 1, 20);
      target.rate = clampInt((target.rate ?? 0) - 5, 0, 100);
    } else if (perk.id === "all_rate_hp") {
      for (const action of actions) {
        action.rate = clampInt((action.rate ?? 0) - 5, 0, 100);
        action.cost = clampInt((action.cost ?? 1) + 1, 1, 20);
      }
    } else if (perk.id === "spbreak_rate") {
      target.rate = clampInt((target.rate ?? 0) - 5, 0, 100);
    }
  }
  return actions.slice(0, 3);
}

export function createDefaultYouCard(uid = "") {
  return {
    id: YOU_CARD_ID,
    name: "YOU",
    kind: "unit",
    type: "光",
    attr: "光",
    rarity: "SSR",
    cost: 1,
    hp: 10,
    sp: 10,
    theme: "YOU",
    series: "育成",
    source: "you",
    growthVersion: 3,
    attrSelected: false,
    ownerUid: String(uid || ""),
    desc: "プレイヤー専用の育成カード。ユーザー画面でHP/SP/技/特殊能力を伸ばせます。",
    actions: [YOU_BASE_ACTION],
    cardEffects: [],
    perks: [],
    upgrades: { hp: 0, sp: 0, skillRolls: 0, abilityRolls: 0, attrChanges: 0 },
  };
}

export function normalizeYouCard(raw = {}, uid = "") {
  const base = createDefaultYouCard(uid);
  const data = raw && typeof raw === "object" ? raw : {};
  const upgrades = {
    hp: clampInt(data.upgrades?.hp ?? 0),
    sp: clampInt(data.upgrades?.sp ?? 0),
    skillRolls: clampInt(data.upgrades?.skillRolls ?? 0),
    abilityRolls: clampInt(data.upgrades?.abilityRolls ?? 0),
    attrChanges: clampInt(data.upgrades?.attrChanges ?? 0),
  };
  let actions = Array.isArray(data.actions) && data.actions.length
    ? data.actions.slice(0, 4).map((a, i) => normalizeAction(a, base.actions[i] || base.actions[0]))
    : base.actions;
  const oldDefaultSkill = actions.length === 1 && String(actions[0]?.name || "") === "ストライク";
  const migrationV = clampInt(data.growthVersion ?? 0);
  const migratedStats = migrationV < 2;
  const hp = migratedStats ? 10 + upgrades.hp * 10 : clampInt(data.hp ?? base.hp, 10, 200);
  const sp = migratedStats ? 10 + upgrades.sp * 10 : clampInt(data.sp ?? base.sp, 10, 160);
  return {
    ...base,
    ...data,
    id: YOU_CARD_ID,
    name: String(data.name || base.name).trim() || base.name,
    kind: "unit",
    type: String(data.type || data.attr || base.type).trim() || base.type,
    attr: String(data.attr || data.type || base.attr).trim() || base.attr,
    rarity: String(data.rarity || base.rarity).toUpperCase(),
    cost: youCostFromUpgrades(upgrades),
    hp,
    sp,
    growthVersion: 3,
    attrSelected: data.attrSelected === true || upgrades.attrChanges > 0,
    ownerUid: String(data.ownerUid || uid || ""),
    actions: oldDefaultSkill && upgrades.skillRolls <= 0 ? [YOU_BASE_ACTION] : migrateYouPerksToV3(actions, data.perks, migrationV),
    cardEffects: Array.isArray(data.cardEffects) ? data.cardEffects.slice(0, 4) : [],
    perks: normalizePerkList(data.perks),
    upgrades,
  };
}

function profileDefaults(uid, extra = {}) {
  const ownedCounts = ensureYouOwnedCounts(extra.ownedCounts || {});
  return {
    uid,
    gems: STARTER_GEMS,
    pity: 0,
    gachaPity: 0,
    ownedCounts,
    youCard: normalizeYouCard(extra.youCard, uid),
    stats: { matches: 0, wins: 0, losses: 0 },
  };
}

function youProfilePatch(uid, data = {}) {
  const patch = {};
  const normalizedYou = normalizeYouCard(data.youCard, uid);
  if (
    !data.youCard
    || data.youCard?.id !== YOU_CARD_ID
    || clampInt(data.youCard?.growthVersion ?? 0) < 3
    || clampInt(data.youCard?.cost ?? -1, -1, 20) !== normalizedYou.cost
  ) {
    patch.youCard = normalizedYou;
  }
  if (clampInt((data.ownedCounts || {})[YOU_CARD_ID] || 0) < 1) {
    patch.ownedCounts = ensureYouOwnedCounts(data.ownedCounts || {});
  }
  if (data.gachaPity == null) patch.gachaPity = 0;
  return patch;
}

const YOU_SKILL_POOL = [
  { id: "slash", name: "斬撃", cost: 1, range: "front1", rate: 75, hpDelta: -20, spDelta: 0 },
  { id: "tuki", name: "突き", cost: 1, range: "side1", rate: 40, hpDelta: -10, spDelta: 0 },
  { id: "syuriken", name: "手裏剣", cost: 2, range: "front2", rate: 65, hpDelta: -10, spDelta: 0 },
  { id: "teate1", name: "応急手当て", cost: 1, range: "front1", rate: 65, hpDelta: 10, spDelta: 0 },
  { id: "mental_bunseki", name: "精神分析", cost: 1, range: "front1", rate: 30, hpDelta: 0, spDelta: 10 },
  { id: "kumituki", name: "組み付き", cost: 1, range: "front1", rate: 80, hpDelta: -10, spDelta: 0 },
  { name: "フロントブレイク", cost: 1, range: "front1", rate: 80, hpDelta: -10, spDelta: 0 },
  { name: "SPショット", cost: 2, range: "front1", rate: 75, hpDelta: 0, spDelta: -10 },
  { name: "サイドスラッシュ", cost: 2, range: "side1", rate: 72, hpDelta: -10, spDelta: 0 },
  { name: "ノックバッシュ", cost: 2, range: "front1", rate: 68, hpDelta: -10, spDelta: 0, tags: ["knockback:1"] },
  { name: "スイッチヒット", cost: 2, range: "front1", rate: 65, hpDelta: -10, spDelta: 0, tags: ["swap"] },
  { name: "セルフリペア", cost: 1, range: "self", rate: 85, hpDelta: 10, spDelta: 0 },
  { name: "におい付与", cost: 2, range: "front1", rate: 70, hpDelta: 0, spDelta: -10, addStatus: "smell", statusValue: "1,2" },
  { name: "骨折打ち", cost: 2, range: "front1", rate: 70, hpDelta: -10, spDelta: 0, addStatus: "fracture", statusValue: "1,2" },
];

const YOU_ABILITY_POOL = [
  { name: "召喚時リペア", trigger: "onSummon", type: "heal", target: "self", rate: 100, hp: 10, sp: 0 },
  { name: "開幕集中", trigger: "onSummon", type: "addStatus", target: "self", rate: 100, status: "powerUp", v: 10, turns: 1 },
  { name: "ターン開始SP", trigger: "onTurnStart", type: "heal", target: "self", rate: 100, hp: 0, sp: 5 },
  { name: "回避姿勢", trigger: "onSummon", type: "addStatus", target: "self", rate: 100, status: "evade", v: 25, turns: 1 },
  { name: "反撃準備", trigger: "onSummon", type: "addStatus", target: "self", rate: 100, status: "counter", v: 25, turns: 1 },
  { name: "マナ呼吸", trigger: "onTurnStart", type: "manaUp", target: "self", rate: 100, amount: 1 },
];

export const YOU_PERK_POOL = [
  {
    id: "rate_hp",
    name: "集中姿勢",
    desc: "対象技の成功率+5%。HP/SPは下がらない。",
  },
  {
    id: "power_sp",
    name: "一点突破",
    desc: "対象技のHP変化を10強化。代わりに成功率-5%。",
  },
  {
    id: "cheap_rate",
    name: "省エネ",
    desc: "対象技のコスト-1。代わりに成功率-15%。コストは最低1。",
  },
  {
    id: "all_rate_hp",
    name: "全集中",
    desc: "すべての技成功率+5%。代わりに全技コスト+1。",
  },
  {
    id: "spbreak_rate",
    name: "精神削り",
    desc: "対象技にSP-10を追加。代わりに成功率-15%。",
  },
];

function pickYouUpgrade(pool) {
  const item = pool[Math.floor(Math.random() * pool.length)] || pool[0];
  return JSON.parse(JSON.stringify(item));
}

function applyYouPerkEffectToAction(actionRaw, perkId) {
  const action = { ...(actionRaw || {}) };
  if (perkId === "rate_hp") {
    action.rate = clampInt((action.rate ?? 0) + 5, 0, 100);
  } else if (perkId === "power_sp") {
    const hp = clampInt(action.hpDelta ?? action.hp ?? 0, -999, 999);
    action.hpDelta = hp < 0 ? hp - 10 : hp + 10;
    action.rate = clampInt((action.rate ?? 0) - 5, 0, 100);
  } else if (perkId === "cheap_rate") {
    action.cost = clampInt((action.cost ?? 1) - 1, 1, 20);
    action.rate = clampInt((action.rate ?? 0) - 15, 0, 100);
  } else if (perkId === "all_rate_hp") {
    action.rate = clampInt((action.rate ?? 0) + 5, 0, 100);
    action.cost = clampInt((action.cost ?? 1) + 1, 1, 20);
  } else if (perkId === "spbreak_rate") {
    action.spDelta = clampInt((action.spDelta ?? action.sp ?? 0) - 10, -999, 999);
    action.rate = clampInt((action.rate ?? 0) - 15, 0, 100);
  }
  return action;
}

function applyExistingPerksToNewAction(actionRaw, perksRaw, slotIndex) {
  let action = { ...(actionRaw || {}) };
  const perks = normalizePerkList(perksRaw);
  if (perks.some((p) => p?.id === "all_rate_hp")) {
    action = applyYouPerkEffectToAction(action, "all_rate_hp");
  }
  const slotPerk = perks[slotIndex];
  if (slotPerk?.id && slotPerk.id !== "all_rate_hp") {
    action = applyYouPerkEffectToAction(action, slotPerk.id);
  }
  return action;
}

function applyYouPerk(card, perkId, slotIndex) {
  const perk = YOU_PERK_POOL.find((p) => p.id === perkId);
  if (!perk) throw new Error("unknown YOU perk");
  const actions = Array.isArray(card.actions) ? card.actions.map((a) => ({ ...a })) : [];
  if (!actions[slotIndex]) throw new Error(`技${slotIndex + 1}がまだありません`);
  const target = actions[slotIndex];
  if (perk.id === "rate_hp") {
    actions[slotIndex] = applyYouPerkEffectToAction(target, perk.id);
  } else if (perk.id === "power_sp") {
    actions[slotIndex] = applyYouPerkEffectToAction(target, perk.id);
  } else if (perk.id === "cheap_rate") {
    actions[slotIndex] = applyYouPerkEffectToAction(target, perk.id);
  } else if (perk.id === "all_rate_hp") {
    for (const action of actions) {
      Object.assign(action, applyYouPerkEffectToAction(action, perk.id));
    }
  } else if (perk.id === "spbreak_rate") {
    actions[slotIndex] = applyYouPerkEffectToAction(target, perk.id);
  }
  card.cost = youCostFromUpgrades(card.upgrades || {});
  card.actions = actions.slice(0, 3);
  const perks = normalizePerkList(card.perks);
  perks[slotIndex] = { id: perk.id, name: perk.name, slot: slotIndex + 1, desc: perk.desc };
  card.perks = perks.slice(0, 2);
  return perk;
}

export function isFairyTaleCardId(cardId) {
  return String(cardId || "").startsWith("ft_");
}

export function isStarterCardId(cardId) {
  return STARTER_CARD_ID_SET.has(String(cardId || "").trim().toLowerCase());
}

export function isStarterCardDef(cardId, def = {}) {
  if (def?.hidden) return false;
  const kind = String(def?.kind || "unit").toLowerCase();
  if (kind === "ex_support" || kind === "exsupport" || kind === "ex") return false;
  if (isStarterCardId(cardId)) return true;

  const series = String(def?.series || def?.sourceSeries || "").trim().toLowerCase();
  const source = String(def?.source || def?.pack || "").trim().toLowerCase();
  return (
    series === "初期" ||
    series === "スターター" ||
    series === "starter" ||
    source === "starter_creator" ||
    source === "starter" ||
    source.startsWith("starter_")
  );
}

export function buildStarterOwnedCounts(cardDefs = {}, count = STARTER_CARD_COUNT) {
  const out = {};
  const safeCount = clampInt(count, 1, 99);
  for (const [cardId, def] of Object.entries(cardDefs || {})) {
    if (!isStarterCardDef(cardId, def || {})) continue;
    out[cardId] = safeCount;
  }
  return out;
}

export async function getCurrentUserUid() {
  const user = await ensureSignedIn();
  const uid = user?.uid || "";
  if (!uid) throw new Error("sign-in failed");
  localStorage.setItem("anonUid", uid);
  localStorage.setItem("uid", uid);
  return uid;
}

export async function ensureUserProfile(extra = {}) {
  const uid = await getCurrentUserUid();
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const namePatch = {
    ...localPlayerNamePatch(),
    ...namePatchFrom(extra.playerName || extra.displayName || extra.name || ""),
  };

  if (!snap.exists()) {
    const now = serverTimestamp();
    const data = {
      ...profileDefaults(uid, extra),
      createdAt: now,
      updatedAt: now,
      ...namePatch,
      ...extra,
    };
    await setDoc(ref, data, { merge: true });
    await syncPlayerNameIndex(uid, data.playerName || data.displayName || data.name || "");
    await claimPendingAdminGrants(uid);
    return { uid, data };
  }

  const data = snap.data() || {};
  const youPatch = youProfilePatch(uid, data);
  const patch = {
    uid,
    gems: clampInt(data.gems ?? STARTER_GEMS),
    pity: clampInt(data.pity ?? 0),
    gachaPity: clampInt(data.gachaPity ?? 0),
    stats: {
      matches: clampInt(data.stats?.matches ?? 0),
      wins: clampInt(data.stats?.wins ?? 0),
      losses: clampInt(data.stats?.losses ?? 0),
    },
    updatedAt: serverTimestamp(),
    ...youPatch,
    ...namePatch,
    ...extra,
  };
  await setDoc(ref, patch, { merge: true });
  await syncPlayerNameIndex(uid, patch.playerName || patch.displayName || patch.name || "");
  await claimPendingAdminGrants(uid);
  return { uid, data: { ...data, ...patch } };
}

export async function claimPendingAdminGrants(uid) {
  const actualUid = String(uid || "").trim();
  if (!actualUid) return { applied: 0 };

  let docs = [];
  try {
    const snap = await getDocs(query(collection(db, "decks"), where("targetUid", "==", actualUid), limit(100)));
    docs = snap.docs
      .map((d) => ({ id: d.id, data: d.data() || {} }))
      .filter((it) => it.data.type === "admin_grant");
  } catch (e) {
    console.warn("[user_store] pending admin grants read skipped:", e?.message || e);
    return { applied: 0, skipped: true };
  }

  if (!docs.length) return { applied: 0 };

  const ref = profileRef(actualUid);
  const applied = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    const claimed = { ...(data.claimedAdminGrants || {}) };
    const ownedCounts = normalizeOwnedCounts(data.ownedCounts || {});
    let gemDelta = 0;
    let pityDelta = 0;
    let changed = false;

    if (!snap.exists()) {
      tx.set(ref, {
        ...profileDefaults(actualUid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }

    for (const item of docs) {
      const grantId = String(item.data.grantId || item.id || "").trim();
      if (!grantId || claimed[grantId]) continue;
      const grantKind = String(item.data.grantKind || "").trim();
      if (grantKind === "gems") {
        const amount = clampInt(item.data.amount, -999999999, 999999999);
        if (!amount) continue;
        gemDelta += amount;
        applied.push({ type: "admin_gems", amount, reason: item.data.reason || "admin_grant", adminUid: item.data.adminUid || "" });
      } else if (grantKind === "pity" || grantKind === "growth") {
        const amount = clampInt(item.data.amount, -999999999, 999999999);
        if (!amount) continue;
        pityDelta += amount;
        applied.push({ type: "admin_pity", amount, reason: item.data.reason || "admin_growth", adminUid: item.data.adminUid || "" });
      } else if (grantKind === "card") {
        const cardId = String(item.data.cardId || "").trim();
        const count = clampInt(item.data.count, 1, 999999);
        if (!cardId || !count) continue;
        ownedCounts[cardId] = clampInt(ownedCounts[cardId] || 0, 0, 999999) + count;
        applied.push({ type: "admin_card", cardId, count, reason: item.data.reason || "admin_card", adminUid: item.data.adminUid || "" });
      } else {
        continue;
      }
      claimed[grantId] = true;
      changed = true;
    }

    if (!changed) return;

    const patch = {
      claimedAdminGrants: claimed,
      updatedAt: serverTimestamp(),
    };
    if (gemDelta) patch.gems = increment(gemDelta);
    if (pityDelta) patch.pity = increment(pityDelta);
    if (applied.some((x) => x.type === "admin_card")) patch.ownedCounts = ensureYouOwnedCounts(ownedCounts);
    Object.assign(patch, youProfilePatch(actualUid, { ...data, ownedCounts: patch.ownedCounts || ownedCounts }));
    tx.set(ref, patch, { merge: true });
  });

  for (const item of applied) {
    await writeHistorySafe(actualUid, item);
  }

  return { applied: applied.length };
}

export async function createOperationGemGift(adminUid, amount, title = "ログインボーナス", reason = "login_bonus") {
  const actor = await assertAdminUid(adminUid);
  const value = clampInt(amount, 1, 999999);
  if (!value) throw new Error("amount must be greater than 0");
  const giftId = safeId(`op_gift_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const payload = {
    type: "operation_gift",
    visibility: "public",
    title: String(title || "ログインボーナス").trim().slice(0, 80),
    giftId,
    grantKind: "gems",
    amount: value,
    reason: String(reason || "login_bonus").trim().slice(0, 160),
    active: true,
    adminUid: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "decks", giftId), payload, { merge: true });
  return { giftId, amount: value, title: payload.title };
}

export async function listOperationGifts(n = 20) {
  const out = [];
  try {
    const snap = await getDocs(query(collection(db, "decks"), where("type", "==", "operation_gift"), limit(n)));
    snap.forEach((d) => {
      const data = d.data() || {};
      if (data.active === false) return;
      out.push({ id: d.id, ...data });
    });
  } catch (e) {
    console.warn("[user_store] operation gifts read skipped:", e?.message || e);
  }
  out.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  return out;
}

export async function claimOperationGifts(uid) {
  const actualUid = String(uid || "").trim();
  if (!actualUid) return { applied: 0, gems: 0, gifts: [] };

  const gifts = await listOperationGifts(50);
  if (!gifts.length) return { applied: 0, gems: 0, gifts: [] };

  const ref = profileRef(actualUid);
  const applied = [];
  let totalGems = 0;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    const claimed = { ...(data.claimedOperationGifts || {}) };
    let changed = false;
    let gemDelta = 0;

    if (!snap.exists()) {
      tx.set(ref, {
        ...profileDefaults(actualUid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }

    for (const gift of gifts) {
      const giftId = String(gift.giftId || gift.id || "").trim();
      if (!giftId || claimed[giftId]) continue;
      if (gift.active === false) continue;
      const kind = String(gift.grantKind || "").trim();
      if (kind !== "gems") continue;
      const amount = clampInt(gift.amount, 0, 999999);
      if (!amount) continue;
      claimed[giftId] = true;
      gemDelta += amount;
      totalGems += amount;
      changed = true;
      applied.push({
        type: "operation_gems",
        giftId,
        amount,
        title: gift.title || "ログインボーナス",
        reason: gift.reason || "login_bonus",
        adminUid: gift.adminUid || "",
      });
    }

    if (!changed) return;
    tx.set(ref, {
      claimedOperationGifts: claimed,
      gems: increment(gemDelta),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  for (const item of applied) {
    await writeHistorySafe(actualUid, item);
  }

  return { applied: applied.length, gems: totalGems, gifts: applied };
}

export function watchUserProfile(uid, callback, onError = console.warn) {
  return onSnapshot(
    profileRef(uid),
    (snap) => callback(snap.exists() ? { id: snap.id, ...(snap.data() || {}) } : null),
    onError,
  );
}

export function watchOwnedCards(uid, callback, onError = console.warn) {
  return onSnapshot(
    profileRef(uid),
    (snap) => {
      const list = [];
      const counts = snap.exists() ? ensureYouOwnedCounts(snap.data()?.ownedCounts || {}) : {};
      for (const [cardId, countRaw] of Object.entries(counts)) {
        const count = clampInt(countRaw);
        if (count > 0) list.push({ cardId, count });
      }
      list.sort((a, b) => String(a.cardId).localeCompare(String(b.cardId)));
      callback(list);
    },
    onError,
  );
}

export async function getOwnedCards(uid) {
  const snap = await getDoc(profileRef(uid));
  const list = [];
  const counts = snap.exists() ? ensureYouOwnedCounts(snap.data()?.ownedCounts || {}) : {};
  for (const [cardId, countRaw] of Object.entries(counts)) {
    const count = clampInt(countRaw);
    if (count > 0) list.push({ cardId, count });
  }
  return list;
}

export async function getOwnedCounts(uid) {
  if (!uid) return {};
  const snap = await getDoc(profileRef(uid));
  return snap.exists() ? ensureYouOwnedCounts(snap.data()?.ownedCounts || {}) : {};
}

export async function ensureStarterOwnedCards(uid, cardDefs = {}) {
  const actualUid = uid || await getCurrentUserUid();
  const starter = buildStarterOwnedCounts(cardDefs);
  const starterIds = Object.keys(starter);
  const ref = profileRef(actualUid);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    const ownedCounts = ensureYouOwnedCounts(data.ownedCounts || {});
    let changed = false;

    if (data.starterOwnedVersion === "20260702_non_fairy_v1") {
      for (const cardId of Object.keys(ownedCounts)) {
        if (isStarterCardId(cardId) || isFairyTaleCardId(cardId)) continue;
        delete ownedCounts[cardId];
        changed = true;
      }
    }

    for (const [cardId, starterCount] of Object.entries(starter)) {
      const current = clampInt(ownedCounts[cardId] ?? 0);
      if (current >= starterCount) continue;
      ownedCounts[cardId] = starterCount;
      changed = true;
    }

    if (!snap.exists()) {
      tx.set(ref, {
        ...profileDefaults(actualUid, { ownedCounts }),
        createdAt: serverTimestamp(),
      }, { merge: true });
      changed = true;
    }

    const youPatch = youProfilePatch(actualUid, { ...data, ownedCounts });
    if (Object.keys(youPatch).length) changed = true;

    if (changed) {
      tx.set(ref, {
        ownedCounts,
        ...youPatch,
        starterOwnedVersion: STARTER_OWNED_VERSION,
        starterOwnedCount: starterIds.length,
        starterOwnedUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else if (data.starterOwnedVersion !== STARTER_OWNED_VERSION) {
      tx.set(ref, {
        starterOwnedVersion: STARTER_OWNED_VERSION,
        starterOwnedCount: starterIds.length,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    return {
      uid: actualUid,
      changed,
      starterCount: starterIds.length,
      ownedCounts,
    };
  });
}

export async function getRecentHistory(uid, n = 20) {
  const q = query(historyCol(uid), orderBy("at", "desc"), limit(n));
  const snap = await getDocs(q);
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...(d.data() || {}) }));
  return list;
}

export async function resolveUserIdentifier(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("target user missing");

  if (/^[a-zA-Z0-9_-]{16,}$/.test(raw)) {
    try {
      await getDoc(profileRef(raw));
    } catch (e) {
      console.warn("[user_store] target uid read skipped:", e?.message || e);
    }
    return raw;
  }

  const indexedUid = await resolveUserByNameIndex(raw);
  if (indexedUid) return indexedUid;

  const lower = raw.toLowerCase();
  const users = collection(db, "users");
  const searches = [
    ["playerNameLower", lower],
    ["displayNameLower", lower],
    ["nameLower", lower],
    ["playerName", raw],
    ["displayName", raw],
    ["name", raw],
  ];

  for (const [field, value] of searches) {
    try {
      const snap = await getDocs(query(users, where(field, "==", value), limit(2)));
      if (snap.empty) continue;
      if (snap.docs.length > 1) {
        throw new Error(`same player name exists: ${raw}. use UID`);
      }
      return snap.docs[0].id;
    } catch (e) {
      console.warn("[user_store] users name query skipped:", e?.message || e);
      break;
    }
  }

  throw new Error(`player name not registered: ${raw}. save player name once or use UID`);
}

export async function grantGems(uid, amount, reason = "manual") {
  const value = clampInt(amount, -999999999, 999999999);
  if (!value) return { uid, amount: 0 };
  const ref = profileRef(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      tx.set(ref, {
        ...profileDefaults(uid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
    const data = snap.exists() ? (snap.data() || {}) : {};
    tx.set(ref, { ...youProfilePatch(uid, data), gems: increment(value), updatedAt: serverTimestamp() }, { merge: true });
  });
  await writeHistorySafe(uid, { type: "gems", amount: value, reason });
  return { uid, amount: value };
}

export async function grantPity(uid, amount, reason = "manual") {
  const value = clampInt(amount, -999999999, 999999999);
  if (!value) return { uid, amount: 0 };
  const actualUid = String(uid || "").trim() || await getCurrentUserUid();
  const ref = profileRef(actualUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    if (!snap.exists()) {
      tx.set(ref, {
        ...profileDefaults(actualUid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
    tx.set(ref, {
      ...youProfilePatch(actualUid, data),
      pity: increment(value),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  await writeHistorySafe(actualUid, { type: "pity", amount: value, reason });
  return { uid: actualUid, amount: value };
}

export async function grantGemsByAdmin(adminUid, targetUid, amount, reason = "admin_grant") {
  const actor = String(adminUid || "").trim();
  const target = await resolveUserIdentifier(targetUid);
  const value = clampInt(amount, -999999999, 999999999);
  if (!actor) throw new Error("admin uid missing");
  if (!target) throw new Error("target uid missing");
  if (!value) throw new Error("amount must not be 0");

  const adminRef = profileRef(actor);
  const targetRef = profileRef(target);
  try {
    await runTransaction(db, async (tx) => {
      const adminSnap = await tx.get(adminRef);
      if (!adminSnap.exists() || adminSnap.data()?.isAdmin !== true) {
        throw new Error("admin permission required");
      }
      tx.set(targetRef, {
        uid: target,
        gems: increment(value),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await writeHistorySafe(target, {
      type: "admin_gems",
      amount: value,
      reason,
      adminUid: actor,
    });
    return { uid: target, amount: value, queued: false };
  } catch (e) {
    if (!isPermissionError(e)) throw e;
    return queueAdminGrant({
      adminUid: actor,
      targetUid: target,
      grantKind: "gems",
      amount: value,
      reason,
      directError: e?.message || e,
    });
  }
}

export async function grantPityByAdmin(adminUid, targetUid, amount, reason = "admin_growth") {
  const actor = String(adminUid || "").trim();
  const target = await resolveUserIdentifier(targetUid);
  const value = clampInt(amount, -999999999, 999999999);
  if (!actor) throw new Error("admin uid missing");
  if (!target) throw new Error("target uid missing");
  if (!value) throw new Error("amount must not be 0");

  const adminRef = profileRef(actor);
  const targetRef = profileRef(target);
  try {
    await runTransaction(db, async (tx) => {
      const adminSnap = await tx.get(adminRef);
      if (!adminSnap.exists() || adminSnap.data()?.isAdmin !== true) {
        throw new Error("admin permission required");
      }
      tx.set(targetRef, {
        uid: target,
        pity: increment(value),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await writeHistorySafe(target, {
      type: "admin_pity",
      amount: value,
      reason,
      adminUid: actor,
    });
    return { uid: target, amount: value, queued: false };
  } catch (e) {
    if (!isPermissionError(e)) throw e;
    return queueAdminGrant({
      adminUid: actor,
      targetUid: target,
      grantKind: "pity",
      amount: value,
      reason,
      directError: e?.message || e,
    });
  }
}

export async function grantCardByAdmin(adminUid, targetUid, cardId, count = 1, reason = "admin_card") {
  const actor = String(adminUid || "").trim();
  const target = await resolveUserIdentifier(targetUid);
  const id = String(cardId || "").trim();
  const value = clampInt(count, 1, 9999);
  if (!actor) throw new Error("admin uid missing");
  if (!target) throw new Error("target uid missing");
  if (!id) throw new Error("card id missing");

  const adminRef = profileRef(actor);
  const targetRef = profileRef(target);
  try {
    await runTransaction(db, async (tx) => {
      const adminSnap = await tx.get(adminRef);
      if (!adminSnap.exists() || adminSnap.data()?.isAdmin !== true) {
        throw new Error("admin permission required");
      }
      tx.set(targetRef, {
        uid: target,
        ownedCounts: {
          [id]: increment(value),
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await writeHistorySafe(target, {
      type: "admin_card",
      cardId: id,
      count: value,
      reason,
      adminUid: actor,
    });
    return { uid: target, cardId: id, count: value, queued: false };
  } catch (e) {
    if (!isPermissionError(e)) throw e;
    return queueAdminGrant({
      adminUid: actor,
      targetUid: target,
      grantKind: "card",
      cardId: id,
      count: value,
      reason,
      directError: e?.message || e,
    });
  }
}

export async function setYouCardAttribute(uid, attr = "") {
  const actualUid = String(uid || "").trim() || await getCurrentUserUid();
  const nextAttr = String(attr || "").trim();
  if (!YOU_ATTRIBUTES.includes(nextAttr)) throw new Error("unknown YOU attribute");
  const ref = profileRef(actualUid);
  let result = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    const card = normalizeYouCard(data.youCard, actualUid);
    if (card.attr === nextAttr && card.attrSelected === true) {
      result = { uid: actualUid, card, cost: 0, pityBefore: clampInt(data.pity ?? 0), pityAfter: clampInt(data.pity ?? 0), label: "属性変更なし" };
      return;
    }
    const firstPick = card.attrSelected !== true && clampInt(card.upgrades?.attrChanges ?? 0) <= 0;
    const cost = firstPick ? 0 : YOU_UPGRADE_COSTS.attr;
    const pity = clampInt(data.pity ?? 0);
    if (pity < cost) throw new Error(`not enough Growth Pt (need:${cost})`);

    card.attr = nextAttr;
    card.type = nextAttr;
    card.attrSelected = true;
    card.upgrades.attrChanges = clampInt((card.upgrades?.attrChanges ?? 0) + 1);

    tx.set(ref, {
      ...youProfilePatch(actualUid, data),
      pity: pity - cost,
      youCard: card,
      ownedCounts: ensureYouOwnedCounts(data.ownedCounts || {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    result = { uid: actualUid, card, cost, pityBefore: pity, pityAfter: pity - cost, label: `属性: ${nextAttr}` };
  });

  await writeHistorySafe(actualUid, {
    type: "you_attribute",
    attr: nextAttr,
    cost: result?.cost ?? 0,
  });
  return result;
}

export async function upgradeYouCard(uid, kind = "", options = {}) {
  const actualUid = String(uid || "").trim() || await getCurrentUserUid();
  const upgradeKind = String(kind || "").trim();
  const cost = YOU_UPGRADE_COSTS[upgradeKind];
  if (!cost) throw new Error("unknown YOU upgrade");

  const skillSlot = upgradeKind === "skill" ? -1 : /^skill[123]$/.test(upgradeKind) ? Number(upgradeKind.slice(-1)) - 1 : -1;
  const perkSlot = /^perk[12]$/.test(upgradeKind) ? Number(upgradeKind.slice(-1)) - 1 : -1;
  const rolledSkill = skillSlot >= 0 ? pickYouUpgrade(YOU_SKILL_POOL) : null;
  const rolledAbility = upgradeKind === "ability" ? pickYouUpgrade(YOU_ABILITY_POOL) : null;
  const ref = profileRef(actualUid);
  let result = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    if (!snap.exists()) {
      tx.set(ref, {
        ...profileDefaults(actualUid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }

    const pity = clampInt(data.pity ?? 0);
    if (pity < cost) throw new Error(`not enough Growth Pt (need:${cost})`);

    const card = normalizeYouCard(data.youCard, actualUid);
    const ownedCounts = ensureYouOwnedCounts(data.ownedCounts || {});
    let label = "";

    if (upgradeKind === "hp") {
      card.hp = clampInt(card.hp + 10, 10, 200);
      card.upgrades.hp = clampInt(card.upgrades.hp + 1);
      card.cost = youCostFromUpgrades(card.upgrades);
      label = "HP +10";
    } else if (upgradeKind === "sp") {
      card.sp = clampInt(card.sp + 10, 10, 160);
      card.upgrades.sp = clampInt(card.upgrades.sp + 1);
      card.cost = youCostFromUpgrades(card.upgrades);
      label = "SP +10";
    } else if (skillSlot >= 0) {
      const actions = Array.isArray(card.actions) ? [...card.actions] : [];
      let next = normalizeAction(rolledSkill);
      while (actions.length <= skillSlot) actions.push(normalizeAction(YOU_BASE_ACTION));
      next = applyExistingPerksToNewAction(next, card.perks, skillSlot);
      actions[skillSlot] = next;
      card.actions = actions.slice(0, 3);
      card.upgrades.skillRolls = clampInt(card.upgrades.skillRolls + 1);
      label = `技${skillSlot + 1}: ${next.name}`;
    } else if (upgradeKind === "ability") {
      const effects = Array.isArray(card.cardEffects) ? [...card.cardEffects] : [];
      const next = rolledAbility;
      if (effects.length < 3) {
        effects.push(next);
      } else {
        effects[Math.floor(Math.random() * effects.length)] = next;
      }
      card.cardEffects = effects.slice(0, 3);
      card.upgrades.abilityRolls = clampInt(card.upgrades.abilityRolls + 1);
      label = `Ability: ${next.name}`;
    } else if (perkSlot >= 0) {
      const perks = normalizePerkList(card.perks);
      if (perks[perkSlot]?.id) throw new Error(`技${perkSlot + 1}のパークは設定済みです`);
      const perk = applyYouPerk(card, String(options?.perkId || ""), perkSlot);
      label = `技${perkSlot + 1}パーク: ${perk.name}`;
    }

    tx.set(ref, {
      ...youProfilePatch(actualUid, data),
      pity: pity - cost,
      youCard: card,
      ownedCounts,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    result = { uid: actualUid, card, cost, pityBefore: pity, pityAfter: pity - cost, kind: upgradeKind, label };
  });

  await writeHistorySafe(actualUid, {
    type: "you_upgrade",
    upgradeKind,
    cost,
    label: result?.label || "",
  });
  return result;
}

export async function recordMatchResult({
  uid,
  roomId = "",
  playerId = "",
  seat = "",
  winner = "",
  result = "",
  reason = "",
  turnSeq = 0,
  kills = 0,
  infil = 0,
  deckTitle = "",
  deckCount = 0,
  mode = "",
  startedAtMs = 0,
  endedAtMs = 0,
  durationMs = 0,
} = {}) {
  const actualUid = uid || await getCurrentUserUid();
  const normalized = String(result || "").toLowerCase();
  if (normalized !== "win" && normalized !== "lose") {
    return { uid: actualUid, skipped: true, reason: "unknown result" };
  }

  const reward = normalized === "win" ? REWARD_WIN : REWARD_LOSE;
  const pityReward = normalized === "win" ? REWARD_PITY_WIN : REWARD_PITY_LOSE;
  const ref = profileRef(actualUid);
  const histIdBase = safeId(`${roomId || "local"}_${playerId || actualUid}_${seat || "seat"}`);
  const histRef = doc(historyCol(actualUid), `match_${histIdBase}`);

  return runTransaction(db, async (tx) => {
    const [profileSnap, histSnap] = await Promise.all([tx.get(ref), tx.get(histRef)]);
    if (histSnap.exists()) {
      return { uid: actualUid, alreadyRecorded: true, reward: 0 };
    }
    if (!profileSnap.exists()) {
      tx.set(ref, {
        ...profileDefaults(actualUid),
        createdAt: serverTimestamp(),
      }, { merge: true });
    }

    tx.set(histRef, {
      type: "match",
      roomId,
      playerId,
      seat,
      winner,
      result: normalized,
      reason,
      reward,
      pityReward,
      turnSeq: clampInt(turnSeq),
      kills: clampInt(kills),
      infil: clampInt(infil),
      deckTitle: String(deckTitle || "").trim().slice(0, 80),
      deckCount: clampInt(deckCount, 0, 999),
      mode: String(mode || "").trim().slice(0, 24),
      startedAtMs: clampInt(startedAtMs, 0, 9999999999999),
      endedAtMs: clampInt(endedAtMs, 0, 9999999999999),
      durationMs: clampInt(durationMs, 0, 999999999),
      at: serverTimestamp(),
    });
    tx.set(ref, {
      ...youProfilePatch(actualUid, profileSnap.exists() ? (profileSnap.data() || {}) : {}),
      gems: increment(reward),
      pity: increment(pityReward),
      "stats.matches": increment(1),
      [normalized === "win" ? "stats.wins" : "stats.losses"]: increment(1),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { uid: actualUid, alreadyRecorded: false, reward, pityReward };
  });
}
