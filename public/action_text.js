// public/action_text.js
// v20260728_priority123
// 目的：技(action)の効果テキストを統一（deck/battle共通）
// - hpDelta/spDelta の符号で「ダメージ/回復」を出し分け
// - tags / addStatus（CSV）を拾って「命中UP/装甲…」を表示
// - アイコン付与

function isObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function nInt(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : d;
}
function fmtSigned(n) {
  const x = nInt(n, 0);
  return x >= 0 ? `+${x}` : `${x}`;
}
function fmtTurns(t) {
  const x = Math.max(1, nInt(t, 1));
  return `${x}T`;
}
function fmtVitalDelta(kind, delta) {
  const n = nInt(delta, 0);
  if (!n) return "";
  const upper = String(kind).toUpperCase();
  const icon =
    upper === "SP"
      ? n > 0
        ? "🩵"
        : "💙"
      : n > 0
        ? "💚"
        : "❤️";
  return `${icon}${n > 0 ? "+" : ""}${n}`;
}

// ===== アイコン + 表示名（CSVに合わせる） =====
const STATUS_META = {
  hitUp: { icon: "🎯", label: "命中増加" },
  aim: { icon: "🎯", label: "命中増加" }, // 互換
  jinx: { icon: "🌀", label: "命中DOWN" },
  armor: { icon: "🛡️", label: "装甲" },
  powerUp: { icon: "💥", label: "攻撃増加" },
  evade: { icon: "💨", label: "回避" },
  recoverMove: { icon: "👟", label: "移動回復" },
  recoverFatigue: { icon: "😌", label: "疲労回復" },
  fracture: { icon: "🦴", label: "骨折" },
  bleed: { icon: "🩸", label: "出血" },
  blind: { icon: "🙈", label: "盲目" },
  smell: { icon: "🦨", label: "におい" },
  lostSoul: { icon: "👻", label: "失魂" },
  pierce: { icon: "📌", label: "貫通" },
  aoe: { icon: "💢", label: "範囲" },
  combo: { icon: "🔗", label: "コンボ" },
  followUp: { icon: "⏭️", label: "追撃" },
  knockback: { icon: "↩️", label: "ノックバック" },
  seal: { icon: "🔒", label: "封印" },
  // public/action_text.js の STATUS_META に追加
  draw: { icon: "🃏", label: "ドロー" },
  rage: { icon: "💢", label: "激怒" },
  激怒: { icon: "💢", label: "激怒" },
  brainwash: { icon: "🧠", label: "洗脳" },
  洗脳: { icon: "🧠", label: "洗脳" },
  sludge: { icon: "🟣", label: "ヘドロ" },
  ヘドロ: { icon: "🟣", label: "ヘドロ" },
  counter: { icon: "↩", label: "カウンター" },
  カウンター: { icon: "↩", label: "カウンター" },
  taiman: { icon: "◎", label: "タイマン" },
  タイマン: { icon: "◎", label: "タイマン" },
};

function fmtStatusKey(k) {
  const key = String(k || "").trim();
  if (!key) return null;
  if (STATUS_META[key]) return { key, ...STATUS_META[key] };
  // kb2/kb3…対応（あなたの方針）
  if (/^kb\d+$/i.test(key))
    return { key, icon: "↩️", label: `ノックバック(${key})` };
  return { key, icon: "✨", label: key };
}

// tags 文字列を ["a","b","c"] に
// tags を [{key, v}] に（"hitUp:30" "powerUp=10" 対応）
function parseTagsKV(tags) {
  const out = [];
  if (!tags) return out;

  const parts = Array.isArray(tags)
    ? tags.map((x) => String(x || "").trim()).filter(Boolean)
    : String(tags)
        .trim()
        .split(/[,\|\+\s]+/g)
        .map((x) => x.trim())
        .filter(Boolean);

  for (const p of parts) {
    // key:value / key=value
    const m = p.match(/^([^:=]+)\s*[:=]\s*(-?\d+)\s*$/);
    if (m) {
      out.push({ key: m[1].trim(), v: nInt(m[2], 0) });
      continue;
    }
    // 値なしタグ
    out.push({ key: p, v: null });
  }
  return out;
}

