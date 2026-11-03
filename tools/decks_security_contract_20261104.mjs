// Source-level compatibility contract for the Firestore decks permission patch.
// These assertions do NOT substitute for a Firestore Emulator rules test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const rules = read("security/firestore_decks_lockdown_20261104.rules.part");
const lib = read("public/deck_library.js");
const store = read("public/user_store.js");

// A normal deck must always carry an Auth UID in its ownerUid.
assert.match(lib, /ownerUid: uid/);
assert.match(lib, /docType: "deck"/);
assert.match(rules, /data\.get\('ownerUid', ''\) == request\.auth\.uid/);
assert.match(rules, /ownDeck\(oldData\) && ownDeck\(newData\)/);

// User-name indexes must not be writable for another player's UID.
assert.match(store, /type: "user_name_index"/);
assert.match(rules, /data\.get\('targetUid', ''\) == request\.auth\.uid/);
assert.match(rules, /ownNameIndex\(oldData\) && ownNameIndex\(newData\)/);

// Both money-generating ticket types must require admin authentication.
assert.match(store, /type: "admin_grant"/);
assert.match(store, /type: "operation_gift"/);
assert.match(rules, /data\.get\('type', ''\) in \['admin_grant', 'operation_gift'\]/);
assert.match(rules, /return isAdmin\(\)/);
assert.match(rules, /data\.get\('adminUid', ''\) == request\.auth\.uid/);

// Never allow changing the document type from an ordinary deck to a grant.
assert.match(rules, /adminGrant\(oldData\) && adminGrant\(newData\)/);
assert.match(rules, /oldData\.get\('type', ''\) == newData\.get\('type', ''\)/);
assert.doesNotMatch(rules, /allow write:\s*if\s*signedIn\(\)/);
assert.match(rules, /allow create: if canWriteNew\(request\.resource\.data\)/);
assert.match(rules, /allow update: if canUpdate\(resource\.data, request\.resource\.data\)/);

console.log("decks security contract: 17 static source assertions passed (not emulator-tested)");
