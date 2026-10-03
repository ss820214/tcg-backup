(() => {
  "use strict";

  const VERSION = "20260805_visual_upgrade1";
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function pageKey() {
    const name = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (name === "" || name === "index.html" || name === "deck.html") return "deck";
    if (name === "game.html" || name === "battle.html") return "game";
    if (name === "gacha.html") return "gacha";
    if (name === "match_intro.html") return "match";
    return name.replace(/\.html$/, "");
  }

  function setPageClass() {
    const key = pageKey();
    document.body.classList.add("vu-upgrade", `vu-${key}`);
  }

  function labelForText(text) {
    if (/闇鍋/.test(text)) return "dark";
    if (/童話/.test(text)) return "fairy";
    if (/時織/.test(text)) return "time";
    if (/サポート/.test(text)) return "support";
    return "dark";
  }

  function upgradeGacha() {
    if (!document.body.classList.contains("vu-gacha")) return;
    const deck = qs("#themeDeck");
    if (deck) {
      qsa("button, [role='button'], .btn, .themeCard, .themeBtn", deck).forEach((el) => {
        if (el.dataset.vuReady) return;
        const text = (el.textContent || "").trim();
        if (!text) return;
        el.classList.add("vuGachaBanner");
        el.dataset.vuBanner = labelForText(text);
        el.dataset.vuReady = "1";
      });
    }

    qsa("#btnUnitBanner, #btnSupportBanner").forEach((btn) => {
      if (btn.dataset.vuReady) return;
      btn.classList.add("vuGachaBanner");
      btn.dataset.vuBanner = labelForText(btn.textContent || "");
      btn.dataset.vuReady = "1";
    });
  }

  function topLevelSectionFor(title, root) {
    let node = title;
    while (node && node.parentElement && node.parentElement !== root) {
      node = node.parentElement;
    }
    return node && node !== root ? node : title;
  }

  function upgradeBattleTabs() {
    if (!document.body.classList.contains("vu-game")) return;
    const right = qs("#rightPane");
    if (!right || qs(".vuBattleTabs", right)) return;

    const entries = [
      { key: "cardPreview", label: "カード", target: qs("#cardPreview", right) },
      { key: "hand", label: "手札", target: qs("#hand", right) },
      { key: "actionPicker", label: "行動", target: qs("#actionPicker", right) },
      { key: "log", label: "ログ", target: qs("#log", right) },
    ].filter((entry) => entry.target);

    if (entries.length < 2) return;

    const bar = document.createElement("div");
    bar.className = "vuBattleTabs";
    bar.setAttribute("aria-label", "バトル右パネル移動");

    const setActive = (key) => {
      qsa(".vuBattleTab", bar).forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.vuTarget === key);
      });
    };

    entries.forEach((entry, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vuBattleTab";
      btn.dataset.vuTarget = entry.key;
      btn.textContent = entry.label;
      btn.addEventListener("click", () => {
        setActive(entry.key);
        const title = qsa(".paneTitle", right).find((el) => {
          const text = el.textContent || "";
          return entry.key === "cardPreview" ? /カード|詳細/.test(text) : text.includes(entry.label);
        });
        const target = title ? topLevelSectionFor(title, right) : entry.target;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (index === 0) btn.classList.add("active");
      bar.appendChild(btn);
    });

    right.insertBefore(bar, right.firstChild);
  }

  function upgradeMatchIntro() {
    if (!document.body.classList.contains("vu-match")) return;
    const plate = qs("#fieldPlate");
    if (plate && !plate.dataset.vuReady) {
      plate.dataset.vuReady = "1";
      plate.setAttribute("aria-label", "選択フィールド");
    }

    qsa(".pCard").forEach((card) => {
      if (card.dataset.vuReady) return;
      card.dataset.vuReady = "1";
      const rail = document.createElement("i");
      rail.className = "vuMatchRail";
      card.prepend(rail);
    });
  }

  function upgradeDeck() {
    if (!document.body.classList.contains("vu-deck")) return;
    qsa("#deckList .cardRow").forEach((row) => {
      if (row.dataset.vuReady) return;
      row.dataset.vuReady = "1";
      const text = row.textContent || "";
      if (/support|サポ|効果/.test(text) && !row.dataset.kind) {
        row.dataset.kind = "support";
      }
    });
  }

  function run() {
    if (!document.body) return;
    setPageClass();
    upgradeDeck();
    upgradeBattleTabs();
    upgradeGacha();
    upgradeMatchIntro();
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("load", run);
  run();

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    run();
    if (tries >= 8) clearInterval(timer);
  }, 450);

  if ("MutationObserver" in window) {
    const observer = new MutationObserver(() => run());
    const startObserver = () => {
      const targets = [
        qs("#deckList"),
        qs("#themeDeck"),
        qs("#rightPane"),
      ].filter(Boolean);
      targets.forEach((target) => {
        observer.observe(target, { childList: true, subtree: true });
      });
      setTimeout(() => observer.disconnect(), 20000);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    } else {
      startObserver();
    }
  }

  window.__visualUpgrade20260805 = { version: VERSION, refresh: run };
})();
