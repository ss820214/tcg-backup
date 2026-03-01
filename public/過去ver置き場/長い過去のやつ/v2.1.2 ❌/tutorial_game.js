// public/tutorial_game.js
// Tutorial (local battle) - same UI as game.html, but no Firestore.
// Supports:
// - t=2 : summon "decoy" and explain mana/hand.
// - t=3 : summon "prototype_A", move, then attack an enemy "decoy" placed on board.
// - t=4 : evolution tutorial (prototype_A -> kusokimo_metabo)
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
  prototype_A: {
    id: "prototype_A",
    name: "練習用キャラ",
    type: "光",
    cost: 1,
    hp: 20,
    sp: 10,
    actions: [
      { id:"huiuti", name:"不意打ち(確定攻撃)", cost:1, range:"front1", rate:100, dmg:10, spDmg:0 }
    ]
  },
  decoy: {
    id:"decoy",
    name:"デコイ",
    type:"光",
    cost: 1,
    hp: 10,
    sp: 10,
    actions: []
  },
  // t=4: 新規カード
  kusokimo_metabo: {
    id:"kusokimo_metabo",
    name:"クソキモメタボ",
    type:"光",
    cost: 3,
    hp: 10,
    sp: 990,
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
let mode = null; // "summon" | "move" | "attack" | "evolve"
let selectedHandIndex = null;
let selectedUnitId = null;

// evolve temp
let evolveHandIndex = null;

// ===== tutorial overlay =====
const tutorial = new TutorialSystem();
const abortRef = { aborted:false };

// ★最重要：rootを必ず作る（constructorでは作られない）
try {
  tutorial._ensureRoot();
  // z-index 勝ちを確実にする（fxFlash が 99999）
  const tr = document.getElementById("tutorialRoot");
  if (tr) tr.style.zIndex = "1000000";
} catch (e) {
  console.error("[tutorial_game] tutorial init failed", e);
}

// デバッグ用：Consoleから __tutorial._showDialog できる
window.__tutorial = tutorial;

// ついでに「安全に呼ぶ」ラッパ（失敗してもゲーム自体は動かす）
function tShowDialog(payload){
  try {
    tutorial._ensureRoot();
    const tr = document.getElementById("tutorialRoot");
    if (tr) tr.style.zIndex = "1000000";
    tutorial._showDialog(payload);
  } catch (e) {
    console.error("[tutorial] showDialog failed", e);
  }
}
function tShowTips(payload){
  try {
    tutorial._ensureRoot();
    const tr = document.getElementById("tutorialRoot");
    if (tr) tr.style.zIndex = "1000000";
    tutorial._showTips(payload);
  } catch (e) {
    console.error("[tutorial] showTips failed", e);
  }
}
function tHideTips(){
  try { tutorial._hideTips(); } catch(e){ console.error(e); }
}
async function tWait(){
  try { return await tutorial._wait(abortRef); }
  catch(e){ console.error("[tutorial] wait failed", e); return false; }
}

// ====== helpers ======
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
  allow: { summon:false, move:false, attack:false, evolve:false, hand:false, board:false }
};

function setLock(locked, allow = null){
  lockState.locked = !!locked;
  if (allow) lockState.allow = { ...lockState.allow, ...allow };

  // always disable unused buttons in tutorial pages
  if (btnEnd) btnEnd.disabled = true;

  if (btnSummon) btnSummon.disabled = !( !lockState.locked && lockState.allow.summon );
  if (btnMove)   btnMove.disabled   = !( !lockState.locked && lockState.allow.move );
  if (btnAttack) btnAttack.disabled = !( !lockState.locked && lockState.allow.attack );
  if (btnEvolve) btnEvolve.disabled = !( !lockState.locked && lockState.allow.evolve );

  // doEvolve is special: shown only in evolve mode
  if (btnDoEvolve) {
    btnDoEvolve.style.display = (mode === "evolve") ? "inline-block" : "none";
    // enable/disable is handled by updateDoEvolveEnabled()
  }
}

