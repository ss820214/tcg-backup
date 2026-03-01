// public/tutorial_game.js
// Tutorial (local battle) - same UI as game.html, but no Firestore.
// Supports:
// - t=2 : summon "decoy" and explain mana/hand.
// - t=3 : summon "prototype_A", move, then attack an enemy "decoy" placed on board.
//
// NOTE:
// - Uses TutorialSystem overlay from tutorial.js
// - Calls underscore methods (private-ish) but OK for internal use.

import { TutorialSystem } from "./tutorial.js";

// ===== constants (match UI) =====
const W = 5, H = 7;

// "summon area" like your game: A is bottom 2 rows, B is top 2 rows
function summonArea(owner, y){
  return owner === "A" ? (y >= H-2) : (y <= 1);
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function $(id){ return document.getElementById(id); }

const boardEl = $("board");
const youEl = $("you");
const turnEl = $("turn");
const manaEl = $("mana");
const manaGaugeEl = $("manaGauge");
const deckCountEl = $("deckCount");
const handEl = $("hand");
const actionPickerEl = $("actionPicker");
const detailEl = $("detail");
const diceEl = $("dice");
const logEl = $("log");
const killsEl = $("kills");
const infilEl = $("infil");
const modeHintEl = $("modeHint");

const btnSummon = $("modeSummon");
const btnMove = $("modeMove");
const btnAttack = $("modeAttack");
const btnEvolve = $("modeEvolve");
const btnDoEvolve = $("doEvolve");
const btnEnd = $("endTurn");

const btnBack = $("btnBack");

// ===== back behavior =====
btnBack?.addEventListener("click", () => {
  const p = new URLSearchParams(location.search);
  const back = p.get("back");
  if (back) location.href = back;
  else history.back();
});

// ===== local card defs (minimum) =====
const cardDefs = {
  // prototype_A,練習用キャラ,光,1,20,10,huiuti
  prototype_A: {
    id: "prototype_A",
    name: "練習用キャラ",
    type: "光",
    cost: 1,
    hp: 20,
    sp: 10,
    actions: [
      // huiuti,不意打ち(確定攻撃),1,front1,10,0,100,,,
      { id:"huiuti", name:"不意打ち(確定攻撃)", cost:1, range:"front1", rate:100, dmg:10, spDmg:0 }
    ]
  },
  // tutorial decoy
  decoy: {
    id:"decoy",
    name:"デコイ",
    type:"光",
    cost: 1,
    hp: 10,
    sp: 10,
    actions: []
  }
};

function cardName(id){ return cardDefs[id]?.name || id; }

// ===== tutorial selection from URL =====
const qs = new URLSearchParams(location.search);
const T = Number(qs.get("t") || "2"); // default: 2

// ===== local game state =====
const state = {
  turn: "A",
  you: "A",
  mana: { A:{cur:3,max:3}, B:{cur:3,max:3} },
  hands: { A:[], B:[] },
  units: [], // {id, owner, cardId, x,y,hp,sp}
  log: [`--- Tutorial ${T} ---`],
  winner: null
};

// UI local selections
let mode = null; // "summon" | "move" | "attack"
let selectedHandIndex = null;
let selectedUnitId = null;

// ===== tutorial overlay =====
const tutorial = new TutorialSystem();
const abortRef = { aborted:false };

// ===== helpers =====
function uid(){
  return "u_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
function myMana(){ return state.mana[state.you]; }

function pushLog(line){
  state.log.push(line);
  if (state.log.length > 250) state.log.splice(0, state.log.length - 250);
}
function cellIn(x,y){ return x>=0 && x<W && y>=0 && y<H; }
function getUnitAt(x,y){
  return state.units.find(u => u.x===x && u.y===y && u.hp>0) || null;
}
function getUnitById(id){
  return state.units.find(u => u.id===id) || null;
}
function isEmptyCell(x,y){ return !getUnitAt(x,y); }

function goBack(){
  const p = new URLSearchParams(location.search);
  const back = p.get("back");
  if (back) location.href = back;
  else location.href = "./deck.html";
}

function showCardDetail(cardId){
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  let html = `<b>${esc(d.name || cardId)}</b> <span class="small">(${esc(cardId)})</span><br>`;
  html += `属性:${esc(d.type)} / コスト:${esc(d.cost)}<br>`;
  html += `HP:${esc(d.hp)} SP:${esc(d.sp)}<br><br>`;

  const acts = d.actions || [];
  if (!acts.length) html += "行動なし";
  else {
    acts.forEach((a)=>{
      html += `【${esc(a.cost)}】${esc(a.name)}<br>`;
      html += `射程:${esc(a.range)} / 成功:${esc(a.rate)}%<br>`;
      html += `効果: HP-${esc(a.dmg)}<br><br>`;
    });
  }
  detailEl.innerHTML = html;
}

// ===== lock control =====
const lockState = {
  locked: true,
  allow: { summon:false, move:false, attack:false, hand:false, board:false }
};

function setLock(locked, allow = null){
  lockState.locked = !!locked;
  if (allow) lockState.allow = { ...lockState.allow, ...allow };

  // always disable unused buttons in tutorial pages
  if (btnEvolve) btnEvolve.disabled = true;
  if (btnDoEvolve) btnDoEvolve.disabled = true;
  if (btnEnd) btnEnd.disabled = true;

  if (btnSummon) btnSummon.disabled = !( !lockState.locked && lockState.allow.summon );
  if (btnMove) btnMove.disabled = !( !lockState.locked && lockState.allow.move );
  if (btnAttack) btnAttack.disabled = !( !lockState.locked && lockState.allow.attack );
}

// ===== mode =====
function setMode(m){
  mode = m;
  if (modeHintEl) {
    modeHintEl.textContent =
      (m === "summon") ? "召喚：手札を選択 → 緑のマスをクリック（召喚エリアのみ）" :
      (m === "move")   ? "移動：自分のユニットを選択 → 緑のマスをクリック（上下左右1マス / マナ1）" :
      (m === "attack") ? "攻撃：自分のユニットを選択 → 攻撃できる敵マスをクリック（マナ消費）" :
      "（チュートリアル）";
  }
  render();
}

// ===== render =====
function renderManaGauge(){
  if (!manaGaugeEl) return;
  manaGaugeEl.innerHTML = "";
  const my = state.mana[state.you];
  for (let i=0;i<my.max;i++){
    const pip = document.createElement("div");
    pip.className = "manaPip max";
    if (i < my.cur) pip.classList.add("on");
    manaGaugeEl.appendChild(pip);
  }
  for (let i=my.max;i<20;i++){
    const pip = document.createElement("div");
    pip.className = "manaPip";
    manaGaugeEl.appendChild(pip);
  }
}

function renderHand(){
  if (!handEl) return;
  handEl.innerHTML = "";

  const myHand = state.hands[state.you] || [];
  myHand.forEach((cardId, idx)=>{
    const def = cardDefs[cardId];
    const d = document.createElement("div");
    d.className = "card";
    if (idx === selectedHandIndex) d.classList.add("selected");

    d.innerHTML = `
      <div class="cardRow">
        <div><b>【${esc(def?.cost ?? "?")}】 ${esc(cardName(cardId))} ${esc(def?.type ?? "?")}</b></div>
        <div><button data-detail="${esc(cardId)}">詳細</button></div>
      </div>
      <div class="small">HP:${esc(def?.hp ?? "?")} / SP:${esc(def?.sp ?? "?")}</div>
      <div class="small">${
        def?.actions?.[0]
          ? `行動: ${esc(def.actions[0].name)} / 射程:${esc(def.actions[0].range)} / ${esc(def.actions[0].rate)}%`
          : "行動: なし"
      }</div>
    `;

    d.addEventListener("click", (e)=>{
      const btn = e.target?.closest?.("button");
      if (btn) return;
      if (lockState.locked || !lockState.allow.hand) return;

      selectedHandIndex = idx;
      selectedUnitId = null;
      showCardDetail(cardId);
      render();
    });

    d.querySelector("button[data-detail]")?.addEventListener("click", (e)=>{
      e.stopPropagation();
      showCardDetail(cardId);
    });

    handEl.appendChild(d);
  });
}

function moveCandidates(unit){
  // tutorial: 4-neighbor 1 step
  const cand = [];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx,dy] of dirs){
    const nx = unit.x + dx, ny = unit.y + dy;
    if (!cellIn(nx,ny)) continue;
    if (!isEmptyCell(nx,ny)) continue;
    cand.push([nx,ny]);
  }
  return cand;
}

