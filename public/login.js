// public/login.js
// v20260627_login1

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInAnonymously,
  onAuthStateChanged,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  inMemoryPersistence,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getAdminSession } from "./auth.js?v=20261103_email_admin1";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};


const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const el = {
  form: $("loginForm"),
  name: $("name"),
  pin: $("pin"),
  msg: $("msg"),
  authState: $("authState"),
  uidView: $("uidView"),
  savedName: $("savedName"),
  tabLogin: $("tabLogin"),
  tabRegister: $("tabRegister"),
  btnSubmit: $("btnSubmit"),
  btnSuggest: $("btnSuggest"),
  btnUseSaved: $("btnUseSaved"),
  btnBack: $("btnBack"),
  adminEmail: $("adminEmail"),
  adminPassword: $("adminPassword"),
  adminMsg: $("adminMsg"),
  btnAdminLink: $("btnAdminLink"),
  btnAdminLogin: $("btnAdminLogin"),
};

let mode = "login";

function setMessage(msg, kind = "") {
  if (!el.msg) return;
  el.msg.textContent = msg || "";
  el.msg.className = `message ${kind}`.trim();
}

function setBusy(busy) {
  [el.btnSubmit, el.btnSuggest, el.btnUseSaved, el.tabLogin, el.tabRegister, el.btnAdminLink, el.btnAdminLogin].forEach((b) => {
    if (b) b.disabled = !!busy;
  });
}

function normName(s) {
  const t = String(s ?? "").trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(t)) return null;
  return t;
}

function normPin(s) {
  const t = String(s ?? "").trim();
  if (!/^\d{4,8}$/.test(t)) return null;
  return t;
}

function setMode(next) {
  mode = next === "register" ? "register" : "login";
  el.tabLogin?.setAttribute("aria-selected", mode === "login" ? "true" : "false");
  el.tabRegister?.setAttribute("aria-selected", mode === "register" ? "true" : "false");
  if (el.btnSubmit) el.btnSubmit.textContent = mode === "register" ? "IDを登録する" : "ログインする";
  setMessage(
    mode === "register"
      ? "新しいプレイヤーIDをこの端末に登録します。既にIDがある場合はログインを使ってください。"
      : "登録済みのプレイヤーIDとPINで入ります。未登録IDは自動作成しません。",
  );
}

function refreshSavedView() {
  const saved = localStorage.getItem("playerName") || "";
  const uid = localStorage.getItem("uid") || localStorage.getItem("anonUid") || auth.currentUser?.uid || "";
  if (el.savedName) el.savedName.textContent = saved || "なし";
  if (el.uidView) el.uidView.textContent = uid ? uid.slice(0, 12) : "未接続";
}

function suggestId() {
  const n = Math.floor(1000 + Math.random() * 9000);
  const candidates = [
    `player_${n}`,
    `obato_${n}`,
    `duelist_${n}`,
  ];
  el.name.value = candidates[Math.floor(Math.random() * candidates.length)];
  el.name.focus();
}

function useSavedId() {
  const saved = localStorage.getItem("playerName") || "";
  if (!saved) {
    setMessage("保存済みIDがありません。新規登録から作成してください。", "bad");
    return;
  }
  el.name.value = saved;
  setMode("login");
  el.pin.focus();
}

function safeReturnUrl() {
  const ret = new URLSearchParams(location.search).get("return");
  if (!ret) return "";
  try {
    const url = new URL(ret, location.href);
    if (url.origin !== location.origin) return "";
    return url.href;
  } catch {
    return "";
  }
}

function moveNext(uid) {
  const ret = safeReturnUrl();
  if (ret) {
    location.href = ret;
    return;
  }
  location.href = `./index.html?uid=${encodeURIComponent(uid)}`;
}

const te = new TextEncoder();

