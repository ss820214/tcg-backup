// Regression test for solo CPU planning and repeated actions (no Firestore required).
// Run: node tools/cpu_regression_20261019.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const aiSource = fs.readFileSync("public/cpu_ai.js", "utf8");
const driverSource = fs.readFileSync("public/cpu_driver.js", "utf8");
const gameSource = fs.readFileSync("public/game.js", "utf8");
const battleHtml = fs.readFileSync("public/game.html", "utf8");
const createCpuAI = vm.runInNewContext(aiSource.replace("export function createCpuAI","function createCpuAI")+"\ncreateCpuAI");
const createCpuDriver = vm.runInNewContext(driverSource.replace(/^import .*$/gm,"").replace("export function createCpuDriver","function createCpuDriver")+"\ncreateCpuDriver",{createCpuAI,console});
const definitions={unit1:{cost:2,actions:[{name:"attack",damage:10,success:100}]}};
const state={turn:"B",turnSeq:1,winner:null,hands:{A:[],B:["unit1"]},mana:{A:{cur:2},B:{cur:3}},units:[{id:"enemy",owner:"A",cardId:"enemy",hp:40,x:2,y:4}]};
const actions=[];
let ended=0;
const driver=createCpuDriver({cardDefs:definitions,W:5,H:7});
const helpers={
 listLegalSummons:s=>s.hands.B.length&&s.mana.B.cur>=2?[{cardId:"unit1",handIndex:0,cost:2,to:{x:2,y:1}}]:[],
 listLegalMoves:(s,u)=>s.mana.B.cur>0&&u.y<4?[{to:{x:u.x,y:u.y+1}}]:[],
 listLegalAttacks:()=>[],
 goalProgress:(_s,u,to)=>to.y-u.y,
};
await driver.tick(state,{
 cpuSeat:"B", helpers,
 execCpuPlan:async plan=>{
  actions.push(plan.type);
  if(plan.type==="summon"){
    state.hands.B.splice(0,1);
    state.mana.B.cur-=2;
    state.units.push({id:"cpu1",owner:"B",cardId:"unit1",hp:40,x:2,y:1});
    return true;
  }
  if(plan.type==="move"){
    state.mana.B.cur--;
    state.units.find(u=>u.id===plan.unitId).y=plan.to.y;
    return true;
  }
  return false;
 },
 readState:async()=>state,
 finishTurn:async()=>{ended++;state.turn="A";return true},
});
assert.deepEqual(actions,["summon","move"]);
assert.equal(ended,1);
assert.equal(state.units.find(x=>x.id==="cpu1").y,2);
await driver.tick(state,{cpuSeat:"B",execCpuPlan:async()=>{throw Error("duplicate")},finishTurn:async()=>{throw Error("duplicate")}});
assert.equal(ended,1);
const attacking={turn:"B",turnSeq:2,units:[{id:"cpu1",owner:"B",hp:40,cardId:"unit1",x:2,y:3},{id:"enemy",owner:"A",hp:40,x:2,y:4}],hands:{B:[]},mana:{B:{cur:3}}};
const ai=createCpuAI({seat:"B"});
const plan=ai.pickAction(attacking,{mySeat:"B",enemySeat:"A",helpers:{
 getUnitById:id=>attacking.units.find(u=>u.id===id),
 getActionsForUnit:u=>definitions[u.cardId]?.actions||[],
 listLegalAttacks:(_s,u)=>u.owner==="B"?[{attackerId:u.id,actionIndex:0,targetId:"enemy"}]:[],
 listLegalSummons:()=>[],
 listLegalMoves:()=>[]
}});
assert.equal(plan.type,"attack");
assert.match(gameSource,/async function executeCpuSummon/);
assert.match(gameSource,/hand\.splice\(idx,1\)/);
assert.match(gameSource,/listLegalSummons: listCpuLegalSummons/);
assert.match(gameSource,/finishTurn: finishCpuTurn/);
assert.doesNotMatch(battleHtml,/id="quickMove"/);
assert.doesNotMatch(battleHtml,/id="quickAttack"/);
console.log("Solo CPU summon/move/attack planning and duplicate control checks passed.");
