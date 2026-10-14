(()=>{"use strict";
function restore(){
 const board=document.getElementById("board"),app=document.getElementById("app");
 if(!board||!app)return;
 const init=()=>{
  if(board.querySelectorAll(":scope > .cell").length)return;
  const frag=document.createDocumentFragment();
  for(let y=0;y<7;y++)for(let x=0;x<5;x++){const cell=document.createElement("div");cell.className="recoveryCell";cell.dataset.x=String(x);cell.dataset.y=String(y);frag.appendChild(cell);}
  board.appendChild(frag);
 };
 setTimeout(()=>{if(!board.querySelector(".cell"))init();},5000);
 const css=document.createElement("style");css.id="battleBoardRecovery20261015";css.textContent=`
 @media(max-width:760px) and (orientation:portrait){
  html,body{height:auto!important;min-height:100dvh!important;overflow-y:auto!important;overflow-x:hidden!important}
  body{padding-bottom:90px!important}
  #app{display:flex!important;flex-direction:column!important;gap:10px!important;width:100%!important;height:auto!important;min-height:calc(100dvh - 80px)!important;overflow:visible!important;padding:10px!important}
  #centerPane{display:flex!important;order:0!important;position:relative!important;min-height:0!important;width:100%!important;max-width:100%!important;overflow:visible!important;align-items:center!important;justify-content:center!important}
  #board{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;grid-template-rows:repeat(7,minmax(0,1fr))!important;gap:4px!important;width:min(100%,460px)!important;height:auto!important;min-height:410px!important;aspect-ratio:5/7!important;max-height:none!important;visibility:visible!important;opacity:1!important;margin:0 auto!important;padding:6px!important;overflow:visible!important}
  #board>.cell,#board>.recoveryCell{display:block!important;position:relative!important;width:100%!important;height:100%!important;min-height:0!important;min-width:0!important;box-sizing:border-box!important;visibility:visible!important;opacity:1!important;border:1px solid rgba(109,201,210,.3)!important;border-radius:5px!important}
  #leftPane,#rightPane{display:block!important;position:relative!important;order:1!important;width:100%!important;max-width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;visibility:visible!important;opacity:1!important}
  #rightPane{order:2!important}
  #mobileBattleNav{display:flex!important;position:fixed!important;bottom:10px!important;left:10px!important;right:10px!important;z-index:3000!important;gap:6px!important;justify-content:center!important}
  #mobileBattleNav button{flex:1!important;min-height:42px!important}
 }
 `;document.head.appendChild(css);
 const indicator=document.createElement("div");indicator.id="boardRecoveryStatus";indicator.setAttribute("role","status");indicator.style.cssText="display:none;margin:8px auto;padding:10px;border:1px solid #a78636;border-radius:9px;color:#ffe7aa;background:#30280d;font-size:13px;width:min(100%,460px)";
 board.insertAdjacentElement("afterend",indicator);
 setTimeout(()=>{if(!board.querySelector(".cell .unitBox")&&!board.querySelector(".cell .uName")&&board.querySelectorAll(".cell").length===35){indicator.style.display="block";indicator.textContent="盤面を表示しています。キャラが表示されない場合は、ルームの同期が完了していない可能性があります。";}},6500);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",restore,{once:true});else restore();
})();