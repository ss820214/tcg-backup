// Offline readiness guards for the *not-yet-deployed* economy rules.
// This checks a static policy only. It does NOT simulate Firestore or
// demonstrate that the production backend is protected.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const rules = read("security/v1.2.1_users_server_authority.rules.part");
const gacha = read("public/gacha.js");
const store = read("public/user_store.js");
const v120 = read("docs/V1.2.0_FREE_10_USER_SECURITY.md");

assert.match(rules, /match \/users\/\{uid\}/);
assert.match(rules, /request\.auth\.uid == uid/);
assert.match(rules, /allow create: if false;/);
assert.match(rules, /allow delete: if false;/);
assert.match(rules, /allow list: if false;/);
assert.match(rules, /allow update: if isSelf\(\) && protectedFieldsUnchanged\(\);/);
assert.match(rules, /request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)/);
for (const field of [
  "uid", "isAdmin", "gems", "pity", "gachaPity", "ownedCounts",
  "claimedAdminGrants", "claimedOperationGifts", "stats", "starterOwnedVersion",
]) {
  assert.ok(rules.includes("'" + field + "'"), "missing protected profile field: " + field);
}
// These checks prevent premature activation while browser-authoritative logic
// remains in use. If these assertions change, update migration instructions.
assert.match(gacha, /function buildPullPlan\(/);
assert.match(gacha, /async function doGacha\(/);
assert.match(gacha, /tx\.set\(\s*userRef,/);
assert.match(store, /export async function recordMatchResult\(/);
assert.match(store, /export async function ensureUserProfile\(/);
assert.match(v120, /本人のジェム・Growth・所持カードの自由な書き換え/);
console.log("Economy authority staging contract: 22 assertions passed; not deployed.");