function b64(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function b64ToBytes(s) {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function pbkdf2Hash(pin, saltBytes) {
  const keyMat = await crypto.subtle.importKey(
    "raw",
    te.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations: 120000,
    },
    keyMat,
    256,
  );
  return b64(bits);
}

function newSaltB64() {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

async function ensureAnonSignedIn() {
  await setPersistence(auth, browserLocalPersistence);
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return auth.currentUser;
}

async function writeProfile(uid, name, pin) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const saltB64 = newSaltB64();
  const pinHash = await pbkdf2Hash(pin, b64ToBytes(saltB64));
  await setDoc(
    ref,
    {
      uid,
      name,
      salt: saltB64,
      pinHash,
      updatedAt: serverTimestamp(),
      ...(snap.exists() ? {} : {
        gems: 2400,
        pity: 0,
        stats: { matches: 0, wins: 0, losses: 0 },
        createdAt: serverTimestamp(),
      }),
    },
    { merge: true },
  );
}

async function loginProfile(uid, name, pin) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return {
      ok: false,
      reason: "この端末にはまだIDが登録されていません。新規登録タブから作成してください。",
    };
  }

  const data = snap.data() || {};
  if (!data.salt || !data.pinHash) {
    return {
      ok: false,
      reason: "登録データが古い形式です。新規登録でPINを設定し直してください。",
    };
  }

  if (String(data.name || "") !== name) {
    return { ok: false, reason: "プレイヤーIDが一致しません。" };
  }

  const nowHash = await pbkdf2Hash(pin, b64ToBytes(data.salt));
  if (nowHash !== data.pinHash) {
    return { ok: false, reason: "PINが違います。" };
  }

  await setDoc(ref, { name, updatedAt: serverTimestamp() }, { merge: true });
  return { ok: true, mode: "login", isAdmin: (await getAdminSession()).isAdmin };
}

async function registerProfile(uid, name, pin) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() || {};
    const hasLogin = !!data.salt && !!data.pinHash && !!data.name;
    if (!hasLogin) {
      await writeProfile(uid, name, pin);
      return { ok: true, mode: "register-upgrade", isAdmin: false };
    }
    return {
      ok: false,
      reason: `この端末には既にIDがあります: ${data.name || "unknown"}\n別IDに変える場合は、確認してから登録し直してください。`,
    };
  }

  await writeProfile(uid, name, pin);
  return { ok: true, mode: "register", isAdmin: false };
}

function saveLocalProfile(uid, name, isAdmin) {
  localStorage.setItem("playerName", name);
  localStorage.setItem("uid", uid);
  localStorage.setItem("anonUid", uid);
  localStorage.setItem("profileLinked", "1");
  localStorage.setItem("isAdmin", isAdmin ? "1" : "0");
  // An old localStorage admin flag is not a valid authorization signal.
  localStorage.removeItem("tcg_admin_ok_v1");
}

async function runAuth() {
  try {
    setBusy(true);
    setMessage(mode === "register" ? "IDを登録しています..." : "ログインしています...");

    const name = normName(el.name?.value);
    const pin = normPin(el.pin?.value);
    if (!name) throw new Error("プレイヤーIDは英数字と _ の3〜16文字にしてください。");
    if (!pin) throw new Error("PINは数字4〜8桁にしてください。");

    const user = await ensureAnonSignedIn();
    const uid = user?.uid;
    if (!uid) throw new Error("UIDの取得に失敗しました。");

    const res = mode === "register"
      ? await registerProfile(uid, name, pin)
      : await loginProfile(uid, name, pin);

    if (!res.ok) throw new Error(res.reason || "認証に失敗しました。");

    saveLocalProfile(uid, name, res.isAdmin);
    refreshSavedView();
    setMessage(
      `OK: ${res.mode}\nID: ${name}\nRole: ${res.isAdmin ? "admin" : "user"}\nデッキ画面へ移動します...`,
      "ok",
    );
    setTimeout(() => moveNext(uid), 350);
  } catch (e) {
    setMessage(String(e?.message || e), "bad");
    setBusy(false);
  }
}


function adminMessage(message, kind = "") {
  if (!el.adminMsg) return;
  el.adminMsg.textContent = message;
  el.adminMsg.className = `message ${kind}`.trim();
}

function adminCredentials() {
  const email = String(el.adminEmail?.value || "").trim();
  const password = String(el.adminPassword?.value || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("管理者メールアドレスを確認してください。");
  }
  if (password.length < 12) {
    throw new Error("管理者パスワードは12文字以上にしてください。");
  }
  return { email, password };
}

function forgetAdminPassword() {
  if (el.adminPassword) el.adminPassword.value = "";
}

