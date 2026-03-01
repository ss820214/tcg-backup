// public/support_text.js
// v20260129a - Support effect text (JP)
// 表示専用：ゲームロジックは触らない

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function safeObj(o){ return (o && typeof o === "object" && !Array.isArray(o)) ? o : {}; }

function effectOneToJa(effect){
  const e = safeObj(effect);
  const type = String(e.type || "").trim();

  if (type === "draw") {
    const n = Math.max(0, Math.trunc(Number(e.n ?? e.draw ?? 1)));
    return `カードを${n}枚引く`;
  }
  if (type === "heal") {
    const hp = Math.max(0, Math.trunc(Number(e.hp ?? 0)));
    const sp = Math.max(0, Math.trunc(Number(e.sp ?? 0)));
    const parts = [];
    if (hp) parts.push(`HP+${hp}`);
    if (sp) parts.push(`SP+${sp}`);
    return parts.length ? `回復：${parts.join(" / ")}` : "回復";
  }
  if (type === "dmg") {
    const hp = Math.max(0, Math.trunc(Number(e.hp ?? 0)));
    const sp = Math.max(0, Math.trunc(Number(e.sp ?? 0)));
    const parts = [];
    if (hp) parts.push(`HP-${hp}`);
    if (sp) parts.push(`SP-${sp}`);
    return parts.length ? `ダメージ：${parts.join(" / ")}` : "ダメージ";
  }
  if (type === "modRate") {
    const d = Math.trunc(Number(e.delta ?? e.rateDelta ?? 0));
    if (d === 0) return "命中率変化なし";
    return d > 0 ? `命中率 +${d}%` : `命中率 ${d}%`;
  }
  if (type === "powerUp") {
    const d = Math.trunc(Number(e.delta ?? e.power ?? 0));
    return `威力 +${d}%`;
  }
  if (type === "cleanse") return "状態異常を回復";
  if (type === "bounce") return "対象を手札に戻す";
  if (type === "swapPos") return "2体の位置を入れ替える";
  if (type === "moveTo") {
    const md = (e.maxDist == null) ? null : Math.max(0, Math.trunc(Number(e.maxDist)));
    return md == null ? "対象を指定マスへ移動" : `対象を指定マスへ移動（距離${md}まで）`;
  }

  // 不明タイプ
  return type ? `効果(${type})` : "効果";
}

/**
 * effectSpec:
 *  - {rate, type, ...} 形式
 *  - {table:[{min,max,label,effect}, ...]} 形式
 */
export function supportEffectTextJa(effectSpec){
  const spec = safeObj(effectSpec);

  // table形式
  if (Array.isArray(spec.table)) {
    const rows = spec.table
      .map(x => ({
        min: clamp(Number(x.min ?? 1), 1, 100),
        max: clamp(Number(x.max ?? 100), 1, 100),
        label: String(x.label ?? ""),
        effect: x.effect ?? null,
      }))
      .sort((a,b)=> a.min - b.min);

    return rows.map(r => {
      const mm = `${r.min}-${r.max}`;
      const lab = r.label ? `（${r.label}）` : "";
      const body = r.effect ? effectOneToJa(r.effect) : "不発";
      return `${mm}${lab}：${body}`;
    }).join(" / ");
  }

  // rate形式
  const rate = clamp(Number(spec.rate ?? 100), 0, 100);
  const body = effectOneToJa(spec);
  return `成功${rate}%：${body}`;
}