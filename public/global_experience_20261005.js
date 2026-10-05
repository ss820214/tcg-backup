(() => {
  "use strict";

  const VERSION = "20261005_experience1";
  const FEEDBACK_STYLE_ID = "tcgGlobalExperienceStyle20261005";
  const HOME_STYLE_ID = "tcgHomeCompletionStyle20261005";
  const root = document.documentElement;
  let activeCount = 0;
  let showTimer = 0;
  let longTimer = 0;
  let hideTimer = 0;
  let lastRetry = () => location.reload();
  let feedbackEl = null;
  let textEl = null;
  let retryEl = null;
  let railEl = null;
  let homeObserver = null;

  function injectFeedbackStyle() {
    if (document.getElementById(FEEDBACK_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = FEEDBACK_STYLE_ID;
    style.textContent = `
      #tcgLoadRail {
        position: fixed;
        left: 0;
        top: 0;
        width: 100%;
        height: 3px;
        z-index: 2147483600;
        pointer-events: none;
        opacity: 0;
        overflow: hidden;
        background: rgba(255,255,255,.04);
        transition: opacity .18s ease;
      }
      #tcgLoadRail::after {
        content: "";
        position: absolute;
        inset: 0 auto 0 -36%;
        width: 36%;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(108,225,255,.95), rgba(190,255,135,.92), transparent);
        box-shadow: 0 0 15px rgba(108,225,255,.65);
        animation: tcgLoadRailMove 1.05s cubic-bezier(.42,0,.2,1) infinite;
      }
      html[data-tcg-net-state="loading"] #tcgLoadRail { opacity: 1; }

      #tcgNetFeedback {
        position: fixed;
        left: 50%;
        bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        z-index: 2147483601;
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 42px;
        max-width: min(92vw, 520px);
        padding: 9px 11px;
        border: 1px solid rgba(140,225,255,.30);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(22,31,43,.95), rgba(6,9,14,.96));
        color: rgba(248,253,255,.96);
        box-shadow: 0 16px 44px rgba(0,0,0,.46), 0 0 26px rgba(95,205,255,.13), inset 0 1px rgba(255,255,255,.08);
        backdrop-filter: blur(14px) saturate(1.18);
        transform: translate(-50%, 14px) scale(.98);
        opacity: 0;
        visibility: hidden;
        transition: opacity .18s ease, transform .18s ease, visibility .18s step-end;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: .02em;
        pointer-events: none;
      }
      #tcgNetFeedback.is-visible {
        opacity: 1;
        visibility: visible;
        transform: translate(-50%, 0) scale(1);
        transition: opacity .18s ease, transform .18s ease, visibility 0s;
        pointer-events: auto;
      }
      #tcgNetFeedback[data-state="error"],
      #tcgNetFeedback[data-state="offline"] {
        border-color: rgba(255,112,112,.48);
        box-shadow: 0 16px 44px rgba(0,0,0,.48), 0 0 28px rgba(255,80,80,.15), inset 0 1px rgba(255,255,255,.07);
      }
      #tcgNetFeedback[data-state="success"] {
        border-color: rgba(125,255,184,.42);
      }
      .tcgNetSpinner {
        width: 17px;
        height: 17px;
        flex: 0 0 auto;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,.17);
        border-top-color: rgba(120,225,255,.98);
        border-right-color: rgba(190,255,130,.76);
        animation: tcgNetSpin .72s linear infinite;
      }
      #tcgNetFeedback[data-state="error"] .tcgNetSpinner,
      #tcgNetFeedback[data-state="offline"] .tcgNetSpinner,
      #tcgNetFeedback[data-state="success"] .tcgNetSpinner {
        animation: none;
        border: 0;
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        font-size: 14px;
      }
      #tcgNetFeedback[data-state="error"] .tcgNetSpinner::before,
      #tcgNetFeedback[data-state="offline"] .tcgNetSpinner::before { content: "!"; color: #ff8c8c; }
      #tcgNetFeedback[data-state="success"] .tcgNetSpinner::before { content: "✓"; color: #8dffc0; }
      .tcgNetText {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tcgNetRetry {
        appearance: none;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: #fff;
        min-height: 28px;
        padding: 4px 10px;
        font: inherit;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
        display: none;
      }
      #tcgNetFeedback[data-state="error"] .tcgNetRetry,
      #tcgNetFeedback[data-state="offline"] .tcgNetRetry { display: inline-flex; align-items: center; }
      .tcgNetRetry:active { transform: scale(.96); }

      @keyframes tcgLoadRailMove { to { left: 136%; } }
      @keyframes tcgNetSpin { to { transform: rotate(360deg); } }

      @media (max-width: 600px) {
        #tcgNetFeedback {
          bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          min-height: 40px;
          max-width: calc(100vw - 18px);
          padding: 8px 10px;
          font-size: 11px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #tcgLoadRail::after, .tcgNetSpinner { animation-duration: 1.8s !important; }
        #tcgNetFeedback { transition-duration: .08s !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureFeedbackUi() {
    injectFeedbackStyle();
    if (!document.body) return false;
    if (!railEl) {
      railEl = document.getElementById("tcgLoadRail") || document.createElement("div");
      railEl.id = "tcgLoadRail";
      railEl.setAttribute("aria-hidden", "true");
      if (!railEl.isConnected) document.body.appendChild(railEl);
    }
    if (!feedbackEl) {
      feedbackEl = document.getElementById("tcgNetFeedback") || document.createElement("div");
      feedbackEl.id = "tcgNetFeedback";
      feedbackEl.setAttribute("role", "status");
      feedbackEl.setAttribute("aria-live", "polite");
      const spinner = document.createElement("span");
      spinner.className = "tcgNetSpinner";
      spinner.setAttribute("aria-hidden", "true");
      textEl = document.createElement("span");
      textEl.className = "tcgNetText";
      retryEl = document.createElement("button");
      retryEl.type = "button";
      retryEl.className = "tcgNetRetry";
      retryEl.textContent = "再試行";
      retryEl.addEventListener("click", () => {
        try { lastRetry?.(); } catch { location.reload(); }
      });
      feedbackEl.replaceChildren(spinner, textEl, retryEl);
      if (!feedbackEl.isConnected) document.body.appendChild(feedbackEl);
    }
    return true;
  }

  function setState(state, message, options = {}) {
    if (!ensureFeedbackUi()) {
      requestAnimationFrame(() => setState(state, message, options));
      return;
    }
    clearTimeout(hideTimer);
    feedbackEl.dataset.state = state;
    textEl.textContent = message;
    root.dataset.tcgNetState = state;
    if (options.retry) lastRetry = options.retry;
    feedbackEl.classList.add("is-visible");
    if (options.autoHide) {
      hideTimer = window.setTimeout(() => hideStatus(), options.autoHide);
    }
  }

  function hideStatus() {
    clearTimeout(hideTimer);
    if (!feedbackEl) return;
    feedbackEl.classList.remove("is-visible");
    if (root.dataset.tcgNetState !== "offline") root.dataset.tcgNetState = "idle";
  }

  function begin(label = "読み込み中…", options = {}) {
    activeCount += 1;
    const delay = Number.isFinite(options.delay) ? options.delay : 320;
    clearTimeout(showTimer);
    clearTimeout(longTimer);
    showTimer = window.setTimeout(() => {
      if (activeCount > 0 && navigator.onLine !== false) setState("loading", label);
    }, Math.max(0, delay));
    longTimer = window.setTimeout(() => {
      if (activeCount > 0 && navigator.onLine !== false) setState("loading", "読み込みに時間がかかっています…");
    }, 8000);
    return { done: () => end() };
  }

  function end() {
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount > 0) return;
    clearTimeout(showTimer);
    clearTimeout(longTimer);
    if (root.dataset.tcgNetState === "loading") {
      setState("success", "準備完了", { autoHide: 700 });
    }
  }

  function showError(message = "通信に失敗しました", retry) {
    activeCount = 0;
    clearTimeout(showTimer);
    clearTimeout(longTimer);
    setState("error", message, { retry: retry || (() => location.reload()) });
  }

  function showSuccess(message = "完了しました") {
    setState("success", message, { autoHide: 1050 });
  }

  function looksStreaming(url) {
    const value = String(url || "");
    return /(?:Listen|Write|channel|WebChannel|google\.firestore\.v1\.Firestore\.(?:Listen|Write))/i.test(value);
  }

  function requestUrl(input) {
    try {
      if (typeof input === "string") return input;
      if (input?.url) return input.url;
      return String(input || "");
    } catch {
      return "";
    }
  }

  function installFetchTracking() {
    if (!window.fetch || window.fetch.__tcgFeedbackWrapped) return;
    const originalFetch = window.fetch.bind(window);
    const wrapped = async function tcgTrackedFetch(input, init) {
      const url = requestUrl(input);
      const shouldTrack = !looksStreaming(url) && !/^data:|^blob:/i.test(url);
      const token = shouldTrack ? begin("通信中…", { delay: 380 }) : null;
      try {
        const response = await originalFetch(input, init);
        token?.done();
        if (shouldTrack && response && response.status >= 500) {
          showError(`通信エラー (${response.status})`);
        }
        return response;
      } catch (error) {
        token?.done();
        if (shouldTrack) showError(navigator.onLine === false ? "オフラインです" : "通信に失敗しました");
        throw error;
      }
    };
    wrapped.__tcgFeedbackWrapped = true;
    wrapped.__tcgOriginalFetch = originalFetch;
    window.fetch = wrapped;
  }

  function installNetworkEvents() {
    window.addEventListener("offline", () => {
      setState("offline", "オフラインです。接続を確認してください", { retry: () => location.reload() });
    });
    window.addEventListener("online", () => {
      activeCount = 0;
      setState("success", "通信が復帰しました", { autoHide: 1400 });
    });
    window.addEventListener("unhandledrejection", (event) => {
      const text = String(event.reason?.message || event.reason || "");
      if (/network|fetch|offline|unavailable|timeout|failed to load|firebase/i.test(text)) {
        showError(navigator.onLine === false ? "オフラインです" : "通信処理に失敗しました");
      }
    });
    window.addEventListener("error", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.matches("script[src],link[rel='stylesheet'][href]")) return;
      showError("必要なデータを読み込めませんでした");
    }, true);
  }

  function installInitialLoadFeedback() {
    if (document.readyState === "complete") return;
    const token = begin("画面を読み込み中…", { delay: 260 });
    window.addEventListener("load", () => token.done(), { once: true });
  }

  function injectHomeStyle() {
    if (document.getElementById(HOME_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HOME_STYLE_ID;
    style.textContent = `
      #deckStart.tcgHomeComplete {
        isolation: isolate;
      }
      #deckStart.tcgHomeComplete .deckStartShell,
      #deckStart.tcgHomeComplete .deckStartStage,
      #deckStart.tcgHomeComplete .deckStartLeft {
        position: relative;
        z-index: 2;
      }
      #deckStart .tcgHomeAtmosphere {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        pointer-events: none;
        opacity: .82;
      }
      #deckStart .tcgHomeAtmosphere::before {
        content: "";
        position: absolute;
        inset: -18%;
        background:
          radial-gradient(circle at 18% 20%, rgba(82,196,255,.16), transparent 28%),
          radial-gradient(circle at 84% 28%, rgba(170,255,92,.10), transparent 30%),
          radial-gradient(circle at 52% 88%, rgba(105,105,255,.10), transparent 32%);
        filter: blur(10px);
        animation: tcgHomeAura 9s ease-in-out infinite alternate;
      }
      #deckStart .tcgHomeRing {
        position: absolute;
        right: -8vmin;
        top: 12%;
        width: min(56vmin, 430px);
        aspect-ratio: 1;
        border-radius: 50%;
        border: 1px solid rgba(135,225,255,.12);
        box-shadow: inset 0 0 45px rgba(85,195,255,.045), 0 0 40px rgba(90,210,255,.035);
        animation: tcgHomeRingSpin 24s linear infinite;
      }
      #deckStart .tcgHomeRing::before,
      #deckStart .tcgHomeRing::after {
        content: "";
        position: absolute;
        border-radius: inherit;
        border: 1px dashed rgba(195,255,135,.10);
      }
      #deckStart .tcgHomeRing::before { inset: 12%; }
      #deckStart .tcgHomeRing::after { inset: 27%; border-color: rgba(125,185,255,.12); }
      #deckStart .tcgHomeMote {
        --mx: 0px;
        --my: -80px;
        position: absolute;
        width: 3px;
        height: 3px;
        border-radius: 50%;
        background: rgba(210,247,255,.88);
        box-shadow: 0 0 9px rgba(100,220,255,.78);
        opacity: 0;
        animation: tcgHomeMote 5.8s ease-in-out infinite;
      }

      #deckStart.tcgHomeComplete .deckStartStage,
      #deckStart.tcgHomeComplete .deckStartLeft {
        border-color: rgba(150,220,255,.14) !important;
        box-shadow: 0 18px 50px rgba(0,0,0,.34), inset 0 1px rgba(255,255,255,.055), inset 0 0 34px rgba(70,175,255,.025) !important;
      }
      #deckStart.tcgHomeComplete .deckStartProfile,
      #deckStart.tcgHomeComplete .deckStartPass {
        border-color: rgba(145,215,255,.17) !important;
        box-shadow: inset 0 1px rgba(255,255,255,.055), 0 8px 22px rgba(0,0,0,.18) !important;
      }
      #deckStart.tcgHomeComplete .deckStartTitle {
        text-shadow: 0 3px 0 rgba(0,0,0,.46), 0 0 22px rgba(90,195,255,.24), 0 15px 34px rgba(0,0,0,.52) !important;
      }
      #deckStart.tcgHomeComplete .deckStartSub {
        text-shadow: 0 2px 10px rgba(0,0,0,.72);
      }

      #deckStart.tcgHomeComplete .deckHomeBtn {
        position: relative !important;
        isolation: isolate;
        border-color: rgba(160,220,255,.17) !important;
        box-shadow: 0 9px 24px rgba(0,0,0,.28), inset 0 1px rgba(255,255,255,.075) !important;
        transition: transform .16s cubic-bezier(.2,.8,.2,1), filter .16s ease, border-color .16s ease, box-shadow .16s ease !important;
        -webkit-tap-highlight-color: transparent;
      }
      #deckStart.tcgHomeComplete .deckHomeBtn > :not(.tcgHomeBtnGlow) {
        position: relative;
        z-index: 2;
      }
      #deckStart .tcgHomeBtnGlow {
        position: absolute;
        inset: 0;
        z-index: 1;
        border-radius: inherit;
        pointer-events: none;
        opacity: 0;
        background: radial-gradient(120px circle at var(--tcg-px,50%) var(--tcg-py,50%), rgba(150,230,255,.20), transparent 62%);
        transition: opacity .16s ease;
      }
      @media (hover:hover) and (pointer:fine) {
        #deckStart.tcgHomeComplete .deckHomeBtn:hover {
          transform: translateY(-2px) scale(1.012) !important;
          filter: brightness(1.10) saturate(1.08);
          border-color: rgba(150,225,255,.34) !important;
          box-shadow: 0 13px 28px rgba(0,0,0,.34), 0 0 22px rgba(85,195,255,.10), inset 0 1px rgba(255,255,255,.09) !important;
        }
        #deckStart.tcgHomeComplete .deckHomeBtn:hover .tcgHomeBtnGlow { opacity: 1; }
      }
      #deckStart.tcgHomeComplete .deckHomeBtn.tcgHomePressed {
        transform: translateY(1px) scale(.975) !important;
        filter: brightness(1.18);
        box-shadow: 0 4px 13px rgba(0,0,0,.30), 0 0 24px rgba(95,215,255,.16), inset 0 0 22px rgba(135,230,255,.09) !important;
      }

      #deckStart.tcgHomeComplete .deckStartDuel {
        position: relative !important;
        isolation: isolate;
        overflow: hidden !important;
        border-color: rgba(155,235,255,.46) !important;
        box-shadow: 0 13px 30px rgba(0,0,0,.38), 0 0 28px rgba(95,210,255,.16), inset 0 1px rgba(255,255,255,.12) !important;
        text-shadow: 0 2px 8px rgba(0,0,0,.62), 0 0 14px rgba(175,240,255,.28);
        transition: transform .14s ease, filter .14s ease, box-shadow .14s ease !important;
      }
      #deckStart .tcgPlaySweep {
        position: absolute;
        z-index: -1;
        top: -60%;
        bottom: -60%;
        left: -38%;
        width: 24%;
        transform: skewX(-18deg);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
        animation: tcgPlaySweep 2.8s ease-in-out infinite;
        pointer-events: none;
      }
      #deckStart.tcgHomeComplete .deckStartDuel:active {
        transform: translateY(1px) scale(.985) !important;
        filter: brightness(1.14);
      }

      @keyframes tcgHomeAura {
        0% { transform: translate3d(-1.5%, -1%, 0) scale(1); opacity: .72; }
        100% { transform: translate3d(2%, 1.5%, 0) scale(1.04); opacity: 1; }
      }
      @keyframes tcgHomeRingSpin { to { transform: rotate(360deg); } }
      @keyframes tcgHomeMote {
        0% { transform: translate3d(0, 24px, 0) scale(.5); opacity: 0; }
        20% { opacity: .72; }
        78% { opacity: .38; }
        100% { transform: translate3d(var(--mx), var(--my), 0) scale(1.2); opacity: 0; }
      }
      @keyframes tcgPlaySweep {
        0%, 58% { left: -42%; opacity: 0; }
        68% { opacity: .9; }
        88%,100% { left: 122%; opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        #deckStart .tcgHomeAtmosphere::before,
        #deckStart .tcgHomeRing,
        #deckStart .tcgHomeMote,
        #deckStart .tcgPlaySweep { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function isHomePage() {
    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return file === "index.html" || file === "";
  }

  function decorateHome() {
    if (!isHomePage()) return false;
    const home = document.getElementById("deckStart");
    if (!home) return false;
    injectHomeStyle();
    home.classList.add("tcgHomeComplete");

    if (!home.querySelector(":scope > .tcgHomeAtmosphere")) {
      const atmosphere = document.createElement("div");
      atmosphere.className = "tcgHomeAtmosphere";
      atmosphere.setAttribute("aria-hidden", "true");
      const ring = document.createElement("i");
      ring.className = "tcgHomeRing";
      atmosphere.appendChild(ring);
      for (let i = 0; i < 7; i += 1) {
        const mote = document.createElement("i");
        mote.className = "tcgHomeMote";
        mote.style.left = `${9 + ((i * 14.3) % 82)}%`;
        mote.style.top = `${18 + ((i * 19.7) % 66)}%`;
        mote.style.animationDelay = `${-0.75 * i}s`;
        mote.style.animationDuration = `${5.2 + (i % 3) * .8}s`;
        mote.style.setProperty("--mx", `${-18 + (i % 4) * 12}px`);
        mote.style.setProperty("--my", `${-64 - (i % 3) * 28}px`);
        atmosphere.appendChild(mote);
      }
      home.prepend(atmosphere);
    }

    home.querySelectorAll(".deckHomeBtn").forEach((button) => {
      if (!button.querySelector(":scope > .tcgHomeBtnGlow")) {
        const glow = document.createElement("span");
        glow.className = "tcgHomeBtnGlow";
        glow.setAttribute("aria-hidden", "true");
        button.appendChild(glow);
      }
      if (button.dataset.tcgHomePolishBound === "1") return;
      button.dataset.tcgHomePolishBound = "1";
      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        button.style.setProperty("--tcg-px", `${Math.max(0, Math.min(100, ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100))}%`);
        button.style.setProperty("--tcg-py", `${Math.max(0, Math.min(100, ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100))}%`);
      }, { passive: true });
      button.addEventListener("pointerdown", () => {
        button.classList.add("tcgHomePressed");
        window.setTimeout(() => button.classList.remove("tcgHomePressed"), 170);
      }, { passive: true });
    });

    const play = home.querySelector(".deckStartDuel");
    if (play && !play.querySelector(":scope > .tcgPlaySweep")) {
      const sweep = document.createElement("span");
      sweep.className = "tcgPlaySweep";
      sweep.setAttribute("aria-hidden", "true");
      play.appendChild(sweep);
    }

    root.dataset.homeCompletion = VERSION;
    return true;
  }

  function watchHome() {
    if (!isHomePage()) return;
    if (decorateHome()) return;
    if (homeObserver) return;
    homeObserver = new MutationObserver(() => {
      if (decorateHome()) {
        homeObserver.disconnect();
        homeObserver = null;
      }
    });
    homeObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function run(label, task, options = {}) {
    const token = begin(label || "処理中…", { delay: options.delay ?? 220 });
    try {
      const result = await (typeof task === "function" ? task() : task);
      token.done();
      if (options.success) showSuccess(options.success);
      return result;
    } catch (error) {
      token.done();
      showError(options.error || "処理に失敗しました", options.retry);
      throw error;
    }
  }

  function install() {
    if (root.dataset.globalExperience === VERSION) return;
    root.dataset.globalExperience = VERSION;
    ensureFeedbackUi();
    installFetchTracking();
    installNetworkEvents();
    installInitialLoadFeedback();
    watchHome();
    if (navigator.onLine === false) {
      setState("offline", "オフラインです。接続を確認してください", { retry: () => location.reload() });
    }
  }

  window.TCG_FEEDBACK = {
    version: VERSION,
    begin,
    end,
    success: showSuccess,
    error: showError,
    hide: hideStatus,
    run,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  console.log("[global_experience] ready", VERSION);
})();
