// public/deck_radar.js
// v1.7.3
// - サポートカードを効果込みで評価
// - 平均的な30枚デッキが低く出すぎないようスケールを調整
// - 主属性が濃いデッキは強み/弱みがはっきり出るよう極端化
// - 評価はフィールド非依存。ゲインを抑え、最終表示を0〜100に固定

// レーダー軸
const AXES = [
  "攻撃力",
  "耐久性",
  "安定性",
  "展開力",
  "扱いやすさ",
  "制圧力",
];
const AXIS_KEYS = ["atk", "dur", "stab", "exp", "use", "ctl"];
const AXIS_SHORT = ["攻撃", "耐久", "安定", "展開", "操作", "制圧"];

// 属性の「役割イメージ」(0〜100)
const TYPE_PROFILE = {
  "火": { atk: 100, dur: 34, stab: 36, exp: 62, use: 82, ctl: 66 },
  "水": { atk: 34, dur: 100, stab: 92, exp: 58, use: 70, ctl: 38 },
  "闇": { atk: 100, dur: 44, stab: 34, exp: 78, use: 30, ctl: 100 },
  "風": { atk: 44, dur: 42, stab: 54, exp: 100, use: 100, ctl: 44 },
  "雷": { atk: 78, dur: 46, stab: 58, exp: 100, use: 54, ctl: 78 },
  "光": { atk: 60, dur: 84, stab: 100, exp: 62, use: 46, ctl: 48 },
  "鋼": { atk: 24, dur: 100, stab: 78, exp: 24, use: 100, ctl: 70 },
  "草": { atk: 34, dur: 78, stab: 100, exp: 54, use: 100, ctl: 36 },
  "幻": { atk: 52, dur: 48, stab: 50, exp: 86, use: 62, ctl: 100 },
  "呪": { atk: 36, dur: 38, stab: 58, exp: 46, use: 62, ctl: 96 },
};

// サポートカード用プロファイル
const SUPPORT_PROFILE = { atk: 35, dur: 55, stab: 88, exp: 76, use: 88, ctl: 58 };

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function avg(arr){
  if (!arr.length) return 0;
  return arr.reduce((s,x)=>s+x,0)/arr.length;
}

function normalizeTypeKey(type){
  const t = String(type || "").trim();
  const low = t.toLowerCase();
  if (TYPE_PROFILE[t]) return t;
  if (low.includes("fire") || t.includes("炎") || t.includes("火")) return "火";
  if (low.includes("water") || t.includes("水")) return "水";
  if (low.includes("thunder") || low.includes("lightning") || t.includes("雷")) return "雷";
  if (low.includes("grass") || low.includes("plant") || t.includes("草")) return "草";
  if (low.includes("wind") || t.includes("風")) return "風";
  if (low.includes("steel") || low.includes("metal") || t.includes("鋼")) return "鋼";
  if (low.includes("light") || t.includes("光")) return "光";
  if (low.includes("dark") || t.includes("闇")) return "闇";
  if (low.includes("illusion") || low.includes("phantom") || t.includes("幻")) return "幻";
  if (low.includes("curse") || low.includes("cursed") || low.includes("hex") || t.includes("呪")) return "呪";
  return "";
}

// range文字列から「制圧っぽさ」をざっくり加点
function rangeControlBonus(rangeStr){
  if (!rangeStr) return 0;
  const r = String(rangeStr);
  let bonus = 0;
  if (r.includes("front3")) bonus += 10;
  if (r.includes("adj8")) bonus += 8;
  if (r.includes("adj4")) bonus += 6;
  if (r.includes("+") || r.includes("|") || r.includes(",")) bonus += 6; // 複数範囲っぽい
  // 2以上射程っぽい token (lf2 etc)
  if (/\b(?:lf|rf|lb|rb|f|b|l|r)\d\b/i.test(r)) bonus += 6;
  return bonus;
}

// 50中心で極端化（強い→もっと強く / 弱い→もっと弱く）
function exaggerate(score, gain = 1.35){
  const s = clamp(Number(score) || 0, 0, 100);
  const d = s - 50;
  return clamp(50 + d * gain, 0, 100);
}

