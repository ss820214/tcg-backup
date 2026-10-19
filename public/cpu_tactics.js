// CPU tactical planner. No Firebase or DOM dependencies.
// Generates only high-confidence actions; game.js validates again transactionally.
// Player-vs-player is unaffected: this module is used exclusively by cpu_driver.js.
const STYLES = new Set(["aggressive", "balanced", "defensive", "infiltration"]);
const value = x => Math.max(0, Number(x) || 0);
const fraction = (current, maximum) => maximum > 0 ? Math.max(0, Math.min(1, current / maximum)) : 1;
const own = (u, seat) => u && u.owner === seat && value(u.hp) > 0 && !u.panic;
const enemy = (u, seat) => u && u.owner !== seat && value(u.hp) > 0 && !u.panic;
function priorityForSupport(type, target, seat, style) {
  const missingHp = target ? Math.max(0, value(target.maxHp) - value(target.hp)) : 0;
  const missingSp = target ? Math.max(0, value(target.maxSp) - value(target.sp)) : 0;
  const wounded = target && fraction(value(target.hp), value(target.maxHp)) < 0.5;
  if (type === "heal") return 13 + Math.min(70, missingHp * .65 + missingSp * .45) + (wounded ? 35 : 0);
  if (type === "cleanse") return 42;
  if (type === "draw" || type === "search") return 25;
  if (type === "modRate" || type === "powerUp" || type === "grantEvade") return style === "defensive" ? 45 : 30;
  if (type === "dmg") return style === "aggressive" ? 85 : 52;
  if (type === "addStatus" || type === "lostSoul") return style === "aggressive" ? 65 : 42;
  return 0;
}
function scoreCandidate(st, seat, style, item) {
  const units = st.units || [];
  const target = units.find(u => u.id === item.targetId);
  if (item.type === "evolve") {
    const base = units.find(u => u.id === item.baseUnitId);
    if (!base) return -Infinity;
    const danger = fraction(value(base.hp),value(base.maxHp)) < .3;
    const score = 60 + (base.fatigue ? 35 : 0) + (style === "aggressive" ? 18 : 0)
      + (style === "defensive" ? 13 : 0) - value(item.cost) * 4;
    return score - (danger ? 20 : 0);
  }
  if (item.type === "support") {
    const score = priorityForSupport(item.effectType,target,seat,style);
    if (score <= 0) return -Infinity;
    if (item.effectType === "heal" && target && !own(target,seat)) return -Infinity;
    if (item.effectType === "dmg" && target && !enemy(target,seat)) return -Infinity;
    return score - value(item.cost) * 3;
  }
  return -Infinity;
}
/**
 * Return a chosen advanced plan or null so the existing AI can act.
 * A candidate is never trusted as legal by the execution layer.
 */
export function pickAdvancedCpuPlan(st, {seat = "B", style = "balanced", helpers = {}, basePlan = null} = {}) {
  if (!st || st.winner || st.turn !== seat) return null;
  const mode = STYLES.has(style) ? style : "balanced";
  const candidates = [
    ...(helpers.listLegalEvolves?.(st) || []),
    ...(helpers.listLegalSupports?.(st) || []),
  ];
  let best = null, bestScore = -Infinity;
  for (const plan of candidates) {
    if (!plan || !["evolve","support"].includes(plan.type)) continue;
    const score = scoreCandidate(st,seat,mode,plan);
    if (Number.isFinite(score) && score > bestScore) {bestScore = score;best = plan;}
  }
  if (!best) return null;
  // A winning attack still outranks support/upgrade; preserve infiltration rush.
  if (mode === "infiltration" && basePlan?.meta?.reason === "goalRush") return null;
  if (basePlan?.type === "attack" && value(basePlan.meta?.score) >= (mode === "defensive" ? 120 : 100)) return null;
  // Attack-focused CPU uses useful immediate attacks before routine buffs.
  if (mode === "aggressive" && basePlan?.type === "attack" && value(basePlan.meta?.score) > bestScore * .65) return null;
  if (mode === "infiltration" && basePlan?.type === "move" && bestScore < 40) return null;
  // Take free buffs, substantial heals and good evolutions, not marginal spam.
  if (bestScore < (mode === "infiltration" ? 48 : 22)) return null;
  return {...best,meta:{...(best.meta || {}),score:bestScore}};
}
