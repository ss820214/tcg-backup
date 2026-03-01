// public/arcade.js
// v20260207_1 arcade skeleton
// - 3体選択 → 5x5 バトル（移動/攻撃）→ 撃破した敵を捕獲して山札へ追加
// - ローカル完結（後で cardDefs / battle.js に差し替えやすい構造）

const $ = (id) => document.getElementById(id);

// top
const btnBackDeck = $("btnBackDeck");
const phaseBadge = $("phaseBadge");

// select screen
const screenSelect = $("screenSelect");
const pickListEl = $("pickList");
const pickCountBadge = $("pickCountBadge");
const btnStart = $("btnStart");
const btnPickReset = $("btnPickReset");

// battle screens
const screenBattleLeft = $("screenBattleLeft");
const screenBattleCenter = $("screenBattleCenter");
const screenSelectCenter = $("screenSelectCenter");

// battle ui
const gridEl = $("grid");
const logEl = $("log");
const statusBadge = $("statusBadge");
const turnBadge = $("turnBadge");
const modeBadge = $("modeBadge");
const youAliveEl = $("youAlive");
const enemyAliveEl = $("enemyAlive");
const selLabelEl = $("selLabel");
const deckListEl = $("deckList");
const deckSizeBadge = $("deckSizeBadge");

const btnEndTurn = $("btnEndTurn");
const btnResetRun = $("btnResetRun");
const btnMoveMode = $("btnMoveMode");
const btnAttackMode = $("btnAttackMode");

// modal
const modalBackdrop = $("modalBackdrop");
const modalClose = $("modalClose");
const captureText = $("captureText");
const btnCaptureYes = $("btnCaptureYes");
const btnCaptureNo = $("btnCaptureNo");

// --------------------
// Data (placeholder roster)
// --------------------
const START_ROSTER = [
  { id:"P001", name:"整備士", mana:2, hp:18, atk:6, desc:"堅実。隣接攻撃が強め。" },
  { id:"P002", name:"新人ナース", mana:1, hp:14, atk:4, desc:"軽い。捕獲しやすい立ち回り向き。" },
  { id:"P003", name:"安全監視ヨシ", mana:3, hp:16, atk:5, desc:"安定。標準性能。" },
  { id:"P004", name:"応急パッチ", mana:4, hp:20, atk:4, desc:"硬い。殴りは弱め。" },
  { id:"P005", name:"強化剤", mana:4, hp:15, atk:7, desc:"火力寄り。落ちやすい。" },
];

const ENEMY_POOL = [
  { id:"E101", name:"光の加護", mana:2, hp:12, atk:4, desc:"弱めの補助系。" },
  { id:"E102", name:"雷鳴の追い打ち", mana:3, hp:14, atk:5, desc:"標準の敵。" },
  { id:"E103", name:"部屋移動", mana:1, hp:10, atk:3, desc:"逃げ足が速そう（今は飾り）。" },
  { id:"E104", name:"泥棒", mana:4, hp:16, atk:6, desc:"ちょい強め。" },
  { id:"E105", name:"ドップラー", mana:4, hp:18, atk:5, desc:"硬め。" },
];

const PICK_LIMIT = 3;
const GRID_N = 5;

// --------------------
// State
// --------------------
let phase = "select"; // select | battle
let pickedIds = new Set();

let turn = 1;
let side = "YOU"; // YOU | ENEMY
let mode = "NONE"; // NONE | MOVE | ATTACK

/**
 * unit: {
 *   uid, team("YOU"/"ENEMY"), card{...}, hp, maxHp, x,y
 * }
 */
let units = [];
let selectedUid = null;

// deck gained by capture
let deck = []; // array of card snapshots

// for capture modal
let pendingCapture = null; // { card, unitUid }

