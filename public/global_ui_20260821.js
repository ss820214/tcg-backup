(() => {
  "use strict";

  const VERSION = "20260926_device_switch4";
  const STORAGE_KEY = "tcgDeviceModeOverrideV2";
  const MODES = ["auto", "pc", "mobile"];
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const page = path.replace(/\.html$/i, "") || "index";

  const labels = {
    index: "Home",
    deck: "Deck Builder",
    game: "Battle",
    gacha: "Gacha",
    profile: "Profile",
    creator: "Creator",
    match_intro: "Match",
    rule: "Rules",
    arcade: "Arcade",
    login: "Login",
    tier: "Tier",
    tutorial: "Tutorial",
    tutorial_game: "Tutorial Battle",
    victory: "Victory",
  };

  document.documentElement.dataset.globalUi = VERSION;

  function safeText(el) {
    return String(el?.textContent || "").trim();
  }

  function getMode() {
    const urlMode = getUrlMode();
    if (urlMode) return urlMode;
    try {
      const mode = localStorage.getItem(STORAGE_KEY);
      return MODES.includes(mode) ? mode : "auto";
    } catch {
      return "auto";
    }
  }

  function getUrlMode() {
    try {
      const params = new URLSearchParams(location.search);
      const raw = String(params.get("view") || params.get("device") || params.get("mode") || "").toLowerCase();
      if (raw === "pc" || raw === "desktop") return "pc";
      if (raw === "mobile" || raw === "sp" || raw === "phone") return "mobile";
    } catch {
      // Keep auto mode in older embedded browsers.
    }
    return "";
  }

  function setMode(mode) {
    const next = MODES.includes(mode) ? mode : "auto";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can be blocked in some browser modes. Auto is still safe.
    }
    return next;
  }

  function detectMobileAuto() {
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 9999;
    const screenWidth = window.screen?.width || 9999;
    const ua = navigator.userAgent || "";
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const coarsePointer = (() => {
      try {
        return !!window.matchMedia?.("(pointer: coarse)")?.matches;
      } catch {
        return false;
      }
    })();

    // Narrow desktop windows and DevTools should stay PC. Mobile requires mobile UA,
    // or a coarse pointer on a truly phone-sized screen.
    return (mobileUa && viewportWidth <= 1180) || (coarsePointer && screenWidth <= 900);
  }

  function isMobileView() {
    const mode = getMode();
    if (mode === "pc") return false;
    if (mode === "mobile") return true;
    return detectMobileAuto();
  }

  function applyDeviceMode() {
    const mode = getMode();
    const mobile = isMobileView();
    const root = document.documentElement;
    root.dataset.viewMode = mobile ? "mobile" : "pc";
    root.dataset.deviceModeOverride = mode;

    if (document.body) {
      document.body.classList.toggle("forcePcUi", mode === "pc");
      document.body.classList.toggle("forceMobileUi", mode === "mobile");
      document.body.classList.toggle("deviceModeManual", mode !== "auto");
      document.body.classList.toggle("deviceIsMobile", mobile);
      document.body.classList.toggle("deviceIsPc", !mobile);
      if (mode === "pc") {
        document.body.classList.remove("mobileDeckScreenForce", "mobileDeckScreen", "mobileFitUi", "mobileHomeFit");
      }
    }

    return { mode, mobile };
  }

  function nextMode(mode) {
    if (mode === "auto") return "pc";
    if (mode === "pc") return "mobile";
    return "auto";
  }

  function modeLabel({ mode, mobile }) {
    if (mode === "auto") return mobile ? "スマホ版 / 自動" : "PC版 / 自動";
    return mode === "mobile" ? "スマホ版 / 固定" : "PC版 / 固定";
  }

  function ensureDeviceModeBadge() {
    if (!document.body) return applyDeviceMode();
    const state = applyDeviceMode();
    let badge = document.getElementById("deviceModeBadge");
    if (!badge) {
      badge = document.createElement("button");
      badge.id = "deviceModeBadge";
      badge.className = "deviceModeBadge";
      badge.type = "button";
      badge.setAttribute("aria-live", "polite");
      const host = document.querySelector("header .topRight, .topRight, .page-nav, .topbar, header");
      if (host) {
        host.appendChild(badge);
      } else {
        badge.classList.add("deviceModeBadgeFixed");
        document.body.appendChild(badge);
      }
    }

    if (badge.tagName !== "BUTTON") {
      badge.setAttribute("role", "button");
      badge.setAttribute("tabindex", "0");
    }

    badge.classList.add("deviceModeBadge");
    badge.dataset.mode = state.mobile ? "mobile" : "pc";
    badge.dataset.override = state.mode;
    badge.textContent = modeLabel(state);
    badge.title = "クリックで 自動 → PC固定 → スマホ固定 を切り替え";

    if (!badge.dataset.deviceModeBound) {
      badge.dataset.deviceModeBound = "1";
      const cycle = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setMode(nextMode(getMode()));
        refreshDeviceMode(true);
      };
      badge.addEventListener("click", cycle);
      badge.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") cycle(event);
      });
    }

    return state;
  }

  function refreshDeviceMode(emit = false) {
    const state = ensureDeviceModeBadge();
    if (emit) {
      window.dispatchEvent(new CustomEvent("tcg:device-mode-change", { detail: state }));
      window.dispatchEvent(new Event("resize"));
    }
    return state;
  }

  function markButtonIntent() {
    document.querySelectorAll("button, .btn, .btnGhost, a.button, a.navButton").forEach((el) => {
      if (el.dataset.intentLocked === "1") return;
      const text = safeText(el);
      if (!text) return;
      if (/開始|PLAY|プレイ|対戦|ソロ|参加|作成|Start|Battle/i.test(text)) el.dataset.intent = "primary";
      if (/削除|全消し|解除|リセット|戻る|Delete|Clear|Reset/i.test(text)) el.dataset.intent = "danger";
      if (/保存|更新|同期|ロード|読込|読み込|Save|Load|Sync/i.test(text)) el.dataset.intent = "utility";
      el.dataset.uiMarked = "1";
    });
  }

  function addPageStamp() {
    if (document.querySelector(".uiPageStamp")) return;
    const stamp = document.createElement("div");
    stamp.className = "uiPageStamp";
    stamp.textContent = labels[page] || page.toUpperCase();
    stamp.setAttribute("aria-hidden", "true");
    document.body.appendChild(stamp);
  }

  function markScrollable() {
    document.querySelectorAll(".list, [id$='List'], #log, #detail, #cardList, #deckList").forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 8 || el.classList.contains("list")) {
        el.classList.add("uiScrollable");
      }
    });
  }

  function install() {
    document.body?.classList.add("ui-polish", `ui-page-${page}`);
    markButtonIntent();
    markScrollable();
    addPageStamp();
    refreshDeviceMode(false);
  }

  window.TCG_DEVICE_MODE = {
    get: getMode,
    set(mode) {
      setMode(mode);
      return refreshDeviceMode(true);
    },
    isMobile: isMobileView,
    detectAuto: detectMobileAuto,
    refresh: () => refreshDeviceMode(true),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  let raf = 0;
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(install);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("resize", () => refreshDeviceMode(false), { passive: true });
  window.addEventListener("orientationchange", () => refreshDeviceMode(false), { passive: true });
})();