// addStatus が JSON文字列のとき（例：[{ "when":"<=40","addStatus":"bleed","v":10 }]）
function tryParseJson(s) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (
    !(
      (t.startsWith("[") && t.endsWith("]")) ||
      (t.startsWith("{") && t.endsWith("}"))
    )
  )
    return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// addStatus を “効果一覧” に寄せて回収
function collectStatusEffectsFromAction(action) {
  const a = isObj(action) ? action : {};
  const out = [];

  // 1) tags / tag (CSV互換)
  for (const t of parseTagsKV(a.tags || a.tag)) {
    out.push({ key: t.key, v: t.v, turns: null });
  }

  // 1.5) effect/effects の中に tags があるケース
  const effSrc = a.effects ?? a.effect ?? null;
  if (effSrc) {
    const arr = Array.isArray(effSrc) ? effSrc : [effSrc];
    for (const e of arr) {
      if (!isObj(e)) continue;
      for (const t of parseTagsKV(e.tags || e.tag)) {
        out.push({ key: t.key, v: t.v, turns: null });
      }
      // addStatusっぽいのも拾う
      if (e.addStatus) {
        for (const t of parseTagsKV(e.addStatus)) {
          out.push({ key: t.key, v: t.v, turns: null });
        }
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
    } else if (typeof raw === "number" || /^\d+$/.test(String(raw).trim())) {
      const hasKb = parseTags(a.tags || a.tag).some(
        (x) => String(x).toLowerCase() === "knockback",
      );
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
  const bonus =
    a.bonus != null && String(a.bonus).trim() !== "" ? nInt(a.bonus, 0) : null;
  if (bonus != null) {
    const keys = out.map((x) => String(x.key));
    const prefer = ["hitUp", "powerUp", "armor", "jinx", "knockback"];
    const k = prefer.find((p) => keys.includes(p)) || null;
    if (k) {
      out.forEach((x) => {
        if (String(x.key) === k && x.v == null) x.v = bonus;
      });
    } else {
      out.push({ key: "bonus", v: bonus, turns: null });
    }
  }

  // マージ（同keyまとめる）
  const map = new Map();
  for (const e of out) {
    const key = String(e.key || "").trim();
    if (!key) continue;
    const cur = map.get(key) || { key, v: null, turns: null, when: "" };
    if (e.v != null) cur.v = cur.v == null ? e.v : cur.v + e.v;
    if (e.turns != null)
      cur.turns = cur.turns == null ? e.turns : Math.max(cur.turns, e.turns);
    if (e.when) cur.when = cur.when ? `${cur.when},${e.when}` : e.when;
    map.set(key, cur);
  }
  return [...map.values()];
}

// ===== 公開：actionの効果を1行で =====
export function actionEffectTextJa(eff) {
  if (eff == null) return "";

  if (
    typeof eff === "string" ||
    typeof eff === "number" ||
    typeof eff === "boolean"
  ) {
    return String(eff);
  }

  if (Array.isArray(eff)) {
    return eff.map(actionEffectTextJa).filter(Boolean).join(" / ");
  }

  if (typeof eff === "object") {
    // ★ ここ追加：action(技)っぽいなら、状態/タグ表示を actionSpecialTextJa に任せる
    const looksLikeAction =
      "hpDelta" in eff ||
      "spDelta" in eff ||
      "tags" in eff ||
      "tag" in eff ||
      "addStatus" in eff ||
      "bonus" in eff ||
      "draw" in eff;

    if (looksLikeAction) {
      const parts = [];

      // ダメージ/回復（hpDelta/spDelta から）
      const hp = Number(eff.hpDelta ?? 0);
      const sp = Number(eff.spDelta ?? 0);

      const hpDmg = Math.max(0, -hp);
      const spDmg = Math.max(0, -sp);
      const hpHeal = Math.max(0, hp);
      const spHeal = Math.max(0, sp);

      const dmgHeal = [];
      if (hpDmg) dmgHeal.push(fmtVitalDelta("HP", -hpDmg));
      if (spDmg) dmgHeal.push(fmtVitalDelta("SP", -spDmg));
      if (hpHeal) dmgHeal.push(fmtVitalDelta("HP", hpHeal));
      if (spHeal) dmgHeal.push(fmtVitalDelta("SP", spHeal));
      if (dmgHeal.length) parts.push(dmgHeal.join(" "));

      // 特殊（状態/タグ/bonus/draw etc）
      const spc = actionSpecialTextJa(eff);
      if (spc) parts.push(spc);

      return parts.join("\n"); // ← 詳細UIが改行対応ならこっちが見やすい
      // return parts.join(" / "); // ← 1行にしたいならこっち
    }

    // それ以外の「効果オブジェクト」用の既存表示
    if (eff.healHp != null) return fmtVitalDelta("HP", eff.healHp);
    if (eff.healSP != null) return fmtVitalDelta("SP", eff.healSP);
    if (eff.damage != null) return `💥ダメージ${eff.damage}`;
    if (eff.draw != null) return `🃏ドロー${eff.draw}`;
    if (eff.mana != null) return `🔷マナ${eff.mana >= 0 ? "+" : ""}${eff.mana}`;

    // addStatus が来ても [object Object] にしない（最低限）
    if (eff.addStatus != null) {
      if (typeof eff.addStatus === "string") {
        return `✨状態:${eff.addStatus}${eff.turns ? `(${eff.turns}T)` : ""}`;
      }
      // object/array のときは JSON で出すより “出さない” のが安全
      return "";
    }

    if (eff.move != null) return `➡移動:${eff.move}`;

    try {
      return JSON.stringify(eff);
    } catch (_) {
      return "";
    }
  }

  return String(eff);
}

// ===== range を矢印に変換 =====
function rangeTokenToArrow(tok) {
  const t = String(tok || "").trim();
  if (!t) return "";
  if (t === "self") return "自分";

  // 互換: f2 みたいなのを front2 扱い
  const t2 = t.replace(/^f(\d+)$/i, "front$1");

  // front/back/rf/lf/side/adj
  let m;

  if ((m = t2.match(/^front(\d+)$/i))) return `↑${m[1]}`;
  if ((m = t2.match(/^back(\d+)$/i))) return `↓${m[1]}`;
  if ((m = t2.match(/^rf(\d+)$/i))) return `↗${m[1]}`;
  if ((m = t2.match(/^lf(\d+)$/i))) return `↖${m[1]}`;

  // side は左右どっちとも取れるので ↔ にするのが無難
  if ((m = t2.match(/^side(\d+)$/i))) return `↔${m[1]}`;

  // adj4 みたいなのは「周囲4」
  if ((m = t2.match(/^adj(\d+)$/i))) return `◇${m[1]}`;

  return t; // 不明はそのまま
}

export function rangeToArrowJa(range) {
  const s = String(range || "").trim();
  if (!s) return "";

  // "rf1+lf1" とか "front1+side1+rf1"
  return s
    .split("+")
    .map((x) => rangeTokenToArrow(x))
    .filter(Boolean)
    .join(" + ");
}

function rangeTokenToReadable(tok) {
  const t = String(tok || "").trim();
  if (!t) return "";
  if (t === "self") return "自分";
  if (t === "all") return "全体";
  if (t === "enemyAll") return "敵全体";
  if (t === "allyAll") return "味方全体";

  const t2 = t.replace(/^f(\d+)$/i, "front$1");
  let m;

  if ((m = t2.match(/^front(\d+)$/i))) return `前方${m[1]}`;
  if ((m = t2.match(/^back(\d+)$/i))) return `後方${m[1]}`;
  if ((m = t2.match(/^rf(\d+)$/i))) return `右前${m[1]}`;
  if ((m = t2.match(/^lf(\d+)$/i))) return `左前${m[1]}`;
  if ((m = t2.match(/^side(\d+)$/i))) return `横${m[1]}`;
  if ((m = t2.match(/^adj(\d+)$/i))) return `周囲${m[1]}`;
  if ((m = t2.match(/^right(\d+)$/i))) return `右${m[1]}`;
  if ((m = t2.match(/^left(\d+)$/i))) return `左${m[1]}`;
  if ((m = t2.match(/^up(\d+)$/i))) return `上${m[1]}`;
  if ((m = t2.match(/^down(\d+)$/i))) return `下${m[1]}`;

  return t;
}

export function rangeToReadableJa(range) {
  const s = String(range || "").trim();
  if (!s) return "";
  const readable = s
    .split("+")
    .map((x) => rangeTokenToReadable(x))
    .filter(Boolean)
    .join(" + ");
  const arrows = rangeToArrowJa(s);
  if (!readable) return arrows || s;
  if (arrows && arrows !== readable && arrows !== s) return `${readable} / ${arrows}`;
  return readable;
}

// ===== 「技(action)」から “効果” を作る（JSON出さない） =====
function actionExtraEffectJa(action) {
  const a = isObj(action) ? action : {};
  const parts = [];

  // draw
  const draw = nInt(a.draw, 0);
  if (draw) parts.push(`🃏ドロー+${draw}`);

  // tags/addStatus/bonus から状態系を拾う（あなたの既存関数を活かす）
  const effects = collectStatusEffectsFromAction(a);

  const st = effects
    .map((e) => {
      const meta = fmtStatusKey(e.key);
      if (!meta) return "";

      const v = e.v != null ? fmtSigned(e.v) : "";
      const turns = e.turns != null ? `(${fmtTurns(e.turns)})` : "";

      // 条件付き(JSON addStatus)のときだけ “条件:” を末尾に
      const when = e.when ? ` 条件:${e.when}` : "";

      return `${meta.icon}${meta.label}${v}${turns}${when}`;
    })
    .filter(Boolean);

  if (st.length) parts.push(st.join(" / "));

  return parts.join(" / ");
}

// ===== deck.js が欲しい “形” をまとめて返す =====
export function actionDetailPartsJa(action) {
  const a = isObj(action) ? action : {};

  const cost = nInt(a.cost, 0);
  const name = String(a.name || "");
  const rate = nInt(a.rate, 0);
  const range = rangeToReadableJa(a.range || "");

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
export function actionSpecialTextJa(action) {
  const a = isObj(action) ? action : {};
  const list = collectStatusEffectsFromAction(a);

  const out = [];

  // draw も「特殊」に含める（表示したいなら）
  if (a.draw != null && String(a.draw).trim() !== "") {
    const n = nInt(a.draw, 0);
    if (n) out.push(`🃏ドロー+${n}`);
  }

  const directAttrChange =
    a.changeAttr ?? a.setAttr ?? a.attrChange ?? a.attributeChange ?? null;
  if (directAttrChange != null) {
    const attr =
      typeof directAttrChange === "object"
        ? String(directAttrChange.attr ?? directAttrChange.to ?? directAttrChange.value ?? "").trim()
        : String(directAttrChange).trim();
    if (attr) out.push(`属性変更:${attr}`);
  }

  const effs = Array.isArray(a.effects)
    ? a.effects
    : Array.isArray(a.effect)
      ? a.effect
      : [];
  for (const eff of effs) {
    if (!eff || typeof eff !== "object") continue;
    const type = String(eff.type ?? "").toLowerCase();
    if (
      type === "changeattr" ||
      type === "setattr" ||
      type === "attrchange" ||
      type === "attributechange"
    ) {
      const attr = String(eff.attr ?? eff.to ?? eff.value ?? eff.targetAttr ?? "").trim();
      if (attr) out.push(`属性変更:${attr}`);
    }
  }

  for (const e of list) {
    const meta = fmtStatusKey(e.key);
    if (!meta) continue;

    const v = e.v != null ? fmtSigned(e.v) : "";
    const t = e.turns != null ? `(${fmtTurns(e.turns)})` : "";
    const w = e.when ? `(${e.when})` : "";
    out.push(`${meta.icon}${meta.label}${v}${t}${w}`);
  }

  return out.join(" / ");
}

// 二重読み込みでも落ちないように（すでに定義済みなら上書きしない）
if (!window.actionSpecialTextJa)
  window.actionSpecialTextJa = actionSpecialTextJa;

// デバッグ用（任意）
window.actionDetailPartsJa = actionDetailPartsJa;
console.log("[action_text] exported actionDetailPartsJa");

window.actionEffectTextJa = actionEffectTextJa;
window.rangeToArrowJa = rangeToArrowJa;
window.rangeToReadableJa = rangeToReadableJa;
console.log("[action_text] loaded v20260226");
console.log("action_text exports loaded");
