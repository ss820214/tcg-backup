// public/tools/generate_card_art.mjs
// Generate deterministic SVG illustrations for locally known cards.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cardArtSvg, safeCardArtId } from "../card_art.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const projectRoot = path.resolve(root, "..");
const outDir = path.join(root, "assets", "card_art");
const manifestPath = path.join(root, "card_art_manifest.js");

function uniqCards(cards) {
  const map = new Map();
  for (const raw of cards || []) {
    if (!raw) continue;
    const id = String(raw.id || raw.cardId || "").trim();
    if (!id) continue;
    map.set(id, { ...raw, id });
  }
  return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id), "ja"));
}

function parseStarterIds(text) {
  const m = text.match(/export\s+const\s+STARTER_CARD_IDS\s*=\s*\[([\s\S]*?)\];/);
  if (!m) return [];
  const ids = [];
  const re = /"([^"]+)"/g;
  let hit;
  while ((hit = re.exec(m[1]))) ids.push(hit[1]);
  return ids;
}

function starterNameFromId(id) {
  const labels = {
    normal_arm: "\u4e00\u822c\u6226\u58eb",
    rare_arm: "\u30d9\u30c6\u30e9\u30f3\u6226\u58eb",
    nabe_tate: "\u306a\u3079\u3076\u305f\u76fe\u5e2b",
    itou1: "\u30d0\u30c3\u30af\u30e9\u30fc\u4f0a\u85e4",
    mamoru_kun: "\u5b88\u541b\u30d5\u30ed\u30f3\u30c8",
    normal_bokusi: "\u65b0\u7c73\u7267\u5e2b",
    sendousi: "\u5148\u5c0e\u5e2b",
    sensei1: "\u7570\u8272\u5ba3\u6559\u5e2b",
    sito: "\u4f7f\u5f92",
    list_cutter: "\u30ea\u30b9\u30c8\u30ab\u30c3\u30bf\u30fc",
    yami_denkyo: "\u95c7\u306e\u4f1d\u6559\u5e2b",
    rock1: "\u6f2c\u7269\u77f3",
    rock2: "\u5de8\u5927\u5076\u50cf",
    rock3: "\u4e07\u91cc\u306e\u9577\u57ce",
    wind1: "\u3064\u3080\u3058\u98a8",
    ninja1: "\u76d7\u64ae\u30be\u30f3\u30d3",
    nausika: "\u30ca\u30a6\u30b7\u30ab",
    plug: "\u96fb\u6e90\u30d7\u30e9\u30b0\u541b",
    INV1: "\u78c1\u30a4\u30f3\u30d0\u30fc\u30bf",
    sennpuuki: "\u5de8\u5927\u6247\u98a8\u6a5f",
    kenkyuui: "\u7814\u4fee\u533b",
    yamiisya: "\u95c7\u533b\u8005",
    inazou: "\u9054\u4eba\u30e1\u30b9\u634c\u304d \u7a32\u9020\u3055\u3093",
  };
  return labels[id] || id;
}

function starterAttrFromId(id) {
  if (/rock/.test(id)) return "\u92fc";
  if (/wind|ninja|nausika/.test(id)) return "\u98a8";
  if (/plug|INV|sennpuuki/.test(id)) return "\u96f7";
  if (/kenkyuui|yamiisya|inazou/.test(id)) return "\u8349";
  if (/bokusi|sendousi|sensei/.test(id)) return "\u5149";
  if (/sito|cutter|yami/.test(id)) return "\u95c7";
  if (/nabe|ito|mamoru/.test(id)) return "\u6c34";
  return "\u706b";
}

function starterDef(id) {
  return {
    id,
    name: starterNameFromId(id),
    kind: "unit",
    type: starterAttrFromId(id),
    attr: starterAttrFromId(id),
    rarity: id.includes("rock3") || id.includes("sennpuuki") ? "SR" : "R",
    cost: Number((String(id).match(/\d+/) || ["2"])[0]) || 2,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      if (quoted && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((v) => String(v || "").trim())) rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.some((v) => String(v || "").trim())) rows.push(row);
  return rows;
}

