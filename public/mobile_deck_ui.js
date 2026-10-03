// Mobile-only deck builder layout layer.
// Keep desktop untouched; make phones readable and tappable.
(() => {
  "use strict";

  const VERSION = "20260906_curse_nav1";
  const STYLE_ID = "mobileDeckUiStyle";
  const NAV_ID = "mobileDeckNav";

  const ja = {
    navLabel: "\u30b9\u30de\u30db\u7528\u30c7\u30c3\u30ad\u64cd\u4f5c",
    cards: "\u5019\u88dc",
    deck: "\u63a1\u7528",
    save: "\u4fdd\u5b58",
    top: "\u4e0a\u3078",
  };

  function isDeckBuilder() {
    return Boolean(document.getElementById("cardList") && document.getElementById("deckPanel"));
  }

  function installStyle() {
    if (!isDeckBuilder()) return;
    document.body.classList.add("mobileDeckUi");
    document.documentElement.dataset.mobileDeckUi = VERSION;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
body.mobileDeckUi #mobileDeckNav{display:none !important}

@media (max-width: 900px) {
  html[data-mobile-deck-ui],
  body.mobileDeckUi {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  body.mobileDeckUi {
    --mdu-bg: rgba(8,13,17,.94);
    --mdu-panel: rgba(13,19,25,.94);
    --mdu-line: rgba(255,255,255,.12);
    --mdu-cyan: #70eaff;
    --mdu-green: #8dff9b;
    --mdu-gray: #aeb4bc;
    padding-bottom: calc(86px + env(safe-area-inset-bottom,0px)) !important;
    background:
      radial-gradient(520px 340px at 20% 0%, rgba(112,234,255,.12), transparent 62%),
      radial-gradient(520px 360px at 92% 24%, rgba(141,255,155,.10), transparent 64%),
      #06090c !important;
  }

  body.mobileDeckUi header {
    position: sticky !important;
    top: 0 !important;
    z-index: 5000 !important;
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 7px !important;
    min-height: 0 !important;
    padding: 8px !important;
    background: linear-gradient(180deg, rgba(9,16,21,.97), rgba(8,12,16,.88)) !important;
    border-bottom: 1px solid rgba(112,234,255,.18) !important;
    backdrop-filter: blur(14px) !important;
  }

  body.mobileDeckUi header .left,
  body.mobileDeckUi header .topRight {
    display: flex !important;
    width: 100% !important;
    min-width: 0 !important;
    gap: 4px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    flex-wrap: nowrap !important;
    scrollbar-width: none !important;
  }

  body.mobileDeckUi header .topRight {
    justify-content: flex-end !important;
  }

  body.mobileDeckUi header .topRight > :not(#btnHome):not(#btnDeckTop):not(#deviceModeBadge) {
    display: none !important;
  }

  body.mobileDeckUi header .left::-webkit-scrollbar,
  body.mobileDeckUi header .topRight::-webkit-scrollbar,
  body.mobileDeckUi #mobileDeckNav::-webkit-scrollbar,
  body.mobileDeckUi .filterBox::-webkit-scrollbar {
    display: none !important;
  }

  body.mobileDeckUi header h1 {
    flex: 0 0 auto !important;
    font-size: 16px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi header button,
  body.mobileDeckUi header .pill,
  body.mobileDeckUi header .meta {
    flex: 0 0 auto !important;
    min-height: 27px !important;
    padding: 4px 8px !important;
    border-radius: 999px !important;
    font-size: 11px !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi header #versionLabel {
    max-width: 148px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi header #btnHome,
  body.mobileDeckUi header #btnDeckTop {
    max-width: 108px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi #mobileDeckNav {
    position: sticky !important;
    top: 70px !important;
    z-index: 4200 !important;
    display: none !important;
    gap: 6px !important;
    overflow-x: auto !important;
    padding: 7px 8px !important;
    margin: 0 !important;
    background: linear-gradient(180deg, rgba(7,13,17,.94), rgba(7,11,15,.78)) !important;
    border-bottom: 1px solid rgba(255,255,255,.08) !important;
    backdrop-filter: blur(14px) !important;
  }

  body.mobileDeckUi #mobileDeckNav button {
    flex: 1 0 76px !important;
    min-height: 34px !important;
    padding: 6px 8px !important;
    border-radius: 999px !important;
    border: 1px solid rgba(112,234,255,.24) !important;
    background: linear-gradient(180deg, rgba(112,234,255,.14), rgba(0,0,0,.18)) !important;
    color: #fff !important;
    font-size: 12px !important;
    font-weight: 900 !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi #mobileDeckNav button.isActive {
    border-color: rgba(141,255,155,.72) !important;
    box-shadow: 0 0 18px rgba(141,255,155,.22), inset 0 0 18px rgba(141,255,155,.08) !important;
  }

  body.mobileDeckUi .wrap {
    display: grid !important;
    grid-template-columns: 1fr !important;
    grid-template-rows: auto auto !important;
    gap: 9px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    min-height: auto !important;
    height: auto !important;
    padding: 8px !important;
    zoom: 1 !important;
    transform: none !important;
  }

  body.mobileDeckUi .wrap::before,
  body.mobileDeckUi .tcg-route-strip,
  body.mobileDeckUi .journeyStrip,
  body.mobileDeckUi #journeyFab,
  body.mobileDeckUi #journeyPanel {
    display: none !important;
  }

  body.mobileDeckUi .libraryPanel,
  body.mobileDeckUi #deckMainPanel,
  body.mobileDeckUi #deckPanel {
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
    overflow: hidden !important;
    border-radius: 16px !important;
    background:
      radial-gradient(420px 160px at 12% -10%, rgba(112,234,255,.10), transparent 66%),
      linear-gradient(180deg, rgba(255,255,255,.048), rgba(255,255,255,.018)),
      var(--mdu-panel) !important;
  }

  body.mobileDeckUi .libraryPanel,
  body.mobileDeckUi #deckMainPanel { order: 1 !important; }
  body.mobileDeckUi #deckPanel { order: 2 !important; display: block !important; }

  body.mobileDeckUi .panel .hd,
  body.mobileDeckUi #deckPanel > .hd {
    min-height: 42px !important;
    padding: 9px 10px !important;
  }

  body.mobileDeckUi .panel .hd b,
  body.mobileDeckUi #deckPanel > .hd b {
    font-size: 14px !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi .panel .hd .small {
    max-width: 58vw !important;
    font-size: 10px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi .panel .bd,
  body.mobileDeckUi #deckPanel > .bd,
  body.mobileDeckUi .workspace {
    display: block !important;
    min-height: 0 !important;
    height: auto !important;
    padding: 8px !important;
    overflow: visible !important;
  }

  body.mobileDeckUi .filterBox {
    position: sticky !important;
    top: 116px !important;
    z-index: 2500 !important;
    margin: 0 0 8px !important;
    padding: 7px !important;
    border-radius: 14px !important;
    overflow-x: auto !important;
    background: rgba(7,12,16,.94) !important;
    border: 1px solid rgba(112,234,255,.14) !important;
    backdrop-filter: blur(12px) !important;
  }

  body.mobileDeckUi .filterGrid {
    display: block !important;
    min-width: max-content !important;
  }

  body.mobileDeckUi .sectionHead {
    display: grid !important;
    grid-template-columns: minmax(160px, 1fr) auto !important;
    gap: 7px !important;
    margin-bottom: 7px !important;
  }

  body.mobileDeckUi .sectionHead .input,
  body.mobileDeckUi #search {
    min-height: 34px !important;
    padding: 7px 10px !important;
    border-radius: 12px !important;
    font-size: 12px !important;
  }

  body.mobileDeckUi .typeRow,
  body.mobileDeckUi .attrRow,
  body.mobileDeckUi .ownedRow {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 5px !important;
    min-width: max-content !important;
    overflow: visible !important;
    margin: 6px 0 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }

  body.mobileDeckUi .filterBtn,
  body.mobileDeckUi .tab {
    flex: 0 0 auto !important;
    min-height: 29px !important;
    min-width: 0 !important;
    padding: 5px 9px !important;
    border-radius: 999px !important;
    font-size: 11px !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi #cardList.list {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 8px !important;
    max-height: 43svh !important;
    min-height: 210px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 2px 2px 8px !important;
    scroll-padding-top: 128px !important;
  }

  body.mobileDeckUi #cardList .cardRow {
    min-height: 96px !important;
    height: auto !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(112px, 36vw) !important;
    grid-template-areas: "main ctrl" !important;
    gap: 8px !important;
    padding: 9px 8px !important;
    border-radius: 13px !important;
  }

  body.mobileDeckUi #cardList .cardRow > div:first-child,
  body.mobileDeckUi #cardList .cardMain {
    grid-area: main !important;
    min-width: 0 !important;
  }

  body.mobileDeckUi #cardList .cardRow .name,
  body.mobileDeckUi #cardList .cardRow .cardName,
  body.mobileDeckUi #cardList .cardRow b {
    font-size: 13px !important;
    line-height: 1.22 !important;
    white-space: normal !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  body.mobileDeckUi #cardList .cardRow .sub,
  body.mobileDeckUi #cardList .cardRow .cardMeta {
    margin-top: 5px !important;
    font-size: 11px !important;
    line-height: 1.36 !important;
    white-space: normal !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 3 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  body.mobileDeckUi #cardList .cardRow .badge,
  body.mobileDeckUi #cardList .cardRow .pill,
  body.mobileDeckUi #deckList .cardRow .badge,
  body.mobileDeckUi #deckList .cardRow .pill {
    min-height: 20px !important;
    padding: 2px 6px !important;
    font-size: 10px !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns,
  body.mobileDeckUi #cardList .cardRow .cardCtrl {
    grid-area: ctrl !important;
    display: grid !important;
    grid-template-columns: 34px minmax(42px, 1fr) 34px !important;
    grid-template-areas:
      "minus count plus"
      "detail detail detail"
      "admin admin admin" !important;
    grid-auto-rows: 28px !important;
    gap: 4px !important;
    align-self: stretch !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns button,
  body.mobileDeckUi #cardList .cardRow .btns .count,
  body.mobileDeckUi #cardList .cardRow .btns .cnt,
  body.mobileDeckUi #cardList .cardRow .cardCtrl button,
  body.mobileDeckUi #cardList .cardRow .cardCtrl .countBox {
    width: auto !important;
    min-width: 0 !important;
    min-height: 28px !important;
    height: 28px !important;
    padding: 0 !important;
    border-radius: 9px !important;
    font-size: 11px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-detail],
  body.mobileDeckUi #cardList .cardRow .detailBtn {
    grid-area: detail !important;
    width: 100% !important;
    font-size: 0 !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-minus] { grid-area: minus !important; }
  body.mobileDeckUi #cardList .cardRow [data-plus] { grid-area: plus !important; }
  body.mobileDeckUi #cardList .cardRow .count,
  body.mobileDeckUi #cardList .cardRow .cnt,
  body.mobileDeckUi #cardList .cardRow .countBox { grid-area: count !important; }
  body.mobileDeckUi #cardList .cardRow .adminHideToggle { grid-area: admin !important; width: 100% !important; }

  body.mobileDeckUi #cardList .cardRow[data-kind="support"],
  body.mobileDeckUi #cardList .cardRow[data-kind="ex_support"] {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--row-attr, var(--mdu-gray)) 7%, transparent), rgba(255,255,255,.012)),
      linear-gradient(90deg, rgba(174,180,188,.15), rgba(174,180,188,.04) 58%, transparent),
      rgba(0,0,0,.24) !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-detail]::before,
  body.mobileDeckUi #cardList .cardRow .detailBtn::before {
    content: "\\8A73" !important;
    font-size: 12px !important;
  }

  body.mobileDeckUi #deckPanelActions,
  body.mobileDeckUi .deckPanelActions {
    position: relative !important;
    top: auto !important;
    z-index: 10 !important;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 7px !important;
    margin: -2px 0 7px !important;
    padding: 6px !important;
    border: 1px solid rgba(141,255,155,.13) !important;
    border-radius: 14px !important;
    background: rgba(7,13,16,.94) !important;
    backdrop-filter: blur(12px) !important;
  }

  body.mobileDeckUi #deckPanelActions button,
  body.mobileDeckUi .deckPanelActions button {
    min-width: 0 !important;
    min-height: 36px !important;
    padding: 6px 8px !important;
    border-radius: 999px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi .deckSaveDock,
  body.mobileDeckUi .deckInfoDock {
    margin: 0 0 8px !important;
    border-radius: 14px !important;
    overflow: hidden !important;
  }

  body.mobileDeckUi .deckSaveDockHead,
  body.mobileDeckUi .deckInfoDockHead,
  body.mobileDeckUi .listHead {
    min-height: 38px !important;
    padding: 8px !important;
  }

  body.mobileDeckUi .deckSaveDockHeadMain b,
  body.mobileDeckUi .deckInfoDockHeadMain b,
  body.mobileDeckUi .listHead b {
    font-size: 13px !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi .deckSaveDockHeadMain span,
  body.mobileDeckUi .deckInfoDockHeadMain span,
  body.mobileDeckUi .listHead .small {
    max-width: 62vw !important;
    font-size: 10px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi .deckSaveDock:not(.isCollapsed) .deckSaveRow {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 7px !important;
    padding: 8px !important;
  }

  body.mobileDeckUi .sectionMinBtn,
  body.mobileDeckUi #deckSaveMinBtn,
  body.mobileDeckUi #deckInfoMinBtn {
    width: 34px !important;
    min-width: 34px !important;
    min-height: 32px !important;
    padding: 0 !important;
    border-radius: 999px !important;
  }

  body.mobileDeckUi .deckInfoBody {
    display: block !important;
    padding: 7px !important;
    min-height: 0 !important;
  }

  body.mobileDeckUi #deckList.list {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    max-height: 56svh !important;
    min-height: 230px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 2px 2px 90px !important;
  }

  body.mobileDeckUi #deckList .cardRow {
    min-height: 102px !important;
    height: auto !important;
    position: relative !important;
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
    padding: 9px 8px !important;
    border-radius: 12px !important;
  }

  body.mobileDeckUi #deckList .cardRow > div:first-child,
  body.mobileDeckUi #deckList .cardRow .cardMain {
    position: relative !important;
    z-index: 1 !important;
    min-width: 0 !important;
  }

  body.mobileDeckUi #deckList .cardRow[data-kind="support"],
  body.mobileDeckUi #deckList .cardRow[data-kind="ex_support"] {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--row-attr, var(--mdu-gray)) 7%, transparent), rgba(255,255,255,.012)),
      linear-gradient(90deg, rgba(174,180,188,.15), rgba(174,180,188,.04) 58%, transparent),
      rgba(0,0,0,.24) !important;
  }

  body.mobileDeckUi #deckList .cardRow .name,
  body.mobileDeckUi #deckList .cardRow .cardName,
  body.mobileDeckUi #deckList .cardRow b {
    font-size: 12.5px !important;
    line-height: 1.22 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi #deckList .cardRow .sub,
  body.mobileDeckUi #deckList .cardRow .cardMeta {
    margin-top: 3px !important;
    font-size: 10.5px !important;
    line-height: 1.32 !important;
    white-space: normal !important;
    overflow: hidden !important;
    text-overflow: clip !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
  }

  body.mobileDeckUi #deckList .cardRow .btns,
  body.mobileDeckUi #deckList .cardRow .cardCtrl {
    position: relative !important;
    z-index: 200 !important;
    isolation: isolate !important;
    display: grid !important;
    grid-template-columns: 64px 42px minmax(64px, 1fr) 42px !important;
    grid-template-areas:
      "detail plus count minus"
      "ex ex ex ex" !important;
    gap: 5px !important;
    width: 100% !important;
    min-width: 0 !important;
    align-items: center !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  body.mobileDeckUi #deckList .cardRow [data-detail],
  body.mobileDeckUi #deckList .cardRow .detailBtn {
    grid-area: detail !important;
    font-size: 12px !important;
    font-weight: 900 !important;
  }

  body.mobileDeckUi #deckList .cardRow [data-plus] { grid-area: plus !important; }
  body.mobileDeckUi #deckList .cardRow [data-minus] { grid-area: minus !important; }
  body.mobileDeckUi #deckList .cardRow .count,
  body.mobileDeckUi #deckList .cardRow .cnt,
  body.mobileDeckUi #deckList .cardRow .countBox { grid-area: count !important; }
  body.mobileDeckUi #deckList .cardRow [data-ex],
  body.mobileDeckUi #deckList .cardRow [data-expick] { grid-area: ex !important; }

  body.mobileDeckUi #deckList .cardRow .btns button,
  body.mobileDeckUi #deckList .cardRow .btns .count,
  body.mobileDeckUi #deckList .cardRow .btns .cnt,
  body.mobileDeckUi #deckList .cardRow .cardCtrl button,
  body.mobileDeckUi #deckList .cardRow .cardCtrl .countBox {
    position: relative !important;
    z-index: 210 !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
    min-width: 0 !important;
    min-height: 34px !important;
    height: 34px !important;
    padding: 0 !important;
    border-radius: 10px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }

  body.mobileDeckUi #deckList .cardRow [data-ex],
  body.mobileDeckUi #deckList .cardRow [data-expick] {
    height: 24px !important;
    min-height: 24px !important;
    font-size: 10px !important;
  }

  body.mobileDeckUi #detailWrap {
    position: fixed !important;
    left: 8px !important;
    right: 8px !important;
    bottom: calc(76px + env(safe-area-inset-bottom,0px)) !important;
    width: auto !important;
    max-height: 58svh !important;
    z-index: 7200 !important;
    border-radius: 16px !important;
  }

  body.mobileDeckUi #detailWrap:not(.open) {
    display: none !important;
  }

  body.mobileDeckUi #roomDrawer {
    width: 100vw !important;
    max-width: 100vw !important;
  }

  body.mobileDeckUi #roomDrawerToggle {
    display: none !important;
    pointer-events: none !important;
  }

  body.mobileDeckUi #deckPanelActions [data-deck-panel-action="play"],
  body.mobileDeckUi .deckPanelActions [data-deck-panel-action="play"] {
    display: none !important;
    pointer-events: none !important;
  }

  body.mobileDeckUi #btnClearDeck {
    position: relative !important;
    inset: auto !important;
    z-index: 1 !important;
    min-height: 38px !important;
    padding: 6px 12px !important;
    border-radius: 999px !important;
    background: rgba(0,0,0,.58) !important;
  }

  body.mobileDeckUi .deckLab {
    max-height: 36svh !important;
    overflow: auto !important;
  }
}

