const STORAGE_KEY = "zeroBattlePaperHelper_v3";

const defaultState = {
  turn: 1,
  active: "a",
  first: "a",
  winner: "",
  diceText: "?",
  diceJudge: "通常判定",
  diceSubtext: "ここに結果が表示されます",
  log: [{ time: time(), text: "起動しました" }],
  players: {
    a: {
      name: "プレイヤーA",
      mana: 2,
      maxMana: 2,
      kills: 0,
      infil: 0,
      deck: 20,
      hand: 5,
      memo: "",
    },
    b: {
      name: "プレイヤーB",
      mana: 2,
      maxMana: 2,
      kills: 0,
      infil: 0,
      deck: 20,
      hand: 5,
      memo: "",
    },
  },
};

let state = loadState();

const refs = {
  turnDisplay: document.getElementById("turnDisplay"),
  activePlayerDisplay: document.getElementById("activePlayerDisplay"),
  firstPlayerDisplay: document.getElementById("firstPlayerDisplay"),
  winnerDisplay: document.getElementById("winnerDisplay"),
  turnBanner: document.getElementById("turnBanner"),
  diceCard: document.querySelector(".dice-card"),
  diceDisplay: document.getElementById("diceDisplay"),
  diceJudge: document.getElementById("diceJudge"),
  diceSubtext: document.getElementById("diceSubtext"),
  logList: document.getElementById("logList"),
  nameA: document.getElementById("nameA"),
  nameB: document.getElementById("nameB"),
  memoA: document.getElementById("memoA"),
  memoB: document.getElementById("memoB"),

  killsABar: document.getElementById("killsABar"),
  infilABar: document.getElementById("infilABar"),
  killsBBar: document.getElementById("killsBBar"),
  infilBBar: document.getElementById("infilBBar"),

  killsAText: document.getElementById("killsAText"),
  infilAText: document.getElementById("infilAText"),
  killsBText: document.getElementById("killsBText"),
  infilBText: document.getElementById("infilBText"),

  manaAValue: document.getElementById("manaAValue"),
  maxManaAValue: document.getElementById("maxManaAValue"),
  killsAValue: document.getElementById("killsAValue"),
  infilAValue: document.getElementById("infilAValue"),
  deckAValue: document.getElementById("deckAValue"),
  handAValue: document.getElementById("handAValue"),
  manaAGems: document.getElementById("manaAGems"),

  manaBValue: document.getElementById("manaBValue"),
  maxManaBValue: document.getElementById("maxManaBValue"),
  killsBValue: document.getElementById("killsBValue"),
  infilBValue: document.getElementById("infilBValue"),
  deckBValue: document.getElementById("deckBValue"),
  handBValue: document.getElementById("handBValue"),
  manaBGems: document.getElementById("manaBGems"),
};

let isRolling = false;

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.action === "change") {
    changeStat(btn.dataset.player, btn.dataset.key, Number(btn.dataset.delta));
    return;
  }

  if (btn.dataset.action === "changeMana") {
    changeMana(btn.dataset.player, Number(btn.dataset.delta));
    return;
  }

  if (btn.dataset.dice) {
    roll(btn.dataset.dice);
    return;
  }

  if (btn.id === "roll1d100Btn") {
    roll("1d100");
    return;
  }

  if (btn.id === "toggleTurnBtn") {
    toggleTurn();
    return;
  }

  if (btn.id === "nextTurnBtn") {
    state.turn += 1;
    pushLog(`ターンを ${state.turn} に進めました。`);
    sync();
    return;
  }

  if (btn.id === "setFirstA") {
    setFirst("a");
    return;
  }

  if (btn.id === "setFirstB") {
    setFirst("b");
    return;
  }

  if (btn.id === "clearLogBtn") {
    state.log = [];
    pushLog("ログを消去しました。");
    sync();
    return;
  }

  if (btn.id === "resetBtn") {
    const ok = window.confirm("対戦データをすべて初期化する？");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(defaultState);
    sync();
  }
});

refs.nameA.addEventListener("input", () => {
  state.players.a.name = refs.nameA.value || "プレイヤーA";
  sync(false);
});

refs.nameB.addEventListener("input", () => {
  state.players.b.name = refs.nameB.value || "プレイヤーB";
  sync(false);
});

refs.memoA.addEventListener("input", () => {
  state.players.a.memo = refs.memoA.value;
  saveState();
});

refs.memoB.addEventListener("input", () => {
  state.players.b.memo = refs.memoB.value;
  saveState();
});

function setFirst(player) {
  state.first = player;
  state.active = player;
  pushLog(`${state.players[player].name} を先攻に設定しました。`);
  sync();
}

function changeStat(player, key, delta) {
  const p = state.players[player];
  p[key] = Math.max(0, Number(p[key] || 0) + delta);

  pushLog(`${p.name} の ${labelJa(key)} ${signed(delta)} → ${p[key]}`);
  sync();
}

