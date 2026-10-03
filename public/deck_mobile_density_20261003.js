(() => {
  "use strict";

  const VERSION = "20261003_density1";
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
    if ($(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  body.${BODY_CLASS} header{
    position:sticky!important;
    top:0!important;
    min-height:46px!important;
    padding:5px 7px!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    align-items:start!important;
    gap:4px!important;
  }
  body.${BODY_CLASS} header .left{
    min-width:0!important;
    padding-top:2px!important;
  }
  body.${BODY_CLASS} header .left h1{
    font-size:15px!important;
    line-height:1.05!important;
  }
  body.${BODY_CLASS} header .topRight{
    position:absolute!important;
    top:5px!important;
    right:5px!important;
    width:auto!important;
    min-width:0!important;
    display:flex!important;
    justify-content:flex-end!important;
    align-items:center!important;
    gap:4px!important;
    padding:0!important;
    margin:0!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} header .topRight>*{display:none!important}
  body.${BODY_CLASS} header #btnHome,
  body.${BODY_CLASS} header #btnDeckTop{
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:0!important;
    width:auto!important;
    height:30px!important;
    min-height:30px!important;
    padding:0 9px!important;
    margin:0!important;
    border-radius:999px!important;
    font-size:10.5px!important;
    line-height:1!important;
    white-space:nowrap!important;
  }
  body.${BODY_CLASS} header #btnSettings{display:none!important}
  body.${BODY_CLASS} #deviceModeBadge{
    grid-column:1/-1!important;
    width:100%!important;
    height:27px!important;
    min-height:27px!important;
    margin:4px 0 0!important;
    padding:0 8px!important;
    font-size:10px!important;
  }

  body.${BODY_CLASS} .wrap{
    gap:6px!important;
    padding:6px!important;
  }
  body.${BODY_CLASS} #deckMainPanel,
  body.${BODY_CLASS} #deckPanel,
  body.${BODY_CLASS} .libraryPanel{
    border-radius:14px!important;
  }
  body.${BODY_CLASS} .panel>.hd,
  body.${BODY_CLASS} #deckPanel>.hd{
    min-height:38px!important;
    padding:6px 8px!important;
  }
  body.${BODY_CLASS} .panel>.hd b,
  body.${BODY_CLASS} #deckPanel>.hd b{
    font-size:13px!important;
  }
  body.${BODY_CLASS} .panel>.bd,
  body.${BODY_CLASS} #deckPanel>.bd{
    padding:5px!important;
    gap:5px!important;
  }
  body.${BODY_CLASS} .workspace{
    gap:5px!important;
  }

  body.${BODY_CLASS} .filterBox,
  body.${BODY_CLASS} #deckMainPanel .filterBox{
    margin:0 0 4px!important;
    padding:6px!important;
    border-radius:11px!important;
  }
  body.${BODY_CLASS} #search{
    height:34px!important;
    min-height:34px!important;
    padding:6px 9px!important;
    border-radius:10px!important;
    font-size:12px!important;
  }
  body.${BODY_CLASS} .filterGrid{
    gap:3px!important;
    margin-top:4px!important;
  }
  body.${BODY_CLASS} .typeRow,
  body.${BODY_CLASS} .attrRow,
  body.${BODY_CLASS} .ownedRow{
    gap:3px!important;
    padding:0 0 2px!important;
    margin:0!important;
  }
  body.${BODY_CLASS} .filterBtn,
  body.${BODY_CLASS} .tab{
    min-height:28px!important;
    height:28px!important;
    padding:0 8px!important;
    font-size:10.5px!important;
  }

  body.${BODY_CLASS} #cardList.list{
    min-height:190px!important;
    max-height:60dvh!important;
    padding:0 1px 5px!important;
    scroll-padding-top:4px!important;
  }
  body.${BODY_CLASS} .dmrGroup{
    margin:0 0 4px!important;
    border-radius:10px!important;
  }
  body.${BODY_CLASS} .dmrGroupHead{
    min-height:32px!important;
    grid-template-columns:23px minmax(0,1fr) auto!important;
    gap:5px!important;
    padding:4px 7px!important;
  }
  body.${BODY_CLASS} .dmrGroupIcon{
    width:22px!important;
    height:22px!important;
    font-size:10px!important;
  }
  body.${BODY_CLASS} .dmrGroupName{font-size:11.5px!important}
  body.${BODY_CLASS} .dmrGroupCount{font-size:9.5px!important}
  body.${BODY_CLASS} .dmrGroupBody{
    gap:3px!important;
    padding:3px!important;
  }

  body.${BODY_CLASS} #cardList .cardRow,
  body.${BODY_CLASS} #deckList .cardRow{
    min-height:64px!important;
    grid-template-columns:minmax(0,1fr) 94px!important;
    gap:4px!important;
    padding:5px 6px!important;
    border-radius:9px!important;
    box-shadow:0 3px 10px rgba(0,0,0,.14)!important;
  }
  body.${BODY_CLASS} #cardList .cardRow .name,
  body.${BODY_CLASS} #deckList .cardRow .name,
  body.${BODY_CLASS} #cardList .cardRow .cardName,
  body.${BODY_CLASS} #deckList .cardRow .cardName{
    font-size:11.5px!important;
    line-height:1.2!important;
    -webkit-line-clamp:1!important;
  }
  body.${BODY_CLASS} #cardList .cardRow .sub,
  body.${BODY_CLASS} #deckList .cardRow .sub,
  body.${BODY_CLASS} #cardList .cardRow .cardMeta,
  body.${BODY_CLASS} #deckList .cardRow .cardMeta{
    margin-top:2px!important;
    font-size:9.5px!important;
    line-height:1.28!important;
    -webkit-line-clamp:2!important;
  }
  body.${BODY_CLASS} #cardList .cardRow .btns,
  body.${BODY_CLASS} #cardList .cardRow .cardCtrl,
  body.${BODY_CLASS} #deckList .cardRow .btns,
  body.${BODY_CLASS} #deckList .cardRow .cardCtrl{
    grid-template-columns:27px minmax(32px,1fr) 27px!important;
    grid-auto-rows:25px!important;
    gap:2px!important;
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
    min-height:25px!important;
    height:25px!important;
    padding:0 3px!important;
    border-radius:7px!important;
    font-size:9.5px!important;
  }

  body.${BODY_CLASS} #deckPanelActions,
  body.${BODY_CLASS} .deckPanelActions{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:3px!important;
    width:100%!important;
    max-width:100%!important;
    overflow:visible!important;
    margin:0!important;
    padding:0!important;
  }
  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action],
  body.${BODY_CLASS} .deckPanelActions [data-deck-panel-action],
  body.${BODY_CLASS} .deckPanelActions button{
    min-width:0!important;
    width:100%!important;
    min-height:30px!important;
    height:30px!important;
    padding:0 4px!important;
    border-radius:8px!important;
    font-size:9.5px!important;
    line-height:1!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  body.${BODY_CLASS} #deckPanel>.bd{
    overflow:visible!important;
  }
  body.${BODY_CLASS} .deckSaveDock,
  body.${BODY_CLASS} .deckInfoDock{
    border-radius:10px!important;
  }
  body.${BODY_CLASS} .deckSaveDockHead,
  body.${BODY_CLASS} .deckInfoDockHead,
  body.${BODY_CLASS} .listHead{
    min-height:34px!important;
    padding:6px 8px!important;
    gap:5px!important;
  }
  body.${BODY_CLASS} .deckSaveRow{
    gap:4px!important;
    padding:5px!important;
  }
  body.${BODY_CLASS} .deckSaveRow #deckTitle,
  body.${BODY_CLASS} .deckSaveRow #btnSave{
    min-height:31px!important;
    height:31px!important;
    font-size:10.5px!important;
  }
  body.${BODY_CLASS} .deckInfoBody{
    padding:0 5px 5px!important;
    gap:4px!important;
  }
  body.${BODY_CLASS} #deckList.list{
    min-height:120px!important;
    max-height:44dvh!important;
    gap:3px!important;
    padding:0 1px 5px!important;
  }
  body.${BODY_CLASS} .deckLab{
    padding:7px!important;
    border-radius:10px!important;
  }

  body.${BODY_CLASS} [data-density-hidden="1"]{
    display:none!important;
  }

  @media(max-width:380px){
    body.${BODY_CLASS} #cardList .cardRow,
    body.${BODY_CLASS} #deckList .cardRow{
      grid-template-columns:minmax(0,1fr) 88px!important;
      padding:4px 5px!important;
    }
    body.${BODY_CLASS} #deckPanelActions,
    body.${BODY_CLASS} .deckPanelActions{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
  }
}
`;
    document.head.appendChild(style);
  }

  function normalizeHeader() {
    const home = $("btnHome");
    const deck = $("btnDeckTop");
    const settings = $("btnSettings");
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
  }

  function hideRedundantLabels() {
    const exact = new Set(["入れたカード", "カード選択"]);
    document.querySelectorAll("#deckPanel *").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = String(el.textContent || "").trim();
      if (!exact.has(text)) return;
      el.dataset.densityHidden = "1";
      const row = el.closest(".listHead,.deckInfoDockHead,.sectionHead");
      if (row && String(row.textContent || "").trim() === text) row.dataset.densityHidden = "1";
    });
  }

  function compactAttributeGuide() {
    document.querySelectorAll("#deckMainPanel *").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
      if (!text.includes("属性の特徴")) return;
      const box = el.closest(".msg,.small,.guide,.attributeGuide,.attributeHint,[class*='attribute'],[class*='guide']") || el.parentElement;
      if (!box || !(box instanceof HTMLElement)) return;
      box.style.setProperty("margin", "3px 0 4px", "important");
      box.style.setProperty("padding", "6px 8px", "important");
      box.style.setProperty("min-height", "0", "important");
      box.style.setProperty("line-height", "1.25", "important");
      box.style.setProperty("font-size", "10.5px", "important");
    });
  }

  function compactDeckStatus() {
    document.querySelectorAll("#deckPanel .pill,#deckPanel .badge,#deckPanel .small").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.style.setProperty("min-height", "24px", "important");
      el.style.setProperty("padding", "2px 6px", "important");
      el.style.setProperty("font-size", "9.5px", "important");
      el.style.setProperty("line-height", "1.1", "important");
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
      if (!busy) schedule(40);
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (!isDeckBuilder()) return;
  apply();
  startObserver();
  window.addEventListener("resize", () => schedule(70), { passive:true });
  window.addEventListener("orientationchange", () => schedule(110), { passive:true });
  window.addEventListener("pageshow", () => schedule(30));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(30); });
  console.log("[deck_mobile_density] ready", VERSION);
})();