@media (max-width: 420px) {
  body.mobileDeckUi #cardList.list {
    grid-template-columns: 1fr !important;
    max-height: 45svh !important;
  }

  body.mobileDeckUi #cardList .cardRow {
    grid-template-columns: minmax(0, 1fr) minmax(104px, 35vw) !important;
    min-height: 94px !important;
    padding: 8px 7px !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns,
  body.mobileDeckUi #cardList .cardRow .cardCtrl,
  body.mobileDeckUi #cardList .cardRow .btns button,
  body.mobileDeckUi #cardList .cardRow .btns .count,
  body.mobileDeckUi #cardList .cardRow .btns .cnt,
  body.mobileDeckUi #cardList .cardRow .cardCtrl button,
  body.mobileDeckUi #cardList .cardRow .cardCtrl .countBox {
    width: auto !important;
    min-width: 0 !important;
  }

  body.mobileDeckUi #deckList .cardRow {
    grid-template-columns: 1fr !important;
    min-height: 100px !important;
  }

  body.mobileDeckUi #deckList .cardRow .btns,
  body.mobileDeckUi #deckList .cardRow .cardCtrl {
    grid-template-columns: 60px 40px minmax(56px, 1fr) 40px !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  body.mobileDeckUi #deckList .cardRow [data-detail],
  body.mobileDeckUi #deckList .cardRow .detailBtn {
    font-size: 10px !important;
  }
}

