// public/card_editor.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  onSnapshot, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// あなたの既存 action_text を利用（プレビューに使う）
import { actionDetailPartsJa } from "./action_text.js?v=20260722_vital_icons1";

// ====== ここをあなたの Firebase config に差し替え ======
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
  storageBucket: "tcg-0bato.firebasestorage.app",
  messagingSenderId: "440001841840",
  appId: "1:440001841840:web:d77a9bdb80f3d8d8c10975",
  measurementId: "G-2BS37RDG7F"
};
// ======================================================

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const $ = (id) => document.getElementById(id);

const el = {
  connState: $("connState"),
  btnReload: $("btnReload"),
  search: $("search"),
  list: $("list"),
  btnNew: $("btnNew"),
  btnClone: $("btnClone"),
  btnDelete: $("btnDelete"),

  cardId: $("cardId"),
  name: $("name"),
  attr: $("attr"),
  cost: $("cost"),
  hp: $("hp"),
  sp: $("sp"),
  imageUrl: $("imageUrl"),
  desc: $("desc"),

  actions: $("actions"),
  btnAddAction: $("btnAddAction"),

  btnSave: $("btnSave"),
  btnExport: $("btnExport"),
  btnImport: $("btnImport"),
  jsonBox: $("jsonBox"),
  saveState: $("saveState"),

  imgPreview: $("imgPreview"),
  pvName: $("pvName"),
  pvMeta: $("pvMeta"),
  pvActions: $("pvActions"),
  pvJson: $("pvJson"),
};

let cardsIndex = []; // {id,data}
let selectedId = null;
let unsubscribe = null;
let dirty = false;

function markDirty(v=true){
  dirty = v;
  el.saveState.textContent = dirty ? "未保存（変更あり）" : "保存済み";
  el.saveState.style.color = dirty ? "#ffd27a" : "#93a4b8";
}

function safeInt(v, d=0){
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}

function normStr(v){ return String(v ?? "").trim(); }
function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

function defaultCard(){
  return {
    type: "char",
    name: "新キャラ",
    attr: "雷",
    cost: 1,
    hp: 10,
    sp: 10,
    imageUrl: "",
    desc: "",
    actions: [
      {
        cost: 1,
        name: "パンチ",
        rate: 80,
        range: "front1",
        hpDelta: -10,
        spDelta: 0,
        tags: "",
        addStatus: "",
        bonus: "",
        draw: ""
      }
    ],
    updatedAt: null,
  };
}

function actionRowTemplate(a, idx){
  return `
  <div class="actionBox" data-idx="${idx}">
    <div class="head">
      <div class="ttl">[${idx+1}] 技</div>
      <div class="row">
        <button class="btn ghost" data-act="up">↑</button>
        <button class="btn ghost" data-act="down">↓</button>
        <button class="btn danger" data-act="remove">削除</button>
      </div>
    </div>

    <div class="split">
      <div>
        <label>コスト</label>
        <input data-k="cost" type="number" step="1" />
      </div>
      <div>
        <label>成功率（rate）</label>
        <input data-k="rate" type="number" step="1" />
      </div>
    </div>

    <div class="split" style="margin-top:8px;">
      <div>
        <label>技名</label>
        <input data-k="name" />
      </div>
      <div>
        <label>射程（例: rf1+lf1+front1 / self）</label>
        <input data-k="range" placeholder="front1+side1" />
      </div>
    </div>

    <div class="split" style="margin-top:8px;">
      <div>
        <label>hpDelta（-ダメ / +回復）</label>
        <input data-k="hpDelta" type="number" step="1" />
      </div>
      <div>
        <label>spDelta（-ダメ / +回復）</label>
        <input data-k="spDelta" type="number" step="1" />
      </div>
    </div>

    <div class="split" style="margin-top:8px;">
      <div>
        <label>tags（CSV / +区切り可）</label>
        <input data-k="tags" placeholder="smell+blind など" />
      </div>
      <div>
        <label>addStatus（CSV / JSON / object）</label>
        <input data-k="addStatus" placeholder='例: lostSoul,bleed / [{"addStatus":"bleed","v":10}]' />
      </div>
    </div>

    <div class="split" style="margin-top:8px;">
      <div>
        <label>bonus（命中UP/威力UPなどの数値）</label>
        <input data-k="bonus" placeholder="例: 10" />
      </div>
      <div>
        <label>draw（ドロー数）</label>
        <input data-k="draw" placeholder="例: 1" />
      </div>
    </div>

    <div style="margin-top:8px;">
      <div class="muted">プレビュー（action_text.js）</div>
      <pre data-k="preview">—</pre>
    </div>
  </div>`;
}