// Step 1: upgrade the EXISTING anonymous admin account. Linking rather than
// creating a new Firebase user keeps the UID, inventory, gems, and card edits.
async function linkAdminEmail() {
  try {
    setBusy(true);
    adminMessage("現在の管理者アカウントを確認中...");
    const user = await ensureAnonSignedIn();
    const beforeUid = user.uid;
    const snap = await getDoc(doc(db, "users", beforeUid));
    if (!snap.exists() || snap.data()?.isAdmin !== true) {
      throw new Error("この端末のUIDは既存の管理者ではありません。元の管理者端末から操作してください。");
    }
    if (user.providerData?.some((p) => p.providerId === "password")) {
      throw new Error("このUIDは既にメール連携済みです。メールでログインしてください。");
    }
    const { email, password } = adminCredentials();
    await linkWithCredential(user, EmailAuthProvider.credential(email, password));
    if (auth.currentUser?.uid !== beforeUid) {
      throw new Error("UIDが変わりました。管理者設定を確認してください。");
    }
    const session = await getAdminSession();
    if (!session.isAdmin) throw new Error("メール連携後の管理者状態を確認できませんでした。");
    saveLocalProfile(beforeUid, snap.data()?.name || localStorage.getItem("playerName") || "admin", true);
    adminMessage(`メール認証の連携成功。UIDを維持できました。\nUID: ${beforeUid}\n次はFirebaseルールの管理者UIDをこの値に切り替えてください。`, "ok");
    refreshSavedView();
  } catch (e) {
    adminMessage(`連携できませんでした: ${e?.message || e}\n既存UIDを失わないよう、ブラウザデータは消さないでください。`, "bad");
  } finally {
    forgetAdminPassword();
    setBusy(false);
  }
}

// Probe email login with a separate in-memory Auth instance so an invalid or
// non-admin email can never replace the current anonymous player's UID.
async function loginAdminEmail() {
  let probeAuth = null;
  try {
    setBusy(true);
    adminMessage("管理者メール認証を確認中...");
    const { email, password } = adminCredentials();
    const probeName = "0bato-admin-login-probe";
    const probeApp = getApps().find((a) => a.name === probeName)
      || initializeApp(firebaseConfig, probeName);
    probeAuth = getAuth(probeApp);
    await setPersistence(probeAuth, inMemoryPersistence);
    const probe = await signInWithEmailAndPassword(probeAuth, email, password);
    const probeDb = getFirestore(probeApp);
    const probeSnap = await getDoc(doc(probeDb, "users", probe.user.uid));
    if (!probeSnap.exists() || probeSnap.data()?.isAdmin !== true) {
      throw new Error("このメールアカウントには管理者権限がありません。");
    }
    const uid = probe.user.uid;
    await signOut(probeAuth);
    probeAuth = null;

    // Switching the primary Auth identity happens only after the probe passes.
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user.uid !== uid) throw new Error("UID確認に失敗しました。");
    const session = await getAdminSession();
    if (!session.isAdmin) throw new Error("管理者権限の確認に失敗しました。");
    saveLocalProfile(uid, probeSnap.data()?.name || "admin", true);
    refreshSavedView();
    adminMessage(`管理者ログイン成功。UID: ${uid}\n画面へ移動します。`, "ok");
    setTimeout(() => moveNext(uid), 350);
  } catch (e) {
    adminMessage(`管理者ログイン失敗: ${e?.message || e}`, "bad");
  } finally {
    if (probeAuth?.currentUser) await signOut(probeAuth).catch(() => {});
    forgetAdminPassword();
    setBusy(false);
  }
}

function wire() {
  el.btnAdminLink?.addEventListener("click", linkAdminEmail);
  el.btnAdminLogin?.addEventListener("click", loginAdminEmail);
  el.tabLogin?.addEventListener("click", () => setMode("login"));
  el.tabRegister?.addEventListener("click", () => setMode("register"));
  el.btnSuggest?.addEventListener("click", suggestId);
  el.btnUseSaved?.addEventListener("click", useSavedId);
  el.btnBack?.addEventListener("click", () => {
    location.href = safeReturnUrl() || "./index.html";
  });
  el.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    runAuth();
  });
}

wire();
setMode("login");
refreshSavedView();

onAuthStateChanged(auth, (u) => {
  if (el.authState) el.authState.textContent = u?.uid ? `uid:${u.uid.slice(0, 8)}` : "未接続";
  refreshSavedView();
});

ensureAnonSignedIn()
  .then(() => {
    if (el.authState && auth.currentUser?.uid) el.authState.textContent = `uid:${auth.currentUser.uid.slice(0, 8)}`;
    refreshSavedView();
  })
  .catch((err) => {
    setMessage(`Auth接続に失敗しました: ${err?.message || err}`, "bad");
  });
