// public/deck_library.js
// v20260204_deck_library_noauth_v2
// - Firebase Auth を使わない（auth/configuration-not-found 回避）
// - 端末ごとの deviceKey (localStorage) を ownerKey として扱い「自分のデッキ」を実現
// - Firestore "decks" に保存/公開/一覧
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

const LS_LAST_ID   = "tcg_cloud_deck_last_id_v20260204";
const LS_LAST_VIS  = "tcg_cloud_deck_last_vis_v20260204";
const LS_DEVICEKEY = "tcg_cloud_device_key_v20260204";

function $(id){ return document.getElementById(id); }

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function fmtTime(ts){
  try{
    const ms = ts?.toMillis?.() ?? (typeof ts === "number" ? ts : null);
    if (!ms) return "";
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }catch{ return ""; }
}

function safeJsonClone(obj){
  try{ return JSON.parse(JSON.stringify(obj ?? {})); }catch{ return {}; }
}

function sumDeck(deckMap){
  let t = 0;
  for (const v of Object.values(deckMap || {})){
    const n = Number(v||0);
    if (Number.isFinite(n)) t += n;
  }
  return t;
}

function getLS(k){ try{ return localStorage.getItem(k) || ""; }catch{ return ""; } }
function setLS(k,v){ try{ localStorage.setItem(k,String(v||"")); }catch{} }

function ensureDeviceKey(){
  let k = getLS(LS_DEVICEKEY);
  if (k) return k;
  try{
    k = (crypto.randomUUID?.() ?? ("dev_" + Math.random().toString(16).slice(2) + Date.now()));
  }catch{
    k = ("dev_" + Math.random().toString(16).slice(2) + Date.now());
  }
  setLS(LS_DEVICEKEY, k);
  return k;
}

function visLabel(v){
  if (v === "public") return "公開";
  if (v === "unlisted") return "限定公開";
  return "非公開";
}
function visBadgeClass(v){
  if (v === "public") return "pub";
  if (v === "unlisted") return "unl";
  return "prv";
}

async function safeQueryDocs(q, fallbackQ = null){
  try{
    const snap = await getDocs(q);
    return snap.docs;
  }catch(e){
    if (fallbackQ){
      const snap2 = await getDocs(fallbackQ);
      return snap2.docs;
    }
    throw e;
  }
}

function ensureStyle(){
  if (document.getElementById("deckLibStyle")) return;
  const css = `
  .deckLibBox{
    margin-top: 14px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 16px;
    background: rgba(0,0,0,.18);
    overflow: hidden;
  }
  .deckLibHd{
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    padding: 10px 12px;
    background: rgba(0,0,0,.25);
    border-bottom: 1px solid rgba(255,255,255,.10);
  }
  .deckLibHd b{ letter-spacing:.02em; }
  .deckLibBd{ padding: 12px; }

  .deckLibTabs{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .deckLibTab{
    border-radius: 999px;
    padding: 7px 10px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(0,0,0,.20);
    color:#fff;
    font-weight:900;
    cursor:pointer;
    user-select:none;
    font-size: 12px;
  }
  .deckLibTab.active{
    border-color: rgba(90,170,255,.55);
    background: rgba(90,170,255,.18);
  }

  .deckLibRow{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .deckLibRow .input{ flex: 1 1 180px; }
  .deckLibRow .btn, .deckLibRow .btnGhost{ white-space:nowrap; }

  .deckLibSub{
    margin: 8px 0 10px;
    font-size: 12px;
    color: rgba(255,255,255,.60);
    line-height: 1.35;
    white-space: pre-wrap;
  }

  .deckLibList{
    display:flex;
    flex-direction:column;
    gap:10px;
    max-height: 42vh;
    overflow:auto;
    padding-right:6px;
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
    border-radius: 14px;
    background: rgba(0,0,0,.20);
    padding: 12px 12px;
    box-shadow: 0 10px 24px rgba(0,0,0,.25);
  }
  .deckLibCardTop{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:10px;
  }
  .deckLibTitle{
    font-weight: 950;
    font-size: 14px;
    letter-spacing: .01em;
    line-height: 1.25;
  }
  .deckLibMeta{
    margin-top: 4px;
    font-size: 12px;
    color: rgba(255,255,255,.62);
    line-height: 1.35;
  }
  .deckLibBtns{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    justify-content:flex-end;
    flex-shrink:0;
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
    color: rgba(255,255,255,.70);
    margin-right: 6px;
    margin-top: 6px;
  }
  .deckLibBadge.pub{ border-color: rgba(120,255,170,.35); background: rgba(120,255,170,.12); color: rgba(210,255,230,.95); }
  .deckLibBadge.unl{ border-color: rgba(90,170,255,.35); background: rgba(90,170,255,.12); color: rgba(220,240,255,.95); }
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
    margin-top:8px;
  }
  .deckLibSelect{
    border-radius:14px;
    border:1px solid rgba(255,255,255,.14);
    background: rgba(0,0,0,.25);
    color:#fff;
    padding: 10px 12px;
    font-size: 13px;
    outline:none;
  }
  .deckLibSelect:focus{ border-color: rgba(90,170,255,.55); box-shadow: 0 0 0 3px rgba(90,170,255,.10); }
  `;
  const style = document.createElement("style");
  style.id = "deckLibStyle";
  style.textContent = css;
  document.head.appendChild(style);
}

