// public/actions_balance.js
import { calcRecManaDetail } from "./support_rec_mana.js";

const CSV_URL = "./actions.csv";

const $ = (id) => document.getElementById(id);

const state = {
  rows: [],
  view: [],
  sortKey: "diff",
  sortDir: "asc",
  selectedId: "",
};

const COLS = [
  { key: "recRaw", label: "rec(raw)", cls: "right mono" },
  { key: "actionId", label: "actionId", cls: "mono" },
  { key: "name", label: "name" },
  { key: "cost", label: "cost", cls: "right mono" },
  { key: "recMana", label: "rec", cls: "right mono" },
  { key: "diff", label: "diff(cost-rec)", cls: "right mono" },
  { key: "range", label: "range", cls: "mono" },
  { key: "hpDelta", label: "hpΔ", cls: "right mono" },
  { key: "spDelta", label: "spΔ", cls: "right mono" },
  { key: "rate", label: "rate", cls: "right mono" },
  { key: "draw", label: "draw", cls: "right mono" },
  { key: "role", label: "role" },
  { key: "power", label: "power", cls: "right mono" },
  { key: "tags", label: "tags", cls: "mono small" },
  { key: "addStatus", label: "addStatus", cls: "mono small" },
  { key: "ownerType", label: "属性", cls: "mono" },
  { key: "bonus", label: "bonus", cls: "mono" },
];

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ちゃんとしたCSVパーサ（ダブルクォート対応）
function parseCSV(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (ch === ",") {
        pushField();
        i++;
        continue;
      }
      if (ch === "\r") {
        i++;
        continue;
      }
      if (ch === "\n") {
        pushField();
        pushRow();
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
  }
  // last
  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  // 空行除去
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function buildRowObj(header, fields) {
  const o = {};
  for (let i = 0; i < header.length; i++) {
    o[header[i]] = fields[i] ?? "";
  }
  return o;
}

function computeDerived(row) {
  const rec = calcRecManaDetail(row);
  const cost = toNum(row.cost);

  return {
    ...row,
    cost,
    recMana: rec.recMana,
    manaRaw: rec.manaRaw,
    recRaw: Number(rec.manaRaw).toFixed(2),
    score: rec.score,
    breakdown: rec.breakdown || {},
    diff: cost - rec.recMana,
    hpDelta: toNum(row.hpDelta),
    spDelta: toNum(row.spDelta),
    rate: toNum(row.rate),
    draw: row.draw === "" ? "" : toNum(row.draw),
    power: row.power === "" ? "" : toNum(row.power),
  };
}

function dangerClass(diff) {
  // diff = cost - rec
  // 低い(マイナス)ほど「安すぎ危険」
  if (diff <= -2) return "rowBad";
  if (diff === -1) return "rowWarn";
  if (diff >= 2) return "rowOver";
  return "";
}

function diffBadge(diff) {
  if (diff <= -2) return `<span class="diff bad">${diff}</span>`;
  if (diff === -1) return `<span class="diff warn">${diff}</span>`;
  if (diff === 0) return `<span class="diff ok">${diff}</span>`;
  if (diff === 1) return `<span class="diff good">+${diff}</span>`;
  return `<span class="diff good">+${diff}</span>`;
}

function renderHeader() {
  const tr = $("theadRow");
  tr.innerHTML = COLS.map((c) => {
    const arrow =
      state.sortKey === c.key ? (state.sortDir === "asc" ? " ▲" : " ▼") : "";
    return `<th data-key="${c.key}">${escapeHtml(c.label)}${arrow}</th>`;
  }).join("");

  tr.querySelectorAll("th").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (state.sortKey === key)
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else {
        state.sortKey = key;
        state.sortDir = key === "diff" ? "asc" : "desc";
      }
      applyFiltersAndRender();
    });
  });
}

function renderChips(rows) {
  const total = rows.length;
  const under2 = rows.filter((r) => r.diff <= -2).length;
  const under1 = rows.filter((r) => r.diff === -1).length;
  const ok = rows.filter((r) => r.diff === 0).length;
  const over1 = rows.filter((r) => r.diff === 1).length;
  const over2 = rows.filter((r) => r.diff >= 2).length;

  $("chips").innerHTML = `
    <span class="chip"><b>${total}</b> 件</span>
    <span class="chip">危険(安すぎ) <b>${under2}</b></span>
    <span class="chip">注意(安い) <b>${under1}</b></span>
    <span class="chip">適正 <b>${ok}</b></span>
    <span class="chip">やや高い <b>${over1}</b></span>
    <span class="chip">高すぎ <b>${over2}</b></span>
  `;
}

