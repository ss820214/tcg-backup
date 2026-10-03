// public/card_art.js
// v20260828_jewel_art1
// Deterministic per-card illustrations. The art is based on card name/id, not
// on attribute templates. Static cards use saved SVG assets; cloud/custom cards
// fall back to the same generated art as a data URI.

import { CARD_ART_IDS, CARD_ART_VERSION } from "./card_art_manifest.js?v=20260828_jewel_art1";
import { cardIllustrationSrc } from "./card_illustrations.js?v=20260725_dark_illusion_gen1";

const PALETTES = [
  ["#ff6b65", "#ffd1a1", "#241016"],
  ["#62d7ff", "#d8f7ff", "#0b1728"],
  ["#ffdf57", "#fff6b6", "#221b09"],
  ["#73ef9a", "#e5ff9c", "#092017"],
  ["#9ef7ee", "#ffffff", "#092126"],
  ["#dce5ef", "#91a4b8", "#10151d"],
  ["#fff2a8", "#ffffff", "#201b08"],
  ["#b77bff", "#ff8cdf", "#170b23"],
  ["#78f3ff", "#dba0ff", "#091524"],
  ["#ff9a5f", "#ffe0c0", "#25110a"],
  ["#8cb7ff", "#d9e8ff", "#0b1322"],
  ["#f6a7ff", "#fff1fb", "#221023"],
];

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function attrEscape(value) {
  return xmlEscape(value).replaceAll("\n", " ");
}

export function safeCardArtId(cardId) {
  const raw = String(cardId || "unknown").trim() || "unknown";
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 96);
}

export function isSupportLike(def = {}) {
  const kind = String(def?.kind || "").toLowerCase();
  const type = String(def?.type || "").toLowerCase();
  return kind.includes("support") || type === "support" || type.includes("support");
}

export function cardArtAttr(def = {}) {
  return String(def?.type || def?.attr || "").trim();
}

