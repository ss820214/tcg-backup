import assert from "node:assert/strict";
import fs from "node:fs";
const home=fs.readFileSync("public/index.html","utf8");
const deck=fs.readFileSync("public/deck.js","utf8");
const checks=[
 ["only two top-level tabs",()=>{assert.match(home,/data-ob-editor-view="cards"/);assert.match(home,/data-ob-editor-view="deck"/);assert.doesNotMatch(home,/data-ob-editor-view="owned"/);}],
 ["nav enters actual mobile shell",()=>{assert.match(home,/shell\.insertBefore\(nav,shell\.firstChild\)/);assert.match(deck,/shell\.appendChild\(library\)/);assert.match(deck,/shell\.appendChild\(deck\)/);}],
 ["panels switch exclusively",()=>{assert.match(home,/library\.style\.setProperty\("display",deckView\?"none":"flex","important"\)/);assert.match(home,/deck\.style\.setProperty\("display",deckView\?"flex":"none","important"\)/);}],
 ["legacy max-height overridden",()=>{assert.match(home,/mobileDeckStackShell:has\(#obEditorNavV1016\[data-view="deck"\]\) > #deckPanel \{display:flex!important;max-height:none!important/);}],
 ["deck contents uncollapse",()=>{assert.match(home,/info\?\.classList\.remove\("isCollapsed"\)/);assert.match(home,/body\?\.style\.setProperty\("display","block","important"\)/);assert.match(home,/document\.getElementById\("btnDeckTop"\)\?\.addEventListener/);}]
];
checks.forEach(([name,run],i)=>{run();console.log(`PASS ${i+1}/5: ${name}`);});
