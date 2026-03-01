// public/game_core.js
// マナ管理（A/B対応）

const MANA_CONSTS = {
  MAX_MANA: 20,
  START_MAX: 2,
  START_CUR: 2,
  GROW_PER_TURN: 2,
};

export function getManaConsts() {
  return { ...MANA_CONSTS };
}

export function nowMs() {
  return Date.now();
}

export function normalizeMana(mana) {
  const out = { A: { cur: 0, max: 0 }, B: { cur: 0, max: 0 } };

  const src = mana || {};
  for (const k of ["A", "B"]) {
    const cur = Number(src?.[k]?.cur ?? 0);
    const max = Number(src?.[k]?.max ?? 0);

    const clampedMax = clampInt(max, 0, MANA_CONSTS.MAX_MANA);
    const clampedCur = clampInt(cur, 0, clampedMax);

    out[k] = { cur: clampedCur, max: clampedMax };
  }
  return out;
}

export function startTurnMana(mana, turnSeat) {
  const m = normalizeMana(mana);
  const seat = (turnSeat === "B") ? "B" : "A";

  const nextMax = clampInt(m[seat].max + MANA_CONSTS.GROW_PER_TURN, 0, MANA_CONSTS.MAX_MANA);
  m[seat].max = nextMax;
  m[seat].cur = nextMax;

  return m;
}

export function spendMana(mana, seat, cost) {
  const m = normalizeMana(mana);
  const s = (seat === "B") ? "B" : "A";
  const c = Math.max(0, Math.trunc(Number(cost ?? 0)));

  if (m[s].cur < c) return { ok: false, mana: m };
  m[s].cur -= c;
  return { ok: true, mana: m };
}

function clampInt(n, min, max) {
  const v = Math.trunc(Number.isFinite(n) ? n : 0);
  return Math.min(max, Math.max(min, v));
}