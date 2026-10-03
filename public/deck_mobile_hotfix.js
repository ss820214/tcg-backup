// public/deck_mobile_hotfix.js
// v20261003_1
// Mobile safety layer for the deck builder.
// It does not own deck/card data. deck.js remains the source of truth.

const MOBILE_QUERY = "(max-width: 860px), ((pointer: coarse) and (max-width: 980px))";
const mq = window.matchMedia(MOBILE_QUERY);
const CARD_KEY = "tcg_mobile_card_panel_open_v20261003";
const DECK_KEY = "tcg_mobile_deck_panel_open_v20261003";

const $ = (id) => document.getElementById(id);

let observer = null;
let resizeTimer = 0;
let mounted = false;

function isDeckBuilder() {
  return !!($("cardList") && $("deckList"));
}

function getStoredOpen(key, fallback = true) {
  try {
    const v = localStorage.getItem(key);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {}
  return fallback;
}

function setStoredOpen(key, open) {
  try { localStorage.setItem(key, open ? "1" : "0"); } catch {}
}

function injectCss() {
  if ($("deckMobileHotfixCss")) return;
  const style = document.createElement("style");
  style.id = "deckMobileHotfixCss";
  style.textContent = `
    @media (max-width: 860px), ((pointer: coarse) and (max-width: 980px)) {
      html, body {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
        zoom: 1 !important;
      }

      body.deckMobileSafe {
        min-width: 0 !important;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }

      body.deckMobileSafe header {
        position: relative !important;
        top: auto !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 10px 12px !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
        overflow: visible !important;
        transform: none !important;
      }

      body.deckMobileSafe header .left {
        min-width: 0 !important;
        flex: 1 1 220px !important;
      }

      body.deckMobileSafe header h1 {
        font-size: 17px !important;
        white-space: nowrap !important;
      }

      body.deckMobileSafe header .topRight,
      body.deckMobileSafe header > .row {
        width: 100% !important;
        max-width: 100% !important;
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: flex-end !important;
        gap: 7px !important;
        overflow: visible !important;
      }

      body.deckMobileSafe header button,
      body.deckMobileSafe header .pill {
        min-height: 40px !important;
        padding: 7px 10px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
      }

      body.deckMobileSafe .wrap,
      body.deckMobileSafe .layout2 {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        padding: 10px !important;
        gap: 10px !important;
        margin: 0 !important;
        overflow: visible !important;
        transform: none !important;
        scale: 1 !important;
        zoom: 1 !important;
      }

      body.deckMobileSafe .panel,
      body.deckMobileSafe .leftCol,
      body.deckMobileSafe .bd,
      body.deckMobileSafe .panelHead,
      body.deckMobileSafe .scroll,
      body.deckMobileSafe .list,
      body.deckMobileSafe #cardList,
      body.deckMobileSafe #deckList {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        transform: none !important;
        scale: 1 !important;
        zoom: 1 !important;
      }

      body.deckMobileSafe .panel {
        overflow: hidden !important;
        border-radius: 16px !important;
      }

      body.deckMobileSafe .panel > .hd,
      body.deckMobileSafe .panel > .panelHead {
        min-height: 58px !important;
        padding: 10px 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 8px !important;
        flex-wrap: nowrap !important;
      }

      body.deckMobileSafe .panel > .hd > b,
      body.deckMobileSafe .panel > .panelHead > b {
        min-width: 0 !important;
        font-size: 16px !important;
      }

      body.deckMobileSafe .panel > .bd,
      body.deckMobileSafe .panel > .scroll {
        padding: 10px !important;
        overflow: visible !important;
      }

      body.deckMobileSafe .deckMobileCollapsed > .bd,
      body.deckMobileSafe .deckMobileCollapsed > .scroll {
        display: none !important;
      }

      body.deckMobileSafe .deckMobileToggle {
        flex: 0 0 44px !important;
        width: 44px !important;
        min-width: 44px !important;
        height: 44px !important;
        min-height: 44px !important;
        padding: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 999px !important;
        border: 1px solid rgba(255,255,255,.18) !important;
        background: rgba(255,255,255,.06) !important;
        color: #fff !important;
        font-size: 20px !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        touch-action: manipulation !important;
      }

      body.deckMobileSafe .listHead {
        position: relative !important;
        top: auto !important;
        margin: 0 0 8px !important;
        padding: 8px 9px !important;
      }

      body.deckMobileSafe #cardList.list,
      body.deckMobileSafe #deckList.list,
      body.deckMobileSafe #cardList,
      body.deckMobileSafe #deckList {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        max-height: none !important;
        overflow: visible !important;
        overflow-x: hidden !important;
        padding: 0 !important;
        scrollbar-gutter: auto !important;
      }

      body.deckMobileSafe #cardList .cardRow,
      body.deckMobileSafe #deckList .cardRow,
      body.deckMobileSafe #cardList .card,
      body.deckMobileSafe #deckList .card {
        position: relative !important;
        inset: auto !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 11px 10px 10px 13px !important;
        gap: 9px !important;
        overflow: visible !important;
        transform: none !important;
        scale: 1 !important;
        zoom: 1 !important;
        float: none !important;
        clear: both !important;
      }

      body.deckMobileSafe .cardRow > div:first-child,
      body.deckMobileSafe .cardHead > div:first-child {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
      }

      body.deckMobileSafe #cardList .cardRow .name,
      body.deckMobileSafe #deckList .cardRow .name {
        max-width: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: clip !important;
        display: block !important;
        -webkit-line-clamp: unset !important;
        font-size: 14px !important;
        line-height: 1.3 !important;
        overflow-wrap: anywhere !important;
      }

      body.deckMobileSafe #cardList .cardRow .sub,
      body.deckMobileSafe #deckList .cardRow .sub {
        max-width: 100% !important;
        width: 100% !important;
        margin-top: 4px !important;
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: clip !important;
        display: block !important;
        -webkit-line-clamp: unset !important;
        font-size: 11px !important;
        line-height: 1.35 !important;
        overflow-wrap: anywhere !important;
      }

      body.deckMobileSafe #cardList .btns,
      body.deckMobileSafe #deckList .btns,
      body.deckMobileSafe .cardHead .btns {
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: flex-end !important;
        align-items: center !important;
        gap: 6px !important;
        margin: 0 !important;
        transform: none !important;
      }

      body.deckMobileSafe #cardList .miniBtn,
      body.deckMobileSafe #deckList .miniBtn,
      body.deckMobileSafe .cardHead button {
        min-width: 42px !important;
        min-height: 40px !important;
        padding: 6px 9px !important;
        font-size: 12px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        flex: 0 0 auto !important;
      }

      body.deckMobileSafe #cardList .count,
      body.deckMobileSafe #deckList .count,
      body.deckMobileSafe .cardHead .cnt {
        min-width: 48px !important;
        min-height: 40px !important;
        padding: 6px 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 12px !important;
        white-space: nowrap !important;
        flex: 0 0 auto !important;
      }

      body.deckMobileSafe #deckMobileToolbar {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 7px !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 0 9px !important;
        padding: 0 !important;
      }

      body.deckMobileSafe #deckMobileToolbar button {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 42px !important;
        padding: 7px 8px !important;
        border-radius: 12px !important;
        border: 1px solid rgba(255,255,255,.15) !important;
        background: rgba(255,255,255,.055) !important;
        color: #fff !important;
        font-size: 12px !important;
        font-weight: 900 !important;
        line-height: 1.1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.deckMobileSafe #btnClearDeck {
        min-height: 42px !important;
        padding: 7px 11px !important;
        white-space: nowrap !important;
      }

      body.deckMobileSafe #roomDrawer {
        width: min(100vw, 430px) !important;
        max-width: 100vw !important;
        height: 100dvh !important;
        overflow: hidden !important;
      }

      body.deckMobileSafe .roomDrawerBody {
        min-width: 0 !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding: 10px !important;
      }

      body.deckMobileSafe .roomRow,
      body.deckMobileSafe .deckLibRow {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        gap: 7px !important;
      }

      body.deckMobileSafe .roomRow > *,
      body.deckMobileSafe .deckLibRow > * {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      body.deckMobileSafe #deckTitle,
      body.deckMobileSafe #playerName,
      body.deckMobileSafe #joinRoomId,
      body.deckMobileSafe #deckLibSearch,
      body.deckMobileSafe .input {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }

      body.deckMobileSafe .deckLibBox,
      body.deckMobileSafe .deckLibBd,
      body.deckMobileSafe .deckLibCard,
      body.deckMobileSafe .deckLibList {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow-x: hidden !important;
        transform: none !important;
      }

      body.deckMobileSafe .deckLibTabs {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 7px !important;
        width: 100% !important;
        flex-wrap: nowrap !important;
      }

      body.deckMobileSafe .deckLibTab {
        width: 100% !important;
        min-width: 0 !important;
        min-height: 40px !important;
        padding: 6px 7px !important;
        font-size: 11px !important;
        line-height: 1.1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.deckMobileSafe .deckLibList {
        max-height: none !important;
        overflow-y: visible !important;
        padding-right: 0 !important;
      }

      body.deckMobileSafe .deckLibCardTop {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 8px !important;
      }

      body.deckMobileSafe .deckLibBtns {
        width: 100% !important;
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: flex-start !important;
        gap: 6px !important;
      }

      body.deckMobileSafe .deckLibBtns button {
        min-height: 38px !important;
        white-space: nowrap !important;
      }

      body.deckMobileSafe #detailWrap,
      body.deckMobileSafe .detailWrap,
      body.deckMobileSafe #detailWrap.detailFloating {
        left: 8px !important;
        right: 8px !important;
        bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
        top: auto !important;
        width: auto !important;
        max-width: none !important;
        max-height: 62dvh !important;
        transform: none !important;
      }

      body.deckMobileSafe #detail {
        max-height: calc(62dvh - 48px) !important;
      }

      body.deckMobileSafe .deckMobileEmptyHint {
        display: block;
        width: 100%;
        padding: 14px 12px;
        border: 1px dashed rgba(255,255,255,.14);
        border-radius: 12px;
        color: rgba(255,255,255,.62);
        font-size: 12px;
        line-height: 1.45;
        text-align: center;
      }
    }

    @media (max-width: 390px) {
      body.deckMobileSafe .wrap,
      body.deckMobileSafe .layout2 { padding: 7px !important; gap: 8px !important; }
      body.deckMobileSafe .panel > .bd,
      body.deckMobileSafe .panel > .scroll { padding: 8px !important; }
      body.deckMobileSafe #cardList .cardRow,
      body.deckMobileSafe #deckList .cardRow { padding: 9px 8px 9px 11px !important; }
      body.deckMobileSafe #cardList .miniBtn,
      body.deckMobileSafe #deckList .miniBtn { min-width: 40px !important; padding: 6px 7px !important; }
      body.deckMobileSafe #cardList .count,
      body.deckMobileSafe #deckList .count { min-width: 44px !important; padding: 6px !important; }
    }
  `;
  document.head.appendChild(style);
}

function removeStaleToggleButtons(head) {
  if (!head) return;
  for (const b of head.querySelectorAll("button")) {
    if (b.classList.contains("deckMobileToggle")) continue;
    if (b.id) continue;
    const t = String(b.textContent || "").trim();
    if (t === "+" || t === "−" || t === "-") b.remove();
  }
}

function getPanelParts(listId) {
  const list = $(listId);
  if (!list) return null;
  const panel = list.closest(".panel");
  if (!panel) return null;
  const head = panel.querySelector(":scope > .hd, :scope > .panelHead");
  const body = panel.querySelector(":scope > .bd, :scope > .scroll");
  return { list, panel, head, body };
}

function setPanelOpen(parts, open, storageKey) {
  if (!parts) return;
  parts.panel.classList.toggle("deckMobileCollapsed", !open);
  const btn = parts.head?.querySelector(".deckMobileToggle");
  if (btn) {
    btn.textContent = open ? "−" : "+";
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "閉じる" : "開く");
  }
  setStoredOpen(storageKey, open);
}