// ===== mode =====
function setMode(m){
  mode = m;

  if (btnDoEvolve) btnDoEvolve.style.display = (m === "evolve") ? "inline-block" : "none";

  if (modeHintEl) {
    modeHintEl.textContent =
      (m === "summon") ? "召喚：手札を選択 → 緑のマスをクリック（召喚エリアのみ）" :
      (m === "move")   ? "移動：自分のユニットを選択 → 緑のマス（上下左右1マス / マナ1）" :
      (m === "attack") ? "攻撃：自分のユニットを選択 → 攻撃できる敵マス（マナ消費）" :
      (m === "evolve") ? "進化：自分ユニット選択 → 手札の進化先を選択 → 進化実行" :
      "（チュートリアル）";
  }

  render();
  updateDoEvolveEnabled();
}

// ===== evolve helpers =====
function updateDoEvolveEnabled(){
  if (!btnDoEvolve) return;

  if (mode !== "evolve") {
    btnDoEvolve.disabled = true;
    return;
  }

  const unit = selectedUnitId ? getUnitById(selectedUnitId) : null;
  const cid = (evolveHandIndex != null) ? (state.hands[state.you]?.[evolveHandIndex]) : null;
  if (!unit || !cid) {
    btnDoEvolve.disabled = true;
    return;
  }

  const def = cardDefs[cid];
  const cost = Number(def?.cost ?? 0);
  btnDoEvolve.disabled = myMana().cur < cost;
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

    // highlight
    if (mode === "evolve") {
      if (idx === evolveHandIndex) d.classList.add("selected");
    } else {
      if (idx === selectedHandIndex) d.classList.add("selected");
    }

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

      if (mode === "evolve") {
        evolveHandIndex = idx;
        showCardDetail(cardId);
        render();
        updateDoEvolveEnabled();
        return;
      }

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
  const dy = (unit.owner === "A") ? -1 : 1;
  return [unit.x, unit.y + dy];
}

