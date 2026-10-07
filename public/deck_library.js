// public/deck_library.js
// v20261008_guest_save_limit2
// Single-save UI + guest 2-deck / registered 10-deck cloud save + copy-safe overwrite semantics.

import { initDeckLibrary as initDeckLibraryCore } from "./deck_library_core_20261005.js?v=20260822_deck_meta1";
import { ensureSignedIn } from "./auth.js?v=20260627_perm1";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const LS_LAST_ID = "tcg_cloud_deck_last_id_v20260204";
const LS_LAST_VIS = "tcg_cloud_deck_last_vis_v20260204";
const LS_LAST_THEME = "tcg_cloud_deck_theme_v20260822";
const LS_DEVICEKEY = "tcg_cloud_device_key_v20260204";
const LS_COPY_SOURCE_ID = "tcg_cloud_deck_copy_source_id_v20261005";
const LOCAL_KEY = "tcg_deck_local_v20260202_30";
const DECK_TITLE_KEY = "tcg_deck_title_v20260204";
const EX_KEY = "tcg_ex_support_v20260202_30";
const FIELD_KEY = "tcg_desired_field_v20260702";
const FIX_STATE_KEY = "__tcgDeckUnifiedSave20261006";

function getLS(key) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }
function setLS(key, value) { try { localStorage.setItem(key, String(value ?? "")); } catch {} }
function removeLS(key) { try { localStorage.removeItem(key); } catch {} }
function safeClone(v) { try { return JSON.parse(JSON.stringify(v ?? {})); } catch { return {}; } }
function sumDeck(deck) {
  return Object.values(deck || {}).reduce((n, v) => n + (Number(v) || 0), 0);
}
function deviceKey() {
  let key = getLS(LS_DEVICEKEY);
  if (key) return key;
  try { key = crypto.randomUUID?.() || `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  catch { key = `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
  setLS(LS_DEVICEKEY, key);
  return key;
}
function isProfileLinked() {
  return getLS("profileLinked") === "1" && !!getLS("uid");
}
function sharedState() {
  if (!window[FIX_STATE_KEY]) {
    window[FIX_STATE_KEY] = {
      pendingLoad: null,
      captureInstalled: false,
      unifiedInstalled: false,
      saving: false,
    };
  }
  return window[FIX_STATE_KEY];
}
function currentLibraryMode() {
  return document.getElementById("deckLibBox")?.dataset?.mode === "all" ? "all" : "my";
}
function setMsg(text, ok = true) {
  const host = document.getElementById("deckUnifiedSaveMessage");
  if (host) {
    host.textContent = text || "";
    host.classList.toggle("bad", !ok);
  }
  const oldOk = document.getElementById("deckLibMsgOk");
  const oldNg = document.getElementById("deckLibMsgNg");
  if (oldOk) { oldOk.textContent = ok ? (text || "") : ""; oldOk.style.display = "none"; }
  if (oldNg) { oldNg.textContent = ok ? "" : (text || ""); oldNg.style.display = "none"; }
}
function saveLocalSnapshot(snap = {}) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(safeClone(snap.deck || {})));
    localStorage.setItem(DECK_TITLE_KEY, String(snap.title || ""));
    localStorage.setItem(EX_KEY, String(snap.exSupport || ""));
    if (snap.desiredField) localStorage.setItem(FIELD_KEY, String(snap.desiredField));
  } catch {}
}
async function ownDeckCount(db, uid) {
  try {
    const snap = await getDocs(query(collection(db, "decks"), where("ownerUid", "==", uid), limit(20)));
    return snap.size;
  } catch {
    return 0;
  }
}
function makePayload(opts, snap, uid, size) {
  const visibility = String(document.getElementById("deckLibVis")?.value || getLS(LS_LAST_VIS) || "private");
  const themeColor = String(document.getElementById("deckLibThemeColor")?.value || getLS(LS_LAST_THEME) || "#70c7ff");
  const titleInput = document.getElementById(opts.deckTitleInputId || "deckTitle");
  const title = String(titleInput?.value || snap.title || "無題デッキ").trim().slice(0, 32) || "無題デッキ";
  return {
    docType: "deck",
    title,
    deck: safeClone(snap.deck || {}),
    exSupport: String(snap.exSupport || ""),
    desiredField: String(snap.desiredField || ""),
    deckSize: size,
    visibility,
    themeColor,
    ownerUid: uid,
    ownerName: String(opts.getPlayerName?.() || getLS("playerName") || "player").trim() || "player",
    isAdminOwner: getLS("isAdmin") === "1",
    ownerKey: deviceKey(),
    updatedAt: serverTimestamp(),
  };
}

