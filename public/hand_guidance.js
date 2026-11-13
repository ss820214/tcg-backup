// Display-only next steps; gameplay validation and execution stay in game.js.
export function buildHandGuidance(s = {}) {
  const result = {
    text: '使いたいカードをタップ', tone: 'idle', boardVisible: false,
    modeLabel: s.support ? '対象選択' : '進化元選択', modeDisabled: true,
  };
  if (!s.hasCard) return result;
  result.boardVisible = ['summon', 'evolve', 'support'].includes(s.mode);
  const block = text => ({...result, text, tone:'blocked'});
  if (s.winner) return block('対戦終了。カードは使用できません');
  if (!s.canAct) return block('相手のターンです。自分のターンを待ってね');
  if (s.locked) return block('伏せ中。次の自分のターンまで使用できません');
  const mana = Math.max(0, Number(s.mana) || 0);
  const cost = Math.max(0, Number(s.cost) || 0);
  const shortage = `マナが${Math.max(0,cost-mana)}不足（必要${cost}／現在${mana}）`;
  if (s.support) {
    const need = s.supportNeed || 'none';
    result.modeLabel = need === 'search' ? 'カード選択' : s.supportReady ? '使用を確認' : '対象選択';
    if (mana < cost) return block(shortage);
    result.modeDisabled = false;
    if (s.mode !== 'support') return {...result, text:`「${result.modeLabel}」から使用準備へ`, tone:'support'};
    if (need === 'search') return {...result, text:'「カード選択」で探すカードを選び、サポート発動で確定', tone:'support'};
    if (s.supportReady) return {...result, text:need === 'none' ? '対象選択は不要。「サポート発動」で確定' : '対象選択済み。「サポート発動」で確定', tone:'support'};
    const target = s.supportTarget === 'ally' ? '味方' : s.supportTarget === 'enemy' ? '敵' : '対象のキャラ';
    let text = `${target}をタップして選択`;
    if (need === 'unit2') text = s.supportFirst ? '入れ替える2体目のキャラをタップ' : '入れ替える1体目のキャラをタップ';
    if (need === 'unitCell') text = s.supportFirst ? '移動先の光る空きマスをタップ' : '移動させるキャラをタップ';
    if (need === 'units') text = `${target}を${Math.max(1,Number(s.supportCount)||1)}体選択（${Number(s.supportPicked)||0}体選択済み）`;
    return {...result,text,tone:'support'};
  }
  result.modeDisabled = !s.evolveCandidates;
  result.modeLabel = s.evolveCandidates ? '進化元選択' : '進化対象なし';
  if (s.mode === 'evolve') {
    if (!s.evolveCandidates) return block('進化できる味方がいません（同属性・低コスト・必要マナ）');
    if (s.evolveReady) return {...result,text:'進化元を選択済み。「進化を実行」で確定',modeLabel:'進化を確認',tone:'evolve'};
    return {...result,text:'光る味方をタップ。進化はコスト差分のマナを消費',tone:'evolve'};
  }
  if (s.mode !== 'summon') return {...result,text:'カードを選び直すか「進化元選択」へ',tone:'idle'};
  if (mana < cost) return {...block(shortage),modeDisabled:result.modeDisabled};
  if (s.summonFull) return {...block('場のキャラが上限です。進化するか場を空けてね'),modeDisabled:result.modeDisabled};
  if (!s.summonSpace) return {...block('召喚できる空きマスがありません'),modeDisabled:result.modeDisabled};
  return {...result,text:`自陣の光る空きマスをタップして召喚（${cost}マナ）`,tone:'summon'};
}
