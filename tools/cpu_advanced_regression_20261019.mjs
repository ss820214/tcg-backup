// Execute: node tools/cpu_advanced_regression_20261019.mjs
// Fully offline tactical regression, no Firebase credentials needed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = path => readFileSync(path, "utf8");
const script = source("public/cpu_tactics.js").replace("export function pickAdvancedCpuPlan","function pickAdvancedCpuPlan")+"\npickAdvancedCpuPlan";
const pick = vm.runInNewContext(script);
const ally={id:"ally",owner:"B",hp:20,maxHp:80,sp:10,maxSp:20,cardId:"base"};
const enemy={id:"enemy",owner:"A",hp:80,maxHp:80,sp:20,maxSp:20,cardId:"enemy"};
const state={turn:"B",turnSeq:3,units:[ally,enemy]};
const heal={type:"support",cardId:"heal",handIndex:0,effectType:"heal",targetId:"ally",cost:1};
const evolve={type:"evolve",cardId:"evo",handIndex:1,baseUnitId:"ally",cost:2};
const damage={type:"support",cardId:"bolt",handIndex:2,effectType:"dmg",targetId:"enemy",cost:2};
const options=(style,candidates,basePlan={type:"end"})=>({seat:"B",style,basePlan,helpers:{
 listLegalSupports:()=>candidates.filter(x=>x.type==="support"),
 listLegalEvolves:()=>candidates.filter(x=>x.type==="evolve")
}});
assert.equal(pick(state,options("balanced",[heal,evolve])).type,"support","critical ally should get healing");
assert.equal(pick(state,options("defensive",[heal])).type,"support");
assert.equal(pick(state,options("aggressive",[damage])).type,"support");
assert.equal(pick(state,options("aggressive",[heal],{type:"attack",meta:{score:160}})),null,"lethal attack priority");
assert.equal(pick(state,options("infiltration",[evolve],{type:"move",meta:{reason:"goalRush"}})),null,"immediate infiltration win");
assert.equal(pick({...state,turn:"A"},options("balanced",[heal])),null,"other side");
assert.equal(pick({...state,winner:"A"},options("balanced",[heal])),null,"after win");
assert.equal(pick(state,options("balanced",[])),null,"no candidate");
const driver=source("public/cpu_driver.js");
const game=source("public/game.js");
const html=source("public/game.html");
assert.match(driver,/import \{ pickAdvancedCpuPlan \} from/);
assert.match(driver,/listLegalSupports: ctx\?\.helpers\?\.listLegalSupports/);
assert.match(driver,/listLegalEvolves: ctx\?\.helpers\?\.listLegalEvolves/);
assert.match(game,/async function executeCpuEvolve/);
assert.match(game,/createEvolveSystem\(\{/);
assert.match(game,/async function executeCpuSupport/);
assert.match(game,/const result=applySupport\(\{/);
assert.match(game,/if \(plan\.type === "support"\) return executeCpuSupport/);
assert.match(game,/if \(plan\.type === "evolve"\) return executeCpuEvolve/);
assert.match(game,/isHandCardLocked\(s,plan\.handIndex,actor\)/);
// The page may be cache-bumped independently; assert active integration instead.
assert.match(html,/game\\.js\\?v=/);
assert.match(game,/cpu_driver\\.js\\?v=/);
console.log("Advanced CPU tactics regression OK.");
