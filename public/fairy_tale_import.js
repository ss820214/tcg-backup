// public/fairy_tale_import.js
// v20260701_fairy_unit1

import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { db, ensureSignedIn } from "./auth.js?v=20260627_user1";
import {
  FAIRY_TALE_CARD_LIST,
  FAIRY_TALE_ATTRS,
  FAIRY_TALE_CARD_COUNT,
} from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";

const $ = (id) => document.getElementById(id);
const summaryEl = $("summary");
const statusEl = $("status");
const listEl = $("list");
const uploadBtn = $("uploadBtn");
const copyJsonBtn = $("copyJsonBtn");
const loginBtn = $("loginBtn");
const ADMIN_OK_LOCAL = "tcg_admin_ok_v1";

if (loginBtn) {
  loginBtn.href = `./login.html?return=${encodeURIComponent(location.href)}`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function cardsJson() {
  return JSON.stringify(
    FAIRY_TALE_CARD_LIST.map(({ id, ...data }) => ({ id, ...data })),
    null,
    2,
  );
}

function isLocalAdminUnlocked() {
  try {
    return localStorage.getItem(ADMIN_OK_LOCAL) === "1";
  } catch {
    return false;
  }
}

async function getAdminInfo() {
  const localUnlocked = isLocalAdminUnlocked();
  const user = await ensureSignedIn();
  const uid = user?.uid || "";
  if (!uid) return { uid: "", isAdmin: false, localUnlocked, data: null };

  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() || {} : null;
    return { uid, isAdmin: data?.isAdmin === true, localUnlocked, data };
  } catch (e) {
    return { uid, isAdmin: false, localUnlocked, data: null, error: e };
  }
}

function adminHelpText(admin) {
  const uid = admin.uid || "-";
  const target = `users/${admin.uid || "{uid}"}.isAdmin`;

  if (admin.localUnlocked) {
    return (
      `端末の管理者ロックは解除済みですが、Firestore投入用のUID権限がまだありません。\n` +
      `uid: ${uid}\n` +
      `${target} が true になるよう、上の「管理ログイン」から管理者IDで入り直してください。\n\n` +
      `補足: 設定画面の管理者解除はローカル機能用、Firestore rules は users/{uid}.isAdmin を見ています。`
    );
  }

  return (
    `管理者権限が未確認です。\n` +
    `uid: ${uid}\n` +
    `Firestore投入には ${target}=true が必要です。\n\n` +
    `上の「管理ログイン」から管理者IDで入るか、設定画面の管理者解除も確認してください。`
  );
}

function render() {
  const counts = Object.fromEntries(FAIRY_TALE_ATTRS.map((a) => [a, 0]));
  for (const c of FAIRY_TALE_CARD_LIST) counts[c.type] = (counts[c.type] || 0) + 1;

  summaryEl.textContent =
    `${FAIRY_TALE_CARD_COUNT}枚 / ${FAIRY_TALE_ATTRS.length}属性\n` +
    FAIRY_TALE_ATTRS.map((a) => `${a}:${counts[a] || 0}`).join("  ");

  listEl.innerHTML = FAIRY_TALE_CARD_LIST.map((c) => {
    const acts = (c.actions || [])
      .map((a) => `【${esc(a.cost)}】${esc(a.name)} / ${esc(a.range)} / ${esc(a.rate)}% / HP${esc(a.hpDelta)} SP${esc(a.spDelta ?? 0)}`)
      .join("<br>");
    return `
      <article class="card">
        <div class="top">
          <div class="name">【${esc(c.cost)}】${esc(c.name)}</div>
          <span class="pill">${esc(c.type)} ${esc(c.rarity)}</span>
        </div>
        <div class="meta">HP:${esc(c.hp)} / SP:${esc(c.sp)} / kind:${esc(c.kind)}</div>
        <div class="id">${esc(c.id)}</div>
        <div class="desc">${esc(c.desc)}</div>
        <div class="acts">${acts}</div>
      </article>
    `;
  }).join("");
}

async function upload() {
  const ok = confirm(
    `童話カード ${FAIRY_TALE_CARD_COUNT}枚を Firestore cards に保存します。\n` +
      "同じIDのカードは merge 更新されます。実行しますか？",
  );
  if (!ok) return;

  uploadBtn.disabled = true;
  setStatus("サインイン確認中...");

  try {
    const admin = await getAdminInfo();
    if (!admin.isAdmin) {
      setStatus(
        `権限不足で投入できません。\n\n` +
          `${adminHelpText(admin)}\n\n` +
          `童話カードはJS側ではすでにローカル反映済みです。Firestoreへ本登録したい場合だけ管理者権限が必要です。`,
        "bad",
      );
      return;
    }

    setStatus(`uid:${admin.uid}\n管理者確認OK\n投入開始...`);

    let done = 0;
    for (const card of FAIRY_TALE_CARD_LIST) {
      const { id, ...data } = card;
      await setDoc(
        doc(db, "cards", id),
        {
          ...data,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      done += 1;
      setStatus(`投入中... ${done}/${FAIRY_TALE_CARD_COUNT}\n最後: ${id}`);
    }

    setStatus(`投入完了！ ${done}/${FAIRY_TALE_CARD_COUNT}枚`, "good");
  } catch (e) {
    console.error(e);
    setStatus(`投入失敗\n${e?.message || e}`, "bad");
  } finally {
    uploadBtn.disabled = false;
  }
}

async function copyJson() {
  const text = cardsJson();
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`童話カードJSONをコピーしました。\n${FAIRY_TALE_CARD_COUNT}枚`, "good");
  } catch (e) {
    console.warn(e);
    setStatus(`クリップボードへコピーできませんでした。\nConsole の window.__fairyTaleCardsJson から取得できます。`, "bad");
  }
}

render();
getAdminInfo().then((admin) => {
  if (admin.isAdmin) {
    setStatus(`管理者UID確認OK\nuid: ${admin.uid}`, "good");
    return;
  }
  setStatus(`未投入 / 管理者権限未確認\n\n${adminHelpText(admin)}`);
});
try {
  window.__fairyTaleCards = FAIRY_TALE_CARD_LIST;
  window.__fairyTaleCardsJson = cardsJson();
} catch {}
uploadBtn?.addEventListener("click", upload);
copyJsonBtn?.addEventListener("click", copyJson);
