// Solo CPU deck integrity. Pure functions shared by lobby and battle.
// An object is not a playable deck unless it contains exactly the intended cards.
export const CPU_DECK_SIZE = 30;
export const CPU_OPENING_HAND = 5;

export function normalizeCpuDeck(deck, knownIds = null) {
  if (!deck || typeof deck !== "object" || Array.isArray(deck)) return {};
  const known = knownIds ? new Set(knownIds) : null;
  const out = {};
  for (const [id, raw] of Object.entries(deck)) {
    if (!id || (known && !known.has(id))) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 4) continue;
    out[id] = n;
  }
  return out;
}
export function cpuDeckSize(deck) {
  return Object.values(normalizeCpuDeck(deck)).reduce((sum,n)=>sum+n,0);
}
export function validCpuDeck(deck, size = CPU_DECK_SIZE, knownIds = null) {
  const normalized = normalizeCpuDeck(deck, knownIds);
  return Object.values(normalized).reduce((sum,n)=>sum+n,0) === size;
}
export function pickCpuDeck(publicDeck, fallbackDeck, knownIds = null) {
  if (validCpuDeck(publicDeck, CPU_DECK_SIZE, knownIds))
    return {deck: normalizeCpuDeck(publicDeck, knownIds), source:"public"};
  if (validCpuDeck(fallbackDeck, CPU_DECK_SIZE, knownIds))
    return {deck: normalizeCpuDeck(fallbackDeck, knownIds), source:"fallback"};
  return {deck:null, source:"missing"};
}
// Only repair the explicitly broken initial state, never an ordinarily emptied deck.
export function needsCpuOpeningRepair(state, cpuSeat) {
  if (!state || state.winner || state.cpuDeckRecovered || !["A","B"].includes(cpuSeat)) return false;
  const seq=Number(state.turnSeq ?? 1);
  if (!Number.isFinite(seq) || seq < 1 || seq > 12) return false;
  if ((state.hands?.[cpuSeat]||[]).length ||
      (state.decks?.[cpuSeat]||[]).length ||
      (state.discards?.[cpuSeat]||[]).length) return false;
  // Even a knocked-out unit or a played support means cards were present.
  if ((state.units||[]).some(u=>u?.owner===cpuSeat)) return false;
  const logs=Array.isArray(state.log)?state.log:[];
  if (logs.some(line=>typeof line==="string" &&
      new RegExp("^\\["+cpuSeat+"\\]").test(line) &&
      /(?:召喚|進化|サポート|Support|EX使用|CPU move|CPU attack|移動：|攻撃：)/.test(line))) return false;
  return true;
}
export function prepareCpuOpening(deck, shuffle = a => a) {
  if (!validCpuDeck(deck)) return null;
  const list=Object.entries(normalizeCpuDeck(deck)).flatMap(([id,n])=>Array(n).fill(id));
  const randomized=shuffle([...list]);
  if (!Array.isArray(randomized) || randomized.length !== list.length) return null;
  return {hand: randomized.slice(-CPU_OPENING_HAND),deck:randomized.slice(0,-CPU_OPENING_HAND)};
}
