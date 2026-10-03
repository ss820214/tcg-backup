// public/game_mobile.js
// v20261003_mobile_ui_overhaul
// Mobile-only presentation layer for game.html.
// Existing game DOM nodes are moved (not cloned) so their listeners/state remain intact.

const MOBILE_QUERY = "(max-width: 820px), ((pointer: coarse) and (max-width: 980px))";
const mq = window.matchMedia(MOBILE_QUERY);

const $ = (id) => document.getElementById(id);

const moved = new Map();
let mounted = false;
let syncObserver = null;
let actionObserver = null;
let detailObserver = null;
let resizeRaf = 0;
let activeTab = "";

function rememberAndMove(el, parent) {
  if (!el || !parent) return;
  if (!moved.has(el)) {
    const marker = document.createComment(`mobile-origin:${el.id || el.className || "node"}`);
    el.parentNode?.insertBefore(marker, el);
    moved.set(el, marker);
  }
  parent.appendChild(el);
}

function restoreMoved() {
  for (const [el, marker] of moved.entries()) {
    if (marker?.parentNode) marker.parentNode.insertBefore(el, marker);
    marker?.remove?.();
  }
  moved.clear();
}

function make(tag, attrs = {}, text = "") {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("aria-")) el.setAttribute(k, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  if (text) el.textContent = text;
  return el;
}

function buildHud() {
  const hud = make("div", { id: "mobileTopHud", "aria-label": "battle status" });

  const turnChip = make("div", { class: "mHudChip" });
  turnChip.innerHTML = '<span class="k">TURN</span><span class="v" id="mTurn">?</span>';

  const manaChip = make("div", { class: "mHudChip" });
  manaChip.innerHTML = '<span class="k">MANA</span><span class="v" id="mMana">?</span>';

  const scores = make("div", { class: "mHudScores" });
  const kill = make("div", { class: "mHudScore" });
  kill.innerHTML = '<span class="k">KILL</span><span class="v" id="mKill">A0 B0</span>';
  const infil = make("div", { class: "mHudScore" });
  infil.innerHTML = '<span class="k">INFIL</span><span class="v" id="mInfil">A0 B0</span>';
  scores.append(kill, infil);

  const exHost = make("div", { id: "mobileExHost" });

  hud.append(turnChip, manaChip, scores, exHost);
  document.body.appendChild(hud);
  return { hud, exHost };
}

function buildBottomUi() {
  const util = make("nav", { id: "mobileUtilityBar", "aria-label": "battle panels" });
  const tabs = [
    ["hand", "🃏 手札"],
    ["action", "⚔ 技"],
    ["detail", "🔎 詳細"],
    ["log", "☰ ログ"],
  ];

  for (const [tab, label] of tabs) {
    const b = make("button", {
      type: "button",
      dataset: { tab },
      "aria-expanded": "false",
      "aria-controls": `mobilePanel-${tab}`,
    }, label);
    b.addEventListener("click", () => {
      if (activeTab === tab && $("mobileSheet")?.classList.contains("open")) closeSheet();
      else openSheet(tab);
    });
    util.appendChild(b);
  }

  const dock = make("div", { id: "mobileActionDock", "aria-label": "battle actions" });

  const scrim = make("div", { id: "mobileSheetScrim", "aria-hidden": "true" });
  scrim.addEventListener("pointerdown", closeSheet);

  const sheet = make("section", { id: "mobileSheet", "aria-hidden": "true" });
  const head = make("div", { id: "mobileSheetHeader" });
  const title = make("div", { id: "mobileSheetTitle", class: "title" }, "パネル");
  const close = make("button", { id: "mobileSheetClose", type: "button", "aria-label": "閉じる" }, "✕");
  close.addEventListener("click", closeSheet);
  head.append(title, close);
  sheet.appendChild(head);

  for (const [tab] of tabs) {
    const panel = make("div", { id: `mobilePanel-${tab}`, class: "mobileSheetPanel" });
    panel.hidden = true;
    sheet.appendChild(panel);
  }

  document.body.append(scrim, sheet, util, dock);
  return { util, dock, sheet };
}

function moveLiveControls(exHost, dock) {
  // Use the ORIGINAL buttons. Never clone them: game.js already owns their handlers.
  ["modeSummon", "modeMove", "modeAttack", "modeEvolve", "modeSupport", "endTurn"].forEach((id) => {
    const el = $(id);
    if (el) rememberAndMove(el, dock);
  });

  const ex = $("exWrap");
  if (ex) rememberAndMove(ex, exHost);

  const targets = {
    hand: $("hand"),
    action: $("actionPicker"),
    detail: $("detail"),
    log: $("log"),
  };

  for (const [tab, el] of Object.entries(targets)) {
    if (el) rememberAndMove(el, $(`mobilePanel-${tab}`));
  }
}

