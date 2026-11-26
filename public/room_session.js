// One transaction owns room capacity and participant creation. No auth tokens are stored.
export const ROOM_SESSION_VERSION = '20261116_v122';
export function validRoomCode(value) { return /^\d{4}$/.test(String(value||'')) && value !== '0000'; }
export function roomExpiry(data) {
 const value=data?.expiresAt;
 return value?.toMillis?.() ?? (Number.isFinite(value?.seconds)?value.seconds*1000:0);
}
export function createRoomService(api) {
 const {db,doc,collection,getDocs,runTransaction,serverTimestamp,Timestamp}=api;
 const roomRef=code=>doc(db,'rooms',code), memberRef=(code,id)=>doc(db,'rooms',code,'players',id), matchRef=code=>doc(db,'rooms',code,'game','match');
 const expires=()=>Timestamp.fromMillis(Date.now()+30*60000);
 async function enter({code,uid,playerId,profile={},mode='join',field='grass',gameMode='default'}) {
  if(!validRoomCode(code)||!uid||!playerId||playerId==='cpu')throw Error('参加情報を確認できません。対戦準備から入り直してください。');
  const creating=mode==='create'||mode==='solo';
  const legacy=(await getDocs(collection(db,'rooms',code,'players'))).docs.map(d=>({id:d.id,...d.data()}));
  return runTransaction(db,async tx=>{
   const room=await tx.get(roomRef(code)),match=await tx.get(matchRef(code));
   const priorState=creating?await tx.get(doc(db,'rooms',code,'game','state')):null;
   if(creating&&(room.exists()||match.exists()||priorState?.exists()||legacy.length))throw Error('ルーム番号が重複しました。もう一度開始してください。');
   if(!creating&&!room.exists())throw Error('ルームが見つかりません。番号を確認してください。');
   const data=room.data()||{};
   const members=Array.isArray(data.memberIds)?data.memberIds:legacy.map(p=>p.id);
   const owners=data.memberOwners||Object.fromEntries(legacy.filter(p=>p.uid).map(p=>[p.id,p.uid]));
   const previous=members.find(id=>id!=='cpu'&&owners[id]===uid);
   const id=previous||playerId;
   const member=await tx.get(memberRef(code,id));
   const own=member.exists()&&(member.data()?.uid===uid || owners[id]===uid);
   if(member.exists()&&!own)throw Error('この参加情報は使用できません。対戦準備から入り直してください。');
   if(!creating){
    if(data.status==='closed')throw Error('このルームは終了しています。新しいルームを作成してください。');
    if(!own&&roomExpiry(data)&&roomExpiry(data)<=Date.now())throw Error('このルームの有効期限が切れています。');
    if(!own&&(data.solo===true||data.mode==='solo'))throw Error('ソロ用ルームには参加できません。');
    if(!own&&(match.exists()||data.status==='playing'))throw Error('このルームは既に対戦を開始しています。');
    if(!own&&!members.includes(id)&&members.length>=2)throw Error('このルームは満員です（2人参加済み）。');
   }
   const next=[...new Set([...members,id,...(mode==='solo'?['cpu']:[])])];
   if(next.length>2)throw Error('このルームは満員です（2人参加済み）。');
   const nextOwners={...owners,[id]:uid,...(mode==='solo'?{cpu:uid}:{})};
   const patch={memberIds:next,memberOwners:nextOwners,lastActiveAt:serverTimestamp(),expiresAt:expires()};
   if(creating)tx.set(roomRef(code),{...patch,status:'waiting',ownerUid:uid,createdAt:serverTimestamp(),desiredField:field,fieldId:field,field:{id:field},mode:mode==='solo'?'solo':'versus',solo:mode==='solo',...(gameMode==='invasion'?{gameMode:'invasion'}:{})});
   else tx.update(roomRef(code),patch);
   // Re-entry preserves the match's chosen deck and READY state.
   if(!own)tx.set(memberRef(code,id),{...profile,uid,ready:false,joinedAt:serverTimestamp(),updatedAt:serverTimestamp()});
   if(mode==='solo')tx.set(memberRef(code,'cpu'),{name:'CPU',isCpu:true,uid,deck:profile.deck||{},exSupport:'',ready:true,desiredField:field,updatedAt:serverTimestamp()});
   return{room:code,player:id,field:creating?field:(data.fieldId||data.desiredField||field),solo:creating?mode==='solo':data.solo===true,started:match.exists(),gameMode:(creating?gameMode:(match.data()?.gameMode||data.gameMode))==='invasion'?'invasion':'default'};
  });
 }
 async function leave({code,playerId,uid}) {
  return runTransaction(db,async tx=>{
   const room=await tx.get(roomRef(code)),match=await tx.get(matchRef(code)),member=await tx.get(memberRef(code,playerId));
   if(!room.exists()||!member.exists())return;
   if(member.data()?.uid!==uid)throw Error('本人の参加情報を確認できません。');
   if(match.exists())throw Error('対戦は開始済みです。対戦画面から再開してください。');
   const data=room.data()||{},ids=(data.memberIds||[]).filter(id=>id!==playerId),owners={...data.memberOwners};delete owners[playerId];
   tx.delete(memberRef(code,playerId));
   tx.update(roomRef(code),{memberIds:ids,memberOwners:owners,status:data.ownerUid===uid?'closed':'waiting',lastActiveAt:serverTimestamp()});
  });
 }
 return {enter,leave};
}
export const ACTIVE_MATCH_KEY='tcg_active_match_v122';
export function rememberMatch(session,storage=localStorage){try{storage.setItem(ACTIVE_MATCH_KEY+':'+session.uid,JSON.stringify({...session,at:Date.now()}));}catch{}}
export function readRememberedMatch(uid,storage=localStorage){try{const s=JSON.parse(storage.getItem(ACTIVE_MATCH_KEY+':'+uid)||storage.getItem(ACTIVE_MATCH_KEY)||'null');return s?.uid===uid&&validRoomCode(s.room)&&typeof s.player==='string'?s:null;}catch{return null;}}
export function forgetMatch(uid,storage=localStorage){try{if(uid)storage.removeItem(ACTIVE_MATCH_KEY+':'+uid);const old=JSON.parse(storage.getItem(ACTIVE_MATCH_KEY)||'null');if(old?.uid===uid)storage.removeItem(ACTIVE_MATCH_KEY);}catch{}}