function changeMana(player, delta) {
  const p = state.players[player];
  const prev = p.mana;
  p.mana = clamp(Number(p.mana || 0) + delta, 0, Number(p.maxMana || 0));

  const actionText = delta < 0 ? "使用" : "回復";
  pushLog(`${p.name} のマナ ${actionText} ${signed(delta)} → ${prev} から ${p.mana}`);
  sync();
}

function toggleTurn() {
  state.active = state.active === "a" ? "b" : "a";
  state.turn += 1;

  const p = state.players[state.active];
  const prevMana = Number(p.mana || 0);
  const prevMaxMana = Number(p.maxMana || 0);
  p.maxMana = Math.max(0, prevMaxMana + 2);
  p.mana = clamp(prevMana + 2, 0, p.maxMana);

  pushLog(`エンドフェイズ。${p.name} の手番へ。マナ +2 → ${p.mana}/${p.maxMana}`);
  sync();
}

function roll(type) {
  if (isRolling) return;
  const result = buildRollResult(type);
  playRollAnimation(type, result);
}

function buildRollResult(type) {
  let resultText = "";
  let judgeText = "通常判定";
  let subtext = "";

  if (type === "1d100") {
    const n = rand(1, 100);
    resultText = String(n);

    if (n >= 1 && n <= 5) {
      judgeText = "クリティカル";
    } else if (n >= 96 && n <= 100) {
      judgeText = "ファンブル";
    } else {
      judgeText = "通常判定";
    }

    subtext = `1D100 → ${n}`;
    return { resultText, judgeText, subtext, logText: `${subtext} / ${judgeText}` };
  }

  if (type === "1d6") {
    const n = rand(1, 6);
    resultText = String(n);
    subtext = `1D6 → ${n}`;
  } else if (type === "2d6") {
    const a = rand(1, 6);
    const b = rand(1, 6);
    resultText = String(a + b);
    subtext = `2D6 → ${a} + ${b} = ${a + b}`;
  } else if (type === "1d20") {
    const n = rand(1, 20);
    resultText = String(n);
    subtext = `1D20 → ${n}`;
  } else if (type === "coin") {
    const side = Math.random() < 0.5 ? "表" : "裏";
    resultText = side;
    subtext = `コイン → ${side}`;
  }

  return { resultText, judgeText: "通常判定", subtext, logText: subtext };
}

function playRollAnimation(type, result) {
  isRolling = true;
  refs.diceCard?.classList.add("is-rolling");
  refs.diceDisplay.classList.remove("critical", "fumble", "normal");
  refs.diceDisplay.classList.add("rolling");
  refs.diceJudge.classList.remove("critical", "fumble");
  refs.diceJudge.textContent = "ROLLING";
  refs.diceSubtext.textContent = `${diceTypeLabel(type)} を判定中...`;

  const start = performance.now();
  const duration = type === "1d100" ? 760 : 620;
  const tick = () => {
    refs.diceDisplay.textContent = previewRollValue(type);
    if (performance.now() - start < duration) {
      requestAnimationFrame(tick);
      return;
    }

    state.diceText = result.resultText;
    state.diceJudge = result.judgeText;
    state.diceSubtext = result.subtext;
    pushLog(result.logText);
    syncDiceClass(result.judgeText);
    sync();
    refs.diceCard?.classList.remove("is-rolling");
    isRolling = false;
  };

  requestAnimationFrame(tick);
}

function previewRollValue(type) {
  if (type === "1d100") return String(rand(1, 100)).padStart(2, "0");
  if (type === "1d6") return String(rand(1, 6));
  if (type === "2d6") return String(rand(2, 12));
  if (type === "1d20") return String(rand(1, 20));
  if (type === "coin") return Math.random() < 0.5 ? "表" : "裏";
  return "?";
}

function diceTypeLabel(type) {
  const map = {
    "1d100": "1D100",
    "1d6": "1D6",
    "2d6": "2D6",
    "1d20": "1D20",
    coin: "コイン",
  };
  return map[type] || "ダイス";
}

function syncDiceClass(judgeText) {
  refs.diceDisplay.classList.remove("critical", "fumble", "normal", "rolling");
  refs.diceJudge.classList.remove("critical", "fumble");

  void refs.diceDisplay.offsetWidth;

  if (judgeText === "クリティカル") {
    refs.diceDisplay.classList.add("critical");
    refs.diceJudge.classList.add("critical");
  } else if (judgeText === "ファンブル") {
    refs.diceDisplay.classList.add("fumble");
    refs.diceJudge.classList.add("fumble");
  } else {
    refs.diceDisplay.classList.add("normal");
  }
}

function labelJa(key) {
  const map = {
    kills: "撃破",
    infil: "侵入",
    deck: "山札",
    hand: "手札",
  };
  return map[key] || key;
}

function signed(n) {
  return n > 0 ? `+${n}` : String(n);
}

