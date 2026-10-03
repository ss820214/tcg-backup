// public/profile.js
// v20260723_starter_series1

import { db } from "./auth.js?v=20260627_perm1";
import {
  ensureUserProfile,
  ensureStarterOwnedCards,
  watchUserProfile,
  watchOwnedCards,
  getRecentHistory,
  claimPendingAdminGrants,
  grantGemsByAdmin,
  grantPityByAdmin,
  grantCardByAdmin,
  upgradeYouCard,
  setYouCardAttribute,
  YOU_UPGRADE_COSTS,
  YOU_ATTRIBUTES,
  YOU_PERK_POOL,
  normalizeYouCard,
} from "./user_store.js?v=20260726_post1";
import { FAIRY_TALE_CARD_LIST } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { JEWEL_CARD_LIST } from "./jewel_cards.js?v=20260828_jewel_art1";
import { STARTER_SUPPORT_CARDS } from "./starter_support_cards.js?v=20260706_starter_support_all1";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const state = {
  uid: "",
  cards: new Map(),
  owned: [],
  query: "",
  profile: null,
};
const PLAYER_NAME_KEY = "tcg_player_name_v20260202_30";

function normalizePlayerNameInput(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function saveLocalPlayerName(name) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, String(name || ""));
  } catch {}
}