function getEditorValue(){
  const data = {
    type: "char",
    name: normStr(el.name.value) || "—",
    attr: normStr(el.attr.value) || "無",
    cost: safeInt(el.cost.value, 0),
    hp: safeInt(el.hp.value, 0),
    sp: safeInt(el.sp.value, 0),
    imageUrl: normStr(el.imageUrl.value),
    desc: normStr(el.desc.value),
    actions: [],
    updatedAt: serverTimestamp(),
  };

  const boxes = [...el.actions.querySelectorAll(".actionBox")];
  for (const box of boxes){
    const g = (k) => box.querySelector(`[data-k="${k}"]`);

    const a = {
      cost: safeInt(g("cost").value, 0),
      name: normStr(g("name").value),
      rate: safeInt(g("rate").value, 0),
      range: normStr(g("range").value),

      hpDelta: safeInt(g("hpDelta").value, 0),
      spDelta: safeInt(g("spDelta").value, 0),

      tags: normStr(g("tags").value),
      addStatus: normStr(g("addStatus").value),
      bonus: normStr(g("bonus").value),
      draw: normStr(g("draw").value),
    };
    data.actions.push(a);
  }

  return data;
}

function setEditorValue(cardId, data){
  selectedId = cardId || null;

  el.cardId.value = cardId || "";
  el.name.value = data?.name ?? "";
  el.attr.value = data?.attr ?? "雷";
  el.cost.value = safeInt(data?.cost, 0);
  el.hp.value   = safeInt(data?.hp, 0);
  el.sp.value   = safeInt(data?.sp, 0);
  el.imageUrl.value = data?.imageUrl ?? "";
  el.desc.value = data?.desc ?? "";

  el.actions.innerHTML = "";
  const acts = Array.isArray(data?.actions) ? data.actions : [];
  if (!acts.length) acts.push(defaultCard().actions[0]);

  acts.forEach((a, i)=> addActionBox(a, i));
  refreshActionsPreview();
  refreshPreviewPanel();
  markDirty(false);
}

function addActionBox(actionData, idx = null){
  const current = [...el.actions.querySelectorAll(".actionBox")].length;
  const i = (idx == null) ? current : idx;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = actionRowTemplate(actionData, i);
  const box = wrapper.firstElementChild;

  // 値入れ
  for (const [k,v] of Object.entries(actionData || {})){
    const t = box.querySelector(`[data-k="${k}"]`);
    if (t) t.value = (v ?? "");
  }

  // ボタン
  box.addEventListener("click", (e)=>{
    const b = e.target?.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;

    const boxes = [...el.actions.querySelectorAll(".actionBox")];
    const pos = boxes.indexOf(box);

    if (act === "remove"){
      box.remove();
      reindexActions();
      refreshActionsPreview();
      refreshPreviewPanel();
      markDirty(true);
      return;
    }
    if (act === "up" && pos > 0){
      el.actions.insertBefore(box, boxes[pos-1]);
      reindexActions();
      refreshActionsPreview();
      refreshPreviewPanel();
      markDirty(true);
      return;
    }
    if (act === "down" && pos < boxes.length - 1){
      el.actions.insertBefore(boxes[pos+1], box);
      reindexActions();
      refreshActionsPreview();
      refreshPreviewPanel();
      markDirty(true);
      return;
    }
  });

  // 入力変更
  box.addEventListener("input", ()=>{
    refreshActionsPreview();
    refreshPreviewPanel();
    markDirty(true);
  });

  el.actions.appendChild(box);
  reindexActions();
}

function reindexActions(){
  const boxes = [...el.actions.querySelectorAll(".actionBox")];
  boxes.forEach((b, i)=>{
    b.dataset.idx = String(i);
    const ttl = b.querySelector(".ttl");
    if (ttl) ttl.textContent = `[${i+1}] 技`;
  });
}