/* Late readability pass: keep card text, detail, and +/- from fighting each other. */
@media (max-width: 1180px) {
  body.mobileDeckUi .wrap {
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  body.mobileDeckUi #deckPanel,
  body.mobileDeckUi #deckMainPanel,
  body.mobileDeckUi .libraryPanel {
    min-height: 0 !important;
    max-height: none !important;
  }
}

@media (max-width: 900px) {
  body.mobileDeckUi {
    --mdu-control-w: clamp(132px, 39vw, 164px);
    --mdu-row-pad: 8px;
  }

  body.mobileDeckUi header {
    overflow: hidden !important;
  }

  body.mobileDeckUi header .topRight,
  body.mobileDeckUi header .left {
    max-width: 100% !important;
  }

  body.mobileDeckUi #mobileDeckNav {
    display: none !important;
  }

  body.mobileDeckUi #mobileDeckNav button {
    flex: 1 0 68px !important;
    min-height: 32px !important;
    font-size: 12px !important;
  }

  body.mobileDeckUi #cardFilters,
  body.mobileDeckUi .filterBox {
    top: 101px !important;
    max-height: 182px !important;
    overflow: auto !important;
  }

  body.mobileDeckUi #cardList.list,
  body.mobileDeckUi #deckList.list {
    overscroll-behavior: contain !important;
    scroll-behavior: auto !important;
  }

  body.mobileDeckUi #cardList.list {
    max-height: 50svh !important;
    min-height: 240px !important;
  }

  body.mobileDeckUi #deckList.list {
    max-height: 62svh !important;
    min-height: 280px !important;
    padding-bottom: calc(88px + env(safe-area-inset-bottom,0px)) !important;
  }

  body.mobileDeckUi #cardList .cardRow,
  body.mobileDeckUi #deckList .cardRow {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) var(--mdu-control-w) !important;
    grid-template-areas: "main ctrl" !important;
    align-items: center !important;
    gap: 7px !important;
    min-height: 82px !important;
    max-height: none !important;
    padding: var(--mdu-row-pad) !important;
    overflow: hidden !important;
  }

  body.mobileDeckUi #cardList .cardRow > div:first-child,
  body.mobileDeckUi #deckList .cardRow > div:first-child,
  body.mobileDeckUi #cardList .cardMain,
  body.mobileDeckUi #deckList .cardMain {
    grid-area: main !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }

  body.mobileDeckUi #cardList .cardRow .name,
  body.mobileDeckUi #deckList .cardRow .name,
  body.mobileDeckUi #cardList .cardRow .cardName,
  body.mobileDeckUi #deckList .cardRow .cardName,
  body.mobileDeckUi #cardList .cardRow b,
  body.mobileDeckUi #deckList .cardRow b {
    display: block !important;
    min-width: 0 !important;
    max-width: 100% !important;
    font-size: 13px !important;
    line-height: 1.22 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi #cardList .cardRow .sub,
  body.mobileDeckUi #deckList .cardRow .sub,
  body.mobileDeckUi #cardList .cardRow .cardMeta,
  body.mobileDeckUi #deckList .cardRow .cardMeta {
    margin-top: 4px !important;
    font-size: 10.5px !important;
    line-height: 1.35 !important;
    display: -webkit-box !important;
    -webkit-box-orient: vertical !important;
    -webkit-line-clamp: 2 !important;
    max-height: 2.8em !important;
    overflow: hidden !important;
  }

  body.mobileDeckUi #deckList .cardRow .sub,
  body.mobileDeckUi #deckList .cardRow .cardMeta {
    -webkit-line-clamp: 1 !important;
    max-height: 1.45em !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns,
  body.mobileDeckUi #deckList .cardRow .btns,
  body.mobileDeckUi #cardList .cardRow .cardCtrl,
  body.mobileDeckUi #deckList .cardRow .cardCtrl {
    grid-area: ctrl !important;
    position: relative !important;
    z-index: 8 !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    display: grid !important;
    grid-template-columns: 40px minmax(44px, 1fr) 40px !important;
    grid-template-areas:
      "minus count plus"
      "detail detail detail"
      "ex ex ex" !important;
    gap: 5px !important;
    align-self: center !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-minus],
  body.mobileDeckUi #deckList .cardRow [data-minus] { grid-area: minus !important; }

  body.mobileDeckUi #cardList .cardRow [data-plus],
  body.mobileDeckUi #deckList .cardRow [data-plus] { grid-area: plus !important; }

  body.mobileDeckUi #cardList .cardRow .count,
  body.mobileDeckUi #deckList .cardRow .count,
  body.mobileDeckUi #cardList .cardRow .cnt,
  body.mobileDeckUi #deckList .cardRow .cnt,
  body.mobileDeckUi #cardList .cardRow .countBox,
  body.mobileDeckUi #deckList .cardRow .countBox {
    grid-area: count !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-detail],
  body.mobileDeckUi #deckList .cardRow [data-detail],
  body.mobileDeckUi #cardList .cardRow .detailBtn,
  body.mobileDeckUi #deckList .cardRow .detailBtn {
    grid-area: detail !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-ex],
  body.mobileDeckUi #deckList .cardRow [data-ex],
  body.mobileDeckUi #cardList .cardRow [data-expick],
  body.mobileDeckUi #deckList .cardRow [data-expick],
  body.mobileDeckUi #cardList .cardRow .adminHideToggle,
  body.mobileDeckUi #deckList .cardRow .adminHideToggle {
    grid-area: ex !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns button,
  body.mobileDeckUi #deckList .cardRow .btns button,
  body.mobileDeckUi #cardList .cardRow .btns .count,
  body.mobileDeckUi #deckList .cardRow .btns .count,
  body.mobileDeckUi #cardList .cardRow .btns .cnt,
  body.mobileDeckUi #deckList .cardRow .btns .cnt,
  body.mobileDeckUi #cardList .cardRow .cardCtrl button,
  body.mobileDeckUi #deckList .cardRow .cardCtrl button,
  body.mobileDeckUi #cardList .cardRow .cardCtrl .countBox,
  body.mobileDeckUi #deckList .cardRow .cardCtrl .countBox {
    min-width: 0 !important;
    min-height: 32px !important;
    height: 32px !important;
    padding: 0 6px !important;
    border-radius: 10px !important;
    font-size: 12px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.mobileDeckUi #cardList .cardRow [data-detail],
  body.mobileDeckUi #deckList .cardRow [data-detail],
  body.mobileDeckUi #cardList .cardRow .detailBtn,
  body.mobileDeckUi #deckList .cardRow .detailBtn {
    font-size: 12px !important;
    font-weight: 950 !important;
  }

  body.mobileDeckUi #cardList .cardRow[data-kind="support"],
  body.mobileDeckUi #deckList .cardRow[data-kind="support"],
  body.mobileDeckUi #cardList .cardRow[data-kind="ex_support"],
  body.mobileDeckUi #deckList .cardRow[data-kind="ex_support"] {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--row-attr, #aeb4bc) 7%, transparent), rgba(255,255,255,.012)),
      linear-gradient(90deg, rgba(174,180,188,.16), rgba(174,180,188,.04) 58%, transparent),
      rgba(0,0,0,.24) !important;
  }

  body.mobileDeckUi #roomDrawerToggle,
  body.mobileDeckUi [data-deck-panel-action="play"],
  body.mobileDeckUi #cmdFab,
  body.mobileDeckUi .cmdFab {
    display: none !important;
    pointer-events: none !important;
  }
}

