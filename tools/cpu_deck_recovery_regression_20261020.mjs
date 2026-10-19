// node tools/cpu_deck_recovery_regression_20261020.mjs
// Fail-closed CPU deck preparation; never enter solo with 0 cards.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const code=fs.readFileSync("public/cpu_deck_guard.js","utf8");
const {inspectCpuDeck,chooseCpuDeck,expandCpuDeck,needsCpuOpeningRepair}=vm.runInNewContext(
  code.replace(/^export /gm,"")+"\n({inspectCpuDeck,chooseCpuDeck,expandCpuDeck,needsCpuOpeningRepair})"
);
const ids=Array.from({length:8},(_,i)=>"unit"+i);
const defs=Object.fromEntries(ids.map(id=>[id,{kind:"unit",hp:40,cost:2}]));
const deck=Object.fromEntries(ids.map((id,i)=>[id,i===7?2:4]));
assert.equal(inspectCpuDeck(deck,{defs}).ok,true);
assert.equal(inspectCpuDeck({},{defs}).ok,false,"an empty deck is not playable");
assert.equal(inspectCpuDeck({unit0:4},{defs}).ok,false,"an incomplete public deck is not playable");
assert.equal(inspectCpuDeck({...deck,unit0:99},{defs}).ok,false,"copy limit");
const chosen=chooseCpuDeck([{title:"broken",deck:{}},{title:"good",deck}],deck,defs,()=>0);
assert.equal(chosen.source,"public");
assert.equal(chosen.title,"good");
const fallback=chooseCpuDeck([{title:"broken",deck:{}}],deck,defs,()=>0);
assert.equal(fallback.source,"fallback");
assert.equal(inspectCpuDeck(fallback.deck,{defs}).total,30);
assert.throws(()=>chooseCpuDeck([{deck:{}}],{},defs),/CPUの30枚デッキ/);
const pile=expandCpuDeck(deck,()=>0.5),hand=Array.from({length:5},()=>pile.pop());
assert.equal(hand.length,5);
assert.equal(pile.length,25);
const init={turn:"B",turnSeq:4,hands:{A:["mine"],B:[]},decks:{A:["mine"],B:[]},
  discards:{A:[],B:[]},units:[],log:["[B] ターン終了：疲労/状態異常を回復"]};
assert.equal(needsCpuOpeningRepair(init,"B"),true,"empty historical match may be rescued");
assert.equal(needsCpuOpeningRepair({...init,decks:{A:[],B:["known-card"]}},"B"),true,"missing hand may be recovered from an existing pile");
assert.equal(needsCpuOpeningRepair({...init,turnSeq:13},"B"),false,"long matches are not refilled");
assert.equal(needsCpuOpeningRepair({...init,discards:{B:["usedCard"]}},"B"),false,"an exhausted deck is never refilled");
assert.equal(needsCpuOpeningRepair({...init,units:[{owner:"B",id:"dead",hp:0}]},"B"),false,"a prior summon prevents refill");
assert.equal(needsCpuOpeningRepair({...init,cpuDeckRecovered:true},"B"),false,"no repeated recovery");
assert.equal(needsCpuOpeningRepair({...init,log:["[B] CPU 召喚：card"]},"B"),false);
const lobby=fs.readFileSync("public/battle.js","utf8");
const game=fs.readFileSync("public/game.js","utf8");
assert.match(lobby,/chooseCpuDeck\(candidates,fallback,cardDefs\)/);
assert.match(lobby,/await bootCpuIfEnabled\(\)/);
assert.match(lobby,/inspectCpuDeck\(prepared\.exists\(\)\?prepared\.data\(\)\?\.deck:null/);
assert.match(game,/needsCpuOpeningRepair\(s,cpuSeat\)/);
assert.match(game,/cpuDeckRecovered:true/);
assert.match(game,/fn\(s\.decks,s\.hands,who,cnt\)/);
console.log("CPU deck guard, 30-card bootstrap, one-time recovery and draw signature: OK");
