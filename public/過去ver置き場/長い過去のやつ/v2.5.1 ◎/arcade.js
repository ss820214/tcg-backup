// public/arcade.js
// v20260210_1 sugoroku roguelite arcade
// - 左：デッキ編成（所持→デッキ）
// - 中：双六（5ステージ）サイコロで進む → マス効果（Money/Shop/Card/VS/Boss/Goal）
// - バトル：5x5（移動/攻撃）を継続。勝利報酬でカード増える。
// - game.js へ差し替えしやすいよう、BattleEngine を閉じた形に。

const $ = (id) => document.getElementById(id);

// top
const btnBackDeck = $("btnBackDeck");
const phaseBadge = $("phaseBadge");
const stageBadge = $("stageBadge");
const moneyBadge = $("moneyBadge");

// left
const tabOwned = $("tabOwned");
const tabDeck = $("tabDeck");
const ownedWrap = $("ownedWrap");
const deckWrap = $("deckWrap");
const ownedList = $("ownedList");
const deckList = $("deckList");
const deckCountBadge = $("deckCountBadge");
const btnStarterPack = $("btnStarterPack");
const btnDeckAuto = $("btnDeckAuto");
const btnDeckClear = $("btnDeckClear");

// center map
const screenMap = $("screenMap");
const screenBattle = $("screenBattle");
const btnDice = $("btnDice");
const btnNextStage = $("btnNextStage");
const mapLegend = $("mapLegend");
const mapTrack = $("mapTrack");
const tileBadge = $("tileBadge");
const posBadge = $("posBadge");
const lenBadge = $("lenBadge");
const moneyText = $("moneyText");

// battle
const gridEl = $("grid");
const logEl = $("log");
const statusBadge = $("statusBadge");
const turnBadge = $("turnBadge");
const modeBadge = $("modeBadge");
const youAliveEl = $("youAlive");
const enemyAliveEl = $("enemyAlive");
const selLabelEl = $("selLabel");

const btnEndTurn = $("btnEndTurn");
const btnMoveMode = $("btnMoveMode");
const btnAttackMode = $("btnAttackMode");
const btnRetreat = $("btnRetreat");

// right
const btnLogClear = $("btnLogClear");
const legendHelp = $("legendHelp");

// modal
const modalBackdrop = $("modalBackdrop");
const modalClose = $("modalClose");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const modalFooter = $("modalFooter");

// --------------------
// CONFIG / DATA
// --------------------
const DECK_MAX = 20;
const GRID_N = 5;
const STAGE_COUNT = 5;

// “所持カード”の素体（後で cardDefs に差し替えやすい）
const CARD_POOL = [
  { id:"P001", name:"整備士", mana:2, hp:18, atk:6, desc:"堅実。隣接攻撃が強め。" },
  { id:"P002", name:"新人ナース", mana:1, hp:14, atk:4, desc:"軽い。捕獲しやすい立ち回り向き。" },
  { id:"P003", name:"安全監視ヨシ", mana:3, hp:16, atk:5, desc:"安定。標準性能。" },
  { id:"P004", name:"応急パッチ", mana:4, hp:20, atk:4, desc:"硬い。殴りは弱め。" },
  { id:"P005", name:"強化剤", mana:4, hp:15, atk:7, desc:"火力寄り。落ちやすい。" },

  // 追加（報酬/ショップで増える前提で、最初からプールに用意）
  { id:"C101", name:"火炎瓶", mana:2, hp:12, atk:6, desc:"火力寄りの軽量。" },
  { id:"C102", name:"救急処置", mana:1, hp:16, atk:3, desc:"耐久寄り。殴りは控えめ。" },
  { id:"C103", name:"集中", mana:2, hp:13, atk:5, desc:"器用貧乏、扱いやすい。" },
  { id:"C104", name:"泥棒", mana:4, hp:16, atk:6, desc:"強め。値段も高い。" },
  { id:"C105", name:"ドップラー", mana:4, hp:18, atk:5, desc:"硬めの中火力。" },
];