function parseScore(id) {
  const text = String($(id)?.textContent || "0/3").trim();
  const m = text.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? m[1] : text.replace(/\s+/g, "");
}

function syncHud() {
  const turn = String($("turn")?.textContent || "?").trim();
  const mana = String($("mana")?.textContent || "?").trim();
  const you = String($("you")?.textContent || "").trim();

  const mTurn = $("mTurn");
  const mMana = $("mMana");
  const mKill = $("mKill");
  const mInfil = $("mInfil");

  if (mTurn) mTurn.textContent = you ? `${turn} / ${you}` : turn;
  if (mMana) mMana.textContent = mana;
  if (mKill) mKill.textContent = `A${parseScore("killTextA")} B${parseScore("killTextB")}`;
  if (mInfil) mInfil.textContent = `A${parseScore("infilTextA")} B${parseScore("infilTextB")}`;
}

function observeHudSources() {
  syncObserver?.disconnect?.();
  syncObserver = new MutationObserver(syncHud);
  ["turn", "mana", "you", "killTextA", "killTextB", "infilTextA", "infilTextB"].forEach((id) => {
    const el = $(id);
    if (el) syncObserver.observe(el, { subtree: true, childList: true, characterData: true });
  });
  syncHud();
}

function panelTitle(tab) {
  return ({ hand: "手札", action: "行動 / 技", detail: "詳細", log: "バトルログ" })[tab] || "パネル";
}

function openSheet(tab) {
  if (!mounted) return;
  activeTab = tab;

  document.querySelectorAll(".mobileSheetPanel").forEach((p) => {
    p.hidden = p.id !== `mobilePanel-${tab}`;
  });
  document.querySelectorAll("#mobileUtilityBar button[data-tab]").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-expanded", on ? "true" : "false");
  });

  const title = $("mobileSheetTitle");
  if (title) title.textContent = panelTitle(tab);

  $("mobileSheet")?.classList.add("open");
  $("mobileSheet")?.setAttribute("aria-hidden", "false");
  $("mobileSheetScrim")?.classList.add("open");
  $("mobileSheetScrim")?.setAttribute("aria-hidden", "false");
}

function closeSheet() {
  activeTab = "";
  $("mobileSheet")?.classList.remove("open");
  $("mobileSheet")?.setAttribute("aria-hidden", "true");
  $("mobileSheetScrim")?.classList.remove("open");
  $("mobileSheetScrim")?.setAttribute("aria-hidden", "true");
  document.querySelectorAll("#mobileUtilityBar button[data-tab]").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-expanded", "false");
  });
}

function installSmartPanelBehavior() {
  const hand = $("hand");
  const action = $("actionPicker");
  const detail = $("detail");
  const board = $("board");

  // Detail buttons in the hand should take the player straight to the detail panel.
  hand?.addEventListener("click", (ev) => {
    if (ev.target?.closest?.(".hcDetailBtn")) setTimeout(() => openSheet("detail"), 0);
  });

  // Once an action/support execution button is selected, return focus to the board.
  action?.addEventListener("click", (ev) => {
    if (ev.target?.closest?.(".actBtn, .btnExec")) setTimeout(closeSheet, 120);
  });

  board?.addEventListener("pointerdown", () => {
    if ($("mobileSheet")?.classList.contains("open")) closeSheet();
  }, { passive: true });

  $("endTurn")?.addEventListener("click", closeSheet);

  // If the action panel changes from a placeholder to actionable buttons, show a small dot
  // on the utility button. We do not auto-open, avoiding disruptive UI jumps.
  actionObserver?.disconnect?.();
  actionObserver = new MutationObserver(() => {
    const btn = document.querySelector('#mobileUtilityBar button[data-tab="action"]');
    if (!btn) return;
    const hasAction = !!action.querySelector(".actBtn, .btnExec");
    btn.classList.toggle("hasContent", hasAction);
  });
  if (action) actionObserver.observe(action, { childList: true, subtree: true });

  detailObserver?.disconnect?.();
  detailObserver = new MutationObserver(() => {
    const btn = document.querySelector('#mobileUtilityBar button[data-tab="detail"]');
    if (!btn) return;
    const meaningful = String(detail?.textContent || "").trim().length > 10;
    btn.classList.toggle("hasContent", meaningful);
  });
  if (detail) detailObserver.observe(detail, { childList: true, subtree: true, characterData: true });
}

