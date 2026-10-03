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
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const ADMIN_NAME = "admin0217";
const ADMIN_PIN = "0745";

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
};

let mode = "login";

function setMessage(msg, kind = "") {
  if (!el.msg) return;
  el.msg.textContent = msg || "";
  el.msg.className = `message ${kind}`.trim();
}

function setBusy(busy) {
  [el.btnSubmit, el.btnSuggest, el.btnUseSaved, el.tabLogin, el.tabRegister].forEach((b) => {
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

function moveNext(uid) {
  const ret = new URLSearchParams(location.search).get("return");
  if (ret) {
    location.href = decodeURIComponent(ret);
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

async function writeProfile(uid, name, pin, isAdmin) {
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
      isAdmin: !!isAdmin,
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
  const isAdmin = name === ADMIN_NAME && pin === ADMIN_PIN;

  if (isAdmin) {
    await writeProfile(uid, name, pin, true);
    return { ok: true, mode: snap.exists() ? "admin-login" : "admin-register", isAdmin: true };
  }

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

  await setDoc(ref, { name, isAdmin: false, updatedAt: serverTimestamp() }, { merge: true });
  return { ok: true, mode: "login", isAdmin: false };
}

async function registerProfile(uid, name, pin) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const isAdmin = name === ADMIN_NAME && pin === ADMIN_PIN;

  if (isAdmin) {
    await writeProfile(uid, name, pin, true);
    return { ok: true, mode: snap.exists() ? "admin-overwrite" : "admin-register", isAdmin: true };
  }

  if (snap.exists()) {
    const data = snap.data() || {};
    const hasLogin = !!data.salt && !!data.pinHash && !!data.name;
    if (!hasLogin) {
      await writeProfile(uid, name, pin, false);
      return { ok: true, mode: "register-upgrade", isAdmin: false };
    }
    return {
      ok: false,
      reason: `この端末には既にIDがあります: ${data.name || "unknown"}\n別IDに変える場合は、確認してから登録し直してください。`,
    };
  }

  await writeProfile(uid, name, pin, false);
  return { ok: true, mode: "register", isAdmin: false };
}

function saveLocalProfile(uid, name, isAdmin) {
  localStorage.setItem("playerName", name);
  localStorage.setItem("uid", uid);
  localStorage.setItem("anonUid", uid);
  localStorage.setItem("profileLinked", "1");
  localStorage.setItem("isAdmin", isAdmin ? "1" : "0");
  if (isAdmin) localStorage.setItem("tcg_admin_ok_v1", "1");
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

function wire() {
  el.tabLogin?.addEventListener("click", () => setMode("login"));
  el.tabRegister?.addEventListener("click", () => setMode("register"));
  el.btnSuggest?.addEventListener("click", suggestId);
  el.btnUseSaved?.addEventListener("click", useSavedId);
  el.btnBack?.addEventListener("click", () => {
    const ret = new URLSearchParams(location.search).get("return");
    location.href = ret ? decodeURIComponent(ret) : "./index.html";
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
