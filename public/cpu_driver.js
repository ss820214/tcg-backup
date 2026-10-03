// public/cpu_driver.js
import { createCpuAI } from "./cpu_ai.js?v=20260626_deckui_ai2";

export function createCpuDriver({ db, stateRef, matchRef, cardDefs, W, H }) {
  const aiBySeat = {};
  let busy = false;
  let lastTurnSeq = null;

  function getAi(seat) {
    const key = seat === "A" ? "A" : "B";
    if (!aiBySeat[key]) aiBySeat[key] = createCpuAI({ seat: key });
    return aiBySeat[key];
  }

  function getUnitById(st, id) {
    return (st.units || []).find(u => u && u.id === id) || null;
  }

  // 最低限：移動候補（4近傍1マス、空きマスのみ）
  function listLegalMoves(st, u) {
    if (!u || u.hp <= 0 || u.panic) return [];
    const occ = new Set((st.units || []).filter(x => x && x.hp > 0).map(x => `${x.x},${x.y}`));
    const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    const out = [];
    for (const d of dirs) {
      const x = u.x + d.dx, y = u.y + d.dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if (occ.has(`${x},${y}`)) continue;
      out.push({ to: { x, y } });
    }
    return out;
  }

  // 最低限：攻撃候補（「射程判定」は game.js 側関数が必要なので、ここは game.jsからhelpers渡す想定でもOK）
  function listLegalAttacksFallback(st, u) {
    // とりあえず「隣接だけ」でも動く（後で強化）
    const enemy = (st.units || []).filter(x => x && x.hp > 0 && x.owner !== u.owner);
    const out = [];
    const acts = (cardDefs?.[u.cardId]?.actions || []);
    for (let i = 0; i < acts.length; i++) {
      for (const e of enemy) {
        const d = Math.abs(e.x - u.x) + Math.abs(e.y - u.y);
        if (d === 1) out.push({ attackerId: u.id, actionIndex: i, targetId: e.id });
      }
    }
    return out;
  }

  async function tick(st, ctx) {
    if (!st || busy) return;
    if (st.winner) return;

    const cpuSeat = ctx?.cpuSeat ?? "B";
    if (st.turn !== cpuSeat) return;

    // 同じturnSeqで多重実行しない
    if (lastTurnSeq === st.turnSeq) return;
    lastTurnSeq = st.turnSeq;

    busy = true;
    try {
      // CPU思考
      const plan = getAi(cpuSeat).pickAction(st, {
        mySeat: cpuSeat,
        enemySeat: cpuSeat === "A" ? "B" : "A",
        helpers: {
          getUnitById: (id) => getUnitById(st, id),
          getActionsForUnit: (u) => cardDefs?.[u?.cardId]?.actions || [],
          listLegalMoves: (s, u) => listLegalMoves(s, u),
          listLegalAttacks: ctx?.helpers?.listLegalAttacks
            ? (s, u) => ctx.helpers.listLegalAttacks(s, u)
            : (s, u) => listLegalAttacksFallback(s, u),
        }
      });

      // 実行（ここは game.js 側に「CPUでも叩けるトランザクションAPI」を用意して呼ぶのが安全）
      await ctx.execCpuPlan(plan);
    } finally {
      busy = false;
    }
  }

  return { tick };
}
