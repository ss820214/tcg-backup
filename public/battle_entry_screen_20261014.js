(()=>{"use strict";
function init(){
 const drawer=document.getElementById("roomDrawer"), close=document.getElementById("roomDrawerClose"), overlay=document.getElementById("roomDrawerOverlay");
 if(!drawer||document.getElementById("battleDeckChoice"))return;
 const body=document.querySelector("#roomDrawer .roomDrawerBody");
 if(body){
   const section=document.createElement("section");section.id="battleDeckChoice";section.className="roomOpCard";
   section.innerHTML='<div class="roomOpCardHd"><b>使用するデッキ</b><span class="small">対戦で使う30枚を確認</span></div><div class="roomOpCardBd"><div class="battleDeckChoiceLine"><button type="button" id="battleUseCurrentDeck">編集中のデッキを使う</button><button type="button" id="battleChooseSavedDeck">保存済みデッキを選ぶ</button></div><p id="battleDeckChoiceNote" role="status">現在のデッキを使用します。保存済みデッキは一覧からロードできます。</p></div>';
   const start=body.querySelector(".roomOpCard");if(start)start.before(section);else body.prepend(section);
   section.querySelector("#battleUseCurrentDeck").addEventListener("click",()=>{const el=document.getElementById("battleDeckChoiceNote");if(el)el.textContent="現在編集中のデッキを使います。下の開始方法を選んでください。";});
   section.querySelector("#battleChooseSavedDeck").addEventListener("click",()=>{location.href="./deck_list.html?mode=my&return=battle";});
 }
 const quit=()=>{document.body.classList.remove("battleEntryScreen");};
 close?.addEventListener("click",quit);
 overlay?.addEventListener("click",e=>{if(e.target===overlay)quit();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")quit();});
 const style=document.createElement("style");style.id="battleEntryScreenCss";style.textContent=`
 body.battleEntryScreen{overflow:hidden!important}
 body.battleEntryScreen #roomDrawer{position:fixed!important;inset:0!important;width:100vw!important;max-width:100vw!important;height:100dvh!important;transform:none!important;z-index:100010!important;display:flex!important;visibility:visible!important;opacity:1!important;border:0!important;border-radius:0!important;background:#0b111a!important}
 body.battleEntryScreen #roomDrawerOverlay{display:none!important}
 body.battleEntryScreen #roomDrawerHead,body.battleEntryScreen .roomDrawerHead{flex:0 0 auto!important;padding-top:max(14px,env(safe-area-inset-top))!important}
 body.battleEntryScreen #roomDrawer .roomDrawerBody{min-height:0!important;flex:1 1 auto!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;padding:12px!important;padding-bottom:max(28px,env(safe-area-inset-bottom))!important}
 body.battleEntryScreen #roomDrawer .roomOpCard{min-width:0!important;max-width:100%!important}
 #battleDeckChoice .battleDeckChoiceLine{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
 #battleDeckChoice button{min-width:0;min-height:44px;padding:9px;border:1px solid #598d9c;border-radius:12px;background:#183039;color:#f4fbff;font-weight:800;overflow-wrap:anywhere}
 #battleDeckChoiceNote{font-size:12px;line-height:1.5;color:#b8d0d9;margin:10px 0 0}
 @media(max-width:420px){#battleDeckChoice .battleDeckChoiceLine{grid-template-columns:1fr}}
 #deckPanel .deckSaveDock .deckLibSaveBtns,#deckPanel .deckSaveDock .deckLibSaveBtns button,#deckPanel .deckSaveDock [data-save-new],#deckPanel .deckSaveDock [data-save-update]{display:none!important}
 #deckPanel #btnSave{display:block!important}
 `;document.head.appendChild(style);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();