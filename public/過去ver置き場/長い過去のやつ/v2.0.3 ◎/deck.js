// public/deck.js
// v2.0.0-ex - deck editor supports support cards + EX select (players.exCardId)
// - EX is 1 support card (separate from 20-card deck)
// - Save/create/join also persists exCardId
// - EX picker modal is created dynamically (no extra HTML needed)
// - Keep all existing features
//
// v2.0.0-ex+patch3
// (1) create/join で roomId/playerId 変更後、表示ラベルを即同期
// (2) EX UI のDOMも必須チェックに追加（置き忘れ検出）
// (3) 20枚警告がEX保存メッセージ等を即上書きしないよう調整

import { TutorialSystem } from "./tutorial.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com") ? "tcg-0bato" : "tcg-0bato",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// Const
// =====================
const DECK_SIZE = 20;
const MAX_SAME = 4;

const LOCAL_KEY = "tcg_deck_local_v15b";
const EX_LOCAL_KEY = "tcg_ex_local_v20260129";
const OPEN_TYPE_KEY = "tcg_deck_open_type_v15b";
const NAME_KEY = "tcg_player_name_v15b";

// ★30分で期限切れ
const ROOM_TTL_MIN = 30;
const ROOM_TTL_MS = ROOM_TTL_MIN * 60 * 1000;

// ★属性説明（＋強み / −弱み）
const TYPE_INFO = {
  "火": { plus: ["高火力でHPを削り切りやすい", "短期決戦向き（撃破勝ちを狙える）"], minus: ["継戦能力が低い（息切れしやすい）", "防御/回復が薄めになりがち"] },
  "水": { plus: ["安定・防御寄り（耐えて勝つ）", "SP削りや妨害が得意"], minus: ["瞬間火力が出にくい", "決め手不足で長引きやすい"] },
  "風": { plus: ["機動力が高い（位置取りで勝てる）", "侵入勝ち/回避寄りが得意"], minus: ["一撃が軽め", "盤面が崩れると立て直しが難しい"] },
  "光": { plus: ["万能寄り（状況対応しやすい）", "補助/バフで試合を整えるのが得意"], minus: ["尖った勝ち筋を作りにくい", "器用貧乏になりがち"] },
  "闇": { plus: ["妨害・状態異常で崩すのが得意", "相手主力を機能停止にしやすい"], minus: ["噛み合わないと弱い（依存度高い）", "対策されると失速しやすい"] },
  "鋼": { plus: ["カッチカチで前線維持が得意", "受けながら勝ち筋を作れる"], minus: ["メンタル弱め（SP管理が難しい）", "展開力と安定性が低い"] },
  "雷": { plus: ["加速して展開力がある", "テンポで押し切りやすい"], minus: ["制圧が低め（盤面固定が苦手）", "失速すると脆い"] },
  "サポート": { plus: ["試合を有利にする補助カード"], minus: ["失敗しても消費される（バトル側仕様）"] },
};

function typeInfo(type) {
  const t = String(type || "");
  return TYPE_INFO[t] || { plus: ["（未定）"], minus: ["（未定）"] };
}

// 表示順：既定属性 → その他 → サポート最後
const TYPE_ORDER = ["火","水","風","光","闇","鋼","雷"];

// =====================
// URL params（room/player を必ず確保してURLに入れる）
// =====================
const params = new URLSearchParams(location.search);
let roomId = params.get("room");
let playerId = params.get("player");

function newRoomCode4() { return String(Math.floor(1000 + Math.random() * 9000)); }
function newPlayerId() { return (crypto.randomUUID?.() ?? ("p" + Math.random().toString(16).slice(2))); }

if (!roomId) roomId = newRoomCode4();
if (!playerId) playerId = newPlayerId();

params.set("room", roomId);
params.set("player", playerId);
history.replaceState(null, "", `${location.pathname}?${params.toString()}`);

// =====================
// DOM
// =====================
const $ = (id) => document.getElementById(id);

const roomIdLabel = $("roomIdLabel");
const playerIdLabel = $("playerIdLabel");

const typeSelect = $("typeSelect");
const searchEl = $("search");
const shownCountEl = $("shownCount");

const cardSectionsEl = $("cardSections");
const deckListEl = $("deckList");
const deckCountEl = $("deckCount");
const msgEl = $("msg");
const detailEl = $("detail");

const btnSave = $("btnSave");
const createBtn = $("createBtn");
const joinBtn = $("joinBtn");
const randomDeckBtn = $("randomDeckBtn");

