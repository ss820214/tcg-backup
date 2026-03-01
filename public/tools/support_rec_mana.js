// public/tools/support_rec_mana.js
// 推奨マナ計算（内訳つき）

// =========================
// 設定
// =========================
export const REC_MANA_CFG = {
  basePerMana: 10,        // score / 10 => manaRaw
  spValue: 1.5,           // SPの価値
  drawValue: 8,           // ドロー1枚の価値（感覚）
};

// 状態異常/バフ/特性の倍率（ユーザー指定を反映）
const STATUS_MUL = {
  bleed: 1.3,       // 出血
  fracture: 1.4,    // 骨折
  smell: 1.2,       // 匂い
  lostSoul: 1.3,    // 失魂
  blind: 1.7,       // 盲目
  evade: 1.2,       // 回避
  combo: 1.3,       // コンボ
  followUp: 1.7,    // 追撃（followUp）
  // 追加（未指定のものは控えめ）
  jinx: 1.2,
  hitUp: 1.1,
  powerUp: 1.4,
  armor: 1.2,
  recoverMove: 1.2,
  recoverFatigue: 1.2,
};

const TAG_MUL = {
  pierce: 1.3,      // 貫通
  aoe: 1.6,         // 全体
  knockback: 1.3,   // ノックバック
};

// =========================
// ユーティリティ
// =========================
function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function splitTokens(s) {
  const t = String(s ?? "").trim();
  if (!t) return [];
  return t
    .split("+")
    .map(x => x.trim())
    .filter(Boolean);
}

function parseTagSet(tags, addStatus) {
  const set = new Set();
  for (const t of splitTokens(tags)) set.add(t);
  for (const t of splitTokens(addStatus)) set.add(t);
  return set;
}

// =========================
// 基礎スコア（期待値）
// =========================
function baseExpectedValue(hpDelta, spDelta, rate, draw = 0) {
  // ダメージは -hpDelta / -spDelta、回復は +hpDelta / +spDelta
  // 期待値 = (価値合計) * 命中率
  const hpVal = Math.abs(hpDelta);
  const spVal = Math.abs(spDelta) * REC_MANA_CFG.spValue;

  // 「攻撃/回復」どちらも強さは絶対値で評価（符号はrole側で意味が変わるが、コストは強さ基準）
  const raw = hpVal + spVal;
  const hit = Math.max(0, Math.min(100, rate)) / 100;

  const drawScore = Math.max(0, toNum(draw, 0)) * REC_MANA_CFG.drawValue;

  return raw * hit + drawScore;
}

// =========================
// 射程倍率
// =========================
function distMulFromToken(tok) {
  // token例: front1, front2, front3, front4, side1, rf1, lf2, back1, adj4, self, f2
  const t = String(tok).toLowerCase();

  if (t === "self") return 0.95;     // 自分対象はやや扱いづらい/限定
  if (t.startsWith("back")) return 0.70; // 後ろは使いづらい
  if (t.startsWith("side")) return 0.90; // 横はちょい使いづらい
  if (t.startsWith("rf") || t.startsWith("lf")) return 0.90;

  // front / f の距離
  // f2 みたいなのもあるので数字を拾う
  const m = t.match(/(\d+)/);
  const d = m ? toNum(m[1], 1) : 1;

  // 距離は強い（届くほど使いやすい）ので倍率上げる
  // 1:1.00 2:1.15 3:1.30 4:1.45
  if (d <= 1) return 1.00;
  if (d === 2) return 1.15;
  if (d === 3) return 1.30;
  return 1.45;
}

function rangeMultiplier(rangeStr) {
  const tokens = splitTokens(rangeStr);
  if (!tokens.length) return 1.0;

  // 「選べる射程」は有利側で使えるので max を採用
  // ただし、全部 back 系だけなら back ペナルティが残る
  const muls = tokens.map(distMulFromToken);
  const best = Math.max(...muls);

  // 全部 back なら best も 0.7 になるのでそのまま
  return best;
}

// =========================
// タグ倍率（状態異常/貫通/全体/バフ等）
// =========================
function tagMultiplier(tagsStr, addStatusStr) {
  const set = parseTagSet(tagsStr, addStatusStr);
  if (!set.size) return 1.0;

  let mul = 1.0;

  // tags列の特性
  for (const k of set) {
    if (TAG_MUL[k] != null) mul *= TAG_MUL[k];
  }

  // addStatus列の状態異常/バフ
  for (const k of set) {
    if (STATUS_MUL[k] != null) mul *= STATUS_MUL[k];
  }

  return mul;
}

// =========================
// SP希少性補正
// =========================
function spScarcityMultiplier(hpDelta, spDelta) {
  // SPにダメージ/回復が絡む技は価値が高い（ユーザー方針）
  // ここは “割合” で補正をかける（SP比率が高いほど上がる）
  const hp = Math.abs(hpDelta);
  const sp = Math.abs(spDelta) * REC_MANA_CFG.spValue;

  const total = hp + sp;
  if (total <= 0) return 1.0;

  const spRatio = sp / total; // 0..1
  // 最大で +0.5 まで上げる（=1.5倍）
  return 1.0 + 0.5 * spRatio;
}

// =========================
// 反動（今回はCSVに専用列が無いので placeholder）
// 例: もし将来 recoilHp を持たせたらここで -補正できる
// =========================
function recoilScoreFromRow(_row) {
  // 現状: 反動情報がCSVに無いので 0
  return 0;
}

// =========================
// 外部公開：推奨マナ（内訳つき）
// =========================
export function calcRecManaDetail(row) {
  const hpDelta = toNum(row.hpDelta, 0);
  const spDelta = toNum(row.spDelta, 0);
  const rate = toNum(row.rate, 0);
  const draw = row.draw === "" ? 0 : toNum(row.draw, 0);

  const baseEV = baseExpectedValue(hpDelta, spDelta, rate, draw);
  const rangeMul = rangeMultiplier(row.range);
  const tagMul = tagMultiplier(row.tags, row.addStatus);
  const spScarcity = spScarcityMultiplier(hpDelta, spDelta);
  const recoilScore = recoilScoreFromRow(row);

  // score構築：反動は減点（-=）
  let score = baseEV;
  score *= rangeMul;
  score *= tagMul;
  score *= spScarcity;
  score += recoilScore; // 今は0

  const manaRaw = score / REC_MANA_CFG.basePerMana;
  const recMana = Math.max(1, Math.ceil(manaRaw));

  return {
    recMana,
    manaRaw,
    score,
    breakdown: {
      baseEV,
      rangeMul,
      tagMul,
      spScarcity,
      recoilScore,
      basePerMana: REC_MANA_CFG.basePerMana,
    },
  };
}

// 互換（必要なら使う）
export function calcRecMana(row) {
  return calcRecManaDetail(row).recMana;
}