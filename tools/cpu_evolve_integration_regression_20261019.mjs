// Offline integration check: the CPU can drive the existing evolution engine.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const defs={
  base:{type:"火",cost:1,hp:40,sp:20,actions:[]},
  upgrade:{type:"火",cost:3,hp:80,sp:40,actions:[]},
};
let state={
  turn:"B",winner:null,turnSeq:1,
  mana:{B:{cur:4}},hands:{B:["upgrade"]},
  units:[{id:"cpu1",owner:"B",cardId:"base",x:1,y:1,hp:30,sp:20,maxHp:40,maxSp:20,fatigue:true}],
};
const clone = value=>JSON.parse(JSON.stringify(value));
const runTransaction=async(_db,fn)=>fn({
  get:async()=>({exists:()=>true,data:()=>clone(state)}),
  set:(_ref,changed)=>{state=changed},
});
const code=readFileSync("public/evolve_system.js","utf8")
  .replace(/^import .*$/gm,"")
  .replace("export function createEvolveSystem","function createEvolveSystem")
  +"\ncreateEvolveSystem";
const create=vm.runInNewContext(code,{runTransaction});
const engine=create({
  db:{},stateRef:{},getSeat:()=>"B",
  canControl:st=>st.turn==="B"&&!st.winner,
  normalizeMana:m=>m,
  spendManaMut:(m,seat,c)=>{m[seat].cur-=c;return m},
  nowMs:()=>1234,round10:v=>Math.round(v/10)*10,
  clampUnitStats10:()=>{},cardDefsRef:()=>defs,
  cardName:id=>id,logPush:(st,msg)=>{(st.log??=[]).push(msg)},
  checkWinLocal:()=>null,isPanic:u=>u.panic,fireCardEffects:()=>0,
});
assert.equal(engine.onPickBaseUnit(state.units[0],state).ok,true);
assert.equal(engine.canExec(state,0),true);
assert.equal(await engine.execEvolveFromHandIndex(0),true);
assert.equal(state.units[0].cardId,"upgrade");
assert.equal(state.units[0].hp,70,"preserves accumulated damage");
assert.ok(!state.units[0].fatigue,"evolution clears fatigue");
assert.equal(state.mana.B.cur,2,"charges mana difference");
assert.equal(state.hands.B.length,0,"consumes evolution card");
console.log("CPU-shared evolution engine integration OK.");