// 主属性が濃いデッキは「その属性らしさ」を最終スコアへ強めに反映する。
// 例：火が多いなら攻撃を大きく伸ばし、耐久/安定は落として尖らせる。
const PRIMARY_IDENTITY = {
  "火": { boost:[56,-24,-22,-8,12,10], floor:[82,0,0,0,0,0], cap:[100,58,56,74,92,90] },
  "水": { boost:[-20,54,34,-6,8,-12], floor:[0,82,76,0,0,0], cap:[64,100,100,78,90,72] },
  "雷": { boost:[22,-14,-8,52,-8,22], floor:[0,0,0,82,0,70], cap:[90,66,76,100,78,94] },
  "草": { boost:[-18,22,52,-8,34,-12], floor:[0,0,80,0,76,0], cap:[66,88,100,76,100,72] },
  "風": { boost:[-12,-16,-8,58,44,-10], floor:[0,0,0,84,78,0], cap:[74,66,76,100,100,74] },
  "鋼": { boost:[-26,62,22,-24,38,16], floor:[0,86,0,0,76,0], cap:[58,100,90,58,100,88] },
  "光": { boost:[4,28,56,-8,-14,-8], floor:[0,74,84,0,0,0], cap:[82,96,100,76,72,72] },
  "闇": { boost:[38,-16,-26,18,-28,60], floor:[78,0,0,0,0,84], cap:[100,66,58,90,58,100] },
  "幻": { boost:[-4,-10,-12,28,10,62], floor:[0,0,0,72,0,84], cap:[78,70,72,94,84,100] },
  "呪": { boost:[-24,-26,8,-10,6,54], floor:[0,0,0,0,0,82], cap:[64,62,86,74,84,100] },
};

function applyPrimaryIdentity(scores, topType, topRatio){
  const spec = PRIMARY_IDENTITY[topType];
  if (!spec) return scores;
  const strength = clamp((Number(topRatio) - 0.38) / 0.42, 0, 1);
  if (strength <= 0) return scores;
  const identityGain = 0.68;
  return scores.map((v, i) => {
    let next = Number(v) + (Number(spec.boost?.[i] || 0) * strength * identityGain);
    const floor = Number(spec.floor?.[i] || 0);
    if (floor > 0) {
      next = Math.max(next, floor + Math.max(0, Number(topRatio) - 0.5) * 24);
    }
    const cap = Number(spec.cap?.[i] || 0);
    if (cap > 0) next = Math.min(next, cap);
    return clamp(next, 0, 100);
  });
}

// サポート判定（import無しで判定できるように）
// 優先：kind==="support"
// 予備：effectがある && (actionsが空/未定義)
function isSupportCardLike(c){
  if (!c) return false;
  const kind = String(c.kind || "").toLowerCase();
  if (kind === "support" || kind === "ex_support" || kind === "exsupport") return true;
  const type = String(c.type || "").toLowerCase();
  if (type === "support" || type === "サポート") return true;
  const hasEffect = !!c.effect;
  const acts = Array.isArray(c.actions) ? c.actions : [];
  if (hasEffect && acts.length === 0) return true;
  return false;
}

