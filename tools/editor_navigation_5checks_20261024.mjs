import assert from "node:assert/strict";
import fs from "node:fs";
const home=fs.readFileSync("public/index.html","utf8");
const deck=fs.readFileSync("public/deck.js","utf8");
const checks=[
  ["no editor tab placed in home HTML",()=>{assert.doesNotMatch(home,/<nav id="obEditorNavV1016"/);assert.doesNotMatch(home,/<style id="obEditorNavStyleV1016"/);}],
  ["deck.js creates exactly two navigation choices",()=>{assert.match(deck,/id = "obEditorTabsIntegrated"/);assert.match(deck,/data-editor-target="cards"/);assert.match(deck,/data-editor-target="deck"/);assert.doesNotMatch(deck,/data-editor-target="owned"/);}],
  ["nav follows mobile shell and hides while home is visible",()=>{assert.match(deck,/shell\.insertBefore\(nav, shell\.firstChild\)/);assert.match(deck,/homeShown \? "none" : "flex"/);}],
  ["mutually exclusive card and deck panels",()=>{assert.match(deck,/library\.style\.setProperty\("display", isDeck \? "none" : "flex", "important"\)/);assert.match(deck,/deck\.style\.setProperty\("display", isDeck \? "flex" : "none", "important"\)/);}],
  ["unfold selected deck and override mobile height cap",()=>{assert.match(deck,/info\?\.classList\.remove\("isCollapsed"\)/);assert.match(deck,/mobileDeckStackShell\[data-editor-target="deck"\]>#deckPanel\{display:flex!important;max-height:none!important/);}]
];
checks.forEach(([name,fn],i)=>{fn();console.log("PASS "+(i+1)+"/5 "+name);});
