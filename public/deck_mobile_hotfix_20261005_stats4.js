(() => {
  "use strict";
  const STYLE_ID = "deckMobileStats4Style";
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  /* ガチャ / 初期 / 童話などのシリーズ分類は編成画面では表示しない。 */
  #cardList .seriesBadge,
  #deckList .seriesBadge {
    display:none!important;
  }

  /* HP / SP / 行動をカード名の直下で必ず読めるようにする。 */
  #cardList .cardRow,
  #deckList .cardRow {
    height:auto!important;
    min-height:104px!important;
    align-items:start!important;
  }
  #cardList .cardRow > div:first-child,
  #deckList .cardRow > div:first-child,
  #cardList .cardMain,
  #deckList .cardMain {
    min-width:0!important;
    overflow:visible!important;
  }
  #cardList .cardRow .sub,
  #deckList .cardRow .sub,
  #cardList .cardRow .cardMeta,
  #deckList .cardRow .cardMeta,
  #cardList .cardRow .cardHead .small,
  #deckList .cardRow .cardHead .small {
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:2!important;
    margin-top:6px!important;
    max-height:3.1em!important;
    overflow:hidden!important;
    white-space:normal!important;
    text-overflow:clip!important;
    font-size:11px!important;
    line-height:1.45!important;
    color:rgba(255,255,255,.76)!important;
  }

  /* 名前 / 属性 / 所持枚数だけを上段に残す。 */
  #cardList .cardRow .name,
  #deckList .cardRow .name,
  #cardList .cardRow .cardName,
  #deckList .cardRow .cardName,
  #cardList .cardRow .cardHead > div:first-child > b,
  #deckList .cardRow .cardHead > div:first-child > b {
    display:flex!important;
    align-items:center!important;
    flex-wrap:wrap!important;
    gap:5px!important;
    min-height:28px!important;
    overflow:visible!important;
    white-space:normal!important;
    -webkit-line-clamp:unset!important;
  }

  /* クラウド管理を親レイアウトに依存させない。 */
  #deckLibBox,
  #deckLibBox .deckLibBd,
  #deckLibBox .deckLibModePanel,
  #deckLibBox .deckLibSection,
  #deckLibBox .deckLibSectionBd,
  #deckLibBox .deckLibRow,
  #deckLibBox .deckLibSaveBtns {
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    box-sizing:border-box!important;
    writing-mode:horizontal-tb!important;
  }
  #deckLibBox {
    display:block!important;
    margin:10px 0 0!important;
    overflow:visible!important;
  }
  #deckLibBox .deckLibModeTabs {
    display:none!important;
  }
  #deckLibBox .deckLibModePanel[hidden],
  #deckLibBox .deckLibSection[hidden],
  #deckLibBox #deckLibModeSearch[hidden],
  #deckLibBox #deckLibSearchPanel[hidden] {
    display:none!important;
  }
  #deckLibBox #deckLibSavePanel:not([hidden]) {
    display:block!important;
  }
  #deckLibBox .deckLibSectionBd,
  #deckLibBox .deckLibRow,
  #deckLibBox .deckLibSaveBtns {
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    gap:8px!important;
  }
  #deckLibBox #deckLibUploadNew,
  #deckLibBox #deckLibUploadOverwrite,
  #deckLibBox #deckLibOpenOwnDecks,
  #deckLibBox #deckLibVis {
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:44px!important;
    height:44px!important;
    writing-mode:horizontal-tb!important;
    white-space:normal!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  #deckLibBox .deckLibColorWrap {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 72px!important;
    align-items:center!important;
    gap:10px!important;
    width:100%!important;
    min-width:0!important;
    min-height:44px!important;
    padding:7px 10px!important;
    border:1px solid rgba(255,255,255,.10)!important;
    border-radius:12px!important;
    background:rgba(0,0,0,.18)!important;
  }
  #deckLibBox #deckLibThemeColor {
    width:72px!important;
    min-width:72px!important;
    height:34px!important;
    padding:2px!important;
  }

  /* 通常のデッキ名保存も必ず縦1列。 */
  #deckSaveDock,
  .deckSaveDock {
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    overflow:visible!important;
    box-sizing:border-box!important;
  }
  #deckSaveDock .deckSaveRow,
  .deckSaveDock .deckSaveRow {
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
  }
  #deckSaveDock #deckTitle,
  #deckSaveDock #btnSave,
  .deckSaveDock #deckTitle,
  .deckSaveDock #btnSave {
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:44px!important;
    height:44px!important;
    writing-mode:horizontal-tb!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
}
`;
  document.head.appendChild(style);
})();
