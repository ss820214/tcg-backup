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
const status=read("public/status_guide.html");
assert.match(status,/const statuses=/);
assert.match(status,/data-filter="buff"/);
assert.match(status,/data-filter="special"/);
assert.match(status,/statusGrid/);
const carddex=read("public/carddex.html");
for(const id of ["carddexSearch","seriesFilter","cardGrid","detail","stats"])assert.match(carddex,new RegExp('id="'+id+'"'));
const tutorial=read("public/tutorial.html");
for(const id of ["backBtn","prevBtn","nextBtn","stepNum","stepMax","stepBox"])assert.match(tutorial,new RegExp('id="'+id+'"'));
console.log("Tool destinations markup and syntax checks passed.");
