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
    "./deck_mobile_refine_20261005.js?v=20261005_hotfix3",
    "data-deck-mobile-stable",
  );

  if (stable) {
    stable.addEventListener("load", () => {
      append(
        "./deck_mobile_refine_20261005_patch1.js?v=20261005_patch3",
        "data-deck-mobile-stable-patch",
      );
    });
    stable.addEventListener("error", () => {
      console.error("[deck_mobile_refine] failed to load stable mobile layer");
    });
  }

  // Independent final hotfixes. They intentionally do not wait for the stable
  // layer so index.html and deck.html stay usable even with older cached CSS.
  append(
    "./deck_mobile_hotfix_20261005_tabs2.js?v=20261005_tabs2_2119",
    "data-deck-mobile-tabs2",
  );
  append(
    "./deck_mobile_hotfix_20261005_labels3.js?v=20261005_labels3_2119",
    "data-deck-mobile-labels3",
  );
  append(
    "./deck_mobile_hotfix_20261005_stats4.js?v=20261005_stats4_2119",
    "data-deck-mobile-stats4",
  );
  append(
    "./deck_mobile_hotfix_20261006_cardlayout5.js?v=20261006_cardlayout5_0131",
    "data-deck-mobile-cardlayout5",
  );
})();
