// Presentation and a shared submission lock. Battle rules remain in game.js.
export function battleCommandState(s={}) {
  const hidden={visible:false,ready:false,label:'実行',status:''};
  if (!s.canControl || !['attack','evolve','support'].includes(s.mode)) return hidden;
  const mana=Number(s.mana)||0,cost=Math.max(0,Number(s.cost)||0);
  if (s.mode==='attack') {
    if (!s.ownUnit) return hidden;
    let status=s.actionText||'技を選択してください';
    if (s.unitBlocked) status='このキャラは行動できません（疲労・パニック）';
    else if (s.hasAction && mana<cost) status=`マナ不足（必要${cost}／現在${mana}）`;
    else if (s.hasAction && s.needsTarget && !s.hasTarget) status+=' ／ 盤面の対象をタップ';
    return {visible:true,ready:!!s.hasAction&&!s.unitBlocked&&mana>=cost&&(!s.needsTarget||s.hasTarget),label:'攻撃決定',status};
  }
  if (!s.hasCard) return hidden;
  if (s.mode==='evolve') return {visible:true,ready:!!s.evolutionReady&&!s.handLocked,label:'進化を実行',status:s.guide||'進化元を選択してください'};
  return {visible:true,ready:!!s.supportReady&&!s.handLocked&&mana>=cost&&s.searchReady!==false,label:'サポート発動',status:s.guide||'対象を選択してください'};
}
export function createCommandGate(onChange=()=>{}) {
  let busy=false;
  return {
    get busy(){return busy;},
    async run(execute){
      if(busy)return false;
      busy=true;
      try{onChange(true);await execute();return true;}
      finally{busy=false;onChange(false);}
    },
  };
}