const btnRule = $("btnRule");

// tutorial modal (existing)
const btnTutorial = $("btnTutorial");
const modalBackdrop = $("modalBackdrop");
const btnCloseModal = $("btnCloseModal");
const tutorialBody = $("tutorialBody");

// EX UI (from index.html)
const exLabelEl = $("exLabel");
const exPickBtn = $("exPickBtn");
const exClearBtn = $("exClearBtn");

// 必須DOMチェック（ズレ検出）
const requiredIds = [
  "typeSelect","search","shownCount","cardSections","deckList","deckCount","msg","detail",
  "btnSave","createBtn","joinBtn","randomDeckBtn",
  // ★patch(2): EX UIも必須扱いにして置き忘れを検出
  "exLabel","exPickBtn","exClearBtn"
];
for (const id of requiredIds) {
  if (!$(id)) {
    console.error("index.html missing element id:", id);
    throw new Error(`index.html missing element id: ${id}`);
  }
}

// =====================
// Firestore refs
// =====================
const roomRef = (rid) => doc(db, "rooms", rid);
const playerRef = (rid, pid) => doc(db, "rooms", rid, "players", pid);
const playersCol = (rid) => collection(db, "rooms", rid, "players");

const matchRef = (rid) => doc(db, "rooms", rid, "game", "match");
const stateRef = (rid) => doc(db, "rooms", rid, "game", "state");

// =====================
// State
// =====================
let cardDefs = {};
let cardIdsSorted = [];
let deckMap = {};
let filterType = "ALL";
let filterName = "";

// ★EX（1枚）
let exCardId = null; // players.exCardId に保存

// =====================
// Utils
// =====================
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function sumDeck(m) {
  return Object.values(m || {}).reduce((a, b) => a + Number(b || 0), 0);
}
function setMsg(text, ok = false) {
  msgEl.style.color = ok ? "#9cff9c" : "#ff8080";
  msgEl.textContent = text || "";
}
function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isSupportCard(def){
  return String(def?.kind || "").toLowerCase() === "support";
}

// 表示上の属性（supportは "サポート" 扱い）
function displayType(def){
  if (isSupportCard(def)) return "サポート";
  return String(def?.type || "");
}

// ★patch(1): roomId/playerId 表示ラベル同期
function syncRoomPlayerLabels(){
  if (roomIdLabel) roomIdLabel.textContent = roomId;
  if (playerIdLabel) playerIdLabel.textContent = playerId;
}

// ===== サポート効果を日本語で表示 =====
function supportEffectTextJa(effect){
  const eff = (effect && typeof effect === "object") ? effect : null;
  if (!eff) return "効果なし";

  const one = (e) => {
    const type = String(e?.type || "");
    const rate = (e?.rate != null) ? Number(e.rate) : null;

    const rateTxt = (rate == null) ? "" : `（成功${Math.max(0, Math.min(100, Math.trunc(rate)))}%）`;

    if (type === "draw") {
      const n = Math.max(0, Math.trunc(Number(e?.n ?? e?.draw ?? 1)));
      return `ドロー${n}${rateTxt}`;
    }
    if (type === "heal") {
      const hp = Math.max(0, Math.trunc(Number(e?.hp ?? 0)));
      const sp = Math.max(0, Math.trunc(Number(e?.sp ?? 0)));
      const parts = [];
      if (hp) parts.push(`HP+${hp}`);
      if (sp) parts.push(`SP+${sp}`);
      return `回復：${parts.join(" / ") || "なし"}${rateTxt}`;
    }
    if (type === "dmg") {
      const hp = Math.max(0, Math.trunc(Number(e?.hp ?? 0)));
      const sp = Math.max(0, Math.trunc(Number(e?.sp ?? 0)));
      const parts = [];
      if (hp) parts.push(`HP-${hp}`);
      if (sp) parts.push(`SP-${sp}`);
      return `ダメージ：${parts.join(" / ") || "なし"}${rateTxt}`;
    }
    if (type === "modRate") {
      const delta = Math.trunc(Number(e?.delta ?? e?.rateDelta ?? 0));
      if (delta >= 0) return `命中率+${delta}%${rateTxt}`;
      return `命中率-${Math.abs(delta)}%${rateTxt}`;
    }
    if (type === "powerUp") {
      const delta = Math.trunc(Number(e?.delta ?? e?.power ?? 0));
      return `威力+${delta}%${rateTxt}`;
    }
    if (type === "cleanse") {
      return `状態異常を回復${rateTxt}`;
    }
    if (type === "bounce") {
      return `対象を手札に戻す${rateTxt}`;
    }
    if (type === "swapPos") {
      return `対象2体の位置を入れ替える${rateTxt}`;
    }
    if (type === "moveTo") {
      const md = (e?.maxDist == null) ? "" : `（最大距離${Math.max(0, Math.trunc(Number(e.maxDist)))}）`;
      return `対象を指定マスへ移動${md}${rateTxt}`;
    }

    return `効果(${type || "unknown"})${rateTxt}`;
  };

  if (Array.isArray(eff.table)) {
    return eff.table.map(row=>{
      const min = row?.min ?? 1;
      const max = row?.max ?? 100;
      const label = row?.label ? `：${String(row.label)}` : "";
      if (!row?.effect) return `${min}-${max}${label} → 不発`;
      return `${min}-${max}${label} → ${one(row.effect)}`;
    }).join(" / ");
  }

  return one(eff);
}

