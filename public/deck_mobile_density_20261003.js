(() => {
  "use strict";

  const VERSION = "20261003_density2";
  const BODY_CLASS = "deckMobileDensity";
  const STYLE_ID = "deckMobileDensity20261003Style";
  let timer = 0;
  let observer = null;
  let busy = false;

  const $ = (id) => document.getElementById(id);

  function isDeckBuilder() {
    return !!($("cardList") && $("deckPanel"));
  }

  function isMobileLike() {
    try {
      if (window.TCG_DEVICE_MODE?.isMobile) return !!window.TCG_DEVICE_MODE.isMobile();
    } catch {}
    const width = window.innerWidth || document.documentElement.clientWidth || 9999;
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
    return width <= 900 || ((uaMobile || coarse) && width <= 1180);
  }

  function injectStyle() {
    let style = $(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  body.${BODY_CLASS},
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit){
    overflow-x:hidden!important;
    overflow-y:auto!important;
    height:auto!important;
    min-height:100dvh!important;
    padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;
  }

  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) header,
  body.${BODY_CLASS} header{
    position:sticky!important;
    top:0!important;
    z-index:7000!important;
    min-height:68px!important;
    height:auto!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    align-items:start!important;
    gap:4px!important;
    padding:6px 7px 31px!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} header .left{
    min-width:0!important;
    padding-top:2px!important;
  }
  body.${BODY_CLASS} header .left h1{
    margin:0!important;
    font-size:15px!important;
    line-height:1.05!important;
  }
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) header .topRight,
  body.${BODY_CLASS} header .topRight{
    position:absolute!important;
    top:5px!important;
    right:5px!important;
    left:auto!important;
    width:auto!important;
    min-width:0!important;
    display:flex!important;
    flex-wrap:nowrap!important;
    justify-content:flex-end!important;
    align-items:center!important;
    gap:4px!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} header .topRight>*{display:none!important}
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) header #btnHome,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) header #btnDeckTop,
  body.${BODY_CLASS} header #btnHome,
  body.${BODY_CLASS} header #btnDeckTop{
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:0!important;
    width:auto!important;
    height:29px!important;
    min-height:29px!important;
    margin:0!important;
    padding:0 8px!important;
    border-radius:999px!important;
    font-size:10.5px!important;
    line-height:1!important;
    white-space:nowrap!important;
  }
  body.${BODY_CLASS} header #btnSettings{display:none!important}
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) header>#deviceModeBadge,
  body.${BODY_CLASS} header>#deviceModeBadge{
    position:absolute!important;
    left:7px!important;
    right:7px!important;
    bottom:4px!important;
    top:auto!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:auto!important;
    min-width:0!important;
    height:24px!important;
    min-height:24px!important;
    margin:0!important;
    padding:0 8px!important;
    font-size:9.5px!important;
    line-height:1!important;
  }

  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) .wrap,
  body.${BODY_CLASS} .wrap{
    display:flex!important;
    flex-direction:column!important;
    grid-template-columns:none!important;
    grid-template-rows:none!important;
    align-content:start!important;
    width:100%!important;
    max-width:100%!important;
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    overflow:visible!important;
    gap:5px!important;
    padding:5px!important;
    transform:none!important;
    zoom:1!important;
  }
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckMainPanel,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) .libraryPanel,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckPanel,
  body.${BODY_CLASS} #deckMainPanel,
  body.${BODY_CLASS} .libraryPanel,
  body.${BODY_CLASS} #deckPanel{
    position:relative!important;
    inset:auto!important;
    top:auto!important;
    left:auto!important;
    right:auto!important;
    order:initial!important;
    flex:0 0 auto!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    margin:0!important;
    overflow:visible!important;
    border-radius:13px!important;
  }
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckMainPanel>.bd,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckPanel>.bd,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) .workspace,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #mobileCardSection,
  body.${BODY_CLASS} #deckMainPanel>.bd,
  body.${BODY_CLASS} #deckPanel>.bd,
  body.${BODY_CLASS} .workspace,
  body.${BODY_CLASS} #mobileCardSection{
    flex:0 0 auto!important;
    width:100%!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} #deckMainPanel>.bd,
  body.${BODY_CLASS} #deckPanel>.bd{
    padding:4px!important;
    gap:4px!important;
  }
  body.${BODY_CLASS} #deckMainPanel>.hd,
  body.${BODY_CLASS} #deckPanel>.hd,
  body.${BODY_CLASS} .panel>.hd{
    min-height:36px!important;
    padding:5px 7px!important;
    gap:5px!important;
  }
  body.${BODY_CLASS} #deckMainPanel>.hd b,
  body.${BODY_CLASS} #deckPanel>.hd b{
    font-size:13px!important;
  }
  body.${BODY_CLASS} #deckMainPanel>.hd>.small{
    font-size:9.5px!important;
    line-height:1.1!important;
  }

  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) .filterBox,
  body.${BODY_CLASS} .filterBox{
    position:relative!important;
    top:auto!important;
    width:100%!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    margin:0 0 3px!important;
    padding:5px!important;
    border-radius:10px!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} .sectionHead{
    width:100%!important;
    min-height:0!important;
    margin:0!important;
  }
  body.${BODY_CLASS} #search{
    width:100%!important;
    height:33px!important;
    min-height:33px!important;
    padding:5px 9px!important;
    border-radius:9px!important;
    font-size:12px!important;
  }
  body.${BODY_CLASS} #attributeHint{display:none!important}
  body.${BODY_CLASS} .filterGrid{
    display:flex!important;
    flex-direction:column!important;
    width:100%!important;
    gap:2px!important;
    margin-top:3px!important;
  }
  body.${BODY_CLASS} .typeRow,
  body.${BODY_CLASS} .attrRow,
  body.${BODY_CLASS} .ownedRow{
    display:flex!important;
    flex-wrap:nowrap!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    gap:3px!important;
    margin:0!important;
    padding:0 0 2px!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    border:0!important;
    scrollbar-width:none!important;
  }
  body.${BODY_CLASS} .typeRow::-webkit-scrollbar,
  body.${BODY_CLASS} .attrRow::-webkit-scrollbar,
  body.${BODY_CLASS} .ownedRow::-webkit-scrollbar{display:none!important}
  body.${BODY_CLASS} .filterBtn,
  body.${BODY_CLASS} .tab{
    flex:0 0 auto!important;
    min-width:0!important;
    min-height:27px!important;
    height:27px!important;
    padding:0 8px!important;
    border-radius:999px!important;
    font-size:10px!important;
    line-height:1!important;
    white-space:nowrap!important;
  }

  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #cardList.list,
  body.${BODY_CLASS} #cardList.list{
    display:flex!important;
    flex-direction:column!important;
    grid-template-columns:none!important;
    flex:0 0 auto!important;
    width:100%!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    max-height:60dvh!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    gap:3px!important;
    margin:0!important;
    padding:0 1px 4px!important;
    scroll-padding-top:3px!important;
  }
  body.${BODY_CLASS} #cardList.list:empty{
    display:none!important;
    min-height:0!important;
    height:0!important;
    max-height:0!important;
    margin:0!important;
    padding:0!important;
  }
  body.${BODY_CLASS} .dmrGroup{
    margin:0 0 3px!important;
    border-radius:9px!important;
  }
  body.${BODY_CLASS} .dmrGroupHead{
    min-height:30px!important;
    grid-template-columns:22px minmax(0,1fr) auto!important;
    gap:4px!important;
    padding:3px 6px!important;
  }
  body.${BODY_CLASS} .dmrGroupIcon{
    width:21px!important;
    height:21px!important;
    font-size:9.5px!important;
  }
  body.${BODY_CLASS} .dmrGroupName{font-size:11px!important}
  body.${BODY_CLASS} .dmrGroupCount{font-size:9px!important}
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) .dmrGroupBody,
  body.${BODY_CLASS} .dmrGroupBody{
    display:flex!important;
    flex-direction:column!important;
    grid-template-columns:none!important;
    gap:3px!important;
    padding:3px!important;
  }
  body.${BODY_CLASS} .dmrGroupBody[hidden]{display:none!important}

  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #cardList .cardRow,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckList .cardRow,
  body.${BODY_CLASS} #cardList .cardRow,
  body.${BODY_CLASS} #deckList .cardRow{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:62px!important;
    height:auto!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 92px!important;
    gap:4px!important;
    align-items:center!important;
    margin:0!important;
    padding:4px 5px!important;
    border-radius:8px!important;
  }
  body.${BODY_CLASS} #cardList .cardName,
  body.${BODY_CLASS} #deckList .cardName,
  body.${BODY_CLASS} #cardList .name,
  body.${BODY_CLASS} #deckList .name{
    font-size:11.5px!important;
    line-height:1.18!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  body.${BODY_CLASS} #cardList .cardMeta,
  body.${BODY_CLASS} #deckList .cardMeta,
  body.${BODY_CLASS} #cardList .sub,
  body.${BODY_CLASS} #deckList .sub{
    margin-top:2px!important;
    font-size:9.5px!important;
    line-height:1.25!important;
    display:-webkit-box!important;
    -webkit-line-clamp:2!important;
    -webkit-box-orient:vertical!important;
    overflow:hidden!important;
  }
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #cardList .cardRow .btns,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #cardList .cardRow .cardCtrl,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckList .cardRow .btns,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckList .cardRow .cardCtrl,
  body.${BODY_CLASS} #cardList .cardRow .btns,
  body.${BODY_CLASS} #cardList .cardRow .cardCtrl,
  body.${BODY_CLASS} #deckList .cardRow .btns,
  body.${BODY_CLASS} #deckList .cardRow .cardCtrl{
    min-width:0!important;
    display:grid!important;
    grid-template-columns:26px minmax(30px,1fr) 26px!important;
    grid-auto-rows:24px!important;
    gap:2px!important;
    align-content:center!important;
  }
  body.${BODY_CLASS} #cardList .cardRow .btns button,
  body.${BODY_CLASS} #deckList .cardRow .btns button,
  body.${BODY_CLASS} #cardList .cardRow .cardCtrl button,
  body.${BODY_CLASS} #deckList .cardRow .cardCtrl button,
  body.${BODY_CLASS} #cardList .cardRow .count,
  body.${BODY_CLASS} #deckList .cardRow .count,
  body.${BODY_CLASS} #cardList .cardRow .cnt,
  body.${BODY_CLASS} #deckList .cardRow .cnt,
  body.${BODY_CLASS} #cardList .cardRow .countBox,
  body.${BODY_CLASS} #deckList .cardRow .countBox{
    min-width:0!important;
    min-height:24px!important;
    height:24px!important;
    padding:0 2px!important;
    border-radius:6px!important;
    font-size:9px!important;
    line-height:1!important;
  }

  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckPanelActions,
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) .deckPanelActions,
  body.${BODY_CLASS} #deckPanelActions,
  body.${BODY_CLASS} .deckPanelActions{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:3px!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action],
  body.${BODY_CLASS} .deckPanelActions [data-deck-panel-action]{
    min-width:0!important;
    width:100%!important;
    min-height:29px!important;
    height:29px!important;
    padding:0 3px!important;
    border-radius:7px!important;
    font-size:9.5px!important;
    line-height:1!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  body.${BODY_CLASS} .deckSaveDock,
  body.${BODY_CLASS} .deckInfoDock{
    width:100%!important;
    min-width:0!important;
    min-height:0!important;
    height:auto!important;
    border-radius:9px!important;
    overflow:hidden!important;
  }
  body.${BODY_CLASS} .deckSaveDockHead,
  body.${BODY_CLASS} .deckInfoDockHead,
  body.${BODY_CLASS} .listHead{
    min-height:31px!important;
    padding:4px 6px!important;
    gap:4px!important;
  }
  body.${BODY_CLASS} .deckSaveDockHeadMain>span,
  body.${BODY_CLASS} .deckInfoDockHeadMain>span,
  body.${BODY_CLASS} .listHead>.small{
    display:none!important;
  }
  body.${BODY_CLASS} .deckSaveRow{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 88px!important;
    gap:4px!important;
    padding:4px!important;
  }
  body.${BODY_CLASS} .deckSaveRow #deckTitle,
  body.${BODY_CLASS} .deckSaveRow #btnSave{
    min-width:0!important;
    min-height:29px!important;
    height:29px!important;
    padding:0 6px!important;
    font-size:10px!important;
  }
  body.${BODY_CLASS} .deckInfoBody{
    min-height:0!important;
    height:auto!important;
    padding:0 4px 4px!important;
    gap:3px!important;
  }
  body.mobileFitUi.mobileDeckUi.${BODY_CLASS}:not(.mobileHomeFit) #deckList.list,
  body.${BODY_CLASS} #deckList.list{
    flex:0 0 auto!important;
    width:100%!important;
    min-height:0!important;
    height:auto!important;
    max-height:44dvh!important;
    gap:3px!important;
    padding:0 1px 4px!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
  }
  body.${BODY_CLASS} #deckList.list:empty{
    min-height:0!important;
    height:0!important;
    padding:0!important;
    margin:0!important;
  }
  body.${BODY_CLASS} .deckLab{
    padding:6px!important;
    border-radius:9px!important;
  }
  body.${BODY_CLASS} [data-density-hidden="1"]{display:none!important}

  @media(max-width:380px){
    body.${BODY_CLASS} #cardList .cardRow,
    body.${BODY_CLASS} #deckList .cardRow{
      grid-template-columns:minmax(0,1fr) 86px!important;
    }
    body.${BODY_CLASS} #deckPanelActions,
    body.${BODY_CLASS} .deckPanelActions{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
  }
}
`;
  }

  function normalizeHeader() {
    const header = document.querySelector("header");
    const topRight = header?.querySelector(".topRight");
    const home = $("btnHome");
    const deck = $("btnDeckTop");
    const settings = $("btnSettings");
    const badge = $("deviceModeBadge");

    if (home) {
      home.hidden = false;
      home.textContent = "ホーム";
      home.setAttribute("aria-label", "ホームへ戻る");
    }
    if (deck) {
      deck.hidden = false;
      deck.textContent = "デッキ";
      deck.setAttribute("aria-label", "デッキ画面");
    }
    if (settings) settings.hidden = true;

    if (badge && header && badge.parentElement !== header) {
      header.appendChild(badge);
    }
    if (topRight && home && home.parentElement !== topRight) topRight.appendChild(home);
    if (topRight && deck && deck.parentElement !== topRight) topRight.appendChild(deck);
  }

  function hideRedundantLabels() {
    const exact = new Set(["入れたカード", "カード選択"]);
    document.querySelectorAll("#deckPanel *").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (!exact.has(text)) return;
      el.dataset.densityHidden = "1";
      const wrapper = el.closest(".listHead,.sectionHead");
      if (wrapper && String(wrapper.textContent || "").replace(/\s+/g, " ").trim() === text) {
        wrapper.dataset.densityHidden = "1";
      }
    });
  }

  function compactAttributeGuide() {
    document.querySelectorAll("#deckMainPanel *").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text.includes("属性の特徴")) return;
      if (text.length > 180) return;

      const candidates = [el, el.parentElement, el.parentElement?.parentElement];
      candidates.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (!node.closest("#deckMainPanel")) return;
        if (node.matches("#deckMainPanel,#mobileCardSection,.filterBox")) return;
        node.style.setProperty("min-height", "0", "important");
        node.style.setProperty("height", "auto", "important");
        node.style.setProperty("max-height", "none", "important");
        node.style.setProperty("margin-top", "2px", "important");
        node.style.setProperty("margin-bottom", "3px", "important");
        node.style.setProperty("padding-top", "4px", "important");
        node.style.setProperty("padding-bottom", "4px", "important");
        node.style.setProperty("line-height", "1.2", "important");
      });
      const next = el.nextElementSibling;
      if (next instanceof HTMLElement) next.style.setProperty("margin-top", "3px", "important");
    });
  }

  function compactDeckStatus() {
    document.querySelectorAll("#deckPanel .pill,#deckPanel .badge,#deckPanel .small").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.style.setProperty("min-height", "22px", "important");
      el.style.setProperty("padding", "2px 5px", "important");
      el.style.setProperty("font-size", "9px", "important");
      el.style.setProperty("line-height", "1.05", "important");
    });
  }

  function normalizeActionLabels() {
    const labels = { save:"保存", library:"自分のデッキ", lab:"評価", play:"対戦へ" };
    Object.entries(labels).forEach(([key, label]) => {
      const btn = document.querySelector(`#deckPanelActions [data-deck-panel-action="${key}"]`);
      if (btn && btn.textContent !== label) btn.textContent = label;
    });
  }

  function apply() {
    if (!document.body || !isDeckBuilder() || busy) return;
    busy = true;
    try {
      const mobile = isMobileLike();
      document.documentElement.dataset.deckMobileDensity = mobile ? VERSION : "desktop";
      document.body.classList.toggle(BODY_CLASS, mobile);
      if (!mobile) return;
      injectStyle();
      normalizeHeader();
      hideRedundantLabels();
      compactAttributeGuide();
      compactDeckStatus();
      normalizeActionLabels();
    } finally {
      busy = false;
    }
  }

  function schedule(delay = 0) {
    clearTimeout(timer);
    timer = setTimeout(apply, delay);
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => {
      if (!busy) schedule(24);
    });
    observer.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:["hidden","class"]
    });
  }

  if (!isDeckBuilder()) return;
  apply();
  startObserver();
  window.addEventListener("resize", () => schedule(50), { passive:true });
  window.addEventListener("orientationchange", () => schedule(90), { passive:true });
  window.addEventListener("pageshow", () => schedule(20));
  window.addEventListener("tcg:device-mode-change", () => schedule(20));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(20); });
  console.log("[deck_mobile_density] ready", VERSION);
})();
