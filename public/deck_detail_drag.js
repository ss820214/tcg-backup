// Hold the title bar briefly, then drag. The content remains scrollable.
export function installDetailDrag(panel) {
  const handle = panel.querySelector("#detailHead,.detailHead");
  if (!handle) return { cancel() {} };
  handle.title = "長押しして移動";
  handle.style.cssText += ";cursor:grab;touch-action:none;user-select:none;";
  let hold = null;
  let gesture = null;
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
  function place(left, top) {
    const box = panel.getBoundingClientRect();
    panel.style.left = `${clamp(left, 8, window.innerWidth - box.width - 8)}px`;
    panel.style.top = `${clamp(top, 8, window.innerHeight - Math.min(box.height, window.innerHeight - 16) - 8)}px`;
  }
  function cancel() {
    clearTimeout(hold);
    hold = null;
    if (gesture && handle.hasPointerCapture?.(gesture.id)) handle.releasePointerCapture(gesture.id);
    gesture = null;
    handle.style.cursor = "grab";
  }
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button,a,input,select,textarea")) return;
    cancel();
    const box = panel.getBoundingClientRect();
    gesture = { id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left, top:box.top, active:false };
    handle.setPointerCapture?.(event.pointerId);
    hold = setTimeout(() => {
      hold = null;
      if (!gesture) return;
      gesture.active = true;
      panel.style.position = "fixed";
      panel.style.margin = "0";
      panel.style.transform = "none";
      place(gesture.left, gesture.top);
      handle.style.cursor = "grabbing";
    }, 400);
  });
  handle.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.active) {
      if (Math.hypot(dx, dy) > 10) cancel();
      return;
    }
    event.preventDefault();
    place(gesture.left + dx, gesture.top + dy);
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(name, cancel);
  handle.addEventListener("contextmenu", event => event.preventDefault());
  window.addEventListener("resize", () => {
    cancel();
    if (panel.style.position === "fixed") {
      const box = panel.getBoundingClientRect();
      place(box.left, box.top);
    }
  });
  return { cancel };
}
