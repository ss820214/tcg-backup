// public/evolve_system.js
// v20260204_evolve_system
// - evolve mode: pick base on board -> highlight candidates in hand -> press per-card evolve button to execute
// - game.js から依存関数を注入して使う（機能を落とさない）

import {
  runTransaction
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

export function createEvolveSystem(deps){
  const {
    db, stateRef,
    getSeat,                 // ()=> "A"|"B"
    canControl,              // (st)=>bool
    normalizeMana,           // (manaObj)=> normalized
    spendManaMut,            // (manaObj, who, cost)=> manaObj
    nowMs,                   // ()=>ms
    round10, clampUnitStats10,
    cardDefsRef,             // ()=> cardDefs map
    cardName,                // (cardId)=> string
    logPush,                 // (st,line)=>void
    checkWinLocal,           // (st)=> "A"|"B"|null
    isPanic                  // (unit)=>bool
  } = deps;

  // internal state
  let baseUnitId = null;
  let candidateSet = new Set(); // hand indices

  function reset(){
    baseUnitId = null;
    candidateSet = new Set();
  }

  function getBaseUnitId(){ return baseUnitId; }
  function getCandidates(){ return candidateSet; }
  function isCandidate(i){ return candidateSet?.has(i); }

  function computeCandidates(st, baseUnit){
    const seat = getSeat();
    const res = new Set();
    if (!st || !baseUnit) return res;

    const cardDefs = cardDefsRef();
    const baseDef = cardDefs?.[baseUnit.cardId];
    if (!baseDef) return res;

    const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
    const mana = normalizeMana(st.mana);

    for (let i=0;i<hand.length;i++){
      const cid = hand[i];
      const evoDef = cardDefs?.[cid];
      if (!evoDef) continue;

      // 同属性 + コスト増
      if (String(evoDef.type ?? "") !== String(baseDef.type ?? "")) continue;
      if (!(Number(evoDef.cost) > Number(baseDef.cost))) continue;

      const extra = Math.max(0, Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)));
      if ((mana?.[seat]?.cur ?? 0) < extra) continue;

      res.add(i);
    }
    return res;
  }

  // 盤面ユニットをクリックした時（進化元決定）
  function onPickBaseUnit(u, st){
    const seat = getSeat();
    if (!st || !u) return { ok:false };
    if (!canControl(st)) return { ok:false };
    if (u.owner !== seat) return { ok:false };
    if (Number(u.hp) <= 0) return { ok:false };
    if (isPanic(u)) return { ok:false };

    baseUnitId = u.id;
    candidateSet = computeCandidates(st, u);

    return { ok:true, baseUnitId, candidates: candidateSet };
  }

  // 手札カードDOMを装飾（候補なら光らせ、ボタンを出す）
  function decorateHandCard({ cardEl, index, cardId, st, onShowDetail }){
    if (!cardEl) return;
    const seat = getSeat();

    // 進化元が未選択なら候補も出さない
    const isCand = (baseUnitId && candidateSet && candidateSet.has(index));
    if (isCand) cardEl.classList.add("evoCandidate");
    else cardEl.classList.remove("evoCandidate");

    // 既存ボタンがあれば更新だけ
    let btn = cardEl.querySelector(".hcEvoBtn");
    if (!isCand){
      if (btn) btn.remove();
      return;
    }

    if (!btn){
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hcEvoBtn";
      btn.textContent = "進化";
      btn.title = "このカードで進化";
      btn.addEventListener("click", async (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        try{ onShowDetail?.(cardId); }catch{}
        await execEvolveFromHandIndex(index);
      });
      cardEl.appendChild(btn);
    }
  }

  function canExec(st, handIndex){
    if (!st) return false;
    if (!canControl(st)) return false;
    if (!baseUnitId) return false;
    if (handIndex == null) return false;
    return candidateSet?.has(handIndex);
  }

  async function execEvolveFromHandIndex(handIndex){
    const seat = getSeat();
    // 現在表示のstateを信用しすぎず、トランザクション内で再検証する
    await runTransaction(db, async (tx)=>{
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;

      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];
      s.hands = s.hands || {A:[],B:[]};

      const base = s.units.find(u => u.id === baseUnitId) || null;
      if (!base || base.owner !== seat) return;
      if (Number(base.hp) <= 0) return;
      if (isPanic(base)) return;

      const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];
      if (handIndex == null || handIndex < 0 || handIndex >= hand.length) return;

      const evoCardId = hand[handIndex];
      const cardDefs = cardDefsRef();
      const baseDef = cardDefs?.[base.cardId];
      const evoDef  = cardDefs?.[evoCardId];
      if (!baseDef || !evoDef) return;

      // 同属性＆コスト増
      if (String(evoDef.type ?? "") !== String(baseDef.type ?? "")) return;
      if (!(Number(evoDef.cost) > Number(baseDef.cost))) return;

      const extra = Math.max(0, Math.trunc(Number(evoDef.cost) - Number(baseDef.cost)));
      const mana = normalizeMana(s.mana);
      if ((mana?.[seat]?.cur ?? 0) < extra) return;

      // 支払い
      s.mana = spendManaMut(s.mana, seat, extra);

      // 進化：差分加算（ダメージ維持感）
      const hpDiff = round10(Number(evoDef.hp ?? 0) - Number(baseDef.hp ?? 0));
      const spDiff = round10(Number(evoDef.sp ?? 0) - Number(baseDef.sp ?? 0));

      const fromId = base.cardId;
      base.cardId = evoCardId;
      base.hp = round10(Number(base.hp) + hpDiff);
      base.sp = round10(Number(base.sp) + spDiff);
      clampUnitStats10(base);

      // 手札消費
      hand.splice(handIndex, 1);
      s.hands[seat] = hand;

      // ログ
      logPush(s, `[${seat}] 進化：${cardName(fromId)} → ${cardName(evoCardId)}（追加マナ:${extra}）`);
      s.lastEvolve = { at: nowMs(), owner: seat, baseId: baseUnitId, to: evoCardId };

      // 勝利判定
      const w = checkWinLocal(s);
      if (w){
        s.winner = w;
        logPush(s, `🏁 勝者：${w}`);
      }

      tx.set(stateRef, s, { merge:true });
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
    execEvolveFromHandIndex
  };
}