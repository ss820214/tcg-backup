// public/card_audit.js
// Read-only card audit screen.

import { loadAuditData, summarizeAudit, esc } from "./audit_core_20260825.js?v=20260906_curse1";

let state = { filter: "all", q: "", rows: [], summary: null };

function stat(label, value) {
  return `<article class="auditStat"><span class="small">${esc(label)}</span><b>${esc(value)}</b></article>`;
}

function issueChips(issues, hasArt) {
  const list = [...issues];
  if (!hasArt) list.push({ level: "note", label: "画像なし" });
  if (!list.length) return `<span class="chip">OK</span>`;
  return list.map((i) => `<span class="chip ${esc(i.level)}">${esc(i.label)}</span>`).join("");
}

function rowMatches(r) {
  const q = state.q.trim().toLowerCase();
  if (state.filter === "unit" && r.kind !== "unit") return false;
  if (state.filter === "support" && r.kind !== "support") return false;
  if (state.filter === "bad" && !r.issues.some((i) => i.level === "bad")) return false;
  if (state.filter === "warn" && !r.issues.some((i) => i.level === "warn")) return false;
  if (state.filter === "art" && r.hasArt) return false;
  if (!q) return true;
  const hay = [r.id, r.card?.name, r.card?.series, r.card?.source, r.attr, r.kind].join(" ").toLowerCase();
  return hay.includes(q);
}

function render() {
  const s = state.summary;
  document.getElementById("stats").innerHTML = [
    stat("総数", s.total),
    stat("キャラ", s.units),
    stat("サポート", s.supports),
    stat("危険 / 注意", `${s.bad} / ${s.warn}`),
    stat("画像なし", s.missingArt),
  ].join("");

  const rows = state.rows.filter(rowMatches);
  document.getElementById("rows").innerHTML = rows.map((r) => `
    <article class="auditRow" data-kind="${esc(r.kind)}">
      <div>
        <b>${esc(r.card?.name || r.id)}</b>
        <div class="muted">${esc(r.id)}</div>
      </div>
      <div class="chips">
        <span class="chip">${esc(r.kind === "support" ? "サポート" : "キャラ")}</span>
        ${r.attr ? `<span class="chip">${esc(r.attr)}</span>` : ""}
        ${r.card?.rarity ? `<span class="chip">${esc(r.card.rarity)}</span>` : ""}
        ${r.card?.series ? `<span class="chip">${esc(r.card.series)}</span>` : ""}
      </div>
      <div class="chips">${issueChips(r.issues, r.hasArt)}</div>
    </article>
  `).join("") || `<div class="auditRow">該当カードなし</div>`;
}

async function main() {
  const ctx = await loadAuditData();
  state.summary = summarizeAudit(ctx);
  state.rows = state.summary.rows;
  document.getElementById("q").addEventListener("input", (e) => {
    state.q = e.target.value || "";
    render();
  });
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter || "all";
      document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("isActive", b === btn));
      render();
    });
  });
  render();
}

main().catch((err) => {
  document.getElementById("rows").innerHTML = `<div class="auditRow">監査に失敗しました: ${esc(err?.message || err)}</div>`;
});
