// public/ui_styles.js
// v20260211_ui_styles_split_a_fixed
//
// - export の重複を完全解消
// - TYPE_RGB.none を追加（null/未定義防止）
// - 英語/別名→キー吸収を維持
// - rgba はそのまま返し、hex の時だけ rgba 化
// - 既存の inject CSS 群はそのまま

// =====================
// 色（属性：濃い色を枠として使う）
// =====================
export const TYPE_RGB = {
  火: "#ff3b30",
  水: "#0a84ff",
  草: "#34c759",
  闇: "#af52de",
  光: "#ffd60a",
  雷: "#ff9500",
  風: "#f5f5f7",
  鋼: "#8e8e93",
  土: "#c19a6b",
  support: "#c7c7cc",
  Support: "#c7c7cc",

  // フィールド/その他（rgba はそのまま使う）
  grass: "rgba(140, 255, 140, 0.70)",
  swamp: "rgba(120, 200, 160, 0.70)",
  danger: "rgba(255, 120, 120, 0.70)",
};

// 未定義フォールバック（これが無いと TYPE_RGB.none 参照で落ちる）
TYPE_RGB.none = "rgba(255,255,255,0.35)";

// =====================
// Utils
// =====================
export function hexToRgba(hex, a = 1) {
  const h = String(hex || "")
    .replace("#", "")
    .trim();
  if (h.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// 英語/別名→キー吸収（TYPE_RGB のキーに正規化）
function normalizeTypeKey(type) {
  const raw = String(type ?? "").trim();

  // まずそのまま
  if (TYPE_RGB[raw]) return raw;

  const low = raw.toLowerCase();
  if (TYPE_RGB[low]) return low;

  // よくある別名を吸収
  const alias = {
    fire: "火",
    water: "水",
    grass: "草",
    wind: "風",
    thunder: "雷",
    light: "光",
    dark: "闇",
    steel: "鋼",
    earth: "土",
    support: "support",
  };
  if (alias[low] && TYPE_RGB[alias[low]]) return alias[low];

  // 「炎」など（必要なら追加）
  const aliasJP = { 炎: "火" };
  if (aliasJP[raw] && TYPE_RGB[aliasJP[raw]]) return aliasJP[raw];

  return null;
}

// =====================
// Public API（game.js から import される想定）
// =====================
export function typeToCssColor(type) {
  const k = normalizeTypeKey(type);
  return (k ? TYPE_RGB[k] : null) || TYPE_RGB.none;
}

export function typeColorStrong(type) {
  return typeToCssColor(type);
}

export function typeColorSoft(type, alpha = 0.35) {
  const strong = typeColorStrong(type);

  // すでに rgba / rgb ならそのまま（フィールド色とか）
  if (/^rgba?\(/i.test(String(strong))) return strong;

  // hex のときだけ rgba 化
  return hexToRgba(strong, alpha);
}

// 旧名互換
export function typeColor(type) {
  return typeColorSoft(type, 0.28);
}

// =====================
// Field Theme CSS: inject
// =====================
export function ensureFieldThemeCss() {
  if (document.getElementById("fieldThemeCss_v20260206")) return;

  const css = document.createElement("style");
  css.id = "fieldThemeCss_v20260206";
  css.textContent = `
    /* base */
    body{
      min-height: 100vh;
      background-attachment: fixed;
      transition: background 350ms ease;
    }
    body::before{
      content:"";
      position: fixed;
      inset: 0;
      pointer-events:none;
      opacity: .12;
      mix-blend-mode: overlay;
      background-image:
        radial-gradient(circle at 20% 30%, rgba(255,255,255,.10), transparent 35%),
        radial-gradient(circle at 70% 60%, rgba(255,255,255,.08), transparent 40%),
        repeating-linear-gradient(0deg, rgba(255,255,255,.03), rgba(255,255,255,.03) 1px, transparent 1px, transparent 3px);
    }

    /* grass */
    body.field-grass{
      background:
        radial-gradient(900px 520px at 20% 15%, rgba(160,255,170,.18), transparent 60%),
        radial-gradient(900px 650px at 80% 60%, rgba(80,170,255,.10), transparent 65%),
        linear-gradient(180deg, #0b2a16 0%, #05140b 100%);
    }

    /* danger (爆弾フィールド) */
    body.field-danger{
      background:
        radial-gradient(900px 520px at 25% 20%, rgba(255,110,80,.20), transparent 60%),
        radial-gradient(900px 650px at 75% 65%, rgba(255,220,120,.10), transparent 65%),
        linear-gradient(180deg, #2a0b0b 0%, #090202 100%);
    }

    /* swamp */
    body.field-swamp{
      background:
        radial-gradient(900px 520px at 20% 18%, rgba(120,255,190,.12), transparent 60%),
        radial-gradient(900px 650px at 75% 65%, rgba(80,160,120,.10), transparent 65%),
        linear-gradient(180deg, #08221a 0%, #04110c 100%);
    }
  `;
  document.head.appendChild(css);
}

export const FIELD_THEME_CLASSES = [
  "field-grass",
  "field-danger",
  "field-swamp",
];

// normalizeFieldId を game.js から渡してもらう（依存をここに持ち込まない）
export function applyFieldThemeFromState(st, normalizeFieldId) {
  ensureFieldThemeCss();
  const fid = normalizeFieldId(st?.fieldId ?? st?.field?.id ?? "grass");
  const root = document.body;
  root.classList.remove(...FIELD_THEME_CLASSES);
  root.classList.add(`field-${fid}`);
}

// =====================
// Hand UI: inject CSS
// =====================
export function ensureHandCss() {
  if (document.getElementById("handCss_v20260201_simple_v2")) return;

  const css = document.createElement("style");
  css.id = "handCss_v20260201_simple_v2";
  css.textContent = `
    #hand{ display:flex; flex-wrap:wrap; gap:10px; align-items:stretch; justify-content:flex-start; padding:8px 6px; }
    .handCard{
      --accent: rgba(255,255,255,.55);
      --accentSoft: rgba(255,255,255,.22);
      width:250px; min-height:102px;
      border:1px solid rgba(255,255,255,.16); border-color:var(--accentSoft);
      border-radius:14px;
      background:rgba(255,255,255,.05);
      position:relative; overflow:hidden; cursor:pointer; user-select:none;
      padding:10px 10px 8px;
      box-shadow: 0 6px 16px rgba(0,0,0,.25), 0 0 0 2px rgba(0,0,0,.10) inset;
      transition: transform .06s ease, border-color .06s ease, background .06s ease, box-shadow .06s ease;
    }
    .handCard:hover{
      transform: translateY(-1px);
      border-color: var(--accent);
      background: rgba(255,255,255,.06);
      box-shadow: 0 8px 18px rgba(0,0,0,.28), 0 0 0 2px rgba(0,0,0,.10) inset;
    }
    .handCard.selected{
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(255,255,255,.12), 0 0 0 2px var(--accentSoft) inset, 0 10px 20px rgba(0,0,0,.35);
    }
    .handCard.evoCandidate{ outline:2px solid rgba(120,255,170,.45); outline-offset:0px; }

    .hcBar{ position:absolute; left:0; top:0; bottom:0; width:14px; opacity:1;
  background: linear-gradient(180deg, var(--accent) 0%, rgba(0,0,0,.0) 140%); }
    .hcRow1{ display:flex; gap:10px; align-items:center; }
    .hcDiamond{
      width:28px; height:28px; transform: rotate(45deg);
      border-radius:6px; border:1px solid rgba(255,255,255,.22); border-color: var(--accentSoft);
      background: rgba(0,0,0,.18);
      display:flex; align-items:center; justify-content:center; flex:0 0 auto;
      box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
    }
    .hcDiamond span{ transform: rotate(-45deg); font-weight:900; font-size:13px; line-height:1; }
    .hcMain{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .hcName{ font-weight:900; font-size:14px; line-height:1.15; word-break: break-word; }
    .hcType{ font-size:12px; opacity:.88; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .hcRow2{
  margin-top:8px;
  display:flex;
  align-items:flex-start;     /* ← 上詰めにして潰れ防止 */
  justify-content:space-between;
  gap:10px;
}
    .hcStats{
  font-size:12px;
  opacity:.92;
  display:block;              /* ← flexやめる：折返しが安定する */
  line-height:1.15;
  white-space:normal;         /* ← 折返し許可 */
  overflow:visible;           /* ← 見切れ防止 */
  min-width:0;
}
    .hcDetailBtn{
      font-size:12px; padding:6px 10px;
      border-radius:10px; border:1px solid rgba(255,255,255,.20); border-color: var(--accentSoft);
      background: rgba(0,0,0,.18); color:#fff; cursor:pointer; flex:0 0 auto;
    }
    .hcEvoBtn{
      position:absolute;
      right:10px;
      top:10px;
      font-size:12px;
      padding:7px 10px;
      border-radius:12px;
      border:1px solid rgba(120,255,170,.35);
      background: rgba(120,255,170,.14);
      color:#fff;
      font-weight: 950;
      cursor:pointer;
      box-shadow: 0 0 0 2px rgba(0,0,0,.10) inset;
    }
    .hcEvoBtn:hover{
      background: rgba(120,255,170,.20);
      border-color: rgba(120,255,170,.55);
    }

    .hcDetailBtn:hover{ background: rgba(255,255,255,.08); border-color: var(--accent); }
    .hcSupport{ font-size:12px; opacity:.92; }
  `;
  document.head.appendChild(css);
}

// =====================
// Action Picker UI: inject CSS
// =====================
export function ensureActionPickerCss() {
  if (document.getElementById("actionPickerCss_v20260201")) return;
  const css = document.createElement("style");
  css.id = "actionPickerCss_v20260201";
  css.textContent = `
    #actionPicker{
      border-radius:14px;
      border:1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.04);
      padding:10px 10px 12px;
      box-shadow: 0 8px 18px rgba(0,0,0,.28);
    }
    .apTitle{ display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
    .apTitle b{ font-size:14px; font-weight:900; }
    .apTitle .small{ opacity:.86; font-size:12px; }
    .actWrap{ display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }

    .actBtn{
      --fill: 0;
      position:relative; overflow:hidden;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.18);
      color:#fff;
      padding:8px 10px;
      font-size:12px;
      cursor:pointer;
      min-width:160px;
      box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
      transition: transform .06s ease, border-color .06s ease, background .06s ease;
    }
    .actBtn:hover{
      transform: translateY(-1px);
      border-color: rgba(255,255,255,.30);
      background: rgba(255,255,255,.06);
    }
    .actBtn::before{
      content:"";
      position:absolute;
      left:0; right:0; bottom:0;
      height:100%;
      transform-origin: bottom;
      transform: scaleY(var(--fill));
      transition: transform .22s ease;
      background: linear-gradient(180deg,
        rgba(90,170,255,.08) 0%,
        rgba(90,170,255,.18) 40%,
        rgba(90,170,255,.28) 100%);
    }
    .actBtn.selected{
      border-color: rgba(90,170,255,.55);
      box-shadow: 0 0 0 2px rgba(90,170,255,.18), 0 0 0 2px rgba(0,0,0,.12) inset;
    }
    .actBtn.selected::before{ transform: scaleY(1); }
    .actBtn .actText{ position:relative; z-index:2; display:flex; align-items:center; gap:8px; white-space:nowrap; }
    .actBtn .badge{
      display:inline-flex; align-items:center; justify-content:center;
      padding:2px 6px; border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.16);
      font-weight:800; font-size:11px; opacity:.95;
    }
    .apFooter{ margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }

    .apPanel{
      margin-top: 10px;
      padding: 10px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.16);
    }
    .apPanel .row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
    .apPanel .small{ font-size:12px; opacity:.86; }
    .apPanel .title{ font-weight:900; }
    .apPanel .pill{
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.16);
      background: rgba(0,0,0,.14);
      font-size: 11px;
      font-weight: 900;
      opacity: .95;
    }
    .apPanel .hint{
      margin-top: 8px;
      font-size: 12px;
      opacity: .92;
      line-height: 1.35;
      white-space: pre-wrap;
    }
    .btnExec{
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.22);
      background: rgba(90,170,255,.16);
      color: #fff;
      font-weight: 900;
      padding: 9px 12px;
      cursor: pointer;
    }
    .btnExec:hover{ background: rgba(90,170,255,.22); }
    .btnExec:disabled{
      opacity: .45;
      cursor: not-allowed;
      background: rgba(0,0,0,.16);
    }
    .btnGhost{
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.14);
      color: #fff;
      font-weight: 900;
      padding: 9px 12px;
      cursor: pointer;
    }
    .btnGhost:hover{ background: rgba(255,255,255,.06); }
    .btnGhost:disabled{ opacity:.45; cursor:not-allowed; }
  `;
  document.head.appendChild(css);
}

// =====================
// Board Unit UI: inject CSS
// =====================
export function ensureBoardUnitCss() {
  if (document.getElementById("boardUnitCss_v20260202_owner_ribbon")) return;
  const css = document.createElement("style");
  css.id = "boardUnitCss_v20260202_owner_ribbon";
  css.textContent = `
    .unitBox{
      --accent: rgba(255,255,255,.55);
      --accentSoft: rgba(255,255,255,.22);
      display:flex; flex-direction:column; gap:4px;
      padding:8px 8px 7px;
      border-radius:14px;
      background: rgba(0,0,0,.14);
      border: 2px solid var(--accentSoft);
      box-shadow: 0 0 0 2px rgba(0,0,0,.12) inset;
      position:relative;
      overflow:hidden;
    }
    .uTop{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; opacity:.96; line-height:1; }
    .uCost{
      font-weight:900; padding:2px 6px; border-radius:10px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.18);
      display:inline-flex; align-items:center; gap:4px;
      min-width:18px; justify-content:center;
    }
    .uType{
      padding:2px 6px; border-radius:10px;
      border:1px solid var(--accentSoft);
      background: rgba(0,0,0,.10);
      opacity:.95; white-space:nowrap;
    }
    .uName{
      font-weight:900;
      font-size:13px;
      line-height:1.05;
      word-break:break-word;
    }
    .uHP{
      font-size:12px;
      opacity:.95;
      line-height:1.05;
      white-space:nowrap;
    }
    .uIcons{
      font-size:12px;
      opacity:.98;
      line-height:1.05;
      min-height:14px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    /* OWNER ribbon */
    .uOwner{
      margin-top: 4px;
      padding: 5px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .10em;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.16);
    }
    .uOwner .tag{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:2px 7px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.14);
      font-weight:900;
      font-size:10px;
      letter-spacing:.18em;
    }
    .uOwner.you{ border-color: rgba(120,255,170,.25); }
    .uOwner.enemy{ border-color: rgba(255,120,120,.20); }
    .uOwner.you .tag{ border-color: rgba(120,255,170,.25); }
    .uOwner.enemy .tag{ border-color: rgba(255,120,120,.20); }

    .panicBadge{
      position:absolute;
      right:8px;
      top:8px;
      padding:3px 7px;
      border-radius:999px;
      font-size:10px;
      font-weight:900;
      letter-spacing:.12em;
      border:1px solid rgba(255,120,120,.35);
      background: rgba(255,120,120,.14);
      color:#fff;
      pointer-events:none;
    }
  `;
  document.head.appendChild(css);
}

// =====================
// Board assist CSS（召喚緑枠/射程など）
// =====================
export function ensureBoardAssistCss() {
  if (document.getElementById("boardAssistCss_v20260201")) return;
  const css = document.createElement("style");
  css.id = "boardAssistCss_v20260201";
  css.textContent = `
    .cell{ position:relative; box-sizing:border-box; }
    .cell.summonOk{ outline:3px solid rgba(120,255,170,.55); outline-offset:-3px; }
    .cell.summonOk::after{
      content:"＋";
      position:absolute; inset:0;
      display:flex; align-items:center; justify-content:center;
      font-weight:900; font-size:18px;
      color: rgba(120,255,170,.9);
      text-shadow: 0 2px 10px rgba(0,0,0,.65);
      pointer-events:none;
    }

    /* range highlight */
    .cell.rangeOk{ outline:3px solid rgba(90,170,255,.45); outline-offset:-3px; }
    .cell.rangeNo{ outline:3px dashed rgba(255,170,90,.35); outline-offset:-3px; }

    /* support highlight */
    .cell.supportOk{ outline:3px solid rgba(170,120,255,.45); outline-offset:-3px; }
    .cell.supportOk::after{
      content:"★";
      position:absolute; right:6px; bottom:4px;
      font-weight:900; font-size:14px;
      color: rgba(190,150,255,.95);
      text-shadow: 0 2px 10px rgba(0,0,0,.65);
      pointer-events:none;
    }

    /* selection */
    .cell.selUnit{ box-shadow: inset 0 0 0 3px rgba(120,255,170,.55); }
    .cell.selTarget{ box-shadow: inset 0 0 0 3px rgba(255,120,120,.45); }

    /* hit FX */
    .cell.hitFlash::before{
      content:"";
      position:absolute; inset:-2px;
      border-radius:10px;
      box-shadow: 0 0 0 3px rgba(255,255,255,.15), 0 0 20px rgba(255,255,255,.18);
      animation: hitFlash .6s ease both;
      pointer-events:none;
    }
    @keyframes hitFlash{
      0%{ opacity:0; transform: scale(.98); }
      20%{ opacity:1; transform: scale(1); }
      100%{ opacity:0; transform: scale(1.02); }
    }

    .floatDmg{
      position:absolute;
      left:50%; top:50%;
      transform: translate(-50%,-50%);
      padding:4px 8px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.22);
      background: rgba(0,0,0,.28);
      font-weight:900;
      font-size:12px;
      pointer-events:none;
      animation: floatUp 1s ease both;
      white-space:nowrap;
    }
    @keyframes floatUp{
      0%{ opacity:0; transform: translate(-50%,-20%); }
      15%{ opacity:1; }
      100%{ opacity:0; transform: translate(-50%,-120%); }
    }
  `;
  document.head.appendChild(css);
}
