// public/auth.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
  const current = await new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
  if (current) return current;
  const result = await signInAnonymously(auth);
  return result.user;
}


// UI authorization check only: Firestore Security Rules must independently
// authorize card writes by the owner's exact Firebase Auth UID (or a server-
// issued custom claim). Never trust a localStorage flag or a PIN in browser JS.
export async function getAdminSession() {
  const user = await ensureSignedIn();
  const linkedEmail = !user.isAnonymous &&
    user.providerData?.some((provider) => provider.providerId === "password");
  if (!linkedEmail) return { uid: user.uid, isAdmin: false, linkedEmail: false };

  // A signed-in user can only read their own users/{uid} document under
  // the existing rules. This read is for displaying/admin UI gating only.
  const snap = await getDoc(doc(db, "users", user.uid));
  return {
    uid: user.uid,
    isAdmin: snap.exists() && snap.data()?.isAdmin === true,
    linkedEmail: true,
  };
}