function renderMeta() {
  const s = state.view;
  const bad = s
    .filter((r) => r.diff <= -2)
    .slice(0, 8)
    .map((r) => `${r.actionId}(${r.cost}→${r.recMana})`)
    .join(", ");
  const warn = s
    .filter((r) => r.diff === -1)
    .slice(0, 8)
    .map((r) => `${r.actionId}(${r.cost}→${r.recMana})`)
    .join(", ");

  $("meta").innerHTML = `
    表示中: <b>${s.length}</b> 件
    <span class="muted"> / 例: 危険(安すぎ) → ${escapeHtml(bad || "-")}</span>
    <span class="muted"> / 注意(安い) → ${escapeHtml(warn || "-")}</span>
  `;
}

function renderTable() {
  const tbody = $("tbody");
  const html = state.view
    .map((r) => {
      const rowCls = dangerClass(r.diff);
      return `
      <tr class="${rowCls} ${
        state.selectedId === String(r.actionId) ? "rowSel" : ""
      }" data-action-id="${escapeHtml(r.actionId)}">
        ${COLS.map((c) => {
          let v = r[c.key];
          if (c.key === "diff")
            return `<td class="${c.cls ?? ""}">${diffBadge(r.diff)}</td>`;
          if (c.key === "cost")
            return `<td class="${c.cls ?? ""}">${r.cost}</td>`;
          if (c.key === "recMana")
            return `<td class="${c.cls ?? ""}">${r.recMana}</td>`;

          // 見やすさ: tags/addStatusはpillにする
          if (c.key === "tags" || c.key === "addStatus") {
            const s = String(v ?? "").trim();
            if (!s) return `<td class="${c.cls ?? ""} muted">-</td>`;
            return `<td class="${c.cls ?? ""}"><span class="pill">${escapeHtml(
              s
            )}</span></td>`;
          }

          if (v === "" || v == null)
            return `<td class="${c.cls ?? ""} muted">-</td>`;
          return `<td class="${c.cls ?? ""}">${escapeHtml(v)}</td>`;
        }).join("")}
      </tr>
    `;
    })
    .join("");

  tbody.innerHTML = html;

  // row click -> breakdown
  tbody.querySelectorAll('tr[data-action-id]').forEach((tr) => {
    tr.addEventListener("click", () => {
      state.selectedId = tr.dataset.actionId || "";
      const row = state.rows.find(
        (x) => String(x.actionId) === String(state.selectedId)
      );
      if (row) renderBreakdown(row);
      renderTable(); // selection highlight
    });
  });
}

function renderBreakdown(row) {
  const root = $("detailBody");
  if (!root) return;

  const b = row.breakdown || {};
  const fmt = (n, d = 2) =>
    Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "-";

  root.innerHTML = `
    <div class="panelTitle">内訳: <span class="mono">${escapeHtml(
      row.actionId
    )}</span> <b>${escapeHtml(row.name)}</b></div>
    <div class="panelGrid">
      <div class="k">現在cost</div><div class="v mono">${escapeHtml(row.cost)}</div>
      <div class="k">推奨rec</div><div class="v mono">${escapeHtml(
        row.recMana
      )} <span class="muted">(raw ${escapeHtml(row.recRaw)})</span></div>

      <div class="k">基礎期待値</div><div class="v mono">${fmt(b.baseEV)}</div>
      <div class="k">射程倍率</div><div class="v mono">× ${fmt(b.rangeMul)}</div>
      <div class="k">タグ倍率</div><div class="v mono">× ${fmt(b.tagMul)}</div>
      <div class="k">SP補正</div><div class="v mono">× ${fmt(b.spScarcity)}</div>
      <div class="k">反動補正</div><div class="v mono">${fmt(b.recoilScore)}</div>

      <div class="k">合計score</div><div class="v mono">${fmt(row.score)}</div>
      <div class="k">basePerMana</div><div class="v mono">${fmt(b.basePerMana)}</div>
    </div>
  `;
}

