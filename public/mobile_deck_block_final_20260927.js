(function () {
  "use strict";
  // Superseded by the stable mobile deck layout below.
  return;

  var BODY_CLASS = "tcgDeckBlockFinal";
  var MOBILE_CLASS = "tcgMobileDeckActive";
  var VERSION = "20260928_deckblock_mobile_fix1";
  var scheduled = false;

  var JP = {
    cardList: "\u30ab\u30fc\u30c9\u4e00\u89a7",
    cardName: "\u30ab\u30fc\u30c9\u540d",
    seriesSearch: "\u30b7\u30ea\u30fc\u30ba\u3067\u691c\u7d22",
    allAttr: "\u5168\u5c5e\u6027",
    chara: "\u30ad\u30e3\u30e9",
    support: "\u30b5\u30dd\u30fc\u30c8",
    clickDetail: "\u30af\u30ea\u30c3\u30af\u3067\u8a73\u7d30",
    candidate: "\u5019\u88dc",
    deck: "\u30c7\u30c3\u30ad",
    includedCards: "\u5165\u308c\u305f\u30ab\u30fc\u30c9",
    adoptedCards: "\u63a1\u7528\u30ab\u30fc\u30c9",
    save: "\u4fdd\u5b58",
    myDeck: "\u81ea\u5206\u306e\u30c7\u30c3\u30ad",
    publicDeck: "\u307f\u3093\u306a\u306e\u30c7\u30c3\u30ad",
    clearAll: "\u5168\u6d88\u3057",
    count: "\u679a\u6570",
    cardSelect: "\u30ab\u30fc\u30c9\u9078\u629e",
    emptyDeck: "\u307e\u3060\u30ab\u30fc\u30c9\u304c\u5165\u3063\u3066\u3044\u307e\u305b\u3093",
    detail: "\u8a73\u7d30"
  };

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function textOf(el) {
    if (!el) return "";
    var value = el.value || el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.textContent || "";
    return String(value).replace(/\s+/g, " ").trim();
  }

  function compact(el) {
    return textOf(el).replace(/\s+/g, "");
  }

  function rectOf(el) {
    try {
      return el.getBoundingClientRect();
    } catch (e) {
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0 };
    }
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return false;
    var style = getComputedStyle(el);
    var rect = rectOf(el);
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 70 && rect.height > 24;
  }

  function addClass(el, cls) {
    if (el && el.classList && !el.classList.contains(cls)) el.classList.add(cls);
  }

  function removeClass(el, cls) {
    if (el && el.classList) el.classList.remove(cls);
  }

  function clearClass(root, cls) {
    qsa("." + cls, root || document).forEach(function (el) {
      removeClass(el, cls);
    });
  }

  function isMobileMode() {
    var params = new URLSearchParams(location.search);
    return params.has("mobile") ||
      params.get("view") === "mobile" ||
      params.get("mode") === "mobile" ||
      document.documentElement.classList.contains(MOBILE_CLASS) ||
      document.body.classList.contains("tcgMobile") ||
      innerWidth <= 920 ||
      (window.matchMedia && matchMedia("(pointer: coarse)").matches);
  }

  function scoreWords(text, words, weight) {
    var score = 0;
    words.forEach(function (word) {
      if (text.indexOf(word) !== -1) score += weight;
    });
    return score;
  }

  function panelScore(el, type) {
    if (!isVisible(el)) return -9999;
    var text = compact(el);
    if (!text || text.length > 180000) return -9999;
    var rect = rectOf(el);
    var score = Math.min(rect.width, 1100) / 120 + Math.min(rect.height, 1200) / 120;

    if (type === "card") {
      score += scoreWords(text, [JP.cardList, JP.cardName, JP.seriesSearch, JP.allAttr, JP.chara, JP.support, JP.clickDetail, JP.candidate], 35);
      score -= scoreWords(text, [JP.includedCards, JP.adoptedCards, JP.myDeck, JP.clearAll, "READY", "30/30"], 55);
    } else {
      score += scoreWords(text, [JP.deck, JP.includedCards, JP.adoptedCards, JP.save, JP.myDeck, JP.clearAll, "READY", "30/30", JP.count], 34);
      score += scoreWords(text, [JP.cardSelect, JP.emptyDeck], 28);
      score -= scoreWords(text, [JP.cardList, JP.cardName, JP.seriesSearch, JP.allAttr, JP.candidate], 48);
    }

    if (el.id && /deck|card|list|library/i.test(el.id)) score += 10;
    if (el.className && /deck|card|list|library/i.test(String(el.className))) score += 10;
    return score;
  }

  function bestPanel(type) {
    var nodes = qsa("main, section, aside, article, .panel, .card, .deck, .deck-panel, .deckList, .deck-list, .library, .card-list, div");
    var best = null;
    var bestScore = -9999;
    nodes.forEach(function (el) {
      var r = rectOf(el);
      if (r.width < 180 || r.height < 90) return;
      var score = panelScore(el, type);
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return bestScore > 30 ? best : null;
  }

  function nearestPanelChild(panel, root) {
    if (!panel || !root || panel === root) return panel;
    var node = panel;
    while (node && node.parentElement && node.parentElement !== root) node = node.parentElement;
    return node || panel;
  }

  function commonAncestor(a, b) {
    if (!a || !b) return null;
    var seen = [];
    var n = a;
    while (n) {
      seen.push(n);
      n = n.parentElement;
    }
    n = b;
    while (n) {
      if (seen.indexOf(n) !== -1) return n;
      n = n.parentElement;
    }
    return null;
  }

  function markScrollArea(panel, cls) {
    if (!panel) return;
    var candidates = qsa("div, section, ul, ol", panel).filter(function (el) {
      if (!isVisible(el)) return false;
      var text = compact(el);
      var rect = rectOf(el);
      return rect.height > 120 && (
        /\d+\s*\/\s*\d+/.test(text) ||
        text.indexOf(JP.detail) !== -1 ||
        text.indexOf(JP.cardName) !== -1 ||
        text.indexOf(JP.emptyDeck) !== -1
      );
    });
    candidates.sort(function (a, b) {
      var ar = rectOf(a);
      var br = rectOf(b);
      return br.height - ar.height;
    });
    addClass(candidates[0] || panel, cls);
  }

  function nearestUsefulScrollParent(panel, rows) {
    if (!panel || !rows || !rows.length) return panel;
    var targetCount = Math.min(rows.length, 3);
    var node = rows[0].parentElement;
    while (node && node !== panel && node !== document.body) {
      var r = rectOf(node);
      var count = qsa(".tcgDbDeckRow", node).length;
      if (count >= targetCount && r.width > 180 && r.height > 80) return node;
      node = node.parentElement;
    }
    return rows[0].parentElement || panel;
  }

  function markDeckContent(deckPanel) {
    if (!deckPanel) return;
    clearClass(deckPanel, "tcgDbDeckContent");
    var rows = qsa(".tcgDbDeckRow", deckPanel).filter(isVisible);
    if (rows.length) {
      addClass(nearestUsefulScrollParent(deckPanel, rows), "tcgDbDeckContent");
      return;
    }
    markScrollArea(deckPanel, "tcgDbDeckContent");
  }

  function fixDetailText(el) {
    var text = textOf(el);
    if (!text) return;
    if (/^(?:\u8a73)+\u7d30$/.test(text) || text.indexOf("\u8a73\u8a73\u7d30") !== -1) {
      if ("value" in el && el.value) el.value = JP.detail;
      else el.textContent = JP.detail;
      el.setAttribute("aria-label", JP.detail);
    }
  }

  function classifyControls(root) {
    qsa("button, a, input, select, [role='button'], .btn", root).forEach(function (el) {
      var text = textOf(el);
      fixDetailText(el);
      text = textOf(el);
      removeClass(el, "tcgDbRowPlus");
      removeClass(el, "tcgDbRowMinus");
      removeClass(el, "tcgDbRowCount");
      removeClass(el, "tcgDbRowDetail");
      removeClass(el, "tcgDbDeckActionBtn");
      removeClass(el, "tcgDbPublicDeckBtn");
      if (/^[+＋]$/.test(text)) addClass(el, "tcgDbRowPlus");
      if (/^[-−ー]$/.test(text)) addClass(el, "tcgDbRowMinus");
      if (/^\d+\s*\/\s*\d+$/.test(text)) addClass(el, "tcgDbRowCount");
      if (text === JP.detail) addClass(el, "tcgDbRowDetail");
      if (text.indexOf(JP.save) !== -1 || text.indexOf(JP.myDeck) !== -1) addClass(el, "tcgDbDeckActionBtn");
      if (text.indexOf(JP.publicDeck) !== -1) addClass(el, "tcgDbPublicDeckBtn");
    });
  }

  function rowScore(el) {
    var text = compact(el);
    var r = rectOf(el);
    var score = 0;
    if (r.height >= 34 && r.height <= 180 && r.width > 170) score += 10;
    if (/\(\d+\)|\[\d+\]|\d+\s*\/\s*\d+/.test(text)) score += 18;
    if (text.indexOf(JP.detail) !== -1) score += 14;
    if (text.indexOf(JP.support) !== -1 || text.indexOf("unit") !== -1 || text.indexOf("UNIT") !== -1) score += 10;
    return score;
  }

  function markRows(panel, deckMode) {
    if (!panel) return;
    var candidates = qsa("li, article, .card-row, .deck-row, .card, .item, div", panel).filter(function (el) {
      if (!isVisible(el)) return false;
      if (el === panel) return false;
      var r = rectOf(el);
      if (r.width < 170 || r.height < 34 || r.height > 190) return false;
      return rowScore(el) >= 24;
    });

    candidates.forEach(function (row) {
      addClass(row, "tcgDbRow");
      addClass(row, deckMode ? "tcgDbDeckRow" : "tcgDbCardRow");
      var controls = qsa(".tcgDbRowPlus, .tcgDbRowMinus, .tcgDbRowCount, .tcgDbRowDetail", row);
      var main = null;
      Array.prototype.slice.call(row.children).some(function (child) {
        if (controls.indexOf(child) !== -1) return false;
        if (child.matches && child.matches("button, a, input, select, [role='button']")) return false;
        var text = textOf(child);
        if (!text || text === JP.detail || /^[+＋−ー-]$/.test(text) || /^\d+\s*\/\s*\d+$/.test(text)) return false;
        main = child;
        return true;
      });
      addClass(main || row, "tcgDbRowMain");
    });
  }

  function markDeckTitle(deckPanel) {
    if (!deckPanel) return;
    var nodes = qsa("h1,h2,h3,h4,.title,.header,div,span", deckPanel);
    nodes.some(function (el) {
      var text = compact(el);
      var r = rectOf(el);
      if (r.height > 70 || r.width < 40) return false;
      if (text === JP.deck || text.indexOf(JP.deck) === 0) {
        addClass(el, "tcgDbDeckTitle");
        return true;
      }
      return false;
    });
  }

  function apply() {
    if (!document.body) return;
    addClass(document.body, BODY_CLASS);
    addClass(document.documentElement, BODY_CLASS);

    if (!isMobileMode()) {
      removeClass(document.body, MOBILE_CLASS);
      removeClass(document.documentElement, MOBILE_CLASS);
      return;
    }

    addClass(document.body, MOBILE_CLASS);
    addClass(document.documentElement, MOBILE_CLASS);
    document.documentElement.dataset.deckBlockVersion = VERSION;

    qsa(".tcgDbCardPanel,.tcgDbDeckPanel,.tcgDbStackRoot,.tcgDbStackItem,.tcgDbStackCardItem,.tcgDbStackDeckItem,.tcgDbCardScroll,.tcgDbDeckContent,.tcgDbDeckTitle,.tcgDbRow,.tcgDbCardRow,.tcgDbDeckRow,.tcgDbRowMain").forEach(function (el) {
      ["tcgDbCardPanel", "tcgDbDeckPanel", "tcgDbStackRoot", "tcgDbStackItem", "tcgDbStackCardItem", "tcgDbStackDeckItem", "tcgDbCardScroll", "tcgDbDeckContent", "tcgDbDeckTitle", "tcgDbRow", "tcgDbCardRow", "tcgDbDeckRow", "tcgDbRowMain"].forEach(function (cls) {
        removeClass(el, cls);
      });
    });

    var cardPanel = bestPanel("card");
    var deckPanel = bestPanel("deck");
    if (!cardPanel || !deckPanel || cardPanel === deckPanel) return;

    addClass(cardPanel, "tcgDbCardPanel");
    addClass(deckPanel, "tcgDbDeckPanel");

    var root = commonAncestor(cardPanel, deckPanel);
    if (root && root !== document.body && root !== document.documentElement) {
      addClass(root, "tcgDbStackRoot");
      var cardItem = nearestPanelChild(cardPanel, root);
      var deckItem = nearestPanelChild(deckPanel, root);
      addClass(cardItem, "tcgDbStackItem");
      addClass(cardItem, "tcgDbStackCardItem");
      addClass(deckItem, "tcgDbStackItem");
      addClass(deckItem, "tcgDbStackDeckItem");
    }

    classifyControls(document.body);
    markRows(cardPanel, false);
    markRows(deckPanel, true);
    markScrollArea(cardPanel, "tcgDbCardScroll");
    markDeckContent(deckPanel);
    markDeckTitle(deckPanel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  function boot() {
    apply();
    [250, 700, 1400, 2600, 4200].forEach(function (ms) {
      setTimeout(apply, ms);
    });
    try {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
    addEventListener("resize", schedule, { passive: true });
    addEventListener("orientationchange", schedule, { passive: true });
    addEventListener("click", function () { setTimeout(apply, 60); }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* v20260930_mobile_deck_stable2
   Stable mobile-only deck builder layout. Keep game/deck data rendering owned
   by deck.js and only normalize layout, labels, and navigation controls here. */
(function () {
  "use strict";

  var MOBILE_QUERY = "(max-width: 900px)";
  var scheduled = false;
  var observer = null;

  var TEXT = {
    detail: "\u8a73\u7d30",
    brokenDetail: "\u8a73\u8a73\u7d30",
    save: "\u4fdd\u5b58",
    saveDeck: "\u30c7\u30c3\u30ad\u4fdd\u5b58",
    mine: "\u81ea\u5206\u306e\u30c7\u30c3\u30ad",
    publicDecks: "\u307f\u3093\u306a\u306e\u30c7\u30c3\u30ad",
    rating: "\u8a55\u4fa1",
    start: "\u958b\u59cb",
    play: "PLAY",
    battle: "\u5bfe\u6226\u6e96\u5099"
  };

  function textOf(el) {
    return (el && el.textContent ? el.textContent : "").replace(/\s+/g, " ").trim();
  }

  function isMobile() {
    return !!(window.matchMedia && window.matchMedia(MOBILE_QUERY).matches);
  }

  function closestPanel(el) {
    return el && (el.closest("section.panel") || el.closest(".panel"));
  }

  function commonParent(a, b) {
    if (!a || !b) return null;
    var node = a;
    while (node && !node.contains(b)) node = node.parentElement;
    return node;
  }

  function normalizeLabels(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll("button, [role='button']"), function (button) {
      var label = textOf(button);
      if (label.indexOf(TEXT.brokenDetail) !== -1) {
        button.textContent = label.replace(TEXT.brokenDetail, TEXT.detail);
      }
    });
  }

  function markDeckActions(deckPanel) {
    var primaryBar = deckPanel.querySelector("#deckPanelActions");
    if (primaryBar) {
      primaryBar.classList.add("tcgMobileDeckPrimaryActions");
      primaryBar.classList.remove("tcgMobileDeckHiddenAction", "tcgMobileDeckActionRow");
    }

    var buttons = Array.prototype.slice.call(deckPanel.querySelectorAll("button, a"));
    buttons.forEach(function (button) {
      var label = textOf(button).replace(/\s+/g, "");
      var isPrimary = !!primaryBar && primaryBar.contains(button) &&
        (label === TEXT.save || label.indexOf(TEXT.mine) !== -1);
      var shouldHide = label.indexOf(TEXT.publicDecks) !== -1 ||
        label === TEXT.rating || label === TEXT.start || label === TEXT.play ||
        label.indexOf(TEXT.battle) !== -1;

      button.classList.toggle("tcgMobileDeckPrimaryAction", isPrimary);
      button.classList.toggle("tcgMobileDeckHiddenAction", shouldHide && !isPrimary);
      if (isPrimary) button.classList.remove("tcgMobileDeckHiddenAction");
    });
  }

  function markRows(list) {
    if (!list) return;
    Array.prototype.forEach.call(list.children, function (row) {
      row.classList.add("tcgMobileDeckCardRow");
      Array.prototype.forEach.call(row.querySelectorAll("button"), function (button) {
        var label = textOf(button);
        if (label.indexOf(TEXT.brokenDetail) !== -1) {
          button.textContent = label.replace(TEXT.brokenDetail, TEXT.detail);
        }
        if (label === TEXT.detail || label.indexOf(TEXT.detail) !== -1) {
          button.classList.add("tcgMobileDeckDetailButton");
        }
      });
    });
  }

  function clearMobileClasses() {
    document.documentElement.classList.remove("tcgMobileDeckStable");
    document.body && document.body.classList.remove("tcgMobileDeckStable");
  }

  function applyLayout() {
    scheduled = false;
    normalizeLabels(document);

    if (!isMobile()) {
      clearMobileClasses();
      return;
    }

    var cardList = document.getElementById("cardList");
    var deckList = document.getElementById("deckList");
    var deckPanel = document.getElementById("deckPanel");
    var cardPanel = closestPanel(cardList);
    if (!cardList || !deckList || !deckPanel || !cardPanel) return;

    var root = commonParent(cardPanel, deckPanel) || document.querySelector("main.wrap");
    document.documentElement.classList.add("tcgMobileDeckStable");
    document.body.classList.add("tcgMobileDeckStable");
    root && root.classList.add("tcgMobileDeckStableRoot");
    cardPanel.classList.add("tcgMobileDeckStableCardPanel");
    deckPanel.classList.add("tcgMobileDeckStableDeckPanel");
    cardList.classList.add("tcgMobileDeckStableCardList");
    deckList.classList.add("tcgMobileDeckStableDeckList");

    // Legacy mobile rules still apply fixed heights/hidden overflow after this
    // module loads. Keep the two main blocks in normal document flow so the
    // adopted-card list is never clipped on narrow screens.
    [cardPanel, deckPanel].forEach(function (panel) {
      panel.style.setProperty("height", "auto", "important");
      panel.style.setProperty("max-height", "none", "important");
      panel.style.setProperty("overflow", "visible", "important");
      var body = panel.querySelector(":scope > .bd");
      if (body) {
        body.style.setProperty("height", "auto", "important");
        body.style.setProperty("max-height", "none", "important");
        body.style.setProperty("overflow", "visible", "important");
      }
    });

    markDeckActions(deckPanel);
    markRows(cardList);
    markRows(deckList);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyLayout);
  }

  function injectStyles() {
    if (document.getElementById("tcg-mobile-deck-stable-style")) return;
    var style = document.createElement("style");
    style.id = "tcg-mobile-deck-stable-style";
    style.textContent = `
      .tcgMobileDeckHiddenAction { display: none !important; }

      @media (max-width: 900px) {
        html.tcgMobileDeckStable,
        body.tcgMobileDeckStable {
          width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 100% !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }

        body.tcgMobileDeckStable main.wrap,
        body.tcgMobileDeckStable .tcgMobileDeckStableRoot {
          display: flex !important;
          flex-direction: column !important;
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: stretch !important;
          gap: 14px !important;
          width: 100% !important;
          max-width: none !important;
          height: auto !important;
          min-height: 0 !important;
          overflow: visible !important;
          padding-inline: 12px !important;
          box-sizing: border-box !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableCardPanel,
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel {
          position: relative !important;
          inset: auto !important;
          transform: none !important;
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          margin: 0 !important;
          overflow: visible !important;
          writing-mode: horizontal-tb !important;
          text-orientation: mixed !important;
          box-sizing: border-box !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableCardPanel { order: 1 !important; }
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel { order: 2 !important; }

        body.tcgMobileDeckStable .tcgMobileDeckStableCardPanel > .hd,
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel > .hd {
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
          min-height: 58px !important;
          padding: 10px 12px !important;
          overflow: visible !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel > .hd {
          flex-wrap: wrap !important;
        }

        body.tcgMobileDeckStable #deckPanelActions,
        body.tcgMobileDeckStable .tcgMobileDeckPrimaryActions {
          order: 3 !important;
          flex: 1 1 100% !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
        }

        body.tcgMobileDeckStable #deckPanelActions > button,
        body.tcgMobileDeckStable .tcgMobileDeckPrimaryActions > button {
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          min-height: 44px !important;
          padding: 7px 6px !important;
          font-size: 13px !important;
          white-space: nowrap !important;
          writing-mode: horizontal-tb !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        body.tcgMobileDeckStable .panelHdText,
        body.tcgMobileDeckStable .panelHdText b,
        body.tcgMobileDeckStable #deckPanel > .hd b {
          display: block !important;
          width: auto !important;
          min-width: 0 !important;
          white-space: nowrap !important;
          word-break: keep-all !important;
          writing-mode: horizontal-tb !important;
          text-orientation: mixed !important;
          line-height: 1.25 !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableCardPanel > .bd,
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel > .bd {
          display: block !important;
          width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 10px !important;
          box-sizing: border-box !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableCardPanel.isCollapsed > .bd,
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel.isCollapsed > .bd,
        body.tcgMobileDeckStable .tcgMobileDeckStableCardPanel.collapsed > .bd,
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckPanel.collapsed > .bd {
          display: none !important;
        }

        body.tcgMobileDeckStable #cardFilters {
          position: relative !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          touch-action: pan-x !important;
          scrollbar-width: thin !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableCardList,
        body.tcgMobileDeckStable .tcgMobileDeckStableDeckList {
          position: relative !important;
          inset: auto !important;
          transform: none !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 240px !important;
          max-height: 58svh !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          touch-action: pan-y !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 4px !important;
          box-sizing: border-box !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckStableDeckList {
          min-height: 300px !important;
          max-height: 62svh !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckCardRow {
          position: relative !important;
          inset: auto !important;
          transform: none !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          min-height: 82px !important;
          margin: 0 !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        body.tcgMobileDeckStable button,
        body.tcgMobileDeckStable [role="button"] {
          pointer-events: auto !important;
          touch-action: manipulation !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckCardRow button {
          position: relative !important;
          z-index: 4 !important;
          min-width: 44px !important;
          min-height: 44px !important;
        }

        body.tcgMobileDeckStable .tcgMobileDeckDetailButton {
          white-space: nowrap !important;
          writing-mode: horizontal-tb !important;
          line-height: 1 !important;
        }

        body.tcgMobileDeckStable .deckSaveDock,
        body.tcgMobileDeckStable .deckInfoDock,
        body.tcgMobileDeckStable .deckInfoBody {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          box-sizing: border-box !important;
        }

        body.tcgMobileDeckStable .deckSaveRow,
        body.tcgMobileDeckStable .tcgMobileDeckActionRow {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
        }

        body.tcgMobileDeckStable .deckSaveRow > .small { display: none !important; }

        body.tcgMobileDeckStable .tcgMobileDeckPrimaryAction {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 46px !important;
          padding: 8px 10px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        body.tcgMobileDeckStable .listHead {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
          min-width: 0 !important;
        }

        body.tcgMobileDeckStable .listHead .hint {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    applyLayout();
    [80, 240, 600, 1200, 2400].forEach(function (delay) {
      setTimeout(applyLayout, delay);
    });
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });
    document.addEventListener("click", function () { setTimeout(schedule, 30); }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

;(function () {
  "use strict";

  var STYLE_ID = "tcg-mobile-deck-decide-20260929-final";
  var BODY_CLASS = "tcgMobileDeckDecide";

  function isMobileLike() {
    try {
      return window.innerWidth <= 900 ||
        window.matchMedia("(pointer: coarse)").matches ||
        /(?:\?|&)mobile=1(?:&|$)/.test(location.search);
    } catch (e) {
      return window.innerWidth <= 900;
    }
  }

  function all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function txt(el) {
    return ((el && (el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    var s = getComputedStyle(el);
    var r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 8 && r.height > 8;
  }

  function area(el) {
    var r = el.getBoundingClientRect();
    return r.width * r.height;
  }

  function add(el, cls) {
    if (el) el.classList.add(cls);
  }

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 900px), (pointer: coarse) {
  html, body {
    overflow-x: hidden !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckDecideHost {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    overflow: visible !important;
    transform: none !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardPanel,
  body.${BODY_CLASS} .tcgMobileDeckDeckPanel {
    position: relative !important;
    inset: auto !important;
    left: auto !important;
    right: auto !important;
    top: auto !important;
    bottom: auto !important;
    float: none !important;
    transform: none !important;
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
    min-width: 0 !important;
    margin: 0 auto !important;
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
    overflow: hidden !important;
    contain: none !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardPanel {
    order: 10 !important;
    min-height: 320px !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckDeckPanel {
    order: 20 !important;
    min-height: 430px !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardPanel *,
  body.${BODY_CLASS} .tcgMobileDeckDeckPanel * {
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
    max-width: 100% !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardScroll,
  body.${BODY_CLASS} .tcgMobileDeckDeckScroll {
    display: block !important;
    min-width: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior: contain !important;
    touch-action: pan-y !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardScroll {
    max-height: 62vh !important;
    min-height: 260px !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckDeckScroll {
    max-height: 68vh !important;
    min-height: 300px !important;
    padding-bottom: 92px !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckTitle,
  body.${BODY_CLASS} .tcgMobileDeckCardPanel h1,
  body.${BODY_CLASS} .tcgMobileDeckCardPanel h2,
  body.${BODY_CLASS} .tcgMobileDeckCardPanel h3,
  body.${BODY_CLASS} .tcgMobileDeckDeckPanel h1,
  body.${BODY_CLASS} .tcgMobileDeckDeckPanel h2,
  body.${BODY_CLASS} .tcgMobileDeckDeckPanel h3 {
    position: static !important;
    transform: none !important;
    text-indent: 0 !important;
    white-space: nowrap !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    line-height: 1.25 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckActions {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    gap: 8px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckAction {
    width: 100% !important;
    min-width: 0 !important;
    height: 44px !important;
    padding: 0 10px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckHide {
    display: none !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckRow {
    position: relative !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 58px 42px 56px 42px !important;
    grid-template-areas: "main detail minus count plus" !important;
    align-items: center !important;
    gap: 6px !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 62px !important;
    padding: 8px !important;
    overflow: hidden !important;
    transform: none !important;
    contain: none !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckRowMain {
    grid-area: main !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckDetail {
    grid-area: detail !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckMinus {
    grid-area: minus !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCount {
    grid-area: count !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPlus {
    grid-area: plus !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckDetail,
  body.${BODY_CLASS} .tcgMobileDeckPlus,
  body.${BODY_CLASS} .tcgMobileDeckMinus,
  body.${BODY_CLASS} .tcgMobileDeckCount {
    position: static !important;
    inset: auto !important;
    transform: none !important;
    float: none !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 38px !important;
    min-height: 38px !important;
    max-height: 38px !important;
    padding: 0 6px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
    z-index: 20 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckDeckPanel .tcgMobileDeckRow + .tcgMobileDeckRow {
    margin-top: 8px !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardPanel .tcgMobileDeckRow {
    grid-template-columns: minmax(0, 1fr) 58px 42px 56px 42px !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckCardPanel .tcgMobileDeckRow:not(:has(.tcgMobileDeckPlus)):not(:has(.tcgMobileDeckMinus)) {
    grid-template-columns: minmax(0, 1fr) 86px !important;
    grid-template-areas: "main detail" !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function replaceTypo(root) {
    if (!root) return;
    try {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      var targets = [];
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.indexOf("詳詳細") >= 0) targets.push(node);
      }
      targets.forEach(function (n) { n.nodeValue = n.nodeValue.replace(/詳詳細/g, "詳細"); });
    } catch (e) {}
  }

  function panelByText(re) {
    var nodes = all("section, article, aside, main, div")
      .filter(function (el) {
        if (!visible(el)) return false;
        var r = el.getBoundingClientRect();
        return r.width > 240 && r.height > 80 && r.width <= window.innerWidth * 2.5 && re.test(txt(el));
      })
      .sort(function (a, b) { return area(a) - area(b); });
    return nodes[0] || null;
  }

  function climbPanel(from, re) {
    var el = from;
    for (var i = 0; el && el !== document.body && i < 10; i += 1, el = el.parentElement) {
      var r = el.getBoundingClientRect();
      if (r.width > 240 && r.height > 90 && re.test(txt(el))) return el;
    }
    return null;
  }

  function findCardPanel() {
    var list = document.getElementById("cardList");
    return climbPanel(list, /カード一覧/) || panelByText(/カード一覧/);
  }

  function findDeckPanel() {
    var deckPanel = document.getElementById("deckPanel");
    if (deckPanel && visible(deckPanel)) return deckPanel;
    var deckList = document.getElementById("deckList");
    return climbPanel(deckList, /デッキ|入れたカード|採用カード/) ||
      panelByText(/デッキ[\s\S]*(保存|全消し|入れたカード|採用カード)/);
  }

  function commonParent(a, b) {
    var chain = [];
    var x = a;
    while (x && x !== document.body) {
      chain.push(x);
      x = x.parentElement;
    }
    var y = b;
    while (y && y !== document.body) {
      if (chain.indexOf(y) >= 0) return y;
      y = y.parentElement;
    }
    return null;
  }

  function directRows(root) {
    if (!root) return [];
    var candidates = all(".cardRow, .deckRow, .deckCardRow, .deckInCard, .deckListItem, li, div", root)
      .filter(function (el) {
        if (!visible(el)) return false;
        var t = txt(el);
        if (!t) return false;
        var hasButton = all("button, a", el).some(function (b) {
          var bt = txt(b);
          return bt === "+" || bt === "-" || bt.indexOf("詳細") >= 0 || /\d+\s*\/\s*\d+/.test(bt);
        });
        return hasButton && (/\d+\s*\/\s*\d+/.test(t) || /詳細/.test(t) || /HP|SP|効果|unit|サポ|support/.test(t));
      });
    return candidates.filter(function (el) {
      return !candidates.some(function (other) { return other !== el && other.contains(el); });
    });
  }

  function classifyRow(row) {
    add(row, "tcgMobileDeckRow");
    var parts = all("button, a, span, div", row).filter(visible);
    var controlSet = [];
    parts.forEach(function (el) {
      var t = txt(el);
      if (t === "+") {
        add(el, "tcgMobileDeckPlus");
        controlSet.push(el);
      } else if (t === "-") {
        add(el, "tcgMobileDeckMinus");
        controlSet.push(el);
      } else if (t.indexOf("詳細") >= 0 && t.length <= 8) {
        add(el, "tcgMobileDeckDetail");
        controlSet.push(el);
      } else if (/^\d+\s*\/\s*\d+$/.test(t)) {
        add(el, "tcgMobileDeckCount");
        controlSet.push(el);
      }
    });
    var children = Array.prototype.slice.call(row.children);
    var main = children.find(function (ch) {
      return controlSet.indexOf(ch) < 0 && !/^\d+\s*\/\s*\d+$/.test(txt(ch)) && !/^[+\-]$/.test(txt(ch));
    }) || children[0];
    add(main, "tcgMobileDeckRowMain");
  }

  function markTitles(panel, label) {
    if (!panel) return;
    all("h1,h2,h3,h4,.title,.panelTitle,.sectionTitle,header,button,span,div", panel)
      .filter(function (el) { return visible(el) && txt(el) === label; })
      .forEach(function (el) { add(el, "tcgMobileDeckTitle"); });
  }

  function findActionBar(deckPanel) {
    var actionButtons = all("button, a", deckPanel).filter(function (b) {
      var t = txt(b);
      return t === "保存" || t.indexOf("自分のデッキ") >= 0;
    });
    actionButtons.forEach(function (b) {
      add(b, "tcgMobileDeckAction");
      var p = b.parentElement;
      for (var i = 0; p && p !== deckPanel && i < 4; i += 1, p = p.parentElement) {
        var labels = all("button, a", p).map(txt).join(" ");
        if (/保存/.test(labels) && /自分のデッキ/.test(labels)) {
          add(p, "tcgMobileDeckActions");
          break;
        }
      }
    });
  }

  function hideMobileOnly(deckPanel) {
    all("button, a", deckPanel).forEach(function (b) {
      var t = txt(b);
      if (/みんなのデッキ|評価|開始|プレイ/.test(t)) add(b, "tcgMobileDeckHide");
    });
  }

  function chooseScroll(panel, fallbackId, rowRootRe) {
    var byId = document.getElementById(fallbackId);
    if (byId && panel.contains(byId)) return byId;
    var nodes = all("div, ul, ol, section", panel).filter(function (el) {
      if (!visible(el)) return false;
      var r = el.getBoundingClientRect();
      return r.height > 120 && r.width > 220 && rowRootRe.test(txt(el));
    }).sort(function (a, b) { return area(a) - area(b); });
    return nodes[0] || panel;
  }

  function apply() {
    if (!isMobileLike()) {
      document.body.classList.remove(BODY_CLASS);
      return;
    }
    injectCss();
    replaceTypo(document.body);
    document.body.classList.add(BODY_CLASS);

    var cardPanel = findCardPanel();
    var deckPanel = findDeckPanel();
    if (!cardPanel || !deckPanel || cardPanel === deckPanel) return;

    add(cardPanel, "tcgMobileDeckCardPanel");
    add(deckPanel, "tcgMobileDeckDeckPanel");
    markTitles(cardPanel, "カード一覧");
    markTitles(deckPanel, "デッキ");

    var host = commonParent(cardPanel, deckPanel);
    if (host) add(host, "tcgMobileDeckDecideHost");

    var cardScroll = chooseScroll(cardPanel, "cardList", /詳細|HP|SP|効果|unit|サポ|support/);
    var deckScroll = chooseScroll(deckPanel, "deckList", /\d+\s*\/\s*\d+|入れたカード|採用カード|まだカード/);
    add(cardScroll, "tcgMobileDeckCardScroll");
    add(deckScroll, "tcgMobileDeckDeckScroll");

    directRows(cardScroll).forEach(classifyRow);
    directRows(deckScroll).forEach(classifyRow);
    findActionBar(deckPanel);
    hideMobileOnly(deckPanel);
  }

  var timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 40);
  }

  function boot() {
    apply();
    [80, 220, 600, 1200, 2400, 4800].forEach(function (ms) { setTimeout(apply, ms); });
    try {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    } catch (e) {}
    addEventListener("resize", schedule, { passive: true });
    addEventListener("orientationchange", schedule, { passive: true });
    addEventListener("click", function () { setTimeout(apply, 30); }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

;(() => {
  const STYLE_ID = "tcg-mobile-deck-last-word-20260929";
  const MOBILE_Q = "(max-width: 820px), (pointer: coarse)";
  const mq = matchMedia(MOBILE_Q);
  let timer = 0;

  const textOf = (el) => (el && (el.innerText || el.textContent) || "").replace(/\s+/g, " ").trim();
  const isShown = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20;
  };
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const hasText = (el, re) => re.test(textOf(el));

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 820px), (pointer: coarse) {
  body.tcgMobileDeckLastWord {
    overflow-x: hidden !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastStackHost,
  body.tcgMobileDeckLastWord .tcgMLastStackHost > .tcgMLastCardPanel,
  body.tcgMobileDeckLastWord .tcgMLastStackHost > .tcgMLastDeckPanel {
    transform: none !important;
    writing-mode: horizontal-tb !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastStackHost {
    width: 100vw !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
    gap: 12px !important;
    overflow: visible !important;
    padding: 8px 10px 24px !important;
    box-sizing: border-box !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastCardPanel,
  body.tcgMobileDeckLastWord .tcgMLastDeckPanel {
    position: relative !important;
    inset: auto !important;
    float: none !important;
    order: 1 !important;
    width: calc(100vw - 20px) !important;
    min-width: 0 !important;
    max-width: calc(100vw - 20px) !important;
    max-height: none !important;
    margin: 0 auto !important;
    box-sizing: border-box !important;
    overflow: visible !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDeckPanel {
    order: 2 !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastCardScroll,
  body.tcgMobileDeckLastWord .tcgMLastDeckScroll {
    max-height: 64vh !important;
    min-height: 180px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    touch-action: pan-y !important;
    padding-right: 4px !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDeckScroll {
    max-height: 72vh !important;
    min-height: 260px !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDeckTitle {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    writing-mode: horizontal-tb !important;
    transform: none !important;
    white-space: nowrap !important;
    text-orientation: mixed !important;
    letter-spacing: 0 !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastActionLine {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    gap: 8px !important;
    align-items: center !important;
    width: 100% !important;
    overflow: visible !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastAction {
    min-width: 0 !important;
    width: 100% !important;
    height: 44px !important;
    padding: 0 8px !important;
    white-space: nowrap !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastHide {
    display: none !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDeckRow {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 58px 44px 56px 44px !important;
    grid-template-areas:
      "main detail minus count plus" !important;
    gap: 6px !important;
    align-items: center !important;
    min-height: 66px !important;
    max-height: none !important;
    padding: 8px !important;
    overflow: visible !important;
    box-sizing: border-box !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDeckRowMain {
    grid-area: main !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDetail { grid-area: detail !important; }
  body.tcgMobileDeckLastWord .tcgMLastMinus { grid-area: minus !important; }
  body.tcgMobileDeckLastWord .tcgMLastCount { grid-area: count !important; }
  body.tcgMobileDeckLastWord .tcgMLastPlus { grid-area: plus !important; }
  body.tcgMobileDeckLastWord .tcgMLastDetail,
  body.tcgMobileDeckLastWord .tcgMLastMinus,
  body.tcgMobileDeckLastWord .tcgMLastPlus,
  body.tcgMobileDeckLastWord .tcgMLastCount {
    position: relative !important;
    inset: auto !important;
    transform: none !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 42px !important;
    max-height: 42px !important;
    z-index: 30 !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    white-space: nowrap !important;
    writing-mode: horizontal-tb !important;
  }
  body.tcgMobileDeckLastWord .tcgMLastDeckRowMain,
  body.tcgMobileDeckLastWord .tcgMLastDeckRowMain * {
    max-width: 100% !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function findPanel(labelRe, extraRe) {
    const candidates = qsa("section, article, aside, main > div, body > div, .panel, .card, .deck, [class*='panel'], [class*='deck'], [class*='card']");
    return candidates
      .filter(isShown)
      .filter((el) => labelRe.test(textOf(el)) && (!extraRe || extraRe.test(textOf(el))))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return (br.width * br.height) - (ar.width * ar.height);
      })[0] || null;
  }

  function commonHost(a, b) {
    let p = a && a.parentElement;
    while (p && p !== document.body) {
      if (p.contains(b)) return p;
      p = p.parentElement;
    }
    return a && a.parentElement;
  }

  function markScroll(panel, kind) {
    const kids = qsa("div, section, article, ul, ol", panel).filter(isShown);
    const scored = kids.map((el) => {
      const t = textOf(el);
      const count = kind === "card"
        ? (t.match(/詳細/g) || []).length + (t.match(/0\s*\/\s*\d+/g) || []).length
        : (t.match(/\d+\s*\/\s*\d+/g) || []).length + (t.match(/入れたカード|採用カード/g) || []).length;
      const r = el.getBoundingClientRect();
      return { el, score: count * 1000 + Math.min(r.height, 900) + Math.min(r.width, 900) };
    }).filter((x) => x.score > 1000).sort((a, b) => b.score - a.score);
    const target = (scored[0] && scored[0].el) || panel;
    target.classList.add(kind === "card" ? "tcgMLastCardScroll" : "tcgMLastDeckScroll");
  }

  function cleanText(root) {
    qsa("*", root).forEach((el) => {
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE && el.textContent.includes("詳詳細")) {
        el.textContent = el.textContent.replace(/詳詳細/g, "詳細");
      }
    });
  }

  function markDeckActions(deckPanel) {
    const buttons = qsa("button, a, [role='button'], .btn, [class*='button']", deckPanel).filter(isShown);
    const keep = [];
    buttons.forEach((btn) => {
      const t = textOf(btn);
      if (/みんなのデッキ|評価|開始|プレイ/.test(t)) btn.classList.add("tcgMLastHide");
      if (/^(保存|デッキ保存|自分のデッキ)$/.test(t) || /保存|自分のデッキ/.test(t)) {
        btn.classList.add("tcgMLastAction");
        keep.push(btn);
      }
    });
    if (keep.length >= 2) {
      const p = keep[0].parentElement || deckPanel;
      p.classList.add("tcgMLastActionLine");
    }
  }

  function markDeckRows(deckPanel) {
    const controlSel = "button, input, [role='button'], .btn, [class*='button']";
    qsa(controlSel, deckPanel).forEach((el) => {
      const t = textOf(el).trim();
      const v = (el.value || "").trim();
      const key = t || v;
      if (key === "+" || key === "＋") el.classList.add("tcgMLastPlus");
      if (key === "-" || key === "－") el.classList.add("tcgMLastMinus");
      if (/^詳?詳細$/.test(key)) {
        el.textContent = "詳細";
        el.classList.add("tcgMLastDetail");
      }
      if (/^\d+\s*\/\s*\d+$/.test(key)) el.classList.add("tcgMLastCount");
    });
    qsa(".tcgMLastPlus, .tcgMLastMinus, .tcgMLastDetail, .tcgMLastCount", deckPanel).forEach((ctl) => {
      let row = ctl.closest("li, article, section, .deck-card, .deck-row, [class*='row'], [class*='item']");
      if (!row || row === deckPanel || !/\d+\s*\/\s*\d+|詳細|\+|－|-/.test(textOf(row))) {
        row = ctl.parentElement;
        while (row && row !== deckPanel && (!/\d+\s*\/\s*\d+/.test(textOf(row)) || row.getBoundingClientRect().height > 160)) {
          row = row.parentElement;
        }
      }
      if (!row || row === deckPanel) return;
      row.classList.add("tcgMLastDeckRow");
      const children = Array.from(row.children).filter((c) => !c.classList.contains("tcgMLastPlus") && !c.classList.contains("tcgMLastMinus") && !c.classList.contains("tcgMLastDetail") && !c.classList.contains("tcgMLastCount"));
      const main = children.find((c) => /[ぁ-んァ-ヶ一-龠A-Za-z]/.test(textOf(c))) || children[0];
      if (main) main.classList.add("tcgMLastDeckRowMain");
    });
  }

  function markTitles(deckPanel) {
    qsa("h1,h2,h3,h4,.title,.heading,[class*='title'],[class*='heading']", deckPanel).forEach((el) => {
      if (/デッキ/.test(textOf(el)) && el.getBoundingClientRect().height < 120) el.classList.add("tcgMLastDeckTitle");
    });
  }

  function apply() {
    if (!mq.matches) return;
    injectCss();
    document.body.classList.add("tcgMobileDeckLastWord");

    const cardPanel = findPanel(/カード一覧/, /候補|クリックで詳細|カード名|全属性|キャラ|サポート/);
    const deckPanel = findPanel(/デッキ/, /入れたカード|採用カード|保存|自分のデッキ|全消し/);
    if (!cardPanel || !deckPanel || cardPanel === deckPanel) return;

    const host = commonHost(cardPanel, deckPanel);
    if (host) host.classList.add("tcgMLastStackHost");
    cardPanel.classList.add("tcgMLastCardPanel");
    deckPanel.classList.add("tcgMLastDeckPanel");
    [cardPanel, deckPanel].forEach((p) => {
      p.style.width = "calc(100vw - 20px)";
      p.style.maxWidth = "calc(100vw - 20px)";
      p.style.minWidth = "0";
      p.style.marginLeft = "auto";
      p.style.marginRight = "auto";
      p.style.transform = "none";
      p.style.writingMode = "horizontal-tb";
    });

    markScroll(cardPanel, "card");
    markScroll(deckPanel, "deck");
    cleanText(deckPanel);
    markDeckActions(deckPanel);
    markDeckRows(deckPanel);
    markTitles(deckPanel);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(apply, 60);
  }

  function boot() {
    apply();
    [100, 300, 700, 1300, 2500, 4500, 7000].forEach((ms) => setTimeout(apply, ms));
    try {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) {}
    addEventListener("resize", schedule, { passive: true });
    addEventListener("orientationchange", schedule, { passive: true });
    addEventListener("click", () => setTimeout(apply, 40), true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

;(() => {
  const STYLE_ID = "tcg-mobile-deck-stack-hardfix-runtime-style-v2";
  const BODY_CLASS = "tcgMobileDeckStackHardFix";

  function isMobileDeckView() {
    try {
      return matchMedia("(max-width: 900px)").matches ||
        (matchMedia("(pointer: coarse)").matches && matchMedia("(max-width: 980px)").matches);
    } catch (e) {
      return window.innerWidth <= 900;
    }
  }

  function textOf(el) {
    return ((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 20;
  }

  function panelLike(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const cls = String(el.className || "");
    if (/panel|card|deck|section|block|pane|builder|list/i.test(cls)) return true;
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    return !!(r && r.width > 180 && r.height > 90);
  }

  function closestPanel(el, label) {
    let cur = el;
    let best = null;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (panelLike(cur) && textOf(cur).indexOf(label) >= 0) best = cur;
      cur = cur.parentElement;
    }
    return best;
  }

  function findPanelByLabel(label) {
    const direct = Array.from(document.querySelectorAll(".tcgMobileCardPanelHardFix,.tcgMobileDeckPanelHardFix"))
      .find((el) => textOf(el).indexOf(label) >= 0 && isVisible(el));
    if (direct) return direct;

    const nodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,header,section,article,aside,div"));
    const hits = nodes.filter((el) => {
      const t = textOf(el);
      return t === label || t.startsWith(label + " ") || t.indexOf(label) >= 0;
    });
    for (const hit of hits) {
      const panel = closestPanel(hit, label);
      if (panel && isVisible(panel)) return panel;
    }
    return null;
  }

  function commonParent(a, b) {
    const seen = new Set();
    let cur = a;
    while (cur) {
      seen.add(cur);
      cur = cur.parentElement;
    }
    cur = b;
    while (cur) {
      if (seen.has(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width: 900px), (pointer: coarse) and (max-width: 980px) {
  body.${BODY_CLASS} {
    overflow-x: hidden !important;
    min-width: 0 !important;
  }

  body.${BODY_CLASS} main,
  body.${BODY_CLASS} .builder-grid,
  body.${BODY_CLASS} .deck-layout,
  body.${BODY_CLASS} .deckBuilderLayout,
  body.${BODY_CLASS} .tcgDeckBuilderShell,
  body.${BODY_CLASS} .mobileDeckStackHost,
  body.${BODY_CLASS} .tcgDbMobileStack,
  body.${BODY_CLASS} .tcgMobileDeckRootHardFix {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
    width: 100% !important;
    max-width: 100vw !important;
    min-width: 0 !important;
    grid-template-columns: 1fr !important;
    overflow: visible !important;
    transform: none !important;
  }

  body.${BODY_CLASS} .tcgMobileCardPanelHardFix,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix {
    position: relative !important;
    inset: auto !important;
    left: auto !important;
    right: auto !important;
    top: auto !important;
    bottom: auto !important;
    transform: none !important;
    float: none !important;
    width: calc(100vw - 20px) !important;
    max-width: calc(100vw - 20px) !important;
    min-width: 0 !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 auto 12px !important;
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
    overflow: hidden !important;
  }

  body.${BODY_CLASS} .tcgMobileCardPanelHardFix {
    order: 1 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix {
    order: 2 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix *,
  body.${BODY_CLASS} .tcgMobileCardPanelHardFix * {
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
  }

  body.${BODY_CLASS} .tcgMobileCardPanelHardFix #cardList,
  body.${BODY_CLASS} .tcgMobileCardPanelHardFix .tcgDbCardScroll,
  body.${BODY_CLASS} .tcgMobileCardPanelHardFix .tcgMobileCardListHardFix,
  body.${BODY_CLASS} .tcgMobileCardPanelHardFix [class*="cardList"],
  body.${BODY_CLASS} .tcgMobileCardPanelHardFix [class*="CardList"] {
    display: block !important;
    min-height: 280px !important;
    max-height: 62vh !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix #deckList,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgDbDeckContent,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckListHardFix,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix [class*="deckList"],
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix [class*="DeckList"] {
    display: block !important;
    min-height: 300px !important;
    max-height: 64vh !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 8px 8px 112px !important;
    -webkit-overflow-scrolling: touch !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckActionHidden {
    display: none !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgDbDeckActions,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .deckPanelActions,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckActionLine {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 8px !important;
    overflow: visible !important;
    width: 100% !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowFix {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 62px 42px 54px 42px !important;
    grid-template-rows: auto auto !important;
    align-items: center !important;
    gap: 6px !important;
    min-height: 84px !important;
    padding: 9px !important;
    overflow: visible !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowMain {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
    min-width: 0 !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowDetail {
    grid-column: 2 !important;
    grid-row: 2 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowPlus {
    grid-column: 3 !important;
    grid-row: 2 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowCount {
    grid-column: 4 !important;
    grid-row: 2 !important;
    text-align: center !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowMinus {
    grid-column: 5 !important;
    grid-row: 2 !important;
  }

  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowDetail,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowPlus,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowMinus,
  body.${BODY_CLASS} .tcgMobileDeckPanelHardFix .tcgMobileDeckRowCount {
    position: static !important;
    inset: auto !important;
    transform: none !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 38px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    white-space: nowrap !important;
    pointer-events: auto !important;
    z-index: 3 !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function tagActionButtons(deckPanel) {
    const buttons = Array.from(deckPanel.querySelectorAll("button,a,[role='button']"));
    buttons.forEach((btn) => {
      const t = textOf(btn);
      if (/みんなのデッキ|評価|開始/.test(t)) {
        btn.classList.add("tcgMobileDeckActionHidden");
      } else if (/保存|自分のデッキ/.test(t)) {
        btn.classList.add("tcgMobileDeckActionPrimary");
        const parent = btn.parentElement;
        if (parent && parent.children.length <= 4) parent.classList.add("tcgMobileDeckActionLine");
      }
    });
  }

  function findRowFromControl(control, panel) {
    let cur = control;
    for (let i = 0; i < 8 && cur && cur !== panel; i += 1) {
      const t = textOf(cur);
      const hasCount = /\d+\s*\/\s*\d+/.test(t);
      const hasName = /【|\(\d+\)|×|x\d+|初期|ガチャ|サポ|unit|support/.test(t);
      const controls = cur.querySelectorAll ? cur.querySelectorAll("button,a,[role='button']").length : 0;
      if (hasCount && (hasName || controls >= 2)) return cur;
      cur = cur.parentElement;
    }
    return control.parentElement;
  }

  function tagDeckRows(deckPanel) {
    const controls = Array.from(deckPanel.querySelectorAll("button,a,[role='button'],span,div"));
    controls.forEach((el) => {
      const t = textOf(el);
      if (t === "詳詳細") el.textContent = "詳細";
    });

    const buttonControls = Array.from(deckPanel.querySelectorAll("button,a,[role='button']"));
    buttonControls.forEach((btn) => {
      const t = textOf(btn);
      let cls = "";
      if (t === "+") cls = "tcgMobileDeckRowPlus";
      else if (t === "-") cls = "tcgMobileDeckRowMinus";
      else if (/詳細|詳詳細/.test(t)) cls = "tcgMobileDeckRowDetail";
      if (!cls) return;
      btn.classList.add(cls);
      const row = findRowFromControl(btn, deckPanel);
      if (!row) return;
      row.classList.add("tcgMobileDeckRowFix");
    });

    Array.from(deckPanel.querySelectorAll(".tcgMobileDeckRowFix")).forEach((row) => {
      const count = Array.from(row.querySelectorAll("span,div,button")).find((el) => /^\d+\s*\/\s*\d+$/.test(textOf(el)));
      if (count) count.classList.add("tcgMobileDeckRowCount");

      const detail = row.querySelector(".tcgMobileDeckRowDetail");
      const plus = row.querySelector(".tcgMobileDeckRowPlus");
      const minus = row.querySelector(".tcgMobileDeckRowMinus");
      Array.from(row.children).forEach((child) => {
        if (child === detail || child === plus || child === minus || child === count) return;
        if (!child.classList.contains("tcgMobileDeckRowMain") && textOf(child)) {
          child.classList.add("tcgMobileDeckRowMain");
        }
      });
      if (!row.querySelector(".tcgMobileDeckRowMain")) row.classList.add("tcgMobileDeckRowMain");
    });
  }

  function applyMobileDeckStack() {
    injectStyle();
    if (!document.body) return;
    if (!isMobileDeckView()) {
      document.body.classList.remove(BODY_CLASS);
      return;
    }

    document.body.classList.add(BODY_CLASS);

    Array.from(document.querySelectorAll("button,a,span,div")).forEach((el) => {
      if (textOf(el) === "詳詳細") el.textContent = "詳細";
    });

    const cardPanel = findPanelByLabel("カード一覧");
    const deckPanel = findPanelByLabel("デッキ");
    if (!cardPanel || !deckPanel || cardPanel === deckPanel) return;

    cardPanel.classList.add("tcgMobileCardPanelHardFix");
    deckPanel.classList.add("tcgMobileDeckPanelHardFix");

    const root = commonParent(cardPanel, deckPanel);
    if (root && root !== document.body && root !== document.documentElement) {
      root.classList.add("tcgMobileDeckRootHardFix");
    }

    const cardList = cardPanel.querySelector("#cardList,[data-card-list],.tcgDbCardScroll,.card-list,.cards-list,[class*='cardList'],[class*='CardList']");
    if (cardList) cardList.classList.add("tcgMobileCardListHardFix");

    const deckList = deckPanel.querySelector("#deckList,[data-deck-list],.tcgDbDeckContent,.deck-list,.deckCards,[class*='deckList'],[class*='DeckList']");
    if (deckList) deckList.classList.add("tcgMobileDeckListHardFix");

    tagActionButtons(deckPanel);
    tagDeckRows(deckPanel);
  }

  function scheduleApply() {
    clearTimeout(scheduleApply.t);
    scheduleApply.t = setTimeout(applyMobileDeckStack, 50);
  }

  function boot() {
    applyMobileDeckStack();
    [120, 350, 800, 1600, 3000, 5200].forEach((ms) => setTimeout(applyMobileDeckStack, ms));
    try {
      new MutationObserver(scheduleApply).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    } catch (e) {}
    addEventListener("resize", scheduleApply, { passive: true });
    addEventListener("orientationchange", scheduleApply, { passive: true });
    addEventListener("click", () => setTimeout(applyMobileDeckStack, 40), true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

;(() => {
  const MOBILE_QUERY = "(max-width: 900px)";
  const ROOT_CLASS = "tcgMobileDeckStackHardFix";

  const textOf = (el) => String((el && (el.value || el.textContent)) || "").replace(/\s+/g, " ").trim();

  function isMobileLayout() {
    try {
      return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
    } catch (_) {
      return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "");
    }
  }

  function commonParent(a, b) {
    if (!a || !b) return null;
    let cur = a;
    while (cur) {
      if (cur.contains(b)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function closestPanel(el) {
    if (!el) return null;
    return el.closest("section,aside,.panel,.deckPanel,.cardPanel,[class*='Panel'],[class*='panel']") || el.closest("div");
  }

  function findPanelByLabel(label) {
    const nodes = Array.from(document.querySelectorAll("section,aside,.panel,.deckPanel,.cardPanel,[class*='Panel'],[class*='panel'],main > div"));
    return nodes.find((el) => textOf(el).includes(label)) || null;
  }

  function fixDetailTypo(root) {
    root.querySelectorAll("button,a,span,div").forEach((el) => {
      if (textOf(el) === "詳詳細") el.textContent = "詳細";
    });
  }

  function tagDeckActions(deckPanel) {
    const buttons = Array.from(deckPanel.querySelectorAll("button,a,[role='button']"));
    buttons.forEach((btn) => {
      const t = textOf(btn);
      if (/保存/.test(t) || /自分のデッキ/.test(t)) btn.classList.add("tcgMobileDeckActionPrimary");
      if (/みんなのデッキ|評価|開始/.test(t)) btn.classList.add("tcgMobileDeckActionHidden");
    });
  }

  function tagDeckRows(deckList) {
    Array.from(deckList.children).forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      row.classList.add("tcgMobileDeckRowFix");
      const controls = new Set();
      Array.from(row.querySelectorAll("button,a,[role='button']")).forEach((btn) => {
        const t = textOf(btn);
        if (t === "+" || t === "＋") {
          btn.classList.add("tcgMobileDeckRowPlus");
          controls.add(btn);
        } else if (t === "-" || t === "−" || t === "ー") {
          btn.classList.add("tcgMobileDeckRowMinus");
          controls.add(btn);
        } else if (/詳細|詳詳細/.test(t)) {
          btn.classList.add("tcgMobileDeckRowDetail");
          btn.textContent = "詳細";
          controls.add(btn);
        }
      });
      Array.from(row.querySelectorAll("input,span,div,button")).forEach((el) => {
        const v = textOf(el);
        if (/^\d+\s*\/\s*\d+$/.test(v)) {
          el.classList.add("tcgMobileDeckRowCount");
          controls.add(el);
        }
      });
      const main = Array.from(row.children).find((ch) => {
        if (!(ch instanceof HTMLElement)) return false;
        if (controls.has(ch)) return false;
        if (ch.matches("button,a,input")) return false;
        return textOf(ch).length > 0;
      }) || row.firstElementChild;
      if (main instanceof HTMLElement) main.classList.add("tcgMobileDeckRowMain");
    });
  }

  function applyMobileDeckFix() {
    if (!document.body) return;
    if (!isMobileLayout()) {
      document.body.classList.remove(ROOT_CLASS);
      return;
    }
    document.body.classList.add(ROOT_CLASS);

    const deckList = document.getElementById("deckList");
    const cardList = document.getElementById("cardList") || document.querySelector("#cardPool,.cardList,.cardsList,[data-card-list],[class*='cardList']");
    const deckPanel = closestPanel(deckList) || findPanelByLabel("デッキ");
    const cardPanel = closestPanel(cardList) || findPanelByLabel("カード一覧");

    if (cardPanel) cardPanel.classList.add("tcgMobileCardPanelHardFix");
    if (deckPanel) deckPanel.classList.add("tcgMobileDeckPanelHardFix");

    const root = commonParent(cardPanel, deckPanel) || (deckPanel && deckPanel.parentElement) || (cardPanel && cardPanel.parentElement);
    if (root) root.classList.add("tcgMobileDeckRootHardFix");

    if (deckList) {
      deckList.classList.add("tcgMobileDeckListHardFix");
      tagDeckRows(deckList);
    }
    if (deckPanel) tagDeckActions(deckPanel);
    fixDetailTypo(document.body);
  }

  let scheduled = false;
  function scheduleMobileDeckFix() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyMobileDeckFix();
    });
  }

  function startObserver() {
    if (!document.body) return;
    new MutationObserver(scheduleMobileDeckFix).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleMobileDeckFix);
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    scheduleMobileDeckFix();
    startObserver();
  }

  window.addEventListener("resize", scheduleMobileDeckFix, { passive: true });
  window.addEventListener("orientationchange", scheduleMobileDeckFix, { passive: true });

  let runs = 0;
  const timer = setInterval(() => {
    scheduleMobileDeckFix();
    runs += 1;
    if (runs > 16) clearInterval(timer);
  }, 350);
})();

/* v20260928_deck_mobile_stack4
   Last-resort mobile repair: force card list and deck panels into a vertical,
   independently scrollable layout. This intentionally only adds classes; it
   does not replace existing deck logic. */
(function () {
  "use strict";

  // Superseded by the stable v20260930 mobile deck implementation above.
  return;

  var VERSION = "20260928_deck_mobile_stack4";
  var scheduled = false;

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function textOf(el) {
    return (el && el.textContent ? el.textContent : "").replace(/\s+/g, " ").trim();
  }

  function compact(el) {
    return textOf(el).replace(/\s+/g, "");
  }

  function rect(el) {
    return el ? el.getBoundingClientRect() : { width: 0, height: 0, top: 0, left: 0 };
  }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = rect(el);
    if (r.width < 8 || r.height < 8) return false;
    var cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  }

  function isMobileDeck() {
    return (
      window.innerWidth <= 940 ||
      (window.matchMedia && matchMedia("(pointer: coarse)").matches) ||
      document.body.classList.contains("tcgMobileDeckActive")
    );
  }

  function add(el, cls) {
    if (el) el.classList.add(cls);
  }

  function remove(el, cls) {
    if (el) el.classList.remove(cls);
  }

  function commonAncestor(a, b) {
    if (!a || !b) return null;
    var seen = new Set();
    for (var x = a; x; x = x.parentElement) seen.add(x);
    for (var y = b; y; y = y.parentElement) {
      if (seen.has(y)) return y;
    }
    return null;
  }

  function findHeader(label) {
    var want = label.replace(/\s+/g, "");
    return qsa("h1,h2,h3,h4,header,div,span,section").filter(function (el) {
      if (!visible(el)) return false;
      var t = compact(el);
      var r = rect(el);
      if (r.height > 96 || r.width > Math.max(560, window.innerWidth * 0.9)) return false;
      if (want === "デッキ") return t === "デッキ" || t.indexOf("デッキ") === 0;
      return t.indexOf(want) >= 0;
    }).sort(function (a, b) {
      var ar = rect(a), br = rect(b);
      return ar.top - br.top || ar.left - br.left;
    })[0] || null;
  }

  function climbPanel(from, kind) {
    var node = from;
    var best = null;
    while (node && node !== document.body && node !== document.documentElement) {
      var r = rect(node);
      if (r.width >= Math.min(300, window.innerWidth - 30) && r.height >= 120) {
        best = node;
        var c = compact(node);
        if (kind === "card" && c.indexOf("カード一覧") >= 0 && c.indexOf("クリックで詳細") >= 0) break;
        if (kind === "deck" && c.indexOf("入れたカード") >= 0) break;
      }
      node = node.parentElement;
    }
    return best || from;
  }

  function findPanels() {
    var cardPanel = document.querySelector(".tcgDbCardPanel");
    var deckPanel = document.querySelector(".tcgDbDeckPanel");
    if (!cardPanel) cardPanel = climbPanel(findHeader("カード一覧"), "card");
    if (!deckPanel) {
      var deckHeads = qsa("h1,h2,h3,h4,header,div,span").filter(function (el) {
        if (!visible(el)) return false;
        var t = compact(el);
        var r = rect(el);
        return (t === "デッキ" || t.indexOf("デッキ") === 0) && r.height <= 96 && r.top > 40;
      }).sort(function (a, b) {
        return rect(a).top - rect(b).top;
      });
      deckPanel = climbPanel(deckHeads[0], "deck");
    }
    if (cardPanel && deckPanel && cardPanel === deckPanel) {
      deckPanel = document.querySelector(".tcgDbDeckPanel");
    }
    return { cardPanel: cardPanel, deckPanel: deckPanel };
  }

  function isPlusText(t) {
    t = (t || "").trim();
    return t === "+" || t === "＋" || t === "追加";
  }

  function isMinusText(t) {
    t = (t || "").trim();
    return t === "-" || t === "−" || t === "－" || t === "ー";
  }

  function isCountText(t) {
    return /^\d+\s*\/\s*\d+$/.test((t || "").trim());
  }

  function classifyControls(root) {
    qsa("button,a,[role='button'],input,select", root).forEach(function (el) {
      remove(el, "tcgDbRowPlus");
      remove(el, "tcgDbRowMinus");
      remove(el, "tcgDbRowCount");
      remove(el, "tcgDbRowDetail");
      remove(el, "tcgDbDeckActionBtn");
      remove(el, "tcgDbPublicDeckBtn");

      var t = textOf(el) || (el.value || "");
      if (isPlusText(t)) add(el, "tcgDbRowPlus");
      else if (isMinusText(t)) add(el, "tcgDbRowMinus");
      else if (isCountText(t)) add(el, "tcgDbRowCount");
      else if (t.indexOf("詳詳細") >= 0 || t.indexOf("詳細") >= 0) {
        el.textContent = "詳細";
        add(el, "tcgDbRowDetail");
      }
      if (t.indexOf("保存") >= 0 || t.indexOf("自分のデッキ") >= 0) add(el, "tcgDbDeckActionBtn");
      if (t.indexOf("みんなのデッキ") >= 0 || t.indexOf("公開デッキ") >= 0) add(el, "tcgDbPublicDeckBtn");
    });
  }

  function uniqueRows(candidates) {
    var picked = [];
    candidates.sort(function (a, b) {
      var ar = rect(a), br = rect(b);
      return ar.top - br.top || ar.left - br.left;
    }).forEach(function (el) {
      if (picked.some(function (p) { return p.contains(el) || el.contains(p); })) return;
      picked.push(el);
    });
    return picked;
  }

  function markRows(panel, isDeck) {
    if (!panel) return [];
    qsa(".tcgDbRow,.tcgDbCardRow,.tcgDbDeckRow", panel).forEach(function (el) {
      remove(el, "tcgDbRow");
      remove(el, "tcgDbCardRow");
      remove(el, "tcgDbDeckRow");
    });
    var candidates = qsa("li,article,.card-row,.deck-row,.card,.item,div", panel).filter(function (el) {
      if (!visible(el) || el === panel) return false;
      var r = rect(el);
      if (r.height < 42 || r.height > 170 || r.width < 160) return false;
      if (qsa(".tcgDbRowPlus,.tcgDbRowMinus,.tcgDbRowCount,.tcgDbRowDetail", el).length) return true;
      var t = compact(el);
      return /[\[【]\d+[\]】]/.test(t) && (t.indexOf("HP") >= 0 || t.indexOf("効果") >= 0 || t.indexOf("unit") >= 0 || t.indexOf("サポ") >= 0);
    });
    var rows = uniqueRows(candidates);
    rows.forEach(function (row) {
      add(row, "tcgDbRow");
      add(row, isDeck ? "tcgDbDeckRow" : "tcgDbCardRow");
      var controls = qsa(".tcgDbRowPlus,.tcgDbRowMinus,.tcgDbRowCount,.tcgDbRowDetail", row);
      var main = Array.prototype.find.call(row.children, function (child) {
        return !controls.some(function (c) { return child === c || child.contains(c); });
      }) || row;
      add(main, "tcgDbRowMain");
    });
    return rows;
  }

  function bestRowParent(rows, fallback) {
    if (!rows.length) return fallback;
    var p = rows[0].parentElement;
    while (p && p !== fallback && p !== document.body) {
      var count = rows.filter(function (row) { return p.contains(row); }).length;
      if (count >= Math.max(2, Math.floor(rows.length * 0.75))) return p;
      p = p.parentElement;
    }
    return rows[0].parentElement || fallback;
  }

  function markScroll(panel, rows, cls) {
    if (!panel) return;
    qsa("." + cls, panel).forEach(function (el) { remove(el, cls); });
    add(bestRowParent(rows, panel), cls);
  }

  function markDeckActions(deckPanel) {
    if (!deckPanel) return;
    qsa(".tcgDbDeckActions", deckPanel).forEach(function (el) { remove(el, "tcgDbDeckActions"); });
    var btns = qsa(".tcgDbDeckActionBtn", deckPanel).filter(visible);
    if (!btns.length) return;
    var parent = btns[0].parentElement;
    if (btns[1]) parent = commonAncestor(btns[0], btns[1]) || parent;
    add(parent, "tcgDbDeckActions");
  }

  function markDeckTitle(deckPanel) {
    if (!deckPanel) return;
    qsa(".tcgDbDeckTitle", deckPanel).forEach(function (el) { remove(el, "tcgDbDeckTitle"); });
    var title = qsa("h1,h2,h3,h4,span,div", deckPanel).filter(function (el) {
      return visible(el) && (compact(el) === "デッキ" || compact(el).indexOf("デッキ") === 0) && rect(el).height < 80;
    })[0];
    add(title, "tcgDbDeckTitle");
  }

  function apply() {
    if (!document.body || !isMobileDeck()) return;
    document.body.classList.add("tcgDeckBlockFinal", "tcgMobileDeckActive", "tcgMobileDeckStack4");
    document.body.dataset.deckMobilePatch = VERSION;

    classifyControls(document.body);
    var panels = findPanels();
    var cardPanel = panels.cardPanel;
    var deckPanel = panels.deckPanel;
    if (!cardPanel || !deckPanel || cardPanel === deckPanel) return;

    add(cardPanel, "tcgDbCardPanel");
    add(deckPanel, "tcgDbDeckPanel");
    var root = commonAncestor(cardPanel, deckPanel);
    if (root && root !== document.body && root !== document.documentElement) add(root, "tcgDbStackRoot");
    add(cardPanel.parentElement, "tcgDbStackCardItem");
    add(deckPanel.parentElement, "tcgDbStackDeckItem");

    var cardRows = markRows(cardPanel, false);
    var deckRows = markRows(deckPanel, true);
    markScroll(cardPanel, cardRows, "tcgDbCardScroll");
    markScroll(deckPanel, deckRows, "tcgDbDeckContent");
    markDeckActions(deckPanel);
    markDeckTitle(deckPanel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  function injectFinalStackCss() {
    if (document.getElementById("tcg-mobile-deck-stack-final-style")) return;
    var style = document.createElement("style");
    style.id = "tcg-mobile-deck-stack-final-style";
    style.textContent = `
@media (max-width: 900px), (pointer: coarse) and (max-width: 980px) {
  body.tcgDeckBlockFinal.tcgMobileDeckActive {
    overflow-x: hidden !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .mobileDeckStackHost,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbStackRoot,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbMobileStack,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .builder-grid,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .deck-layout,
  body.tcgDeckBlockFinal.tcgMobileDeckActive main {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 12px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    grid-template-columns: 1fr !important;
    grid-template-areas: none !important;
    overflow: visible !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbStackCardItem,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardPanel {
    order: 10 !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbStackDeckItem,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckPanel {
    order: 20 !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardPanel,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckPanel {
    position: relative !important;
    inset: auto !important;
    left: auto !important;
    right: auto !important;
    top: auto !important;
    bottom: auto !important;
    transform: none !important;
    float: none !important;
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
    min-width: 0 !important;
    margin: 0 auto !important;
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
    overflow: hidden !important;
    contain: none !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardPanel {
    min-height: 118px !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckPanel {
    min-height: 520px !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardPanel .tcgDbCardScroll,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardPanel #cardList,
  body.tcgDeckBlockFinal.tcgMobileDeckActive #cardList.tcgDbCardScroll {
    display: block !important;
    max-height: 58vh !important;
    min-height: 260px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckPanel .tcgDbDeckContent,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckPanel #deckList,
  body.tcgDeckBlockFinal.tcgMobileDeckActive #deckList.tcgDbDeckContent {
    display: block !important;
    max-height: 56vh !important;
    min-height: 300px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    padding: 8px 8px 112px !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckPanel * {
    writing-mode: horizontal-tb !important;
    text-orientation: mixed !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckTitle {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    height: auto !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    text-align: left !important;
    text-indent: 0 !important;
    transform: none !important;
    position: static !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckActions,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .deckPanelActions {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 8px !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: visible !important;
    white-space: nowrap !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckActions > *,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .deckPanelActions > * {
    width: 100% !important;
    min-width: 0 !important;
    height: 46px !important;
    padding: 0 10px !important;
    font-size: 15px !important;
    white-space: nowrap !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbPublicDeckBtn,
  body.tcgDeckBlockFinal.tcgMobileDeckActive [data-deck-action="public"],
  body.tcgDeckBlockFinal.tcgMobileDeckActive .deckPanelActions > *:nth-child(n+3),
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckActions > *:nth-child(n+3) {
    display: none !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardRow,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckRow {
    position: relative !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    margin: 8px 0 !important;
    transform: none !important;
    overflow: hidden !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbDeckRow {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 62px 44px 56px 44px !important;
    grid-template-areas: "main detail plus count minus" !important;
    align-items: center !important;
    gap: 6px !important;
    min-height: 64px !important;
    padding: 8px !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardRow {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 44px 58px 44px !important;
    grid-template-areas:
      "main minus count plus"
      "detail detail detail detail" !important;
    align-items: center !important;
    gap: 6px !important;
    min-height: 96px !important;
    padding: 8px !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowMain {
    grid-area: main !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowDetail {
    grid-area: detail !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowPlus {
    grid-area: plus !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowMinus {
    grid-area: minus !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowCount {
    grid-area: count !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowPlus,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowMinus,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowCount,
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbRowDetail {
    position: static !important;
    inset: auto !important;
    transform: none !important;
    min-width: 0 !important;
    width: 100% !important;
    height: 38px !important;
    white-space: nowrap !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  body.tcgDeckBlockFinal.tcgMobileDeckActive .tcgDbCardRow .tcgDbRowDetail {
    height: 40px !important;
  }
}
`;
    document.head.appendChild(style);
  }

  function boot() {
    injectFinalStackCss();
    apply();
    [120, 350, 800, 1600, 3000, 5200].forEach(function (ms) { setTimeout(apply, ms); });
    try {
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) {}
    addEventListener("resize", schedule, { passive: true });
    addEventListener("orientationchange", schedule, { passive: true });
    addEventListener("click", function () { setTimeout(apply, 40); }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
