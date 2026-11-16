import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateDeck, drawRadar} from '../public/deck_radar.js';
import {STARTER_SUPPORT_CARD_MAP} from '../public/starter_support_cards.js';
const defs={...STARTER_SUPPORT_CARD_MAP,
 fire:{type:'火',cost:4,hp:40,sp:20,actions:[{dmg:10}]},
 water:{type:'水',cost:4,hp:40,sp:20,actions:[{dmg:10}]},
 wind:{type:'風',cost:2,hp:20,sp:10,actions:[{dmg:10,range:'f2'}]}};
for (const deck of [{fire:15,water:15},{fire:10,water:10,wind:10},{fire:9,water:9,s002:4,s003:4,s007:4}]) {
 const entries=Object.entries(deck), expected=evaluateDeck(deck,defs);
 function permutations(items) {return items.length<2?[items]:items.flatMap((entry,i)=>permutations(items.filter((_,j)=>i!==j)).map(tail=>[entry,...tail]));}
 for(const order of permutations(entries)) {
  const restored=JSON.parse(JSON.stringify(Object.fromEntries(order)));
  assert.deepEqual(evaluateDeck(restored,defs),expected,'card enumeration must not change notes or scores');
 }
 for(let i=0;i<20;i++)assert.deepEqual(evaluateDeck(deck,defs),expected);
}
// A deck with a genuine majority retains its existing attribute identity.
assert.match(evaluateDeck({water:16,fire:14},defs).note,/主属性:水53%/);
assert.deepEqual(evaluateDeck({fire:30},defs).scores,[100,17.1,14.1,48,92,67.1]);

// Record real renderer labels: all must fit and no peak chip may cover an axis.
globalThis.document={documentElement:{}};
globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});
for(const [width,height] of [[360,320],[360,260],[260,260]])for(const peak of [false,true]){
 const labels=[];
 const ctx={canvas:{width,height},save(){},restore(){},measureText:s=>({width:[...s].length*13}),fillText(text,x,y){labels.push({text,x,y,w:[...text].length*13+18,h:24});}};
 for(const name of ['beginPath','moveTo','lineTo','quadraticCurveTo','closePath','fill','stroke','arc','clearRect'])ctx[name]=()=>{};
 const canvas={width,height,getContext:()=>ctx};
 drawRadar(canvas,[90,58,56,66,92,54],{showPeakLabel:peak});
 assert.equal(labels.length,peak?7:6);
 for(const a of labels){assert.ok(a.x-a.w/2>=0&&a.x+a.w/2<=width&&a.y-a.h/2>=0&&a.y+a.h/2<=height,`${width}x${height}: ${a.text} stays visible`);}
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
  const a=labels[i],b=labels[j];
  assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.y-b.y)>=(a.h+b.h)/2,`${width}x${height}: ${a.text}/${b.text} must not overlap`);
 }
 const first=JSON.stringify(labels);labels.length=0;drawRadar(canvas,[90,58,56,66,92,54],{showPeakLabel:peak});assert.equal(JSON.stringify(labels),first);
}
const read=f=>fs.readFileSync('public/'+f,'utf8');
for(const page of ['battle.js','victory_screen.js'])assert.match(read(page),/deck_radar\.js\?v=20261116_radar_stable1/);
assert.match(read('battle.html'),/id="battleDeckRadar" width="360" height="320"/);
assert.match(read('deck_radar.js'),/drawRadar\(canvas, res\.scores, \{ showPeakLabel: false \}\)/);
console.log('PASS: all deck permutations/repeated evaluations, unique-majority identity, label bounds/overlap, repeated drawing and shared radar revision');