function renderHistogram() {
  const canvas = $("histCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const metric = $("histMetric")?.value || "diffInt";
  const bins = toNum($("histBins")?.value, 12);

  const data = state.view
    .map((r) => {
      if (metric === "recRaw") return Number(r.manaRaw);
      if (metric === "diffRaw") return Number(r.cost - r.manaRaw);
      return Number(r.diff); // diffInt
    })
    .filter((v) => Number.isFinite(v));

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, w, h);
  if (!data.length) return;

  let min = Math.min(...data);
  let max = Math.max(...data);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const binCount = Math.max(4, Math.min(60, bins));
  const binW = (max - min) / binCount;
  const counts = new Array(binCount).fill(0);

  for (const v of data) {
    let idx = Math.floor((v - min) / binW);
    idx = Math.max(0, Math.min(binCount - 1, idx));
    counts[idx]++;
  }

  const padL = 36,
    padR = 10,
    padT = 10,
    padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxC = Math.max(...counts) || 1;

  // axes
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  const bw = plotW / binCount;
  for (let i = 0; i < binCount; i++) {
    const c = counts[i];
    const bh = (c / maxC) * plotH;
    const x = padL + i * bw;
    const y = padT + plotH - bh;
    ctx.fillRect(x + 1, y, Math.max(1, bw - 2), bh);
  }

  ctx.font =
    '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  ctx.fillText(min.toFixed(2), padL, padT + plotH + 16);
  const maxLabel = max.toFixed(2);
  const tw = ctx.measureText(maxLabel).width;
  ctx.fillText(maxLabel, padL + plotW - tw, padT + plotH + 16);

  const title =
    metric === "recRaw" ? "rec(raw)" : metric === "diffRaw" ? "diff(raw)" : "diff(int)";
  const titleEl = $("histTitle");
  if (titleEl) titleEl.textContent = `ヒストグラム: ${title}（表示中 ${data.length}件）`;
}

function applyFiltersAndRender() {
  const q = $("search").value.trim().toLowerCase();
  const role = $("filterRole").value;
  const attr = $("filterAttr").value;
  const danger = $("filterDanger").value;

  let v = [...state.rows];

  if (q) {
    v = v.filter((r) => {
      const blob = [
        r.actionId,
        r.name,
        r.range,
        r.role,
        r.tags,
        r.addStatus,
        r.ownerType,
        r.bonus,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }

  if (role) v = v.filter((r) => String(r.role) === role);
  if (attr) v = v.filter((r) => String(r.ownerType) === attr);

  if (danger) {
    if (danger === "under2") v = v.filter((r) => r.diff <= -2);
    if (danger === "under1") v = v.filter((r) => r.diff === -1);
    if (danger === "ok") v = v.filter((r) => r.diff === 0);
    if (danger === "over1") v = v.filter((r) => r.diff === 1);
    if (danger === "over2") v = v.filter((r) => r.diff >= 2);
  }

  // sort
  const key = state.sortKey;
  const dir = state.sortDir === "asc" ? 1 : -1;

  v.sort((a, b) => {
    const A = a[key];
    const B = b[key];

    // number first
    if (typeof A === "number" && typeof B === "number") return (A - B) * dir;

    // fallback: string
    return String(A ?? "").localeCompare(String(B ?? ""), "ja") * dir;
  });

  state.view = v;
  renderChips(state.rows);
  renderMeta();
  renderTable();
  renderHistogram();
}

// ---- Load CSV ----
async function loadCSV() {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();

  const parsed = parseCSV(text);
  const header = parsed[0].map((s) => String(s).trim());
  const dataRows = parsed.slice(1);

  const rows = dataRows.map((fields) => buildRowObj(header, fields)).map(computeDerived);

  state.rows = rows;
  buildFilters(rows);
  renderHeader();
  applyFiltersAndRender();

  // initial selection
  if (!state.selectedId) state.selectedId = String(rows[0]?.actionId || "");
  const first =
    rows.find((x) => String(x.actionId) === String(state.selectedId)) || rows[0];
  if (first) renderBreakdown(first);
  renderTable();
  renderHistogram();
}

function buildFilters(rows) {
  // role
  const roles = [...new Set(rows.map((r) => String(r.role ?? "").trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ja")
  );
  const attrs = [...new Set(rows.map((r) => String(r.ownerType ?? "").trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "ja")
  );

  $("filterRole").innerHTML =
    `<option value="">role: 全て</option>` +
    roles.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  $("filterAttr").innerHTML =
    `<option value="">属性: 全て</option>` +
    attrs.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
}

function wireUI() {
  $("search").addEventListener("input", () => applyFiltersAndRender());
  $("filterRole").addEventListener("change", () => applyFiltersAndRender());
  $("filterAttr").addEventListener("change", () => applyFiltersAndRender());
  $("filterDanger").addEventListener("change", () => applyFiltersAndRender());
  $("reload").addEventListener("click", () => loadCSV().catch((err) => alert(err.message)));

  $("histMetric")?.addEventListener("change", () => renderHistogram());
  $("histBins")?.addEventListener("input", () => renderHistogram());
  window.addEventListener("resize", () => renderHistogram());
}

wireUI();
loadCSV().catch((err) => {
  console.error(err);
  alert("読み込み失敗: " + err.message + "\nactions.csv の場所/パスを確認してね。");
});