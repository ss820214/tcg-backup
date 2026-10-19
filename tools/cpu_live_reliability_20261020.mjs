// Offline regression for live solo turn orchestration.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const load = p => fs.readFileSync(p,"utf8");
const ai=vm.runInNewContext(load("public/cpu_ai.js").replace("export function createCpuAI","function createCpuAI")+"\ncreateCpuAI");
const tactics=vm.runInNewContext(load("public/cpu_tactics.js").replace("export function pickAdvancedCpuPlan","function pickAdvancedCpuPlan")+"\npickAdvancedCpuPlan");
const driver=vm.runInNewContext(load("public/cpu_driver.js").replace(/^import .*$/gm,"").replace("export function createCpuDriver","function createCpuDriver")+"\ncreateCpuDriver",{createCpuAI:ai,pickAdvancedCpuPlan:tactics,console});
const game=load("public/game.js");
const html=load("public/game.html");
assert.match(game,/m\.seatA === "cpu" \|\| m\.seatB === "cpu"/);
assert.match(game,/const snap=await tx\.get\(stateRef\)/);
assert.match(html,/id="cpuTurnDiagnostic"/);
const state={turn:"B",turnSeq:1,winner:null,mana:{B:{cur:4}},hands:{B:["unit"]},units:[]};
const debug=[];
let exec=0,finished=0;
await driver({cardDefs:{unit:{cost:2,hp:40,sp:20,actions:[]}},W:5,H:7}).tick(state,{
 cpuSeat:"B",
 onDebug:(stage)=>debug.push(stage),
 helpers:{listLegalSummons:s=>s.hands.B.length?[{cardId:"unit",handIndex:0,cost:2,to:{x:2,y:1}}]:[],
 listLegalMoves:()=>[],listLegalAttacks:()=>[]},
 execCpuPlan:async plan=>{
  exec++;
  if(exec===1)return false; // first write rejected: retry must not stick
  state.hands.B.splice(0,1);
  state.units.push({id:"u",owner:"B",cardId:"unit",hp:40,sp:20,x:2,y:1});
  state.mana.B.cur-=2;
  return true;
 },
 readState:async()=>state,
 finishTurn:async()=>{finished++;state.turn="A";return true;},
});
assert.equal(finished,1);
assert.ok(debug.includes("rejected"));
assert.ok(debug.includes("finished"));
assert.ok(exec>=1);
console.log("Solo CPU orchestration failure reporting and turn completion OK.");
