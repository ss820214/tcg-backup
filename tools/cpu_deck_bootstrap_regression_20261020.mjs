// Run: node tools/cpu_deck_bootstrap_regression_20261020.mjs
// Regression for the observed "CPU start hand=0, deck=0, no-action" bug.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const read=path=>readFileSync(path,"utf8");
const code=read("public/cpu_deck_guard.js")
  .replace(/export const/g,"const")
  .replace(/export function/g,"function")
  +"\n({inspectCpuDeck,expandCpuDeck,chooseCpuDeck,needsCpuOpeningRepair})";
const {inspectCpuDeck,expandCpuDeck,chooseCpuDeck,needsCpuOpeningRepair}=vm.runInNewContext(code);
const valid={a:4,b:4,c:4,d:4,e:4,f:4,g:4,h:2};
const defs={a:{hp:50,cost:2,kind:"character"},b:{hp:60,cost:3}};
assert.equal(inspectCpuDeck({}).ok,false,"empty deck must be rejected");
assert.equal(inspectCpuDeck({a:4,b:4,c:4,d:4,e:4}).ok,false,"20-card deck must be rejected");
assert.equal(inspectCpuDeck({...valid,h:5}).ok,false,"same-name limit");
assert.equal(inspectCpuDeck({...valid,h:2.5}).ok,false,"fractional counts");
assert.equal(inspectCpuDeck(valid,{defs}).ok,true,"one summonable unit is enough");
assert.equal(inspectCpuDeck(valid,{defs:{a:{kind:"support",hp:0}}}).ok,false,"unsupported card-only deck");
const publicInvalid=[
 {title:"空の公開デッキ",deck:{}},
 {title:"旧20枚",deck:{a:4,b:4,c:4,d:4,e:4}},
];
const fallback=chooseCpuDeck(publicInvalid,valid,defs,()=>0);
assert.equal(fallback.source,"fallback");
assert.equal(inspectCpuDeck(fallback.deck).total,30);
const publicGood={title:"有効な公開デッキ",deck:{...valid},exSupport:"EX1",desiredField:"grass"};
const picked=chooseCpuDeck([...publicInvalid,publicGood],valid,defs,()=>0);
assert.equal(picked.source,"public");
assert.equal(picked.title,"有効な公開デッキ");
assert.equal(picked.exSupport,"EX1");
assert.equal(picked.desiredField,"grass");
assert.equal(picked.deck===publicGood.deck,false,"public data must not be mutated");
const pile=expandCpuDeck(valid,()=>0.2);
assert.equal(pile.length,30);
assert.equal(pile.slice(0,5).length,5);
assert.equal(pile.slice(5).length,25);
const countById=Object.fromEntries(Object.keys(valid).map(id=>[id,pile.filter(x=>x===id).length]));
for(const [id,n] of Object.entries(valid))assert.equal(countById[id],n);
assert.throws(()=>chooseCpuDeck(publicInvalid,{},defs),/CPUの30枚デッキを準備できません/);
const emptyCpu={turnSeq:4,winner:null,hands:{B:[]},decks:{B:[]},discards:{B:[]},units:[],log:[]};
assert.equal(needsCpuOpeningRepair(emptyCpu,"B"),true);
assert.equal(needsCpuOpeningRepair({...emptyCpu,hands:{B:["a"]}},"B"),false,"valid hand never refilled");
assert.equal(needsCpuOpeningRepair({...emptyCpu,units:[{owner:"B",id:"used"}]},"B"),false,"used units never refilled");
assert.equal(needsCpuOpeningRepair({...emptyCpu,discards:{B:["a"]}},"B"),false,"used discards never refilled");
assert.equal(needsCpuOpeningRepair({...emptyCpu,turnSeq:100},"B"),false,"late game never refilled");


const lobby=read("public/battle.js");
const game=read("public/game.js");
assert.match(lobby,/await bootCpuIfEnabled\(\);\s*const prepared=await getDoc\(cpuRef\)/);
assert.match(lobby,/const inspection=inspectCpuDeck\(cpuData\.deck,\{defs:cardDefs\}\)/);
assert.match(lobby,/chooseCpuDeck\(candidates,fallback,cardDefs\)/);
assert.match(lobby,/cpuBootPromise=ensureCpuPlayerDocFromPublicDeck\(\)/);
assert.match(game,/inspectCpuDeck\(cpuDeck,\{defs:cardDefs\}\)/);
assert.match(game,/needsCpuOpeningRepair\(s,cpuSeat\)/);
assert.match(game,/s\.cpuDeckRecovered=true/);
assert.match(game,/const shuffled=keepPile \? \[\.\.\.currentPile\] : expandCpuDeck\(savedDeck\)/);
assert.match(game,/ret = fn\(s\.decks,s\.hands,who,cnt\)/);

// Verify real turn-start drawCards signature and the adapter together.
const stateSource=read("public/game_state.js");
const drawStart=stateSource.indexOf("export function drawCards(");
const drawEnd=stateSource.indexOf("export function goToDeck(",drawStart);
assert.ok(drawStart>=0&&drawEnd>drawStart);
const draw=vm.runInNewContext(stateSource.slice(drawStart,drawEnd)
  .replace("export function drawCards","function drawCards")+"\ndrawCards");
const adapterStart=game.indexOf("function safeDrawCards(s, who, n)");
const adapterEnd=game.indexOf("function otherSeatOf(",adapterStart);
assert.ok(adapterStart>=0&&adapterEnd>adapterStart);
const adapted=vm.runInNewContext(game.slice(adapterStart,adapterEnd)+"\nsafeDrawCards",{drawCards:draw});
const sim={decks:{A:[],B:["second","first"]},hands:{A:[],B:[]}};
adapted(sim,"B",1);
assert.equal(sim.hands.B.length,1,"one card must be drawn at CPU turn start");
assert.equal(sim.decks.B.length,1,"drawing exactly one card");
adapted(sim,"B",1);
assert.equal(sim.hands.B.length,2);
assert.equal(sim.decks.B.length,0);

console.log("CPU deck bootstrap: empty/public validation, ready/match guards and 5+25 seeding OK.");
