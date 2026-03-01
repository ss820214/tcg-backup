// public/game.js
// v20260202_full_repair_no_feature_drop_plus_infil_fix_plus_draw_fix_owner_buff_icons
//
// - 未定義で落ちる箇所を修復（infil / win判定 / evolveログなど）
// - ✅ ドローが増えない問題を完全修正：safeDrawCards() を導入して endTurn / Support(draw) を強制成功
// - ✅ バフ/デバフのアイコン表示を強化：status/statuses 両対応 + 表示安定化
// - ✅ 所有者表示をわかりやすく：OWNER表示を「YOU/ENEMY + 色リボン」
// - ✅ 攻撃：対象選択→「行動実行」ボタンで確定（即実行しない）
// - ✅ サポート：対象選択→「サポート実行」ボタンで確定（moveTo等を分かりやすく）
// - ✅ パニック：盤面表示に😱PANICを出す
// - ※ 既存機能は削らない（UI/EX/Support/FX/Range 等は維持）

let didGoVictory = false;

function normSeat(t) {
  const s = String(t ?? "").toUpperCase();
  return s === "A" || s === "B" ? s : null;
}

// ===== Support core (Support + EX) =====
import {
  applySupport,
  isSupportCard,
  resolveSupportEffect,
  applyExSupport,
} from "./support_core.js?v=20260207";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  nowMs,
  normalizeMana,
  spendMana,
  getManaConsts,
} from "./game_core.js?v=20260207";

import { createEvolveSystem } from "./evolve_system.js?v=20260207";

import {
  W,
  H,
  DRAW_PER_TURN,
  summonArea,
  computeInfil,
  checkWin,
  drawCards,
  uid,
  shuffle,
  isPanic,
  getStatus,
  formatStatusList,
  applyStatusesOnHit,
  calcHitRateWithStatus,
  checkEvade,
  isMoveBlockedByStatus,
  applyBleedOnMove,
  applySmellOnTurnEnd,

  // ★追加（state 側の仕様を使う）
  applyPowerUpToHpDamage,
  applyArmorToHpDamage,
  parseAddStatus,
  parseTags,

  // ✅ 追加：疲労回復/状態クリア（互換で確実に）
  clearFatigue,
  clearStatuses,
  isAlive,
} from "./game_state.js?v=20260207";

// ===== Field system =====
import {
  TYPE_RGB,
  hexToRgba,
  typeColorStrong,
  typeColorSoft,
  typeColor,
  ensureFieldThemeCss,
  applyFieldThemeFromState,
  ensureHandCss,
  ensureActionPickerCss,
  ensureBoardUnitCss,
  ensureBoardAssistCss,
} from "./ui_styles.js?v=20260211";

import {
  normalizeFieldId,
  fieldNameJa,
  ensureFieldState,
  applyFieldMoveRule,
  applyFieldOnStepAfterMove,
  applyFieldOnTurnStart, // ★追加
} from "./field_system.js?v=20260205_field_v1";

import { supportEffectTextJa } from "./support_text.js?v=20260207";

// settings (optional)
let initSettings = null;
try {
  const mod = await import("./settings.js?v=20260207");
  initSettings = mod?.initSettings || null;
} catch {}

const CORE = getManaConsts();
const MAX_MANA_UI = CORE.MAX_MANA ?? 20;

// ★追加：場の上限
const MAX_UNITS_PER_PLAYER = 5;

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com")
    ? "tcg-0bato"
    : "tcg-0bato",
};
console.log("[firebaseConfig]", firebaseConfig);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// DOM
// =====================

// Score UI (new) 2026/02/18: 既存の kill/infil UI をリプレイス（同じIDを引き継いでいるので、既存部屋でも勝利条件が変わるだけで落ちないはず）
const killMeterA = document.getElementById("killMeterA");
const killMeterB = document.getElementById("killMeterB");
const infilMeterA = document.getElementById("infilMeterA");
const infilMeterB = document.getElementById("infilMeterB");

const killTextA = document.getElementById("killTextA");
const killTextB = document.getElementById("killTextB");
const infilTextA = document.getElementById("infilTextA");
const infilTextB = document.getElementById("infilTextB");
const boardEl = document.getElementById("board");
const youEl = document.getElementById("you");
const turnEl = document.getElementById("turn");
const manaEl = document.getElementById("mana");
const manaGaugeEl = document.getElementById("manaGauge");
const deckCountEl = document.getElementById("deckCount");
const handEl = document.getElementById("hand");
const actionPickerEl = document.getElementById("actionPicker");
const detailEl = document.getElementById("detail");
const diceEl = document.getElementById("dice");
const logEl = document.getElementById("log");

const killsEl = document.getElementById("kills");
const infilEl = document.getElementById("infil");
const modeHintEl = document.getElementById("modeHint");

const btnSummon = document.getElementById("modeSummon");
const btnMove = document.getElementById("modeMove");
const btnAttack = document.getElementById("modeAttack");
const btnEvolve = document.getElementById("modeEvolve");
const btnSupport = document.getElementById("modeSupport");
const btnDoEvolve = document.getElementById("doEvolve");
const btnEnd = document.getElementById("endTurn");
const turnBanner = document.getElementById("turnBanner");

const quickActionsEl = document.getElementById("quickActions");
const btnQuickMove = document.getElementById("quickMove");
const btnQuickAttack = document.getElementById("quickAttack");
const quickMsgEl = document.getElementById("quickMsg");

// Pinch + EX UI
const pinchFxEl = document.getElementById("pinchFx");
const exWrapEl = document.getElementById("exWrap");
const exBtnEl = document.getElementById("exBtn");
const exInfoEl = document.getElementById("exInfo");

// FX
const fxFlashEl = document.getElementById("fxFlash");

// =====================
// v2.0.9: 乱数調整ボタン（見た目だけ）
// =====================
let rngMsgUntil = 0;
function ensureRngButton() {
  if (!logEl) return null;
  let btn = document.getElementById("btnRngReset");
  if (btn) return btn;

  btn = document.createElement("button");
  btn.id = "btnRngReset";
  btn.type = "button";
  btn.textContent = "🎲 乱数調整";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "12px";
  btn.title = "見た目だけ（乱数は実際には変わりません）";

  const parent = logEl.parentNode;
  if (parent) parent.insertBefore(btn, logEl);

  btn.addEventListener("click", () => {
    rngMsgUntil = nowMs() + 2200;
    render(currentState);
  });

  return btn;
}

// Optional Settings button auto-mount (if settings.js exists)
function ensureSettingsButton() {
  if (!initSettings) return null;
  let btn = document.getElementById("btnSettings");
  if (btn) return btn;

  const left = document.getElementById("leftPane");
  if (!left) return null;

  btn = document.createElement("button");
  btn.id = "btnSettings";
  btn.type = "button";
  btn.textContent = "⚙️ 設定";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";

  const controls = left.querySelector(".controls");
  if (controls && controls.parentNode)
    controls.parentNode.insertBefore(btn, controls);
  else left.appendChild(btn);

  btn.addEventListener("click", () => {
    try {
      initSettings?.({ db, roomId, playerId });
    } catch {}
  });

  return btn;
}

// =====================
// BGM Toggle button (simple)
// =====================
let bgmAudio = null;
let bgmEnabled = true;

function loadBgmPref() {
  try {
    const v = localStorage.getItem("bgmEnabled");
    if (v === "0") bgmEnabled = false;
    if (v === "1") bgmEnabled = true;
  } catch {}
}
function saveBgmPref() {
  try {
    localStorage.setItem("bgmEnabled", bgmEnabled ? "1" : "0");
  } catch {}
}

function ensureBgmAudio() {
  if (bgmAudio) return bgmAudio;
  // ★ここを自分のBGMファイルに変えてね（例）
  const src = "./assets/bgm/battle_bgm.mp3"; // ←ファイルパス調整
  const a = new Audio(src);
  a.loop = true;
  a.volume = 0.35;
  bgmAudio = a;
  return a;
}

async function setBgmEnabled(on) {
  bgmEnabled = !!on;
  saveBgmPref();

  const a = ensureBgmAudio();
  if (!bgmEnabled) {
    try {
      a.pause();
    } catch {}
    return;
  }
  // autoplay制限があるので、ボタンクリックでのみ確実に再生される
  try {
    await a.play();
  } catch {
    // 失敗しても落とさない（ブラウザ制限）
  }
}

function ensureBgmToggleButton() {
  loadBgmPref();

  let btn = document.getElementById("btnBgmToggle");
  if (btn) {
    btn.textContent = bgmEnabled ? "🔊 BGM ON" : "🔇 BGM OFF";
    return btn;
  }

  const left = document.getElementById("leftPane");
  if (!left) return null;

  btn = document.createElement("button");
  btn.id = "btnBgmToggle";
  btn.type = "button";
  btn.textContent = bgmEnabled ? "🔊 BGM ON" : "🔇 BGM OFF";
  btn.style.margin = "6px 2px";
  btn.style.border = "1px solid #555";
  btn.style.background = "#262626";
  btn.style.color = "#fff";
  btn.style.borderRadius = "10px";
  btn.style.padding = "7px 10px";
  btn.style.cursor = "pointer";

  // 設定ボタンの横に置く
  const settingsBtn = document.getElementById("btnSettings");
  if (settingsBtn && settingsBtn.parentNode) {
    settingsBtn.parentNode.insertBefore(btn, settingsBtn.nextSibling);
  } else {
    // 設定ボタンが無い場合はcontrolsの手前
    const controls = left.querySelector(".controls");
    if (controls && controls.parentNode)
      controls.parentNode.insertBefore(btn, controls);
    else left.appendChild(btn);
  }

  btn.addEventListener("click", async () => {
    await setBgmEnabled(!bgmEnabled);
    btn.textContent = bgmEnabled ? "🔊 BGM ON" : "🔇 BGM OFF";
  });

  // 初期状態：OFFなら止める / ONなら(自動再生は無理なので)何もしない
  if (!bgmEnabled) {
    try {
      ensureBgmAudio().pause();
    } catch {}
  }

  return btn;
}

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
const roomId = params.get("room");
const playerId = params.get("player");
// ✅ フィールド選択（URLで切替）: ?field=grass | danger | swamp
const fieldIdFromUrl = normalizeFieldId(params.get("field") || "grass");
console.log("[field param]", params.get("field"), "=>", fieldIdFromUrl);

if (!roomId || !playerId) {
  alert("URLに room / player がありません（battleから入ってね）");
  throw new Error("missing room/player");
}

const matchRef = doc(db, "rooms", roomId, "game", "match");
const stateRef = doc(db, "rooms", roomId, "game", "state");
const playerRef = (pid) => doc(db, "rooms", roomId, "players", pid);

// =====================
// Load card defs
// =====================
let cardDefs = {};
async function loadCards() {
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach((d) => (m[d.id] = d.data()));
  cardDefs = m;
}
await loadCards();