export function hashCardSeed(cardId, def = {}) {
  const src = `${cardId}|${def?.name || ""}|${def?.type || ""}|${def?.kind || ""}|${def?.series || ""}`;
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed, n) {
  let x = (seed + Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967295;
}

function pick(seed, list, n = 0) {
  return list[Math.floor(rand(seed, n) * list.length) % list.length];
}

function shortCardName(name, max = 9) {
  const s = String(name || "").trim();
  if (!s) return "";
  return [...s].slice(0, max).join("");
}

function searchText(cardId, def = {}) {
  const bits = [
    cardId,
    def?.id,
    def?.name,
    def?.kind,
    def?.series,
    def?.theme,
    def?.pack,
    def?.source,
    def?.effect,
  ];
  for (const action of Array.isArray(def?.actions) ? def.actions : []) {
    bits.push(action?.id, action?.name, action?.range, action?.tags);
  }
  return bits.flat().filter(Boolean).join(" ").toLowerCase();
}

function has(text, words) {
  return words.some((word) => text.includes(String(word).toLowerCase()));
}

function subjectFromName(cardId, def = {}) {
  const text = searchText(cardId, def);
  const idText = String(cardId || def?.id || "").trim().toLowerCase();
  const idRules = [
    ["trainingSoldier", ["kummernhei"]],
    ["warrior", ["normal_arm", "rare_arm"]],
    ["potShield", ["nabe_tate"]],
    ["buckler", ["itou1"]],
    ["guardian", ["mamoru_kun"]],
    ["priest", ["normal_bokusi", "sendousi", "sensei1", "sito", "yami_denkyo"]],
    ["cutter", ["list_cutter"]],
    ["stone", ["rock1"]],
    ["statue", ["rock2"]],
    ["greatWall", ["rock3"]],
    ["gust", ["wind1"]],
    ["cameraZombie", ["ninja1"]],
    ["glider", ["nausika"]],
    ["plugPerson", ["plug"]],
    ["inverter", ["inv1"]],
    ["fanMachine", ["sennpuuki"]],
    ["doctorIntern", ["kenkyuui"]],
    ["darkDoctor", ["yamiisya"]],
    ["scalpelMaster", ["inazou"]],
    ["maintenanceWindow", ["s112"]],
    ["focus", ["s003", "s107"]],
    ["weirdImage", ["s004"]],
    ["molotov", ["s005"]],
    ["assignmentNotice", ["s006"]],
    ["boosterVial", ["s007", "s108", "s113"]],
    ["escapeDevice", ["s009"]],
    ["departmentMove", ["s010"]],
    ["exileBoat", ["s011"]],
    ["meteor", ["s012"]],
    ["quickReaction", ["s101"]],
    ["book", ["s001", "s102"]],
    ["phone", ["s103"]],
    ["extinguisher", ["s105"]],
    ["pepTalk", ["s106"]],
    ["safetyCheck", ["s109"]],
    ["cleanup", ["s002", "s008", "s110", "s111"]],
    ["manaExtract", ["s114"]],
  ];
  for (const [subject, ids] of idRules) {
    if (ids.includes(idText)) return subject;
  }
  const rules = [
    ["redhood", ["redhood"]],
    ["matchGirl", ["match_girl", "match girl", "match"]],
    ["candyKnight", ["candy", "ginger"]],
    ["beanDragon", ["bean", "dragon"]],
    ["piper", ["piper"]],
    ["cinder", ["cinder", "ash"]],
    ["phoenixTailor", ["phoenix", "tailor"]],
    ["mermaid", ["mermaid"]],
    ["snowQueen", ["snow queen", "snow_queen"]],
    ["frogPrince", ["frog"]],
    ["blueBeard", ["bluebeard", "blue_beard"]],
    ["swanKnight", ["swan"]],
    ["turtleMoon", ["turtle", "moon"]],
    ["leviathanBook", ["leviathan"]],
    ["bootsCat", ["cat", "boots"]],
    ["tinSoldier", ["tin"]],
    ["jackThunder", ["jack", "thunder"]],
    ["clockRabbit", ["rabbit", "clock"]],
    ["goldGoose", ["goose"]],
    ["sleepingPrincess", ["sleep", "sleeping"]],
    ["cloudGiant", ["cloud", "giant"]],
    ["roseGarden", ["rose"]],
    ["bearGuard", ["bear"]],
    ["rapunzel", ["rapunzel"]],
    ["lostSiblings", ["siblings"]],
    ["thumbelina", ["thumbelina"]],
    ["greenKnight", ["green_knight"]],
    ["worldTree", ["world_tree", "world tree"]],
    ["flyingBoy", ["flying_boy", "peter"]],
    ["tinkerBell", ["tinker"]],
    ["flyingCarpet", ["carpet"]],
    ["nightBird", ["night_bird"]],
    ["wildSwan", ["wild_swan"]],
    ["glassMountain", ["glass_mountain"]],
    ["pegasus", ["pegasus"]],
    ["tinHeart", ["tin_heart"]],
    ["ironHans", ["iron_hans"]],
    ["duckMachine", ["duck_machine"]],
    ["nutcracker", ["nutcracker"]],
    ["gateKnight", ["gate_knight"]],
    ["silverShoes", ["silver_shoes"]],
    ["steelGiant", ["steel_giant"]],
    ["cinderellaShoe", ["cinderella", "shoe"]],
    ["snowApple", ["snow_apple"]],
    ["holyMirror", ["holy_mirror", "mirror"]],
    ["starChild", ["star_child"]],
    ["swanPrince", ["swan_prince"]],
    ["lampPrince", ["lamp"]],
    ["storyteller", ["storyteller"]],
    ["wolf", ["wolf"]],
    ["witchHouse", ["witch"]],
    ["blackSwan", ["black_swan"]],
    ["shadowPiper", ["shadow_piper"]],
    ["poisonQueen", ["poison_queen"]],
    ["curseSpinner", ["curse", "spinner"]],
    ["darkDragonMirror", ["dark_dragon", "dragon_mirror"]],
    ["alice", ["alice"]],
    ["cheshire", ["cheshire"]],
    ["madTea", ["mad_tea", "tea"]],
    ["muckBoot", ["muck", "boot"]],
    ["bremen", ["bremen"]],
    ["moonRabbit", ["moon_rabbit"]],
    ["fairyKing", ["fairy_king"]],
    ["warrior", ["normal_arm", "rare_arm", "warrior"]],
    ["potShield", ["nabe_tate", "shield"]],
    ["buckler", ["itou1", "buckler"]],
    ["guardian", ["mamoru", "guardian"]],
    ["priest", ["bokusi", "sendousi", "sensei", "sito", "denkyo", "priest"]],
    ["cutter", ["cutter"]],
    ["stone", ["rock1", "stone"]],
    ["statue", ["rock2", "statue"]],
    ["greatWall", ["rock3", "wall"]],
    ["gust", ["wind1", "gust"]],
    ["cameraZombie", ["ninja1", "camera", "zombie"]],
    ["glider", ["nausika", "glider"]],
    ["plugPerson", ["plug"]],
    ["inverter", ["inv1", "inverter"]],
    ["fanMachine", ["sennpuuki", "fan"]],
    ["doctor", ["kenkyuui", "yamiisya", "doctor", "medical"]],
    ["scalpelMaster", ["inazou", "scalpel"]],
    ["maintenanceWindow", ["s112", "maintenance"]],
    ["focus", ["s003", "s107", "focus"]],
    ["weirdImage", ["s004", "image"]],
    ["molotov", ["s005", "molotov"]],
    ["assignmentNotice", ["s006", "notice"]],
    ["boosterVial", ["s007", "s108", "s113", "booster"]],
    ["escapeDevice", ["s009", "escape"]],
    ["departmentMove", ["s010", "move"]],
    ["exileBoat", ["s011", "boat"]],
    ["meteor", ["s012", "meteor"]],
    ["quickReaction", ["s101", "reaction"]],
    ["book", ["s001", "s102", "book"]],
    ["phone", ["s103", "phone"]],
    ["extinguisher", ["s105", "extinguisher"]],
    ["pepTalk", ["s106", "pep"]],
    ["safetyCheck", ["s109", "safety"]],
    ["manaExtract", ["s114", "mana"]],
    ["cleanup", ["s002", "s008", "s110", "s111", "cleanup"]],
    ["thunderSupport", ["thunder"]],
    ["retreat", ["retreat"]],
  ];
  for (const [subject, words] of rules) {
    if (has(text, words)) return subject;
  }
  return isSupportLike(def) ? "customSupport" : "customUnit";
}

function paletteFor(seed) {
  const base = PALETTES[seed % PALETTES.length];
  const alt = PALETTES[Math.floor(rand(seed, 5) * PALETTES.length) % PALETTES.length];
  return [base[0], alt[1], base[2]];
}

export function cardArtPalette(def = {}) {
  return paletteFor(hashCardSeed(def?.id || def?.cardId || def?.name || "card", def));
}

export function cardArtSymbol(def = {}) {
  const name = String(def?.name || def?.id || "");
  return [...name.trim()][0] || "?";
}

function sparkle(seed) {
  let out = "";
  for (let i = 0; i < 9; i++) {
    const x = 18 + Math.round(rand(seed, i + 20) * 220);
    const y = 28 + Math.round(rand(seed, i + 40) * 248);
    const r = 1.2 + rand(seed, i + 60) * 2.4;
    const o = 0.14 + rand(seed, i + 80) * 0.34;
    out += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="white" opacity="${o.toFixed(2)}"/>`;
  }
  return out;
}

function signatureProps(seed) {
  const props = [
    `<path d="M48 250c34-22 68-22 102 0" fill="none" stroke="white" stroke-opacity=".18" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M44 98h50M162 238h46" stroke="white" stroke-opacity=".20" stroke-width="7" stroke-linecap="round"/>`,
    `<circle cx="${58 + Math.round(rand(seed, 90) * 20)}" cy="216" r="14" fill="url(#core)" opacity=".46"/>`,
    `<rect x="${158 + Math.round(rand(seed, 91) * 16)}" y="88" width="34" height="34" rx="10" fill="url(#paper)" opacity=".35"/>`,
    `<path d="M202 118l17 13-17 13-17-13Z" fill="url(#core)" opacity=".46"/>`,
  ];
  const a = props[Math.floor(rand(seed, 92) * props.length) % props.length];
  const b = props[Math.floor(rand(seed, 93) * props.length) % props.length];
  return `${a}${b}`;
}

function person({ head = 128, y = 116, robe = 148, w = 72, accessory = "" } = {}) {
  return `
    <circle cx="${head}" cy="${y}" r="27" fill="url(#core)" opacity=".95"/>
    <path d="M${head - w / 2} ${robe}q${w / 2}-30 ${w} 0l24 102q-54 34-120 0Z" fill="url(#figure)" opacity=".92"/>
    ${accessory}
  `;
}

function wingPair(cx = 128, cy = 160) {
  return `
    <path d="M${cx - 16} ${cy}c-45-42-74-35-91 10c38-2 60 20 86 49Z" fill="url(#paper)" opacity=".62"/>
    <path d="M${cx + 16} ${cy}c45-42 74-35 91 10c-38-2-60 20-86 49Z" fill="url(#paper)" opacity=".62"/>
  `;
}

function subjectMarkup(subject, seed) {
  const rot = -10 + Math.round(rand(seed, 2) * 20);
  const dx = Math.round(rand(seed, 3) * 18) - 9;
  switch (subject) {
    case "redhood":
      return person({ accessory: `<path d="M88 109q40-62 80 0q-13 26-40 31q-27-5-40-31Z" fill="#d72e3d" opacity=".9"/><path d="M167 190l30 20-42 13" fill="none" stroke="url(#core)" stroke-width="12" stroke-linecap="round"/><path d="M188 175c13 22-11 31-1 54-33-15-38-35 1-54Z" fill="url(#core)"/>` });
    case "matchGirl":
      return `<path d="M74 228l96-126" stroke="url(#paper)" stroke-width="12" stroke-linecap="round"/><path d="M170 94c24 28-6 37 6 70-42-16-48-46-6-70Z" fill="url(#core)"/><circle cx="92" cy="206" r="24" fill="url(#figure)" opacity=".78"/>`;
    case "candyKnight":
      return `${person({ accessory: `<path d="M72 229h112v32H72z" fill="url(#paper)" opacity=".55"/><circle cx="86" cy="229" r="12" fill="url(#core)"/><circle cx="170" cy="229" r="12" fill="url(#core)"/>` })}<path d="M86 92h84l14 30H72Z" fill="url(#paper)" opacity=".58"/>`;
    case "beanDragon":
      return `<path d="M92 268c8-80 4-130 74-188" fill="none" stroke="url(#figure)" stroke-width="17" stroke-linecap="round"/><path d="M130 146c34-40 70-12 58 28l-32-4 28 26c-48 14-75-3-54-50Z" fill="url(#core)" opacity=".9"/><path d="M98 199c-31-12-41-36-20-57 27 8 43 28 20 57Z" fill="url(#paper)" opacity=".58"/>`;
    case "piper":
    case "shadowPiper":
      return `${person({ accessory: `<path d="M93 178l99-37" stroke="url(#core)" stroke-width="12" stroke-linecap="round"/><circle cx="196" cy="138" r="12" fill="url(#paper)" opacity=".72"/>` })}`;
    case "phoenixTailor":
      return `${wingPair()}<path d="M129 74c42 58-20 60 28 110 32 33 1 83-43 72-43-11-39-58-4-88 19-16 24-44 19-94Z" fill="url(#core)" opacity=".92"/><path d="M74 255l104-102" stroke="white" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>`;
    case "mermaid":
      return `${person({ y: 104, robe: 140, w: 58 })}<path d="M109 221c23 4 40-8 62-38-4 58-34 88-74 88 21-18 21-36 12-50Z" fill="url(#core)" opacity=".85"/><path d="M66 217c37 17 80 13 124-13" fill="none" stroke="white" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>`;
    case "snowQueen":
      return `${person({ accessory: `<path d="M96 75h64l-19 31h-26Z" fill="url(#paper)" opacity=".82"/><path d="M96 190l32-34 32 34-32 34Z" fill="url(#core)" opacity=".55"/>` })}`;
    case "frogPrince":
      return `<ellipse cx="128" cy="166" rx="72" ry="54" fill="url(#figure)" opacity=".92"/><circle cx="92" cy="118" r="26" fill="url(#core)"/><circle cx="164" cy="118" r="26" fill="url(#core)"/><path d="M100 208q28 23 56 0" fill="none" stroke="white" stroke-opacity=".48" stroke-width="8" stroke-linecap="round"/><path d="M97 76h62l-13 28h-36Z" fill="url(#paper)" opacity=".75"/>`;
    case "blueBeard":
      return person({ accessory: `<path d="M107 139q21 54 43 0v70q-24 20-48 0Z" fill="url(#core)" opacity=".6"/><path d="M84 230h88" stroke="url(#paper)" stroke-width="10" stroke-linecap="round"/>` });
    case "swanKnight":
    case "wildSwan":
    case "swanPrince":
      return `${wingPair()}${person({ accessory: `<path d="M102 88q26-28 52 0" fill="none" stroke="white" stroke-opacity=".65" stroke-width="8" stroke-linecap="round"/>` })}`;
    case "turtleMoon":
      return `<ellipse cx="128" cy="175" rx="78" ry="58" fill="url(#figure)" opacity=".9"/><path d="M75 175h106M128 119v112M92 136q36 36 72 0M92 214q36-36 72 0" stroke="white" stroke-opacity=".25" stroke-width="6"/><circle cx="185" cy="91" r="27" fill="url(#paper)" opacity=".72"/>`;
    case "leviathanBook":
      return `<rect x="67" y="120" width="122" height="92" rx="14" fill="url(#paper)" opacity=".72"/><path d="M128 120v92M85 146h32M139 146h32M82 178h38M139 178h36" stroke="#0b1320" stroke-opacity=".4" stroke-width="5"/><path d="M52 234c42-64 111-42 152-83-4 64-72 105-152 83Z" fill="url(#core)" opacity=".74"/>`;
    case "bootsCat":
    case "cheshire":
      return `<circle cx="128" cy="132" r="48" fill="url(#figure)" opacity=".92"/><path d="M89 104l-19-32 37 13M167 104l19-32-37 13" fill="url(#figure)"/><path d="M94 162q34 26 68 0" fill="none" stroke="white" stroke-opacity=".55" stroke-width="8" stroke-linecap="round"/><path d="M85 240h38M143 240h38" stroke="url(#core)" stroke-width="16" stroke-linecap="round"/>`;
    case "trainingSoldier":
      return `${person({ accessory: `<path d="M92 80h72v24H92z" fill="url(#paper)" opacity=".54"/><path d="M82 225l84-78" stroke="url(#core)" stroke-width="10" stroke-linecap="round"/><circle cx="180" cy="134" r="18" fill="url(#paper)" opacity=".45"/>` })}<path d="M78 252h100" stroke="white" stroke-opacity=".22" stroke-width="8" stroke-linecap="round"/>`;
    case "potShield":
      return `<path d="M74 92h108q11 0 11 11v63q0 57-65 96-65-39-65-96v-63q0-11 11-11Z" fill="url(#figure)" opacity=".92"/><path d="M94 119h68M94 150h68M128 92v151" stroke="white" stroke-opacity=".22" stroke-width="7" stroke-linecap="round"/><circle cx="128" cy="171" r="31" fill="url(#core)" opacity=".55"/>`;
    case "buckler":
      return `<circle cx="128" cy="170" r="78" fill="url(#figure)" opacity=".9"/><circle cx="128" cy="170" r="50" fill="none" stroke="white" stroke-opacity=".24" stroke-width="10"/><circle cx="128" cy="170" r="18" fill="url(#core)" opacity=".82"/><path d="M70 238q58 28 116 0" fill="none" stroke="url(#paper)" stroke-width="9" stroke-linecap="round" opacity=".6"/>`;
    case "guardian":
      return `${person({ accessory: `<path d="M82 143h92v92q-46 34-92 0Z" fill="url(#paper)" opacity=".5"/><path d="M128 154v68M101 188h54" stroke="url(#core)" stroke-width="9" stroke-linecap="round"/>` })}`;
    case "priest":
      return `${person({ accessory: `<path d="M128 154v86M100 188h56" stroke="url(#core)" stroke-width="11" stroke-linecap="round"/><path d="M82 248q46 25 92 0" fill="none" stroke="white" stroke-opacity=".24" stroke-width="8" stroke-linecap="round"/>` })}<circle cx="128" cy="83" r="20" fill="none" stroke="url(#paper)" stroke-width="8" opacity=".58"/>`;
    case "cutter":
      return `<path d="M64 234l120-128 21 21L85 255q-18 2-21-21Z" fill="url(#paper)" opacity=".84"/><path d="M82 235l102-109" stroke="url(#core)" stroke-width="7" stroke-linecap="round"/><path d="M66 105q62 40 124 0" fill="none" stroke="white" stroke-opacity=".15" stroke-width="10" stroke-linecap="round"/>`;
    case "stone":
      return `<path d="M69 202q7-76 70-104 54 21 67 92-25 55-92 66-35-10-45-54Z" fill="url(#figure)" opacity=".92"/><path d="M98 133l47-14M88 186l86-27M110 226l60-23" stroke="white" stroke-opacity=".18" stroke-width="8" stroke-linecap="round"/>`;
    case "statue":
      return `<path d="M91 91h74l-16 55h-42Z" fill="url(#paper)" opacity=".62"/><path d="M89 146h78v96H89Z" fill="url(#figure)" opacity=".9"/><path d="M69 258h118" stroke="url(#core)" stroke-width="16" stroke-linecap="round"/><circle cx="128" cy="121" r="21" fill="url(#core)" opacity=".5"/>`;
    case "gust":
      return `<path d="M56 122c56-46 132-29 138 22-38-18-78-8-116 28M44 197c56-43 132-31 154 18-47-13-83-4-118 25" fill="none" stroke="url(#paper)" stroke-width="13" stroke-linecap="round" opacity=".76"/><circle cx="177" cy="112" r="20" fill="url(#core)" opacity=".66"/>`;
    case "cameraZombie":
      return `${person({ accessory: `<rect x="80" y="155" width="98" height="62" rx="14" fill="rgba(0,0,0,.46)" stroke="url(#paper)" stroke-width="6"/><circle cx="129" cy="186" r="18" fill="url(#core)"/><path d="M82 230q46 28 92 0" fill="none" stroke="white" stroke-opacity=".22" stroke-width="8" stroke-linecap="round"/>` })}`;
    case "glider":
      return `<path d="M35 133c58-52 128-53 186 0-51 5-78 28-93 76-15-48-42-71-93-76Z" fill="url(#paper)" opacity=".74"/><path d="M128 139v96M86 245h84" stroke="url(#core)" stroke-width="10" stroke-linecap="round"/><circle cx="128" cy="229" r="18" fill="url(#figure)" opacity=".86"/>`;
    case "tinSoldier":
    case "warrior":
      return person({ accessory: `<path d="M93 83h70v25H93z" fill="url(#paper)" opacity=".66"/><path d="M184 115v116" stroke="url(#core)" stroke-width="10" stroke-linecap="round"/>` });
    case "jackThunder":
    case "thunderSupport":
      return `<path d="M147 66 74 188h49l-23 102 84-135h-52Z" fill="url(#core)" opacity=".94"/><path d="M88 232c40 19 72 19 112 0" fill="none" stroke="white" stroke-opacity=".25" stroke-width="8" stroke-linecap="round"/>`;
    case "clockRabbit":
    case "moonRabbit":
      return `<circle cx="128" cy="152" r="53" fill="url(#paper)" opacity=".82"/><path d="M105 104c-26-47-8-78 22-28M151 104c26-47 8-78-22-28" fill="none" stroke="url(#core)" stroke-width="14" stroke-linecap="round"/><path d="M128 152v-33M128 152l29 19" stroke="#10151d" stroke-opacity=".56" stroke-width="7" stroke-linecap="round"/>`;
    case "goldGoose":
      return `<path d="M72 177c36-67 117-61 121 7-28-19-56-1-65 51-17-44-44-51-56-58Z" fill="url(#core)" opacity=".88"/><circle cx="162" cy="129" r="22" fill="url(#paper)" opacity=".78"/><path d="M181 129l31 9-31 9Z" fill="url(#paper)" opacity=".75"/>`;
    case "rapunzel":
      return `<rect x="89" y="91" width="78" height="162" rx="12" fill="url(#figure)" opacity=".88"/><path d="M83 91h90l-16-31h-58Z" fill="url(#paper)" opacity=".55"/><path d="M135 104c-14 50 38 75 8 154" fill="none" stroke="url(#core)" stroke-width="15" stroke-linecap="round"/>`;
    case "greatWall":
    case "gateKnight":
      return `<path d="M56 120h144v121H56Z" fill="url(#figure)" opacity=".9"/><path d="M56 155h144M56 199h144M91 120v35M147 155v44M94 199v42M166 199v42" stroke="#0b1320" stroke-opacity=".43" stroke-width="7"/><path d="M47 109h162" stroke="url(#paper)" stroke-width="13" stroke-linecap="round"/>`;
    case "plugPerson":
    case "inverter":
      return `${person({ accessory: `<path d="M99 73v43M157 73v43" stroke="white" stroke-opacity=".65" stroke-width="12" stroke-linecap="round"/><path d="M138 160l-26 44h25l-17 43 42-60h-25Z" fill="url(#core)" opacity=".95"/>` })}`;
    case "fanMachine":
      return `<circle cx="128" cy="161" r="67" fill="none" stroke="url(#paper)" stroke-width="10" opacity=".58"/><circle cx="128" cy="161" r="18" fill="url(#core)"/><path d="M128 143c40-57 82-17 34 23M110 171c-64-8-47-66 11-29M138 175c22 61-42 68-28 3" fill="url(#figure)" opacity=".84"/>`;
    case "doctorIntern":
      return `${person({ accessory: `<path d="M86 144h84v104q-42 22-84 0Z" fill="url(#paper)" opacity=".72"/><path d="M128 164v34M111 181h34" stroke="url(#core)" stroke-width="9" stroke-linecap="round"/><rect x="72" y="207" width="54" height="42" rx="10" fill="rgba(0,0,0,.38)" stroke="white" stroke-opacity=".18"/><path d="M84 222h28M84 236h19" stroke="white" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>` })}<path d="M80 93q48-22 96 0" fill="none" stroke="url(#paper)" stroke-width="10" stroke-linecap="round" opacity=".55"/>`;
    case "darkDoctor":
      return `${person({ accessory: `<path d="M82 143h92v111q-46 24-92 0Z" fill="#101018" opacity=".82"/><path d="M127 164v38M108 183h38" stroke="url(#core)" stroke-width="9" stroke-linecap="round"/><path d="M169 205c24 23 10 51-18 48-16-21-11-43 18-48Z" fill="url(#core)" opacity=".76"/>` })}`;
    case "scalpelMaster":
      return `${person({ accessory: `<path d="M88 143h80v96q-40 22-80 0Z" fill="url(#paper)" opacity=".58"/><path d="M71 236l110-91 15 19-110 91q-15-1-15-19Z" fill="url(#core)" opacity=".9"/><path d="M100 127q28 16 56 0" stroke="white" stroke-opacity=".45" stroke-width="8" stroke-linecap="round"/>` })}`;
    case "doctor":
      return `${person({ accessory: `<rect x="82" y="192" width="92" height="56" rx="14" fill="url(#paper)" opacity=".68"/><path d="M128 205v30M113 220h30" stroke="url(#core)" stroke-width="10" stroke-linecap="round"/>` })}`;
    case "maintenanceWindow":
      return `<rect x="58" y="91" width="140" height="112" rx="16" fill="url(#paper)" opacity=".82"/><path d="M58 129h140M104 91v112" stroke="#0b1320" stroke-opacity=".42" stroke-width="7"/><path d="M91 240l57-57 19 19-57 57q-13 5-23-5t4-14Z" fill="url(#core)" opacity=".94"/>`;
    case "phone":
      return `<rect x="89" y="75" width="78" height="162" rx="18" fill="url(#figure)" opacity=".9"/><circle cx="128" cy="214" r="8" fill="url(#core)"/><path d="M104 108h48M104 135h48M104 162h48" stroke="white" stroke-opacity=".34" stroke-width="6" stroke-linecap="round"/>`;
    case "book":
      return `<rect x="64" y="104" width="128" height="122" rx="14" fill="url(#paper)" opacity=".78"/><path d="M128 104v122M83 136h30M143 136h30M82 174h37M143 174h36" stroke="#0b1320" stroke-opacity=".42" stroke-width="6" stroke-linecap="round"/>`;
    case "molotov":
      return `<path d="M105 93h45v40l-12 20v88q0 24-34 24t-34-24v-88l35-20Z" fill="url(#figure)" opacity=".9"/><path d="M127 63c19 29-8 34 8 65-36-12-41-37-8-65Z" fill="url(#core)"/>`;
    case "extinguisher":
      return `<rect x="87" y="121" width="82" height="130" rx="22" fill="url(#figure)" opacity=".9"/><path d="M104 103h48M128 103v-31M152 82h38" stroke="url(#paper)" stroke-width="11" stroke-linecap="round"/><path d="M97 177h62" stroke="white" stroke-opacity=".42" stroke-width="8" stroke-linecap="round"/>`;
    case "assignmentNotice":
    case "safetyCheck":
    case "retreat":
      return `<rect x="72" y="90" width="112" height="152" rx="16" fill="url(#paper)" opacity=".84"/><path d="M94 132h68M94 164h68M94 196h48" stroke="#0b1320" stroke-opacity=".45" stroke-width="6" stroke-linecap="round"/><path d="M157 214l18 18 34-43" fill="none" stroke="url(#core)" stroke-width="10" stroke-linecap="round"/>`;
    case "departmentMove":
    case "exileBoat":
      return `<path d="M72 132h90l-27-27M162 132l-27 27" fill="none" stroke="url(#core)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M69 228c44 21 90 19 138-5l-24 34H91Z" fill="url(#figure)" opacity=".85"/>`;
    case "meteor":
      return `<path d="M60 232c81-58 117-97 141-167-62 31-113 66-165 146Z" fill="url(#core)" opacity=".9"/><circle cx="93" cy="207" r="34" fill="url(#figure)" opacity=".92"/>`;
    case "manaExtract":
      return `<path d="M128 70l62 84-62 114-62-114Z" fill="url(#figure)" opacity=".86"/><circle cx="128" cy="155" r="34" fill="url(#core)" opacity=".78"/><path d="M128 101v110M94 155h68" stroke="white" stroke-opacity=".32" stroke-width="7" stroke-linecap="round"/>`;
    case "focus":
      return `<circle cx="128" cy="166" r="72" fill="none" stroke="url(#paper)" stroke-width="10" opacity=".58"/><circle cx="128" cy="166" r="38" fill="none" stroke="url(#core)" stroke-width="9"/><circle cx="128" cy="166" r="12" fill="white" opacity=".88"/><path d="M128 62v45M128 225v45M24 166h45M187 166h45" stroke="url(#core)" stroke-width="8" stroke-linecap="round"/>`;
    case "weirdImage":
      return `<rect x="58" y="82" width="140" height="170" rx="18" fill="url(#figure)" opacity=".82"/><path d="M82 130c31-38 61 45 94 5M82 184c44 33 64-37 94 6" fill="none" stroke="url(#paper)" stroke-width="10" stroke-linecap="round" opacity=".65"/><circle cx="98" cy="221" r="14" fill="url(#core)"/><circle cx="161" cy="112" r="14" fill="url(#core)"/>`;
    case "boosterVial":
      return `<path d="M108 76h42v47l-52 96q-17 33 30 47 47-14 30-47l-50-96Z" fill="url(#figure)" opacity=".88"/><path d="M104 187h48M128 159v58M106 102h46" stroke="url(#core)" stroke-width="9" stroke-linecap="round"/><circle cx="91" cy="234" r="14" fill="url(#paper)" opacity=".5"/>`;
    case "escapeDevice":
      return `<rect x="68" y="96" width="120" height="132" rx="22" fill="url(#figure)" opacity=".9"/><path d="M101 156h81l-31-31M182 156l-31 31" fill="none" stroke="url(#core)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M80 242h96" stroke="url(#paper)" stroke-width="10" stroke-linecap="round" opacity=".56"/>`;
    case "cleanup":
      return `<path d="M85 88h86v41H85Z" fill="url(#paper)" opacity=".68"/><path d="M91 129h74v104q-37 31-74 0Z" fill="url(#figure)" opacity=".9"/><path d="M110 174h36M128 156v36" stroke="url(#core)" stroke-width="9" stroke-linecap="round"/><path d="M74 250c38 20 80 20 118 0" stroke="white" stroke-opacity=".23" stroke-width="9" stroke-linecap="round"/>`;
    case "quickReaction":
      return `<path d="M128 67l70 68h-42v91h-56v-91H58Z" fill="url(#figure)" opacity=".9"/><path d="M84 245h88" stroke="url(#core)" stroke-width="13" stroke-linecap="round"/><circle cx="188" cy="96" r="18" fill="url(#paper)" opacity=".54"/>`;
    case "customSupport":
      return `<rect x="70" y="90" width="116" height="150" rx="18" fill="url(#paper)" opacity=".82"/><path d="M92 136h72M92 170h84M92 204h52" stroke="#0b1320" stroke-opacity=".39" stroke-width="6" stroke-linecap="round"/><circle cx="168" cy="107" r="17" fill="url(#core)" opacity=".78"/>`;
    default: {
      const head = 24 + Math.round(rand(seed, 30) * 12);
      const w = 64 + Math.round(rand(seed, 31) * 34);
      return person({ head: 128 + dx, y: 113, robe: 148, w, accessory: `<path d="M${83 + dx} 205q45 25 90 0" fill="none" stroke="white" stroke-opacity=".22" stroke-width="8" stroke-linecap="round"/><circle cx="${92 + dx}" cy="111" r="${Math.max(8, Math.round(head / 2))}" fill="url(#paper)" opacity=".34"/>` });
    }
  }
}

export function cardArtSvg(cardId, def = {}, opts = {}) {
  const seed = hashCardSeed(cardId, def);
  const [a, b, c] = paletteFor(seed);
  const name = shortCardName(def?.name || cardId, opts.nameMax || 9);
  const rarity = String(def?.rarity || "R").toUpperCase();
  const cost = String(def?.cost ?? "?");
  const id = safeCardArtId(cardId);
  const subject = subjectFromName(cardId, def);
  const ringRot = Math.round(rand(seed, 2) * 360);
  const slashRot = -26 + Math.round(rand(seed, 3) * 52);
  const accentGlyph = [...String(def?.name || cardId || "?").trim()][0] || "?";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="356" viewBox="0 0 256 356" role="img" aria-label="${attrEscape(name || cardId)} illustration">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset=".52" stop-color="${c}"/>
      <stop offset="1" stop-color="#07090d"/>
    </linearGradient>
    <radialGradient id="halo" cx=".50" cy=".34" r=".60">
      <stop offset="0" stop-color="${b}" stop-opacity=".78"/>
      <stop offset=".42" stop-color="${a}" stop-opacity=".24"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="figure" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${b}"/>
      <stop offset=".62" stop-color="${a}"/>
      <stop offset="1" stop-color="#10131a"/>
    </linearGradient>
    <radialGradient id="core" cx=".38" cy=".22" r=".7">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".32" stop-color="${b}"/>
      <stop offset="1" stop-color="${a}"/>
    </radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".92"/>
      <stop offset="1" stop-color="${b}" stop-opacity=".45"/>
    </linearGradient>
    <filter id="${id}_glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="256" height="356" rx="26" fill="#080b12"/>
  <rect x="7" y="7" width="242" height="342" rx="22" fill="url(#bg)"/>
  <rect x="10" y="10" width="236" height="336" rx="19" fill="url(#halo)"/>
  <path d="M-20 92 C64 44 132 48 276 12" stroke="white" stroke-opacity=".10" stroke-width="42"/>
  <path d="M-18 286 C72 222 178 282 274 216" stroke="${b}" stroke-opacity=".16" stroke-width="38"/>
  <g transform="rotate(${ringRot} 128 176)" opacity=".36">
    <ellipse cx="128" cy="176" rx="83" ry="118" fill="none" stroke="white" stroke-opacity=".15" stroke-width="2"/>
    <ellipse cx="128" cy="176" rx="54" ry="104" fill="none" stroke="${b}" stroke-opacity=".26" stroke-width="4"/>
  </g>
  <path d="M20 252 L236 84" stroke="white" stroke-opacity=".12" stroke-width="2"/>
  <path d="M${42 + Math.round(rand(seed, 11) * 32)} 306 L${188 + Math.round(rand(seed, 12) * 36)} 72" stroke="${b}" stroke-opacity=".18" stroke-width="7" transform="rotate(${slashRot} 128 178)"/>
  <g opacity=".82">${signatureProps(seed)}</g>
  <g filter="url(#${id}_glow)">${subjectMarkup(subject, seed)}</g>
  ${sparkle(seed)}
  <rect x="18" y="18" width="42" height="42" rx="14" fill="rgba(0,0,0,.38)" stroke="white" stroke-opacity=".22"/>
  <text x="39" y="46" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="white">${xmlEscape(cost)}</text>
  <rect x="190" y="18" width="48" height="30" rx="15" fill="rgba(0,0,0,.34)" stroke="white" stroke-opacity=".22"/>
  <text x="214" y="38" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="white">${xmlEscape(rarity)}</text>
  <rect x="21" y="264" width="42" height="24" rx="12" fill="rgba(0,0,0,.32)" stroke="white" stroke-opacity=".14"/>
  <text x="42" y="281" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="900" fill="white" opacity=".66">${xmlEscape(accentGlyph)}</text>
  <rect x="18" y="292" width="220" height="44" rx="14" fill="rgba(0,0,0,.44)" stroke="white" stroke-opacity=".16"/>
  <text x="128" y="319" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="white">${xmlEscape(name || cardId)}</text>
</svg>`;
}

export function cardArtDataUri(cardId, def = {}) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(cardArtSvg(cardId, def))}`;
}

export function cardArtFileUrl(cardId) {
  return `./assets/card_art/${safeCardArtId(cardId)}.svg?v=${CARD_ART_VERSION}`;
}

export function cardArtSrc(cardId, def = {}) {
  const direct = String(def?.imageUrl || def?.artUrl || def?.illustrationUrl || "").trim();
  if (direct) return direct;
  const illustrated = cardIllustrationSrc(cardId);
  if (illustrated) return illustrated;
  const safe = safeCardArtId(cardId);
  if (CARD_ART_IDS.has(safe)) return cardArtFileUrl(cardId);
  return cardArtDataUri(cardId, def);
}

export function cardArtImgHtml(cardId, def = {}, className = "cardArtImg") {
  const src = cardArtSrc(cardId, def);
  const alt = `${def?.name || cardId || "card"} illustration`;
  return `<img class="${attrEscape(className)}" src="${attrEscape(src)}" alt="${attrEscape(alt)}" loading="lazy" decoding="async" />`;
}

export function cardArtInlineStyle(cardId, def = {}) {
  return `background-image:url("${attrEscape(cardArtSrc(cardId, def))}")`;
}