const ENEMY_POOL = [
  { id:"E101", name:"光の加護", mana:2, hp:12, atk:4, desc:"弱めの補助系。" },
  { id:"E102", name:"雷鳴の追い打ち", mana:3, hp:14, atk:5, desc:"標準の敵。" },
  { id:"E103", name:"部屋移動", mana:1, hp:10, atk:3, desc:"逃げ足が速そう（今は飾り）。" },
  { id:"E104", name:"泥棒", mana:4, hp:16, atk:6, desc:"ちょい強め。" },
  { id:"E105", name:"ドップラー", mana:4, hp:18, atk:5, desc:"硬め。" },
];

// 双六マス
const TILE = {
  START: { key:"START", icon:"🏁", name:"START", help:"ステージ開始。" },
  MONEY: { key:"MONEY", icon:"💰", name:"お金", help:"所持金が増える。" },
  SHOP:  { key:"SHOP",  icon:"🏪", name:"お店", help:"所持金でカード購入。" },
  CARD:  { key:"CARD",  icon:"🎁", name:"入手", help:"カードを1枚入手（選択式）。" },
  VS:    { key:"VS",    icon:"⚔️", name:"VS", help:"通常戦闘。" },
  BOSS:  { key:"BOSS",  icon:"👑", name:"BOSS", help:"強敵戦闘。勝つと豪華報酬。" },
  GOAL:  { key:"GOAL",  icon:"🚪", name:"GOAL", help:"ステージクリア。次へ。" },
};

const LEGEND = [TILE.START, TILE.MONEY, TILE.SHOP, TILE.CARD, TILE.VS, TILE.BOSS, TILE.GOAL];

// ステージ生成（軽くランダム、でも最低限の構成を保証）
function makeStageTrack(stageIndex){
  // 12〜16マス程度
  const len = 12 + Math.floor(Math.random()*3) + stageIndex; // 後半少し長い
  const arr = [];
  arr.push({ ...TILE.START });

  // 中間を生成
  for (let i=1;i<len-1;i++){
    // 進行度に応じてVS/BOSS寄り
    const r = Math.random();
    let t = TILE.MONEY;

    if (i === len-2){
      t = TILE.BOSS;
    } else if (r < 0.20) t = TILE.MONEY;
    else if (r < 0.35) t = TILE.CARD;
    else if (r < 0.50) t = TILE.SHOP;
    else if (r < 0.92) t = TILE.VS;
    else t = TILE.CARD;

    arr.push({ ...t });
  }

  arr.push({ ...TILE.GOAL });

  // ステージ終盤に必ずBOSSを置く（GOALの1つ前をBOSSにする）
  if (arr.length >= 3){
    arr[arr.length-2] = { ...TILE.BOSS };
  }
  return arr;
}

// --------------------
// STATE
// --------------------
let phase = "map"; // map | battle
let stageIndex = 0; // 0..4
let track = makeStageTrack(stageIndex);
let pos = 0; // tile index
let money = 0;

// 所持カード（プレイヤーが集めた分）
let owned = []; // array of card snapshots
// デッキ（戦闘で使う “候補” のような扱い。今はUIとして保持）
let deck = []; // array of card snapshots

// バトルの勝敗に応じた戻り先イベント
let pendingTileResolve = null; // { tileKey, boss:boolean }

// --------------------
// BATTLE ENGINE STATE
// --------------------
let turn = 1;
let side = "YOU"; // YOU | ENEMY
let mode = "NONE"; // NONE | MOVE | ATTACK
let units = []; // {uid, team, card, hp, maxHp, x, y}
let selectedUid = null;

