// public/evolve_system.js
// v20260205_evolve_system_fix_fatigue_actions
// - 進化時に疲労系ステータスを確実に解除（fatigue/tired/exhaust/疲労 など）
// - （任意）evoDef.actions が定義されている場合のみ、ユニットの actions を進化先で上書き（技重複の温床対策）
// - 既存機能は削らない（進化手順/候補表示/マナ差分支払い/HPSP差分加算/ログ/勝利判定など維持）

import { runTransaction } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export function createEvolveSystem(deps) {
  const {
    db,
    stateRef,
    getSeat, // ()=> "A"|"B"
    canControl, // (st)=>bool
    normalizeMana, // (manaObj)=> normalized
    spendManaMut, // (manaObj, who, cost)=> manaObj
    nowMs, // ()=>ms
    round10,
    clampUnitStats10,
    cardDefsRef, // ()=> cardDefs map
    cardName, // (cardId)=> string
    logPush, // (st,line)=>void
    checkWinLocal, // (st)=> "A"|"B"|null
    isPanic, // (unit)=>bool
  } = deps;

  // internal state
  let baseUnitId = null;
  let candidateSet = new Set(); // hand indices

  function reset() {
    baseUnitId = null;
    candidateSet = new Set();
  }

  function getBaseUnitId() {
    return baseUnitId;
  }
  function getCandidates() {
    return candidateSet;
  }
  function isCandidate(i) {
    return candidateSet?.has(i);
  }

  function clearFatigueLike(u) {
    if (!u) return;

    // ★プロジェクト内の揺れに合わせて多めに吸う
    const KEYS = [
      "fatigue",
      "fatigued",
      "tired",
      "tire",
      "exhaust",
      "exhausted",
      "疲労",
    ];

    // status: { fatigue: ... }
    if (u.status && typeof u.status === "object") {
      for (const k of KEYS) delete u.status[k];
    }

    // statuses: ["fatigue", ...]
    if (Array.isArray(u.statuses)) {
      u.statuses = u.statuses.filter((x) => !KEYS.includes(String(x)));
    }

    // tags: ["fatigue", ...]
    if (Array.isArray(u.tags)) {
      u.tags = u.tags.filter((x) => !KEYS.includes(String(x)));
    }

    // 直フィールド型
    for (const k of KEYS) {
      if (k in u) delete u[k];
    }
  }

  function deepClone(obj) {
    try {
      if (globalThis.structuredClone) return structuredClone(obj);
    } catch {}
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  }

  function computeCandidates(st, baseUnit) {
    const seat = getSeat();
    const res = new Set();
    if (!st || !baseUnit) return res;

    const cardDefs = cardDefsRef();
    const baseDef = cardDefs?.[baseUnit.cardId];
    if (!baseDef) return res;

    const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
    const mana = normalizeMana(st.mana);

    for (let i = 0; i < hand.length; i++) {
      const cid = hand[i];
      const evoDef = cardDefs?.[cid];
      if (!evoDef) continue;

      // 同属性 + コスト増
      if (String(evoDef.type ?? "") !== String(baseDef.type ?? "")) continue;
      if (!(Number(evoDef.cost) > Number(baseDef.cost))) continue;

      const extra = Math.max(
        0,
        Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)),
      );
      if ((mana?.[seat]?.cur ?? 0) < extra) continue;

      res.add(i);
    }
    return res;
  }

  // 盤面ユニットをクリックした時（進化元決定）
  function onPickBaseUnit(u, st) {
    const seat = getSeat();
    if (!st || !u) return { ok: false };
    if (!canControl(st)) return { ok: false };
    if (u.owner !== seat) return { ok: false };
    if (Number(u.hp) <= 0) return { ok: false };
    if (isPanic(u)) return { ok: false };

    baseUnitId = u.id;
    candidateSet = computeCandidates(st, u);

    return { ok: true, baseUnitId, candidates: candidateSet };
  }

  // 手札カードDOMを装飾（候補なら光らせ、ボタンを出す）
  function decorateHandCard({ cardEl, index, cardId, st, onShowDetail }) {
    if (!cardEl) return;

    // 進化元が未選択なら候補も出さない
    const isCand = baseUnitId && candidateSet && candidateSet.has(index);
    if (isCand) cardEl.classList.add("evoCandidate");
    else cardEl.classList.remove("evoCandidate");

    // 既存ボタンがあれば更新だけ
    let btn = cardEl.querySelector(".hcEvoBtn");
    if (!isCand) {
      if (btn) btn.remove();
      return;
    }

    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hcEvoBtn";
      btn.textContent = "進化";
      btn.title = "このカードで進化";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          onShowDetail?.(cardId);
        } catch {}
        await execEvolveFromHandIndex(index);
      });
      cardEl.appendChild(btn);
    }
  }

  function canExec(st, handIndex) {
    if (!st) return false;
    if (!canControl(st)) return false;
    if (!baseUnitId) return false;
    if (handIndex == null) return false;
    return candidateSet?.has(handIndex);
  }

  async function execEvolveFromHandIndex(handIndex) {
    const seat = getSeat();

    // 現在表示のstateを信用しすぎず、トランザクション内で再検証する
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;

      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];
      s.hands = s.hands || { A: [], B: [] };

      const base = s.units.find((u) => u.id === baseUnitId) || null;
      if (!base || base.owner !== seat) return;
      if (Number(base.hp) <= 0) return;
      if (isPanic(base)) return;

      const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];
      if (handIndex == null || handIndex < 0 || handIndex >= hand.length)
        return;

      const evoCardId = hand[handIndex];
      const cardDefs = cardDefsRef();
      const baseDef = cardDefs?.[base.cardId];
      const evoDef = cardDefs?.[evoCardId];
      if (!baseDef || !evoDef) return;

      // 同属性＆コスト増
      if (String(evoDef.type ?? "") !== String(baseDef.type ?? "")) return;
      if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

      const extra = Math.max(
        0,
        Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)),
      );
      const mana = normalizeMana(s.mana);
      if ((mana?.[seat]?.cur ?? 0) < extra) return;

      // 支払い
      s.mana = spendManaMut(s.mana, seat, extra);

      const fromId = base.cardId;

      // ===== 最大値（HP/SP）を unit に持たせる：無ければ初期化 =====
      const oldMaxHp = round10(
        Number(base.maxHp ?? baseDef.hp ?? base.hp ?? 0),
      );
      const oldMaxSp = round10(
        Number(base.maxSp ?? baseDef.sp ?? base.sp ?? 0),
      );

      const oldCurHp = Math.max(
        0,
        Math.min(round10(Number(base.hp ?? 0)), oldMaxHp || 0),
      );
      const oldCurSp = Math.max(
        0,
        Math.min(round10(Number(base.sp ?? 0)), oldMaxSp || 0),
      );

      const newMaxHp = round10(Number(evoDef.hp ?? 0));
      const newMaxSp = round10(Number(evoDef.sp ?? 0));

      // 最大値更新
      base.maxHp = newMaxHp;
      base.maxSp = newMaxSp;

      // ===== 進化は必ず成立（失敗なし） =====
      // 受けている損傷量（= 最大値 - 現在値）を引き継ぐ。
      // 進化先の最大値を参照し、損傷が深すぎて 0 以下になる場合は「進化直後に破壊」。
      let diedByOverDamage = false;

      const dmgTakenHp = Math.max(0, round10(oldMaxHp - oldCurHp));
      const dmgTakenSp = Math.max(0, round10(oldMaxSp - oldCurSp));

      base.hp = round10(newMaxHp - dmgTakenHp);
      base.sp = round10(newMaxSp - dmgTakenSp);

      if (base.hp <= 0 || base.sp <= 0) {
        diedByOverDamage = true;
        base.hp = 0;
        base.sp = 0;
      }

      clampUnitStats10(base);
      // ★カードID更新
      base.cardId = evoCardId;

      // ★進化で疲労解除（game.js は unit.fatigue を見てる）
      base.fatigue = false;

      // ★進化で疲労だけ解除
      clearFatigueLike(base);

      // ★技重複っぽい挙動の温床対策：
      //    進化先定義に actions がある時だけ、ユニットの actions を進化先に差し替える
      //    （actions 未定義なら “既存維持” して機能を落とさない）
      if (Array.isArray(evoDef.actions)) {
        base.actions = deepClone(evoDef.actions);
      }

      // 手札消費
      hand.splice(handIndex, 1);
      s.hands[seat] = hand;

      // ログ
      logPush(
        s,
        `[${seat}] 進化：${cardName(fromId)} → ${cardName(evoCardId)}（追加マナ:${extra}）`,
      );
      if (diedByOverDamage) {
        logPush(
          s,
          `💥 進化直後に破壊：損傷が進化先の最大値を超過（HP/SP）`,
        );
      }
      s.lastEvolve = {
        at: nowMs(),
        owner: seat,
        baseId: baseUnitId,
        to: evoCardId,
      };

      // 勝利判定
      const w = checkWinLocal(s);
      if (w) {
        s.winner = w;
        logPush(s, `🏁 勝者：${w}`);
      }

      tx.set(stateRef, s, { merge: true });
    });
  }

  return {
    reset,
    getBaseUnitId,
    getCandidates,
    isCandidate,
    onPickBaseUnit,
    decorateHandCard,
    canExec,
    execEvolveFromHandIndex,
  };
}
