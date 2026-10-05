(() => {
  "use strict";
  if (document.getElementById("deckMobileStablePatch20261005_1")) return;
  const style = document.createElement("style");
  style.id = "deckMobileStablePatch20261005_1";
  style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  body.deckMobileStable20261005 #deckPanel .deckSaveDock .deckLibModePanel[hidden],
  body.deckMobileStable20261005 #deckPanel .deckSaveDock .deckLibSection[hidden],
  body.deckMobileStable20261005 #deckPanel .deckSaveDock #deckLibSearchPanel[hidden],
  body.deckMobileStable20261005 #deckPanel .deckSaveDock #deckLibModeSearch[hidden]{
    display:none!important;
  }
  body.deckMobileStable20261005 #deckPanel .deckSaveDock #deckLibSavePanel:not([hidden]){
    display:block!important;
    width:100%!important;
    min-width:0!important;
  }
  body.deckMobileStable20261005 #deckPanel .deckSaveDock button,
  body.deckMobileStable20261005 #deckPanel .deckSaveDock select,
  body.deckMobileStable20261005 #deckPanel .deckSaveDock input{
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
}
`;
  document.head.appendChild(style);
})();
