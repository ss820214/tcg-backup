// public/deck_library.js
// v20261005_copy_save_fix1
// Thin compatibility layer over the 20260822 deck library.
// - A public/community load is treated as a copy source, never as an overwrite target.
// - The ordinary deck "保存" button auto-creates a new cloud deck while copy mode is active.
// - Copy state is only committed after applySnapshot succeeds.

import { initDeckLibrary as initDeckLibraryCore } from "./deck_library_core_20261005.js?v=20260822_deck_meta1";

const LS_LAST_ID = "tcg_cloud_deck_last_id_v20260204";
const LS_COPY_SOURCE_ID = "tcg_cloud_deck_copy_source_id_v20261005";

const FIX_STATE_KEY = "__tcgDeckCopySaveFix20261005";

function getLS(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function setLS(key, value) {
  try {
    localStorage.setItem(key, String(value || ""));
  } catch {}
}

function removeLS(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function sharedState() {
  if (!window[FIX_STATE_KEY]) {
    window[FIX_STATE_KEY] = {
      pendingLoad: null,
      captureInstalled: false,
      saveBridgeInstalled: false,
      observer: null,
      copyUploadQueued: false,
    };
  }
  return window[FIX_STATE_KEY];
}

function currentLibraryMode() {
  const box = document.getElementById("deckLibBox");
  return box?.dataset?.mode === "all" ? "all" : "my";
}

function syncOverwriteUi() {
  const lastId = getLS(LS_LAST_ID);
  const btn = document.getElementById("deckLibUploadOverwrite");
  const hint = document.getElementById("deckLibLastHint");

  if (btn) {
    btn.disabled = !lastId;
    btn.title = lastId
      ? `最後に保存したクラウドデッキを更新（ID:${lastId}）`
      : "上書き先がありません（先に「新規として保存」をしてください）";
  }
  if (hint) {
    hint.textContent = lastId ? `更新先ID: ${lastId}` : "未保存";
  }
}

function commitLoadedSource({ id, mode }) {
  const sourceId = String(id || "").trim();
  if (!sourceId) return;

  if (mode === "all") {
    // Community/public decks are copy sources. Never point overwrite at them.
    setLS(LS_COPY_SOURCE_ID, sourceId);
    removeLS(LS_LAST_ID);
  } else {
    // Loading from "自分のデッキ" keeps normal overwrite semantics.
    removeLS(LS_COPY_SOURCE_ID);
    setLS(LS_LAST_ID, sourceId);
  }

  syncOverwriteUi();
}

function installLoadCapture() {
  const state = sharedState();
  if (state.captureInstalled) return;
  state.captureInstalled = true;

  document.addEventListener(
    "click",
    (event) => {
      const btn = event.target?.closest?.("#deckLibList [data-load]");
      if (!btn) return;

      state.pendingLoad = {
        id: String(btn.getAttribute("data-load") || ""),
        mode: currentLibraryMode(),
        startedAt: Date.now(),
      };

      // Do not persist copy state here. The Firestore load can still fail.
      window.setTimeout(() => {
        if (
          state.pendingLoad &&
          Date.now() - Number(state.pendingLoad.startedAt || 0) >= 15000
        ) {
          state.pendingLoad = null;
        }
      }, 15050);
    },
    true,
  );
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

      // Let the normal local/user save handler run too, then reuse the
      // library's existing "新規として保存" path for the cloud copy.
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

    if (state.copyUploadQueued && ngText) {
      // Keep the copy marker so the user can retry the ordinary Save button.
      state.copyUploadQueued = false;
    }
  };

  state.observer = new MutationObserver(inspectResult);
  if (ok) state.observer.observe(ok, { childList: true, characterData: true, subtree: true });
  if (ng) state.observer.observe(ng, { childList: true, characterData: true, subtree: true });
}

export function initDeckLibrary(opts = {}) {
  const originalApplySnapshot = opts.applySnapshot;
  installLoadCapture();

  const wrappedApplySnapshot =
    typeof originalApplySnapshot === "function"
      ? (snap) => {
          const state = sharedState();
          const pending = state.pendingLoad;
          const result = originalApplySnapshot(snap);

          // Reaching this point means the core loader fetched/validated the deck
          // and applySnapshot completed without throwing.
          if (pending?.id) {
            commitLoadedSource(pending);
          }
          state.pendingLoad = null;
          return result;
        }
      : originalApplySnapshot;

  const result = initDeckLibraryCore({
    ...opts,
    applySnapshot: wrappedApplySnapshot,
  });

  installSaveBridge();
  syncOverwriteUi();
  return result;
}
