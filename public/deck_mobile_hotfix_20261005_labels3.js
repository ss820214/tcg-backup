(() => {
  "use strict";
  if (document.getElementById("deckMobileLabels3Style")) return;
  const style = document.createElement("style");
  style.id = "deckMobileLabels3Style";
  style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  #cardList .cardRow .name,
  #deckList .cardRow .name,
  #cardList .cardRow .cardName,
  #deckList .cardRow .cardName,
  #cardList .cardRow .cardHead > div:first-child > b,
  #deckList .cardRow .cardHead > div:first-child > b{
    display:flex!important;
    align-items:center!important;
    flex-wrap:wrap!important;
    column-gap:6px!important;
    row-gap:4px!important;
    min-width:0!important;
    width:100%!important;
    white-space:normal!important;
    line-height:1.35!important;
    overflow:visible!important;
    text-overflow:clip!important;
    -webkit-line-clamp:unset!important;
    -webkit-box-orient:initial!important;
  }
  #cardList .ownedBadge,#deckList .ownedBadge,
  #cardList .seriesBadge,#deckList .seriesBadge,
  #cardList .attrBadge,#deckList .attrBadge{
    display:inline-flex!important;
    flex:0 0 auto!important;
    align-items:center!important;
    justify-content:center!important;
    margin:0!important;
    white-space:nowrap!important;
    writing-mode:horizontal-tb!important;
  }
}
`;
  document.head.appendChild(style);
})();