function parseMaybeJson(value){
  if (value == null) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function getSupportStats(effect){
  const root = parseMaybeJson(effect) ?? effect;
  const out = { hpDmg:0, spDmg:0, hpHeal:0, spHeal:0, draw:0, mana:0, status:0, rangeB:0 };
  const walk = (x) => {
    if (!x) return;
    if (Array.isArray(x)) {
      x.forEach(walk);
      return;
    }
    if (typeof x !== "object") return;
    if (x.effect) walk(x.effect);
    if (x.effects) walk(x.effects);
    if (x.table) walk(x.table);

    const type = String(x.type || "").toLowerCase();
    const hp = Number(x.hp ?? x.hpDelta ?? x.heal ?? 0);
    const sp = Number(x.sp ?? x.spDelta ?? 0);
    const dmg = Number(x.damage ?? x.dmg ?? 0);
    const spDmg = Number(x.spDmg ?? x.spDamage ?? 0);
    if (type.includes("draw") || x.draw != null || x.n != null && type === "draw") out.draw += Math.max(1, Number(x.n ?? x.draw ?? 1));
    if (type.includes("search") || type.includes("tutor")) out.draw += 1.5;
    if (type.includes("heal")) {
      out.hpHeal += Math.abs(hp);
      out.spHeal += Math.abs(sp);
    } else {
      if (hp > 0) out.hpHeal += hp;
      if (sp > 0) out.spHeal += sp;
    }
    if (type.includes("dmg") || type.includes("damage")) {
      out.hpDmg += Math.abs(hp || dmg);
      out.spDmg += Math.abs(sp || spDmg);
    } else {
      if (hp < 0) out.hpDmg += Math.abs(hp);
      if (sp < 0) out.spDmg += Math.abs(sp);
    }
    if (type.includes("mana") || type.includes("powerup") || type.includes("modrate") || x.delta != null) out.mana += Math.abs(Number(x.delta ?? x.mana ?? 1));
    if (type.includes("status") || type.includes("cleanse") || type.includes("bounce") || type.includes("swap") || type.includes("move") || type.includes("setcard") || type.includes("facedown") || x.addStatus || x.status || x.bounce || x.swapPos || x.moveTo || x.knockback) out.status += 1;
    if (x.range) out.rangeB += rangeControlBonus(x.range);
  };
  walk(root);
  return out;
}

// actionから「ダメージ/回復」を両schemaで拾う
// - 旧: dmg/spDmg（ダメージ:+）
// - 新: hpDelta/spDelta（回復:+ / ダメージ:-）
function getActionStats(a){
  const dmgOld = Number(a?.dmg ?? 0);
  const spDmgOld = Number(a?.spDmg ?? 0);

  const hpDelta = (a?.hpDelta !== undefined) ? Number(a.hpDelta) : null;
  const spDelta = (a?.spDelta !== undefined) ? Number(a.spDelta) : null;

  // ダメージ量（正）
  const hpDmg = (hpDelta != null) ? Math.max(0, -hpDelta) : Math.max(0, dmgOld);
  const spDmg = (spDelta != null) ? Math.max(0, -spDelta) : Math.max(0, spDmgOld);

  // 回復量（正）
  const hpHeal = (hpDelta != null) ? Math.max(0, hpDelta) : 0;
  const spHeal = (spDelta != null) ? Math.max(0, spDelta) : 0;

  const draw = Number(a?.draw ?? 0);
  const rangeB = rangeControlBonus(a?.range);

  return { hpDmg, spDmg, hpHeal, spHeal, draw, rangeB };
}

// deckObj: {cardId: count}
// cardDefs: {cardId: {type,cost,hp,sp,actions...}}
export function evaluateDeck(deckObj, cardDefs){
  const ids = Object.keys(deckObj || {}).filter(id => Number(deckObj[id]) > 0);
  const total = ids.reduce((s,id)=>s+Number(deckObj[id]||0),0);
  if (!total) {
    return { total:0, scores: [0,0,0,0,0,0], note:"デッキが空です" };
  }

  let atk=0, dur=0, stab=0, exp=0, use=0, ctl=0;
  let highCost = 0;
  let supportCount = 0;
  let unitCount = 0;
  const typeCounts = {};

  for (const id of ids) {
    const cnt = Number(deckObj[id] || 0);
    const c = cardDefs?.[id];
    if (!c) continue;

    const isSup = isSupportCardLike(c);
    if (isSup) supportCount += cnt;

    const type = normalizeTypeKey(c.type ?? c.attr);
    const prof = isSup
      ? SUPPORT_PROFILE
      : (TYPE_PROFILE[type] || { atk:58, dur:58, stab:58, exp:58, use:58, ctl:58 });
    if (!isSup) {
      unitCount += cnt;
      const key = type || "属性不明";
      typeCounts[key] = (typeCounts[key] || 0) + cnt;
    }

    const cost = Number(c.cost ?? 0);
    const hp = Number(c.hp ?? 0);
    const sp = Number(c.sp ?? 0);

    if (cost >= 5) highCost += cnt;

    const acts = Array.isArray(c.actions) ? c.actions : [];
    const st = acts.map(getActionStats);
    const supportStats = isSup ? getSupportStats(c.effect) : null;
    if (supportStats) st.push(supportStats);

    const hpDmgAvg  = avg(st.map(x => x.hpDmg));
    const spDmgAvg  = avg(st.map(x => x.spDmg));
    const hpHealAvg = avg(st.map(x => x.hpHeal));
    const spHealAvg = avg(st.map(x => x.spHeal));
    const drawAvg   = avg(st.map(x => x.draw));
    const rangeBonus= avg(st.map(x => x.rangeB));

    // ざっくり式：プロファイル + 実数値補正
    atk  += cnt * (prof.atk  + hpDmgAvg*2.4 + spDmgAvg*2.8);
    dur  += cnt * (prof.dur  + hp*0.45 + sp*0.18 + hpHealAvg*1.1 + spHealAvg*1.5);
    stab += cnt * (prof.stab + sp*0.35 + clamp(6 - cost, 0, 6)*4 + hpHealAvg*1.2 + spHealAvg*1.4 + drawAvg*4);
    exp  += cnt * (prof.exp  + drawAvg*16 + clamp(4 - cost, 0, 4)*7);
    use  += cnt * (prof.use  + clamp(5 - cost, 0, 5)*7 + hpHealAvg*0.5 + spHealAvg*0.8);
    ctl  += cnt * (prof.ctl  + spDmgAvg*5.0 + rangeBonus + (supportStats ? supportStats.status * 8 : 0));
  }

  // 安定性：高マナが多いと下がる（サポート分は少し緩和）
  const highCostPenalty = (highCost * 18) - (supportCount * 6);
  stab -= Math.max(0, highCostPenalty);

  // 圧縮（差を出す）
  const DIV = 1.18;

  const rawScores = [
    atk /(total*DIV),
    dur /(total*DIV),
    stab/(total*DIV),
    exp /(total*DIV),
    use /(total*DIV),
    ctl /(total*DIV),
  ];

  const topType = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0];
  const topRatio = topType && unitCount ? topType[1] / unitCount : 0;
  const concentration = clamp((topRatio - 0.28) / 0.44, 0, 1);
  if (topType && TYPE_PROFILE[topType[0]] && concentration > 0) {
    const prof = TYPE_PROFILE[topType[0]];
    AXIS_KEYS.forEach((key, i) => {
      const diff = Number(prof[key] || 50) - 62;
      rawScores[i] += diff * concentration * (diff >= 0 ? 0.44 : 0.34);
    });
    const peakIndex = AXIS_KEYS
      .map((key, i) => ({ i, v: Number(prof[key] || 0) }))
      .sort((a,b)=>b.v-a.v)[0]?.i ?? 0;
    rawScores[peakIndex] += 6 * concentration;
  }

  const sAtk  = clamp(rawScores[0], 0, 100);
  const sDur  = clamp(rawScores[1], 0, 100);
  const sStab = clamp(rawScores[2], 0, 100);
  const sExp  = clamp(rawScores[3], 0, 100);
  const sUse  = clamp(rawScores[4], 0, 100);
  const sCtl  = clamp(rawScores[5], 0, 100);

  // 最後に極端化
  const GAIN = 1.34;
  let scores = [
    exaggerate(sAtk,  GAIN),
    exaggerate(sDur,  GAIN),
    exaggerate(sStab, GAIN),
    exaggerate(sExp,  GAIN),
    exaggerate(sUse,  GAIN),
    exaggerate(sCtl,  GAIN),
  ];

  scores = applyPrimaryIdentity(scores, topType?.[0], topRatio)
    .map((v) => clamp(Math.round((Number(v) || 0) * 10) / 10, 0, 100));

  const topNote = topType && topType[0] !== "属性不明"
    ? ` / 主属性:${topType[0]}${Math.round(topRatio * 100)}%`
    : "";
  const note = `枚数:${total} / 高マナ(5+)枚数:${highCost} / サポ:${supportCount}${topNote}`;
  return { total, scores, note };
}

