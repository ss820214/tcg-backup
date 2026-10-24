// Regression tests for non-destructive 4-digit room create/join behavior.
import assert from "node:assert/strict";
import fs from "node:fs";

const deck = fs.readFileSync("public/deck.js", "utf8");
assert.doesNotMatch(deck, /resetRoomHardish\(/, "room entry must not delete existing matches");
assert.doesNotMatch(deck, /touchRoom\(roomId, \{ createdAt:/, "opening the editor must not create a room");

// Opening the home/editor must not place a fake invite code in the browser URL.
const startup = deck.slice(deck.indexOf("// URL params"), deck.indexOf("// DOM ("));
assert.ok(startup.includes("let roomId ="), "initial room state is still available internally");
assert.doesNotMatch(startup, /history\.replaceState|params\.set\("room"|params\.set\("player"/, "home load must not publish an unreserved room ID");
assert.match(deck, /function updateUrlAndLabels\(\)/, "explicit create/join still publishes the room URL");

const saveBlock = deck.slice(deck.indexOf("async function saveDeckOnly("), deck.indexOf('btnSave?.addEventListener("click"', deck.indexOf("async function saveDeckOnly(")));
assert.match(saveBlock, /activeRoom = memberSnap\.exists\(\)/, "normal save must only touch a confirmed match participant");
assert.match(saveBlock, /await saveDeckToUser\(name\)/, "cloud save must remain available outside a match");

const start = deck.indexOf("// Reserve a truly new code.");
const end = deck.indexOf("// =====================\n// Data load", start);
assert.ok(start >= 0 && end > start, "transactional room entry helpers exist");
const helpers = deck.slice(start, end);

const rooms = new Map();
const matches = new Set();
const players = new Map();
const ts = () => ({ toMillis: () => 999999 });
const takenCodes = ["1234", "5678"];
const make = new Function(
  "db", "runTransaction", "roomRef", "newRoomCode4",
  "serverTimestamp", "expiresAtFromNow", "getDoc", "getDocs",
  "matchRef", "playersCol", "isExpiredRoomDoc", "document", "setMsg",
  helpers + "\nreturn { reserveFreshRoom, requireJoinableRoom };",
);
const roomSnap = (ref) => ({
  exists: () => rooms.has(ref),
  data: () => rooms.get(ref),
});
const api = make(
  {},
  async (_db, callback) => {
    const changes = [];
    const result = await callback({
      get: async (ref) => roomSnap(ref),
      set: (ref, value) => changes.push(["set", ref, value]),
      update: (ref, value) => changes.push(["update", ref, value]),
    });
    for (const [kind, ref, value] of changes) {
      if (kind === "update") assert.ok(rooms.has(ref), "update never creates room");
      rooms.set(ref, { ...(kind === "update" ? rooms.get(ref) : {}), ...value });
    }
    return result;
  },
  (code) => "room:" + code,
  () => takenCodes.shift(),
  ts, ts,
  async (ref) => ({ exists: () => matches.has(ref) }),
  async (ref) => ({ size: players.get(ref) || 0 }),
  (code) => "match:" + code,
  (code) => "players:" + code,
  (data) => (data.expiresAt?.toMillis?.() ?? Infinity) < 200000,
  { getElementById: () => null },
  () => {},
);

rooms.set("room:1234", {
  createdAt: "original", fieldId: "grass", expiresAt: ts(),
});
const reserved = await api.reserveFreshRoom({ fieldId: "swamp" });
assert.equal(reserved, "5678", "retry on code collision");
assert.equal(rooms.get("room:1234").createdAt, "original");
assert.equal(rooms.get("room:1234").fieldId, "grass");
assert.equal(rooms.get("room:5678").fieldId, "swamp");

const countBeforeJoin = rooms.size;
await assert.rejects(api.requireJoinableRoom("0001"), /見つかりません/);
assert.equal(rooms.size, countBeforeJoin, "missing join must not create a room");

await api.requireJoinableRoom("1234");
assert.equal(rooms.get("room:1234").createdAt, "original", "join preserves creation time");
assert.equal(rooms.get("room:1234").fieldId, "grass", "join preserves host settings");

rooms.set("room:7777", { expiresAt: { toMillis: () => 1 } });
await assert.rejects(api.requireJoinableRoom("7777"), /有効期限/);

rooms.set("room:8888", { solo: true, expiresAt: ts() });
await assert.rejects(api.requireJoinableRoom("8888"), /ソロ/);

matches.add("match:1234");
await assert.rejects(api.requireJoinableRoom("1234"), /対戦を開始/);
matches.delete("match:1234");

players.set("players:1234", 2);
await assert.rejects(api.requireJoinableRoom("1234"), /満員/);


// The obsolete 20-card join URL must redirect without touching Firestore.
const legacyJoin = fs.readFileSync("public/join.js", "utf8");
assert.match(legacyJoin, /window\.location\.replace\(home\.href\)/, "legacy entry redirects to the active lobby");
assert.doesNotMatch(legacyJoin, /(?:setDoc|deleteDoc|updateDoc|runTransaction|resetRoomHardish)\s*\(/, "legacy entry must never mutate room data");

console.log("Room entry regression: collision, missing, active, expired, solo, started, full OK");
