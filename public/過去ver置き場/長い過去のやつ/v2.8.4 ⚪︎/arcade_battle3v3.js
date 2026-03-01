// public/arcade_battle3v3.js
// v20260212_arcade_battle3v3
//
// 3vs3コマンドバトル
// - 共有マナ: start=2, +2/turn, cap=10
// - 命令: Attack / Guard / Focus / Switch（任意）
// - 敵AI: 生存からランダムターゲット、コスト範囲で最大期待値の技を選ぶ
//
// deps で UI と cardDefs と戻り処理を受け取る。

export function createBattle3v3Engine(deps) {
  const {
    rootEl,
    logEl,
    statusEl,
    btnTurn,
    btnRetreat,
    yourTeamEl,
    enemyTeamEl,
    cmdPanelEl,

    cardDefs,
    cardName,

    // arcade連携
    getDeckPicks, // () => [cardId,cardId,cardId]
    getStageIndex,
    onBattleEnd, // async(win:boolean, resultObj)

    rng = Math.random,
  } = deps;

  // -------------------
  // battle state
  // -------------------
  const ST = {
    turn: 1,
    mana: 2,
    manaCap: 10,
    manaGain: 2,
    phase: "plan", // plan / resolve / end
    you: [],
    enemy: [],
    plan: new Map(), // unitId -> {type, data}
    selectedUnitId: null,
    selectedTargetId: null,
    winner: null,
  };

  // -------------------
  // helpers
  // -------------------
  const uid = () => Math.random().toString(36).slice(2, 9);

  const clamp10 = (n) => Math.trunc((Number(n) || 0) / 10) * 10;
  const alive = (u) => u && u.hp > 0;
  const teamAlive = (arr) => arr.filter(alive);

  function setStatus(t) {
    if (statusEl) statusEl.textContent = t || "";
  }
  function log(t) {
    if (!logEl) return;
    const p = document.createElement("div");
    p.textContent = t;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function getActs(cardId) {
    const def = cardDefs?.[cardId] || {};
    const acts = Array.isArray(def.actions) ? def.actions : [];
    return acts;
  }

  function actRate(act) {
    const v = Number(act?.rate ?? act?.successRate ?? act?.hitRate ?? 100);
    if (!Number.isFinite(v)) return 100;
    return Math.max(0, Math.min(100, Math.trunc(v)));
  }

  function getActDeltas(act) {
    let hpDelta = 0;
    let spDelta = 0;

    const hpDeltaRaw = act?.hpDelta !== undefined ? Number(act.hpDelta) : undefined;
    const spDeltaRaw = act?.spDelta !== undefined ? Number(act.spDelta) : undefined;

    if (Number.isFinite(hpDeltaRaw)) hpDelta = Math.trunc(hpDeltaRaw);
    if (Number.isFinite(spDeltaRaw)) spDelta = Math.trunc(spDeltaRaw);

    if (!Number.isFinite(hpDeltaRaw) && !Number.isFinite(spDeltaRaw)) {
      const dmg = Number(act?.dmg ?? act?.damage ?? 0);
      const heal = Number(act?.heal ?? 0);
      const dmgType = String(act?.dmgType ?? act?.damageType ?? "HP").toUpperCase();
      const healType = String(act?.healType ?? "HP").toUpperCase();

      if (Number.isFinite(dmg) && dmg) {
        if (dmgType === "SP") spDelta -= Math.trunc(dmg);
        else hpDelta -= Math.trunc(dmg);
      }
      if (Number.isFinite(heal) && heal) {
        if (healType === "SP") spDelta += Math.trunc(heal);
        else hpDelta += Math.trunc(heal);
      }
    }

    return { hpDelta: clamp10(hpDelta), spDelta: clamp10(spDelta) };
  }

  function roll100() {
    return Math.floor(rng() * 100) + 1; // 1..100
  }

  function applyDeltas(target, deltas, mult = 1) {
    if (!target) return { items: [] };
    const items = [];
    const hp = deltas.hpDelta * mult;
    const sp = deltas.spDelta * mult;

    if (hp) {
      target.hp = clamp10(target.hp + hp);
      items.push({ kind: "HP", delta: hp });
    }
    if (sp) {
      target.sp = clamp10(target.sp + sp);
      items.push({ kind: "SP", delta: sp });
    }

    // 0未満防止
    if (target.hp < 0) target.hp = 0;
    if (target.sp < 0) target.sp = 0;
    return { items };
  }

  function estimateExpectedDamage(act) {
    const r = actRate(act) / 100;
    const d = getActDeltas(act);
    const dmg = Math.max(0, -d.hpDelta) + Math.max(0, -d.spDelta);
    return dmg * r;
  }

  // -------------------
  // build teams
  // -------------------
  function makeUnit(cardId, side) {
    const def = cardDefs?.[cardId] || {};
    const hp = clamp10(def?.hp ?? 100);
    const sp = clamp10(def?.sp ?? 100);
    return {
      id: uid(),
      cardId,
      name: cardName(cardId),
      side, // "you" | "enemy"
      hp,
      sp,
      maxHp: hp,
      maxSp: sp,
      guard: false,
      focus: false,
    };
  }

  function buildEnemyTeam(stageIdx) {
    // 適当に敵プールから3体（同一OK/NGは好みで）
    const pool = Object.keys(cardDefs || {}).filter((id) => {
      const def = cardDefs[id];
      // supportは除外
      const kind = String(def?.kind ?? "").toLowerCase();
      return kind !== "support";
    });
    // 何もなければ適当に3つ
    const picked = [];
    for (let i = 0; i < 3; i++) {
      const id = pool[Math.floor(rng() * pool.length)] || pool[0];
      picked.push(id);
    }
    return picked.map((id) => makeUnit(id, "enemy"));
  }

  // -------------------
  // UI render
  // -------------------
  function renderTeam(el, team, clickable) {
    if (!el) return;
    el.innerHTML = "";

    for (const u of team) {
      const c = document.createElement("div");
      c.className = "b3_unit" + (ST.selectedUnitId === u.id ? " sel" : "");
      const dead = !alive(u);
      if (dead) c.classList.add("dead");

      const t = document.createElement("div");
      t.className = "b3_title";
      t.textContent = `${u.name}`;

      const bars = document.createElement("div");
      bars.className = "b3_bars";
      bars.innerHTML = `
        <div class="b3_bar"><span>HP</span><b>${u.hp}/${u.maxHp}</b></div>
        <div class="b3_bar"><span>SP</span><b>${u.sp}/${u.maxSp}</b></div>
      `;

      const st = document.createElement("div");
      st.className = "b3_st";
      st.textContent = `${u.guard ? "🛡Guard " : ""}${u.focus ? "🎯Focus" : ""}`.trim();

      const plan = ST.plan.get(u.id);
      const pl = document.createElement("div");
      pl.className = "b3_plan";
      pl.textContent = plan ? `命令: ${plan.type}` : "";

      c.appendChild(t);
      c.appendChild(bars);
      c.appendChild(st);
      c.appendChild(pl);

      if (clickable && alive(u)) {
        c.addEventListener("click", () => {
          ST.selectedUnitId = u.id;
          ST.selectedTargetId = null;
          renderAll();
        });
      }

      el.appendChild(c);
    }
  }

  function renderCmdPanel() {
    if (!cmdPanelEl) return;
    cmdPanelEl.innerHTML = "";

    if (ST.phase !== "plan") {
      cmdPanelEl.innerHTML = `<div class="b3_hint">処理中…</div>`;
      return;
    }

    const youUnits = teamAlive(ST.you);
    const sel = youUnits.find((u) => u.id === ST.selectedUnitId) || youUnits[0] || null;
    if (!sel) {
      cmdPanelEl.innerHTML = `<div class="b3_hint">味方がいない…</div>`;
      return;
    }
    ST.selectedUnitId = sel.id;

    const head = document.createElement("div");
    head.className = "b3_head";
    head.innerHTML = `
      <div><b>TURN ${ST.turn}</b> / Mana <b>${ST.mana}</b> / 10</div>
      <div class="b3_small">選択中：${sel.name}</div>
    `;
    cmdPanelEl.appendChild(head);

    // 技ボタン（コスト消費：共有マナ）
    const acts = getActs(sel.cardId).filter((a) => Number(a?.cost ?? 0) >= 0);
    const actWrap = document.createElement("div");
    actWrap.className = "b3_actions";

    for (const act of acts) {
      const cost = Math.max(0, Math.trunc(Number(act.cost ?? 0)));
      const rate = actRate(act);
      const deltas = getActDeltas(act);
      const txt = [];
      if (deltas.hpDelta < 0) txt.push(`HP-${Math.abs(deltas.hpDelta)}`);
      if (deltas.spDelta < 0) txt.push(`SP-${Math.abs(deltas.spDelta)}`);
      if (deltas.hpDelta > 0) txt.push(`HP+${deltas.hpDelta}`);
      if (deltas.spDelta > 0) txt.push(`SP+${deltas.spDelta}`);

      const b = document.createElement("button");
      b.className = "b3_btn";
      b.disabled = cost > ST.mana;
      b.innerHTML = `<b>${act.name ?? "?"}</b><span>cost:${cost} / hit:${rate}% / ${txt.join(" ") || "—"}</span>`;
      b.addEventListener("click", () => {
        // 単体攻撃扱い：ターゲットが必要
        ST.plan.set(sel.id, { type: `Attack:${act.name ?? "?"}`, data: { act } });
        setStatus(`対象を選んでね（敵クリック）`);
        renderAll();
      });
      actWrap.appendChild(b);
    }
    cmdPanelEl.appendChild(actWrap);

    // Guard / Focus / Pass
    const util = document.createElement("div");
    util.className = "b3_utils";

    const mk = (label, onClick) => {
      const b = document.createElement("button");
      b.className = "b3_btn ghost";
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };

    util.appendChild(
      mk("🛡 Guard（被ダメ半減）", () => {
        ST.plan.set(sel.id, { type: "Guard", data: {} });
        renderAll();
      })
    );
    util.appendChild(
      mk("🎯 Focus（命中+20%）", () => {
        ST.plan.set(sel.id, { type: "Focus", data: {} });
        renderAll();
      })
    );
    util.appendChild(
      mk("⏭ Pass", () => {
        ST.plan.set(sel.id, { type: "Pass", data: {} });
        renderAll();
      })
    );

    cmdPanelEl.appendChild(util);

    // ターゲット選択説明
    const hint = document.createElement("div");
    hint.className = "b3_hint";
    hint.textContent = `敵をクリックすると対象が選べるよ。命令は味方3体ぶん入れて「ターン実行」。`;
    cmdPanelEl.appendChild(hint);
  }

  function renderAll() {
    setStatus(`TURN ${ST.turn} / Mana ${ST.mana}/10  | 命令:${ST.plan.size}/3`);
    renderTeam(yourTeamEl, ST.you, true);
    renderTeam(enemyTeamEl, ST.enemy, false);
    renderCmdPanel();

    // 敵クリックでターゲット指定
    if (enemyTeamEl) {
      const cards = [...enemyTeamEl.querySelectorAll(".b3_unit")];
      const enemies = ST.enemy;
      cards.forEach((el, idx) => {
        const u = enemies[idx];
        if (!u || !alive(u)) return;
        el.addEventListener("click", () => {
          ST.selectedTargetId = u.id;

          // 選択中味方の命令が Attack なら target をセット
          const youUnits = teamAlive(ST.you);
          const sel = youUnits.find((x) => x.id === ST.selectedUnitId);
          if (!sel) return;

          const p = ST.plan.get(sel.id);
          if (p && String(p.type).startsWith("Attack:")) {
            p.data.targetId = u.id;
            ST.plan.set(sel.id, p);
            setStatus(`対象: ${u.name} を指定した`);
          }
          renderAll();
        });
      });
    }

    // ターン実行ボタン
    if (btnTurn) {
      const ready = isPlanReady();
      btnTurn.disabled = !ready;
      btnTurn.textContent = ready ? "ターン実行" : "命令を3体ぶん入れてね";
    }
  }

  function isPlanReady() {
    const youUnits = teamAlive(ST.you);
    if (youUnits.length === 0) return false;
    // 生存味方（最大3）ぶん plan があること
    for (const u of youUnits.slice(0, 3)) {
      const p = ST.plan.get(u.id);
      if (!p) return false;
      if (String(p.type).startsWith("Attack:")) {
        if (!p.data?.act) return false;
        if (!p.data?.targetId) return false; // ターゲット必須
        const cost = Math.max(0, Math.trunc(Number(p.data.act.cost ?? 0)));
        if (cost > ST.manaCap) return false;
      }
    }
    return true;
  }

  // -------------------
  // resolve turn
  // -------------------
  function clearTempFlags() {
    for (const u of ST.you) {
      u.guard = false;
      u.focus = false;
    }
    for (const u of ST.enemy) {
      u.guard = false;
      u.focus = false;
    }
  }

  function applyCommandFlags(unit, plan) {
    if (!unit || !plan) return;
    if (plan.type === "Guard") unit.guard = true;
    if (plan.type === "Focus") unit.focus = true;
  }

  function hitRoll(rate, focus) {
    let r = Math.max(0, Math.min(100, Math.trunc(rate)));
    if (focus) r = Math.min(100, r + 20);
    const d = roll100();
    return { d, ok: d <= r };
  }

  function pickEnemyPlan() {
    // 敵は「マナ内で期待値最大の技」+ ターゲットは生存からランダム
    const aliveEnemies = teamAlive(ST.enemy);
    const aliveYou = teamAlive(ST.you);
    const plan = new Map();

    for (const e of aliveEnemies.slice(0, 3)) {
      const acts = getActs(e.cardId);
      const usable = acts
        .map((act) => ({ act, cost: Math.max(0, Math.trunc(Number(act?.cost ?? 0))) }))
        .filter((x) => x.cost <= ST.mana);

      if (!usable.length || !aliveYou.length) {
        // 何もできないなら Guard
        plan.set(e.id, { type: "Guard", data: {} });
        continue;
      }

      usable.sort((a, b) => estimateExpectedDamage(b.act) - estimateExpectedDamage(a.act));
      const best = usable[0].act;
      const tgt = aliveYou[Math.floor(rng() * aliveYou.length)];

      plan.set(e.id, { type: `Attack:${best.name ?? "?"}`, data: { act: best, targetId: tgt.id } });
    }
    return plan;
  }

  function spendMana(cost) {
    ST.mana = Math.max(0, ST.mana - cost);
  }

  function damageGuarded(target, delta) {
    // Guard: 受けるダメージ（負のdelta）だけ半減。回復は半減しない
    if (!target.guard) return delta;
    if (delta < 0) return Math.trunc(delta / 2);
    return delta;
  }

  function execAttack(attacker, plan, enemySide) {
    const act = plan?.data?.act;
    const tgtId = plan?.data?.targetId;
    if (!act || !tgtId) return;

    const cost = Math.max(0, Math.trunc(Number(act.cost ?? 0)));
    if (cost > ST.mana) {
      log(`(${attacker.name}) マナ不足で不発`);
      return;
    }
    spendMana(cost);

    const targets = enemySide === "enemy" ? ST.enemy : ST.you;
    const target = targets.find((u) => u.id === tgtId && alive(u));
    if (!target) {
      log(`(${attacker.name}) 対象がいない`);
      return;
    }

    const deltas = getActDeltas(act);
    const rate = actRate(act);
    const roll = hitRoll(rate, attacker.focus);

    if (!roll.ok) {
      log(`❌ ${attacker.name} の ${act.name}（${roll.d}/${rate}%）→ ミス`);
      return;
    }

    // ガード補正
    const hpDelta = damageGuarded(target, deltas.hpDelta);
    const spDelta = damageGuarded(target, deltas.spDelta);

    const applied = applyDeltas(target, { hpDelta, spDelta }, 1);
    const txt = [];
    for (const it of applied.items) {
      if (it.delta < 0) txt.push(`${it.kind}-${Math.abs(it.delta)}`);
      if (it.delta > 0) txt.push(`${it.kind}+${it.delta}`);
    }

    log(`✅ ${attacker.name} の ${act.name} → ${target.name} (${txt.join(" ") || "—"})`);

    if (target.hp <= 0) {
      log(`💀 ${target.name} は倒れた`);
    }
  }

  async function resolveTurn() {
    if (ST.phase !== "plan") return;
    ST.phase = "resolve";
    btnTurn && (btnTurn.disabled = true);

    clearTempFlags();

    // 命令で guard/focus だけ先に反映（先制の形）
    const aliveYou = teamAlive(ST.you);
    for (const u of aliveYou) {
      applyCommandFlags(u, ST.plan.get(u.id));
    }

    const enemyPlan = pickEnemyPlan();
    for (const e of teamAlive(ST.enemy)) {
      applyCommandFlags(e, enemyPlan.get(e.id));
    }

    // 1) 味方行動
    for (const u of aliveYou) {
      const p = ST.plan.get(u.id);
      if (!p) continue;
      if (String(p.type).startsWith("Attack:")) execAttack(u, p, "enemy");
      // Guard/Focus/Passは何もしない
      if (checkEnd()) return;
      await sleep(250);
    }

    // 2) 敵行動
    const aliveEnemy = teamAlive(ST.enemy);
    for (const e of aliveEnemy) {
      const p = enemyPlan.get(e.id);
      if (!p) continue;
      if (String(p.type).startsWith("Attack:")) execAttack(e, p, "you");
      if (checkEnd()) return;
      await sleep(250);
    }

    // ターン終了 → 次ターン準備
    ST.turn += 1;
    ST.mana = Math.min(ST.manaCap, ST.mana + ST.manaGain);
    ST.plan.clear();
    ST.phase = "plan";
    ST.selectedTargetId = null;

    setStatus(`次のターン：命令を入れてね`);
    renderAll();
  }

  function checkEnd() {
    const ya = teamAlive(ST.you).length;
    const ea = teamAlive(ST.enemy).length;
    if (ya <= 0 || ea <= 0) {
      ST.winner = ya > 0 ? "you" : "enemy";
      endBattle(ST.winner === "you");
      return true;
    }
    return false;
  }

  async function endBattle(win) {
    ST.phase = "end";
    btnTurn && (btnTurn.disabled = true);
    btnRetreat && (btnRetreat.disabled = true);

    log(win ? "🏁 勝利！" : "💀 敗北…");

    await onBattleEnd?.(win, {
      turn: ST.turn,
      stage: getStageIndex?.() ?? 0,
      youAlive: teamAlive(ST.you).length,
      enemyAlive: teamAlive(ST.enemy).length,
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // -------------------
  // public API
  // -------------------
  function start() {
    // build you team from deck picks
    const picks = getDeckPicks?.() || [];
    const youCards = picks.slice(0, 3);

    ST.you = youCards.map((id) => makeUnit(id, "you"));

    // enemy
    ST.enemy = buildEnemyTeam(getStageIndex?.() ?? 0);

    ST.turn = 1;
    ST.mana = 2;
    ST.plan.clear();
    ST.phase = "plan";
    ST.selectedUnitId = ST.you[0]?.id ?? null;
    ST.selectedTargetId = null;

    log(`⚔️ 3vs3 Battle Start!`);
    renderAll();
  }

  function bind() {
    btnTurn?.addEventListener("click", () => {
      if (ST.phase !== "plan") return;
      if (!isPlanReady()) return;
      resolveTurn();
    });

    btnRetreat?.addEventListener("click", () => {
      if (ST.phase === "end") return;
      endBattle(false);
    });
  }

  bind();

  return { start };
}