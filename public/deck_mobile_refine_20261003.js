// public/deck_mobile_refine_20261003.js
// Compatibility loader: the old mobile refinement re-parented card rows and
// caused scroll jumps, broken attribute selection, and collapsed save UI.
// Keep this filename for existing cache references, but hand off to the stable
// 2026-10-05 layer without touching the deck DOM.
(() => {
  "use strict";
  if (window.__deckMobileStable20261005Loading) return;
  window.__deckMobileStable20261005Loading = true;

  const stable = document.createElement("script");
  stable.src = "./deck_mobile_refine_20261005.js?v=20261005_hotfix1";
  stable.defer = true;
  stable.dataset.deckMobileStable = "1";
  stable.addEventListener("load", () => {
    const patch = document.createElement("script");
    patch.src = "./deck_mobile_refine_20261005_patch1.js?v=20261005_patch1";
    patch.defer = true;
    patch.dataset.deckMobileStablePatch = "1";
    document.body.appendChild(patch);
  });
  stable.addEventListener("error", () => {
    window.__deckMobileStable20261005Loading = false;
    console.error("[deck_mobile_refine] failed to load stable mobile layer");
  });
  document.body.appendChild(stable);
})();
