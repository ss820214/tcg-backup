// scripts/import_cards.js
// v2.0.3-a
// - actions.csv: hpDelta/spDelta を正式採用（ターゲット判定を機械化するため）
// - 互換のため dmg/spDmg も同時保存（hpDelta/spDelta と相互変換）
// - actions.csv: ownerType を取り込み（空欄は共有技）
// - 既存: support_cards.csv, addStatus, tags, balance(role/power) は維持

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { parse } = require("csv-parse/sync");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(`serviceAccountKey.json が見つかりません: ${serviceAccountPath}`);
}
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function stripCsvCommentLines(csvText) {
  return String(csvText || "")
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("//");
    })
    .join("\n");
}

function readCsv(filePath) {
  const rawText = fs.readFileSync(filePath, "utf8");
  const csvText = stripCsvCommentLines(rawText);

  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_column_count_less: true,
    relax_column_count_more: true,
  });
}

function s(v) { return (v ?? "").toString().trim(); }
function num(v) {
  const t = s(v);
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}
function int(v) {
  const n = num(v);
  return n === undefined ? undefined : Math.trunc(n);
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

function parseCommaList(v) {
  const t = s(v);
  if (!t) return [];
  return t.split(",").map(x => x.trim()).filter(Boolean);
}

// ★act列（cards.csv）の扱い：
// 1) "a,b" 形式
// 2) '["a","b"]' JSON配列 形式
function parseActList(actRaw) {
  const t0 = s(actRaw);
  if (!t0) return [];

  const t = t0.replace(/""/g, '"');
  if (t.startsWith("[") && t.endsWith("]")) {
    try {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) {
        return arr.map(x => s(x)).filter(Boolean);
      }
    } catch (e) {}
  }
  return parseCommaList(t0);
}

// tags列（actions.csv）の扱い： "combo,xxx"
function parseTags(tags) {
  return parseCommaList(tags);
}

// addStatus列（actions.csv）
function parseAddStatus(raw) {
  const t = s(raw);
  if (!t) return null;

  const out = { target: {}, self: {} };

  for (const token0 of t.split(",").map(x => x.trim()).filter(Boolean)) {
    let token = token0;
    let dst = "target";

    if (token.startsWith("self.")) {
      dst = "self";
      token = token.slice("self.".length);
    } else if (token.startsWith("target.")) {
      dst = "target";
      token = token.slice("target.".length);
    }

    const [k0, v0] = token.split(":").map(x => x.trim());
    const key = s(k0);
    if (!key) continue;

    if (v0 !== undefined && v0 !== "") {
      const n = Number(v0);
      out[dst][key] = Number.isFinite(n) ? n : s(v0);
    } else {
      out[dst][key] = true;
    }
  }

  const hasAny =
    Object.keys(out.target).length > 0 ||
    Object.keys(out.self).length > 0;

  return hasAny ? out : null;
}

// ★support effect JSON（CSV内の "" エスケープにも対応）
function parseJsonEffect(raw, rowInfo = "") {
  const t0 = s(raw);
  if (!t0) return null;

  // CSVで "" が入っている場合に備えて戻す
  const t = t0.replace(/""/g, '"');

  try {
    const obj = JSON.parse(t);
    if (obj && typeof obj === "object") return obj;
  } catch (e) {
    throw new Error(`support_cards.csv: effect JSON parse失敗 ${rowInfo} / raw=${t0}`);
  }
  return null;
}

function safeLower(v){ return s(v).toLowerCase(); }

// ★hpDelta/spDelta と dmg/spDmg を相互補完して整形
// - 正: hpDelta/spDelta（回復は +、ダメージは -）
// - 互換: dmg/spDmg（ダメージは +、回復は -）
// 優先順位:
//   1) hpDelta/spDelta があればそれを採用
//   2) なければ Dmg/spDmg から hpDelta=-Dmg, spDelta=-spDmg を生成
//   3) さらに互換のため dmg=-hpDelta, spDmg=-spDelta も揃える
function normalizeDeltas(row) {
  // 新列
  let hpDelta = int(pick(row, ["hpDelta", "HPDelta", "hpdelta", "hp_change", "HPChange"]));
  let spDelta = int(pick(row, ["spDelta", "SPDelta", "spdelta", "sp_change", "SPChange"]));

  // 旧列
  let dmg = int(pick(row, ["Dmg", "dmg", "HPDmg", "hpDmg"]));
  let spDmg = int(pick(row, ["spDmg", "SpDmg", "spdmg", "SPdmg"]));

  // 新が無いなら旧から生成
  if (hpDelta === undefined && dmg !== undefined) hpDelta = -dmg;
  if (spDelta === undefined && spDmg !== undefined) spDelta = -spDmg;

  // 互換：旧が無いなら新から逆生成
  if (dmg === undefined && hpDelta !== undefined) dmg = -hpDelta;
  if (spDmg === undefined && spDelta !== undefined) spDmg = -spDelta;

  return { hpDelta, spDelta, dmg, spDmg };
}