// 一覧用1行要約
function firstLine(def) {
  if (!def) return "";
  if (isSupportCard(def)) {
    return `サポート: ${supportEffectTextJa(def.effect)}`;
  }
  const a = def?.actions?.[0];
  if (!a) return "行動: なし";
  return `行動: ${a.name} / 程:${a.range} / ${a.rate}%`;
}

// ===== EX local storage =====
function loadLocalEx() {
  try {
    const v = localStorage.getItem(EX_LOCAL_KEY);
    return v ? String(v) : null;
  } catch { return null; }
}
function saveLocalEx(idOrNull) {
  try {
    if (!idOrNull) localStorage.removeItem(EX_LOCAL_KEY);
    else localStorage.setItem(EX_LOCAL_KEY, String(idOrNull));
  } catch {}
}

// ===== EX UI render =====
function cardName(id){
  return cardDefs?.[id]?.name || id;
}

function renderExUI(){
  if (!exLabelEl || !exPickBtn || !exClearBtn) return;

  if (!exCardId) {
    exLabelEl.innerHTML = `<span class="badge">ピンチ時のみ</span><br>未選択`;
    exClearBtn.disabled = true;
    return;
  }

  const def = cardDefs?.[exCardId] || null;
  const ok = def && isSupportCard(def);

  if (!ok) {
    exLabelEl.innerHTML = `<span class="badge">ピンチ時のみ</span><br><span style="color:#ff8080;">無効なEX（サポート以外）</span>`;
    exClearBtn.disabled = false;
    return;
  }

  const cost = (def?.cost != null) ? Number(def.cost) : "?";
  const eff = supportEffectTextJa(def.effect);
  exLabelEl.innerHTML =
    `<span class="badge">ピンチ時のみ</span><br>` +
    `EX: <b>${esc(cardName(exCardId))}</b>（cost:${esc(cost)}）<br>` +
    `<span class="small" style="opacity:.9;">${esc(eff)}</span>`;
  exClearBtn.disabled = false;
}

// =====================
// EX picker modal (dynamic)
// =====================
let exModalBackdrop = null;

function closeExModal(){
  if (exModalBackdrop) {
    try { exModalBackdrop.remove(); } catch {}
    exModalBackdrop = null;
  }
}