function front1TargetCell(unit){
  // A's "front" is upward (y-1). B's "front" is downward (y+1).
  const dy = (unit.owner === "A") ? -1 : 1;
  return [unit.x, unit.y + dy];
}

function renderActionPicker(){
  if (!actionPickerEl) return;

  if (T === 2) {
    actionPickerEl.textContent = "（チュートリアル2では未使用）";
    return;
  }

  const u = selectedUnitId ? getUnitById(selectedUnitId) : null;
  if (!u) {
    actionPickerEl.textContent = "（ユニットを選択すると攻撃内容が出るよ）";
    return;
  }
  const def = cardDefs[u.cardId];
  const a = def?.actions?.[0];
  if (!a) {
    actionPickerEl.textContent = "（このユニットは行動なし）";
    return;
  }
  actionPickerEl.innerHTML = `
    <div class="small">使用する行動：</div>
    <div><b>【${esc(a.cost)}】${esc(a.name)}</b></div>
    <div class="small">射程:${esc(a.range)} / 成功:${esc(a.rate)}%</div>
    <div class="small">効果: HP-${esc(a.dmg)}</div>
  `;
}

function renderBoard(){
  if (!boardEl) return;
  boardEl.innerHTML = "";

  const highlights = new Set();

  if (!lockState.locked && lockState.allow.board) {
    // summon highlight
    if (mode === "summon" && selectedHandIndex != null && lockState.allow.summon) {
      const cid = (state.hands[state.you] || [])[selectedHandIndex];
      const def = cardDefs[cid];
      const mm = myMana();

      for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
          if (!isEmptyCell(x,y)) continue;
          if (!summonArea(state.you, y)) continue;
          const can = def && mm.cur >= Number(def.cost ?? 0);

          // Tutorial3: enforce center summon cell to guarantee flow (x=2,y=5)
          if (T === 3 && t3.phase === "summonTry") {
            if (!(x === t3.requiredSummonX && y === t3.requiredSummonY)) continue;
          }

          if (can) highlights.add(`${x},${y},summon`);
        }
      }
    }

    // move highlight
    if (mode === "move" && selectedUnitId && lockState.allow.move) {
      const u = getUnitById(selectedUnitId);
      if (u) {
        for (const [nx,ny] of moveCandidates(u)) highlights.add(`${nx},${ny},move`);
      }
    }

    // attack highlight
    if (mode === "attack" && selectedUnitId && lockState.allow.attack) {
      const u = getUnitById(selectedUnitId);
      if (u) {
        const [tx,ty] = front1TargetCell(u);
        const target = cellIn(tx,ty) ? getUnitAt(tx,ty) : null;
        if (target && target.owner !== u.owner) highlights.add(`${tx},${ty},summon`);
      }
    }
  }

  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const cell = document.createElement("div");
      cell.className = "cell";

      const u = getUnitAt(x,y);
      if (u){
        cell.classList.add(u.owner==="A" ? "unitA" : "unitB");
        if (u.id === selectedUnitId) cell.classList.add("selected");
        const def = cardDefs[u.cardId] || {};
        cell.innerHTML = `
          <div class="attr">${esc(def.type ?? "?")}</div>
          <div class="status">HP${esc(u.hp)} SP${esc(u.sp)}</div>
        `;
      }

      if (highlights.has(`${x},${y},summon`)) cell.classList.add("summon");
      if (highlights.has(`${x},${y},move`)) cell.classList.add("move");

      cell.addEventListener("click", ()=> clickCell(x,y));
      boardEl.appendChild(cell);
    }
  }
}