function findSaveRow(){
  const btnSave = $("btnSave");
  if (!btnSave) return null;
  return btnSave.closest(".roomRow") || btnSave.parentElement;
}

export function initDeckLibrary(opts){
  ensureStyle();

  const {
    db,
    getSnapshot,     // () => { title, deck, exSupport }
    applySnapshot,   // (snap) => void
    getPlayerName,   // () => string
    getCardDefs,     // () => cardDefs map (optional)
    deckTitleInputId = "deckTitle",
  } = opts || {};

  if (!db || typeof getSnapshot !== "function" || typeof applySnapshot !== "function"){
    console.warn("deck_library(noauth): missing required callbacks");
    return;
  }

  const deviceKey = ensureDeviceKey();

  const saveRow = findSaveRow();
  if (!saveRow){
    console.warn("deck_library(noauth): save row not found");
    return;
  }

  // UI 挿入
  let box = document.getElementById("deckLibBox");
  if (!box){
    box = document.createElement("div");
    box.id = "deckLibBox";
    box.className = "deckLibBox";
    box.innerHTML = `
      <div class="deckLibHd">
        <b>みんなのデッキ</b>
        <span class="pill" style="opacity:.85;">Cloud</span>
      </div>

      <div class="deckLibBd">

        <div class="deckLibRow" style="margin-bottom:10px;">
          <select id="deckLibVis" class="deckLibSelect" title="公開範囲">
            <option value="public">公開（みんなに表示）</option>
            <option value="unlisted">限定公開（ID知ってる人）</option>
            <option value="private">非公開（自分だけ）</option>
          </select>

          <button id="deckLibUploadNew" class="btn" type="button">クラウドに新規保存</button>
          <button id="deckLibUploadOverwrite" class="btnGhost" type="button" title="最後に保存したクラウドデッキを更新">上書き保存</button>
        </div>

        <div class="deckLibSub">
・この端末に紐づく「自分のデッキ」をクラウドに保存できます
・公開/限定公開/非公開 を選べます
・「みんなのデッキ」は公開のみ表示
        </div>

        <div class="deckLibTabs">
          <button id="deckLibTabMy" class="deckLibTab active" type="button">自分のデッキ</button>
          <button id="deckLibTabAll" class="deckLibTab" type="button">みんなのデッキ</button>
        </div>

        <div class="deckLibRow" style="margin-bottom:10px;">
          <input id="deckLibSearch" class="input" placeholder="検索（タイトル/作者/タグ）" />
          <button id="deckLibRefresh" class="btnGhost" type="button">更新</button>
        </div>

        <div id="deckLibInfo" class="deckLibMini"></div>
        <div id="deckLibList" class="deckLibList"></div>

        <div id="deckLibMsgOk" class="deckLibOk" style="display:none;"></div>
        <div id="deckLibMsgNg" class="deckLibWarn" style="display:none;"></div>

        <div class="deckLibMini" style="opacity:.8;margin-top:10px;">
          ownerKey: ${esc(deviceKey)}
        </div>
      </div>
    `;
    saveRow.insertAdjacentElement("afterend", box);
  }

  const elVis  = $("deckLibVis");
  const btnNew = $("deckLibUploadNew");
  const btnOw  = $("deckLibUploadOverwrite");
  const tabMy  = $("deckLibTabMy");
  const tabAll = $("deckLibTabAll");
  const inputQ = $("deckLibSearch");
  const btnRef = $("deckLibRefresh");
  const listEl = $("deckLibList");
  const infoEl = $("deckLibInfo");
  const msgOk  = $("deckLibMsgOk");
  const msgNg  = $("deckLibMsgNg");

  function setOk(t){ if (!msgOk) return; msgOk.style.display = t ? "" : "none"; msgOk.textContent = t || ""; }
  function setNg(t){ if (!msgNg) return; msgNg.style.display = t ? "" : "none"; msgNg.textContent = t || ""; }

  // vis restore
  if (elVis){
    const last = getLS(LS_LAST_VIS);
    if (last) elVis.value = last;
    elVis.addEventListener("change", ()=> setLS(LS_LAST_VIS, elVis.value));
  }

  const deckTitleInput = $(deckTitleInputId) || $("deckName") || $("deckTitle") || null;
  function pickTitle(){
    const v = String(deckTitleInput?.value || "").trim();
    if (v) return v.slice(0, 32);
    return "無題デッキ";
  }

  function computeTagsFromDeck(deckMap){
    const defs = typeof getCardDefs === "function" ? (getCardDefs() || {}) : null;
    if (!defs) return [];
    const counts = new Map();
    for (const [id, n] of Object.entries(deckMap || {})){
      const c = Number(n||0);
      if (!c) continue;
      const t = String(defs[id]?.type || "").trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) || 0) + c);
    }
    return Array.from(counts.entries())
      .sort((a,b)=> b[1]-a[1])
      .slice(0,4)
      .map(([t])=> t);
  }

  function deckDocPayload({title, deck, exSupport, visibility, ownerName}){
    const tags = computeTagsFromDeck(deck);
    return {
      title: title || "無題デッキ",
      deck: safeJsonClone(deck || {}),
      exSupport: String(exSupport || ""),
      deckSize: sumDeck(deck || {}),
      tags,
      visibility: visibility || "public",

      // Authなしの所有者キー
      ownerKey: deviceKey,
      ownerName: ownerName || "player",

      updatedAt: serverTimestamp(),
    };
  }

  function setTab(which){
    const isMy = (which === "my");
    tabMy?.classList.toggle("active", isMy);
    tabAll?.classList.toggle("active", !isMy);
    box.dataset.mode = isMy ? "my" : "all";
    refreshList().catch(()=>{});
  }

  tabMy?.addEventListener("click", ()=> setTab("my"));
  tabAll?.addEventListener("click", ()=> setTab("all"));
  btnRef?.addEventListener("click", ()=> refreshList().catch(()=>{}));

  let lastDocs = [];
  let lastMode = "my";

  async function refreshList(){
    if (!listEl) return;
    setOk(""); setNg("");

    const mode = (box.dataset.mode === "all") ? "all" : "my";
    lastMode = mode;

    listEl.innerHTML = `<div class="small" style="opacity:.85;">読み込み中…</div>`;
    if (infoEl) infoEl.textContent = "";

    const decksCol = collection(db, "decks");

    let docs = [];
    try{
      if (mode === "my"){
        const q1 = query(decksCol, where("ownerKey","==", deviceKey), orderBy("updatedAt","desc"), limit(50));
        const qFallback = query(decksCol, where("ownerKey","==", deviceKey), limit(50));
        docs = await safeQueryDocs(q1, qFallback);
      }else{
        const q1 = query(decksCol, where("visibility","==","public"), orderBy("updatedAt","desc"), limit(50));
        const qFallback = query(decksCol, where("visibility","==","public"), limit(50));
        docs = await safeQueryDocs(q1, qFallback);
      }
    }catch(e){
      console.error(e);
      listEl.innerHTML = `<div class="small" style="opacity:.85;">読み込みに失敗しました</div>`;
      setNg(`一覧取得に失敗：${e?.message || e}`);
      return;
    }

    lastDocs = docs.map(d => ({ id: d.id, data: d.data() || {} }));
    renderList();
  }

  function matchQuery(item, q){
    if (!q) return true;
    const d = item.data || {};
    const hay = [
      d.title,
      d.ownerName,
      (d.tags || []).join(" "),
      d.visibility,
      item.id,
    ].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderList(){
    if (!listEl) return;
    const q = String(inputQ?.value || "").trim();
    const filtered = lastDocs.filter(it => matchQuery(it, q));

    const mode = lastMode;
    if (infoEl){
      infoEl.textContent = mode === "my"
        ? `自分のデッキ：${filtered.length}件`
        : `公開デッキ：${filtered.length}件`;
    }

    if (!filtered.length){
      listEl.innerHTML = `<div class="small" style="opacity:.85;">デッキがありません</div>`;
      return;
    }

    listEl.innerHTML = "";
    for (const it of filtered){
      const d = it.data || {};
      const title = String(d.title || "無題デッキ");
      const owner = String(d.ownerName || "player");
      const vis = String(d.visibility || "public");
      const updated = fmtTime(d.updatedAt) || fmtTime(d.createdAt) || "";
      const size = Number(d.deckSize || 0) || sumDeck(d.deck || {});
      const tagHtml = (d.tags || []).slice(0,4).map(t=> `<span class="deckLibBadge">${esc(t)}</span>`).join("");
      const badge = `<span class="deckLibBadge ${visBadgeClass(vis)}">${esc(visLabel(vis))}</span>`;

      const canDelete = (mode === "my");

      const card = document.createElement("div");
      card.className = "deckLibCard";
      card.innerHTML = `
        <div class="deckLibCardTop">
          <div style="min-width:0;">
            <div class="deckLibTitle">${esc(title)}</div>
            <div class="deckLibMeta">
              ${badge}
              <span class="deckLibBadge">枚数:${esc(size)}</span>
              <span class="deckLibBadge">作者:${esc(owner)}</span>
              ${updated ? `<span class="deckLibBadge">更新:${esc(updated)}</span>` : ""}
              <span class="deckLibBadge">ID:${esc(it.id)}</span>
              ${tagHtml}
            </div>
          </div>

          <div class="deckLibBtns">
            <button class="btn" data-load="${esc(it.id)}" type="button">ロード</button>
            ${canDelete ? `<button class="btnGhost" data-del="${esc(it.id)}" type="button">削除</button>` : ``}
          </div>
        </div>
      `;

      card.querySelector(`[data-load="${CSS.escape(it.id)}"]`)?.addEventListener("click", async ()=>{
        setOk(""); setNg("");
        try{
          const ref = doc(db, "decks", it.id);
          const snap = await getDoc(ref);
          if (!snap.exists()){
            setNg("デッキが見つかりませんでした");
            return;
          }
          const data = snap.data() || {};
          const deck = data.deck || {};
          const exSupport = String(data.exSupport || "");
          const t = String(data.title || "");

          applySnapshot({ title: t, deck, exSupport });

          if (deckTitleInput && t) deckTitleInput.value = t;
          setOk(`ロードしました：${t || it.id}`);
        }catch(e){
          console.error(e);
          setNg(`ロードに失敗：${e?.message || e}`);
        }
      });

      card.querySelector(`[data-del="${CSS.escape(it.id)}"]`)?.addEventListener("click", async ()=>{
        setOk(""); setNg("");
        if (!confirm(`削除しますか？\n${title}\nID:${it.id}`)) return;
        try{
          await deleteDoc(doc(db, "decks", it.id));
          setOk("削除しました");
          if (getLS(LS_LAST_ID) === it.id) setLS(LS_LAST_ID, "");
          await refreshList();
        }catch(e){
          console.error(e);
          setNg(`削除に失敗：${e?.message || e}`);
        }
      });

      listEl.appendChild(card);
    }
  }

  inputQ?.addEventListener("input", ()=> renderList());

  async function uploadDeck({overwrite}){
    setOk(""); setNg("");

    const snap = getSnapshot();
    const deck = snap?.deck || {};
    const exSupport = String(snap?.exSupport || "");
    const title = String(snap?.title || pickTitle()).trim() || "無題デッキ";
    const visibility = String(elVis?.value || "public");

    const size = sumDeck(deck);
    if (size !== 30){
      setNg("クラウド保存は「30枚ちょうど」のデッキだけに対応しています");
      return;
    }

    const ownerName = String(getPlayerName?.() || "player").trim() || "player";

    try{
      const decksCol = collection(db, "decks");

      if (overwrite){
        const lastId = getLS(LS_LAST_ID);
        if (!lastId){
          setNg("上書き先がありません（先に「新規保存」をしてください）");
          return;
        }
        const ref = doc(db, "decks", lastId);
        await setDoc(ref, deckDocPayload({title, deck, exSupport, visibility, ownerName}), { merge: true });
        setOk(`上書き保存しました：${title}`);
      }else{
        const payload = deckDocPayload({title, deck, exSupport, visibility, ownerName});
        payload.createdAt = serverTimestamp();
        const ref = await addDoc(decksCol, payload);
        setLS(LS_LAST_ID, ref.id);
        setOk(`新規保存しました：${title}\nID:${ref.id}`);
      }

      await refreshList();
    }catch(e){
      console.error(e);
      setNg(`保存に失敗：${e?.message || e}`);
    }
  }

  btnNew?.addEventListener("click", ()=> uploadDeck({overwrite:false}));
  btnOw?.addEventListener("click", ()=> uploadDeck({overwrite:true}));

  // 初期タブ
  setTab("my");
  refreshList().catch(()=>{});
}