@media (max-width: 430px) {
  body.mobileDeckUi { --mdu-control-w: 138px; }

  body.mobileDeckUi header {
    padding: 6px 7px !important;
  }

  body.mobileDeckUi header h1 {
    font-size: 15px !important;
  }

  body.mobileDeckUi header button,
  body.mobileDeckUi header .pill,
  body.mobileDeckUi header .meta {
    min-height: 25px !important;
    padding: 3px 7px !important;
    font-size: 10px !important;
  }

  body.mobileDeckUi #cardList .cardRow,
  body.mobileDeckUi #deckList .cardRow {
    min-height: 78px !important;
    padding: 7px !important;
    gap: 6px !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns,
  body.mobileDeckUi #deckList .cardRow .btns,
  body.mobileDeckUi #cardList .cardRow .cardCtrl,
  body.mobileDeckUi #deckList .cardRow .cardCtrl {
    grid-template-columns: 36px minmax(42px, 1fr) 36px !important;
    gap: 4px !important;
  }

  body.mobileDeckUi #cardList .cardRow .btns button,
  body.mobileDeckUi #deckList .cardRow .btns button,
  body.mobileDeckUi #cardList .cardRow .btns .count,
  body.mobileDeckUi #deckList .cardRow .btns .count,
  body.mobileDeckUi #cardList .cardRow .btns .cnt,
  body.mobileDeckUi #deckList .cardRow .btns .cnt {
    height: 30px !important;
    min-height: 30px !important;
    font-size: 11px !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function ensureNav() {
    if (!isDeckBuilder() || document.getElementById(NAV_ID)) return;
    const wrap = document.querySelector(".wrap");
    if (!wrap) return;
    const nav = document.createElement("nav");
    nav.id = NAV_ID;
    nav.setAttribute("aria-label", ja.navLabel);
    nav.innerHTML = `
      <button type="button" data-mobile-jump="cards">${ja.cards}</button>
      <button type="button" data-mobile-jump="deck">${ja.deck}</button>
      <button type="button" data-mobile-jump="save">${ja.save}</button>
      <button type="button" data-mobile-jump="top">${ja.top}</button>
    `;
    wrap.parentElement?.insertBefore(nav, wrap);

    const expandDock = (id) => {
      const dock = document.getElementById(id);
      dock?.classList.remove("isCollapsed");
      return dock;
    };
    const scrollTo = (target) => {
      target?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    };

    nav.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-mobile-jump]");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      nav.querySelectorAll("[data-mobile-jump]").forEach((item) => item.classList.toggle("isActive", item === btn));
      const key = btn.dataset.mobileJump;
      if (key === "cards") scrollTo(document.querySelector(".libraryPanel, #deckMainPanel"));
      if (key === "deck") scrollTo(expandDock("deckInfoDock") || document.getElementById("deckPanel"));
      if (key === "save") {
        scrollTo(expandDock("deckSaveDock") || document.getElementById("deckPanel"));
      }
      if (key === "top") window.scrollTo({ top: 0, behavior: "smooth" });
      nav.querySelectorAll("button").forEach((el) => el.classList.toggle("isActive", el === btn));
    });

    nav.querySelector("[data-mobile-jump='cards']")?.classList.add("isActive");
  }

  function markRows() {
    document.querySelectorAll("#cardList .cardRow, #deckList .cardRow").forEach((row) => {
      const text = row.textContent || "";
      const supportPattern = /support|SUPPORT|\u30b5\u30dd\u30fc\u30c8|\u52b9\u679c|\u56de\u5fa9|\u30c9\u30ed\u30fc|\u72b6\u614b\u7570\u5e38|\u5f37\u5236\u79fb\u52d5/;
      if (!row.dataset.kind && supportPattern.test(text)) {
        row.dataset.kind = "support";
        return;
      }
      if (!row.dataset.kind && /support|サポート|効果|回復|ドロー|状態異常|強制移動/.test(text)) {
        row.dataset.kind = "support";
      }
    });
  }

  function install() {
    installStyle();
    ensureNav();
    markRows();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }

  const observer = new MutationObserver(() => install());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
