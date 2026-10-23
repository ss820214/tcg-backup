// Guard critical HP/SP semantics and deck controls before live deployment.
// Read-only test: never touches user or Firebase data.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = p => fs.readFileSync(p, "utf8");
const source = read("public/action_text.js");
const actionDetailPartsJa = vm.runInNewContext(
  source.replace(/^export\s+/gm, "") + "\nactionDetailPartsJa",
  {window: {}, console}
);
for (const [hpDelta, spDelta, expected] of [
  [20, 0, [0, 0, 20, 0]],
  [-20, 0, [20, 0, 0, 0]],
  [0, 10, [0, 0, 0, 10]],
  [0, -10, [0, 10, 0, 0]],
]) {
  const a = actionDetailPartsJa({name: "check", rate: 100, hpDelta, spDelta});
  assert.deepEqual(
    [a.hpDmg, a.spDmg, a.hpHeal, a.spHeal],
    expected,
    "Wrong HP/SP healing vs damage convention"
  );
}
const deck = read("public/deck.js");
const home = read("public/index.html");
for (const id of ["libraryPanelMinBtn", "deckPanelMinBtn", "deckInfoMinBtn", "btnClearDeck", "detailClose"]) {
  assert.ok(home.includes('id="' + id + '"'), "Missing deck UI control: " + id);
}
assert.ok(deck.includes("showCardDetail(cardId)"), "Card details unavailable");
assert.ok(deck.includes('id="obHomeVersion"'), "Home version marker unavailable");
assert.ok(home.includes('id="obDeckLayoutV102"'), "Deck layout correction unavailable");
assert.match(home, /deck\.js\?v=/);
console.log("HP/SP and deck control contracts pass.");