function render(){
  if (youEl) youEl.textContent = state.you;
  if (turnEl) turnEl.textContent = state.turn;
  if (manaEl) manaEl.textContent = `A ${state.mana.A.cur}/${state.mana.A.max} | B ${state.mana.B.cur}/${state.mana.B.max}`;
  renderManaGauge();

  if (deckCountEl) deckCountEl.textContent = `ローカル（チュートリアル用）`;
  if (killsEl) killsEl.textContent = `0 / 0`;
  if (infilEl) infilEl.textContent = `0 / 0`;

  if (logEl) logEl.textContent = state.log.slice(-70).join("\n");

  renderActionPicker();
  renderHand();
  renderBoard();
}

// ===== interactions: mode buttons =====
btnSummon?.addEventListener("click", ()=>{
  if (lockState.locked || !lockState.allow.summon) return;
  setMode("summon");
});
btnMove?.addEventListener("click", ()=>{
  if (lockState.locked || !lockState.allow.move) return;
  setMode("move");
});
btnAttack?.addEventListener("click", ()=>{
  if (lockState.locked || !lockState.allow.attack) return;
  setMode("attack");
});

// ===== click cell behavior =====
function clickCell(x,y){
  if (lockState.locked || !lockState.allow.board) return;

  const u = getUnitAt(x,y);

  // selecting a unit
  if (u && u.owner === state.you) {
    selectedUnitId = u.id;
    selectedHandIndex = null;
    showCardDetail(u.cardId);
    render();
    return;
  }

  // ===== summon =====
  if (mode === "summon" && lockState.allow.summon) {
    if (selectedHandIndex == null) return;
    if (!isEmptyCell(x,y)) return;
    if (!summonArea(state.you, y)) return;

    // Tutorial3: enforce required summon cell
    if (T === 3 && t3.phase === "summonTry") {
      if (!(x === t3.requiredSummonX && y === t3.requiredSummonY)) return;
    }

    const hand = state.hands[state.you] || [];
    const cid = hand[selectedHandIndex];
    const def = cardDefs[cid];
    if (!def) return;

    const cost = Number(def.cost ?? 0);
    if (myMana().cur < cost) return;

    handleSummonAttempt({ cid, x, y, cost });
    return;
  }

  // ===== move =====
  if (mode === "move" && lockState.allow.move) {
    const sel = selectedUnitId ? getUnitById(selectedUnitId) : null;
    if (!sel) return;

    const cand = moveCandidates(sel).some(([nx,ny]) => nx===x && ny===y);
    if (!cand) return;

    // cost: 1 mana per move (tutorial)
    if (myMana().cur < 1) return;

    myMana().cur -= 1;
    sel.x = x; sel.y = y;
    pushLog(`[${sel.owner}] 移動 (-1)`);

    handleMovedOnce();
    render();
    return;
  }

  // ===== attack =====
  if (mode === "attack" && lockState.allow.attack) {
    const sel = selectedUnitId ? getUnitById(selectedUnitId) : null;
    if (!sel) return;

    const def = cardDefs[sel.cardId];
    const a = def?.actions?.[0];
    if (!a) return;

    const [tx,ty] = front1TargetCell(sel);
    if (!(tx===x && ty===y)) return;

    const target = getUnitAt(tx,ty);
    if (!target || target.owner === sel.owner) return;

    const cost = Number(a.cost ?? 0);
    if (myMana().cur < cost) return;

    myMana().cur -= cost;

    const rate = Number(a.rate ?? 0);
    const roll = Math.floor(Math.random() * 100) + 1;
    const ok = roll <= rate;

    if (diceEl) diceEl.textContent = `🎲 ${roll} / 成功率 ${rate}% → ${ok ? "成功" : "失敗"}`;

    if (ok) {
      const dmg = Number(a.dmg ?? 0);
      target.hp -= dmg;
      pushLog(`[${sel.owner}] 攻撃：${a.name} (-${cost}) 命中！ HP-${dmg}`);

      if (target.hp <= 0) {
        target.hp = 0;
        pushLog(`[${target.owner}] ${cardName(target.cardId)} は倒れた…`);
      }
    } else {
      pushLog(`[${sel.owner}] 攻撃：${a.name} (-${cost}) 失敗…`);
    }

    handleAttackResolved({ ok, roll, rate });
    render();
    return;
  }
}

