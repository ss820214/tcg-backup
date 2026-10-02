// public/game_mobile_fit.js
// v20261003_1
// Final board fitter: measure the ACTUAL centerPane after safe-area / portrait / landscape CSS.
// This runs after the base mobile fitter and therefore corrects iOS notch/home-indicator cases.

const MOBILE_QUERY = "(max-width: 820px), ((pointer: coarse) and (max-width: 980px))";
const mq = window.matchMedia(MOBILE_QUERY);
const $ = (id) => document.getElementById(id);

let raf1 = 0;
let raf2 = 0;
let ro = null;
let bodyObserver = null;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fitFromStage() {
  if (!mq.matches || !document.body.classList.contains("mobileBattle")) return;
  const stage = $("centerPane");
  if (!stage) return;

  const rect = stage.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 120) return;

  const portrait = rect.height >= rect.width;
  const gap = rect.width <= 360 ? 3 : 4;
  const pad = 4;
  const availW = Math.max(100, Math.floor(rect.width) - 6);
  const availH = Math.max(100, Math.floor(rect.height) - 6);

  const byW = Math.floor((availW - pad * 2 - gap * 4) / 5);
  const byH = Math.floor((availH - pad * 2 - gap * 6) / 7);

  let cellW;
  let cellH;

  if (portrait) {
    cellW = clamp(byW, 34, 86);
    cellH = clamp(Math.min(byH, Math.floor(cellW * 1.34)), 32, 116);
  } else {
    // Landscape uses a right-side action rail. Prioritize height, then give cards
    // enough width for the name + two compact bars.
    cellH = clamp(byH, 28, 66);
    cellW = clamp(Math.min(byW, Math.floor(cellH * 1.28)), 36, 76);
  }

  // Final hard guarantee: if the min clamp itself would overflow a tiny viewport,
  // relax it rather than clipping the seventh row / fifth column.
  const totalW = (w) => w * 5 + gap * 4 + pad * 2;
  const totalH = (h) => h * 7 + gap * 6 + pad * 2;
  while (cellW > 24 && totalW(cellW) > availW) cellW -= 1;
  while (cellH > 24 && totalH(cellH) > availH) cellH -= 1;

  const root = document.documentElement;
  root.style.setProperty("--m-cell-w", `${cellW}px`, "important");
  root.style.setProperty("--m-cell-h", `${cellH}px`, "important");
  root.style.setProperty("--m-gap", `${gap}px`, "important");
}

function queueFit() {
  cancelAnimationFrame(raf1);
  cancelAnimationFrame(raf2);
  // The base mobile script also reacts to resize. Two frames puts this fitter last,
  // after fixed bars/safe-area/side-rail layout has settled.
  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(fitFromStage);
  });
}

function bindStage() {
  ro?.disconnect?.();
  const stage = $("centerPane");
  if (!stage || typeof ResizeObserver !== "function") return;
  ro = new ResizeObserver(queueFit);
  ro.observe(stage);
}

function reconcile() {
  if (!mq.matches) return;
  bindStage();
  queueFit();
}

function watchMobileClass() {
  bodyObserver?.disconnect?.();
  bodyObserver = new MutationObserver(() => {
    if (document.body.classList.contains("mobileBattle")) reconcile();
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    watchMobileClass();
    reconcile();
  }, { once: true });
} else {
  watchMobileClass();
  reconcile();
}

window.addEventListener("resize", queueFit, { passive: true });
window.addEventListener("orientationchange", queueFit, { passive: true });
window.visualViewport?.addEventListener("resize", queueFit, { passive: true });

if (typeof mq.addEventListener === "function") mq.addEventListener("change", reconcile);
else mq.addListener?.(reconcile);
