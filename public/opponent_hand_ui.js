// 0バト: opponent hand silhouette. No card IDs, names or art enter the DOM.
// The live Firestore state already includes hand arrays; only their length is used.
export function opponentHandCount(state, mySeat) {
  const opponent = mySeat === "A" ? "B" : mySeat === "B" ? "A" : null;
  const hand = opponent && state?.hands?.[opponent];
  return Array.isArray(hand) ? Math.max(0, Math.min(60, hand.length)) : 0;
}

export function createOpponentHandView(root, { animationMs = 320 } = {}) {
  if (!root) return { update() {}, destroy() {} };
  const cards = root.querySelector(".enemyHandCards");
  const caption = root.querySelector(".enemyHandCaption");
  if (!cards) return { update() {}, destroy() {} };

  let previousCount = null;
  let nextKey = 0;
  let activeCards = [];
  let hidden = true;
  let disposed = false;
  let hideTimer = null;

  function createBack() {
    const el = document.createElement("span");
    el.className = "enemyHandBack";
    el.setAttribute("aria-hidden", "true");
    el.dataset.key = String(nextKey++);
    return el;
  }
  function clear() {
    for (const el of activeCards) el.remove();
    activeCards = [];
    cards.replaceChildren();
    previousCount = null;
  }
  function update(state, mySeat) {
    if (disposed) return;
    const theirTurn = !!mySeat && state?.turn && state.turn !== mySeat && !state?.winner;
    const count = opponentHandCount(state, mySeat);
    if (!theirTurn) {
      if (!hidden && previousCount !== null && count < previousCount) {
        // Briefly retain the last play animation across the turn boundary.
        root.classList.add("enemyHandLeaving");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (hidden && !disposed) { root.hidden = true; clear(); }
        }, animationMs + 120);
      } else {
        root.hidden = true;
        root.classList.remove("enemyHandLeaving");
        clearTimeout(hideTimer);
        clear();
      }
      hidden = true;
      return;
    }
    hidden = false;
    clearTimeout(hideTimer);
    root.hidden = false;
    root.classList.remove("enemyHandLeaving");

    if (previousCount === null) {
      clear();
      for (let i = 0; i < count; i++) {
        const node = createBack();
        cards.appendChild(node);
        activeCards.push(node);
      }
    } else {
      while (activeCards.length > count) {
        const node = activeCards.pop();
        node.classList.add("enemyHandBackPlayed");
        node.addEventListener("animationend", () => node.remove(), { once: true });
        setTimeout(() => node.remove(), animationMs + 150);
      }
      while (activeCards.length < count) {
        const node = createBack();
        node.classList.add("enemyHandBackDrawn");
        cards.appendChild(node);
        activeCards.push(node);
      }
    }
    previousCount = count;
    root.setAttribute("aria-label", "相手の手札 " + count + "枚（カード内容は非公開）");
    if (caption) caption.textContent = "相手の手札 " + count + "枚";
    // Avoid huge hand rows over the playfield.
    cards.classList.toggle("enemyHandCompact", count > 12);
  }
  function destroy() {
    disposed = true;
    clearTimeout(hideTimer);
    clear();
    root.hidden = true;
  }
  return { update, destroy };
}
