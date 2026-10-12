(() => {
"use strict";
const ready = () => {
  if (document.getElementById("tierReadableTools")) return;
  const board=document.getElementById("tierBoard"), toolbar=document.querySelector(".tier-toolbar"), hero=document.querySelector(".hero"), actions=document.querySelector(".hero-actions");
  if(!board||!toolbar||!hero) return;
  const css=document.createElement("style");css.id="tierReadableStyles";
  css.textContent=`
  html,body{max-width:100%;overflow-x:clip}
  body .app,body .hero,body .tier-board,body .tier-row,body .tier-dropzone,body .deck-chip{min-width:0;max-width:100%;box-sizing:border-box}
  .tier-row{min-height:58px!important;grid-template-columns:65px minmax(0,1fr)!important}
  .tier-dropzone{min-height:58px!important;padding:8px!important;gap:6px!important;align-content:center!important}
  .tier-label{font-size:27px!important;gap:2px!important}
  .tier-count{font-size:10px!important;min-height:18px!important;min-width:24px!important;padding:2px 5px!important}
  .tier-row .deck-chip{min-width:0!important;max-width:100%!important;padding:7px 10px!important;border-radius:9px!important;box-shadow:none!important;font-size:12px!important}
  .tier-row .deck-chip .chip-name{overflow-wrap:anywhere}
  .tier-row .deck-chip .chip-sub,.tier-row .deck-chip .chip-roles{font-size:10px!important;margin-top:2px!important}
  .is-view-mode .tier-row .deck-chip .chip-tools,.is-view-mode .tier-row .deck-chip .delete-mini{display:none!important}
  .tier-row .tier-dropzone:empty:after{content:"未配置";font-size:11px;color:rgba(255,255,255,.35)}
  #tierReadableTools{margin:8px 0;padding:0;min-width:0}
  #tierReadableTools summary{cursor:pointer;padding:10px 13px;border:1px solid rgba(125,211,252,.3);border-radius:10px;background:rgba(12,23,36,.9);font-size:13px;font-weight:800;list-style-position:inside}
  #tierReadableTools .tierReadableInner{display:grid;gap:10px;padding:10px 0}
  #tierReadableTools .tier-toolbar,#tierReadableTools #tierConvenienceTools{position:static!important;margin:0!important;min-width:0}
  #tierReadableTools .hero-actions{display:flex!important;flex-wrap:wrap!important;gap:8px!important}
  #tierReadableTools .hero-actions button{min-height:38px!important;flex:1 1 140px!important}
  @media(max-width:720px){
    body .app{width:calc(100% - 16px)!important;margin-inline:auto!important;min-width:0!important}
    body .page-nav{margin-bottom:6px!important}
    body .hero{padding:10px 12px!important;gap:7px!important;margin-bottom:7px!important}
    body .hero h1{font-size:20px!important;line-height:1.2!important;overflow-wrap:anywhere}
    body .hero .eyebrow{font-size:9px!important;margin-bottom:4px!important}
    body .hero .lead{font-size:11px!important;line-height:1.35!important;margin:4px 0!important}
    body .tier-board{display:grid!important;gap:6px!important}
    body .tier-row,body .is-compact-tier .tier-row{display:grid!important;grid-template-columns:44px minmax(0,1fr)!important;min-height:45px!important;border-radius:11px!important}
    body .tier-label,body .is-compact-tier .tier-label{font-size:23px!important;padding:4px!important;align-items:center!important;justify-content:center!important;flex-direction:column!important}
    body .tier-dropzone,body .is-compact-tier .tier-dropzone{min-height:45px!important;padding:5px!important;gap:4px!important;display:flex!important;flex-wrap:wrap!important}
    body .tier-row .deck-chip,body .is-compact-tier .tier-row .deck-chip{min-width:0!important;max-width:100%!important;width:auto!important;padding:5px 8px!important;font-size:11px!important;border-radius:7px!important}
    body .tier-row .deck-chip .chip-sub,body .tier-row .deck-chip .chip-roles{display:none!important}
    body .tier-row .deck-chip .chip-tools{grid-template-columns:28px 28px minmax(75px,1fr)!important;gap:3px!important}
    body .tier-row .deck-chip .delete-mini{position:static!important;width:26px!important;height:26px!important;margin-top:5px!important}
    body .pool-section{padding:12px!important;margin-top:10px!important;min-width:0}
    body .section-head{gap:6px!important}
  }
  `;
  document.head.appendChild(css);
  const details=document.createElement("details");details.id="tierReadableTools";
  details.innerHTML='<summary>⚙ 編集・検索・ツール</summary><div class="tierReadableInner"></div>';
  const inner=details.querySelector(".tierReadableInner");
  toolbar.insertAdjacentElement("beforebegin",details);
  inner.appendChild(toolbar);
  if(actions) inner.appendChild(actions);
  const attachConvenience=()=>{const node=document.getElementById("tierConvenienceTools");if(node && node.parentElement!==inner)inner.appendChild(node)};
  attachConvenience();
  let scheduled=false;
  const refresh=()=>{
    scheduled=false;
    for(const row of board.querySelectorAll(".tier-row")){
      const amount=row.querySelectorAll(".tier-dropzone .deck-chip").length;
      row.dataset.empty=String(amount===0);
    }
    attachConvenience();
  };
  const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(refresh)});
  observer.observe(board,{childList:true,subtree:true});
  const toolObserver=new MutationObserver(()=>{if(document.getElementById("tierConvenienceTools")?.parentElement!==inner)attachConvenience()});
  toolObserver.observe(document.body,{childList:true});
  refresh();
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();
})();