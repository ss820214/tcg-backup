// Offline verification of opponent-hand silhouettes. No Firestore reads or card contents displayed.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const js = fs.readFileSync("public/opponent_hand_ui.js","utf8");
const page = fs.readFileSync("public/game.html","utf8");
const battle = fs.readFileSync("public/game.js","utf8");
const styles = fs.readFileSync("public/opponent_hand_ui.css","utf8");
const {opponentHandCount,createOpponentHandView} = vm.runInNewContext(
  js.replace(/export function/g,"function")+"\n({opponentHandCount,createOpponentHandView})",
  {document:{createElement:()=>({})}}
);
assert.equal(opponentHandCount({hands:{A:["me"],B:["secret1","secret2"]}},"A"),2);
assert.equal(opponentHandCount({hands:{A:["secret1"],B:["me"]}},"B"),1);
assert.equal(opponentHandCount({hands:{A:["me"],B:["secret"]}},"invalid"),0);
assert.equal(opponentHandCount({hands:{}},"A"),0);
assert.equal(opponentHandCount({hands:{B:Array(90).fill("secret")}},"A"),60);
assert.match(page,/id="enemyHandOverlay" hidden/);
assert.match(page,/class="enemyHandCards" aria-hidden="true"/);
assert.match(battle,/opponentHandView\.update\(st, seat\)/);
assert.match(styles,/pointer-events:none/);
assert.match(styles,/enemyHandBackPlayed/);
assert.doesNotMatch(js,/\.cardId|\.name|\.art|\.title|textContent\s*=\s*hand/);
console.log("Opponent hand overlay privacy, synchronisation, and non-interaction checks passed.");
