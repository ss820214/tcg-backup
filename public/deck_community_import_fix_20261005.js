(() => {
  "use strict";

  const VERSION = "20261005_community_import_fix2";
  const COMMUNITY_IMPORT_KEY = "tcg_community_deck_import_v20261005";
  const LAST_ID_KEY = "tcg_cloud_deck_last_id_v20260204";

  let pending = null;
  let observer = null;
  let timeoutId = 0;

  function clearWatch() {
    observer?.disconnect?.();
    observer = null;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = 0;
  }

  function setOverwriteUiImported() {
    const overwrite = document.getElementById("deckLibUploadOverwrite");
    if (overwrite) {
      overwrite.disabled = true;
      overwrite.title = "みんなのデッキからのコピーは、新規デッキとして保存します";
    }
    const hint = document.getElementById("deckLibLastHint");
    if (hint) hint.textContent = "コピー中：保存すると自分の新規デッキになります";
  }

  function markCommunityImport(sourceId) {
    const id = String(sourceId || "").trim();
    if (!id) return;

    try {
      sessionStorage.setItem(
        COMMUNITY_IMPORT_KEY,
        JSON.stringify({ sourceId: id, importedAt: Date.now(), via: "embedded-library" }),
      );
    } catch {}

    // Never let a community deck inherit a stale personal-cloud overwrite target.
    try {
      localStorage.removeItem(LAST_ID_KEY);
    } catch {}

    document.documentElement.dataset.communityDeckImport = id;
    setOverwriteUiImported();
    window.dispatchEvent(
      new CustomEvent("tcg:community-deck-imported", {
        detail: { sourceId: id, version: VERSION },
      }),
    );
  }

  function clearCommunityImport() {
    try {
      sessionStorage.removeItem(COMMUNITY_IMPORT_KEY);
    } catch {}
    delete document.documentElement.dataset.communityDeckImport;
  }

  function finishPendingFromMessages() {
    if (!pending) return;
    const ok = String(document.getElementById("deckLibMsgOk")?.textContent || "").trim();
    const ng = String(document.getElementById("deckLibMsgNg")?.textContent || "").trim();

    if (ok.startsWith("ロードしました")) {
      const done = pending;
      pending = null;
      clearWatch();
      if (done.mode === "all") markCommunityImport(done.sourceId);
      else clearCommunityImport();
      return;
    }

    if (ng.startsWith("ロードに失敗") || ng.includes("見つかりません")) {
      pending = null;
      clearWatch();
    }
  }

  function watchPendingLoad() {
    clearWatch();
    const ok = document.getElementById("deckLibMsgOk");
    const ng = document.getElementById("deckLibMsgNg");
    if (!ok && !ng) return;

    observer = new MutationObserver(finishPendingFromMessages);
    if (ok) observer.observe(ok, { childList: true, subtree: true, characterData: true, attributes: true });
    if (ng) observer.observe(ng, { childList: true, subtree: true, characterData: true, attributes: true });
    timeoutId = window.setTimeout(() => {
      pending = null;
      clearWatch();
    }, 12000);
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const loadBtn = target.closest(".deckLibBox [data-load]");
      if (loadBtn) {
        const box = loadBtn.closest(".deckLibBox");
        const sourceId = String(loadBtn.getAttribute("data-load") || "").trim();
        if (!sourceId) return;
        pending = {
          sourceId,
          mode: box?.dataset?.mode === "all" ? "all" : "my",
          startedAt: Date.now(),
        };
        watchPendingLoad();
        return;
      }

      // Clear the stale cloud target before deck_library's own btnSave listener runs.
      const saveBtn = target.closest("#btnSave");
      if (saveBtn) {
        let marker = null;
        try {
          const raw = sessionStorage.getItem(COMMUNITY_IMPORT_KEY) || "";
          marker = raw ? JSON.parse(raw) : null;
        } catch {}
        if (marker?.sourceId) {
          try {
            localStorage.removeItem(LAST_ID_KEY);
          } catch {}
          setOverwriteUiImported();
        }
      }
    },
    true,
  );

  // deck_list.html already writes the import marker before navigating here.
  // Re-apply the safe "new save" state when returning to the builder.
  try {
    const raw = sessionStorage.getItem(COMMUNITY_IMPORT_KEY) || "";
    const marker = raw ? JSON.parse(raw) : null;
    if (marker?.sourceId) {
      try {
        localStorage.removeItem(LAST_ID_KEY);
      } catch {}
      document.documentElement.dataset.communityDeckImport = String(marker.sourceId);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setOverwriteUiImported, { once: true });
      } else {
        setOverwriteUiImported();
      }
    }
  } catch {}

  console.log("[deck_community_import_fix] ready", VERSION);
})();
