#!/usr/bin/env node
/**
 * scripts/recommend_mana.js
 *
 * Features (keep):
 * - Read cards.csv + actions.csv
 * - Compute recommended mana for each card
 * - Write new csv (default: cards_with_rec_mana.csv) OR overwrite input
 * - Add "recommendedMana" column if not exists
 * - Warn if card references actions not found in actions.csv
 * - Works as CLI AND as importable module (for setting.js)
 *
 * Usage:
 *   # from project root (TCG/)
 *   node scripts/recommend_mana.js
 *
 *   node scripts/recommend_mana.js --in cards.csv --actions actions.csv --out cards_with_rec_mana.csv
 *   node scripts/recommend_mana.js --overwrite
 *   node scripts/recommend_mana.js --decimals 1
 *
 *   # if csv is under public/
 *   node scripts/recommend_mana.js --in public/cards.csv --actions public/actions.csv
 */

const fs = require("fs");
const path = require("path");

// =====================
// cards.csv header mapping (YOUR FORMAT)
// cardID,cardName,type,cost,hp,sp,act
// =====================
const CARD_HEADERS = {
  id: ["cardID"],
  name: ["cardName"],
  attr: ["type"],
  mana: ["cost"],     // current cost in your csv
  hp: ["hp"],
  sp: ["sp"],
  skills: ["act"],    // single id or JSON array string
};

// rawPower = stat + GAMMA * Σ(cost * attrMul * strengthMul)
const GAMMA = 12;

// Attribute stat weights (暫定 / converterで吸収されるので後で調整OK)
const STAT_W = {
  "火": { hp: 0.8, sp: 1.4 },
  "水": { hp: 1.0, sp: 1.2 },
  "草": { hp: 1.1, sp: 1.1 },
  "風": { hp: 0.9, sp: 1.3 },
  "闇": { hp: 0.9, sp: 1.35 },
  "光": { hp: 1.0, sp: 1.25 },
  "雷": { hp: 1.0, sp: 1.5 },
  "鋼": { hp: 1.0, sp: 1.5 },
};

// Anchors-matched converters (piecewise linear)
// 火/水/草/風/闇/光/雷/鋼 すべて対応
const CONVERTER = {
  // 既存6属性
  "火": { th: 106.88, a1: 0.03516174402250352, b1: 0.24191279887482398, a2: 0.04635352286773795, b2: -0.9542645241038317 },
  "水": { th: 95.6,   a1: 0.09541984732824428, b1: -5.122137404580153, a2: 0.04212299915754001, b2: -0.02695871946082473 },
  "草": { th: 108.3,  a1: 0.06230529595015575, b1: -1.7476635514018688, a2: 0.07097232079489, b2: -2.686302342086589 },
  "風": { th: 105.8,  a1: 0.055147058823529396, b1: -1.8345588235294108, a2: 0.08010680907877173, b2: -4.475300400534049 },
  "闇": { th: 111.84, a1: 0.04198152812762384, b1: 0.30478589420654933, a2: 0.07854225573358467, b2: -3.7841658812441104 },
  "光": { th: 125.5,  a1: 0.06568144499178981, b1: -2.2430213464696216, a2: 0.04870129870129868, b2: -0.11201298701298512 },

  // 追加：雷（thief=2 / kosodoro=4 / kyarua=9 のアンカー想定）
  "雷": { th: 97.68,  a1: 0.06333122229259022, b1: -2.1861937935402134, a2: 0.05582849486377847, b2: -1.4533273782938814 },

  // 追加：鋼（konow=2 / kangoku=5 / konow3=10 のアンカー想定）
  "鋼": { th: 118.16, a1: 0.11312217194570137, b1: -8.366515837104075, a2: 0.055364854390432955, b2: -1.541911194773558 },
};

// =====================
// CSV utils (handles quotes)
// =====================
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { header, rows };
}

