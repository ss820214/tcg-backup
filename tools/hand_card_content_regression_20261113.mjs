import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cardArtSrc} from '../public/card_art.js';

const ui = fs.readFileSync('public/game_ui.js', 'utf8');
const start = ui.indexOf('function vitalDeltaText(');
const end = ui.indexOf('function updateHandDrawerPosition', start);
const lines = vm.runInNewContext(ui.slice(start, end) + '\nhandCardActionLines', {
  isSupportCard: d => d?.kind === 'support',
  supportEffectSummary: d => d.summary,
});
const actions = [
  {name:'キック',cost:2,hpDelta:-20,rate:30},
  {name:'かばう',cost:1,spDelta:10,rate:100},
  {name:'反撃',cost:0,hpDelta:-10,spDelta:-10,rate:0},
];
const result = Array.from(lines({actions}));
assert.equal(result.length, 3, 'All actions must be present, not just the first');
for (let i=0;i<actions.length;i++) {
  assert.ok(result[i].includes(actions[i].name));
  assert.ok(result[i].includes(`[${actions[i].cost}]`));
  assert.ok(result[i].includes(`${actions[i].rate}%`));
}
assert.ok(result[1].includes('+10'));
assert.deepEqual(Array.from(lines({actions:[]})), ['技なし']);
assert.deepEqual(Array.from(lines({kind:'support',summary:'2枚引く'})), ['2枚引く']);
assert.deepEqual(Array.from(lines({kind:'support',desc:'回復'})), ['回復']);
assert.deepEqual(Array.from(lines({kind:'support'})), ['効果なし']);
for (const id of ['nabe_tate','normal_arm','mamoru_kun']) {
  const src = cardArtSrc(id);
  assert.ok(fs.existsSync('public/'+src.split('?')[0].replace(/^\.\//,'')), id+' illustration must exist');
}
assert.match(cardArtSrc('cloud_custom_new',{name:'新カード'}),/^data:image\/svg\+xml/);
assert.equal(cardArtSrc('custom',{imageUrl:'https://example.org/card.png'}),'https://example.org/card.png');
assert.match(ui,/cardArtImgHtml\?\.\(cid, artDef, "shcIllustration"\)/);
assert.doesNotMatch(ui,/class="shcArtSymbol"/);
console.log('PASS: all hand actions, zero costs/rates, support effects, registered/custom artwork and no duplicate attribute placeholder');
