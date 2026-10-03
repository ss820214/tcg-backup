(() => {
  "use strict";

  // Compatibility loader. global_ui_20260821.js requests this stable path.
  // Load runtime protection first, then the final compact mobile deck layer.
  const VERSION = "20261004_guard3_compact1_loader";
  const GUARD_SRC = "./deck_runtime_guard_v3_20261003.js?v=20261003_guard3";
  const COMPACT_SRC = "./deck_mobile_compact_v3_20261004.js?v=20261004_compact1";

  function loadCompact() {
    if (!document.body) {
      requestAnimationFrame(loadCompact);
      return;
    }
    if (document.querySelector('script[data-deck-mobile-compact-v3="1"]')) return;
    const compact = document.createElement("script");
    compact.src = COMPACT_SRC;
    compact.async = false;
    compact.dataset.deckMobileCompactV3 = "1";
    compact.addEventListener("error", () => {
      console.error("[deck_runtime_guard] compact v3 failed to load");
    }, { once:true });
    document.body.appendChild(compact);
  }

  function load() {
    if (!document.body) {
      requestAnimationFrame(load);
      return;
    }

    const existing = document.querySelector('script[data-deck-runtime-guard-v3="1"]');
    if (existing) {
      loadCompact();
      return;
    }

    const script = document.createElement("script");
    script.src = GUARD_SRC;
    script.async = false;
    script.dataset.deckRuntimeGuardV3 = "1";
    script.addEventListener("load", loadCompact, { once:true });
    script.addEventListener("error", () => {
      console.error("[deck_runtime_guard] v3 failed to load");
      loadCompact();
    }, { once:true });
    document.body.appendChild(script);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once:true });
  else load();

  console.log("[deck_runtime_guard] compatibility loader", VERSION);
})();