function renderActionPicker(){
  if (!actionPickerEl) return;

  if (T === 2) {
    actionPickerEl.textContent = "（チュートリアル2では未使用）";
    return;
  }
  if (T === 4) {
    actionPickerEl.textContent = "（進化チュートリアル：攻撃は使わない）";
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
    // summon highlights
    if (mode === "summon" && selectedHandIndex != null && lockState.allow.summon) {
      const cid = (state.hands[state.you] || [])[selectedHandIndex];
      const def = cardDefs[cid];
      const mm = myMana();
      for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
          if (!isEmptyCell(x,y)) continue;
          const can = def && summonArea(state.you, y) && mm.cur >= Number(def.cost ?? 0);
          if (can) highlights.add(`${x},${y},summon`);
        }
      }
    }

    // move highlights
    if (mode === "move" && selectedUnitId && lockState.allow.move) {
      const u = getUnitById(selectedUnitId);
      if (u) {
        for (const [nx,ny] of moveCandidates(u)) highlights.add(`${nx},${ny},move`);
      }
    }

    // attack highlights (t=3)
    if (mode === "attack" && selectedUnitId && lockState.allow.attack) {
      const u = getUnitById(selectedUnitId);
      if (u) {
        const [tx,ty] = front1TargetCell(u);
        const target = cellIn(tx,ty) ? getUnitAt(tx,ty) : null;
        if (target && target.owner !== u.owner) highlights.add(`${tx},${ty},summon`); // reuse green
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
  if (diceEl) diceEl.textContent = "";

  if (btnDoEvolve) btnDoEvolve.style.display = (mode === "evolve") ? "inline-block" : "none";

  renderActionPicker();
  renderHand();
  renderBoard();

  // refresh locks
  setLock(lockState.locked, null);
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
btnEvolve?.addEventListener("click", ()=>{
  if (lockState.locked || !lockState.allow.evolve) return;
  setMode("evolve");
});

// ===== evolve execute =====
btnDoEvolve?.addEventListener("click", ()=>{
  if (lockState.locked || mode !== "evolve") return;

  const unit = selectedUnitId ? getUnitById(selectedUnitId) : null;
  const cid = (evolveHandIndex != null) ? (state.hands[state.you]?.[evolveHandIndex]) : null;
  if (!unit || !cid) return;

  const def = cardDefs[cid];
  const cost = Number(def?.cost ?? 0);
  if (myMana().cur < cost) return;

  // pay + remove from hand
  myMana().cur -= cost;
  state.hands[state.you].splice(evolveHandIndex, 1);

  // evolve (overwrite stats)
  unit.cardId = cid;
  unit.hp = Number(def.hp ?? 0);
  unit.sp = Number(def.sp ?? 0);

  evolveHandIndex = null;
  pushLog(`[${state.you}] 進化：${cardName(cid)} (-${cost})`);

  render();
  updateDoEvolveEnabled();

  if (T === 4) handleEvolved_T4();
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
    updateDoEvolveEnabled();
    return;
  }

  // ===== summon =====
  if (mode === "summon" && lockState.allow.summon) {
    if (selectedHandIndex == null) return;
    if (!isEmptyCell(x,y)) return;
    if (!summonArea(state.you, y)) return;

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

    if (myMana().cur < 1) return;

    myMana().cur -= 1;
    sel.x = x; sel.y = y;
    pushLog(`[${sel.owner}] 移動 (-1)`);

    handleMovedOnce();
    render();
    return;
  }

  // ===== attack ===== (t=3)
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

// ===== common: summon dispatch =====
function handleSummonAttempt(payload){
  if (T === 2) return handleSummonAttempt_T2(payload);
  if (T === 3) return handleSummonAttempt_T3(payload);
  if (T === 4) return handleSummonAttempt_T4(payload);
}

// ===== go back =====
function goBack(){
  const p = new URLSearchParams(location.search);
  const back = p.get("back");
  if (back) location.href = back;
  else location.href = "./deck.html";
}

// =======================================================
// Tutorial 2 flow
// =======================================================
const t2 = { phase:"intro", requireCardId:"decoy", summonedOk:false };

function handleSummonAttempt_T2({ cid, x, y, cost }){
  if (cid !== t2.requireCardId) {
    setLock(true, { hand:false, board:false });
    tShowDialog({
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
  // init
  state.units.length = 0;
  state.hands.A = ["decoy"];
  state.hands.B = [];
  state.mana.A.cur = 99; state.mana.A.max = 3;
  state.mana.B.cur = 3; state.mana.B.max = 3;
  selectedHandIndex = null;
  selectedUnitId = null;
  evolveHandIndex = null;

  setMode("summon");
  setLock(true, { summon:false, move:false, attack:false, evolve:false, hand:false, board:false });
  render();

  tShowDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "こんにちメタボ！\n囚人番号はしっかり覚えたかな？",
  });
  await tWait();

  tShowDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さてここが君の職場だよ。\n日光？あー今日見れたらいいね！",
  });
  await tWait();

  tShowDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さて今回は、ゲームを進める上での手札を確認しようか。",
  });
  await tWait();

  tShowDialog({
    face: "konow7",
    name: "コレステ@コッペパン（Konow）",
    text: "うん？手札とは…？わからない…？？",
  });
  await tWait();

  tShowDialog({
    face: "konow4",
    name: "コレステ@コッペパン（Konow）",
    text: "これだから新卒は…\n手札は「自分が持ってる手駒」のことだね。\nこの手駒を出し合って勝利を目指すのがこのゲームさ。",
  });
  await tWait();

  tShowDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "さて、実際に手駒を出そうか。\n手元のデコイを出してみよう。",
    nextLabel: "やってみる",
    onNext: () => tutorial._resolveWait?.(),
    hint: "手札でデコイを選んで、緑のマスをクリック！"
  });
  await tWait();

  t2.phase = "summonTry";
  setLock(false, { summon:true, hand:true, board:true, move:false, attack:false, evolve:false });
  setMode("summon");
  render();
}

async function runAfterSummon_T2(){
  tShowDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "よし、うまく出せたね。\n召喚にはカードに書いてあるコスト分、「マナ」ってのを使うんだ。",
  });
  await tWait();

  tShowTips({
    title: "Tips：マナと召喚",
    lines: [
      "召喚するにはマナを消費するよ（カードのコスト分）。",
      "移動にもマナが必要（このゲームは“何するにもマナ”が基本）。",
      "強い行動ほどコストが重いことが多い。",
      "つまり：マナ管理が勝敗に直結する！"
    ]
  });
  await tWait();
  tHideTips();

  tShowDialog({
    face: "konow2",
    name: "コレステ@コッペパン（Konow）",
    text: "重要なのが、何をするにも大体マナが必要なんだ。\nマナ管理ができる頭をこの、かんご…職場で養っていこうか。",
    nextLabel: "完了",
    onNext: () => goBack(),
    hint: "完了で戻る"
  });
}

