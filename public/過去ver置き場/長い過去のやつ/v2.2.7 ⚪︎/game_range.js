// public/game_range.js
// v1.7.0
// - 直線射程（同じ行 or 同じ列）
// - ブロック判定/ライン上ユーティリティを追加（game.jsで使う用）
//
// 互換：game.js は isInRange(attacker, x, y, range) を呼ぶだけなので
// isInRange は「射程内か」のみ返す（遮蔽物/貫通/全体は別関数で処理）

function n(v){ v = Number(v); return Number.isFinite(v) ? v : 0; }
function s(v){ return String(v ?? "").toLowerCase(); }

// 同じマスは不可（攻撃/移動共通の安全策に使える）
export function isSameCell(a, x, y){
  return !!a && n(a.x) === n(x) && n(a.y) === n(y);
}

// 直線距離（同一行/列のときのみ意味がある）
export function lineDist(a, x, y){
  if (!a) return 999;
  const ax = n(a.x), ay = n(a.y);
  const tx = n(x),  ty = n(y);
  if (ax === tx) return Math.abs(ay - ty);
  if (ay === ty) return Math.abs(ax - tx);
  return 999;
}

/**
 * 射程判定（互換用）
 * - 同じ行/列で距離 <= range のとき true
 * - diagonal は false
 */
export function isInRange(attacker, tx, ty, range){
  if (!attacker) return false;
  const r = Math.max(0, Math.trunc(n(range)));
  if (r <= 0) return false;

  if (isSameCell(attacker, tx, ty)) return false;

  const d = lineDist(attacker, tx, ty);
  return d >= 1 && d <= r;
}

/**
 * attacker→target の間にある「途中マス座標」を返す（両端除く）
 * - 直線でない場合は [] を返す
 */
export function cellsBetween(attacker, tx, ty){
  if (!attacker) return [];
  const ax = n(attacker.x), ay = n(attacker.y);
  tx = n(tx); ty = n(ty);

  const out = [];
  if (ax === tx) {
    const step = (ty > ay) ? 1 : -1;
    for (let y = ay + step; y !== ty; y += step) out.push({ x: ax, y });
    return out;
  }
  if (ay === ty) {
    const step = (tx > ax) ? 1 : -1;
    for (let x = ax + step; x !== tx; x += step) out.push({ x, y: ay });
    return out;
  }
  return [];
}

/**
 * ライン上ブロック判定
 * - “前にキャラがいたら殴れない” を実現するために game.js で使う想定
 * - panic も盤面に残る仕様なので、基本「hp>0ならブロック」にしてある
 *
 * @param units 盤面ユニット配列
 * @param attacker 攻撃者
 * @param tx ty 狙う座標
 * @param opt { includePanic?:boolean } 既定true（panicも壁）
 */
export function isLineBlocked(units, attacker, tx, ty, opt={}){
  const includePanic = (opt.includePanic ?? true);

  const mid = cellsBetween(attacker, tx, ty);
  if (!mid.length) return false;

  const list = Array.isArray(units) ? units : [];
  for (const c of mid){
    const u = list.find(v => n(v.x) === c.x && n(v.y) === c.y && n(v.hp) > 0);
    if (!u) continue;
    if (!includePanic && !!u.panic) continue;
    return true;
  }
  return false;
}

/**
 * attacker から “同方向” に見えるユニットを距離順で返す
 * - 貫通（pierce）で「手前から順に当てる」みたいな処理に便利
 */
export function unitsOnRay(units, attacker, dir, maxRange=99){
  const list = Array.isArray(units) ? units : [];
  const ax = n(attacker?.x), ay = n(attacker?.y);
  const r = Math.max(0, Math.trunc(n(maxRange)));

  const d = s(dir);
  let dx=0, dy=0;
  if (d === "up") dy = -1;
  else if (d === "down") dy = 1;
  else if (d === "left") dx = -1;
  else if (d === "right") dx = 1;
  else return [];

  const out = [];
  for (let i=1; i<=r; i++){
    const x = ax + dx*i;
    const y = ay + dy*i;
    const u = list.find(v => n(v.x) === x && n(v.y) === y && n(v.hp) > 0);
    if (u) out.push({ u, dist:i, x, y });
  }
  return out;
}

/**
 * attacker→(tx,ty) の方向（up/down/left/right）を返す。直線でないなら null。
 */
export function dirTo(attacker, tx, ty){
  if (!attacker) return null;
  const ax = n(attacker.x), ay = n(attacker.y);
  tx = n(tx); ty = n(ty);

  if (ax === tx) return (ty < ay) ? "up" : "down";
  if (ay === ty) return (tx < ax) ? "left" : "right";
  return null;
}