function escapeCsvCell(v) {
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(header, rows) {
  const out = [];
  out.push(header.map(escapeCsvCell).join(","));
  for (const r of rows) out.push(r.map(escapeCsvCell).join(","));
  return out.join("\n") + "\n";
}

function findHeaderIndex(header, candidates) {
  const lower = header.map(h => String(h).trim().toLowerCase());
  for (const cand of candidates) {
    const i = lower.indexOf(String(cand).toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

// =====================
// Mana model
// =====================
function strengthMul(power) {
  const p = Math.max(1, Math.min(5, Math.round(Number(power) || 3)));
  return 1.0 + (p - 3) * 0.075; // 1:0.85, 3:1.0, 5:1.15
}

// ownerType empty => common(0.8), same attr => 1.0, other => 1.3 (暫定)
function attrMul(skillOwnerType, charAttr) {
  const t = (skillOwnerType || "").trim();
  if (!t) return 0.8;
  if (t === charAttr) return 1.0;
  return 1.3;
}

function parseSkillsCell(cell) {
  const s = String(cell ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try { return JSON.parse(s); } catch {}
  }
  if (s.includes(";")) return s.split(";").map(x => x.trim()).filter(Boolean);
  if (s.includes("|")) return s.split("|").map(x => x.trim()).filter(Boolean);
  return [s];
}

function calcRawPower(char, actionsById) {
  const w = STAT_W[char.attr] || { hp: 1.0, sp: 1.5 };
  const stat = char.hp * w.hp + char.sp * w.sp;

  let skillSum = 0;
  for (const aid of char.skills) {
    const a = actionsById[aid];
    if (!a) continue;
    const cost = Number(a.cost) || 0;
    skillSum += cost * attrMul(a.ownerType, char.attr) * strengthMul(a.power);
  }
  return stat + GAMMA * skillSum;
}

function recommendManaFromRaw(attr, rawPower) {
  const c = CONVERTER[attr];
  if (!c) return null;
  return (rawPower <= c.th) ? (c.a1 * rawPower + c.b1) : (c.a2 * rawPower + c.b2);
}

function roundToDecimals(value, decimals) {
  const d = Math.max(0, Math.min(6, Number(decimals ?? 1)));
  const m = Math.pow(10, d);
  return Math.round(value * m) / m;
}

// =====================
// Load actions.csv -> actionsById
// =====================
function loadActions(actionsCsvPath) {
  const text = fs.readFileSync(actionsCsvPath, "utf8");
  const { header, rows } = parseCsv(text);

  const idx = {
    id: findHeaderIndex(header, ["actionId", "id"]),
    cost: findHeaderIndex(header, ["cost"]),
    power: findHeaderIndex(header, ["power"]),
    ownerType: findHeaderIndex(header, ["ownerType"]),
  };
  for (const k of Object.keys(idx)) {
    if (idx[k] < 0) throw new Error(`actions.csv missing header: ${k}`);
  }

  const map = {};
  for (const r of rows) {
    const id = r[idx.id];
    if (!id) continue;
    map[id] = {
      actionId: id,
      cost: Number(r[idx.cost] || 0),
      power: Number(r[idx.power] || 3),
      ownerType: (r[idx.ownerType] || "").trim(),
    };
  }
  return map;
}

// =====================
// Load cards.csv
// =====================
function loadCards(cardsCsvPath) {
  const text = fs.readFileSync(cardsCsvPath, "utf8");
  const { header, rows } = parseCsv(text);

  const idx = {};
  for (const [key, cands] of Object.entries(CARD_HEADERS)) {
    idx[key] = findHeaderIndex(header, cands);
    if (idx[key] < 0) throw new Error(`cards.csv missing header for "${key}" : ${JSON.stringify(cands)}`);
  }

  return { header, rows, idx };
}

// =====================
// Core runner (exportable for setting.js)
// =====================
async function runRecommendMana(options = {}) {
  const {
    inPath = "cards.csv",
    actionsPath = "actions.csv",
    outPath = "cards_with_rec_mana.csv",
    overwrite = false,
    decimals = 1,
    cwd = process.cwd(),
  } = options;

  const cardsCsvPath = path.resolve(cwd, inPath);
  const actionsCsvPath = path.resolve(cwd, actionsPath);
  const outCsvPath = path.resolve(cwd, overwrite ? inPath : outPath);

  const actionsById = loadActions(actionsCsvPath);
  const { header, rows, idx } = loadCards(cardsCsvPath);

  // Add output column if not exists
  let recIdx = findHeaderIndex(header, ["recommendedMana", "recMana", "manaRecommended"]);
  const newHeader = header.slice();
  if (recIdx < 0) {
    newHeader.push("recommendedMana");
    recIdx = newHeader.length - 1;
  }

  const missing = new Map();

  const newRows = rows.map(r => {
    const attr = r[idx.attr];
    const hp = Number(r[idx.hp] || 0);
    const sp = Number(r[idx.sp] || 0);
    const skills = parseSkillsCell(r[idx.skills]);

    for (const aid of skills) {
      if (!actionsById[aid]) missing.set(aid, (missing.get(aid) || 0) + 1);
    }

    const raw = calcRawPower({ attr, hp, sp, skills }, actionsById);
    const rec = recommendManaFromRaw(attr, raw);

    const outRow = r.slice();
    while (outRow.length < newHeader.length) outRow.push("");

    outRow[recIdx] = (rec == null) ? "" : roundToDecimals(rec, decimals);
    return outRow;
  });

  fs.writeFileSync(outCsvPath, writeCsv(newHeader, newRows), "utf8");

  return {
    outPath: outCsvPath,
    missingActions: [...missing.entries()].sort((a, b) => b[1] - a[1]),
  };
}

// =====================
// CLI wrapper
// =====================
function parseArgs(argv) {
  const args = argv.slice(2);
  const has = (k) => args.includes(k);
  const get = (k, def) => {
    const i = args.indexOf(k);
    return (i >= 0 && args[i + 1]) ? args[i + 1] : def;
  };

  return {
    inPath: get("--in", "cards.csv"),
    actionsPath: get("--actions", "actions.csv"),
    outPath: get("--out", "cards_with_rec_mana.csv"),
    overwrite: has("--overwrite"),
    decimals: Number(get("--decimals", "1")),
  };
}

if (require.main === module) {
  (async () => {
    const opt = parseArgs(process.argv);
    try {
      const result = await runRecommendMana(opt);
      const rel = path.relative(process.cwd(), result.outPath);
      console.log(`OK: wrote ${rel}`);

      if (result.missingActions.length) {
        console.warn("WARN: actions referenced in cards.csv but not found in actions.csv:");
        for (const [k, v] of result.missingActions.slice(0, 20)) {
          console.warn(`  - ${k} (x${v})`);
        }
      }
    } catch (e) {
      console.error(e?.stack || String(e));
      process.exitCode = 1;
    }
  })();
}

// Export for setting.js
module.exports = { runRecommendMana };