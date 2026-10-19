// Source-level and executable strategy regression for 0bato solo mode.
// Run from repository root: node tools/cpu_styles_regression_20261019.mjs
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read = p => readFileSync("public/"+p,"utf8");
const aiSrc=read("cpu_ai.js");
const createCpuAI=vm.runInNewContext(aiSrc.replace("export function createCpuAI","function createCpuAI")+"\ncreateCpuAI");
const unit={id:"cpu",cardId:"u",owner:"B",hp:40,x:2,y:2};
const enemy={id:"enemy",cardId:"v",owner:"A",hp:40,x:2,y:3};
const state={boardH:7,units:[unit,enemy],hands:{B:[]},mana:{B:{cur:4}}};
const helpers={
 getUnitById:id=>state.units.find(x=>x.id===id),
 getActionsForUnit:u=>u.id==="cpu"?[{name:"attack",damage:20,success:100}]:[],
 listLegalAttacks:(_s,u)=>u.id==="cpu"?[{attackerId:"cpu",actionIndex:0,targetId:"enemy"}]:[],
 listLegalMoves:(_s,u)=>u.id==="cpu"?[{to:{x:2,y:3}}]:[],
 listLegalSummons:()=>[],
 goalProgress:(_s,u,to)=>to.y-u.y,
};
const styles=["aggressive","balanced","defensive","infiltration"];
const choices={};
const scores={};
for(const style of styles){
 const ai=createCpuAI({style,seat:"B"});
 const ctx={mySeat:"B",enemySeat:"A",helpers};
 choices[style]=ai.pickAction(state,ctx).type;
 scores[style]=ai.scoreMovePlan(state,ctx,{unitId:"cpu",to:{x:2,y:3}},[unit],[enemy]);
 assert.ok(Number.isFinite(scores[style]),"finite move score: "+style);
}
assert.equal(choices.aggressive,"attack");
assert.equal(choices.balanced,"attack");
assert.equal(choices.defensive,"attack");
assert.equal(choices.infiltration,"move");
assert.ok(scores.infiltration>scores.defensive,"infiltration must advance more aggressively");
assert.equal(createCpuAI({style:"invalid"}).pickAction(state,{mySeat:"B",enemySeat:"A",helpers}).type,"attack");
const lobby=read("battle.html");
const lobbyJs=read("battle.js");
const game=read("game.js");
const driver=read("cpu_driver.js");
const intro=read("match_intro.js");
for(const style of styles){
 assert.match(lobby,new RegExp('name="cpuStyle" value="'+style+'"'));
 assert.match(aiSrc,new RegExp(style));
}
assert.match(lobby,/id="cpuStrategyPanel"/);
assert.match(lobby,/相手デッキ：？？？/);
assert.match(lobbyJs,/cpuStyle:\s*selectedCpuStyle\(\)/);
assert.match(lobbyJs,/cpuStyle: Object\.hasOwn\(CPU_STYLES/);
assert.match(lobbyJs,/updateCpuStylePanel\(!!me\.ready\)/);
assert.match(game,/style: cpuTacticalStyle/);
assert.match(driver,/createCpuAI\(\{ seat: key, style \}\)/);
assert.match(intro,/デッキ：？？？/);
assert.match(intro,/data\?\.isCpu/);
console.log("Four CPU strategies, persistence wiring and hidden deck UI checks passed.",choices,scores);
