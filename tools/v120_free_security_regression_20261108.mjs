// v1.2.0 regression for the free/Spark 10-user hardening release.
// Source-level tests only. These do not claim to test deployed Firestore Rules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const hosting = JSON.parse(read("firebase.json"));
const rules = read("security/v1.2.0_decks.rules.part");
const gacha = read("public/gacha.js");
const store = read("public/user_store.js");
const lib = read("public/deck_library.js");
const libCore = read("public/deck_library_core_20261005.js");
const play = read("public/play.js");
const home = read("public/index.html");
const deck = read("public/deck.js");
const playHtml = read("public/play.html");

assert.match(home, /id="deckVersionPill">v1\.2\.0/);
assert.match(deck, /"V1\.2\.0"/);
assert.match(home, /deck\.js\?v=20261108_v120_free10_security/);

// Browser defense headers must be included without overriding the existing
// no-cache rules, and no new billable Firebase products are configured.
const globalHeaders = hosting.hosting.headers.find(h => h.source === "**")?.headers || [];
const val = key => globalHeaders.find(h => h.key === key)?.value || "";
assert.equal(val("X-Content-Type-Options"), "nosniff");
assert.equal(val("X-Frame-Options"), "DENY");
assert.match(val("Referrer-Policy"), /strict-origin/);
assert.match(val("Strict-Transport-Security"), /max-age/);
assert.ok(hosting.hosting.headers.some(h=>h.source === "**/*.html"));
assert.ok(!("functions" in hosting), "Spark release must not add paid Cloud Functions");

// Clear UI results must NOT reset the persisted pity counter.
const clearStart = gacha.indexOf('btnClear?.addEventListener("click"');
const clearEnd = gacha.indexOf("// init", clearStart);
assert.ok(clearStart > 0 && clearEnd > clearStart);
const clear = gacha.slice(clearStart, clearEnd);
assert.match(clear, /lastResults = \[\]/);
assert.match(clear, /renderResultsGrid\(\[\]\)/);
assert.doesNotMatch(clear, /setDoc|updateDoc|gachaPity: 0|deleteDoc/);

// Public grant tickets must not expose their recipient details, and public
// gift search must be constrained to public records for rules compatibility.
const queue = store.slice(store.indexOf("async function queueAdminGrant("),
  store.indexOf("export async function syncPlayerNameIndex("));
assert.match(queue, /visibility: "private"/);
assert.match(store, /where\("visibility", "==", "public"\), where\("type", "==", "operation_gift"\)/);

// Public-title checks must not request unrelated private records.
assert.match(lib, /where\("title","==",title\),where\("visibility","==","public"\)/);
assert.match(libCore, /where\("title","==",title\),where\("visibility","==","public"\)/);

// Legacy room entry must use a Firestore transaction to reserve the code.
assert.match(play, /if\(mode!=="join"\)await runTransaction\(db,async\(tx\)=>/);
assert.match(play, /const existing=await tx\.get\(roomRef\)/);
assert.match(play, /if\(existing\.exists\(\)\)throw Error/);
assert.match(play, /tx\.set\(roomRef,/);
assert.match(playHtml, /play\.js\?v=20261108_v120_room_atomic/);

// Rules preserve owners' access and only reveal publicly listed decks,
// link-only decks by ID, and the recipient's private grant.
assert.match(rules, /allow get: if publicRecord\(resource\.data\)/);
assert.match(rules, /allow list: if publicRecord\(resource\.data\)/);
assert.match(rules, /linkOnlyDeck\(resource\.data\)/);
assert.match(rules, /isOwner\(resource\.data\)/);
assert.match(rules, /isGrantRecipient\(resource\.data\)/);
assert.match(rules, /return isAdmin\(\)/);
assert.match(rules, /ownDeck\(resource\.data\) && ownDeck\(request\.resource\.data\)/);
assert.match(rules, /adminGrant\(resource\.data\)/);
assert.doesNotMatch(rules, /allow read:\s*if\s*true/);

console.log("v1.2.0 free-ten-user security regressions: 29 checks passed (rules not emulator-tested)");
