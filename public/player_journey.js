// public/player_journey.js
// v20261006_home_beginner_gate1
// Keep the full journey system in the archived core, but only expose the game
// explanation from Home. Gacha/Profile/Creator/Arcade stay unobstructed.
(() => {
  "use strict";

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const blockedPages = new Set(["gacha.html", "profile.html", "creator.html", "arcade.html"]);
  if (blockedPages.has(page)) {
    try { localStorage.setItem("tcgJourneyOpen", "0"); } catch {}
    return;
  }

  const isHome = page === "index.html" || page === "";
  if (isHome) {
    try { localStorage.setItem("tcgJourneyOpen", "0"); } catch {}
  }

  const core = document.createElement("script");
  core.src = "./player_journey_core_20261006.js?v=20261006_home_beginner_gate1";
  core.defer = true;
  core.dataset.playerJourneyCore = "1";

  const wireHomeBeginner = () => {
    if (!isHome) return;

    const fab = document.getElementById("journeyFab");
    const panel = document.getElementById("journeyPanel");
    const beginnerWrap = document.querySelector(".beginnerMenu");
    const beginnerBtn = document.getElementById("btnBeginner");
    const oldPanel = document.getElementById("beginnerPanel");

    if (fab) fab.style.setProperty("display", "none", "important");
    if (oldPanel) oldPanel.hidden = true;

    if (beginnerWrap) {
      beginnerWrap.style.setProperty("display", "inline-flex", "important");
      beginnerWrap.style.setProperty("position", "relative", "important");
      beginnerWrap.style.setProperty("align-items", "center", "important");
    }

    if (!beginnerBtn) return;
    beginnerBtn.textContent = "🔰";
    beginnerBtn.title = "このゲームの説明";
    beginnerBtn.setAttribute("aria-label", "このゲームの説明");
    beginnerBtn.setAttribute("aria-expanded", "false");
    beginnerBtn.style.setProperty("display", "inline-flex", "important");
    beginnerBtn.style.setProperty("align-items", "center", "important");
    beginnerBtn.style.setProperty("justify-content", "center", "important");
    beginnerBtn.style.setProperty("width", "42px", "important");
    beginnerBtn.style.setProperty("min-width", "42px", "important");
    beginnerBtn.style.setProperty("height", "42px", "important");
    beginnerBtn.style.setProperty("padding", "0", "important");
    beginnerBtn.style.setProperty("border-radius", "999px", "important");
    beginnerBtn.style.setProperty("font-size", "20px", "important");
    beginnerBtn.style.setProperty("line-height", "1", "important");
    beginnerBtn.style.setProperty("writing-mode", "horizontal-tb", "important");

    const openGuide = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      if (!panel) return;
      if (oldPanel) oldPanel.hidden = true;
      panel.classList.add("open");
      beginnerBtn.setAttribute("aria-expanded", "true");
      try {
        localStorage.setItem("tcgJourneyOpen", "1");
        localStorage.setItem("tcgJourneySeen", "20260801_journey1");
      } catch {}
    };

    beginnerBtn.addEventListener("click", openGuide, true);

    panel?.querySelector(".journeyClose")?.addEventListener("click", () => {
      beginnerBtn.setAttribute("aria-expanded", "false");
      try { localStorage.setItem("tcgJourneyOpen", "0"); } catch {}
    });

    // The explanation must never auto-open on Home; the beginner mark is the gate.
    panel?.classList.remove("open");
    try { localStorage.setItem("tcgJourneyOpen", "0"); } catch {}
  };

  core.addEventListener("load", () => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wireHomeBeginner, { once:true });
    } else {
      requestAnimationFrame(wireHomeBeginner);
    }
  }, { once:true });
  core.addEventListener("error", () => console.error("[player_journey] core load failed"), { once:true });

  (document.body || document.documentElement).appendChild(core);
})();
