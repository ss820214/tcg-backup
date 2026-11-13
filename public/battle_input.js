// A render may replace the tapped card before the click reaches document.
const commandSurfaces = '#board,#actionPicker,#hand,#handDrawer,#handDrawerToggle,#detail,#quickActions,#battleAttackConfirmDock,.actionOrbit,button,input,select,textarea,a';
export function isBattleCommandEvent(event) {
  const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
  return [event?.target, ...path].some(node => !!node?.closest?.(commandSurfaces));
}

// A long press already handled the pointer gesture. Consume its trailing click,
// even if the original card was replaced. A fresh pointerdown starts a new gesture.
export function createLongPressClickGuard(doc = document) {
  let consumed = false;
  const reset = () => { consumed = false; };
  const click = event => {
    if (!consumed || event.detail === 0) return;
    consumed = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  doc.addEventListener('pointerdown', reset, true);
  doc.addEventListener('click', click, true);
  return {consume: () => { consumed = true; }};
}