function ensurePanelToggle(listId, storageKey, fallbackOpen = true) {
  const parts = getPanelParts(listId);
  if (!parts?.head) return;

  removeStaleToggleButtons(parts.head);
  let btn = parts.head.querySelector(".deckMobileToggle");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "deckMobileToggle";
    parts.head.appendChild(btn);
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setPanelOpen(parts, parts.panel.classList.contains("deckMobileCollapsed"), storageKey);
    });
  }

  // After this hotfix, first visit is deliberately open so content cannot disappear.
  setPanelOpen(parts, getStoredOpen(storageKey, fallbackOpen), storageKey);
}

function normalizeInlineGeometry(root) {
  if (!root) return;
  const nodes = [root, ...root.querySelectorAll(".panel, .bd, .scroll, .list, .cardRow, .card, .cardHead, .btns")];
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    for (const prop of ["width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight", "transform", "scale", "zoom", "left", "right"]) {
      if (el.style[prop]) el.style[prop] = "";
    }
  }
}

function ensureQuickToolbar() {
  const deck = getPanelParts("deckList");
  if (!deck?.body) return;

  let bar = $("deckMobileToolbar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "deckMobileToolbar";

    const save = document.createElement("button");
    save.id = "deckMobileSave";
    save.type = "button";
    save.textContent = "保存";
    save.addEventListener("click", () => $("btnSave")?.click());

    const my = document.createElement("button");
    my.id = "deckMobileMyDecks";
    my.type = "button";
    my.textContent = "自分のデッキ";
    my.addEventListener("click", () => {
      const drawer = $("roomDrawer");
      const toggle = $("roomDrawerToggle");
      if (drawer && !drawer.classList.contains("open")) toggle?.click();
      window.setTimeout(() => {
        $("deckLibTabMy")?.click();
        $("deckLibBox")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      }, 80);
    });

    bar.append(save, my);
    deck.body.prepend(bar);
  }
}

