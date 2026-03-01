// public/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function ensureSignedIn(){
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) return resolve(user);
      await signInAnonymously(auth); // 自動で匿名ログイン  [oai_citation:2‡Firebase](https://firebase.google.com/docs/auth/web/anonymous-auth?utm_source=chatgpt.com)
      resolve(auth.currentUser);
    });
  });
}