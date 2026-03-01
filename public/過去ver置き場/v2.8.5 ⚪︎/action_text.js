// public/action_text.js
// v20260226_action_text
// 目的：技(action)の効果テキストを統一（deck/battle共通）
// - hpDelta/spDelta の符号で「ダメージ/回復」を出し分け
// - tags / addStatus（CSV）を拾って「命中UP/装甲…」を表示
// - アイコン付与

function isObj(x){ return !!x && typeof x === "object" && !Array.isArray(x); }
function nInt(v, d=0){ const x=Number(v); return Number.isFinite(x)?Math.trunc(x):d; }
function fmtSigned(n){ const x=nInt(n,0); return x>=0?`+${x}`:`${x}`; }
function fmtTurns(t){ const x=Math.max(1,nInt(t,1)); return `${x}T`; }

// ===== アイコン + 表示名（CSVに合わせる） =====
const STATUS_META = {
  hitUp:        { icon:"🎯", label:"命中UP" },
  aim:          { icon:"🎯", label:"命中UP" },  // 互換
  jinx:         { icon:"🌀", label:"命中DOWN" },
  armor:        { icon:"🛡️", label:"装甲" },
  powerUp:      { icon:"💥", label:"威力UP" },
  evade:        { icon:"💨", label:"回避" },
  recoverMove:  { icon:"👟", label:"移動回復" },
  recoverFatigue:{icon:"😌", label:"疲労回復" },
  fracture:     { icon:"🦴", label:"骨折" },
  bleed:        { icon:"🩸", label:"出血" },
  blind:        { icon:"🙈", label:"目隠し" },
  smell:        { icon:"🦨", label:"悪臭" },
  lostSoul:     { icon:"👻", label:"失魂" },
  pierce:       { icon:"📌", label:"貫通" },
  aoe:          { icon:"💢", label:"範囲" },
  combo:        { icon:"🔗", label:"コンボ" },
  followUp:     { icon:"⏭️", label:"追撃" },
  knockback:    { icon:"↩️", label:"ノックバック" },
};

function fmtStatusKey(k){
  const key = String(k||"").trim();
  if (!key) return null;
  if (STATUS_META[key]) return { key, ...STATUS_META[key] };
  // kb2/kb3…対応（あなたの方針）
  if (/^kb\d+$/i.test(key)) return { key, icon:"↩️", label:`ノックバック(${key})` };
  return { key, icon:"✨", label:key };
}

// tags 文字列を ["a","b","c"] に
function parseTags(tags){
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(x=>String(x||"").trim()).filter(Boolean);

  const s = String(tags).trim();
  if (!s) return [];
  // "smell+blind" みたいな書き方もある
  return s.split(/[,+\s]+/g).map(x=>x.trim()).filter(Boolean);
}

