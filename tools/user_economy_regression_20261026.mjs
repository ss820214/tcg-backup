// No Firebase credentials or live writes: exercise the production helper bodies
// against a Firestore transaction mock to guard real inventory/balance regressions.
import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../public/user_store.js", import.meta.url), "utf8");
function section(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "source function boundaries must exist");
  return source.slice(a, b).replace(/^export /, "");
}
const code = section(
  "export async function ensureUserProfile(extra = {}) {",
  "\nexport async function claimPendingAdminGrants(",
) + "\n" + section(
  "export async function ensureStarterOwnedCards(uid, cardDefs = {}) {",
  "\nexport async function getRecentHistory(",
);

function buildFixture(initial = null) {
  const uid = "test-uid";
  const ref = "users/" + uid;
  const docs = new Map();
  if (initial) docs.set(ref, structuredClone(initial));
  let nameSyncs = 0;

  // The fake transaction queues writes and reads committed state. This catches
  // helpers which overwrite financial values with a stale pre-transaction copy.
  const runTransaction = async (_db, callback) => {
    const staged = [];
    const tx = {
      async get(key) {
        const has = docs.has(key);
        const value = has ? structuredClone(docs.get(key)) : null;
        return { exists: () => has, data: () => value };
      },
      set(key, data, opts) {
        assert.equal(opts?.merge, true);
        staged.push({ key, data });
      },
    };
    const result = await callback(tx);
    for (const item of staged) {
      docs.set(item.key, { ...(docs.get(item.key) || {}), ...item.data });
    }
    return result;
  };

  const deps = {
    getCurrentUserUid: async () => uid,
    profileRef: () => ref,
    db: {},
    serverTimestamp: () => "server-time",
    runTransaction,
    localPlayerNamePatch: () => ({}),
    namePatchFrom: (name) => name ? { name, displayName: name, playerName: name } : {},
    profileDefaults: () => ({
      uid, gems: 2400, pity: 0, gachaPity: 0,
      ownedCounts: { you: 1 }, stats: { matches: 0, wins: 0, losses: 0 },
    }),
    youProfilePatch: () => ({}),
    syncPlayerNameIndex: async () => { nameSyncs++; },
    claimPendingAdminGrants: async () => ({ applied: 0 }),
    buildStarterOwnedCounts: (defs) =>
      Object.fromEntries(Object.entries(defs).filter(([, def]) => def.starter).map(([id]) => [id, 4])),
    ensureYouOwnedCounts: (counts) => ({ you: 1, ...counts }),
    clampInt: (value) => Math.max(0, Math.trunc(Number(value) || 0)),
    STARTER_OWNED_VERSION: "20260705_starter_support30_v1",
  };
  const f = new Function(...Object.keys(deps), code + "\nreturn { ensureUserProfile, ensureStarterOwnedCards };");
  return { ...f(...Object.values(deps)), docs, ref, getNameSyncs: () => nameSyncs };
}

// Loading a screen must not undo a concurrent gacha purchase or game reward.
{
  const state = {
    uid: "test-uid", gems: 1780, pity: 13, gachaPity: 29,
    ownedCounts: { you: 1, rare_card: 2 },
    stats: { matches: 8, wins: 5, losses: 3 },
    isAdmin: false,
  };
  const env = buildFixture(state);
  await env.ensureUserProfile({
    name: "PlayerA", gems: 999999, pity: 999999,
    ownedCounts: { rare_card: 999 }, isAdmin: true,
  });
  const actual = env.docs.get(env.ref);
  for (const field of ["gems", "pity", "gachaPity", "ownedCounts", "stats", "isAdmin"]) {
    assert.deepEqual(actual[field], state[field], "startup changed " + field);
  }
  assert.equal(actual.name, "PlayerA");
  assert.equal(env.getNameSyncs(), 1);
}

// Older starter migrations must never delete a paid/gacha card.
{
  const env = buildFixture({
    uid: "test-uid", starterOwnedVersion: "20260702_non_fairy_v1",
    gems: 600, pity: 30, gachaPity: 7,
    ownedCounts: { you: 1, ssr_from_gacha: 3, event_exclusive: 1, starter_A: 1 },
  });
  const res = await env.ensureStarterOwnedCards("test-uid", {
    starter_A: { starter: true }, starter_B: { starter: true },
  });
  const after = env.docs.get(env.ref);
  assert.equal(res.changed, true);
  assert.equal(after.ownedCounts.ssr_from_gacha, 3);
  assert.equal(after.ownedCounts.event_exclusive, 1);
  assert.equal(after.ownedCounts.starter_A, 4);
  assert.equal(after.ownedCounts.starter_B, 4);
  assert.equal(after.gems, 600);
  assert.equal(after.gachaPity, 7);
}

// A truly new profile still receives starter balance exactly once.
{
  const env = buildFixture();
  await env.ensureUserProfile({ playerName: "NewPlayer" });
  assert.equal(env.docs.get(env.ref).gems, 2400);
  env.docs.get(env.ref).gems = 1980;
  await env.ensureUserProfile();
  assert.equal(env.docs.get(env.ref).gems, 1980);
}

// Existing legacy users receive only missing fields, never a reset.
{
  const env = buildFixture({
    uid: "test-uid", gems: 50, ownedCounts: { old_reward: 1 }, isAdmin: false,
  });
  await env.ensureUserProfile();
  const after = env.docs.get(env.ref);
  assert.equal(after.gems, 50);
  assert.equal(after.pity, 0);
  assert.equal(after.gachaPity, 0);
  assert.equal(after.ownedCounts.old_reward, 1);
}

console.log("user economy regression: 4 scenarios passed");
