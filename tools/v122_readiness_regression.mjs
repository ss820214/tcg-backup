import assert from 'node:assert/strict';
import {createRoomService,rememberMatch,readRememberedMatch} from '../public/room_session.js';
import {PRACTICE_DECK,validDeckMap} from '../public/starter_practice.js';
import {validateStoredMatchResult} from '../public/match_result_validation.js';
import {createAccountTransfer} from '../public/account_transfer.js';
import {createBattleConnection} from '../public/battle_connection.js';
const copy=x=>x==null?x:structuredClone(x), docs=new Map(), versions=new Map();
const snapshot=(path)=>{const data=copy(docs.get(path));return{exists:()=>data!==undefined,data:()=>data,metadata:{fromCache:false}}};
function put(path,value){docs.set(path,copy(value));versions.set(path,(versions.get(path)||0)+1);}
const api={db:{},doc:(_, ...parts)=>parts.join('/'),collection:(_, ...parts)=>parts.join('/'),Timestamp:{fromMillis:n=>({seconds:n/1000})},serverTimestamp:()=>Date.now(),getDocs:async prefix=>({docs:[...docs].filter(([k])=>k.startsWith(prefix+'/')&&k.slice(prefix.length+1).indexOf('/')<0).map(([k,v])=>({id:k.split('/').at(-1),data:()=>copy(v)}))}),runTransaction:async(_,fn)=>{
 for(let attempt=0;attempt<10;attempt++){
  const reads=new Map(),writes=[];let writing=false;
  const tx={get:async path=>{assert.equal(writing,false,'all transaction reads must precede writes');reads.set(path,versions.get(path)||0);return snapshot(path);},set:(p,v)=>{writing=true;writes.push(['set',p,v]);},update:(p,v)=>{writing=true;writes.push(['update',p,v]);},delete:p=>{writing=true;writes.push(['delete',p]);}};
  const result=await fn(tx);await Promise.resolve();
  if([...reads].some(([p,v])=>(versions.get(p)||0)!==v))continue;
  for(const [kind,p,v] of writes){if(kind==='delete'){docs.delete(p);versions.set(p,(versions.get(p)||0)+1);}else put(p,kind==='update'?{...docs.get(p),...v}:v);}
  return result;
 }throw Error('transaction retries exhausted');
}};
const rooms=createRoomService(api),args=(uid,playerId=uid,code='1234')=>({uid,playerId,code,profile:{name:uid,deck:PRACTICE_DECK},field:'grass'});
put('rooms/7777/game/state',{units:[]});await assert.rejects(rooms.enter({...args('new','new','7777'),mode:'create'}),/重複/);
await rooms.enter({...args('host'),mode:'create'});
const race=await Promise.allSettled([rooms.enter(args('second')),rooms.enter(args('third'))]);
assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.match(race.find(x=>x.status==='rejected').reason.message,/満員/);
assert.equal(docs.get('rooms/1234').memberIds.length,2);assert.equal((await api.getDocs('rooms/1234/players')).docs.length,2);
const resumed=await rooms.enter(args('host','different-id'));assert.equal(resumed.player,'host');assert.equal(docs.get('rooms/1234').memberIds.length,2);
await assert.rejects(rooms.enter({...args('new'),code:'4321'}),/見つかりません/);
await rooms.enter({...args('solo','solo','2222'),mode:'solo'});await assert.rejects(rooms.enter(args('intruder','intruder','2222')),/ソロ/);
put('rooms/3333',{memberIds:[],expiresAt:{seconds:1}});await assert.rejects(rooms.enter(args('late','late','3333')),/有効期限/);
put('rooms/4444',{memberIds:['a'],memberOwners:{a:'a'}});put('rooms/4444/game/match',{seatA:'a',seatB:'b'});await assert.rejects(rooms.enter(args('started','started','4444')),/開始/);
const other=docs.get('rooms/1234').memberIds.find(id=>id!=='host');await rooms.leave({code:'1234',uid:other,playerId:other});await rooms.enter(args('replacement'));
assert.equal(docs.get('rooms/1234').memberIds.length,2);
await assert.rejects(rooms.leave({code:'1234',uid:'fake',playerId:'host'}),/本人/);
await rooms.leave({code:'1234',uid:'host',playerId:'host'});await assert.rejects(rooms.enter(args('closed')),/終了/);
const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
rememberMatch({room:'5678',player:'member',uid:'u'},storage);assert.ok(readRememberedMatch('u',storage));rememberMatch({room:'6789',player:'second',uid:'other'},storage);assert.ok(readRememberedMatch('u',storage));assert.equal(readRememberedMatch('unknown',storage),null);
assert.ok(validDeckMap(PRACTICE_DECK));assert.equal(Object.values(PRACTICE_DECK).reduce((s,n)=>s+n,0),30);assert.equal(validDeckMap({bad:30}),false);assert.equal(validDeckMap({a:3.5}),false);
const claim={uid:'u',playerId:'p',seat:'A',winner:'A',result:'win',match:{seatA:'p',seatB:'q'},state:{winner:'A',turnSeq:7,kills:{A:3}},player:{uid:'u'}};
assert.equal(validateStoredMatchResult(claim).turnSeq,7);
for(const patch of [{uid:'x'},{playerId:'q'},{seat:'B'},{winner:'B'},{result:'lose'},{state:{}},{player:{uid:'x'}}])assert.equal(validateStoredMatchResult({...claim,...patch}),null);
let current={uid:'old',isAnonymous:true,providerData:[],getIdToken:async()=>'token'};let signIns=0;
const account=createAccountTransfer({auth:{get currentUser(){return current;}},ensureUser:async()=>current,profileFor:async()=>({name:'player',deck:PRACTICE_DECK}),linkWithCredential:async()=>{},credential:(e,p)=>({e,p}),signIn:async()=>{signIns++;current={uid:'new'};return current;},probe:async()=>({uid:'new'}),storage,apiKey:'fake'});
assert.equal((await account.link('player@example.test','test-password-123')).uid,'old');
assert.equal(await account.login('player@example.test','test-password-123',async()=>false),null);assert.equal(signIns,0);assert.equal(current.uid,'old');
assert.equal((await account.login('player@example.test','test-password-123',async()=>true)).uid,'new');assert.ok(store.has('tcg_pending_cloud_deck_v20260822'));
const failed=createAccountTransfer({auth:{get currentUser(){return current;}},probe:async()=>{throw Error('bad login')},storage,apiKey:'fake'});await assert.rejects(failed.login('player@example.test','test-password-123',async()=>true),/bad login/);assert.equal(current.uid,'new');
// Email privacy-protection fallback must include an existing ID token and keep the UID.
let fetched=0;const anon={uid:'keep',isAnonymous:true,providerData:[],getIdToken:async()=>''};
const fallback=createAccountTransfer({auth:{currentUser:anon},ensureUser:async()=>anon,profileFor:async()=>({}),credential:()=>({}),linkWithCredential:async()=>{throw{code:'auth/operation-not-allowed',message:'verify the new email before changing email'};},signIn:async()=>{throw Error('must not sign in');},storage,apiKey:'test',fetcher:async()=>{fetched++;return{ok:true,json:async()=>({localId:'wrong'})};}});
await assert.rejects(fallback.link('player@example.test','test-password-123'),/認証情報/);assert.equal(fetched,0);
anon.getIdToken=async()=>'existing-token';await assert.rejects(fallback.link('player@example.test','test-password-123'),/UID/);assert.equal(fetched,1);
function element(){return{hidden:false,style:{},children:[],setAttribute(){},append(...xs){this.children.push(...xs)},addEventListener(){},remove(){}};}
const doc={...element(),hidden:false,body:{prepend(){}},createElement:element,addEventListener(){},removeEventListener(){}};
const listeners={},win={navigator:{onLine:true},addEventListener:(k,v)=>listeners[k]=v,removeEventListener(){}};
let fail=false,refreshes=0,identity=true;
const connection=createBattleConnection({doc,win,identity:()=>identity,refresh:async()=>{refreshes++;if(fail)throw Error('offline');return{exists:()=>true,metadata:{fromCache:false}};}});
assert.equal(connection.canAct(),false);connection.observe({exists:()=>true,metadata:{fromCache:true}});assert.equal(connection.canAct(),false);
connection.observe({exists:()=>true,metadata:{fromCache:false}});assert.equal(connection.canAct(),true);
identity=false;assert.equal(connection.canAct(),false);identity=true;
win.navigator.onLine=false;listeners.offline();assert.equal(connection.canAct(),false);
win.navigator.onLine=true;await Promise.all([connection.reconnect(),connection.reconnect()]);assert.equal(refreshes,1);assert.equal(connection.canAct(),true);
fail=true;await connection.reconnect();assert.equal(connection.canAct(),false);connection.dispose();
console.log('PASS v1.2.2: concurrent admission, re-entry, closed/expired/solo/started/full rooms, exit, practice deck, result identity, transfer safety and cached/offline/reconnect controls');