// --------------------
// Helpers
// --------------------
function log(line){
  const t = new Date();
  const hh = String(t.getHours()).padStart(2,"0");
  const mm = String(t.getMinutes()).padStart(2,"0");
  const stamp = `${hh}:${mm}`;
  const prev = logEl.textContent || "";
  logEl.textContent = `${prev}${prev ? "\n" : ""}[${stamp}] ${line}`;
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(text){
  statusBadge.textContent = text;
}
function setPhase(p){
  phase = p;
  phaseBadge.textContent = (p === "select") ? "準備" : "戦闘中";
}
function uid(){
  return (crypto.randomUUID?.() ?? ("u" + Math.random().toString(16).slice(2)));
}
function inBounds(x,y){
  return x>=0 && y>=0 && x<GRID_N && y<GRID_N;
}
function getUnitAt(x,y){
  return units.find(u => u.x===x && u.y===y) || null;
}
function getSelected(){
  return units.find(u => u.uid === selectedUid) || null;
}
function neighbors4(x,y){
  return [
    {x:x, y:y-1},
    {x:x, y:y+1},
    {x:x-1, y:y},
    {x:x+1, y:y},
  ].filter(p => inBounds(p.x,p.y));
}
function aliveUnits(team){
  return units.filter(u => u.team===team && u.hp>0);
}
function updateHeaderCounts(){
  youAliveEl.textContent = String(aliveUnits("YOU").length);
  enemyAliveEl.textContent = String(aliveUnits("ENEMY").length);
  turnBadge.textContent = `TURN ${turn} / ${side}`;
}
function updateModeUI(){
  modeBadge.textContent = `MODE: ${mode === "NONE" ? "なし" : (mode==="MOVE"?"移動":"攻撃")}`;
  btnMoveMode.classList.toggle("primary", mode==="MOVE");
  btnAttackMode.classList.toggle("primary", mode==="ATTACK");
}
function updateDeckUI(){
  deckSizeBadge.textContent = `${deck.length}枚`;
  deckListEl.textContent = deck.length
    ? deck.map((c,i)=>`・${c.name}（M${c.mana}）`).join("\n")
    : "（まだ捕獲していません）";
}

// --------------------
// Screens
// --------------------
function showSelect(){
  setPhase("select");
  screenSelect.classList.add("active");
  screenSelectCenter.classList.add("active");
  screenBattleLeft.classList.remove("active");
  screenBattleCenter.classList.remove("active");
}
function showBattle(){
  setPhase("battle");
  screenSelect.classList.remove("active");
  screenSelectCenter.classList.remove("active");
  screenBattleLeft.classList.add("active");
  screenBattleCenter.classList.add("active");
}

// --------------------
// Selection
// --------------------
function renderPickList(){
  pickListEl.innerHTML = "";
  const roster = START_ROSTER
    .filter(c => c.mana <= 4)
    .sort((a,b)=>a.mana-b.mana);

  roster.forEach(card=>{
    const div = document.createElement("div");
    div.className = "cardPick" + (pickedIds.has(card.id) ? " selected" : "");
    div.innerHTML = `
      <div class="cardTop">
        <div>
          <div class="cardName">${escapeHtml(card.name)}</div>
          <div class="hint" style="margin-top:4px;">HP:${card.hp} / ATK:${card.atk}</div>
        </div>
        <span class="pill">M${card.mana}</span>
      </div>
      <div class="cardDesc">${escapeHtml(card.desc || "")}</div>
    `;
    div.addEventListener("click", ()=>{
      if (pickedIds.has(card.id)) pickedIds.delete(card.id);
      else{
        if (pickedIds.size >= PICK_LIMIT){
          setStatus("3体まで！");
          log("選択は3体まで。いったん外してね。");
          return;
        }
        pickedIds.add(card.id);
      }
      updatePickUI();
      renderPickList();
    });
    pickListEl.appendChild(div);
  });
}
function updatePickUI(){
  pickCountBadge.textContent = `${pickedIds.size} / ${PICK_LIMIT}`;
  btnStart.disabled = (pickedIds.size !== PICK_LIMIT);
}

// --------------------
// Battle init
// --------------------
function startBattle(){
  // reset state
  turn = 1;
  side = "YOU";
  mode = "NONE";
  selectedUid = null;
  units = [];
  deck = [];

  // create player units from picks
  const picks = Array.from(pickedIds).map(id => START_ROSTER.find(c=>c.id===id)).filter(Boolean);

  // spawn positions: bottom row (y=4), spread
  const spawnX = [1,2,3];
  picks.forEach((card,i)=>{
    units.push({
      uid: uid(),
      team: "YOU",
      card: {...card},
      hp: card.hp,
      maxHp: card.hp,
      x: spawnX[i] ?? i,
      y: 4,
    });
    deck.push({ ...card }); // 初期3体は山札にも入れておく（捕獲で増える体験が分かりやすい）
  });

  // enemy spawn: top row (y=0), 3体
  const enemies = shuffle([...ENEMY_POOL]).slice(0,3);
  const ex = [1,2,3];
  enemies.forEach((card,i)=>{
    units.push({
      uid: uid(),
      team: "ENEMY",
      card: {...card},
      hp: card.hp,
      maxHp: card.hp,
      x: ex[i] ?? i,
      y: 0,
    });
  });

  showBattle();
  updateDeckUI();
  updateHeaderCounts();
  updateModeUI();
  setStatus("戦闘開始");
  log("戦闘開始！ユニットを選択して、移動/攻撃してみて。");

  renderGrid();
}

// --------------------
// Rendering grid
// --------------------
function renderGrid(){
  gridEl.innerHTML = "";

  const sel = getSelected();
  const selTeam = sel?.team || null;

  // compute highlights
  const moveCells = new Set();
  const targetCells = new Set();
  if (sel && selTeam === side){
    if (mode === "MOVE"){
      for (const p of neighbors4(sel.x, sel.y)){
        if (!getUnitAt(p.x,p.y)) moveCells.add(key(p.x,p.y));
      }
    } else if (mode === "ATTACK"){
      for (const p of neighbors4(sel.x, sel.y)){
        const u = getUnitAt(p.x,p.y);
        if (u && u.team !== sel.team) targetCells.add(key(p.x,p.y));
      }
    }
  }

  for (let y=0; y<GRID_N; y++){
    for (let x=0; x<GRID_N; x++){
      const cell = document.createElement("div");
      cell.className = "cell";
      const k = key(x,y);

      const u = getUnitAt(x,y);
      if (sel && sel.x===x && sel.y===y) cell.classList.add("sel");
      if (moveCells.has(k)) cell.classList.add("move");
      if (targetCells.has(k)) cell.classList.add("target");

      if (u && u.hp > 0){
        const unit = document.createElement("div");
        unit.className = "unit " + (u.team==="YOU" ? "player" : "enemy");

        const pct = Math.max(0, Math.min(100, Math.floor((u.hp / u.maxHp)*100)));
        unit.innerHTML = `
          <div class="unitTop">
            <div class="unitName">${escapeHtml(u.card.name)}</div>
            <div class="unitMana">M${u.card.mana}</div>
          </div>
          <div>
            <div class="hpbar"><div class="hpfill" style="width:${pct}%"></div></div>
            <div class="hptext">
              <span>HP ${u.hp}/${u.maxHp}</span>
              <span>ATK ${u.card.atk}</span>
            </div>
          </div>
        `;
        cell.appendChild(unit);
      }

      cell.addEventListener("click", ()=> onCellClick(x,y));
      gridEl.appendChild(cell);
    }
  }

  // footer labels
  if (!sel) selLabelEl.textContent = "なし";
  else selLabelEl.textContent = `${sel.card.name} (${sel.team})`;
}

// --------------------
// Actions
// --------------------
function onCellClick(x,y){
  const u = getUnitAt(x,y);

  // selecting
  if (mode === "NONE" || !selectedUid){
    if (u && u.hp>0){
      selectedUid = u.uid;
      mode = "NONE";
      updateModeUI();
      renderGrid();
      return;
    }
    return;
  }

  const sel = getSelected();
  if (!sel || sel.hp<=0) return;

  // only act on your side
  if (sel.team !== side){
    // allow reselect
    if (u && u.hp>0){ selectedUid = u.uid; renderGrid(); }
    return;
  }

  // MOVE
  if (mode === "MOVE"){
    const can = neighbors4(sel.x,sel.y).some(p=>p.x===x && p.y===y) && !getUnitAt(x,y);
    if (!can) return;
    sel.x = x; sel.y = y;
    log(`${sel.card.name} が移動 (${x+1},${y+1})`);
    mode = "NONE";
    updateModeUI();
    renderGrid();
    return;
  }

  // ATTACK
  if (mode === "ATTACK"){
    const isAdj = neighbors4(sel.x,sel.y).some(p=>p.x===x && p.y===y);
    if (!isAdj) return;

    const target = u;
    if (!target || target.hp<=0 || target.team === sel.team) return;

    // damage
    const dmg = sel.card.atk;
    target.hp = Math.max(0, target.hp - dmg);
    log(`${sel.card.name} の攻撃！ → ${target.card.name} に ${dmg} ダメージ`);

    if (target.hp <= 0){
      log(`撃破！ ${target.card.name} を倒した`);
      onEnemyDefeated(target);
    }

    mode = "NONE";
    updateModeUI();
    renderGrid();
    checkWinLose();
    return;
  }

  // if clicking with NONE, just switch selection
  if (u && u.hp>0){
    selectedUid = u.uid;
    renderGrid();
  }
}

function onEnemyDefeated(enemyUnit){
  if (enemyUnit.team !== "ENEMY") return;

  pendingCapture = {
    card: { ...enemyUnit.card },
    unitUid: enemyUnit.uid
  };

  openCaptureModal(enemyUnit.card);
}

function checkWinLose(){
  const you = aliveUnits("YOU").length;
  const en = aliveUnits("ENEMY").length;
  updateHeaderCounts();

  if (en <= 0){
    setStatus("勝利！");
    log("敵を全滅！勝利！");
  } else if (you <= 0){
    setStatus("敗北…");
    log("味方が全滅…敗北。");
  }
}

function endTurn(){
  // simple enemy AI: each enemy tries to attack adjacent; else move down if possible
  if (aliveUnits("YOU").length<=0 || aliveUnits("ENEMY").length<=0) return;

  if (side === "YOU"){
    side = "ENEMY";
    turnBadge.textContent = `TURN ${turn} / ${side}`;
    setStatus("敵ターン");
    log("敵のターン…");
    enemyAct();
    // return to player
    side = "YOU";
    turn++;
    setStatus("あなたのターン");
    log(`TURN ${turn}：あなたのターン`);
    selectedUid = null;
    mode = "NONE";
    updateModeUI();
    updateHeaderCounts();
    renderGrid();
  }
}

function enemyAct(){
  const enemies = aliveUnits("ENEMY");
  const yous = aliveUnits("YOU");

  for (const e of enemies){
    // try attack adjacent
    const adj = neighbors4(e.x,e.y)
      .map(p=>getUnitAt(p.x,p.y))
      .filter(u=>u && u.team==="YOU" && u.hp>0);

    if (adj.length){
      const t = adj[0];
      const dmg = e.card.atk;
      t.hp = Math.max(0, t.hp - dmg);
      log(`敵 ${e.card.name} の攻撃 → ${t.card.name} に ${dmg} ダメージ`);
      if (t.hp<=0) log(`${t.card.name} が倒れた…`);
      continue;
    }

    // else move: try step toward nearest player (very simple)
    const target = yous[0];
    if (!target) break;

    const dx = Math.sign(target.x - e.x);
    const dy = Math.sign(target.y - e.y);

    const candidates = [
      {x:e.x, y:e.y + dy},
      {x:e.x + dx, y:e.y},
      {x:e.x, y:e.y + 1}, // bias down
    ].filter(p=>inBounds(p.x,p.y));

    const dest = candidates.find(p=>!getUnitAt(p.x,p.y));
    if (dest){
      e.x = dest.x; e.y = dest.y;
      log(`敵 ${e.card.name} が移動`);
    }
  }

  checkWinLose();
}

function setMode(next){
  if (phase !== "battle") return;
  const sel = getSelected();
  if (!sel || sel.team !== side){
    setStatus("まず自分のユニットを選択");
    return;
  }
  mode = (mode === next) ? "NONE" : next;
  updateModeUI();
  renderGrid();
}

// --------------------
// Capture modal
// --------------------
function openCaptureModal(card){
  captureText.innerHTML = `
    <div style="color:rgba(255,255,255,.92); font-weight:950; margin-bottom:8px;">
      ${escapeHtml(card.name)}（M${card.mana}）
    </div>
    <div>倒した敵を捕獲して、あなたの山札に加えます。</div>
    <div style="margin-top:10px; color:rgba(255,255,255,.65); font-size:12px;">
      ※今は「山札リストに追加」まで。後でドロー/デッキ循環を本格実装できる。
    </div>
  `;
  modalBackdrop.classList.add("open");
  modalBackdrop.setAttribute("aria-hidden","false");
}
function closeCaptureModal(){
  modalBackdrop.classList.remove("open");
  modalBackdrop.setAttribute("aria-hidden","true");
}

btnCaptureYes?.addEventListener("click", ()=>{
  if (!pendingCapture) return closeCaptureModal();
  deck.push({ ...pendingCapture.card });
  updateDeckUI();
  log(`捕獲成功：${pendingCapture.card.name} を山札に追加！`);
  setStatus("捕獲！");
  pendingCapture = null;
  closeCaptureModal();
});
btnCaptureNo?.addEventListener("click", ()=>{
  if (!pendingCapture) return closeCaptureModal();
  log(`捕獲しなかった：${pendingCapture.card.name}`);
  pendingCapture = null;
  closeCaptureModal();
});
modalClose?.addEventListener("click", ()=>{
  pendingCapture = null;
  closeCaptureModal();
});
modalBackdrop?.addEventListener("click", (e)=>{
  if (e.target === modalBackdrop){
    pendingCapture = null;
    closeCaptureModal();
  }
});

// --------------------
// Wiring
// --------------------
btnBackDeck?.addEventListener("click", ()=>{
  location.href = "./deck.html";
});

btnPickReset?.addEventListener("click", ()=>{
  pickedIds = new Set();
  updatePickUI();
  renderPickList();
  setStatus("リセット");
  log("選択をリセットした");
});

btnStart?.addEventListener("click", ()=>{
  if (pickedIds.size !== PICK_LIMIT) return;
  startBattle();
});

btnEndTurn?.addEventListener("click", endTurn);
btnResetRun?.addEventListener("click", ()=>{
  setStatus("リトライ");
  log("リトライ：選択画面へ戻る");
  pickedIds = new Set(pickedIds); // keep? → 一旦保持したいならこのまま。完全リセットなら空SetにしてOK
  showSelect();
  renderPickList();
  updatePickUI();
});

btnMoveMode?.addEventListener("click", ()=> setMode("MOVE"));
btnAttackMode?.addEventListener("click", ()=> setMode("ATTACK"));

window.addEventListener("keydown", (e)=>{
  if (e.key === "Escape"){
    if (modalBackdrop.classList.contains("open")){
      pendingCapture = null;
      closeCaptureModal();
      return;
    }
    mode = "NONE";
    updateModeUI();
    renderGrid();
  }
});

// --------------------
// Utils
// --------------------
function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function key(x,y){ return `${x},${y}`; }
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

// --------------------
// Boot
// --------------------
showSelect();
renderPickList();
updatePickUI();
setStatus("準備中");
log("アーケード：3体選んでバトル開始！");