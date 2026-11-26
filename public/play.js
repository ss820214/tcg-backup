import {ensureSignedIn,db} from './auth.js?v=20260627_user1';
import {doc,collection,getDoc,getDocFromServer,getDocs,setDoc,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {createRoomService,rememberMatch,readRememberedMatch,forgetMatch} from './room_session.js?v=20261116_v122';
import {PRACTICE_DECK,validDeckMap} from './starter_practice.js?v=20261116_v122';
const $=id=>document.getElementById(id),KEY='tcg_deck_local_v20260202_30',TITLE='tcg_deck_title_v20260204',NAME='tcg_player_name_v20260202_30',FIELD='tcg_desired_field_v20260702',EX='tcg_ex_support_v20260202_30';
import {normalizeGameMode} from './invasion_rules.js?v=1';
const rooms=createRoomService({db,doc,collection,getDocs,runTransaction,serverTimestamp,Timestamp});
let deck={},busy=false,user=null;
const msg=text=>{$('message').textContent=text;};
function info(){
 try{const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');deck=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch{deck={}}
 const count=Object.values(deck).reduce((s,n)=>s+(Number.isInteger(n)&&n>0?n:0),0),valid=validDeckMap(deck);
 $('deckCount').textContent=count+' / 30';$('deckTitle').textContent=localStorage.getItem(TITLE)||'編集中のデッキ';
 $('deckStatus').textContent=valid?'準備完了・このデッキで対戦できます':count+'枚です。30枚・同名4枚までにしてください';
 for(const id of ['solo','create','join'])$(id).disabled=busy||!valid;
 $('practiceDeck').textContent=count?'練習デッキへ切り替える':'はじめての30枚デッキを用意する';
 return valid;
}
$('playerName').value=localStorage.getItem(NAME)||'player';$('refreshDeck').onclick=info;
$('practiceDeck').onclick=()=>{
 if(busy)return;
 if(Object.keys(deck).length&&!confirm('編集中のデッキを練習用30枚へ切り替えます。保存済みのデッキは残ります。切り替えますか？'))return;
 localStorage.setItem('tcg_draft_before_practice_v122',JSON.stringify({deck,title:localStorage.getItem(TITLE)||'',exSupport:localStorage.getItem(EX)||''}));
 localStorage.setItem(KEY,JSON.stringify(PRACTICE_DECK));localStorage.setItem(TITLE,'はじめての練習デッキ');localStorage.removeItem(EX);info();
 $('restoreDraft').hidden=false;msg('30枚を用意しました。「ソロ開始」でCPUと練習できます。元の編集中デッキは下のボタンで戻せます。');
};
$('restoreDraft').onclick=()=>{
 if(busy)return;
 try{const saved=JSON.parse(localStorage.getItem('tcg_draft_before_practice_v122')||'null');if(!saved)return;
 localStorage.setItem(KEY,JSON.stringify(saved.deck||{}));localStorage.setItem(TITLE,saved.title||'');localStorage.setItem(EX,saved.exSupport||'');localStorage.removeItem('tcg_draft_before_practice_v122');$('restoreDraft').hidden=true;info();msg('元の編集中デッキへ戻しました。');}catch{msg('編集中デッキを復元できませんでした。保存済みデッキから選び直してください。');}
};
$('restoreDraft').hidden=!localStorage.getItem('tcg_draft_before_practice_v122');
info();window.addEventListener('pageshow',info);document.addEventListener('visibilitychange',()=>{if(!document.hidden)info()});
const fieldNames={grass:'草原',danger:'危険地帯',swamp:'沼地'},validField=id=>Object.hasOwn(fieldNames,id)?id:'grass';
function go(session){
 rememberMatch({...session,uid:user.uid});
 const url=new URL(session.started?'./game.html':'./battle.html',location.href);
 for(const key of ['room','player','field','gameMode'])url.searchParams.set(key,session[key]);
 if(session.solo){url.searchParams.set('solo','1');url.searchParams.set('mode','solo')}
 location.assign(url.href);
}
async function start(mode){
 if(busy||!info())return;
 let code=mode==='join'?$('joinCode').value.trim():String(Math.floor(1000+Math.random()*9000));
 if(!/^\d{4}$/.test(code)||code==='0000')return msg('ルーム番号は0000以外の4桁を入力してね。');
 busy=true;info();msg('対戦ルームを準備中…');
 try{
  user=await ensureSignedIn();const name=$('playerName').value.trim().slice(0,24)||'player',field=validField(localStorage.getItem(FIELD)||'grass');
  localStorage.setItem(NAME,name);const playerId=crypto.randomUUID();
  const profile={name,deck,exSupport:localStorage.getItem(EX)||'',deckTitle:localStorage.getItem(TITLE)||'',desiredField:field};
  let session;
  for(let attempt=0;attempt<24;attempt++){
   try{session=await rooms.enter({code,uid:user.uid,playerId,profile,mode,field,gameMode:normalizeGameMode(document.querySelector('input[name="gameMode"]:checked')?.value)});break;}
   catch(error){if(mode==='join'||!String(error.message).includes('重複')||attempt===23)throw error;code=String(Math.floor(1000+Math.random()*9000));}
  }
  // Room entry has already committed. Optional profile saving must never strand a seat.
  try{await setDoc(doc(db,'users',user.uid),{name,playerName:name,displayName:name,...profile,updatedAt:serverTimestamp()},{merge:true});}catch(error){console.warn('[play] profile save skipped',error?.code);}
  localStorage.setItem(FIELD,session.field);go(session);
 }catch(error){console.error('[play]',error);msg('開始できませんでした: '+(error?.message||error));busy=false;info();}
}
$('solo').onclick=()=>start('solo');$('create').onclick=()=>start('create');$('join').onclick=()=>start('join');
$('joinCode').value=new URLSearchParams(location.search).get('code')||'';
async function refreshResume(){
 try{user=await ensureSignedIn();const saved=readRememberedMatch(user.uid);if(!saved)return;
 const [r,p,m,s]=await Promise.all([getDocFromServer(doc(db,'rooms',saved.room)),getDocFromServer(doc(db,'rooms',saved.room,'players',saved.player)),getDocFromServer(doc(db,'rooms',saved.room,'game','match')),getDocFromServer(doc(db,'rooms',saved.room,'game','state'))]);
 if(!r.exists()||r.data()?.status==='closed'||!p.exists()||p.data()?.uid!==user.uid||s.data()?.winner){forgetMatch(user.uid);return;}
 $('resumePanel').hidden=false;$('resumeLabel').textContent='ルーム '+saved.room+(m.exists()?'：進行中の対戦':'：待機中');
 $('resumeMatch').onclick=()=>go({...saved,gameMode:normalizeGameMode(m.data()?.gameMode||r.data()?.gameMode),started:m.exists()});
 }catch(error){console.warn('[play] resume lookup unavailable',error?.code);}
}
void refreshResume();
const selected=new URLSearchParams(location.search).get('deckSelected')==='1';
if(selected){$('chosenDeckConfirm')?.classList.remove('hidden');$('confirmDeck')?.addEventListener('click',()=>{localStorage.removeItem('tcg_pending_cloud_deck_v20260822');$('chosenDeckConfirm').classList.add('hidden');$('deckStatus').textContent='使用デッキを決定しました';history.replaceState(null,'',location.pathname);$('solo').scrollIntoView({behavior:'smooth',block:'center'});});}