function refreshActionsPreview(){
  const boxes = [...el.actions.querySelectorAll(".actionBox")];
  for (const box of boxes){
    const g = (k) => box.querySelector(`[data-k="${k}"]`);
    const a = {
      cost: safeInt(g("cost").value, 0),
      name: normStr(g("name").value),
      rate: safeInt(g("rate").value, 0),
      range: normStr(g("range").value),

      hpDelta: safeInt(g("hpDelta").value, 0),
      spDelta: safeInt(g("spDelta").value, 0),

      tags: normStr(g("tags").value),
      addStatus: normStr(g("addStatus").value),
      bonus: normStr(g("bonus").value),
      draw: normStr(g("draw").value),
    };

    const p = box.querySelector(`[data-k="preview"]`);
    if (p){
      const parts = actionDetailPartsJa(a);
      const lines = [];
      lines.push(`【${parts.cost}】 ${parts.name}（射程:${parts.range || "-"} 成功:${parts.rate}%）`);

      const dmg = [];
      if (parts.hpDmg) dmg.push(`❤️-${parts.hpDmg}`);
      if (parts.spDmg) dmg.push(`💙-${parts.spDmg}`);
      if (parts.hpHeal) dmg.push(`❤️+${parts.hpHeal}`);
      if (parts.spHeal) dmg.push(`💙+${parts.spHeal}`);
      if (dmg.length) lines.push(dmg.join(" "));

      if (parts.effectText) lines.push(parts.effectText);
      p.textContent = lines.join("\n");
    }
  }
}

function refreshPreviewPanel(){
  const data = getEditorValue();

  el.pvName.textContent = data.name || "—";
  el.pvMeta.textContent = `属性:${data.attr} / コスト:${data.cost} / HP:${data.hp} SP:${data.sp}`;

  // image
  el.imgPreview.innerHTML = "";
  if (data.imageUrl){
    const img = new Image();
    img.src = data.imageUrl;
    img.alt = data.name;
    img.onerror = ()=> { el.imgPreview.innerHTML = `<div class="muted">画像読込失敗</div>`; };
    el.imgPreview.appendChild(img);
  } else {
    el.imgPreview.innerHTML = `<div class="muted">画像なし</div>`;
  }

  // actions
  const lines = [];
  (data.actions || []).forEach((a, i)=>{
    const p = actionDetailPartsJa(a);

    lines.push(`[${i+1}] ${p.name}（コスト:${p.cost} / 射程:${p.range || "-"} / 成功:${p.rate}%）`);

    const dmg = [];
    if (p.hpDmg) dmg.push(`❤️-${p.hpDmg}`);
    if (p.spDmg) dmg.push(`💙-${p.spDmg}`);
    if (p.hpHeal) dmg.push(`❤️+${p.hpHeal}`);
    if (p.spHeal) dmg.push(`💙+${p.spHeal}`);
    if (dmg.length) lines.push(`  ${dmg.join(" ")}`);

    if (p.effectText) lines.push(`  ${p.effectText}`);
  });
  el.pvActions.textContent = lines.join("\n") || "—";

  // json（表示用：updatedAtは落とす）
  const json = deepClone(data);
  delete json.updatedAt;
  el.pvJson.textContent = JSON.stringify(json, null, 2);
}

function renderList(){
  const q = normStr(el.search.value).toLowerCase();

  const filtered = cardsIndex.filter(({id, data})=>{
    const name = String(data?.name ?? "").toLowerCase();
    const attr = String(data?.attr ?? "").toLowerCase();
    const s = `${id} ${name} ${attr}`.toLowerCase();
    return !q || s.includes(q);
  });

  el.list.innerHTML = "";
  for (const item of filtered){
    const div = document.createElement("div");
    div.className = "item" + (item.id === selectedId ? " active" : "");
    div.innerHTML = `
      <div class="top">
        <div class="name">${item.data?.name ?? "(no name)"}</div>
        <div class="muted">${item.data?.attr ?? "?"} / ${item.data?.cost ?? "?"}</div>
      </div>
      <div class="meta">id: ${item.id} / HP:${item.data?.hp ?? "?"} SP:${item.data?.sp ?? "?"}</div>
    `;

    div.addEventListener("click", async ()=>{
      if (dirty && !confirm("未保存の変更があります。破棄して切り替えますか？")) return;
      await loadOne(item.id);
    });

    el.list.appendChild(div);
  }
}

