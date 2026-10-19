// Spatial support effects: one shared legality definition for hints, clicks and application.
export function spatialEffect(def, type) {
  const root = def?.effect || def || {};
  if (String(root.type || "") === type) return root;
  const effects = Array.isArray(root.table) ? root.table.map(row => row?.effect) : [];
  return effects.find(e => String(e?.type || "") === type) || null;
}
export function spatialLimit(effect) {
  const raw = effect?.maxDist;
  if (raw == null || raw === "") return null; // Cards without limits remain unrestricted.
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}
export function boardCell(x, y, W = 5, H = 7) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < W && y < H;
}
export function taxicab(a, b) {
  return Math.abs(Number(a.x)-Number(b.x)) + Math.abs(Number(a.y)-Number(b.y));
}
export function validSpatialMove({from,to,effect,units=[],W=5,H=7}) {
  if (!from || !to || !boardCell(Number(to.x), Number(to.y),W,H)) return false;
  if (!boardCell(Number(from.x),Number(from.y),W,H)) return false;
  const distance = taxicab(from,to), max = spatialLimit(effect);
  if (distance <= 0 || (max != null && distance > max)) return false;
  return !units.some(u=>u && Number(u.hp)>0 && Number(u.x)===Number(to.x) && Number(u.y)===Number(to.y));
}
export function validSpatialSwap({first,second,effect,W=5,H=7}) {
  if (!first || !second || first.id === second.id ||
      !(Number(first.hp)>0) || !(Number(second.hp)>0) ||
      !boardCell(Number(first.x),Number(first.y),W,H) ||
      !boardCell(Number(second.x),Number(second.y),W,H)) return false;
  const max=spatialLimit(effect);
  return max == null || taxicab(first,second) <= max;
}
