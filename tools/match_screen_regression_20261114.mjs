import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(`public/${file}`, 'utf8');
const controls = ['lobbyDeckContent','lobbyEvalContent'].map(id => {
 const content={hidden:false}; const attrs={'aria-controls':id}; const listeners={};
 const button={dataset:{panelLabel:id},getAttribute:k=>attrs[k],setAttribute:(k,v)=>{attrs[k]=v},addEventListener:(k,fn)=>{listeners[k]=fn}};
 return {id,content,button,attrs,listeners};
});
const storage = new Map();
function boot(blocked=false){
 const context={document:{querySelectorAll:()=>controls.map(x=>x.button),getElementById:id=>controls.find(x=>x.id===id)?.content}, sessionStorage:{getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key)},setItem:(key,v)=>{if(blocked)throw Error('blocked');storage.set(key,v)}}};
 vm.runInNewContext(read('lobby_panels.js'),context);
}
boot();
assert.ok(controls.every(x=>!x.content.hidden));
controls[0].listeners.click();
assert.equal(controls[0].content.hidden,true); assert.equal(controls[0].attrs['aria-expanded'],'false');
assert.equal(controls[1].content.hidden,false,'minimizing deck does not minimize evaluation');
assert.match(controls[0].button.textContent,/最大化/);
controls[1].listeners.click();
for(const c of controls){delete c.button.dataset.panelBound;c.content.hidden=false;}
boot(); assert.ok(controls.every(x=>x.content.hidden),'collapse choices survive re-entry');
controls[0].listeners.click(); assert.equal(controls[0].content.hidden,false);assert.equal(controls[0].attrs['aria-expanded'],'true');
assert.match(controls[0].button.textContent,/最小化/);
for(const c of controls)delete c.button.dataset.panelBound;
boot(true);controls[0].listeners.click();assert.equal(controls[0].content.hidden,true,'storage failures do not block toggling');

const polish=read('ui_polish.js');
const route=polish.slice(polish.indexOf('  function ensureRouteStrip()'),polish.indexOf('  function normalizeTitle()'));
for(const page of ['battle.html','match_intro.html','victory.html']){
 assert.match(read(page),/data-route-strip="off"/);
 let mounted=false;
 const document={body:{dataset:{routeStrip:'off'},prepend(){mounted=true}}};
 new Function('document','page','isHome','$',`${route};ensureRouteStrip();`)(document,page,false,()=>null);
 assert.equal(mounted,false,`${page}: no injected navigation over the screen`);
}
assert.match(read('index.html'),/id="deckVersionPill">v1\.2\.1/);
assert.match(read('deck.js'),/\|\| "V1\.2\.1"/);
console.log('PASS: independent lobby panels, collapse/restore, re-entry, blocked storage, route opt-out, v1.2.1 labels');
