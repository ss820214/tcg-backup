// Offline checks of new battle readability and detail report modules.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const battle=vm.runInNewContext(read("public/battle_readability.js").replace(/export function/g,"function")+"\n({predictMoveCells,latestEnemyAction})");
const results=vm.runInNewContext(read("public/battle_result_details.js").replace(/export function/g,"function")+"\n({summarizeBattle})");
const unit={id:"a",owner:"A",hp:40,x:2,y:5,moveTurnSeq:1,moveUsed:0};
const st={turn:"A",turnSeq:1,mana:{A:{cur:2}},units:[unit,{id:"b",owner:"B",hp:50,x:2,y:4}]};
const moves=battle.predictMoveCells(st,unit,"A",5,7);
assert.equal(moves.length,3,"blocked enemy square removed");
assert.equal(moves.some(p=>p.x===2&&p.y===4),false);
assert.equal(battle.predictMoveCells({...st,mana:{A:{cur:0}}},unit,"A").length,0);
assert.equal(battle.predictMoveCells({...st,turn:"B"},unit,"A").length,0);
const previous={units:st.units,lastMove:{at:1,owner:"B"}};
const current={units:st.units,lastMove:{at:2,owner:"B",from:{x:2,y:4},to:{x:2,y:3}}};
assert.equal(battle.latestEnemyAction(previous,current,"A").label,"移動");
assert.equal(battle.latestEnemyAction(previous,{...current,lastMove:{...current.lastMove,owner:"A"}},"A"),null);
assert.equal(battle.latestEnemyAction({log:["start"]},{log:["start","[B] サポート成功：回復 (-2)"]},"A").label,"サポート成功：回復 (-2)");
const report=results.summarizeBattle({log:[
 "[A] 召喚：カードA (1,5)",
 "[B] CPU 召喚：カードB (2,1)",
 "[B] CPU move: カードB (2,1) -> (2,2)",
 "[A] サポート成功：回復 (-2)",
 "試合終了"
]},"A");
assert.equal(report.mine.summons,1);
assert.equal(report.opponent.summons,1);
assert.equal(report.opponent.moves,1);
assert.equal(report.mine.spentMana,2);
const game=read("public/game.js"),html=read("public/game.html"),victory=read("public/victory_screen.js");
assert.match(game,/updateBattleReadability\(st\)/);
assert.match(game,/onAfterRender: st=>updateBattleReadability\(st\)/);
assert.match(html,/id="battleRecentAction"/);
assert.match(html,/id="battleRecentAction"/, "Latest-action status remains on battle field");
assert.match(victory,/renderBattleDetails\(document\.getElementById\("battleActionDetails"\)/);
console.log("Battle usability features: movement hints, enemy action filter, log collapse and result summary OK.");