function commitLoadedSource({ id, mode }) {
  const sourceId = String(id || "").trim();
  if (!sourceId) return;
  if (mode === "all") {
    setLS(LS_COPY_SOURCE_ID, sourceId);
    removeLS(LS_LAST_ID);
  } else {
    removeLS(LS_COPY_SOURCE_ID);
    setLS(LS_LAST_ID, sourceId);
  }
}
function installLoadCapture() {
  const state = sharedState();
  if (state.captureInstalled) return;
  state.captureInstalled = true;
  document.addEventListener("click", (event) => {
    const btn = event.target?.closest?.("#deckLibList [data-load]");
    if (!btn) return;
    state.pendingLoad = {
      id: String(btn.getAttribute("data-load") || ""),
      mode: currentLibraryMode(),
      startedAt: Date.now(),
    };
    setTimeout(() => {
      if (state.pendingLoad && Date.now() - Number(state.pendingLoad.startedAt || 0) >= 15000) {
        state.pendingLoad = null;
      }
    }, 15050);
  }, true);
}

function injectUnifiedStyle() {
  if (document.getElementById("deckUnifiedSaveStyle20261006")) return;
  const style = document.createElement("style");
  style.id = "deckUnifiedSaveStyle20261006";
  style.textContent = `
    #deckLibBox{display:none !important;}
    #deckUnifiedSavePanel{
      width:100%;
      margin-top:12px;
      display:grid;
      gap:10px;
      padding:12px 14px;
      border-top:1px solid rgba(255,255,255,.10);
    }
    #deckUnifiedSavePanel .deckUnifiedSettings{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:10px;
      align-items:center;
    }
    #deckUnifiedSavePanel .deckUnifiedVis{
      min-width:0;
    }
    #deckUnifiedSavePanel #deckLibVis{
      width:100% !important;
      min-height:42px !important;
    }
    #deckUnifiedSavePanel .deckUnifiedColor{
      display:flex;
      align-items:center;
      gap:8px;
      color:rgba(255,255,255,.70);
      font-size:12px;
      font-weight:800;
      white-space:nowrap;
    }
    #deckUnifiedSavePanel #deckLibThemeColor{
      width:52px !important;
      height:38px !important;
      min-width:52px !important;
    }
    #deckUnifiedSaveMessage{
      min-height:18px;
      font-size:12px;
      line-height:1.45;
      color:#97ffbc;
    }
    #deckUnifiedSaveMessage.bad{color:#ff9aa7;}
    #deckUnifiedAccountNote{
      font-size:12px;
      line-height:1.45;
      color:rgba(255,255,255,.62);
    }
    #deckUnifiedAccountNote a{
      color:#9ddcff;
      font-weight:900;
      text-decoration:none;
    }
    #btnSave.deckGuestSave{
      opacity:.62 !important;
      border-color:rgba(255,255,255,.14) !important;
    }
    @media (max-width:720px){
      #deckUnifiedSavePanel{padding:10px 12px;}
      #deckUnifiedSavePanel .deckUnifiedSettings{
        grid-template-columns:minmax(0,1fr) auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function installUnifiedUi(opts = {}) {
  const state = sharedState();
  if (state.unifiedInstalled) return;
  state.unifiedInstalled = true;
  injectUnifiedStyle();

  const btnSave = document.getElementById("btnSave");
  const box = document.getElementById("deckLibBox");
  const vis = document.getElementById("deckLibVis");
  const color = document.getElementById("deckLibThemeColor");
  if (!btnSave || !box || !vis || !color) return;

  btnSave.textContent = "保存";
  btnSave.removeAttribute("disabled");

  const saveRow = btnSave.closest(".roomRow") || btnSave.parentElement;
  let panel = document.getElementById("deckUnifiedSavePanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "deckUnifiedSavePanel";
    panel.innerHTML = `
      <div class="deckUnifiedSettings">
        <div class="deckUnifiedVis" id="deckUnifiedVisHost"></div>
        <label class="deckUnifiedColor">テーマ色 <span id="deckUnifiedColorHost"></span></label>
      </div>
      <div id="deckUnifiedSaveMessage"></div>
      <div id="deckUnifiedAccountNote"></div>
    `;
    saveRow?.insertAdjacentElement("afterend", panel);
  }
  document.getElementById("deckUnifiedVisHost")?.appendChild(vis);
  document.getElementById("deckUnifiedColorHost")?.appendChild(color);
  box.hidden = true;

  const note = document.getElementById("deckUnifiedAccountNote");
  const linked = isProfileLinked();
  btnSave.classList.toggle("deckGuestSave", !linked);
  if (note) {
    if (linked) {
      note.textContent = "1〜30枚で保存できます。初回は新規保存、以後は同じデッキを更新します。";
    } else {
      const params = new URLSearchParams();
      params.set("return", location.href);
      note.innerHTML = `ゲストは2デッキまで保存できます。<a href="./login.html?${params.toString()}">ログイン / 新規登録</a>すると最大10デッキ保存できます。`;
    }
  }

  btnSave.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.saving) return;

    void (async () => {
      const linked = isProfileLinked();
      const user = await ensureSignedIn().catch(() => null);
      const linkedUid = linked ? getLS("uid") : String(user?.uid || "");
      if (!user?.uid || !linkedUid || user.uid !== linkedUid) {
        setMsg(linked
          ? "ログイン情報を確認できません。いったんログインし直してください。"
          : "ゲスト情報を確認できません。ページを再読み込みしてもう一度お試しください。", false);
        return;
      }

      const snap = opts.getSnapshot?.() || {};
      const size = sumDeck(snap.deck || {});
      if (size < 1 || size > 30) {
        setMsg("デッキは1〜30枚で保存できます。", false);
        return;
      }

      state.saving = true;
      btnSave.disabled = true;
      const prev = btnSave.textContent;
      btnSave.textContent = "保存中…";
      try {
        saveLocalSnapshot(snap);
        const payload = makePayload(opts, snap, linkedUid, size);
        const db = opts.db;
        const copyMode = !!getLS(LS_COPY_SOURCE_ID);
        let targetId = copyMode ? "" : getLS(LS_LAST_ID);

        if (targetId) {
          try {
            const existing = await getDoc(doc(db, "decks", targetId));
            if (!existing.exists()) {
              targetId = "";
            } else {
              const d = existing.data() || {};
              const own = String(d.ownerUid || "") === linkedUid || String(d.ownerKey || "") === deviceKey();
              if (!own) targetId = "";
            }
          } catch {
            targetId = "";
          }
        }

        if (targetId) {
          await setDoc(doc(db, "decks", targetId), payload, { merge:true });
          setMsg(`保存しました：${payload.title}（${size}/30枚）`, true);
        } else {
          const maxDecks = linked ? 10 : 2;
          if (await ownDeckCount(db, linkedUid) >= maxDecks) {
            throw new Error(linked
              ? "保存デッキは最大10件です。自分のデッキから不要なデッキを削除してください。"
              : "ゲストは2デッキまで保存できます。さらに保存するにはログイン / 新規登録してください。");
          }
          payload.createdAt = serverTimestamp();
          const ref = await addDoc(collection(db, "decks"), payload);
          setLS(LS_LAST_ID, ref.id);
          removeLS(LS_COPY_SOURCE_ID);
          setMsg(`保存しました：${payload.title}（${size}/30枚）`, true);
        }

        setLS(LS_LAST_VIS, payload.visibility);
        setLS(LS_LAST_THEME, payload.themeColor);
      } catch (e) {
        console.error(e);
        setMsg(`保存に失敗しました：${e?.message || e}`, false);
      } finally {
        state.saving = false;
        btnSave.disabled = false;
        btnSave.textContent = prev || "保存";
      }
    })();
  }, true);
}

export function initDeckLibrary(opts = {}) {
  const originalApplySnapshot = opts.applySnapshot;
  installLoadCapture();

  const wrappedApplySnapshot =
    typeof originalApplySnapshot === "function"
      ? (snap) => {
          const state = sharedState();
          const pending = state.pendingLoad;
          const result = originalApplySnapshot(snap);
          if (pending?.id) commitLoadedSource(pending);
          state.pendingLoad = null;
          return result;
        }
      : originalApplySnapshot;

  const result = initDeckLibraryCore({ ...opts, applySnapshot: wrappedApplySnapshot });
  installUnifiedUi(opts);
  return result;
}