// --------------------
// HELPERS
// --------------------
function uid(){
  return (crypto.randomUUID?.() ?? ("u" + Math.random().toString(16).slice(2)));
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function log(line){
  const t = new Date();
  const hh = String(t.getHours()).padStart(2,"0");
  const mm = String(t.getMinutes()).padStart(2,"0");
  const stamp = `${hh}:${mm}`;
  const prev = logEl.textContent || "";
  logEl.textContent = `${prev}${prev ? "\n" : ""}[${stamp}] ${line}`;
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(text){ statusBadge.textContent = text; }
function setPhase(p){
  phase = p;
  phaseBadge.textContent = (p === "map") ? "探索" : "戦闘中";
}
function setMoney(v){
  money = Math.max(0, Math.floor(v));
  moneyBadge.textContent = `¥${money}`;
  moneyText.textContent = String(money);
}
function setStage(i){
  stageIndex = i;
  stageBadge.textContent = `STAGE ${stageIndex+1}/${STAGE_COUNT}`;
}
function showMap(){
  setPhase("map");
  screenMap.classList.add("active");
  screenBattle.classList.remove("active");
}
function showBattle(){
  setPhase("battle");
  screenMap.classList.remove("active");
  screenBattle.classList.add("active");
}
function inBounds(x,y){ return x>=0 && y>=0 && x<GRID_N && y<GRID_N; }
function key(x,y){ return `${x},${y}`; }
function getUnitAt(x,y){ return units.find(u=>u.x===x && u.y===y && u.hp>0) || null; }
function getSelected(){ return units.find(u=>u.uid===selectedUid) || null; }
function neighbors4(x,y){
  return [
    {x:x, y:y-1},
    {x:x, y:y+1},
    {x:x-1, y:y},
    {x:x+1, y:y},
  ].filter(p=>inBounds(p.x,p.y));
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
function updateDeckCount(){
  deckCountBadge.textContent = `${deck.length}/${DECK_MAX}`;
}
function cardTagText(c){
  // “ゲームっぽい”一言タグ
  if (c.atk >= 7) return { text:"火力", cls:"good" };
  if (c.hp >= 20) return { text:"硬い", cls:"good" };
  if (c.mana <= 1) return { text:"軽い", cls:"" };
  return { text:"標準", cls:"" };
}

// --------------------
// LEFT UI: TABS
// --------------------
function setTab(which){
  const ownedOn = which === "owned";
  tabOwned.classList.toggle("active", ownedOn);
  tabDeck.classList.toggle("active", !ownedOn);
  ownedWrap.classList.toggle("active", ownedOn);
  deckWrap.classList.toggle("active", !ownedOn);
}
tabOwned?.addEventListener("click", ()=> setTab("owned"));
tabDeck?.addEventListener("click", ()=> setTab("deck"));

// --------------------
// CARD LIST RENDER
// --------------------
function renderOwned(){
  ownedList.innerHTML = "";
  if (!owned.length){
    ownedList.innerHTML = `<div class="card"><div class="cardName">まだ所持カードがない</div><div class="cardDesc">「初期3枚を配布」か、双六を進めてカードを集めよう。</div></div>`;
    return;
  }
  owned
    .slice()
    .sort((a,b)=> (a.mana-b.mana) || (b.atk-a.atk) || (b.hp-a.hp))
    .forEach((c,idx)=>{
      const tag = cardTagText(c);
      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div class="cardTop">
          <div>
            <div class="cardName">${escapeHtml(c.name)}</div>
            <div class="cardMeta">M${c.mana} / HP${c.hp} / ATK${c.atk}</div>
          </div>
          <div class="tag ${tag.cls}">${tag.text}</div>
        </div>
        <div class="cardDesc">${escapeHtml(c.desc||"")}</div>
        <div class="cardBtns">
          <button class="btn small primary" data-add="${idx}">デッキへ追加</button>
        </div>
      `;
      div.querySelector(`[data-add="${idx}"]`)?.addEventListener("click", ()=>{
        if (deck.length >= DECK_MAX){
          log("デッキが満杯（20枚）");
          openInfoModal("デッキ満杯", "デッキは最大20枚。いったん抜いてね。");
          return;
        }
        deck.push({ ...c });
        updateDeckCount();
        renderDeck();
        log(`デッキに追加：${c.name}`);
      });
      ownedList.appendChild(div);
    });
}
function renderDeck(){
  deckList.innerHTML = "";
  updateDeckCount();
  if (!deck.length){
    deckList.innerHTML = `<div class="card"><div class="cardName">デッキが空</div><div class="cardDesc">所持カードから追加してね。</div></div>`;
    return;
  }
  deck.forEach((c,idx)=>{
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div class="cardTop">
        <div>
          <div class="cardName">${escapeHtml(c.name)}</div>
          <div class="cardMeta">M${c.mana} / HP${c.hp} / ATK${c.atk}</div>
        </div>
        <span class="tag">#${idx+1}</span>
      </div>
      <div class="cardDesc">${escapeHtml(c.desc||"")}</div>
      <div class="cardBtns">
        <button class="btn small danger" data-remove="${idx}">抜く</button>
      </div>
    `;
    div.querySelector(`[data-remove="${idx}"]`)?.addEventListener("click", ()=>{
      const rm = deck.splice(idx,1)[0];
      updateDeckCount();
      renderDeck();
      log(`デッキから抜いた：${rm?.name ?? ""}`);
    });
    deckList.appendChild(div);
  });
}

// 初期3枚配布（双六の “初手山札” の体験）
btnStarterPack?.addEventListener("click", ()=>{
  if (owned.length){
    openInfoModal("初期配布", "すでに所持カードがあります。続けて双六を進めよう。");
    return;
  }
  const starters = [
    CARD_POOL.find(c=>c.id==="P001"),
    CARD_POOL.find(c=>c.id==="P002"),
    CARD_POOL.find(c=>c.id==="P003"),
  ].filter(Boolean).map(c=>({ ...c }));

  owned.push(...starters);
  // デッキにも最初は3枚入れておく（初手感）
  deck.push(...starters.map(c=>({ ...c })));

  setMoney(30);
  renderOwned();
  renderDeck();
  log("初期3枚を配布：整備士 / 新人ナース / 安全監視ヨシ");
  openInfoModal("初期3枚を配布", "探索スタート！サイコロを振って進もう。");
});

// デッキ自動整列
btnDeckAuto?.addEventListener("click", ()=>{
  deck.sort((a,b)=> (a.mana-b.mana) || (b.atk-a.atk) || (b.hp-a.hp));
  renderDeck();
  log("デッキを自動整列（M→ATK→HP）");
});
btnDeckClear?.addEventListener("click", ()=>{
  deck = [];
  renderDeck();
  log("デッキを全抜きした");
});

// --------------------
// MAP UI
// --------------------
function renderLegend(){
  mapLegend.innerHTML = "";
  LEGEND.forEach(t=>{
    const div = document.createElement("div");
    div.className = "legendItem";
    div.innerHTML = `<span class="dot"></span><span>${t.icon} ${t.name}</span>`;
    div.querySelector(".dot").style.background = tileColor(t.key);
    mapLegend.appendChild(div);
  });

  legendHelp.textContent =
    LEGEND.map(t=>`${t.icon} ${t.name}：${t.help}`).join("\n");
}
function tileColor(key){
  switch(key){
    case "START": return "rgba(255,255,255,.35)";
    case "MONEY": return "rgba(255,209,102,.75)";
    case "SHOP": return "rgba(124,92,255,.75)";
    case "CARD": return "rgba(54,211,153,.75)";
    case "VS": return "rgba(255,77,109,.75)";
    case "BOSS": return "rgba(255,77,109,.95)";
    case "GOAL": return "rgba(255,255,255,.65)";
    default: return "rgba(255,255,255,.35)";
  }
}
function renderTrack(){
  mapTrack.innerHTML = "";
  lenBadge.textContent = String(track.length - 1);
  posBadge.textContent = String(pos);
  const t = track[pos];
  tileBadge.textContent = t ? `${t.icon} ${t.name}` : "-";

  track.forEach((tile, i)=>{
    const div = document.createElement("div");
    div.className = "tile";
    if (i === pos) div.classList.add("here");
    if (i < pos) div.classList.add("done");
    div.innerHTML = `
      <div class="tileIcon">${tile.icon}</div>
      <div class="tileType">${tile.key}</div>
      <div class="tileName">${tile.name}</div>
      <div class="tileSmall">${escapeHtml(tile.help)}</div>
    `;
    div.style.borderColor = "rgba(255,255,255,.10)";
    // 色味（控えめ）
    div.style.boxShadow = (i === pos)
      ? `0 0 0 2px ${tileColor(tile.key)}33 inset`
      : "none";
    mapTrack.appendChild(div);
  });

  btnNextStage.disabled = !(track[pos]?.key === "GOAL");
}

// --------------------
// DICE + TILE RESOLVE
// --------------------
async function diceRoll(){
  if (phase !== "map") return;
  if (track[pos]?.key === "GOAL"){
    log("すでにGOAL。次のステージへ進めます。");
    return;
  }
  if (owned.length === 0){
    openInfoModal("まだ準備不足", "左の「初期3枚を配布」を押して、探索を開始しよう。");
    return;
  }

  const roll = 1 + Math.floor(Math.random()*6);
  btnDice.disabled = true;
  btnDice.textContent = `🎲 ${roll}`;
  log(`サイコロ：${roll}`);

  // コマ進行（簡易アニメ）
  for (let s=0; s<roll; s++){
    pos = Math.min(track.length - 1, pos + 1);
    renderTrack();
    await wait(140);
    if (track[pos]?.key === "GOAL") break;
  }

  btnDice.disabled = false;
  btnDice.textContent = `🎲 サイコロ`;

  // 着地効果
  await resolveTile(track[pos]);
}
btnDice?.addEventListener("click", diceRoll);

btnNextStage?.addEventListener("click", ()=>{
  if (track[pos]?.key !== "GOAL") return;
  if (stageIndex >= STAGE_COUNT-1){
    openInfoModal("完全勝利", "5ステージクリア！おめでとう。さらに拡張するなら、周回・難易度上昇・レア枠など足せる。");
    log("5ステージ完全クリア！");
    return;
  }
  stageIndex++;
  setStage(stageIndex);
  track = makeStageTrack(stageIndex);
  pos = 0;
  renderTrack();
  log(`次のステージへ：STAGE ${stageIndex+1}`);
});

async function resolveTile(tile){
  if (!tile) return;
  tileBadge.textContent = `${tile.icon} ${tile.name}`;

  switch(tile.key){
    case "START":{
      log("ステージ開始。");
      break;
    }
    case "MONEY":{
      const gain = 15 + Math.floor(Math.random()*15) + stageIndex*5;
      setMoney(money + gain);
      log(`お金マス：¥${gain} 獲得`);
      openInfoModal("💰 お金マス", `¥${gain} を獲得！`);
      break;
    }
    case "CARD":{
      log("入手マス：カード報酬");
      await openRewardChoice({ count: 3, title:"🎁 カード入手", hint:"1枚選んで所持に追加（デッキにも入れられる）" });
      break;
    }
    case "SHOP":{
      log("お店マス：購入できる");
      await openShop();
      break;
    }
    case "VS":{
      if (deck.length < 3){
        openInfoModal("デッキ不足", "バトルには最低3枚ほしい。左でデッキに追加してね。");
        log("デッキ不足でVS開始できない");
        break;
      }
      log("VSマス：戦闘開始");
      pendingTileResolve = { tileKey:"VS", boss:false };
      startBattle({ boss:false });
      break;
    }
    case "BOSS":{
      if (deck.length < 3){
        openInfoModal("デッキ不足", "ボス前にデッキを整えよう（最低3枚）。");
        log("デッキ不足でBOSS開始できない");
        break;
      }
      log("BOSSマス：強敵戦闘！");
      pendingTileResolve = { tileKey:"BOSS", boss:true };
      startBattle({ boss:true });
      break;
    }
    case "GOAL":{
      log("GOAL到達！次のステージへ進める。");
      openInfoModal("🚪 GOAL", "ステージクリア！右上の「次のステージへ」を押そう。");
      break;
    }
  }
}

// --------------------
// BATTLE (5x5 Move/Attack)  ※後で差し替えしやすい作り
// --------------------
function pickBattleTeamCards(){
  // いまは「デッキから先頭3枚」を出撃扱い（game.js方式に差し替え前提）
  const picks = deck.slice(0,3).map(c=>({ ...c }));
  if (picks.length < 3){
    // 足りないときは所持から補完
    const extra = owned.filter(c=>!picks.some(p=>p.id===c.id)).slice(0, 3-picks.length).map(c=>({ ...c }));
    picks.push(...extra);
  }
  return picks.slice(0,3);
}

function startBattle({ boss }){
  // reset battle state
  turn = 1;
  side = "YOU";
  mode = "NONE";
  selectedUid = null;
  units = [];

  // player spawn bottom row
  const picks = pickBattleTeamCards();
  const spawnX = [1,2,3];
  picks.forEach((card,i)=>{
    units.push({
      uid: uid(),
      team: "YOU",
      card: { ...card },
      hp: card.hp,
      maxHp: card.hp,
      x: spawnX[i] ?? i,
      y: 4,
    });
  });

  // enemy spawn top row（ボスなら硬く/強く）
  const enemies = shuffle([...ENEMY_POOL]).slice(0,3).map(c=>({ ...c }));
  if (boss){
    enemies.forEach(e=>{
      e.hp = Math.floor(e.hp * 1.25);
      e.atk = Math.ceil(e.atk * 1.15);
      e.name = `BOSS:${e.name}`;
      e.desc = "ボス補正（硬め/強め）";
    });
  }
  const ex = [1,2,3];
  enemies.forEach((card,i)=>{
    units.push({
      uid: uid(),
      team: "ENEMY",
      card: { ...card },
      hp: card.hp,
      maxHp: card.hp,
      x: ex[i] ?? i,
      y: 0,
    });
  });

  showBattle();
  updateHeaderCounts();
  updateModeUI();
  setStatus(boss ? "ボス戦！" : "戦闘開始");
  log(boss ? "ボス戦開始！" : "戦闘開始！ユニットを選択して移動/攻撃。");

  renderGrid();
}

function renderGrid(){
  gridEl.innerHTML = "";

  const sel = getSelected();
  const selTeam = sel?.team || null;

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

      if (u){
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

  if (!sel) selLabelEl.textContent = "なし";
  else selLabelEl.textContent = `${sel.card.name} (${sel.team})`;
}

function onCellClick(x,y){
  const u = getUnitAt(x,y);

  // selecting
  if (mode === "NONE" || !selectedUid){
    if (u){
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
    if (u){ selectedUid = u.uid; renderGrid(); }
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
    if (!target || target.team === sel.team) return;

    const dmg = sel.card.atk;
    target.hp = Math.max(0, target.hp - dmg);
    log(`${sel.card.name} の攻撃！ → ${target.card.name} に ${dmg} ダメージ`);

    if (target.hp <= 0){
      log(`撃破！ ${target.card.name} を倒した`);
    }

    mode = "NONE";
    updateModeUI();
    renderGrid();
    checkWinLose();
    return;
  }

  if (u){
    selectedUid = u.uid;
    renderGrid();
  }
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

function endTurn(){
  if (aliveUnits("YOU").length<=0 || aliveUnits("ENEMY").length<=0) return;
  if (side !== "YOU") return;

  side = "ENEMY";
  updateHeaderCounts();
  setStatus("敵ターン");
  log("敵のターン…");

  enemyAct();

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

    // move toward nearest player（超簡易）
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

  renderGrid();
  checkWinLose();
}

function checkWinLose(){
  const you = aliveUnits("YOU").length;
  const en = aliveUnits("ENEMY").length;
  updateHeaderCounts();

  if (en <= 0){
    setStatus("勝利！");
    log("敵を全滅！勝利！");
    onBattleEnd(true);
  } else if (you <= 0){
    setStatus("敗北…");
    log("味方が全滅…敗北。");
    onBattleEnd(false);
  }
}

async function onBattleEnd(win){
  // 入力ロックっぽく（手軽）
  btnEndTurn.disabled = true;
  btnMoveMode.disabled = true;
  btnAttackMode.disabled = true;

  const boss = !!pendingTileResolve?.boss;

  if (win){
    // 勝利報酬：カード選択（ボスは多め＆お金）
    const bonusMoney = boss ? (60 + stageIndex*15) : (25 + stageIndex*8);
    setMoney(money + bonusMoney);
    log(`勝利報酬：¥${bonusMoney} 獲得`);

    await openRewardChoice({
      count: boss ? 4 : 3,
      title: boss ? "👑 ボス報酬" : "🎁 勝利報酬",
      hint: boss ? "1枚選んで所持に追加（ボスは選択肢が多い）" : "1枚選んで所持に追加"
    });

    openInfoModal("勝利", "マップへ戻る。次のサイコロへ！");
    showMap();
    renderTrack();
  } else {
    // 敗北：罰（お金減）→ マップに戻る（そのマスは再挑戦可）
    const loseCost = Math.min(money, 25 + stageIndex*10);
    setMoney(money - loseCost);
    openInfoModal("敗北", `撤退… ¥${loseCost} を失った。立て直して再挑戦しよう。`);
    showMap();
    renderTrack();
  }

  pendingTileResolve = null;

  // battle buttons restore
  btnEndTurn.disabled = false;
  btnMoveMode.disabled = false;
  btnAttackMode.disabled = false;
}

// --------------------
// MODAL HELPERS
// --------------------
function openModal({ title, bodyHtml, footerHtml }){
  modalTitle.textContent = title ?? "情報";
  modalBody.innerHTML = bodyHtml ?? "";
  modalFooter.innerHTML = footerHtml ?? "";
  modalBackdrop.classList.add("open");
  modalBackdrop.setAttribute("aria-hidden","false");
}
function closeModal(){
  modalBackdrop.classList.remove("open");
  modalBackdrop.setAttribute("aria-hidden","true");
}
modalClose?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", (e)=>{
  if (e.target === modalBackdrop) closeModal();
});

function openInfoModal(title, text){
  openModal({
    title,
    bodyHtml: `
      <div class="card" style="min-width: 280px;">
        <div class="cardName">${escapeHtml(title)}</div>
        <div class="cardDesc">${escapeHtml(text)}</div>
      </div>
    `,
    footerHtml: `<button class="btn primary" id="btnModalOk">OK</button>`
  });
  $("btnModalOk")?.addEventListener("click", closeModal);
}

async function openRewardChoice({ count, title, hint }){
  const choices = makeRewardChoices(count);

  return new Promise((resolve)=>{
    openModal({
      title,
      bodyHtml: `
        <div style="width:100%; color:rgba(255,255,255,.65); font-size:12px; margin-bottom:6px;">
          ${escapeHtml(hint || "1枚選んで所持に追加")}
        </div>
        ${choices.map((c,i)=> rewardCardHtml(c,i)).join("")}
      `,
      footerHtml: `<button class="btn ghost" id="btnSkipReward">スキップ</button>`
    });

    $("btnSkipReward")?.addEventListener("click", ()=>{
      log("報酬スキップ");
      closeModal();
      renderOwned();
      resolve();
    });

    choices.forEach((c,i)=>{
      const btn = document.querySelector(`[data-reward="${i}"]`);
      btn?.addEventListener("click", ()=>{
        owned.push({ ...c });
        log(`カード入手：${c.name}`);
        // “集める楽しさ”を強めるため、入手時はデッキへ入れるか選べる
        closeModal();
        openModal({
          title: "入手！",
          bodyHtml: `
            <div class="card" style="min-width:320px;">
              <div class="cardTop">
                <div>
                  <div class="cardName">${escapeHtml(c.name)}</div>
                  <div class="cardMeta">M${c.mana} / HP${c.hp} / ATK${c.atk}</div>
                </div>
                <div class="tag good">NEW</div>
              </div>
              <div class="cardDesc">${escapeHtml(c.desc||"")}</div>
            </div>
          `,
          footerHtml: `
            <button class="btn" id="btnKeepOwned">所持だけ</button>
            <button class="btn primary" id="btnAddDeck">デッキにも入れる</button>
          `
        });

        $("btnKeepOwned")?.addEventListener("click", ()=>{
          closeModal();
          renderOwned();
          renderDeck();
          resolve();
        });
        $("btnAddDeck")?.addEventListener("click", ()=>{
          if (deck.length >= DECK_MAX){
            log("デッキ満杯で追加できない");
            openInfoModal("デッキ満杯", "所持には入った。デッキに入れるなら抜いてから。");
            renderOwned();
            renderDeck();
            resolve();
            return;
          }
          deck.push({ ...c });
          log(`デッキにも追加：${c.name}`);
          closeModal();
          renderOwned();
          renderDeck();
          resolve();
        });
      });
    });
  });
}

function rewardCardHtml(c,i){
  const tag = cardTagText(c);
  return `
    <div class="card" style="width: 260px;">
      <div class="cardTop">
        <div>
          <div class="cardName">${escapeHtml(c.name)}</div>
          <div class="cardMeta">M${c.mana} / HP${c.hp} / ATK${c.atk}</div>
        </div>
        <div class="tag ${tag.cls}">${tag.text}</div>
      </div>
      <div class="cardDesc">${escapeHtml(c.desc||"")}</div>
      <div class="cardBtns">
        <button class="btn primary small" data-reward="${i}">これにする</button>
      </div>
    </div>
  `;
}

function makeRewardChoices(n){
  // “所持済みが出てもOK”のローグライト風。気になるなら重複排除も可
  const pool = shuffle([...CARD_POOL]);
  const out = [];
  for (const c of pool){
    out.push({ ...c });
    if (out.length >= n) break;
  }
  return out;
}

// SHOP
async function openShop(){
  const items = makeShopItems(4);
  return new Promise((resolve)=>{
    openModal({
      title: "🏪 お店",
      bodyHtml: `
        <div style="width:100%; color:rgba(255,255,255,.65); font-size:12px; margin-bottom:6px;">
          所持金：¥${money} / 1枚買えます（価格はマナ基準）
        </div>
        ${items.map((c,i)=> shopCardHtml(c,i)).join("")}
      `,
      footerHtml: `
        <button class="btn ghost" id="btnShopClose">閉じる</button>
      `
    });
    $("btnShopClose")?.addEventListener("click", ()=>{
      closeModal();
      resolve();
    });

    items.forEach((c,i)=>{
      document.querySelector(`[data-buy="${i}"]`)?.addEventListener("click", ()=>{
        const price = shopPrice(c);
        if (money < price){
          openInfoModal("お金が足りない", `¥${price} 必要（今¥${money}）`);
          return;
        }
        setMoney(money - price);
        owned.push({ ...c });
        log(`購入：${c.name}（¥${price}）`);
        closeModal();
        renderOwned();
        openInfoModal("購入完了", `${c.name} を所持に追加！`);
        resolve();
      });
    });
  });
}
function shopPrice(c){
  // 価格はステージで微増（後半しんどくしすぎない程度）
  return (c.mana * 25) + (stageIndex * 10);
}
function makeShopItems(n){
  const pool = shuffle([...CARD_POOL]);
  return pool.slice(0,n).map(c=>({ ...c }));
}
function shopCardHtml(c,i){
  const price = shopPrice(c);
  const tag = cardTagText(c);
  const can = money >= price;
  return `
    <div class="card" style="width: 260px; opacity:${can ? 1 : .72}">
      <div class="cardTop">
        <div>
          <div class="cardName">${escapeHtml(c.name)}</div>
          <div class="cardMeta">M${c.mana} / HP${c.hp} / ATK${c.atk}</div>
        </div>
        <div class="tag ${tag.cls}">${tag.text}</div>
      </div>
      <div class="cardDesc">${escapeHtml(c.desc||"")}</div>
      <div class="cardBtns">
        <span class="tag ${can ? "good" : "bad"}">¥${price}</span>
        <button class="btn primary small" data-buy="${i}" ${can ? "" : "disabled"}>購入</button>
      </div>
    </div>
  `;
}

// --------------------
// WIRING
// --------------------
btnBackDeck?.addEventListener("click", ()=>{ location.href = "./deck.html"; });
btnMoveMode?.addEventListener("click", ()=> setMode("MOVE"));
btnAttackMode?.addEventListener("click", ()=> setMode("ATTACK"));
btnEndTurn?.addEventListener("click", endTurn);
btnRetreat?.addEventListener("click", ()=>{
  if (phase !== "battle") return;
  log("撤退した…（敗北扱い）");
  onBattleEnd(false);
});
btnLogClear?.addEventListener("click", ()=>{ logEl.textContent = ""; });

window.addEventListener("keydown", (e)=>{
  if (e.key === "Escape"){
    if (modalBackdrop.classList.contains("open")){
      closeModal();
      return;
    }
    if (phase === "battle"){
      mode = "NONE";
      updateModeUI();
      renderGrid();
    }
  }
});

// --------------------
// BOOT
// --------------------
function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

function boot(){
  setStage(0);
  setMoney(0);
  owned = [];
  deck = [];
  setTab("owned");
  renderLegend();
  renderOwned();
  renderDeck();
  renderTrack();

  showMap();
  setStatus("探索開始");
  log("アーケード（双六ローグ）：まず左の「初期3枚を配布」→ サイコロで進め！");
}
boot();