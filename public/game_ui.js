// public/game_ui.js
// v20260723_stable_restore1
// - UI描画だけをここに隔離する
// - 状態/ロジックは game.js 側に残す

export function createGameUI(ctx) {
  const {
    setTurnUI,
    renderLog,
    fxOnHit,

    // basic
    W,
    H,
    dom,

    actAllowsAllyTarget,
    actFlags,
    isSelfRange,

    // seat/mode/state
    getSeat,
    getMode,
    setMode,
    canControl,

    // selection
    getSelectedUnitId,
    getSelectedTargetId,
    setSelectedTargetId,
    getSelectedHandIndex,
    setSelectedHandIndex,
    isHandCardLocked,
    getSelectedActionIndex,
    setSelectedActionIndex,

    // data
    cardDefsRef,
    cardName,
    shortLabel,
    isSupportCard,

    // styles
    ensureHandCss,
    ensureActionPickerCss,
    ensureBoardUnitCss,
    ensureBoardAssistCss,
    hexToRgba,
    typeColorStrong,
    typeColorSoft,

    // view/click
    toModelXY,
    onCellClickView,

    // board queries
    unitAt,
    isEmptyCell,
    inSummonAreaForSeat,
    buildRangeMap,
    buildSupportMap,

    // board render helpers
    round10,
    statusIconsText,
    statusIconsHtml,
    normalizeFieldId,

    // evolve hand decorate
    evolveDecorateHandCard,
    canSelectedHandEvolve,
    execSelectedHandEvolve,

    // detail helpers
    selectedIsSupport,
    showCardDetail,

    // action text helpers
    actionDetailPartsJa,
    actionSpecialTextJa,

    // action picker deps
    getSelectedUnit,
    getSelectedTarget,
    ensureSelectedActionIndex,
    actRangeLabel,
    calcHitRateAdapter,
    selectedHandDef,
    selectedHandCardId,
    supportPlan,
    supportReadyByPlan,
    supportRateText,
    supportTargetText,
    supportHintText,
    supportSearchOptions,
    getSupportSearchCardId,
    setSupportSearchCardId,
    resetSupportPicks,
    normalizeMana,
    getActionChoices,
    getActionCost,
    execAttack,
    execSupport,
    isPanic,
  } = ctx;

  // 先にダミーを置く（ハンドラから render() を呼んでも落ちないように）
  let render = () => {};

  const boardEl = dom.boardEl;
  const handEl = dom.handEl;
  const actionPickerEl = dom.actionPickerEl;
  const detailEl = dom.detailEl; // 使うなら

  let handDrawerEl = null;
let handDrawerToggleEl = null;
let handDrawerOpen = false;
let handLockCssReady = false;

function ensureHandLockCss() {
  if (handLockCssReady || typeof document === "undefined") return;
  handLockCssReady = true;
  const style = document.createElement("style");
  style.textContent = `
    .stackHandCard.locked{
      filter: grayscale(.55) brightness(.58);
      border-color: rgba(170,170,190,.34) !important;
      box-shadow: inset 0 0 0 999px rgba(0,0,0,.34) !important;
    }
    .stackHandCard.locked .shcName,
    .stackHandCard.locked .shcType,
    .stackHandCard.locked .shcStats{ opacity:.55; }
    .shcLock{
      position:absolute;
      right:10px;
      top:10px;
      border:1px solid rgba(255,255,255,.22);
      background:rgba(0,0,0,.48);
      color:rgba(255,255,255,.86);
      border-radius:999px;
      padding:4px 8px;
      font-size:11px;
      font-weight:1000;
      letter-spacing:.04em;
    }
    .apSelect{
      width:100%;
      border:1px solid rgba(255,255,255,.16);
      border-radius:10px;
      background:rgba(0,0,0,.26);
      color:#fff;
      padding:8px 10px;
      font:inherit;
      outline:none;
    }
  `;
  document.head.appendChild(style);
}

function ensureHandDrawerUI() {
  if (handDrawerEl && handDrawerToggleEl) return;

  handDrawerToggleEl = document.getElementById("handDrawerToggle");
  if (!handDrawerToggleEl) {
    handDrawerToggleEl = document.createElement("button");
    handDrawerToggleEl.id = "handDrawerToggle";
    handDrawerToggleEl.type = "button";
    handDrawerToggleEl.className = "handDrawerToggle";
    handDrawerToggleEl.innerHTML = `<span class="handDrawerToggleLabel">手札</span><span class="handDrawerToggleArrow">▲</span>`;
    handDrawerToggleEl.setAttribute("aria-label", "手札を開く");
    document.body.appendChild(handDrawerToggleEl);
  }

  handDrawerEl = document.getElementById("handDrawer");
  if (!handDrawerEl) {
    handDrawerEl = document.createElement("div");
    handDrawerEl.id = "handDrawer";
    handDrawerEl.className = "handDrawer";
    handDrawerEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(handDrawerEl);
  }

  handDrawerToggleEl.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handDrawerOpen = !handDrawerOpen;
    updateHandDrawerOpenState();
  });

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (!handDrawerOpen) return;
      if (e.target?.closest?.("#handDrawer")) return;
      if (e.target?.closest?.("#handDrawerToggle")) return;
      handDrawerOpen = false;
      updateHandDrawerOpenState();
    },
    { capture: true },
  );
}

function updateHandDrawerOpenState() {
  if (!handDrawerEl || !handDrawerToggleEl) return;

  handDrawerEl.classList.toggle("open", handDrawerOpen);
  handDrawerEl.setAttribute("aria-hidden", handDrawerOpen ? "false" : "true");
  handDrawerToggleEl.classList.toggle("open", handDrawerOpen);
  handDrawerToggleEl.innerHTML = `<span class="handDrawerToggleLabel">手札</span><span class="handDrawerToggleArrow">${handDrawerOpen ? "▼" : "▲"}</span>`;
  handDrawerToggleEl.setAttribute("aria-label", handDrawerOpen ? "手札を閉じる" : "手札を開く");
}

function handCardKindLabel(def) {
  return isSupportCard?.(def) ? "SUPPORT" : "UNIT";
}

