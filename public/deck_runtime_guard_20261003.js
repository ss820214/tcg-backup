(() => {
  "use strict";

  const VERSION = "20261003_guard2";
  const STYLE_ID = "deckRuntimeGuardStyle20261003";
  const SAFE_BACK_ID = "btnSafeBack";
  let playFallbackTimer = 0;
  let drawerHistoryArmed = false;
  let syncRaf = 0;
  let homeObserver = null;

  const $ = (id) => document.getElementById(id);

  function isDeckPage() {
    const path = (location.pathname.split("/").pop() || "deck.html").toLowerCase();
    return (path === "deck.html" || path === "deck") && !!document.body;
  }

  function isMobileLike() {
    try {
      if (window.TCG_DEVICE_MODE?.isMobile) return !!window.TCG_DEVICE_MODE.isMobile();
    } catch {}
    const width = window.innerWidth || document.documentElement?.clientWidth || 9999;
    const screenWidth = window.screen?.width || 9999;
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
    const coarse = !!window.matchMedia?.("(pointer: coarse)")?.matches;
    return width <= 900 || ((uaMobile || coarse) && screenWidth <= 900 && width <= 1180);
  }

  function injectStyle() {
    let style = $(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      #${SAFE_BACK_ID}{
        min-width:0!important;
        min-height:30px!important;
        height:30px!important;
        padding:0 9px!important;
        border-radius:999px!important;
        font-size:11px!important;
        line-height:1!important;
        white-space:nowrap!important;
      }
      @media (max-width:900px), (pointer:coarse) and (max-width:1180px){
        header .left{
          display:flex!important;
          align-items:center!important;
          gap:5px!important;
        }
        #${SAFE_BACK_ID}{
          flex:0 0 auto!important;
          height:28px!important;
          min-height:28px!important;
          padding:0 8px!important;
          font-size:10px!important;
        }

        /* Home is created dynamically by deck.js. Keep the home state authoritative even
           when older mobile layout layers observed the DOM before #deckStart existed. */
        body.mobileHomeFit #deckStart:not(.hide){
          visibility:visible!important;
          opacity:1!important;
          pointer-events:auto!important;
        }
        body.mobileHomeFit #deckStart:not(.hide) .deckStartDuel{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          visibility:visible!important;
          opacity:1!important;
          pointer-events:auto!important;
          width:auto!important;
          min-width:0!important;
          min-height:44px!important;
          height:44px!important;
          margin:0!important;
          position:relative!important;
          z-index:8!important;
        }
      }
    `;
  }

  function isVisible(el) {
    if (!el || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0;
  }

  function homeShouldBeOpen() {
    const home = $("deckStart");
    if (!home || home.hidden || home.classList.contains("hide") || home.getAttribute("aria-hidden") === "true") return false;
    if (!document.body.contains(home)) return false;
    const style = getComputedStyle(home);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function syncHomeState() {
    if (!document.body) return;
    const shouldFitHome = isMobileLike() && homeShouldBeOpen();
    document.body.classList.toggle("mobileHomeFit", shouldFitHome);
    document.documentElement.dataset.deckHomeVisible = shouldFitHome ? "1" : "0";

    const play = document.querySelector("#deckStart [data-home-action='play']");
    if (play instanceof HTMLElement && shouldFitHome) {
      play.hidden = false;
      play.removeAttribute("aria-hidden");
    }
  }

  function scheduleHomeSync(delay = 0) {
    clearTimeout(scheduleHomeSync._timer);
    scheduleHomeSync._timer = setTimeout(() => {
      cancelAnimationFrame(syncRaf);
      syncRaf = requestAnimationFrame(syncHomeState);
    }, delay);
  }

  function startHomeObserver() {
    if (homeObserver || !document.body) return;
    homeObserver = new MutationObserver((mutations) => {
      let relevant = false;
      for (const m of mutations) {
        if (m.type === "childList") {
          const nodes = [...m.addedNodes, ...m.removedNodes];
          if (nodes.some((node) => node instanceof Element && (node.id === "deckStart" || node.querySelector?.("#deckStart")))) {
            relevant = true;
            break;
          }
        } else if (m.type === "attributes") {
          const t = m.target;
          if (t instanceof Element && (t.id === "deckStart" || t === document.body)) {
            relevant = true;
            break;
          }
        }
      }
      if (relevant) scheduleHomeSync(0);
    });
    homeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden"],
    });
  }

  function roomDrawerIsOpen() {
    const drawer = $("roomDrawer");
    return !!drawer && (drawer.classList.contains("open") || drawer.getAttribute("aria-hidden") === "false");
  }

  function setRoomDrawerOpen(open, { pushHistory = false } = {}) {
    const drawer = $("roomDrawer");
    const overlay = $("roomDrawerOverlay");
    const toggle = $("roomDrawerToggle");
    if (!drawer) return false;

    drawer.classList.toggle("open", !!open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    overlay?.classList.toggle("open", !!open);
    overlay?.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("roomDrawerOpen", !!open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "閉じる ◀" : "開始 ▶";
    }

    if (open && pushHistory && !drawerHistoryArmed) {
      try {
        history.pushState({ ...(history.state || {}), tcgOverlay: "room" }, "", location.href);
        drawerHistoryArmed = true;
      } catch {}
    }
    if (!open) drawerHistoryArmed = false;
    scheduleHomeSync(0);
    return true;
  }

  function openRoomDrawerReliably() {
    clearTimeout(playFallbackTimer);
    const start = performance.now();

    const attempt = () => {
      const intro = $("deckStart");
      const introGone = !intro || intro.classList.contains("hide") || intro.getAttribute("aria-hidden") === "true" || !document.body.contains(intro);
      const drawer = $("roomDrawer");
      if (drawer && introGone) {
        if (!roomDrawerIsOpen()) {
          const toggle = $("roomDrawerToggle");
          if (toggle) {
            try { toggle.click(); } catch {}
          }
        }
        setTimeout(() => {
          if (!roomDrawerIsOpen()) setRoomDrawerOpen(true, { pushHistory: true });
          else if (!drawerHistoryArmed) {
            try {
              history.pushState({ ...(history.state || {}), tcgOverlay: "room" }, "", location.href);
              drawerHistoryArmed = true;
            } catch {}
          }
          scheduleHomeSync(0);
        }, 80);
        return;
      }

      if (performance.now() - start < 3000) {
        playFallbackTimer = setTimeout(attempt, 80);
      } else if (drawer) {
        // Final fallback: never leave PLAY as a silent no-op.
        if (intro) {
          intro.classList.add("hide");
          intro.setAttribute("aria-hidden", "true");
        }
        setRoomDrawerOpen(true, { pushHistory: true });
      }
    };

    playFallbackTimer = setTimeout(attempt, 40);
  }

  function showHomeSafely() {
    if (roomDrawerIsOpen()) setRoomDrawerOpen(false);
    const home = $("btnHome");
    if (home) {
      try {
        home.click();
        scheduleHomeSync(20);
        return true;
      } catch {}
    }
    location.href = "./deck.html";
    return true;
  }

  function safeBack() {
    const detail = $("detailWrap");
    if (detail && isVisible(detail)) {
      $("detailClose")?.click();
      detail.style.display = "none";
      detail.setAttribute("aria-hidden", "true");
      return;
    }

    if (roomDrawerIsOpen()) {
      setRoomDrawerOpen(false);
      return;
    }

    const lexicon = document.querySelector("[data-lexicon]:not([hidden])");
    if (lexicon) {
      lexicon.hidden = true;
      return;
    }

    const intro = $("deckStart");
    if (!intro || intro.classList.contains("hide") || intro.getAttribute("aria-hidden") === "true") {
      showHomeSafely();
      return;
    }

    // Already on the app home screen: go to the real site root instead of leaving the site.
    location.href = "./index.html";
  }

  function ensureSafeBackButton() {
    if ($(SAFE_BACK_ID)) return;
    const headerLeft = document.querySelector("header .left") || document.querySelector("header");
    if (!headerLeft) return;
    const btn = document.createElement("button");
    btn.id = SAFE_BACK_ID;
    btn.type = "button";
    btn.className = "btnGhost tcgSafeBack";
    btn.textContent = "← 戻る";
    btn.setAttribute("aria-label", "安全に戻る");
    btn.dataset.intent = "utility";
    btn.dataset.intentLocked = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      safeBack();
    });
    headerLeft.insertBefore(btn, headerLeft.firstElementChild || null);
  }

  function bindFallbackInteractions() {
    if (document.documentElement.dataset.deckRuntimeGuardBound === VERSION) return;
    document.documentElement.dataset.deckRuntimeGuardBound = VERSION;

    document.addEventListener("click", (e) => {
      const action = e.target?.closest?.("[data-home-action='play']");
      if (action) {
        openRoomDrawerReliably();
        scheduleHomeSync(0);
      }

      const toggle = e.target?.closest?.("#roomDrawerToggle");
      if (toggle) {
        const before = roomDrawerIsOpen();
        setTimeout(() => {
          if (roomDrawerIsOpen() === before) setRoomDrawerOpen(!before, { pushHistory: !before });
        }, 80);
      }

      if (e.target?.closest?.("#roomDrawerClose,#roomDrawerOverlay")) {
        setTimeout(() => {
          if (roomDrawerIsOpen()) setRoomDrawerOpen(false);
        }, 40);
      }
    }, true);

    window.addEventListener("popstate", (e) => {
      if (roomDrawerIsOpen()) {
        setRoomDrawerOpen(false);
        return;
      }
      if (e.state?.tcgOverlay === "room") drawerHistoryArmed = false;
      scheduleHomeSync(0);
    });

    window.addEventListener("pageshow", () => {
      ensureSafeBackButton();
      const drawer = $("roomDrawer");
      if (drawer && drawer.getAttribute("aria-hidden") === "true") {
        drawer.classList.remove("open");
        $("roomDrawerOverlay")?.classList.remove("open");
      }
      scheduleHomeSync(0);
    });

    window.addEventListener("resize", () => scheduleHomeSync(40), { passive: true });
    window.addEventListener("orientationchange", () => scheduleHomeSync(80), { passive: true });
    window.addEventListener("tcg:device-mode-change", () => scheduleHomeSync(0));

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        ensureSafeBackButton();
        scheduleHomeSync(0);
      }
    });
  }

  function install() {
    if (!isDeckPage()) return;
    injectStyle();
    ensureSafeBackButton();
    bindFallbackInteractions();
    startHomeObserver();
    syncHomeState();
    // deck.js can create #deckStart after this guard has already installed.
    [0, 40, 120, 300, 700, 1400].forEach((ms) => setTimeout(syncHomeState, ms));
    console.log("[deck_runtime_guard] ready", VERSION);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