function openExModal(){
  // support cards only
  const supportIds = Object.keys(cardDefs || {}).filter(id => isSupportCard(cardDefs[id]));
  supportIds.sort((a,b)=>{
    const A = cardDefs[a] || {};
    const B = cardDefs[b] || {};
    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;
    return String(A.name || a).localeCompare(String(B.name || b), "ja");
  });

  // build modal
  closeExModal();

  const bd = document.createElement("div");
  bd.style.position = "fixed";
  bd.style.inset = "0";
  bd.style.background = "rgba(0,0,0,0.65)";
  bd.style.display = "flex";
  bd.style.alignItems = "center";
  bd.style.justifyContent = "center";
  bd.style.zIndex = "10000";

  const modal = document.createElement("div");
  modal.style.width = "min(920px, 92vw)";
  modal.style.maxHeight = "88vh";
  modal.style.background = "#1a1a1a";
  modal.style.border = "1px solid #444";
  modal.style.borderRadius = "16px";
  modal.style.overflow = "hidden";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.boxShadow = "0 20px 60px rgba(0,0,0,0.5)";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "10px";
  header.style.padding = "12px";
  header.style.borderBottom = "1px solid #333";
  header.innerHTML = `
    <div>
      <div class="small" style="opacity:.8;">EXカードを選択（サポートのみ）</div>
      <b>EXピッカー</b>
    </div>
    <div style="display:flex; gap:8px; align-items:center;">
      <input id="exSearch" placeholder="名前検索（例：回復）" style="padding:7px 10px; border-radius:10px; border:1px solid #666; background:#1b1b1b; color:#fff;" />
      <button id="exClose" style="cursor:pointer; padding:7px 10px; border-radius:10px; border:1px solid #666; background:#2b2b2b; color:#fff;">閉じる</button>
    </div>
  `;

  const body = document.createElement("div");
  body.style.overflow = "auto";
  body.style.padding = "12px";

  const list = document.createElement("div");

  const renderList = (q="")=>{
    list.innerHTML = "";
    const qq = String(q||"").trim().toLowerCase();

    const ids = supportIds.filter(id=>{
      if (!qq) return true;
      const nm = String(cardName(id)).toLowerCase();
      return nm.includes(qq);
    });

    if (!ids.length){
      list.innerHTML = `<div class="small" style="opacity:.85;">該当するサポートカードがありません</div>`;
      return;
    }

    for (const id of ids){
      const def = cardDefs[id] || {};
      const wrap = document.createElement("div");
      wrap.className = "card";
      wrap.style.margin = "10px 0";
      wrap.style.background = "#232323";

      const cost = (def?.cost != null) ? Number(def.cost) : "?";
      const eff = supportEffectTextJa(def.effect);

      wrap.innerHTML = `
        <div class="cardHead" style="align-items:flex-start;">
          <div>
            <b>【${esc(cost)}】 ${esc(cardName(id))} サポート</b>
            <div class="small">${esc(eff)}</div>
            ${id === exCardId ? `<div class="small" style="margin-top:6px; color:#ffd700;">✅ 選択中</div>` : ``}
          </div>
          <div class="btns">
            <button data-detail="${esc(id)}">詳細</button>
            <button data-pick="${esc(id)}" ${id === exCardId ? "disabled" : ""}>これをEXにする</button>
          </div>
        </div>
      `;

      wrap.querySelector("[data-detail]")?.addEventListener("click", ()=>{
        showCardDetail(id);
      });

      wrap.querySelector("[data-pick]")?.addEventListener("click", async ()=>{
        await setExCard(id);
        closeExModal();
      });

      list.appendChild(wrap);
    }
  };

  body.appendChild(list);
  modal.appendChild(header);
  modal.appendChild(body);
  bd.appendChild(modal);
  document.body.appendChild(bd);

  exModalBackdrop = bd;

  header.querySelector("#exClose")?.addEventListener("click", closeExModal);
  bd.addEventListener("click", (e)=>{
    if (e.target === bd) closeExModal();
  });

  const exSearch = header.querySelector("#exSearch");
  exSearch?.addEventListener("input", ()=> renderList(exSearch.value));

  renderList("");
  exSearch?.focus();
}

// ===== EX firestore save/load =====
async function setExCard(idOrNull){
  const next = idOrNull ? String(idOrNull) : null;

  // validate: must be support
  if (next) {
    const def = cardDefs?.[next];
    if (!def || !isSupportCard(def)) {
      setMsg("EXはサポートカードのみ選択できます", false);
      return;
    }
  }

  exCardId = next;
  saveLocalEx(exCardId);
  renderExUI();

  // persist immediately (best effort)
  try {
    await setDoc(playerRef(roomId, playerId), { exCardId: exCardId || null, updatedAt: serverTimestamp() }, { merge:true });
    setMsg("EXを保存しました。", true);
    setTimeout(() => setMsg("", true), 900);
  } catch (e) {
    console.warn("save ex failed", e);
    setMsg("EXの保存に失敗（ローカルはOK）", false);
  }
}

// =====================
// Deck ops
// =====================
function canAdd(cardId) {
  const total = sumDeck(deckMap);
  if (total >= DECK_SIZE) return { ok: false, reason: "20枚ちょうどにしてください" };
  const c = Number(deckMap[cardId] || 0);
  if (c >= MAX_SAME) return { ok: false, reason: "同名は最大4枚までです" };
  return { ok: true };
}
function addToDeck(cardId) {
  const chk = canAdd(cardId);
  if (!chk.ok) return setMsg(chk.reason, false);
  setMsg("", true);
  deckMap[cardId] = Number(deckMap[cardId] || 0) + 1;
  renderAll();
}
function removeFromDeck(cardId) {
  setMsg("", true);
  const c = Number(deckMap[cardId] || 0);
  if (c <= 0) return;
  const next = c - 1;
  if (next <= 0) delete deckMap[cardId];
  else deckMap[cardId] = next;
  renderAll();
}
function loadLocalDeck() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    return obj;
  } catch {
    return {};
  }
}
function saveLocalDeck() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(deckMap || {}));
    return true;
  } catch {
    return false;
  }
}
function setOpenType(type) {
  try { localStorage.setItem(OPEN_TYPE_KEY, String(type || "")); } catch {}
}
function getOpenType() {
  try { return localStorage.getItem(OPEN_TYPE_KEY) || ""; } catch { return ""; }
}