function num(v) {
  const n = Math.trunc(Number(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(v) {
  try {
    const d = v?.toDate ? v.toDate() : null;
    if (!d) return "";
    return d.toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function rarityOf(c) {
  const r = String(c?.rarity || "R").toUpperCase();
  return r === "SSR" || r === "SR" || r === "R" ? r : "R";
}

async function loadCardDefs() {
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
      console.warn("[profile] collection skipped", colName, e?.message || e);
      return [];
    }
  };

  const all = [
    ...STARTER_SUPPORT_CARDS,
    ...(await loadCollectionSafe("cards", "unit")),
    ...(await loadCollectionSafe("support_cards", "support")),
    ...(await loadCollectionSafe("supports", "support")),
    ...(await loadCollectionSafe("supportCards", "support")),
    ...(await loadCollectionSafe("ex_support_cards", "ex_support")),
    ...(await loadCollectionSafe("ex_supports", "ex_support")),
    ...(await loadCollectionSafe("exSupportCards", "ex_support")),
    ...(await loadCollectionSafe("ex_support", "ex_support")),
  ];
  const map = new Map();
  for (const c of all) {
    map.set(c.id, c);
  }
  for (const c of FAIRY_TALE_CARD_LIST) {
    map.set(c.id, { ...c });
  }
  for (const c of JEWEL_CARD_LIST) {
    map.set(c.id, { ...c });
  }
  state.cards = map;
}

function renderProfile(data) {
  state.profile = data || state.profile || {};
  const fullUid = state.uid || data?.uid || "...";
  $("uid").textContent = shortenUid(fullUid);
  $("uid")?.setAttribute("title", fullUid);
  ensurePlayerNamePanel();
  const currentName = normalizePlayerNameInput(data?.playerName || data?.displayName || data?.name || "");
  const nameInput = $("profilePlayerName");
  const namePreview = $("profilePlayerNamePreview");
  if (currentName) saveLocalPlayerName(currentName);
  if (nameInput && document.activeElement !== nameInput) nameInput.value = currentName;
  if (namePreview) namePreview.textContent = currentName || "未設定";
  $("gems").textContent = String(num(data?.gems));
  $("pity").textContent = String(num(data?.pity));
  $("matches").textContent = String(num(data?.stats?.matches));
  $("wins").textContent = String(num(data?.stats?.wins));
  $("losses").textContent = String(num(data?.stats?.losses));
  $("adminPanel")?.classList.toggle("hidden", data?.isAdmin !== true);
  if (data?.youCard?.id) state.cards.set(data.youCard.id, normalizeYouCard(data.youCard, fullUid));
  renderYouCard(data?.youCard, data?.pity);
}

function ensurePlayerNamePanel() {
  if ($("profileNamePanel")) return;
  const profilePanel = document.querySelector("main.grid .panel");
  const stats = profilePanel?.querySelector(".stats");
  if (!profilePanel || !stats) return;

  if (!$("profileNameCss")) {
    const style = document.createElement("style");
    style.id = "profileNameCss";
    style.textContent = `
      .profileNamePanel{
        margin-top:12px;
        border:1px solid rgba(120,227,173,.22);
        border-radius:8px;
        padding:12px;
        background:
          radial-gradient(280px 120px at 0% 0%, rgba(120,227,173,.12), transparent 62%),
          rgba(0,0,0,.22);
      }
      .profileNameHead{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:10px;
      }
      .profileNameHead b{font-size:14px;}
      .profileNamePreview{
        max-width:48%;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:var(--accent);
        font-weight:900;
      }
      .profileNameForm{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        gap:8px;
      }
      .profileNameInput{
        width:100%;
        border:1px solid var(--line);
        border-radius:8px;
        padding:10px 11px;
        background:rgba(0,0,0,.24);
        color:var(--text);
        outline:none;
      }
      .profileNameNote{
        margin-top:8px;
        color:var(--muted);
        font-size:12px;
        line-height:1.45;
      }
      .profileNameMsg{
        margin-top:8px;
        min-height:18px;
        color:var(--accent);
        font-size:12px;
      }
      .profileNameMsg.bad{color:var(--bad);}
      @media (max-width: 620px){
        .profileNameForm{grid-template-columns:1fr;}
        .profileNamePreview{max-width:100%;}
      }
    `;
    document.head.appendChild(style);
  }

  const panel = document.createElement("section");
  panel.id = "profileNamePanel";
  panel.className = "profileNamePanel";
  panel.innerHTML = `
    <div class="profileNameHead">
      <b>プレイヤー名</b>
      <span id="profilePlayerNamePreview" class="profileNamePreview">未設定</span>
    </div>
    <div class="profileNameForm">
      <input id="profilePlayerName" class="profileNameInput" type="text" maxlength="24" placeholder="例: obato_217">
      <button id="btnSaveProfileName" type="button">名前を保存</button>
    </div>
    <div class="profileNameNote">対戦ルームやジェム配布の指定名として使います。保存後はデッキ画面の対戦開始にも反映されます。</div>
    <div id="profileNameMsg" class="profileNameMsg"></div>
  `;
  stats.insertAdjacentElement("afterend", panel);
  $("btnSaveProfileName")?.addEventListener("click", handleSaveProfileName);
}

function setProfileNameMsg(msg, ok = true) {
  const el = $("profileNameMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `profileNameMsg ${ok ? "" : "bad"}`;
}

async function handleSaveProfileName() {
  const input = $("profilePlayerName");
  const clean = normalizePlayerNameInput(input?.value || "");
  if (!clean) return setProfileNameMsg("名前を入力してください。", false);
  try {
    saveLocalPlayerName(clean);
    const res = await ensureUserProfile({ playerName: clean, displayName: clean, name: clean });
    state.uid = res.uid || state.uid;
    state.profile = { ...(state.profile || {}), ...(res.data || {}), playerName: clean, displayName: clean, name: clean };
    $("profilePlayerNamePreview").textContent = clean;
    setProfileNameMsg(`保存しました: ${clean}`, true);
  } catch (e) {
    setProfileNameMsg(String(e?.message || e), false);
  }
}

function applyYouCardResult(card, pity) {
  const normalized = normalizeYouCard(card || {}, state.uid);
  state.profile = {
    ...(state.profile || {}),
    pity: num(pity),
    youCard: normalized,
  };
  state.cards.set(normalized.id, normalized);
  $("pity").textContent = String(num(pity));
  renderYouCard(normalized, pity);
}

function actionText(a = {}) {
  const hp = num(a.hpDelta ?? a.hp);
  const sp = num(a.spDelta ?? a.sp);
  const parts = [
    `[${num(a.cost)}] ${a.name || "skill"}`,
    a.range || "front1",
    `${num(a.rate ?? a.successRate)}%`,
  ];
  if (hp) parts.push(`HP${hp > 0 ? "+" : ""}${hp}`);
  if (sp) parts.push(`SP${sp > 0 ? "+" : ""}${sp}`);
  if (a.addStatus) parts.push(String(a.addStatus));
  return parts.join(" / ");
}

function effectText(e = {}) {
  const name = e.name ? `${e.name}: ` : "";
  const trigger = e.trigger || "effect";
  const type = e.type || "-";
  const bits = [];
  if (e.hp) bits.push(`HP${e.hp > 0 ? "+" : ""}${e.hp}`);
  if (e.sp) bits.push(`SP${e.sp > 0 ? "+" : ""}${e.sp}`);
  if (e.status) bits.push(String(e.status));
  if (e.amount) bits.push(`mana+${e.amount}`);
  return `${name}${trigger} / ${type}${bits.length ? ` / ${bits.join(" ")}` : ""}`;
}

function perkText(p = {}) {
  if (!p?.id) return "未設定";
  return `${p.name || p.id}${p.desc ? ` / ${p.desc}` : ""}`;
}

function perkOptionHtml() {
  return YOU_PERK_POOL
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} - ${escapeHtml(p.desc)}</option>`)
    .join("");
}

function youSkillRowHtml(action, perk, index, pity) {
  const slot = index + 1;
  const perkAllowed = index < 2;
  const perkCost = index === 0 ? YOU_UPGRADE_COSTS.perk1 : YOU_UPGRADE_COSTS.perk2;
  if (!action) {
    return `<div class="youLine muted"><div class="youSkillTop"><span>技${slot} 未開放</span></div></div>`;
  }
  const hasPerk = Boolean(perk?.id);
  const canBuy = num(pity) >= perkCost && !hasPerk;
  return `
    <div class="youLine youSkillRow">
      <div class="youSkillTop">
        <span><b>技${slot}</b> ${escapeHtml(actionText(action))}</span>
        ${perkAllowed ? `<button class="perkIconBtn ${hasPerk ? "active" : ""}" type="button" data-you-perk-toggle="${index}" title="パーク詳細">🧩</button>` : ""}
      </div>
      ${perkAllowed ? `
        <div class="youPerkPanel hidden" data-you-perk-panel="${index}">
          <div class="label">パーク</div>
          <div class="youPerkCurrent">${escapeHtml(perkText(perk))}</div>
          ${hasPerk ? "" : `
            <div class="youPerkApply">
              <select id="youPerkSelect${slot}">${perkOptionHtml()}</select>
              <button type="button" data-you-perk-apply="${index}" ${canBuy ? "" : "disabled"}>付与 (${perkCost})</button>
            </div>
          `}
        </div>
      ` : ""}
    </div>
  `;
}

function renderYouCard(raw, pity = 0) {
  const box = $("youCardBox");
  if (!box) return;
  const card = normalizeYouCard(raw || {}, state.uid);
  const actions = Array.isArray(card.actions) ? card.actions : [];
  const effects = Array.isArray(card.cardEffects) ? card.cardEffects : [];
  const perks = Array.isArray(card.perks) ? card.perks : [];
  const attrCost = card.attrSelected ? YOU_UPGRADE_COSTS.attr : 0;
  const attrOptions = YOU_ATTRIBUTES
    .map((a) => `<option value="${escapeHtml(a)}" ${a === card.attr ? "selected" : ""}>${escapeHtml(a)}</option>`)
    .join("");
  box.innerHTML = `
    <div class="youCardHead">
      <div>
        <div class="youName">${escapeHtml(card.name || "YOU")}</div>
        <div class="youMeta">${escapeHtml(card.type || "-")} / cost ${num(card.cost)} / Growth ${num(pity)}</div>
      </div>
      <div class="youStat"><b>HP</b>${num(card.hp)}</div>
      <div class="youStat"><b>SP</b>${num(card.sp)}</div>
    </div>
    <div class="youList">
      <div class="label">Skills</div>
      ${[0, 1, 2].map((i) => youSkillRowHtml(actions[i], perks[i], i, pity)).join("")}
    </div>
    <div class="youList">
      <div class="label">Abilities</div>
      ${effects.map((e) => `<div class="youLine">${escapeHtml(effectText(e))}</div>`).join("") || `<div class="youLine muted">none</div>`}
    </div>
    <div class="youAttrRow">
      <label>
        <span class="label">属性</span>
        <select id="youAttrSelect">${attrOptions}</select>
      </label>
      <button id="btnYouAttr" type="button">属性変更 (${attrCost})</button>
    </div>
  `;
  $("btnYouAttr")?.addEventListener("click", () => handleYouAttribute());
  box.querySelectorAll("[data-you-perk-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.getAttribute("data-you-perk-toggle");
      box.querySelector(`[data-you-perk-panel="${idx}"]`)?.classList.toggle("hidden");
    });
  });
  box.querySelectorAll("[data-you-perk-apply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-you-perk-apply") || 0);
      handleYouUpgrade(idx === 0 ? "perk1" : "perk2");
    });
  });
  const setCost = (id, label, cost) => {
    const btn = $(id);
    if (!btn) return;
    btn.textContent = `${label} (${cost})`;
    btn.disabled = num(pity) < cost;
  };
  setCost("btnYouAttr", "属性変更", attrCost);
  setCost("btnYouHp", "HP+10", YOU_UPGRADE_COSTS.hp);
  setCost("btnYouSp", "SP+10", YOU_UPGRADE_COSTS.sp);
  setCost("btnYouSkill1", "技1ガチャ", YOU_UPGRADE_COSTS.skill1);
  setCost("btnYouSkill2", "技2ガチャ", YOU_UPGRADE_COSTS.skill2);
  setCost("btnYouSkill3", "技3ガチャ", YOU_UPGRADE_COSTS.skill3);
  setCost("btnYouAbility", "特殊ガチャ", YOU_UPGRADE_COSTS.ability);
}

function setYouMsg(msg, ok = true) {
  const el = $("youMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `youMsg ${ok ? "ok" : "bad"}`;
}

async function handleYouUpgrade(kind) {
  try {
    const opts = {};
    if (kind === "perk1") opts.perkId = $("youPerkSelect1")?.value || "";
    if (kind === "perk2") opts.perkId = $("youPerkSelect2")?.value || "";
    const res = await upgradeYouCard(state.uid, kind, opts);
    applyYouCardResult(res.card, res.pityAfter);
    setYouMsg(`${res.label} / Growth ${res.pityBefore} -> ${res.pityAfter}`, true);
  } catch (e) {
    setYouMsg(String(e?.message || e), false);
  }
}

async function handleYouAttribute() {
  try {
    const res = await setYouCardAttribute(state.uid, $("youAttrSelect")?.value || "");
    applyYouCardResult(res.card, res.pityAfter);
    setYouMsg(`${res.label} / Growth ${res.pityBefore} -> ${res.pityAfter}`, true);
  } catch (e) {
    setYouMsg(String(e?.message || e), false);
  }
}

function shortenUid(uid) {
  const s = String(uid || "");
  if (s.length <= 18) return s || "...";
  return `${s.slice(0, 8)}...${s.slice(-6)}`;
}

function renderOwned() {
  const box = $("cards");
  if (!box) return;
  const q = state.query.trim().toLowerCase();
  const withDefs = state.owned.map((o) => {
    const def = state.cards.get(o.cardId) || {};
    return { ...o, def, name: def.name || o.cardId, rarity: rarityOf(def) };
  });
  withDefs.sort((a, b) => {
    const rank = { SSR: 0, SR: 1, R: 2 };
    return (rank[a.rarity] ?? 9) - (rank[b.rarity] ?? 9)
      || String(a.name).localeCompare(String(b.name), "ja")
      || String(a.cardId).localeCompare(String(b.cardId));
  });

  const filtered = q
    ? withDefs.filter((o) => {
      const hay = `${o.cardId} ${o.name} ${o.rarity} ${o.def.type || ""}`.toLowerCase();
      return hay.includes(q);
    })
    : withDefs;

  $("ownedUnique").textContent = String(state.owned.length);
  $("ownedTotal").textContent = String(state.owned.reduce((a, b) => a + num(b.count), 0));

  box.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.owned.length ? "条件に合うカードがありません" : "まだ所持カードがありません";
    box.appendChild(empty);
    return;
  }

  for (const item of filtered) {
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <div class="count">x${num(item.count)}</div>
      <div class="rar ${item.rarity}">${item.rarity}</div>
      <div class="name">${escapeHtml(item.name)}</div>
      <div class="meta">${escapeHtml(item.def.type || "-")} / ${escapeHtml(item.cardId)}</div>
    `;
    box.appendChild(el);
  }
}

function renderHistory(list) {
  const box = $("history");
  if (!box) return;
  box.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "まだ対戦履歴がありません";
    box.appendChild(empty);
    return;
  }
  for (const h of list) {
    const result = String(h.result || "").toLowerCase();
    const type = String(h.type || "match");
    const el = document.createElement("div");
    el.className = "row";
    if (type === "admin_gems" || type === "gems" || type === "operation_gems") {
      el.innerHTML = `
        <div class="result win">GEMS</div>
        <div>${escapeHtml(fmtDate(h.at) || h.id)} / ${escapeHtml(h.reason || "admin")}</div>
        <div class="reward">${num(h.amount) >= 0 ? "+" : ""}${num(h.amount)} gems</div>
      `;
    } else if (type === "admin_pity" || type === "pity") {
      el.innerHTML = `
        <div class="result win">PT</div>
        <div>${escapeHtml(fmtDate(h.at) || h.id)} / ${escapeHtml(h.reason || "growth")}</div>
        <div class="reward">${num(h.amount) >= 0 ? "+" : ""}${num(h.amount)} Growth</div>
      `;
    } else if (type === "admin_card") {
      el.innerHTML = `
        <div class="result win">CARD</div>
        <div>${escapeHtml(fmtDate(h.at) || h.id)} / ${escapeHtml(h.cardId || "-")}</div>
        <div class="reward">x${num(h.count)}</div>
      `;
    } else {
      const deck = h.deckTitle ? ` / ${h.deckTitle}` : "";
      const duration = formatDuration(h.durationMs);
      el.innerHTML = `
        <div class="result ${result}">${result === "win" ? "WIN" : "LOSE"}</div>
        <div>${escapeHtml(fmtDate(h.at) || h.roomId || h.id)} / ${escapeHtml(h.reason || "match")}${escapeHtml(deck)}${duration ? ` / ${escapeHtml(duration)}` : ""}</div>
        <div class="reward">+${num(h.reward)} gems</div>
      `;
    }
    box.appendChild(el);
  }
}

function formatDuration(ms) {
  const total = Math.max(0, Math.trunc(Number(ms || 0) / 1000));
  if (!total) return "";
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}時間${m % 60}分`;
  }
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

function setAdminMsg(msg, ok = true) {
  const el = $("adminMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `adminMsg ${ok ? "ok" : "bad"}`;
}

function setUidMsg(msg, ok = true) {
  const el = $("uidCopyMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `uidCopyMsg ${ok ? "ok" : "bad"}`;
  if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 1400);
}

async function handleGrantGems() {
  try {
    if (state.profile?.isAdmin !== true) throw new Error("管理者権限が必要です");
    const targetUid = $("adminTargetUid")?.value || "";
    const amount = $("adminGemAmount")?.value || "";
    const reason = $("adminReason")?.value || "admin_grant";
    const res = await grantGemsByAdmin(state.uid, targetUid, amount, reason);
    if (res.queued) {
      setAdminMsg(`${res.uid} への ${res.amount} gems 配布を予約しました。相手がユーザー画面を開くと反映されます。`, true);
    } else {
      setAdminMsg(`${res.uid} に ${res.amount} gems を配布しました`, true);
    }
    if (res.uid === state.uid) await claimPendingAdminGrants(state.uid);
    await refreshHistory();
  } catch (e) {
    setAdminMsg(String(e?.message || e), false);
  }
}

async function handleGrantPity() {
  try {
    if (state.profile?.isAdmin !== true) throw new Error("管理者権限が必要です");
    const targetUid = $("adminTargetUid")?.value || "";
    const amount = $("adminPityAmount")?.value || "";
    const reason = $("adminReason")?.value || "admin_growth";
    const res = await grantPityByAdmin(state.uid, targetUid, amount, reason);
    if (res.queued) {
      setAdminMsg(`${res.uid} への ${res.amount} Growth Pt 配布を予約しました。相手がユーザー画面を開くと反映されます。`, true);
    } else {
      setAdminMsg(`${res.uid} に ${res.amount} Growth Pt を配布しました`, true);
    }
    if (res.uid === state.uid) await claimPendingAdminGrants(state.uid);
    await refreshHistory();
  } catch (e) {
    setAdminMsg(String(e?.message || e), false);
  }
}

async function copyUid() {
  try {
    if (!state.uid) return;
    await navigator.clipboard.writeText(state.uid);
    setUidMsg("コピーしました", true);
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = state.uid;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setUidMsg("コピーしました", true);
    } catch (e) {
      setUidMsg("コピー失敗", false);
    }
  }
}

async function handleGrantCard() {
  try {
    if (state.profile?.isAdmin !== true) throw new Error("管理者権限が必要です");
    const targetUid = $("adminTargetUid")?.value || "";
    const cardId = $("adminCardId")?.value || "";
    const count = $("adminCardCount")?.value || "1";
    const reason = $("adminReason")?.value || "admin_card";
    const res = await grantCardByAdmin(state.uid, targetUid, cardId, count, reason);
    if (res.queued) {
      setAdminMsg(`${res.uid} への ${res.cardId} x${res.count} 配布を予約しました。相手がユーザー画面を開くと反映されます。`, true);
    } else {
      setAdminMsg(`${res.uid} に ${res.cardId} x${res.count} を配布しました`, true);
    }
    if (res.uid === state.uid) await claimPendingAdminGrants(state.uid);
    await refreshHistory();
  } catch (e) {
    setAdminMsg(String(e?.message || e), false);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshHistory() {
  if (!state.uid) return;
  try {
    renderHistory(await getRecentHistory(state.uid, 24));
  } catch {
    renderHistory([]);
  }
}

async function init() {
  $("btnDeck")?.addEventListener("click", () => { location.href = "./index.html"; });
  $("btnGacha")?.addEventListener("click", () => { location.href = "./gacha.html"; });
  $("btnReload")?.addEventListener("click", () => { location.reload(); });
  $("btnCopyUid")?.addEventListener("click", copyUid);
  $("btnGrantGems")?.addEventListener("click", handleGrantGems);
  $("btnGrantPity")?.addEventListener("click", handleGrantPity);
  $("btnGrantCard")?.addEventListener("click", handleGrantCard);
  $("btnYouHp")?.addEventListener("click", () => handleYouUpgrade("hp"));
  $("btnYouSp")?.addEventListener("click", () => handleYouUpgrade("sp"));
  $("btnYouSkill1")?.addEventListener("click", () => handleYouUpgrade("skill1"));
  $("btnYouSkill2")?.addEventListener("click", () => handleYouUpgrade("skill2"));
  $("btnYouSkill3")?.addEventListener("click", () => handleYouUpgrade("skill3"));
  $("btnYouAbility")?.addEventListener("click", () => handleYouUpgrade("ability"));
  $("search")?.addEventListener("input", (e) => {
    state.query = e.target.value || "";
    renderOwned();
  });

  await loadCardDefs();
  const { uid, data } = await ensureUserProfile();
  state.uid = uid;
  await ensureStarterOwnedCards(uid, Object.fromEntries(state.cards.entries()));
  renderProfile(data);
  watchUserProfile(uid, renderProfile);
  watchOwnedCards(uid, (owned) => {
    state.owned = owned;
    renderOwned();
  });
  await refreshHistory();
}

init().catch((e) => {
  console.error(e);
  alert(`ユーザー情報の読み込みに失敗しました: ${e?.message || e}`);
});