// CSS変数を拾って canvas の色をページと揃える
function getThemeColors(){
  const root = document.documentElement;
  const cs = getComputedStyle(root);

  const pick = (name, fallback) => {
    const v = (cs.getPropertyValue(name) || "").trim();
    return v || fallback;
  };

  return {
    text:   pick("--text", "rgba(245,247,255,0.95)"),
    line:   pick("--line", "rgba(255,255,255,0.12)"),
    blue:   pick("--blue", "rgba(106,169,255,0.85)"),
    accent: pick("--accent","rgba(255,215,0,0.95)"),
  };
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[ch]));
}

function roundRectPath(ctx, x, y, w, h, r){
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawLabelPill(ctx, label, x, y, active=false){
  ctx.save();
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  const w = Math.max(42, ctx.measureText(label).width + 18);
  const h = 24;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 999);
  ctx.shadowColor = active ? "rgba(255,215,0,0.28)" : "rgba(0,0,0,0.35)";
  ctx.shadowBlur = active ? 14 : 8;
  ctx.fillStyle = active ? "rgba(255,215,0,0.16)" : "rgba(9,13,18,0.72)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = active ? 1.4 : 1;
  ctx.strokeStyle = active ? "rgba(255,215,0,0.72)" : "rgba(255,255,255,0.16)";
  ctx.stroke();
  ctx.fillStyle = active ? "rgba(255,245,170,0.98)" : "rgba(245,248,255,0.92)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 0.5);
  ctx.restore();
}

function drawPeakChip(ctx, label, score, x, y){
  const text = `PEAK ${label} ${Math.round(score)}`;
  ctx.save();
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  const w = Math.min(ctx.canvas.width - 20, ctx.measureText(text).width + 22);
  const h = 26;
  const left = clamp(x - w / 2, 10, ctx.canvas.width - w - 10);
  const top = clamp(y, 8, ctx.canvas.height - h - 8);
  roundRectPath(ctx, left, top, w, h, 999);
  ctx.shadowColor = "rgba(255,215,0,0.28)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(255,215,0,0.16)";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,215,0,0.55)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,238,120,0.98)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + w / 2, top + h / 2 + 0.5);
  ctx.restore();
}