// ===== dispatchers =====
function handleSummonAttempt(args){
  if (T === 2) return handleSummonAttempt_T2(args);
  if (T === 3) return handleSummonAttempt_T3(args);
}
function handleMovedOnce(){
  if (T === 3) return handleMovedOnce_T3();
}
function handleAttackResolved(args){
  if (T === 3) return handleAttackResolved_T3(args);
}

// =====================
// Tutorial 2 flow (kept)
// =====================
const t2 = {
  phase: "intro",          // intro -> explainHand -> summonTry -> manaTips -> done
  requireCardId: "decoy",
  summonedOk: false
};

function handleSummonAttempt_T2({ cid, x, y, cost }){
  // NG: wrong card
  if (cid !== t2.requireCardId) {
    setLock(true, { hand:false, board:false });
    tutorial._showDialog({
      face: "konow1",
      name: "コレステ@コッペパン（Konow）",
      text: "残業確定ね。\nもう一回、手元のデコイを召喚させる。",
      nextLabel: "やり直す",
      onNext: () => {
        selectedHandIndex = null;
        setLock(false, { summon:true, hand:true, board:true });
        setMode("summon");
      },
      hint: "デコイ（decoy）を選んで召喚してね"
    });
    return;
  }

  // OK summon
  const hand = state.hands[state.you];
  const def = cardDefs[cid];

  state.mana[state.you].cur = Math.max(0, state.mana[state.you].cur - cost);
  hand.splice(selectedHandIndex, 1);
  selectedHandIndex = null;

  state.units.push({
    id: uid(),
    owner: state.you,
    cardId: cid,
    x, y,
    hp: Number(def.hp ?? 0),
    sp: Number(def.sp ?? 0)
  });

  pushLog(`[${state.you}] 召喚：${cardName(cid)} (-${cost})`);

  t2.summonedOk = true;
  t2.phase = "manaTips";

  setLock(true, { hand:false, board:false });
  render();
  runAfterSummon_T2().catch(console.error);
}

