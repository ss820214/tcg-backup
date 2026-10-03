(() => {
  "use strict";

  const VERSION = "20261004_compact1";
  const STYLE_ID = "deckMobileCompactV320261004";

  function isMobileLike() {
    try {
      if (window.TCG_DEVICE_MODE?.isMobile) return !!window.TCG_DEVICE_MODE.isMobile();
    } catch {}
    const w = window.innerWidth || document.documentElement?.clientWidth || 9999;
    const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
    return w <= 900 || ((ua || coarse) && w <= 1180);
  }

  function isDeckBuilder() {
    return !!(document.getElementById("cardList") && document.getElementById("deckPanel"));
  }

  function installStyle() {
    if (!document.head || !isMobileLike() || !isDeckBuilder()) return;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  /* Card library: never let the attribute hint consume the remaining panel height. */
  html body.deckMobileDensity .libraryPanel > .bd,
  html body.mobileFitUi .libraryPanel > .bd,
  html body .libraryPanel > .bd {
    display:flex!important;
    flex-direction:column!important;
    justify-content:flex-start!important;
    align-items:stretch!important;
    gap:3px!important;
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    padding:4px!important;
    overflow:visible!important;
  }

  html body.deckMobileDensity .libraryPanel > .bd > .listHead,
  html body.mobileFitUi .libraryPanel > .bd > .listHead,
  html body .libraryPanel > .bd > .listHead {
    position:relative!important;
    inset:auto!important;
    flex:0 0 auto!important;
    display:block!important;
    width:100%!important;
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    margin:0!important;
    padding:0!important;
    gap:0!important;
  }

  html body .libraryPanel > .bd > .listHead > b {
    display:none!important;
  }

  html body .libraryPanel .attrHintBox {
    min-height:0!important;
    height:auto!important;
    margin:0!important;
    padding:5px 8px!important;
    border-radius:8px!important;
  }
  html body .libraryPanel .attrHintTitle {
    margin:0!important;
    font-size:10.5px!important;
    line-height:1.2!important;
  }
  html body .libraryPanel .attrHintText {
    margin:1px 0 0!important;
    font-size:9.5px!important;
    line-height:1.25!important;
  }

  html body .libraryPanel #cardFilters.filterBar,
  html body .libraryPanel .filterBar {
    position:relative!important;
    inset:auto!important;
    flex:0 0 auto!important;
    width:100%!important;
    min-height:0!important;
    height:auto!important;
    margin:0!important;
    padding:4px!important;
    gap:3px!important;
    border-radius:8px!important;
  }

  /* Deck header: two compact action buttons, never horizontal scrolling. */
  html body.deckMobileDensity.deckMobileStackActive #deckPanel > .hd,
  html body.deckMobileDensity #deckPanel > .hd,
  html body.mobileFitUi #deckPanel > .hd,
  html body #deckPanel > .hd {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto auto!important;
    grid-template-areas:
      "title clear min"
      "actions actions actions"!important;
    align-items:center!important;
    gap:3px!important;
    min-height:0!important;
    height:auto!important;
    padding:4px 6px!important;
    overflow:hidden!important;
  }
  html body #deckPanel > .hd .panelHdText {
    grid-area:title!important;
    min-width:0!important;
  }
  html body #deckPanel > .hd .panelHdText > .small {
    display:none!important;
  }
  html body #deckPanel > .hd #btnClearDeck {
    grid-area:clear!important;
    min-width:0!important;
    min-height:28px!important;
    height:28px!important;
    padding:0 8px!important;
    font-size:10.5px!important;
  }
  html body #deckPanel > .hd #deckPanelMinBtn {
    grid-area:min!important;
    width:28px!important;
    min-width:28px!important;
    height:28px!important;
    min-height:28px!important;
    padding:0!important;
  }

  html body.deckMobileDensity.deckMobileStackActive #deckPanel .deckPanelActions,
  html body.deckMobileStackActive #deckPanel .deckPanelActions,
  html body.deckMobileDensity #deckPanel .deckPanelActions,
  html body #deckPanel .deckPanelActions {
    grid-area:actions!important;
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-flow:row!important;
    align-items:stretch!important;
    justify-content:stretch!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:auto!important;
    margin:0!important;
    padding:0!important;
    gap:3px!important;
    overflow:hidden!important;
    overflow-x:hidden!important;
    white-space:normal!important;
  }
  html body.deckMobileDensity.deckMobileStackActive #deckPanel .deckPanelActions button,
  html body.deckMobileStackActive #deckPanel .deckPanelActions button,
  html body.deckMobileDensity #deckPanel .deckPanelActions button,
  html body #deckPanel .deckPanelActions button {
    display:inline-flex!important;
    flex:0 1 auto!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:27px!important;
    height:27px!important;
    margin:0!important;
    padding:0 5px!important;
    gap:3px!important;
    border-radius:8px!important;
    font-size:10px!important;
    line-height:1!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
  }
  html body #deckPanel .deckPanelActions button::before {
    flex:0 0 auto!important;
    width:14px!important;
    height:14px!important;
    min-width:14px!important;
    font-size:8px!important;
  }

  /* Remove redundant labels and the empty space they leave behind. */
  html body #deckInfoDock > .deckInfoDockHead {
    display:none!important;
    height:0!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    overflow:hidden!important;
  }
  html body #deckInfoDock > .deckInfoBody > .listHead {
    display:none!important;
    height:0!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    overflow:hidden!important;
  }
  html body #deckInfoDock {
    min-height:0!important;
    height:auto!important;
    margin:0!important;
    padding:0!important;
    border-radius:8px!important;
  }
  html body #deckInfoDock > .deckInfoBody {
    min-height:0!important;
    height:auto!important;
    gap:3px!important;
    margin:0!important;
    padding:3px!important;
  }

  /* Keep only a tiny progress bar; the 'カード選択' heading is redundant. */
  html body #deckProgressMini {
    min-height:0!important;
    height:auto!important;
    margin:1px 2px 3px!important;
    padding:2px!important;
    border-radius:999px!important;
  }
  html body #deckProgressMini .deckProgressMiniHead {
    display:none!important;
    height:0!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
  }
  html body #deckProgressMini .deckProgressBar {
    height:4px!important;
    min-height:4px!important;
    margin:0!important;
    border-radius:999px!important;
  }

  html body #deckPanel > .bd {
    gap:3px!important;
    padding:4px!important;
  }
  html body #deckPanel .deckSaveDock {
    margin:0!important;
  }
  html body #deckList {
    margin:0!important;
  }
}
`;

    // Keep this style last in the cascade. Some legacy deck code appends styles late.
    if (style !== document.head.lastElementChild) document.head.appendChild(style);
  }

  function install() {
    if (!document.body || !isDeckBuilder()) return;
    installStyle();
    [0, 80, 240, 700, 1400].forEach((ms) => setTimeout(installStyle, ms));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once:true });
  } else {
    install();
  }
  window.addEventListener("load", install, { once:true });
  window.addEventListener("pageshow", install);
  window.addEventListener("resize", () => setTimeout(installStyle, 80), { passive:true });
  window.addEventListener("orientationchange", () => setTimeout(installStyle, 120), { passive:true });

  console.log("[deck_mobile_compact_v3] ready", VERSION);
})();
