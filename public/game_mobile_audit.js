// public/game_mobile_audit.js
// v20261003_1
// Runtime audit helper for real mobile devices. No game-state mutation.

const PRIMARY_IDS = [
  "modeSummon",
  "modeMove",
  "modeAttack",
  "modeEvolve",
  "modeSupport",
  "endTurn",
  "exBtn",
];

function rectInfo(el) {
  const r = el.getBoundingClientRect();
  return {
    left: Math.round(r.left),
    top: Math.round(r.top),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
}

function isPointOwnedBy(el, x, y) {
  const top = document.elementFromPoint(x, y);
  if (!top) return false;
  return top === el || el.contains(top) || top.closest?.(`#${CSS.escape(el.id)}`) === el;
}

function auditButton(id) {
  const el = document.getElementById(id);
  if (!el) return { id, exists: false, ok: false, reason: "missing" };

  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const visible =
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || 1) > 0 &&
    r.width > 0 &&
    r.height > 0;

  if (!visible) {
    return {
      id,
      exists: true,
      ok: !!el.disabled,
      disabled: !!el.disabled,
      reason: el.disabled ? "disabled/hidden" : "hidden",
      rect: rectInfo(el),
    };
  }

  const cx = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2));
  const cy = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2));
  const inViewport = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
  const owned = inViewport && isPointOwnedBy(el, cx, cy);
  const touchSize = r.width >= 40 && r.height >= 40;

  return {
    id,
    exists: true,
    ok: !!el.disabled || (visible && inViewport && owned && touchSize),
    disabled: !!el.disabled,
    visible,
    inViewport,
    topmostAtCenter: owned,
    touchSize,
    rect: rectInfo(el),
    reason: el.disabled
      ? "disabled"
      : !inViewport
        ? "offscreen"
        : !owned
          ? "covered"
          : !touchSize
            ? "small-target"
            : "ok",
  };
}

function auditBoard() {
  const board = document.getElementById("board");
  const stage = document.getElementById("centerPane");
  if (!board || !stage) return { ok: false, reason: "missing board/stage" };

  const b = board.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const cells = board.querySelectorAll(".cell").length;
  const fits =
    b.left >= s.left - 1 &&
    b.top >= s.top - 1 &&
    b.right <= s.right + 1 &&
    b.bottom <= s.bottom + 1;

  return {
    ok: fits && cells === 35,
    fits,
    cells,
    board: rectInfo(board),
    stage: rectInfo(stage),
  };
}

export function runMobileBattleAudit({ log = true } = {}) {
  const buttons = PRIMARY_IDS.map(auditButton);
  const board = auditBoard();
  const failures = buttons.filter((x) => !x.ok);
  if (!board.ok) failures.push({ id: "board", reason: board.reason || "board-overflow" });

  const result = {
    version: "20261003_1",
    at: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait",
    },
    board,
    buttons,
    ok: failures.length === 0,
    failures,
  };

  if (log) {
    if (result.ok) console.info("[mobile-ui audit] OK", result);
    else console.warn("[mobile-ui audit] issues", result);
    try { console.table(buttons); } catch {}
  }

  return result;
}

window.__mobileBattleAudit = runMobileBattleAudit;

function autoAudit() {
  if (!document.body.classList.contains("mobileBattle")) return;
  window.setTimeout(() => runMobileBattleAudit({ log: true }), 900);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoAudit, { once: true });
} else {
  autoAudit();
}

window.addEventListener("orientationchange", () => window.setTimeout(autoAudit, 700), { passive: true });