function csvRowsToObjects(text) {
  const rows = parseCsv(text);
  const header = (rows.shift() || []).map((v) => String(v || "").trim());
  return rows.map((row) => {
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = row[i] ?? "";
    });
    return obj;
  });
}

function safeLocalName(id, rawName) {
  const name = String(rawName || "").trim();
  if (!name) return id;
  // Some legacy CSVs contain mojibake. Keep generated art readable by using
  // the stable card id for those records; the real UI still uses live card names.
  const mojibakeHints = [
    "\ufffd",
    "\u7e3a",
    "\u7e67",
    "\u87c6",
    "\u870d",
    "\u8c4c",
    "\u8f63",
    "\u9ae3",
    "\u9b1a",
    "\u9a6a",
    "\u8708",
    "\u95d5",
    "\u87a2",
    "\u8b14",
    "\u8b41",
  ];
  if (mojibakeHints.some((hint) => name.includes(hint))) return id;
  return name;
}

function localCsvCardDef(row) {
  const id = String(row.cardID || row.cardId || row.id || "").trim();
  if (!id) return null;
  const type = String(row.type || row.attr || "").trim();
  return {
    id,
    name: safeLocalName(id, row.cardName || row.name),
    kind: "unit",
    type,
    attr: type,
    rarity: "R",
    cost: Number(row.cost || 1) || 1,
    hp: Number(row.hp || 0) || 0,
    sp: Number(row.sp || 0) || 0,
  };
}

function localCsvSupportDef(row) {
  const id = String(row.id || row.cardID || row.cardId || "").trim();
  if (!id || id.startsWith("{") || id === "]}" || id === "]}") return null;
  return {
    id,
    name: safeLocalName(id, row.name),
    kind: "support",
    type: "support",
    rarity: "R",
    cost: Number(row.cost || 1) || 1,
  };
}

async function readLocalCsvCards() {
  const files = [
    {
      file: path.join(projectRoot, "scripts", "cards.csv"),
      map: localCsvCardDef,
    },
    {
      file: path.join(projectRoot, "scripts", "support_cards.csv"),
      map: localCsvSupportDef,
    },
  ];
  const out = [];
  for (const item of files) {
    try {
      const text = await fs.readFile(item.file, "utf8");
      out.push(...csvRowsToObjects(text).map(item.map).filter(Boolean));
    } catch (e) {
      console.warn(`[generate_card_art] skipped ${item.file}: ${e?.message || e}`);
    }
  }
  return out;
}

async function importLocalModule(file) {
  return import(pathToFileURL(path.join(root, file)).href);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const [{ FAIRY_TALE_CARD_LIST }, { STARTER_SUPPORT_CARDS }] = await Promise.all([
    importLocalModule("fairy_tale_cards.js"),
    importLocalModule("starter_support_cards.js"),
  ]);

  const userStoreText = await fs.readFile(path.join(root, "user_store.js"), "utf8");
  const starterIds = parseStarterIds(userStoreText);
  const localCsvCards = await readLocalCsvCards();

  const cards = uniqCards([
    ...localCsvCards,
    ...starterIds.map(starterDef),
    ...STARTER_SUPPORT_CARDS,
    ...FAIRY_TALE_CARD_LIST,
    {
      id: "you",
      name: "YOU",
      kind: "unit",
      type: "\u5149",
      attr: "\u5149",
      rarity: "SSR",
      cost: 1,
    },
  ]);

  const ids = [];
  for (const card of cards) {
    const safe = safeCardArtId(card.id);
    ids.push(safe);
    const svg = cardArtSvg(card.id, card);
    await fs.writeFile(path.join(outDir, `${safe}.svg`), svg, "utf8");
  }

  const manifest = `// public/card_art_manifest.js
// Generated by tools/generate_card_art.mjs.

export const CARD_ART_VERSION = "20260731_all_local_art1";
export const CARD_ART_IDS = new Set(${JSON.stringify(ids, null, 2)});
`;
  await fs.writeFile(manifestPath, manifest, "utf8");

  console.log(`Generated ${ids.length} card art SVG files.`);
  console.log(path.relative(process.cwd(), outDir));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
