// public/deck_radar.js
// v1.5.0-b (contrast boost) - 50寄りを極端に見える化（80/30狙い）
// ※ 属性は変えない：火/水/風/雷/光/闇/鋼（草/土は未使用なので入れない）

// レーダー軸
const AXES = [
  "攻撃力",
  "耐久性",
  "安定性",
  "展開力",
  "扱いやすさ",
  "制圧力",
];

// 属性の「役割イメージ」(0〜100の基準に寄与)
const TYPE_PROFILE = {
  "火": { atk: 90, dur: 35, stab: 35, exp: 55, use: 75, ctl: 70 },
  "水": { atk: 35, dur: 80, stab: 75, exp: 65, use: 70, ctl: 45 },
  "闇": { atk: 80, dur: 45, stab: 40, exp: 70, use: 30, ctl: 80 },
  "風": { atk: 40, dur: 40, stab: 55, exp: 85, use: 85, ctl: 45 },
  "雷": { atk: 60, dur: 45, stab: 65, exp: 90, use: 65, ctl: 70 },
  "光": { atk: 55, dur: 60, stab: 80, exp: 60, use: 40, ctl: 35 },
  "鋼": { atk: 20, dur: 90, stab: 50, exp: 20, use: 70, ctl: 20 },
};

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

  for (const id of ids) {
    const cnt = Number(deckObj[id] || 0);
    const c = cardDefs?.[id];
    if (!c) continue;

    const type = c.type ?? "?";
    const prof = TYPE_PROFILE[type] || { atk:50, dur:50, stab:50, exp:50, use:50, ctl:50 };

    const cost = Number(c.cost ?? 0);
    const hp = Number(c.hp ?? 0);
    const sp = Number(c.sp ?? 0);

    if (cost >= 5) highCost += cnt;

    const acts = Array.isArray(c.actions) ? c.actions : [];
    const dmgAvg = avg(acts.map(a => Number(a?.dmg ?? 0)));
    const spDmgAvg = avg(acts.map(a => Number(a?.spDmg ?? 0)));
    const drawAvg = avg(acts.map(a => Number(a?.draw ?? 0)));
    const rangeBonus = avg(acts.map(a => rangeControlBonus(a?.range)));

    // ざっくり式：属性プロファイル + カード実数値補正
    atk += cnt * (prof.atk + dmgAvg*3 + spDmgAvg*1.6);
    dur += cnt * (prof.dur + hp*0.9 + sp*0.25);
    stab += cnt * (prof.stab + sp*0.7 + clamp(6 - cost, 0, 6)*6);
    exp += cnt * (prof.exp + drawAvg*18 + clamp(4 - cost, 0, 4)*10);
    use += cnt * (prof.use + clamp(5 - cost, 0, 5)*10);
    ctl += cnt * (prof.ctl + spDmgAvg*6 + rangeBonus);
  }

  // 安定性：高マナが多いと下がる（要望）
  stab -= highCost * 18;

  // ★圧縮を弱めて “差が出やすい” ようにする
  // 以前: /(total*2) で50寄りになりがち → 1.6にして振れ幅増
  const DIV = 1.6;

  const sAtk  = clamp(atk /(total*DIV), 0, 100);
  const sDur  = clamp(dur /(total*DIV), 0, 100);
  const sStab = clamp(stab/(total*DIV), 0, 100);
  const sExp  = clamp(exp /(total*DIV), 0, 100);
  const sUse  = clamp(use /(total*DIV), 0, 100);
  const sCtl  = clamp(ctl /(total*DIV), 0, 100);

  // ★最後に“極端化”（50中心で拡大）
  // 例: 60→70, 40→30 くらいに寄せる（gain=2.0）
  const GAIN = 2.0;
  const scores = [
    exaggerate(sAtk,  GAIN),
    exaggerate(sDur,  GAIN),
    exaggerate(sStab, GAIN),
    exaggerate(sExp,  GAIN),
    exaggerate(sUse,  GAIN),
    exaggerate(sCtl,  GAIN),
  ];

  const note = `枚数:${total} / 高マナ(5+)枚数:${highCost}`;
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
    else textEl.textContent = `${res.note} / ${AXES.map((k,i)=>`${k}:${Math.round(res.scores[i])}`).join(" / ")}`;
  }
}