function normalizeActionsForDef(def) {
  const actsRaw = def?.actions;

  // actions が配列じゃないなら無理に変換せず、既存挙動を維持
  if (!Array.isArray(actsRaw)) return;

  // “同一技”判定キー（必要ならここ調整）
  const keyOf = (a) =>
    [
      String(a?.name ?? ""),
      String(a?.cost ?? ""),
      String(a?.range ?? ""),
      String(a?.dmg ?? a?.damage ?? ""),
      String(a?.heal ?? ""),
      String(a?.hpDelta ?? ""),
      String(a?.spDelta ?? ""),
      String(a?.dmgType ?? a?.damageType ?? ""),
      String(a?.rate ?? a?.successRate ?? a?.hitRate ?? a?.prob ?? a?.p ?? ""),
    ].join("|");

  const seen = new Set();
  const out = [];
  for (const a of actsRaw) {
    const k = keyOf(a);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  def.actions = out;
}

function normalizeAllCardDefs() {
  for (const id of Object.keys(cardDefs || {})) {
    const d = cardDefs[id];
    if (!d || typeof d !== "object") continue;
    normalizeActionsForDef(d);
  }
}

// loadCards 後に1回だけ
normalizeAllCardDefs();

function cardName(cardId) {
  return cardDefs?.[cardId]?.name || cardId;
}
function shortLabel(s, max = 6) {
  s = String(s ?? "");
  return s.length > max ? s.slice(0, max) : s;
}

/* =====================
   表示用ヘルパー
===================== */
function safeStatusText(u) {
  const t = formatStatusList(u);
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.join(",");
  if (t && typeof t === "object") {
    const keys = Object.keys(t);
    return keys.length ? keys.join(",") : "なし";
  }
  return "なし";
}

// =====================
// ★Firestore(map)/配列/文字列でも壊れない addStatus & tags 吸収層
// =====================
function addStatusListFromAny(addStatus) {
  if (!addStatus) return [];
  if (Array.isArray(addStatus)) {
    return addStatus.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof addStatus === "string") {
    return parseAddStatus(addStatus) || [];
  }
  if (typeof addStatus === "object") {
    const out = [];
    const t =
      addStatus.target && typeof addStatus.target === "object"
        ? addStatus.target
        : null;
    if (t) out.push(...Object.keys(t));
    return out.map((x) => String(x || "").trim()).filter(Boolean);
  }
  return [];
}

function tagMapFromAny(tags) {
  if (!tags) return {};
  if (typeof tags === "string") return parseTags(tags) || {};
  if (Array.isArray(tags)) return parseTags(tags.join(",")) || {};
  if (typeof tags === "object") return tags;
  return {};
}

function describeSpecialEffects(act) {
  const list = addStatusListFromAny(act?.addStatus).map((s) =>
    String(s || "").trim(),
  );
  if (!list.length) return [];

  const tags = tagMapFromAny(act?.tags);

  const out = [];
  const has = (...names) => names.some((n) => list.includes(n));

  const getVal = (name, defVal) => {
    let v = Number(
      tags[name] ??
        tags[`${name}Up`] ??
        tags[`${name}_up`] ??
        tags[`${name}Plus`] ??
        tags[`${name}_plus`],
    );
    if (!Number.isFinite(v)) v = defVal;
    return Math.trunc(v);
  };

  if (has("aim", "命中")) out.push(`命中+${getVal("aim", 10)}%`);
  if (has("jinx", "不運", "命中低下")) out.push(`命中-${getVal("jinx", 10)}%`);

  if (has("powerUp")) out.push(`威力+${getVal("powerUp", 10)}`);
  if (has("power") && !has("powerUp")) out.push(`威力+${getVal("power", 10)}`);

  if (has("armor", "装甲")) out.push(`装甲+${getVal("armor", 10)}`);

  if (has("bleed", "出血")) out.push(`出血付与(${getVal("bleed", 10)})`);
  if (has("fracture", "骨折")) out.push(`骨折（移動不可）`);
  if (has("smell", "におい")) out.push(`におい付与(${getVal("smell", 10)})`);
  if (has("lostSoul", "ロストソウル")) out.push(`ロストソウル`);
  if (has("blind", "盲目")) out.push(`盲目`);
  if (has("evade", "回避")) out.push(`回避+${getVal("evade", 10)}`);
  if (has("combo", "コンボ")) out.push(`コンボ`);
  if (has("followUp", "追撃")) out.push(`追撃`);

  if (has("recoverFatigue", "疲労回復", "fatigueHeal", "fatigueClear"))
    out.push(`疲労回復`);
  if (
    has(
      "recoverMove",
      "moveReset",
      "refreshMove",
      "移動回復",
      "移動制限回復",
      "移動回数回復",
    )
  )
    out.push(`移動回復（2マス）`);

  return out;
}

function displayAddStatus(act) {
  const list = addStatusListFromAny(act?.addStatus);
  const hidden = new Set([
    "pierce",
    "aoe",
    "all",
    "knockback",
    "貫通",
    "全体",
    "ノックバック",
  ]);
  const shown = list
    .map((s) => String(s || "").trim())
    .filter((s) => s && !hidden.has(s));
  return shown.length ? ` / add:${shown.join(",")}` : "";
}

// =====================
// ★射程表記（矢印）：陣営の前方向に合わせて出す
// =====================
function forwardDy(owner) {
  return owner === "A" ? -1 : 1;
}
function arrowByForward(owner) {
  return forwardDy(owner) === -1 ? "↑" : "↓";
}
function arrowByBack(owner) {
  return forwardDy(owner) === -1 ? "↓" : "↑";
}

function rangeTokenToArrow(tok, owner) {
  const t = String(tok || "").trim();
  if (!t) return "";
  if (t.toLowerCase() === "adj4") return "＋1";

  const m = t.match(/^(front|back|side|rf|lf|f)(\d+)$/i);
  if (!m) return t;

  const kind = m[1].toLowerCase();
  const n = Math.max(1, Math.trunc(Number(m[2] || 1)));

  const f = arrowByForward(owner);
  const b = arrowByBack(owner);

  const rf = forwardDy(owner) === -1 ? "↗" : "↘";
  const lf = forwardDy(owner) === -1 ? "↖" : "↙";

  if (kind === "front" || kind === "f") return `${f}${n}`;
  if (kind === "back") return `${b}${n}`;
  if (kind === "side") return `←${n}→${n}`;
  if (kind === "rf") return `${rf}${n}`;
  if (kind === "lf") return `${lf}${n}`;
  return t;
}

function rangeSpecToArrow(rangeSpec, owner) {
  const n = Number(rangeSpec);
  if (Number.isFinite(n)) return `距離${Math.max(0, Math.trunc(n))}`;

  const s = String(rangeSpec ?? "")
    .replaceAll('"', "")
    .trim();
  if (!s) return "";

  return s
    .split("+")
    .map((x) => rangeTokenToArrow(x.trim(), owner))
    .filter(Boolean)
    .join("+");
}

function actFlags(act) {
  const add = addStatusListFromAny(act?.addStatus);
  const tags = tagMapFromAny(act?.tags);

  const has = (x) => add.includes(x);
  const tagTrue = (k) =>
    tags?.[k] === true ||
    tags?.[k] === "true" ||
    tags?.[k] === 1 ||
    tags?.[k] === "1";

  return {
    pierce: has("pierce") || has("貫通") || tagTrue("pierce"),
    aoe:
      has("aoe") ||
      has("all") ||
      has("全体") ||
      tagTrue("aoe") ||
      tagTrue("all"),
    knockback: has("knockback") || has("ノックバック") || tagTrue("knockback"),
  };
}

function actRangeLabel(act, owner) {
  const base = rangeSpecToArrow(act?.range, owner) || String(act?.range ?? "?");
  const flags = actFlags(act);
  const suffix = `${flags.aoe ? "全" : ""}${flags.pierce ? "貫" : ""}`;
  return `${base}${suffix}`;
}

// =====================
// Seat
// =====================
let seat = null;
let opponentSeat = null;
let seatAPlayerId = null;
let seatBPlayerId = null;

async function resolveSeat() {
  const ms = await getDoc(matchRef);
  if (!ms.exists()) {
    alert("matchがありません（battleで両者準備OKになった？）");
    throw new Error("match missing");
  }
  const m = ms.data();
  seatAPlayerId = m.seatA;
  seatBPlayerId = m.seatB;

  if (playerId === seatAPlayerId) seat = "A";
  else if (playerId === seatBPlayerId) seat = "B";
  else {
    alert("あなたはこのマッチの参加者ではありません");
    throw new Error("not participant");
  }

  opponentSeat = seat === "A" ? "B" : "A";
  if (youEl) youEl.textContent = seat;
}
await resolveSeat();

// =====================
// Solo Debug Panel (externalized)
// =====================
// deck/battle 側で `?solo=1` を付けたときだけ表示する想定
const isSoloMode = params.get("solo") === "1" || params.get("mode") === "solo";
if (isSoloMode) {
  (async () => {
    try {
      const mod = await import("./solo_debug.js?v=20260218");
      const init = mod?.initSoloDebug;
      if (typeof init === "function") {
        init({
          db,
          roomId,
          playerId,
          seat,
          stateRef,
          matchRef,
          playerRef: playerRef(playerId), // ✅ docRef を渡す
          cardDefsRef: null, // （現状未使用なら null でOK）
          render, // ✅ function宣言なのでそのまま渡せる
        });
      }
    } catch (e) {
      console.warn("[solo_debug] module not loaded", e);
    }
  })();
}

// =====================
// Solo Console (open/close on demand)
// =====================
let soloConsoleInited = false;
let soloConsoleVisible = false;

function findSoloConsoleEl() {
  return (
    document.getElementById("soloDebugRoot") ||
    document.getElementById("soloDebugPanel") ||
    document.getElementById("soloDebug")
  );
}

function setSoloConsoleVisible(v) {
  soloConsoleVisible = !!v;
  const el = findSoloConsoleEl();
  if (el) el.style.display = soloConsoleVisible ? "block" : "none";
}

async function initSoloConsoleOnce() {
  if (soloConsoleInited) return;

  try {
    const mod = await import("./solo_debug.js?v=20260214");
    const init = mod?.initSoloDebug;
    if (typeof init !== "function") throw new Error("initSoloDebug not found");

    init({
      db,
      roomId,
      playerId,
      seat,
      stateRef,
      matchRef,
      playerRef: playerRef(playerId),
      cardDefsRef: null,
      render,
    });

    soloConsoleInited = true;

    // init直後にDOMがまだ生えてないケースがあるので1回待つ
    queueMicrotask(() => {
      // 初期表示：solo=1なら開いておく
      const p = new URLSearchParams(location.search);
      const isSolo = p.get("solo") === "1" || p.get("mode") === "solo";
      setSoloConsoleVisible(isSolo);
    });
  } catch (e) {
    console.warn("[solo console] init failed", e);
    alert("solo_debug.jsが読み込めなかった");
  }
}

// 外から呼べるトグル（game.html のボタンから呼ぶ）
window.toggleSoloConsole = async function () {
  await initSoloConsoleOnce();

  // init後にDOM生成が遅延する実装対策：少しだけ待って再取得
  let el = findSoloConsoleEl();
  if (!el) {
    await new Promise((r) => setTimeout(r, 0));
    el = findSoloConsoleEl();
  }
  if (!el) {
    alert("コンソールDOMが見つからない（solo_debug.js側でidを付けてね）");
    return;
  }

  setSoloConsoleVisible(!soloConsoleVisible);
};

// 既存：URLで solo=1 なら自動で初期化（＝最初から使える）
(async () => {
  const p = new URLSearchParams(location.search);
  const isSolo = p.get("solo") === "1" || p.get("mode") === "solo";
  if (isSolo) await initSoloConsoleOnce();
})();

// =====================
// Evolve system (separated) 2026/02/18
// =====================
const evolveSys = createEvolveSystem({
  db,
  stateRef,
  getSeat: () => seat,
  canControl,
  normalizeMana,
  spendManaMut,
  nowMs,
  round10,
  clampUnitStats10,
  cardDefsRef: () => cardDefs,
  cardName,
  logPush,
  checkWinLocal,
  isPanic,
});

// =====================
// ★侵入/勝利判定（未定義で落ちるのを修復）
// =====================
const WIN_KILL_COUNT = 3;
const WIN_INFIL_COUNT = 3;

function ensureInfilObj(s) {
  if (!s) return { A: 0, B: 0 };
  if (!s.infil || typeof s.infil !== "object") s.infil = { A: 0, B: 0 };
  s.infil.A = Math.max(0, Math.trunc(Number(s.infil.A ?? 0) || 0));
  s.infil.B = Math.max(0, Math.trunc(Number(s.infil.B ?? 0) || 0));
  return s.infil;
}

function formatInfilText(infil) {
  const a = Math.max(0, Math.trunc(Number(infil?.A ?? 0) || 0));
  const b = Math.max(0, Math.trunc(Number(infil?.B ?? 0) || 0));
  return `A:${a} / B:${b}`;
}

// ターン終了時に侵入を加算する（相手側2列に侵入している自軍ユニット数）
function calcInfilAddAtTurnEnd(s, who) {
  const units = Array.isArray(s?.units) ? s.units : [];
  const alive = units.filter(
    (u) => u && Number(u.hp) > 0 && !u.panic && normSeat(u.owner) === who,
  );
  if (who === "A") return alive.filter((u) => Number(u.y) <= 1).length; // A→上2列
  if (who === "B") return alive.filter((u) => Number(u.y) >= H - 2).length; // B→下2列
  return 0;
}

// ★今この瞬間の侵入数（累積しない）
function calcInfilNow(s) {
  const units = Array.isArray(s?.units) ? s.units : [];
  const alive = units.filter((u) => u && Number(u.hp) > 0 && !u.panic);

  const a = alive.filter(
    (u) => normSeat(u.owner) === "A" && Number(u.y) <= 1,
  ).length; // Aが上2列
  const b = alive.filter(
    (u) => normSeat(u.owner) === "B" && Number(u.y) >= H - 2,
  ).length; // Bが下2列
  return { A: a, B: b };
}

// 既存 checkWin があるなら尊重しつつ、最低限（kills/infil）でも勝者を返せるように
function checkWinLocal(s) {
  if (!s) return null;

  const killsA = Math.trunc(Number(s?.kills?.A ?? 0) || 0);
  const killsB = Math.trunc(Number(s?.kills?.B ?? 0) || 0);
  if (killsA >= WIN_KILL_COUNT) return "A";
  if (killsB >= WIN_KILL_COUNT) return "B";

  const now = calcInfilNow(s);
  if (Math.trunc(Number(now.A ?? 0)) >= WIN_INFIL_COUNT) return "A";
  if (Math.trunc(Number(now.B ?? 0)) >= WIN_INFIL_COUNT) return "B";

  try {
    if (typeof checkWin === "function") {
      const w = normSeat(checkWin(s));
      if (w) return w;
    }
  } catch {}
  return null;
}

// =====================
// Init state once
// =====================
async function ensureStateInitialized() {
  await runTransaction(db, async (tx) => {
    const st = await tx.get(stateRef);
    if (st.exists()) {
      const s = st.data() || {};

      // ✅ フィールド状態の補完（既存部屋でも落ちない）
      try {
        ensureFieldState(s, W, H, fieldIdFromUrl);
        tx.set(
          stateRef,
          { fieldId: s.fieldId, field: s.field },
          { merge: true },
        );
      } catch {}

      const mana = normalizeMana(s.mana);
      if (s.schema !== "mana_v3")
        tx.set(stateRef, { mana, schema: "mana_v3" }, { merge: true });

      if (typeof s.turnSeq !== "number")
        tx.set(stateRef, { turnSeq: 1 }, { merge: true });
      if (s.lastSupportRoll === undefined)
        tx.set(stateRef, { lastSupportRoll: null }, { merge: true });

      if (!s.ex)
        tx.set(stateRef, { ex: { A: null, B: null } }, { merge: true });
      if (!s.exUsed)
        tx.set(stateRef, { exUsed: { A: false, B: false } }, { merge: true });

      if (s.lastSummon === undefined)
        tx.set(stateRef, { lastSummon: null }, { merge: true });
      if (s.lastEvolve === undefined)
        tx.set(stateRef, { lastEvolve: null }, { merge: true });

      ensureInfilObj(s);
      tx.set(stateRef, { infil: s.infil }, { merge: true });

      if (!s.kills || typeof s.kills !== "object")
        tx.set(stateRef, { kills: { A: 0, B: 0 } }, { merge: true });

      return;
    }

    const pA = await tx.get(playerRef(seatAPlayerId));
    const pB = await tx.get(playerRef(seatBPlayerId));
    if (!pA.exists() || !pB.exists()) throw new Error("players missing");

    const deckA_simple = pA.data().deck || {};
    const deckB_simple = pB.data().deck || {};

    const exA = pA.data().exCardId || null;
    const exB = pB.data().exCardId || null;

    function buildDeck(simple) {
      const arr = [];
      for (const id of Object.keys(simple)) {
        const cntRaw = Number(simple[id] || 0);
        const cnt = Math.max(0, Math.min(4, Math.trunc(cntRaw)));
        for (let i = 0; i < cnt; i++) arr.push(id);
      }
      return shuffle(arr);
    }

    const deckA = buildDeck(deckA_simple);
    const deckB = buildDeck(deckB_simple);

    const hands = { A: [], B: [] };
    for (let i = 0; i < 5; i++) {
      if (deckA.length) hands.A.push(deckA.pop());
    }
    for (let i = 0; i < 5; i++) {
      if (deckB.length) hands.B.push(deckB.pop());
    }

    const mana = {
      A: { cur: CORE.START_CUR, max: CORE.START_MAX },
      B: { cur: CORE.START_CUR, max: CORE.START_MAX },
    };

    tx.set(stateRef, {
      turn: "A",
      turnSeq: 1,

      fieldId: fieldIdFromUrl,
      field: { id: fieldIdFromUrl },

      mana,
      decks: { A: deckA, B: deckB },
      hands,
      units: [],
      kills: { A: 0, B: 0 },
      infil: { A: 0, B: 0 },
      winner: null,
      log: ["--- Aターン ---"],
      lastRoll: null,
      lastHit: null,
      lastSupportRoll: null,
      lastSummon: null,
      lastEvolve: null,
      ex: { A: exA, B: exB },
      exUsed: { A: false, B: false },
      createdAt: serverTimestamp(),
      schema: "mana_v3",
    });
  });
}
await ensureStateInitialized();

// =====================
// ★ドロー吸収（drawCardsのシグネチャ/返り値の違いを全部吸う）
// =====================
function safeDrawCards(s, who, n) {
  const cnt = Math.max(0, Math.trunc(Number(n ?? 0)));
  if (!s || !who || !cnt) return;

  s.decks = s.decks || { A: [], B: [] };
  s.hands = s.hands || { A: [], B: [] };

  const beforeH = Array.isArray(s.hands[who]) ? s.hands[who].length : 0;

  // 1) drawCards を色んな呼び方で試す（返り値も吸う）
  try {
    const fn = drawCards;
    if (typeof fn === "function") {
      const L = fn.length;
      let ret;

      if (L >= 4) ret = fn(s, who, cnt, cardDefs);
      else if (L === 3) ret = fn(s, who, cnt);
      else if (L === 2) ret = fn(s, who);
      else ret = fn(s);

      // ret が state/partial を返す実装を吸う
      if (ret && typeof ret === "object") {
        if (ret.decks || ret.hands) {
          if (ret.decks) s.decks = ret.decks;
          if (ret.hands) s.hands = ret.hands;
        }
        if (ret.state && (ret.state.decks || ret.state.hands)) {
          if (ret.state.decks) s.decks = ret.state.decks;
          if (ret.state.hands) s.hands = ret.state.hands;
        }
      }
    }
  } catch {}

  // 2) ここまでで増えてなかったら手動ドロー（最終保険）
  s.decks = s.decks || { A: [], B: [] };
  s.hands = s.hands || { A: [], B: [] };

  const afterH = Array.isArray(s.hands[who]) ? s.hands[who].length : 0;

  // ✅ drawCardsが1枚だけ引く実装でも、指定枚数になるまで補填する
  const drawn = afterH - beforeH;
  const need = Math.max(0, cnt - (Number.isFinite(drawn) ? drawn : 0));

  if (need > 0) {
    const dk = Array.isArray(s.decks[who]) ? s.decks[who] : [];
    const hd = Array.isArray(s.hands[who]) ? s.hands[who] : [];
    for (let i = 0; i < need; i++) {
      if (!dk.length) break;
      hd.push(dk.pop());
    }
    s.decks[who] = dk;
    s.hands[who] = hd;
  }

  s.hands[who] = Array.isArray(s.hands[who]) ? s.hands[who] : [];
  s.decks[who] = Array.isArray(s.decks[who]) ? s.decks[who] : [];
}
// =====================
// Local selection
// =====================
let lastSelectedUnitId = null;

function onSelectMyUnit(newUnitId, st) {
  if (!newUnitId) return;
  const changed = lastSelectedUnitId && lastSelectedUnitId !== newUnitId;
  lastSelectedUnitId = newUnitId;

  selectedUnitId = newUnitId;

  // 攻撃フロー：選び直したら対象は一旦クリア
  selectedTargetId = null;

  if (changed) selectedActionIndex = 0;

  ensureSelectedActionIndex(st);
  render(st);
}

let mode = null; // summon/move/attack/evolve/support/null
let selectedUnitId = null;
let selectedTargetId = null;
let selectedHandIndex = null;
let selectedActionIndex = 0;

let supportTarget1Id = null;
let supportTarget2Id = null;
let supportTargetCell = null;

function canControl(st) {
  return st && normSeat(st.turn) === seat && !st.winner;
}

function getSelectedUnit(st) {
  if (!st || !selectedUnitId) return null;
  return (st.units || []).find((u) => u.id === selectedUnitId) || null;
}
function getSelectedTarget(st) {
  if (!st || !selectedTargetId) return null;
  return (st.units || []).find((u) => u.id === selectedTargetId) || null;
}

function ensureSelectedActionIndex(st) {
  const su = getSelectedUnit(st);
  if (!su) {
    selectedActionIndex = 0;
    return;
  }
  const acts = cardDefs?.[su.cardId]?.actions || [];
  if (!Array.isArray(acts) || acts.length <= 0) {
    selectedActionIndex = 0;
    return;
  }
  if (selectedActionIndex < 0 || selectedActionIndex >= acts.length)
    selectedActionIndex = 0;
}

function selectedHandCardId(st) {
  const hand = st?.hands?.[seat] || [];
  if (selectedHandIndex == null) return null;
  return hand[selectedHandIndex] || null;
}
function selectedHandDef(st) {
  const cid = selectedHandCardId(st);
  if (!cid) return null;
  return cardDefs?.[cid] || null;
}
function selectedIsSupport(st) {
  const def = selectedHandDef(st);
  return !!def && isSupportCard(def);
}
function resetSupportPicks() {
  supportTarget1Id = null;
  supportTarget2Id = null;
  supportTargetCell = null;
}

function setMode(m) {
  mode = m;

  if (m !== "support") resetSupportPicks();

  // ✅ 進化の選択状態はモード変更のたびに安全にリセット
  try {
    evolveSys.reset();
  } catch (e) {}

  if (modeHintEl) {
    modeHintEl.textContent =
      m === "summon"
        ? "召喚：手札→フィールド（自陣2列のみ）"
        : m === "move"
          ? "移動：自軍を選択→移動先をクリック（マナ-1 / ターン中2マスまで）"
          : m === "attack"
            ? "行動：攻撃対象をクリックで選択 → 「行動実行」ボタンで確定"
            : m === "evolve"
              ? "進化：進化元を選択→手札候補が光る→手札選択→進化実行（疲労でも可）"
              : m === "support"
                ? "サポート：対象をクリックで選択 → 「サポート実行」ボタンで確定"
                : "ユニット選択→🏃移動 / ⚔️行動 を選択";
  }

  render(currentState);
}

function supportEffectSummary(def) {
  if (!def?.effect) return "効果なし";
  // まず自作 prettyEffect で読める形へ（文字列JSONも吸う）
  const t = prettyEffect(def.effect);
  if (t && t !== "[object Object]") return t;

  // 最後の保険：既存の文言化
  try {
    return supportEffectTextJa(def.effect);
  } catch {}
  return String(def.effect);
}

function supportPlan(def) {
  const eff = def?.effect;
  const types = [];
  if (eff?.type) types.push(String(eff.type));
  if (Array.isArray(eff?.table)) {
    for (const r of eff.table) {
      if (r?.effect?.type) types.push(String(r.effect.type));
    }
  }
  const has = (t) => types.includes(t);

  if (has("swapPos")) return { need: "unit2" };
  if (has("moveTo")) return { need: "unitCell" };

  if (
    types.some((t) =>
      [
        "dmg",
        "heal",
        "modRate",
        "bounce",
        "powerUp",
        "cleanse",
        "recoverFatigue",
        "recoverMove",
        "refreshMove",
      ].includes(t),
    )
  )
    return { need: "unit" };

  return { need: "none" };
}

// =====================
// ★Support: target(ally/enemy/any) + rate表示
// =====================
function getSupportTargetMode(def) {
  const eff0 = def?.effect;
  const t0 = String(eff0?.target ?? "")
    .trim()
    .toLowerCase();

  const table = Array.isArray(eff0?.table) ? eff0.table : null;
  const ts = [];
  if (t0) ts.push(t0);
  if (table) {
    for (const r of table) {
      const te = String(r?.effect?.target ?? r?.target ?? "")
        .trim()
        .toLowerCase();
      if (te) ts.push(te);
    }
  }

  if (!ts.length) return "any";
  if (ts.includes("any")) return "any";
  if (ts.includes("ally")) return "ally";
  if (ts.includes("enemy")) return "enemy";
  return "any";
}

function supportCanPickUnit(unit, who, targetMode) {
  if (!unit || Number(unit.hp) <= 0) return false;
  const owner = normSeat(unit.owner);
  const me = normSeat(who);
  if (!owner || !me) return false;

  const mode = String(targetMode || "any");
  if (mode === "any") return true;
  if (mode === "ally") return owner === me;
  if (mode === "enemy") return owner !== me;
  return true;
}

function supportRateText(def) {
  const eff0 = def?.effect;
  if (!eff0) return "成功率:?";

  const table = Array.isArray(eff0?.table) ? eff0.table : null;
  if (table && table.length) {
    const rates = [];
    for (const r of table) {
      const e = r?.effect || r;
      const t = String(e?.type ?? "").trim();
      if (t === "draw") {
        rates.push(100);
        continue;
      } // drawは強制成功仕様
      const rr = Number(e?.rate ?? eff0?.rate);
      if (Number.isFinite(rr))
        rates.push(Math.max(0, Math.min(100, Math.trunc(rr))));
    }
    if (rates.length) {
      const mn = Math.min(...rates),
        mx = Math.max(...rates);
      return mn === mx
        ? `成功率:${mn}%（抽選）`
        : `成功率:${mn}–${mx}%（抽選）`;
    }
    return "成功率:（抽選）";
  }

  const t = String(eff0?.type ?? "").trim();
  if (t === "draw") return "成功率:100%（ドロー）";
  const rate = Number(eff0?.rate);
  if (Number.isFinite(rate))
    return `成功率:${Math.max(0, Math.min(100, Math.trunc(rate)))}%`;
  return "成功率:100%";
}

function supportTargetText(def) {
  const m = getSupportTargetMode(def);
  if (m === "ally") return "対象:味方";
  if (m === "enemy") return "対象:敵";
  return "対象:任意";
}

// ★追加：Support選択状態の「準備OK」判定
function supportReadyByPlan(plan) {
  const need = plan?.need || "none";
  if (need === "none") return true;
  if (need === "unit") return !!supportTarget1Id;
  if (need === "unit2")
    return (
      !!supportTarget1Id &&
      !!supportTarget2Id &&
      supportTarget1Id !== supportTarget2Id
    );
  if (need === "unitCell") return !!supportTarget1Id && !!supportTargetCell;
  return false;
}

// ★追加：Support 操作ヒント文字列
function supportHintText(st) {
  const def = selectedHandDef(st);
  if (!def || !isSupportCard(def)) return "サポート：手札のサポカを選択してね";
  const plan = supportPlan(def);

  const parts = [];
  parts.push(`選択中：${cardName(selectedHandCardId(st))}`);
  parts.push(`効果：${supportEffectSummary(def)}`);
  parts.push(`${supportTargetText(def)} / ${supportRateText(def)}`);

  if (plan.need === "unit") {
    parts.push(`手順：対象ユニットをクリック → 「サポート実行」`);
    parts.push(`対象：${supportTarget1Id ? "✅選択済" : "未選択"}`);
  } else if (plan.need === "unit2") {
    parts.push(
      `手順：ユニット①クリック → ユニット②クリック → 「サポート実行」`,
    );
    parts.push(
      `①:${supportTarget1Id ? "✅" : "未"} ②:${supportTarget2Id ? "✅" : "未"}`,
    );
  } else if (plan.need === "unitCell") {
    parts.push(
      `手順：移動させるユニットをクリック → 移動先マスをクリック → 「サポート実行」`,
    );
    parts.push(
      `ユニット:${supportTarget1Id ? "✅" : "未"} マス:${supportTargetCell ? `✅(${supportTargetCell.x},${supportTargetCell.y})` : "未"}`,
    );
  } else {
    parts.push(`手順：「サポート実行」で発動`);
  }

  return parts.join("\n");
}

function countMyAliveUnits(units, owner) {
  const arr = Array.isArray(units) ? units : [];
  return arr.filter((u) => u && u.hp > 0 && !u.panic && u.owner === owner)
    .length;
}

function moveUsedThisTurn(u, st) {
  const curSeq = Number(st?.turnSeq ?? 1);
  if (!u) return 0;
  return Number(u.moveTurnSeq ?? 0) === curSeq ? Number(u.moveUsed ?? 0) : 0;
}

// =====================
// Range helpers（戦闘判定用）
// =====================
function expandTokenToOffsets(token, owner) {
  const t = String(token || "").trim();
  const dyF = forwardDy(owner);

  const m = t.match(/^(front|back|side|rf|lf|f)(\d+)$/i);
  if (m) {
    const kind = m[1].toLowerCase();
    const n = Math.max(1, Math.trunc(Number(m[2])));
    const res = [];
    for (let k = 1; k <= n; k++) {
      if (kind === "front" || kind === "f") res.push({ dx: 0, dy: dyF * k });
      else if (kind === "back") res.push({ dx: 0, dy: -dyF * k });
      else if (kind === "side") {
        res.push({ dx: k, dy: 0 });
        res.push({ dx: -k, dy: 0 });
      } else if (kind === "rf") res.push({ dx: k, dy: dyF * k });
      else if (kind === "lf") res.push({ dx: -k, dy: dyF * k });
    }
    return res;
  }

  if (t.toLowerCase() === "adj4") {
    return [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
  }
  return [];
}

function parseRangeSpecToOffsets(rangeSpec, owner) {
  const n = Number(rangeSpec);
  if (Number.isFinite(n)) {
    const r = Math.max(0, Math.trunc(n));
    const res = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx) + Math.abs(dy) <= r) res.push({ dx, dy });
      }
    }
    return res;
  }

  const s = String(rangeSpec || "")
    .replaceAll('"', "")
    .trim();
  if (!s) return [];

  const parts = s
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);
  let res = [];
  for (const p of parts) {
    res = res.concat(expandTokenToOffsets(p, owner));
  }
  const uniq = new Map();
  for (const o of res) uniq.set(`${o.dx},${o.dy}`, o);
  return [...uniq.values()];
}