function checkWin() {
  const a = state.players.a;
  const b = state.players.b;

  if (a.kills >= 3 || a.infil >= 3) return a.name;
  if (b.kills >= 3 || b.infil >= 3) return b.name;
  return "";
}

function updateGauge(barEl, textEl, value) {
  const clamped = Math.min(3, Math.max(0, Number(value || 0)));
  barEl.style.width = `${(clamped / 3) * 100}%`;
  textEl.textContent = `${value} / 3`;
}

function renderManaGems(container, mana, maxMana) {
  container.innerHTML = "";

  const safeMax = Math.max(0, Number(maxMana || 0));
  const safeMana = clamp(Number(mana || 0), 0, safeMax);

  for (let i = 0; i < safeMax; i++) {
    const gem = document.createElement("span");
    gem.className = `mana-gem ${i < safeMana ? "on" : "off"}`;
    container.appendChild(gem);
  }
}

function pushLog(text) {
  state.log.push({ time: time(), text });
  if (state.log.length > 200) state.log = state.log.slice(-200);
}

function render() {
  refs.turnDisplay.textContent = state.turn;
  refs.activePlayerDisplay.textContent = state.players[state.active].name;
  refs.firstPlayerDisplay.textContent = state.first ? state.players[state.first].name : "未設定";

  const winner = checkWin();
  state.winner = winner;
  refs.winnerDisplay.textContent = winner ? `${winner} 勝利` : "進行中";
  refs.turnBanner.textContent = `${state.players[state.active].name} のターン`;

  refs.diceDisplay.textContent = state.diceText;
  refs.diceJudge.textContent = state.diceJudge;
  refs.diceSubtext.textContent = state.diceSubtext;

  refs.nameA.value = state.players.a.name;
  refs.nameB.value = state.players.b.name;
  refs.memoA.value = state.players.a.memo;
  refs.memoB.value = state.players.b.memo;

  refs.manaAValue.textContent = state.players.a.mana;
  refs.maxManaAValue.textContent = state.players.a.maxMana;
  refs.killsAValue.textContent = state.players.a.kills;
  refs.infilAValue.textContent = state.players.a.infil;
  refs.deckAValue.textContent = state.players.a.deck;
  refs.handAValue.textContent = state.players.a.hand;

  refs.manaBValue.textContent = state.players.b.mana;
  refs.maxManaBValue.textContent = state.players.b.maxMana;
  refs.killsBValue.textContent = state.players.b.kills;
  refs.infilBValue.textContent = state.players.b.infil;
  refs.deckBValue.textContent = state.players.b.deck;
  refs.handBValue.textContent = state.players.b.hand;

  renderManaGems(refs.manaAGems, state.players.a.mana, state.players.a.maxMana);
  renderManaGems(refs.manaBGems, state.players.b.mana, state.players.b.maxMana);

  updateGauge(refs.killsABar, refs.killsAText, state.players.a.kills);
  updateGauge(refs.infilABar, refs.infilAText, state.players.a.infil);
  updateGauge(refs.killsBBar, refs.killsBText, state.players.b.kills);
  updateGauge(refs.infilBBar, refs.infilBText, state.players.b.infil);

  refs.logList.innerHTML = [...state.log]
    .reverse()
    .map(
      (entry) =>
        `<div class="log-entry"><span class="log-time">${escapeHtml(entry.time)}</span>${escapeHtml(entry.text)}</div>`
    )
    .join("");
}

function sync(save = true) {
  render();
  if (save) saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);

    const parsed = JSON.parse(raw);
    const merged = structuredClone(defaultState);

    merged.turn = Math.max(1, Number(parsed.turn || 1));
    merged.active = parsed.active === "b" ? "b" : "a";
    merged.first = parsed.first === "a" || parsed.first === "b" ? parsed.first : "a";
    merged.winner = typeof parsed.winner === "string" ? parsed.winner : "";
    merged.diceText = parsed.diceText || "?";
    merged.diceJudge = parsed.diceJudge || "通常判定";
    merged.diceSubtext = parsed.diceSubtext || "ここに結果が表示されます";
    merged.log = Array.isArray(parsed.log) ? parsed.log.slice(-200) : merged.log;

    ["a", "b"].forEach((player) => {
      const src = parsed.players?.[player] || {};
      const dst = merged.players[player];
      dst.name = typeof src.name === "string" && src.name.trim() ? src.name : dst.name;
      dst.memo = typeof src.memo === "string" ? src.memo : "";
      ["mana", "maxMana", "kills", "infil", "deck", "hand"].forEach((key) => {
        dst[key] = Math.max(0, Number(src[key] ?? dst[key]));
      });
      dst.mana = clamp(dst.mana, 0, dst.maxMana);
    });

    return merged;
  } catch {
    return structuredClone(defaultState);
  }
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function time() {
  return new Date().toLocaleTimeString("ja-JP", { hour12: false });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

syncDiceClass(state.diceJudge);
sync(false);