// =======================================================
// Tutorial 3 flow
// =======================================================
const t3 = {
  phase:"intro",
  enemyPlaced:false,
  enemyUnitId:null,
  myUnitId:null,
  moved:false,
};

function placeEnemyDecoy_T3(){
  const x = 2, y = 3;
  const def = cardDefs.decoy;
  const u = { id:uid(), owner:"B", cardId:"decoy", x,y, hp:+def.hp, sp:+def.sp };
  state.units.push(u);
  t3.enemyUnitId = u.id;
  t3.enemyPlaced = true;
  pushLog(`[B] デコイ配置 (${x},${y})`);
}

function handleSummonAttempt_T3({ cid, x, y, cost }){
  if (cid !== "prototype_A") {
    setLock(true, { hand:false, board:false });
    tShowDialog({
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

  const me = { id:uid(), owner:state.you, cardId:cid, x,y, hp:+def.hp, sp:+def.sp };
  state.units.push(me);
  t3.myUnitId = me.id;

  pushLog(`[A] 召喚：${cardName(cid)} (-${cost})`);

  t3.phase = "moveTry";
  setLock(true, { hand:false, board:false });
  render();
  runAfterSummon_T3().catch(console.error);
}

async function runScript_T3(){
  // init
  state.units.length = 0;
  state.hands.A = ["prototype_A"];
  state.hands.B = [];
  state.mana.A.cur = 3; state.mana.A.max = 3;
  state.mana.B.cur = 3; state.mana.B.max = 3;
  selectedHandIndex = null;
  selectedUnitId = null;
  evolveHandIndex = null;

  t3.phase = "intro";
  t3.moved = false;
  t3.enemyPlaced = false;
  t3.enemyUnitId = null;
  t3.myUnitId = null;

  setMode("summon");
  setLock(true, { summon:false, move:false, attack:false, evolve:false, hand:false, board:false });

  if (!t3.enemyPlaced) placeEnemyDecoy_T3();

  render();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"こんにちポテチ！\n僕のお腹の7割は水じゃなくてジャガイモでできてるんだ" });
  await tWait();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"さて、今回はいよいよ、敵に近づいて倒してしまうってことをやるよ。" });
  await tWait();

  tShowDialog({ face:"konow3", name:"コレステ@コッペパン（Konow）", text:"え？かわいそうでできない？" });
  await tWait();

  tShowDialog({ face:"konow1", name:"コレステ@コッペパン（Konow）", text:"うるせぇ！この世界は殺すか殺されるかなんだよ！！" });
  await tWait();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"それじゃ実際に戦闘に移ろう。\nあそこに突っ立ってる無能そうなデコイがいるね。あいつを倒そう。" });
  await tWait();

  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"それじゃ手札のキャラを召喚しよう。\nまさか忘れたなんて、えりぃとてくなーは言わないよね？？",
    nextLabel:"召喚してみる",
    onNext: () => tutorial._resolveWait?.(),
    hint:"練習用キャラ（prototype_A）を選んで召喚！"
  });
  await tWait();

  t3.phase = "summonTry";
  setLock(false, { summon:true, hand:true, board:true, move:false, attack:false, evolve:false });
  setMode("summon");
  render();
}

async function runAfterSummon_T3(){
  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"よし。\n召喚したキャラを選択して、実際に移動させてみよう。\nそれから不意打ちを決めろ！！",
    nextLabel:"移動する",
    onNext: () => tutorial._resolveWait?.(),
    hint:"移動ボタン → 自分ユニット選択 → 緑マスへ"
  });
  await tWait();

  setLock(false, { move:true, hand:false, board:true, summon:false, attack:false, evolve:false });
  setMode("move");
  selectedUnitId = t3.myUnitId;
  render();
}

function handleMovedOnce(){
  if (T !== 3) return;
  if (t3.phase !== "moveTry") return;
  if (t3.moved) return;

  t3.moved = true;
  t3.phase = "attackTry";

  setLock(true, { board:false });
  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"いいね。\n次は攻撃だ。『攻撃』ボタンを押して、不意打ちを叩き込め！",
    nextLabel:"攻撃する",
    onNext: () => {
      tutorial._resolveWait?.();
      setLock(false, { attack:true, board:true, move:false, summon:false, evolve:false, hand:false });
      setMode("attack");
      selectedUnitId = t3.myUnitId;
      render();
    },
    hint:"攻撃できる敵が緑になるよ（front1）"
  });
}

