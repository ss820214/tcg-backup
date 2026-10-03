(() => {
  "use strict";

  const VERSION = "20261003_refine1";
  const BODY_CLASS = "deckMobileRefined";
  const STYLE_ID = "deckMobileRefine20261003Style";
  const GROUP_CLASS = "dmrGroup";
  const GROUP_BODY_CLASS = "dmrGroupBody";
  const GROUP_STATE_KEY = "tcgDeckMobileGroupsV1";
  const ATTR_ORDER = ["火", "水", "草", "風", "雷", "鋼", "光", "闇", "幻", "呪", "その他"];

  let scheduled = 0;
  let observer = null;
  let busy = false;

  function isDeckBuilder() {
    return Boolean(document.getElementById("cardList") && document.getElementById("deckPanel"));
  }

  function readOverride() {
    try {
      return String(
        localStorage.getItem("tcgDeviceModeOverrideV2") ||
          localStorage.getItem("tcgDeviceModeOverride") ||
          "auto"
      ).toLowerCase();
    } catch {
      return "auto";
    }
  }

  function isMobileLike() {
    try {
      if (window.TCG_DEVICE_MODE?.isMobile) return !!window.TCG_DEVICE_MODE.isMobile();
    } catch {}
    const override = readOverride();
    if (/^(pc|desktop|wide|fixed)$/.test(override)) return false;
    if (/^(mobile|smart|phone|sp)$/.test(override)) return true;
    const w = window.innerWidth || document.documentElement.clientWidth || 9999;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
    return (mobileUa && w <= 1180) || (coarse && w <= 1180) || w <= 900;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 900px), (pointer: coarse) and (max-width: 1180px) {
  body.${BODY_CLASS} {
    --dmr-cyan: #7cecff;
    --dmr-green: #9cff9f;
    --dmr-gold: #ffd86b;
    --dmr-line: rgba(255,255,255,.13);
    overflow-x: hidden !important;
    overflow-y: auto !important;
    height: auto !important;
    min-height: 100dvh !important;
    padding-bottom: calc(82px + env(safe-area-inset-bottom, 0px)) !important;
    background:
      radial-gradient(540px 320px at 10% -2%, rgba(73,188,255,.18), transparent 64%),
      radial-gradient(460px 340px at 96% 18%, rgba(142,255,132,.12), transparent 64%),
      linear-gradient(180deg,#071017 0%,#090d13 38%,#05070a 100%) !important;
  }

  body.${BODY_CLASS} header {
    position: sticky !important;
    top: 0 !important;
    z-index: 7000 !important;
    min-height: 50px !important;
    height: auto !important;
    display: grid !important;
    grid-template-columns: minmax(0,1fr) auto !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 7px 8px !important;
    overflow: visible !important;
    border-bottom: 1px solid rgba(124,236,255,.28) !important;
    background:
      linear-gradient(90deg,rgba(20,41,54,.96),rgba(8,14,20,.96) 58%,rgba(20,41,32,.94)) !important;
    box-shadow: 0 8px 28px rgba(0,0,0,.35), inset 0 -1px 0 rgba(255,255,255,.04) !important;
    backdrop-filter: blur(15px) !important;
  }

  body.${BODY_CLASS} header .left {
    display: flex !important;
    align-items: center !important;
    min-width: 0 !important;
    width: auto !important;
    gap: 7px !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} header .left h1 {
    margin: 0 !important;
    font-size: 16px !important;
    line-height: 1 !important;
    letter-spacing: .025em !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    text-shadow: 0 0 18px rgba(124,236,255,.32) !important;
  }

  body.${BODY_CLASS} header .left .pill,
  body.${BODY_CLASS} header .left .badge {
    display: none !important;
  }

  body.${BODY_CLASS} header .topRight {
    width: auto !important;
    min-width: 0 !important;
    display: flex !important;
    flex-wrap: nowrap !important;
    justify-content: flex-end !important;
    gap: 6px !important;
    overflow: visible !important;
    padding: 0 !important;
  }

  body.${BODY_CLASS} header .topRight > * {
    display: none !important;
  }

  body.${BODY_CLASS} header #btnHome,
  body.${BODY_CLASS} header #btnSettings {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 72px !important;
    width: auto !important;
    height: 34px !important;
    min-height: 34px !important;
    padding: 0 11px !important;
    border-radius: 999px !important;
    font-size: 11.5px !important;
    font-weight: 950 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS} header #btnHome {
    border-color: rgba(124,236,255,.45) !important;
    background: linear-gradient(180deg,rgba(75,194,255,.23),rgba(35,92,130,.16)) !important;
  }

  body.${BODY_CLASS} header #btnSettings {
    border-color: rgba(156,255,159,.42) !important;
    background: linear-gradient(180deg,rgba(111,239,142,.20),rgba(34,99,68,.15)) !important;
  }

  body.${BODY_CLASS} .wrap {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    gap: 10px !important;
    padding: 8px !important;
    zoom: 1 !important;
    transform: none !important;
  }

  body.${BODY_CLASS} #deckMainPanel,
  body.${BODY_CLASS} .libraryPanel,
  body.${BODY_CLASS} #deckPanel {
    position: relative !important;
    inset: auto !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    border-radius: 17px !important;
    border: 1px solid rgba(124,236,255,.16) !important;
    background:
      radial-gradient(460px 150px at 8% -8%, rgba(74,184,255,.13), transparent 64%),
      linear-gradient(180deg,rgba(21,31,40,.96),rgba(10,15,20,.96)) !important;
    box-shadow: 0 16px 44px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.035) !important;
  }

  body.${BODY_CLASS} .panel > .hd,
  body.${BODY_CLASS} #deckPanel > .hd {
    min-height: 44px !important;
    padding: 9px 10px !important;
    border-bottom: 1px solid rgba(124,236,255,.15) !important;
    background: linear-gradient(90deg,rgba(45,97,122,.18),rgba(255,255,255,.025)) !important;
  }

  body.${BODY_CLASS} .panel > .hd b,
  body.${BODY_CLASS} #deckPanel > .hd b {
    font-size: 14px !important;
    letter-spacing: .025em !important;
  }

  body.${BODY_CLASS} .panel > .bd,
  body.${BODY_CLASS} #deckPanel > .bd,
  body.${BODY_CLASS} .workspace,
  body.${BODY_CLASS} #mobileCardSection {
    min-width: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  body.${BODY_CLASS} .panel > .bd,
  body.${BODY_CLASS} #deckPanel > .bd {
    padding: 8px !important;
  }

  body.${BODY_CLASS} .workspace {
    display: block !important;
    padding: 0 !important;
  }

  body.${BODY_CLASS} .filterBox,
  body.${BODY_CLASS} #deckMainPanel .filterBox {
    position: relative !important;
    top: auto !important;
    z-index: 5 !important;
    width: 100% !important;
    min-width: 0 !important;
    overflow: visible !important;
    margin: 0 0 8px !important;
    padding: 8px !important;
    border-radius: 14px !important;
    border: 1px solid rgba(124,236,255,.16) !important;
    background: linear-gradient(180deg,rgba(12,24,32,.95),rgba(7,13,18,.96)) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03) !important;
  }

  body.${BODY_CLASS} .sectionHead {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
  }

  body.${BODY_CLASS} #search {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 8px 12px !important;
    border-radius: 12px !important;
    border: 1px solid rgba(124,236,255,.24) !important;
    background: rgba(0,0,0,.28) !important;
    color: #fff !important;
    font-size: 13px !important;
    box-shadow: inset 0 0 18px rgba(63,167,224,.05) !important;
  }

  body.${BODY_CLASS} #search:focus {
    border-color: rgba(124,236,255,.68) !important;
    box-shadow: 0 0 0 3px rgba(124,236,255,.11), inset 0 0 18px rgba(63,167,224,.08) !important;
  }

  body.${BODY_CLASS} #attributeHint {
    display: none !important;
  }

  body.${BODY_CLASS} .filterGrid {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    min-width: 0 !important;
    gap: 5px !important;
    margin-top: 6px !important;
  }

  body.${BODY_CLASS} .typeRow,
  body.${BODY_CLASS} .attrRow,
  body.${BODY_CLASS} .ownedRow {
    display: flex !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    gap: 5px !important;
    margin: 0 !important;
    padding: 1px 0 4px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    border: 0 !important;
    scrollbar-width: none !important;
    -webkit-overflow-scrolling: touch !important;
  }

  body.${BODY_CLASS} .typeRow::-webkit-scrollbar,
  body.${BODY_CLASS} .attrRow::-webkit-scrollbar,
  body.${BODY_CLASS} .ownedRow::-webkit-scrollbar {
    display: none !important;
  }

  body.${BODY_CLASS} .filterBtn,
  body.${BODY_CLASS} .tab {
    flex: 0 0 auto !important;
    min-width: 0 !important;
    min-height: 31px !important;
    height: 31px !important;
    padding: 0 10px !important;
    border-radius: 999px !important;
    font-size: 11px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS} .filterBtn.active,
  body.${BODY_CLASS} .tab.active {
    border-color: rgba(156,255,159,.62) !important;
    background: linear-gradient(180deg,rgba(99,220,128,.24),rgba(44,112,72,.14)) !important;
    box-shadow: 0 0 15px rgba(98,236,131,.12) !important;
  }

  body.${BODY_CLASS} #cardList.list {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 260px !important;
    height: auto !important;
    max-height: 58dvh !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    padding: 2px 2px 12px !important;
    scroll-padding-top: 8px !important;
    overscroll-behavior: contain !important;
  }

  body.${BODY_CLASS} .${GROUP_CLASS} {
    --dmr-accent: rgba(124,236,255,.88);
    margin: 0 0 8px !important;
    overflow: hidden !important;
    border: 1px solid color-mix(in srgb, var(--dmr-accent) 34%, rgba(255,255,255,.08)) !important;
    border-radius: 14px !important;
    background: linear-gradient(180deg,color-mix(in srgb,var(--dmr-accent) 7%, rgba(15,20,26,.98)),rgba(8,12,16,.96)) !important;
  }

  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="火"] { --dmr-accent:#ff806e; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="水"] { --dmr-accent:#69b7ff; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="草"] { --dmr-accent:#78e39b; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="風"] { --dmr-accent:#8de3db; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="雷"] { --dmr-accent:#ffe36f; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="鋼"] { --dmr-accent:#b6c0cc; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="光"] { --dmr-accent:#fff1a6; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="闇"] { --dmr-accent:#b38aff; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="幻"] { --dmr-accent:#ef90ff; }
  body.${BODY_CLASS} .${GROUP_CLASS}[data-attr="呪"] { --dmr-accent:#d87dff; }

  body.${BODY_CLASS} .dmrGroupHead {
    width: 100% !important;
    min-height: 38px !important;
    display: grid !important;
    grid-template-columns: 28px minmax(0,1fr) auto !important;
    align-items: center !important;
    gap: 7px !important;
    padding: 6px 9px !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: linear-gradient(90deg,color-mix(in srgb,var(--dmr-accent) 18%, rgba(255,255,255,.02)),rgba(0,0,0,.10)) !important;
    color: #fff !important;
    text-align: left !important;
    box-shadow: inset 3px 0 0 var(--dmr-accent) !important;
  }

  body.${BODY_CLASS} .dmrGroupIcon {
    width: 26px !important;
    height: 26px !important;
    display: grid !important;
    place-items: center !important;
    border-radius: 999px !important;
    border: 1px solid color-mix(in srgb,var(--dmr-accent) 55%, rgba(255,255,255,.12)) !important;
    background: color-mix(in srgb,var(--dmr-accent) 15%, rgba(0,0,0,.22)) !important;
    color: var(--dmr-accent) !important;
    font-size: 11px !important;
    font-weight: 1000 !important;
  }

  body.${BODY_CLASS} .dmrGroupName {
    min-width: 0 !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
    font-size: 12.5px !important;
    font-weight: 1000 !important;
    letter-spacing: .04em !important;
  }

  body.${BODY_CLASS} .dmrGroupCount {
    color: rgba(255,255,255,.65) !important;
    font-size: 10px !important;
    font-weight: 900 !important;
  }

  body.${BODY_CLASS} .${GROUP_BODY_CLASS} {
    display: grid !important;
    grid-template-columns: minmax(0,1fr) !important;
    gap: 7px !important;
    padding: 7px !important;
  }

  body.${BODY_CLASS} .${GROUP_BODY_CLASS}[hidden] {
    display: none !important;
  }

  body.${BODY_CLASS} .${GROUP_CLASS}.isCollapsed .dmrGroupHead {
    opacity: .78 !important;
  }

  body.${BODY_CLASS} #cardList .cardRow,
  body.${BODY_CLASS} #deckList .cardRow {
    --dmr-row-accent: rgba(124,236,255,.7);
    position: relative !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    min-height: 88px !important;
    height: auto !important;
    display: grid !important;
    grid-template-columns: minmax(0,1fr) 108px !important;
    gap: 7px !important;
    align-items: center !important;
    padding: 8px !important;
    overflow: hidden !important;
    border: 1px solid rgba(255,255,255,.10) !important;
    border-left: 3px solid var(--dmr-row-accent) !important;
    border-radius: 12px !important;
    background:
      linear-gradient(90deg,color-mix(in srgb,var(--dmr-row-accent) 7%, rgba(255,255,255,.035)),rgba(255,255,255,.018)) !important;
    box-shadow: 0 7px 18px rgba(0,0,0,.17), inset 0 1px 0 rgba(255,255,255,.025) !important;
  }

  body.${BODY_CLASS} #cardList .cardRow[data-type="火"], body.${BODY_CLASS} #deckList .cardRow[data-type="火"] { --dmr-row-accent:#ff806e; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="水"], body.${BODY_CLASS} #deckList .cardRow[data-type="水"] { --dmr-row-accent:#69b7ff; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="草"], body.${BODY_CLASS} #deckList .cardRow[data-type="草"] { --dmr-row-accent:#78e39b; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="風"], body.${BODY_CLASS} #deckList .cardRow[data-type="風"] { --dmr-row-accent:#8de3db; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="雷"], body.${BODY_CLASS} #deckList .cardRow[data-type="雷"] { --dmr-row-accent:#ffe36f; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="鋼"], body.${BODY_CLASS} #deckList .cardRow[data-type="鋼"] { --dmr-row-accent:#b6c0cc; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="光"], body.${BODY_CLASS} #deckList .cardRow[data-type="光"] { --dmr-row-accent:#fff1a6; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="闇"], body.${BODY_CLASS} #deckList .cardRow[data-type="闇"] { --dmr-row-accent:#b38aff; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="幻"], body.${BODY_CLASS} #deckList .cardRow[data-type="幻"] { --dmr-row-accent:#ef90ff; }
  body.${BODY_CLASS} #cardList .cardRow[data-type="呪"], body.${BODY_CLASS} #deckList .cardRow[data-type="呪"] { --dmr-row-accent:#d87dff; }

  body.${BODY_CLASS} #cardList .cardRow > div:first-child,
  body.${BODY_CLASS} #deckList .cardRow > div:first-child,
  body.${BODY_CLASS} #cardList .cardRow .cardMain,
  body.${BODY_CLASS} #deckList .cardRow .cardMain {
    min-width: 0 !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} #cardList .cardRow .name,
  body.${BODY_CLASS} #deckList .cardRow .name,
  body.${BODY_CLASS} #cardList .cardRow .cardName,
  body.${BODY_CLASS} #deckList .cardRow .cardName {
    font-size: 13px !important;
    line-height: 1.3 !important;
    white-space: normal !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} #cardList .cardRow .sub,
  body.${BODY_CLASS} #deckList .cardRow .sub,
  body.${BODY_CLASS} #cardList .cardRow .cardMeta,
  body.${BODY_CLASS} #deckList .cardRow .cardMeta {
    margin-top: 4px !important;
    font-size: 10.5px !important;
    line-height: 1.4 !important;
    white-space: normal !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 3 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} #cardList .cardRow .btns,
  body.${BODY_CLASS} #cardList .cardRow .cardCtrl {
    display: grid !important;
    grid-template-columns: 31px minmax(38px,1fr) 31px !important;
    grid-template-areas: "minus count plus" "detail detail detail" "admin admin admin" !important;
    grid-auto-rows: 29px !important;
    align-content: center !important;
    gap: 4px !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  body.${BODY_CLASS} #deckList .cardRow .btns,
  body.${BODY_CLASS} #deckList .cardRow .cardCtrl {
    display: grid !important;
    grid-template-columns: 36px minmax(38px,1fr) 36px !important;
    grid-template-areas: "minus count plus" "detail detail detail" "ex ex ex" !important;
    grid-auto-rows: 30px !important;
    gap: 4px !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  body.${BODY_CLASS} #cardList .cardRow [data-minus], body.${BODY_CLASS} #deckList .cardRow [data-minus] { grid-area: minus !important; }
  body.${BODY_CLASS} #cardList .cardRow [data-plus], body.${BODY_CLASS} #deckList .cardRow [data-plus] { grid-area: plus !important; }
  body.${BODY_CLASS} #cardList .cardRow .count, body.${BODY_CLASS} #deckList .cardRow .count,
  body.${BODY_CLASS} #cardList .cardRow .cnt, body.${BODY_CLASS} #deckList .cardRow .cnt { grid-area: count !important; }
  body.${BODY_CLASS} #cardList .cardRow [data-detail], body.${BODY_CLASS} #deckList .cardRow [data-detail] { grid-area: detail !important; }
  body.${BODY_CLASS} #cardList .cardRow [data-ex], body.${BODY_CLASS} #deckList .cardRow [data-ex],
  body.${BODY_CLASS} #cardList .cardRow [data-expick], body.${BODY_CLASS} #deckList .cardRow [data-expick] { grid-area: ex !important; }
  body.${BODY_CLASS} #cardList .cardRow .adminHideToggle { grid-area: admin !important; }

  body.${BODY_CLASS} #cardList .cardRow .btns button,
  body.${BODY_CLASS} #deckList .cardRow .btns button,
  body.${BODY_CLASS} #cardList .cardRow .count,
  body.${BODY_CLASS} #deckList .cardRow .count,
  body.${BODY_CLASS} #cardList .cardRow .cnt,
  body.${BODY_CLASS} #deckList .cardRow .cnt {
    width: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    min-height: 29px !important;
    height: 29px !important;
    padding: 0 5px !important;
    border-radius: 9px !important;
    font-size: 10.5px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} #deckPanelActions {
    order: 0 !important;
    display: grid !important;
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    gap: 6px !important;
    width: 100% !important;
    overflow: visible !important;
    margin: 0 !important;
  }

  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action] {
    min-width: 0 !important;
    width: 100% !important;
    min-height: 35px !important;
    height: 35px !important;
    padding: 0 7px !important;
    border-radius: 11px !important;
    font-size: 11px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action="save"],
  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action="library"] {
    border-color: rgba(124,236,255,.28) !important;
    background: linear-gradient(180deg,rgba(62,164,213,.18),rgba(20,72,99,.13)) !important;
  }

  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action="play"] {
    border-color: rgba(156,255,159,.38) !important;
    background: linear-gradient(180deg,rgba(93,214,122,.21),rgba(34,103,63,.15)) !important;
  }

  body.${BODY_CLASS} .deckSaveDock,
  body.${BODY_CLASS} .deckInfoDock {
    width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
    border-radius: 13px !important;
  }

  body.${BODY_CLASS} .deckSaveRow {
    display: grid !important;
    grid-template-columns: minmax(0,1fr) minmax(92px,auto) !important;
    gap: 6px !important;
    padding: 8px !important;
  }

  body.${BODY_CLASS} .deckSaveRow #deckTitle,
  body.${BODY_CLASS} .deckSaveRow #btnSave {
    min-width: 0 !important;
    min-height: 36px !important;
    height: 36px !important;
  }

  body.${BODY_CLASS} #deckList.list {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 190px !important;
    height: auto !important;
    max-height: 48dvh !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 7px !important;
    padding: 2px 2px 10px !important;
    overscroll-behavior: contain !important;
  }

  body.${BODY_CLASS} #detailWrap {
    left: 8px !important;
    right: 8px !important;
    bottom: calc(72px + env(safe-area-inset-bottom,0px)) !important;
    width: auto !important;
    max-width: none !important;
    max-height: 68dvh !important;
    border-radius: 16px !important;
  }

  body.${BODY_CLASS} #roomDrawer {
    width: min(100vw, 520px) !important;
  }

  body.${BODY_CLASS} #roomDrawerToggle {
    right: 10px !important;
    bottom: calc(10px + env(safe-area-inset-bottom,0px)) !important;
    min-height: 40px !important;
    border-radius: 999px !important;
  }

  @media (min-width: 560px) {
    body.${BODY_CLASS} .${GROUP_BODY_CLASS} {
      grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    }
  }

  @media (max-width: 380px) {
    body.${BODY_CLASS} header #btnHome,
    body.${BODY_CLASS} header #btnSettings {
      min-width: 64px !important;
      padding-inline: 8px !important;
      font-size: 10.5px !important;
    }

    body.${BODY_CLASS} #cardList .cardRow,
    body.${BODY_CLASS} #deckList .cardRow {
      grid-template-columns: minmax(0,1fr) 100px !important;
      padding: 7px !important;
    }
  }
}
`;
    document.head.appendChild(style);
  }

  function loadGroupState() {
    try {
      const raw = localStorage.getItem(GROUP_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveGroupState(state) {
    try {
      localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(state || {}));
    } catch {}
  }

  function attrOfRow(row) {
    const raw = String(row?.dataset?.type || "").trim();
    return raw || "その他";
  }

  function attrIcon(attr) {
    return ({ 火:"火", 水:"水", 草:"草", 風:"風", 雷:"雷", 鋼:"鋼", 光:"光", 闇:"闇", 幻:"幻", 呪:"呪" })[attr] || "・";
  }

  function groupSort(a, b) {
    const ai = ATTR_ORDER.indexOf(a);
    const bi = ATTR_ORDER.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.localeCompare(b, "ja");
  }

  function arrowizeString(value) {
    return String(value || "")
      .replace(/\bfront(\d+)\b/gi, "↑$1")
      .replace(/\bf(\d+)\b/gi, "↑$1")
      .replace(/\bback(\d+)\b/gi, "↓$1")
      .replace(/\brf(\d+)\b/gi, "↗$1")
      .replace(/\blf(\d+)\b/gi, "↖$1")
      .replace(/\bside(\d+)\b/gi, "↔$1")
      .replace(/\badj(\d+)\b/gi, "◇$1")
      .replace(/\bright(\d+)\b/gi, "→$1")
      .replace(/\bleft(\d+)\b/gi, "←$1")
      .replace(/\bup(\d+)\b/gi, "↑$1")
      .replace(/\bdown(\d+)\b/gi, "↓$1");
  }

  function arrowizeRow(row) {
    row?.querySelectorAll?.(".sub,.cardMeta,.deckQuickAction,.deckDetailAction").forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const before = node.nodeValue || "";
        const after = arrowizeString(before);
        if (after !== before) node.nodeValue = after;
      });
    });
  }

  function rememberOriginal(el, key) {
    if (!el || el.dataset[key] !== undefined) return;
    el.dataset[key] = el.textContent || "";
  }

  function normalizeHeader() {
    const header = document.querySelector("header");
    if (!header) return;
    const home = document.getElementById("btnHome");
    const settings = document.getElementById("btnSettings");
    const deckTop = document.getElementById("btnDeckTop");

    if (home) {
      rememberOriginal(home, "dmrOriginalText");
      home.hidden = false;
      home.textContent = "ホームへ";
      home.setAttribute("aria-label", "ホームへ戻る");
    }
    if (settings) {
      rememberOriginal(settings, "dmrOriginalText");
      settings.hidden = false;
      settings.textContent = "設定";
      settings.setAttribute("aria-label", "設定を開く");
    }
    if (deckTop) deckTop.hidden = true;
  }

  function normalizeFilters() {
    const search = document.getElementById("search");
    if (search) {
      search.type = "search";
      search.placeholder = "カード名 / ID / シリーズで検索";
      search.setAttribute("autocomplete", "off");
      search.setAttribute("inputmode", "search");
    }
  }

  function normalizeActions() {
    const actions = document.getElementById("deckPanelActions");
    if (!actions) return;
    const labels = {
      save: "保存",
      library: "自分のデッキ",
      lab: "評価",
      play: "対戦へ",
    };
    Object.entries(labels).forEach(([key, label]) => {
      const btn = actions.querySelector(`[data-deck-panel-action="${key}"]`);
      if (!btn) return;
      rememberOriginal(btn, "dmrOriginalText");
      btn.textContent = label;
    });
  }

  function restoreLabels() {
    document.querySelectorAll("[data-dmr-original-text]").forEach((el) => {
      el.textContent = el.dataset.dmrOriginalText || el.textContent;
      delete el.dataset.dmrOriginalText;
    });
    const deckTop = document.getElementById("btnDeckTop");
    if (deckTop) deckTop.hidden = false;
  }

  function ungroupRows() {
    const list = document.getElementById("cardList");
    if (!list) return;
    const groups = Array.from(list.querySelectorAll(`:scope > .${GROUP_CLASS}`));
    if (!groups.length) return;
    const rows = Array.from(list.querySelectorAll(".cardRow"));
    const frag = document.createDocumentFragment();
    rows.forEach((row) => frag.appendChild(row));
    groups.forEach((group) => group.remove());
    list.appendChild(frag);
    delete list.dataset.dmrSignature;
  }

  function groupRows() {
    const list = document.getElementById("cardList");
    if (!list) return;
    const rows = Array.from(list.querySelectorAll(".cardRow"));
    if (!rows.length) {
      delete list.dataset.dmrSignature;
      return;
    }

    rows.forEach(arrowizeRow);
    const signature = rows.map((row) => `${row.dataset.cardId || ""}:${attrOfRow(row)}`).join("|");
    const hasGroups = !!list.querySelector(`:scope > .${GROUP_CLASS}`);
    if (hasGroups && list.dataset.dmrSignature === signature) return;

    const state = loadGroupState();
    const byAttr = new Map();
    rows.forEach((row) => {
      const attr = attrOfRow(row);
      if (!byAttr.has(attr)) byAttr.set(attr, []);
      byAttr.get(attr).push(row);
    });

    rows.forEach((row) => row.remove());
    list.querySelectorAll(`:scope > .${GROUP_CLASS}`).forEach((el) => el.remove());

    Array.from(byAttr.keys()).sort(groupSort).forEach((attr) => {
      const section = document.createElement("section");
      section.className = GROUP_CLASS;
      section.dataset.attr = attr;

      const head = document.createElement("button");
      head.type = "button";
      head.className = "dmrGroupHead";
      head.innerHTML = `<span class="dmrGroupIcon">${attrIcon(attr)}</span><span class="dmrGroupName">${attr}</span><span class="dmrGroupCount">${byAttr.get(attr).length}枚</span>`;

      const body = document.createElement("div");
      body.className = GROUP_BODY_CLASS;
      byAttr.get(attr).forEach((row) => body.appendChild(row));

      const collapsed = state[attr] === true;
      section.classList.toggle("isCollapsed", collapsed);
      body.hidden = collapsed;
      head.setAttribute("aria-expanded", collapsed ? "false" : "true");
      head.addEventListener("click", () => {
        const next = !section.classList.contains("isCollapsed");
        section.classList.toggle("isCollapsed", next);
        body.hidden = next;
        head.setAttribute("aria-expanded", next ? "false" : "true");
        const nextState = loadGroupState();
        nextState[attr] = next;
        saveGroupState(nextState);
      });

      section.append(head, body);
      list.appendChild(section);
    });

    list.dataset.dmrSignature = signature;
  }

  function apply() {
    if (!document.body || !isDeckBuilder()) return;
    const mobile = isMobileLike();
    document.documentElement.dataset.deckMobileRefined = mobile ? VERSION : "desktop";

    if (!mobile) {
      document.body.classList.remove(BODY_CLASS);
      if (busy) return;
      busy = true;
      try {
        ungroupRows();
        restoreLabels();
      } finally {
        busy = false;
      }
      return;
    }

    injectStyle();
    document.body.classList.add(BODY_CLASS);
    if (busy) return;
    busy = true;
    try {
      normalizeHeader();
      normalizeFilters();
      normalizeActions();
      groupRows();
      document.querySelectorAll("#deckList .cardRow").forEach(arrowizeRow);
    } finally {
      busy = false;
    }
  }

  function schedule(delay = 0) {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(apply, delay);
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      if (busy) return;
      const relevant = mutations.some((m) => {
        const target = m.target instanceof Element ? m.target : m.target?.parentElement;
        return target?.closest?.("#cardList,#deckList,#deckPanel,header") || target?.id === "cardList" || target?.id === "deckList";
      });
      if (relevant) schedule(40);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (!isDeckBuilder()) return;
  apply();
  startObserver();
  window.addEventListener("resize", () => schedule(80), { passive: true });
  window.addEventListener("orientationchange", () => schedule(120), { passive: true });
  window.addEventListener("pageshow", () => schedule(40));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule(40);
  });
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("#cardList,#deckList,#deckPanelActions,.filterBox,header")) schedule(60);
  }, true);
  console.log("[deck_mobile_refine] ready", VERSION);
})();
