(() => {
  "use strict";

  // Compatibility loader. global_ui_20260821.js still requests this stable path;
  // the real runtime protection lives in v3 so we can replace it independently
  // without touching the large legacy deck script.
  const VERSION = "20261003_guard3_loader";
  const SRC = "./deck_runtime_guard_v3_20261003.js?v=20261003_guard3";

  function load() {
    if (!document.body) {
      requestAnimationFrame(load);
      return;
    }
    if (document.querySelector('script[data-deck-runtime-guard-v3="1"]')) return;
    const script = document.createElement("script");
    script.src = SRC;
    script.async = false;
    script.dataset.deckRuntimeGuardV3 = "1";
    script.addEventListener("error", () => {
      console.error("[deck_runtime_guard] v3 failed to load");
    }, { once:true });
    document.body.appendChild(script);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load, { once:true });
  else load();

  console.log("[deck_runtime_guard] compatibility loader", VERSION);
})();
