(()=>{"use strict";
function init(){
 const nav=document.getElementById("mobileBattleNav"), board=document.getElementById("board"), center=document.getElementById("centerPane");
 if(!nav||!board||!center)return;
 const panes={leftPane:document.getElementById("leftPane"),rightPane:document.getElementById("rightPane")};
 const mobile=()=>window.innerWidth<=760;
 const slots=new Map(); let open="";
 for(const [id,p] of Object.entries(panes)){if(!p)continue;const marker=document.createComment(id+" position");p.before(marker);slots.set(id,marker)}
 const shade=document.createElement("div");shade.id="mobileBattlePopupShade";shade.setAttribute("aria-hidden","true");document.body.append(shade);
 const buttons=[...nav.querySelectorAll("button[data-jump-target]")];
 function restore(id){const el=panes[id],marker=slots.get(id);if(el&&marker&&el.parentElement!==marker.parentElement)marker.after(el);el?.classList.remove("mobileBattlePopupActive");for(const prop of ["display","visibility","opacity","z-index"])el?.style.removeProperty(prop)}
 function close(){open="";document.body.classList.remove("mobileBattlePopupOpen");Object.keys(panes).forEach(restore);buttons.forEach(b=>{b.classList.remove("active");b.setAttribute("aria-expanded","false")})}
 function toggle(id){if(!mobile())return;if(id==="centerPane"||open===id){close();return}close();const p=panes[id];if(!p)return;open=id;document.body.append(p);p.classList.add("mobileBattlePopupActive");document.body.classList.add("mobileBattlePopupOpen");p.style.setProperty("display","block","important");p.style.setProperty("visibility","visible","important");p.style.setProperty("opacity","1","important");p.style.setProperty("z-index","2147483001","important");buttons.forEach(b=>{const yes=b.dataset.jumpTarget===id;b.classList.toggle("active",yes);b.setAttribute("aria-expanded",String(yes))})}
 nav.addEventListener("click",ev=>{if(!mobile())return;const b=ev.target.closest("button[data-jump-target]");if(!b)return;ev.preventDefault();ev.stopImmediatePropagation();toggle(b.dataset.jumpTarget)},true);
 shade.addEventListener("click",close);document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});window.addEventListener("resize",()=>{if(!mobile())close()});
 // Reuse the actual gameplay gauge so its illuminated diamonds, bonus mana,
 // and spent mana always match the controls panel. Never duplicate the gauge.
 const gauge=document.getElementById("manaGauge");
 const gaugeHome=document.createComment("mana gauge home");
 if(gauge)gauge.before(gaugeHome);
 const meter=document.createElement("section");
 meter.id="battleManaQuick";
 meter.setAttribute("aria-label","マナ状況");
 meter.innerHTML='<span class="manaQuickLabel">マナ</span><div id="battleManaQuickGauge"></div><strong id="battleManaQuickValue"></strong>';
 center.append(meter);
 const gaugeSlot=meter.querySelector("#battleManaQuickGauge");
 const mana=document.getElementById("mana");
 const value=meter.querySelector("#battleManaQuickValue");
 const update=()=>{
  const text=(mana?.textContent||"A ?/? | B ?/?").trim();
  const my=(text.match(/A\\s*(\\d+)\\s*\\/\\s*(\\d+)/)||[]);const other=(text.match(/B\\s*(\\d+)\\s*\\/\\s*(\\d+)/)||[]);
  const seat=(document.getElementById("you")?.textContent||"A").trim().toUpperCase();
  const pair=seat==="B"?other:my;
  const label=pair.length?pair[1]+"/"+pair[2]:text.replace(/\s*\|\s*/g," ｜ ");
  value.textContent=label;
 };
 const position=()=>{
  if(!gauge)return;
  if(mobile()){if(gauge.parentElement!==gaugeSlot)gaugeSlot.append(gauge)}
  else if(gaugeHome.parentNode&&gauge.previousSibling!==gaugeHome){gaugeHome.after(gauge)}
 };
 const reposition=()=>{const note=document.getElementById("boardRecoveryStatus");if(note&&note.parentNode===center){meter.after(note);note.classList.add("battleSyncSmall");}};reposition();new MutationObserver(reposition).observe(center,{childList:true});
 update();position();
 if(mana)new MutationObserver(update).observe(mana,{subtree:true,childList:true,characterData:true});
 window.addEventListener("resize",position);
 const css=document.createElement("style");css.id="gameTabsAndMana20261015";css.textContent=`
 #boardRecoveryStatus.battleSyncSmall{display:block!important;max-width:min(100%,460px)!important;margin:4px auto 10px!important;padding:4px 8px!important;background:transparent!important;border:0!important;color:#84929f!important;box-shadow:none!important;font-size:10px!important;line-height:1.4!important} #battleManaQuick{display:flex;align-items:center;justify-content:space-between;gap:12px;width:min(100%,460px);padding:10px 14px;margin:9px auto;border:1px solid rgba(241,196,95,.55);background:linear-gradient(110deg,#272012,#182d32);border-radius:13px;color:#f8e4ad;box-shadow:0 3px 18px #0006}
 #battleManaQuick .manaQuickLabel{font-weight:900;font-size:14px}
 #battleManaQuickGauge{flex:1;min-width:0}#battleManaQuickGauge #manaGauge{margin:0!important;display:flex!important;min-width:0!important;max-height:none!important;gap:5px!important;flex-wrap:wrap!important}#battleManaQuickValue{font-size:clamp(16px,4.5vw,20px);letter-spacing:.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
 @media(min-width:761px){#battleManaQuick{display:none}}
 @media(max-width:760px) and (orientation:portrait){
 #board .uName{font-size:clamp(10px,2.8vw,13px)!important;line-height:1.15!important;font-weight:850!important;max-height:3.5em!important;overflow-wrap:anywhere!important;text-shadow:0 1px 3px #000,0 0 3px #000!important}
 body:not(.mobileBattlePopupOpen) #leftPane,body:not(.mobileBattlePopupOpen) #rightPane{display:none!important}
 #mobileBattlePopupShade{display:none;position:fixed;inset:0;background:#0009;z-index:2147483000;pointer-events:auto}
 body.mobileBattlePopupOpen #mobileBattlePopupShade{display:block}
 body.mobileBattlePopupOpen #leftPane:not(.mobileBattlePopupActive),body.mobileBattlePopupOpen #rightPane:not(.mobileBattlePopupActive){display:none!important}
 body.mobileBattlePopupOpen #leftPane.mobileBattlePopupActive,body.mobileBattlePopupOpen #rightPane.mobileBattlePopupActive{display:block!important;position:fixed!important;left:10px!important;right:10px!important;top:max(12px,env(safe-area-inset-top))!important;bottom:90px!important;z-index:2147483001!important;width:auto!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;pointer-events:auto!important;touch-action:pan-y!important;background:#111b29!important;box-shadow:0 12px 48px #000e!important;border:1px solid #48818e!important;border-radius:17px!important;padding:16px!important}
 body.mobileBattlePopupOpen #leftPane.mobileBattlePopupActive *,body.mobileBattlePopupOpen #rightPane.mobileBattlePopupActive *{pointer-events:auto!important}
 #mobileBattleNav{z-index:2147483002!important;pointer-events:auto!important}
 #mobileBattleNav button{pointer-events:auto!important;touch-action:manipulation!important}
 #mobileBattleNav button.active{border-color:#70d4d1!important;box-shadow:0 0 12px #25a6a855!important}
 }
 `;document.head.append(css);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();