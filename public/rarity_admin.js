// public/rarity_admin.js
// v20260627_rarity1

import { db, ensureSignedIn } from "./auth.js?v=20260627_rarity1";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const ADMIN_OK_LOCAL = "tcg_admin_ok_v1";
const RARITIES = ["R", "SR", "SSR"];

const $ = (id) => document.getElementById(id);
const state = {
  cards: [],
  filtered: [],
  busy: false,
};

function isAdminUnlocked() {
  try {
    return localStorage.getItem(ADMIN_OK_LOCAL) === "1";
  } catch {
    return false;
  }
}

function normalizeRarity(v) {
  const r = String(v || "").toUpperCase().trim();
  return RARITIES.includes(r) ? r : "R";
}

function rawRarity(v) {
  const r = String(v || "").toUpperCase().trim();
  return RARITIES.includes(r) ? r : "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setToast(msg, kind = "") {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `toast ${kind}`.trim();
}

function setBusy(v) {
  state.busy = !!v;
  $("btnBulk").disabled = state.busy;
}

async function loadCards() {
  setToast("カード一覧を読み込み中...");
  const snap = await getDocs(collection(db, "cards"));
  state.cards = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  state.cards.sort((a, b) => {
    const ar = normalizeRarity(a.data?.rarity);
    const br = normalizeRarity(b.data?.rarity);
    const rank = { SSR: 0, SR: 1, R: 2 };
    return (rank[ar] ?? 9) - (rank[br] ?? 9)
      || String(a.data?.name || "").localeCompare(String(b.data?.name || ""), "ja")
      || a.id.localeCompare(b.id);
  });
  setToast(`読み込み完了: ${state.cards.length}枚`, "ok");
  render();
}

function getFilteredCards() {
  const q = String($("search")?.value || "").trim().toLowerCase();
  const filter = String($("filterRarity")?.value || "");
  return state.cards.filter((card) => {
    const data = card.data || {};
    const rr = rawRarity(data.rarity);
    const nr = normalizeRarity(data.rarity);
    if (filter === "UNSET" && rr) return false;
    if (filter && filter !== "UNSET" && nr !== filter) return false;
    if (!q) return true;
    const hay = `${card.id} ${data.name || ""} ${data.attr || ""} ${data.type || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderStats() {
  const counts = { R: 0, SR: 0, SSR: 0, UNSET: 0 };
  for (const card of state.cards) {
    const raw = rawRarity(card.data?.rarity);
    if (!raw) counts.UNSET += 1;
    counts[normalizeRarity(card.data?.rarity)] += 1;
  }
  $("stats").innerHTML = `
    <span class="pill">全 ${state.cards.length}</span>
    <span class="pill SSR">SSR ${counts.SSR}</span>
    <span class="pill SR">SR ${counts.SR}</span>
    <span class="pill R">R ${counts.R}</span>
    <span class="pill">未設定 ${counts.UNSET}</span>
    <span class="pill">表示 ${state.filtered.length}</span>
  `;
}

function render() {
  state.filtered = getFilteredCards();
  renderStats();

  const list = $("list");
  list.innerHTML = "";
  if (!state.filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "該当するカードがありません";
    list.appendChild(empty);
    return;
  }

  for (const card of state.filtered) {
    const data = card.data || {};
    const rarity = normalizeRarity(data.rarity);
    const raw = rawRarity(data.rarity);
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <div class="cardHead">
        <div>
          <div class="name">${escapeHtml(data.name || "(no name)")}</div>
          <div class="id">${escapeHtml(card.id)}</div>
        </div>
        <select class="raritySelect ${rarity}" data-card-id="${escapeHtml(card.id)}">
          <option value="R" ${rarity === "R" ? "selected" : ""}>R</option>
          <option value="SR" ${rarity === "SR" ? "selected" : ""}>SR</option>
          <option value="SSR" ${rarity === "SSR" ? "selected" : ""}>SSR</option>
        </select>
      </div>
      <div class="meta">
        ${escapeHtml(data.attr || data.type || "-")} / cost:${escapeHtml(data.cost ?? "?")} / HP:${escapeHtml(data.hp ?? "?")} SP:${escapeHtml(data.sp ?? "?")}
        ${raw ? "" : " / 未設定はR扱い"}
      </div>
    `;
    list.appendChild(el);
  }

  list.querySelectorAll(".raritySelect").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const target = e.currentTarget;
      await saveRarity(target.dataset.cardId, target.value, target);
    });
  });
}

async function saveRarity(cardId, rarity, selectEl = null) {
  if (!isAdminUnlocked()) {
    setToast("管理者モードが解除されていません", "bad");
    return;
  }
  const r = normalizeRarity(rarity);
  try {
    if (selectEl) {
      selectEl.disabled = true;
      selectEl.className = `raritySelect ${r}`;
    }
    await setDoc(doc(db, "cards", cardId), {
      rarity: r,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    const item = state.cards.find((c) => c.id === cardId);
    if (item) item.data = { ...item.data, rarity: r };
    setToast(`${cardId} を ${r} にしました`, "ok");
    renderStats();
  } catch (e) {
    console.error(e);
    setToast(`保存失敗: ${e?.message || e}`, "bad");
  } finally {
    if (selectEl) selectEl.disabled = false;
  }
}

async function bulkApply() {
  if (!isAdminUnlocked()) {
    setToast("管理者モードが解除されていません", "bad");
    return;
  }
  const target = normalizeRarity($("bulkRarity").value);
  const cards = getFilteredCards();
  if (!cards.length) return setToast("一括反映するカードがありません", "bad");
  if (!confirm(`表示中の ${cards.length} 枚を ${target} にします。よろしいですか？`)) return;

  setBusy(true);
  setToast(`一括反映中... ${cards.length}枚`);
  try {
    for (let i = 0; i < cards.length; i += 450) {
      const chunk = cards.slice(i, i + 450);
      const batch = writeBatch(db);
      for (const card of chunk) {
        batch.set(doc(db, "cards", card.id), {
          rarity: target,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
    }
    for (const card of cards) card.data = { ...card.data, rarity: target };
    setToast(`一括反映しました: ${cards.length}枚 -> ${target}`, "ok");
    render();
  } catch (e) {
    console.error(e);
    setToast(`一括反映失敗: ${e?.message || e}`, "bad");
  } finally {
    setBusy(false);
  }
}

function wire() {
  $("btnDeck")?.addEventListener("click", () => { location.href = "./index.html"; });
  $("btnGacha")?.addEventListener("click", () => { location.href = "./gacha.html"; });
  $("btnReload")?.addEventListener("click", () => { location.reload(); });
  $("search")?.addEventListener("input", render);
  $("filterRarity")?.addEventListener("change", render);
  $("btnBulk")?.addEventListener("click", bulkApply);
}

async function init() {
  wire();
  $("lock").style.display = isAdminUnlocked() ? "none" : "block";
  await ensureSignedIn();
  await loadCards();
}

init().catch((e) => {
  console.error(e);
  setToast(`初期化失敗: ${e?.message || e}`, "bad");
});
