// public/deck_library.js
// v20261006_partial_save2
// Compatibility layer over the 20260822 deck library.

import { initDeckLibrary as initDeckLibraryCore } from "./deck_library_core_20261005.js?v=20260822_deck_meta1";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const LS_LAST_ID = "tcg_cloud_deck_last_id_v20260204";
const LS_LAST_VIS = "tcg_cloud_deck_last_vis_v20260204";
const LS_LAST_THEME = "tcg_cloud_deck_theme_v20260822";
const LS_DEVICEKEY = "tcg_cloud_device_key_v20260204";
const LS_COPY_SOURCE_ID = "tcg_cloud_deck_copy_source_id_v20261005";
const PARTIAL_SLOT_KEY = "__tcg_partial_slots__";
const FIX_STATE_KEY = "__tcgDeckCopySaveFix20261005";

function getLS(key) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }
function setLS(key, value) { try { localStorage.setItem(key, String(value ?? "")); } catch {} }
function removeLS(key) { try { localStorage.removeItem(key); } catch {} }
function sumDeck(deck) { return Object.entries(deck || {}).reduce((n, [k, v]) => k === PARTIAL_SLOT_KEY ? n : n + (Number(v) || 0), 0); }
function safeClone(v) { try { return JSON.parse(JSON.stringify(v ?? {})); } catch { return {}; } }
function cloudDeckForSave(deck, size) {
  const out = safeClone(deck);
  delete out[PARTIAL_SLOT_KEY];
  if (size > 0 && size < 30) out[PARTIAL_SLOT_KEY] = 30 - size;
  return out;
}

function deviceKey() {
  let key = getLS(LS_DEVICEKEY);
  if (key) return key;
  try { key = crypto.randomUUID?.() || `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  catch { key = `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  setLS(LS_DEVICEKEY, key);
  return key;
}

function sharedState() {
  if (!window[FIX_STATE_KEY]) {
    window[FIX_STATE_KEY] = {
      pendingLoad: null,
      captureInstalled: false,
      saveBridgeInstalled: false,
      partialSaveInstalled: false,
      observer: null,
      copyUploadQueued: false,
    };
  }
  return window[FIX_STATE_KEY];
}

function currentLibraryMode() {
  return document.getElementById("deckLibBox")?.dataset?.mode === "all" ? "all" : "my";
}

function syncOverwriteUi() {
  const lastId = getLS(LS_LAST_ID);
  const btn = document.getElementById("deckLibUploadOverwrite");
  const hint = document.getElementById("deckLibLastHint");
  if (btn) {
    btn.disabled = !lastId;
    btn.title = lastId ? `最後に保存したクラウドデッキを更新（ID:${lastId}）` : "上書き先がありません（先に新規保存してください）";
  }
  if (hint) hint.textContent = lastId ? `更新先ID: ${lastId}` : "未保存";
}

function commitLoadedSource({ id, mode }) {
  const sourceId = String(id || "").trim();
  if (!sourceId) return;
  if (mode === "all") {
    setLS(LS_COPY_SOURCE_ID, sourceId);
    removeLS(LS_LAST_ID);
  } else {
    removeLS(LS_COPY_SOURCE_ID);
    setLS(LS_LAST_ID, sourceId);
  }
  syncOverwriteUi();
}

function installLoadCapture() {
  const state = sharedState();
  if (state.captureInstalled) return;
  state.captureInstalled = true;
  document.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("#deckLibList [data-load]");
    if (!btn) return;
    state.pendingLoad = {
      id: String(btn.getAttribute("data-load") || ""),
      mode: currentLibraryMode(),
      startedAt: Date.now(),
    };
    window.setTimeout(() => {
      if (state.pendingLoad && Date.now() - Number(state.pendingLoad.startedAt || 0) >= 15000) state.pendingLoad = null;
    }, 15050);
  }, true);
}

function setOk(text) {
  const ok = document.getElementById("deckLibMsgOk");
  const ng = document.getElementById("deckLibMsgNg");
  if (ok) ok.textContent = text || "";
  if (ng) ng.textContent = "";
}
function setNg(text) {
  const ok = document.getElementById("deckLibMsgOk");
  const ng = document.getElementById("deckLibMsgNg");
  if (ok) ok.textContent = "";
  if (ng) ng.textContent = text || "";
}

async function ownDeckCount(db) {
  const ids = new Set();
  const uid = getLS("uid");
  const key = deviceKey();
  try {
    if (uid) {
      const s = await getDocs(query(collection(db, "decks"), where("ownerUid", "==", uid), limit(20)));
      s.forEach((d) => ids.add(d.id));
    }
  } catch {}
  try {
    const s = await getDocs(query(collection(db, "decks"), where("ownerKey", "==", key), limit(20)));
    s.forEach((d) => ids.add(d.id));
  } catch {}
  return ids.size;
}

function updatePartialHint() {
  document.querySelectorAll("#deckLibBox .deckLibSub").forEach((el) => {
    if (el.textContent.includes("30枚ちょうど")) {
      el.textContent = el.textContent.replace("「30枚ちょうど」のデッキのみ対応", "1〜30枚のデッキを保存可能");
    }
  });
}

