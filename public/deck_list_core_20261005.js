// public/deck_list.js
// v20260822_deck_meta1

import { db, ensureSignedIn } from "./auth.js?v=20260627_perm1";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const MAX_DECKS = 10;
const PUBLIC_LIMIT = 80;
const LOCAL_KEY = "tcg_deck_local_v20260202_30";
const DECK_TITLE_KEY = "tcg_deck_title_v20260204";
const EX_KEY = "tcg_ex_support_v20260202_30";
const FIELD_KEY = "tcg_desired_field_v20260702";
const LAST_ID_KEY = "tcg_cloud_deck_last_id_v20260204";
const DEVICE_KEY = "tcg_cloud_device_key_v20260204";
const PENDING_CLOUD_DECK_KEY = "tcg_pending_cloud_deck_v20260822";

const $ = (id) => document.getElementById(id);

let items = [];
let mode = new URLSearchParams(location.search).get("mode") === "public" ? "public" : "my";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getLS(k) {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
}

function setLS(k, v) {
  try {
    localStorage.setItem(k, String(v ?? ""));
  } catch {}
}

function deviceKey() {
  let key = getLS(DEVICE_KEY);
  if (key) return key;
  try {
    key = crypto.randomUUID?.() || `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    key = `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
  setLS(DEVICE_KEY, key);
  return key;
}

function sumDeck(deck) {
  let total = 0;
  for (const [key, v] of Object.entries(deck || {})) {
    if (key === "__tcg_partial_slots__") continue;
    const n = Number(v || 0);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isDeckDoc(data = {}) {
  const type = String(data.type || data.docType || data.kind || "").toLowerCase();
  const title = String(data.title || "");
  if (type === "user_name_index") return false;
  if (type.includes("template") || type.includes("skill") || type.includes("action") || type.includes("creator")) return false;
  if (title.includes("技テンプレ")) return false;
  if (!isPlainObject(data.deck)) return false;
  const actual = Number(data.deckSize || 0) || sumDeck(data.deck);
  return actual >= 1 && actual <= 30;
}

function millis(ts) {
  try {
    return ts?.toMillis?.() ?? (typeof ts === "number" ? ts : 0);
  } catch {
    return 0;
  }
}

function fmtTime(ts) {
  const ms = millis(ts);
  if (!ms) return "更新日なし";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function normalizeVisibility(v) {
  const s = String(v || "").toLowerCase();
  if (s === "private" || s === "hidden" || s === "secret") return "private";
  if (s === "unlisted" || s === "limited") return "unlisted";
  return "public";
}

function visibilityLabel(v) {
  const s = normalizeVisibility(v);
  if (s === "private") return "非公開";
  if (s === "unlisted") return "限定公開";
  return "公開";
}

function visibilityClass(v) {
  return normalizeVisibility(v);
}

function cleanColor(v) {
  const s = String(v || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : "#70c7ff";
}

function message(text, ok = true) {
  const el = $("message");
  if (!el) return;
  el.className = `message ${ok ? "" : "bad"}`;
  el.textContent = text || "";
}

function currentParamsUrl(path) {
  const url = new URL(path, location.href);
  const params = new URLSearchParams(location.search);
  for (const key of ["room", "player", "debug_owned"]) {
    const v = params.get(key);
    if (v) url.searchParams.set(key, v);
  }
  return url.href;
}

async function safeDocs(q, label) {
  try {
    const snap = await getDocs(q);
    return snap.docs;
  } catch (e) {
    console.warn(`deck_list query failed (${label}):`, e?.message || e);
    return [];
  }
}

async function loadDecks() {
  const user = await ensureSignedIn();
  const profileUid = getLS("uid") || user?.uid || "";
  const key = deviceKey();
  $("uidPill").textContent = `uid: ${(profileUid || user?.uid || "").slice(0, 10) || "..."}`;

  const decksCol = collection(db, "decks");
  let docs = [];
  if (mode === "public") {
    docs = await safeDocs(
      query(decksCol, where("visibility", "==", "public"), limit(PUBLIC_LIMIT)),
      "public",
    );
  } else {
    docs = [
      ...(await safeDocs(query(decksCol, where("ownerUid", "==", profileUid), limit(80)), "ownerUid")),
      ...(await safeDocs(query(decksCol, where("ownerKey", "==", key), limit(80)), "ownerKey")),
    ];
  }

  const map = new Map();
  for (const d of docs) {
    const data = d.data() || {};
    if (!isDeckDoc(data)) continue;
    if (mode === "public" && normalizeVisibility(data.visibility) !== "public") continue;
    map.set(d.id, { id: d.id, data });
  }
  const cap = mode === "my" ? MAX_DECKS : PUBLIC_LIMIT;
  items = Array.from(map.values())
    .sort((a, b) => millis(b.data.updatedAt) - millis(a.data.updatedAt))
    .slice(0, cap);
  render();
}

function filteredItems() {
  const q = String($("searchInput")?.value || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter(({ id, data }) => {
    const tags = Array.isArray(data.tags) ? data.tags.join(" ") : "";
    return `${id} ${data.title || ""} ${data.ownerName || ""} ${tags}`.toLowerCase().includes(q);
  });
}

function syncModeUI() {
  $("tabMy")?.classList.toggle("active", mode === "my");
  $("tabPublic")?.classList.toggle("active", mode === "public");
  const title = $("pageTitle");
  const desc = $("pageDesc");
  const head = $("boardTitle");
  if (title) title.textContent = mode === "my" ? "自分のデッキ" : "みんなのデッキ";
  if (desc) {
    desc.textContent =
      mode === "my"
        ? "保存済みデッキは最大10件。名前・公開範囲・テーマカラーをここで管理できます。"
        : "公開されたデッキを検索してロードできます。限定公開・非公開デッキは表示されません。";
  }
  if (head) head.textContent = mode === "my" ? "保存スロット" : "公開デッキ";
  $("countPill").textContent =
    mode === "my" ? `${items.length} / ${MAX_DECKS}` : `${items.length}件`;
  const url = new URL(location.href);
  url.searchParams.set("mode", mode);
  history.replaceState(null, "", url.href);
}

function render() {
  const grid = $("deckGrid");
  if (!grid) return;
  syncModeUI();
  const shown = filteredItems();
  grid.innerHTML = "";

  shown.forEach((it, index) => grid.appendChild(renderDeckCard(it, index + 1)));

  if (!shown.length) {
    const div = document.createElement("div");
    div.className = "deckCard empty";
    div.innerHTML =
      mode === "my"
        ? `<div><div class="slot">NO DECK</div><div class="deckName">保存デッキなし</div><div class="sub">デッキビルダーで「保存」を押すとここに追加されます。</div></div>`
        : `<div><div class="slot">NO PUBLIC DECK</div><div class="deckName">公開デッキなし</div><div class="sub">検索条件を変えるか、誰かが公開するのを待ってください。</div></div>`;
    grid.appendChild(div);
  }

}

function renderDeckCard(item, slotNo) {
  const { id, data } = item;
  const title = String(data.title || id || "無題デッキ");
  const tags = Array.isArray(data.tags) ? data.tags.slice(0, 4) : [];
  const vis = normalizeVisibility(data.visibility);
  const themeColor = cleanColor(data.themeColor || data.accentColor);
  const count = Number(data.deckSize || 0) || sumDeck(data.deck || {});
  const canEdit = mode === "my";
  const card = document.createElement("article");
  card.className = "deckCard";
  card.style.setProperty("--deck-color", themeColor);
  card.innerHTML = `
    <div class="deckCardMain">
      <div class="deckCardTopline">
        <div>
          <div class="slot">SLOT ${String(slotNo).padStart(2, "0")}</div>
          <div class="deckName" title="${esc(title)}">${esc(title)}</div>
        </div>
        <div class="deckCardQuick">
          <button class="btn primary" type="button" data-load>ロード</button>
          ${canEdit ? `<button class="btn iconBtn" type="button" data-edit aria-expanded="false" title="デッキ設定">⚙</button>` : ``}
        </div>
      </div>
      <div class="meta">
        <span class="tag ${visibilityClass(vis)}">${visibilityLabel(vis)}</span>
        <span class="tag">${count}/30</span>
        ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
      </div>
      <div class="sub">${esc(fmtTime(data.updatedAt))}</div>
      ${
        canEdit
          ? `<div class="editBox" data-edit-box hidden>
              <label>デッキ名<input class="editInput" data-title value="${esc(title)}" maxlength="32" /></label>
              <label>公開範囲
                <select class="editInput" data-vis>
                  <option value="public" ${vis === "public" ? "selected" : ""}>公開</option>
                  <option value="unlisted" ${vis === "unlisted" ? "selected" : ""}>限定公開</option>
                  <option value="private" ${vis === "private" ? "selected" : ""}>非公開</option>
                </select>
              </label>
              <label>テーマ色<input class="editColor" data-color type="color" value="${esc(themeColor)}" /></label>
              <div class="editActions">
                <button class="btn" type="button" data-save-meta>変更保存</button>
                <button class="btn danger" type="button" data-delete>削除</button>
              </div>
            </div>`
          : ``
      }
    </div>
  `;

  card.querySelector("[data-edit]")?.addEventListener("click", () => {
    const btn = card.querySelector("[data-edit]");
    const box = card.querySelector("[data-edit-box]");
    if (!box || !btn) return;
    const open = box.hidden;
    box.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  card.querySelector("[data-load]")?.addEventListener("click", async () => {
    try {
      message("ロード中...");
      const snap = await getDoc(doc(db, "decks", id));
      const fresh = snap.exists() ? snap.data() || data : data;
      const payload = {
        title: String(fresh.title || title),
        deck: { ...(fresh.deck || {}) },
        exSupport: String(fresh.exSupport || ""),
        desiredField: String(fresh.desiredField || ""),
        themeColor: cleanColor(fresh.themeColor || themeColor),
        sourceId: id,
      };
      delete payload.deck.__tcg_partial_slots__;
      setLS(LOCAL_KEY, JSON.stringify(payload.deck));
      setLS(DECK_TITLE_KEY, payload.title);
      setLS(EX_KEY, payload.exSupport);
      if (payload.desiredField) setLS(FIELD_KEY, payload.desiredField);
      setLS(LAST_ID_KEY, id);
      setLS(PENDING_CLOUD_DECK_KEY, JSON.stringify(payload));
      location.href = currentParamsUrl("./index.html?skipIntro=1");
    } catch (e) {
      console.error(e);
      message(`ロードに失敗しました: ${e?.message || e}`, false);
    }
  });

  card.querySelector("[data-save-meta]")?.addEventListener("click", async () => {
    const nextTitle = String(card.querySelector("[data-title]")?.value || "").trim().slice(0, 32);
    const nextVis = normalizeVisibility(card.querySelector("[data-vis]")?.value || "public");
    const nextColor = cleanColor(card.querySelector("[data-color]")?.value || themeColor);
    if (!nextTitle) {
      message("デッキ名を入力してください。", false);
      return;
    }
    try {
      await setDoc(
        doc(db, "decks", id),
        {
          title: nextTitle,
          visibility: nextVis,
          themeColor: nextColor,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      message(`変更しました：${nextTitle}`);
      await loadDecks();
    } catch (e) {
      console.error(e);
      message(`変更保存に失敗しました: ${e?.message || e}`, false);
    }
  });

  card.querySelector("[data-delete]")?.addEventListener("click", async () => {
    if (!confirm(`削除しますか？\n${title}`)) return;
    try {
      await deleteDoc(doc(db, "decks", id));
      if (getLS(LAST_ID_KEY) === id) setLS(LAST_ID_KEY, "");
      message("削除しました。");
      await loadDecks();
    } catch (e) {
      console.error(e);
      message(`削除に失敗しました: ${e?.message || e}`, false);
    }
  });

  return card;
}

function setMode(nextMode) {
  mode = nextMode === "public" ? "public" : "my";
  $("searchInput").value = "";
  message("");
  loadDecks().catch((e) => {
    console.error(e);
    message(`デッキ一覧の読み込みに失敗しました: ${e?.message || e}`, false);
  });
}

$("btnHome")?.addEventListener("click", () => {
  location.href = currentParamsUrl("./index.html");
});
$("btnBuilder")?.addEventListener("click", () => {
  location.href = currentParamsUrl("./index.html?skipIntro=1");
});
$("tabMy")?.addEventListener("click", () => setMode("my"));
$("tabPublic")?.addEventListener("click", () => setMode("public"));
$("searchInput")?.addEventListener("input", render);

loadDecks().catch((e) => {
  console.error(e);
  message(`デッキ一覧の読み込みに失敗しました: ${e?.message || e}`, false);
});