function inActionRange(attacker, targetX, targetY, rangeSpec) {
  if (!attacker) return false;
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  if (!offs.length) return false;
  const dx = targetX - attacker.x;
  const dy = targetY - attacker.y;
  return offs.some((o) => o.dx === dx && o.dy === dy);
}

function rangeSpecMaxDist(attacker, rangeSpec) {
  const offs = parseRangeSpecToOffsets(rangeSpec, attacker.owner);
  let mx = 0;
  for (const o of offs) {
    mx = Math.max(mx, Math.abs(o.dx) + Math.abs(o.dy));
  }
  return mx;
}

// =====================
// UI helpers
// =====================
function showDiceRoll(lastRoll, lastSupportRoll) {
  if (!diceEl) return;

  const lines = [];

  if (lastRoll) {
    const age = nowMs() - (lastRoll.at || 0);
    if (age <= 2600) {
      lines.push(
        `🎲 ${lastRoll.r} / ${lastRoll.rate}%  ${lastRoll.hit ? "✅ 成功" : "❌ 失敗"}  (${lastRoll.actionName})`,
      );
    }
  }

  if (lastSupportRoll) {
    const age2 = nowMs() - (lastSupportRoll.at || 0);
    if (age2 <= 2600) {
      const ok = lastSupportRoll.ok ? "✅ 成功" : "❌ 失敗";
      lines.push(
        `🎲 ${lastSupportRoll.r} / ${lastSupportRoll.label}  ${ok}  (Support:${lastSupportRoll.cardName})`,
      );
    }
  }

  diceEl.textContent = lines.join("\n");
}

function flashTurnBanner() {
  if (!turnBanner) return;
  turnBanner.style.display = "block";
  turnBanner.style.opacity = "1";
  setTimeout(() => {
    turnBanner.style.opacity = "0";
  }, 900);
  setTimeout(() => {
    turnBanner.style.display = "none";
  }, 1400);
}

function renderManaGauge(manaObj) {
  if (!manaGaugeEl) return;
  manaGaugeEl.innerHTML = "";
  const m = normalizeMana(manaObj);
  const my = m[seat];

  for (let i = 0; i < my.max; i++) {
    const pip = document.createElement("div");
    pip.className = "manaPip max";
    if (i < my.cur) pip.classList.add("on");
    manaGaugeEl.appendChild(pip);
  }
  for (let i = my.max; i < MAX_MANA_UI; i++) {
    const pip = document.createElement("div");
    pip.className = "manaPip";
    manaGaugeEl.appendChild(pip);
  }
}

// bonus: [{ when:"<=40", addStatus:"bleed", v:10 }, ...]
function bonusUiText(a) {
  const bonus = Array.isArray(a?.bonus) ? a.bonus : [];
  if (!bonus.length) return "";

  const parts = [];
  for (const b of bonus) {
    const whenRaw = String(b?.when ?? "").trim();
    const add = String(b?.addStatus ?? "").trim();
    if (!whenRaw || !add) continue;

    // 表記を "<40%" に寄せる（<=40 なら <40 とか好みで調整可）
    const m = whenRaw.match(/^(<=|>=|<|>|==)\s*(\d+)$/);
    let whenText = whenRaw;
    if (m) {
      const op = m[1];
      const n = Math.max(1, Math.min(100, Math.trunc(Number(m[2]))));
      if (op === "<=")
        whenText = `<${n}%`; // <=40 -> <40%
      else if (op === "<") whenText = `<${n}%`;
      else if (op === ">=") whenText = `≥${n}%`;
      else if (op === ">") whenText = `>${n}%`;
      else if (op === "==") whenText = `=${n}%`;
    } else {
      // 既に "<40%" みたいなのが来たらそのまま
      whenText = whenRaw.includes("%") ? whenRaw : `${whenRaw}%`;
    }

    parts.push(`${whenText} ${bonusIcon(add)}`);
  }

  return parts.length ? parts.join(" ") : "";
}

// ★表示用 status 取得（getStatusが壊れても status/statuses から拾える）
function getStatusLocal(unit) {
  // 1) 既存getStatusが動くなら最優先（ただし配列は除外）
  try {
    if (typeof getStatus === "function") {
      const st = getStatus(unit);
      if (st && typeof st === "object" && !Array.isArray(st)) return st;
    }
  } catch {}

  const out = {};

  // 2) status/statuses が object の場合
  const a =
    unit &&
    unit.status &&
    typeof unit.status === "object" &&
    !Array.isArray(unit.status)
      ? unit.status
      : null;
  const b =
    unit &&
    unit.statuses &&
    typeof unit.statuses === "object" &&
    !Array.isArray(unit.statuses)
      ? unit.statuses
      : null;

  if (b) Object.assign(out, b);
  if (a) Object.assign(out, a);

  // 3) status/statuses が配列の場合（["bleed","armor"] など）
  const arr1 = Array.isArray(unit?.status) ? unit.status : null;
  const arr2 = Array.isArray(unit?.statuses) ? unit.statuses : null;

  for (const k of arr2 || []) {
    const kk = String(k || "").trim();
    if (!kk) continue;
    if (!out[kk]) out[kk] = { v: true };
  }
  for (const k of arr1 || []) {
    const kk = String(k || "").trim();
    if (!kk) continue;
    if (!out[kk]) out[kk] = { v: true };
  }

  // 4) tags が配列で付いてる個体も吸う（現状のSTATUS_ICONにあるものだけ）
  const tags = Array.isArray(unit?.tags) ? unit.tags : null;
  for (const k of tags || []) {
    const kk = String(k || "").trim();
    if (!kk) continue;
    if (STATUS_ICON[kk] && !out[kk]) out[kk] = { v: true };
  }

  return out;
}

function statusIconsText(unit) {
  const st = getStatusLocal(unit);
  const keys = Object.keys(st || {});
  const order = [
    "armor",
    "bleed",
    "fracture",
    "smell",
    "lostSoul",
    "blind",
    "evade",
    "combo",
    "followUp",
    "aim",
    "jinx",
    "powerUp",
    "power",
  ];

  if (keys.length) {
    keys.sort(
      (a, b) =>
        (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) -
        (order.indexOf(b) === -1 ? 999 : order.indexOf(b)),
    );
  }

  const parts = [];

  // ✅ パニック表示を盤面に出す（先頭）
  if (isPanic(unit)) parts.push("😱PANIC");

  for (const k of keys) {
    const icon = STATUS_ICON[k] || "❔";
    const v = st[k]?.v;

    if (k === "armor") parts.push(`${icon}${Number(v ?? 0)}`);
    else if (k === "evade") parts.push(`${icon}${Number(v ?? 0)}`);
    else if (k === "bleed") parts.push(`${icon}${Number(v ?? 10)}`);
    else if (k === "smell") parts.push(`${icon}${Number(v ?? 10)}`);
    else if (k === "aim") parts.push(`${icon}+${Number(v ?? 0)}`);
    else if (k === "jinx") parts.push(`${icon}-${Number(v ?? 0)}`);
    else if (k === "powerUp") parts.push(`${icon}+${Number(v ?? 0)}`);
    else if (k === "power") parts.push(`${icon}+${Number(v ?? 0)}`);
    else parts.push(v != null && v !== true ? `${icon}${v}` : `${icon}`);
  }

  return parts.join(" ");
}

btnSummon && (btnSummon.onclick = () => setMode("summon"));
btnMove && (btnMove.onclick = () => setMode("move"));
btnEvolve && (btnEvolve.onclick = () => setMode("evolve"));
btnSupport && (btnSupport.onclick = () => setMode("support"));
btnAttack && (btnAttack.onclick = () => setMode("attack"));

btnQuickMove?.addEventListener("click", () => setMode("move"));
btnQuickAttack?.addEventListener("click", async () => {
  // ✅ いきなり殴らない：攻撃モードにして「対象選択→行動実行」
  setMode("attack");
  render(currentState);
});

// =====================
// ★追加：撃破カウント（panicも撃破扱い）
// =====================
function countKillIfNeeded(
  target,
  killerSeat,
  kills,
  logLines,
  reason = "撃破",
) {
  if (!target || !kills) return;
  if (target.countedAsKill) return;

  target.countedAsKill = true;
  kills[killerSeat] = (kills[killerSeat] ?? 0) + 1;
  if (logLines)
    logLines.push(`[${killerSeat}] ${reason}：${cardName(target.cardId)}`);
}

function setPanicAndCountIfNeeded(
  target,
  killerSeat,
  kills,
  logLines,
  reason = "パニック撃破",
) {
  if (!target) return;
  if (Number(target.sp) <= 0 && Number(target.hp) > 0) {
    const was = !!target.panic;
    target.panic = true;
    if (!was) {
      target.panicKillSeat = killerSeat;
      countKillIfNeeded(target, killerSeat, kills, logLines, reason);
    }
  }
}

function reviveFromPanicIfHealed(u, kills, logLines) {
  if (!u || !u.panic) return false;
  if (Number(u.hp) > 0 && Number(u.sp) > 0) {
    u.panic = false;

    const ks = normSeat(u.panicKillSeat);
    if (ks && kills && typeof kills[ks] === "number") {
      kills[ks] = Math.max(0, Math.trunc(Number(kills[ks] ?? 0)) - 1);
    }

    u.countedAsKill = false;
    u.panicKillSeat = null;

    if (logLines)
      logLines.push(`[${u.owner}] 復帰：${cardName(u.cardId)}（パニック解除）`);
    return true;
  }
  return false;
}