function installPartialSaveBridge(opts = {}) {
  const state = sharedState();
  if (state.partialSaveInstalled) return;
  state.partialSaveInstalled = true;

  document.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("#deckLibUploadNew,#deckLibUploadOverwrite");
    if (!btn) return;
    const snap = opts.getSnapshot?.() || {};
    const deck = snap.deck || {};
    const size = sumDeck(deck);
    if (size >= 30) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const overwrite = btn.id === "deckLibUploadOverwrite";
    void (async () => {
      const db = opts.db;
      if (!db) return setNg("保存先の初期化に失敗しました");
      if (size <= 0) return setNg("1枚以上カードを入れてから保存してください");

      const input = document.getElementById(opts.deckTitleInputId || "deckTitle");
      const title = String(input?.value || snap.title || "無題デッキ").trim().slice(0, 32) || "無題デッキ";
      const visibility = String(document.getElementById("deckLibVis")?.value || getLS(LS_LAST_VIS) || "public");
      const themeColor = String(document.getElementById("deckLibThemeColor")?.value || getLS(LS_LAST_THEME) || "#70c7ff");
      const ownerName = String(opts.getPlayerName?.() || "player").trim() || "player";
      const ownerUid = getLS("uid");
      const ownerKey = deviceKey();
      const payload = {
        docType: "deck",
        title,
        deck: cloudDeckForSave(deck, size),
        exSupport: String(snap.exSupport || ""),
        desiredField: String(snap.desiredField || ""),
        deckSize: size,
        tags: [],
        visibility,
        themeColor,
        ownerUid,
        ownerName,
        isAdminOwner: getLS("isAdmin") === "1",
        ownerKey,
        partialDeck: true,
        updatedAt: serverTimestamp(),
      };

      try {
        if (overwrite) {
          const id = getLS(LS_LAST_ID);
          if (!id) return setNg("更新先がありません。先に新規として保存してください");
          await setDoc(doc(db, "decks", id), payload, { merge: true });
          setOk(`更新しました：${title}（${size}/30枚）`);
        } else {
          if (await ownDeckCount(db) >= 10) return setNg("クラウド保存は最大10件です");
          payload.createdAt = serverTimestamp();
          const ref = await addDoc(collection(db, "decks"), payload);
          setLS(LS_LAST_ID, ref.id);
          setOk(`新規保存しました：${title}（${size}/30枚）`);
        }
        setLS(LS_LAST_VIS, visibility);
        setLS(LS_LAST_THEME, themeColor);
        syncOverwriteUi();
      } catch (e) {
        console.error(e);
        setNg(`保存に失敗しました: ${e?.message || e}`);
      }
    })();
  }, true);
}

function installSaveBridge() {
  const state = sharedState();
  if (state.saveBridgeInstalled) return;
  state.saveBridgeInstalled = true;
  const normalSaveBtn = document.getElementById("btnSave");
  if (normalSaveBtn) {
    normalSaveBtn.addEventListener("click", () => {
      const copySourceId = getLS(LS_COPY_SOURCE_ID);
      if (!copySourceId || state.copyUploadQueued) return;
      state.copyUploadQueued = true;
      window.setTimeout(() => {
        const sourceStillPending = getLS(LS_COPY_SOURCE_ID);
        const newSaveBtn = document.getElementById("deckLibUploadNew");
        if (!sourceStillPending || !newSaveBtn || newSaveBtn.disabled) {
          state.copyUploadQueued = false;
          return;
        }
        newSaveBtn.click();
      }, 0);
    });
  }

  const ok = document.getElementById("deckLibMsgOk");
  const ng = document.getElementById("deckLibMsgNg");
  if (!ok && !ng) return;
  const inspectResult = () => {
    const okText = String(ok?.textContent || "").trim();
    const ngText = String(ng?.textContent || "").trim();
    if (getLS(LS_COPY_SOURCE_ID) && okText.startsWith("新規保存しました")) {
      removeLS(LS_COPY_SOURCE_ID);
      state.copyUploadQueued = false;
      syncOverwriteUi();
      return;
    }
    if (state.copyUploadQueued && ngText) state.copyUploadQueued = false;
  };
  state.observer = new MutationObserver(inspectResult);
  if (ok) state.observer.observe(ok, { childList:true, characterData:true, subtree:true });
  if (ng) state.observer.observe(ng, { childList:true, characterData:true, subtree:true });
}

export function initDeckLibrary(opts = {}) {
  const originalApplySnapshot = opts.applySnapshot;
  installLoadCapture();
  const wrappedApplySnapshot = typeof originalApplySnapshot === "function"
    ? (snap) => {
        if (snap?.deck && PARTIAL_SLOT_KEY in snap.deck) {
          snap = { ...snap, deck: { ...snap.deck } };
          delete snap.deck[PARTIAL_SLOT_KEY];
        }
        const state = sharedState();
        const pending = state.pendingLoad;
        const result = originalApplySnapshot(snap);
        if (pending?.id) commitLoadedSource(pending);
        state.pendingLoad = null;
        return result;
      }
    : originalApplySnapshot;

  const result = initDeckLibraryCore({ ...opts, applySnapshot: wrappedApplySnapshot });
  installPartialSaveBridge(opts);
  installSaveBridge();
  syncOverwriteUi();
  updatePartialHint();
  return result;
}
