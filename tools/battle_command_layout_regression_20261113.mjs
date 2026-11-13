import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {battleCommandState as state,createCommandGate} from '../public/battle_command_state.js';
const attack={mode:'attack',canControl:true,ownUnit:true,hasAction:true,mana:4,cost:2,needsTarget:true,hasTarget:true};
assert.equal(state(attack).ready,true);
for(const patch of [{canControl:false},{hasAction:false},{mana:1},{unitBlocked:true},{hasTarget:false}])assert.equal(state({...attack,...patch}).ready,false);
assert.equal(state({...attack,needsTarget:false,hasTarget:false}).ready,true);
assert.equal(state({...attack,ownUnit:false}).visible,false);
const evolve={mode:'evolve',canControl:true,hasCard:true,evolutionReady:true};
assert.equal(state(evolve).ready,true);
assert.equal(state({...evolve,handLocked:true}).ready,false);
assert.equal(state({...evolve,evolutionReady:false}).ready,false);
const support={mode:'support',canControl:true,hasCard:true,supportReady:true,mana:2,cost:2};
assert.equal(state(support).ready,true);
for(const patch of [{mana:0},{supportReady:false},{handLocked:true},{searchReady:false}])assert.equal(state({...support,...patch}).ready,false);
const calls=[],gate=createCommandGate(v=>calls.push(v));let release;
const first=gate.run(()=>new Promise(r=>{release=r}));
assert.equal(gate.busy,true);let duplicates=0;
assert.equal(await gate.run(()=>{duplicates++}),false);assert.equal(duplicates,0);
release();await first;assert.equal(gate.busy,false);assert.deepEqual(calls,[true,false]);
await assert.rejects(gate.run(()=>Promise.reject(new Error('failed'))));assert.equal(gate.busy,false);
let restarted=0;await gate.run(()=>{restarted++});assert.equal(restarted,1);
// Use the real status formatter: compact board limits cannot change detailed contents.
const source=fs.readFileSync('public/game.js','utf8');
const start=source.indexOf('function statusIconsHtml('),end=source.indexOf('\nbtnSummon',start);
const format=vm.runInNewContext(source.slice(start,end)+'\nstatusIconsHtml',{
 statusIconItems:()=>Array.from({length:5},(_,i)=>({key:'s'+i,label:'状態'+i,title:'状態'+i,text:'状態詳細'+i})),
 escapeStatusHtml:String,statusIconClassName:String,statusIconSketchHtml:k=>'<i>'+k+'</i>',
});
const compact=format({}, {compact:true,maxVisible:2,labels:false});
assert.equal((compact.match(/statusChipIcon/g)||[]).length,2);assert.match(compact,/>\+3</);assert.doesNotMatch(compact,/statusBoardLabel/);
assert.equal((format({}, {compact:false}).match(/statusChipIcon/g)||[]).length,5);
const ui=fs.readFileSync('public/game_ui.js','utf8');
assert.equal((ui.match(/attackConfirmDock.id="battleAttackConfirmDock"/g)||[]).length,1);
assert.doesNotMatch(ui,/createElement\([^)]*\)[^\n]*battle(Evolve|Support)(Apply|Cancel)/);
assert.doesNotMatch(ui,/typeEl.textContent = String\(t\)/);
console.log('PASS: shared attack/evolution/support confirmation, mana/targets/turn locks, async duplicate/error handling, and compact/full status formatting');
