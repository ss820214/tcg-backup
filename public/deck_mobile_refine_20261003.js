// public/deck_mobile_refine_20261003.js
// Compatibility loader for Deck Builder mobile fixes.
(() => {
  "use strict";
  if (window.__deckMobileStable20261005Loading) return;
  window.__deckMobileStable20261005Loading = true;

  const append = (src, dataKey) => new Promise((resolve) => {
    if (document.querySelector(`script[${dataKey}="1"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute(dataKey, "1");
    script.addEventListener("load", () => resolve(), { once:true });
    script.addEventListener("error", () => resolve(), { once:true });
    document.body.appendChild(script);
  });

  const run = async () => {
    // 旧レイアウトを先に完了させ、その後に最終カード表示を必ず当てる。
    await append("./deck_mobile_refine_20261005.js?v=20261005_hotfix3", "data-deck-mobile-stable");
    await append("./deck_mobile_refine_20261005_patch1.js?v=20261005_patch3", "data-deck-mobile-stable-patch");
    await append("./deck_mobile_hotfix_20261005_tabs2.js?v=20261005_tabs2_2119", "data-deck-mobile-tabs2");
    await append("./deck_mobile_hotfix_20261006_cardlayout5.js?v=20261006_icons9_2220", "data-deck-mobile-cardlayout5");
    await append("./deck_mobile_hotfix_20261006_skills6.js?v=20261007_statusplus11", "data-deck-mobile-skills6");
  };

  run().catch((err) => console.error("[deck_mobile_refine] loader failed", err));
})();