function handCardSymbol(def) {
  if (isSupportCard?.(def)) return "◆";
  const t = String(def?.type || def?.attr || "");
  if (t === "火" || t === "炎") return "火";
  if (t === "水") return "水";
  if (t === "雷") return "雷";
  if (t === "草") return "草";
  if (t === "風") return "風";
  if (t === "鋼") return "鋼";
  if (t === "光") return "光";
  if (t === "闇") return "闇";
  if (t === "幻") return "幻";
  if (t === "呪") return "呪";
  return "◇";
}

function vitalDeltaText(kind, delta) {
  const n = Math.trunc(Number(delta) || 0);
  if (!n) return "";
  const upper = String(kind).toUpperCase();
  const icon =
    upper === "SP"
      ? n > 0
        ? "🩵"
        : "💙"
      : n > 0
        ? "💚"
        : "❤️";
  return `${icon}${n > 0 ? "+" : ""}${n}`;
}

function handCardPrimaryText(def) {
  if (isSupportCard?.(def)) {
    const eff = String(def?.effectText || def?.desc || def?.effect || "").trim();
    return eff || "サポート効果";
  }
  const acts = Array.isArray(def?.actions) ? def.actions : [];
  const a = acts[0] || null;
  if (!a) return "技なし";
  const hp = Number(a.hpDelta ?? a.hp ?? 0);
  const sp = Number(a.spDelta ?? a.sp ?? 0);
  const bits = [`${a.name || "技"}`];
  if (hp) bits.push(vitalDeltaText("HP", hp));
  if (sp) bits.push(vitalDeltaText("SP", sp));
  if (a.rate != null) bits.push(`${a.rate}%`);
  return bits.join(" / ");
}

