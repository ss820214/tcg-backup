// public/settings.js
// v2.0.5-b - Deluxe Settings + Admin lock (password) + gear FX

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const $id = (id)=>document.getElementById(id);

const ADMIN_PASS = "ILoveSex";             // ★指定どおり固定
const ADMIN_OK_LOCAL = "tcg_admin_ok_v1";  // unlock状態（この端末）
const ADMIN_KEY_LOCAL = "tcg_admin_key_v1";

function getAdminUnlocked(){ try { return localStorage.getItem(ADMIN_OK_LOCAL) === "1"; } catch { return false; } }
function setAdminUnlocked(v){ try { localStorage.setItem(ADMIN_OK_LOCAL, v ? "1" : "0"); } catch {} }

function getAdminKey(){ try { return localStorage.getItem(ADMIN_KEY_LOCAL) || ""; } catch { return ""; } }
function setAdminKey(v){ try { localStorage.setItem(ADMIN_KEY_LOCAL, String(v||"")); } catch {} }

let bd = null;
let ctxHold = null;
let activeTab = "workshop"; // workshop/admin

function ensureCss(){
  if (document.getElementById("settingsCssLink")) return;
  const link = document.createElement("link");
  link.id = "settingsCssLink";
  link.rel = "stylesheet";
  link.href = `./settings.css?v=20260130b`;
  document.head.appendChild(link);
}

function closeSettings(){
  if (bd) { try { bd.remove(); } catch {} }
  bd = null;
  ctxHold = null;
}

function gearFX(){
  const fx = document.createElement("div");
  fx.className = "st_gearFx";
  fx.innerHTML = `<div class="st_gear"><span>⚙️</span></div>`;
  document.body.appendChild(fx);
  setTimeout(()=>{ try{ fx.remove(); }catch{} }, 950);
}

function setMiniMsg(el, text, ok=true){
  if (!el) return;
  el.className = `st_small ${ok ? "st_msg_ok" : "st_msg_ng"}`;
  el.textContent = text || "";
}

