// CPU deck protection shared by lobby and match bootstrap.
// Do not accept structurally empty or incomplete public decks just because
// they have a "deck" property. CPU battle decks use the same 30/4 rules as players.
export const CPU_DECK_SIZE = 30;
export const CPU_MAX_SAME = 4;

export function inspectCpuDeck(deck, { size = CPU_DECK_SIZE, defs = null } = {}) {
  if (!deck || typeof deck !== "object" || Array.isArray(deck)) {
    return { ok: false, total: 0, reason: "デッキ形式が不正" };
  }
  const entries = Object.entries(deck);
  if (!entries.length) return { ok: false, total: 0, reason: "デッキが空" };
  let total = 0;
  for (const [id, rawCount] of entries) {
    const count = Number(rawCount);
    if (!String(id).trim() || !Number.isInteger(count) ||
        count < 1 || count > CPU_MAX_SAME) {
      return { ok: false, total, reason: "カード枚数・IDが不正" };
    }
    total += count;
  }
  if (total !== size) return { ok: false, total, reason: `${size}枚必要（現在${total}枚）` };

  // A valid numeric deck may still be unplayable if every card is a support.
  // When definitions are available, require at least one recognized unit.
  if (defs && Object.keys(defs).length) {
    const canSummon = entries.some(([id]) => {
      const def = defs[id];
      if (!def) return false;
      const kind = String(def.kind || "").toLowerCase();
      const type = String(def.type || "").toLowerCase();
      return !["support", "ex_support", "exsupport"].includes(kind) &&
        !["support", "サポート", "ex_support", "exsupport"].includes(type) &&
        Number(def.hp || 0) > 0;
    });
    if (!canSummon) return { ok: false, total, reason: "召喚可能なカードがありません" };
  }
  return { ok: true, total, reason: "" };
}

// Safe to shuffle a copy: never mutate Firestore snapshots or a source deck.
export function expandCpuDeck(deck, rng = Math.random) {
  const report = inspectCpuDeck(deck);
  if (!report.ok) throw new Error("CPUデッキが無効: " + report.reason);
  const pile = [];
  for (const [id, count] of Object.entries(deck)) {
    for (let i = 0; i < Number(count); i++) pile.push(id);
  }
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
    [pile[i], pile[j]] = [pile[j], pile[i]];
  }
  return pile;
}

export function chooseCpuDeck(publicDecks, fallbackDeck, defs = null, rng = Math.random) {
  const acceptable = (Array.isArray(publicDecks) ? publicDecks : [])
    .filter(item => inspectCpuDeck(item?.deck, { defs }).ok);
  if (acceptable.length) {
    const i = Math.min(acceptable.length - 1, Math.max(0, Math.floor(rng() * acceptable.length)));
    const chosen = acceptable[i];
    return {
      deck: { ...chosen.deck },
      source: "public",
      title: String(chosen.title || "公開デッキ").slice(0,32),
      exSupport: String(chosen.exSupport || ""),
      desiredField: String(chosen.desiredField || ""),
    };
  }
  const report = inspectCpuDeck(fallbackDeck, { defs });
  if (report.ok) return { deck: { ...fallbackDeck }, source: "fallback", title: "CPU" };
  throw new Error("CPUの30枚デッキを準備できません（公開デッキに有効なものがなく、自分のデッキも " + report.reason + "）");
}

/**
 * Recover ONLY a solo match that literally started without CPU cards.
 * A legitimately exhausted deck, played unit or discard is never refilled.
 * The low turn-sequence bound avoids giving new cards to long-running matches.
 */
export function needsCpuOpeningRepair(state,cpuSeat) {
  if (!state || state.winner || state.cpuDeckRecovered || !["A","B"].includes(cpuSeat)) return false;
  const seq=Number(state.turnSeq ?? 1);
  if (!Number.isFinite(seq) || seq < 1 || seq > 12) return false;
  // Some legacy matches have a draw pile but no opening hand; they also need
  // a one-off 5-card draw. A legitimate consumed hand leaves units/discards/logs.
  if ((state.hands?.[cpuSeat]||[]).length ||
      (state.discards?.[cpuSeat]||[]).length) return false;
  if ((state.units||[]).some(u=>u?.owner===cpuSeat)) return false;
  // CPU turn-end logs alone do not imply it ever received a card.
  if ((state.log||[]).some(line=>typeof line==="string" &&
      line.startsWith("["+cpuSeat+"]") &&
      /(?:召喚|進化|サポート|Support|EX使用|CPU move|CPU attack|移動：|攻撃：)/.test(line))) return false;
  return true;
}
