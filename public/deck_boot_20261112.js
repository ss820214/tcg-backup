/* Explicit application readiness: window.load / a finished fetch are not app-ready. */
(() => {
  "use strict";
  const root = document.documentElement;
  const assets = new Map();
  let state = "loading";
  let label = "画面を読み込み中…";
  let appComplete = false;
  let ui = null;
  let text = null;
  let retry = null;
  let settling = false;
  let assetWarning = false;
  let slow = false;
  let hideTimer;
  let watchdog;

  const style = document.createElement("style");
  style.textContent = `
    html[data-deck-boot-state="loading"] #tcgNetFeedback,
    html[data-deck-boot-state="error"] #tcgNetFeedback,
    html[data-deck-boot-state="loading"] #tcgLoadRail { display:none!important; }
    #obDeckBootStatus { position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));
      transform:translateX(-50%);z-index:2147483602;display:flex;align-items:center;gap:9px;
      width:max-content;box-sizing:border-box;max-width:calc(100vw - 24px);padding:10px 14px;border-radius:22px;border:1px solid #74cbb6;
      background:#0b1925f5;color:#effffb;font:700 12px/1.5 system-ui,sans-serif;
      box-shadow:0 5px 22px #0008;pointer-events:none; }
    #obDeckBootStatus[hidden] { display:none!important; }
    #obDeckBootStatus .obBootSpinner { width:16px;height:16px;flex-shrink:0;border:2px solid #ffffff38;
      border-top-color:#8affce;border-radius:50%;animation:obBootSpin .8s linear infinite; }
    #obDeckBootStatus[data-state="ready"] .obBootSpinner { animation:none;border:0; }
    #obDeckBootStatus[data-state="ready"] .obBootSpinner::before { content:"✓";color:#8affce; }
    #obDeckBootStatus[data-state="error"] { border-color:#ffb177; }
    #obDeckBootStatus[data-state="error"] .obBootSpinner { display:none; }
    #obDeckBootStatus button { pointer-events:auto;font:inherit;color:inherit;background:#ffffff16;
      border:1px solid #ffffff50;border-radius:12px;padding:5px 9px;white-space:nowrap;min-height:32px; }
    #obDeckBootStatus button[hidden] { display:none!important; }
    @keyframes obBootSpin { to { transform:rotate(360deg); } }
    @media(prefers-reduced-motion:reduce) { #obDeckBootStatus .obBootSpinner { animation:none; } }
  `;
  document.head.appendChild(style);

  function render() {
    root.dataset.deckBootState = state;
    if (!document.body) return;
    if (!ui) {
      ui = document.createElement("div");
      ui.id = "obDeckBootStatus";
      ui.setAttribute("role", "status");
      ui.setAttribute("aria-live", "polite");
      const spinner = document.createElement("span");
      spinner.className = "obBootSpinner";
      spinner.setAttribute("aria-hidden", "true");
      text = document.createElement("span");
      retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "再読み込み";
      retry.addEventListener("click", () => location.reload());
      ui.append(spinner, text, retry);
      document.body.appendChild(ui);
    }
    ui.dataset.state = state;
    const message = slow && state === "loading" ? `${label}（時間がかかっています）` : label;
    if (text.textContent !== message) text.textContent = message;
    retry.hidden = state !== "error" && !slow;
    const main = document.querySelector("main");
    if (main) {
      main.inert = state !== "ready";
      main.setAttribute("aria-busy", String(state !== "ready"));
    }
  }

  function stage(message) {
    if (state !== "loading") return;
    label = message;
    slow = false;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { slow = true; render(); }, 15000);
    render();
  }

  function fail(message = "準備に失敗しました。再読み込みしてください") {
    if (state === "ready") return;
    state = "error";
    label = message;
    clearTimeout(watchdog);
    render();
  }

  async function step(message, task) {
    stage(message);
    try { return await task(); }
    catch (error) { fail(); throw error; }
  }

  function asset(src) {
    if (!src || assets.has(src)) return;
    const image = new Image();
    const promise = new Promise(resolve => {
      let timer;
      const finish = (ok) => {
        clearTimeout(timer);
        if (!ok) assetWarning = true;
        resolve(); // A decorative image failure must not disable the editor.
      };
      image.onload = async () => {
        try { if (image.decode) await image.decode(); finish(true); }
        catch { finish(false); }
      };
      image.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), 15000);
      image.src = src;
    });
    assets.set(src, promise);
  }

  async function finish() {
    if (!appComplete || settling || state !== "loading") return;
    if (root.dataset.deckRuntimeReady !== "true") {
      stage("操作機能を読み込み中…");
      return;
    }
    settling = true;
    stage("アセット（画像）を読み込み中…");
    await Promise.all([...assets.values(), window.TCG_DECK_LAYOUT_READY]);
    if (state !== "loading") return;
    stage("操作できるか確認中…");
    // Let handlers, layout adapters and a real input task take their turn before success.
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 120)));
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (state !== "loading") return;
    state = "ready";
    label = assetWarning ? "操作できます（一部の画像を読み込めませんでした）" : "準備完了";
    clearTimeout(watchdog);
    render();
    window.dispatchEvent(new CustomEvent("tcg:deck-ready"));
    hideTimer = setTimeout(() => { if (ui) ui.hidden = true; }, assetWarning ? 5000 : 1400);
  }

  window.TCG_DECK_BOOT = {
    stage, step, asset, fail,
    complete() { appComplete = true; return finish(); },
    get state() { return state; },
  };
  window.addEventListener("tcg:deck-runtime-ready", () => { void finish(); });
  window.addEventListener("unhandledrejection", () => fail());
  window.addEventListener("error", event => {
    const target = event.target;
    if (target?.matches?.("script[src],link[rel='stylesheet'][href]") || event.error) fail();
  }, true);
  const syncMotion = () => {
    const paused = document.hidden ? "true" : "false";
    if (root.dataset.homeMotionPaused !== paused) root.dataset.homeMotionPaused = paused;
  };
  document.addEventListener("visibilitychange", syncMotion);
  root.dataset.homeLightMotion = String(Boolean(navigator.connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)));
  syncMotion();
  document.addEventListener("DOMContentLoaded", render, { once:true });
  stage(label);
})();
