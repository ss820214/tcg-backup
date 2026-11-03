// Offline test for Firebase email enumeration protection + admin UID safety.
// This never sends a request to Firebase.
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../public/login.js", import.meta.url), "utf8");
const name = "async function linkAdminEmailWithPrivacyProtection(user, email, password) {";
const a = source.indexOf(name);
const b = source.indexOf("\n// Step 1:", a);
assert.ok(a >= 0 && b > a, "admin privacy-link helper must exist");
const helper = source.slice(a, b);
assert.match(source, /verify the new email before changing email/i);
assert.match(source, /await linkAdminEmailWithPrivacyProtection\(user, email, password\)/);

function scenario(payload, { status = true, failSignIn = false } = {}) {
  const calls = [];
  let signIns = 0;
  const auth = { currentUser: { uid: "existing-admin-uid" } };
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    return { ok: status, json: async () => payload };
  };
  const signInWithEmailAndPassword = async (_, email, password) => {
    signIns++;
    if (failSignIn) throw Object.assign(new Error("sign-in error"), { code: "auth/invalid-credential" });
    assert.equal(email, "admin@example.test");
    assert.equal(password, "strong-password");
    return { user: { uid: "existing-admin-uid" } };
  };
  const make = new Function("fetch", "firebaseConfig", "auth", "signInWithEmailAndPassword",
    helper + "\nreturn linkAdminEmailWithPrivacyProtection;");
  const link = make(fetch, { apiKey: "TEST_API_KEY" }, auth, signInWithEmailAndPassword);
  const admin = {
    uid: "existing-admin-uid", isAnonymous: true,
    getIdToken: async () => "old-account-id-token",
  };
  return { calls, auth, admin, link, getSignIns: () => signIns };
}

{
  const c = scenario({ localId: "existing-admin-uid" });
  const result = await c.link(c.admin, "admin@example.test", "strong-password");
  assert.equal(result.uid, c.admin.uid);
  assert.equal(c.getSignIns(), 1);
  assert.match(c.calls[0].url, /identitytoolkit\.googleapis\.com\/v1\/accounts:signUp\?key=/);
  assert.equal(c.calls[0].init.method, "POST");
  assert.deepEqual(c.calls[0].body, {
    idToken: "old-account-id-token",
    email: "admin@example.test",
    password: "strong-password",
    returnSecureToken: true,
  });
  assert.equal(c.calls[0].init.credentials, "omit");
}
{
  const c = scenario({ localId: "other-uid" });
  await assert.rejects(c.link(c.admin, "admin@example.test", "strong-password"), /UID/);
  assert.equal(c.getSignIns(), 0, "UID mismatch must not switch Firebase session");
}
{
  const c = scenario({ error: { message: "EMAIL_EXISTS" } }, { status: false });
  await assert.rejects(c.link(c.admin, "admin@example.test", "strong-password"), /既にFirebase/);
  assert.equal(c.getSignIns(), 0);
}
{
  const c = scenario({ localId: "existing-admin-uid" }, { failSignIn: true });
  await assert.rejects(c.link(c.admin, "admin@example.test", "strong-password"), /ブラウザデータは削除せず/);
}

console.log("admin email link regression: 4 scenarios passed");
