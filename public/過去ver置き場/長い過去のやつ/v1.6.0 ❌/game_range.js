// public/game_range.js
// v1.5.0 射程判定（front1+side1 など OR 対応）

function frontDir(owner) { return owner === "A" ? -1 : 1; }

function relDelta(owner, dir) {
  const mapA = {
    f:[0,-1], b:[0,1], l:[-1,0], r:[1,0],
    lf:[-1,-1], rf:[1,-1], lb:[-1,1], rb:[1,1],
  };
  const mapB = {
    f:[0,1], b:[0,-1], l:[1,0], r:[-1,0],
    lf:[1,1], rf:[-1,1], lb:[1,-1], rb:[-1,-1],
  };
  const m = (owner === "A") ? mapA : mapB;
  return m[dir] || null;
}

function matchDirStep(owner, dx, dy, token) {
  const m = token.match(/^(lf|rf|lb|rb|f|b|l|r)(\d+)$/i);
  if (!m) return false;
  const dir = m[1].toLowerCase();
  const step = Number(m[2]);
  const d = relDelta(owner, dir);
  if (!d) return false;
  return dx === d[0] * step && dy === d[1] * step;
}

/**
 * rangeType 例:
 * - "front1"
 * - "front1+side1"   ← OR
 * - "adj8"
 * - "f2+lf1+rf1"
 * - "frontarc1"
 */
export function isInRange(unit, tx, ty, rangeType) {
  const dx = tx - unit.x;
  const dy = ty - unit.y;

  if (!rangeType) return false;
  const t = String(rangeType).trim();
  if (!t) return false;

  // 単体ショートカット
  const f = frontDir(unit.owner);
  if (t === "front1") return dx === 0 && dy === f;
  if (t === "front3") return dx === 0 && dy * f > 0 && Math.abs(dy) <= 3;
  if (t === "side1")  return dy === 0 && Math.abs(dx) === 1;
  if (t === "rf1")    return matchDirStep(unit.owner, dx, dy, "rf1");
  if (t === "self")   return dx === 0 && dy === 0;

  // OR 分割（+ , | をOR扱い）
  const parts = t.split(/[+,|]/).map(s => s.trim()).filter(Boolean);

  for (const raw of parts) {
    const p = raw.toLowerCase();

    if (p === "adj8") { if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) return true; continue; }
    if (p === "adj4") { if (Math.abs(dx) + Math.abs(dy) === 1) return true; continue; }

    if (p === "frontarc1") {
      if (
        matchDirStep(unit.owner, dx, dy, "f1") ||
        matchDirStep(unit.owner, dx, dy, "lf1") ||
        matchDirStep(unit.owner, dx, dy, "rf1")
      ) return true;
      continue;
    }

    if (p === "backarc1") {
      if (
        matchDirStep(unit.owner, dx, dy, "b1") ||
        matchDirStep(unit.owner, dx, dy, "lb1") ||
        matchDirStep(unit.owner, dx, dy, "rb1")
      ) return true;
      continue;
    }

    // 例: f2 / lf1 / r3
    if (matchDirStep(unit.owner, dx, dy, p)) return true;

    // front1 / side1 を parts 内で許容（ショートカットで拾い漏れないように）
    if (p === "front1" && dx === 0 && dy === f) return true;
    if (p === "side1"  && dy === 0 && Math.abs(dx) === 1) return true;
    if (p === "front3" && dx === 0 && dy * f > 0 && Math.abs(dy) <= 3) return true;
    if (p === "self"   && dx === 0 && dy === 0) return true;
  }

  return false;
}