function loadName() {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
}
function saveName(name) {
  try { localStorage.setItem(NAME_KEY, String(name || "")); } catch {}
}
function askNameIfNeeded() {
  let name = loadName();
  if (!name) {
    name = prompt("ニックネームを入力してね（例：てらだ）", "")?.trim() || "";
    if (!name) name = "player";
    saveName(name);
  }
  return name;
}

// =====================
// v1.8.0: dataset hook
// =====================
function setTypeDataset(el, defOrType) {
  if (!el) return;
  const t = (typeof defOrType === "string")
    ? defOrType
    : displayType(defOrType);
  el.dataset.type = String(t || "");
}

// =====================
// Room TTL / Reset
// =====================
function expiresAtFromNow() {
  return Timestamp.fromMillis(Date.now() + ROOM_TTL_MS);
}
function isExpiredRoomDoc(roomDocData) {
  const exp = roomDocData?.expiresAt;
  if (!exp) return false;
  const expMs = (typeof exp.toMillis === "function") ? exp.toMillis() : null;
  if (!expMs) return false;
  return expMs < Date.now();
}

async function touchRoom(rid, extra = {}) {
  await setDoc(roomRef(rid), {
    lastActiveAt: serverTimestamp(),
    expiresAt: expiresAtFromNow(),
    ...extra,
  }, { merge: true });
}

async function resetRoomHardish(rid) {
  try {
    const ps = await getDocs(playersCol(rid));
    for (const d of ps.docs) await deleteDoc(d.ref);
  } catch (e) {
    console.warn("resetRoom: players delete failed", e);
  }

  try { await deleteDoc(matchRef(rid)); } catch {}
  try { await deleteDoc(stateRef(rid)); } catch {}
}

// =====================
// Data load
// =====================
async function loadCards() {
  const snap = await getDocs(collection(db, "cards"));
  const m = {};
  snap.forEach((d) => (m[d.id] = d.data()));
  cardDefs = m;

  // ソート：type → cost → name（supportは最後のtype扱い）
  cardIdsSorted = Object.keys(cardDefs).sort((a, b) => {
    const A = cardDefs[a] || {};
    const B = cardDefs[b] || {};
    const tA = displayType(A);
    const tB = displayType(B);

    // サポートを最後へ
    const aSup = (tA === "サポート");
    const bSup = (tB === "サポート");
    if (aSup !== bSup) return aSup ? 1 : -1;

    if (tA !== tB) return tA.localeCompare(tB, "ja");

    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;

    return String(A.name || a).localeCompare(String(B.name || b), "ja");
  });
}

async function loadDeckPreferFirestore(rid, pid) {
  // deck + exCardId
  try {
    const ps = await getDoc(playerRef(rid, pid));
    if (ps.exists()) {
      const d = ps.data() || {};
      const dm = d.deck || {};
      if (dm && typeof dm === "object" && !Array.isArray(dm)) {
        deckMap = dm;
      } else {
        deckMap = loadLocalDeck();
      }

      // ex
      const ex = d.exCardId || null;
      exCardId = ex ? String(ex) : (loadLocalEx() || null);
      return;
    }
  } catch (e) {
    console.warn("loadDeckPreferFirestore fallback to local", e);
  }

  deckMap = loadLocalDeck();
  exCardId = loadLocalEx() || null;
}

