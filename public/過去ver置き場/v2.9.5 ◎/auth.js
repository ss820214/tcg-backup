// public/auth.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

// 既に初期化済みでも落ちないように
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 匿名ログインを保証して user を返す
export async function ensureSignedIn() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) return resolve(user);
      await signInAnonymously(auth);
      resolve(auth.currentUser);
    });
  });
}