async function runScript_T2(){
  setMode("summon");
  setLock(true, { summon:false, move:false, attack:false, hand:false, board:false });
  render();

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "こんにちメタボ！\n囚人番号はしっかり覚えたかな？",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さてここが君の職場だよ。\n日光？あー今日見れたらいいね！",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さて今回は、ゲームを進める上での手札を確認しようか。",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow7",
    name: "コレステ@コッペパン（Konow）",
    text: "うん？手札とは…？わからない…？？",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow4",
    name: "コレステ@コッペパン（Konow）",
    text: "これだから新卒は…\n手札は「自分が持ってる手駒」のことだね。\nこの手駒を出し合って勝利を目指すのがこのゲームさ。",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さて、実際に手駒を出そうか。\n手元のデコイを出してみよう。",
    nextLabel: "やってみる",
    onNext: () => tutorial._resolveWait?.(),
    hint: "手札でデコイを選んで、緑のマスをクリック！"
  });
  await tutorial._wait(abortRef);

  t2.phase = "summonTry";
  setLock(false, { summon:true, hand:true, board:true });
  setMode("summon");
  render();
}

async function runAfterSummon_T2(){
  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "よし、うまく出せたね。\n召喚にはカードに書いてあるコスト分、「マナ」ってのを使うんだ。",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showTips({
    title: "Tips：マナと召喚",
    lines: [
      "召喚するにはマナを消費するよ（カードのコスト分）。",
      "移動にもマナが必要（このゲームは“何するにもマナ”が基本）。",
      "強い行動ほどコストが重いことが多い。",
      "つまり：マナ管理が勝敗に直結する！"
    ]
  });
  await tutorial._wait(abortRef);
  tutorial._hideTips();

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "重要なのが、何をするにも大体マナが必要なんだ。\nマナ管理ができる頭をこの、かんご…職場で養っていこうか。",
    nextLabel: "完了",
    onNext: () => goBack(),
    hint: "完了で戻る"
  });
}

// =====================
// Tutorial 3 flow (NEW)
// =====================
const t3 = {
  phase: "intro",          // intro -> summonTry -> moveTry -> attackTry -> tips -> done
  enemyPlaced: false,
  enemyUnitId: null,
  myUnitId: null,

  // flow safety: make it solvable always
  requiredSummonX: 2,
  requiredSummonY: H-2,  // y=5
  requiredMoveX: 2,
  requiredMoveY: H-3,    // y=4 (so front1 hits y=3)
};

function placeEnemyDecoy_T3(){
  // 「敵陣真ん中から2マス前」→ center x=2, y=3（top=0,1 enemy area）
  const x = 2, y = 3;

  const def = cardDefs.decoy;
  const u = {
    id: uid(),
    owner: "B",
    cardId: "decoy",
    x, y,
    hp: Number(def.hp ?? 0),
    sp: Number(def.sp ?? 0)
  };
  state.units.push(u);
  t3.enemyUnitId = u.id;
  t3.enemyPlaced = true;
  pushLog(`[B] デコイ配置 (${x},${y})`);
}

