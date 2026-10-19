// Presentation only: prediction marks, enemy-action toast, and movement ghosts.
// No Firestore writes, no card reveals, no modifications to battle rules.
export function predictMoveCells(state, unit, seat, W=5, H=7) {
  if (!state || !unit || state.turn!==seat || unit.owner!==seat ||
      !(Number(unit.hp)>0) || unit.panic) return [];
  const seq=Number(state.turnSeq??1);
  const used=Number(unit.moveTurnSeq)===seq?Number(unit.moveUsed??0):0;
  if (used>=2 || Number(state.mana?.[seat]?.cur??0)<1) return [];
  const occupied=new Set((state.units||[]).filter(u=>u&&Number(u.hp)>0).map(u=>u.x+","+u.y));
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy])=>({x:Number(unit.x)+dx,y:Number(unit.y)+dy}))
    .filter(p=>p.x>=0&&p.x<W&&p.y>=0&&p.y<H&&!occupied.has(p.x+","+p.y));
}
export function latestEnemyAction(previous,current,seat) {
  if (!previous || !current || !seat) return null;
  const enemy=seat==="A"?"B":"A";
  const types=[
    ["lastSummon","召喚"],["lastMove","移動"],["lastHit","攻撃"],
    ["lastEvolve","進化"],["lastSupportRoll","サポート"]
  ];
  const changes=[];
  for(const [field,label] of types){
    const cur=current[field],old=previous[field];
    const actor=cur?.owner||cur?.seat||(cur?.attackerId ? (current.units||[]).find(u=>u.id===cur.attackerId)?.owner : null);
    if(cur?.at && Number(cur.at)!==Number(old?.at) && actor===enemy) {
      changes.push({kind:field,label,at:Number(cur.at),cardId:cur.cardId||null,from:cur.from||null,to:cur.to||null});
    }
  }
  // Events are first choice. Some historical support/evolution effects have
  // no owner field; in those cases use only *new* already-public battle log lines.
  if (changes.length) return changes.sort((a,b)=>b.at-a.at)[0];
  const before=Array.isArray(previous.log)?previous.log:[];
  const after=Array.isArray(current.log)?current.log:[];
  if(after.length>before.length){
    const additions=after.slice(before.length);
    for(let i=additions.length-1;i>=0;i--){
      const line=String(additions[i]||"");
      if(!line.startsWith("["+enemy+"]"))continue;
      if(/(?:サポート|Support|EX|進化|召喚|move|移動|attack|攻撃)/i.test(line)){
        return {kind:"log",label:line.replace(/^\[[AB]\]\s*/,"").slice(0,58),cardId:null};
      }
    }
  }
  return null;
}
export function createBattleReadability({board,notice,seat,getCardName,toView}) {
  let previous=null;
  let toastTimer=0;
  let animating=false;
  const showNotice=(message)=>{
    if(!notice)return;
    notice.textContent=message;
    notice.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{notice.hidden=true},3000);
  };
  function moveGhost(from,to,swap=false) {
    if (!board || !from || !to || animating || matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const old=toView(from), next=toView(to);
    const start=board.querySelector(`.cell[data-x="${old.x}"][data-y="${old.y}"]`);
    const dest=board.querySelector(`.cell[data-x="${next.x}"][data-y="${next.y}"]`);
    if(!start||!dest)return;
    const a=start.getBoundingClientRect(),b=dest.getBoundingClientRect(),root=board.getBoundingClientRect();
    const ghost=document.createElement("span");
    ghost.className="battleReadableGhost";
    ghost.style.left=(a.left-root.left)+"px";
    ghost.style.top=(a.top-root.top)+"px";
    ghost.style.width=a.width+"px";
    ghost.style.height=a.height+"px";
    ghost.textContent=swap?"⇄":"➜";
    board.appendChild(ghost);
    animating=true;
    const animation=ghost.animate(
      [{transform:"translate(0,0)",opacity:.7},{transform:`translate(${b.left-a.left}px,${b.top-a.top}px)`,opacity:0}],
      {duration:480,easing:"ease-in-out"}
    );
    animation.finished.catch(()=>{}).finally(()=>{ghost.remove();animating=false});
  }
  function update(state,{mode,selectedId,attackMap,moveBlocked=false}={}){
    if(!state)return;
    const cells=board?.querySelectorAll(".cell")||[];
    for(const cell of cells)cell.classList.remove("battlePredMove","battlePredAttack");
    if(state.turn===seat&&selectedId){
      const unit=(state.units||[]).find(x=>x.id===selectedId);
      if(unit && mode==="move" && !moveBlocked){
        for(const p of predictMoveCells(state,unit,seat)){
          const v=toView(p),cell=board?.querySelector(`.cell[data-x="${v.x}"][data-y="${v.y}"]`);
          cell?.classList.add("battlePredMove");
        }
      }else if(unit&&mode==="attack"&&attackMap){
        // Use the game's existing range calculator, not a new approximation.
        for(const [key,info] of attackMap){
          if(!info?.ok)continue;
          const [x,y]=key.split(",").map(Number),v=toView({x,y});
          board?.querySelector(`.cell[data-x="${v.x}"][data-y="${v.y}"]`)?.classList.add("battlePredAttack");
        }
      }
    }
    const event=latestEnemyAction(previous,state,seat);
    if(event){
      showNotice("相手の行動："+event.label+(event.cardId?"（"+String(getCardName(event.cardId)).slice(0,28)+"）":""));
      // Regular movement already uses the existing game.js move trail effect.
    }
    if(previous&&Array.isArray(previous.units)&&Array.isArray(state.units)){
      for(const before of previous.units){
        const after=state.units.find(u=>u.id===before.id);
        if(!after||Number(before.hp)<=0||Number(after.hp)<=0)continue;
        if(before.x===after.x&&before.y===after.y)continue;
        // Swaps have no lastMove marker; animate both displacement hints once.
        const swapped=previous.units.some(peer=>{
          if(peer.id===before.id)return false;
          const latest=state.units.find(u=>u.id===peer.id);
          return latest&&peer.x===after.x&&peer.y===after.y&&latest.x===before.x&&latest.y===before.y;
        });
        if(swapped){moveGhost({x:before.x,y:before.y},{x:after.x,y:after.y},true);showNotice("位置入れ替えが発生");break;}
      }
    }
    previous={...state,units:(state.units||[]).map(u=>({...u}))};
  }
  return {update,dispose(){clearTimeout(toastTimer);}};
}