// addStatus が JSON文字列のとき（例：[{ "when":"<=40","addStatus":"bleed","v":10 }]）
function tryParseJson(s){
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (!((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}")))) return null;
  try { return JSON.parse(t); } catch { return null; }
}

// addStatus を “効果一覧” に寄せて回収
function collectStatusEffectsFromAction(action){
  const a = isObj(action) ? action : {};
  const out = [];

  // 1) tags / tag (CSV互換)
  for (const k of parseTags(a.tags || a.tag)){
    out.push({ key:k, v:null, turns:null });
  }

  // 1.5) effect/effects の中に tags があるケース
  const effSrc = a.effects ?? a.effect ?? null;
  if (effSrc){
    const arr = Array.isArray(effSrc) ? effSrc : [effSrc];
    for (const e of arr){
      if (!isObj(e)) continue;
      for (const k of parseTags(e.tags || e.tag)){
        out.push({ key:k, v:null, turns:null });
      }
      // addStatusっぽいのも拾う
      if (e.addStatus){
        for (const k of parseTags(e.addStatus)) out.push({ key:k, v:null, turns:null });
      }
    }
  }

    // 2) addStatus (CSV/JSON/OBJECT 全対応)
  if (a.addStatus != null) {
    const raw = a.addStatus;

    // (A) addStatus が object のケース
    // 例: { self:{}, target:{ lostSoul:true, bleed:true } }
    if (isObj(raw)) {
      // 直下が {lostSoul:true} みたいな形もあるので両方拾う
      const buckets = [];

      if (isObj(raw.self)) buckets.push(raw.self);
      if (isObj(raw.target)) buckets.push(raw.target);

      // self/target が無い場合は raw 自体を拾う
      if (!buckets.length) buckets.push(raw);

      for (const b of buckets) {
        if (!isObj(b)) continue;
        for (const [k, v] of Object.entries(b)) {
          // true/1 なら付与、数字なら値付き付与として扱う
          if (v === true || v === 1 || v === "1") {
            out.push({ key: k, v: null, turns: null });
          } else if (typeof v === "number" || /^\-?\d+$/.test(String(v))) {
            out.push({ key: k, v: nInt(v, 0), turns: null });
          }
        }
      }

    // (B) 数値だけ（例: knockback距離 2）
    } else if (typeof raw === "number" || (/^\d+$/.test(String(raw).trim()))) {
      const hasKb = parseTags(a.tags || a.tag).some(x => String(x).toLowerCase() === "knockback");
      if (hasKb) out.push({ key: "knockback", v: nInt(raw, 0), turns: null });

    // (C) JSON文字列 or 文字列CSV
    } else {
      const parsed = tryParseJson(raw);
      if (parsed) {
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const row of arr) {
          if (!isObj(row)) continue;
          const key = row.addStatus || row.status || row.key;
          if (!key) continue;
          out.push({
            key: String(key),
            v: row.v != null ? nInt(row.v, 0) : null,
            turns: row.turns != null ? nInt(row.turns, 1) : null,
            when: row.when ? String(row.when) : "",
          });
        }
      } else {
        for (const k of parseTags(raw)) {
          out.push({ key: k, v: null, turns: null });
        }
      }
    }
  }

  // 3) bonus（数値バフ）
  const bonus = (a.bonus != null && String(a.bonus).trim() !== "") ? nInt(a.bonus, 0) : null;
  if (bonus != null){
    const keys = out.map(x=>String(x.key));
    const prefer = ["hitUp","powerUp","armor","jinx","knockback"];
    const k = prefer.find(p=>keys.includes(p)) || null;
    if (k){
      out.forEach(x=>{
        if (String(x.key) === k && x.v == null) x.v = bonus;
      });
    }else{
      out.push({ key:"bonus", v:bonus, turns:null });
    }
  }

  // マージ（同keyまとめる）
  const map = new Map();
  for (const e of out){
    const key = String(e.key||"").trim();
    if (!key) continue;
    const cur = map.get(key) || { key, v:null, turns:null, when:"" };
    if (e.v != null) cur.v = (cur.v==null) ? e.v : cur.v + e.v;
    if (e.turns != null) cur.turns = (cur.turns==null) ? e.turns : Math.max(cur.turns, e.turns);
    if (e.when) cur.when = cur.when ? `${cur.when},${e.when}` : e.when;
    map.set(key, cur);
  }
  return [...map.values()];
}

// ===== 公開：actionの効果を1行で =====
export function actionEffectTextJa(eff){
  // null/undefined
  if (eff == null) return "";

  // 文字列・数値
  if (typeof eff === "string" || typeof eff === "number" || typeof eff === "boolean"){
    return String(eff);
  }

  // 配列（複数効果）
  if (Array.isArray(eff)){
    return eff.map(actionEffectTextJa).filter(Boolean).join(" / ");
  }

  // オブジェクト（効果1個）
  if (typeof eff === "object"){
    // よくあるキーを“それっぽく”表示（必要に応じて増やせる）
    if (eff.healHp != null) return `💚HP回復${eff.healHp}`;
    if (eff.healSP != null) return `💙SP回復${eff.healSP}`;
    if (eff.damage != null) return `💥ダメージ${eff.damage}`;
    if (eff.draw != null)   return `🃏ドロー${eff.draw}`;
    if (eff.mana != null)   return `🔷マナ${eff.mana >= 0 ? "+" : ""}${eff.mana}`;
    if (eff.addStatus)      return `✨状態:${eff.addStatus}${eff.turns ? `(${eff.turns}T)` : ""}`;
    if (eff.move)           return `➡移動:${eff.move}`;

    // フォールバック（最低でも中身が見えるように）
    try { return JSON.stringify(eff); } catch(_) { return String(eff); }
  }

  return String(eff);
}

// ===== range を矢印に変換 =====
function rangeTokenToArrow(tok){
  const t = String(tok||"").trim();
  if (!t) return "";
  if (t === "self") return "自分";

  // 互換: f2 みたいなのを front2 扱い
  const t2 = t.replace(/^f(\d+)$/i, "front$1");

  // front/back/rf/lf/side/adj
  let m;

  if ((m = t2.match(/^front(\d+)$/i))) return `↑${m[1]}`;
  if ((m = t2.match(/^back(\d+)$/i)))  return `↓${m[1]}`;
  if ((m = t2.match(/^rf(\d+)$/i)))    return `↗${m[1]}`;
  if ((m = t2.match(/^lf(\d+)$/i)))    return `↖${m[1]}`;

  // side は左右どっちとも取れるので ↔ にするのが無難
  if ((m = t2.match(/^side(\d+)$/i)))  return `↔${m[1]}`;

  // adj4 みたいなのは「周囲4」
  if ((m = t2.match(/^adj(\d+)$/i)))   return `◇${m[1]}`;

  return t; // 不明はそのまま
}

export function rangeToArrowJa(range){
  const s = String(range||"").trim();
  if (!s) return "";

  // "rf1+lf1" とか "front1+side1+rf1"
  return s
    .split("+")
    .map(x=>rangeTokenToArrow(x))
    .filter(Boolean)
    .join(" + ");
}

// ===== 「技(action)」から “効果” を作る（JSON出さない） =====
function actionExtraEffectJa(action){
  const a = isObj(action) ? action : {};
  const parts = [];

  // draw
  const draw = nInt(a.draw, 0);
  if (draw) parts.push(`🃏ドロー+${draw}`);

  // tags/addStatus/bonus から状態系を拾う（あなたの既存関数を活かす）
  const effects = collectStatusEffectsFromAction(a);

  const st = effects.map(e=>{
    const meta = fmtStatusKey(e.key);
    if (!meta) return "";

    const v = (e.v != null) ? fmtSigned(e.v) : "";
    const turns = (e.turns != null) ? `(${fmtTurns(e.turns)})` : "";

    // 条件付き(JSON addStatus)のときだけ “条件:” を末尾に
    const when = e.when ? ` 条件:${e.when}` : "";

    return `${meta.icon}${meta.label}${v}${turns}${when}`;
  }).filter(Boolean);

  if (st.length) parts.push(st.join(" / "));

  return parts.join(" / ");
}

// ===== deck.js が欲しい “形” をまとめて返す =====
export function actionDetailPartsJa(action){
  const a = isObj(action) ? action : {};

  const cost  = nInt(a.cost, 0);
  const name  = String(a.name || "");
  const rate  = nInt(a.rate, 0);
  const range = rangeToArrowJa(a.range || "");

  const hpDelta = nInt(a.hpDelta, 0);
  const spDelta = nInt(a.spDelta, 0);

  // 「ダメージ」は delta がマイナスのとき
  const hpDmg = Math.max(0, -hpDelta);
  const spDmg = Math.max(0, -spDelta);

  // 回復は delta がプラスのとき（必要なら deck.js で表示）
  const hpHeal = Math.max(0, hpDelta);
  const spHeal = Math.max(0, spDelta);

  const effectText = actionExtraEffectJa(a); // ←ここが “object撲滅”

  return { cost, name, rate, range, hpDmg, spDmg, hpHeal, spHeal, effectText };
}

// ===== deck用：特殊効果(状態/タグ/条件付きaddStatus/bonus)を1行で =====
export function actionSpecialTextJa(action){
  const a = isObj(action) ? action : {};
  const list = collectStatusEffectsFromAction(a);

  const out = [];

  // draw も「特殊」に含める（表示したいなら）
  if (a.draw != null && String(a.draw).trim() !== "") {
    const n = nInt(a.draw, 0);
    if (n) out.push(`🃏ドロー+${n}`);
  }

  for (const e of list){
    const meta = fmtStatusKey(e.key);
    if (!meta) continue;

    const v = (e.v != null) ? fmtSigned(e.v) : "";
    const t = (e.turns != null) ? `(${fmtTurns(e.turns)})` : "";
    const w = e.when ? `(${e.when})` : "";
    out.push(`${meta.icon}${meta.label}${v}${t}${w}`);
  }

  return out.join(" / ");
}

// 二重読み込みでも落ちないように（すでに定義済みなら上書きしない）
if (!window.actionSpecialTextJa) window.actionSpecialTextJa = actionSpecialTextJa;

// デバッグ用（任意）
window.actionDetailPartsJa = actionDetailPartsJa;
console.log("[action_text] exported actionDetailPartsJa");

window.actionEffectTextJa = actionEffectTextJa;
console.log("[action_text] loaded v20260226");
console.log("action_text exports loaded");