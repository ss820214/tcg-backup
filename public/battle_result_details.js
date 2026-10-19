// Pure, conservative post-match summary; only count identifiable log events.
export function summarizeBattle(state={},seat="A"){
 const messages=Array.isArray(state.log)?state.log.filter(x=>typeof x==="string"):[];
 const summary={A:{summons:0,moves:0,attacks:0,evolves:0,supports:0,spentMana:0},B:{summons:0,moves:0,attacks:0,evolves:0,supports:0,spentMana:0}};
 for(const line of messages){
   const m=line.match(/^\[([AB])\]\s*(.*)$/);
   if(!m)continue;
   const side=m[1],detail=m[2],s=summary[side];
   if(/(?:CPU\s*)?召喚[：:]/.test(detail))s.summons++;
   else if(/(?:CPU move:|移動[：:])/.test(detail))s.moves++;
   else if(/(?:CPU attack:|攻撃[：:])/.test(detail))s.attacks++;
   else if(/(?:進化[：:]|進化成功)/.test(detail))s.evolves++;
   else if(/(?:Support成功|Support使用|サポート成功|サポート使用|EX使用)/.test(detail))s.supports++;
   const cost=detail.match(/\(-([0-9]+)\)/);
   if(cost)s.spentMana+=Number(cost[1]);
 }
 const mine=seat==="B"?"B":"A",other=mine==="A"?"B":"A";
 return {mine:summary[mine],opponent:summary[other],totalLogEntries:messages.length};
}
export function renderBattleDetails(host,state,seat){
 if(!host)return;
 const {mine,opponent,totalLogEntries}=summarizeBattle(state,seat);
 host.replaceChildren();
 const heading=document.createElement("h3");
 heading.textContent="対戦行動レポート";
 host.appendChild(heading);
 const note=document.createElement("p");
 note.textContent="記録されたログからの集計です。記録されていない行動・消費マナは含みません。";
 host.appendChild(note);
 const table=document.createElement("table");
 table.className="resultActionTable";
 const labels=[["summons","召喚"],["moves","移動"],["attacks","攻撃"],["evolves","進化"],["supports","サポート・EX"],["spentMana","ログ上の消費マナ"]];
 const header=document.createElement("tr");
 for(const t of ["項目","自分","相手"]){const th=document.createElement("th");th.textContent=t;header.appendChild(th)}
 table.appendChild(header);
 for(const [key,label] of labels){
   const tr=document.createElement("tr");
   for(const t of [label,String(mine[key]),String(opponent[key])]){const td=document.createElement("td");td.textContent=t;tr.appendChild(td)}
   table.appendChild(tr);
 }
 host.appendChild(table);
 const detail=document.createElement("details");
 const summary=document.createElement("summary");summary.textContent="対戦ログを見る（"+totalLogEntries+"件）";
 detail.appendChild(summary);
 const pre=document.createElement("pre");pre.textContent=(state.log||[]).filter(x=>typeof x==="string").join("\n");
 detail.appendChild(pre);
 host.appendChild(detail);
}
