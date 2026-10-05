(() => {
  "use strict";

  const VERSION = "20261005_hotfix1";
  const BODY_CLASS = "deckMobileStable20261005";
  const STYLE_ID = "deckMobileStableStyle20261005";
  let labelObserver = null;
  let labelBusy = false;

  const $ = (id) => document.getElementById(id);

  function isDeckBuilder() {
    return !!($("cardList") && $("deckPanel"));
  }

  function deviceOverride() {
    try {
      return String(
        localStorage.getItem("tcgDeviceModeOverrideV2") ||
          localStorage.getItem("tcgDeviceModeOverride") ||
          "auto",
      ).toLowerCase();
    } catch {
      return "auto";
    }
  }

  function isMobileLike() {
    try {
      if (window.TCG_DEVICE_MODE?.isMobile) return !!window.TCG_DEVICE_MODE.isMobile();
    } catch {}
    const mode = deviceOverride();
    if (/^(pc|desktop|wide|fixed)$/.test(mode)) return false;
    if (/^(mobile|smart|phone|sp)$/.test(mode)) return true;
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
  body.${BODY_CLASS}{
    overflow-x:hidden!important;
    overflow-y:auto!important;
    width:100%!important;
    max-width:100vw!important;
    min-height:100dvh!important;
    padding-bottom:calc(82px + env(safe-area-inset-bottom,0px))!important;
  }

  body.${BODY_CLASS} .wrap,
  body.${BODY_CLASS} #mobileDeckStackShell,
  body.${BODY_CLASS} .mobileDeckStackHost{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    overflow:visible!important;
  }

  body.${BODY_CLASS} #deckMainPanel,
  body.${BODY_CLASS} .libraryPanel,
  body.${BODY_CLASS} #deckPanel{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
    box-sizing:border-box!important;
  }

  body.${BODY_CLASS} .libraryPanel>.bd,
  body.${BODY_CLASS} #deckPanel>.bd,
  body.${BODY_CLASS} .workspace{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
    box-sizing:border-box!important;
  }

  /* カード一覧は既存DOMをそのまま使う。属性別の再グループ化はしない。 */
  body.${BODY_CLASS} #cardList{
    display:flex!important;
    flex-direction:column!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
    min-height:260px!important;
    height:auto!important;
    max-height:58dvh!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    padding:2px 3px 12px!important;
    background:transparent!important;
    scroll-behavior:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
    touch-action:pan-y!important;
    scrollbar-gutter:stable!important;
  }

  /* 旧スマホ補正がBFCacheに残った場合も見た目を平坦化する。 */
  body.${BODY_CLASS} #cardList>.dmrGroup,
  body.${BODY_CLASS} #cardList>.dmrGroup>.dmrGroupBody{
    display:contents!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    background:none!important;
    box-shadow:none!important;
  }
  body.${BODY_CLASS} #cardList .dmrGroupHead{display:none!important;}

  body.${BODY_CLASS} .filterBox{
    position:relative!important;
    top:auto!important;
    z-index:5!important;
    width:100%!important;
    min-width:0!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} .typeRow,
  body.${BODY_CLASS} .attrRow,
  body.${BODY_CLASS} .ownedRow,
  body.${BODY_CLASS} #cardFilters .filterRow{
    display:flex!important;
    flex-wrap:nowrap!important;
    gap:6px!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    padding:2px 0 5px!important;
    scrollbar-width:none!important;
    -webkit-overflow-scrolling:touch!important;
    touch-action:pan-x!important;
  }
  body.${BODY_CLASS} .typeRow::-webkit-scrollbar,
  body.${BODY_CLASS} .attrRow::-webkit-scrollbar,
  body.${BODY_CLASS} .ownedRow::-webkit-scrollbar,
  body.${BODY_CLASS} #cardFilters .filterRow::-webkit-scrollbar{display:none!important;}
  body.${BODY_CLASS} .filterBtn,
  body.${BODY_CLASS} .tab{
    flex:0 0 auto!important;
    min-height:36px!important;
    height:auto!important;
    padding:7px 12px!important;
    white-space:nowrap!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }

  body.${BODY_CLASS} #cardList .cardRow,
  body.${BODY_CLASS} #deckList .cardRow{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    min-height:82px!important;
    grid-template-columns:minmax(0,1fr) 112px!important;
    gap:8px!important;
    overflow:hidden!important;
    box-sizing:border-box!important;
    background:
      linear-gradient(90deg,color-mix(in srgb,var(--row-attr,#7dd3fc) 8%,rgba(255,255,255,.025)),rgba(255,255,255,.018)),
      rgba(7,12,16,.78)!important;
  }

  /* カード名とバッジを文字列として潰さない。 */
  body.${BODY_CLASS} #cardList .cardRow .name,
  body.${BODY_CLASS} #deckList .cardRow .name,
  body.${BODY_CLASS} #cardList .cardRow .cardName,
  body.${BODY_CLASS} #deckList .cardRow .cardName{
    display:flex!important;
    align-items:center!important;
    flex-wrap:wrap!important;
    gap:5px!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    font-size:13px!important;
    line-height:1.35!important;
    white-space:normal!important;
    overflow:visible!important;
    text-overflow:clip!important;
    -webkit-line-clamp:unset!important;
    -webkit-box-orient:initial!important;
  }
  body.${BODY_CLASS} .ownedBadge,
  body.${BODY_CLASS} .seriesBadge,
  body.${BODY_CLASS} .attrBadge{
    flex:0 0 auto!important;
    white-space:nowrap!important;
    writing-mode:horizontal-tb!important;
  }
  body.${BODY_CLASS} #cardList .cardRow .sub,
  body.${BODY_CLASS} #deckList .cardRow .sub,
  body.${BODY_CLASS} #cardList .cardRow .cardMeta,
  body.${BODY_CLASS} #deckList .cardRow .cardMeta{
    margin-top:5px!important;
    font-size:10.5px!important;
    line-height:1.42!important;
    white-space:normal!important;
    display:-webkit-box!important;
    -webkit-line-clamp:2!important;
    -webkit-box-orient:vertical!important;
    overflow:hidden!important;
  }

  body.${BODY_CLASS} #cardList .cardRow .btns,
  body.${BODY_CLASS} #cardList .cardRow .cardCtrl,
  body.${BODY_CLASS} #deckList .cardRow .btns,
  body.${BODY_CLASS} #deckList .cardRow .cardCtrl{
    width:112px!important;
    min-width:112px!important;
    max-width:112px!important;
    display:grid!important;
    grid-template-columns:32px minmax(40px,1fr) 32px!important;
    grid-template-areas:"minus count plus" "detail detail detail" "ex ex ex" "admin admin admin"!important;
    gap:5px!important;
    align-content:center!important;
  }
  body.${BODY_CLASS} #cardList .cardRow [data-minus],
  body.${BODY_CLASS} #deckList .cardRow [data-minus]{grid-area:minus!important;}
  body.${BODY_CLASS} #cardList .cardRow [data-plus],
  body.${BODY_CLASS} #deckList .cardRow [data-plus]{grid-area:plus!important;}
  body.${BODY_CLASS} #cardList .cardRow .count,
  body.${BODY_CLASS} #deckList .cardRow .count,
  body.${BODY_CLASS} #cardList .cardRow .cnt,
  body.${BODY_CLASS} #deckList .cardRow .cnt{grid-area:count!important;}
  body.${BODY_CLASS} #cardList .cardRow [data-detail],
  body.${BODY_CLASS} #deckList .cardRow [data-detail]{grid-area:detail!important;}
  body.${BODY_CLASS} #cardList .cardRow [data-ex],
  body.${BODY_CLASS} #deckList .cardRow [data-ex],
  body.${BODY_CLASS} #cardList .cardRow [data-expick],
  body.${BODY_CLASS} #deckList .cardRow [data-expick]{grid-area:ex!important;}
  body.${BODY_CLASS} #cardList .cardRow .adminHideToggle{grid-area:admin!important;}
  body.${BODY_CLASS} #cardList .cardRow .btns button,
  body.${BODY_CLASS} #deckList .cardRow .btns button,
  body.${BODY_CLASS} #cardList .cardRow .count,
  body.${BODY_CLASS} #deckList .cardRow .count,
  body.${BODY_CLASS} #cardList .cardRow .cnt,
  body.${BODY_CLASS} #deckList .cardRow .cnt{
    min-width:0!important;
    width:auto!important;
    max-width:100%!important;
    min-height:31px!important;
    height:31px!important;
    padding:0 5px!important;
    border-radius:9px!important;
    font-size:10.5px!important;
    line-height:1!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }

  /* デッキ保存・クラウド管理は横幅を潰さない。 */
  body.${BODY_CLASS} #deckPanel .deckSaveDock,
  body.${BODY_CLASS} #deckPanel #deckSaveDock{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
    padding:10px!important;
    box-sizing:border-box!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock:not(.isCollapsed){
    display:block!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveRow{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
    padding:9px!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveRow #deckTitle,
  body.${BODY_CLASS} #deckPanel .deckSaveRow #btnSave{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:42px!important;
    height:42px!important;
  }

  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibBox,
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibBd,
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSection,
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSectionBd,
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibModePanel{
    display:block!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    box-sizing:border-box!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibBox{
    overflow:visible!important;
    margin:8px 0 0!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibHd{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
    padding:10px 11px!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibBd{
    padding:10px!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibModeTabs{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:6px!important;
    width:100%!important;
    margin:0 0 9px!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibModeBtn{
    width:100%!important;
    min-width:0!important;
    min-height:40px!important;
    white-space:normal!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibRow{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    align-items:center!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSelect{
    grid-column:1 / -1!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:42px!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibColorWrap{
    grid-column:1 / -1!important;
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:10px!important;
    width:100%!important;
    min-width:0!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibColor{
    flex:0 0 64px!important;
    width:64px!important;
    height:40px!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSaveBtns{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSaveBtns .btn,
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSaveBtns .btnGhost{
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:44px!important;
    height:auto!important;
    padding:10px 12px!important;
    white-space:normal!important;
    overflow:visible!important;
    text-overflow:clip!important;
    writing-mode:horizontal-tb!important;
    line-height:1.25!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  body.${BODY_CLASS} #deckPanel .deckSaveDock .deckLibSub{
    display:block!important;
    width:100%!important;
    margin-top:9px!important;
    font-size:10.5px!important;
    line-height:1.5!important;
    white-space:pre-wrap!important;
  }

  body.${BODY_CLASS} #deckPanelActions{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:6px!important;
    width:100%!important;
    min-width:0!important;
    overflow:visible!important;
  }
  body.${BODY_CLASS} #deckPanelActions [data-deck-panel-action]{
    width:100%!important;
    min-width:0!important;
    min-height:36px!important;
    height:auto!important;
    padding:7px 8px!important;
    white-space:nowrap!important;
    overflow:visible!important;
    text-overflow:clip!important;
  }

  body.${BODY_CLASS} #deckList{
    width:100%!important;
    min-width:0!important;
    min-height:210px!important;
    height:auto!important;
    max-height:50dvh!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    scroll-behavior:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
  }

  @media(max-width:380px){
    body.${BODY_CLASS} #cardList .cardRow,
    body.${BODY_CLASS} #deckList .cardRow{grid-template-columns:minmax(0,1fr) 104px!important;}
    body.${BODY_CLASS} #cardList .cardRow .btns,
    body.${BODY_CLASS} #cardList .cardRow .cardCtrl,
    body.${BODY_CLASS} #deckList .cardRow .btns,
    body.${BODY_CLASS} #deckList .cardRow .cardCtrl{
      width:104px!important;
      min-width:104px!important;
      max-width:104px!important;
    }
  }
}
`;
    document.head.appendChild(style);
  }

  function flattenLegacyGroups() {
    const list = $("cardList");
    if (!list) return;
    const groups = Array.from(list.querySelectorAll(":scope > .dmrGroup"));
    if (!groups.length) return;

    const frag = document.createDocumentFragment();
    groups.forEach((group) => {
      group.querySelectorAll(".cardRow").forEach((row) => frag.appendChild(row));
    });
    groups.forEach((group) => group.remove());
    delete list.dataset.dmrSignature;
    list.appendChild(frag);
  }

  function normalizeHeaderAndActions() {
    const home = $("btnHome");
    if (home && home.textContent !== "ホームへ") home.textContent = "ホームへ";

    const labels = { save: "保存", library: "自分のデッキ", lab: "評価", play: "対戦へ" };
    Object.entries(labels).forEach(([key, label]) => {
      const btn = document.querySelector(`#deckPanelActions [data-deck-panel-action="${key}"]`);
      if (btn && btn.textContent !== label) btn.textContent = label;
    });

    const search = $("search");
    if (search && search.placeholder !== "カード名 / ID / シリーズで検索") {
      search.placeholder = "カード名 / ID / シリーズで検索";
    }
  }

  function normalizeVisibleLabels(root = document) {
    if (labelBusy) return;
    labelBusy = true;
    try {
      const selectors = [
        "#cardList .sub",
        "#deckList .sub",
        ".cardMeta",
        ".deckQuickMeta",
        ".deckDetailBadge",
        ".deckLabType",
      ].join(",");
      root.querySelectorAll?.(selectors).forEach((el) => {
        const before = el.textContent || "";
        const after = before
          .replace(/\bunit\b/gi, "キャラ")
          .replaceAll("辟｡", "無属性")
          .replaceAll("莠呈鋤", "表示");
        if (after !== before) el.textContent = after;
      });
    } finally {
      labelBusy = false;
    }
  }

  function apply() {
    if (!document.body || !isDeckBuilder()) return;
    const mobile = isMobileLike();
    document.documentElement.dataset.deckMobileRefined = mobile ? VERSION : "desktop";
    document.body.classList.toggle(BODY_CLASS, mobile);
    if (!mobile) return;

    injectStyle();
    flattenLegacyGroups();
    normalizeHeaderAndActions();
    normalizeVisibleLabels(document);
  }

  function startLabelObserver() {
    if (labelObserver || !document.body) return;
    labelObserver = new MutationObserver((mutations) => {
      if (labelBusy || !document.body.classList.contains(BODY_CLASS)) return;
      const needsFix = mutations.some((m) => {
        const el = m.target instanceof Element ? m.target : m.target?.parentElement;
        return !!el?.closest?.("#cardList,#deckList,#deckPanel");
      });
      if (!needsFix) return;
      normalizeVisibleLabels(document);
      normalizeHeaderAndActions();
    });
    labelObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (!isDeckBuilder()) return;
  apply();
  startLabelObserver();
  window.addEventListener("resize", apply, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(apply, 120), { passive: true });
  window.addEventListener("pageshow", apply);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) apply();
  });
  console.log("[deck_mobile_refine] stable", VERSION);
})();
