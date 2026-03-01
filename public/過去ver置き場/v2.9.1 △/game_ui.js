// public/game_ui.js
// v3.0.0 split step-1 (UI renderer)
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
    normalizeFieldId,

    // evolve hand decorate
    evolveDecorateHandCard,

    // detail helpers
    selectedIsSupport,
    showCardDetail,

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
    resetSupportPicks,
    normalizeMana,
    execAttack,
    execSupport,
    isPanic,
  } = ctx;

  //DOM///

    // 先にダミーを置く（ハンドラから render() を呼んでも落ちないように）
  let render = () => {};

  const boardEl = dom.boardEl;
  const handEl = dom.handEl;
  const actionPickerEl = dom.actionPickerEl;
  const detailEl = dom.detailEl; // 使うなら

  // ===== local =====
  function ensureBoardGrid() {
    if (!boardEl) return;
    if (boardEl.children && boardEl.children.length === W * H) return;

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
  }

  function renderBoard(st) {
    if (!boardEl) return;

    ensureBoardGrid();
    ensureBoardAssistCss();
    ensureBoardUnitCss();

    const seat = getSeat();
    const rangeMap = buildRangeMap(st);
    const supportMap = buildSupportMap(st);

    const cells = boardEl.children;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.innerHTML = "";
      cell.classList.remove(
        "summonOk",
        "rangeOk",
        "rangeNo",
        "supportOk",
        "selUnit",
        "selTarget",
        "hitFlash",
        "bombCell",
      );

      const vx = Number(cell.dataset.x);
      const vy = Number(cell.dataset.y);
      const { x, y } = toModelXY(vx, vy); // model座標

      // 残像防止
      cell.style.background = "";
      cell.style.boxShadow = "";

      // swamp中央行（見た目）
      try {
        const fid =
          normalizeFieldId?.(st?.fieldId ?? st?.field?.id ?? "grass") ??
          "grass";
        if (fid === "swamp") {
          const swampY = Math.floor(H / 2); // H=7 -> 3（4行目）
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

            // できるだけ壊さない最低限表示（既存CSS前提）
            const th = Math.max(1, Math.trunc(Number(bomb.threshold ?? 3)));
            const steps = Math.max(0, Math.trunc(Number(bomb.steps ?? 0)));

            const obj = document.createElement("div");
            obj.className = "bombObj";
            obj.textContent = `💣${steps}/${th}`;
            cell.appendChild(obj);
          }
        }
      } catch {}

      const u = unitAt(st, x, y);
      if (!u) continue;

      // selection highlight
      if (u.id === getSelectedUnitId()) cell.classList.add("selUnit");
      if (u.id === getSelectedTargetId()) cell.classList.add("selTarget");

      const def = cardDefsRef()?.[u.cardId] || {};
      const t = def.type || "?";
      const strong = typeColorStrong(t);
      const soft = typeColorSoft(t, 0.18);

      const box = document.createElement("div");
      box.className = "unitBox";
      box.style.borderColor = hexToRgba(strong, 0.45);
      box.style.background = soft;

      // panic badge（UIは判定関数を持ってないので unit.panic を見る）
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

      // hp/sp（2行 + ミニゲージ）
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

      // 状態異常アイコン
      const ic = document.createElement("div");
      ic.className = "uIcons";
      ic.textContent = statusIconsText ? statusIconsText(u) || "" : "";
      box.appendChild(ic);

      // owner ribbon
      const owner = document.createElement("div");
      owner.className = "uOwner " + (u.owner === seat ? "you" : "enemy");

      const left = document.createElement("div");
      left.textContent = u.owner === seat ? "YOU" : "ENEMY";

      owner.appendChild(left);
      box.appendChild(owner);

      // click（cell clickをそのまま使う）
      box.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onCellClickView(vx, vy);
      });

      cell.appendChild(box);
    }
  }

  function renderHand(st) {
    if (!handEl) return;

    ensureHandCss();
    handEl.innerHTML = "";

    const seat = getSeat();
    const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
    const cardDefs = cardDefsRef() || {};

    for (let i = 0; i < hand.length; i++) {
      const cid = hand[i];
      const def = cardDefs[cid] || {};
      const t = def.type || "?";
      const strong = typeColorStrong(t);

      const card = document.createElement("div");
      card.className =
        "handCard" + (i === getSelectedHandIndex() ? " selected" : "");
      card.style.setProperty("--accent", hexToRgba(strong, 0.55));
      card.style.setProperty("--accentSoft", hexToRgba(strong, 0.22));

      const bar = document.createElement("div");
      bar.className = "hcBar";
      bar.style.background = `linear-gradient(180deg, ${hexToRgba(strong, 0.75)} 0%, rgba(0,0,0,.0) 140%)`;
      card.appendChild(bar);

      const r1 = document.createElement("div");
      r1.className = "hcRow1";

      const diamond = document.createElement("div");
      diamond.className = "hcDiamond";
      const sp = document.createElement("span");
      sp.textContent = String(def.cost ?? "?");
      diamond.appendChild(sp);

      const main = document.createElement("div");
      main.className = "hcMain";

      const name = document.createElement("div");
      name.className = "hcName";
      name.textContent = cardName(cid);

      const type = document.createElement("div");
      type.className = "hcType";
      type.textContent = isSupportCard(def)
        ? "Support"
        : String(def.type ?? "?");

      main.appendChild(name);
      main.appendChild(type);

      r1.appendChild(diamond);
      r1.appendChild(main);
      card.appendChild(r1);

      const r2 = document.createElement("div");
      r2.className = "hcRow2";

      const stats = document.createElement("div");
      stats.className = "hcStats";
      if (isSupportCard(def)) {
        stats.innerHTML = `<span class="badge">SUPPORT</span>`;
      } else {
        stats.textContent = `HP ${def.hp ?? "?"} / SP ${def.sp ?? "?"}`;
      }

      const btn = document.createElement("button");
      btn.className = "hcDetailBtn";
      btn.textContent = "詳細";
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        showCardDetail(cid);
      });

      r2.appendChild(stats);
      r2.appendChild(btn);
      card.appendChild(r2);

      // owner bar（UIは自分手札だけなので固定でYOU）
      const ownerBar = document.createElement("div");
      ownerBar.className = "hcOwnerBar you";
      ownerBar.textContent = "YOU";
      card.appendChild(ownerBar);

      // click select
      card.addEventListener("click", () => {
        setSelectedHandIndex(i);
        showCardDetail(cid);

        // サポート選択したらサポートモードに寄せる（game.jsと同じ）
        if (selectedIsSupport(st)) setMode("support");

        render(st);
      });

      // ★進化候補なら手札カードにデコ（game.jsの evolveSys.decorateHandCard 相当）
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

      handEl.appendChild(card);
    }
  }
  function renderActionPicker(st) {
    if (!actionPickerEl) return;

    // CSS確保
    try {
      ensureActionPickerCss?.();
    } catch {}

    actionPickerEl.innerHTML = "";
    if (!st) return;

    const seat = getSeat();
    const myTurn = !!canControl(st);
    const mode = getMode();
    const su = getSelectedUnit?.(st) || null;

    // タイトル
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

    // =========
    // Support
    // =========
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

    // =========
    // Attack
    // =========
    if (mode === "attack" && myTurn && su && su.owner === seat) {
      const def = cardDefsRef()?.[su.cardId] || {};
      const acts = Array.isArray(def.actions) ? def.actions : [];

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

        btn.innerHTML = `<span class="actText">
        <span class="badge">${act?.cost ?? "?"}</span>
        ${act?.name ?? "?"}
        <span class="badge">命中${rate}%</span>
        <span class="badge">${rng}</span>
      </span>`;

        btn.addEventListener("click", () => {
          setSelectedActionIndex(i);
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
        `技：${curAct?.name ?? "?"}（コスト:${curAct?.cost ?? "?"}）\n` +
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

      // 支払い可否
      const mana = normalizeMana?.(st.mana);
      const cost = Math.max(0, Math.trunc(Number(curAct?.cost ?? 0)));
      const canPay = !!mana?.[seat] && Number(mana[seat].cur) >= cost;

      // 対象必須（超シンプル版）：targetが必要ならここを厳密化していく

      execBtn.addEventListener("click", () => execAttack?.(st));

      // 対象が必要か？：selfは不要 / AOEも不要（対象なしで撃てる）
      const flags =
        typeof actFlags === "function" ? actFlags(curAct) : { aoe: false };
      const isSelf =
        typeof isSelfRange === "function" ? isSelfRange(curAct?.range) : false;
      const needTarget = !!curAct && !isSelf && !flags.aoe;

      // 実行可否
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

    // =========
    // Default
    // =========
    const p = document.createElement("div");
    p.className = "apPanel";
    p.innerHTML = `<div class="small">ユニット選択→モードを選んで操作してね</div>`;
    actionPickerEl.appendChild(p);
  }
  
    // =========================
  // Main render (UI entrypoint)
  // - 左ペイン更新もここで実行（setTurnUI/renderLog/fxOnHit）
  // - hand click から render(st) が呼ばれても落ちない（先頭で let render を確保済み）
  // =========================
  function renderImpl(st) {
    if (!st) return;

    // ★左ペイン（TURN/mana/score/dice）更新
    try { setTurnUI?.(st); } catch {}

    // 盤面/手札
    renderBoard(st);
    renderHand(st);

    // 行動パネル
    try { renderActionPicker?.(st); } catch {}

    // ★ログ
    try { renderLog?.(st); } catch {}

    // ★ヒット演出
    try { fxOnHit?.(st); } catch {}
  }

  // ★ここで「ダミーrender」を本物に差し替える
  render = renderImpl;

  return { render, renderBoard, renderHand, renderActionPicker };
}