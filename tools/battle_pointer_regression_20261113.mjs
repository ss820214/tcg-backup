import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {isBattleCommandEvent,createLongPressClickGuard} from '../public/battle_input.js';

class Events {
  listeners=new Map();
  addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(f=>f!==fn));}
  emit(type,event={}){for(const fn of [...this.listeners.get(type)||[]]){fn(event);if(event.immediateStopped)break;}}
}
const event=(patch={})=>({button:0,isPrimary:true,pointerId:1,pointerType:'touch',clientX:80,clientY:90,detail:1,
 preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediateStopped=true;this.stopped=true;},...patch});

// The original descendant has already been detached by a render. Its event path
// still contains the board and must not be treated as an outside click.
const detached={closest:()=>null},board={closest:selector=>selector.includes('#board')?board:null};
const inside=event({target:detached,composedPath:()=>[detached,board]});
assert.equal(isBattleCommandEvent(inside),true);
assert.equal(isBattleCommandEvent(event({target:detached,composedPath:()=>[detached]})),false);
assert.equal(isBattleCommandEvent({target:{closest:()=>true}}),true);
assert.equal(isBattleCommandEvent({target:null}),false);
const source=fs.readFileSync('public/game.js','utf8');
const start=source.indexOf('document.addEventListener("click", (ev) => {',source.indexOf('btnQuickMove?.addEventListener'));
const end=source.indexOf('// =====================',start);
const outsideDoc=new Events();let cleared=0;
vm.runInNewContext(source.slice(start,end),{document:outsideDoc,mode:'attack',currentState:{},canControl:()=>true,isBattleCommandEvent,clearCommandSelectionUI:()=>cleared++});
outsideDoc.emit('click',inside);assert.equal(cleared,0);
outsideDoc.emit('click',event({target:detached}));assert.equal(cleared,1);

// Exercise the real unit pointer handlers with touch and mouse event sequences.
const ui=fs.readFileSync('public/game_ui.js','utf8');
const a=ui.indexOf('  function attachLongPress('),b=ui.indexOf('  // ===== local =====',a);
function harness(pointerType){
 const doc=new Events(),win=new Events(),box=new Events(),timers=new Map();let id=0,picks=0,menus=0;
 box.style={};box.setPointerCapture=()=>{};
 const guard=createLongPressClickGuard(doc);
 const attach=vm.runInNewContext(ui.slice(a,b)+'\nattachLongPress',{
  window:win,longPressClickGuard:guard,hideQuickMenu:()=>{},onCellClickView:()=>picks++,
  boardEl:{querySelector:()=>({})},showQuickMenuForCell:()=>menus++,lastSt:{},
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:i=>timers.delete(i),
 });
 attach({box,st:{},u:{id:'enemy'},vx:2,vy:4});
 const down=()=>{const e=event({pointerType});doc.emit('pointerdown',e);box.emit('pointerdown',e);};
 const up=()=>win.emit('pointerup',event({pointerType}));
 const click=()=>{const e=event({pointerType});doc.emit('click',e);if(!e.immediateStopped)box.emit('click',e);return e;};
 const timer=delay=>{for(const [i,t]of [...timers])if(t.delay===delay){timers.delete(i);t.fn();}};
 return{down,up,click,timer,move:()=>box.emit('pointermove',event({clientX:110})),cancel:()=>{win.emit('pointercancel',event());box.emit('pointercancel',event());},get picks(){return picks;},get menus(){return menus;}};
}
for(const type of ['touch','mouse']){
 const h=harness(type);
 h.down();h.up();assert.equal(h.picks,0,'pointerup must not redraw/detach the target');
 assert.equal(h.click().stopped,true);assert.equal(h.picks,1,'one activation, no bubbling cell activation');
 h.down();h.up();h.click();assert.equal(h.picks,2,'the next tap remains usable');
 h.down();h.move();h.up();h.click();assert.equal(h.picks,2,'scrolling does not select a card');
 h.down();h.cancel();h.click();assert.equal(h.picks,2,'canceled pointers do not select');
 h.down();h.timer(380);assert.equal(h.picks,3);h.timer(0);assert.equal(h.menus,1);
 h.up();assert.equal(h.click().immediateStopped,true);assert.equal(h.picks,3,'long press trailing click is consumed');
 h.down();h.up();h.click();assert.equal(h.picks,4,'new tap works after long press');
}
// Keyboard activation is not consumed, and a new pointerdown clears a stale guard.
const doc=new Events(),guard=createLongPressClickGuard(doc);guard.consume();
let e=event({detail:0});doc.emit('click',e);assert.equal(e.immediateStopped,undefined);
doc.emit('pointerdown',event());e=event();doc.emit('click',e);assert.equal(e.immediateStopped,undefined);
console.log('PASS: touch/mouse taps activate once after pointerup, detached-target outside guard, long-press click suppression, drag/cancel and subsequent gestures');
