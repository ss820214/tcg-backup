// public/ui_stability_20260825.js
// Defensive UI layer: diagnostics links, deck filters, mobile cleanup, scroll preservation.

(function () {
  "use strict";

  const VERSION = "20260826_deckspace1";
  const ATTRS = ["\u706b", "\u6c34", "\u96f7", "\u8349", "\u98a8", "\u92fc", "\u5149", "\u95c7", "\u5e7b"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function textOf(node) {
    return String(node?.textContent || "");
  }

  function isSupportText(text) {
    const value = String(text || "");
    return /support/i.test(value) ||
      value.includes("\u30b5\u30dd\u30fc\u30c8") ||
      value.includes("\u52b9\u679c") ||
      value.includes("\u56de\u5fa9") ||
      value.includes("\u30c9\u30ed\u30fc") ||
      value.includes("\u72b6\u614b\u7570\u5e38") ||
      value.includes("\u30d0\u30a6\u30f3\u30b9") ||
      value.includes("\u4f4d\u7f6e\u5165\u66ff");
  }

  function classifyRow(row) {
    if (!row) return "unit";
    const ds = String(row.dataset.kind || row.dataset.cardKind || "").toLowerCase();
    if (ds.includes("support")) return "support";
    if (ds.includes("unit")) return "unit";

    const text = textOf(row);
    const looksUnit = /unit\s*\/\s*HP/i.test(text) || text.includes("\u30e6\u30cb\u30c3\u30c8");
    const kind = isSupportText(text) && !looksUnit ? "support" : "unit";
    row.dataset.kind = kind;
    return kind;
  }

  function attrFromRow(row) {
    const ds = row?.dataset?.type || row?.dataset?.attr || row?.dataset?.cardAttr || "";
    if (ATTRS.includes(ds)) return ds;
    const text = textOf(row);
    return ATTRS.find((attr) => text.includes(attr)) || "";
  }

  function getActiveKind() {
    const active = $("[data-kind-filter].active,[data-kind-filter].isActive");
    return String(active?.dataset.kindFilter || document.body.dataset.kindFilter || "all").toLowerCase();
  }

  function getActiveOwned() {
    const active = $("[data-owned-filter].active,[data-owned-filter].isActive");
    return String(active?.dataset.ownedFilter || document.body.dataset.ownedFilter || "all").toLowerCase();
  }

  function getActiveAttr() {
    const active = $("[data-attr-filter].active,[data-attr-filter].isActive");
    const fromBtn = active?.dataset.attrFilter;
    const fromSelect = $("#typeSelect")?.value;
    return String(fromBtn || fromSelect || "ALL");
  }

  function enforceDeckFilters() {
    const list = $("#cardList");
    if (!list) return;
    const kind = getActiveKind();
    const owned = getActiveOwned();
    const attr = getActiveAttr();

    for (const row of $$(".cardRow", list)) {
      const rowKind = classifyRow(row);
      const rowAttr = attrFromRow(row);
      const isOwned = !row.classList.contains("notOwned");
      const ownedOk = owned === "all" || (owned === "owned" ? isOwned : !isOwned);
      const kindOk = kind === "all" || (kind === "support" ? rowKind === "support" : rowKind === "unit");
      const attrOk = attr === "ALL" || !attr || rowAttr === attr;
      row.classList.toggle("uiFilteredOut", !(ownedOk && kindOk && attrOk));
    }
  }

  function installFilterSelfHeal() {
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-kind-filter],[data-owned-filter],[data-attr-filter]");
      if (!btn) return;
      setTimeout(enforceDeckFilters, 0);
      setTimeout(enforceDeckFilters, 80);
    }, true);
    $("#search")?.addEventListener("input", () => setTimeout(enforceDeckFilters, 80));
    new MutationObserver(() => requestAnimationFrame(enforceDeckFilters))
      .observe(document.body, { childList: true, subtree: true });
    requestAnimationFrame(enforceDeckFilters);
  }

  let savedScroll = null;

  function captureScroll() {
    savedScroll = ["#cardList", "#deckList", "#deckMainPanel", "#deckPanel", "main", "body", "html"].map((sel) => {
      const el = sel === "body" ? document.body : sel === "html" ? document.documentElement : $(sel);
      return el ? [sel, el.scrollTop, el.scrollLeft] : null;
    }).filter(Boolean);
  }

  function restoreScroll() {
    if (!savedScroll) return;
    for (const [sel, top, left] of savedScroll) {
      const el = sel === "body" ? document.body : sel === "html" ? document.documentElement : $(sel);
      if (!el) continue;
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  }

  function installScrollPreserver() {
    document.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest("#cardList button,#deckList button,.cardCtrl button,.btns button")) captureScroll();
    }, true);
    document.addEventListener("click", (ev) => {
      if (!ev.target.closest("#cardList button,#deckList button,.cardCtrl button,.btns button")) return;
      requestAnimationFrame(restoreScroll);
      setTimeout(restoreScroll, 60);
      setTimeout(restoreScroll, 180);
    }, true);
  }

  function installMobileNavFallback() {
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-mobile-jump]");
      if (!btn) return;
      const key = btn.dataset.mobileJump;
      const target =
        key === "cards" ? $("#mobileCardSection") || $("#cardList") :
        key === "deck" ? $("#deckPanel") || $("#deckList") :
        key === "save" ? $("#deckSaveDock") || $("#deckPanel") :
        document.body;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function installUtilityLinks() {
    if ($(".tcgUtilityLinks")) return;
    const target = $(".topRight") || $("header") || document.body;
    if (!target) return;
    const box = document.createElement("span");
    box.className = "tcgUtilityLinks";
    box.innerHTML = `
      <a href="./ui_health.html?v=${VERSION}" title="UI\u8a3a\u65ad">UI\u8a3a\u65ad</a>
      <a href="./card_audit.html?v=${VERSION}" title="\u30ab\u30fc\u30c9\u76e3\u67fb">\u30ab\u30fc\u30c9\u76e3\u67fb</a>
    `;
    target.appendChild(box);
  }

  function installDeckMetrics() {
    const panel = $("#deckPanel .bd") || $("#deckPanel");
    if (!panel || $(".deckMetricStrip")) return;
    const strip = document.createElement("div");
    strip.className = "deckMetricStrip";
    strip.innerHTML = `
      <div class="deckMetric"><span>\u72b6\u614b</span><b id="uiDeckReadyMetric">\u7de8\u6210\u4e2d</b></div>
      <div class="deckMetric"><span>\u30ab\u30fc\u30c9</span><b id="uiDeckCountMetric">0/30</b></div>
      <div class="deckMetric"><span>\u30ad\u30e3\u30e9</span><b id="uiDeckUnitMetric">-</b></div>
      <div class="deckMetric"><span>\u30b5\u30dd</span><b id="uiDeckSupportMetric">-</b></div>
    `;
    const anchor = $("#deckList")?.parentElement || panel.firstElementChild;
    anchor?.parentElement?.insertBefore(strip, anchor);
    updateDeckMetrics();
  }

  function updateDeckMetrics() {
    const countText = $("#deckCount")?.textContent?.trim() || "0";
    const rows = $$("#deckList .cardRow");
    const unit = rows.filter((row) => classifyRow(row) === "unit").length;
    const support = rows.filter((row) => classifyRow(row) === "support").length;
    const countNum = Number(countText.replace(/[^\d]/g, "")) || rows.length || 0;
    const ready = countNum === 30 ? "READY" : "\u7de8\u6210\u4e2d";
    const set = (id, value) => {
      const el = $(id);
      if (el) el.textContent = value;
    };
    set("#uiDeckReadyMetric", ready);
    set("#uiDeckCountMetric", `${countNum}/30`);
    set("#uiDeckUnitMetric", String(unit || "-"));
    set("#uiDeckSupportMetric", String(support || "-"));
  }

  function installMetricObserver() {
    if (!$("#deckPanel")) return;
    installDeckMetrics();
    new MutationObserver(() => requestAnimationFrame(updateDeckMetrics))
      .observe($("#deckPanel"), { childList: true, subtree: true, characterData: true });
  }

  function compactBattlePanels() {
    if (!/game\.html/i.test(location.pathname) && !$("#board")) return;
    document.body.classList.add("gameMobileLayout");
    for (const title of $$("h2,h3,.panelTitle,.sideTitle")) {
      const text = textOf(title);
      if (text.includes("\u8a73\u7d30") || text.includes("\u30ed\u30b0")) {
        title.closest("section,aside,.panel,div")?.classList.add("battleInfoPanel");
      }
    }
  }

  function init() {
    installUtilityLinks();
    installFilterSelfHeal();
    installScrollPreserver();
    installMobileNavFallback();
    installMetricObserver();
    compactBattlePanels();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
