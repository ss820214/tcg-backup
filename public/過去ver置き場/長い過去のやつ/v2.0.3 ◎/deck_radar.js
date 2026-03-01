// public/deck_radar.js
// v1.6.0 (support+grass + type profile ~400sum + heal-aware)
// - サポートカードは専用スコア（耐久/展開=30、安定/扱いやすさ↑）
// - 草属性追加（ヒーラー：安定&扱いやすさ↑、攻撃&制圧↓）
// - TYPE_PROFILE は各属性 合計400点くらいに調整（色が出やすい）
// - hpDelta/spDelta も評価（回復/新schema対応）
//
// ※ 属性は：火/水/風/雷/光/闇/鋼/草（※土は未使用なので入れない）

// レーダー軸
const AXES = [
  "攻撃力",
  "耐久性",
  "安定性",
  "展開力",
  "扱いやすさ",
  "制圧力",
];

// 属性の「役割イメージ」(0〜100)
// ★各属性の合計がだいたい400になるよう調整（色が出やすい）
const TYPE_PROFILE = {
  "火": { atk: 95, dur: 45, stab: 45, exp: 65, use: 85, ctl: 65 }, // 400
  "水": { atk: 40, dur: 95, stab: 85, exp: 65, use: 70, ctl: 45 }, // 400
  "闇": { atk: 90, dur: 55, stab: 50, exp: 80, use: 35, ctl: 90 }, // 400
  "風": { atk: 50, dur: 50, stab: 60, exp: 95, use: 90, ctl: 55 }, // 400
  "雷": { atk: 70, dur: 55, stab: 65, exp: 95, use: 60, ctl: 55 }, // 400
  "光": { atk: 65, dur: 80, stab: 95, exp: 65, use: 45, ctl: 50 }, // 400
  "鋼": { atk: 30, dur: 100, stab: 80, exp: 30, use: 100, ctl: 60 }, // 400
  "草": { atk: 40, dur: 70, stab: 95, exp: 60, use: 95, ctl: 40 }, // 400（ヒーラー寄り）
};

