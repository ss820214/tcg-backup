// Lightweight source-level regression checks for 0bato's recent UI fixes.
// Run from repository root: node tools/ui_regression_20261017.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path, "utf8");
const home = read("public/index.html");
const deck = read("public/deck.js");
const play = read("public/play.js");
const playHtml = read("public/play.html");
const post = read("public/post_box.js");
const game = read("public/game.js");
const gameHtml = read("public/game.html");
const css = read("public/ux_refinement_20261017.css");

assert.match(deck, /data-home-beginner-toggle/);
assert.match(deck, /data-home-beginner-panel/);
assert.match(deck, /deckHomeBeginnerPanel\[hidden\]/);
assert.match(deck, /data-home-action="beginner"/);
assert.match(deck, /data-home-action="guide"/);
assert.match(deck, /data-home-action="rule"/);
assert.match(deck, /setBeginnerOpen\(beginnerPanel.hidden\)/);
assert.match(home, /deck\.js\?v=20261017_beginner_dropdown3/);
assert.match(playHtml, /id="fieldSelect"/);
assert.match(playHtml, /id="confirmField"/);
assert.match(play, /mode!=="join" && fieldPicker/);
assert.match(play, /if\(mode!=="join"\)await setDoc\(roomRef/);
assert.match(play, /field=validField\(r\.data\(\)\?\.desiredField/);
assert.match(post, /generation !== openGeneration/);
assert.match(post, /target\.closest\("\[data-post-close\]"\)/);
assert.match(game, /showInfiltrationPulse\(who\)/);
assert.doesNotMatch(game, /HIGH MANA EVOLVE/);
assert.match(game, /const maxTicks = 5/);
assert.match(css, /infiltrationPulseA/);
assert.match(css, /uHPWrap/);
assert.match(gameHtml, /ux_refinement_20261017\.css\?v=6/);
console.log("0bato UI regression checks passed");