async function finish_T3(){
  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"不意打ちで倒せたね。\n実戦ではこんなうまくいかず、攻撃には『成功率』ってのがあるからね。",
  });
  await tWait();

  tShowTips({
    title:"Tips：移動・攻撃・成功率",
    lines:[
      "移動にもマナが必要（このチュートリアルでは1マナ）。",
      "攻撃にもマナが必要（技のコスト分）。",
      "攻撃には成功率があり、外れることもある。",
      "だから『位置取り』『マナ管理』『成功率』をセットで考えるのが大事。"
    ]
  });
  await tWait();
  tHideTips();

  tShowDialog({
    face:"konow5",
    name:"コレステ@コッペパン（Konow）",
    text:"こんなところかな。君もいい感じにおなか出てきたね！！",
    nextLabel:"完了",
    onNext: () => goBack(),
    hint:"完了で戻る"
  });
}

function handleAttackResolved({ ok }){
  if (T !== 3) return;
  if (t3.phase !== "attackTry") return;

  const enemy = t3.enemyUnitId ? getUnitById(t3.enemyUnitId) : null;
  const dead = !enemy || enemy.hp <= 0;

  if (!ok || !dead) {
    setLock(true, { board:false });
    tShowDialog({
      face:"konow1",
      name:"コレステ@コッペパン（Konow）",
      text:"外したな。\n実戦ではこういうこともある。\nもう一回やれ。",
      nextLabel:"もう一回",
      onNext: () => {
        // 詰み防止：攻撃コスト1だけ戻す
        state.mana[state.you].cur = Math.min(state.mana[state.you].max, state.mana[state.you].cur + 1);
        setLock(false, { attack:true, board:true });
        setMode("attack");
        selectedUnitId = t3.myUnitId;
        render();
      },
      hint:"攻撃は成功率がある（次で説明する）"
    });
    return;
  }

  // kill confirmed
  t3.phase = "done";
  setLock(true, { board:false });
  finish_T3().catch(console.error);
}

// =======================================================
// Tutorial 4 : Evolution
// =======================================================
function handleSummonAttempt_T4({ cid, x, y, cost }){
  if (cid !== "prototype_A") {
    setLock(true, { hand:false, board:false });
    tShowDialog({
      face:"konow1",
      name:"コレステ@コッペパン（Konow）",
      text:"そっちはエリートの方だ吹っ飛ばすぞ",
      nextLabel:"やり直す",
      onNext: () => {
        tutorial._resolveWait?.();
        selectedHandIndex = null;
        setLock(false, { summon:true, hand:true, board:true, evolve:false, move:false, attack:false });
        setMode("summon");
      }
    });
    return;
  }

  const def = cardDefs[cid];

  // pay + remove from hand
  myMana().cur = Math.max(0, myMana().cur - cost);
  state.hands.A.splice(selectedHandIndex, 1);
  selectedHandIndex = null;

  // summon
  const u = { id:uid(), owner:"A", cardId:cid, x,y, hp:+def.hp, sp:+def.sp };
  state.units.push(u);
  selectedUnitId = u.id;

  pushLog(`[A] 召喚：${cardName(cid)} (-${cost})`);

  setLock(true, { hand:false, board:false });
  render();

  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"よく分かってんじゃん。\nじゃあこのイケメンでハーレム人生の俺を進化させてみよう。",
    nextLabel:"進化する",
    onNext: () => {
      tutorial._resolveWait?.();
      // unlock evolve
      setLock(false, { evolve:true, hand:true, board:true, summon:false, move:false, attack:false });
      setMode("evolve");
      // 迷子防止
      selectedUnitId = u.id;
      evolveHandIndex = null;
      render();
      updateDoEvolveEnabled();
    }
  });
}