// =====================
// Detail（※ここは1回だけ定義！）
// =====================
function showCardDetail(cardId) {
  const d = cardDefs[cardId];
  if (!d) return;

  const t = displayType(d);

  let html = `<b>${esc(d.name || cardId)}</b> <span class="small">(${esc(cardId)})</span><br>`;
  html += `分類:${esc(t)} / コスト:${esc(d.cost)}<br>`;

  if (!isSupportCard(d)) {
    html += `HP:${esc(d.hp)} SP:${esc(d.sp)}<br><br>`;
  } else {
    html += `<br>`;
  }

  if (isSupportCard(d)) {
    html += `<b>サポート効果</b><br>`;
    html += `<div class="small">${esc(supportEffectTextJa(d.effect))}</div>`;
    detailEl.innerHTML = html;
    return;
  }

  const acts = d.actions || [];
  if (!acts.length) html += "行動なし";
  else {
    acts.forEach((a) => {
      const parts = [];
      if (a.dmg !== undefined) parts.push(`HP-${a.dmg}`);
      if (a.spDmg !== undefined) parts.push(`SP-${a.spDmg}`);
      if (a.draw !== undefined) parts.push(`ドロー+${a.draw}`);
      const effect = parts.length ? parts.join(" / ") : "効果";

      html += `【${esc(a.cost)}】${esc(a.name)}<br>`;
      html += `射程:${esc(a.range)} / 成功:${esc(a.rate)}%<br>`;
      html += `効果:${esc(effect)}<br><br>`;
    });
  }
  detailEl.innerHTML = html;
}

// =====================
// Filters
// =====================
function buildTypeOptions() {
  const types = new Set();
  let hasSupport = false;

  for (const id of Object.keys(cardDefs)) {
    const def = cardDefs[id];
    const t = displayType(def);
    if (t === "サポート") hasSupport = true;
    if (t) types.add(String(t));
  }

  typeSelect.innerHTML = `<option value="ALL">すべて</option>`;

  const arr = Array.from(types);
  const other = arr.filter(t => !TYPE_ORDER.includes(t) && t !== "サポート").sort((a,b)=>a.localeCompare(b,"ja"));
  const ordered = [
    ...TYPE_ORDER.filter(t => types.has(t)),
    ...other,
    ...(hasSupport ? ["サポート"] : [])
  ];

  ordered.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    typeSelect.appendChild(o);
  });
}

// =====================
// Render enable/disable（20枚判定の唯一の真実）
// =====================
function updatePlayButtons() {
  const total = sumDeck(deckMap);
  const ok = (total === DECK_SIZE);

  createBtn.disabled = !ok;
  joinBtn.disabled = !ok;

  // ★patch(3): EX保存などのメッセージを即上書きしない
  if (!ok) {
    if (!msgEl.textContent) setMsg("20枚ちょうどにしてください", false);
  } else {
    setMsg("", true);
  }
}

// =====================
// Render
// =====================
function renderDeck() {
  const total = sumDeck(deckMap);
  deckCountEl.textContent = String(total);

  deckListEl.innerHTML = "";
  const idsInDeck = Object.keys(deckMap).sort((a, b) => {
    const A = cardDefs[a] || {};
    const B = cardDefs[b] || {};
    const tA = displayType(A);
    const tB = displayType(B);

    const aSup = (tA === "サポート");
    const bSup = (tB === "サポート");
    if (aSup !== bSup) return aSup ? 1 : -1;

    if (tA !== tB) return tA.localeCompare(tB, "ja");

    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;

    return String(A.name || a).localeCompare(String(B.name || b), "ja");
  });

  idsInDeck.forEach((cardId) => {
    const def = cardDefs[cardId] || {};
    const cnt = Number(deckMap[cardId] || 0);

    const div = document.createElement("div");
    div.className = "card";
    setTypeDataset(div, def);

    const t = displayType(def);

    div.innerHTML = `
      <div class="cardHead">
        <div>
          <b>【${esc(def.cost)}】 ${esc(def.name || cardId)} ${esc(t)}</b>
          ${isSupportCard(def)
            ? `<div class="small">${esc(firstLine(def))}</div>`
            : `<div class="small">HP:${esc(def.hp)} / SP:${esc(def.sp)}</div>
               <div class="small">${esc(firstLine(def))}</div>`
          }
        </div>
        <div class="btns">
          <button data-minus="${esc(cardId)}">-</button>
          <div class="cnt">${cnt} 枚</div>
          <button data-plus="${esc(cardId)}">+</button>
          <button data-detail="${esc(cardId)}">詳細</button>
        </div>
      </div>
    `;
    div.querySelector("[data-minus]")?.addEventListener("click", () => removeFromDeck(cardId));
    div.querySelector("[data-plus]")?.addEventListener("click", () => addToDeck(cardId));
    div.querySelector("[data-detail]")?.addEventListener("click", () => showCardDetail(cardId));
    deckListEl.appendChild(div);
  });

  updatePlayButtons();
}