function normalizePanicForAll(units, kills, logLines) {
  const arr = Array.isArray(units) ? units : [];
  for (const u of arr) {
    reviveFromPanicIfHealed(u, kills, logLines);
  }
}

// =====================
// v1.8.0: 射程ハイライト
// =====================
function buildRangeMap(st) {
  const map = new Map();
  if (!st) return map;
  if (mode !== "attack") return map;

  ensureSelectedActionIndex(st);

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return map;

  const def = cardDefs[su.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;
  if (!act) return map;

  const units = Array.isArray(st.units) ? st.units : [];
  const flags = actFlags(act);

  if (isSelfRange(act.range)) {
    map.set(`${su.x},${su.y}`, { ok: true, self: true });
    return map;
  }

  if (flags.aoe) {
    const offs = parseRangeSpecToOffsets(act.range, su.owner);

    for (const o of offs) {
      const x = su.x + o.dx;
      const y = su.y + o.dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;

      // ✅ AOEでもブロックを効かせたいなら（好み）
      // if (!flags.pierce) {
      //   const pseudo = { x, y };
      //   if (isLineBlocked(units, su, pseudo)) {
      //     map.set(`${x},${y}`, { ok: false, reason: "blocked" });
      //     continue;
      //   }
      // }

      map.set(`${x},${y}`, { ok: true });
    }
    return map;
  }

  const offs = parseRangeSpecToOffsets(act.range, su.owner);
  for (const o of offs) {
    const x = su.x + o.dx;
    const y = su.y + o.dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;

    if (!flags.pierce) {
      const pseudo = { x, y };
      if (isLineBlocked(units, su, pseudo)) {
        map.set(`${x},${y}`, { ok: false, reason: "blocked" });
        continue;
      }
    }
    map.set(`${x},${y}`, { ok: true });
  }
  return map;
}

// ✅ Support用ハイライト（対象ユニット/対象マス）
function buildSupportMap(st) {
  const map = new Map();
  if (!st) return map;
  if (mode !== "support") return map;
  if (!canControl(st)) return map;

  const def = selectedHandDef(st);
  if (!def || !isSupportCard(def)) return map;

  const plan = supportPlan(def);
  const tMode = getSupportTargetMode(def);
  const units = Array.isArray(st.units) ? st.units : [];

  // unit: 全ユニットを候補に
  if (plan.need === "unit") {
    for (const u of units) {
      if (!u || Number(u.hp) <= 0) continue;
      if (!supportCanPickUnit(u, seat, tMode)) continue;
      map.set(`${u.x},${u.y}`, { ok: true, kind: "unit" });
    }
    return map;
  }

  // unit2: 1体目選択後に2体目候補
  if (plan.need === "unit2") {
    for (const u of units) {
      if (!u || Number(u.hp) <= 0) continue;
      if (supportTarget1Id && u.id === supportTarget1Id) continue;
      if (!supportCanPickUnit(u, seat, tMode)) continue;
      map.set(`${u.x},${u.y}`, { ok: true, kind: "unit2" });
    }
    return map;
  }

  // unitCell: まずユニット、選ばれたら空マス候補を出す
  if (plan.need === "unitCell") {
    if (!supportTarget1Id) {
      for (const u of units) {
        if (!u || Number(u.hp) <= 0) continue;
        if (!supportCanPickUnit(u, seat, tMode)) continue;
        map.set(`${u.x},${u.y}`, { ok: true, kind: "pickUnit" });
      }
      return map;
    }
    // 空マス候補（全域）
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const occ = units.find(
          (v) => v && Number(v.hp) > 0 && v.x === x && v.y === y,
        );
        if (occ) continue;
        map.set(`${x},${y}`, { ok: true, kind: "pickCell" });
      }
    }
    return map;
  }

  return map;
}

// =====================
// 詳細（敵も見れる）
// =====================
function getActDeltas(act) {
  const hpDeltaRaw =
    act && act.hpDelta !== undefined ? Number(act.hpDelta) : undefined;
  const spDeltaRaw =
    act && act.spDelta !== undefined ? Number(act.spDelta) : undefined;

  let hpDelta = Number.isFinite(hpDeltaRaw) ? Math.trunc(hpDeltaRaw) : 0;
  let spDelta = Number.isFinite(spDeltaRaw) ? Math.trunc(spDeltaRaw) : 0;

  if (!hpDeltaRaw && !spDeltaRaw && act) {
    const dmg = Number(act.dmg ?? act.damage ?? 0);
    const heal = Number(act.heal ?? 0);
    const dmgType = String(act.dmgType ?? act.damageType ?? "HP").toUpperCase();
    const healType = String(act.healType ?? "HP").toUpperCase();

    if (Number.isFinite(dmg) && dmg !== 0) {
      if (dmgType === "SP") spDelta -= Math.trunc(dmg);
      else hpDelta -= Math.trunc(dmg);
    }
    if (Number.isFinite(heal) && heal !== 0) {
      if (healType === "SP") spDelta += Math.trunc(heal);
      else hpDelta += Math.trunc(heal);
    }
  }

  // ★HP/SPは10単位の世界：ここで丸め（安全側）
  hpDelta = Math.trunc(hpDelta / 10) * 10;
  spDelta = Math.trunc(spDelta / 10) * 10;

  return { hpDelta, spDelta };
}

function fmtDamageEffect(act) {
  const { hpDelta, spDelta } = getActDeltas(act);
  const parts = [];
  if (hpDelta < 0) parts.push(`HPダメージ:${Math.abs(hpDelta)}`);
  if (spDelta < 0) parts.push(`SPダメージ:${Math.abs(spDelta)}`);
  if (hpDelta > 0) parts.push(`HP回復:+${hpDelta}`);
  if (spDelta > 0) parts.push(`SP回復:+${spDelta}`);
  if (act?.draw !== undefined)
    parts.push(`ドロー:+${Math.trunc(Number(act.draw ?? 0))}`);
  return parts.length ? parts.join(" / ") : "（変化なし）";
}

