// public/deck_mobile_refine_20261003.js
// Compatibility loader for Deck Builder mobile fixes.
(() => {
  "use strict";
  if (window.__deckMobileStable20261005Loading) return;
  window.__deckMobileStable20261005Loading = true;

  const append = (src, dataKey) => {
    if (document.querySelector(`script[${dataKey}="1"]`)) return null;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute(dataKey, "1");
    document.body.appendChild(script);
    return script;
  };

  const stable = append(
    "./deck_mobile_refine_20261005.js?v=20261005_hotfix2",
    "data-deck-mobile-stable",
  );

  if (stable) {
    stable.addEventListener("load", () => {
      append(
        "./deck_mobile_refine_20261005_patch1.js?v=20261005_patch2",
        "data-deck-mobile-stable-patch",
      );
    });
    stable.addEventListener("error", () => {
      console.error("[deck_mobile_refine] failed to load stable mobile layer");
    });
  }

  // Independent final hotfix. It intentionally does not wait for the stable
  // layer so the tabs / +/- / cloud save layout still applies if an older
  // cached stable file fails to load.
  append(
    "./deck_mobile_hotfix_20261005_tabs2.js?v=20261005_tabs2_2053",
    "data-deck-mobile-tabs2",
  );
})();
