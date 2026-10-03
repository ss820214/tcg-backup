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
      transform: translateY(-3px);
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,.18), transparent 58%),
        rgba(255,255,255,.07);
      box-shadow:
        0 0 0 2px rgba(255,255,255,.16),
        0 0 0 3px var(--accentSoft) inset,
        0 0 24px var(--accentSoft),
        0 14px 28px rgba(0,0,0,.42);
      animation: selectedHandPulse 1.35s ease-in-out infinite;
    }
    @keyframes selectedHandPulse{
      0%,100%{ filter: brightness(1); }
      50%{ filter: brightness(1.18); }
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

    .handDrawerToggle{
      position: fixed;
      z-index: 1200;
      transform: translateX(-50%);
      min-width: 112px;
      height: 46px;
      border-radius: 999px;
      border: 1px solid rgba(160,210,255,.34);
      background:
        linear-gradient(180deg, rgba(30,52,72,.94), rgba(12,18,28,.94));
      color: rgba(255,255,255,.96);
      font-weight: 1000;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      box-shadow: 0 14px 34px rgba(0,0,0,.42), inset 0 0 0 1px rgba(255,255,255,.06);
      backdrop-filter: blur(10px);
    }
    .handDrawerToggle.open{
      border-color: rgba(255,214,10,.62);
      box-shadow: 0 0 0 1px rgba(255,214,10,.14), 0 18px 38px rgba(0,0,0,.46), 0 0 26px rgba(255,214,10,.16);
    }
    .handDrawerToggleLabel{ letter-spacing:.08em; }
    .handDrawerToggleArrow{ opacity:.9; font-size:13px; }

    .handDrawer{
      position: fixed;
      z-index: 1190;
      width: var(--hand-drawer-w, min(980px, calc(100vw - 28px)));
      min-height: 248px;
      max-height: min(440px, calc(100vh - 120px));
      transform: translate(-50%, 28px) scale(.98);
      opacity: 0;
      pointer-events: none;
      border: 1px solid rgba(160,210,255,.20);
      border-radius: 22px;
      background:
        radial-gradient(720px 260px at 50% 100%, rgba(255,214,10,.14), transparent 62%),
        radial-gradient(820px 320px at 50% 15%, rgba(92,170,255,.16), transparent 66%),
        linear-gradient(180deg, rgba(18,29,43,.94), rgba(7,10,16,.96));
      box-shadow: 0 26px 70px rgba(0,0,0,.58), inset 0 0 0 1px rgba(255,255,255,.05);
      backdrop-filter: blur(16px);
      overflow: hidden;
      transition: opacity .18s ease, transform .18s ease;
    }
    .handDrawer.open{
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, -100%) scale(1);
    }
    .handDrawer::before{
      content:"";
      position:absolute;
      left:50%;
      bottom:-70px;
      width:720px;
      height:170px;
      transform:translateX(-50%);
      border-radius:50%;
      background: radial-gradient(closest-side, rgba(255,214,10,.18), rgba(255,214,10,.05) 58%, transparent 72%);
      pointer-events:none;
    }
    .handDrawerHead{
      position: relative;
      z-index: 4;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding: 14px 18px 8px;
      color: rgba(255,255,255,.92);
    }
    .handDrawerHead b{
      font-size:15px;
      letter-spacing:.12em;
    }
    .handDrawerHead span{
      margin-left:8px;
      color: rgba(255,255,255,.64);
      font-size:12px;
      font-weight:800;
    }
    .handDrawerHint{
      color: rgba(255,255,255,.58);
      font-size:12px;
      white-space:nowrap;
    }

    .handStack.mdHandFan{
      position: relative;
      z-index: 3;
      width: calc(100% - 28px);
      min-height: 238px;
      height: 272px;
      margin: 0 auto;
      overflow-x: clip;
      overflow-y: visible;
      display: block;
      perspective: 1100px;
    }
    .stackHandCard{
      --x: 0px;
      --y: 0px;
      --rot: 0deg;
      --z: 1;
      --accent: rgba(125,211,252,.72);
      --accentSoft: rgba(125,211,252,.22);
      position:absolute;
      left:50%;
      bottom: 18px;
      z-index: var(--z);
      width: 132px;
      height: 188px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.16);
      border-color: var(--accentSoft);
      border-radius: 12px;
      color:#fff;
      background:
        linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.04) 30%, rgba(0,0,0,.34)),
        radial-gradient(160px 120px at 50% 15%, var(--accentSoft), transparent 60%),
        #121720;
      box-shadow: 0 16px 28px rgba(0,0,0,.48), inset 0 0 0 1px rgba(255,255,255,.08);
      cursor:pointer;
      overflow:hidden;
      transform:
        translateX(calc(-50% + var(--x)))
        translateY(var(--y))
        rotate(var(--rot));
      transform-origin: 50% 115%;
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, filter .16s ease;
      user-select:none;
      text-align:left;
    }
    .stackHandCard:hover,
    .stackHandCard:focus-visible{
      z-index: 240;
      border-color: var(--accent);
      transform:
        translateX(calc(-50% + var(--x)))
        translateY(calc(var(--y) - 42px))
        rotate(0deg)
        scale(1.08);
      box-shadow: 0 26px 42px rgba(0,0,0,.58), 0 0 34px var(--accentSoft), inset 0 0 0 1px rgba(255,255,255,.12);
      outline: none;
    }
    .stackHandCard.selected{
      z-index: 260;
      border-color: var(--accent);
      overflow: visible;
      transform:
        translateX(calc(-50% + var(--x)))
        translateY(calc(var(--y) - 54px))
        rotate(0deg)
        scale(1.12);
      box-shadow: 0 28px 48px rgba(0,0,0,.62), 0 0 0 2px rgba(255,255,255,.12), 0 0 36px var(--accentSoft), inset 0 0 0 1px rgba(255,255,255,.14);
    }
    .stackHandCard.evoCandidate{
      outline: 2px solid rgba(120,255,170,.72);
      outline-offset: 3px;
    }
    .shcFrameGlow{
      position:absolute;
      inset:-35% -45% auto;
      height:90px;
      background: radial-gradient(closest-side, var(--accentSoft), transparent 72%);
      opacity:.9;
      pointer-events:none;
    }
    .shcTop{
      position:relative;
      z-index:2;
      display:flex;
      align-items:center;
      justify-content:space-between;
      padding:8px 8px 5px;
    }
    .shcCost,
    .shcAttr{
      width:26px;
      height:26px;
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.20);
      background:rgba(0,0,0,.42);
      font-size:12px;
      font-weight:1000;
      text-shadow:0 1px 6px rgba(0,0,0,.8);
    }
    .shcAttr{
      width:auto;
      min-width:30px;
      padding:0 7px;
      color:rgba(255,255,255,.86);
    }
    .shcArt{
      position:relative;
      z-index:1;
      height:72px;
      margin:0 8px 6px;
      border-radius:9px;
      border:1px solid rgba(255,255,255,.12);
      background:
        radial-gradient(circle at 50% 38%, rgba(255,255,255,.22), transparent 12%),
        radial-gradient(circle at 50% 50%, var(--accentSoft), transparent 56%),
        linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.24));
      display:grid;
      place-items:center;
      overflow:hidden;
    }
    .shcArtImg{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
      filter:saturate(1.08) contrast(1.04);
      opacity:.96;
    }
    .shcArt::after{
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      border:1px solid rgba(255,255,255,.10);
      background:
        linear-gradient(135deg, rgba(255,255,255,.18), transparent 34%),
        linear-gradient(0deg, rgba(0,0,0,.30), transparent 54%);
    }
    .shcArtSymbol{
      position:relative;
      z-index:2;
      align-self:end;
      justify-self:end;
      margin:0 7px 6px 0;
      padding:3px 7px;
      border-radius:999px;
      background:rgba(0,0,0,.46);
      border:1px solid rgba(255,255,255,.16);
      font-size:13px;
      font-weight:1000;
      opacity:.95;
      text-shadow:0 0 18px var(--accentSoft), 0 2px 10px rgba(0,0,0,.8);
    }
    .shcBody{
      position:relative;
      z-index:2;
      display:grid;
      gap:3px;
      padding:0 9px 9px;
    }
    .shcKind{
      color:rgba(255,255,255,.50);
      font-size:9px;
      font-weight:1000;
      letter-spacing:.16em;
    }
    .shcName{
      font-size:13px;
      font-weight:1000;
      line-height:1.12;
      min-height:27px;
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
    }
    .shcVitals{
      width:max-content;
      max-width:100%;
      margin:1px 0 0;
      padding:2px 6px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(0,0,0,.22);
      color:rgba(255,255,255,.88);
      font-size:9px;
      font-weight:950;
      line-height:1.1;
      white-space:nowrap;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
    }
    .shcType{
      color:rgba(255,255,255,.66);
      font-size:10px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .shcText{
      min-height:28px;
      color:rgba(255,255,255,.72);
      font-size:10px;
      line-height:1.25;
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
    }
    .shcStats{
      color:rgba(255,255,255,.88);
      font-size:10px;
      font-weight:900;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .shcPickMarker{
      position:absolute;
      left:50%;
      bottom:-30px;
      z-index:12;
      width:34px;
      height:34px;
      transform:translateX(-50%);
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,232,128,.66);
      background:
        radial-gradient(circle at 30% 18%, rgba(255,255,255,.32), transparent 42%),
        linear-gradient(180deg, rgba(255,222,92,.34), rgba(43,30,4,.92));
      box-shadow:
        0 0 0 3px rgba(255,215,0,.10),
        0 0 24px rgba(255,215,0,.34),
        0 10px 22px rgba(0,0,0,.48);
      pointer-events:none;
      animation: shcPickBounce 1.05s ease-in-out infinite;
    }
    .shcPickMarker span{
      display:block;
      font-size:19px;
      line-height:1;
      filter: drop-shadow(0 2px 5px rgba(0,0,0,.7));
    }
    @keyframes shcPickBounce{
      0%,100%{ transform:translateX(-50%) translateY(0); }
      50%{ transform:translateX(-50%) translateY(5px); }
    }
    .shcLock{
      position:absolute;
      right:8px;
      top:40px;
      z-index:5;
      border:1px solid rgba(255,255,255,.22);
      background:rgba(0,0,0,.58);
      color:rgba(255,255,255,.86);
      border-radius:999px;
      padding:4px 8px;
      font-size:11px;
      font-weight:1000;
      letter-spacing:.04em;
    }

    .handPreview{
      width:100%;
    }
    .hpvCard{
      border-radius:14px;
      border:1px solid var(--accentSoft);
      background:
        radial-gradient(260px 160px at 0% 0%, var(--accentSoft), transparent 64%),
        rgba(255,255,255,.045);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.04);
    }
    .hpvArt{
      position:absolute;
      right:12px;
      top:12px;
      width:92px;
      height:128px;
      border-radius:14px;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.16);
      box-shadow:0 16px 34px rgba(0,0,0,.35), 0 0 28px var(--accentSoft);
      opacity:.94;
    }
    .hpvArt::after{
      content:"";
      position:absolute;
      inset:0;
      border-radius:inherit;
      background:linear-gradient(135deg, rgba(255,255,255,.20), transparent 32%);
      pointer-events:none;
    }
    .hpvArtImg{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }
    .hpvMain,
    .hpvStats,
    .hpvDetailBtn{
      position:relative;
      z-index:2;
      max-width:calc(100% - 108px);
    }

    @media (max-width: 760px){
      .handDrawerToggle{
        min-width:118px;
        height:48px;
      }
      .handDrawer{
        width:var(--hand-drawer-w, calc(100vw - 18px));
        min-height:226px;
        max-height:310px;
        border-radius:18px;
      }
      .handDrawer.open{
        transform: translate(-50%, 0) scale(1);
      }
      .handDrawerHead{
        padding:12px 14px 4px;
      }
      .handDrawerHint{ display:none; }
      .handStack.mdHandFan{
        width: calc(100% - 8px);
        height:220px;
        min-height:206px;
        overflow-x:auto;
        overflow-y:visible;
        padding:0 44px 0;
        scrollbar-width: thin;
      }
      .handStack.mdHandFan .stackHandCard{
        width:104px;
        height:158px;
        bottom:16px;
      }
      .stackHandCard:hover,
      .stackHandCard:focus-visible,
      .stackHandCard.selected{
        transform:
          translateX(calc(-50% + var(--x)))
          translateY(calc(var(--y) - 32px))
          rotate(0deg)
          scale(1.04);
      }
      .shcArt{ height:58px; }
      .hpvArt{
        width:74px;
        height:104px;
      }
      .hpvMain,
      .hpvStats,
      .hpvDetailBtn{
        max-width:calc(100% - 88px);
      }
      .shcName{ font-size:12px; min-height:25px; }
      .shcVitals{ font-size:8px; padding:2px 5px; }
      .shcText{ display:none; }
      .shcPickMarker{
        bottom:-26px;
        width:30px;
        height:30px;
      }
      .shcPickMarker span{ font-size:17px; }
    }
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
    .uArtMini{
      position:relative;
      height:34px;
      margin:2px 0 4px;
      border-radius:8px;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.18);
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.04);
    }
    .uArtMini::after{
      content:"";
      position:absolute;
      inset:0;
      background:
        linear-gradient(135deg, rgba(255,255,255,.16), transparent 34%),
        linear-gradient(0deg, rgba(0,0,0,.36), transparent 58%);
      pointer-events:none;
    }
    .uArtMiniImg{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
      filter:saturate(1.05);
    }
    .uHP{
      font-size:12px;
      opacity:.95;
      line-height:1.05;
      white-space:nowrap;
    }
    
    .unitBox{
  position: relative;       /* ←これ超重要（中のabsolute基準） */
  overflow: hidden;         /* ←はみ出し防止 */
  padding-bottom: 18px;     /* ←下にアイコン分の余白を確保 */
}

.uIcons{
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 22px;             /* ←「少し上」に上げる（ここ調整） */
  font-size: 12px;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;  /* 長い時に…で切る */
  pointer-events: none;     /* クリック邪魔しない */
  text-shadow: 0 2px 8px rgba(0,0,0,.6);
  opacity: .95;
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
