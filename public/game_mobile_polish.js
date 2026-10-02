// public/game_mobile_polish.js
// v20261003_2
// Small mobile affordances that mirror desktop-only controls without touching game rules.

const MOBILE_QUERY = "(max-width: 820px), ((pointer: coarse) and (max-width: 980px))";
const mq = window.matchMedia(MOBILE_QUERY);

const $ = (id) => document.getElementById(id);
let sourceObserver = null;
let hintObserver = null;
let bodyObserver = null;

function ensureHint() {
  let hint = $("mobileModeHint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "mobileModeHint";
    hint.setAttribute("aria-live", "polite");
    document.body.appendChild(hint);
  }
  return hint;
}

function syncHint() {
  const hint = ensureHint();
  const src = $("modeHint");
  let text = String(src?.textContent || "").replace(/\s+/g, " ").trim();
  if (text.length > 72) text = text.slice(0, 69) + "…";
  hint.textContent = mq.matches ? text : "";
}

function bindHint() {
  hintObserver?.disconnect?.();
  const src = $("modeHint");
  if (src) {
    hintObserver = new MutationObserver(syncHint);
    hintObserver.observe(src, { subtree: true, childList: true, characterData: true });
  }
  syncHint();
}

function compactBgmLabel(text) {
  const on = /ON|🔊/i.test(String(text || ""));
  return on ? "🔊 BGM ON" : "🔇 BGM OFF";
}

function mountExtraControls() {
  if (!mq.matches) return false;
  const panel = $("mobilePanel-log");
  const sourceBgm = $("bgmToggleBtn");
  if (!panel || !sourceBgm) return false;

  let wrap = panel.querySelector(".mobileExtraControls");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "mobileExtraControls";
    panel.prepend(wrap);
  }

  let bgm = $("mobileBgmMirror");
  if (!bgm) {
    bgm = document.createElement("button");
    bgm.id = "mobileBgmMirror";
    bgm.type = "button";
    bgm.addEventListener("click", () => sourceBgm.click());
    wrap.appendChild(bgm);
  }
  bgm.textContent = compactBgmLabel(sourceBgm.textContent);

  const sourceConsole = $("consoleToggleBtn");
  let consoleMirror = $("mobileConsoleMirror");
  if (sourceConsole && !consoleMirror) {
    consoleMirror = document.createElement("button");
    consoleMirror.id = "mobileConsoleMirror";
    consoleMirror.type = "button";
    consoleMirror.textContent = "🖥 コンソール";
    consoleMirror.addEventListener("click", () => sourceConsole.click());
    wrap.appendChild(consoleMirror);
  }

  sourceObserver?.disconnect?.();
  sourceObserver = new MutationObserver(() => {
    const mirror = $("mobileBgmMirror");
    if (mirror) mirror.textContent = compactBgmLabel(sourceBgm.textContent);
  });
  sourceObserver.observe(sourceBgm, { subtree: true, childList: true, characterData: true });

  // The expensive body-wide observer is only needed during startup/re-mount.
  bodyObserver?.disconnect?.();
  bodyObserver = null;
  return true;
}

function watchForMobileShell() {
  bodyObserver?.disconnect?.();
  bodyObserver = null;
  if (!mq.matches) return;
  if (mountExtraControls()) return;

  bodyObserver = new MutationObserver(() => {
    mountExtraControls();
  });
  bodyObserver.observe(document.body, { subtree: true, childList: true });
}

function reconcile() {
  syncHint();
  if (mq.matches) {
    watchForMobileShell();
  } else {
    sourceObserver?.disconnect?.();
    sourceObserver = null;
    bodyObserver?.disconnect?.();
    bodyObserver = null;
    $("mobileModeHint")?.replaceChildren();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bindHint();
    reconcile();
  }, { once: true });
} else {
  bindHint();
  reconcile();
}

if (typeof mq.addEventListener === "function") mq.addEventListener("change", reconcile);
else mq.addListener?.(reconcile);
