// public/deck_library.js
// v20260822_deck_meta1
// - UIを「保存（クラウド）」として整理（新規/更新が迷わない）
// - ボタン/カードを高級感寄りに（グラデ/立体/押し感）
// - 機能は維持（Firestore保存/公開/一覧/ロード/削除/検索）
// - UIは drawer 内の「デッキ保存(btnSave)」の下へ自動挿入（index.html改造不要）

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const LS_LAST_ID = "tcg_cloud_deck_last_id_v20260204";
const LS_LAST_VIS = "tcg_cloud_deck_last_vis_v20260204";
const LS_LAST_THEME = "tcg_cloud_deck_theme_v20260822";
const LS_DEVICEKEY = "tcg_cloud_device_key_v20260204";
const COMMUNITY_IMPORT_KEY = "tcg_community_deck_import_v20261005";
const DECK_LIST_PAGE_SIZE = 10;

function $(id) {
  return document.getElementById(id);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getOwnerUid() {
  try {
    return (localStorage.getItem("uid") || "").trim();
  } catch {
    return "";
  }
}

function isAdminUser() {
  try {
    return localStorage.getItem("isAdmin") === "1";
  } catch {
    return false;
  }
}

function fmtTime(ts) {
  try {
    const ms = ts?.toMillis?.() ?? (typeof ts === "number" ? ts : null);
    if (!ms) return "";
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

function safeJsonClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj ?? {}));
  } catch {
    return {};
  }
}

