import {ensureSignedIn,db} from "./auth.js?v=20260627_user1";
import {doc,getDoc,setDoc,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
const $=id=>document.getElementById(id),KEY="tcg_deck_local_v20260202_30",TITLE="tcg_deck_title_v20260204",NAME="tcg_player_name_v20260202_30",FIELD="tcg_desired_field_v20260702",EX="tcg_ex_support_v20260202_30";
let deck={};const info=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||"{}");deck=v&&typeof v==="object"&&!Array.isArray(v)?v:{}}catch{deck={}}const count=Object.values(deck).reduce((s,x)=>s+Math.max(0,Number(x)||0),0);$("deckCount").textContent=count+" / 30";$("deckStatus").textContent=count===30?"準備完了・このデッキで対戦できます":count+"枚です。30枚にしてから開始してください";$("deckTitle").textContent=localStorage.getItem(TITLE)||"編集中のデッキ";for(const id of ["solo","create","join"])$(id).disabled=count!==30;return count};
$("playerName").value=localStorage.getItem(NAME)||"player";$("refreshDeck").onclick=info;info();window.addEventListener("pageshow",info);document.addEventListener("visibilitychange",()=>{if(!document.hidden)info()});
const selected=new URLSearchParams(location.search).get("deckSelected")==="1";
if(selected){
  // The deck list stores the selected deck in localStorage before navigation.
  const panel=$("chosenDeckConfirm");panel?.classList.remove("hidden");
  $("confirmDeck")?.addEventListener("click",()=>{
    try{localStorage.removeItem("tcg_pending_cloud_deck_v20260822")}catch{}
    panel?.classList.add("hidden");
    $("deckStatus").textContent="使用デッキを決定しました";
    history.replaceState(null,"",location.pathname);
    document.getElementById("solo")?.scrollIntoView({behavior:"smooth",block:"center"});
  });
}
const fieldPicker=$("fieldSelect");
const fieldStatus=$("fieldStatus");
const fieldNames={grass:"草原",danger:"危険地帯",swamp:"沼地"};
const validField=id=>Object.hasOwn(fieldNames,id)?id:"grass";
let confirmedField=validField(localStorage.getItem(FIELD)||"grass");
if(fieldPicker){
  fieldPicker.value=confirmedField;
  fieldStatus.textContent="決定済み: "+fieldNames[confirmedField];
  fieldPicker.addEventListener("change",()=>{
    fieldStatus.textContent="未決定: "+fieldNames[validField(fieldPicker.value)]+"（決定ボタンを押してね）";
  });
}
$("confirmField")?.addEventListener("click",()=>{
  confirmedField=validField(fieldPicker.value);
  localStorage.setItem(FIELD,confirmedField);
  fieldStatus.textContent="決定済み: "+fieldNames[confirmedField];
});
let busy=false;const msg=s=>$("message").textContent=s;
async function start(mode){if(busy)return;if(info()!==30)return msg("30枚ちょうどのデッキが必要です。");const code=mode==="join"?$("joinCode").value.trim():String(Math.floor(1000+Math.random()*9000));if(!/^\d{4}$/.test(code)||code==="0000")return msg("ルーム番号は0000以外の4桁を入力してね。");busy=true;for(const b of ["solo","create","join"])$(b).disabled=true;msg("対戦ルームを準備中...");try{const user=await ensureSignedIn();const name=$("playerName").value.trim().slice(0,24)||"player";if(fieldPicker && validField(fieldPicker.value)!==confirmedField) return msg("フィールドを決定してから開始してね。");let field=confirmedField;localStorage.setItem(NAME,name);localStorage.setItem(FIELD,field);const player=crypto.randomUUID?.()||"p"+Math.random().toString(16).slice(2);const roomRef=doc(db,"rooms",code);if(mode==="join"){const r=await getDoc(roomRef);if(!r.exists())throw Error("指定されたルームが見つかりません。番号を確認してね。");field=validField(r.data()?.desiredField||r.data()?.fieldId||r.data()?.field?.id||field);localStorage.setItem(FIELD,field);}else{const r=await getDoc(roomRef);if(r.exists())throw Error("ルーム番号が重複しました。もう一度開始してください。");}
const common={desiredField:field,fieldId:field,field:{id:field},lastActiveAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+30*60000)};if(mode!=="join")await setDoc(roomRef,{...common,createdAt:serverTimestamp(),...(mode==="solo"?{mode:"solo",solo:true}:{})},{merge:true});
await setDoc(doc(db,"rooms",code,"players",player),{uid:user.uid,name,deck,exSupport:localStorage.getItem(EX)||"",deckTitle:localStorage.getItem(TITLE)||"",desiredField:field,ready:false,updatedAt:serverTimestamp()},{merge:true});
await setDoc(doc(db,"users",user.uid),{name,playerName:name,displayName:name,deck,deckTitle:localStorage.getItem(TITLE)||"",exSupport:localStorage.getItem(EX)||"",desiredField:field,updatedAt:serverTimestamp()},{merge:true});
if(mode==="solo")await setDoc(doc(db,"rooms",code,"players","cpu"),{name:"CPU",deck,exSupport:"",deckTitle:"CPU",desiredField:field,ready:true,isCpu:true,updatedAt:serverTimestamp()},{merge:true});
const url=new URL("./battle.html",location.href);url.searchParams.set("room",code);url.searchParams.set("player",player);url.searchParams.set("field",field);if(mode==="solo"){url.searchParams.set("solo","1");url.searchParams.set("mode","solo")}location.assign(url.href);
}catch(e){console.error("[play]",e);msg("開始できませんでした: "+(e?.message||e));busy=false;info();}}
$("solo").onclick=()=>start("solo");$("create").onclick=()=>start("create");$("join").onclick=()=>start("join");