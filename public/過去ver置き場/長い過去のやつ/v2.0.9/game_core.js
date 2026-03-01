// public/game_core.js
// v1.7.0
// - マナ周りのユーティリティ（game.js が import して使う）
// - schema揺れ/欠損に強くしておく

export function nowMs(){
  return Date.now();
}

// マナ定数（必要ならここだけ触れば調整できる）
const CORE = {
  START_CUR: 2,
  START_MAX: 2,

  // ターン開始時：max を増やして cur を回復
  GROW_PER_TURN: 2,
  RECOVER_FULL: true,

  MAX_MANA: 20,
};

export function getManaConsts(){
  return { ...CORE };
}

function clamp(n, lo, hi){
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * mana の形が揺れても A/B の {cur,max} を返す
 * - null/undefined/古い形でも落ちない
 */
export function normalizeMana(mana){
  const res = {
    A: { cur: CORE.START_CUR, max: CORE.START_MAX },
    B: { cur: CORE.START_CUR, max: CORE.START_MAX },
  };

  if (!mana || typeof mana !== "object") return res;

  for (const k of ["A","B"]){
    const m = mana[k];
    if (m && typeof m === "object"){
      const cur = clamp(m.cur ?? m.current ?? res[k].cur, 0, CORE.MAX_MANA);
      const max = clamp(m.max ?? m.maximum ?? res[k].max, 0, CORE.MAX_MANA);
      res[k] = { cur: Math.min(cur, max), max };
    }
  }
  return res;
}

/**
 * ターン開始マナ更新
 * - max を GROW_PER_TURN だけ増やす（上限 MAX_MANA）
 * - cur は基本「全回復」にする（RECOVER_FULL=true）
 */
export function startTurnMana(mana, seatKey){
  const m = normalizeMana(mana);
  const cur = m[seatKey]?.cur ?? 0;
  const max = m[seatKey]?.max ?? 0;

  const newMax = clamp(max + CORE.GROW_PER_TURN, 0, CORE.MAX_MANA);
  const newCur = CORE.RECOVER_FULL ? newMax : clamp(cur, 0, newMax);

  return {
    ...m,
    [seatKey]: { cur: newCur, max: newMax }
  };
}

/**
 * マナ支払い（破壊的変更を避けてコピー返す）
 */
export function spendMana(mana, seatKey, cost){
  const c = Math.max(0, Math.trunc(Number(cost ?? 0)));
  const m = normalizeMana(mana);

  if ((m?.[seatKey]?.cur ?? 0) < c) {
    return { ok:false, mana:m };
  }

  const next = {
    ...m,
    [seatKey]: {
      ...m[seatKey],
      cur: (m[seatKey].cur - c),
    }
  };
  return { ok:true, mana: next };
}