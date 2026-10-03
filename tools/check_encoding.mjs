import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const root = path.resolve(process.argv[2] || "public");
const decoder = new TextDecoder("utf-8", { fatal: true });

const TEXT_EXTS = new Set([
  ".css",
  ".csv",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".md",
  ".txt",
]);

const SKIP_DIRS = new Set([
  ".firebase",
  "node_modules",
  "tcg-backup",
  "過去ver置き場",
]);

const MOJIBAKE_PATTERNS = [
  /繝|縺|邵|譫|蜈|郢|髢|螟|隕|荳|蝣|闕|譁|莨|膕|蟆|遉|鬆/g,
  /(?:^|[^<])\/(?:button|span|div|b|small)>/g,
  /<[^>]*[�][^>]*>/g,
  /[�]{1,}/g,
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name) || ent.name.startsWith("_codex_backup_")) continue;
      walk(path.join(dir, ent.name), out);
      continue;
    }
    if (ent.name.startsWith("_")) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (TEXT_EXTS.has(ext)) out.push(path.join(dir, ent.name));
  }
  return out;
}

function stripSafeText(file, text) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") {
    return text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  }
  if (ext === ".js" || ext === ".mjs" || ext === ".css") {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }
  return text;
}

let failed = false;
const files = walk(root);

for (const file of files) {
  let text = "";
  try {
    text = decoder.decode(fs.readFileSync(file));
  } catch (err) {
    failed = true;
    console.error(`[encoding] invalid UTF-8: ${path.relative(root, file)} (${err.message})`);
    continue;
  }

  const visible = stripSafeText(file, text);
  for (const pattern of MOJIBAKE_PATTERNS) {
    pattern.lastIndex = 0;
    const found = pattern.exec(visible);
    if (!found) continue;
    failed = true;
    const rel = path.relative(root, file);
    const before = visible.slice(0, found.index);
    const line = before.split(/\r?\n/).length;
    const col = found.index - before.lastIndexOf("\n");
    const sample = visible.slice(Math.max(0, found.index - 24), found.index + 80).replace(/\s+/g, " ");
    console.error(`[encoding] suspicious text: ${rel}:${line}:${col} ${sample}`);
    break;
  }
}

if (failed) {
  console.error("[encoding] failed. Fix the text before deploying.");
  process.exit(1);
}

console.log(`[encoding] OK: ${files.length} text files checked under ${root}`);