function handleSummonAttempt_T3({ cid, x, y, cost }){
  // must be prototype_A
  if (cid !== "prototype_A") {
    setLock(true, { hand:false, board:false });
    tutorial._showDialog({
      face: "konow1",
      name: "コレステ@コッペパン（Konow）",
      text: "残業確定。\n練習用キャラ（prototype_A）を召喚し直せ。",
      nextLabel: "やり直す",
      onNext: () => {
        selectedHandIndex = null;
        setLock(false, { summon:true, hand:true, board:true });
        setMode("summon");
      }
    });
    return;
  }

  const hand = state.hands[state.you];
  const def = cardDefs[cid];

  state.mana[state.you].cur = Math.max(0, state.mana[state.you].cur - cost);
  hand.splice(selectedHandIndex, 1);
  selectedHandIndex = null;

  const me = {
    id: uid(),
    owner: state.you,
    cardId: cid,
    x, y,
    hp: Number(def.hp ?? 0),
    sp: Number(def.sp ?? 0)
  };
  state.units.push(me);
  t3.myUnitId = me.id;

  pushLog(`[A] 召喚：${cardName(cid)} (-${cost})`);

  t3.phase = "moveTry";

  setLock(true, { hand:false, board:false, summon:false, move:false, attack:false });
  render();
  runAfterSummon_T3().catch(console.error);
}

async function runScript_T3(){
  setMode("summon");
  setLock(true, { summon:false, move:false, attack:false, hand:false, board:false });

  if (!t3.enemyPlaced) placeEnemyDecoy_T3();
  render();

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "こんにちポテチ！\n僕のお腹の7割は水じゃなくてジャガイモでできてるんだ",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さて、今回はいよいよ、敵に近づいて倒してしまうってことをやるよ。",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow3",
    name: "コレステ@コッペパン（Konow）",
    text: "え？かわいそうでできない？",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow1",
    name: "コレステ@コッペパン（Konow）",
    text: "うるせぇ！この世界は殺すか殺されるかなんだよ！！",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "それじゃ実際に戦闘に移ろう。\nあそこに突っ立ってる無能そうなデコイがいるね。あいつを倒そう。",
    hint: "タップ/次へで進む"
  });
  await tutorial._wait(abortRef);

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "それじゃ手札のキャラを召喚しよう。\nまさか忘れたなんて、えりぃとてくなーは言わないよね？？",
    nextLabel: "召喚してみる",
    onNext: () => tutorial._resolveWait?.(),
    hint: "練習用キャラ（prototype_A）を選んで、中央の緑マスに召喚！"
  });
  await tutorial._wait(abortRef);

  t3.phase = "summonTry";
  setLock(false, { summon:true, hand:true, board:true });
  setMode("summon");
  render();
}

async function runAfterSummon_T3(){
  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "召喚したキャラを選択して、実際に移動させてみよう。\nそれから不意打ちを決めろ！！",
    nextLabel: "移動する",
    onNext: () => {
      tutorial._resolveWait?.();
      setLock(false, { move:true, board:true, summon:false, attack:false, hand:false });
      setMode("move");
      selectedUnitId = t3.myUnitId;
      render();
    },
    hint: "移動は上下左右1マス（マナ1）"
  });
  await tutorial._wait(abortRef);
}

function handleMovedOnce_T3(){
  if (t3.phase !== "moveTry") return;

  const me = t3.myUnitId ? getUnitById(t3.myUnitId) : null;
  if (!me) return;

  // must reach (2,4) to be able to front1 attack enemy at (2,3)
  const okPos = (me.x === t3.requiredMoveX && me.y === t3.requiredMoveY);

  if (!okPos) {
    // keep trying (no lock)
    tutorial._showDialog({
      face: "konow1",
      name: "コレステ@コッペパン（Konow）",
      text: "そこじゃ届かねぇ。\nデコイの真正面まで移動しろ（緑マスで誘導してやる）。",
      nextLabel: "了解",
      onNext: () => {
        tutorial._resolveWait?.();
        setLock(false, { move:true, board:true });
        setMode("move");
        selectedUnitId = t3.myUnitId;
        render();
      }
    });
    return;
  }

  // reached attack position
  t3.phase = "attackTry";
  setLock(true, { board:false });

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "よし。\n次は攻撃だ。『攻撃』ボタンを押して、不意打ちを叩き込め！",
    nextLabel: "攻撃する",
    onNext: () => {
      tutorial._resolveWait?.();
      setLock(false, { attack:true, board:true, move:false, summon:false, hand:false });
      setMode("attack");
      selectedUnitId = t3.myUnitId;
      render();
    },
    hint: "攻撃にもマナを使うぞ"
  });
}