function ensureEmptyHints() {
  const cardList = $("cardList");
  const deckList = $("deckList");
  if (!cardList || !deckList) return;

  const cardHint = cardList.querySelector(":scope > .deckMobileEmptyHint");
  if (cardList.querySelector(".cardRow, .card")) cardHint?.remove();

  const deckHint = deckList.querySelector(":scope > .deckMobileEmptyHint");
  if (deckList.querySelector(".cardRow, .card")) deckHint?.remove();
}

function markLoadingIfNeeded() {
  const cardList = $("cardList");
  if (!cardList || cardList.querySelector(".cardRow, .card, .deckMobileEmptyHint")) return;
  const hint = document.createElement("div");
  hint.className = "deckMobileEmptyHint";
  hint.textContent = "カードを読み込み中…";
  cardList.appendChild(hint);

  window.setTimeout(() => {
    if (!hint.isConnected) return;
    if (cardList.querySelector(".cardRow, .card")) return hint.remove();
    hint.textContent = "カード一覧を取得できていません。再読み込みしても空のままなら、通信またはカード読込エラーを確認してください。";
  }, 6000);
}

function normalize() {
  if (!mq.matches || !isDeckBuilder()) return;
  document.body.classList.add("deckMobileSafe");
  injectCss();
  normalizeInlineGeometry(document.querySelector("main.wrap, .wrap, .layout2") || document.body);
  ensurePanelToggle("cardList", CARD_KEY, true);
  ensurePanelToggle("deckList", DECK_KEY, true);
  ensureQuickToolbar();
  ensureEmptyHints();
}

function mount() {
  if (!mq.matches || !isDeckBuilder()) return;
  if (!mounted) {
    mounted = true;
    injectCss();
    markLoadingIfNeeded();

    observer = new MutationObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(normalize, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  normalize();
}

function unmount() {
  if (!mounted) return;
  mounted = false;
  observer?.disconnect();
  observer = null;
  document.body.classList.remove("deckMobileSafe");
  $("deckMobileToolbar")?.remove();
  document.querySelectorAll(".deckMobileToggle").forEach((b) => b.remove());
  document.querySelectorAll(".deckMobileCollapsed").forEach((p) => p.classList.remove("deckMobileCollapsed"));
}

function reconcile() {
  if (mq.matches) mount();
  else unmount();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", reconcile, { once: true });
} else {
  reconcile();
}

if (typeof mq.addEventListener === "function") mq.addEventListener("change", reconcile);
else mq.addListener?.(reconcile);

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(normalize, 100);
}, { passive: true });