// ★サポートカード用プロファイル
// - 耐久性/展開力を30に固定気味
// - 扱いやすさ/安定性を高く
// - 攻撃/制圧は盛りすぎない（でも影響が見える程度）
const SUPPORT_PROFILE = { atk: 55, dur: 30, stab: 95, exp: 30, use: 95, ctl: 55 };

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function avg(arr){
  if (!arr.length) return 0;
  return arr.reduce((s,x)=>s+x,0)/arr.length;
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

// ★50中心で極端にする（強い→もっと強く / 弱い→もっと弱く）
function exaggerate(score, gain = 2.0){
  const s = clamp(Number(score) || 0, 0, 100);
  const d = s - 50;
  return clamp(50 + d * gain, 0, 100);
}

// ★サポート判定（import無しで判定できるように）
// 優先：kind==="support"
// 予備：effectがある && (actionsが空/未定義) など
function isSupportCardLike(c){
  if (!c) return false;
  if (String(c.kind || "").toLowerCase() === "support") return true;
  const hasEffect = !!c.effect;
  const acts = Array.isArray(c.actions) ? c.actions : [];
  if (hasEffect && acts.length === 0) return true;
  return false;
}

// ★actionから「ダメージ/回復」を両schemaで拾う
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

  // 素点（大きいほど強い）
  let atk=0, dur=0, stab=0, exp=0, use=0, ctl=0;
  let highCost = 0;
  let supportCount = 0;

  for (const id of ids) {
    const cnt = Number(deckObj[id] || 0);
    const c = cardDefs?.[id];
    if (!c) continue;

    const isSup = isSupportCardLike(c);
    if (isSup) supportCount += cnt;

    const type = c.type ?? "?";
    const prof = isSup
      ? SUPPORT_PROFILE
      : (TYPE_PROFILE[type] || { atk:66, dur:66, stab:66, exp:66, use:66, ctl:66 });

    const cost = Number(c.cost ?? 0);
    const hp = Number(c.hp ?? 0);
    const sp = Number(c.sp ?? 0);

    if (cost >= 5) highCost += cnt;

    const acts = Array.isArray(c.actions) ? c.actions : [];
    const st = acts.map(getActionStats);

    const hpDmgAvg  = avg(st.map(x => x.hpDmg));
    const spDmgAvg  = avg(st.map(x => x.spDmg));
    const hpHealAvg = avg(st.map(x => x.hpHeal));
    const spHealAvg = avg(st.map(x => x.spHeal));
    const drawAvg   = avg(st.map(x => x.draw));
    const rangeBonus= avg(st.map(x => x.rangeB));

    // ざっくり式：プロファイル + 実数値補正
    // - 攻撃：HP/Spダメージ
    // - 耐久：HP/SP + 回復少し寄与
    // - 安定：SP + 軽コスト + 回復(特にHP回復)
    // - 展開：ドロー + 低コスト
    // - 扱い：低コスト + 回復は扱いやすい
    // - 制圧：SPダメ + 射程/範囲
    atk  += cnt * (prof.atk  + hpDmgAvg*3.0 + spDmgAvg*1.6);
    dur  += cnt * (prof.dur  + hp*0.9 + sp*0.25 + hpHealAvg*1.4 + spHealAvg*0.6);
    stab += cnt * (prof.stab + sp*0.7 + clamp(6 - cost, 0, 6)*6 + hpHealAvg*2.2 + spHealAvg*1.0);
    exp  += cnt * (prof.exp  + drawAvg*18 + clamp(4 - cost, 0, 4)*10);
    use  += cnt * (prof.use  + clamp(5 - cost, 0, 5)*10 + hpHealAvg*1.0 + spHealAvg*0.4);
    ctl  += cnt * (prof.ctl  + spDmgAvg*6.0 + rangeBonus);
  }

  // 安定性：高マナが多いと下がる（要望）
  // ※サポートカードは高マナでも「安定」を落としすぎないほうが自然なので、少し緩和
  const highCostPenalty = (highCost * 18) - (supportCount * 6);
  stab -= Math.max(0, highCostPenalty);

  // ★圧縮（差を出す）
  const DIV = 1.6;

  const sAtk  = clamp(atk /(total*DIV), 0, 100);
  const sDur  = clamp(dur /(total*DIV), 0, 100);
  const sStab = clamp(stab/(total*DIV), 0, 100);
  const sExp  = clamp(exp /(total*DIV), 0, 100);
  const sUse  = clamp(use /(total*DIV), 0, 100);
  const sCtl  = clamp(ctl /(total*DIV), 0, 100);

  // ★最後に“極端化”（50中心で拡大）
  const GAIN = 2.0;
  const scores = [
    exaggerate(sAtk,  GAIN),
    exaggerate(sDur,  GAIN),
    exaggerate(sStab, GAIN),
    exaggerate(sExp,  GAIN),
    exaggerate(sUse,  GAIN),
    exaggerate(sCtl,  GAIN),
  ];

  const note = `枚数:${total} / 高マナ(5+)枚数:${highCost} / サポ:${supportCount}`;
  return { total, scores, note };
}

export function drawRadar(canvas, scores, opts={}){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const cx = W*0.50, cy = H*0.52;
  const R = Math.min(W, H) * 0.38;

  // 背景
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,W,H);

  // グリッド（5段）
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
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
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  for (let i=0;i<6;i++){
    const ang = (-Math.PI/2) + i*(Math.PI*2/6);
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx + Math.cos(ang)*R, cy + Math.sin(ang)*R);
    ctx.stroke();
  }

  // ラベル
  ctx.fillStyle = "#111";
  ctx.font = "12px system-ui";
  for (let i=0;i<6;i++){
    const ang = (-Math.PI/2) + i*(Math.PI*2/6);
    const x = cx + Math.cos(ang)*(R+18);
    const y = cy + Math.sin(ang)*(R+18);
    const text = AXES[i];
    ctx.fillText(text, x - ctx.measureText(text).width/2, y+4);
  }

  // ポリゴン
  const vals = scores.map(s => clamp(Number(s)||0,0,100)/100);
  ctx.fillStyle = "rgba(0, 120, 255, 0.20)";
  ctx.strokeStyle = "rgba(0, 120, 255, 0.75)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  for (let i=0;i<6;i++){
    const ang = (-Math.PI/2) + i*(Math.PI*2/6);
    const r = R*vals[i];
    const x = cx + Math.cos(ang)*r;
    const y = cy + Math.sin(ang)*r;
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export function renderDeckRadar(canvasId, textId, deckObj, cardDefs){
  const canvas = document.getElementById(canvasId);
  const textEl = document.getElementById(textId);
  if (!canvas) return;

  const res = evaluateDeck(deckObj, cardDefs);
  drawRadar(canvas, res.scores);

  if (textEl) {
    if (!res.total) textEl.textContent = res.note;
    else textEl.textContent =
      `${res.note} / ${AXES.map((k,i)=>`${k}:${Math.round(res.scores[i])}`).join(" / ")}`;
  }
}