function installSheetSwipeClose() {
  const head = $("mobileSheetHeader");
  const sheet = $("mobileSheet");
  if (!head || !sheet) return;

  let startY = null;
  let pointerId = null;

  head.addEventListener("pointerdown", (ev) => {
    if (ev.target?.closest?.("button")) return;
    startY = ev.clientY;
    pointerId = ev.pointerId;
    try { head.setPointerCapture(pointerId); } catch {}
  });

  head.addEventListener("pointermove", (ev) => {
    if (startY == null || ev.pointerId !== pointerId) return;
    const dy = Math.max(0, ev.clientY - startY);
    sheet.style.transition = "none";
    sheet.style.transform = `translateY(${Math.min(dy, 120)}px)`;
  });

  const finish = (ev) => {
    if (startY == null || (ev.pointerId != null && ev.pointerId !== pointerId)) return;
    const dy = Math.max(0, (ev.clientY ?? startY) - startY);
    startY = null;
    pointerId = null;
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (dy > 64) closeSheet();
  };

  head.addEventListener("pointerup", finish);
  head.addEventListener("pointercancel", finish);
}

function fitBoard() {
  if (!mounted) return;
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const vw = Math.max(280, Math.floor(vv?.width || window.innerWidth || document.documentElement.clientWidth));
    const vh = Math.max(320, Math.floor(vv?.height || window.innerHeight || document.documentElement.clientHeight));

    const landscape = vw > vh && vh <= 560;
    const top = landscape ? 46 : 54;
    const util = landscape ? 38 : 44;
    const action = landscape ? 54 : 62;
    const safeTop = 0; // CSS env() handles visual safe-area padding.
    const safeBottomGuess = 0;

    const availW = Math.max(240, vw - 8);
    const availH = Math.max(250, vh - top - util - action - safeTop - safeBottomGuess - 8);
    const gap = vw <= 360 ? 3 : 4;
    const pad = 4;

    const byW = Math.floor((availW - pad * 2 - gap * 4) / 5);
    const byH = Math.floor((availH - pad * 2 - gap * 6) / 7);

    // Prefer a slightly vertical card, but never overflow either axis.
    let cellW = Math.max(42, Math.min(86, byW));
    let cellH = Math.max(44, Math.min(116, byH, Math.floor(cellW * 1.34)));

    // On short landscape screens height is the limiting axis; narrow cards are fine.
    if (landscape) {
      cellH = Math.max(38, Math.min(74, byH));
      cellW = Math.max(42, Math.min(82, byW, Math.floor(cellH * 0.82)));
    }

    root.style.setProperty("--m-cell-w", `${cellW}px`);
    root.style.setProperty("--m-cell-h", `${cellH}px`);
    root.style.setProperty("--m-gap", `${gap}px`);
  });
}

function addContentIndicatorsCss() {
  if ($("mobileUiIndicatorCss")) return;
  const style = make("style", { id: "mobileUiIndicatorCss" });
  style.textContent = `
    @media (max-width:820px), ((pointer:coarse) and (max-width:980px)) {
      #mobileUtilityBar button.hasContent{ position:relative; }
      #mobileUtilityBar button.hasContent::after{
        content:""; position:absolute; width:6px; height:6px; border-radius:999px;
        right:7px; top:6px; background:#78ffaa; box-shadow:0 0 8px rgba(120,255,170,.5);
      }
    }
  `;
  document.head.appendChild(style);
}

function mount() {
  if (mounted || !mq.matches) return;
  if (!$('app') || !$('board')) return;

  mounted = true;
  document.body.classList.add("mobileBattle");
  addContentIndicatorsCss();

  const { exHost } = buildHud();
  const { dock } = buildBottomUi();
  moveLiveControls(exHost, dock);
  observeHudSources();
  installSmartPanelBehavior();
  installSheetSwipeClose();
  fitBoard();

  window.addEventListener("resize", fitBoard, { passive: true });
  window.visualViewport?.addEventListener("resize", fitBoard, { passive: true });
  window.visualViewport?.addEventListener("scroll", fitBoard, { passive: true });

  // Expose only a tiny debug surface; harmless in production and useful on devices.
  window.__mobileBattleUI = {
    open: openSheet,
    close: closeSheet,
    fit: fitBoard,
    version: "20261003",
  };
}

function unmount() {
  if (!mounted) return;
  mounted = false;
  closeSheet();
  syncObserver?.disconnect?.();
  actionObserver?.disconnect?.();
  detailObserver?.disconnect?.();
  syncObserver = actionObserver = detailObserver = null;

  restoreMoved();

  ["mobileTopHud", "mobileActionDock", "mobileUtilityBar", "mobileSheetScrim", "mobileSheet"].forEach((id) => $(id)?.remove?.());
  document.body.classList.remove("mobileBattle");

  window.removeEventListener("resize", fitBoard);
  window.visualViewport?.removeEventListener("resize", fitBoard);
  window.visualViewport?.removeEventListener("scroll", fitBoard);
}

function reconcile() {
  if (mq.matches) mount();
  else unmount();
}

// game.js is loaded just before this file. Waiting one frame ensures its DOM references/listeners
// are established before nodes are moved to mobile hosts.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(reconcile), { once: true });
} else {
  requestAnimationFrame(reconcile);
}

if (typeof mq.addEventListener === "function") mq.addEventListener("change", reconcile);
else mq.addListener?.(reconcile);
