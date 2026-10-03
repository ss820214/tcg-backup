// public/cpu_ai.js
// v1 CPU (rule-based + scoring)
// - Separate from game.js for easy editing

export function createCpuAI(options = {}) {
  const cfg = {
    seat: options.seat ?? "B",
    thinkDelayMs: options.thinkDelayMs ?? 250,
    // 重み（ここをいじると性格が変わる）
    w: {
      killBonus: 120,
      hpDmg: 1.0,
      spDmg: 1.15,
      status: 14,
      hitRate: 1.0, // 命中率重視
      selfPreserve: 1.2,
      advance: 0.9,
      center: 0.15,
      goalRush: 2.0, // 侵入勝ち狙い
      panicAvoid: 2.0,
      exposePenalty: 0.9, // 反撃受けそうな位置のペナルティ
    },
    // 状態異常のざっくり点数（ゲームに合わせて増やしてOK）
    statusScore: {
      fracture: 22,
      bleed: 16,
      poison: 14,
      smell: 10,
      stun: 24,
      slow: 10,
      panic: 18,
      // unknown は軽め
      _default: 8,
    },
    ...options,
  };

  // ====== Public API ======
 return {
  pickAction,
  scoreAttackPlan: scoreAttackCandidate,
  scoreMovePlan: scoreMoveCandidate,
};

  // ====== Core: choose best action this turn ======
  function pickAction(st, ctx) {
    // ctx: {
    //   mySeat, enemySeat,
    //   myMana, hand, etc... (game.js側の情報があれば渡す)
    //   helpers: { getUnitById, listLegalMoves, listLegalAttacks, ... } (あれば)
    // }
    const mySeat = ctx?.mySeat ?? cfg.seat;
    const enemySeat = ctx?.enemySeat ?? (mySeat === "A" ? "B" : "A");

    const myUnits = (st.units || []).filter(u => u && u.owner === mySeat && u.hp > 0);
    const enUnits = (st.units || []).filter(u => u && u.owner === enemySeat && u.hp > 0);

    // 1) 侵入勝ちが近いなら、ゴール優先（盤面ルールがあるならここを強くする）
    //    ※ ctx.helpers で「ゴール判定」「前進距離」が取れるならもっと正確にできる
    const rushPlan = tryGoalRush(st, ctx, myUnits, enUnits);
    if (rushPlan) return rushPlan;

    // 2) 攻撃候補（期待値最大）
    const bestAtk = findBestAttack(st, ctx, myUnits, enUnits);
    if (bestAtk) return bestAtk;

    // 3) サポート候補（任意：ctx.helpers がある時だけ）
    const bestSup = findBestSupport(st, ctx, myUnits, enUnits);
    if (bestSup) return bestSup;

    // 4) 移動候補（敵に近づく/安全に前進）
    const bestMv = findBestMove(st, ctx, myUnits, enUnits);
    if (bestMv) return bestMv;

    // 5) 何もしない
    return { type: "end" };
  }

  // ====== Attack ======
  function findBestAttack(st, ctx, myUnits, enUnits) {
    const listLegalAttacks = ctx?.helpers?.listLegalAttacks;
    const getUnitById = ctx?.helpers?.getUnitById;

    let best = null;
    let bestScore = -1e18;

    for (const u of myUnits) {
      const candidates = listLegalAttacks
        ? listLegalAttacks(st, u)
        : fallbackListAttacks(st, u, enUnits, ctx);

      for (const c of candidates) {
        // c: { attackerId, actionIndex, targets:[id...] } or { targetId }
        const score = scoreAttackCandidate(st, ctx, c, myUnits, enUnits, getUnitById);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }

    if (!best) return null;

    return {
      type: "attack",
      attackerId: best.attackerId,
      actionIndex: best.actionIndex,
      targetId: best.targetId ?? (best.targets?.[0] ?? null),
      // AOEなら targets を使う実装でもOK
      targets: best.targets ?? null,
      meta: { score: bestScore },
    };
  }

  function scoreAttackCandidate(st, ctx, c, myUnits, enUnits, getUnitById) {
    const attacker = getUnitById ? getUnitById(c.attackerId) : (st.units || []).find(x => x?.id === c.attackerId);
    if (!attacker) return -1e18;

    // game.js の action 構造が不明なので「それっぽく」取る（必要ならここを合わせる）
    const action = getActionsForUnit(attacker, ctx)[c.actionIndex];
    if (!action) return -1e18;

    const hit = clamp01((action.hitRate ?? action.success ?? 100) / 100);
    const hpD = Math.abs(Number(action.damageHP ?? action.damage ?? action.hpDelta ?? 0));
    const spD = Math.abs(Number(action.damageSP ?? action.spDelta ?? 0));
    const status = action.status || action.addStatus || null;

    // 対象が複数あるなら総和
    const targetIds = c.targets?.length ? c.targets : (c.targetId ? [c.targetId] : []);
    if (!targetIds.length) return -1e18;

    let score = 0;
    for (const tid of targetIds) {
      const t = getUnitById ? getUnitById(tid) : (st.units || []).find(x => x?.id === tid);
      if (!t) continue;

      const expected = (hpD * cfg.w.hpD + spD * cfg.w.spDmg) * hit * cfg.w.hitRate;
      score += expected;

      // 追い打ち（トドメ）
      const killLikely = (t.hp <= hpD) && hit >= 0.5;
      if (killLikely) score += cfg.w.killBonus;

      // 状態異常ボーナス
      if (status) score += scoreStatus(status) * hit * cfg.w.status;
    }

    // 自分が危ない時は「確実性」を上げる（命中が低い技を避ける）
    if (attacker.hp <= 20) score += hit * 10;

    return score;
  }

  function scoreStatus(s) {
    // s が {type:"bleed", ...} でも "bleed" でも対応
    const key = typeof s === "string" ? s : String(s?.type ?? s?.name ?? "").toLowerCase();
    if (!key) return cfg.statusScore._default;
    return cfg.statusScore[key] ?? cfg.statusScore._default;
  }

  // ====== Support (optional) ======
  function findBestSupport(st, ctx, myUnits, enUnits) {
    const listLegalSupports = ctx?.helpers?.listLegalSupports;
    if (!listLegalSupports) return null; // game.js 側のサポート構造に依存するので任意

    const supports = listLegalSupports(st);
    let best = null;
    let bestScore = -1e18;

    for (const s of supports) {
      const score = scoreSupportCandidate(st, ctx, s, myUnits, enUnits);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) return null;

    return { type: "support", ...best, meta: { score: bestScore } };
  }

  function scoreSupportCandidate(st, ctx, s, myUnits, enUnits) {
    // 例: 回復・ドロー・バフをざっくり評価
    const kind = String(s.kind ?? s.type ?? "").toLowerCase();
    let score = 0;

    if (kind.includes("heal")) {
      const tgt = s.targetId ? (st.units || []).find(u => u?.id === s.targetId) : null;
      const low = tgt ? (1 - clamp01((tgt.hp ?? 1) / (tgt.maxHp ?? 100))) : 0.4;
      score += 60 * low;
    }
    if (kind.includes("draw")) score += 18;
    if (kind.includes("buff")) score += 22;

    return score;
  }

  // ====== Move ======
  function findBestMove(st, ctx, myUnits, enUnits) {
    const listLegalMoves = ctx?.helpers?.listLegalMoves;

    let best = null;
    let bestScore = -1e18;

    for (const u of myUnits) {
      const moves = listLegalMoves ? listLegalMoves(st, u) : fallbackListMoves(st, u, myUnits, enUnits, ctx);
      for (const mv of moves) {
        const c = { unitId: u.id, to: mv.to };
        const score = scoreMoveCandidate(st, ctx, c, myUnits, enUnits);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
    }
    if (!best) return null;

    return { type: "move", ...best, meta: { score: bestScore } };
  }

  function scoreMoveCandidate(st, ctx, c, myUnits, enUnits) {
    const getUnitById = ctx?.helpers?.getUnitById;
    const dist = ctx?.helpers?.manhattanDist ?? ((a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
    const enemyThreatAt = ctx?.helpers?.enemyThreatAt; // あれば「そこに移動したときの被弾確率」を見積もれる
    const goalProgress = ctx?.helpers?.goalProgress;   // あれば侵入に近いほど加点

    const u = getUnitById ? getUnitById(c.unitId) : (st.units || []).find(x => x?.id === c.unitId);
    if (!u) return -1e18;

    const to = c.to;
    let score = 0;

    // 敵に近づく（ただし無防備突撃は避ける）
    const nearest = nearestEnemy(enUnits, to, dist);
    if (nearest) score += cfg.w.advance * (12 - nearest.d); // 近いほど高い

    // 中央寄り（雑に盤面中心へ）
    if (ctx?.helpers?.boardCenter) {
      const center = ctx.helpers.boardCenter(st);
      score += cfg.w.center * (10 - dist(to, center));
    }

    // ゴールへ前進
    if (goalProgress) {
      score += cfg.w.goalRush * goalProgress(st, u, to);
    }

    // 危険地回避
    if (enemyThreatAt) {
      const danger = enemyThreatAt(st, to, u.owner); // 0..1
      score -= cfg.w.exposePenalty * danger * 40;
    }

    // HP低い時は安全優先
    if ((u.hp ?? 999) <= 20 && enemyThreatAt) {
      const danger = enemyThreatAt(st, to, u.owner);
      score -= cfg.w.selfPreserve * danger * 55;
    }

    // パニック/移動不能っぽいのは避ける（情報が取れるなら）
    if (u.panic) score -= cfg.w.panicAvoid * 50;

    return score;
  }

  function nearestEnemy(enUnits, pos, dist) {
    let best = null;
    for (const e of enUnits) {
      const ePos = normalizePos(e);
      if (!ePos) continue;
      const d = dist(pos, ePos);
      if (!best || d < best.d) best = { e, d };
    }
    return best;
  }

  // ====== Goal rush ======
  function tryGoalRush(st, ctx, myUnits, enUnits) {
    // 侵入勝ち条件が ctx.helpers にあるときだけ強く動く
    const canWinByInfil = ctx?.helpers?.canWinByInfiltration;
    const bestInfilMove = ctx?.helpers?.bestInfilMove;
    if (!canWinByInfil || !bestInfilMove) return null;

    if (!canWinByInfil(st, cfg.seat)) return null;

    const mv = bestInfilMove(st, cfg.seat);
    if (!mv) return null;

    return { type: "move", unitId: mv.unitId, to: mv.to, meta: { reason: "goalRush" } };
  }

  // ====== Fallbacks (when helpers not provided) ======
  function fallbackListAttacks(st, unit, enUnits, ctx) {
    // helpers が無いときでも最低限動くための簡易判定：
    // - unit.pos / enemy.pos がある前提
    // - 射程は action.range / action.rangeMin / action.rangeMax があれば使う
    // - 無ければ「隣接(1)」
    const dist = ctx?.helpers?.manhattanDist ?? ((a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y));

    const actions = getActionsForUnit(unit, ctx);
    const res = [];

    const unitPos = normalizePos(unit);
    if (!unitPos) return res;

    for (let i = 0; i < actions.length; i++) {
      const a = actions[i] || {};
      const rMin = Number.isFinite(a.rangeMin) ? a.rangeMin : 0;
      const rMax = Number.isFinite(a.rangeMax)
        ? a.rangeMax
        : (Number.isFinite(a.range) ? a.range : 1);

      const targets = [];
      for (const e of enUnits || []) {
        const ePos = normalizePos(e);
        if (!ePos || e.hp <= 0) continue;
        const d = dist(unitPos, ePos);
        if (d >= rMin && d <= rMax) targets.push(e.id);
      }

      // targets が無い攻撃は候補にしない（scoreAttackCandidate が -1e18 になるので）
      if (targets.length) {
        // 近い順で並べておく（単体攻撃なら先頭が使われる）
        targets.sort((id1, id2) => {
          const e1 = (enUnits || []).find(x => x?.id === id1);
          const e2 = (enUnits || []).find(x => x?.id === id2);
          const p1 = normalizePos(e1);
          const p2 = normalizePos(e2);
          const d1 = p1 ? dist(unitPos, p1) : 999;
          const d2 = p2 ? dist(unitPos, p2) : 999;
          return d1 - d2;
        });

        res.push({ attackerId: unit.id, actionIndex: i, targets });
      }
    }

    return res;
  }

  function fallbackListMoves(st, unit, myUnits, enUnits, ctx) {
    // helpers が無いときの簡易移動：
    // - 4近傍に1マス移動
    // - 盤外チェックは st.boardW/H, st.width/height, st.board?.w/h があれば使う
    // - 味方/敵の占有マスは避ける
    const unitPos = normalizePos(unit);
    if (!unitPos) return [];

    const w = st?.boardW ?? st?.width ?? st?.board?.w ?? st?.board?.width ?? null;
    const h = st?.boardH ?? st?.height ?? st?.board?.h ?? st?.board?.height ?? null;

    const occupied = new Set();
    for (const u of (st.units || [])) {
      const p = normalizePos(u);
      if (!p || u.hp <= 0) continue;
      occupied.add(`${p.x},${p.y}`);
    }

    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    const res = [];
    for (const d of dirs) {
      const to = { x: unitPos.x + d.x, y: unitPos.y + d.y };

      if (w != null && (to.x < 0 || to.x >= w)) continue;
      if (h != null && (to.y < 0 || to.y >= h)) continue;

      // 自分の現在地は occupied に入っているので、そこだけ特例で許可しない
      const key = `${to.x},${to.y}`;
      if (occupied.has(key)) continue;

      res.push({ to });
    }

    return res;
  }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  function normalizePos(u) {
    if (!u) return null;
    if (u.pos && Number.isFinite(Number(u.pos.x)) && Number.isFinite(Number(u.pos.y))) {
      return { x: Number(u.pos.x), y: Number(u.pos.y) };
    }
    if (Number.isFinite(Number(u.x)) && Number.isFinite(Number(u.y))) {
      return { x: Number(u.x), y: Number(u.y) };
    }
    return null;
  }

  function getActionsForUnit(unit, ctx) {
    const fromHelper = ctx?.helpers?.getActionsForUnit?.(unit);
    if (Array.isArray(fromHelper)) return fromHelper;
    return unit?.actions || unit?.skills || [];
  }
}