function sumDeck(deckMap) {
  let t = 0;
  for (const v of Object.values(deckMap || {})) {
    const n = Number(v || 0);
    if (Number.isFinite(n)) t += n;
  }
  return t;
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isDeckLibraryDoc(data = {}) {
  const type = String(data?.type || data?.docType || data?.kind || "").toLowerCase();
  const title = String(data?.title || "");
  if (type === "user_name_index") return false;
  if (
    type.includes("template") ||
    type.includes("skill") ||
    type.includes("action") ||
    type.includes("creator")
  ) {
    return false;
  }
  if (title.includes("\u6280\u30c6\u30f3\u30d7\u30ec")) return false;
  if (!isPlainObject(data?.deck)) return false;
  return sumDeck(data.deck) === 30;
}

function getLS(k) {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
}
function setLS(k, v) {
  try {
    localStorage.setItem(k, String(v || ""));
  } catch {}
}

function ensureDeviceKey() {
  let k = getLS(LS_DEVICEKEY);
  if (k) return k;
  try {
    k =
      crypto.randomUUID?.() ??
      "dev_" + Math.random().toString(16).slice(2) + Date.now();
  } catch {
    k = "dev_" + Math.random().toString(16).slice(2) + Date.now();
  }
  setLS(LS_DEVICEKEY, k);
  return k;
}

function visLabel(v) {
  if (v === "public") return "公開";
  if (v === "unlisted") return "限定公開";
  return "非公開";
}
function visBadgeClass(v) {
  if (v === "public") return "pub";
  if (v === "unlisted") return "unl";
  return "prv";
}

async function safeQueryDocs(q, fallbackQ = null) {
  try {
    const snap = await getDocs(q);
    return snap.docs;
  } catch (e) {
    if (fallbackQ) {
      const snap2 = await getDocs(fallbackQ);
      return snap2.docs;
    }
    throw e;
  }
}

function ensureStyle() {
  if (document.getElementById("deckLibStyle_v20260801_deck_manage1")) return;

  const css = `
  /* ===== Deck Library (Lux) ===== */
  .deckLibBox{
    margin-top: 14px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 18px;
    background: rgba(0,0,0,.20);
    overflow: hidden;
    box-shadow: 0 18px 60px rgba(0,0,0,.45);
    position: relative;
  }
  .deckLibBox::before{
    content:"";
    position:absolute;
    inset:-2px;
    background:
      radial-gradient(800px 240px at 18% 0%, rgba(105,180,255,.16), transparent 55%),
      radial-gradient(800px 240px at 86% 0%, rgba(120,255,170,.10), transparent 55%),
      radial-gradient(900px 420px at 60% 120%, rgba(160,120,255,.09), transparent 60%);
    pointer-events:none;
    opacity:.9;
  }

  .deckLibHd{
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    padding: 11px 12px;
    background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.18));
    border-bottom: 1px solid rgba(255,255,255,.10);
    position:relative;
    z-index:1;
  }
  .deckLibHd b{
    letter-spacing:.05em;
    font-weight: 950;
  }

  .deckLibBd{ padding: 12px; position:relative; z-index:1; }

  .deckLibModeTabs{
    display:grid;
    grid-template-columns:1fr;
    gap:8px;
    margin-bottom:12px;
    padding:4px;
    border:1px solid rgba(255,255,255,.10);
    border-radius:16px;
    background:rgba(0,0,0,.18);
  }
  .deckLibModeBtn{
    min-height:38px;
    border-radius:13px;
    border:1px solid transparent;
    background:transparent;
    color:rgba(255,255,255,.72);
    font-weight:950;
    cursor:pointer;
  }
  .deckLibModeBtn.active{
    border-color:rgba(105,180,255,.46);
    background:rgba(105,180,255,.16);
    color:#fff;
    box-shadow:0 10px 24px rgba(0,0,0,.24);
  }
  #deckLibModeSearch{ display:none !important; }
  .deckLibModePanel[hidden]{ display:none !important; }

  /* section */
  .deckLibSection{
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 16px;
    background: rgba(0,0,0,.18);
    overflow:hidden;
  }
  .deckLibSectionHd{
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    padding: 10px 10px;
    border-bottom: 1px solid rgba(255,255,255,.10);
    background: rgba(0,0,0,.22);
  }
  .deckLibSectionHd b{ font-size:12px; letter-spacing:.04em; opacity:.95; }
  .deckLibSectionBd{ padding: 10px; }

  .deckLibRow{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .deckLibRow .input{ flex: 1 1 180px; }
  .deckLibRow .btn, .deckLibRow .btnGhost{ white-space:nowrap; }

  .deckLibSub{
    margin: 8px 0 0;
    font-size: 12px;
    color: rgba(255,255,255,.62);
    line-height: 1.38;
    white-space: pre-wrap;
  }

  /* pills / badges */
  .deckLibPill{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(0,0,0,.16);
    font-size: 11px;
    color: rgba(255,255,255,.72);
  }
  .deckLibPill.cloud{
    border-color: rgba(105,180,255,.22);
    background: rgba(105,180,255,.10);
    color: rgba(220,240,255,.95);
  }
  .deckLibPill.hint{
    opacity:.85;
  }

  /* tabs */
  .deckLibTabs{ display:flex; gap:8px; flex-wrap:wrap; margin: 12px 0 10px; }
  .deckLibTab{
    border-radius: 999px;
    padding: 8px 12px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(0,0,0,.20);
    color:#fff;
    font-weight:950;
    cursor:pointer;
    user-select:none;
    font-size: 12px;
    transition: transform .08s ease, background .10s ease, border-color .10s ease;
  }
  .deckLibTab:hover{ background: rgba(255,255,255,.06); transform: translateY(-1px); }
  .deckLibTab.active{
    border-color: rgba(105,180,255,.55);
    background: rgba(105,180,255,.18);
    box-shadow: 0 10px 22px rgba(0,0,0,.25);
  }

  /* list */
  .deckLibList{
    display:flex;
    flex-direction:column;
    gap:10px;
    max-height: none;
    overflow-y:auto;
    overflow-x:hidden;
    padding-right:6px;
    min-width:0;
  }
  .deckLibList::-webkit-scrollbar{ width:10px; }
  .deckLibList::-webkit-scrollbar-thumb{
    background: rgba(255,255,255,.10);
    border: 3px solid rgba(0,0,0,0);
    background-clip: padding-box;
    border-radius: 999px;
  }

  .deckLibCard{
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 16px;
    background:
      linear-gradient(135deg, rgba(255,255,255,.045), rgba(255,255,255,.015)),
      rgba(0,0,0,.22);
    padding: 13px 13px 12px 16px;
    box-shadow: 0 12px 30px rgba(0,0,0,.30);
    position: relative;
    overflow:hidden;
    cursor:pointer;
    min-width:0;
  }
  .deckLibCard.isCompact{
    padding: 11px 10px 11px 14px;
    min-height: 52px;
    cursor:default;
  }
  .deckLibCard:hover{
    border-color:rgba(105,180,255,.34);
    background:
      linear-gradient(135deg, rgba(105,180,255,.06), rgba(120,255,190,.025)),
      rgba(0,0,0,.24);
  }
  .deckLibCard::before{
    content:"";
    position:absolute;
    left:0; top:0; bottom:0;
    width: 4px;
    background: rgba(105,180,255,.55);
    opacity:.8;
  }
  .deckLibCardTop{
    display:grid;
    grid-template-columns: minmax(0, 1fr);
    gap:12px;
    min-width:0;
  }
  .deckLibLine{
    display:grid;
    grid-template-columns:34px minmax(0,1fr) auto auto auto;
    gap:8px;
    align-items:center;
    min-width:0;
    min-height:36px;
  }
  .deckLibExpand{
    width:32px;
    height:32px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(0,0,0,.22);
    color:#fff;
    font-weight:950;
    cursor:pointer;
  }
  .deckLibTitleOne{
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-weight:950;
    font-size:14px;
    letter-spacing:0;
  }
  .deckLibDetails{
    margin-top:9px;
    padding-top:9px;
    border-top:1px solid rgba(255,255,255,.10);
  }
  .deckLibDetails[hidden]{ display:none !important; }
  .deckLibInfoBlock{
    min-width:0;
    display:grid;
    gap:8px;
  }
  .deckLibTitle{
    font-weight: 950;
    font-size: clamp(14px, 1.9vw, 17px);
    letter-spacing: 0;
    line-height: 1.35;
    overflow-wrap:anywhere;
    word-break: break-word;
  }
  .deckLibMeta{
    display:grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap:7px;
    font-size: 12px;
    color: rgba(255,255,255,.62);
    line-height: 1.35;
  }
  .deckLibMetaItem{
    min-width:0;
    padding:8px 9px;
    border-radius:11px;
    border:1px solid rgba(255,255,255,.09);
    background:rgba(0,0,0,.17);
  }
  .deckLibMetaItem b{
    display:block;
    margin-bottom:2px;
    font-size:10px;
    color:rgba(255,255,255,.48);
    letter-spacing:0;
    font-weight:800;
  }
  .deckLibMetaItem span{
    display:block;
    min-width:0;
    color:rgba(255,255,255,.82);
    font-size:12px;
    line-height:1.35;
    overflow-wrap:anywhere;
    word-break:break-word;
  }
  .deckLibMetaItem.deckLibWide{ grid-column:1 / -1; }
  .deckLibTags{
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    min-width:0;
  }
  .deckLibBtns{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    justify-content:stretch;
    align-items:center;
    min-width:0;
    position:relative;
    z-index:2;
  }
  .deckLibBtns .btn,
  .deckLibBtns .btnGhost{
    flex:1 1 120px;
    min-height:40px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
  }

  .deckLibBadge{
    display:inline-flex;
    align-items:center;
    gap:6px;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.16);
    font-size: 11px;
    color: rgba(255,255,255,.72);
    line-height:1.25;
    overflow-wrap:anywhere;
    word-break:break-word;
    max-width:100%;
  }
  .deckLibBadge.pub{ border-color: rgba(120,255,170,.35); background: rgba(120,255,170,.12); color: rgba(210,255,230,.95); }
  .deckLibBadge.unl{ border-color: rgba(105,180,255,.35); background: rgba(105,180,255,.12); color: rgba(220,240,255,.95); }
  .deckLibBadge.prv{ border-color: rgba(255,160,90,.35); background: rgba(255,160,90,.12); color: rgba(255,235,220,.95); }

  .deckLibWarn{
    margin-top:10px;
    font-size:12px;
    color: rgba(255, 120, 120, .92);
    white-space: pre-wrap;
    line-height: 1.35;
  }
  .deckLibOk{
    margin-top:10px;
    font-size:12px;
    color: rgba(120,255,170,.92);
    white-space: pre-wrap;
    line-height: 1.35;
  }
  .deckLibMini{
    font-size:12px;
    color: rgba(255,255,255,.60);
    margin-top:10px;
  }

  .deckLibPager{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    flex-wrap:wrap;
    margin:10px 0 2px;
    padding:8px;
    border:1px solid rgba(255,255,255,.10);
    border-radius:14px;
    background:rgba(0,0,0,.14);
  }
  .deckLibPagerBtn{
    min-width:36px;
    height:34px;
    padding:0 10px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(0,0,0,.22);
    color:rgba(255,255,255,.82);
    font-weight:950;
    cursor:pointer;
  }
  .deckLibPagerBtn.active{
    border-color:rgba(105,180,255,.55);
    background:rgba(105,180,255,.20);
    color:#fff;
    box-shadow:0 8px 18px rgba(0,0,0,.28);
  }
  .deckLibPagerBtn:disabled{
    opacity:.42;
    cursor:not-allowed;
  }
  .deckLibPagerInfo{
    flex:1 1 100%;
    text-align:center;
    font-size:11px;
    color:rgba(255,255,255,.58);
  }

  .deckLibSelect{
    border-radius:14px;
    border:1px solid rgba(255,255,255,.14);
    background: rgba(0,0,0,.25);
    color:#fff;
    padding: 10px 12px;
    font-size: 13px;
    outline:none;
    min-width: min(260px, 90vw);
  }
  .deckLibSelect:focus{ border-color: rgba(105,180,255,.62); box-shadow: 0 0 0 3px rgba(105,180,255,.12); }
  .deckLibColorWrap{
    display:grid;
    grid-template-columns:minmax(0,1fr) auto;
    align-items:center;
    gap:10px;
  }
  .deckLibColorWrap label{
    color:rgba(255,255,255,.72);
    font-size:12px;
    font-weight:800;
  }
  .deckLibColor{
    width:54px;
    height:42px;
    padding:4px;
    border:1px solid rgba(255,255,255,.16);
    border-radius:14px;
    background:rgba(0,0,0,.26);
    cursor:pointer;
  }

  @media (max-width: 720px){
    .deckLibBox{ border-radius:16px; }
    .deckLibBd{ padding:10px; }
    .deckLibLine{
      grid-template-columns:32px minmax(0,1fr) auto;
      grid-template-areas:
        "toggle title vis"
        ". load del";
    }
    .deckLibExpand{ grid-area:toggle; }
    .deckLibTitleOne{ grid-area:title; }
    .deckLibLine > .deckLibBadge{ grid-area:vis; }
    .deckLibLine [data-load]{ grid-area:load; }
    .deckLibLine [data-del]{ grid-area:del; }
    .deckLibLine .btn,
    .deckLibLine .btnGhost{
      width:100%;
      min-width:0;
    }
    .deckLibMeta{ grid-template-columns:1fr; }
  }

  /* Lux buttons (override existing .btn/.btnGhost inside deck library only) */
  .deckLibBox .btn, .deckLibBox .btnGhost{
    border-radius: 999px;
    padding: 10px 14px;
    font-weight: 950;
    letter-spacing: .01em;
    transition: transform .08s ease, filter .10s ease, background .10s ease, border-color .10s ease, box-shadow .12s ease;
  }
  .deckLibBox .btn{
    border: 1px solid rgba(105,180,255,.40);
    background: linear-gradient(180deg, rgba(105,180,255,.22), rgba(105,180,255,.12));
    box-shadow: 0 14px 34px rgba(0,0,0,.32);
  }
  .deckLibBox .btn:hover{
    filter: brightness(1.06);
    transform: translateY(-1px);
    border-color: rgba(105,180,255,.60);
    box-shadow: 0 18px 44px rgba(0,0,0,.40);
  }
  .deckLibBox .btn:active{
    transform: translateY(0px) scale(.99);
  }

  .deckLibBox .btnGhost{
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(0,0,0,.22);
  }
  .deckLibBox .btnGhost:hover{
    background: rgba(255,255,255,.07);
    transform: translateY(-1px);
  }
  .deckLibBox .btnGhost:active{
    transform: translateY(0px) scale(.99);
  }
  .deckLibBox .btn:disabled,
  .deckLibBox .btnGhost:disabled{
    opacity: .45;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
    filter: none;
  }

  /* save buttons layout */
  .deckLibSaveBtns{
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    align-items:center;
  }
  .deckLibSaveBtns .btn,
  .deckLibSaveBtns .btnGhost{
    flex: 1 1 160px;
  }

  @media (max-width: 520px){
    .deckLibBd{ padding:10px; }
    .deckLibCard{ padding:12px 10px 12px 14px; }
    .deckLibMeta{ grid-template-columns:1fr; }
    .deckLibBtns .btn,
    .deckLibBtns .btnGhost{
      flex:1 1 100%;
    }
    .deckLibSaveBtns .btn,
    .deckLibSaveBtns .btnGhost{
      flex: 1 1 100%;
    }
    .deckLibSelect{ width: 100%; }
    .deckLibLine{
      grid-template-columns:32px minmax(0,1fr) auto;
      grid-template-areas:
        "toggle title badge"
        "load load del";
    }
    .deckLibExpand{ grid-area:toggle; }
    .deckLibTitleOne{ grid-area:title; }
    .deckLibLine > .deckLibBadge{ grid-area:badge; }
    .deckLibLine > [data-load]{ grid-area:load; }
    .deckLibLine > [data-del]{ grid-area:del; }
  }
  `;

  const style = document.createElement("style");
  style.id = "deckLibStyle_v20260801_deck_manage1";
  style.textContent = css;
  document.head.appendChild(style);
}

function findSaveRow() {
  const btnSave = $("btnSave");
  if (!btnSave) return null;
  return btnSave.closest(".roomRow") || btnSave.parentElement;
}

export function initDeckLibrary(opts) {
  ensureStyle();

  const {
    db,
    getSnapshot, // () => { title, deck, exSupport, desiredField }
    applySnapshot, // (snap) => void
    getPlayerName, // () => string
    getCardDefs, // () => cardDefs map (optional)
    deckTitleInputId = "deckTitle",
  } = opts || {};

  if (
    !db ||
    typeof getSnapshot !== "function" ||
    typeof applySnapshot !== "function"
  ) {
    console.warn("deck_library(noauth): missing required callbacks");
    return;
  }

  const deviceKey = ensureDeviceKey();

  const saveRow = findSaveRow();
  if (!saveRow) {
    console.warn("deck_library(noauth): save row not found");
    return;
  }

  // UI 挿入
  let box = document.getElementById("deckLibBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "deckLibBox";
    box.className = "deckLibBox";
    box.innerHTML = `
      <div class="deckLibHd">
        <b>クラウド管理</b>
        <span class="deckLibPill cloud">Cloud</span>
      </div>

      <div class="deckLibBd">
        <div class="deckLibModeTabs" role="tablist" aria-label="クラウドデッキ操作">
          <button id="deckLibModeSave" class="deckLibModeBtn active" type="button">保存する</button>
          <button id="deckLibModeSearch" class="deckLibModeBtn" type="button" hidden>読み込む</button>
        </div>

        <div class="deckLibSection deckLibModePanel" id="deckLibSavePanel">
          <div class="deckLibSectionHd">
            <b>保存設定</b>
            <span class="deckLibPill hint" id="deckLibLastHint">未保存</span>
          </div>
          <div class="deckLibSectionBd">

            <div class="deckLibRow" style="margin-bottom:10px;">
              <select id="deckLibVis" class="deckLibSelect" title="公開範囲">
                <option value="public">公開（みんなに表示）</option>
                <option value="unlisted">限定公開（ID知ってる人）</option>
                <option value="private">非公開（自分だけ）</option>
              </select>
              <div class="deckLibColorWrap">
                <label for="deckLibThemeColor">テーマカラー</label>
                <input id="deckLibThemeColor" class="deckLibColor" type="color" value="#70c7ff" title="デッキのテーマカラー" />
              </div>
            </div>

            <div class="deckLibSaveBtns">
              <button id="deckLibUploadNew" class="btn" type="button">新規として保存</button>
              <button id="deckLibUploadOverwrite" class="btnGhost" type="button" title="最後に保存したクラウドデッキを更新">このデッキを更新</button>
              <button id="deckLibOpenOwnDecks" class="btnGhost" type="button">自分のデッキを見る</button>
            </div>

            <div class="deckLibSub">
・新規：別スロットとして保存（IDが新しくなる）
・更新：最後に保存したクラウドデッキ（同じID）を上書き
・クラウド保存は最大10件 / 「30枚ちょうど」のデッキのみ対応
・ロードと削除は「自分のデッキ」画面で管理
            </div>
          </div>
        </div>

        <div class="deckLibModePanel" id="deckLibSearchPanel" hidden>
        <div class="deckLibTabs">
          <button id="deckLibTabMy" class="deckLibTab active" type="button">自分のデッキ</button>
          <button id="deckLibTabAll" class="deckLibTab" type="button">みんなのデッキ</button>
        </div>

        <div class="deckLibRow" style="margin-bottom:10px;">
          <input id="deckLibSearch" class="input" placeholder="検索（タイトル/作者/タグ/ID）" />
          <button id="deckLibRefresh" class="btnGhost" type="button">更新</button>
        </div>

        <div id="deckLibInfo" class="deckLibMini"></div>
        <div id="deckLibList" class="deckLibList"></div>
        <div id="deckLibPager" class="deckLibPager" style="display:none;"></div>
        </div>

        <div id="deckLibMsgOk" class="deckLibOk" style="display:none;"></div>
        <div id="deckLibMsgNg" class="deckLibWarn" style="display:none;"></div>

        <div class="deckLibMini" style="opacity:.78;">
          ownerKey: ${esc(deviceKey)}
        </div>
      </div>
    `;
    saveRow.insertAdjacentElement("afterend", box);
  }

  const elVis = $("deckLibVis");
  const elThemeColor = $("deckLibThemeColor");
  const btnNew = $("deckLibUploadNew");
  const btnOw = $("deckLibUploadOverwrite");
  const btnOwnDecks = $("deckLibOpenOwnDecks");
  const modeSave = $("deckLibModeSave");
  const modeSearch = $("deckLibModeSearch");
  const savePanel = $("deckLibSavePanel");
  const searchPanel = $("deckLibSearchPanel");
  const tabMy = $("deckLibTabMy");
  const tabAll = $("deckLibTabAll");
  const inputQ = $("deckLibSearch");
  const btnRef = $("deckLibRefresh");
  const listEl = $("deckLibList");
  const pagerEl = $("deckLibPager");
  const infoEl = $("deckLibInfo");
  const msgOk = $("deckLibMsgOk");
  const msgNg = $("deckLibMsgNg");
  const lastHint = $("deckLibLastHint");
  let lastDocs = [];
  let lastMode = "my";
  let listPage = 1;

  function setOk(t) {
    if (!msgOk) return;
    msgOk.style.display = t ? "" : "none";
    msgOk.textContent = t || "";
  }
  function setNg(t) {
    if (!msgNg) return;
    msgNg.style.display = t ? "" : "none";
    msgNg.textContent = t || "";
  }

  function setLibraryMode(mode) {
    const isSearch = mode === "search";
    modeSave?.classList.toggle("active", !isSearch);
    modeSearch?.classList.toggle("active", isSearch);
    if (savePanel) savePanel.hidden = isSearch;
    if (searchPanel) searchPanel.hidden = !isSearch;
    box.dataset.libraryMode = isSearch ? "search" : "save";
    if (isSearch) refreshList().catch(() => {});
  }

  function updateOverwriteState() {
    const lastId = getLS(LS_LAST_ID);
    if (btnOw) {
      btnOw.disabled = !lastId;
      btnOw.title = lastId
        ? `最後に保存したクラウドデッキを更新（ID:${lastId}）`
        : "上書き先がありません（先に「新規として保存」をしてください）";
    }
    if (lastHint) {
      lastHint.textContent = lastId ? `更新先ID: ${lastId}` : "未保存";
    }
  }

  // vis restore
  if (elVis) {
    const last = getLS(LS_LAST_VIS);
    if (last) elVis.value = last;
    elVis.addEventListener("change", () => setLS(LS_LAST_VIS, elVis.value));
  }
  if (elThemeColor) {
    const last = getLS(LS_LAST_THEME);
    if (/^#[0-9a-f]{6}$/i.test(last)) elThemeColor.value = last;
    elThemeColor.addEventListener("input", () =>
      setLS(LS_LAST_THEME, elThemeColor.value),
    );
  }

  const deckTitleInput =
    $(deckTitleInputId) || $("deckName") || $("deckTitle") || null;
  function pickTitle() {
    const v = String(deckTitleInput?.value || "").trim();
    if (v) return v.slice(0, 32);
    return "無題デッキ";
  }

  function computeTagsFromDeck(deckMap) {
    const defs = typeof getCardDefs === "function" ? getCardDefs() || {} : null;
    if (!defs) return [];
    const counts = new Map();
    for (const [id, n] of Object.entries(deckMap || {})) {
      const c = Number(n || 0);
      if (!c) continue;
      const t = String(defs[id]?.type || "").trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + c);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([t]) => t);
  }

  function deckDocPayload({
    title,
    deck,
    exSupport,
    desiredField,
    visibility,
    ownerName,
    themeColor,
  }) {
    const tags = computeTagsFromDeck(deck);
    const ownerUid = getOwnerUid();
    const admin = isAdminUser();

    return {
      type: "deck",
      docType: "deck",
      title: title || "無題デッキ",
      deck: safeJsonClone(deck || {}),
      exSupport: String(exSupport || ""),
      desiredField: String(desiredField || ""),
      deckSize: sumDeck(deck || {}),
      tags,
      visibility: visibility || "public",
      themeColor: themeColor || "#70c7ff",

      // 主所有者
      ownerUid: ownerUid || "",
      ownerName: ownerName || "player",
      isAdminOwner: admin,

      // 旧互換
      ownerKey: deviceKey,

      updatedAt: serverTimestamp(),
    };
  }
  function setTab(which) {
    const isMy = which === "my";
    tabMy?.classList.toggle("active", isMy);
    tabAll?.classList.toggle("active", !isMy);
    box.dataset.mode = isMy ? "my" : "all";
    listPage = 1;
    if (box.dataset.libraryMode === "search") refreshList().catch(() => {});
  }

async function countMyDecks() {
  const decksCol = collection(db, "decks");
  const ownerUid = getOwnerUid();

  let docs = [];
  if (ownerUid) {
    const q1 = query(decksCol, where("ownerUid", "==", ownerUid), limit(100));
    docs = docs.concat(await safeQueryDocs(q1));
  }
  const q2 = query(decksCol, where("ownerKey", "==", deviceKey), limit(100));
  docs = docs.concat(await safeQueryDocs(q2).catch(() => []));

  const seen = new Map();
  docs.forEach((d) => seen.set(d.id, { id: d.id, data: d.data() || {} }));
  const items = Array.from(seen.values());
  const realDeckItems = items.filter((it) => isDeckLibraryDoc(it.data));
  const total = realDeckItems.length;
  const publicCount = realDeckItems.filter(
    (it) => String(it.data.visibility || "") === "public",
  ).length;

  return { total, publicCount, items: realDeckItems };
}

  tabMy?.addEventListener("click", () => setTab("my"));
  tabAll?.addEventListener("click", () => setTab("all"));
  modeSave?.addEventListener("click", () => setLibraryMode("save"));
  modeSearch?.addEventListener("click", () => setLibraryMode("search"));
  btnOwnDecks?.addEventListener("click", () => {
    const url = new URL("./deck_list.html", location.href);
    const room = new URLSearchParams(location.search).get("room") || "";
    const player = new URLSearchParams(location.search).get("player") || "";
    if (room) url.searchParams.set("room", room);
    if (player) url.searchParams.set("player", player);
    location.href = url.href;
  });
  window.addEventListener("tcg:deckLibraryOpen", (ev) => {
    const detail = ev?.detail || {};
    if (detail.tab === "all") setTab("all");
    if (detail.tab === "my") setTab("my");
    if (detail.mode === "search") setLibraryMode("search");
    if (detail.mode === "save") setLibraryMode("save");
  });
  btnRef?.addEventListener("click", () => {
    listPage = 1;
    refreshList().catch(() => {});
  });

  async function refreshList() {
    if (!listEl) return;
    setOk("");
    setNg("");

    const mode = box.dataset.mode === "all" ? "all" : "my";
    lastMode = mode;

    listEl.innerHTML = `<div class="small" style="opacity:.85;">読み込み中…</div>`;
    if (infoEl) infoEl.textContent = "";
    if (pagerEl) pagerEl.style.display = "none";

    const decksCol = collection(db, "decks");

    let docs = [];
    try {
      if (mode === "my") {
        const ownerUid = getOwnerUid();

        if (ownerUid) {
          const q1 = query(
            decksCol,
            where("ownerUid", "==", ownerUid),
            orderBy("updatedAt", "desc"),
            limit(50),
          );
          const qFallback = query(
            decksCol,
            where("ownerUid", "==", ownerUid),
            limit(50),
          );
          docs = await safeQueryDocs(q1, qFallback);
        } else {
          const q1 = query(
            decksCol,
            where("ownerKey", "==", deviceKey),
            orderBy("updatedAt", "desc"),
            limit(50),
          );
          const qFallback = query(
            decksCol,
            where("ownerKey", "==", deviceKey),
            limit(50),
          );
          docs = await safeQueryDocs(q1, qFallback);
        }
      } else {
        const q1 = query(
          decksCol,
          where("visibility", "==", "public"),
          orderBy("updatedAt", "desc"),
          limit(50),
        );
        const qFallback = query(
          decksCol,
          where("visibility", "==", "public"),
          limit(50),
        );
        docs = await safeQueryDocs(q1, qFallback);
      }
    } catch (e) {
      console.error(e);
      listEl.innerHTML = `<div class="small" style="opacity:.85;">読み込みに失敗しました</div>`;
      setNg(`一覧取得に失敗：${e?.message || e}`);
      return;
    }

    lastDocs = docs
      .map((d) => ({ id: d.id, data: d.data() || {} }))
      .filter((it) => isDeckLibraryDoc(it.data));
    renderList();
    updateOverwriteState();
  }

  function matchQuery(item, q) {
    if (!q) return true;
    const d = item.data || {};
    const hay = [
      d.title,
      d.ownerName,
      (d.tags || []).join(" "),
      d.visibility,
      item.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderList() {
    if (!listEl) return;
    const q = String(inputQ?.value || "").trim();
    const filtered = lastDocs.filter((it) => matchQuery(it, q));
    const totalPages = Math.max(1, Math.ceil(filtered.length / DECK_LIST_PAGE_SIZE));
    listPage = Math.max(1, Math.min(listPage, totalPages));
    const start = (listPage - 1) * DECK_LIST_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + DECK_LIST_PAGE_SIZE);

    const mode = lastMode;
    if (infoEl) {
      infoEl.textContent =
        mode === "my"
          ? `自分のデッキ：${filtered.length}件（${listPage}/${totalPages}ページ）`
          : `公開デッキ：${filtered.length}件（${listPage}/${totalPages}ページ）`;
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="small" style="opacity:.85;">デッキがありません</div>`;
      if (pagerEl) {
        pagerEl.innerHTML = "";
        pagerEl.style.display = "none";
      }
      return;
    }

    listEl.innerHTML = "";
    renderPager(filtered.length, totalPages);
    for (const it of pageItems) {
      const d = it.data || {};
      const title = String(d.title || "無題デッキ");
      const owner = String(d.ownerName || "player");
      const vis = String(d.visibility || "public");
      const updated = fmtTime(d.updatedAt) || fmtTime(d.createdAt) || "";
      const size = Number(d.deckSize || 0) || sumDeck(d.deck || {});
      const tagHtml = (d.tags || [])
        .slice(0, 4)
        .map((t) => `<span class="deckLibBadge">${esc(t)}</span>`)
        .join("");
      const tags = tagHtml || `<span class="deckLibBadge">タグなし</span>`;
      const visibilityBadge = `<span class="deckLibBadge ${visBadgeClass(vis)}">${esc(visLabel(vis))}</span>`;

      const canDelete = mode === "my" || isAdminUser();

      const card = document.createElement("div");
      card.className = "deckLibCard isCompact";
      card.innerHTML = `
        <div class="deckLibLine">
          <button class="deckLibExpand" data-toggle="${esc(it.id)}" type="button" aria-expanded="false" title="詳細を開く">⌄</button>
          <div class="deckLibTitleOne" title="${esc(title)}">${esc(title)}</div>
          ${visibilityBadge}
          <button class="btn" data-load="${esc(it.id)}" type="button">ロード</button>
          ${canDelete ? `<button class="btnGhost" data-del="${esc(it.id)}" type="button">削除</button>` : ``}
        </div>
        <div class="deckLibDetails" data-details="${esc(it.id)}" hidden>
            <div class="deckLibMeta">
              <div class="deckLibMetaItem"><b>公開</b><span>${visibilityBadge}</span></div>
              <div class="deckLibMetaItem"><b>枚数</b><span>${esc(size)} / 30</span></div>
              <div class="deckLibMetaItem"><b>作者</b><span>${esc(owner)}</span></div>
              <div class="deckLibMetaItem"><b>更新</b><span>${updated ? esc(updated) : "不明"}</span></div>
              <div class="deckLibMetaItem deckLibWide"><b>ID</b><span>${esc(it.id)}</span></div>
              <div class="deckLibMetaItem deckLibWide"><b>タグ</b><div class="deckLibTags">${tags}</div></div>
            </div>
        </div>
      `;

      const loadDeck = async () => {
          setOk("");
          setNg("");
          try {
            const ref = doc(db, "decks", it.id);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
              setNg("デッキが見つかりませんでした");
              return;
            }
            const data = snap.data() || {};
            if (!isDeckLibraryDoc(data)) {
              setNg("これはデッキデータではありません。デッキ保存/ロード欄からは読み込めません。");
              return;
            }
            const deck = data.deck || {};
            const exSupport = String(data.exSupport || "");
            const desiredField = String(data.desiredField || "");
            const t = String(data.title || "");

            applySnapshot({ title: t, deck, exSupport, desiredField });

            if (deckTitleInput && t) deckTitleInput.value = t;
            setOk(`ロードしました：${t || it.id}`);
          } catch (e) {
            console.error(e);
            setNg(`ロードに失敗：${e?.message || e}`);
          }
        };

      card.querySelector("[data-load]")?.addEventListener("click", (e) => {
        e.stopPropagation?.();
        loadDeck();
      });
      card.querySelector("[data-toggle]")?.addEventListener("click", (e) => {
        e.stopPropagation?.();
        const btn = e.currentTarget;
        const details = card.querySelector("[data-details]");
        const nextOpen = details?.hidden !== false;
        if (details) details.hidden = !nextOpen;
        btn?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        if (btn) btn.textContent = nextOpen ? "⌃" : "⌄";
      });

      card
        .querySelector("[data-del]")
        ?.addEventListener("click", async (e) => {
          e.stopPropagation?.();
          setOk("");
          setNg("");
          if (!confirm(`削除しますか？\n${title}\nID:${it.id}`)) return;
          try {
            await deleteDoc(doc(db, "decks", it.id));
            setOk("削除しました");
            if (getLS(LS_LAST_ID) === it.id) setLS(LS_LAST_ID, "");
            await refreshList();
          } catch (e) {
            console.error(e);
            setNg(`削除に失敗：${e?.message || e}`);
          }
        });

      listEl.appendChild(card);
    }
  }

  function renderPager(total, totalPages) {
    if (!pagerEl) return;
    if (totalPages <= 1) {
      pagerEl.innerHTML = "";
      pagerEl.style.display = "none";
      return;
    }

    const from = (listPage - 1) * DECK_LIST_PAGE_SIZE + 1;
    const to = Math.min(total, listPage * DECK_LIST_PAGE_SIZE);
    const buttons = [
      `<button class="deckLibPagerBtn" data-page="${listPage - 1}" ${listPage <= 1 ? "disabled" : ""} type="button">前</button>`,
    ];
    for (let p = 1; p <= totalPages; p++) {
      buttons.push(
        `<button class="deckLibPagerBtn ${p === listPage ? "active" : ""}" data-page="${p}" type="button">${p}</button>`,
      );
    }
    buttons.push(
      `<button class="deckLibPagerBtn" data-page="${listPage + 1}" ${listPage >= totalPages ? "disabled" : ""} type="button">次</button>`,
    );

    pagerEl.innerHTML = `
      <div class="deckLibPagerInfo">${from}-${to} / ${total}件を表示</div>
      ${buttons.join("")}
    `;
    pagerEl.style.display = "";
    pagerEl.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = Number(btn.getAttribute("data-page") || "1");
        if (!Number.isFinite(next) || next === listPage) return;
        listPage = Math.max(1, Math.min(next, totalPages));
        renderList();
      });
    });
  }

  inputQ?.addEventListener("input", () => {
    listPage = 1;
    renderList();
  });

async function uploadDeck({ overwrite }) {
  setOk("");
  setNg("");

  const snap = getSnapshot();
  const deck = snap?.deck || {};
  const exSupport = String(snap?.exSupport || "");
  const desiredField = String(snap?.desiredField || "");
  const title = String(snap?.title || pickTitle()).trim() || "無題デッキ";
  const visibility = String(elVis?.value || "public");
  const themeColor = /^#[0-9a-f]{6}$/i.test(String(elThemeColor?.value || ""))
    ? String(elThemeColor.value)
    : "#70c7ff";

  const size = sumDeck(deck);
  if (size !== 30) {
    setNg("クラウド保存は「30枚ちょうど」のデッキだけに対応しています");
    return;
  }

  const ownerName = String(getPlayerName?.() || "player").trim() || "player";
  const admin = isAdminUser();

  try {
    const decksCol = collection(db, "decks");

    const { total, publicCount } = await countMyDecks();

    if (!overwrite && total >= 10) {
      setNg("クラウド保存は最大10件までです。不要なデッキを削除してください。");
      return;
    }

    // 公開数だけ一般ユーザーに制限
    if (!admin) {
      if (visibility === "public") {
        const lastId = getLS(LS_LAST_ID);
        const overwriteToPublic = overwrite && !!lastId;

        if (!overwriteToPublic && publicCount >= 3) {
          setNg("一般ユーザーが公開できるデッキは3件までです。公開中デッキを非公開化または削除してください。");
          return;
        }

        if (overwriteToPublic && lastId) {
          const currentRef = doc(db, "decks", lastId);
          const currentSnap = await getDoc(currentRef);
          const currentData = currentSnap.exists() ? currentSnap.data() || {} : {};
          const wasPublic = String(currentData.visibility || "") === "public";

          if (!wasPublic && publicCount >= 3) {
            setNg("一般ユーザーが公開できるデッキは3件までです。公開中デッキを非公開化または削除してください。");
            return;
          }
        }
      }
    }

    if (overwrite) {
      const lastId = getLS(LS_LAST_ID);
      if (!lastId) {
        setNg("上書き先がありません（先に「新規として保存」をしてください）");
        updateOverwriteState();
        return;
      }
      const ref = doc(db, "decks", lastId);
      await setDoc(
        ref,
        deckDocPayload({
          title,
          deck,
          exSupport,
          desiredField,
          visibility,
          ownerName,
          themeColor,
        }),
        { merge: true },
      );
      setOk(`更新しました：${title}\nID:${lastId}`);
    } else {
      const payload = deckDocPayload({
        title,
        deck,
        exSupport,
        desiredField,
        visibility,
        ownerName,
        themeColor,
      });
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(decksCol, payload);
      setLS(LS_LAST_ID, ref.id);
      setOk(`新規保存しました：${title}\nID:${ref.id}`);
    }

    updateOverwriteState();
    setTab("my");
    setLibraryMode("save");
  } catch (e) {
    console.error(e);
    setNg(`保存に失敗：${e?.message || e}`);
    updateOverwriteState();
  }
}

  btnNew?.addEventListener("click", () => uploadDeck({ overwrite: false }));
  btnOw?.addEventListener("click", () => uploadDeck({ overwrite: true }));

  // Main "デッキ保存" should clone an imported community deck into a new personal slot.
  // Normal personal-deck edits keep their existing behavior and are not duplicated.
  let communityImportSaveBusy = false;
  const mainDeckSaveBtn = $("btnSave");
  mainDeckSaveBtn?.addEventListener("click", () => {
    let marker = null;
    try {
      const raw = sessionStorage.getItem(COMMUNITY_IMPORT_KEY) || "";
      marker = raw ? JSON.parse(raw) : null;
    } catch {}
    if (!marker?.sourceId || communityImportSaveBusy) return;

    communityImportSaveBusy = true;
    // Force new-save semantics even if an old/stale cloud id survived elsewhere.
    setLS(LS_LAST_ID, "");

    setTimeout(async () => {
      try {
        await uploadDeck({ overwrite: false });
        const newId = getLS(LS_LAST_ID);
        if (newId && newId !== String(marker.sourceId)) {
          try { sessionStorage.removeItem(COMMUNITY_IMPORT_KEY); } catch {}
          updateOverwriteState();
        }
      } finally {
        communityImportSaveBusy = false;
      }
    }, 0);
  });

  // 初期表示
  setTab("my");
  setLibraryMode("save");
  updateOverwriteState();
}
