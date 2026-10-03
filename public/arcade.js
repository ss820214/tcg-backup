// public/arcade.js
// v20260723_starter_series1

import { db } from "./auth.js?v=20260627_perm1";
import {
  ensureUserProfile,
  grantGems,
  grantPity,
  YOU_CARD_ID,
  normalizeYouCard,
} from "./user_store.js?v=20260723_starter_series1";
import { FAIRY_TALE_CARD_LIST } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { STARTER_SUPPORT_CARDS } from "./starter_support_cards.js?v=20260706_starter_support_all1";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const LOCAL_DECK_KEY = "tcg_deck_local_v20260202_30";
const DECK_SIZE = 30;
const ROUND_MAX = 5;

const DIFF = {
  easy: { label: "EASY", scale: 0.85, reward: 120, pityReward: 6, rateBonus: -5, budget: 85 },
  normal: { label: "NORMAL", scale: 1, reward: 200, pityReward: 10, rateBonus: 0, budget: 110 },
  hard: { label: "HARD", scale: 2, reward: 350, pityReward: 18, rateBonus: 8, budget: 140 },
};

const $ = (id) => document.getElementById(id);
const state = {
  uid: "",
  gems: 0,
  diff: "normal",
  cardDefs: {},
  unitPool: [],
  deckMap: {},
  deckArray: [],
  party: [],
  enemies: [],
  round: 0,
  phase: "setup",
  complete: false,
  rewardPaid: false,
  selectedActorId: "",
  selectedActionIndex: 0,
  selectedTargetId: "",
  actedIds: [],
  log: [],
};

function clampInt(v, min = 0, max = 999999) {
  const n = Math.trunc(Number(v ?? 0));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeKind(c) {
  const k = String(c?.kind || "unit").toLowerCase();
  if (k === "card") return "unit";
  if (k === "exsupport") return "ex_support";
  return k;
}

function isUnitCard(c) {
  const k = normalizeKind(c);
  return k !== "support" && k !== "ex_support" && !c?.hidden;
}

function cardName(id) {
  return state.cardDefs[id]?.name || id;
}

function hpOf(c) {
  return Math.max(10, Math.trunc(Number(c?.hp ?? 30) / 10) * 10);
}

function spOf(c) {
  return Math.max(0, Math.trunc(Number(c?.sp ?? 10) / 10) * 10);
}

function costOf(c) {
  return clampInt(c?.cost ?? 1, 1, 99);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)] || null;
}