function handleAttackResolved_T3({ ok, roll, rate }){
  if (t3.phase !== "attackTry") return;

  const enemy = t3.enemyUnitId ? getUnitById(t3.enemyUnitId) : null;
  const dead = !enemy || enemy.hp <= 0;

  if (!ok || !dead) {
    setLock(true, { board:false });
    tutorial._showDialog({
      face: "konow1",
      name: "コレステ@コッペパン（Konow）",
      text: `外したな。\n実戦ではこういうこともある。\nもう一回やれ。`,
      nextLabel: "もう一回",
      onNext: () => {
        // 詰み防止：攻撃コスト1ぶん戻す（このチュートリアルは確定成功でもいいけど保険）
        state.mana[state.you].cur = Math.min(state.mana[state.you].max, state.mana[state.you].cur + 1);
        setLock(false, { attack:true, board:true });
        setMode("attack");
        selectedUnitId = t3.myUnitId;
        render();
      },
      hint: "次で成功率の話もする"
    });
    return;
  }

  // success
  t3.phase = "tips";
  setLock(true, { board:false });

  tutorial._showDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "不意打ちで倒せたね。\n実戦ではこんなうまくいかず、攻撃には『成功率』ってのがあるからね。",
    hint: "タップ/次へで進む"
  });

  (async ()=>{
    await tutorial._wait(abortRef);

    tutorial._showTips({
      title: "Tips：移動 / 攻撃 / 成功率",
      lines: [
        "移動：上下左右1マス。基本はマナを消費する（このチュートリアルでは1）。",
        "攻撃：行動（技）ごとにコスト（マナ）が必要。",
        "成功率：攻撃は確率で失敗することがある（成功率%に依存）。",
        "だから『マナ管理』と『狙うタイミング』がめちゃ重要。"
      ]
    });
    await tutorial._wait(abortRef);
    tutorial._hideTips();

    tutorial._showDialog({
      face: "konow2",
      name: "コレステ@コッペパン（Konow）",
      text: "こんなところかな。\n君もいい感じにおなか出てきたね！！",
      nextLabel: "完了",
      onNext: () => goBack(),
      hint: "完了で戻る"
    });
  })().catch(console.error);
}

// =====================
// Boot
// =====================
(function boot(){
  // ===== FIX: ensure tutorial root exists BEFORE calling _showDialog/_showTips =====
  // （ここが無いと root=null のまま appendChild で落ちる）
  tutorial._ensureRoot?.();

  // base UI labels
  if (youEl) youEl.textContent = state.you;
  if (turnEl) turnEl.textContent = state.turn;

  // disable unused buttons by default
  if (btnMove) btnMove.disabled = true;
  if (btnAttack) btnAttack.disabled = true;
  if (btnEvolve) btnEvolve.disabled = true;
  if (btnDoEvolve) btnDoEvolve.disabled = true;
  if (btnEnd) btnEnd.disabled = true;

  // initial detail
  if (detailEl) {
    detailEl.innerHTML = `<span class="small">手札の「詳細」やクリックで情報を見れるよ（チュートリアル進行中は指示に従ってね）。</span>`;
  }

  // init state per tutorial
  if (T === 2) {
    state.mana.A = { cur:3, max:3 };
    state.mana.B = { cur:3, max:3 };
    state.hands.A = ["prototype_A","decoy"];
    state.hands.B = [];
    t2.phase = "intro";
  } else if (T === 3) {
    // 召喚(1) + 移動(1) + 攻撃(1) + 保険で余裕を持たせる
    state.mana.A = { cur:5, max:5 };
    state.mana.B = { cur:5, max:5 };
    state.hands.A = ["prototype_A"];
    state.hands.B = [];
    t3.phase = "intro";
  } else {
    // fallback: behave like T=2
    state.mana.A = { cur:3, max:3 };
    state.mana.B = { cur:3, max:3 };
    state.hands.A = ["prototype_A","decoy"];
    state.hands.B = [];
  }

  render();

  // run selected tutorial script
  if (T === 3) runScript_T3().catch(console.error);
  else runScript_T2().catch(console.error);
})();