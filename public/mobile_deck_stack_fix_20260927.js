(function () {
  "use strict";

  const BODY_CLASS = "tcgMobileDeckStackFinal";
  const CARD_PANEL_CLASS = "tcgFinalCardPanel";
  const DECK_PANEL_CLASS = "tcgFinalDeckPanel";
  const STACK_SHELL_CLASS = "tcgFinalStackShell";
  const STACK_OUTER_CLASS = "tcgFinalStackOuter";
  const CARD_SCROLL_CLASS = "tcgFinalCardScroll";
  const DECK_SCROLL_CLASS = "tcgFinalDeckScroll";
  const DECK_HEADER_CLASS = "tcgFinalDeckHeader";
  const DECK_TITLE_CLASS = "tcgFinalDeckTitle";
  const DECK_ACTIONS_CLASS = "tcgFinalDeckActions";
  const DECK_ACTION_BTN_CLASS = "tcgFinalDeckActionBtn";
  const DECK_CONTENT_CLASS = "tcgFinalDeckContent";
  const DECK_EMPTY_CLASS = "tcgFinalDeckEmpty";
  const ROW_CLASS = "tcgFinalRow";
  const MAIN_CLASS = "tcgFinalMain";
  const PLUS_CLASS = "tcgFinalPlus";
  const MINUS_CLASS = "tcgFinalMinus";
  const DETAIL_CLASS = "tcgFinalDetail";
  const COUNT_CLASS = "tcgFinalCount";
  const HIDE_CLASS = "tcgFinalHide";
  const DETAIL_LABEL = "\u8a73\u7d30";
  const DECK_LABEL = "\u30c7\u30c3\u30ad";
  const CARD_LIST_LABEL = "\u30ab\u30fc\u30c9\u4e00\u89a7";
  const PUBLIC_DECK_RE = /(?:\u307f\u3093\u306a\u306e\u30c7\u30c3\u30ad|\u516c\u958b\u30c7\u30c3\u30ad|public\s*deck)/i;
  const DETAIL_RE = /(?:\u8a73+\u7d30+|\u8a73\u8a73\u7d30|\u8a73\u7d30\u8a73\u7d30|detail)/i;
  const COUNT_RE = /^\d+\s*\/\s*\d+$/;
  const SAVE_DECK_RE = /(?:\u4fdd\u5b58|\u30c7\u30c3\u30ad\u4fdd\u5b58|save)/i;
  const MY_DECK_RE = /(?:\u81ea\u5206\u306e\u30c7\u30c3\u30ad|my\s*deck)/i;
  let scheduled = false;
  let observing = false;

  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const visibleText = (el) =>
    clean(el && ("value" in el && el.value ? el.value : el.textContent || el.getAttribute?.("aria-label") || el.getAttribute?.("title")));

  const isHidden = (el) =>
    !el ||
    el.hidden ||
    el.classList.contains(HIDE_CLASS) ||
    el.getAttribute?.("aria-hidden") === "true" ||
    getComputedStyle(el).display === "none";

  function getParam(name) {
    try {
      return new URLSearchParams(location.search).get(name) || "";
    } catch (_) {
      return "";
    }
  }

  function deviceOverride() {
    try {
      return String(
        localStorage.getItem("tcgDeviceModeOverrideV2") ||
          localStorage.getItem("tcgDeviceModeOverride") ||
          localStorage.getItem("tcgDeviceMode") ||
          ""
      ).toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function isMobileLike() {
    const override = deviceOverride();
    if (/^(pc|desktop|wide|fixed)$/.test(override)) return false;
    if (/^(mobile|smart|phone|sp)$/.test(override)) return true;

    const mobileParam = String(getParam("mobile")).toLowerCase();
    const viewParam = String(getParam("view")).toLowerCase();
    if (/^(1|true|mobile|sp)$/.test(mobileParam)) return true;
    if (/^(mobile|sp|smart)$/.test(viewParam)) return true;

    try {
      if (
        window.TCG_DEVICE_MODE &&
        typeof window.TCG_DEVICE_MODE.isMobile === "function" &&
        window.TCG_DEVICE_MODE.isMobile()
      ) {
        return true;
      }
    } catch (_) {}

    if (!window.matchMedia) return window.innerWidth <= 900;
    return (
      window.matchMedia("(max-width: 900px)").matches ||
      (window.matchMedia("(pointer: coarse)").matches && window.innerWidth <= 1180)
    );
  }

  function queryAny(selectors, root) {
    for (const selector of selectors) {
      try {
        const found = (root || document).querySelector(selector);
        if (found) return found;
      } catch (_) {}
    }
    return null;
  }

  function textIncludes(el, needle) {
    return clean(el && el.textContent).includes(needle);
  }

  function findByText(needle, root) {
    const scope = root || document.body || document;
    const nodes = scope.querySelectorAll("h1,h2,h3,h4,.title,.panelTitle,.hd,.panelHd,section,div,aside");
    for (const node of nodes) {
      if (textIncludes(node, needle)) return node;
    }
    return null;
  }

  function commonAncestor(a, b) {
    const seen = new Set();
    for (let node = a; node; node = node.parentElement) seen.add(node);
    for (let node = b; node; node = node.parentElement) {
      if (seen.has(node)) return node;
    }
    return null;
  }

  function bestPanel(anchor, otherAnchor, kind) {
    if (!anchor) return null;
    const selector =
      kind === "deck"
        ? "#deckPanel,.deckPanel,.deckArea,.deckBox,.deckZone,.deckSection,.selectedDeck,.panel,.section,[data-deck-panel]"
        : "#cardPanel,.libraryPanel,.cardLibrary,.cardsPanel,.cardPanel,.cardSection,.panel,.section,[data-card-panel]";

    const direct = anchor.closest(selector);
    if (direct && (!otherAnchor || !direct.contains(otherAnchor))) return direct;

    const shared = otherAnchor ? commonAncestor(anchor, otherAnchor) : null;
    let node = anchor.parentElement;
    let best = anchor.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (shared && node.parentElement === shared) return node;
      if (otherAnchor && node.contains(otherAnchor)) break;
      const rect = node.getBoundingClientRect();
      if (rect.width > 180 && rect.height > 70) best = node;
      node = node.parentElement;
    }
    return best;
  }

  function findPanels() {
    const cardAnchor =
      queryAny(["#cardList", "#cardSections", ".cardList", ".cardGrid", ".cards", "[data-card-list]"]) ||
      findByText(CARD_LIST_LABEL);
    const deckAnchor =
      queryAny(["#deckList", ".deckList", ".selectedCards", "[data-deck-list]", "[data-selected-cards]"]) ||
      findByText(DECK_LABEL);

    let cardPanel = bestPanel(cardAnchor, deckAnchor, "card");
    let deckPanel = bestPanel(deckAnchor, cardAnchor, "deck");

    if (cardPanel && deckPanel && cardPanel === deckPanel) {
      const children = Array.from(cardPanel.children);
      const cardChild = children.find((child) => child.contains(cardAnchor));
      const deckChild = children.find((child) => child.contains(deckAnchor) && child !== cardChild);
      if (cardChild) cardPanel = cardChild;
      if (deckChild) deckPanel = deckChild;
    }

    if (!cardPanel && cardAnchor) cardPanel = cardAnchor;
    if (!deckPanel && deckAnchor) deckPanel = deckAnchor;
    return { cardPanel, deckPanel };
  }

  function normalizeText(root) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const before = node.nodeValue || "";
      const after = before
        .replace(/\u8a73\u8a73\u7d30|\u8a73\u7d30\u8a73\u7d30|\u8a73\u8a73/g, DETAIL_LABEL)
        .replace(/詳詳細|詳細詳細|詳詳/g, DETAIL_LABEL);
      if (after !== before) node.nodeValue = after;
    });

    root.querySelectorAll("button,input,textarea").forEach((el) => {
      if ("value" in el && el.value && DETAIL_RE.test(el.value)) el.value = DETAIL_LABEL;
      if (el.placeholder && DETAIL_RE.test(el.placeholder)) el.placeholder = DETAIL_LABEL;
      const text = clean(el.textContent);
      if ((el.tagName === "BUTTON" || el.getAttribute("role") === "button") && DETAIL_RE.test(text)) {
        el.textContent = DETAIL_LABEL;
      }
    });
  }

  function clearRoles(root) {
    if (!root) return;
    root
      .querySelectorAll(
        `.${PLUS_CLASS},.${MINUS_CLASS},.${DETAIL_CLASS},.${COUNT_CLASS},.${ROW_CLASS},.${MAIN_CLASS}`
      )
      .forEach((el) => {
        el.classList.remove(PLUS_CLASS, MINUS_CLASS, DETAIL_CLASS, COUNT_CLASS, ROW_CLASS, MAIN_CLASS);
      });
  }

  function likelyRows(root) {
    if (!root) return [];
    const rows = new Set(
      root.querySelectorAll(
        ".cardRow,.deckRow,.cardItem,.deckItem,.card,.deck-card,.deckCard,.listItem,[data-card-id],[data-deck-card-id]"
      )
    );

    Array.from(root.children || []).forEach((child) => {
      const text = clean(child.textContent);
      if (child.children.length && text.length > 6) {
        const rect = child.getBoundingClientRect();
        if (rect.height > 20 || child.querySelector("button,[role='button']")) rows.add(child);
      }
    });

    return Array.from(rows).filter((row) => row instanceof HTMLElement);
  }

  function classifyRows(root) {
    if (!root) return;
    clearRoles(root);

    likelyRows(root).forEach((row) => {
      row.classList.add(ROW_CLASS);
      const controls = Array.from(row.querySelectorAll("button,a,[role='button'],input,.count,.cnt,span,div"));

      controls.forEach((el) => {
        const text = clean(el.textContent || el.value || "");
        const aria = clean(el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title")));
        const key = `${text} ${aria}`;
        if (el.matches("[data-plus]") || text === "+" || text === "\uff0b" || /add|plus|\u8ffd\u52a0/.test(key)) {
          el.classList.add(PLUS_CLASS);
        }
        if (
          el.matches("[data-minus]") ||
          text === "-" ||
          text === "\u2212" ||
          text === "\u30fc" ||
          /remove|minus|\u524a\u9664/.test(key)
        ) {
          el.classList.add(MINUS_CLASS);
        }
        if (el.matches("[data-detail]") || DETAIL_RE.test(key)) {
          el.classList.add(DETAIL_CLASS);
          if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") el.textContent = DETAIL_LABEL;
        }
        if (COUNT_RE.test(text)) el.classList.add(COUNT_CLASS);
      });

      const main =
        Array.from(row.children).find(
          (child) =>
            !child.classList.contains("btns") &&
            !child.classList.contains(PLUS_CLASS) &&
            !child.classList.contains(MINUS_CLASS) &&
            !child.classList.contains(DETAIL_CLASS) &&
            !child.classList.contains(COUNT_CLASS) &&
            clean(child.textContent).length > 3
        ) || row.firstElementChild;
      if (main) main.classList.add(MAIN_CLASS);
    });
  }

  function markScrolls(cardPanel, deckPanel) {
    [cardPanel, deckPanel].forEach((panel) => {
      if (!panel) return;
      panel.querySelectorAll(`.${CARD_SCROLL_CLASS},.${DECK_SCROLL_CLASS}`).forEach((el) => {
        el.classList.remove(CARD_SCROLL_CLASS, DECK_SCROLL_CLASS);
      });
    });

    const cardScroll =
      queryAny(["#cardList", "#cardSections", ".cardList", ".cardGrid", ".cards", "[data-card-list]"], cardPanel) ||
      cardPanel;
    const deckScroll =
      queryAny(["#deckList", ".deckList", ".selectedCards", "[data-deck-list]", "[data-selected-cards]"], deckPanel) ||
      deckPanel;

    if (cardScroll) cardScroll.classList.add(CARD_SCROLL_CLASS);
    if (deckScroll) deckScroll.classList.add(DECK_SCROLL_CLASS);
  }

  function hidePublicDeckButtons(deckPanel) {
    if (!deckPanel) return;
    deckPanel.querySelectorAll(`.${HIDE_CLASS}`).forEach((el) => el.classList.remove(HIDE_CLASS));

    deckPanel.querySelectorAll("[data-deck-panel-action]").forEach((el) => {
      const action = String(el.getAttribute("data-deck-panel-action") || "").toLowerCase();
      if (action === "public") el.classList.add(HIDE_CLASS);
    });

    deckPanel.querySelectorAll("button,a,[role='button']").forEach((el) => {
      const text = clean(el.textContent);
      if (PUBLIC_DECK_RE.test(text)) el.classList.add(HIDE_CLASS);
    });
  }

  function clearDeckLayout(deckPanel) {
    if (!deckPanel) return;
    deckPanel
      .querySelectorAll(
        `.${DECK_HEADER_CLASS},.${DECK_TITLE_CLASS},.${DECK_ACTIONS_CLASS},.${DECK_ACTION_BTN_CLASS},.${DECK_CONTENT_CLASS},.${DECK_EMPTY_CLASS}`
      )
      .forEach((el) => {
        el.classList.remove(
          DECK_HEADER_CLASS,
          DECK_TITLE_CLASS,
          DECK_ACTIONS_CLASS,
          DECK_ACTION_BTN_CLASS,
          DECK_CONTENT_CLASS,
          DECK_EMPTY_CLASS
        );
      });
  }

  function commonAncestorFrom(nodes) {
    const live = nodes.filter(Boolean);
    if (!live.length) return null;
    let node = live[0];
    while (node && node !== document.body) {
      if (live.every((el) => node.contains(el))) return node;
      node = node.parentElement;
    }
    return live[0].parentElement || live[0];
  }

  function findButton(root, pattern) {
    return (
      Array.from(root.querySelectorAll("button,a,[role='button'],input[type='button'],input[type='submit']"))
        .filter((el) => !isHidden(el))
        .find((el) => pattern.test(visibleText(el))) || null
    );
  }

  function markDeckTitle(deckPanel) {
    const candidates = Array.from(deckPanel.querySelectorAll("h1,h2,h3,h4,header,section,div,span,p")).filter(
      (el) => !isHidden(el)
    );
    const title =
      candidates.find((el) => clean(el.textContent) === DECK_LABEL) ||
      candidates.find((el) => {
        const text = clean(el.textContent);
        return text.startsWith(DECK_LABEL) && text.length <= 16 && el.getBoundingClientRect().height < 90;
      });
    if (!title) return;
    title.classList.add(DECK_TITLE_CLASS);
    const header =
      title.closest("header") ||
      title.parentElement ||
      Array.from(deckPanel.children).find((child) => child.contains(title));
    if (header && header !== deckPanel) header.classList.add(DECK_HEADER_CLASS);
  }

  function markDeckActions(deckPanel) {
    const save = findButton(deckPanel, SAVE_DECK_RE);
    const mine = findButton(deckPanel, MY_DECK_RE);
    [save, mine].forEach((btn) => btn && btn.classList.add(DECK_ACTION_BTN_CLASS));
    const group = commonAncestorFrom([save, mine]);
    if (group && group !== deckPanel) group.classList.add(DECK_ACTIONS_CLASS);
  }

  function isDeckContentNoise(row) {
    const text = clean(row.textContent);
    if (!text) return true;
    if (/^(?:\u30c7\u30c3\u30ad|\u4fdd\u5b58|\u81ea\u5206\u306e\u30c7\u30c3\u30ad|\u307f\u3093\u306a\u306e\u30c7\u30c3\u30ad|\u8a55\u4fa1|\u5168\u6d88\u3057|READY|\u63a1\u7528\u30ab\u30fc\u30c9|\u5165\u308c\u305f\u30ab\u30fc\u30c9|\u72b6\u614b|\u30ab\u30fc\u30c9)$/i.test(text)) {
      return true;
    }
    if (SAVE_DECK_RE.test(text) || MY_DECK_RE.test(text) || PUBLIC_DECK_RE.test(text)) return true;
    if (/^(?:\u304a\u307e\u304b\u305b|\u30b3\u30b9\u30c8|\u7a2e\u5225|\u5c5e\u6027|\u679a\u6570|\u4e26\u3073)$/.test(text)) return true;
    return false;
  }

  function findDeckContent(deckPanel) {
    const direct =
      queryAny(["#deckList", ".deckList", ".selectedCards", "#selectedCards", ".deckCards", "[data-deck-list]", "[data-selected-cards]"], deckPanel) ||
      null;
    if (direct && direct !== deckPanel) return direct;

    const rows = likelyRows(deckPanel).filter((row) => !isDeckContentNoise(row));
    if (!rows.length) {
      return (
        Array.from(deckPanel.querySelectorAll("div,section,ul,ol")).find((el) =>
          /(?:\u307e\u3060\u30ab\u30fc\u30c9|\u5de6\u306e\u30ab\u30fc\u30c9|\u5165\u3063\u3066\u3044\u307e\u305b\u3093)/.test(clean(el.textContent))
        ) || null
      );
    }

    const scored = new Map();
    rows.forEach((row) => {
      let node = row.parentElement;
      while (node && node !== deckPanel && node !== document.body) {
        const score = (scored.get(node) || 0) + 1;
        scored.set(node, score);
        node = node.parentElement;
      }
    });
    return (
      Array.from(scored.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([node]) => node)
        .find((node) => node && node !== deckPanel) || rows[0].parentElement
    );
  }

  function markDeckContent(deckPanel) {
    const content = findDeckContent(deckPanel);
    if (!content) return;
    content.classList.remove(HIDE_CLASS);
    content.classList.add(DECK_CONTENT_CLASS, DECK_SCROLL_CLASS);
    classifyRows(content);

    content.querySelectorAll("*").forEach((el) => {
      if (/(?:\u307e\u3060\u30ab\u30fc\u30c9|\u5de6\u306e\u30ab\u30fc\u30c9|\u5165\u3063\u3066\u3044\u307e\u305b\u3093)/.test(clean(el.textContent))) {
        el.classList.add(DECK_EMPTY_CLASS);
      }
    });
  }

  function markDeckLayout(deckPanel) {
    clearDeckLayout(deckPanel);
    markDeckTitle(deckPanel);
    markDeckActions(deckPanel);
    markDeckContent(deckPanel);
  }

  function apply() {
    const active = isMobileLike();
    document.documentElement.classList.toggle(BODY_CLASS, active);
    if (document.body) document.body.classList.toggle(BODY_CLASS, active);
    if (!active || !document.body) return;

    const { cardPanel, deckPanel } = findPanels();
    if (!cardPanel || !deckPanel) return;

    document.body.classList.add(STACK_OUTER_CLASS);
    cardPanel.classList.add(CARD_PANEL_CLASS);
    deckPanel.classList.add(DECK_PANEL_CLASS);

    const shell = commonAncestor(cardPanel, deckPanel);
    if (shell && shell !== document.documentElement) shell.classList.add(STACK_SHELL_CLASS);

    normalizeText(document.body);
    markScrolls(cardPanel, deckPanel);
    classifyRows(cardPanel);
    classifyRows(deckPanel);
    hidePublicDeckButtons(deckPanel);
    markDeckLayout(deckPanel);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function observe() {
    if (observing || !document.body) return;
    observing = true;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      apply();
      observe();
    });
  } else {
    apply();
    observe();
  }

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(schedule, 80), { passive: true });
  window.addEventListener("storage", schedule, { passive: true });
  window.tcgApplyMobileDeckStackFix = schedule;
})();
