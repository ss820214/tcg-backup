(() => {
  "use strict";

  const VERSION = "20261005_ui_entry1";
  const fileName = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isRootDeck = fileName === "" || fileName === "index.html";

  const styleSources = [
    ["visual-upgrade", "./visual_upgrade_20260805.css?v=20260808_deck_flow2"],
    ["global-ui", "./global_ui_20260821.css?v=20261005_ui_entry1"],
    ["ui-stability", "./ui_stability_20260825.css?v=20260830_statusguide1"],
  ];
  if (isRootDeck) {
    styleSources.push([
      "mobile-deck-block-final",
      "./mobile_deck_block_final_20260927.css?v=20261005_ui_entry1",
    ]);
  }

  const scriptSources = [
    ["ui-polish", "./ui_polish.js?v=20260801_screen_nav_mobile1"],
    ["visual-upgrade", "./visual_upgrade_20260805.js?v=20260808_deck_flow2"],
    ["deck-layout-guard", "./deck_layout_guard.js?v=20260821_readable_ui1"],
    ["dopagaki", "./dopagaki_mode.js?v=20260912_dopa_tools_fix1"],
    ["mobile-deck-ui", "./mobile_deck_ui.js?v=20260906_curse_nav1"],
    ["ui-stability", "./ui_stability_20260825.js?v=20260826_deckspace1"],
    ["mobile-home-deck", "./mobile_home_deck_ui_20260926.js?v=20261005_ui_entry1"],
  ];
  if (isRootDeck) {
    scriptSources.push([
      "mobile-deck-block-final",
      "./mobile_deck_block_final_20260927.js?v=20261005_ui_entry1",
    ]);
  }
  // The current global UI loader must always run last. It installs the modern
  // refine -> density -> guard -> compact -> visual -> kana/gear chain and the
  // shared cleanup/mojibake/spark layers.
  scriptSources.push([
    "global-ui",
    "./global_ui_20260821.js?v=20261005_ui_entry1",
  ]);

  function filenameFromUrl(src) {
    try {
      return new URL(src, location.href).pathname.split("/").pop() || "";
    } catch {
      return String(src || "").split("?")[0].split("/").pop() || "";
    }
  }

  function hasStylesheet(src) {
    const target = filenameFromUrl(src);
    return [...document.querySelectorAll('link[rel="stylesheet"][href]')].some(
      (link) => filenameFromUrl(link.getAttribute("href")) === target,
    );
  }

  function ensureStyles() {
    for (const [key, src] of styleSources) {
      if (hasStylesheet(src)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = src;
      link.dataset.deckUiStyle = key;
      document.head.appendChild(link);
    }
  }

  function existingScript(src) {
    const target = filenameFromUrl(src);
    return [...document.querySelectorAll("script[src]")].find(
      (script) => filenameFromUrl(script.getAttribute("src")) === target,
    );
  }

  function loadScript(key, src) {
    return new Promise((resolve) => {
      const existing = existingScript(src);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.dataset.deckUiRuntime = key;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        () => {
          console.error(`[deck_ui_entry] failed: ${key}`);
          resolve();
        },
        { once: true },
      );
      document.body.appendChild(script);
    });
  }

  async function start() {
    if (!document.body) {
      requestAnimationFrame(start);
      return;
    }
    ensureStyles();
    for (const [key, src] of scriptSources) {
      await loadScript(key, src);
    }
    document.documentElement.dataset.deckUiEntry = VERSION;
    window.dispatchEvent(
      new CustomEvent("tcg:deck-ui-ready", {
        detail: { version: VERSION, root: isRootDeck },
      }),
    );
    console.log("[deck_ui_entry] ready", VERSION, isRootDeck ? "root" : "deck");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
