(() => {
  "use strict";

  // Compatibility loader. global_ui_20260821.js requests this stable path.
  // Runtime guard -> compact mobile layout -> final visual polish.
  const VERSION = "20261004_guard3_compact1_visual4_loader";
  const GUARD_SRC = "./deck_runtime_guard_v3_20261003.js?v=20261003_guard3";
  const COMPACT_SRC = "./deck_mobile_compact_v3_20261004.js?v=20261004_compact1";
  const VISUAL_SRC = "./deck_visual_polish_v4_20261004.js?v=20261004_visual4";

  function loadVisual() {
    if (!document.body) {
      requestAnimationFrame(loadVisual);
      return;
    }
    if (document.querySelector('script[data-deck-visual-polish-v4="1"]')) return;
    const visual = document.createElement("script");
    visual.src = VISUAL_SRC;
    visual.async = false;
    visual.dataset.deckVisualPolishV4 = "1";
    visual.addEventListener("error", () => {
      console.error("[deck_runtime_guard] visual polish v4 failed to load");
    }, { once:true });
    document.body.appendChild(visual);
  }

  function loadCompact() {
    if (!document.body) {
      requestAnimationFrame(loadCompact);
      return;
    }
    const existing = document.querySelector('script[data-deck-mobile-compact-v3="1"]');
    if (existing) {
      loadVisual();
      return;
    }
    const compact = document.createElement("script");
    compact.src = COMPACT_SRC;
    compact.async = false;
    compact.dataset.deckMobileCompactV3 = "1";
    compact.addEventListener("load", loadVisual, { once:true });
    compact.addEventListener("error", () => {
      console.error("[deck_runtime_guard] compact v3 failed to load");
      loadVisual();
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