async function runScript_T4(){
  // init
  state.units.length = 0;
  state.hands.A = ["prototype_A", "kusokimo_metabo"];
  state.hands.B = [];
  state.mana.A.cur = 99; state.mana.A.max = 99;
  state.mana.B.cur = 3; state.mana.B.max = 3;

  selectedHandIndex = null;
  selectedUnitId = null;
  evolveHandIndex = null;

  setMode("summon");
  setLock(true, { summon:false, move:false, attack:false, evolve:false, hand:false, board:false });
  render();

  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"おは贅肉。\nいい顔になってきたね。\n目の上のクマは発展途上ということで60点ってとこかな。",
  });
  await tWait();

  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"今回は進化っていう要素の説明だ。\nそれにあたって激ヤバ3先輩を連れてきたぞ！！",
  });
  await tWait();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"まずは残業したいだけで仕事しないバトラー！" });
  await tWait();

  tShowDialog({ face:"batter", name:"バトラー", text:"ﾌﾌﾌﾌ" });
  await tWait();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"説明0から！誰がわかんねん指示　ホームレスリーダー！" });
  await tWait();

  tShowDialog({ face:"homeless", name:"ホームレスリーダー", text:"遅すぎますわ。紹介が。" });
  await tWait();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"近づくなと言われている！パワハラの貴公子！ワニータ！" });
  await tWait();

  tShowDialog({ face:"pawahara", name:"ワニータ", text:"若い頃は這いずってでも来てんねんアホが" });
  await tWait();

  tShowDialog({
    face:"konow1",
    name:"コレステ@コッペパン（Konow）",
    text:"さて、先輩方呼んだし、このうちの誰に進化したい？",
    choices:[
      { label:"バトラーD", action:()=>tutorial._resolveWait?.() },
      { label:"ホームレスリーダー", action:()=>tutorial._resolveWait?.() },
      { label:"わにータ", action:()=>tutorial._resolveWait?.() },
    ]
  });
  await tWait();

  tShowDialog({ face:"konow1", name:"コレステ@コッペパン（Konow）", text:"は？そこは俺やろが押し潰すぞ" });
  await tWait();

  tShowDialog({ face:"konow2", name:"コレステ@コッペパン（Konow）", text:"茶番は置いといて、戦闘に入ろうか" });
  await tWait();

  tShowDialog({
    face:"konow2",
    name:"コレステ@コッペパン（Konow）",
    text:"さてまず凡人出そうか",
    nextLabel:"召喚する",
    onNext: () => tutorial._resolveWait?.(),
    hint:"練習用キャラ（prototype_A）を召喚してね"
  });
  await tWait();

  // unlock summon
  setLock(false, { summon:true, hand:true, board:true, evolve:false, move:false, attack:false });
  setMode("summon");
  render();
}

function handleEvolved_T4(){
  // lock while talking
  setLock(true, { hand:false, board:false });

  tShowDialog({
    face:"konow5",
    name:"コレステ@コッペパン（Konow）",
    text:"上出来か。\nマナが余ってたら進化することも選択肢に入れるといいデブよ。",
  });

  tutorial._wait(abortRef).then(async ()=>{
    tShowTips({
      title:"Tips：進化について",
      lines:[
        "進化ばっかしてるとキャラ数が足りなくて物量で押し切られる",
        "そこらへんの配分に頭を使わないといけない"
      ]
    });
    await tWait();
    tHideTips();

    tShowDialog({ face:"konow4", name:"コレステ@コッペパン（Konow）", text:"さて、これで基本的なゲームのシステムは終わりかな。" });
    await tWait();

    tShowDialog({
      face:"konow2",
      name:"コレステ@コッペパン（Konow）",
      text:"案外簡単なゲームシステムだけど、戦略が多いことがわかってくれたと思うんだ。\nそうだよね？バトラー？",
    });
    await tWait();

    tShowDialog({ face:"batter", name:"バトラー", text:"えっ私に聞くの???笑笑" });
    await tWait();

    tShowDialog({
      face:"konow2",
      name:"コレステ@コッペパン（Konow）",
      text:"ほんとにTecherになったらこんな感じの聞けるから、ぜひいろんな人を誘って入社しよう！",
      nextLabel:"完了",
      onNext: () => goBack(),
      hint:"完了で戻る"
    });
  });
}

// ===== entry =====
console.log("[tutorial_game] boot", { T });

// まず盤面だけでも描画（0セル問題の切り分け）
try { render(); } catch (e) { console.error("[tutorial_game] initial render failed", e); }

if (T === 2) runScript_T2().catch(console.error);
if (T === 3) runScript_T3().catch(console.error);
if (T === 4) runScript_T4().catch(console.error);