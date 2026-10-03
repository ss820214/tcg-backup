(() => {
  "use strict";

  const VERSION = "20261003_guard1";
  const STYLE_ID = "deckRuntimeGuardStyle20261003";
  const SAFE_BACK_ID = "btnSafeBack";
  let playFallbackTimer = 0;
  let drawerHistoryArmed = false;

  const $ = (id) => document.getElementById(id);

  function isDeckPage() {
    const path = (location.pathname.split("/").pop() || "deck.html").toLowerCase();
    return (path === "deck.html" || path === "deck") && !!document.body;
  }

  function injectStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
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
      }
    `;
    document.head.appendChild(style);
  }

  function isVisible(el) {
    if (!el || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > 0;
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
        }, 80);
        return;
      }

      if (performance.now() - start < 2600) {
        playFallbackTimer = setTimeout(attempt, 90);
      } else if (drawer) {
        setRoomDrawerOpen(true, { pushHistory: true });
      }
    };

    playFallbackTimer = setTimeout(attempt, 60);
  }

  function showHomeSafely() {
    if (roomDrawerIsOpen()) setRoomDrawerOpen(false);
    const home = $("btnHome");
    if (home) {
      try { home.click(); return true; } catch {}
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
      if (action) openRoomDrawerReliably();

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
    });

    window.addEventListener("pageshow", () => {
      ensureSafeBackButton();
      // bfcache can restore half-open classes; normalize transient UI.
      const drawer = $("roomDrawer");
      if (drawer && drawer.getAttribute("aria-hidden") === "true") {
        drawer.classList.remove("open");
        $("roomDrawerOverlay")?.classList.remove("open");
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) ensureSafeBackButton();
    });
  }

  function install() {
    if (!isDeckPage()) return;
    injectStyle();
    ensureSafeBackButton();
    bindFallbackInteractions();
    console.log("[deck_runtime_guard] ready", VERSION);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
