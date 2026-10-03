// public/post_box.js
// v20260726_post1
// Small operation gift mailbox for the home screen.

import {
  ensureUserProfile,
  claimPendingAdminGrants,
  claimOperationGifts,
  createOperationGemGift,
  listOperationGifts,
} from "./user_store.js?v=20260726_post1";

const STYLE_ID = "tcgPostBoxStyle";
const ROOT_ID = "tcgPostBoxRoot";

let installed = false;
let state = {
  uid: "",
  profile: null,
  gifts: [],
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[m]);
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .postBoxBackdrop{
      position:fixed;
      inset:0;
      z-index:2147482500;
      display:grid;
      place-items:center;
      padding:18px;
      background:rgba(0,0,0,.58);
      backdrop-filter:blur(10px);
    }
    .postBoxPanel{
      width:min(520px, 94vw);
      max-height:min(760px, 92vh);
      overflow:auto;
      border-radius:20px;
      border:1px solid rgba(255,255,255,.18);
      background:
        radial-gradient(circle at 12% 0%, rgba(125,211,252,.22), transparent 34%),
        radial-gradient(circle at 100% 20%, rgba(255,213,104,.14), transparent 38%),
        linear-gradient(145deg, rgba(17,24,39,.96), rgba(12,14,20,.96));
      color:#fff;
      box-shadow:0 24px 80px rgba(0,0,0,.55), inset 0 0 36px rgba(255,255,255,.05);
    }
    .postBoxHeader{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:18px 18px 14px;
      border-bottom:1px solid rgba(255,255,255,.10);
    }
    .postBoxTitle{
      display:flex;
      align-items:center;
      gap:11px;
      font-weight:1000;
      letter-spacing:.04em;
      font-size:20px;
    }
    .postBoxIcon{
      width:42px;
      height:42px;
      display:grid;
      place-items:center;
      border-radius:13px;
      border:1px solid rgba(255,255,255,.18);
      background:
        linear-gradient(135deg, rgba(255,215,110,.34), rgba(105,180,255,.20)),
        rgba(255,255,255,.05);
      box-shadow:0 0 28px rgba(255,215,110,.18);
    }
    .postBoxBody{ padding:16px 18px 18px; }
    .postBoxStatus{
      min-height:22px;
      margin-bottom:12px;
      color:rgba(255,255,255,.78);
      font-size:13px;
    }
    .postBoxGiftList{
      display:grid;
      gap:10px;
      margin:12px 0 16px;
    }
    .postGift{
      display:grid;
      grid-template-columns:1fr auto;
      gap:10px;
      align-items:center;
      padding:12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.13);
      background:rgba(255,255,255,.055);
    }
    .postGift b{ display:block; margin-bottom:3px; }
    .postGift small{ color:rgba(255,255,255,.62); }
    .postGiftAmount{
      min-width:86px;
      padding:8px 10px;
      border-radius:999px;
      text-align:center;
      color:#151102;
      font-weight:1000;
      background:linear-gradient(180deg, #fff3a5, #69ffbb);
      box-shadow:0 0 24px rgba(105,255,187,.18);
    }
    .postBoxActions{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
    }
    .postBoxBtn{
      min-height:40px;
      padding:9px 14px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.07);
      color:#fff;
      font-weight:900;
      cursor:pointer;
    }
    .postBoxBtn.primary{
      border-color:rgba(105,255,187,.40);
      background:linear-gradient(135deg, rgba(35,145,105,.74), rgba(55,115,145,.62));
      box-shadow:0 0 22px rgba(105,255,187,.14);
    }
    .postBoxBtn.warn{
      border-color:rgba(255,213,104,.35);
      background:rgba(255,213,104,.10);
    }
    .postBoxAdmin{
      margin-top:18px;
      padding-top:16px;
      border-top:1px solid rgba(255,255,255,.10);
    }
    .postBoxAdmin h3{
      margin:0 0 10px;
      font-size:14px;
      letter-spacing:.04em;
      color:#baff7a;
    }
    .postBoxAdminGrid{
      display:grid;
      grid-template-columns:1fr 120px;
      gap:10px;
    }
    .postBoxInput{
      width:100%;
      min-height:42px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(0,0,0,.28);
      color:#fff;
      padding:8px 11px;
      font:inherit;
      box-sizing:border-box;
    }
    .postBoxInput::placeholder{ color:rgba(255,255,255,.42); }
    @media (max-width:560px){
      .postBoxAdminGrid{ grid-template-columns:1fr; }
      .postBoxActions{ flex-direction:column; }
      .postBoxBtn{ width:100%; }
    }
  `;
  document.head.appendChild(style);
}

function getRoot() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

function setStatus(text, tone = "") {
  const el = document.querySelector("[data-post-status]");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = tone === "ok" ? "#79ffbd" : tone === "err" ? "#ff8a8a" : "rgba(255,255,255,.78)";
}

function visibleGifts() {
  const claimed = state.profile?.claimedOperationGifts || {};
  return state.gifts.filter((gift) => {
    const giftId = String(gift.giftId || gift.id || "").trim();
    return giftId && !claimed[giftId];
  });
}

function renderGiftList() {
  const gifts = visibleGifts();
  if (!gifts.length) {
    return `<div class="postGift"><div><b>いま届いている運営ギフトはありません</b><small>ログインボーナスや配布が届くとここに表示されます。</small></div></div>`;
  }
  return gifts.map((gift) => {
    const amount = Number(gift.amount || 0);
    return `
      <div class="postGift">
        <div>
          <b>${esc(gift.title || "ログインボーナス")}</b>
          <small>${esc(gift.reason || "運営からの配布")}</small>
        </div>
        <span class="postGiftAmount">+${amount} Gems</span>
      </div>
    `;
  }).join("");
}

function render() {
  const isAdmin = state.profile?.isAdmin === true;
  getRoot().innerHTML = `
    <div class="postBoxBackdrop" data-post-backdrop>
      <section class="postBoxPanel" role="dialog" aria-modal="true" aria-label="運営ポスト">
        <header class="postBoxHeader">
          <div class="postBoxTitle"><span class="postBoxIcon">POST</span><span>運営ポスト</span></div>
          <button class="postBoxBtn" type="button" data-post-close>閉じる</button>
        </header>
        <div class="postBoxBody">
          <div class="postBoxStatus" data-post-status>${state.uid ? `uid: ${esc(state.uid.slice(0, 8))}` : "確認中..."}</div>
          <div class="postBoxGiftList" data-post-gifts>${renderGiftList()}</div>
          <div class="postBoxActions">
            <button class="postBoxBtn primary" type="button" data-post-claim>受け取る</button>
            <button class="postBoxBtn" type="button" data-post-refresh>更新</button>
          </div>
          ${isAdmin ? `
            <div class="postBoxAdmin">
              <h3>管理者: 全員向けログインボーナス作成</h3>
              <div class="postBoxAdminGrid">
                <input class="postBoxInput" data-post-title value="ログインボーナス" placeholder="タイトル">
                <input class="postBoxInput" data-post-amount type="number" value="200" min="1" step="10" placeholder="Gems">
                <input class="postBoxInput" data-post-reason value="operation_login_bonus" placeholder="理由">
                <button class="postBoxBtn warn" type="button" data-post-create>全員に配る</button>
              </div>
            </div>
          ` : ""}
        </div>
      </section>
    </div>
  `;
}

async function load() {
  setStatus("確認中...");
  const { uid, data } = await ensureUserProfile();
  state.uid = uid;
  state.profile = data || {};
  state.gifts = await listOperationGifts(20);
  render();
  const count = visibleGifts().length;
  setStatus(count ? `${count}件の運営ギフトがあります` : "受け取り待ちの運営ギフトはありません");
}

async function claim() {
  if (!state.uid) await load();
  setStatus("受け取り中...");
  const pending = await claimPendingAdminGrants(state.uid);
  const operation = await claimOperationGifts(state.uid);
  const gems = Number(operation?.gems || 0);
  const count = Number(pending?.applied || 0) + Number(operation?.applied || 0);
  const message = count > 0
    ? (gems ? `受け取り完了: +${gems} Gems` : "受け取り完了")
    : "受け取れるものはありません";
  const tone = count > 0 ? "ok" : "";
  const refreshed = await ensureUserProfile();
  state.uid = refreshed.uid;
  state.profile = refreshed.data || {};
  state.gifts = await listOperationGifts(20);
  render();
  setStatus(message, tone);
}

async function createGift() {
  if (!state.uid) await load();
  const title = document.querySelector("[data-post-title]")?.value || "ログインボーナス";
  const amount = document.querySelector("[data-post-amount]")?.value || 200;
  const reason = document.querySelector("[data-post-reason]")?.value || "operation_login_bonus";
  setStatus("運営ギフトを作成中...");
  await createOperationGemGift(state.uid, amount, title, reason);
  setStatus("全員向けギフトを作成しました", "ok");
  await load();
}

function close() {
  getRoot().innerHTML = "";
}

export function openPostBox() {
  injectStyle();
  render();
  load().catch((e) => {
    console.warn("[post_box] load failed", e);
    setStatus(e?.message || "ポストの読み込みに失敗しました", "err");
  });
}

export function initPostBox() {
  if (installed) return;
  installed = true;
  injectStyle();
  window.TCGPostBox = { open: openPostBox, close };
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-post-open]")) {
      e.preventDefault();
      openPostBox();
      return;
    }
    if (target.closest("[data-post-close]") || target.matches("[data-post-backdrop]")) {
      e.preventDefault();
      close();
      return;
    }
    if (target.closest("[data-post-refresh]")) {
      e.preventDefault();
      load().catch((err) => setStatus(err?.message || "更新に失敗しました", "err"));
      return;
    }
    if (target.closest("[data-post-claim]")) {
      e.preventDefault();
      claim().catch((err) => setStatus(err?.message || "受け取りに失敗しました", "err"));
      return;
    }
    if (target.closest("[data-post-create]")) {
      e.preventDefault();
      createGift().catch((err) => setStatus(err?.message || "作成に失敗しました", "err"));
    }
  });
}
