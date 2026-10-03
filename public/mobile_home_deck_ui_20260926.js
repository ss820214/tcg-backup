(() => {
  "use strict";

  const STYLE_ID = "mobileHomeDeckUi20260926";
  const BODY_CLASS = "mobileFitUi";
  const HOME_CLASS = "mobileHomeFit";

  function readDeviceOverride() {
    try {
      return localStorage.getItem("tcgDeviceModeOverrideV2") || "auto";
    } catch {
      return "auto";
    }
  }

  function detectMobileAuto() {
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 9999;
    const screenWidth = window.screen?.width || 9999;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    const coarsePointer = (() => {
      try {
        return !!window.matchMedia?.("(pointer: coarse)")?.matches;
      } catch {
        return false;
      }
    })();
    return (mobileUa && viewportWidth <= 1180) || (coarsePointer && screenWidth <= 900);
  }

  function isMobileLike() {
    if (window.TCG_DEVICE_MODE?.isMobile) return window.TCG_DEVICE_MODE.isMobile();
    const mode = readDeviceOverride();
    if (mode === "pc") return false;
    if (mode === "mobile") return true;
    return detectMobileAuto();
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  }

  function syncMode() {
    const mobile = isMobileLike();
    document.body.classList.toggle(BODY_CLASS, mobile);
    const mode = mobile ? "mobile" : "desktop";
    if (document.documentElement.dataset.mobileFitUi !== mode) {
      document.documentElement.dataset.mobileFitUi = mode;
    }
    const home = document.getElementById("deckStart");
    document.body.classList.toggle(HOME_CLASS, mobile && isVisible(home));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 900px), (pointer: coarse) and (max-width: 1180px) {
  html[data-mobile-fit-ui="mobile"],
  html[data-mobile-fit-ui="mobile"] body {
    max-width: 100vw !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} {
    height: 100dvh !important;
    overflow: hidden !important;
    padding: 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    overflow: hidden !important;
    padding: calc(7px + env(safe-area-inset-top, 0px)) 8px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
    box-sizing: border-box !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartShell {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) auto !important;
    gap: 8px !important;
    overflow: hidden !important;
    transform: none !important;
    zoom: 1 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPanel {
    border-radius: 15px !important;
    min-width: 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartStage {
    order: 1 !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: hidden !important;
    padding: 10px !important;
    display: grid !important;
    grid-template-rows: auto minmax(0, 1fr) auto !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
    order: 2 !important;
    max-height: 35dvh !important;
    min-height: 0 !important;
    overflow: hidden !important;
    padding: 8px !important;
    display: grid !important;
    grid-template-rows: auto auto auto !important;
    gap: 7px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartProfile {
    min-height: 48px !important;
    padding: 7px !important;
    grid-template-columns: 42px minmax(0, 1fr) 30px !important;
    gap: 8px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartAvatar {
    width: 42px !important;
    height: 42px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartProfileTitle,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartProfileName {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    font-size: 14px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartProfileSub,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDeckText {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    font-size: 10px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartInfo {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPass {
    min-height: 38px !important;
    padding: 7px 10px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPass .deckStartDeckText {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMenu {
    min-height: 0 !important;
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 6px !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeBtn {
    min-height: clamp(48px, 8.3dvh, 62px) !important;
    height: auto !important;
    border-radius: 12px !important;
    padding: 7px !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeIcon {
    width: 28px !important;
    height: 28px !important;
    font-size: 11px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeTitle {
    font-size: 12px !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeSub {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTopbar {
    min-height: 30px !important;
    gap: 5px !important;
    flex-wrap: nowrap !important;
    justify-content: flex-end !important;
    align-items: center !important;
    overflow: visible !important;
    position: relative !important;
    z-index: 10 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTopbar > * {
    height: 29px !important;
    min-height: 29px !important;
    padding: 0 8px !important;
    font-size: 10px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTopbar .deckStartChip:nth-of-type(n + 3) {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConcept {
    width: min(288px, 84vw) !important;
    max-height: 29dvh !important;
    overflow: hidden !important;
    justify-self: end !important;
    padding: 9px !important;
    font-size: 11px !important;
    position: relative !important;
    z-index: 3 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConcept h2,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptTitle {
    font-size: clamp(15px, 4.3vw, 20px) !important;
    line-height: 1.08 !important;
    margin: 4px 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptDetails,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptGrid,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartAffinity {
    max-height: 15dvh !important;
    overflow: auto !important;
    scrollbar-width: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptDetails::-webkit-scrollbar,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptGrid::-webkit-scrollbar,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartAffinity::-webkit-scrollbar {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHero {
    min-height: 0 !important;
    overflow: hidden !important;
    position: relative !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .homeCharacter,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMascot {
    width: min(184px, 46vw) !important;
    height: min(250px, 34dvh) !important;
    max-height: 34dvh !important;
    opacity: .72 !important;
    right: 6vw !important;
    top: 23% !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTitleBlock {
    left: 10px !important;
    bottom: 52px !important;
    max-width: 64% !important;
    z-index: 2 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTitle {
    font-size: clamp(34px, 11vw, 58px) !important;
    line-height: .93 !important;
    letter-spacing: 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartSub {
    font-size: 11px !important;
    line-height: 1.45 !important;
    max-height: 3.1em !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuel {
    align-self: end !important;
    justify-self: stretch !important;
    height: 44px !important;
    min-height: 44px !important;
    margin: 0 !important;
    border-radius: 13px !important;
    font-size: 18px !important;
    position: relative !important;
    z-index: 4 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDeckJump,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuel .deckStartDuelSub {
    display: none !important;
  }

  @media (max-height: 650px) {
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
      max-height: 31dvh !important;
    }
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptDetails,
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConceptGrid,
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartAffinity {
      display: none !important;
    }
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConcept {
      max-height: 22dvh !important;
    }
  }

  @media (orientation: landscape) and (max-height: 560px) {
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartShell {
      grid-template-columns: minmax(230px, 34vw) minmax(0, 1fr) !important;
      grid-template-rows: minmax(0, 1fr) !important;
      gap: 8px !important;
    }
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
      order: 1 !important;
      max-height: none !important;
      height: 100% !important;
    }
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartStage {
      order: 2 !important;
    }
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMenu {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeBtn {
      min-height: 50px !important;
    }
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) {
    overflow: hidden !important;
    padding-bottom: 0 !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) header,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .topbar,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .deckTopBar {
    min-height: 46px !important;
    padding: 6px 8px !important;
    gap: 6px !important;
    overflow-x: auto !important;
    scrollbar-width: none !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) header::-webkit-scrollbar,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .topbar::-webkit-scrollbar,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .deckTopBar::-webkit-scrollbar {
    display: none !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .wrap {
    height: calc(100dvh - 58px) !important;
    min-height: 0 !important;
    overflow: hidden !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) minmax(230px, 42dvh) !important;
    gap: 8px !important;
    padding: 8px !important;
    box-sizing: border-box !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .libraryPanel {
    order: 1 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckPanel {
    order: 2 !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .libraryPanel .hd,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckPanel > .hd {
    min-height: 34px !important;
    padding: 7px 9px !important;
    gap: 6px !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .libraryPanel .body,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckPanel .body {
    min-height: 0 !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList.list {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 7px !important;
    overflow: auto !important;
    max-height: none !important;
    min-height: 0 !important;
    padding: 7px !important;
    overscroll-behavior: contain !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow {
    min-height: 82px !important;
    padding: 9px !important;
    border-radius: 12px !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 92px !important;
    grid-template-areas:
      "main ctrl"
      "detail detail" !important;
    align-items: center !important;
    gap: 6px !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow .cardMain,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow .main {
    grid-area: main !important;
    min-width: 0 !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow .name {
    font-size: 12px !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow .sub {
    font-size: 10px !important;
    line-height: 1.35 !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow .btns {
    grid-area: ctrl !important;
    min-width: 0 !important;
    display: grid !important;
    grid-template-columns: 30px minmax(34px, 1fr) 30px !important;
    grid-template-rows: 30px 30px !important;
    gap: 4px !important;
    align-content: center !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow [data-plus],
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow [data-minus],
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow .count {
    min-height: 30px !important;
    height: 30px !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow [data-detail] {
    grid-column: 1 / -1 !important;
    min-height: 30px !important;
    height: 30px !important;
    padding: 0 8px !important;
    font-size: 11px !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList.list {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    overflow: auto !important;
    max-height: none !important;
    min-height: 0 !important;
    padding: 7px !important;
    overscroll-behavior: contain !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow {
    min-height: 58px !important;
    padding: 8px !important;
    border-radius: 11px !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 188px !important;
    grid-template-areas: "main ctrl" !important;
    gap: 6px !important;
    align-items: center !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .cardMain,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .main {
    grid-area: main !important;
    min-width: 0 !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .name {
    font-size: 12px !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .sub {
    font-size: 10px !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .btns {
    grid-area: ctrl !important;
    min-width: 0 !important;
    display: grid !important;
    grid-template-columns: 54px 34px minmax(42px, 1fr) 34px !important;
    grid-template-areas: "detail plus count minus" !important;
    gap: 5px !important;
    align-items: center !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-detail] {
    grid-area: detail !important;
    min-height: 34px !important;
    height: 34px !important;
    padding: 0 7px !important;
    font-size: 11px !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-plus] {
    grid-area: plus !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .count {
    grid-area: count !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-minus] {
    grid-area: minus !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-ex],
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-expick] {
    display: none !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-plus],
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-minus],
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .count {
    min-height: 34px !important;
    height: 34px !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckPanelActions,
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .deckActions {
    flex-wrap: nowrap !important;
    gap: 6px !important;
    overflow-x: auto !important;
  }

  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckPanelActions [data-deck-panel-action="play"],
  body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckPanelActions .playBtn {
    position: static !important;
    transform: none !important;
    min-width: 76px !important;
  }

  @media (max-width: 480px) {
    body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) .wrap {
      grid-template-rows: minmax(0, 1fr) minmax(230px, 43dvh) !important;
      padding: 6px !important;
    }

    body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList.list {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 6px !important;
    }

    body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #cardList .cardRow {
      min-height: 76px !important;
      grid-template-columns: minmax(0, 1fr) 88px !important;
    }

    body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow {
      grid-template-columns: minmax(0, 1fr) 142px !important;
      min-height: 56px !important;
    }

    body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow .btns {
      grid-template-columns: 44px 30px minmax(36px, 1fr) 30px !important;
      gap: 3px !important;
    }

    body.${BODY_CLASS}.mobileDeckUi:not(.${HOME_CLASS}) #deckList .cardRow [data-detail] {
      font-size: 10px !important;
      padding: 0 4px !important;
    }
  }
}
`;
    style.textContent += `
@media (max-width: 900px), (hover: none) and (pointer: coarse) {
  html[data-mobile-fit-ui="mobile"],
  html[data-mobile-fit-ui="mobile"] body.${BODY_CLASS}.${HOME_CLASS} {
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
    overflow: hidden !important;
    overscroll-behavior: none !important;
    background: #071018 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS}::before {
    content: "" !important;
    position: fixed !important;
    inset: 0 !important;
    pointer-events: none !important;
    z-index: 0 !important;
    background:
      radial-gradient(circle at 48% 20%, rgba(164, 91, 255, .22), transparent 34%),
      radial-gradient(circle at 50% 58%, rgba(96, 230, 255, .16), transparent 42%),
      linear-gradient(180deg, rgba(16, 30, 44, .96), rgba(5, 9, 15, .98) 72%, rgba(1, 4, 8, 1));
  }

  body.${BODY_CLASS}.${HOME_CLASS}::after {
    content: "" !important;
    position: fixed !important;
    inset: 0 !important;
    pointer-events: none !important;
    z-index: 1 !important;
    opacity: .28 !important;
    background:
      linear-gradient(rgba(135, 220, 255, .08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(135, 220, 255, .08) 1px, transparent 1px);
    background-size: 22px 22px !important;
    mask-image: radial-gradient(circle at 50% 50%, #000 0 62%, transparent 96%) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    min-height: 0 !important;
    overflow: hidden !important;
    padding:
      max(8px, env(safe-area-inset-top))
      max(8px, env(safe-area-inset-right))
      max(8px, env(safe-area-inset-bottom))
      max(8px, env(safe-area-inset-left)) !important;
    box-sizing: border-box !important;
    isolation: isolate !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartShell {
    position: relative !important;
    z-index: 2 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
    transform: none !important;
    zoom: 1 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPanel {
    box-shadow: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
    position: fixed !important;
    left: max(10px, env(safe-area-inset-left)) !important;
    right: max(10px, env(safe-area-inset-right)) !important;
    bottom: max(9px, env(safe-area-inset-bottom)) !important;
    height: clamp(132px, 21dvh, 176px) !important;
    min-height: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    overflow: visible !important;
    z-index: 42 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartProfile,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPass,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConcept,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTitleBlock,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartChip {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartStage {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    padding: 0 !important;
    border: 1px solid rgba(150, 255, 220, .18) !important;
    border-radius: 24px !important;
    overflow: hidden !important;
    background:
      linear-gradient(180deg, rgba(255,255,255,.045), transparent 26%),
      radial-gradient(circle at 50% 38%, rgba(102, 217, 255, .10), transparent 33%),
      rgba(7, 12, 22, .56) !important;
    box-shadow: inset 0 0 42px rgba(80, 210, 255, .08), 0 18px 50px rgba(0,0,0,.45) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTopbar {
    position: fixed !important;
    top: max(8px, env(safe-area-inset-top)) !important;
    left: max(10px, env(safe-area-inset-left)) !important;
    right: max(10px, env(safe-area-inset-right)) !important;
    height: 46px !important;
    min-height: 46px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 8px !important;
    padding: 0 !important;
    z-index: 84 !important;
    pointer-events: auto !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPostBtn,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsBtn {
    min-height: 38px !important;
    height: 38px !important;
    max-width: 126px !important;
    padding: 0 12px !important;
    border-radius: 999px !important;
    gap: 7px !important;
    background:
      linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.05)),
      rgba(12, 20, 32, .76) !important;
    border: 1px solid rgba(158, 235, 255, .34) !important;
    box-shadow: 0 10px 28px rgba(0,0,0,.36), inset 0 0 18px rgba(255,255,255,.07) !important;
    backdrop-filter: blur(10px) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPostBtn span,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsBtn span {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPostBtn b,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsBtn b {
    font-size: 13px !important;
    letter-spacing: .03em !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPostBtn::before,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsBtn::before {
    flex: 0 0 20px !important;
    width: 20px !important;
    height: 20px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsWrap {
    position: relative !important;
    z-index: 88 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsPanel {
    position: fixed !important;
    top: calc(max(8px, env(safe-area-inset-top)) + 48px) !important;
    left: max(10px, env(safe-area-inset-left)) !important;
    right: max(10px, env(safe-area-inset-right)) !important;
    width: auto !important;
    max-height: 46dvh !important;
    overflow: auto !important;
    border-radius: 18px !important;
    z-index: 99 !important;
    background: rgba(9, 15, 26, .94) !important;
    border: 1px solid rgba(132, 220, 255, .36) !important;
    box-shadow: 0 20px 54px rgba(0,0,0,.56), inset 0 0 24px rgba(110, 210, 255, .08) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolItem {
    min-height: 42px !important;
    font-size: 13px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHero {
    position: absolute !important;
    left: 7% !important;
    right: 7% !important;
    top: 54px !important;
    bottom: calc(clamp(132px, 21dvh, 176px) + 92px) !important;
    min-height: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: visible !important;
    pointer-events: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHeroLines {
    position: absolute !important;
    inset: 0 !important;
    opacity: .62 !important;
    background:
      radial-gradient(circle at 50% 48%, rgba(185,255,55,.18), transparent 32%),
      radial-gradient(circle at 50% 64%, rgba(255,230,80,.22), transparent 18%),
      linear-gradient(115deg, transparent 0 36%, rgba(120, 220, 255, .16) 37%, transparent 41%) !important;
    filter: blur(.2px) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit {
    position: relative !important;
    width: min(66vw, 270px) !important;
    height: min(42dvh, 330px) !important;
    min-width: 190px !important;
    min-height: 230px !important;
    max-height: 44dvh !important;
    transform: translateY(-2px) !important;
    opacity: .98 !important;
    filter: drop-shadow(0 26px 42px rgba(0,0,0,.55)) drop-shadow(0 0 28px rgba(140, 110, 255, .22)) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit::before {
    background-size: contain !important;
    background-position: center bottom !important;
    background-repeat: no-repeat !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuel {
    position: fixed !important;
    left: max(24px, calc(env(safe-area-inset-left) + 18px)) !important;
    right: max(24px, calc(env(safe-area-inset-right) + 18px)) !important;
    bottom: calc(max(9px, env(safe-area-inset-bottom)) + clamp(132px, 21dvh, 176px) + 12px) !important;
    height: clamp(52px, 8dvh, 68px) !important;
    min-height: 52px !important;
    border-radius: 20px !important;
    z-index: 50 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: clamp(22px, 7vw, 34px) !important;
    letter-spacing: .12em !important;
    color: #06120a !important;
    background:
      linear-gradient(90deg, rgba(185,255,30,.98), rgba(111,255,211,.93), rgba(104,180,255,.9)),
      repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,.22) 10px 14px) !important;
    border: 1px solid rgba(208,255,95,.76) !important;
    box-shadow: 0 0 36px rgba(174,255,56,.34), inset 0 0 20px rgba(255,255,255,.28) !important;
    transform: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMenu {
    position: absolute !important;
    inset: 0 !important;
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-auto-rows: 1fr !important;
    gap: 7px !important;
    padding: 0 !important;
    margin: 0 !important;
    height: 100% !important;
    max-height: 100% !important;
    overflow: hidden !important;
    pointer-events: auto !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeBtn {
    min-width: 0 !important;
    min-height: 0 !important;
    width: 100% !important;
    height: 100% !important;
    padding: 9px 7px 8px !important;
    border-radius: 18px !important;
    display: grid !important;
    grid-template-columns: 34px minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) auto !important;
    grid-template-areas:
      "icon label"
      "sub sub" !important;
    align-items: end !important;
    gap: 2px 7px !important;
    overflow: hidden !important;
    background:
      linear-gradient(180deg, rgba(6, 10, 16, .08), rgba(0,0,0,.56)),
      var(--homeArt),
      rgba(10, 18, 28, .78) !important;
    background-size: cover !important;
    background-position: center !important;
    border: 1px solid rgba(132, 226, 255, .24) !important;
    box-shadow: inset 0 0 22px rgba(255,255,255,.05), 0 10px 24px rgba(0,0,0,.36) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeBtn::before {
    opacity: .82 !important;
    background: linear-gradient(135deg, rgba(0,0,0,.24), var(--homeAccent, rgba(105,180,255,.36))) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeIcon {
    grid-area: icon !important;
    width: 30px !important;
    height: 30px !important;
    font-size: 14px !important;
    align-self: end !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeLabel {
    grid-area: label !important;
    min-width: 0 !important;
    font-size: clamp(13px, 3.7vw, 16px) !important;
    line-height: 1.08 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    align-self: end !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeSub {
    grid-area: sub !important;
    font-size: 9px !important;
    letter-spacing: .08em !important;
    opacity: .84 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} .dopagaki-toggle,
  body.${BODY_CLASS}.${HOME_CLASS} .dopagakiToggle,
  body.${BODY_CLASS}.${HOME_CLASS} #dopagakiToggle,
  body.${BODY_CLASS}.${HOME_CLASS} [data-dopagaki-toggle] {
    position: fixed !important;
    top: calc(max(8px, env(safe-area-inset-top)) + 48px) !important;
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%) scale(.72) !important;
    transform-origin: top center !important;
    z-index: 58 !important;
  }

  @media (orientation: landscape) and (max-height: 560px) {
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
      left: max(8px, env(safe-area-inset-left)) !important;
      right: auto !important;
      bottom: max(8px, env(safe-area-inset-bottom)) !important;
      width: min(48vw, 390px) !important;
      height: clamp(112px, 28dvh, 154px) !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMenu {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHero {
      left: 46% !important;
      right: 4% !important;
      top: 48px !important;
      bottom: 70px !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit {
      width: min(28vw, 220px) !important;
      height: min(54dvh, 270px) !important;
      min-height: 180px !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuel {
      left: calc(max(8px, env(safe-area-inset-left)) + min(48vw, 390px) + 14px) !important;
      right: max(18px, env(safe-area-inset-right)) !important;
      bottom: max(10px, env(safe-area-inset-bottom)) !important;
      height: 54px !important;
    }
  }

  @media (max-width: 390px) {
    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
      height: 128px !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeBtn {
      border-radius: 15px !important;
      padding: 7px 6px !important;
      grid-template-columns: 28px minmax(0, 1fr) !important;
      gap: 2px 5px !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeIcon {
      width: 26px !important;
      height: 26px !important;
      font-size: 12px !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeLabel {
      font-size: 12px !important;
    }

    body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeSub {
      font-size: 8px !important;
    }
  }
}
`;
    style.textContent += `
/* Final mobile home composition guard.
   Keep this last so the earlier experimental home layouts cannot fight it. */
@media (max-width: 900px), (hover: none) and (pointer: coarse) {
  html[data-mobile-fit-ui="mobile"] body.${BODY_CLASS}.${HOME_CLASS} {
    height: 100dvh !important;
    min-height: 100dvh !important;
    overflow: hidden !important;
    background:
      radial-gradient(circle at 50% 30%, rgba(168, 255, 82, .09), transparent 32%),
      linear-gradient(180deg, #07121b 0%, #070b10 62%, #030507 100%) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    padding: calc(8px + env(safe-area-inset-top, 0px)) 10px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartShell {
    position: relative !important;
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
    overflow: hidden !important;
    border-radius: 24px !important;
    background:
      radial-gradient(circle at 50% 42%, rgba(197, 85, 255, .20), transparent 34%),
      radial-gradient(circle at 50% 68%, rgba(163, 255, 48, .14), transparent 26%),
      linear-gradient(155deg, rgba(21, 36, 55, .95), rgba(9, 13, 22, .98) 58%, rgba(5, 9, 13, .98)) !important;
    border: 1px solid rgba(156, 224, 255, .18) !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 24px 70px rgba(0,0,0,.5) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartStage {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    border: 0 !important;
    border-radius: inherit !important;
    background:
      linear-gradient(rgba(120, 220, 255, .035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(120, 220, 255, .035) 1px, transparent 1px) !important;
    background-size: 22px 22px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartProfile,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPass,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartInfo,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartConcept,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTitleBlock,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartChip {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartTopbar {
    position: absolute !important;
    top: max(9px, env(safe-area-inset-top, 0px)) !important;
    left: 10px !important;
    right: auto !important;
    transform: none !important;
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 7px !important;
    height: 36px !important;
    z-index: 120 !important;
    pointer-events: auto !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartPostBtn,
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsBtn {
    position: relative !important;
    width: auto !important;
    min-width: 78px !important;
    max-width: 96px !important;
    height: 34px !important;
    padding: 0 10px !important;
    border-radius: 14px !important;
    font-size: 12px !important;
    letter-spacing: .04em !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-shadow: 0 8px 22px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.12) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsWrap {
    position: relative !important;
    z-index: 130 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsPanel {
    position: fixed !important;
    top: calc(max(9px, env(safe-area-inset-top, 0px)) + 42px) !important;
    left: 10px !important;
    right: auto !important;
    width: min(245px, calc(100vw - 20px)) !important;
    max-height: min(48dvh, 330px) !important;
    padding: 8px !important;
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 7px !important;
    overflow: auto !important;
    border-radius: 16px !important;
    background: rgba(14, 20, 31, .96) !important;
    border: 1px solid rgba(119, 215, 255, .30) !important;
    box-shadow: 0 20px 56px rgba(0,0,0,.58), 0 0 28px rgba(112, 219, 255, .12) !important;
    z-index: 160 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolsPanel[hidden] {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartToolItem {
    min-height: 42px !important;
    padding: 8px 10px !important;
    border-radius: 12px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHero {
    position: absolute !important;
    top: 50px !important;
    left: 10px !important;
    right: 10px !important;
    bottom: 222px !important;
    display: grid !important;
    place-items: center !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
    z-index: 20 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHeroLines {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit {
    position: relative !important;
    right: auto !important;
    top: auto !important;
    left: auto !important;
    bottom: auto !important;
    width: min(72vw, 285px) !important;
    height: min(48dvh, 348px) !important;
    max-width: calc(100vw - 58px) !important;
    max-height: 100% !important;
    min-height: 190px !important;
    margin: 0 auto !important;
    transform: none !important;
    opacity: .95 !important;
    overflow: visible !important;
    filter: drop-shadow(0 22px 36px rgba(0,0,0,.42)) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit::before {
    inset: -6% -10% -1% -10% !important;
    background-size: contain !important;
    background-position: center bottom !important;
    background-repeat: no-repeat !important;
    border-radius: 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit::after {
    inset: 15% 1% 6% 1% !important;
    opacity: .32 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartWing {
    inset: 17% -5% 12% -5% !important;
    opacity: .48 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuel {
    position: absolute !important;
    left: 22px !important;
    right: 22px !important;
    bottom: calc(144px + env(safe-area-inset-bottom, 0px)) !important;
    height: 56px !important;
    display: grid !important;
    place-items: center !important;
    padding: 0 !important;
    border-radius: 18px !important;
    font-size: 20px !important;
    letter-spacing: .18em !important;
    z-index: 70 !important;
    background:
      linear-gradient(90deg, rgba(181,255,34,.95), rgba(100,255,185,.92)),
      repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 7px, transparent 7px 14px) !important;
    border: 1px solid rgba(209, 255, 101, .72) !important;
    box-shadow: 0 0 34px rgba(161,255,41,.32), 0 16px 32px rgba(0,0,0,.36) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuelSub {
    display: none !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
    position: absolute !important;
    left: 10px !important;
    right: 10px !important;
    bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
    width: auto !important;
    height: 124px !important;
    min-height: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    overflow: visible !important;
    background: transparent !important;
    box-shadow: none !important;
    z-index: 60 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMenu {
    position: absolute !important;
    inset: 0 !important;
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-rows: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeBtn {
    min-height: 0 !important;
    height: auto !important;
    padding: 8px 7px !important;
    border-radius: 16px !important;
    grid-template-columns: 30px minmax(0, 1fr) !important;
    gap: 2px 6px !important;
    align-content: center !important;
    background:
      linear-gradient(140deg, rgba(13, 23, 33, .82), rgba(6, 10, 15, .88)),
      var(--home-art, none) !important;
    background-size: cover !important;
    background-position: center !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.13), 0 10px 24px rgba(0,0,0,.34) !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeIcon {
    width: 29px !important;
    height: 29px !important;
    font-size: 12px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeLabel {
    font-size: clamp(12px, 3.2vw, 15px) !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckHomeSub {
    font-size: 8px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
}

@media (max-width: 390px) {
  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartHero {
    top: 48px !important;
    bottom: 205px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartUnit {
    width: min(70vw, 250px) !important;
    height: min(44dvh, 300px) !important;
    min-height: 170px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartDuel {
    left: 20px !important;
    right: 20px !important;
    bottom: calc(132px + env(safe-area-inset-bottom, 0px)) !important;
    height: 50px !important;
    font-size: 18px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartLeft {
    height: 116px !important;
  }

  body.${BODY_CLASS}.${HOME_CLASS} #deckStart .deckStartMenu {
    gap: 7px !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    let raf = 0;
    const scheduleSync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncMode();
      });
    };
    syncMode();
    window.addEventListener("resize", scheduleSync, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(syncMode, 160), { passive: true });
    window.addEventListener("tcg:device-mode-change", scheduleSync, { passive: true });
    window.addEventListener("pageshow", scheduleSync, { passive: true });
    window.addEventListener("popstate", scheduleSync, { passive: true });
    document.addEventListener("visibilitychange", scheduleSync, { passive: true });
    [120, 450, 1000, 1800].forEach((delay) => setTimeout(scheduleSync, delay));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

(() => {
  const STYLE_ID = "mobileDeckScreenUi20260926";
  const BODY_CLASS = "mobileDeckScreen";
  const FORCE_CLASS = "mobileDeckScreenForce";
  const MODE_LABEL_ID = "mobileDeckModeLabel";

  const isDeckPage = () =>
    Boolean(
      document.getElementById("deckPanel") &&
        document.getElementById("deckMainPanel") &&
        document.getElementById("cardList")
    );

  const readDeviceOverride = () => {
    try {
      return localStorage.getItem("tcgDeviceModeOverrideV2") || "auto";
    } catch {
      return "auto";
    }
  };

  const detectMobileAuto = () => {
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 9999;
    const screenWidth = window.screen?.width || 9999;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    const coarsePointer = (() => {
      try {
        return !!window.matchMedia?.("(pointer: coarse)")?.matches;
      } catch {
        return false;
      }
    })();
    return (mobileUa && viewportWidth <= 1180) || (coarsePointer && screenWidth <= 900);
  };

  const isMobileLike = () => {
    if (window.TCG_DEVICE_MODE?.isMobile) return window.TCG_DEVICE_MODE.isMobile();
    const mode = readDeviceOverride();
    if (mode === "pc") return false;
    if (mode === "mobile") return true;
    return detectMobileAuto();
  };

  function isHomeVisible() {
    const home = document.getElementById("deckStart");
    if (!home || home.hidden || home.getAttribute("aria-hidden") === "true") return false;
    if (
      home.classList.contains("hidden") ||
      home.classList.contains("hide") ||
      home.classList.contains("isHidden") ||
      home.classList.contains("isClosing")
    ) {
      return false;
    }
    const style = window.getComputedStyle(home);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.03) {
      return false;
    }
    const rect = home.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8;
  }

  function setForcedDeckMode(forced) {
    document.body.classList.toggle(FORCE_CLASS, Boolean(forced));
    requestAnimationFrame(syncMode);
  }

  function wantsDeckMode() {
    return document.body.classList.contains(FORCE_CLASS) || !isHomeVisible();
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 900px), (pointer: coarse) and (max-width: 1180px) {
  body.${BODY_CLASS} {
    width: 100vw !important;
    height: 100dvh !important;
    min-height: 100dvh !important;
    overflow: hidden !important;
    background:
      radial-gradient(circle at 28% 8%, rgba(91, 219, 255, .14), transparent 26%),
      radial-gradient(circle at 88% 22%, rgba(138, 255, 161, .12), transparent 28%),
      linear-gradient(180deg, #07101a 0%, #05080e 100%) !important;
  }

  body.${BODY_CLASS} header {
    position: sticky !important;
    top: 0 !important;
    z-index: 6000 !important;
    height: 48px !important;
    min-height: 48px !important;
    padding: 5px 8px !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    overflow: hidden !important;
    border-bottom: 1px solid rgba(123, 245, 214, .24) !important;
    background: linear-gradient(90deg, rgba(9, 21, 32, .98), rgba(11, 34, 28, .94)) !important;
  }

  body.${BODY_CLASS} header .brand {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    max-width: 38vw !important;
    gap: 7px !important;
  }

  body.${BODY_CLASS} header .brand h1 {
    font-size: 13px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} header .brand .pill {
    display: none !important;
  }

  body.${BODY_CLASS} header .topRight {
    margin-left: auto !important;
    min-width: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 5px !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    scrollbar-width: none !important;
  }

  body.${BODY_CLASS} header .topRight::-webkit-scrollbar {
    display: none !important;
  }

  body.${BODY_CLASS} header .pill,
  body.${BODY_CLASS} header button,
  body.${BODY_CLASS} .${MODE_LABEL_ID} {
    flex: 0 0 auto !important;
    min-width: 0 !important;
    min-height: 30px !important;
    padding: 0 9px !important;
    border-radius: 999px !important;
    font-size: 10.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS} #versionLabel,
  body.${BODY_CLASS} #btnRule,
  body.${BODY_CLASS} #btnGuide,
  body.${BODY_CLASS} #btnSettings,
  body.${BODY_CLASS} #btnBgm {
    display: none !important;
  }

  body.${BODY_CLASS} .wrap {
    width: 100vw !important;
    height: calc(100dvh - 48px) !important;
    min-height: 0 !important;
    padding: 6px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 7px !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} #deckPanel {
    order: 1 !important;
    position: relative !important;
    top: auto !important;
    flex: 0 0 45% !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 220px !important;
    max-height: 45% !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    border-radius: 16px !important;
    box-shadow: 0 12px 28px rgba(0, 0, 0, .38), inset 0 1px 0 rgba(255,255,255,.08) !important;
  }

  body.${BODY_CLASS} #deckMainPanel {
    order: 2 !important;
    flex: 1 1 auto !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: none !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    border-radius: 16px !important;
  }

  body.${BODY_CLASS} .panel > .hd {
    min-height: 32px !important;
    padding: 7px 10px !important;
  }

  body.${BODY_CLASS} .panel > .hd b {
    font-size: 13px !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS} #deckPanel > .hd b::after {
    content: " / スマホ版";
    margin-left: 6px;
    color: rgba(190, 255, 236, .7);
    font-size: 10px;
    font-weight: 600;
  }

  body.${BODY_CLASS} #deckPanel > .hd .row {
    gap: 5px !important;
  }

  body.${BODY_CLASS} #btnClearDeck {
    min-width: 54px !important;
    min-height: 30px !important;
    padding: 0 8px !important;
    font-size: 11px !important;
  }

  body.${BODY_CLASS} #deckPanel > .bd,
  body.${BODY_CLASS} #deckMainPanel > .bd {
    flex: 1 1 auto !important;
    height: 100% !important;
    min-height: 0 !important;
    padding: 7px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} #deckPanelActions {
    order: 0 !important;
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    gap: 5px !important;
    margin: 0 !important;
    padding: 4px !important;
    border: 1px solid rgba(120, 255, 220, .18) !important;
    border-radius: 14px !important;
    background: linear-gradient(90deg, rgba(54, 110, 118, .18), rgba(70, 150, 91, .13)) !important;
  }

  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action] {
    position: relative !important;
    inset: auto !important;
    transform: none !important;
    min-width: 0 !important;
    min-height: 31px !important;
    padding: 2px 4px !important;
    border-radius: 999px !important;
    font-size: 11px !important;
    line-height: 1.05 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} #deckSaveDock {
    order: 1 !important;
    flex: 0 0 auto !important;
    border-radius: 13px !important;
  }

  body.${BODY_CLASS} #deckSaveDock.isCollapsed .deckSaveRow {
    display: none !important;
  }

  body.${BODY_CLASS} .deckSaveDockHead,
  body.${BODY_CLASS} .deckInfoDockHead {
    min-height: 34px !important;
    padding: 7px 9px !important;
  }

  body.${BODY_CLASS} .deckSaveDockHeadMain span,
  body.${BODY_CLASS} .deckInfoDockHeadMain span {
    display: none !important;
  }

  body.${BODY_CLASS} .deckSaveRow {
    padding: 7px !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 82px !important;
    gap: 6px !important;
  }

  body.${BODY_CLASS} #deckTitle {
    min-height: 32px !important;
    height: 32px !important;
    padding: 0 9px !important;
    font-size: 13px !important;
  }

  body.${BODY_CLASS} #btnSave {
    min-height: 32px !important;
    padding: 0 8px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS} #deckInfoDock {
    order: 2 !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    border-radius: 13px !important;
  }

  body.${BODY_CLASS} #deckInfoDock.isCollapsed {
    flex: 0 0 auto !important;
  }

  body.${BODY_CLASS} #deckInfoDock.isCollapsed .deckInfoBody {
    display: none !important;
  }

  body.${BODY_CLASS} .deckInfoBody {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    padding: 6px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} .deckInfoBody .listHead {
    min-height: 30px !important;
    padding: 6px 8px !important;
  }

  body.${BODY_CLASS} .deckInfoBody .listHead .small {
    display: none !important;
  }

  body.${BODY_CLASS} #deckList {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 4px 3px 28px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
    overflow: auto !important;
    overscroll-behavior: contain !important;
  }

  body.${BODY_CLASS} #deckMsg {
    flex: 0 0 auto !important;
    max-height: 28px !important;
    margin: 0 !important;
    overflow: hidden !important;
    font-size: 10px !important;
  }

  body.${BODY_CLASS} #deckMainPanel #mobileCardSection {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} #deckMainPanel .filterBox {
    flex: 0 0 auto !important;
    margin: 0 !important;
    padding: 7px !important;
    border-radius: 13px !important;
  }

  body.${BODY_CLASS} #deckMainPanel .sectionHead {
    margin: 0 0 5px !important;
    gap: 6px !important;
  }

  body.${BODY_CLASS} #search {
    height: 32px !important;
    min-height: 32px !important;
    padding: 0 10px !important;
    font-size: 13px !important;
  }

  body.${BODY_CLASS} #attributeHint {
    display: none !important;
  }

  body.${BODY_CLASS} .filterGrid {
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
  }

  body.${BODY_CLASS} .typeRow,
  body.${BODY_CLASS} .attrRow,
  body.${BODY_CLASS} .ownedRow {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 5px !important;
    margin: 0 !important;
    padding: 1px 0 3px !important;
    overflow-x: auto !important;
    border: 0 !important;
    white-space: nowrap !important;
    scrollbar-width: thin !important;
  }

  body.${BODY_CLASS} .filterBtn {
    flex: 0 0 auto !important;
    min-height: 29px !important;
    padding: 0 9px !important;
    font-size: 11.5px !important;
  }

  body.${BODY_CLASS} #cardList {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    padding: 5px 3px 32px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
    overflow: auto !important;
    overscroll-behavior: contain !important;
  }

  body.${BODY_CLASS} .cardRow {
    min-height: 58px !important;
    padding: 6px 7px !important;
    gap: 6px !important;
    grid-template-columns: minmax(0, 1fr) 132px !important;
    align-items: center !important;
    overflow: hidden !important;
    border-radius: 13px !important;
  }

  body.${BODY_CLASS} #deckList .cardRow {
    min-height: 52px !important;
    grid-template-columns: minmax(0, 1fr) 132px !important;
  }

  body.${BODY_CLASS} .cardMain,
  body.${BODY_CLASS} .cardRow > div:first-child {
    min-width: 0 !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} .cardName,
  body.${BODY_CLASS} .cardRow .name {
    font-size: 12.5px !important;
    line-height: 1.15 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} .cardMeta,
  body.${BODY_CLASS} .cardRow .sub,
  body.${BODY_CLASS} .cardRow .small {
    margin-top: 3px !important;
    font-size: 10px !important;
    line-height: 1.22 !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 1 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} .cardCtrl,
  body.${BODY_CLASS} #deckList .cardRow .btns {
    position: relative !important;
    z-index: 10 !important;
    width: 132px !important;
    min-width: 0 !important;
    display: grid !important;
    grid-template-columns: 34px minmax(42px, 1fr) 34px !important;
    grid-template-areas:
      "minus count plus"
      "detail detail detail" !important;
    gap: 4px !important;
    align-items: center !important;
    justify-content: stretch !important;
  }

  body.${BODY_CLASS} .cardCtrl [data-minus],
  body.${BODY_CLASS} #deckList .cardRow .btns [data-minus] {
    grid-area: minus !important;
  }

  body.${BODY_CLASS} .cardCtrl [data-plus],
  body.${BODY_CLASS} #deckList .cardRow .btns [data-plus] {
    grid-area: plus !important;
  }

  body.${BODY_CLASS} .cardCtrl .countBox,
  body.${BODY_CLASS} .cardCtrl .count,
  body.${BODY_CLASS} #deckList .cardRow .btns .count,
  body.${BODY_CLASS} #deckList .cardRow .btns .cnt {
    grid-area: count !important;
    min-height: 31px !important;
    font-size: 12px !important;
  }

  body.${BODY_CLASS} .detailBtn,
  body.${BODY_CLASS} .cardCtrl [data-detail],
  body.${BODY_CLASS} #deckList .cardRow .btns [data-detail] {
    grid-area: detail !important;
    width: 100% !important;
    min-height: 27px !important;
    height: 27px !important;
    padding: 0 5px !important;
    border-radius: 9px !important;
    font-size: 10.5px !important;
  }

  body.${BODY_CLASS} .cardCtrl button,
  body.${BODY_CLASS} #deckList .cardRow .btns button {
    min-height: 31px !important;
    padding: 0 !important;
    font-size: 12px !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  body.${BODY_CLASS} #deckList .cardRow .btns [data-ex],
  body.${BODY_CLASS} #deckList .cardRow .btns [data-expick] {
    display: none !important;
  }

  body.${BODY_CLASS} #roomDrawerToggle {
    display: none !important;
    pointer-events: none !important;
  }

  body.${BODY_CLASS} #detailWrap {
    left: 8px !important;
    right: 8px !important;
    bottom: 8px !important;
    width: auto !important;
    max-height: 48dvh !important;
    z-index: 9000 !important;
  }
}

@media (max-width: 390px) {
  body.${BODY_CLASS} header .brand {
    max-width: 32vw !important;
  }

  body.${BODY_CLASS} #deckPanel {
    flex-basis: 43% !important;
    max-height: 43% !important;
  }

  body.${BODY_CLASS} .cardRow,
  body.${BODY_CLASS} #deckList .cardRow {
    grid-template-columns: minmax(0, 1fr) 122px !important;
  }

  body.${BODY_CLASS} .cardCtrl,
  body.${BODY_CLASS} #deckList .cardRow .btns {
    width: 122px !important;
    grid-template-columns: 32px minmax(38px, 1fr) 32px !important;
  }

  body.${BODY_CLASS} .cardName,
  body.${BODY_CLASS} .cardRow .name {
    font-size: 12px !important;
  }
}`;
    document.head.appendChild(style);
  }

  function syncModeLabel(active) {
    const headerRight = document.querySelector("header .topRight") || document.querySelector("header");
    if (!active || !headerRight) {
      document.getElementById(MODE_LABEL_ID)?.remove();
      return;
    }
    let label = document.getElementById(MODE_LABEL_ID);
    if (!label) {
      label = document.createElement("span");
      label.id = MODE_LABEL_ID;
      label.className = `${MODE_LABEL_ID} pill`;
      label.textContent = "スマホ版";
      headerRight.insertBefore(label, headerRight.firstChild);
    }
  }

  function syncMode() {
    const active = isDeckPage() && isMobileLike() && wantsDeckMode();
    document.body.classList.toggle(BODY_CLASS, active);
    syncModeLabel(active);
  }

  function wireModeButtons() {
    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button,a,[role='button'],.deckHomeBtn");
        if (!button) return;
        const id = button.id || "";
        const href = button.getAttribute("href") || "";
        const text = (button.textContent || "").replace(/\s+/g, " ").trim();
        const homeIntent = id === "btnHome" || /^(ホーム|TOP|トップ)$/i.test(text);
        const deckIntent =
          id === "btnDeckTop" ||
          /デッキ|BUILD|LOAD/i.test(text) ||
          /(?:^|[/?#])deck(?:\.html|[/?#]|$)/i.test(href);
        if (homeIntent) {
          setTimeout(() => setForcedDeckMode(false), 60);
        } else if (deckIntent) {
          setTimeout(() => setForcedDeckMode(true), 60);
        }
      },
      true
    );
  }

  function boot() {
    if (!isDeckPage()) return;
    injectStyle();
    syncMode();
    const schedule = () => requestAnimationFrame(syncMode);
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(syncMode, 180), { passive: true });
    window.addEventListener("tcg:device-mode-change", schedule, { passive: true });
    window.addEventListener("pageshow", schedule, { passive: true });
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const home = document.getElementById("deckStart");
    if (home) {
      observer.observe(home, { attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });
    }
    wireModeButtons();
    [120, 420, 900, 1600].forEach((delay) => setTimeout(syncMode, delay));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
