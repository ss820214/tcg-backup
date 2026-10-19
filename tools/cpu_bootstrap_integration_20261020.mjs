// node tools/cpu_bootstrap_integration_20261020.mjs
// Run the REAL game.js Firestore bootstrap in a transactional mock.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const guard=vm.runInNewContext(read("public/cpu_deck_guard.js").replace(/^export /gm,"")+
  "\n({inspectCpuDeck,expandCpuDeck,needsCpuOpeningRepair})");
const game=read("public/game.js");
const start=game.indexOf("async function ensureStateInitialized() {");
const end=game.indexOf("await ensureStateInitialized();",start);
assert.ok(start>=0&&end>start,"real game initializer exists");
const fnSource=game.slice(start,end)+"\nensureStateInitialized";
const ids=Array.from({length:8},(_,i)=>"unit"+i);
const defs=Object.fromEntries(ids.map(id=>[id,{hp:40,cost:2,kind:"unit"}]));
const goodDeck=Object.fromEntries(ids.map((id,i)=>[id,i===7?2:4]));
const clone=obj=>JSON.parse(JSON.stringify(obj));
const emptyState={
  turn:"A",turnSeq:4,units:[],mana:{A:{cur:4,max:4},B:{cur:4,max:4}},
  hands:{A:["unit0"],B:[]},decks:{A:[],B:[]},discards:{A:[],B:[]},
  log:["--- Aターン ---"],schema:"mana_v3",kills:{A:0,B:0}
};
async function boot(initial,{solo=true}={}){
 let state=clone(initial),cpuDoc={deck:{}},humanDoc={deck:goodDeck};
 let wrote=false,reads=0;
 const tx={
   get:async ref=>{
     assert.equal(wrote,false,"Firestore transactions must read before writing");
     reads++;
     const value=ref==="state"?state:ref==="player/cpu"?cpuDoc:humanDoc;
     return {exists:()=>!!value,data:()=>clone(value)};
   },
   set:(ref,patch)=>{
     wrote=true;
     if(ref==="state")state={...state,...patch};
     else if(ref==="player/cpu")cpuDoc={...cpuDoc,...patch};
   }
 };
 const ctx={
   ...guard,db:{},stateRef:"state",isSoloMode:solo,cpuSeat:"B",
   seatAPlayerId:"human",seatBPlayerId:"cpu",cardDefs:defs,
   playerRef:id=>"player/"+id,
   normalizeMana:m=>m,ensureFieldState:s=>{s.fieldId="grass";s.field={id:"grass"}},
   fieldIdFromUrl:"grass",W:5,H:7,ensureInfilObj:s=>{s.infil??={A:0,B:0}},
   logPush:(s,line)=>(s.log??=[]).push(line),runTransaction:async(db,fn)=>fn(tx),
   CORE:{START_CUR:2,START_MAX:2},shuffle:a=>a,serverTimestamp:()=>100,
   console:{warn:()=>{}},
 };
 const initialize=vm.runInNewContext(fnSource,ctx);
 await initialize();
 return {state,cpuDoc,reads};
}
const broken=await boot(emptyState);
assert.equal(broken.state.hands.B.length,5,"real bootstrap repairs opening 5");
assert.equal(broken.state.decks.B.length,25,"25 cards remain in CPU deck");
assert.equal(broken.state.cpuDeckRecovered,true,"prevents duplicate repair");
assert.equal(Object.values(broken.cpuDoc.deck).reduce((a,b)=>a+b,0),30);
const validExistingPile=Object.entries(goodDeck).flatMap(([id,n])=>Array(n).fill(id)).slice(0,25);
const noOpeningHand=await boot({...emptyState,decks:{A:[],B:validExistingPile}});
assert.equal(noOpeningHand.state.hands.B.length,5,"draw five from existing pile");
assert.equal(noOpeningHand.state.decks.B.length,20,"do not reintroduce already-lost cards");
assert.equal(noOpeningHand.state.cpuDeckRecovered,true);
const exhausted=await boot({...emptyState,discards:{A:[],B:["spent"]}});
assert.equal(exhausted.state.hands.B.length,0,"never refill a genuinely used deck");
const pvp=await boot(emptyState,{solo:false});
assert.equal(pvp.state.hands.B.length,0,"player-vs-player is untouched");
console.log("CPU bootstrap Firestore-transaction integration: repaired 5+25 / no double-refill / PvP unaffected");
