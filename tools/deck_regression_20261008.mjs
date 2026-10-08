import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const deck = fs.readFileSync('public/deck.js', 'utf8');
assert.doesNotMatch(fs.readFileSync('public/index.html','utf8'), /const KEY = "tcg_detail_hidden"/);
const auth = fs.readFileSync('public/auth.js', 'utf8');
function section(start, end) {
  return deck.slice(deck.indexOf(start), deck.indexOf(end, deck.indexOf(start)));
}
const support = {supportEffectTextJa: vm.runInNewContext(fs.readFileSync('public/support_text.js','utf8').replace('export function', 'function')+'\nsupportEffectTextJa', {window:{},console})};
const summary = vm.runInNewContext(section('function supportSummaryText', 'function firstActionLine') + '\nsupportSummaryText', {
  supportEffectTextJa: support.supportEffectTextJa, actionOneLine: a => a.name,
});
assert.match(summary({effect: 'カードを2枚引く'}), /2枚/);
assert.equal(summary({effect: JSON.stringify({type:'draw',n:2})}), summary({effect:{type:'draw',n:2}}));
assert.match(summary({effect: null, description:'マナを増やす'}), /マナ/);

for (const stored of ['{}', '{"A":2}']) {
  let fallback = 0;
  const context = {localStorage:{getItem:()=>stored},LOCAL_KEY:'deck', normalizeDeckMap:x=>x,
    consumePendingCloudDeck:()=>false,loadDeckFromUser:async()=>{fallback++;return true;},
    loadDeckPreferFirestore:async()=>{fallback++;},roomId:'r',playerId:'p',deckMap:{old:3}};
  await vm.runInNewContext('(async()=>{' + section('const loadedPendingDeck =', 'updateRoomPlayerSummary();\npruneDeckByOwnership') + '})()', context);
  assert.equal(fallback,0);
  assert.deepEqual(JSON.parse(JSON.stringify(context.deckMap)),JSON.parse(stored));
}
assert.match(section('function applySnapshotFromLibrary', 'initDeckLibrary({'), /saveLocalDeck\(\);\s*renderAll\(\)/);
assert.match(deck, /if \(!\(await saveDeckToUser\(name\)\)\) throw/);

const ensureCode = auth.slice(auth.indexOf('export async function ensureSignedIn')).replace('export ', '');
for (const fails of [false,true]) {
  let unsubscribed = false;
  const context = {auth:{},onAuthStateChanged:(a,cb)=>{queueMicrotask(()=>cb(null));return ()=>{unsubscribed=true;};},
    signInAnonymously:async()=>{if(fails)throw Error('offline');return {user:{uid:'test'}};}};
  const ensure = vm.runInNewContext(ensureCode+'\nensureSignedIn',context);
  if(fails) await assert.rejects(ensure(), /offline/);
  else assert.equal((await ensure()).uid,'test');
  assert.equal(unsubscribed,true);
}
const modal = section('function openDetail()', 'detailClose?.addEventListener');
const skills = fs.readFileSync('public/deck_mobile_hotfix_20261006_skills6.js','utf8');
assert.match(skills,/window.getTcgDeckCardDef\?\.\(id\) \|\| defs\[id\]/);
assert.match(skills,/out\[id\] = \{ \.\.\.out\[id\], \.\.\.def \}/);
const layout = fs.readFileSync('public/deck_mobile_hotfix_20261006_cardlayout5.js','utf8');
assert.match(layout,/grid-template-columns:minmax\(0,1fr\) 148px!important/);
assert.match(layout,/min-width:44px!important/);
assert.match(modal,/classList.remove\("isHidden"\)/);
assert.match(modal,/width:"100vw"/);
assert.match(modal,/setProperty\("display", "none", "important"\)/);
assert.match(deck,/openAdminCardEditor\(cardId\)\},5000\)/);
assert.match(deck,/if \(!isAdminUser\(\) \|\| !cardDefs\[cardId\]\) return/);
class ElementMock {
  constructor(tag) { this.tag=tag;this.children=[];this.attrs={};this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.classList={remove:()=>{}}; }
  get firstChild(){return this.children[0];}
  appendChild(child){ if(child.parent)child.parent.children=child.parent.children.filter(x=>x!==child);child.parent=this;this.children.push(child);return child; }
  append(...children){children.forEach(child=>this.appendChild(child));}
  setAttribute(k,v){this.attrs[k]=v;}
  querySelector(){return this.children.find(x=>x.className==='deckDetailDialog')||null;}
  addEventListener(){}
  focus(){this.focused=true;}
  remove(){this.removed=true;}
}
const detailWrap=new ElementMock('div'),detailEl=new ElementMock('div'),detailClose=new ElementMock('button');
detailWrap.append(detailClose,detailEl);
const modalContext={detailWrap,detailEl,detailClose,document:{createElement:tag=>new ElementMock(tag)}};
vm.runInNewContext(modal+'\nopenDetail();',modalContext);
assert.equal(detailWrap.style.width,'100vw');
assert.equal(detailWrap.children.length,1);
assert.equal(detailWrap.children[0].attrs.role,'dialog');
vm.runInNewContext('closeDetail();openDetail();closeDetail();',modalContext);
assert.equal(detailWrap.children.length,1);
assert.equal(detailWrap.style.display,'none');

let allowed=true,written=null;
const body=new ElementMock('body');
const originalCard={name:'テスト',cost:1,effect:{type:'draw',n:2},actions:[],_sourceCollection:'cards',_sourceDocId:'real-doc'};
const adminContext={document:{createElement:tag=>new ElementMock(tag),body},isAdminUser:()=>allowed,
  cardDefs:{A:originalCard},isSupportLike:()=>true,db:{},doc:(_db,col,id)=>({col,id}),
  setDoc:async(ref,patch)=>{written={ref,patch};},renderAll:()=>{}};
vm.runInNewContext(section('function openAdminCardEditor', 'document.addEventListener("pointerdown"')+'\nopenAdminCardEditor("A");',adminContext);
const panel=body.children[0].children[0];
const save=panel.children.find(x=>x.textContent==='Firebaseに保存');
await save.onclick();
assert.equal(written.ref.col,'cards');
assert.equal(written.ref.id,'real-doc');
assert.equal(written.patch.effect.n,2);
allowed=false;written=null;
await save.onclick();
assert.equal(written,null);
console.log('PASS: support text, JSON effects, empty/local deck restoration, snapshot persistence, save failures, auth rejection, modal guards, admin hold guards');
