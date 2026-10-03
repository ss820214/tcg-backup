(() => {
  "use strict";

  const VERSION = "20261003_guard3";
  const STYLE_ID = "deckRuntimeGuardV320261003";
  const BACK_ID = "tcgEmergencyBack";
  let syncTimer = 0;
  let observer = null;

  const $ = (id) => document.getElementById(id);

  function isDeckPage() {
    const p = (location.pathname.split("/").pop() || "").toLowerCase();
    const pathLooksLikeDeck = p === "deck.html" || p === "deck";
    const deckDomReady = !!($("cardList") && $("deckPanel"));
    return pathLooksLikeDeck || deckDomReady;
  }

  function injectStyle() {
    if ($(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${BACK_ID}{
        position:fixed!important;
        top:max(8px,env(safe-area-inset-top,0px))!important;
        left:8px!important;
        z-index:2147483000!important;
        display:none!important;
        align-items:center!important;
        justify-content:center!important;
        min-width:0!important;
        min-height:34px!important;
        height:34px!important;
        padding:0 11px!important;
        border:1px solid rgba(255,255,255,.28)!important;
        border-radius:999px!important;
        background:rgba(6,10,14,.88)!important;
        color:#fff!important;
        box-shadow:0 8px 28px rgba(0,0,0,.42)!important;
        backdrop-filter:blur(10px)!important;
        font:800 12px/1 system-ui,-apple-system,"Segoe UI","Noto Sans JP",sans-serif!important;
      }
      body.tcgSafeBackVisible #${BACK_ID}{display:inline-flex!important}

      #roomDrawer.open{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        transform:translateX(0)!important;
        pointer-events:auto!important;
      }
      #roomDrawerOverlay.open{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        pointer-events:auto!important;
      }
      body.tcgRoomDrawerForced #roomDrawer{
        z-index:2147482000!important;
      }
      body.tcgRoomDrawerForced #roomDrawerOverlay{
        z-index:2147481000!important;
      }

      @media(max-width:900px),(pointer:coarse) and (max-width:1180px){
        #${BACK_ID}{
          top:max(6px,env(safe-area-inset-top,0px))!important;
          left:6px!important;
          min-height:31px!important;
          height:31px!important;
          padding:0 9px!important;
          font-size:11px!important;
        }
        #roomDrawer{
          width:100vw!important;
          max-width:100vw!important;
          height:100dvh!important;
          max-height:100dvh!important;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function drawerOpen() {
    const d = $("roomDrawer");
    return !!d && d.classList.contains("open") && d.getAttribute("aria-hidden") !== "true";
  }

  function forceDrawer(open) {
    const d = $("roomDrawer");
    const ov = $("roomDrawerOverlay");
    const toggle = $("roomDrawerToggle");
    if (!d) return false;

    d.classList.toggle("open", !!open);
    d.hidden = false;
    d.setAttribute("aria-hidden", open ? "false" : "true");
    if (ov) {
      ov.classList.toggle("open", !!open);
      ov.hidden = false;
      ov.setAttribute("aria-hidden", open ? "false" : "true");
    }
    document.body.classList.toggle("tcgRoomDrawerForced", !!open);
    document.body.classList.toggle("roomDrawerOpen", !!open);

    if (toggle) {
      toggle.hidden = false;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "閉じる ◀" : "開始 ▶";
    }

    syncBackVisibility();
    return true;
  }

  function introOpen() {
    const intro = $("deckStart");
    return !!intro && document.body.contains(intro) && !intro.hidden && !intro.classList.contains("hide") && intro.getAttribute("aria-hidden") !== "true";
  }

  function closeIntroImmediately() {
    const intro = $("deckStart");
    if (!intro) return;
    intro.classList.add("hide");
    intro.setAttribute("aria-hidden", "true");
    intro.style.pointerEvents = "none";
    setTimeout(() => {
      if (intro.parentNode && intro.classList.contains("hide")) {
        try { intro.remove(); } catch {}
      }
    }, 220);
  }

  function openPlayReliably() {
    // The original implementation closes the intro and then relies on a delayed
    // synthetic click. We keep that handler, but independently force the final
    // drawer state so a timing race can never become a silent no-op.
    [60, 160, 320, 700].forEach((ms, index) => {
      setTimeout(() => {
        if (index >= 1 && introOpen()) closeIntroImmediately();
        if (!drawerOpen()) forceDrawer(true);
      }, ms);
    });
  }

  function showHome() {
    forceDrawer(false);
    const detail = $("detailWrap");
    if (detail) {
      detail.classList.remove("open");
      detail.style.display = "none";
      detail.setAttribute("aria-hidden", "true");
    }

    const homeBtn = $("btnHome");
    if (homeBtn) {
      try {
        homeBtn.click();
        setTimeout(syncBackVisibility, 60);
        return;
      } catch {}
    }
    location.assign("./deck.html");
  }

  function safeBack() {
    if (drawerOpen()) {
      forceDrawer(false);
      return;
    }

    const detail = $("detailWrap");
    if (detail && (detail.classList.contains("open") || detail.getAttribute("aria-hidden") === "false" || detail.style.display === "block")) {
      $("detailClose")?.click();
      detail.classList.remove("open");
      detail.style.display = "none";
      detail.setAttribute("aria-hidden", "true");
      syncBackVisibility();
      return;
    }

    if (!introOpen()) {
      showHome();
      return;
    }

    location.assign("./index.html");
  }

  function ensureBack() {
    let b = $(BACK_ID);
    if (!b) {
      b = document.createElement("button");
      b.id = BACK_ID;
      b.type = "button";
      b.textContent = "← 戻る";
      b.setAttribute("aria-label", "安全に戻る");
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        safeBack();
      });
      document.body.appendChild(b);
    }
    syncBackVisibility();
  }

  function syncBackVisibility() {
    if (!document.body) return;
    const detail = $("detailWrap");
    const detailOpen = !!detail && (detail.classList.contains("open") || detail.getAttribute("aria-hidden") === "false" || detail.style.display === "block");
    const transitional = !!document.querySelector(".tcgRouteOverlay,.deckStartZoomCard");
    const shouldShow = drawerOpen() || detailOpen || transitional || !introOpen();
    document.body.classList.toggle("tcgSafeBackVisible", shouldShow);
  }

  function stabilize() {
    if (!document.body) return;
    injectStyle();
    ensureBack();

    // Recover from contradictory class/ARIA states produced by overlapping legacy layers.
    const d = $("roomDrawer");
    if (d) {
      const saysOpen = d.classList.contains("open") || d.getAttribute("aria-hidden") === "false";
      if (saysOpen) forceDrawer(true);
    }

    // Make the essential controls interactable even after bfcache/visibility restore.
    const play = document.querySelector("#deckStart [data-home-action='play']");
    if (play instanceof HTMLElement) {
      play.hidden = false;
      play.removeAttribute("aria-hidden");
      play.style.pointerEvents = "auto";
    }
    syncBackVisibility();
  }

  function schedule(ms = 0) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(stabilize, ms);
  }

  function bind() {
    if (document.documentElement.dataset.deckRuntimeGuardV3 === "1") return;
    document.documentElement.dataset.deckRuntimeGuardV3 = "1";

    // Capture phase intentionally runs even if the older handler later fails.
    document.addEventListener("click", (e) => {
      const play = e.target?.closest?.("#deckStart [data-home-action='play']");
      if (play) openPlayReliably();

      if (e.target?.closest?.("#roomDrawerClose,#roomDrawerOverlay")) {
        setTimeout(() => forceDrawer(false), 0);
      }
    }, true);

    window.addEventListener("pageshow", () => {
      [0, 80, 240, 700].forEach((ms) => setTimeout(stabilize, ms));
    });
    window.addEventListener("load", () => {
      [0, 100, 350].forEach((ms) => setTimeout(stabilize, ms));
    }, { once:true });
    window.addEventListener("orientationchange", () => schedule(100), { passive:true });
    window.addEventListener("resize", () => schedule(80), { passive:true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) [0, 100, 300].forEach((ms) => setTimeout(stabilize, ms));
    });

    observer = new MutationObserver(() => schedule(28));
    observer.observe(document.body, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:["class","hidden","aria-hidden","style"],
    });
  }

  function install() {
    if (!isDeckPage() || !document.body) return;
    injectStyle();
    bind();
    [0, 40, 120, 300, 700, 1400].forEach((ms) => setTimeout(stabilize, ms));
    console.log("[deck_runtime_guard_v3] ready", VERSION);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once:true });
  else install();
})();
