// public/deck_ex_ui.js
// v2.3+: デッキ編成画面の「EX欄表示」を壊さず補助する。
// - deck.js がEXを選んだ時、localStorage の EXキーだけは確実に更新される想定
//   （battle.js 側にも fallback キーが定義されている）
// - ここでは localStorage を監視して EX欄(#exLabel)の見た目を整える。

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const LOCAL_EX_KEYS = [
  "tcg_ex_local_v20260129", // 現行
  "tcg_ex_local",          // 旧
];

function safeText(s){ return String(s ?? "").replace(/[<>&]/g, (c)=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c])); }

function getExId(){
  for (const k of LOCAL_EX_KEYS){
    try{
      const v = localStorage.getItem(k);
      if (v) return String(v);
    }catch{}
  }
  return null;
}

function clearExId(){
  for (const k of LOCAL_EX_KEYS){
    try{ localStorage.removeItem(k); }catch{}
  }
}

// ---- cards cache ----
let cardDefs = null; // {id: data}
let cardsLoaded = false;

async function loadCardsOnce(){
  if (cardsLoaded) return;
  cardsLoaded = true;
  try{
    const apps = getApps();
    const app = apps && apps.length ? apps[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, "cards"));
    const m = {};
    snap.forEach(doc=>{ m[doc.id] = doc.data(); });
    cardDefs = m;
  }catch(err){
    console.warn("[deck_ex_ui] cards load failed", err);
    cardDefs = null;
  }
}

function renderEx(){
  const label = document.getElementById("exLabel");
  const btnClear = document.getElementById("exClearBtn");
  if (!label) return;

  const exId = getExId();
  if (!exId){
    label.innerHTML = `<span class="badge">ピンチ時のみ</span><br>未選択`;
    if (btnClear) btnClear.disabled = true;
    return;
  }

  const def = cardDefs ? cardDefs[exId] : null;
  const name = def?.name ? safeText(def.name) : safeText(exId);
  const cost = (def?.cost !== undefined) ? `【${safeText(def.cost)}】 ` : "";
  const kind = def?.kind ? safeText(def.kind) : (def?.type ? safeText(def.type) : "");

  // できるだけ “デッキUIの雰囲気” に寄せる
  // 例）【1】 メンテナンス窓 support
  label.innerHTML = `<span class="badge">ピンチ時のみ</span><br>${cost}${name}${kind ? ` <span style="opacity:.85;">${kind}</span>` : ""}`;
  if (btnClear) btnClear.disabled = false;
}

function hookClear(){
  const btn = document.getElementById("exClearBtn");
  if (!btn) return;
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", ()=>{
    clearExId();
    renderEx();
  });
}

// ---- bootstrap ----
(async function(){
  // DOMができてから
  if (document.readyState === "loading") {
    await new Promise(r=>document.addEventListener("DOMContentLoaded", r, { once:true }));
  }

  hookClear();

  // 先に即表示（cardsがまだでもIDは出せる）
  renderEx();

  // cardsを取れたら再描画
  await loadCardsOnce();
  renderEx();

  // storageイベント（他タブ更新）
  window.addEventListener("storage", (e)=>{
    if (!e) return;
    if (LOCAL_EX_KEYS.includes(e.key)) renderEx();
  });

  // 同一タブは storage が飛ばないのでポーリング（軽量）
  let last = getExId();
  setInterval(()=>{
    const cur = getExId();
    if (cur !== last){
      last = cur;
      renderEx();
    }
  }, 350);
})();