function updateHandDrawerPosition() {
  if (!boardEl || !handDrawerToggleEl || !handDrawerEl) return;

  const isMobile = window.matchMedia?.("(max-width: 760px)")?.matches;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  if (isMobile) {
    handDrawerToggleEl.style.left = "50%";
    handDrawerToggleEl.style.top = "auto";
    handDrawerToggleEl.style.bottom = "14px";

    handDrawerEl.style.left = "50%";
    handDrawerEl.style.top = "auto";
    handDrawerEl.style.bottom = "62px";
    handDrawerEl.style.setProperty("--hand-drawer-w", "calc(100vw - 18px)");
    return;
  }

  const r = boardEl.getBoundingClientRect();
  const drawerWidth = Math.min(980, Math.max(340, window.innerWidth - 28));
  const drawerHalf = drawerWidth / 2;
  const centerX = clamp(
    r.left + r.width / 2,
    drawerHalf + 8,
    window.innerWidth - drawerHalf - 8,
  );
  handDrawerEl.style.setProperty("--hand-drawer-w", `${drawerWidth}px`);

  // 画面外に行かないように補正
  const safeTop = Math.min(
    window.innerHeight - 72,
    Math.max(90, r.bottom - 42),
  );

  handDrawerToggleEl.style.left = `${centerX}px`;
  handDrawerToggleEl.style.top = `${safeTop}px`;
  handDrawerToggleEl.style.bottom = "auto";

  handDrawerEl.style.left = `${centerX}px`;
  handDrawerEl.style.top = `${safeTop - 12}px`;
  handDrawerEl.style.bottom = "auto";
}

  // =========================
  // Long-press Quick Menu (3 balls)
  // =========================
  let lastSt = null;
  let quickMenuEl = null;

  let actionOrbitEl = null;
  let actionTargetingKey = "";

  function actionTargetKey(unitId, index) {
    return `${String(unitId ?? "")}:${Math.max(0, Number(index ?? 0) || 0)}`;
  }

  function markActionTargeting(unitId, index) {
    actionTargetingKey = actionTargetKey(unitId, index);
  }

  function clearActionTargetingIfIdle() {
    if (getMode?.() !== "attack") actionTargetingKey = "";
  }

  function ensureActionOrbit() {
    if (actionOrbitEl) {
      if (boardEl && !boardEl.contains(actionOrbitEl))
        boardEl.appendChild(actionOrbitEl);
      return actionOrbitEl;
    }
    if (!boardEl) return null;

    const el = document.createElement("div");
    el.className = "actionOrbit";
    el.style.display = "none";

    el.addEventListener("click", (ev) => {
  const card = ev.target?.closest?.("button.actionOrbitCard");
  if (!card || card.disabled) return;

  ev.stopPropagation();
  ev.preventDefault?.();

  const idx = Number(card.dataset.actionIndex ?? 0);
  setSelectedActionIndex?.(idx);

  const uid = el.dataset.unitId || "";
  const stNow = lastSt;
  const unit = Array.isArray(stNow?.units)
    ? stNow.units.find((x) => String(x?.id ?? "") === uid)
    : null;

  if (unit) {
    markActionTargeting(uid, idx);
    setMode?.("attack");
    render(stNow);
  } else {
    hideActionOrbit();
    render(stNow);
  }
});

    boardEl.appendChild(el);
    actionOrbitEl = el;
    return el;
  }

  function hideActionOrbit() {
    if (!actionOrbitEl) return;
    actionOrbitEl.style.display = "none";
    actionOrbitEl.innerHTML = "";
    actionOrbitEl.dataset.unitId = "";
    actionOrbitEl.classList.remove("isOpen", "isTargeting");
    actionTargetingKey = "";
  }

  function getActionSummaryParts(act) {
    let parts = null;
    try {
      parts =
        typeof actionDetailPartsJa === "function"
          ? actionDetailPartsJa(act)
          : null;
    } catch {}

    const cost = parts?.cost ?? act?.cost ?? "?";
    const name = parts?.name ?? act?.name ?? "?";
    const rate = parts?.rate ?? act?.rate ?? "?";
    const range = parts?.range ?? act?.range ?? "?";

    const hpDmg = Number(
      parts?.hpDmg ?? Math.max(0, -(Number(act?.hpDelta) || 0)),
    );
    const spDmg = Number(
      parts?.spDmg ?? Math.max(0, -(Number(act?.spDelta) || 0)),
    );
    const hpHeal = Number(
      parts?.hpHeal ?? Math.max(0, Number(act?.hpDelta) || 0),
    );
    const spHeal = Number(
      parts?.spHeal ?? Math.max(0, Number(act?.spDelta) || 0),
    );

    let effectText = String(parts?.effectText ?? "").trim();
    if (!effectText) {
      try {
        effectText =
          typeof actionSpecialTextJa === "function"
            ? String(actionSpecialTextJa(act) || "").trim()
            : "";
      } catch {}
    }

    const dmgBits = [];
    if (hpDmg) dmgBits.push(vitalDeltaText("HP", -hpDmg));
    if (spDmg) dmgBits.push(vitalDeltaText("SP", -spDmg));
    if (hpHeal) dmgBits.push(vitalDeltaText("HP", hpHeal));
    if (spHeal) dmgBits.push(vitalDeltaText("SP", spHeal));

    return {
      cost,
      name,
      rate,
      range,
      dmgText: dmgBits.join(" / "),
      effectText,
    };
  }

  function orbitPositionList(n) {
    if (n <= 1) return [{ x: 0, y: -132 }];

    if (n === 2) {
      return [
        { x: -118, y: -98 },
        { x: 118, y: -98 },
      ];
    }

    if (n === 3) {
      return [
        { x: 0, y: -146 },
        { x: -138, y: -56 },
        { x: 138, y: -56 },
      ];
    }

    if (n === 4) {
      return [
        { x: -84, y: -144 },
        { x: 84, y: -144 },
        { x: -162, y: -34 },
        { x: 162, y: -34 },
      ];
    }

    return [
      { x: 0, y: -154 },
      { x: -118, y: -122 },
      { x: 118, y: -122 },
      { x: -178, y: -16 },
      { x: 178, y: -16 },
    ];
  }

  function showActionOrbitForCell(cell, st, u) {
    const el = ensureActionOrbit();
    if (!el || !cell || !boardEl || !st || !u) return;

    const def = cardDefsRef()?.[u.cardId] || {};
    const acts =
      typeof getActionChoices === "function"
        ? getActionChoices(u, st)
        : Array.isArray(def?.actions)
          ? def.actions
          : [];
    if (!acts.length) return;

    const br = boardEl.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    const cx = cr.left - br.left + cr.width / 2;
    const cy = cr.top - br.top + cr.height / 2;

    el.innerHTML = "";
    el.style.display = "block";
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    el.dataset.unitId = String(u?.id ?? "");
    const currentIdx = Math.max(
      0,
      Number(getSelectedActionIndex?.() ?? 0) || 0,
    );
    const isTargeting =
      getMode?.() === "attack" &&
      actionTargetingKey === actionTargetKey(u?.id, currentIdx);
    el.classList.toggle("isTargeting", isTargeting);

    const myTurn = !!canControl(st);
    const alive = Number(u?.hp ?? 0) > 0;
    const mine = u?.owner === getSeat();
    const panic = !!isPanic?.(u);
    const fatigue = !!u?.fatigue;

    const poses = orbitPositionList(acts.length);

    acts.forEach((act, i) => {
      const pos = poses[i] || poses[poses.length - 1] || { x: 0, y: -132 };
      const s = getActionSummaryParts(act);

      const card = document.createElement("button");
      card.type = "button";
      card.className =
        "actionOrbitCard" + (i === currentIdx ? " selected" : "");
      card.dataset.actionIndex = String(i);
      card.style.setProperty("--ox", `${pos.x}px`);
      card.style.setProperty("--oy", `${pos.y}px`);

      const mana = normalizeMana?.(st?.mana);
      const seatKey = getSeat();
      const actCost =
        typeof getActionCost === "function"
          ? getActionCost(u, act)
          : Math.max(0, Math.trunc(Number(act?.cost ?? 0)));
      const canPay = !!mana?.[seatKey] && Number(mana[seatKey].cur) >= actCost;

      card.disabled = !(
        myTurn &&
        mine &&
        alive &&
        !panic &&
        !fatigue &&
        canPay
      );

      card.innerHTML = `
        <div class="aocTop">
          <span class="aocCost">${String(actCost)}</span>
          <span class="aocRate">命中${String(s.rate)}%</span>
        </div>
        <div class="aocName">${String(s.name)}</div>
        <div class="aocMeta">射程 ${String(s.range)}</div>
        ${s.dmgText ? `<div class="aocMeta">${String(s.dmgText)}</div>` : ""}
        ${s.effectText ? `<div class="aocFx">${String(s.effectText)}</div>` : ""}
      `;

      el.appendChild(card);
    });

    el.classList.remove("isOpen");
    void el.offsetWidth;
    el.classList.add("isOpen");
  }

  // ※ window リスナー重複防止用（1回しか登録しない）
  let quickMenuOutsideListenerInstalled = false;

  function ensureQuickMenu() {
    if (quickMenuEl) {
      if (boardEl && !boardEl.contains(quickMenuEl))
        boardEl.appendChild(quickMenuEl);
      return quickMenuEl;
    }
    if (!boardEl) return null;

    const el = document.createElement("div");
    el.className = "quickMenu";
    el.style.display = "none";

    const mk = (label, mode) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qmBall"; // ★CSSが .qBall 前提なので合わせる
      b.dataset.mode = mode;
      b.textContent = label;
      return b;
    };

    el.appendChild(mk("⚔️", "attack"));
    el.appendChild(mk("🏃", "move"));
    el.appendChild(mk("✨", "evolve"));

    // メニュークリック
    el.addEventListener("click", (ev) => {
  const btn = ev.target?.closest?.("button.qmBall");
  if (!btn || btn.disabled) return;

  ev.stopPropagation();
  ev.preventDefault?.();

  const modeName = btn.dataset.mode;

  try {
    setMode?.(modeName);
  } catch {}

  if (modeName === "attack" && lastSt) {
    const uid = el.dataset.unitId || "";
    const stNow = lastSt;
    const unit = Array.isArray(stNow?.units)
      ? stNow.units.find((x) => String(x?.id ?? "") === uid)
      : null;

    const freshCell = unit
      ? boardEl?.querySelector(`.cell[data-x="${unit.x}"][data-y="${unit.y}"]`)
      : null;

    hideQuickMenu();

    if (unit && freshCell) {
      showActionOrbitForCell(freshCell, stNow, unit);
    } else {
      hideActionOrbit();
      render(stNow);
    }
    return;
  }

  hideActionOrbit();
  hideQuickMenu();
  if (lastSt) render(lastSt);
});

    // 外側タップで閉じる（1回だけ登録）
    if (!quickMenuOutsideListenerInstalled) {
      quickMenuOutsideListenerInstalled = true;
      window.addEventListener(
        "pointerdown",
        (ev) => {
          if (ev.target?.closest?.(".quickMenu")) return;
          if (ev.target?.closest?.(".actionOrbit")) return;
          hideQuickMenu();
          hideActionOrbit();
        },
        { capture: true },
      );
    }

    // board に載せる（absoluteの基準）
    boardEl.appendChild(el);
    quickMenuEl = el;
    return el;
  }

  function hideQuickMenu() {
    if (!quickMenuEl) return;
    quickMenuEl.style.display = "none";
    quickMenuEl.dataset.unitId = "";
    quickMenuEl?.classList?.remove("isOpen");
  }

  function showQuickMenuForCell(cell, st, u) {
    const el = ensureQuickMenu();
    if (!el || !cell || !boardEl) return;

    const seat = getSeat();
    const myTurn = !!canControl(st);
    const mine = u?.owner === seat;
    const alive = Number(u?.hp ?? 0) > 0;

    const canMove = myTurn && mine && alive && !u?.panic;
    const canAttack = myTurn && mine && alive && !u?.panic && !u?.fatigue;
    const canEvolve = myTurn && mine && alive && !u?.panic;

    const bAttack = el.querySelector('button[data-mode="attack"]');
    const bMove = el.querySelector('button[data-mode="move"]');
    const bEvolve = el.querySelector('button[data-mode="evolve"]');

    if (bAttack) bAttack.disabled = !canAttack;
    if (bMove) bMove.disabled = !canMove;
    if (bEvolve) bEvolve.disabled = !canEvolve;

    // board内座標
    const br = boardEl.getBoundingClientRect();
    const cr = cell.getBoundingClientRect();
    const cx = cr.left - br.left + cr.width / 2;
    const cy = cr.top - br.top + cr.height / 2;

    el.style.display = "block";

    // サイズ測って上に配置（CSSの扇状配置があるので、基点だけ置く）
    // quickMenu 自体は「セル中央」に置く。qBall がそこから扇状に配置される。
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;

    el.dataset.unitId = String(u?.id ?? "");

    //アニメーション
    el.classList.remove("isOpen"); // いったん外す
    void el.offsetWidth; // reflow（アニメ再始動の定番）
    el.classList.add("isOpen"); // 開く
  }

  // 長押し検出（iOS/PC両対応・1回目だけ問題を潰す版）
  function attachLongPress({ box, st, u, vx, vy }) {
    if (!box) return;

    // iOS対策：ブラウザのジェスチャ/選択を抑止
    try {
      box.style.touchAction = "none";
    } catch {}

    let t = null;
    let fired = false;
    let sx = 0,
      sy = 0;
    let pid = null;

    const CLEAR = () => {
      if (t) {
        clearTimeout(t);
        t = null;
      }
    };

    const cleanupAll = () => {
      CLEAR();
      pid = null;
      window.removeEventListener("pointerup", onWinUp, true);
      window.removeEventListener("pointercancel", onWinCancel, true);
    };

    const onWinUp = () => {
      // 長押し未発火なら通常タップ
      if (!fired) {
        hideQuickMenu();
        try {
          onCellClickView(vx, vy);
        } catch {}
      }
      cleanupAll();
    };

    const onWinCancel = () => cleanupAll();

    box.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
    });

    box.addEventListener(
      "pointerdown",
      (ev) => {
        ev.stopPropagation();
        ev.preventDefault(); // ★長押し選択/コンテキストを殺す

        // ★前回取りこぼしても復帰
        cleanupAll();

        fired = false;
        sx = ev.clientX;
        sy = ev.clientY;
        pid = ev.pointerId;

        hideQuickMenu();

        // DOMが差し替わっても pointerup を追跡
        try {
          box.setPointerCapture?.(pid);
        } catch {}

        window.addEventListener("pointerup", onWinUp, true);
        window.addEventListener("pointercancel", onWinCancel, true);

        CLEAR();
        t = setTimeout(() => {
          fired = true;

          // 選択を合わせる（ここでrenderが走る）
          try {
            onCellClickView(vx, vy);
          } catch {}

          // render後に「新しい cell」を取り直す
          setTimeout(() => {
            const freshCell = boardEl?.querySelector(
              `.cell[data-x="${vx}"][data-y="${vy}"]`,
            );
            showQuickMenuForCell(freshCell, lastSt || st, u);
          }, 0);
        }, 380);
      },
      { passive: false }, // ★preventDefault を効かせる
    );

    box.addEventListener("pointermove", (ev) => {
      const dx = Math.abs(ev.clientX - sx);
      const dy = Math.abs(ev.clientY - sy);
      if (dx + dy > 12) CLEAR();
    });

    box.addEventListener("pointercancel", cleanupAll);
  }

  // ===== local =====
  function ensureBoardGrid() {
    if (!boardEl) return;

    const cellCount = boardEl.querySelectorAll(".cell").length;
    if (cellCount === W * H) return;

    boardEl.innerHTML = "";
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.addEventListener("click", () => onCellClickView(x, y));
        boardEl.appendChild(cell);
      }
    }

    // 盤面作り直したら quickMenu を付け直す
    if (quickMenuEl && !boardEl.contains(quickMenuEl))
      boardEl.appendChild(quickMenuEl);
  }

  // ===== Float bar =====

  // ===== Board =====
  function renderBoard(st) {
    if (!boardEl) return;

    ensureBoardGrid();
    ensureBoardAssistCss?.();
    ensureBoardUnitCss?.();

    const seat = getSeat();
    const midY = Math.floor(H / 2);

    const rangeMap = buildRangeMap(st);
    const supportMap = buildSupportMap(st);

    const cells = boardEl.querySelectorAll(".cell");

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];

      // まず初期化
      cell.innerHTML = "";
      cell.classList.remove(
        "summonOk",
        "rangeOk",
        "rangeNo",
        "supportOk",
        "selUnit",
        "selTarget",
        "hitFlash",
        "hitFlashHp",
        "hitFlashSp",
        "hitFlashMix",
        "hitFlashHeal",
        "hitPunch",
        "killBurst",
        "moveArrive",
        "bombCell",
        "zoneYou",
        "zoneEnemy",
        "zoneMid",
        "zoneLine",
        "canAct",
      );

      const vx = Number(cell.dataset.x);
      const vy = Number(cell.dataset.y);
      const { x, y } = toModelXY(vx, vy); // model座標

      // 残像防止
      cell.style.background = "";
      cell.style.boxShadow = "";

      // ===== ゾーン表示（自陣/敵陣/中央 + 中央ライン）=====
      const youHome = seat === "A" ? y >= H - 2 : y <= 1;
      const enHome = seat === "A" ? y <= 1 : y >= H - 2;

      if (youHome) cell.classList.add("zoneYou");
      else if (enHome) cell.classList.add("zoneEnemy");
      else cell.classList.add("zoneMid");

      if (y === midY) cell.classList.add("zoneLine");

      // swamp中央行（見た目）
      try {
        const fid =
          normalizeFieldId?.(st?.fieldId ?? st?.field?.id ?? "grass") ??
          "grass";
        if (fid === "swamp") {
          const swampY = Math.floor(H / 2); // H=7 -> 3
          if (vy === swampY) {
            cell.style.background = "rgba(40, 120, 90, .18)";
            cell.style.boxShadow = "inset 0 0 18px rgba(40, 120, 90, .25)";
          }
        }
      } catch {}

      // summon highlight
      if (
        getMode() === "summon" &&
        canControl(st) &&
        inSummonAreaForSeat(x, y, seat) &&
        isEmptyCell(st, x, y)
      ) {
        cell.classList.add("summonOk");
      }

      // range highlight
      const rk = rangeMap.get(`${x},${y}`);
      if (rk) cell.classList.add(rk.ok ? "rangeOk" : "rangeNo");

      // support highlight
      const sk = supportMap.get(`${x},${y}`);
      if (sk?.ok) cell.classList.add("supportOk");

      // danger bomb（見た目）
      try {
        const fid =
          normalizeFieldId?.(st?.fieldId ?? st?.field?.id ?? "grass") ??
          "grass";
        if (fid === "danger") {
          const bomb = st?.field?.bomb;
          if (
            bomb &&
            bomb.alive !== false &&
            x === Math.trunc(Number(bomb.x)) &&
            y === Math.trunc(Number(bomb.y))
          ) {
            cell.classList.add("bombCell");

            const th = Math.max(1, Math.trunc(Number(bomb.threshold ?? 3)));
            const steps = Math.max(0, Math.trunc(Number(bomb.steps ?? 0)));

            const obj = document.createElement("div");
            obj.className = "bombObj";
            obj.textContent = `💣${steps}/${th}`;
            cell.appendChild(obj);
          }
        }
      } catch {}

      // unit
      const u = unitAt(st, x, y);
      if (!u) continue;

      // selection highlight
      if (u.id === getSelectedUnitId()) cell.classList.add("selUnit");
      if (u.id === getSelectedTargetId()) cell.classList.add("selTarget");

      // 行動可能キャラの強調
      const myTurn = !!canControl(st);
      const canAct =
        myTurn &&
        u.owner === seat &&
        !u.panic &&
        !u.fatigue &&
        Number(u.hp) > 0;
      if (canAct) cell.classList.add("canAct");

      const def = cardDefsRef()?.[u.cardId] || {};
      const t = def.type || "?";
      const strong = typeColorStrong(t);
      const soft = typeColorSoft(t, 0.18);

      const box = document.createElement("div");
      box.className = "unitBox";
      box.style.borderColor = hexToRgba(strong, 0.45);
      box.style.background = soft;

      // panic badge
      if (!!u.panic) {
        const pb = document.createElement("div");
        pb.className = "panicBadge";
        pb.textContent = "😱PANIC";
        box.appendChild(pb);
      }

      // top row
      const top = document.createElement("div");
      top.className = "uTop";

      const cost = document.createElement("div");
      cost.className = "uCost";
      cost.textContent = String(def.cost ?? "?");

      const typeEl = document.createElement("div");
      typeEl.className = "uType";
      typeEl.style.borderColor = hexToRgba(strong, 0.35);
      typeEl.textContent = String(t);

      top.appendChild(cost);
      top.appendChild(typeEl);
      box.appendChild(top);

      // name
      const nm = document.createElement("div");
      nm.className = "uName";
      nm.textContent = shortLabel(cardName(u.cardId), 6);
      box.appendChild(nm);

      // hp/sp
      const hpWrap = document.createElement("div");
      hpWrap.className = "uHPWrap";

      const maxHp = Math.max(10, round10(u.maxHp ?? def?.hp ?? u.hp));
      const maxSp = Math.max(10, round10(u.maxSp ?? def?.sp ?? u.sp));
      const curHp = Math.max(0, round10(u.hp));
      const curSp = Math.max(0, round10(u.sp));

      function makeStatRow(label, cur, max, kind) {
        const row = document.createElement("div");
        row.className = "uStatRow";

        const lab = document.createElement("div");
        lab.className = "uStatLabel";
        lab.textContent = label;

        const bar = document.createElement("div");
        bar.className = "uStatBar";

        const fill = document.createElement("div");
        fill.className = "uStatFill " + kind;
        const p = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
        fill.style.width = `${Math.round(p * 100)}%`;
        bar.appendChild(fill);

        const val = document.createElement("div");
        val.className = "uStatOverlay";
        val.textContent = `${cur}/${max}`;
        bar.appendChild(val);

        row.appendChild(lab);
        row.appendChild(bar);
        return row;
      }

      hpWrap.appendChild(makeStatRow("HP", curHp, maxHp, "hp"));
      hpWrap.appendChild(makeStatRow("SP", curSp, maxSp, "sp"));
      box.appendChild(hpWrap);

      // status icons
      const ic = document.createElement("div");
      ic.className = "uIcons";

      const icons =
        typeof statusIconsHtml === "function"
          ? statusIconsHtml(u, { compact: true }) || ""
          : statusIconsText
            ? statusIconsText(u) || ""
            : "";

      ic.innerHTML = icons;
      if (icons) ic.title = statusIconsText ? statusIconsText(u) || "" : "";
      box.appendChild(ic);
      // owner ribbon
      const owner = document.createElement("div");
      owner.className = "uOwner " + (u.owner === seat ? "you" : "enemy");

      const left = document.createElement("div");
      left.textContent = u.owner === seat ? "YOU" : "ENEMY";

      owner.appendChild(left);
      box.appendChild(owner);

      // click
      // 長押しクイック（短押し＝通常選択）
      attachLongPress({ box, cell, st, u, vx, vy });

      cell.appendChild(box);
    }
  }

  // ===== Hand =====
  function renderHand(st) {
  if (!handEl) return;

  ensureHandCss?.();
  ensureHandLockCss();
  ensureHandDrawerUI();
  updateHandDrawerPosition();
  updateHandDrawerOpenState();

  const seat = getSeat();
  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  const cardDefs = cardDefsRef() || {};
  const selectedIndex = getSelectedHandIndex?.();
  const selectedCid =
    selectedIndex != null && selectedIndex >= 0 ? hand[selectedIndex] : null;
  const selectedDef = selectedCid ? cardDefs[selectedCid] || {} : null;
  const selectedLocked =
    selectedIndex != null && typeof isHandCardLocked === "function"
      ? !!isHandCardLocked(st, selectedIndex, seat)
      : false;

  // =====================
  // 右上：選択カードプレビュー
  // =====================
  handEl.innerHTML = "";

  const preview = document.createElement("div");
  preview.className = "handPreview";

  if (!selectedCid || !selectedDef) {
    preview.innerHTML = `
      <div class="hpvEmpty">
        <div class="hpvIcon">🃏</div>
        <div class="hpvTitle">カード未選択</div>
        <div class="hpvText">
          自陣側の▲ボタンから手札を開いて、カードを選択してね。
        </div>
      </div>
    `;
    handEl.appendChild(preview);
  } else if (selectedLocked) {
    preview.innerHTML = `
      <div class="hpvEmpty">
        <div class="hpvIcon">🌑</div>
        <div class="hpvTitle">伏せカード</div>
        <div class="hpvText">
          ${cardName(selectedCid)} は伏せ中。使用者の次ターン開始まで使用できません。
        </div>
      </div>
    `;
    handEl.appendChild(preview);
  } else {
    const t = selectedDef.type || "?";
    const strong = typeColorStrong(t);

    preview.style.setProperty("--accent", hexToRgba(strong, 0.65));
    preview.style.setProperty("--accentSoft", hexToRgba(strong, 0.22));

    const isSup = isSupportCard(selectedDef);

    preview.innerHTML = `
      <div class="hpvCard">
        <div class="hpvCost">${String(selectedDef.cost ?? "?")}</div>
        <div class="hpvMain">
          <div class="hpvName">${cardName(selectedCid)}</div>
          <div class="hpvType">${isSup ? "Support" : String(selectedDef.type ?? "?")}</div>
        </div>
        <div class="hpvStats">
          ${
            isSup
              ? `<span class="hpvBadge">SUPPORT</span>`
              : `HP ${selectedDef.hp ?? "?"} / SP ${selectedDef.sp ?? "?"}`
          }
        </div>
        <button class="hpvDetailBtn" type="button">詳細</button>
      </div>
    `;

    preview.querySelector(".hpvDetailBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCardDetail(selectedCid);
    });

    handEl.appendChild(preview);
  }

  // =====================
  // 手札ドロワー
  // =====================
  if (!handDrawerEl) return;
  handDrawerEl.innerHTML = "";

  const head = document.createElement("div");
  head.className = "handDrawerHead";
  head.innerHTML = `
    <div>
      <b>手札</b>
      <span>${hand.length}枚</span>
    </div>
    <div class="handDrawerControls">
      <button class="handEvolveTopBtn" type="button" disabled>進化</button>
      <div class="handDrawerHint">クリックで選択 / もう一度盤面へ</div>
    </div>
  `;
  const topEvolveBtn = head.querySelector(".handEvolveTopBtn");
  const topEvolveReady =
    selectedIndex != null &&
    !(typeof isHandCardLocked === "function" && isHandCardLocked(st, selectedIndex, seat)) &&
    (() => {
      try {
        return !!canSelectedHandEvolve?.(st, selectedIndex);
      } catch {
        return false;
      }
    })();
  if (topEvolveBtn) {
    topEvolveBtn.disabled = !topEvolveReady;
    topEvolveBtn.textContent = topEvolveReady ? "進化 READY" : "進化";
    topEvolveBtn.classList.toggle("ready", !!topEvolveReady);
    topEvolveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!topEvolveReady) return;
      setMode?.("evolve");
      try {
        await execSelectedHandEvolve?.(st, selectedIndex);
      } catch (err) {
        console.warn("[hand evolve top] failed", err);
      }
    });
  }
  handDrawerEl.appendChild(head);

  const stack = document.createElement("div");
  stack.className = "handStack mdHandFan";
  stack.style.setProperty("--hand-count", String(Math.max(1, hand.length)));

  for (let i = 0; i < hand.length; i++) {
    const cid = hand[i];
    const def = cardDefs[cid] || {};
    const t = def.type || "?";
    const strong = typeColorStrong(t);
    const isSelected = i === selectedIndex;
    const isLocked =
      typeof isHandCardLocked === "function" ? !!isHandCardLocked(st, i, seat) : false;

    const card = document.createElement("button");
    card.type = "button";
    card.className =
      "stackHandCard" +
      (isSelected ? " selected" : "") +
      (isLocked ? " locked" : "");
    card.style.setProperty("--i", String(i));
    card.style.setProperty("--accent", hexToRgba(strong, 0.7));
    card.style.setProperty("--accentSoft", hexToRgba(strong, 0.22));

    const center = (hand.length - 1) / 2;
    const offset = i - center;
    const compactFan = !!window.matchMedia?.("(max-width: 760px)")?.matches;
    const drawerW =
      handDrawerEl?.getBoundingClientRect?.().width || window.innerWidth || 720;
    const cardW = compactFan ? 90 : 116;
    const safePad = compactFan ? 38 : 56;
    const spreadSlots = Math.max(1, hand.length - 1);
    const maxSpread =
      hand.length <= 1
        ? 0
        : Math.floor(Math.max(0, drawerW - cardW - safePad * 2) / spreadSlots);
    const desiredSpread = compactFan ? 40 : 52;
    const spread =
      hand.length <= 1 ? 0 : Math.max(0, Math.min(desiredSpread, maxSpread));
    const lift = Math.max(0, Math.abs(offset) * -3 + 10);
    const rot = offset * Math.max(2.4, 5.8 - hand.length * 0.22);
    card.style.setProperty("--hand-card-w", `${cardW}px`);
    card.style.setProperty("--rot", `${rot}deg`);
    card.style.setProperty("--x", `${offset * spread}px`);
    card.style.setProperty("--y", `${isSelected ? -58 : -lift}px`);
    card.style.setProperty("--z", String(isSelected ? 200 : 80 + i));

    card.innerHTML = `
      <div class="shcFrameGlow"></div>
      <div class="shcTop">
        <div class="shcCost">${String(def.cost ?? "?")}</div>
        <div class="shcAttr">${handCardSymbol(def)}</div>
      </div>
      <div class="shcArt">
        <div class="shcArtSymbol">${handCardSymbol(def)}</div>
      </div>
      <div class="shcBody">
        <div class="shcKind">${handCardKindLabel(def)}</div>
        <div class="shcName">${cardName(cid)}</div>
        ${
          isSupportCard(def)
            ? ""
            : `<div class="shcVitals">HP ${def.hp ?? "?"} / SP ${def.sp ?? "?"}</div>`
        }
        <div class="shcType">${isSupportCard(def) ? "Support" : String(def.type ?? "?")}</div>
        <div class="shcText">${handCardPrimaryText(def)}</div>
        <div class="shcStats">
          ${
            isSupportCard(def)
              ? "SUPPORT"
              : `HP ${def.hp ?? "?"} / SP ${def.sp ?? "?"}`
          }
        </div>
      </div>
      ${isSelected ? `<div class="shcPickMarker" aria-hidden="true"><span>☝</span></div>` : ""}
      ${isLocked ? `<div class="shcLock">伏せ</div>` : ""}
    `;

    card.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      setSelectedHandIndex(i);
      showCardDetail(cid);

      if (isLocked) {
        render(st);
        return;
      }

      const modeNow = getMode?.();
      if (selectedIsSupport(st)) {
        setMode("support");
      } else if (canSelectedHandEvolve?.(st, i)) {
        if (modeNow !== "evolve") setMode("evolve");
      } else if (modeNow === "evolve") {
        setMode("evolve");
      } else {
        setMode("summon");
      }

      render(st);
    });

    try {
      if (typeof evolveDecorateHandCard === "function") {
        evolveDecorateHandCard({
          cardEl: card,
          index: i,
          cardId: cid,
          st,
          onShowDetail: (id) => showCardDetail(id),
        });
      }
    } catch {}

    stack.appendChild(card);
  }

  handDrawerEl.appendChild(stack);
}

  // ===== Action picker =====
  function renderActionPicker(st) {
    if (!actionPickerEl) return;

    try {
      ensureActionPickerCss?.();
    } catch {}

    actionPickerEl.innerHTML = "";
    if (!st) return;

    const seat = getSeat();
    const myTurn = !!canControl(st);
    const mode = getMode();
    const su = getSelectedUnit?.(st) || null;

    // title
    const title = document.createElement("div");
    title.className = "apTitle";

    const b = document.createElement("b");
    b.textContent = "行動パネル";

    const small = document.createElement("div");
    small.className = "small";
    small.textContent = myTurn ? "あなたのターン" : "相手のターン";

    title.appendChild(b);
    title.appendChild(small);
    actionPickerEl.appendChild(title);

    // Support
    const handDef = selectedHandDef?.(st) || null;
    if (mode === "support" && myTurn && handDef && isSupportCard(handDef)) {
      const plan = supportPlan?.(handDef) || { need: "none" };
      const ready = !!supportReadyByPlan?.(plan);

      const panel = document.createElement("div");
      panel.className = "apPanel";

      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = String(supportHintText?.(st) ?? "");
      panel.appendChild(hint);

      if (plan.need === "search") {
        const opts =
          typeof supportSearchOptions === "function"
            ? supportSearchOptions(st, handDef) || []
            : [];
        const selectWrap = document.createElement("div");
        selectWrap.className = "hint";
        selectWrap.style.marginTop = "8px";

        const fixed = String(plan.fixedCardId || "");
        const selected = String(getSupportSearchCardId?.() || fixed || "");
        selectWrap.innerHTML = `
          <label style="display:block;margin-bottom:5px;font-weight:900;">サーチするカード</label>
          <select class="apSelect" ${fixed ? "disabled" : ""}>
            ${fixed ? `<option value="${fixed}">${cardName(fixed)}</option>` : ""}
            ${
              !fixed
                ? opts
                    .map(
                      (o) =>
                        `<option value="${o.cardId}" ${selected === o.cardId ? "selected" : ""}>${cardName(o.cardId)} / cost:${o.cost}</option>`,
                    )
                    .join("")
                : ""
            }
          </select>
        `;
        const sel = selectWrap.querySelector("select");
        if (!fixed && opts.length && !selected) {
          setSupportSearchCardId?.(opts[0].cardId);
          sel.value = opts[0].cardId;
        }
        sel?.addEventListener("change", () => {
          setSupportSearchCardId?.(sel.value);
          render(st);
        });
        panel.appendChild(selectWrap);
      }

      const footer = document.createElement("div");
      footer.className = "apFooter";

      const execBtn = document.createElement("button");
      execBtn.className = "btnExec";
      execBtn.textContent = "サポート実行";
      execBtn.disabled = !ready;
      execBtn.addEventListener("click", () => execSupport?.(st));

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btnGhost";
      cancelBtn.textContent = "選択クリア";
      cancelBtn.addEventListener("click", () => {
        try {
          resetSupportPicks?.();
        } catch {}
        render(st);
      });

      footer.appendChild(execBtn);
      footer.appendChild(cancelBtn);
      panel.appendChild(footer);

      actionPickerEl.appendChild(panel);
      return;
    }

    // Attack
    if (mode === "attack" && myTurn && su && su.owner === seat) {
      const def = cardDefsRef()?.[su.cardId] || {};
      const acts =
        typeof getActionChoices === "function"
          ? getActionChoices(su, st)
          : Array.isArray(def.actions)
            ? def.actions
            : [];

      try {
        ensureSelectedActionIndex?.(st);
      } catch {}

      const wrap = document.createElement("div");
      wrap.className = "actWrap";

      for (let i = 0; i < acts.length; i++) {
        const act = acts[i];
        const btn = document.createElement("button");
        btn.className =
          "actBtn" + (i === getSelectedActionIndex() ? " selected" : "");

        const rate = Math.trunc(Number(calcHitRateAdapter?.(su, act) ?? 100));
        const rng = String(actRangeLabel?.(act, su.owner) ?? "");

        const actionCost =
          typeof getActionCost === "function"
            ? getActionCost(su, act)
            : Math.max(0, Math.trunc(Number(act?.cost ?? 0)));

        btn.innerHTML = `<span class="actText">
          <span class="badge">${actionCost}</span>
          ${act?.name ?? "?"}
          <span class="badge">命中${rate}%</span>
          <span class="badge">${rng}</span>
        </span>`;

        btn.addEventListener("click", () => {
          setSelectedActionIndex(i);
          if (getMode?.() === "attack") markActionTargeting(su?.id, i);
          render(st);
        });

        wrap.appendChild(btn);
      }

      actionPickerEl.appendChild(wrap);

      const panel = document.createElement("div");
      panel.className = "apPanel";

      const hint = document.createElement("div");
      hint.className = "hint";

      const curAct = acts[getSelectedActionIndex()] || acts[0] || null;
      const allowAlly =
        typeof actAllowsAllyTarget === "function"
          ? actAllowsAllyTarget(curAct)
          : false;

      const tgt = getSelectedTarget?.(st) || null;

      hint.textContent =
        `選択ユニット：${cardName(su.cardId)}\n` +
        `技：${curAct?.name ?? "?"}（コスト:${
          typeof getActionCost === "function"
            ? getActionCost(su, curAct)
            : (curAct?.cost ?? "?")
        }）\n` +
        `対象：${tgt ? cardName(tgt.cardId) : "未選択"}\n` +
        `手順：対象ユニットをクリック → 「行動実行」\n` +
        (allowAlly ? `※この技は味方も対象OK\n` : "") +
        (su.fatigue ? `\n※疲労中：行動できません` : "");
      panel.appendChild(hint);

      const footer = document.createElement("div");
      footer.className = "apFooter";

      const execBtn = document.createElement("button");
      execBtn.className = "btnExec";
      execBtn.textContent = "行動実行";
      execBtn.addEventListener("click", () => execAttack?.(st));

      const mana = normalizeMana?.(st.mana);
      const cost =
        typeof getActionCost === "function"
          ? getActionCost(su, curAct)
          : Math.max(0, Math.trunc(Number(curAct?.cost ?? 0)));
      const canPay = !!mana?.[seat] && Number(mana[seat].cur) >= cost;

      const flags =
        typeof actFlags === "function" ? actFlags(curAct) : { aoe: false };
      const isSelf =
        typeof isSelfRange === "function" ? isSelfRange(curAct?.range) : false;
      const needTarget = !!curAct && !isSelf && !flags.aoe;

      execBtn.disabled =
        !curAct ||
        !!su.fatigue ||
        !!isPanic?.(su) ||
        !canPay ||
        (needTarget && !tgt);

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btnGhost";
      cancelBtn.textContent = "対象クリア";
      cancelBtn.addEventListener("click", () => {
        setSelectedTargetId(null);
        render(st);
      });

      footer.appendChild(execBtn);
      footer.appendChild(cancelBtn);
      panel.appendChild(footer);

      actionPickerEl.appendChild(panel);
      return;
    }

    // Default
    const p = document.createElement("div");
    p.className = "apPanel";
    p.innerHTML = `<div class="small">ユニット選択→モードを選んで操作してね</div>`;
    actionPickerEl.appendChild(p);
  }

  // ===== Main render =====
  function renderImpl(st) {
    const prevUnitId = actionOrbitEl?.dataset?.unitId || "";
    lastSt = st;

    if (!st) return;

    try {
      clearActionTargetingIfIdle();
      setTurnUI?.(st);
    } catch {}

    renderBoard(st);
    renderHand(st);

    try {
      renderActionPicker?.(st);
    } catch {}

    try {
      renderLog?.(st);
    } catch {}

    try {
      fxOnHit?.(st);
      // 選択中ユニットの技オーブを描き直し
      try {
        if (
          actionOrbitEl &&
          actionOrbitEl.style.display !== "none" &&
          prevUnitId
        ) {
          const u = Array.isArray(st?.units)
            ? st.units.find((x) => String(x?.id ?? "") === String(prevUnitId))
            : null;

          if (u) {
            const cell = boardEl?.querySelector(
              `.cell[data-x="${u.x}"][data-y="${u.y}"]`,
            );
            if (cell) showActionOrbitForCell(cell, st, u);
            else hideActionOrbit();
          } else {
            hideActionOrbit();
          }
        }
      } catch {}
    } catch {}
  }

  // ダミーrenderを本物へ
  render = renderImpl;

  return { render, renderBoard, renderHand, renderActionPicker };
}
