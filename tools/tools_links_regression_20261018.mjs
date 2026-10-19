// Regression checks for homepage Tools and Beginner destinations.
// Run from repository root: node tools/tools_links_regression_20261018.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = path => readFileSync(path,"utf8");
const deck=read("public/deck.js");
const routes={
  tier:"tier.html",carddex:"carddex.html",dice:"axis/index.html",
  status:"status_guide.html",changelog:"changelog.html",rule:"rule.html",
};
for(const [action,path] of Object.entries(routes)){
  assert.match(deck,new RegExp('data-home-action="'+action+'"'));
  assert.match(deck,new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  const page=read("public/"+path);
  assert.match(page,/<meta charset=/i);
}
for(const path of ["status_guide.html","carddex.html","tutorial.html","changelog.html","rule.html","tier.html","axis/index.html"]){
 const html=read("public/"+path);
 assert.doesNotMatch(html,/(?:縺|繝|譛|謾|蜍)/,"mojibake: "+path);
 for(const tag of ["div","section","button","article","nav","main"]){
   const opens=(html.match(new RegExp("<"+tag+"(?=[\\s>])","g"))||[]).length;
   const closes=(html.match(new RegExp("</"+tag+">","g"))||[]).length;
   assert.equal(opens,closes,tag+" mismatch in "+path);
 }
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
   if(match[1].trim())new vm.Script(match[1],{filename:path});
 }
}
const typography=read("public/document_typography_20261019.css");
assert.match(typography,/line-break:\s*strict/);
assert.match(typography,/text-wrap:\s*balance/);
for(const path of ["status_guide.html","rule.html","carddex.html","tutorial.html","changelog.html","tier.html"]){
 assert.match(read("public/"+path),/document_typography_20261019\.css\?v=/);
}
assert.match(deck,/data-home-action="status"[^>]*>状態効果<\/button>/);
assert.match(read("public/status_guide.html"),/<h1>状態効果ガイド<\/h1>/);
const status=read("public/status_guide.html");
assert.match(status,/const statuses=/);
assert.match(status,/data-filter="buff"/);
assert.match(status,/data-filter="special"/);
assert.match(status,/statusGrid/);
const carddex=read("public/carddex.html");
for(const id of ["carddexSearch","seriesFilter","cardGrid","detail","stats"])assert.match(carddex,new RegExp('id="'+id+'"'));
const tutorial=read("public/tutorial.html");
assert.match(tutorial,/id="openTutorial"/);
assert.match(tutorial,/import \{ TutorialSystem \} from/);
assert.match(tutorial,/tutorial\.openMenu\(\)/);
assert.doesNotMatch(tutorial,/id="stepBox"/);
console.log("Tool destinations markup and syntax checks passed.");