function loadLocalDeck() {
  try {
    const raw = localStorage.getItem(LOCAL_DECK_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const out = {};
    for (const [id, count] of Object.entries(parsed || {})) {
      const n = clampInt(count, 0, 4);
      if (id && n > 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function deckCount(map = state.deckMap) {
  return Object.values(map || {}).reduce((a, b) => a + clampInt(b), 0);
}

function deckPower() {
  let total = 0;
  for (const [id, count] of Object.entries(state.deckMap || {})) {
    total += costOf(state.cardDefs[id] || {}) * clampInt(count, 0, 4);
  }
  return total;
}

function powerScale() {
  const diff = DIFF[state.diff] || DIFF.normal;
  const power = deckPower();
  if (power <= diff.budget) return 1;
  const over = power - diff.budget;
  return Math.min(2.2, 1 + over / diff.budget);
}

function buildDeckArray(map) {
  const out = [];
  for (const [id, count] of Object.entries(map || {})) {
    for (let i = 0; i < clampInt(count, 0, 4); i++) out.push(id);
  }
  return shuffle(out);
}

async function loadCollectionSafe(colName, kind = "") {
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
    console.warn("[arcade] collection skipped", colName, e?.message || e);
    return [];
  }
}

async function loadCardDefs() {
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
    ...FAIRY_TALE_CARD_LIST,
  ];
  const defs = {};
  for (const c of list) defs[c.id] = { ...c };
  try {
    const profile = await ensureUserProfile();
    defs[YOU_CARD_ID] = normalizeYouCard(profile?.data?.youCard, profile?.uid || state.uid);
  } catch (e) {
    console.warn("[arcade] YOU card skipped:", e?.message || e);
  }
  state.cardDefs = defs;
  state.unitPool = Object.values(defs).filter(isUnitCard);
}

function createUnit(cardId, side, scale = 1) {
  const def = state.cardDefs[cardId] || {};
  const hp = Math.max(10, Math.trunc((hpOf(def) * scale) / 10) * 10);
  const sp = Math.max(0, Math.trunc((spOf(def) * scale) / 10) * 10);
  return {
    id: `${side}_${cardId}_${Math.random().toString(16).slice(2)}`,
    side,
    cardId,
    name: cardName(cardId),
    type: def.type || "-",
    hp,
    maxHp: hp,
    sp,
    maxSp: sp,
    actions: Array.isArray(def.actions) ? def.actions : [],
  };
}

function drawPartyFromDeck() {
  const deck = buildDeckArray(state.deckMap);
  const firstFive = deck.splice(0, 5);
  const chosen = [];
  const seen = [...firstFive, ...deck];
  for (const id of seen) {
    const def = state.cardDefs[id];
    if (!def || !isUnitCard(def)) continue;
    chosen.push(createUnit(id, "player", 1));
    if (chosen.length >= 3) break;
  }
  state.deckArray = deck;
  state.log.push(`初期ドロー: ${firstFive.map(cardName).join(" / ") || "なし"}`);
  return chosen;
}

function enemyCostTarget(round) {
  return Math.min(10, 1 + round + Math.floor(Math.random() * 4));
}

function createEnemies(round) {
  const diff = DIFF[state.diff] || DIFF.normal;
  const pool = state.unitPool.filter((c) => {
    const cost = clampInt(c.cost, 1, 99);
    return cost <= enemyCostTarget(round) + (state.diff === "hard" ? 2 : 0);
  });
  const source = pool.length ? pool : state.unitPool;
  const scale = diff.scale * powerScale() * (1 + (round - 1) * 0.13);
  const enemies = [];
  for (let i = 0; i < 3; i++) {
    const c = pick(source);
    if (c) enemies.push(createUnit(c.id, "enemy", scale));
  }
  return enemies;
}

function alive(list) {
  return list.filter((u) => Number(u.hp) > 0);
}

function findUnit(id) {
  return [...state.party, ...state.enemies].find((u) => u.id === id) || null;
}

function actionOf(unit, index = null) {
  const acts = Array.isArray(unit?.actions) ? unit.actions.filter(Boolean) : [];
  if (index != null && acts[index]) return acts[index];
  return pick(acts) || { name: "通常攻撃", rate: 70, hpDelta: -10, cost: 0, range: "front1" };
}

function rateOf(act, side) {
  const base = clampInt(act?.rate ?? act?.successRate ?? act?.hitRate ?? 70, 5, 100);
  const diff = DIFF[state.diff] || DIFF.normal;
  const bonus = side === "enemy" ? diff.rateBonus : 0;
  return Math.max(5, Math.min(98, base + bonus));
}

function deltasOf(act) {
  let hp = Number.isFinite(Number(act?.hpDelta)) ? Math.trunc(Number(act.hpDelta)) : 0;
  let sp = Number.isFinite(Number(act?.spDelta)) ? Math.trunc(Number(act.spDelta)) : 0;
  if (!hp && !sp) {
    const dmg = Number(act?.dmg ?? act?.damage ?? 0);
    const dmgType = String(act?.dmgType ?? act?.damageType ?? "HP").toUpperCase();
    if (Number.isFinite(dmg) && dmg) {
      if (dmgType === "SP") sp -= Math.abs(Math.trunc(dmg));
      else hp -= Math.abs(Math.trunc(dmg));
    }
  }
  hp = Math.trunc(hp / 10) * 10;
  sp = Math.trunc(sp / 10) * 10;
  if (!hp && !sp) hp = -10;
  return { hp, sp };
}

function applyAction(actor, target, act = null) {
  const selected = act || actionOf(actor);
  const rate = rateOf(selected, actor.side);
  const roll = Math.floor(Math.random() * 100) + 1;
  const hit = roll <= rate;
  state.log.push(`${actor.side === "player" ? "[自軍]" : "[敵]"} ${actor.name}: ${selected.name || "技"}  ロール ${roll}/${rate}`);
  if (!hit) {
    state.log.push("  失敗");
    return { hit, roll, rate };
  }
  const { hp, sp } = deltasOf(selected);
  if (hp < 0) target.hp = Math.max(0, target.hp + hp);
  if (hp > 0) actor.hp = Math.min(actor.maxHp, actor.hp + hp);
  if (sp < 0) target.sp = Math.max(0, target.sp + sp);
  if (sp > 0) actor.sp = Math.min(actor.maxSp, actor.sp + sp);
  const parts = [];
  if (hp < 0) parts.push(`${target.name} HP${hp}`);
  if (sp < 0) parts.push(`${target.name} SP${sp}`);
  if (hp > 0) parts.push(`${actor.name} HP+${hp}`);
  if (sp > 0) parts.push(`${actor.name} SP+${sp}`);
  state.log.push(`  ${parts.join(" / ")}`);
  if (target.hp <= 0) state.log.push(`  ${target.name} を撃破`);
  return { hit, roll, rate };
}

function recoverPartyForNextRound() {
  for (const u of state.party) {
    if (u.hp <= 0) u.hp = Math.max(10, Math.trunc(u.maxHp * 0.5 / 10) * 10);
    else u.hp = Math.min(u.maxHp, u.hp + Math.max(10, Math.trunc(u.maxHp * 0.35 / 10) * 10));
    u.sp = Math.min(u.maxSp, u.sp + Math.max(0, Math.trunc(u.maxSp * 0.35 / 10) * 10));
  }
}

function ensureSelections() {
  const actors = alive(state.party).filter((u) => !state.actedIds.includes(u.id));
  if (!actors.some((u) => u.id === state.selectedActorId)) {
    state.selectedActorId = actors[0]?.id || "";
    state.selectedActionIndex = 0;
  }
  if (!alive(state.enemies).some((u) => u.id === state.selectedTargetId)) {
    state.selectedTargetId = alive(state.enemies)[0]?.id || "";
  }
}

async function playerAction() {
  if (state.phase !== "player") return;
  ensureSelections();
  const actor = findUnit(state.selectedActorId);
  const target = findUnit(state.selectedTargetId);
  if (!actor || !target || actor.hp <= 0 || target.hp <= 0) return;
  if (state.actedIds.includes(actor.id)) return;

  const act = actionOf(actor, state.selectedActionIndex);
  applyAction(actor, target, act);
  state.actedIds.push(actor.id);

  if (!alive(state.enemies).length) {
    await finishRoundWin();
    return;
  }

  const remaining = alive(state.party).filter((u) => !state.actedIds.includes(u.id));
  if (!remaining.length) {
    enemyTurn();
    return;
  }

  state.selectedActorId = remaining[0].id;
  state.selectedActionIndex = 0;
  state.selectedTargetId = alive(state.enemies)[0]?.id || "";
  renderAll();
}

function enemyTurn() {
  state.phase = "enemy";
  state.log.push("--- 敵ターン ---");
  for (const enemy of alive(state.enemies)) {
    const target = pick(alive(state.party));
    if (!target) break;
    applyAction(enemy, target);
  }
  if (!alive(state.party).length) {
    state.phase = "defeat";
    state.log.push("敗北。デッキを調整して再挑戦してください。");
    renderAll();
    return;
  }
  state.phase = "player";
  state.actedIds = [];
  ensureSelections();
  state.log.push("--- 自軍ターン ---");
  renderAll();
}

async function finishRoundWin() {
  state.log.push(`Round ${state.round} CLEAR`);
  if (state.round >= ROUND_MAX) {
    state.complete = true;
    state.phase = "complete";
    await payReward();
  } else {
    state.phase = "between";
    recoverPartyForNextRound();
    state.round += 1;
  }
  renderAll();
}

async function payReward() {
  if (state.rewardPaid) return;
  state.rewardPaid = true;
  const diff = DIFF[state.diff] || DIFF.normal;
  const reward = diff.reward;
  const pityReward = diff.pityReward || 0;
  await grantGems(state.uid, reward, `arcade_${state.diff}`);
  if (pityReward) await grantPity(state.uid, pityReward, `arcade_${state.diff}`);
  state.gems += reward;
  $("gems").textContent = String(state.gems);
  state.log.push(`Reward: ${reward} gems / Growth +${pityReward}`);
}
function renderMap() {
  const box = $("roundMap");
  box.innerHTML = "";
  for (let i = 1; i <= ROUND_MAX; i++) {
    const node = document.createElement("div");
    node.className = "node" + (i < state.round ? " clear" : i === state.round ? " active" : "");
    node.innerHTML = `<b>${i}</b><span>${i < state.round ? "CLEAR" : i === state.round ? "BATTLE" : "LOCK"}</span>`;
    box.appendChild(node);
  }
}

function renderUnits(id, list) {
  const box = $(id);
  box.innerHTML = "";
  for (const u of list) {
    const hpPct = u.maxHp ? Math.round((u.hp / u.maxHp) * 100) : 0;
    const spPct = u.maxSp ? Math.round((u.sp / u.maxSp) * 100) : 0;
    const selected = u.id === state.selectedActorId || u.id === state.selectedTargetId;
    const acted = state.actedIds.includes(u.id);
    const el = document.createElement("div");
    el.className = `unit ${u.hp <= 0 ? "dead" : ""} ${selected ? "selected" : ""}`;
    el.innerHTML = `
      <div class="unitName">${escapeHtml(u.name)}${acted ? " <span class=\"mini\">行動済</span>" : ""}</div>
      <div class="unitMeta">${escapeHtml(u.type)} / ${escapeHtml(u.cardId)}</div>
      <div class="bar"><span>HP</span><div class="track"><i class="fill hp" style="width:${hpPct}%"></i></div><span>${u.hp}/${u.maxHp}</span></div>
      <div class="bar"><span>SP</span><div class="track"><i class="fill" style="width:${spPct}%"></i></div><span>${u.sp}/${u.maxSp}</span></div>
    `;
    box.appendChild(el);
  }
}

function renderCommand() {
  const panel = $("commandPanel");
  if (!panel) return;
  panel.hidden = state.phase !== "player";
  if (panel.hidden) return;
  ensureSelections();

  const actorSelect = $("actorSelect");
  const actionSelect = $("actionSelect");
  const targetSelect = $("targetSelect");
  const actors = alive(state.party).filter((u) => !state.actedIds.includes(u.id));
  actorSelect.innerHTML = actors.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`).join("");
  actorSelect.value = state.selectedActorId;

  const actor = findUnit(state.selectedActorId);
  const acts = actor?.actions?.length ? actor.actions : [actionOf(actor || {})];
  actionSelect.innerHTML = acts.map((a, i) => {
    const rate = rateOf(a, "player");
    const cost = clampInt(a?.cost ?? 0, 0, 99);
    return `<option value="${i}">[${cost}] ${escapeHtml(a?.name || "技")} / ${rate}%</option>`;
  }).join("");
  actionSelect.value = String(state.selectedActionIndex);

  const targets = alive(state.enemies);
  targetSelect.innerHTML = targets.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} HP${u.hp}/${u.maxHp}</option>`).join("");
  targetSelect.value = state.selectedTargetId;
}

function renderAll() {
  const diff = DIFF[state.diff] || DIFF.normal;
  const power = deckPower();
  const scale = powerScale();
  const unitKinds = Object.keys(state.deckMap).filter((id) => isUnitCard(state.cardDefs[id] || {})).length;
  $("deckStatus").textContent =
    `デッキ: ${deckCount()}/${DECK_SIZE}枚 / ユニット候補 ${unitKinds}種 / 総コスト ${power} / 基準 ${diff.budget} / 敵補正 x${scale.toFixed(2)}`;
  $("runStatus").innerHTML = state.complete
    ? `<span class="reward">アーケード突破。報酬付与済み。</span>`
    : state.phase === "defeat"
      ? "敗北。ラン開始で再挑戦できます。"
      : state.phase === "between"
        ? `Round ${state.round - 1} CLEAR。次のラウンドへ。`
        : state.round
          ? `Round ${state.round}/${ROUND_MAX} / 難易度 ${diff.label}`
          : "難易度を選んでラン開始。";
  renderMap();
  renderUnits("party", state.party);
  renderUnits("enemies", state.enemies);
  renderCommand();
  $("log").textContent = state.log.slice(-180).join("\n");
  $("btnStart").disabled = deckCount() !== DECK_SIZE || (state.round > 0 && state.phase !== "defeat");
  $("btnNext").disabled = state.phase !== "between";
  $("btnRoll").disabled = state.phase !== "player" || !alive(state.party).length || !alive(state.enemies).length;
}

function startRun() {
  if (deckCount() !== DECK_SIZE) {
    state.log.push("30枚デッキを保存してから開始してください。");
    renderAll();
    return;
  }
  state.round = 1;
  state.phase = "player";
  state.complete = false;
  state.rewardPaid = false;
  state.actedIds = [];
  state.log = [`アーケード開始: ${(DIFF[state.diff] || DIFF.normal).label}`];
  state.party = drawPartyFromDeck();
  if (state.party.length < 3) {
    state.log.push("ユニットが3体見つかりません。デッキにキャラカードを増やしてください。");
    state.round = 0;
    state.phase = "setup";
    renderAll();
    return;
  }
  startRound();
}

function startRound() {
  state.enemies = createEnemies(state.round);
  state.phase = "player";
  state.actedIds = [];
  state.selectedActorId = "";
  state.selectedActionIndex = 0;
  state.selectedTargetId = "";
  state.log.push(`--- Round ${state.round} ---`);
  state.log.push(`敵: ${state.enemies.map((u) => u.name).join(" / ")}`);
  state.log.push("--- 自軍ターン ---");
  ensureSelections();
  renderAll();
}

async function init() {
  $("btnDeck")?.addEventListener("click", () => { location.href = "./index.html"; });
  $("btnProfile")?.addEventListener("click", () => { location.href = "./profile.html"; });
  $("btnStart")?.addEventListener("click", startRun);
  $("btnNext")?.addEventListener("click", startRound);
  $("btnRoll")?.addEventListener("click", playerAction);
  $("actorSelect")?.addEventListener("change", (e) => {
    state.selectedActorId = e.target.value || "";
    state.selectedActionIndex = 0;
    renderAll();
  });
  $("actionSelect")?.addEventListener("change", (e) => {
    state.selectedActionIndex = clampInt(e.target.value, 0, 99);
    renderAll();
  });
  $("targetSelect")?.addEventListener("change", (e) => {
    state.selectedTargetId = e.target.value || "";
    renderAll();
  });
  $("difficulty")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-diff]");
    if (!btn || state.round > 0) return;
    state.diff = btn.dataset.diff || "normal";
    for (const b of $("difficulty").querySelectorAll("button")) b.classList.toggle("active", b === btn);
    renderAll();
  });

  const profile = await ensureUserProfile();
  state.uid = profile.uid;
  state.gems = clampInt(profile.data?.gems ?? 0);
  $("gems").textContent = String(state.gems);
  await loadCardDefs();
  state.deckMap = loadLocalDeck();
  renderAll();
}

init().catch((e) => {
  console.error(e);
  $("runStatus").textContent = `アーケード初期化失敗: ${e?.message || e}`;
});
