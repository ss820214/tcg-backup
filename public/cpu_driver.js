// public/cpu_driver.js
import { createCpuAI } from "./cpu_ai.js?v=20261019_four_styles3";
import { pickAdvancedCpuPlan } from "./cpu_tactics.js?v=20261019_cpu_advanced1";

export function createCpuDriver({ db, stateRef, matchRef, cardDefs, W, H, style = "balanced" }) {
  const aiBySeat = {};
  let busy = false;
  let lastTurnSeq = null;

  function getAi(seat) {
    const key = seat === "A" ? "A" : "B";
    if (!aiBySeat[key]) aiBySeat[key] = createCpuAI({ seat: key, style });
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
    if (!st || busy || st.winner) return;
    const cpuSeat = ctx?.cpuSeat ?? "B";
    if (st.turn !== cpuSeat) return;
    const seq = Number(st.turnSeq ?? 1);
    if (lastTurnSeq === seq) return;
    busy = true;
    let finishSucceeded = false;
    const tried = new Set();
    try {
      let state = st;
      ctx?.onDebug?.("start", {seq,seat:cpuSeat,hand:(st.hands?.[cpuSeat]||[]).length,mana:st.mana?.[cpuSeat]?.cur,deck:(st.decks?.[cpuSeat]||[]).length});
      // Bound successful actions AND failed plan attempts.
      for (let step = 0; step < 12; step++) {
        if (!state || state.winner || state.turn !== cpuSeat ||
            Number(state.turnSeq ?? 1) !== seq) break;
        const basePlan = getAi(cpuSeat).pickAction(state, {
          mySeat: cpuSeat,
          enemySeat: cpuSeat === "A" ? "B" : "A",
          helpers: {
            getUnitById: id => getUnitById(state, id),
            getActionsForUnit: u => cardDefs?.[u?.cardId]?.actions || [],
            listLegalMoves: ctx?.helpers?.listLegalMoves || listLegalMoves,
            listLegalAttacks: ctx?.helpers?.listLegalAttacks || listLegalAttacksFallback,
            listLegalSummons: ctx?.helpers?.listLegalSummons || (() => []),
            goalProgress: ctx?.helpers?.goalProgress,
          },
        });
        const plan = pickAdvancedCpuPlan(state, {
          seat: cpuSeat,style,basePlan,
          helpers: {
            listLegalEvolves: ctx?.helpers?.listLegalEvolves,
            listLegalSupports: ctx?.helpers?.listLegalSupports,
          },
        }) || basePlan;
        if (!plan || plan.type === "end") {
          ctx?.onDebug?.("no-action",{step,hand:(state.hands?.[cpuSeat]||[]).length,mana:state.mana?.[cpuSeat]?.cur,deck:(state.decks?.[cpuSeat]||[]).length});
          break;
        }
        const signature = JSON.stringify([plan.type,plan.cardId,plan.handIndex,plan.unitId,plan.attackerId,plan.targetId,plan.baseUnitId,plan.to]);
        if (tried.has(signature)) {
          ctx?.onDebug?.("repeated-plan",{step,plan:plan.type});
          break;
        }
        tried.add(signature);
        ctx?.onDebug?.("plan",{step,kind:plan.type});
        let changed=false;
        try { changed=!!(await ctx.execCpuPlan(plan)); }
        catch (error) { ctx?.onDebug?.("action-error",{kind:plan.type,message:String(error?.message||error)}); }
        if (!changed) {
          ctx?.onDebug?.("rejected",{step,kind:plan.type});
          // A failed candidate cannot occupy the whole turn silently.
          // Retry only after refreshing the state; give up on repeated candidates.
          state = await ctx.readState();
          continue;
        }
        tried.clear();
        state = await ctx.readState();
      }
      if (ctx.finishTurn) finishSucceeded=!!(await ctx.finishTurn());
      ctx?.onDebug?.("finished",{ok:finishSucceeded});
    } catch (error) {
      console.warn("[cpu] turn failed",error);
      ctx?.onDebug?.("driver-error",{message:String(error?.message||error)});
      try {finishSucceeded=!!(await ctx.finishTurn?.());} catch(e){console.warn("[cpu] end turn failed",e);}
    } finally {
      // Mark the turn processed only when it advanced successfully.
      if (finishSucceeded) lastTurnSeq=seq;
      busy=false;
    }
  }

  return { tick };
}
