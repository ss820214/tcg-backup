// public/deck_list.js
// v20261005_copy_save_fix1
// Compatibility layer over the 20260822 deck list.
// Public loads become copy sources; own-deck loads keep overwrite behavior.

const LS_LAST_ID = "tcg_cloud_deck_last_id_v20260204";
const LS_COPY_SOURCE_ID = "tcg_cloud_deck_copy_source_id_v20261005";
const PENDING_CLOUD_DECK_KEY = "tcg_pending_cloud_deck_v20260822";

const storageProto = Storage.prototype;
const originalSetItem = storageProto.setItem;
const originalRemoveItem = storageProto.removeItem;

function currentMode() {
  try {
    return new URLSearchParams(location.search).get("mode") === "public"
      ? "public"
      : "my";
  } catch {
    return "my";
  }
}

function originalGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function originalSet(key, value) {
  try {
    originalSetItem.call(localStorage, key, String(value || ""));
  } catch {}
}

function originalRemove(key) {
  try {
    originalRemoveItem.call(localStorage, key);
  } catch {}
}

// Clear stale copy state when a fresh load attempt starts. A successful public
// load will set it again below; a failed load therefore leaves no copy marker.
document.addEventListener(
  "click",
  (event) => {
    const btn = event.target?.closest?.("[data-load]");
    if (!btn) return;

    originalRemove(LS_COPY_SOURCE_ID);
    if (currentMode() === "public") {
      originalRemove(LS_LAST_ID);
    }
  },
  true,
);

storageProto.setItem = function patchedDeckListSetItem(key, value) {
  if (this !== localStorage) {
    return originalSetItem.call(this, key, value);
  }

  const k = String(key || "");
  const mode = currentMode();

  if (k === LS_LAST_ID) {
    const id = String(value || "").trim();

    if (mode === "public") {
      // Core deck_list would make the loaded public deck the overwrite target.
      // Convert that write into a copy-source marker instead.
      originalRemove(LS_LAST_ID);
      if (id) originalSet(LS_COPY_SOURCE_ID, id);
      return;
    }

    // Own deck: normal overwrite behavior, and copy mode ends.
    originalRemove(LS_COPY_SOURCE_ID);
    return originalSetItem.call(this, key, value);
  }

  if (k === PENDING_CLOUD_DECK_KEY && mode === "public") {
    try {
      const payload = JSON.parse(String(value || "{}")) || {};
      const sourceId = String(
        payload.sourceId || originalGet(LS_COPY_SOURCE_ID) || "",
      ).trim();

      if (sourceId) {
        payload.copySourceId = sourceId;
        originalSet(LS_COPY_SOURCE_ID, sourceId);
      }

      // deck.js currently interprets sourceId as an overwrite target.
      // Removing it preserves copy semantics after navigation.
      delete payload.sourceId;
      return originalSetItem.call(this, key, JSON.stringify(payload));
    } catch {
      // If the payload is malformed, preserve core behavior rather than
      // breaking navigation.
      return originalSetItem.call(this, key, value);
    }
  }

  return originalSetItem.call(this, key, value);
};

await import("./deck_list_core_20261005.js?v=20261006_clean1");