// Deck builder only: load the mobile refinement stack as soon as the DOM is ready.
// This avoids waiting for every image/resource and removes the intermittent half-rendered state.
(() => {
  const path = (location.pathname.split("/").pop() || "").toLowerCase();
  if (path !== "deck.html" && path !== "deck") return;

  const REFINE = "20261003_refine2";
  const DENSITY = "20261003_density2";
  const GUARD = "20261003_guard1";

  const loadGuard = () => {
    if (document.querySelector(`script[data-deck-runtime-guard="${GUARD}"]`)) return;
    const guard = document.createElement("script");
    guard.src = `./deck_runtime_guard_20261003.js?v=${GUARD}`;
    guard.async = false;
    guard.dataset.deckRuntimeGuard = GUARD;
    document.body.appendChild(guard);
  };

  const loadDensity = () => {
    const existing = document.querySelector(`script[data-deck-mobile-density="${DENSITY}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") loadGuard();
      else existing.addEventListener("load", loadGuard, { once: true });
      return;
    }
    const density = document.createElement("script");
    density.src = `./deck_mobile_density_20261003.js?v=${DENSITY}`;
    density.async = false;
    density.dataset.deckMobileDensity = DENSITY;
    density.addEventListener("load", () => {
      density.dataset.loaded = "1";
      loadGuard();
    }, { once: true });
    document.body.appendChild(density);
  };

  const loadRefine = () => {
    const existing = document.querySelector(`script[data-deck-mobile-refine="${REFINE}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") loadDensity();
      else existing.addEventListener("load", loadDensity, { once: true });
      return;
    }
    const refine = document.createElement("script");
    refine.src = `./deck_mobile_refine_20261003.js?v=${REFINE}`;
    refine.async = false;
    refine.dataset.deckMobileRefine = REFINE;
    refine.addEventListener("load", () => {
      refine.dataset.loaded = "1";
      loadDensity();
    }, { once: true });
    document.body.appendChild(refine);
  };

  const start = () => {
    if (!document.body) {
      requestAnimationFrame(start);
      return;
    }
    loadRefine();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();