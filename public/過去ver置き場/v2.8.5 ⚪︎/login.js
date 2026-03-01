// login.js の一番上
document.getElementById("msg").textContent = "login.js loaded";
console.log("login.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
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

// ✅ ここは game.js と同じ firebaseConfig をコピペして揃えてください
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---- DOM
const $name = document.getElementById("name");
const $pin = document.getElementById("pin");
const $btn = document.getElementById("btn");
const $msg = document.getElementById("msg");

function show(msg) {
  $msg.textContent = msg || "";
}
function normName(s) {
  const t = String(s ?? "").trim();
  // 例：英数/_ 3〜16（必要なら日本語OKに変えて）
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(t)) return null;
  return t;
}
function normPin(s) {
  const t = String(s ?? "").trim();
  if (!/^\d{4,8}$/.test(t)) return null;
  return t;
}

// ---- Crypto helpers (PBKDF2-SHA256)
const te = new TextEncoder();
function b64(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
function b64ToBytes(s) {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
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
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 120000 },
    keyMat,
    256,
  );
  return b64(bits);
}
function newSaltB64() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return b64(salt);
}

async function ensureAnonSignedIn() {
  await setPersistence(auth, browserLocalPersistence);
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return auth.currentUser;
}

async function upsertProfile(uid, name, pin) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // 初回登録
    const saltB64 = newSaltB64();
    const saltBytes = b64ToBytes(saltB64);
    const pinHash = await pbkdf2Hash(pin, saltBytes);

    await setDoc(
      ref,
      {
        name,
        salt: saltB64,
        pinHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true, mode: "register" };
  }

  // 既存：PIN照合
  const data = snap.data() || {};
  const saltB64 = data.salt;
  const stored = data.pinHash;

  if (!saltB64 || !stored) {
    // 旧データ救済：salt無しなら再登録扱い
    const newSalt = newSaltB64();
    const pinHash = await pbkdf2Hash(pin, b64ToBytes(newSalt));
    await setDoc(
      ref,
      { name, salt: newSalt, pinHash, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true, mode: "repair" };
  }

  const nowHash = await pbkdf2Hash(pin, b64ToBytes(saltB64));
  if (nowHash !== stored) return { ok: false, reason: "PINが違います" };

  // OK：名前だけ更新（必要なら固定にしてもいい）
  await setDoc(ref, { name, updatedAt: serverTimestamp() }, { merge: true });
  return { ok: true, mode: "login" };
}

async function onSubmit(){
  try {
    show("サインイン中…");
    $btn.disabled = true;

    const name = normName($name.value);
    const pin = normPin($pin.value);
    if (!name) throw new Error("名前は英数/_ の3〜16文字にしてください");
    if (!pin) throw new Error("PINは数字4〜8桁にしてください");

    const user = await ensureAnonSignedIn();
    const uid = user.uid;

    show("照合中…");
    const res = await upsertProfile(uid, name, pin);
    if (!res.ok) throw new Error(res.reason || "ログイン失敗");

    localStorage.setItem("playerName", name);
    localStorage.setItem("uid", uid);
    localStorage.setItem("profileLinked", "1");

    show(`OK (${res.mode})\nuid=${uid}\n移動します…`);

    const ret = new URLSearchParams(location.search).get("return");
    if (ret) location.href = decodeURIComponent(ret);
    else location.href = `./index.html?uid=${encodeURIComponent(uid)}`; // ★相対に（/index.html だと環境で死ぬ）
  } catch (e) {
    show(String(e?.message || e));
    $btn.disabled = false;
  }
}

// クリック＋iOS向け
$btn.addEventListener("click", (e)=>{ e.preventDefault(); onSubmit(); });
$btn.addEventListener("pointerup", (e)=>{ e.preventDefault(); onSubmit(); });

// Enterキー（最初から有効にする）
[$name, $pin].forEach((el) => {
  el?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSubmit();
  });
});

// 起動時：匿名ログインだけ先に準備
onAuthStateChanged(auth, (u) => {
  if (u) show("匿名サインインOK。名前/PINを入力してください。");
});
ensureAnonSignedIn().catch((err) => show("Auth失敗: " + err));