function showCardDetail(cardId) {
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  let html = `<b>${cardName(cardId)}</b> <span class="small">(${cardId})</span><br>`;
  html += `属性:${d.type ?? "?"} / コスト:${d.cost ?? "?"}<br>`;
  html += `HP:${d.hp ?? "?"} SP:${d.sp ?? "?"}<br>`;

  if (isSupportCard(d)) {
    html += `<br><b>サポート</b><br>`;
    html += `<span class="small">コスト:${d.cost ?? "?"}</span><br>`;
    html += `<span class="small">${supportEffectSummary(d)}</span>`;
    detailEl.innerHTML = html;
    return;
  }

  html += `<br><b>技（行動）</b><br>`;

  const acts = d.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  acts.forEach((a) => {
    const rangeLbl = actRangeLabel(a, seat);
    const addS = displayAddStatus(a);
    const rate = getActRate(a);
    const warn =
      a.range === "?" || a.range === "" || a.range == null
        ? `<span style="color:#ff6;"> ※range未設定</span>`
        : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${rate}%)${addS}${warn}<br>`;
    html += `<span class="small">ダメージ/回復:${fmtDamageEffect(a)}</span><br>`;

    const specials = describeSpecialEffects(a);
    if (specials.length) {
      html += `<span class="small">特殊:${specials.join(" / ")}</span><br>`;
    }

    const bonusText = bonusUiText(a);
    if (bonusText) {
      html += `<span class="small">追加:${bonusText}</span><br>`;
    }

    try {
      const tags = tagMapFromAny(a?.tags);
      const withRaw = String(tags.synergyWith ?? "").trim();
      if (withRaw) {
        const need = Math.max(1, Math.trunc(Number(tags.synergyNeed ?? 1)));
        const r = Math.trunc(Number(tags.synergyRate ?? 0));
        const p = Math.trunc(Number(tags.synergyPower ?? 0));
        const side = String(tags.synergySide ?? "ally");
        html += `<span class="small">シナジー: ${withRaw} x${need} (${side}) → 成功+${r}% / 威力+${p}</span><br>`;
      }
    } catch {}

    html += `<br>`;
  });

  detailEl.innerHTML = html;
}

function showUnitDetail(u, st = currentState) {
  if (!detailEl) return;

  const def = cardDefs[u.cardId] || {};
  let html = `<b>${cardName(u.cardId)}</b> <span class="small">(${u.cardId})</span><br>`;
  html += `属性:${def.type ?? "?"} / 所有:${u.owner}<br>`;
  const maxHp = round10(def?.hp ?? u.hp);
  const maxSp = round10(def?.sp ?? u.sp);
  html += `HP:${round10(u.hp)}/${maxHp} SP:${round10(u.sp)}/${maxSp}<br>`;
  html += `疲労:${u.fatigue ? "あり" : "なし"}<br>`;

  const used = moveUsedThisTurn(u, st);
  html += `移動:${used}/2（ターン中）<br>`;

  html += `状態:${isPanic(u) ? "パニック（死亡扱い/行動不能）" : "通常"}<br>`;
  const icons = statusIconsText(u);
  html += `状態異常:${icons || "なし"}<br><br>`;

  const acts = def.actions || [];
  if (!acts.length) {
    html += "行動なし";
    detailEl.innerHTML = html;
    return;
  }

  html += `<b>技（行動）</b><br>`;

  acts.forEach((a) => {
    const addS = displayAddStatus(a);
    const rangeLbl = actRangeLabel(a, u.owner);
    const rate = getActRate(a);
    const warn =
      a.range === "?" || a.range === "" || a.range == null
        ? `<span style="color:#ff6;"> ※range未設定</span>`
        : "";

    html += `【${a.cost ?? "?"}】${a.name ?? "?"} (射程:${rangeLbl} 成功:${rate}%)${addS}${warn}<br>`;
    html += `<span class="small">ダメージ/回復:${fmtDamageEffect(a)}</span><br>`;

    const specials = describeSpecialEffects(a);
    if (specials.length) {
      html += `<span class="small">特殊:${specials.join(" / ")}</span><br>`;
    }

    html += `<br>`;
  });

  detailEl.innerHTML = html;
}

// =====================
// Quick actions
// =====================
function updateQuickActions(st) {
  if (!quickActionsEl) return;

  const myTurn = canControl(st);
  const su = getSelectedUnit(st);

  if (!myTurn || !su || su.owner !== seat) {
    quickActionsEl.style.display = "none";
    return;
  }
  quickActionsEl.style.display = "block";

  ensureSelectedActionIndex(st);

  const mana = normalizeMana(st.mana);
  const fatigued = !!su.fatigue;
  const def = cardDefs[su.cardId];
  const act = def?.actions?.[selectedActionIndex] || def?.actions?.[0] || null;

  const used = moveUsedThisTurn(su, st);

  if (btnQuickMove) {
    btnQuickMove.disabled =
      isPanic(su) || isMoveBlockedByStatus(su) || used >= 2;
  }

  const canPay = act ? mana[seat].cur >= Number(act.cost ?? 0) : false;
  if (btnQuickAttack) {
    // ✅ いきなり実行しないので「attackへ移動」用途に（押せる条件は緩く）
    btnQuickAttack.disabled = !act || isPanic(su) || !canPay;
  }

  if (!quickMsgEl) return;

  if (isPanic(su))
    quickMsgEl.textContent = "パニック中：死亡扱い＆行動不能（回復で復帰）";
  else if (isMoveBlockedByStatus(su)) quickMsgEl.textContent = "骨折：移動不可";
  else if (used >= 2)
    quickMsgEl.textContent = "移動上限：このターンはもう動けません";
  else if (!act) quickMsgEl.textContent = "行動がないカードです";
  else if (fatigued)
    quickMsgEl.textContent = "疲労中：行動できません（移動はOK）";
  else if (!canPay) quickMsgEl.textContent = "マナ不足：行動できません";
  else if (mode === "attack")
    quickMsgEl.textContent = "対象を選んで「行動実行」で確定！";
  else quickMsgEl.textContent = "";
}

// =====================
// FX helpers
// =====================
function cellIndex(x, y) {
  return y * W + x;
}

function fxFlash(kind = "hit") {
  if (!fxFlashEl) return;
  fxFlashEl.classList.remove("on", "kill");
  void fxFlashEl.offsetWidth;
  fxFlashEl.classList.add("on");
  if (kind === "kill") fxFlashEl.classList.add("kill");
  setTimeout(() => fxFlashEl.classList.remove("on", "kill"), 220);
}

let lastHitAtSeen = 0;
function fxOnHit(st) {
  const lh = st?.lastHit;
  if (!lh?.at || lh.at === lastHitAtSeen) return;
  lastHitAtSeen = lh.at;

  if (!lh?.targetId || !Array.isArray(st.units)) return;

  const tu = st.units.find((u) => u.id === lh.targetId) || null;
  if (!tu) return;

  const idx = cellIndex(tu.x, tu.y);
  const cell = boardEl?.children?.[idx];
  if (!cell) return;

  cell.classList.add("hitFlash");
  setTimeout(() => cell.classList.remove("hitFlash"), 600);

  const items = Array.isArray(lh.items) ? lh.items : [];
  for (const it of items) {
    const kind = String(it.kind || "");
    const delta = Number(it.delta ?? 0);
    if (!delta) continue;

    const el = document.createElement("div");
    el.className = "floatDmg";
    const k = kind === "SP" ? "SP" : "HP";
    el.textContent = `${k}${delta > 0 ? "+" : ""}${delta}`;
    cell.appendChild(el);
    setTimeout(() => {
      try {
        el.remove();
      } catch {}
    }, 1000);
  }

  const kill = Number(tu.hp) <= 0 || !!tu.panic;
  fxFlash(kill ? "kill" : "hit");
}

// ✅ 追加：技の命中率を安全に取る（表記/判定どっちでも使う）
function getActRate(act) {
  const v = Number(
    act?.rate ?? act?.successRate ?? act?.hitRate ?? act?.prob ?? act?.p ?? 100,
  );
  if (!Number.isFinite(v)) return 100;
  return Math.max(0, Math.min(100, Math.trunc(v)));
}

// =====================
// 判定吸収
// =====================
function isSelfRange(r) {
  const s = String(r ?? "")
    .trim()
    .toLowerCase();
  return s === "self" || s === "0" || s === "me" || s === "自身";
}

// 直線＆斜め（従来互換の簡易ブロック）
function isLineBlocked(units, attacker, target) {
  if (!attacker || !target) return false;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;

  const step = (v) => (v === 0 ? 0 : v > 0 ? 1 : -1);
  let sx = step(dx);
  let sy = step(dy);

  const straight = dx === 0 || dy === 0;
  const diag = Math.abs(dx) === Math.abs(dy);
  if (!straight && !diag) return false;

  let x = attacker.x + sx;
  let y = attacker.y + sy;

  while (!(x === target.x && y === target.y)) {
    const hit = (units || []).find(
      (u) => Number(u.hp) > 0 && u.x === x && u.y === y,
    );
    if (hit) return true;
    x += sx;
    y += sy;
    if (x < 0 || x >= W || y < 0 || y >= H) break;
  }
  return false;
}

// ★修正：命中率は「baseRate」を必ず渡す（0%バグ/NaN吸収）
function calcHitRateAdapter(attacker, act) {
  const base = getActRate(act); // 未設定なら100
  try {
    if (typeof calcHitRateWithStatus !== "function") return base;

    const n = calcHitRateWithStatus.length;
    let r;
    if (n >= 2) r = calcHitRateWithStatus(attacker, base);
    else if (n === 1) r = calcHitRateWithStatus(attacker);
    else r = base;

    const rr = Number(r);
    if (!Number.isFinite(rr)) return base;
    return Math.max(0, Math.min(100, Math.trunc(rr)));
  } catch {
    return base;
  }
}

// ★修正：checkEvade は defender + rng で呼ぶ
function checkEvadeAdapter(defender) {
  try {
    if (typeof checkEvade !== "function") return false;

    const rng01 = () => Math.random(); // 0..1
    const n = checkEvade.length;

    if (n >= 2) return !!checkEvade(defender, rng01);
    if (n === 1) return !!checkEvade(defender);
    return false;
  } catch {
    return false;
  }
}

// ★修正：applyStatusesOnHit は (target, act) で呼ぶ
function applyStatusesOnHitAdapter(target, act) {
  try {
    if (typeof applyStatusesOnHit !== "function") return [];
    const n = applyStatusesOnHit.length;
    if (n >= 2) return applyStatusesOnHit(target, act);
    if (n === 1) return applyStatusesOnHit(target);
    return [];
  } catch {
    return [];
  }
}

// =====================
// Snapshot + main loop
// =====================
let currentState = null;
let lastSeenTurnSeq = null;
let lastSeenTurn = null;

function logPush(st, line) {
  if (!st) return;
  if (!Array.isArray(st.log)) st.log = [];
  st.log.push(String(line ?? ""));
  if (st.log.length > 200) st.log.splice(0, st.log.length - 200);
}

// ★致命バグ修正：spendMana() の戻りは {ok, mana} なので res.mana を使う
function spendManaMut(manaObj, who, cost) {
  const m = normalizeMana(manaObj);
  const c = Math.max(0, Math.trunc(Number(cost ?? 0)));
  if (!c) return m;

  try {
    const res = spendMana(m, who, c);
    if (res && typeof res === "object" && res.mana)
      return normalizeMana(res.mana);
    // 万一古い実装で mana を直接返すタイプなら吸収
    return normalizeMana(res ?? m);
  } catch {
    m[who].cur = Math.max(0, Math.trunc(Number(m[who].cur ?? 0)) - c);
    return normalizeMana(m);
  }
}

function gainManaPlus2OnReceiveTurn(manaObj, who) {
  const m = normalizeMana(manaObj);
  const maxCap = Math.trunc(Number(CORE.MAX_MANA ?? 999));
  const add = 2;

  const curMax = Math.trunc(Number(m?.[who]?.max ?? 0));
  const nextMax = Math.min(maxCap, curMax + add);

  m[who] = m[who] || { cur: 0, max: 0 };
  m[who].max = nextMax;
  m[who].cur = nextMax;

  return normalizeMana(m);
}

function renderScoreMeter(meterEl, val, max) {
  if (!meterEl) return;
  const v = Math.max(0, Math.trunc(Number(val ?? 0) || 0));
  const m = Math.max(1, Math.trunc(Number(max ?? 1) || 1));

  meterEl.innerHTML = "";
  for (let i = 0; i < m; i++) {
    const pip = document.createElement("div");
    pip.className = "scorePip" + (i < v ? " on" : "");
    meterEl.appendChild(pip);
  }
}

function setTurnUI(st) {
  if (!st) return;
  const t = normSeat(st.turn) || "?";
  if (turnEl) turnEl.textContent = t;

  const mana = normalizeMana(st.mana);
  const a = mana.A,
    b = mana.B;
  if (manaEl) manaEl.textContent = `A ${a.cur}/${a.max} | B ${b.cur}/${b.max}`;
  renderManaGauge(mana);

  if (deckCountEl) {
    const da = Array.isArray(st?.decks?.A) ? st.decks.A.length : 0;
    const db = Array.isArray(st?.decks?.B) ? st.decks.B.length : 0;
    deckCountEl.textContent = `残り A:${da} / B:${db}`;
  }

  // ===== KILL =====
  const ka = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
  const kb = Math.trunc(Number(st?.kills?.B ?? 0) || 0);

  // 旧表示（残してるなら更新）
  if (killsEl) killsEl.textContent = `A:${ka} / B:${kb}`;

  // 新UI
  renderScoreMeter(killMeterA, ka, WIN_KILL_COUNT);
  renderScoreMeter(killMeterB, kb, WIN_KILL_COUNT);
  if (killTextA) killTextA.textContent = `${ka}/${WIN_KILL_COUNT}`;
  if (killTextB) killTextB.textContent = `${kb}/${WIN_KILL_COUNT}`;

  // ===== INFIL（今この瞬間）=====
  let now = { A: 0, B: 0 };
  try {
    now = calcInfilNow(st);
  } catch {}
  const ia = Math.trunc(Number(now?.A ?? 0) || 0);
  const ib = Math.trunc(Number(now?.B ?? 0) || 0);

  // 旧表示（残してるなら更新）
  if (infilEl) infilEl.textContent = `A:${ia} / B:${ib}`;

  // 新UI
  renderScoreMeter(infilMeterA, ia, WIN_INFIL_COUNT);
  renderScoreMeter(infilMeterB, ib, WIN_INFIL_COUNT);
  if (infilTextA) infilTextA.textContent = `${ia}/${WIN_INFIL_COUNT}`;
  if (infilTextB) infilTextB.textContent = `${ib}/${WIN_INFIL_COUNT}`;

  showDiceRoll(st.lastRoll, st.lastSupportRoll);

  // EX表示（あれば）
  try {
    if (exInfoEl) {
      const exId = st?.ex?.[seat] ?? null;
      const used = !!st?.exUsed?.[seat];
      exInfoEl.textContent = exId
        ? `EX: ${cardName(exId)} ${used ? "（使用済）" : ""}`
        : "EX: なし";
    }
    if (exBtnEl) {
      const exId = st?.ex?.[seat] ?? null;
      const used = !!st?.exUsed?.[seat];
      exBtnEl.disabled = !canControl(st) || !exId || used;
    }
  } catch {}
}

// =====================
// Board init
// =====================
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
      cell.addEventListener("click", () => onCellClick(x, y));
      boardEl.appendChild(cell);
    }
  }
}

function unitAt(st, x, y) {
  const units = Array.isArray(st?.units) ? st.units : [];
  // ✅ PANICでも盤面に残す（占有＆クリック可能）
  return units.find((u) => Number(u.hp) > 0 && u.x === x && u.y === y) || null;
}

function isEmptyCell(st, x, y) {
  return !unitAt(st, x, y);
}

// =====================
// ★召喚エリア（厳密固定）
// 先行(A) = 手前側2列（下2列）
// 後攻(B) = 奥側2列（上2列）
// =====================
function inSummonAreaForSeat(x, y, who) {
  if (who === "A") return y >= H - 2;
  if (who === "B") return y <= 1;
  return false;
}

/**
 * 召喚エリア内の「おすすめ空きマス」を選ぶ
 */
function pickDefaultSummonCell(st, who) {
  if (!st) return null;

  const xs = [];
  const center = (W - 1) / 2;
  for (let x = 0; x < W; x++) xs.push(x);
  xs.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));

  const yStart = who === "A" ? H - 1 : 0;
  const yEnd = who === "A" ? -1 : H;
  const yStep = who === "A" ? -1 : 1;

  for (let y = yStart; y !== yEnd; y += yStep) {
    for (const x of xs) {
      if (!inSummonAreaForSeat(x, y, who)) continue;
      if (!isEmptyCell(st, x, y)) continue;
      return { x, y };
    }
  }
  return null;
}

// =====================
// Board click handlers
// =====================
function onCellClick(x, y) {
  const st = currentState;
  if (!st) return;

  // 事前に必要なものを確定（未定義参照を潰す）
  const handDef = selectedHandDef(st);
  const isSupp = !!handDef && isSupportCard(handDef);

  // =========================
  // 1) Support: unitCell の「移動先マス選択」（空マスのみ）
  // =========================
  if (mode === "support" && canControl(st) && isSupp) {
    const plan = supportPlan(handDef);
    if (plan.need === "unitCell" && supportTarget1Id) {
      const occ = unitAt(st, x, y);
      if (!occ) {
        supportTargetCell = { x, y };
        render(st);
        return;
      }
      // occupied なら下に流して「ユニットクリック扱い」にする
    }
  }

  // =========================
  // 2) ユニットクリック
  // =========================
  const u = unitAt(st, x, y);
  if (u) {
    // 詳細表示
    showUnitDetail(u, st);

    // 自軍なら選択
    if (u.owner === seat) onSelectMyUnit(u.id, st);

    // ---- Supportモード：対象ユニットの選択 ----
    if (mode === "support" && canControl(st) && isSupp) {
      const plan = supportPlan(handDef);
      const tMode = getSupportTargetMode(handDef);

      // 対象制約に合わないユニットなら無視（ここでdef未定義バグを潰す）
      if (!supportCanPickUnit(u, seat, tMode)) {
        render(st);
        return;
      }

      if (plan.need === "unit") {
        supportTarget1Id = u.id;
        render(st);
        return;
      }

      if (plan.need === "unit2") {
        if (!supportTarget1Id) supportTarget1Id = u.id;
        else if (!supportTarget2Id && u.id !== supportTarget1Id)
          supportTarget2Id = u.id;
        else if (u.id === supportTarget1Id) {
          // 1体目を押し直したら 2体目だけリセット
          supportTarget2Id = null;
        }
        render(st);
        return;
      }

      if (plan.need === "unitCell") {
        // まずユニットを選ぶ（どっちの陣営でもOK）
        supportTarget1Id = u.id;
        supportTargetCell = null;
        render(st);
        return;
      }
    }

    // ---- Attackモード：対象ユニットの選択（実行はボタン） ----
    if (mode === "attack" && canControl(st)) {
      const su = getSelectedUnit(st);
      if (su && su.owner === seat) {
        selectedTargetId = u.id;
        render(st);
        return;
      }
    }

    return;
  }

  // =========================
  // 3) 空マスクリック：召喚
  // =========================
  if (mode === "summon" && canControl(st)) {
    if (!inSummonAreaForSeat(x, y, seat)) return;

    const cid = selectedHandCardId(st);
    const def = selectedHandDef(st);
    if (!cid || !def) return;
    if (isSupportCard(def)) return;

    // 上限
    const myAlive = countMyAliveUnits(st.units, seat);
    if (myAlive >= MAX_UNITS_PER_PLAYER) {
      logPush(st, `[${seat}] 召喚失敗：場の上限(${MAX_UNITS_PER_PLAYER})`);
      render(st);
      return;
    }

    // コスト
    const cost = Math.max(0, Math.trunc(Number(def.cost ?? 0)));
    const mana = normalizeMana(st.mana);
    if (mana[seat].cur < cost) return;

    // Transaction中に参照しないために固定
    const idxSnap = selectedHandIndex;
    const cidSnap = cid;

    runTransaction(db, async (tx) => {
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];
      if (unitAt(s, x, y)) return;
      if (!inSummonAreaForSeat(x, y, seat)) return;

      // hand remove
      s.hands = s.hands || { A: [], B: [] };
      const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];

      const idx = idxSnap;
      if (idx == null || idx < 0 || idx >= hand.length) return;

      const cardId = hand[idx];
      if (cardId !== cidSnap) return;

      const cd = cardDefs[cardId];
      if (!cd) return;
      if (isSupportCard(cd)) return;

      // pay
      s.mana = spendManaMut(s.mana, seat, cost);

      // create unit
      const baseHp = round10(cd.hp ?? 0);
      const baseSp = round10(cd.sp ?? 0);

      const unit = {
        id: uid(),
        cardId,
        owner: seat,
        x,
        y,

        hp: baseHp,
        sp: baseSp,

        // ✅ 追加：最大値を持たせる
        maxHp: baseHp,
        maxSp: baseSp,

        fatigue: false,
        moveTurnSeq: Number(s.turnSeq ?? 1),
        moveUsed: 0,
        status: {},
        statuses: {},
        panic: false,
        countedAsKill: false,
        panicKillSeat: null,
      };

      // 10単位に正規化（念のため）
      unit.hp = Math.trunc(unit.hp / 10) * 10;
      unit.sp = Math.trunc(unit.sp / 10) * 10;

      s.units.push(unit);

      // remove from hand
      hand.splice(idx, 1);
      s.hands[seat] = hand;

      // log
      logPush(s, `[${seat}] 召喚：${cardName(cardId)} (${x},${y})`);
      s.lastSummon = { at: nowMs(), owner: seat, cardId };

      tx.set(stateRef, s, { merge: true });
    });

    return;
  }

  // =========================
  // 4) 空マスクリック：移動
  // =========================
  if (mode === "move" && canControl(st)) {
    const su = getSelectedUnit(st);
    if (!su || su.owner !== seat) return;
    if (isPanic(su)) return;
    if (isMoveBlockedByStatus(su)) return;

    const used = moveUsedThisTurn(su, st);
    if (used >= 2) return;

    // 1マス移動のみ（上下左右）
    const dx = Math.abs(x - su.x);
    const dy = Math.abs(y - su.y);
    if (dx + dy !== 1) return;

    // 移動先が空
    if (!isEmptyCell(st, x, y)) return;

    // マナ -1
    const mana = normalizeMana(st.mana);
    if (mana[seat].cur < 1) return;

    // ★transaction用に固定（グローバル参照しない）
    const suIdSnap = su.id;
    const toSnap = { x, y };

    runTransaction(db, async (tx) => {
      const snap = await tx.get(stateRef);
      if (!snap.exists()) return;
      const s = snap.data() || {};
      if (!canControl(s) || s.winner) return;

      s.units = Array.isArray(s.units) ? s.units : [];

      const units = s.units;
      const me = units.find((u) => u.id === suIdSnap) || null;
      if (!me || me.owner !== seat) return;
      if (Number(me.hp) <= 0) return;
      if (isPanic(me)) return;
      if (isMoveBlockedByStatus(me)) return;

      // ターン内移動回数
      const curSeq = Number(s.turnSeq ?? 1);
      const usedNow =
        Number(me.moveTurnSeq ?? 0) === curSeq ? Number(me.moveUsed ?? 0) : 0;
      if (usedNow >= 2) return;

      // 目的地（再チェック）
      const dx2 = Math.abs(toSnap.x - me.x);
      const dy2 = Math.abs(toSnap.y - me.y);
      if (dx2 + dy2 !== 1) return;

      if (unitAt(s, toSnap.x, toSnap.y)) return;

      // ✅ フィールド：移動前判定（沼など）
      const from = { x: me.x, y: me.y };
      let to = { x: toSnap.x, y: toSnap.y };

      try {
        ensureFieldState(s, W, H, s.fieldId ?? s.field?.id ?? fieldIdFromUrl);
        const r = applyFieldMoveRule({
          s,
          who: seat,
          unit: me,
          from,
          to,
          W,
          H,
          round10,
          logPush,
        });
        if (!r?.ok) {
          // 止められた：マナは消費＆移動回数は消費（仕様通り）
          s.mana = spendManaMut(s.mana, seat, 1);

          me.moveTurnSeq = curSeq;
          me.moveUsed = usedNow + 1;

          logPush(
            s,
            `[${seat}] 移動失敗：${cardName(me.cardId)}（${r?.label ?? "field"}）`,
          );

          tx.set(stateRef, s, { merge: true });
          return;
        }
        to = r.to || to;
      } catch {}

      // pay
      s.mana = spendManaMut(s.mana, seat, 1);

      // bleed on move（互換）
      try {
        applyBleedOnMove?.(me, s, seat);
      } catch {}

      // move
      const prev = { x: me.x, y: me.y };
      me.x = to.x;
      me.y = to.y;
      me.moveTurnSeq = curSeq;
      me.moveUsed = usedNow + 1;

      logPush(
        s,
        `[${seat}] 移動：${cardName(me.cardId)} (${prev.x},${prev.y})→(${to.x},${to.y})`,
      );

      // ✅ フィールド：踏んだ後判定（爆弾など）
      try {
        applyFieldOnStepAfterMove({
          s,
          who: seat,
          unit: me,
          pos: { x: me.x, y: me.y },
          round10,
          clampUnitStats10,
          countKillIfNeeded,
          setPanicAndCountIfNeeded,
          logPush,
        });
      } catch {}

      tx.set(stateRef, s, { merge: true });
    });

    return;
  }
}

// =====================
// Render board + hand
// =====================
function renderBoard(st) {
  if (!boardEl) return;
  ensureBoardGrid();
  ensureBoardAssistCss();
  ensureBoardUnitCss();

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
    );

    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);

    // ✅ 前回スタイルをクリア（残像防止）
    cell.style.background = "";
    cell.style.boxShadow = "";

    // ✅ swamp の「中央1行（4行目）」だけ淀ませる（見た目）
    try {
      const fid = normalizeFieldId(st?.fieldId ?? st?.field?.id ?? "grass");
      if (fid === "swamp") {
        const swampY = Math.floor(H / 2); // H=7 -> 3（4行目）
        if (y === swampY) {
          cell.style.background = "rgba(40, 120, 90, .18)";
          cell.style.boxShadow = "inset 0 0 18px rgba(40, 120, 90, .25)";
        }
      }
    } catch {}

    // summon highlight
    if (
      mode === "summon" &&
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

    // ✅ フィールド描画（爆弾など）
    try {
      const fid = normalizeFieldId(st?.fieldId ?? st?.field?.id ?? "grass");
      if (fid === "danger") {
        const bomb = st?.field?.bomb;
        if (
          bomb &&
          bomb.alive !== false &&
          x === Math.trunc(Number(bomb.x)) &&
          y === Math.trunc(Number(bomb.y))
        ) {
          cell.classList.add("bombCell"); // ✅ これを追加

          const th = Math.max(1, Math.trunc(Number(bomb.threshold ?? 3)));
          const steps = Math.max(0, Math.trunc(Number(bomb.steps ?? 0)));
          const obj = document.createElement("div");
          // ...（既存の💣表示）
          cell.appendChild(obj);
        }
      }
    } catch {}

    const u = unitAt(st, x, y);
    if (!u) continue;

    // selection highlight
    if (u.id === selectedUnitId) cell.classList.add("selUnit");
    if (u.id === selectedTargetId) cell.classList.add("selTarget");

    const def = cardDefs[u.cardId] || {};
    const t = def.type || "?";
    const strong = typeColorStrong(t);
    const soft = typeColorSoft(t, 0.18);

    const box = document.createElement("div");
    box.className = "unitBox";
    box.style.borderColor = hexToRgba(strong, 0.45);
    box.style.background = soft;

    // panic badge
    if (isPanic(u)) {
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

      // ★数値をバーの上に重ねる
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

    // 最下段：状態異常アイコン固定
    const ic = document.createElement("div");
    ic.className = "uIcons";
    ic.textContent = statusIconsText(u) || "";
    box.appendChild(ic);

    // owner ribbon
    const owner = document.createElement("div");
    owner.className = "uOwner " + (u.owner === seat ? "you" : "enemy");

    const left = document.createElement("div");
    left.textContent = u.owner === seat ? "YOU" : "ENEMY";

    owner.appendChild(left);
    box.appendChild(owner);

    // click
    box.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onCellClick(x, y);
    });

    cell.appendChild(box);
  }
}

function renderHand(st) {
  if (!handEl) return;

  // ✅ 追加：手札CSSを確実に当てる
  ensureHandCss();

  handEl.innerHTML = "";

  const hand = Array.isArray(st?.hands?.[seat]) ? st.hands[seat] : [];
  for (let i = 0; i < hand.length; i++) {
    const cid = hand[i];
    const def = cardDefs[cid] || {};
    const t = def.type || "?";
    const strong = typeColorStrong(t);

    const card = document.createElement("div");
    card.className = "handCard" + (i === selectedHandIndex ? " selected" : "");
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
    type.textContent = isSupportCard(def) ? "Support" : String(def.type ?? "?");
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

    // ✅ 追加：手札カード下に owner リボン（主張強め）
    const ownerBar = document.createElement("div");
    ownerBar.className = "hcOwnerBar you";
    ownerBar.textContent = "YOU";
    card.appendChild(ownerBar);

    // click select
    card.addEventListener("click", () => {
      selectedHandIndex = i;
      showCardDetail(cid);

      // サポート選択したらサポートモードに寄せる（任意）
      if (selectedIsSupport(st)) setMode("support");

      render(st);
    });

    // 進化候補なら「進化」ボタンを追加（別JS）
    evolveSys.decorateHandCard({
      cardEl: card,
      index: i,
      cardId: cid,
      st,
      onShowDetail: (id) => showCardDetail(id),
    });

    handEl.appendChild(card);
  }
}

// =====================
// Action picker (Attack/Support exec buttons)
// =====================
let execAttackBtn = null;
let execSupportBtn = null;

function renderActionPicker(st) {
  if (!actionPickerEl) return;
  ensureActionPickerCss();

  actionPickerEl.innerHTML = "";
  if (!st) return;

  const myTurn = canControl(st);
  const su = getSelectedUnit(st);

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

  // ---- Support panel ----
  const handDef = selectedHandDef(st);
  if (mode === "support" && myTurn && handDef && isSupportCard(handDef)) {
    const plan = supportPlan(handDef);
    const ready = supportReadyByPlan(plan);

    const panel = document.createElement("div");
    panel.className = "apPanel";

    const row = document.createElement("div");
    row.className = "row";

    const left = document.createElement("div");
    left.innerHTML = `<div class="title">Support</div><div class="small">${cardName(selectedHandCardId(st))}</div>`;

    const right = document.createElement("div");
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = ready ? "準備OK" : "対象選択中";
    right.appendChild(pill);

    const pill2 = document.createElement("span");
    pill2.className = "pill";
    pill2.textContent = supportRateText(handDef);
    right.appendChild(pill2);

    const pill3 = document.createElement("span");
    pill3.className = "pill";
    pill3.textContent = supportTargetText(handDef);
    right.appendChild(pill3);

    row.appendChild(left);
    row.appendChild(right);
    panel.appendChild(row);

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = supportHintText(st);
    panel.appendChild(hint);

    const footer = document.createElement("div");
    footer.className = "apFooter";

    execSupportBtn = document.createElement("button");
    execSupportBtn.className = "btnExec";
    execSupportBtn.textContent = "サポート実行";
    execSupportBtn.disabled = !ready;
    execSupportBtn.addEventListener("click", () => execSupport(st));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btnGhost";
    cancelBtn.textContent = "選択クリア";
    cancelBtn.addEventListener("click", () => {
      resetSupportPicks();
      render(st);
    });

    footer.appendChild(execSupportBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(footer);
    actionPickerEl.appendChild(panel);
    return;
  }

  // ---- Attack panel ----
  if (mode === "attack" && myTurn && su && su.owner === seat) {
    const def = cardDefs[su.cardId] || {};
    const acts = Array.isArray(def.actions) ? def.actions : [];
    ensureSelectedActionIndex(st);

    const wrap = document.createElement("div");
    wrap.className = "actWrap";

    for (let i = 0; i < acts.length; i++) {
      const act = acts[i];
      const btn = document.createElement("button");
      btn.className = "actBtn" + (i === selectedActionIndex ? " selected" : "");
      const rate = calcHitRateAdapter(su, act);
      const rng = actRangeLabel(act, su.owner);

      btn.innerHTML = `<span class="actText">
        <span class="badge">${act.cost ?? "?"}</span>
        ${act.name ?? "?"}
        <span class="badge">命中${rate}%</span>
        <span class="badge">${rng}</span>
      </span>`;

      btn.addEventListener("click", () => {
        selectedActionIndex = i;
        render(st);
      });

      wrap.appendChild(btn);
    }

    actionPickerEl.appendChild(wrap);

    const panel = document.createElement("div");
    panel.className = "apPanel";

    const hint = document.createElement("div");
    hint.className = "hint";

    const tgt = getSelectedTarget(st);
    hint.textContent =
      `選択ユニット：${cardName(su.cardId)}\n` +
      `技：${acts[selectedActionIndex]?.name ?? "?"}（コスト:${acts[selectedActionIndex]?.cost ?? "?"}）\n` +
      `対象：${getSelectedTarget(st) ? cardName(getSelectedTarget(st).cardId) : "未選択"}\n` +
      `手順：対象ユニットをクリック → 「行動実行」\n` +
      (su.fatigue ? `\n※疲労中：行動できません` : "");

    panel.appendChild(hint);

    const footer = document.createElement("div");
    footer.className = "apFooter";

    execAttackBtn = document.createElement("button");
    execAttackBtn.className = "btnExec";
    execAttackBtn.textContent = "行動実行";

    const act = acts[selectedActionIndex] || acts[0] || null;
    const mana = normalizeMana(st.mana);
    const canPay = act
      ? mana?.[seat]?.cur >= Math.max(0, Math.trunc(Number(act.cost ?? 0)))
      : false;

    // 対象が必要か？：selfは不要 / AOEも不要（対象なしで撃てる）
    const flags = act ? actFlags(act) : { aoe: false };
    const needTarget = act ? !isSelfRange(act.range) && !flags.aoe : true;
    const hasTarget = !!getSelectedTarget(st);

    // 実行可否
    execAttackBtn.disabled =
      !act ||
      isPanic(su) ||
      !!su.fatigue ||
      !canPay ||
      (needTarget && !hasTarget);

    execAttackBtn.addEventListener("click", () => execAttack(st));

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btnGhost";
    cancelBtn.textContent = "対象クリア";
    cancelBtn.addEventListener("click", () => {
      selectedTargetId = null;
      render(st);
    });

    footer.appendChild(execAttackBtn);
    footer.appendChild(cancelBtn);

    panel.appendChild(footer);
    actionPickerEl.appendChild(panel);
    return;
  }

  // それ以外（デフォルト）
  const p = document.createElement("div");
  p.className = "apPanel";
  p.innerHTML = `<div class="small">ユニット選択→モードを選んで操作してね</div>`;
  actionPickerEl.appendChild(p);
}

// =====================
// Support / Attack / Evolve / EX 実行コア
// =====================

// 10単位丸め
function round10(n) {
  const v = Math.trunc(Number(n ?? 0));
  return Math.trunc(v / 10) * 10;
}

// 状態付与ヘルパ（status/statuses両対応）
function addOrSetStatus(unit, key, deltaOrValue) {
  if (!unit) return;
  unit.status =
    unit.status && typeof unit.status === "object" ? unit.status : {};
  unit.statuses =
    unit.statuses && typeof unit.statuses === "object" ? unit.statuses : {};
  const st = getStatusLocal(unit);

  const cur = st?.[key]?.v;
  const base = Number.isFinite(Number(cur)) ? Number(cur) : 0;
  const add = Number.isFinite(Number(deltaOrValue)) ? Number(deltaOrValue) : 0;

  const v = base + add;

  unit.status[key] = { v };
  unit.statuses[key] = { v };
}

// powerUp/armor 適用アダプタ（state側実装差異吸収）
function applyPowerUpAdapter(attacker, hpDamageAbs, act) {
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try {
    if (typeof applyPowerUpToHpDamage !== "function") return dmg;
    const n = applyPowerUpToHpDamage.length;
    if (n >= 3)
      return Math.max(
        0,
        Math.trunc(Number(applyPowerUpToHpDamage(attacker, dmg, act) ?? dmg)),
      );
    if (n === 2)
      return Math.max(
        0,
        Math.trunc(Number(applyPowerUpToHpDamage(attacker, dmg) ?? dmg)),
      );
    if (n === 1)
      return Math.max(
        0,
        Math.trunc(Number(applyPowerUpToHpDamage(attacker) ?? dmg)),
      );
    return dmg;
  } catch {
    return dmg;
  }
}

function applyArmorAdapter(defender, hpDamageAbs) {
  let dmg = Math.max(0, Math.trunc(Number(hpDamageAbs ?? 0)));
  try {
    if (typeof applyArmorToHpDamage !== "function") return dmg;

    const ret = applyArmorToHpDamage(defender, dmg);

    // ✅ game_state.js型：{ taken, absorbed, remainArmor }
    if (ret && typeof ret === "object" && Number.isFinite(Number(ret.taken))) {
      return Math.max(0, Math.trunc(Number(ret.taken)));
    }

    // ✅ 旧型：数値返しも吸う
    const n = Number(ret);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));

    return dmg;
  } catch {
    return dmg;
  }
}

function clampUnitStats10(u) {
  if (!u) return;

  // 10単位丸め
  u.hp = round10(u.hp);
  u.sp = round10(u.sp);

  // 下限
  if (u.hp < 0) u.hp = 0;
  if (u.sp < 0) u.sp = 0;

  // 上限（maxHp/maxSp があればそれを使う）
  const maxHp = Number.isFinite(Number(u.maxHp)) ? round10(u.maxHp) : null;
  const maxSp = Number.isFinite(Number(u.maxSp)) ? round10(u.maxSp) : null;

  if (maxHp != null) u.hp = Math.min(u.hp, maxHp);
  if (maxSp != null) u.sp = Math.min(u.sp, maxSp);

  // 念のため格納も10単位に
  if (maxHp != null) u.maxHp = maxHp;
  if (maxSp != null) u.maxSp = maxSp;
}

// 命中ロール
function rollHit(rate) {
  const r = Math.floor(Math.random() * 100) + 1; // 1..100
  return { r, hit: r <= Math.max(0, Math.min(100, Math.trunc(rate))) };
}

// =====================
// クリティカル / ファンブル（追加）
// =====================
const CRIT_ROLL_MAX = 5; // 1..5 でクリティカル
const FUMBLE_ROLL_MIN = 95; // 95..100 でファンブル

// 範囲内ターゲット列挙（AOE用）
function listTargetsForAoe(s, attacker, act) {
  const units = Array.isArray(s?.units) ? s.units : [];
  const flags = actFlags(act);

  // rangeSpec → offsets（front1+rf1+lf1 なら3マスになる）
  const offs = parseRangeSpecToOffsets(act.range, attacker.owner);
  if (!offs.length) return [];

  // all/全体 が付いてたら味方も巻き込む
  const addList = addStatusListFromAny(act?.addStatus);
  const isAll =
    flags.aoe && (addList.includes("all") || addList.includes("全体"));

  // range形状上の「セル集合」を作る
  const cells = new Set();
  for (const o of offs) {
    const x = attacker.x + o.dx;
    const y = attacker.y + o.dy;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;

    // ✅ AOEでも line-block を効かせたいならここをON（今はOFFのままが無難）
    // if (!flags.pierce) {
    //   if (isLineBlocked(units, attacker, { x, y })) continue;
    // }

    cells.add(`${x},${y}`);
  }

  // セルにいるユニットを拾う
  const out = [];
  for (const u of units) {
    if (!u || Number(u.hp) <= 0) continue;
    if (u.id === attacker.id) continue;

    const key = `${u.x},${u.y}`;
    if (!cells.has(key)) continue;

    if (isAll) out.push(u);
    else {
      if (normSeat(u.owner) !== normSeat(attacker.owner)) out.push(u);
    }
  }
  return out;
}

// ===== Status icon helpers =====
const STATUS_ICON = {
  armor: "🛡️",
  bleed: "🩸",
  fracture: "🦴",
  smell: "👃",
  lostSoul: "👻",
  blind: "🙈",
  evade: "💨",
  combo: "🔗",
  followUp: "⚡",
  aim: "🎯",
  jinx: "🍀",
  powerUp: "💥",
  power: "💥",
};

function bonusIcon(name) {
  const m = {
    bleed: "🩸",
    fracture: "🦴",
    smell: "👃",
    blind: "🙈",
    aim: "🎯",
    jinx: "🍀",
    armor: "🛡️",
    powerUp: "💥",
  };
  return m[name] || "★";
}

function isBonusTriggered(when, rollR) {
  const w = String(when || "").trim();
  if (!w) return false;

  // "<=40" ">=80" "<40" ">10" "==1" みたいなのを許可
  const m = w.match(/^(<=|>=|<|>|==)\s*(\d+)$/);
  if (!m) return false;

  const op = m[1];
  const n = Math.max(1, Math.min(100, Math.trunc(Number(m[2]))));
  const r = Math.max(1, Math.min(100, Math.trunc(Number(rollR))));

  if (op === "<=") return r <= n;
  if (op === ">=") return r >= n;
  if (op === "<") return r < n;
  if (op === ">") return r > n;
  if (op === "==") return r === n;
  return false;
}

function applyBonusEffects({ attacker, target, act, rollR, logLines }) {
  const bonus = Array.isArray(act?.bonus) ? act.bonus : [];
  if (!bonus.length) return;

  for (const b of bonus) {
    const when = b?.when;
    if (!isBonusTriggered(when, rollR)) continue;

    const key = String(b?.addStatus || "").trim();
    if (!key) continue;

    const v = Number.isFinite(Number(b?.v)) ? Math.trunc(Number(b.v)) : 10;

    // status/statuses 両対応で付与（既存の addOrSetStatus を使う）
    addOrSetStatus(target, key, v);

    if (logLines) {
      logLines.push(
        `  ↳ 追加効果 ${when} ${bonusIcon(key)}${key}${v ? `(${v})` : ""}`,
      );
    }
  }
}

async function execAttack(st) {
  if (!st) return;
  if (!canControl(st)) return;

  const su = getSelectedUnit(st);
  if (!su || su.owner !== seat) return;

  const def = cardDefs[su.cardId] || {};
  const acts = Array.isArray(def.actions) ? def.actions : [];
  if (!acts.length) return;

  ensureSelectedActionIndex(st);
  const act = acts[selectedActionIndex] || acts[0];
  if (!act) return;

  const flags0 = actFlags(act);
  const needTarget = !isSelfRange(act.range) && !flags0.aoe;
  const target = getSelectedTarget(st); // ✅ 未定義バグ対策

  // 対象が必要なのに無い（単体のみ）
  if (needTarget && !target) return;

  // ★UI選択を固定（transaction中にグローバル参照しない）
  const attackerIdSnap = su.id;
  const actionIndexSnap = selectedActionIndex;
  const targetIdSnap = selectedTargetId;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    const attacker = s.units.find((u) => u.id === attackerIdSnap) || null;
    if (!attacker || attacker.owner !== seat) return;
    if (Number(attacker.hp) <= 0) return;
    if (isPanic(attacker)) return;
    if (attacker.fatigue) return;

    const def2 = cardDefs[attacker.cardId] || {};
    const acts2 = Array.isArray(def2.actions) ? def2.actions : [];
    const act2 = acts2[actionIndexSnap] || acts2[0] || null;
    if (!act2) return;

    // マナ支払い
    const cost = Math.max(0, Math.trunc(Number(act2.cost ?? 0)));
    const mana = normalizeMana(s.mana);
    if (mana?.[seat]?.cur < cost) return;
    s.mana = spendManaMut(s.mana, seat, cost);

    const flags = actFlags(act2);

    // 対象群
    let targets = [];
    if (isSelfRange(act2.range)) {
      targets = [attacker];
    } else if (flags.aoe) {
      targets = listTargetsForAoe(s, attacker, act2);
    } else {
      const tUnit = s.units.find((u) => u.id === targetIdSnap) || null;
      if (!tUnit || Number(tUnit.hp) <= 0) return;

      // 射程チェック
      if (!inActionRange(attacker, tUnit.x, tUnit.y, act2.range)) return;

      // ブロック（pierceでなければ）
      if (!flags.pierce) {
        if (isLineBlocked(s.units, attacker, tUnit)) return;
      }

      targets = [tUnit];
    }

    // 命中率（状態込み）
    const rate = calcHitRateAdapter(attacker, act2);
    const rr = rollHit(rate);

    const isCrit = rr.r <= CRIT_ROLL_MAX; // 1..5
    const isFumble = rr.r >= FUMBLE_ROLL_MIN; // 95..100

    let evaded = false;

    // 回避（単体のとき）
    if (
      rr.hit &&
      targets.length === 1 &&
      targets[0] &&
      targets[0].id !== attacker.id
    ) {
      evaded = checkEvadeAdapter(targets[0]);
    }

    const finalHit = rr.hit && !evaded;

    const logLines = [];
    const actName = String(act2.name ?? "?");
    const label = `${cardName(attacker.cardId)}:${actName}`;

    s.lastRoll = {
      at: nowMs(),
      r: rr.r,
      rate,
      hit: rr.hit && !evaded,
      actionName: actName,
    };

    if (!finalHit) {
      // 失敗ログ（命中失敗 or 回避）
      if (!rr.hit) {
        logLines.push(`[${seat}] 行動失敗：${label}（命中${rate}%）`);
      } else {
        const evName = targets?.[0]?.cardId
          ? cardName(targets[0].cardId)
          : "対象";
        logLines.push(`[${seat}] 回避！：${label} → ${evName}`);
      }

      // ★ファンブル（追加）：95以上で失敗したら自傷
      if (isFumble) {
        const { hpDelta, spDelta } = getActDeltas(act2);

        const selfItems = [];
        // ダメージ成分だけ反映（回復成分は無視）
        if (hpDelta < 0) {
          let dmg = Math.abs(hpDelta);
          // 技の威力強化は「使った技」なので乗せる扱いに（好みで外してOK）
          dmg = applyPowerUpAdapter(attacker, dmg, act2);
          // 自分の装甲も反映（好みで外してOK）
          dmg = applyArmorAdapter(attacker, dmg);
          attacker.hp = round10(Number(attacker.hp) - dmg);
          selfItems.push({ kind: "HP", delta: -dmg });
        }
        if (spDelta < 0) {
          const dmgSp = Math.abs(spDelta);
          attacker.sp = round10(Number(attacker.sp) - dmgSp);
          selfItems.push({ kind: "SP", delta: -dmgSp });
        }

        clampUnitStats10(attacker);

        logLines.push(`💥 ファンブル！ 自分に反動ダメージ`);

        // 自爆でパニック/撃破したら「相手のキル」にする
        const killer = opponentSeat; // すでに上で定義済み
        setPanicAndCountIfNeeded(
          attacker,
          killer,
          s.kills,
          logLines,
          "ファンブル自爆(パニック)",
        );
        if (Number(attacker.hp) <= 0) {
          countKillIfNeeded(
            attacker,
            killer,
            s.kills,
            logLines,
            "ファンブル自爆(撃破)",
          );
        }

        // 演出用（任意）：lastHitに自傷を出す
        s.lastHit = {
          at: nowMs(),
          attackerId: attacker.id,
          targetId: attacker.id,
          items: selfItems.slice(0, 6),
        };
      }

      attacker.fatigue = true;
      normalizePanicForAll(s.units, s.kills, logLines);
      for (const ln of logLines) logPush(s, ln);

      const w = checkWinLocal(s);
      if (w) {
        s.winner = w;
        logPush(s, `🏁 勝者：${w}`);
      }

      tx.set(stateRef, s, { merge: true });
      return;
    }

    // 成功時：効果適用
    const { hpDelta, spDelta } = getActDeltas(act2);
    const hitItems = [];

    if (isCrit) {
      logLines.push(`✨ クリティカル！ ダメージ2倍`);
    }

    for (const t of targets) {
      if (!t || Number(t.hp) <= 0) continue;

      // HP
      if (hpDelta < 0) {
        let dmg = Math.abs(hpDelta);
        dmg = applyPowerUpAdapter(attacker, dmg, act2);

        // ★CRIT：ダメージだけ2倍（回復は増やさない）
        if (isCrit) dmg *= 2;

        dmg = applyArmorAdapter(t, dmg);
        t.hp = round10(Number(t.hp) - dmg);
        hitItems.push({ kind: "HP", delta: -dmg });
      } else if (hpDelta > 0) {
        // 回復は2倍しない
        t.hp = round10(Number(t.hp) + hpDelta);
        hitItems.push({ kind: "HP", delta: +hpDelta });
      }

      // SP
      if (spDelta < 0) {
        let dmgSp = Math.abs(spDelta);

        // ★CRIT：ダメージだけ2倍
        if (isCrit) dmgSp *= 2;

        t.sp = round10(Number(t.sp) - dmgSp);
        hitItems.push({ kind: "SP", delta: -dmgSp });
      } else if (spDelta > 0) {
        // 回復は2倍しない
        t.sp = round10(Number(t.sp) + spDelta);
        hitItems.push({ kind: "SP", delta: +spDelta });
      }

      applyBonusEffects({
        attacker,
        target: t,
        act: act2,
        rollR: rr.r,
        logLines,
      });

      clampUnitStats10(t);

      // 状態付与
      try {
        const ret = applyStatusesOnHitAdapter(t, act2);
        if (ret && typeof ret === "object") {
          // target自体を返す/ statusだけ返す などの差異吸収
          if (ret.status || ret.statuses) {
            if (ret.status) t.status = ret.status;
            if (ret.statuses) t.statuses = ret.statuses;
          }
        }
      } catch {}

      // パニック/撃破
      setPanicAndCountIfNeeded(t, seat, s.kills, logLines);
      if (Number(t.hp) <= 0) {
        countKillIfNeeded(t, seat, s.kills, logLines, "撃破");
      }
    }

    attacker.fatigue = true;

    const tgtName =
      targets.length === 1 && targets[0]
        ? cardName(targets[0].cardId)
        : flags.aoe
          ? `複数(${targets.length})`
          : "なし";

    logLines.push(`[${seat}] 行動成功：${label} → ${tgtName}`);

    const primaryTargetId =
      targets.length === 1 && targets[0]
        ? targets[0].id
        : (targetIdSnap ?? targets[0]?.id ?? null);

    s.lastHit = {
      at: nowMs(),
      attackerId: attacker.id,
      targetId: primaryTargetId || (targets[0]?.id ?? null),
      items: hitItems.slice(0, 6),
    };

    normalizePanicForAll(s.units, s.kills, logLines);

    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logLines.push(`🏁 勝者：${w}`);
    }

    for (const ln of logLines) logPush(s, ln);
    tx.set(stateRef, s, { merge: true });
  });
}

function applySmellOnTurnEndAdapter(u, s, who) {
  try {
    const fn = applySmellOnTurnEnd;
    if (typeof fn !== "function") return;

    const n = fn.length;
    if (n >= 3) fn(u, s, who);
    else if (n === 2) fn(u, s);
    else fn(u);
  } catch {}
}

// ---- Support 実行（applySupport が壊れても最低限動く） ----

function pickEffectByTable(eff, roll) {
  const table = Array.isArray(eff?.table) ? eff.table : null;
  if (!table || !table.length) return eff;

  // row.rate を「重み」扱い（合計100想定）。無ければ均等。
  const weights = table.map((r) => {
    const w = Number(r?.rate ?? r?.p ?? r?.prob ?? 0);
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const sum = weights.reduce((a, b) => a + b, 0);

  if (sum <= 0) {
    // 均等
    const idx = Math.min(
      table.length - 1,
      Math.max(0, Math.trunc(((roll - 1) / 100) * table.length)),
    );
    const row = table[idx];
    return row?.effect ? row.effect : row;
  }

  let acc = 0;
  for (let i = 0; i < table.length; i++) {
    acc += weights[i];
    if (roll <= Math.ceil((acc / sum) * 100)) {
      const row = table[i];
      return row?.effect ? row.effect : row;
    }
  }
  const last = table[table.length - 1];
  return last?.effect ? last.effect : last;
}

function supportAlwaysSuccessForDraw(eff) {
  const e = eff?.effect ? eff.effect : eff;
  if (!e) return false;
  const t = String(e.type ?? "").trim();
  return t === "draw";
}

function applySupportFallback(s, who, def, plan, ctx) {
  const eff0 = def?.effect || null;
  if (!eff0) return { ok: false, label: "効果なし" };

  // ✅ table抽選と成功判定は独立ロール
  const tableRoll = Math.floor(Math.random() * 100) + 1;
  const hitRoll = Math.floor(Math.random() * 100) + 1;

  // table があるなら内容決定
  const eff = pickEffectByTable(eff0, tableRoll);
  // ✅ caster条件があるのに満たしてなければ失敗扱い
  const cond = eff?.cond ?? eff0?.cond ?? null;
  if (!casterCondOkInState(s, ctx, cond, cardDefs)) {
    const label = `cond(caster) NG`;
    return { ok: false, label, eff, hitRoll, tableRoll };
  }
  const type = String(eff?.type ?? "").trim();

  // rate（drawは強制成功）
  const rate = Math.max(
    0,
    Math.min(100, Math.trunc(Number(eff?.rate ?? eff0?.rate ?? 100))),
  );
  const alwaysOk = supportAlwaysSuccessForDraw(eff);
  const hit = alwaysOk ? true : hitRoll <= rate;

  // 表示用（tableRoll/hitRoll 両方残す）
  const label =
    `tbl:${tableRoll} / hit:${hitRoll} / ` +
    (alwaysOk ? "DRAW(強制)" : `${rate}%`);
  if (!hit) return { ok: false, label, eff, hitRoll, tableRoll };

  const units = Array.isArray(s.units) ? s.units : [];
  const u1 = ctx?.target1Id ? units.find((u) => u.id === ctx.target1Id) : null;
  const u2 = ctx?.target2Id ? units.find((u) => u.id === ctx.target2Id) : null;

  const curSeq = Number(s.turnSeq ?? 1);

  // 効果適用（最低限）
  if (type === "draw") {
    const n = Math.max(1, Math.trunc(Number(eff?.n ?? eff?.draw ?? 1)));
    safeDrawCards(s, who, n);
    logPush(s, `[${who}] Support: ドロー +${n}`);
  } else if (type === "heal") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const hp = round10(Number(eff?.hp ?? eff?.heal ?? eff?.amount ?? 10));
    const sp = round10(Number(eff?.sp ?? 0));
    u1.hp = round10(Number(u1.hp) + hp);
    u1.sp = round10(Number(u1.sp) + sp);
    clampUnitStats10(u1);
    logPush(
      s,
      `[${who}] Support: 回復 ${cardName(u1.cardId)} HP+${hp}${sp ? ` SP+${sp}` : ""}`,
    );
  } else if (type === "dmg") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const hp = round10(
      Number(eff?.hp ?? eff?.dmg ?? eff?.damage ?? eff?.amount ?? 10),
    );
    u1.hp = round10(Number(u1.hp) - Math.abs(hp));
    clampUnitStats10(u1);
    // 撃破
    if (Number(u1.hp) <= 0)
      countKillIfNeeded(u1, who, s.kills, null, "Support撃破");
    logPush(
      s,
      `[${who}] Support: ダメージ ${cardName(u1.cardId)} HP-${Math.abs(hp)}`,
    );
  } else if (type === "modRate") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const d = Math.trunc(Number(eff?.delta ?? eff?.d ?? 10));
    if (d >= 0) addOrSetStatus(u1, "aim", d);
    else addOrSetStatus(u1, "jinx", Math.abs(d));
    logPush(
      s,
      `[${who}] Support: 命中${d >= 0 ? "+" : "-"}${Math.abs(d)}% → ${cardName(u1.cardId)}`,
    );
  } else if (type === "powerUp") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    const d = Math.trunc(Number(eff?.delta ?? eff?.d ?? 10));
    addOrSetStatus(u1, "powerUp", d);
    logPush(s, `[${who}] Support: 威力+${d} → ${cardName(u1.cardId)}`);
  } else if (type === "cleanse") {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    u1.status = {};
    u1.statuses = {};
    logPush(s, `[${who}] Support: 状態異常クリア → ${cardName(u1.cardId)}`);
  } else if (
    type === "recoverFatigue" ||
    type === "fatigueHeal" ||
    type === "fatigueClear"
  ) {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    u1.fatigue = false;
    logPush(s, `[${who}] Support: 疲労回復 → ${cardName(u1.cardId)}`);
  } else if (
    type === "recoverMove" ||
    type === "moveReset" ||
    type === "refreshMove"
  ) {
    if (!u1) return { ok: false, label, eff, needs: "unit" };
    u1.moveTurnSeq = curSeq;
    u1.moveUsed = 0;
    logPush(s, `[${who}] Support: 移動回復（2マス） → ${cardName(u1.cardId)}`);
  } else if (type === "swapPos") {
    if (!u1 || !u2) return { ok: false, label, eff, needs: "unit2" };
    const ax = u1.x,
      ay = u1.y;
    u1.x = u2.x;
    u1.y = u2.y;
    u2.x = ax;
    u2.y = ay;
    logPush(
      s,
      `[${who}] Support: 位置入替 ${cardName(u1.cardId)} ⇄ ${cardName(u2.cardId)}`,
    );
  } else if (type === "moveTo") {
    if (!u1 || !ctx?.targetCell)
      return { ok: false, label, eff, needs: "unitCell" };
    const { x, y } = ctx.targetCell;
    // 空マスでなければ中止
    const occ = units.find(
      (v) => v && Number(v.hp) > 0 && v.x === x && v.y === y,
    );
    if (occ) return { ok: false, label, eff, needs: "unitCell" };
    u1.x = x;
    u1.y = y;
    logPush(
      s,
      `[${who}] Support: 強制移動 ${cardName(u1.cardId)} → (${x},${y})`,
    );
  } else {
    // 未対応は何もしないが成功扱い（落ちないこと優先）
    logPush(s, `[${who}] Support: ${type || "unknown"}（fallback適用なし）`);
  }

  normalizePanicForAll(s.units, s.kills, null);

  return { ok: true, label, eff, hitRoll, tableRoll };
}

// ★最低限：caster 属性条件だけチェック（csvで cond.casterAttr / casterAttrIn を使う想定）
function getUnitAttrByIdInState(s, unitId, cardDefs) {
  if (!s || !unitId) return null;
  const units = Array.isArray(s.units) ? s.units : [];
  const u = units.find((x) => x.id === unitId);
  if (!u || Number(u.hp) <= 0 || u.panic) return null;
  const cd = cardDefs?.[u.cardId];
  return cd?.type ? String(cd.type).trim() : null;
}

function casterCondOkInState(s, ctx, cond, cardDefs) {
  if (!cond || typeof cond !== "object") return true;

  const casterAttr = cond.casterAttr ? String(cond.casterAttr).trim() : null;
  const casterAttrIn = Array.isArray(cond.casterAttrIn)
    ? cond.casterAttrIn.map((x) => String(x).trim()).filter(Boolean)
    : null;

  if (!casterAttr && !(casterAttrIn && casterAttrIn.length)) return true;

  const casterAttrNow = getUnitAttrByIdInState(s, ctx?.casterUnitId, cardDefs);
  if (!casterAttrNow) return false;

  if (casterAttr && casterAttrNow !== casterAttr) return false;
  if (
    casterAttrIn &&
    casterAttrIn.length &&
    !casterAttrIn.includes(casterAttrNow)
  )
    return false;

  return true;
}

// ★発動者(caster) を決める：基本は「今選択している自軍ユニット」
// 無ければ「対象1が味方ならそれ」/ それも無ければ「味方の先頭1体」
function pickCasterUnitIdSnapshot(st) {
  const units = Array.isArray(st?.units) ? st.units : [];
  const alive = (u) => u && Number(u.hp) > 0 && !u.panic;

  // 1) 選択中ユニット（自軍）
  const su = units.find((u) => u.id === selectedUnitId);
  if (su && alive(su) && normSeat(su.owner) === seat) return su.id;

  // 2) supportTarget1 が味方ならそれ
  const t1 = units.find((u) => u.id === supportTarget1Id);
  if (t1 && alive(t1) && normSeat(t1.owner) === seat) return t1.id;

  // 3) 味方の先頭（フィールドに居るなら）
  const first = units.find((u) => alive(u) && normSeat(u.owner) === seat);
  return first ? first.id : null;
}

async function execSupport(st) {
  if (!st) return;
  if (!canControl(st)) return;

  const cid = selectedHandCardId(st);
  const def = selectedHandDef(st);
  if (!cid || !def || !isSupportCard(def)) return;

  const plan = supportPlan(def);
  if (!supportReadyByPlan(plan)) return;

  // ★UI選択を固定
  const idxSnap = selectedHandIndex;
  const cidSnap = cid;
  const t1Snap = supportTarget1Id;
  const t2Snap = supportTarget2Id;
  const casterUnitIdSnap = pickCasterUnitIdSnapshot(st);
  const cellSnap = supportTargetCell ? { ...supportTargetCell } : null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.hands = s.hands || { A: [], B: [] };
    s.decks = s.decks || { A: [], B: [] };
    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    const hand = Array.isArray(s.hands[seat]) ? s.hands[seat] : [];

    // ✅ snapを使う（グローバル selectedHandIndex は見ない）
    const idx = idxSnap;
    if (idx == null || idx < 0 || idx >= hand.length) return;
    if (hand[idx] !== cidSnap) return;

    const mana = normalizeMana(s.mana);

    // ★ここで transaction 内の手札IDからdefを引き直す（外のdefは使わない）
    const defSnap = cardDefs?.[cidSnap] || null;
    if (!defSnap || !isSupportCard(defSnap)) return;

    const cost = Math.max(0, Math.trunc(Number(defSnap.cost ?? 0)));
    if (mana?.[seat]?.cur < cost) return;

    // 支払い＆手札消費
    s.mana = spendManaMut(s.mana, seat, cost);
    hand.splice(idx, 1);
    s.hands[seat] = hand;

    // ✅ ctx は try/catch の外で固定
    const ctx = {
      seat,
      casterUnitId: casterUnitIdSnap,
      target1Id: t1Snap,
      target2Id: t2Snap,
      targetCell: cellSnap,
      cardId: cidSnap,
    };

    // core → fallback
    let ok = false;
    let label = "??";
    let metaRoll = null;

    try {
      if (typeof applySupport === "function") {
        const n = applySupport.length;
        let ret;

        if (n >= 4) ret = applySupport(s, seat, defSnap, ctx);
        else if (n === 3) ret = applySupport(s, seat, defSnap);
        else if (n === 2) ret = applySupport(s, seat);
        else ret = applySupport(s);

        if (ret && typeof ret === "object") {
          if (ret.state && typeof ret.state === "object") {
            const ns = ret.state;
            for (const k of Object.keys(ns)) s[k] = ns[k];
          }
          if (ret.ok != null) ok = !!ret.ok;
          if (ret.label) label = String(ret.label);
          const rr = Number(ret?.roll ?? ret?.r ?? null);
          if (Number.isFinite(rr)) metaRoll = Math.trunc(rr);
        } else {
          ok = true;
          label = "core";
        }
      } else {
        throw new Error("applySupport missing");
      }
    } catch {
      const r = applySupportFallback(s, seat, defSnap, plan, ctx);
      ok = !!r.ok;
      label = String(r.label ?? "fallback");

      const hr = Number(r?.hitRoll);
      const tr = Number(r?.tableRoll);
      if (Number.isFinite(hr)) metaRoll = Math.trunc(hr);
      else if (Number.isFinite(tr)) metaRoll = Math.trunc(tr);
      else metaRoll = null;
    }

    s.lastSupportRoll = {
      at: nowMs(),
      r: metaRoll ?? Math.floor(Math.random() * 100) + 1,
      ok,
      label,
      cardName: cardName(cid),
    };

    logPush(
      s,
      `[${seat}] Support使用：${cardName(cid)}（${ok ? "成功" : "失敗"} / ${label}）`,
    );

    const w = checkWinLocal(s);
    if (w) {
      s.winner = w;
      logPush(s, `🏁 勝者：${w}`);
    }

    tx.set(stateRef, s, { merge: true });
  });

  // UIクリア
  selectedHandIndex = null;
  resetSupportPicks();
  setMode(null);
}

// ---- 進化 ----

// ---- EX ----
async function execEx() {
  const st = currentState;
  if (!st || !canControl(st)) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    s.ex = s.ex || { A: null, B: null };
    s.exUsed = s.exUsed || { A: false, B: false };
    const exId = s?.ex?.[seat] ?? null;
    const used = !!s?.exUsed?.[seat];
    if (!exId || used) return;

    let ok = false;
    try {
      if (typeof applyExSupport === "function") {
        const n = applyExSupport.length;
        let ret;
        if (n >= 3) ret = applyExSupport(s, seat, exId);
        else if (n === 2) ret = applyExSupport(s, seat);
        else ret = applyExSupport(s);

        if (ret && typeof ret === "object" && ret.state) {
          const ns = ret.state;
          for (const k of Object.keys(ns)) s[k] = ns[k];
        }
        ok = true;
      } else {
        // EXが無い場合でも落ちない
        ok = true;
        logPush(s, `[${seat}] EX：${cardName(exId)}（適用関数なし）`);
      }
    } catch {
      ok = false;
      logPush(s, `[${seat}] EX失敗：${cardName(exId)}`);
    }

    if (ok) {
      s.exUsed[seat] = true;
      logPush(s, `[${seat}] EX使用：${cardName(exId)}`);
    }

    tx.set(stateRef, s, { merge: true });
  });
}

// ※ panic は状態異常じゃないので “触らない”
function clearFatigueAndStatusesAtTurnEnd(s, who) {
  const units = Array.isArray(s?.units) ? s.units : [];
  for (const u of units) {
    if (!u) continue;
    if (normSeat(u.owner) !== who) continue;
    if (Number(u.hp) <= 0) continue;

    // ✅ 疲労回復：互換キー全部吸う（fatigue/fatigued/actedThisTurn等）
    try {
      clearFatigue(u);
    } catch {
      u.fatigue = false;
    }

    // ✅ 状態異常全回復：game_state.jsの正規（status）を消す
    try {
      clearStatuses(u);
    } catch {
      u.status = {};
    }

    // ✅ UI互換で statuses 側も空にする（panicは一切触らない）
    u.statuses = {};
  }
}

// =====================
// ターン終了
// =====================
// =====================
// ターン終了
// =====================
async function endTurn() {
  const st = currentState;
  if (!st || !canControl(st)) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
    if (!snap.exists()) return;
    const s = snap.data() || {};
    if (!canControl(s) || s.winner) return;

    const who = normSeat(s.turn);
    if (!who) return;

    s.units = Array.isArray(s.units) ? s.units : [];
    s.kills = s.kills && typeof s.kills === "object" ? s.kills : { A: 0, B: 0 };
    ensureInfilObj(s);

    // ---------------------
    // 2) ターン終了時：状態処理（匂いなど）
    // ---------------------
    // ✅ 匂い(smell)：終了時SPダメ（呼び方を正す）
    try {
      const units = Array.isArray(s.units) ? s.units : [];
      for (const u of units) {
        if (!u) continue;
        if (normSeat(u.owner) !== who) continue;
        try {
          if (!isAlive(u)) continue; // panicは生存扱いしない
        } catch {
          if (Number(u.hp) <= 0 || !!u.panic) continue;
        }
        applySmellOnTurnEndAdapter(u, s, who);
      }
    } catch {}

    // 他にも必要ならここに吸収処理を追加可能（現状は匂いだけ確実化）

    // ---------------------
    // 3) 勝利判定（終了時）
    // ---------------------
    const w0 = checkWinLocal(s);
    if (w0) {
      s.winner = w0;
      logPush(s, `🏁 勝者：${w0}`);
      tx.set(stateRef, s, { merge: true });
      return;
    }

    // ---------------------
    // 4) ✅ 自分ターン終わり：疲労＆状態異常を全回復
    //    ※ panic は状態異常ではないので触らない
    // ---------------------
    clearFatigueAndStatusesAtTurnEnd(s, who);
    logPush(s, `[${who}] ターン終了：疲労/状態異常を全回復`);

    // ---------------------
    // 5) ターン交代
    // ---------------------
    const next = who === "A" ? "B" : "A";
    s.turn = next;
    s.turnSeq = Math.trunc(Number(s.turnSeq ?? 1)) + 1;

    // ✅ ターン開始時フィールド処理（爆弾補充などはここ）
    try {
      ensureFieldState(s, W, H, s.fieldId ?? s.field?.id ?? fieldIdFromUrl);
      applyFieldOnTurnStart?.({ s, who: next, W, H, logPush });
    } catch {}

    // 受け手のマナ+2（仕様通り max=cur）
    s.mana = gainManaPlus2OnReceiveTurn(s.mana, next);

    // 受け手ドロー（必ず増える）
    try {
      safeDrawCards(s, next, DRAW_PER_TURN);
    } catch {}

    logPush(s, `--- ${next}ターン ---`);

    // 終了時点での勝利判定（侵入/回復/ドロー等の後）
    const w1 = checkWinLocal(s);
    if (w1) {
      s.winner = w1;
      logPush(s, `🏁 勝者：${w1}`);
    }

    tx.set(stateRef, s, { merge: true });
  });
}

// =====================
// モード別：クリック時の追加処理（進化ベース選択など）
// =====================
function onUnitClickedForMode(u, st) {
  if (!u || !st) return;

  // evolve: ベース選択（別JS）
  if (
    mode === "evolve" &&
    canControl(st) &&
    u.owner === seat &&
    !isPanic(u) &&
    Number(u.hp) > 0
  ) {
    evolveSys.onPickBaseUnit(u, st);
    render(st);
    return;
  }
}

// 既存 onCellClick 内の u クリック処理にフック（落とさず後付け）
const _oldOnCellClick = onCellClick;
onCellClick = function (x, y) {
  const st = currentState;
  if (!st) return;

  const u = unitAt(st, x, y);
  if (u) {
    try {
      onUnitClickedForMode(u, st);
    } catch {}
  }
  return _oldOnCellClick(x, y);
};

// =====================
// Log render
// =====================
function renderLog(st) {
  if (!logEl) return;
  const lines = Array.isArray(st?.log) ? st.log : [];
  const tail = lines.slice(-30).reverse();

  const extra = [];
  if (nowMs() < rngMsgUntil) extra.push("🎲 乱数調整（見た目だけ）");

  logEl.textContent = extra.concat(tail).join("\n");
}

function prettyEffect(eff) {
  if (!eff) return "";
  if (typeof eff === "string") {
    const s = eff.trim();
    if (!s) return "";
    try {
      eff = JSON.parse(s);
    } catch {
      return s;
    }
  }
  if (typeof eff !== "object") return String(eff);

  // よく使うフィールドを拾う
  const t = String(eff.type || eff.kind || eff.action || "").toLowerCase();
  const rate = eff.rate !== undefined ? `成功${eff.rate}%` : "";
  const target = eff.target ? `対象:${eff.target}` : "";
  const tag = eff.tag ? `タグ:${eff.tag}` : "";

  const join = (...xs) => xs.filter(Boolean).join(" / ");

  // type別に日本語化（必要に応じて増やしていく）
  switch (t) {
    case "draw":
      return join("ドロー", eff.n ? `+${eff.n}枚` : "", rate, target);
    case "heal":
      return join(
        "回復",
        eff.hp ? `HP+${eff.hp}` : "",
        eff.sp ? `SP+${eff.sp}` : "",
        rate,
        target,
      );
    case "dmg":
      return join(
        "ダメージ",
        eff.hp ? `HP-${eff.hp}` : "",
        eff.sp ? `SP-${eff.sp}` : "",
        rate,
        target,
      );
    case "modrate":
      return join(
        "成功率補正",
        eff.delta !== undefined
          ? `${eff.delta > 0 ? "+" : ""}${eff.delta}%`
          : "",
        rate,
        target,
      );
    case "addstatus":
    case "status":
      return join(
        "状態付与",
        eff.name || eff.status || "",
        eff.turn ? `${eff.turn}T` : "",
        rate,
        target,
        tag,
      );
    case "moveto":
      return join(
        "移動",
        eff.to !== undefined ? `to:${eff.to}` : "",
        rate,
        target,
      );
    case "recover":
    case "rest":
      return join(
        "回復(行動回数/疲労)",
        eff.delta !== undefined
          ? `${eff.delta > 0 ? "+" : ""}${eff.delta}`
          : "",
        rate,
        target,
      );

    default: {
      // 分からないやつは「キー=値」で軽く見せる（JSON丸出しよりマシ）
      const keys = Object.keys(eff);
      const compact = keys
        .filter((k) => k !== "type")
        .slice(0, 8)
        .map((k) => `${k}:${String(eff[k])}`);
      return join(`効果:${eff.type || "?"}`, compact.join(" / "));
    }
  }
}

function applyFieldThemeToBody(fieldId) {
  const fid = String(fieldId || "grass").toLowerCase();
  document.body.classList.remove("field-grass", "field-danger", "field-swamp");
  document.body.classList.add(`field-${fid}`);
}

// =====================
// Evolve confirm button (above detail)
// =====================
let evolveConfirmBtn = null;

function ensureEvolveConfirmBtn() {
  if (evolveConfirmBtn) return evolveConfirmBtn;

  // 置き場所：右ペインの「詳細」タイトルの直下
  const right = document.getElementById("rightPane");
  if (!right) return null;

  // 「詳細」paneTitle を探す
  const titles = [...right.querySelectorAll(".paneTitle")];
  const detailTitle = titles.find((el) => el.textContent?.includes("詳細"));
  if (!detailTitle) return null;

  const btn = document.createElement("button");
  btn.id = "evolveConfirmBtn";
  btn.type = "button";
  btn.textContent = "✨ 進化確定";
  btn.style.margin = "8px 0 6px";
  btn.style.width = "100%";
  btn.style.borderRadius = "12px";
  btn.style.padding = "10px 12px";
  btn.style.border = "1px solid #666";
  btn.style.background = "#2a2a2a";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", async () => {
    const st = currentState;
    if (!st) return;
    if (!canControl(st)) return;
    if (mode !== "evolve") return;
    if (selectedHandIndex == null) return;

    try {
      if (!evolveSys.canExec(st, selectedHandIndex)) return;
      await evolveSys.execEvolveFromHandIndex(selectedHandIndex);
    } catch (e) {
      console.warn("[evolve confirm] failed", e);
    }
  });

  // 詳細タイトルの直後に差し込む
  detailTitle.insertAdjacentElement("afterend", btn);
  evolveConfirmBtn = btn;
  return btn;
}

function updateEvolveConfirmBtn(st) {
  const btn = ensureEvolveConfirmBtn();
  if (!btn) return;

  // 表示条件：進化モード & 自分のターン
  const show = !!st && mode === "evolve" && canControl(st);
  btn.style.display = show ? "block" : "none";

  if (!show) return;

  // 押せる条件：evolveSysの判定に完全委任
  const ok =
    selectedHandIndex != null && (() => {
      try { return evolveSys.canExec(st, selectedHandIndex); }
      catch { return false; }
    })();

  btn.disabled = !ok;
  btn.style.opacity = ok ? "1" : "0.5";
}

// =====================
// Main render
// =====================
function render(st) {
  currentState = st;
  try {
    applyFieldThemeFromState(st, normalizeFieldId);
  } catch {}
  try {
    applyFieldThemeToBody(
      normalizeFieldId(st?.fieldId ?? st?.field?.id ?? "grass"),
    );
  } catch {}

  ensureRngButton();
  ensureSettingsButton();
  //ensureBgmToggleButton(); // ★追加

  if (!st) return;

  // ターン変化UI
  const t = normSeat(st.turn);
  if (t && (t !== lastSeenTurn || st.turnSeq !== lastSeenTurnSeq)) {
    // 自分のターンが来たときだけ目立たせる
    if (t === seat) flashTurnBanner();
    lastSeenTurn = t;
    lastSeenTurnSeq = st.turnSeq;

    // 相手ターンに入ったら操作系の選択を弱くリセット
    if (t !== seat) {
      selectedTargetId = null;
      resetSupportPicks();
    }
  }

  setTurnUI(st);

  // 盤面＆手札
  renderBoard(st);
  renderHand(st);

  // 行動パネル
  renderActionPicker(st);

  // クイック
  updateQuickActions(st);

  // FX（被弾）
  try {
    fxOnHit(st);
  } catch {}

  // ログ
  renderLog(st);
    // 進化確定ボタン（詳細の上）
  try { updateEvolveConfirmBtn(st); } catch {}

  // detailが空なら軽く誘導
  if (detailEl && !detailEl.innerHTML) {
    detailEl.innerHTML = `<span class="small">ユニットや手札をクリックすると詳細が出るよ</span>`;
  }
}

// =====================
// Buttons bind
// =====================
btnDoEvolve &&
  btnDoEvolve.addEventListener("click", async () => {
    const st = currentState;
    if (!st) return;
    if (selectedHandIndex == null) return;
    if (!evolveSys.canExec(st, selectedHandIndex)) return;
    await evolveSys.execEvolveFromHandIndex(selectedHandIndex);
  });

btnEnd && btnEnd.addEventListener("click", () => endTurn());
exBtnEl && exBtnEl.addEventListener("click", () => execEx());

// =====================
// Snapshot
// =====================
onSnapshot(
  stateRef,
  (snap) => {
    if (!snap.exists()) return;
    const st = snap.data() || {};

    // 最低限の補完（落ちない）
    st.units = Array.isArray(st.units) ? st.units : [];
    st.hands = st.hands || { A: [], B: [] };
    st.decks = st.decks || { A: [], B: [] };
    st.kills =
      st.kills && typeof st.kills === "object" ? st.kills : { A: 0, B: 0 };
    ensureInfilObj(st);

    try {
      ensureFieldState(st, W, H, st.fieldId ?? st.field?.id ?? fieldIdFromUrl);
    } catch {}

    // schema差分の最低補完
    if (!st.ex) st.ex = { A: null, B: null };
    if (!st.exUsed) st.exUsed = { A: false, B: false };

    // =====================
    // ✅ 勝敗確定で victory.html へ遷移（1回だけ）
    // =====================
    try {
      const w = normSeat(st?.winner);
      if (!didGoVictory && w && roomId && playerId && seat) {
        didGoVictory = true;

        // infil は state の infil を優先（無ければ 0）
        const inf = calcInfilNow(st);

        const ka = Math.trunc(Number(st?.kills?.A ?? 0) || 0);
        const kb = Math.trunc(Number(st?.kills?.B ?? 0) || 0);

        const qs = new URLSearchParams();
        qs.set("room", roomId);
        qs.set("player", playerId);
        qs.set("seat", seat); // 自分(A/B)
        qs.set("winner", w); // 勝者(A/B)

        qs.set("turnSeq", String(Math.trunc(Number(st?.turnSeq ?? 0) || 0)));
        qs.set("killsA", String(ka));
        qs.set("killsB", String(kb));
        qs.set("infilA", String(Math.trunc(Number(inf?.A ?? 0) || 0)));
        qs.set("infilB", String(Math.trunc(Number(inf?.B ?? 0) || 0)));

        // もし理由も出したいなら（任意）
        // qs.set("reason", w === "A" ? "Aが勝利条件達成" : "Bが勝利条件達成");

        location.href = `victory.html?${qs.toString()}`;
        return; // 遷移するので以降の render は不要
      }
    } catch (e) {
      console.warn("[victory redirect] failed", e);
    }

    render(st);
  },
  (err) => {
    console.error("[onSnapshot] error", err);
    if (logEl) logEl.textContent = String(err?.message ?? err);
  },
);