async function loadOne(id){
  const ref = doc(db, "cards", id);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    alert("カードが見つかりませんでした");
    return;
  }
  setEditorValue(id, snap.data());
  renderList();
}

async function saveCurrent(){
  const data = getEditorValue();
  const id = normStr(el.cardId.value);

  // docId自動生成は事故りやすいので、ここは固定ID運用推奨
  if (!id){
    alert("カードID（docId）を入れてください（運用上ここは固定ID推奨）");
    return;
  }

  const ref = doc(db, "cards", id);
  await setDoc(ref, data, { merge: true });

  el.connState.textContent = "Firestore: 保存OK";
  markDirty(false);
}

async function deleteCurrent(){
  const id = normStr(el.cardId.value);
  if (!id) return alert("削除するカードIDがありません");
  if (!confirm(`削除しますか？\n${id}`)) return;

  await deleteDoc(doc(db, "cards", id));
  el.connState.textContent = "Firestore: 削除OK";

  selectedId = null;
  setEditorValue("", defaultCard());
  renderList();
}

function exportJson(){
  const data = getEditorValue();
  const out = deepClone(data);
  delete out.updatedAt;
  el.jsonBox.value = JSON.stringify(out, null, 2);
}

function importJson(){
  const s = el.jsonBox.value.trim();
  if (!s) return alert("JSONが空です");
  try{
    const obj = JSON.parse(s);
    setEditorValue(normStr(el.cardId.value), obj);
  }catch(e){
    alert("JSON parse 失敗: " + e.message);
  }
}

function cloneCurrent(){
  const baseId = normStr(el.cardId.value) || "card";
  el.cardId.value = baseId + "_copy";
  el.name.value = (normStr(el.name.value) || "—") + "（コピー）";
  refreshActionsPreview();
  refreshPreviewPanel();
  markDirty(true);
}

function newCard(){
  setEditorValue("", defaultCard());
  renderList();
}

function wire(){
  el.btnReload.addEventListener("click", ()=> location.reload());
  el.search.addEventListener("input", renderList);

  // editor inputs -> preview
  ["cardId","name","attr","cost","hp","sp","imageUrl","desc"].forEach((k)=>{
    el[k].addEventListener("input", ()=>{
      refreshActionsPreview();
      refreshPreviewPanel();
      markDirty(true);
    });
  });

  el.btnAddAction.addEventListener("click", ()=>{
    addActionBox({
      cost: 1, name: "新技", rate: 80, range: "front1",
      hpDelta: -10, spDelta: 0, tags:"", addStatus:"", bonus:"", draw:""
    });
    refreshActionsPreview();
    refreshPreviewPanel();
    markDirty(true);
  });

  el.btnSave.addEventListener("click", async ()=>{
    try { await saveCurrent(); }
    catch(e){ alert("保存失敗: " + (e?.message || e)); }
  });

  el.btnDelete.addEventListener("click", async ()=>{
    try { await deleteCurrent(); }
    catch(e){ alert("削除失敗: " + (e?.message || e)); }
  });

  el.btnNew.addEventListener("click", ()=>{
    if (dirty && !confirm("未保存の変更があります。破棄して新規にしますか？")) return;
    newCard();
  });

  el.btnClone.addEventListener("click", cloneCurrent);

  el.btnExport.addEventListener("click", exportJson);
  el.btnImport.addEventListener("click", importJson);

  window.addEventListener("beforeunload", (e)=>{
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

function startWatch(){
  const col = collection(db, "cards");
  unsubscribe = onSnapshot(col, (snap)=>{
    cardsIndex = snap.docs.map(d=>({ id: d.id, data: d.data() }));
    cardsIndex.sort((a,b)=> String(a.data?.name||"").localeCompare(String(b.data?.name||""), "ja"));

    el.connState.textContent = `Firestore: 接続OK（${cardsIndex.length}件）`;
    renderList();
  }, (err)=>{
    console.error(err);
    el.connState.textContent = "Firestore: 接続エラー";
    alert("Firestore 接続エラー: " + err.message);
  });
}

// ===== 起動 =====
wire();
setEditorValue("", defaultCard());
refreshActionsPreview();
refreshPreviewPanel();
startWatch();
