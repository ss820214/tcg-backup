import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { mergeBattleCardDefinitions } from '../public/battle_card_catalog.js';
import { STARTER_SUPPORT_CARD_MAP } from '../public/starter_support_cards.js';

const read = name => fs.readFileSync(`public/${name}`, 'utf8');
const remoteSupport = { name: 'メンテナンス窓', kind: 'support', cost: 1, effect: { type: 'heal', hp: 10, rate: 90 } };
const remoteUnit = { name: '本番ユニット', type: '水', hp: 60 };
const collections = { cards: { S109: remoteSupport, unit: remoteUnit }, support_cards: { unit: { name: '旧定義' } } };
const snapshot = data => ({ forEach: fn => Object.entries(data).forEach(([id, value]) => fn({ id, data: () => value })) });
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
for (const file of ['game.js', 'battle.js']) {
  const src = read(file);
  const start = src.indexOf('async function loadCards()');
  const end = src.indexOf('\nawait loadCards()', start);
  assert.ok(start >= 0 && end > start);
  const body = src.slice(start, end);
  const load = new AsyncFunction('getCachedCardCollection', 'getDocs', 'collection', 'db', 'STARTER_SUPPORT_CARD_MAP', 'FAIRY_TALE_CARDS', 'JEWEL_CARDS', 'mergeBattleCardDefinitions', 'ensureUserProfile', 'normalizeYouCard', 'authUid', 'YOU_CARD_ID', 'console', `let cardDefs; ${body}; await loadCards(); return cardDefs;`);
  const run = (catalog, fail) => load(async (name, fetch) => { if(name === fail) throw Error('offline'); return snapshot(catalog[name] || {}); }, () => {}, () => {}, {}, STARTER_SUPPORT_CARD_MAP, {}, {}, mergeBattleCardDefinitions, async () => ({data:{}}), () => null, 'qa', 'YOU', { warn(){} });
  const defs = await run(collections);
  for(const id of ['S109','s109']) {
    assert.equal(defs[id].name, remoteSupport.name, `${file}: saved names survive fallback`);
    assert.deepEqual(defs[id].effect, remoteSupport.effect, `${file}: saved effects survive fallback`);
  }
  assert.equal(defs.s005.name, '火炎瓶', `${file}: missing starter remains playable`);
  assert.equal(defs.unit.name, remoteUnit.name, `${file}: main catalog overrides legacy`);
  assert.equal((await run({}, 'support_cards')).s005.name, '火炎瓶', `${file}: optional failure preserves bundled supports`);
  if(file === 'battle.js') await assert.rejects(run({}, 'cards'), /offline/);
}
const lower = mergeBattleCardDefinitions({ s109: remoteSupport }, STARTER_SUPPORT_CARD_MAP);
assert.equal(lower.S109, remoteSupport, 'lowercase saved IDs must also beat bundled uppercase fallback');
assert.equal(STARTER_SUPPORT_CARD_MAP.S109.name, '安全確認ヨシ', 'merge must not mutate bundled definitions');

const deck = read('deck.js');
const homeBlock = deck.slice(deck.indexOf('let homeDeckTotal = null;'), deck.indexOf('function ensureDeckStartElement()'));
let elements = Object.fromEntries(['homeDeckStatusHint','homeDeckStatusCount','homeDeckCountChip'].map(id => [id, {textContent:''}]));
const home = new Function('document', `${homeBlock}; return updateHomeDeckStatus;`)({getElementById: id => elements[id]});
home(); assert.equal(elements.homeDeckStatusCount.textContent, '確認中');
home(0); assert.equal(elements.homeDeckStatusCount.textContent, '0/30'); assert.match(elements.homeDeckStatusHint.textContent, /あと30枚/);
home(29); assert.match(elements.homeDeckStatusHint.textContent, /あと1枚/);
home(30); assert.equal(elements.homeDeckCountChip.textContent, 'DECK 30/30'); assert.match(elements.homeDeckStatusHint.textContent, /対戦できます/);
elements = Object.fromEntries(Object.keys(elements).map(id => [id,{textContent:''}]));
home(); assert.equal(elements.homeDeckStatusCount.textContent, '30/30', 'reopening home retains the restored count');
assert.match(deck, /updateHomeDeckStatus\(total\)/, 'deck rendering must update home too');

let realCells = 35, placeholderCells = 0, observer;
const timers=[];
const board={querySelector: selector=>selector.includes('recoveryCell') ? (placeholderCells ? {} : null) : realCells ? {} : null, querySelectorAll: ()=>Array(realCells).fill({}), insertAdjacentElement(){}, appendChild(){ placeholderCells=35; }};
const indicator={style:{},setAttribute(){},textContent:''};
const recoveryDocument={readyState:'complete',getElementById:id=>id==='board'?board:id==='app'?{}:null,createElement:tag=>tag==='style'?{}:indicator,createDocumentFragment:()=>({appendChild(){}}),head:{appendChild(){}}};
vm.runInNewContext(read('game_board_recovery_20261015.js'), {document:recoveryDocument,setTimeout:fn=>timers.push(fn),MutationObserver:class {constructor(fn){observer=fn}observe(){}}});
timers[1](); assert.equal(indicator.style.display,'none','empty but synchronized opening must not show a sync warning');
realCells=0;placeholderCells=35;observer(); assert.equal(indicator.style.display,'block');
realCells=35;placeholderCells=0;observer(); assert.equal(indicator.style.display,'none','late synchronization clears the loading message');
assert.equal(indicator.textContent,'');
console.log('Basic flow regression: battle catalog priority, support fallback/aliases, home count, empty-board status OK');

const game = read('game.js');
const detailSource = game.slice(game.indexOf('let detailUnitId = null;'), game.indexOf('function showCardDetail(cardId)'));
const detailEl = {textContent:''};
let renderedDetail;
const detail = new Function('detailEl', 'showUnitDetail', `${detailSource}; return { select: id=>{detailUnitId=id}, refreshUnitDetail };`)(detailEl, u=>{renderedDetail=u});
detail.select('qa-unit'); detail.refreshUnitDetail({units:[{id:'qa-unit', hp:50, sp:10}]});
assert.equal(renderedDetail.hp,50,'open unit detail follows damage snapshots');
detail.refreshUnitDetail({units:[]}); assert.match(detailEl.textContent,/盤面を離れました/);
assert.match(game,/onAfterRender: st=>\{ updateBattleReadability\(st\); refreshUnitDetail\(st\); \}/);

const dopa = read('dopagaki_mode.js');
const toggleSource = dopa.slice(dopa.indexOf('  function createToggle()'), dopa.indexOf('  function bindClickConfetti()'));
let mounted, restored = false;
const host={appendChild:btn=>{mounted=btn}};
const toggleDoc={getElementById:()=>null,querySelector:selector=>selector==='header .topRight'?host:null,createElement:()=>({setAttribute(){},addEventListener(){}})};
new Function('document','TOGGLE_ID','restoreTogglePosition','onTogglePointerDown','onTogglePointerMove','onTogglePointerEnd',`${toggleSource};createToggle();`)(toggleDoc,'tcgDopagakiToggle',()=>{restored=true},()=>{},()=>{},()=>{});
assert.equal(mounted.id,'tcgDopagakiToggle'); assert.equal(restored,false,'saved floating position must not move toggle over the home button');
for(const file of ['index.html','deck.js','mobile_deck_ui.js']) assert.match(read(file),/:not\(#deviceModeBadge\):not\(#tcgDopagakiToggle\)/,`${file}: header allows the inline toggle`);
console.log('PASS: live detail refresh and inline deck toggle mounting');
