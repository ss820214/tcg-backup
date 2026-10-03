// public/ui_health.js
// Read-only health dashboard.

import { loadAuditData, summarizeAudit, esc } from "./audit_core_20260825.js?v=20260906_curse1";

const KEY_FILES = [
  "index.html",
  "deck.html",
  "game.html",
  "gacha.html",
  "profile.html",
  "creator.html",
  "rule.html",
  "deck.js",
  "game.js",
  "gacha.js",
  "mobile_deck_ui.js",
  "ui_stability_20260825.js",
  "ui_stability_20260825.css",
];

const SCREENS = [
  ["初期画面", "index.html"],
  ["デッキ", "deck.html"],
  ["自分のデッキ", "deck_list.html"],
  ["バトル", "game.html"],
  ["ガチャ", "gacha.html"],
  ["ユーザー", "profile.html"],
  ["工房", "creator.html"],
  ["ルール", "rule.html"],
  ["ティア", "tier.html"],
];

function metric(label, value, tone = "ok") {
  return `<article class="healthCard"><span class="small">${esc(label)}</span><b class="${tone}">${esc(value)}</b></article>`;
}

async function checkFile(path) {
  try {
    const res = await fetch(`./${path}?health=${Date.now()}`, { cache: "no-store" });
    const text = await res.text();
    if (!res.ok) return { path, ok: false, detail: `${res.status} ${res.statusText}` };
    if (!text.trim()) return { path, ok: false, detail: "empty" };
    return { path, ok: true, detail: `${Math.round(text.length / 1024)}KB` };
  } catch (err) {
    return { path, ok: false, detail: err?.message || String(err) };
  }
}

function renderFileChecks(results) {
  const el = document.getElementById("fileChecks");
  el.innerHTML = results.map((r) => `
    <div class="healthRow">
      <b>${esc(r.path)}</b>
      <span class="${r.ok ? "ok" : "bad"}">${r.ok ? "OK" : "NG"}</span>
      <span class="small">${esc(r.detail)}</span>
    </div>
  `).join("");
}

function renderLinks() {
  const el = document.getElementById("screenLinks");
  el.innerHTML = SCREENS.map(([label, href]) => `<button onclick="location.href='./${esc(href)}'">${esc(label)}</button>`).join("");
}

async function main() {
  renderLinks();
  const [ctx, checks] = await Promise.all([
    loadAuditData(),
    Promise.all(KEY_FILES.map(checkFile)),
  ]);
  const sum = summarizeAudit(ctx);
  const failedFiles = checks.filter((c) => !c.ok).length;
  document.getElementById("summary").innerHTML = [
    metric("カード定義", sum.total, sum.total ? "ok" : "warn"),
    metric("キャラ / サポート", `${sum.units} / ${sum.supports}`, "note"),
    metric("要確認", `${sum.bad + sum.warn}件`, sum.bad ? "bad" : (sum.warn ? "warn" : "ok")),
    metric("読み込みNG", failedFiles, failedFiles ? "bad" : "ok"),
  ].join("");
  renderFileChecks(checks);
}

main().catch((err) => {
  document.getElementById("summary").innerHTML = metric("診断失敗", err?.message || String(err), "bad");
});
