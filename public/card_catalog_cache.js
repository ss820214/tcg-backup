// Cache only PUBLIC card definition collections; never cache rooms, users, decks or match state.
// Cross-page cache reduces repeated Firestore collection reads. TTL 15 minutes.
// Editors may call invalidateCardCatalogCache() after changing cards.
const PREFIX = "0bato_card_catalog_v1:";
const TTL_MS = 15 * 60 * 1000;
const STALE_ON_ERROR_MS = 12 * 60 * 60 * 1000;
const pending = new Map();
const validCollection = name => /^(cards|support_cards|supports|supportCards|ex_support_cards|ex_supports|exSupportCards|ex_support)$/.test(name);

function readEntry(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    const value = raw ? JSON.parse(raw) : null;
    if (!value || !Number.isFinite(value.at) || !Array.isArray(value.docs)) return null;
    return value;
  } catch { return null; }
}

function asSnapshot(docs) {
  // Only expose the Firestore snapshot API used by these catalog loaders.
  const entries = docs.map(item => ({ id: item.id, data: () => item.data }));
  return { docs: entries, size: entries.length, empty: !entries.length, forEach(fn) { entries.forEach(fn); } };
}

export function invalidateCardCatalogCache(name) {
  try {
    if (name && validCollection(name)) localStorage.removeItem(PREFIX + name);
    else for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {}
}

export async function getCachedCardCollection(name, fetchSnapshot) {
  if (!validCollection(name)) return fetchSnapshot();
  const now = Date.now();
  const cached = readEntry(name);
  if (cached && now - cached.at >= 0 && now - cached.at < TTL_MS) return asSnapshot(cached.docs);
  if (pending.has(name)) return pending.get(name);
  const request = (async () => {
    try {
      const snapshot = await fetchSnapshot();
      const docs = [];
      snapshot.forEach(d => docs.push({ id: d.id, data: d.data() || {} }));
      // Empty collections are cached too, to avoid repeatedly probing old aliases.
      try { localStorage.setItem(PREFIX + name, JSON.stringify({ at: Date.now(), docs })); } catch {}
      return asSnapshot(docs);
    } catch (error) {
      // Quota outages: a recently fetched catalog can still be used for reading.
      if (cached && now - cached.at >= 0 && now - cached.at < STALE_ON_ERROR_MS) {
        console.warn("[card catalog] Firestore unavailable; using saved definitions", name, error);
        return asSnapshot(cached.docs);
      }
      throw error;
    }
  })();
  pending.set(name, request);
  try { return await request; } finally { pending.delete(name); }
}
