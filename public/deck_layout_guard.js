// Deck builder final layout guard.
// Keeps the editing screen focused on cards + deck even when shared polish layers load later.
(() => {
  "use strict";

  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const canRunOnThisPage = path === "deck.html" || path === "index.html" || path === "";
  if (!canRunOnThisPage) return;

  const VERSION = "20260821_readable_ui1";

  function isDeckBuilderActive() {
    if (!document.getElementById("cardList") || !document.getElementById("deckPanel")) return false;
    const start = document.getElementById("deckStart");
    if (!start) return true;
    if (start.classList.contains("hide")) return true;
    if (start.getAttribute("aria-hidden") === "true") return true;
    const st = getComputedStyle(start);
    return st.display === "none" || st.visibility === "hidden" || st.pointerEvents === "none";
  }

  function injectCss() {
    if (document.getElementById("deckLayoutGuardCss")) return;
    const style = document.createElement("style");
    style.id = "deckLayoutGuardCss";
    style.textContent = `
      body.deckLayoutGuard {
        --deck-guard-left: minmax(560px, 1fr);
        --deck-guard-right: minmax(390px, 0.58fr);
      }

      body.deckLayoutGuard.has-tcg-route-strip {
        padding-top: 0 !important;
      }

      body.deckLayoutGuard .tcg-route-strip,
      body.deckLayoutGuard .journeyStrip,
      body.deckLayoutGuard #journeyFab,
      body.deckLayoutGuard #journeyPanel {
        display: none !important;
      }

      body.deckLayoutGuard header {
        min-height: 58px !important;
        padding: 8px 14px !important;
      }

      body.deckLayoutGuard .wrap {
        width: 100% !important;
        max-width: none !important;
        display: grid !important;
        grid-template-columns: var(--deck-guard-left) var(--deck-guard-right) !important;
        align-items: start !important;
        gap: 14px !important;
        padding: 14px !important;
      }

      body.deckLayoutGuard #deckMainPanel,
      body.deckLayoutGuard .libraryPanel {
        grid-column: 1 !important;
        grid-row: 1 !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: calc(100vh - 88px) !important;
      }

      body.deckLayoutGuard #deckPanel {
        grid-column: 2 !important;
        grid-row: 1 !important;
        width: 100% !important;
        min-width: 0 !important;
        position: sticky !important;
        top: 72px !important;
        min-height: calc(100vh - 88px) !important;
        max-height: calc(100vh - 88px) !important;
      }

      body.deckLayoutGuard #deckMainPanel .bd,
      body.deckLayoutGuard .libraryPanel .bd {
        min-height: 0 !important;
      }

      body.deckLayoutGuard #cardList {
        max-height: calc(100vh - 246px) !important;
        min-height: 360px !important;
        overflow: auto !important;
      }

      body.deckLayoutGuard #deckPanel > .bd {
        min-height: 0 !important;
        overflow: hidden !important;
      }

      body.deckLayoutGuard #deckList {
        min-height: 0 !important;
        max-height: none !important;
        overflow: auto !important;
      }

      body.deckLayoutGuard #deckList .cardRow[data-kind="support"] {
        --row-attr: #9ca3af !important;
      }

      body.deckLayoutGuard #cardList .cardRow,
      body.deckLayoutGuard #deckList .cardRow {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) clamp(156px, 20vw, 214px) !important;
        align-items: center !important;
        gap: 8px !important;
        overflow: hidden !important;
      }

      body.deckLayoutGuard #cardList .cardRow > div:first-child,
      body.deckLayoutGuard #deckList .cardRow > div:first-child {
        min-width: 0 !important;
      }

      body.deckLayoutGuard #cardList .cardRow .name,
      body.deckLayoutGuard #deckList .cardRow .name {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        flex-wrap: nowrap !important;
        min-width: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.deckLayoutGuard #cardList .cardRow .sub,
      body.deckLayoutGuard #deckList .cardRow .sub {
        display: -webkit-box !important;
        -webkit-line-clamp: 2 !important;
        -webkit-box-orient: vertical !important;
        overflow: hidden !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns,
      body.deckLayoutGuard #deckList .cardRow .btns {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        display: grid !important;
        grid-template-columns: 38px minmax(54px, 1fr) 38px !important;
        grid-template-areas:
          "minus count plus"
          "detail detail detail" !important;
        gap: 5px !important;
        align-self: center !important;
      }

      body.deckLayoutGuard #deckList .cardRow .btns {
        grid-template-columns: 76px 44px minmax(58px, 1fr) 44px !important;
        grid-template-areas:
          "detail plus count minus"
          "ex ex ex ex" !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns [data-minus],
      body.deckLayoutGuard #deckList .cardRow .btns [data-minus] {
        grid-area: minus !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns [data-plus],
      body.deckLayoutGuard #deckList .cardRow .btns [data-plus] {
        grid-area: plus !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns .count,
      body.deckLayoutGuard #deckList .cardRow .btns .count,
      body.deckLayoutGuard #cardList .cardRow .btns .cnt,
      body.deckLayoutGuard #deckList .cardRow .btns .cnt {
        grid-area: count !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns [data-detail],
      body.deckLayoutGuard #deckList .cardRow .btns [data-detail] {
        grid-area: detail !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns [data-ex],
      body.deckLayoutGuard #cardList .cardRow .btns [data-expick],
      body.deckLayoutGuard #deckList .cardRow .btns [data-ex],
      body.deckLayoutGuard #deckList .cardRow .btns [data-expick] {
        grid-area: ex !important;
      }

      body.deckLayoutGuard #cardList .cardRow .btns button,
      body.deckLayoutGuard #deckList .cardRow .btns button,
      body.deckLayoutGuard #cardList .cardRow .btns .count,
      body.deckLayoutGuard #deckList .cardRow .btns .count,
      body.deckLayoutGuard #cardList .cardRow .btns .cnt,
      body.deckLayoutGuard #deckList .cardRow .btns .cnt {
        min-width: 0 !important;
        min-height: 30px !important;
        height: 30px !important;
        padding: 4px 7px !important;
        border-radius: 10px !important;
        font-size: 12px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        word-break: keep-all !important;
      }

      body.deckLayoutGuard #deckPanelActions {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      body.deckLayoutGuard #deckPanelActions button {
        min-width: 0 !important;
        white-space: nowrap !important;
      }

      body.deckLayoutGuard #roomDrawerToggle {
        right: 22px !important;
        bottom: 22px !important;
      }

      @media (max-width: 1280px) {
        body.deckLayoutGuard .wrap {
          grid-template-columns: 1fr !important;
        }

        body.deckLayoutGuard #deckMainPanel,
        body.deckLayoutGuard .libraryPanel,
        body.deckLayoutGuard #deckPanel {
          grid-column: auto !important;
          grid-row: auto !important;
          position: relative !important;
          top: auto !important;
          min-height: auto !important;
          max-height: none !important;
        }

        body.deckLayoutGuard #cardList {
          max-height: 48vh !important;
          min-height: 260px !important;
        }
      }

      @media (max-width: 900px) {
        body.deckLayoutGuard header {
          gap: 8px !important;
        }

        body.deckLayoutGuard .topRight {
          display: flex !important;
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
          padding-bottom: 2px !important;
        }

        body.deckLayoutGuard .wrap {
          padding: 8px !important;
          gap: 8px !important;
        }

        body.deckLayoutGuard #cardList .cardRow,
        body.deckLayoutGuard #deckList .cardRow {
          grid-template-columns: minmax(0, 1fr) 138px !important;
          min-height: 78px !important;
          padding: 7px 8px !important;
        }

        body.deckLayoutGuard #cardList .cardRow .btns,
        body.deckLayoutGuard #deckList .cardRow .btns {
          grid-template-columns: 36px minmax(42px, 1fr) 36px !important;
          gap: 4px !important;
        }

        body.deckLayoutGuard #cardList .cardRow .btns button,
        body.deckLayoutGuard #deckList .cardRow .btns button,
        body.deckLayoutGuard #cardList .cardRow .btns .count,
        body.deckLayoutGuard #deckList .cardRow .btns .count {
          height: 30px !important;
          min-height: 30px !important;
          font-size: 11px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanupForeignDeckChrome() {
    if (!isDeckBuilderActive()) return;
    document.body.classList.add("deckLayoutGuard");
    document.body.classList.remove("has-tcg-route-strip");
    document.querySelectorAll(".tcg-route-strip,.journeyStrip,#journeyFab,#journeyPanel").forEach((el) => el.remove());
    const versionPill = document.getElementById("deckVersionPill");
      if (versionPill) versionPill.textContent = "v20260821 readable-ui1";
  }

  function run() {
    if (!isDeckBuilderActive()) {
      document.body.classList.remove("deckLayoutGuard");
      return;
    }
    injectCss();
    cleanupForeignDeckChrome();
  }

  let retryCount = 0;
  let retryTimer = 0;
  let observerTimer = 0;
  let observer = null;

  function scheduleRun(delay = 0) {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      run();
      retryCount += 1;
      if (retryCount < 18) scheduleRun(retryCount < 6 ? 250 : 750);
    }, delay);
  }

  function startLightObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => {
      if (observerTimer) return;
      observerTimer = window.setTimeout(() => {
        observerTimer = 0;
        run();
      }, 180);
    });
    observer.observe(document.body, { childList: true });
    window.setTimeout(() => {
      if (observer) observer.disconnect();
      observer = null;
    }, 15000);
  }

  run();
  scheduleRun(150);
  window.addEventListener("DOMContentLoaded", () => {
    run();
    startLightObserver();
  });
  window.addEventListener("load", () => {
    run();
    scheduleRun(250);
  });
  document.addEventListener("click", () => scheduleRun(80), true);
  console.log("[deck_layout_guard] ready", VERSION);
})();