async function main() {
  const cardsPath = path.join(__dirname, "cards.csv");
  const actionsPath = path.join(__dirname, "actions.csv");
  const supportCardsPath = path.join(__dirname, "support_cards.csv"); // ★追加

  if (!fs.existsSync(cardsPath)) throw new Error("cards.csv がありません（scripts/ に置いてね）");
  if (!fs.existsSync(actionsPath)) throw new Error("actions.csv がありません（scripts/ に置いてね）");

  const cards = readCsv(cardsPath);
  const actions = readCsv(actionsPath);

  // support_cards.csv は任意
  const supportCards = fs.existsSync(supportCardsPath) ? readCsv(supportCardsPath) : [];
  if (supportCards.length) {
    console.log(`📦 support_cards.csv を検出: ${supportCards.length}件`);
  } else {
    console.log(`ℹ️ support_cards.csv は未検出（スキップ）`);
  }

  // ==== actions を辞書化 ====
  const actionMap = new Map();
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const actionId = s(pick(a, ["actionId", "actionID", "id", "ActionId"]));
    if (!actionId) throw new Error(`actions.csv: actionId が空です (行 ${i + 2})`);

    const obj = {
      id: actionId,
      name: s(pick(a, ["name", "actionName", "ActionName"])),
      cost: int(pick(a, ["cost", "Cost"])),
      range: s(pick(a, ["range", "Range"])),
      rate: int(pick(a, ["rate", "Rate"])),
    };

    // ★hpDelta/spDelta 正式化（旧 dmg/spDmg と相互補完）
    const { hpDelta, spDelta, dmg, spDmg } = normalizeDeltas(a);

    // 新：hpDelta/spDelta（ターゲット判定に使う）
    if (hpDelta !== undefined) obj.hpDelta = hpDelta;
    if (spDelta !== undefined) obj.spDelta = spDelta;

    // 旧：dmg/spDmg（既存UI/バトル互換のため当面残す）
    if (dmg !== undefined) obj.dmg = dmg;
    if (spDmg !== undefined) obj.spDmg = spDmg;

    // draw
    const draw = int(pick(a, ["draw", "Draw"]));
    if (draw !== undefined) obj.draw = draw;

    // ==== ★追加: role / power（balanceに格納） ====
    const role = s(pick(a, ["role", "Role", "kind", "Kind", "typeTag", "TypeTag", "種類", "分類"]));
    const power = int(pick(a, ["power", "Power", "strength", "Strength", "強さ"]));
    if (role || power !== undefined) {
      obj.balance = {};
      if (role) obj.balance.role = role;
      if (power !== undefined) obj.balance.power = power;
    }

    // ownerType（任意 / 空欄は共有技）
    const ownerType = s(pick(a, ["ownerType", "OwnerType", "ownertype", "attr", "属性"]));
    if (ownerType) obj.ownerType = ownerType;

    // tags（任意）
    const tagsRaw = pick(a, ["tags", "Tags", "tag", "Tag"]);
    const tags = parseTags(tagsRaw);
    if (tags.length) obj.tags = tags;

    // addStatus（任意）
    const addStatusRaw = pick(a, ["addStatus", "AddStatus", "status", "Status"]);
    const addStatus = parseAddStatus(addStatusRaw);
    if (addStatus) obj.addStatus = addStatus;

    // バリデーション
    if (!obj.name) throw new Error(`actions.csv: name が空です (actionId=${actionId}, 行 ${i + 2})`);
    if (!obj.range) throw new Error(`actions.csv: range が空です (actionId=${actionId}, 行 ${i + 2})`);
    if (obj.cost === undefined) throw new Error(`actions.csv: cost が空です (actionId=${actionId}, 行 ${i + 2})`);
    if (obj.rate === undefined) throw new Error(`actions.csv: rate が空です (actionId=${actionId}, 行 ${i + 2})`);

    actionMap.set(actionId, obj);
  }

  // ==== Firestore保存 ====
  const BATCH_LIMIT = 450;
  let batch = db.batch();
  let inBatch = 0;
  let total = 0;

  async function commitIfNeeded() {
    if (inBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }

  function enqueueSet(docId, data) {
    const ref = db.collection("cards").doc(docId);
    batch.set(ref, data, { merge: true });
    inBatch++;
    total++;
  }

  // ==========================
  // 1) unitカード（既存 cards.csv）
  // ==========================
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];

    const cardId = s(pick(c, ["cardId", "cardID", "id", "CardId", "カードID"]));
    const cardName = s(pick(c, ["cardName", "name", "Name", "カード名"]));
    const actRaw = pick(c, ["act", "acts", "actionIds", "actions", "Act"]);

    if (!cardId) {
      const keys = Object.keys(c).join(", ");
      throw new Error(`cards.csv: cardId が空です (行 ${i + 2}) / ヘッダ候補: ${keys}`);
    }
    if (!cardName) throw new Error(`cards.csv: cardName が空です (cardId=${cardId}, 行 ${i + 2})`);

    const actList = parseActList(actRaw);
    const cleanActList = actList.map(x => s(x)).filter(Boolean);

    const actionsArr = cleanActList.map(id => {
      const act = actionMap.get(id);
      if (!act) {
        throw new Error(
          `cards.csv: act の actionId が actions.csv にありません (${cardId} -> ${id}) (行 ${i + 2})`
        );
      }
      return act;
    });

    const type = s(pick(c, ["type", "Type", "attr", "属性"]));
    const cost = int(pick(c, ["cost", "Cost"]));
    const hp = int(pick(c, ["hp", "HP"]));
    const sp = int(pick(c, ["sp", "SP"]));

    if (!type) throw new Error(`cards.csv: type 空 (cardId=${cardId}, 行 ${i + 2})`);
    if (cost === undefined) throw new Error(`cards.csv: cost 空 (cardId=${cardId}, 行 ${i + 2})`);
    if (hp === undefined) throw new Error(`cards.csv: hp 空 (cardId=${cardId}, 行 ${i + 2})`);
    if (sp === undefined) throw new Error(`cards.csv: sp 空 (cardId=${cardId}, 行 ${i + 2})`);

    const data = {
      name: cardName,
      type,
      cost,
      hp,
      sp,
      actions: actionsArr,
      // ★unitのkindは明示しなくてもいいが、将来の事故防止で入れておく
      kind: s(pick(c, ["kind", "Kind"])) || "unit",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      schema: "cards_act_v5_hpDelta_support",
    };

    enqueueSet(cardId, data);
    await commitIfNeeded();
  }

  // ==========================
  // 2) supportカード（support_cards.csv）
  // ==========================
  for (let i = 0; i < supportCards.length; i++) {
    const r = supportCards[i];

    const cardId = s(pick(r, ["cardId", "cardID", "id", "supportCardId", "supportCardID", "SupportCardId"]));
    const cardName = s(pick(r, ["cardName", "name", "Name"]));
    const cost = int(pick(r, ["cost", "Cost"]));
    const kind = safeLower(pick(r, ["kind", "Kind"])) || "support";

    // effect列名は色々許容
    const effectRaw = pick(r, ["effect", "Effect", "supportEffect", "SupportEffect", "effectJson", "EffectJson"]);

    if (!cardId) throw new Error(`support_cards.csv: cardId が空です (行 ${i + 2})`);
    if (!cardName) throw new Error(`support_cards.csv: name が空です (cardId=${cardId}, 行 ${i + 2})`);
    if (cost === undefined) throw new Error(`support_cards.csv: cost が空です (cardId=${cardId}, 行 ${i + 2})`);
    if (kind !== "support") throw new Error(`support_cards.csv: kind は support にしてね (cardId=${cardId}, 行 ${i + 2})`);

    const effect = parseJsonEffect(effectRaw, `(cardId=${cardId}, 行 ${i + 2})`);
    if (!effect) throw new Error(`support_cards.csv: effect が空です (cardId=${cardId}, 行 ${i + 2})`);

    // support はユニットとして使わないので、type/hp/sp はデフォルトで安全値
    const data = {
      name: cardName,
      kind: "support",
      type: s(pick(r, ["type", "Type"])) || "support",
      cost,
      hp: int(pick(r, ["hp", "HP"])) ?? 0,
      sp: int(pick(r, ["sp", "SP"])) ?? 0,
      actions: [], // ★サポカは actions を持たない運用
      effect,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      schema: "cards_act_v5_hpDelta_support",
    };

    enqueueSet(cardId, data);
    await commitIfNeeded();
  }

  if (inBatch > 0) await batch.commit();

  console.log(`✅ cards インポート完了: 合計 ${total} 枚（unit + support）`);
  console.log(`✅ actions 辞書数: ${actionMap.size}`);
}

main().catch(e => {
  console.error("❌ 失敗:", e.message);
  process.exit(1);
});