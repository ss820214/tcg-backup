// Safety checks for retiring public plaintext administrator credentials.
// Run: node tools/admin_auth_regression_20261103.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");
const login = read("public/login.js");
const html = read("public/login.html");
const auth = read("public/auth.js");
const deck = read("public/deck.js");
const creator = read("public/creator.js");
const rarity = read("public/rarity_admin.js");
const editor = read("public/card_editor.js");
const userStore = read("public/user_store.js");

assert.doesNotMatch(login, /\bADMIN_(?:NAME|PIN)\b/);
assert.doesNotMatch(login, /\bconst\s+isAdmin\s*=\s*name\s*===/);
assert.doesNotMatch(login, /\bisAdmin\s*:\s*!!isAdmin\b/);
assert.doesNotMatch(login, /setDoc\(ref,\s*\{\s*name,\s*isAdmin\s*:/);
assert.match(login, /\bEmailAuthProvider\.credential\(email, password\)/);
assert.match(login, /\blinkWithCredential\(user, EmailAuthProvider\.credential/);
assert.match(login, /\bif \(auth\.currentUser\?\.uid !== beforeUid\)/);
assert.match(login, /\bsignInWithEmailAndPassword\(probeAuth, email, password\)/);
assert.match(login, /\binMemoryPersistence\b/);
assert.match(login, /\bif \(!probeSnap\.exists\(\) \|\| probeSnap\.data\(\)\?\.isAdmin !== true\)/);
assert.match(html, /id="btnAdminLink"/);
assert.match(html, /id="btnAdminLogin"/);
assert.match(html, /type="password"/);
assert.match(deck, /const session = await getAdminSession\(\)/);
assert.match(creator, /const adminSession = await getAdminSession\(\)/);
assert.match(rarity, /const adminSession = await getAdminSession\(\)/);
assert.doesNotMatch(rarity, /ADMIN_OK_LOCAL/);
assert.match(editor, /await requireEditorAdmin\(\)/);
assert.match(userStore, /const session = await getAdminSession\(\)/);

const start = auth.indexOf("export async function getAdminSession() {");
const end = auth.indexOf("\n}", start) + 2;
assert.ok(start >= 0 && end > start);
const helper = auth.slice(start, end).replace(/^export /, "");
const make = (u, role) => {
  let reads = 0;
  const fn = new Function("ensureSignedIn", "doc", "getDoc", "db", 
    helper + "\nreturn getAdminSession;");
  const functionUnderTest = fn(
    async () => u,
    (_db, coll, uid) => coll + "/" + uid,
    async (ref) => {
      reads++;
      assert.equal(ref, "users/test-uid");
      return { exists: () => true, data: () => ({ isAdmin: role }) };
    },
    {},
  );
  return { get: functionUnderTest, reads: () => reads };
};
{
  const env = make({ uid: "test-uid", isAnonymous: true, providerData: [] }, true);
  const result = await env.get();
  assert.equal(result.isAdmin, false);
  assert.equal(result.linkedEmail, false);
  assert.equal(env.reads(), 0);
}
{
  const env = make({ uid: "test-uid", isAnonymous: false, providerData: [{ providerId: "password" }] }, false);
  assert.equal((await env.get()).isAdmin, false);
}
{
  const env = make({ uid: "test-uid", isAnonymous: false, providerData: [{ providerId: "password" }] }, true);
  const result = await env.get();
  assert.equal(result.isAdmin, true);
  assert.equal(result.linkedEmail, true);
  assert.equal(result.uid, "test-uid");
}

console.log("admin Firebase email migration: 3 simulated sessions and client regressions passed");