function renderRadarSummary(res){
  const scores = Array.isArray(res?.scores) ? res.scores : [];
  const peakIndex = scores.reduce((best, value, index) => {
    return Number(value || 0) > Number(scores[best] || 0) ? index : best;
  }, 0);
  const noteParts = String(res?.note || "")
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  const meta = noteParts
    .map((part) => `<span>${escapeHtml(part)}</span>`)
    .join("");
  const metrics = AXIS_SHORT
    .map((label, index) => {
      const score = Math.round(Number(scores[index] || 0));
      const peakClass = index === peakIndex ? " isPeak" : "";
      return `<span class="deckRadarMetric${peakClass}"><b>${escapeHtml(label)}</b><em>${score}</em></span>`;
    })
    .join("");
  return `<div class="deckRadarMeta">${meta}</div><div class="deckRadarMetrics">${metrics}</div>`;
}

export function drawRadar(canvas, scores, opts={}){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const { line, blue } = getThemeColors();

  const cx = W*0.50, cy = H*0.52;
  const R = Math.min(W, H) * 0.34;
  const peakIndex = (Array.isArray(scores) ? scores : []).reduce((best, value, index) => {
    return Number(value || 0) > Number(scores?.[best] || 0) ? index : best;
  }, 0);

  // 背景は塗らない（CSS側の背景を活かす）

  // グリッド（5段）
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  for (let t=1;t<=5;t++){
    const r = R*(t/5);
    ctx.beginPath();
    for (let i=0;i<6;i++){
      const ang = (-Math.PI/2) + i*(Math.PI*2/6);
      const x = cx + Math.cos(ang)*r;
      const y = cy + Math.sin(ang)*r;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 軸
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  for (let i=0;i<6;i++){
    const ang = (-Math.PI/2) + i*(Math.PI*2/6);
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx + Math.cos(ang)*R, cy + Math.sin(ang)*R);
    ctx.stroke();
  }

  // ラベル
  for (let i=0;i<6;i++){
    const ang = (-Math.PI/2) + i*(Math.PI*2/6);
    const x = cx + Math.cos(ang)*(R+32);
    const y = cy + Math.sin(ang)*(R+30);
    drawLabelPill(ctx, AXIS_SHORT[i] || AXES[i], x, y, i === peakIndex);
  }

  // ポリゴン
  const vals = scores.map(s => clamp(Number(s)||0,0,100)/100);

  // 頂点座標
  const pts = [];
  for (let i=0;i<6;i++){
    const ang = (-Math.PI/2) + i*(Math.PI*2/6);
    const r = R*vals[i];
    pts.push({
      i,
      v: Number(scores?.[i] ?? 0),
      x: cx + Math.cos(ang)*r,
      y: cy + Math.sin(ang)*r,
      ang,
    });
  }

  // 塗り＆線（ダークに馴染ませる）
  // ※ blue 変数はCSS由来だけど、alpha調整した固定rgbaが一番安定するのでこのまま
  ctx.fillStyle = "rgba(106, 169, 255, 0.18)";
  ctx.strokeStyle = "rgba(106, 169, 255, 0.70)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  for (let i=0;i<6;i++){
    const p = pts[i];
    if (i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ピーク強調（最大値の頂点だけ、上品に発光）
  let peak = pts[0];
  for (const p of pts) if (p.v > peak.v) peak = p;

  // 小さなリング
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = "rgba(255,215,0,0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(peak.x, peak.y, 7.5, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();

  // 発光ドット
  ctx.save();
  ctx.shadowColor = "rgba(255,215,0,0.40)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(255,215,0,0.95)";
  ctx.beginPath();
  ctx.arc(peak.x, peak.y, 4.2, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // 中心点（控えめ）
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // ピーク軸名（不要なら opts.showPeakLabel=false）
  if (opts.showPeakLabel !== false){
    drawPeakChip(ctx, AXIS_SHORT[peak.i] || AXES[peak.i], peak.v, W * 0.5, 8);
  }
}

export function renderDeckRadar(canvasId, textId, deckObj, cardDefs){
  const canvas = document.getElementById(canvasId);
  const textEl = document.getElementById(textId);
  if (!canvas) return;

  const res = evaluateDeck(deckObj, cardDefs);
  drawRadar(canvas, res.scores, { showPeakLabel: true });

  if (textEl) {
    textEl.classList.toggle("deckRadarSummary", !!res.total);
    if (!res.total) textEl.textContent = res.note;
    else {
      textEl.innerHTML = renderRadarSummary(res);
    }
  }
}