function renderCardSections() {
  cardSectionsEl.innerHTML = "";

  const nameQ = filterName.trim().toLowerCase();
  const matches = cardIdsSorted.filter((id) => {
    const def = cardDefs[id] || {};
    const t = displayType(def);

    if (filterType !== "ALL" && t !== filterType) return false;
    if (nameQ) {
      const nm = String(def.name || id).toLowerCase();
      if (!nm.includes(nameQ)) return false;
    }
    return true;
  });

  shownCountEl.textContent = String(matches.length);

  const byType = new Map();
  for (const id of matches) {
    const t = displayType(cardDefs[id]) || "その他";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(id);
  }

  const typesFound = Array.from(byType.keys());
  const other = typesFound.filter(t => !TYPE_ORDER.includes(t) && t !== "サポート").sort((a,b)=>a.localeCompare(b,"ja"));
  const ordered = [
    ...TYPE_ORDER.filter(t => byType.has(t)),
    ...other.filter(t => byType.has(t)),
    ...(byType.has("サポート") ? ["サポート"] : [])
  ];

  const openRemembered = getOpenType();
  const openAll = (filterType === "ALL");

  ordered.forEach((t) => {
    const ids = byType.get(t) || [];
    const wrap = document.createElement("details");
    setTypeDataset(wrap, t);

    wrap.open = openAll || (t === openRemembered) || (filterType === t);
    wrap.addEventListener("toggle", () => { if (wrap.open) setOpenType(t); });

    const info = typeInfo(t);
    const plus = info.plus.map(x => `＋${x}`).join(" / ");
    const minus = info.minus.map(x => `−${x}`).join(" / ");

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <div class="sumTop">
        <div>
          <div class="sumTitle">${esc(t)}</div>
          <div class="sumDesc">
            <span class="badge">${esc(plus)}</span>
            <span class="badge" style="margin-left:6px;">${esc(minus)}</span>
          </div>
        </div>
        <div class="sumRight">${ids.length}枚</div>
      </div>
    `;
    wrap.appendChild(summary);

    const inner = document.createElement("div");
    inner.className = "sectionInner";

    ids.forEach((cardId) => {
      const def = cardDefs[cardId] || {};
      const cnt = Number(deckMap[cardId] || 0);
      const dispT = displayType(def);

      const div = document.createElement("div");
      div.className = "card";
      setTypeDataset(div, def);

      const line = firstLine(def);

      div.innerHTML = `
        <div class="cardHead">
          <div>
            <b>【${esc(def.cost)}】 ${esc(def.name || cardId)} ${esc(dispT)}</b>
            ${isSupportCard(def)
              ? `<div class="small">${esc(line)}</div>`
              : `<div class="small">HP:${esc(def.hp)} / SP:${esc(def.sp)}</div>
                 <div class="small">${esc(line)}</div>`
            }
          </div>
          <div class="btns">
            <button data-minus="${esc(cardId)}" ${cnt <= 0 ? "disabled" : ""}>-</button>
            <div class="cnt">${cnt || 0} / ${MAX_SAME}</div>
            <button data-plus="${esc(cardId)}">+</button>
            <button data-detail="${esc(cardId)}">詳細</button>
          </div>
        </div>
      `;

      div.querySelector("[data-minus]")?.addEventListener("click", () => removeFromDeck(cardId));
      div.querySelector("[data-plus]")?.addEventListener("click", () => addToDeck(cardId));
      div.querySelector("[data-detail]")?.addEventListener("click", () => showCardDetail(cardId));

      inner.appendChild(div);
    });

    wrap.appendChild(inner);
    cardSectionsEl.appendChild(wrap);
  });

  if (!ordered.length) {
    cardSectionsEl.innerHTML = `<div class="small" style="opacity:0.85;">該当するカードがありません</div>`;
  }
}

function renderAll() {
  document.body.dataset.filterType = String(filterType || "ALL");
  document.body.dataset.searching = (filterName && filterName.trim()) ? "1" : "0";
  renderCardSections();
  renderDeck();
  renderExUI();
}

// =====================
// Save / Create / Join
// =====================
async function ensurePlayerDoc(rid, pid, name) {
  await setDoc(playerRef(rid, pid), {
    name: name || "player",
    deck: deckMap || {},
    exCardId: exCardId || null, // ★EXも保存
    ready: false,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

async function saveDeckOnly(rid, pid) {
  try {
    await setDoc(playerRef(rid, pid), {
      deck: deckMap || {},
      exCardId: exCardId || null, // ★EXも保存
      updatedAt: serverTimestamp()
    }, { merge: true });
    saveLocalDeck();
    saveLocalEx(exCardId);
    setMsg("保存しました。", true);
    setTimeout(() => setMsg("", true), 900);
  } catch (e) {
    console.error(e);
    saveLocalDeck();
    saveLocalEx(exCardId);
    setMsg("保存に失敗（ローカル保存はOK）", false);
  }
}

btnSave?.addEventListener("click", async () => {
  await saveDeckOnly(roomId, playerId);
});

createBtn?.addEventListener("click", async () => {
  const total = sumDeck(deckMap);
  if (total !== DECK_SIZE) return setMsg("20枚ちょうどにしてください", false);

  const name = askNameIfNeeded();

  roomId = newRoomCode4();
  playerId = newPlayerId();

  const p = new URLSearchParams(location.search);
  p.set("room", roomId);
  p.set("player", playerId);
  history.replaceState(null, "", `${location.pathname}?${p.toString()}`);

  // ★patch(1)
  syncRoomPlayerLabels();

  try {
    const rs = await getDoc(roomRef(roomId));
    if (rs.exists()) await resetRoomHardish(roomId);
  } catch {}

  await touchRoom(roomId, { createdAt: serverTimestamp() });
  await ensurePlayerDoc(roomId, playerId, name);

  saveLocalDeck();
  saveLocalEx(exCardId);
  location.href = `./battle.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
});

joinBtn?.addEventListener("click", async () => {
  const total = sumDeck(deckMap);
  if (total !== DECK_SIZE) return setMsg("20枚ちょうどにしてください", false);

  const name = askNameIfNeeded();

  const code = prompt("参加する部屋番号（4桁）を入力", "")?.trim() || "";
  if (!/^\d{4}$/.test(code)) return setMsg("部屋番号は4桁（例：1234）で入力してね", false);

  roomId = code;
  playerId = newPlayerId();

  const p = new URLSearchParams(location.search);
  p.set("room", roomId);
  p.set("player", playerId);
  history.replaceState(null, "", `${location.pathname}?${p.toString()}`);

  // ★patch(1)
  syncRoomPlayerLabels();

  try {
    const rs = await getDoc(roomRef(roomId));
    if (rs.exists()) {
      const d = rs.data() || {};
      if (isExpiredRoomDoc(d)) await resetRoomHardish(roomId);
    }
  } catch {}

  await touchRoom(roomId, { createdAt: serverTimestamp() });
  await ensurePlayerDoc(roomId, playerId, name);

  saveLocalDeck();
  saveLocalEx(exCardId);
  location.href = `./battle.html?room=${encodeURIComponent(roomId)}&player=${encodeURIComponent(playerId)}`;
});

// ランダムデッキ
randomDeckBtn?.addEventListener("click", () => {
  setMsg("", true);
  const ids = [...cardIdsSorted];
  if (!ids.length) return;

  const next = {};
  shuffleInPlace(ids);

  let guard = 9999;
  while (sumDeck(next) < DECK_SIZE && guard-- > 0) {
    for (const id of ids) {
      if (sumDeck(next) >= DECK_SIZE) break;
      const c = Number(next[id] || 0);
      if (c >= MAX_SAME) continue;
      next[id] = c + 1;
      if (sumDeck(next) >= DECK_SIZE) break;
    }
  }

  deckMap = next;
  renderAll();
  setMsg("ランダムデッキを作成しました（保存は「保存」ボタン）", true);
});

// =====================
// Filters events
// =====================
typeSelect.addEventListener("change", () => {
  filterType = typeSelect.value || "ALL";
  renderCardSections();
  document.body.dataset.filterType = String(filterType || "ALL");
});
searchEl.addEventListener("input", () => {
  filterName = searchEl.value || "";
  renderCardSections();
  document.body.dataset.searching = (filterName && filterName.trim()) ? "1" : "0";
});

// =====================
// EX events
// =====================
exPickBtn?.addEventListener("click", ()=>{
  // support cards only modal
  openExModal();
});

exClearBtn?.addEventListener("click", async ()=>{
  await setExCard(null);
});

// =====================
// Tutorial/Rule
// =====================
const tutorial = new TutorialSystem();

btnTutorial?.addEventListener("click", () => {
  tutorial.openMenu();
});

btnRule?.addEventListener("click", () => {
  location.href = `./rule.html`;
});

// =====================
// Boot
// =====================
syncRoomPlayerLabels();

await loadCards();
buildTypeOptions();

await loadDeckPreferFirestore(roomId, playerId);
renderAll();

touchRoom(roomId, { createdAt: serverTimestamp() }).catch(()=>{});