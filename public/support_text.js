// public/support_text.js
// v20260205_support_text_json_fix_plus_csv_cond_drawback_status_table_fix_fmtCell
//
// ✅ 目的：support の effect が「JSON文字列」のまま表示される問題を解消
// ✅ 追加：CSVで使ってる cond/drawback/addStatus/grantEvade/manaUp/bounce/swapPos/moveTo/table(min-max) 対応
// ✅ 修正：fmtCell 未定義で落ちる問題を修正
// ✅ 修正：[object Object] 表記を極力なくす（cond/drawbackを日本語化＆未知キーを短く表示）
//
// - effect が object / JSON文字列 / 既に説明文の文字列 のどれでも動く
// - table（確率テーブル）にも対応（rate重み型＋min/max/label型）
// - 既存の呼び出し：supportEffectTextJa(def.effect) を維持
console.log("[support_text] loaded v20260728_priority123");

function isPlainObject(x){
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function tryParseJsonString(s){
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  if (!((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]")))) return null;
  try { return JSON.parse(t); } catch { return null; }
}

/**
 * effect を「必ず扱える形」に正規化する
 * - object/array -> そのまま
 * - JSON文字列 -> object/array
 * - それ以外の文字列 -> {_asText:"..."}
 */
function normalizeEffect(effect){
  if (!effect) return null;

  if (isPlainObject(effect) || Array.isArray(effect)) return effect;

  if (typeof effect === "string"){
    const parsed = tryParseJsonString(effect);
    if (parsed) return parsed;
    return { _asText: effect.trim() };
  }

  return { _asText: String(effect) };
}

function nInt(v, def=0){
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : def;
}
function clamp01to100(v, def=100){
  const x = nInt(v, def);
  return Math.max(0, Math.min(100, x));
}
function fmtSigned(n){
  const x = nInt(n, 0);
  return (x >= 0) ? `+${x}` : `${x}`;
}
function fmtVital(kind, delta){
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
function joinNonEmpty(...xs){
  return xs.filter(Boolean).join(" / ");
}

// ============ セル/座標っぽいのを表示（fmtCell 未定義対策） ============
function fmtCell(cell){
  if (!cell) return "";

  // すでに文字列ならそのまま
  if (typeof cell === "string") return cell;

  // 数値 (例: to:3) とか
  if (typeof cell === "number") return String(cell);

  if (!isPlainObject(cell)) {
    try { return JSON.stringify(cell); } catch { return ""; }
  }

  // {x,y} 形式
  if (cell.x != null && cell.y != null) return `(${nInt(cell.x, 0)},${nInt(cell.y, 0)})`;

  // {row,col} 形式
  if (cell.row != null && cell.col != null) return `(${nInt(cell.row, 0)},${nInt(cell.col, 0)})`;

  // {idx} 形式
  if (cell.idx != null) return `#${nInt(cell.idx, 0)}`;

  // それ以外は短く
  try{
    const keys = Object.keys(cell).slice(0, 4);
    const compact = keys.map(k => `${k}:${String(cell[k])}`);
    return `{${compact.join(",")}${Object.keys(cell).length>4?",…":""}}`;
  }catch{
    return "";
  }
}

// ============ cond / drawback を日本語化 ============

function fmtSeat(s){
  const t = String(s || "").toUpperCase();
  if (t === "CASTER") return "使用者";
  if (t === "TARGET") return "対象";
  if (t === "YOU") return "自分";
  if (t === "ENEMY") return "相手";
  return s ? String(s) : "";
}

function shortObj(obj, head){
  try{
    const keys = Object.keys(obj || {}).slice(0, 6);
    const compact = keys.map(k => `${k}:${String(obj[k])}`);
    return `${head}{${compact.join(",")}${Object.keys(obj).length>6?",…":""}}`;
  }catch{
    return head ? `${head}{…}` : "{…}";
  }
}

function fmtCond(cond){
  if (!cond) return "";

  if (typeof cond === "string") return cond;

  if (!isPlainObject(cond)) {
    try { return JSON.stringify(cond); } catch { return "[条件]"; }
  }

  const parts = [];

  // 属性条件
  if (cond.attr) parts.push(`属性=${String(cond.attr)}`);
  if (Array.isArray(cond.attrIn) && cond.attrIn.length) parts.push(`属性∈[${cond.attrIn.join(",")}]`);

  // HP条件
  if (isPlainObject(cond.hp) && (cond.hp.max != null || cond.hp.min != null)){
    const a = [];
    if (cond.hp.min != null) a.push(`≥${nInt(cond.hp.min, 0)}`);
    if (cond.hp.max != null) a.push(`≤${nInt(cond.hp.max, 0)}`);
    parts.push(`HP${a.join("")}`);
  }
  if (isPlainObject(cond.hpPct) && (cond.hpPct.max != null || cond.hpPct.min != null)){
    const a = [];
    if (cond.hpPct.min != null) a.push(`≥${nInt(cond.hpPct.min, 0)}%`);
    if (cond.hpPct.max != null) a.push(`≤${nInt(cond.hpPct.max, 0)}%`);
    parts.push(`HP%${a.join("")}`);
  }

  // マナ条件
  if (isPlainObject(cond.mana)){
    const seat = fmtSeat(cond.mana.seat);
    const a = [];
    if (cond.mana.curMin != null) a.push(`現在マナ≥${nInt(cond.mana.curMin, 0)}`);
    if (cond.mana.curMax != null) a.push(`現在マナ≤${nInt(cond.mana.curMax, 0)}`);
    if (a.length){
      parts.push(`${seat ? seat + "の" : ""}${a.join("")}`);
    }
  }

  // 状態条件
  if (isPlainObject(cond.status)){
    const st = cond.status;
    if (Array.isArray(st.hasAny) && st.hasAny.length) parts.push(`状態あり[${st.hasAny.join(",")}]`);
    if (Array.isArray(st.lacksAny) && st.lacksAny.length) parts.push(`状態なし[${st.lacksAny.join(",")}]`);
  }

  // ここまでで拾えないキーも “壊れない短縮表示”
  if (!parts.length) return shortObj(cond, "");

  return parts.join(" & ");
}

function fmtDrawback(drawback){
  if (!drawback) return "";

  if (typeof drawback === "string") return drawback;

  if (!isPlainObject(drawback)){
    try { return JSON.stringify(drawback); } catch { return "[反動]"; }
  }

  const parts = [];

  // 自傷/自SP消費
  if (drawback.selfHp != null) parts.push(`自分${fmtVital("HP", -Math.abs(nInt(drawback.selfHp, 0)))}`);
  if (drawback.selfSp != null) parts.push(`自分${fmtVital("SP", -Math.abs(nInt(drawback.selfSp, 0)))}`);

  // 捨てる/ミル
  if (drawback.discard != null) parts.push(`手札${nInt(drawback.discard, 0)}枚捨てる`);
  if (drawback.mill != null) parts.push(`山札上から${nInt(drawback.mill, 0)}枚捨てる`);

  // 追加でよくありそうなの（無ければ無視）
  if (drawback.returnToHand != null) parts.push(`自分を手札に戻す`);
  if (drawback.skipTurn != null) parts.push(`次の行動不可`);

  if (!parts.length) return shortObj(drawback, "");

  return parts.join(" / ");
}

// ============ type ラベル ============

function typeLabel(t){
  const s = String(t ?? "").trim();
  if (!s) return "不明";

  const m = {
    lostSoul: "失魂",  
    draw: "ドロー",
    heal: "回復",
    dmg: "ダメージ",
    modRate: "命中補正",
    powerUp: "威力強化",
    manaUp: "マナ増加",
    cleanse: "状態異常クリア",
    addStatus: "状態付与",
    grantEvade: "回避付与",
    recoverFatigue: "疲労回復",
    fatigueHeal: "疲労回復",
    fatigueClear: "疲労回復",
    recoverMove: "移動回復",
    moveReset: "移動回復",
    refreshMove: "移動回復",
    swapPos: "位置入替",
    moveTo: "強制移動",
    bounce: "バウンス",
    shiftGroup: "隊列移動",   // ←追加
    search: "サーチ",
    deckSearch: "サーチ",
    tutor: "サーチ",
    discardHand: "手札墓地送り",
    handDiscard: "手札墓地送り",
    setCard: "カードふせ",
    setHand: "カードふせ",
    faceDown: "カードふせ",
    facedown: "カードふせ",
    cardLock: "カードふせ",
  };
  return m[s] ?? s;
}

// ============ 効果1個を説明 ============

function describeSingleEffect(eff){
  if (!eff) return "なんも起きなかった...";
  if (eff._asText) return String(eff._asText);

  const core = isPlainObject(eff.effect) ? eff.effect : eff;
  if (!core) return "効果なし";

  const type = String(core.type ?? "").trim();
  const label = typeLabel(type);

  const rate = (core.rate != null) ? clamp01to100(core.rate, 100) : null;

  const condText = fmtCond(core.cond);
  const drawbackText = fmtDrawback(core.drawback);

  const suffix = joinNonEmpty(
    rate != null ? `成功${rate}%` : "",
    condText ? `条件:${condText}` : "",
    drawbackText ? `反動:${drawbackText}` : ""
  );

  if (type === "draw"){
    const n = Math.max(1, nInt(core.n ?? core.draw ?? 1, 1));
    return joinNonEmpty(`${label}：+${n}枚`, suffix);
  }

  if (type === "search" || type === "deckSearch" || type === "decksearch" || type === "tutor"){
    const cardId = String(core.cardId ?? core.id ?? core.searchId ?? "").trim();
    const kind = String(core.kind ?? core.cardKind ?? "").trim();
    const attr = String(core.attr ?? "").trim();
    const parts = [];
    if (cardId) parts.push(cardId);
    if (kind) parts.push(kind === "unit" ? "キャラ" : kind === "support" ? "サポート" : kind);
    if (attr) parts.push(`属性:${attr}`);
    return joinNonEmpty(`${label}：デッキから${parts.length ? parts.join(" / ") : "選んだカード"}を手札へ`, suffix);
  }

  if (
    type === "discardHand" ||
    type === "handDiscard" ||
    type === "discard" ||
    type === "graveHand" ||
    type === "trashHand" ||
    type === "手札を墓地へ"
  ){
    const count = Math.max(1, nInt(core.count ?? core.n ?? 1, 1));
    const target = String(core.targetSeat ?? core.seat ?? "enemy").toLowerCase();
    const who = target === "self" || target === "caster" ? "自分" : "相手";
    return joinNonEmpty(`${label}：${who}の手札${count}枚を墓地へ`, suffix);
  }

  if (
    type === "setCard" ||
    type === "setHand" ||
    type === "faceDown" ||
    type === "facedown" ||
    type === "cardSet" ||
    type === "cardLock" ||
    type === "hideCard" ||
    type === "カードふせ"
  ){
    const count = Math.max(1, nInt(core.count ?? core.n ?? 1, 1));
    const target = String(core.targetSeat ?? core.seat ?? "enemy").toLowerCase();
    const who = target === "self" || target === "caster" ? "自分" : "相手";
    return joinNonEmpty(`${label}：${who}の手札${count}枚を伏せる`, suffix);
  }

  if (
    type === "changeAttr" ||
    type === "setAttr" ||
    type === "attrChange" ||
    type === "attributeChange"
  ){
    const attr = String(core.attr ?? core.to ?? core.value ?? core.targetAttr ?? "").trim();
    return joinNonEmpty(`属性変更${attr ? `:${attr}` : ""}`, suffix);
  }

  if (type === "heal"){
    const hp = nInt(core.hp ?? core.heal ?? core.amount ?? 0, 0);
    const sp = nInt(core.sp ?? 0, 0);
    const parts = [];
    if (hp) parts.push(fmtVital("HP", hp));
    if (sp) parts.push(fmtVital("SP", sp));
    if (!parts.length) parts.push(fmtVital("HP", 10));
    return joinNonEmpty(`${label}：${parts.join(" / ")}`, suffix);
  }

  if (type === "dmg"){
    const hp = nInt(core.hp ?? core.dmg ?? core.damage ?? 0, 0);
    const sp = nInt(core.sp ?? core.spDmg ?? 0, 0);
    const parts = [];
    if (hp) parts.push(fmtVital("HP", -Math.abs(hp)));
    if (sp) parts.push(fmtVital("SP", -Math.abs(sp)));
    if (!parts.length) parts.push(fmtVital("HP", -10));
    return joinNonEmpty(`${label}：${parts.join(" / ")}`, suffix);
  }

  if (type === "modRate"){
    const d = nInt(core.delta ?? core.d ?? 10, 10);
    return joinNonEmpty(`${label}：命中${d>=0?"+":"-"}${Math.abs(d)}%`, suffix);
  }

  if (type === "powerUp"){
    const d = nInt(core.delta ?? core.d ?? 10, 10);
    // “与ダメ+10” みたいに見せる（ゲーム表現に寄せる）
    return joinNonEmpty(`${label}：与ダメ${d>=0?"+":"-"}${Math.abs(d)}`, suffix);
  }

  if (type === "manaUp"){
    const d = nInt(core.delta ?? core.mana ?? 1, 1);
    return joinNonEmpty(`${label}：マナ${fmtSigned(d)}`, suffix);
  }

  if (type === "grantEvade"){
    const turns = Math.max(1, nInt(core.turns ?? core.turn ?? 1, 1));
    const v = (core.v != null) ? nInt(core.v, 1) : 1;
    // v=1なら回避1回、みたいな扱いにする（表示は “回避+1” でもOK）
    return joinNonEmpty(`${label}：回避${v}（${turns}T）`, suffix);
  }

  if (type === "addStatus"){
    const st = String(core.status ?? core.name ?? "").trim() || "status?";
    const turns = Math.max(1, nInt(core.turns ?? core.turn ?? 1, 1));
    const v = (core.v != null) ? nInt(core.v, 1) : null;
    const body = joinNonEmpty(
      `状態:${st}`,
      v != null ? `強度:${v}` : "",
      `継続:${turns}T`
    );
    return joinNonEmpty(`${label}：${body}`, suffix);
  }

  if (type === "cleanse"){
    return joinNonEmpty(`${label}`, suffix);
  }

  if (type === "swapPos"){
    return joinNonEmpty(`${label}：ユニット2体の位置を入替`, suffix);
  }

  if (type === "moveTo"){
    const maxDist = (core.maxDist != null) ? `最大${nInt(core.maxDist, 1)}マス` : "";
    const cell = fmtCell(core.cell ?? core.to ?? core.targetCell);
    const moveDesc = cell ? `${cell}へ` : (maxDist ? maxDist : "位置を変更");
    return joinNonEmpty(`${label}：${moveDesc}`, suffix);
  }

  if (type === "bounce"){
    return joinNonEmpty(`${label}：対象を手札に戻す`, suffix);
  }

    if (type === "shiftGroup"){
    const targetGroup = String(core.targetGroup ?? "").trim();
    const mode = String(core.mode ?? "").trim();
    const dist = Math.max(1, nInt(core.dist ?? 1, 1));
    const count = Math.max(1, nInt(core.count ?? 1, 1));

    const targetJa =
      targetGroup === "enemy" ? "敵" :
      targetGroup === "ally" ? "味方" :
      targetGroup === "all" ? "全体" :
      targetGroup || "対象";

    const modeJa =
      mode === "retreat" ? "後退" :
      mode === "advance" ? "前進" :
      mode === "push" ? "押し出し" :
      mode === "pull" ? "引き寄せ" :
      mode || "移動";

    return joinNonEmpty(
      `${label}：${targetJa}${count}体を${modeJa}${dist}マス`,
      suffix
    );
  }

  // 未知：壊さず表示（ただし短縮）
  try{
    const obj = isPlainObject(core) ? core : { value: core };
    const keys = Object.keys(obj).filter(k => k !== "cond" && k !== "drawback").slice(0, 6);
    const compact = keys.map(k => `${k}:${String(obj[k])}`);
    const head = compact.length ? compact.join(",") : JSON.stringify(obj);
    return joinNonEmpty(`${label}：${head}${Object.keys(obj).length>6?",…":""}`, suffix);
  }catch{
    return joinNonEmpty(`${label}`, suffix);
  }
}

// ============ table 説明（重み or min/max/label） ============

function describeTable(effectObj){
  const table = Array.isArray(effectObj?.table) ? effectObj.table : null;
  if (!table || !table.length) return null;

  const isRangeTable = table.some(r => r && (r.min != null || r.max != null || r.label));

  if (isRangeTable){
    const parts = table.map((row)=>{
      const min = (row?.min != null) ? clamp01to100(row.min, 0) : null;
      const max = (row?.max != null) ? clamp01to100(row.max, 0) : null;
      const label = row?.label ? String(row.label) : "";

      const eff = normalizeEffect(row?.effect);
      const effText = describeSingleEffect(eff);

      // 変更後：1〜20 の “範囲” として出す（%は付けない）
const range =
  (min != null && max != null) ? `${min}〜${max}` :
  (min != null) ? `${min}〜` :
  (max != null) ? `〜${max}` : "";
      

      const head = joinNonEmpty(range, label);
      return `${head ? head + "：" : ""}${effText}`;
    });

    return parts.join(" / ");
  }

  // 従来：重み型（rate/p/prob）
  const rows = table.map((row)=>{
    const w = row?.rate ?? row?.p ?? row?.prob ?? null;
    const weight = (w == null) ? null : Math.max(0, nInt(w, 0));
    const eff = row?.effect ?? row;
    const effN = normalizeEffect(eff);
    return { weight, text: describeSingleEffect(effN) };
  });

  const sum = rows.reduce((a,r)=> a + (r.weight ?? 0), 0);
  const parts = rows.map(r=>{
    if (sum > 0 && r.weight != null){
      const pct = Math.round((r.weight / sum) * 100);
      return `${pct}%：${r.text}`;
    }
    if (r.weight != null) return `${r.weight}：${r.text}`;
    return r.text;
  });

  return parts.join(" / ");
}

/**
 * 外部公開：supportEffectTextJa(effect)
 */
export function supportEffectTextJa(effect){
  const e0 = normalizeEffect(effect);
  if (!e0) return "効果なし";
  if (e0._asText) return e0._asText || "効果なし";

  const tbl = describeTable(e0);
  if (tbl) return `ランダム：${tbl}`;

  return describeSingleEffect(e0);
}

window.supportEffectTextJa = supportEffectTextJa;
console.log("[support_text] exported to window");