function mount(ctx){
  ensureCss();
  closeSettings();
  ctxHold = ctx;

  bd = document.createElement("div");
  bd.className = "st_backdrop";

  const unlocked = getAdminUnlocked();

  bd.innerHTML = `
    <div class="st_modal" role="dialog" aria-modal="true">
      <div class="st_head">
        <div class="st_title">
          <div class="st_small">v2.0.5</div>
          <b>設定 / カード作成</b>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="st_tabs">
            <div class="st_tab" id="tabWorkshop" aria-selected="true">🧪 カード投稿</div>
            <div class="st_tab" id="tabAdmin" aria-selected="false">${unlocked ? "⚙️ 管理者" : "🔒 管理者"}</div>
          </div>
          <button class="st_btn" id="stClose">閉じる</button>
        </div>
      </div>

      <div class="st_body" id="stBody">
        <!-- workshop -->
        <div id="panelWorkshop">
          <div class="st_grid">
            <div class="st_card">
              <b>カード投稿（みんな用）</b>
              <div class="st_small" style="margin-top:6px;">
                <span class="st_badge">保存先: cards_pending</span>
                <span class="st_badge">承認制推奨</span>
              </div>

              <div style="display:grid; gap:10px; margin-top:12px;">
                <input class="st_input" id="ws_id" placeholder="カードID（例: grass_heal_01）">
                <input class="st_input" id="ws_name" placeholder="カード名">

                <select class="st_sel" id="ws_kind">
                  <option value="unit">ユニット</option>
                  <option value="support">サポート</option>
                </select>

                <input class="st_input" id="ws_type" placeholder="属性（例: 火/水/風/雷/光/闇/鋼/草）">
                <input class="st_input" id="ws_cost" type="number" placeholder="cost">

                <div class="st_small">ユニット用（supportなら空でOK）</div>
                <div style="display:flex; gap:10px;">
                  <input class="st_input" id="ws_hp" type="number" placeholder="hp">
                  <input class="st_input" id="ws_sp" type="number" placeholder="sp">
                </div>

                <div class="st_small">actions / effect は JSON（空なら省略）</div>
                <textarea class="st_area" id="ws_actions" rows="5"
                  placeholder='actions(JSON) 例: [{"name":"斬る","cost":1,"range":"f1","rate":80,"dmg":2}]'></textarea>
                <textarea class="st_area" id="ws_effect" rows="4"
                  placeholder='support effect(JSON) 例: {"type":"draw","n":1,"rate":80}'></textarea>

                <button class="st_btn primary" id="ws_submit">投稿（cards_pendingへ）</button>
                <div id="ws_msg" class="st_small"></div>
              </div>
            </div>

            <div class="st_card">
              <b>メモ</b>
              <div class="st_small" style="margin-top:8px;">
                ・cards_pending は「誰でも投稿OK」<br>
                ・cards は「管理者だけ書込」にすると荒れない<br>
                <br>
                管理者モードは右上の「管理者」から。
              </div>
            </div>
          </div>
        </div>

        <!-- admin -->
        <div id="panelAdmin" style="display:none;">
          <div class="st_card">
            <b>管理者メニュー</b>
            <div class="st_small" style="margin-top:6px;">
              <span class="st_badge">直接反映: cards</span>
              <span class="st_badge">この端末のみ</span>
            </div>

            <div id="adminLocked" class="st_lockBox" style="display:${unlocked ? "none" : "grid"};">
              <div class="st_small">🔒 パスワードを入力すると管理者が開きます</div>
              <input class="st_input" id="adminPass" type="password" placeholder="管理者パスワード">
              <button class="st_btn" id="adminUnlock">ロック解除</button>
              <div id="adminUnlockMsg" class="st_small"></div>
            </div>

            <div id="adminUnlocked" style="display:${unlocked ? "grid" : "none"}; gap:10px; margin-top:12px;">
              <div class="st_small">✅ 管理者モード（歯車が開いた）</div>

              <input class="st_input" id="ws_adminkey" placeholder="管理キー（任意：端末ローカル）">
              <button class="st_btn" id="ws_savekey">管理キーを保存</button>

              <button class="st_btn primary" id="ws_publish">この入力を cards に直接追加</button>
              <button class="st_btn" id="adminRarity">レア度管理を開く</button>
              <button class="st_btn danger" id="adminLockBack">管理者ロックに戻す</button>

              <div id="ws_adminmsg" class="st_small"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(bd);

  // close
  bd.querySelector("#stClose")?.addEventListener("click", closeSettings);
  bd.addEventListener("click", (e)=>{ if (e.target === bd) closeSettings(); });

  // tabs
  const tabWorkshop = bd.querySelector("#tabWorkshop");
  const tabAdmin = bd.querySelector("#tabAdmin");
  const panelWorkshop = bd.querySelector("#panelWorkshop");
  const panelAdmin = bd.querySelector("#panelAdmin");

  function setTab(name){
    activeTab = name;
    const unlockedNow = getAdminUnlocked();
    tabWorkshop?.setAttribute("aria-selected", name==="workshop" ? "true" : "false");
    tabAdmin?.setAttribute("aria-selected", name==="admin" ? "true" : "false");
    if (tabAdmin) tabAdmin.textContent = unlockedNow ? "⚙️ 管理者" : "🔒 管理者";

    if (panelWorkshop) panelWorkshop.style.display = (name==="workshop") ? "block" : "none";
    if (panelAdmin) panelAdmin.style.display = (name==="admin") ? "block" : "none";
  }

  tabWorkshop?.addEventListener("click", ()=> setTab("workshop"));
  tabAdmin?.addEventListener("click", ()=>{
    setTab("admin");
    if (!getAdminUnlocked()) bd.querySelector("#adminPass")?.focus();
  });

  setTab("workshop");

  // handlers
  wireWorkshop(ctx);
  wireAdmin(ctx, setTab);
}

function readForm(){
  const id = ($id("ws_id")?.value || "").trim();
  const name = ($id("ws_name")?.value || "").trim();
  const kind = ($id("ws_kind")?.value || "unit").trim();
  const type = ($id("ws_type")?.value || "").trim();
  const cost = Number($id("ws_cost")?.value || 0);

  const hp = Number($id("ws_hp")?.value || 0);
  const sp = Number($id("ws_sp")?.value || 0);

  const actionsRaw = ($id("ws_actions")?.value || "").trim();
  const effectRaw  = ($id("ws_effect")?.value || "").trim();

  let actions = null;
  let effect = null;

  if (actionsRaw) {
    actions = JSON.parse(actionsRaw);
    if (!Array.isArray(actions)) throw new Error("actionsは配列JSONにしてね");
  }
  if (effectRaw) {
    effect = JSON.parse(effectRaw);
    if (typeof effect !== "object" || Array.isArray(effect)) throw new Error("effectはJSONオブジェクトにしてね");
  }

  if (!id || !/^[a-z0-9_\-]+$/i.test(id)) throw new Error("カードIDは英数字/ _ / - だけで入力してね");
  if (!name) throw new Error("カード名が空です");
  if (!type) throw new Error("属性(type)が空です");

  const data = {
    name,
    type,
    cost: Math.max(0, Math.trunc(cost)),
    updatedAt: serverTimestamp(),
  };

  if (String(kind).toLowerCase() === "support") {
    data.kind = "support";
    if (effect) data.effect = effect;
  } else {
    data.kind = "unit";
    data.hp = Math.max(0, Math.trunc(hp));
    data.sp = Math.max(0, Math.trunc(sp));
    if (actions) data.actions = actions;
  }

  return { id, data };
}

function wireWorkshop(ctx){
  const { db, roomId, playerId } = ctx;
  const msg = $id("ws_msg");

  $id("ws_submit")?.addEventListener("click", async ()=>{
    try{
      const { id, data } = readForm();
      await setDoc(doc(db, "cards_pending", id), {
        ...data,
        _submittedBy: playerId || null,
        _room: roomId || null,
        _submittedAt: serverTimestamp(),
        _status: "pending",
      }, { merge:false });
      setMiniMsg(msg, `投稿しました！ cards_pending/${id}`, true);
    } catch(e){
      setMiniMsg(msg, `投稿失敗: ${e?.message || e}`, false);
    }
  });
}

function wireAdmin(ctx, setTab){
  const { db, reloadCards } = ctx;

  const unlockMsg = $id("adminUnlockMsg");
  const adminLocked = $id("adminLocked");
  const adminUnlocked = $id("adminUnlocked");
  const adminPass = $id("adminPass");
  const adminBtn = $id("adminUnlock");

  const amsg = $id("ws_adminmsg");

  function refreshAdminUI(){
    const ok = getAdminUnlocked();
    if (adminLocked) adminLocked.style.display = ok ? "none" : "grid";
    if (adminUnlocked) adminUnlocked.style.display = ok ? "grid" : "none";

    const keyInput = $id("ws_adminkey");
    if (keyInput) keyInput.value = getAdminKey();
  }

  async function doUnlock(){
    const v = (adminPass?.value || "").trim();
    if (v !== ADMIN_PASS) {
      setMiniMsg(unlockMsg, "パスワードが違います", false);
      return;
    }
    setAdminUnlocked(true);

    // ★歯車が開く演出
    gearFX();

    setMiniMsg(unlockMsg, "解除成功！", true);
    refreshAdminUI();
    setTimeout(()=> setTab?.("admin"), 120);
  }

  adminBtn?.addEventListener("click", doUnlock);
  adminPass?.addEventListener("keydown", (e)=>{ if (e.key === "Enter") doUnlock(); });

  $id("adminLockBack")?.addEventListener("click", ()=>{
    setAdminUnlocked(false);
    setMiniMsg(amsg, "管理者ロックに戻しました", true);
    refreshAdminUI();
  });

  $id("adminRarity")?.addEventListener("click", ()=>{
    if (!getAdminUnlocked()) {
      setMiniMsg(amsg, "管理者ロックを解除してから開いてください", false);
      return;
    }
    location.href = "./rarity_admin.html";
  });

  $id("ws_savekey")?.addEventListener("click", ()=>{
    const v = ($id("ws_adminkey")?.value || "").trim();
    setAdminKey(v);
    setMiniMsg(amsg, v ? "管理キーを保存しました（この端末のみ）" : "管理キーを消しました", true);
  });

  $id("ws_publish")?.addEventListener("click", async ()=>{
    try{
      if (!getAdminUnlocked()) throw new Error("管理者ロックが解除されていません");
      const { id, data } = readForm();
      await setDoc(doc(db, "cards", id), data, { merge:false });
      setMiniMsg(amsg, `cards に追加しました: ${id}`, true);
      if (typeof reloadCards === "function") await reloadCards();
    } catch(e){
      setMiniMsg(amsg, `追加失敗: ${e?.message || e}`, false);
    }
  });

  refreshAdminUI();
}

export function initSettings(ctx){
  // ctx: {db, roomId, playerId, reloadCards}
  const btn = $id("btnSettings");
  if (!btn) return;
  btn.addEventListener("click", ()=> mount(ctx));
}
