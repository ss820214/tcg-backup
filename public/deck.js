// public/deck.js
// v20260829_home_left_fit1
// Deck builder screen. Keep room/profile tools outside the card list flow.
import { ensureSignedIn } from "./auth.js?v=20260627_user1";

const qs = new URLSearchParams(location.search);

// Profile-linked UID from login.html.
let linkedUid = qs.get("uid") || localStorage.getItem("uid") || "";

const anonUser = await ensureSignedIn();
const anonUid = anonUser?.uid || "";

const profileUid = linkedUid;

try {
  localStorage.setItem("anonUid", anonUid);
  if (profileUid) localStorage.setItem("uid", profileUid);
} catch {}

import { supportEffectTextJa } from "./support_text.js?v=20260827_jewel1";
import {
  actionDetailPartsJa,
  actionEffectTextJa,
  rangeToArrowJa,
} from "./action_text.js?v=20260827_jewel1";
import { cardArtImgHtml } from "./card_art.js?v=20260828_jewel_art1";
import { FAIRY_TALE_CARDS } from "./fairy_tale_cards.js?v=20260726_fairy_rate_down1";
import { JEWEL_CARDS } from "./jewel_cards.js?v=20260828_jewel_art1";
import { STARTER_SUPPORT_CARD_MAP } from "./starter_support_cards.js?v=20260706_starter_support_all1";
import {
  ensureUserProfile,
  ensureStarterOwnedCards,
  getOwnedCounts,
  watchOwnedCards,
  isFairyTaleCardId,
  isStarterCardDef,
  YOU_CARD_ID,
  normalizeYouCard,
} from "./user_store.js?v=20260726_post1";
import { initPostBox } from "./post_box.js?v=20260726_post1";

import { TutorialSystem } from "./tutorial.js?v=20260626";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { initDeckLibrary } from "./deck_library.js?v=20261008_guest2save2";

initPostBox();

// =====================
// Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyBAJV-VyGb9Wujnlmcihuqrh3Z9ejiH87c",
  authDomain: "tcg-0bato.firebaseapp.com",
  projectId: "tcg-0bato.firebaseapp.com".includes("firebaseapp.com")
    ? "tcg-0bato"
    : "tcg-0bato",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =====================
// Const
// =====================
const DECK_SIZE = 30;
const MAX_SAME = 4;

const LOCAL_KEY = "tcg_deck_local_v20260202_30";
const OPEN_TYPE_KEY = "tcg_deck_open_type_v20260202_30";
const NAME_KEY = "tcg_player_name_v20260202_30";
const EX_KEY = "tcg_ex_support_v20260202_30";
const FIELD_KEY = "tcg_desired_field_v20260702";

const DECK_TITLE_KEY = "tcg_deck_title_v20260204";
const PENDING_CLOUD_DECK_KEY = "tcg_pending_cloud_deck_v20260822";

const ROOM_TTL_MIN = 30;
const ROOM_TTL_MS = ROOM_TTL_MIN * 60 * 1000;

const FIELD_OPTIONS = [
  { id: "grass", label: "草原" },
  { id: "danger", label: "危険地帯" },
  { id: "swamp", label: "沼地" },
];

function normalizeFieldIdLocal(v) {
  const raw = String(v || "").trim();
  const s = raw.toLowerCase().replace(/[\s_-]/g, "");
  if (s === "danger" || s === "dangerzone" || raw.includes("危険")) return "danger";
  if (s === "swamp" || raw.includes("沼")) return "swamp";
  if (s === "grass" || raw.includes("草")) return "grass";
  return FIELD_OPTIONS.some((f) => f.id === raw.toLowerCase()) ? raw.toLowerCase() : "grass";
}

function loadDesiredField() {
  try {
    return normalizeFieldIdLocal(localStorage.getItem(FIELD_KEY) || "grass");
  } catch {
    return "grass";
  }
}

function saveDesiredField(v) {
  const id = normalizeFieldIdLocal(v);
  try {
    localStorage.setItem(FIELD_KEY, id);
  } catch {}
  return id;
}

function desiredField() {
  return saveDesiredField(
    document.getElementById("fieldSelect")?.value || loadDesiredField(),
  );
}

function battleUrl(extra = {}) {
  const url = new URL("./battle.html", location.href);
  url.searchParams.set("v", "20260727_room_field_fix1");
  url.searchParams.set("room", roomId);
  url.searchParams.set("player", playerId);
  url.searchParams.set("field", desiredField());
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url.toString();
}

// =====================
// URL params
// =====================
const params = new URLSearchParams(location.search);
let roomId = sanitizeRoomIdParam(params.get("room"));
let playerId = params.get("player");

function newRoomCode4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
function newPlayerId() {
  return crypto.randomUUID?.() ?? "p" + Math.random().toString(16).slice(2);
}
function isValidRoomCode4(v) {
  const s = String(v || "").trim();
  return /^\d{4}$/.test(s) && s !== "0000";
}
function sanitizeRoomIdParam(v) {
  const s = String(v || "").trim();
  return isValidRoomCode4(s) ? s : newRoomCode4();
}

if (!playerId) playerId = newPlayerId();

params.set("room", roomId);
params.set("player", playerId);
history.replaceState(null, "", `${location.pathname}?${params.toString()}`);

// =====================
// DOM (莠呈鋤)
// =====================
const $ = (id) => document.getElementById(id);

const btnSolo = $("btnSolo");
const detailWrap = $("detailWrap");
const detailClose = $("detailClose");
const detailEl = $("detail");
let deckStartEl = $("deckStart");

function ensureDeckStartStyle() {
  if (document.getElementById("deckStartCss_v20260721_home_art1")) return;
  const css = document.createElement("style");
  css.id = "deckStartCss_v20260721_home_art1";
  css.textContent = `
    #btnHome,
    #btnDeckTop{
      border-radius:999px;
      padding:8px 12px;
      border:1px solid rgba(185,255,55,.38);
      background:linear-gradient(180deg, rgba(185,255,55,.16), rgba(0,0,0,.22));
      color:#fff;
      font-weight:950;
      cursor:pointer;
      box-shadow:0 10px 26px rgba(0,0,0,.22);
      transition:transform .08s ease, filter .12s ease, border-color .12s ease;
    }
    #btnHome:hover,
    #btnDeckTop:hover{
      filter:brightness(1.08);
      transform:translateY(-1px);
      border-color:rgba(185,255,55,.58);
    }
    #btnHome:active,
    #btnDeckTop:active{ transform:translateY(0) scale(.99); }
    header .topRight > :not(#btnHome):not(#btnDeckTop):not(#deviceModeBadge){
      display:none !important;
    }
    .deckStart{
      position:fixed; inset:0; z-index:100000;
      display:grid; place-items:center; padding:18px; box-sizing:border-box;
      background:
        radial-gradient(900px 520px at 76% 42%, rgba(160,90,255,.24), transparent 58%),
        radial-gradient(720px 420px at 24% 18%, rgba(65,190,255,.18), transparent 62%),
        radial-gradient(860px 560px at 50% 118%, rgba(120,255,170,.10), transparent 60%),
        linear-gradient(120deg, rgba(4,7,13,.98), rgba(12,15,28,.97) 48%, rgba(7,18,23,.98));
      color:#fff;
      transition: opacity .42s ease, visibility .42s ease;
      font-family:system-ui, -apple-system, Segoe UI, sans-serif;
      overflow:hidden;
    }
    .deckStart::before{
      content:""; position:absolute; inset:0;
      background:
        linear-gradient(115deg, transparent 0 22%, rgba(105,180,255,.10) 22% 22.4%, transparent 22.4% 100%),
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
      background-size:100% 100%, 100% 7px, 7px 100%;
      opacity:.62; pointer-events:none;
    }
    .deckStart::after{
      content:""; position:absolute; right:-12vmin; top:8vmin;
      width:min(560px, 58vw); aspect-ratio:1;
      border-radius:50%;
      border:1px solid rgba(180,120,255,.20);
      box-shadow:0 0 70px rgba(155,95,255,.18), inset 0 0 90px rgba(105,180,255,.08);
      animation:startRing 4.8s ease-in-out infinite; pointer-events:none;
    }
    .deckStart.hide{ opacity:0; visibility:hidden; pointer-events:none; }
    .deckStart.isTransitioning{ pointer-events:none; }
    .deckStart.isTransitioning .deckStartShell{
      transition:opacity .62s ease .68s, transform .62s ease .68s, filter .62s ease .68s;
      opacity:.18;
      transform:scale(.985);
      filter:blur(1.5px);
    }
    .deckStartZoomSource{
      transition:transform .18s ease, filter .18s ease, opacity .18s ease;
      transform:translateY(-2px) scale(1.03);
      filter:brightness(1.28);
      opacity:.72;
    }
    .deckStartZoomCard{
      position:fixed;
      z-index:100003;
      overflow:hidden;
      border-radius:18px;
      border:1px solid rgba(255,255,255,.22);
      background:
        radial-gradient(760px 360px at 62% 42%, rgba(185,255,55,.22), transparent 58%),
        radial-gradient(720px 480px at 34% 30%, rgba(105,180,255,.24), transparent 62%),
        linear-gradient(135deg, rgba(18,24,38,.98), rgba(5,9,16,.98));
      color:#fff;
      box-shadow:0 24px 80px rgba(0,0,0,.62), 0 0 54px rgba(105,180,255,.20);
      transform-origin:center center;
      transform:translate3d(0,0,0) scale(1);
      pointer-events:none;
      will-change:transform, opacity, filter;
      animation:deckStartExpandPanel 1.5s cubic-bezier(.16,1,.22,1) forwards paused;
    }
    .deckStartZoomCard.run{ animation-play-state:running; }
    .deckStartZoomCard > *{
      width:100%;
      height:100%;
      box-sizing:border-box;
    }
    .deckStartZoomCard .deckStartArrow,
    .deckStartZoomCard .deckHomeKey,
    .deckStartZoomCard .deckHomeLabel,
    .deckStartZoomCard .deckStartChip,
    .deckStartZoomCard .deckStartTopicK,
    .deckStartZoomCard .deckStartTopicTitle,
    .deckStartZoomCard .deckStartPass b,
    .deckStartZoomCard .deckStartPass span{
      position:relative;
      z-index:1;
    }
    .deckStartZoomCard::before{
      content:"";
      position:absolute;
      inset:0;
      background:
        repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 8px, transparent 8px 16px),
        linear-gradient(115deg, transparent 0 44%, rgba(185,255,55,.20) 45%, transparent 46% 100%);
      opacity:.68;
      pointer-events:none;
    }
    .deckStartZoomCard::after{
      content:"";
      position:absolute;
      inset:-40%;
      background:linear-gradient(110deg, transparent 0 42%, rgba(255,255,255,.42) 48%, transparent 54% 100%);
      transform:translateX(-36%);
      opacity:.54;
      animation:deckStartZoomSweep 1.5s ease forwards paused;
      pointer-events:none;
    }
    .deckStartZoomCard.run::after{ animation-play-state:running; }
    .deckStartZoomText{
      position:absolute;
      left:50%;
      top:50%;
      z-index:3;
      width:auto !important;
      height:auto !important;
      display:grid;
      gap:10px;
      place-items:center;
      text-align:center;
      padding:24px;
      opacity:0;
      transform:translate(-50%, -50%) scale(.94);
      text-shadow:0 8px 24px rgba(0,0,0,.62);
      animation:deckStartZoomTextIn 1.5s ease forwards paused;
      pointer-events:none;
    }
    .deckStartZoomCard.run .deckStartZoomText{ animation-play-state:running; }
    @keyframes deckStartExpandPanel{
      0%{
        transform:translate3d(0,0,0) scale(1);
        opacity:.98;
        filter:brightness(1.02) saturate(1);
        border-radius:18px;
      }
      12%{
        transform:translate3d(0,-8px,0) scale(1.06);
        opacity:1;
        filter:brightness(1.18) saturate(1.1);
      }
      72%{
        transform:translate3d(var(--zoom-x), var(--zoom-y), 0) scale(var(--zoom-sx), var(--zoom-sy));
        opacity:1;
        filter:brightness(1.1) saturate(1.12);
        border-radius:22px;
      }
      100%{
        transform:translate3d(var(--zoom-x), var(--zoom-y), 0) scale(var(--zoom-sx), var(--zoom-sy));
        opacity:0;
        filter:blur(10px) brightness(1.32) saturate(1.18);
        border-radius:24px;
      }
    }
    @keyframes deckStartZoomSweep{
      0%{ transform:translateX(-42%) rotate(0deg); opacity:0; }
      20%{ opacity:.58; }
      82%{ opacity:.38; }
      100%{ transform:translateX(38%) rotate(0deg); opacity:0; }
    }
    @keyframes deckStartZoomTextIn{
      0%, 20%{ opacity:0; transform:translate(-50%, -50%) scale(.92); }
      36%, 72%{ opacity:1; transform:translate(-50%, -50%) scale(1); }
      100%{ opacity:0; transform:translate(-50%, -50%) scale(1.08); }
    }
    .deckStartZoomLabel{
      position:relative;
      z-index:1;
      display:grid;
      gap:10px;
      place-items:center;
      text-align:center;
      padding:24px;
      text-shadow:0 8px 24px rgba(0,0,0,.62);
    }
    .deckStartZoomLabel b{
      font-size:clamp(34px, 7vw, 92px);
      line-height:.9;
      letter-spacing:.08em;
    }
    .deckStartZoomLabel span{
      color:rgba(255,255,255,.72);
      font-weight:900;
      letter-spacing:.12em;
    }
    .deckStartShell{
      position:relative; z-index:1;
      width:min(1180px, 96vw);
      height:min(680px, calc(100dvh - 28px));
      min-height:0;
      display:grid;
      grid-template-columns:minmax(280px, 390px) minmax(320px, 1fr);
      gap:18px;
      align-items:stretch;
    }
    .deckStartPanel{
      border:1px solid rgba(255,255,255,.16);
      background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.28));
      border-radius:18px;
      box-shadow:0 24px 70px rgba(0,0,0,.55);
      backdrop-filter:blur(14px);
      overflow:hidden;
      min-height:0;
    }
    .deckStartLeft{
      display:flex;
      flex-direction:column;
      gap:10px;
      padding:12px;
      overflow:auto;
      scrollbar-width:thin;
      scroll-padding-top:88px;
    }
    .deckStartProfile{
      position:sticky;
      top:0;
      z-index:6;
      flex:0 0 auto;
      display:grid;
      grid-template-columns:56px minmax(0,1fr) 32px;
      gap:10px;
      align-items:center;
      padding:9px;
      border-radius:15px;
      border:1px solid rgba(255,255,255,.14);
      background:linear-gradient(180deg, rgba(22,38,48,.92), rgba(0,0,0,.70));
      box-shadow:0 10px 28px rgba(0,0,0,.30);
    }
    .deckStartAvatar{
      width:56px; height:56px; border-radius:14px;
      background:
        radial-gradient(circle at 30% 24%, rgba(255,255,255,.55), transparent 12%),
        radial-gradient(circle at 68% 72%, rgba(120,255,170,.45), transparent 26%),
        linear-gradient(135deg, rgba(105,180,255,.58), rgba(120,80,255,.26));
      border:1px solid rgba(255,255,255,.24);
      box-shadow:0 12px 34px rgba(0,0,0,.42), 0 0 26px rgba(105,180,255,.20);
    }
    .deckStartPlayerName{
      min-width:0;
      font-weight:1000;
      font-size:17px;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .deckStartPlayerSub{
      margin-top:3px;
      color:rgba(255,255,255,.58);
      font-size:11px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    .deckStartArrow{
      display:grid; place-items:center;
      width:32px; height:32px; border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.05);
      color:rgba(255,255,255,.76);
      font-weight:950;
    }
    .deckStartTopic{
      position:relative;
      min-height:112px;
      padding:11px;
      border-radius:16px;
      border:1px solid rgba(105,180,255,.22);
      background:
        linear-gradient(135deg, rgba(40,210,255,.12), rgba(0,0,0,.20) 52%),
        repeating-linear-gradient(135deg, rgba(105,180,255,.18) 0 9px, transparent 9px 18px);
      overflow:hidden;
    }
    .deckStartTopic::after{
      content:"";
      position:absolute; inset:auto 0 0 0; height:44%;
      background:linear-gradient(0deg, rgba(0,0,0,.45), transparent);
      pointer-events:none;
    }
    .deckStartTopicK{
      position:relative; z-index:1;
      display:inline-flex;
      padding:3px 9px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.18);
      background:rgba(0,0,0,.32);
      color:rgba(255,255,255,.74);
      font-size:11px;
      font-weight:900;
    }
    .deckStartTopicTitle{
      position:absolute; z-index:1;
      left:14px; right:14px; bottom:14px;
      font-size:21px;
      font-weight:1000;
      letter-spacing:.03em;
      text-shadow:0 3px 12px rgba(0,0,0,.85);
    }
    .deckStartPass{
      display:grid;
      grid-template-columns:1fr auto;
      gap:10px;
      align-items:center;
      padding:10px 12px;
      border-radius:15px;
      border:1px solid rgba(255,220,110,.28);
      background:linear-gradient(90deg, rgba(255,210,80,.18), rgba(0,0,0,.22));
    }
    .deckStartPass b{ font-size:14px; letter-spacing:.06em; }
    .deckStartPass span{ color:rgba(255,255,255,.58); font-size:11px; }
    .deckStartUtility{
      position:relative;
      padding:10px;
      border-radius:15px;
      border:1px solid rgba(105,180,255,.18);
      background:
        linear-gradient(135deg, rgba(105,180,255,.10), rgba(92,220,170,.08)),
        rgba(0,0,0,.20);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
    }
    .deckStartUtilityHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin-bottom:7px;
      color:rgba(255,255,255,.78);
      font-size:12px;
      font-weight:950;
    }
    .deckStartUtilityHead span{
      color:rgba(160,220,255,.68);
      font-size:10px;
      font-weight:900;
    }
    .deckStartUtilityGrid{
      display:grid;
      grid-template-columns:repeat(4, minmax(0, 1fr));
      gap:7px;
    }
    .deckStartUtilityBtn{
      min-height:36px;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      padding:7px 8px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.13);
      background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.22));
      color:#fff;
      font-size:11px;
      font-weight:950;
      cursor:pointer;
      white-space:nowrap;
      transition:transform .14s ease, border-color .14s ease, box-shadow .14s ease, background .14s ease;
    }
    .deckStartUtilityBtn::before{
      content:attr(data-utility-icon);
      width:20px;
      height:20px;
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(0,0,0,.28);
      color:rgba(205,235,255,.92);
      font-size:11px;
      font-weight:1000;
    }
    .deckStartUtilityBtn:hover,
    .deckStartUtilityBtn:focus-visible{
      outline:none;
      transform:translateY(-1px);
      border-color:rgba(105,180,255,.52);
      background:linear-gradient(180deg, rgba(105,180,255,.16), rgba(0,0,0,.22));
      box-shadow:0 0 22px rgba(105,180,255,.14);
    }
    .deckStartMenu{
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:10px;
      margin-top:0;
    }
    .deckHomeBtn{
      --homeArt:url("./assets/home/menu-deck.webp");
      --homeAccent:rgba(105,180,255,.56);
      position:relative;
      min-height:82px;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:flex-end;
      gap:4px;
      overflow:hidden;
      isolation:isolate;
      padding:10px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(0,0,0,.28);
      color:#fff;
      cursor:pointer;
      font-weight:950;
      text-align:left;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 14px 30px rgba(0,0,0,.18);
      transition:transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
    }
    .deckHomeBtn[data-home-action="deck"]{ --homeArt:url("./assets/home/menu-deck.webp"); --homeAccent:rgba(105,180,255,.62); }
    .deckHomeBtn[data-home-action="user"]{ --homeArt:url("./assets/home/menu-user.webp"); --homeAccent:rgba(92,220,170,.58); }
    .deckHomeBtn[data-home-action="gacha"]{ --homeArt:url("./assets/home/menu-gacha.webp"); --homeAccent:rgba(255,210,90,.62); }
    .deckHomeBtn[data-home-action="arcade"]{ --homeArt:url("./assets/home/menu-arcade.webp"); --homeAccent:rgba(255,92,110,.60); }
    .deckHomeBtn[data-home-action="creator"]{ --homeArt:url("./assets/home/menu-creator.webp"); --homeAccent:rgba(172,132,255,.60); }
    .deckHomeBtn[data-home-action="settings"]{ --homeArt:url("./assets/home/menu-room.webp"); --homeAccent:rgba(110,235,255,.58); }
    .deckHomeBtn::before{
      content:"";
      position:absolute;
      inset:0;
      z-index:-2;
      background-image:var(--homeArt);
      background-size:cover;
      background-position:center;
      opacity:.78;
      filter:saturate(1.08) brightness(.86);
      transform:scale(1.02);
      transition:transform .32s ease, opacity .18s ease, filter .18s ease;
    }
    .deckHomeBtn::after{
      content:"";
      position:absolute;
      inset:0;
      z-index:-1;
      background:
        linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.70) 72%, rgba(0,0,0,.84)),
        radial-gradient(circle at 18% 18%, var(--homeAccent), transparent 42%);
      opacity:.92;
    }
    .deckHomeBtn:hover{
      transform:translateY(-2px);
      border-color:var(--homeAccent);
      background:rgba(105,180,255,.12);
      box-shadow:0 16px 34px rgba(0,0,0,.42), 0 0 26px color-mix(in srgb, var(--homeAccent), transparent 58%);
    }
    .deckHomeBtn:hover::before{
      opacity:.95;
      filter:saturate(1.18) brightness(1.02);
      transform:scale(1.08);
    }
    .deckHomeBtn:active{ transform:translateY(0) scale(.99); }
    .deckHomeIcon{
      position:absolute;
      top:8px;
      left:8px;
      z-index:2;
      width:30px; height:30px;
      display:grid; place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.22);
      background:rgba(0,0,0,.42);
      box-shadow:0 0 18px color-mix(in srgb, var(--homeAccent), transparent 46%);
      backdrop-filter:blur(8px);
      font-size:12px;
      letter-spacing:.02em;
    }
    .deckHomeLabel{
      position:relative;
      z-index:2;
      font-size:14px;
      line-height:1.1;
      text-shadow:0 2px 12px rgba(0,0,0,.9);
    }
    .deckHomeSub{
      position:relative;
      z-index:2;
      color:rgba(255,255,255,.72);
      font-size:9px;
      line-height:1.1;
      letter-spacing:.06em;
      text-shadow:0 2px 10px rgba(0,0,0,.85);
    }
    .deckStartStage{
      position:relative;
      min-height:0;
      padding:18px;
      display:grid;
      grid-template-rows:auto 1fr auto;
      overflow:hidden;
    }
    .deckStartTopbar{
      display:flex;
      justify-content:flex-end;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
      position:relative;
      z-index:1100;
    }
    .deckStartPostBtn{
      min-height:38px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:7px 12px;
      border-radius:999px;
      border:1px solid rgba(255,219,118,.35);
      background:
        radial-gradient(circle at 22% 18%, rgba(255,255,255,.30), transparent 24%),
        linear-gradient(135deg, rgba(255,213,104,.20), rgba(105,180,255,.14)),
        rgba(0,0,0,.30);
      color:#fff6c9;
      font-weight:1000;
      letter-spacing:.04em;
      box-shadow:0 0 22px rgba(255,213,104,.13), inset 0 0 18px rgba(255,255,255,.05);
      cursor:pointer;
    }
    .deckStartPostBtn::before{
      content:"";
      width:22px;
      height:22px;
      border-radius:7px;
      border:1px solid rgba(255,255,255,.22);
      background:
        linear-gradient(135deg, transparent 44%, rgba(255,255,255,.55) 45% 55%, transparent 56%),
        linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,213,104,.24));
      box-shadow:0 0 16px rgba(255,213,104,.20);
    }
    .deckStartPostBtn:hover,
    .deckStartPostBtn:focus-visible{
      border-color:rgba(255,240,160,.78);
      transform:translateY(-1px);
      box-shadow:0 0 28px rgba(255,213,104,.25), 0 12px 30px rgba(0,0,0,.28);
    }
    .deckStartPostBtn span{
      font-size:11px;
      color:rgba(255,255,255,.62);
    }
    .deckStartPostBtn b{
      font-size:13px;
    }
    .deckStartToolsWrap{
      position:relative;
      display:inline-flex;
      z-index:1110;
    }
    .deckStartToolsBtn{
      min-height:38px;
      display:inline-flex;
      align-items:center;
      gap:9px;
      padding:8px 13px;
      border-radius:999px;
      border:1px solid rgba(145,230,255,.22);
      background:
        linear-gradient(135deg, rgba(145,230,255,.14), rgba(185,255,55,.08)),
        rgba(0,0,0,.26);
      color:#fff;
      font-weight:1000;
      letter-spacing:0;
      box-shadow:inset 0 0 18px rgba(255,255,255,.04);
      cursor:pointer;
    }
    .deckStartToolsBtn::before{
      content:"";
      width:22px;
      height:22px;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.20);
      background:
        linear-gradient(90deg, transparent 45%, rgba(255,255,255,.68) 45% 55%, transparent 55%),
        linear-gradient(0deg, transparent 45%, rgba(255,255,255,.68) 45% 55%, transparent 55%),
        radial-gradient(circle at 50% 50%, rgba(145,230,255,.35), rgba(255,255,255,.06));
      box-shadow:0 0 16px rgba(145,230,255,.14);
    }
    .deckStartToolsBtn span{
      font-size:10px;
      color:rgba(145,230,255,.72);
    }
    .deckStartToolsBtn b{
      font-size:13px;
    }
    .deckStartToolsWrap.open .deckStartToolsBtn,
    .deckStartToolsBtn:hover,
    .deckStartToolsBtn:focus-visible{
      border-color:rgba(145,230,255,.62);
      box-shadow:0 0 28px rgba(105,180,255,.22), inset 0 0 18px rgba(255,255,255,.05);
      outline:none;
    }
    .deckStartToolsPanel{
      position:absolute;
      top:calc(100% + 8px);
      right:0;
      width:min(280px, 82vw);
      display:grid;
      gap:7px;
      padding:8px;
      border-radius:16px;
      border:1px solid rgba(145,230,255,.25);
      background:
        linear-gradient(135deg, rgba(13,22,34,.96), rgba(20,18,35,.94)),
        radial-gradient(circle at 100% 0%, rgba(185,255,55,.13), transparent 42%);
      box-shadow:0 18px 42px rgba(0,0,0,.45), 0 0 28px rgba(105,180,255,.13);
      backdrop-filter:blur(14px);
      z-index:1120;
    }
    .deckStartToolsPanel[hidden]{ display:none !important; }
    .deckStartToolItem{
      width:100%;
      min-height:42px;
      display:flex;
      align-items:center;
      gap:10px;
      padding:9px 10px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.055);
      color:#fff;
      font-weight:950;
      letter-spacing:0;
      text-align:left;
      cursor:pointer;
    }
    .deckStartToolItem::before{
      content:attr(data-utility-icon);
      flex:0 0 28px;
      width:28px;
      height:28px;
      display:grid;
      place-items:center;
      border-radius:999px;
      background:rgba(145,230,255,.14);
      border:1px solid rgba(145,230,255,.24);
      color:#dff7ff;
      font-size:12px;
      font-weight:1000;
    }
    .deckStartToolItem:hover,
    .deckStartToolItem:focus-visible{
      border-color:rgba(185,255,55,.44);
      background:rgba(185,255,55,.10);
      outline:none;
    }
    @media (max-width:720px){
      .deckStartToolsPanel{
        right:auto;
        left:0;
      }
    }
    .deckStartChip{
      min-height:38px;
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 13px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.15);
      background:rgba(0,0,0,.26);
      color:rgba(255,255,255,.82);
      font-size:13px;
      font-weight:900;
    }
    .deckStartConcept{
      position:absolute;
      top:72px;
      right:18px;
      z-index:5;
      width:min(360px, 40%);
      max-height:calc(100dvh - 148px);
      overflow:auto;
      padding:15px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.14);
      background:
        linear-gradient(135deg, rgba(8,14,22,.76), rgba(24,20,42,.58)),
        radial-gradient(circle at 100% 0%, rgba(185,255,55,.15), transparent 46%);
      box-shadow:0 18px 44px rgba(0,0,0,.28), inset 0 0 28px rgba(105,180,255,.06);
      backdrop-filter:blur(12px);
      scrollbar-width:thin;
    }
    .deckStartConceptBrand{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:10px;
    }
    .deckStartTtcg{
      display:inline-flex;
      align-items:center;
      min-height:34px;
      padding:4px 12px;
      border-radius:999px;
      border:1px solid rgba(185,255,55,.34);
      background:
        linear-gradient(135deg, rgba(185,255,55,.18), rgba(105,180,255,.10)),
        rgba(0,0,0,.22);
      color:rgba(225,255,160,.98);
      font-size:18px;
      font-weight:1000;
      letter-spacing:0;
      box-shadow:0 0 22px rgba(185,255,55,.14);
    }
    .deckStartTtcgSub{
      color:rgba(255,255,255,.62);
      font-size:10px;
      font-weight:900;
      letter-spacing:0;
    }
    .deckStartConceptTrigger{
      width:100%;
      min-height:52px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(185,255,55,.24);
      background:
        linear-gradient(135deg, rgba(185,255,55,.14), rgba(105,180,255,.08)),
        rgba(0,0,0,.28);
      color:#fff;
      text-align:left;
      cursor:pointer;
      box-shadow:inset 0 0 20px rgba(255,255,255,.04);
    }
    .deckStartConceptTrigger:hover,
    .deckStartConceptTrigger:focus-visible{
      border-color:rgba(185,255,55,.58);
      box-shadow:0 0 26px rgba(185,255,55,.16), inset 0 0 20px rgba(255,255,255,.05);
      outline:none;
    }
    .deckStartConceptTrigger::after{
      content:"詳細";
      flex:0 0 auto;
      padding:4px 8px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.08);
      color:rgba(255,255,255,.74);
      font-size:10px;
      font-weight:1000;
    }
    .deckStartConcept.isOpen .deckStartConceptTrigger::after{ content:"閉じる"; }
    .deckStartConceptTitle{
      display:block;
      font-size:20px;
      line-height:1.18;
      font-weight:1000;
      letter-spacing:0;
    }
    .deckStartConceptHint{
      display:block;
      margin-top:5px;
      color:rgba(220,255,155,.82);
      font-size:11px;
      font-weight:900;
    }
    .deckStartConceptDetails[hidden]{ display:none; }
    .deckStartConceptDetails{
      margin-top:12px;
      max-height:calc(100dvh - 330px);
      overflow:auto;
      padding-right:3px;
      animation:deckConceptReveal .22s ease both;
      scrollbar-width:thin;
    }
    .deckStartConceptText{
      color:rgba(255,255,255,.74);
      font-size:12px;
      line-height:1.55;
    }
    .deckStartConceptList{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:7px;
      margin-top:11px;
    }
    .deckStartConceptItem{
      min-height:38px;
      display:flex;
      align-items:center;
      gap:7px;
      padding:7px 8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.20);
      color:rgba(255,255,255,.86);
      font-size:11px;
      font-weight:900;
    }
    .deckStartConceptIcon{
      width:22px;
      height:22px;
      flex:0 0 auto;
      display:grid;
      place-items:center;
      border-radius:8px;
      border:1px solid rgba(255,255,255,.16);
      background:linear-gradient(135deg, rgba(105,180,255,.26), rgba(185,255,55,.13));
      color:#fff;
      font-size:12px;
      box-shadow:0 0 18px rgba(105,180,255,.14);
    }
    .deckStartLexiconBtn{
      width:100%;
      min-height:38px;
      margin-top:12px;
      border-radius:999px;
      border:1px solid rgba(185,255,55,.34);
      background:linear-gradient(90deg, rgba(185,255,55,.18), rgba(105,180,255,.12));
      color:#edffd1;
      font-size:12px;
      font-weight:1000;
      cursor:pointer;
      box-shadow:0 0 20px rgba(185,255,55,.10);
    }
    .deckStartLexicon[hidden]{ display:none; }
    .deckStartLexicon{
      position:absolute;
      inset:18px;
      z-index:20;
      display:grid;
      place-items:center;
      padding:18px;
      background:rgba(0,0,0,.54);
      backdrop-filter:blur(10px);
      animation:deckConceptReveal .18s ease both;
    }
    .deckStartLexiconPanel{
      width:min(760px, 100%);
      max-height:min(78vh, 640px);
      overflow:auto;
      border-radius:18px;
      border:1px solid rgba(255,255,255,.16);
      background:
        radial-gradient(520px 280px at 10% 0%, rgba(185,255,55,.13), transparent 62%),
        linear-gradient(135deg, rgba(20,28,38,.96), rgba(18,17,29,.96));
      box-shadow:0 24px 72px rgba(0,0,0,.45), inset 0 0 30px rgba(255,255,255,.035);
      padding:18px;
    }
    .deckStartLexiconHead{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:12px;
      margin-bottom:14px;
    }
    .deckStartLexiconHead b{display:block;font-size:20px;line-height:1.25;}
    .deckStartLexiconHead span{display:block;margin-top:4px;color:rgba(255,255,255,.62);font-size:12px;}
    .deckStartLexiconClose{
      min-width:70px;
      min-height:36px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.08);
      color:#fff;
      font-weight:1000;
      cursor:pointer;
    }
    .deckStartLexiconGrid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
    }
    .deckStartLexiconCard{
      min-height:92px;
      padding:11px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.12);
      background:
        radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--lex-c, #7dd3fc) 24%, transparent), transparent 44%),
        rgba(0,0,0,.20);
    }
    .deckStartLexiconCard b{
      display:flex;
      align-items:center;
      gap:8px;
      font-size:14px;
    }
    .deckStartLexiconCard i{
      width:26px;height:26px;
      display:grid;place-items:center;
      border-radius:999px;
      border:1px solid color-mix(in srgb, var(--lex-c, #7dd3fc) 62%, rgba(255,255,255,.18));
      background:color-mix(in srgb, var(--lex-c, #7dd3fc) 18%, rgba(0,0,0,.35));
      font-style:normal;
      box-shadow:0 0 18px color-mix(in srgb, var(--lex-c, #7dd3fc) 22%, transparent);
    }
    .deckStartLexiconCard span{
      display:block;
      margin-top:8px;
      color:rgba(255,255,255,.70);
      font-size:12px;
      line-height:1.5;
    }
    .deckStartAttributeOrbit{
      --orbit-size:230px;
      position:relative;
      width:min(var(--orbit-size), 100%);
      aspect-ratio:1;
      margin:14px auto 0;
      border-radius:999px;
      background:
        radial-gradient(circle at 50% 50%, rgba(185,255,55,.16), transparent 20%),
        radial-gradient(circle at 50% 50%, rgba(105,180,255,.14), transparent 42%),
        conic-gradient(from 0deg, rgba(255,107,107,.22), rgba(125,211,252,.22), rgba(250,204,21,.22), rgba(120,227,173,.22), rgba(184,192,204,.22), rgba(184,137,255,.22), rgba(255,107,107,.22));
      border:1px solid rgba(255,255,255,.14);
      box-shadow:inset 0 0 34px rgba(255,255,255,.05), 0 0 36px rgba(105,180,255,.10);
      overflow:hidden;
    }
    .deckStartAttributeOrbit::before,
    .deckStartAttributeOrbit::after{
      content:"";
      position:absolute;
      inset:18px;
      border-radius:999px;
      border:1px dashed rgba(255,255,255,.16);
      pointer-events:none;
    }
    .deckStartAttributeOrbit::after{
      inset:58px;
      border-style:solid;
      border-color:rgba(185,255,55,.16);
      box-shadow:0 0 24px rgba(185,255,55,.08);
    }
    .deckStartOrbitCore{
      position:absolute;
      inset:72px;
      z-index:2;
      display:grid;
      place-items:center;
      align-content:center;
      gap:4px;
      text-align:center;
      border-radius:999px;
      border:1px solid rgba(185,255,55,.30);
      background:radial-gradient(circle at 50% 32%, rgba(255,255,255,.13), rgba(0,0,0,.35) 58%, rgba(0,0,0,.55));
      box-shadow:0 0 30px rgba(185,255,55,.13), inset 0 0 20px rgba(255,255,255,.05);
    }
    .deckStartOrbitCore b{
      color:rgba(236,255,190,.98);
      font-size:13px;
      font-weight:1000;
      letter-spacing:.04em;
    }
    .deckStartOrbitCore span{
      width:74px;
      color:rgba(255,255,255,.66);
      font-size:9px;
      font-weight:900;
      line-height:1.28;
    }
    .deckStartOrbitRing{
      position:absolute;
      inset:0;
      animation:deckStartOrbitSpin 26s linear infinite;
    }
    .deckStartOrbitNode{
      position:absolute;
      left:50%;
      top:50%;
      width:62px;
      height:38px;
      margin:-19px 0 0 -31px;
      transform:rotate(calc(var(--i) * 36deg)) translateY(-94px) rotate(calc(var(--i) * -36deg));
    }
    .deckStartOrbitNode span{
      width:100%;
      height:100%;
      display:grid;
      grid-template-columns:24px 1fr;
      align-items:center;
      gap:5px;
      padding:5px 6px;
      border-radius:999px;
      border:1px solid color-mix(in srgb, var(--c), white 18%);
      background:
        radial-gradient(circle at 24% 28%, color-mix(in srgb, var(--c), white 20%), transparent 28%),
        linear-gradient(135deg, color-mix(in srgb, var(--c), transparent 70%), rgba(0,0,0,.42));
      box-shadow:0 0 18px color-mix(in srgb, var(--c), transparent 72%), inset 0 1px 0 rgba(255,255,255,.12);
      color:#fff;
      animation:deckStartOrbitCounter 26s linear infinite;
    }
    .deckStartOrbitNode b{
      display:grid;
      place-items:center;
      width:24px;
      height:24px;
      border-radius:999px;
      background:rgba(0,0,0,.34);
      font-size:12px;
      font-weight:1000;
      box-shadow:inset 0 0 10px rgba(255,255,255,.08);
    }
    .deckStartOrbitNode small{
      color:rgba(255,255,255,.84);
      font-size:9px;
      font-weight:950;
      line-height:1.1;
    }
    @keyframes deckStartOrbitSpin{
      to{ transform:rotate(360deg); }
    }
    @keyframes deckStartOrbitCounter{
      to{ transform:rotate(-360deg); }
    }
    .deckStartMatchup{
      margin-top:10px;
      padding:10px;
      border-radius:18px;
      border:1px solid rgba(255,255,255,.14);
      background:
        radial-gradient(circle at 20% 0%, rgba(185,255,55,.12), transparent 42%),
        radial-gradient(circle at 85% 18%, rgba(125,211,252,.12), transparent 46%),
        rgba(0,0,0,.22);
      box-shadow:inset 0 0 24px rgba(255,255,255,.04);
    }
    .deckStartMatchupHead{
      display:flex;
      justify-content:space-between;
      align-items:flex-end;
      gap:10px;
      margin-bottom:10px;
    }
    .deckStartMatchupHead b{
      color:#edffd1;
      font-size:13px;
      font-weight:1000;
    }
    .deckStartMatchupHead span{
      color:rgba(255,255,255,.62);
      font-size:10px;
      font-weight:850;
      text-align:right;
      line-height:1.35;
    }
    .deckStartMatchupMap{
      position:relative;
      width:min(190px, 100%);
      aspect-ratio:1;
      margin:0 auto 8px;
      border-radius:999px;
      background:
        radial-gradient(circle at 50% 50%, rgba(185,255,55,.13), transparent 22%),
        radial-gradient(circle at 50% 50%, rgba(255,255,255,.08), transparent 64%),
        rgba(255,255,255,.025);
      border:1px solid rgba(255,255,255,.12);
      overflow:hidden;
    }
    .deckStartMatchupMap::after{
      content:"";
      position:absolute;
      inset:28px;
      border-radius:999px;
      border:1px dashed rgba(255,255,255,.14);
      pointer-events:none;
      z-index:0;
    }
    .deckStartMatchupLines{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      filter:drop-shadow(0 0 6px rgba(125,211,252,.20));
      opacity:.92;
      z-index:1;
    }
    .deckStartMatchupLines path{
      fill:none;
      stroke-width:1.7;
      stroke-linecap:round;
      stroke-linejoin:round;
      vector-effect:non-scaling-stroke;
    }
    .deckStartMatchupLines .good{ stroke:rgba(128,255,170,.72); }
    .deckStartMatchupLines .bad{ stroke:rgba(255,105,125,.62); stroke-dasharray:3 3; }
    .deckStartMatchupCenter{
      position:absolute;
      left:50%;
      top:50%;
      width:88px;
      height:88px;
      transform:translate(-50%,-50%);
      display:grid;
      place-items:center;
      align-content:center;
      gap:3px;
      border-radius:999px;
      border:1px solid rgba(185,255,55,.34);
      background:radial-gradient(circle at 50% 30%, rgba(255,255,255,.16), rgba(0,0,0,.52) 68%);
      box-shadow:0 0 22px rgba(185,255,55,.16), inset 0 0 18px rgba(255,255,255,.05);
      text-align:center;
      z-index:3;
    }
    .deckStartMatchupCenter b{
      color:#edffd1;
      font-size:13px;
      font-weight:1000;
      line-height:1.1;
    }
    .deckStartMatchupCenter small{
      color:rgba(255,255,255,.62);
      font-size:9px;
      font-weight:850;
      line-height:1.15;
    }
    .deckStartAttrOrb{
      position:absolute;
      left:var(--x);
      top:var(--y);
      width:42px;
      height:42px;
      transform:translate(-50%,-50%);
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid color-mix(in srgb, var(--orb-c), white 22%);
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.70), transparent 17%),
        radial-gradient(circle at 62% 70%, color-mix(in srgb, var(--orb-c), white 10%), color-mix(in srgb, var(--orb-c), black 42%) 68%);
      color:#fff;
      font-size:16px;
      font-weight:1000;
      box-shadow:0 0 18px color-mix(in srgb, var(--orb-c), transparent 48%), inset 0 -8px 18px rgba(0,0,0,.24);
      z-index:4;
    }
    .deckStartAttrOrb small{
      position:absolute;
      top:30px;
      left:50%;
      transform:translateX(-50%);
      padding:2px 6px;
      border-radius:999px;
      background:rgba(0,0,0,.52);
      border:1px solid rgba(255,255,255,.12);
      color:rgba(255,255,255,.82);
      font-size:8px;
      line-height:1;
      white-space:nowrap;
    }
    .deckStartMatchupLegend{
      display:flex;
      justify-content:center;
      gap:12px;
      color:rgba(255,255,255,.68);
      font-size:10px;
      font-weight:850;
      margin-bottom:10px;
    }
    .deckStartMatchupLegend span{
      display:inline-flex;
      align-items:center;
      gap:5px;
    }
    .deckStartMatchupLegend i{
      width:22px;
      height:2px;
      border-radius:999px;
      display:inline-block;
    }
    .deckStartMatchupLegend .good{ background:#80ffaa; box-shadow:0 0 10px rgba(128,255,170,.45); }
    .deckStartMatchupLegend .bad{ background:#ff697d; box-shadow:0 0 10px rgba(255,105,125,.40); }
    .deckStartMatchupRows{
      display:grid;
      grid-template-columns:1fr;
      gap:7px;
      max-height:126px;
      overflow:auto;
      padding-right:3px;
    }
    .deckStartMatchupRow{
      display:grid;
      grid-template-columns:32px 1fr;
      gap:8px;
      align-items:center;
      min-height:46px;
      padding:7px 8px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.10);
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--row-c), transparent 84%), rgba(255,255,255,.025));
    }
    .deckStartMatchupRow > b{
      width:30px;
      height:30px;
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid color-mix(in srgb, var(--row-c), white 24%);
      background:color-mix(in srgb, var(--row-c), black 45%);
      box-shadow:0 0 14px color-mix(in srgb, var(--row-c), transparent 56%);
    }
    .deckStartMatchupRow strong{
      display:block;
      color:#fff;
      font-size:11px;
      line-height:1.25;
    }
    .deckStartMatchupRow span{
      display:block;
      margin-top:3px;
      color:rgba(255,255,255,.66);
      font-size:10px;
      line-height:1.35;
    }
    .deckStartHero{
      position:relative;
      display:grid;
      place-items:center;
      min-height:0;
    }
    .deckStartHeroLines{
      position:absolute; inset:0;
      background:
        radial-gradient(circle at 56% 46%, rgba(180,120,255,.28), transparent 26%),
        conic-gradient(from 20deg at 58% 46%, transparent 0 18%, rgba(180,80,255,.18) 20%, transparent 24% 100%);
      filter:blur(.2px);
      opacity:.9;
      pointer-events:none;
    }
    .deckStartUnit{
      position:relative;
      width:min(350px, 40vw);
      height:min(500px, 58vh);
      min-width:245px;
      min-height:340px;
      background:
        radial-gradient(circle at 50% 74%, rgba(185,255,55,.12), transparent 36%),
        var(--deck-start-mascot, url("./assets/home/home-mascot-base-20260911.png")) center / contain no-repeat;
      filter:drop-shadow(0 24px 58px rgba(0,0,0,.58)) drop-shadow(0 0 34px rgba(170,120,255,.26));
      animation:startCardFloat 4.2s ease-in-out infinite;
      z-index:3;
    }
    .deckStartUnit::before{
      content:"";
      position:absolute;
      inset:7% -10% 4%;
      border-radius:999px;
      background:
        radial-gradient(circle at 50% 56%, rgba(185,255,55,.18), transparent 42%),
        radial-gradient(circle at 48% 38%, rgba(170,120,255,.20), transparent 46%);
      filter:blur(22px);
      opacity:.78;
      z-index:-1;
    }
    .deckStartUnit::after{
      content:"";
      position:absolute;
      left:50%;
      bottom:0;
      width:78%;
      height:18%;
      transform:translateX(-50%);
      border-radius:999px;
      background:radial-gradient(closest-side, rgba(185,255,55,.22), rgba(80,190,255,.10), transparent 72%);
      filter:blur(12px);
      opacity:.82;
      z-index:-1;
    }
    .deckStartWing,
    .deckStartArm{ display:none; }
    .deckStartTitleBlock{
      position:absolute;
      left:20px; bottom:86px;
      z-index:4;
      max-width:min(420px, 56%);
      pointer-events:none;
    }
    .deckStartTitle{
      margin:0;
      font-size:clamp(38px, 6vw, 78px);
      line-height:.9;
      font-weight:1000;
      letter-spacing:0;
      text-shadow:0 8px 32px rgba(0,0,0,.72);
    }
    .deckStartSub{
      margin:12px 0 0;
      color:rgba(255,255,255,.72);
      font-size:14px;
      line-height:1.55;
      max-width:360px;
    }
    .deckStartDuel{
      position:relative;
      z-index:4;
      justify-self:end;
      min-width:min(340px, 76vw);
      min-height:52px;
      border:1px solid rgba(210,255,60,.56);
      border-radius:12px;
      background:
        linear-gradient(90deg, rgba(190,255,30,.98), rgba(180,255,80,.70)),
        repeating-linear-gradient(90deg, rgba(255,255,255,.18) 0 9px, transparent 9px 18px);
      color:#172107;
      font-size:22px;
      font-weight:1000;
      letter-spacing:.18em;
      cursor:pointer;
      box-shadow:0 0 36px rgba(190,255,55,.30), inset 0 0 24px rgba(255,255,255,.20);
      transition:transform .10s ease, filter .12s ease, box-shadow .12s ease;
    }
    .deckStartDuel:hover{
      transform:translateY(-2px);
      filter:brightness(1.08);
      box-shadow:0 0 44px rgba(190,255,55,.42), inset 0 0 26px rgba(255,255,255,.26);
    }
    .deckStartDuel:active{ transform:translateY(0) scale(.99); }
    .tcgRouteOverlay{
      position:fixed;
      inset:0;
      z-index:100050;
      display:grid;
      place-items:center;
      padding:22px;
      box-sizing:border-box;
      color:#fff;
      background:
        radial-gradient(900px 520px at 50% 44%, rgba(105,180,255,.18), transparent 62%),
        radial-gradient(760px 460px at 72% 36%, rgba(185,255,55,.14), transparent 58%),
        linear-gradient(120deg, rgba(3,6,12,.92), rgba(8,11,20,.96));
      opacity:0;
      pointer-events:none;
      overflow:hidden;
      transition:opacity .18s ease;
    }
    .tcgRouteOverlay.run{ opacity:1; }
    .tcgRouteOverlay::before,
    .tcgRouteOverlay::after{
      content:"";
      position:absolute;
      inset:-18%;
      pointer-events:none;
    }
    .tcgRouteOverlay::before{
      background:
        linear-gradient(115deg, transparent 0 42%, rgba(255,255,255,.22) 46%, transparent 51% 100%),
        repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 30px);
      transform:translateX(-28%) skewX(-10deg);
      animation:tcgRouteScan 1.18s cubic-bezier(.2,.9,.2,1) forwards;
    }
    .tcgRouteOverlay::after{
      background:radial-gradient(circle at 50% 50%, transparent 0 18%, rgba(185,255,55,.16) 19%, transparent 20% 100%);
      transform:scale(.55);
      opacity:.75;
      animation:tcgRouteRing 1.18s ease-out forwards;
    }
    .tcgRouteCard{
      position:relative;
      z-index:2;
      width:min(620px, 92vw);
      min-height:220px;
      display:grid;
      place-items:center;
      gap:14px;
      text-align:center;
      border:1px solid rgba(255,255,255,.18);
      border-radius:22px;
      background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.26));
      box-shadow:0 30px 90px rgba(0,0,0,.62), inset 0 0 60px rgba(105,180,255,.08);
      transform:translateY(12px) scale(.98);
      opacity:0;
      animation:tcgRouteCardIn .42s ease forwards .06s;
      overflow:hidden;
    }
    .tcgRouteCard::before{
      content:"";
      position:absolute;
      left:-20%;
      right:-20%;
      top:52%;
      height:2px;
      background:linear-gradient(90deg, transparent, rgba(185,255,55,.82), rgba(105,180,255,.72), transparent);
      box-shadow:0 0 22px rgba(185,255,55,.46);
      animation:tcgRouteLine 1.12s ease-in-out infinite;
    }
    .tcgRouteKicker{
      font-size:12px;
      font-weight:1000;
      letter-spacing:.22em;
      color:rgba(185,255,55,.92);
    }
    .tcgRouteTitle{
      font-size:clamp(32px, 6vw, 74px);
      line-height:.92;
      font-weight:1000;
      letter-spacing:.08em;
      text-shadow:0 8px 32px rgba(0,0,0,.64);
    }
    .tcgRouteSub{
      max-width:460px;
      color:rgba(255,255,255,.72);
      font-size:13px;
      line-height:1.55;
    }
    .tcgRouteSteps{
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:8px;
      width:min(460px, 86vw);
      margin-top:6px;
    }
    .tcgRouteStep{
      min-height:6px;
      border-radius:999px;
      background:rgba(255,255,255,.10);
      overflow:hidden;
    }
    .tcgRouteStep::before{
      content:"";
      display:block;
      height:100%;
      width:0;
      border-radius:inherit;
      background:linear-gradient(90deg, rgba(105,180,255,.95), rgba(185,255,55,.95));
      box-shadow:0 0 14px rgba(185,255,55,.46);
      animation:tcgRouteStep 1.12s ease forwards;
    }
    .tcgRouteStep:nth-child(2)::before{ animation-delay:.18s; }
    .tcgRouteStep:nth-child(3)::before{ animation-delay:.36s; }
    @keyframes tcgRouteScan{
      0%{ transform:translateX(-34%) skewX(-10deg); opacity:0; }
      18%{ opacity:1; }
      100%{ transform:translateX(34%) skewX(-10deg); opacity:0; }
    }
    @keyframes tcgRouteRing{
      0%{ transform:scale(.48); opacity:.85; }
      100%{ transform:scale(1.24); opacity:0; }
    }
    @keyframes tcgRouteCardIn{
      to{ transform:translateY(0) scale(1); opacity:1; }
    }
    @keyframes tcgRouteLine{
      0%,100%{ transform:translateX(-8%); opacity:.55; }
      50%{ transform:translateX(8%); opacity:1; }
    }
    @keyframes tcgRouteStep{
      0%{ width:0; }
      100%{ width:100%; }
    }
    .tcgBattleLaunch .tcgRouteCard{
      min-height:280px;
      border-color:rgba(185,255,55,.26);
      box-shadow:0 30px 100px rgba(0,0,0,.68), 0 0 42px rgba(185,255,55,.16), inset 0 0 70px rgba(105,180,255,.10);
    }
    .tcgBattleVs{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:14px;
      width:min(500px, 86vw);
      margin:4px auto 0;
    }
    .tcgBattleSeat{
      flex:1;
      min-width:0;
      padding:10px 12px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(0,0,0,.22);
      font-weight:950;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .tcgBattleVsMark{
      font-size:26px;
      font-weight:1000;
      color:rgba(185,255,55,.95);
      text-shadow:0 0 22px rgba(185,255,55,.42);
    }
    @media (prefers-reduced-motion: reduce){
      .tcgRouteOverlay,
      .tcgRouteOverlay *,
      .deckStartZoomCard,
      .deckStartZoomCard *{
        animation:none !important;
        transition:none !important;
      }
    }
    @media (max-width: 840px){
      .deckStart{ padding:12px; }
      .deckStartShell{
        height:auto;
        min-height:calc(100dvh - 24px);
        max-height:none;
        grid-template-columns:1fr;
        grid-template-rows:auto 1fr;
        gap:12px;
      }
      .deckStartLeft{ order:2; }
      .deckStartStage{ order:1; min-height:390px; padding:14px; overflow:visible; }
      .deckStartMenu{ grid-template-columns:repeat(3, minmax(0,1fr)); }
      .deckHomeBtn{ min-height:86px; font-size:12px; padding:10px; }
      .deckHomeIcon{ width:30px; height:30px; font-size:15px; }
      .deckHomeLabel{ font-size:14px; }
      .deckHomeSub{ display:none; }
      .deckStartTopic, .deckStartPass{ display:none; }
      .deckStartTitleBlock{ left:14px; bottom:78px; max-width:70%; }
      .deckStartConcept{
        position:relative;
        top:auto;
        right:auto;
        width:auto;
        max-height:none;
        overflow:visible;
        margin-top:10px;
        padding:12px;
      }
      .deckStartConceptDetails{ max-height:360px; }
      .deckStartMatchupMap{ width:min(210px, 100%); }
      .deckStartMatchupRows{ max-height:150px; }
      .deckStartConceptTitle{ font-size:16px; }
      .deckStartConceptText{ font-size:11px; }
      .deckStartConceptList{ grid-template-columns:1fr 1fr; gap:6px; }
      .deckStartLexicon{ position:fixed; inset:0; padding:12px; }
      .deckStartLexiconGrid{ grid-template-columns:1fr 1fr; }
      .deckStartAttributeGrid{ grid-template-columns:repeat(3, minmax(0,1fr)); }
      .deckStartUnit{ width:min(260px, 54vw); height:330px; min-height:300px; }
      .deckStartDuel{ justify-self:stretch; min-width:0; }
    }
    @media (max-width: 520px){
      .deckStart{
        display:block;
        padding:10px;
        overflow:auto;
      }
      .deckStartShell{
        width:920px;
        max-width:none;
        height:auto;
        min-height:620px;
        grid-template-columns:300px 1fr;
        grid-template-rows:1fr;
        gap:14px;
        align-items:stretch;
        zoom:.43;
        margin:0 auto;
      }
      .deckStartLeft{
        order:0;
        padding:14px;
        gap:12px;
      }
      .deckStartStage{
        order:0;
        min-height:520px;
        padding:18px;
      }
      .deckStartProfile{ grid-template-columns:64px minmax(0,1fr) 34px; }
      .deckStartAvatar{ width:64px; height:64px; border-radius:15px; }
      .deckStartPlayerName{ font-size:18px; }
      .deckStartMenu{ grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
      .deckHomeBtn{ min-height:100px; font-size:13px; padding:12px; }
      .deckHomeIcon{ width:34px; height:34px; font-size:14px; }
      .deckHomeLabel{ font-size:16px; }
      .deckHomeSub{ display:block; }
      .deckStartTopic,
      .deckStartPass{ display:grid; }
      .deckStartTopic{ min-height:126px; }
      .deckStartTopicTitle{ font-size:22px; }
      .deckStartTopbar{ justify-content:flex-end; }
      .deckStartChip{ min-height:38px; padding:8px 13px; font-size:13px; }
      .deckStartConcept{
        position:absolute;
        top:72px;
        right:18px;
        width:330px;
        max-height:500px;
        overflow:auto;
        margin-top:0;
        padding:15px;
      }
      .deckStartConceptDetails{ max-height:300px; }
      .deckStartMatchupMap{ width:176px; }
      .deckStartMatchupRows{ max-height:106px; }
      .deckStartConceptTitle{ font-size:19px; }
      .deckStartConceptText{ font-size:12px; }
      .deckStartConceptList{ grid-template-columns:1fr 1fr; gap:7px; }
      .deckStartLexiconGrid{ grid-template-columns:1fr 1fr; }
      .deckStartConceptItem{ min-height:38px; }
      .deckStartAttributeGrid{ grid-template-columns:repeat(3, minmax(0,1fr)); }
      .deckStartTitle{ font-size:72px; }
      .deckStartSub{ font-size:14px; max-width:520px; }
      .deckStartTitleBlock{ left:18px; bottom:94px; max-width:48%; }
      .deckStartUnit{ width:300px; height:390px; min-height:360px; }
      .deckStartDuel{
        justify-self:end;
        min-width:360px;
      }
    }
    @media (max-width: 390px){
      .deckStartShell{ zoom:.40; }
    }
    @media (min-width: 430px) and (max-width: 520px){
      .deckStartShell{ zoom:.47; }
    }
    /* 20260911: dedicated mobile home layout. Keep the PC composition intact, but stop
       scaling the wide desktop panel into phone screens. */
    @media (max-width: 720px){
      .deckStart{
        display:block;
        min-height:100dvh;
        padding:calc(10px + env(safe-area-inset-top)) 10px calc(18px + env(safe-area-inset-bottom));
        overflow-x:hidden;
        overflow-y:auto;
        overscroll-behavior:contain;
      }
      .deckStartShell{
        width:min(100%, 430px);
        max-width:430px;
        height:auto;
        min-height:0;
        max-height:none;
        display:grid;
        grid-template-columns:1fr;
        grid-template-rows:auto auto;
        gap:12px;
        align-items:start;
        margin:0 auto;
        zoom:1;
      }
      .deckStartPanel{
        border-radius:20px;
        overflow:hidden;
      }
      .deckStartLeft{
        order:1;
        padding:10px;
        gap:10px;
        max-height:none;
        overflow:visible;
      }
      .deckStartProfile{
        position:relative;
        top:auto;
        grid-template-columns:54px minmax(0, 1fr) 34px;
        gap:10px;
        padding:9px;
        border-radius:18px;
      }
      .deckStartAvatar{
        width:54px;
        height:54px;
        border-radius:15px;
      }
      .deckStartPlayerName{
        font-size:16px;
        line-height:1.15;
      }
      .deckStartPlayerSub{
        font-size:10px;
      }
      .deckStartTopic{
        display:grid;
        min-height:82px;
        padding:10px;
        border-radius:17px;
      }
      .deckStartTopicTitle{
        left:12px;
        right:12px;
        bottom:12px;
        font-size:18px;
      }
      .deckStartPass{
        display:grid;
        grid-template-columns:1fr auto;
        padding:10px;
      }
      .deckStartUtility{
        padding:10px;
        border-radius:17px;
      }
      .deckStartUtilityGrid{
        grid-template-columns:repeat(2, minmax(0, 1fr));
      }
      .deckStartUtilityBtn{
        min-height:38px;
        justify-content:flex-start;
        padding:8px 10px;
        font-size:12px;
      }
      .deckStartMenu{
        grid-template-columns:repeat(2, minmax(0, 1fr));
        gap:9px;
      }
      .deckHomeBtn{
        min-height:94px;
        padding:11px;
        border-radius:17px;
      }
      .deckHomeIcon{
        width:32px;
        height:32px;
        font-size:13px;
      }
      .deckHomeLabel{
        font-size:16px;
      }
      .deckHomeSub{
        display:block;
        font-size:10px;
      }
      .deckStartStage{
        order:2;
        min-height:0;
        padding:12px;
        display:grid;
        grid-template-rows:auto auto auto auto;
        gap:10px;
        overflow:visible;
      }
      .deckStartTopbar{
        order:1;
        justify-content:flex-start;
        gap:7px;
      }
      .deckStartPostBtn{
        min-height:34px;
        padding:6px 10px;
      }
      .deckStartPostBtn::before{
        width:18px;
        height:18px;
        border-radius:6px;
      }
      .deckStartPostBtn span{
        font-size:10px;
      }
      .deckStartPostBtn b{
        font-size:12px;
      }
      .deckStartChip{
        min-height:34px;
        padding:6px 10px;
        font-size:12px;
      }
      .deckStartConcept{
        order:2;
        position:relative;
        top:auto;
        right:auto;
        width:100%;
        max-height:none;
        overflow:visible;
        margin:0;
        padding:11px;
        border-radius:18px;
      }
      .deckStartConceptBrand{
        margin-bottom:8px;
      }
      .deckStartTtcg{
        min-height:30px;
        padding:3px 10px;
        font-size:15px;
      }
      .deckStartConceptTrigger{
        min-height:48px;
        padding:9px 10px;
      }
      .deckStartConceptTitle{
        font-size:16px;
        line-height:1.22;
      }
      .deckStartConceptHint{
        font-size:10px;
      }
      .deckStartConceptDetails{
        max-height:52dvh;
        overflow:auto;
      }
      .deckStartConceptList{
        grid-template-columns:1fr 1fr;
        gap:6px;
      }
      .deckStartConceptItem{
        min-height:36px;
        padding:6px 7px;
        font-size:10px;
      }
      .deckStartAttributeOrbit{
        --orbit-size:210px;
      }
      .deckStartMatchup{
        padding:9px;
      }
      .deckStartMatchupHead{
        display:grid;
        gap:4px;
      }
      .deckStartMatchupHead span{
        text-align:left;
      }
      .deckStartMatchupMap{
        width:min(190px, 88vw);
      }
      .deckStartMatchupRows{
        max-height:150px;
      }
      .deckStartHero{
        order:3;
        min-height:300px;
        border-radius:18px;
        overflow:hidden;
        background:
          radial-gradient(circle at 55% 34%, rgba(180,120,255,.18), transparent 42%),
          linear-gradient(180deg, rgba(255,255,255,.025), rgba(0,0,0,.14));
      }
      .deckStartHeroLines{
        opacity:.72;
      }
      .deckStartUnit{
        position:absolute;
        width:190px;
        min-width:190px;
        height:240px;
        min-height:240px;
        right:12px;
        top:18px;
        opacity:.92;
        transform:scale(.95);
      }
      .deckStartTitleBlock{
        left:13px;
        right:13px;
        bottom:18px;
        max-width:calc(100% - 26px);
      }
      .deckStartTitle{
        font-size:46px;
      }
      .deckStartSub{
        max-width:250px;
        margin-top:8px;
        font-size:12px;
        line-height:1.45;
      }
      .deckStartDuel{
        order:4;
        justify-self:stretch;
        min-width:0;
        min-height:56px;
        border-radius:16px;
        font-size:20px;
      }
      .deckStartLexicon{
        position:fixed;
        inset:0;
        padding:10px;
      }
      .deckStartLexiconPanel{
        max-height:calc(100dvh - 20px);
        padding:14px;
      }
      .deckStartLexiconGrid,
      .deckStartAttributeGrid{
        grid-template-columns:1fr;
      }
    }
    @media (max-width: 380px){
      .deckStartShell{
        max-width:360px;
      }
      .deckStartMenu{
        gap:8px;
      }
      .deckHomeBtn{
        min-height:84px;
      }
      .deckStartUtilityGrid{
        grid-template-columns:1fr;
      }
      .deckStartHero{
        min-height:270px;
      }
      .deckStartUnit{
        width:168px;
        min-width:168px;
        height:216px;
        min-height:216px;
      }
      .deckStartTitle{
        font-size:40px;
      }
      .deckStartSub{
        max-width:220px;
      }
    }
    @keyframes deckConceptReveal{
      from{ opacity:0; transform:translateY(-5px); }
      to{ opacity:1; transform:translateY(0); }
    }
    @keyframes startCardFloat{
      0%,100%{ transform:translateY(0); }
      50%{ transform:translateY(-10px); }
    }
    @keyframes startRing{
      0%,100%{ transform:scale(.96); opacity:.6; }
      50%{ transform:scale(1.04); opacity:1; }
    }
  `;
  document.head.appendChild(css);
}

const HOME_MASCOT_IMAGES = [
  "./assets/home/home-mascot-base-20260911.png",
  "./assets/home/home-mascot-leader-20260911.png",
  "./assets/home/home-mascot-metabo-20260911.png",
  "./assets/home/home-mascot-tokiori-20260911.png",
  "./assets/home/home-mascot-mask-20260911.png",
];

function pickHomeMascotImage() {
  return HOME_MASCOT_IMAGES[Math.floor(Math.random() * HOME_MASCOT_IMAGES.length)] || HOME_MASCOT_IMAGES[0];
}

function randomizeHomeMascot() {
  const unit = deckStartEl?.querySelector?.(".deckStartUnit");
  if (!unit) return;
  unit.style.setProperty("--deck-start-mascot", `url("${pickHomeMascotImage()}")`);
}

function ensureDeckStartElement() {
  ensureDeckStartStyle();
  deckStartEl = $("deckStart");
  const homePlayerName = (() => {
    try {
      return localStorage.getItem(NAME_KEY) || localStorage.getItem("tcg_player_name_v20260202_30") || "PLAYER";
    } catch {
      return "PLAYER";
    }
  })();

  const homeHtml = `
    <div class="deckStartShell">
      <section class="deckStartPanel deckStartLeft" aria-label="メニュー">
        <div class="deckStartProfile" data-home-action="login" role="button" tabindex="0">
          <div class="deckStartAvatar" aria-hidden="true"></div>
          <div>
            <div class="deckStartPlayerName">ログイン / アカウント</div>
            <div class="deckStartPlayerSub">${esc(homePlayerName)} / PLAYER DATA</div>
          </div>
          <div class="deckStartArrow">›</div>
        </div>

        <div class="deckStartPass" data-home-action="deck" role="button" tabindex="0">
          <div>
            <b>DECK STATUS</b><br />
            <span>30枚でルーム作成・参加が有効</span>
          </div>
          <div class="deckStartArrow">30</div>
        </div>

        <div class="deckStartMenu">
          <button class="deckHomeBtn" type="button" data-home-action="deck">
            <span class="deckHomeIcon">D</span><span class="deckHomeLabel">デッキ</span><span class="deckHomeSub">BUILD</span>
          </button>
          <button class="deckHomeBtn" type="button" data-home-action="user">
            <span class="deckHomeIcon">U</span><span class="deckHomeLabel">ユーザー</span><span class="deckHomeSub">PROFILE</span>
          </button>
          <button class="deckHomeBtn" type="button" data-home-action="gacha">
            <span class="deckHomeIcon">G</span><span class="deckHomeLabel">ガチャ</span><span class="deckHomeSub">SUMMON</span>
          </button>
          <button class="deckHomeBtn" type="button" data-home-action="arcade">
            <span class="deckHomeIcon">A</span><span class="deckHomeLabel">アーケード</span><span class="deckHomeSub">SOLO</span>
          </button>
          <button class="deckHomeBtn" type="button" data-home-action="creator">
            <span class="deckHomeIcon">C</span><span class="deckHomeLabel">工房</span><span class="deckHomeSub">CREATE</span>
          </button>
          <button class="deckHomeBtn" type="button" data-home-action="settings">
            <span class="deckHomeIcon">L</span><span class="deckHomeLabel">デッキ一覧</span><span class="deckHomeSub">LOAD</span>
          </button>
        </div>
      </section>

      <section class="deckStartPanel deckStartStage" aria-label="メイン">
        <div class="deckStartTopbar">
          <button class="deckStartPostBtn" type="button" data-post-open title="運営ポスト">
            <span>POST</span><b>ポスト</b>
          </button>
          <div class="deckStartToolsWrap" data-start-tools>
            <button class="deckStartToolsBtn" type="button" data-start-tools-toggle aria-expanded="false" aria-controls="deckStartToolsPanel" title="便利機能">
              <span>TOOLS</span><b>ツール</b>
            </button>
            <div class="deckStartToolsPanel" id="deckStartToolsPanel" data-start-tools-panel hidden>
              <button class="deckStartToolItem" type="button" data-home-action="tier" data-utility-icon="T">ティア表</button>
              <button class="deckStartToolItem" type="button" data-home-action="carddex" data-utility-icon="C">カード図鑑</button>
              <button class="deckStartToolItem" type="button" data-home-action="dice" data-utility-icon="D">ダイス</button>
              <button class="deckStartToolItem" type="button" data-home-action="status" data-utility-icon="S">状態異常</button>
              <button class="deckStartToolItem" type="button" data-home-action="changelog" data-utility-icon="N">更新履歴</button>
            </div>
          </div>
          <span class="deckStartChip">DECK 30</span>
          <span class="deckStartChip">PLAYER ${esc(playerId ? playerId.slice(0, 6) : "------")}</span>
        </div>

        <aside class="deckStartConcept" aria-label="ゲーム概要">
          <div class="deckStartConceptBrand">
            <span class="deckStartTtcg">TTCG</span>
            <span class="deckStartTtcgSub">TRPG x TCG</span>
          </div>
          <button class="deckStartConceptTrigger" type="button" data-concept-toggle aria-expanded="false" aria-controls="deckStartConceptDetails">
            <span>
              <span class="deckStartConceptTitle">脳死でカードゲーム、してませんか。</span>
              <span class="deckStartConceptHint">気になったらクリック</span>
            </span>
          </button>
          <div class="deckStartConceptDetails" id="deckStartConceptDetails" data-concept-details hidden>
            <div class="deckStartConceptText">
              TTCGは、デッキ構築に盤面移動・射程・技判定を重ねた戦術カードバトル。
              引き運だけで終わらせず、配置と属性の読み合いで勝ち筋を作るゲームです。
            </div>
            <div class="deckStartConceptList" aria-hidden="true">
              <div class="deckStartConceptItem"><span class="deckStartConceptIcon">盤</span><span>フィールドで戦う</span></div>
              <div class="deckStartConceptItem"><span class="deckStartConceptIcon">育</span><span>YOUカード育成</span></div>
              <div class="deckStartConceptItem"><span class="deckStartConceptIcon">技</span><span>射程と技選択</span></div>
              <div class="deckStartConceptItem"><span class="deckStartConceptIcon">属</span><span>属性の強弱を読む</span></div>
            </div>
            <div class="deckStartAttributeOrbit" aria-label="属性ごとの特徴">
              <div class="deckStartOrbitCore">
                <b>属性戦略</b>
                <span>強みと弱みを読む</span>
              </div>
              <div class="deckStartOrbitRing" aria-hidden="true">
                <div class="deckStartOrbitNode" style="--i:0;--c:#ff6b6b;"><span><b>火</b><small>火力<br>突破</small></span></div>
                <div class="deckStartOrbitNode" style="--i:1;--c:#7dd3fc;"><span><b>水</b><small>耐久<br>回復</small></span></div>
                <div class="deckStartOrbitNode" style="--i:2;--c:#facc15;"><span><b>雷</b><small>展開<br>SP圧</small></span></div>
                <div class="deckStartOrbitNode" style="--i:3;--c:#78e3ad;"><span><b>草</b><small>回復<br>安定</small></span></div>
                <div class="deckStartOrbitNode" style="--i:4;--c:#9de7c5;"><span><b>風</b><small>移動<br>奇襲</small></span></div>
                <div class="deckStartOrbitNode" style="--i:5;--c:#b8c0cc;"><span><b>鋼</b><small>耐久<br>制圧</small></span></div>
                <div class="deckStartOrbitNode" style="--i:6;--c:#ffe29b;"><span><b>光</b><small>支援<br>安定</small></span></div>
                <div class="deckStartOrbitNode" style="--i:7;--c:#b889ff;"><span><b>闇</b><small>妨害<br>リスク</small></span></div>
                <div class="deckStartOrbitNode" style="--i:8;--c:#f0abfc;"><span><b>幻</b><small>変則<br>干渉</small></span></div>
                <div class="deckStartOrbitNode" style="--i:9;--c:#c084fc;"><span><b>呪</b><small>SP<br>呪圧</small></span></div>
              </div>
            </div>
            <section class="deckStartMatchup" aria-label="属性ごとの有利不利">
              <div class="deckStartMatchupHead">
                <b>属性相性はデッキ傾向</b>
                <span>固定弱点ではなく、HP/SP/技で押しやすさが変わる</span>
              </div>
              <div class="deckStartMatchupMap" aria-hidden="true">
                <svg class="deckStartMatchupLines" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <marker id="deckStartArrowGood" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="rgba(128,255,170,.86)"></path>
                    </marker>
                    <marker id="deckStartArrowBad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M0 0 L8 4 L0 8 Z" fill="rgba(255,105,125,.82)"></path>
                    </marker>
                  </defs>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 10 C35 18 20 34 11 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 10 C68 18 84 34 89 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M23 24 C30 16 40 11 50 10"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M23 24 C34 45 27 62 23 76"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M78 24 C62 21 42 22 23 24"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M78 24 C65 34 56 42 50 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M11 50 C28 38 55 27 78 24"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M11 50 C14 35 18 27 23 24"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M89 50 C72 58 45 68 23 76"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M89 50 C87 62 83 71 78 76"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M23 76 C43 62 61 44 78 24"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M23 76 C32 86 41 91 50 90"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M78 76 C68 86 59 91 50 90"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M78 76 C68 63 58 54 50 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 90 C50 62 50 35 50 10"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 90 C34 76 20 62 11 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 50 C36 48 23 49 11 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 50 C40 62 31 71 23 76"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M48 12 C39 15 31 19 23 24"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M52 12 C55 36 53 64 50 90"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M24 26 C45 23 63 23 78 24"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M76 28 C54 35 31 44 11 50"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M13 48 C25 32 37 18 50 10"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M87 48 C80 37 67 21 50 10"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M25 74 C22 56 22 38 23 24"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M76 74 C66 64 58 56 50 50"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M48 88 C39 80 28 63 11 50"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 62 C58 48 67 34 78 24"></path>
                  <path class="good" marker-end="url(#deckStartArrowGood)" d="M50 62 C47 46 49 28 50 10"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M11 50 C25 58 37 62 50 62"></path>
                  <path class="bad" marker-end="url(#deckStartArrowBad)" d="M78 76 C68 72 58 67 50 62"></path>
                </svg>
                <div class="deckStartMatchupCenter"><b>読み合い</b><small>強みで押す<br>弱みを補う</small></div>
                <span class="deckStartAttrOrb" style="--x:50%;--y:10%;--orb-c:#ff6b6b;">火<small>攻撃</small></span>
                <span class="deckStartAttrOrb" style="--x:23%;--y:24%;--orb-c:#7dd3fc;">水<small>耐久</small></span>
                <span class="deckStartAttrOrb" style="--x:78%;--y:24%;--orb-c:#facc15;">雷<small>SP</small></span>
                <span class="deckStartAttrOrb" style="--x:11%;--y:50%;--orb-c:#78e3ad;">草<small>回復</small></span>
                <span class="deckStartAttrOrb" style="--x:89%;--y:50%;--orb-c:#9de7c5;">風<small>移動</small></span>
                <span class="deckStartAttrOrb" style="--x:23%;--y:76%;--orb-c:#b8c0cc;">鋼<small>制圧</small></span>
                <span class="deckStartAttrOrb" style="--x:78%;--y:76%;--orb-c:#ffe29b;">光<small>支援</small></span>
                <span class="deckStartAttrOrb" style="--x:50%;--y:90%;--orb-c:#b889ff;">闇<small>妨害</small></span>
                <span class="deckStartAttrOrb" style="--x:50%;--y:50%;--orb-c:#f0abfc;">幻<small>変則</small></span>
                <span class="deckStartAttrOrb" style="--x:50%;--y:64%;--orb-c:#c084fc;">呪<small>SP</small></span>
              </div>
              <div class="deckStartMatchupLegend" aria-hidden="true">
                <span><i class="good"></i>押しやすい</span>
                <span><i class="bad"></i>苦手になりやすい</span>
              </div>
              <div class="deckStartMatchupRows">
                <div class="deckStartMatchupRow" style="--row-c:#ff6b6b"><b>火</b><div><strong>火力が高く安定。草・風の低体力を押しやすい。</strong><span>水や闇のSP攻撃には短期決着か支援が欲しい。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#7dd3fc"><b>水</b><div><strong>耐久と回復で火力デッキを受けやすい。</strong><span>雷のSP圧、草の粘りにはテンポを奪われやすい。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#facc15"><b>雷</b><div><strong>展開とSP圧で水・幻に先手を取りやすい。</strong><span>鋼の耐久、草の回復で押し返されることがある。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#78e3ad"><b>草</b><div><strong>回復と安定で雷・水の消耗戦に強い。</strong><span>火の突破力、闇の妨害には守りが崩されやすい。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#9de7c5"><b>風</b><div><strong>移動と奇襲で鋼・光の予定をずらす。</strong><span>火の高火力、雷のテンポには捕まりやすい。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#b8c0cc"><b>鋼</b><div><strong>耐久と制圧で雷・闇の荒らしを受け止める。</strong><span>水のSP削り、風の位置ずらしには注意。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#ffe29b"><b>光</b><div><strong>支援と属性変更で闇・幻の変則を整える。</strong><span>風の奇襲、火の突破には前線管理が必要。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#b889ff"><b>闇</b><div><strong>妨害とSP攻撃で火・草の強みを崩しやすい。</strong><span>光の支援、鋼の高耐久にはリスク管理が大事。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#f0abfc"><b>幻</b><div><strong>伏せ・入れ替えで草・鋼の計画を壊せる。</strong><span>雷の速攻、光の安定化に読み負けると脆い。</span></div></div>
                <div class="deckStartMatchupRow" style="--row-c:#c084fc"><b>呪</b><div><strong>SP攻撃で重い相手の行動を鈍らせる。</strong><span>耐久と火力は控えめ。草・光の立て直しには先にSPを削りたい。</span></div></div>
              </div>
            </section>
            <button class="deckStartLexiconBtn" type="button" data-lexicon-open>属性・状態ミニ辞典</button>
          </div>
        </aside>

        <div class="deckStartHero">
          <div class="deckStartHeroLines" aria-hidden="true"></div>
          <div class="deckStartUnit" aria-hidden="true">
            <div class="deckStartWing left"></div>
            <div class="deckStartWing right"></div>
            <div class="deckStartArm left"></div>
            <div class="deckStartArm right"></div>
          </div>
          <div class="deckStartTitleBlock">
            <h1 class="deckStartTitle">TCG<br />OBATO</h1>
            <p class="deckStartSub">デッキを組み、育てたカードで戦場へ。まずは下のボタンからモードを選んでね。</p>
          </div>
        </div>

        <button class="deckStartDuel" type="button" data-home-action="play">PLAY</button>
        <div class="deckStartLexicon" data-lexicon hidden>
          <div class="deckStartLexiconPanel" role="dialog" aria-label="属性と状態異常のミニ辞典">
            <div class="deckStartLexiconHead">
              <div>
                <b>TTCG ミニ辞典</b>
                <span>属性はデッキの勝ち筋、状態異常は盤面の読み合いを作る要素です。</span>
              </div>
              <button class="deckStartLexiconClose" type="button" data-lexicon-close>閉じる</button>
            </div>
            <div class="deckStartLexiconGrid">
              <div class="deckStartLexiconCard" style="--lex-c:#ff6b6b"><b><i>火</i>火力と突破</b><span>HPを削る力が高い。短期戦は得意だが、守りは薄くなりやすい。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#7dd3fc"><b><i>水</i>耐久と回復</b><span>場持ちと立て直しに強い。マナ不足をどう補うかが構築の鍵。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#facc15"><b><i>雷</i>展開とSP圧</b><span>行動回数とSPへの圧でテンポを取る。SPダメージはHPの2倍価値で評価。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#78e3ad"><b><i>草</i>回復と安定</b><span>事故を減らし、長い試合で強さが出る。決定打は別属性で補いやすい。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#9de7c5"><b><i>風</i>移動と奇襲</b><span>位置取りと射程ずらしで相手の計算を崩す。盤面理解がそのまま強さになる。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#b8c0cc"><b><i>鋼</i>耐久と制圧</b><span>高耐久で前線を固定する。重い展開を補助カードで支えたい。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#ffe29b"><b><i>光</i>支援と安定</b><span>味方を整える器用な属性。デッキの穴埋めやYOUカード育成と相性が良い。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#b889ff"><b><i>闇</i>妨害とリスク</b><span>毒・におい・手札干渉などで相手の予定を崩す。自傷や失敗リスクも読みどころ。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#f0abfc"><b><i>幻</i>変則と干渉</b><span>伏せ・入れ替え・特殊効果で盤面を揺さぶる。使いこなすほど強い。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#c084fc"><b><i>呪</i>SP攻撃と呪圧</b><span>SPを削る妨害寄り属性。耐久と火力は低めなので、行動を縛って勝ち筋を作る。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#ff7a90"><b><i>異</i>状態異常</b><span>出血・毒・におい・骨折・失魂・盲目・沈黙・激怒・洗脳・ヘドロ・カウンターなど。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#7dd3fc"><b><i>射</i>射程</b><span>前・横・斜め・全体・貫通で技の価値が変わる。強い技ほど当て方が大事。</span></div>
              <div class="deckStartLexiconCard" style="--lex-c:#78e3ad"><b><i>育</i>YOUカード</b><span>Growth PtでHP/SP/技/特殊能力を伸ばし、自分だけのカードに育てる。</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  if (deckStartEl) {
    const fresh = deckStartEl.cloneNode(false);
    deckStartEl.replaceWith(fresh);
    deckStartEl = fresh;
    deckStartEl.className = "deckStart";
    deckStartEl.setAttribute("role", "dialog");
    deckStartEl.removeAttribute("tabindex");
    deckStartEl.setAttribute("aria-label", "ホームメニュー");
    deckStartEl.innerHTML = homeHtml;
    return deckStartEl;
  }

  deckStartEl = document.createElement("div");
  deckStartEl.id = "deckStart";
  deckStartEl.className = "deckStart";
  deckStartEl.setAttribute("role", "dialog");
  deckStartEl.setAttribute("aria-label", "ホームメニュー");
  deckStartEl.innerHTML = homeHtml;
  document.body.prepend(deckStartEl);
  return deckStartEl;
}

function actionLabelForHome(action) {
  const m = {
    deck: "DECK",
    play: "PLAY",
    settings: "DECK LIST",
    user: "USER",
    login: "LOGIN",
    gacha: "GACHA",
    arcade: "ARCADE",
    creator: "CREATOR",
    tier: "TIER",
    dice: "DICE",
    changelog: "NEWS",
  };
  return m[action] || "START";
}

function runHomeSelectTransition(action, sourceEl, after) {
  if (!deckStartEl || !sourceEl || !sourceEl.getBoundingClientRect) {
    after?.();
    return;
  }
  if (deckStartEl.classList.contains("isTransitioning")) return;

  const src =
    action === "play"
      ? sourceEl.closest(".deckStartStage") || sourceEl
      : sourceEl.closest(".deckStartProfile, .deckStartPass, .deckStartToolItem, .deckStartToolsBtn, .deckHomeBtn, .deckStartPanel") || sourceEl;
  const r = src.getBoundingClientRect();
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const targetW = Math.max(1, vw * 0.92);
  const targetH = Math.max(1, vh * 0.92);
  const dx = vw / 2 - (r.left + r.width / 2);
  const dy = vh / 2 - (r.top + r.height / 2);
  const sx = Math.max(1, targetW / Math.max(1, r.width));
  const sy = Math.max(1, targetH / Math.max(1, r.height));

  const zoom = document.createElement("div");
  zoom.className = "deckStartZoomCard";
  zoom.style.left = `${r.left}px`;
  zoom.style.top = `${r.top}px`;
  zoom.style.width = `${r.width}px`;
  zoom.style.height = `${r.height}px`;
  zoom.style.setProperty("--zoom-x", `${dx}px`);
  zoom.style.setProperty("--zoom-y", `${dy}px`);
  zoom.style.setProperty("--zoom-sx", sx.toFixed(4));
  zoom.style.setProperty("--zoom-sy", sy.toFixed(4));

  zoom.insertAdjacentHTML("beforeend", `
    <div class="deckStartZoomText">
      <span>CONNECTING TO</span>
      <b>${esc(actionLabelForHome(action))}</b>
    </div>
  `);
  document.body.appendChild(zoom);

  deckStartEl.classList.add("isTransitioning");
  src.classList.add("deckStartZoomSource");
  requestAnimationFrame(() => zoom.classList.add("run"));

  setTimeout(() => {
    try { src.classList.remove("deckStartZoomSource"); } catch {}
    try { zoom.remove(); } catch {}
    after?.();
  }, 1500);
}

function routeCopyFor(action) {
  const m = {
    deck: ["DECK BUILDER", "カードを選び、30枚の戦術を整えます。"],
    play: ["BATTLE ENTRY", "ルーム操作を開きます。準備ができたら開始してください。"],
    settings: ["MY DECKS", "保存済みデッキを確認します。"],
    user: ["USER PROFILE", "所持カード、ジェム、成長状況を読み込みます。"],
    login: ["ACCOUNT LINK", "プレイヤーデータへ接続します。"],
    gacha: ["DARK REVEAL", "カード獲得画面へ移動します。"],
    arcade: ["ARCADE RUN", "短期決戦モードを起動します。"],
    creator: ["CARD FORGE", "カードと技の制作画面へ移動します。"],
    tier: ["TIER BOARD", "デッキやカードの評価表を開きます。"],
    dice: ["DICE TOOL", "ダイス判定ツールを開きます。"],
    changelog: ["CHANGE LOG", "更新履歴を確認します。"],
    battle: ["MATCH ENTRY", "ルームとデッキを同期しています。"],
    solo: ["SOLO ENTRY", "CPU戦の準備をしています。"],
    join: ["JOIN ROOM", "指定ルームへ接続しています。"],
  };
  return m[action] || ["CONNECTING", "画面を切り替えています。"];
}

function showRouteTransition(action = "deck", opts = {}) {
  ensureDeckStartStyle();
  const [title, sub] = routeCopyFor(action);
  const duration = Number(opts.duration || 980);
  const overlay = document.createElement("div");
  overlay.className = `tcgRouteOverlay ${opts.battle ? "tcgBattleLaunch" : ""}`;
  overlay.setAttribute("aria-hidden", "true");
  const roomText = opts.room ? `ROOM ${esc(opts.room)}` : "SYSTEM READY";
  const playerText = opts.player ? esc(opts.player) : "PLAYER";
  const battleBlock = opts.battle
    ? `
      <div class="tcgBattleVs">
        <div class="tcgBattleSeat">${playerText}</div>
        <div class="tcgBattleVsMark">VS</div>
        <div class="tcgBattleSeat">${opts.solo ? "CPU" : "OPPONENT"}</div>
      </div>
    `
    : "";
  overlay.innerHTML = `
    <div class="tcgRouteCard">
      <div class="tcgRouteKicker">${esc(roomText)}</div>
      <div class="tcgRouteTitle">${esc(opts.title || title)}</div>
      <div class="tcgRouteSub">${esc(opts.sub || sub)}</div>
      ${battleBlock}
      <div class="tcgRouteSteps" aria-hidden="true">
        <span class="tcgRouteStep"></span>
        <span class="tcgRouteStep"></span>
        <span class="tcgRouteStep"></span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("run"));
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
      setTimeout(() => {
        try { overlay.remove(); } catch {}
      }, 280);
    }, duration);
  });
}

async function navigateWithRouteTransition(url, action = "deck", opts = {}) {
  if (!url) return;
  await showRouteTransition(action, opts);
  location.href = url;
}

async function launchBattleWithTransition(url, action = "battle", opts = {}) {
  await showRouteTransition(action, {
    battle: true,
    room: roomId,
    player: normalizeName(playerNameInput?.value || loadName() || "") || "YOU",
    duration: 1240,
    ...opts,
  });
  location.href = url;
}

function setupDeckStartScreen(opts = {}) {
  const force = !!opts.force;
  ensureDeckStartElement();
  if (!deckStartEl) return;
  if (!force && qs.get("skipIntro") === "1") {
    deckStartEl.remove();
    return;
  }
  deckStartEl.classList.remove("hide", "isTransitioning");
  deckStartEl.removeAttribute("aria-hidden");
  deckStartEl.dataset.bound = "";
  randomizeHomeMascot();

  const close = (delay = 520) => {
    deckStartEl.classList.add("hide");
    deckStartEl.setAttribute("aria-hidden", "true");
    setTimeout(() => deckStartEl?.remove(), delay);
  };

  const triggerExistingButton = (id, fallbackUrl = "") => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.click();
      return;
    }
    if (fallbackUrl) location.href = fallbackUrl;
  };

  const handleHomeAction = (action, sourceEl) => {
    if (!action) return;
    const run = (fn) => runHomeSelectTransition(action, sourceEl, fn);
    if (action === "deck") {
      run(() => close(0));
      return;
    }
    if (action === "play") {
      run(() => {
        close(0);
        setTimeout(() => triggerExistingButton("roomDrawerToggle"), 80);
      });
      return;
    }
    if (action === "settings") {
      run(() => {
        const url = new URL("./deck_list.html", location.href);
        if (roomId) url.searchParams.set("room", roomId);
        if (playerId) url.searchParams.set("player", playerId);
        navigateWithRouteTransition(url.href, "settings");
      });
      return;
    }
    if (action === "user") {
      run(() => navigateWithRouteTransition("./profile.html", "user"));
      return;
    }
    if (action === "login") {
      run(() => {
        const ret = encodeURIComponent(location.pathname + location.search);
        navigateWithRouteTransition(`./login.html?return=${ret}`, "login");
      });
      return;
    }
    if (action === "gacha") {
      run(() => navigateWithRouteTransition("./gacha.html", "gacha"));
      return;
    }
    if (action === "arcade") {
      run(() => navigateWithRouteTransition("./arcade.html", "arcade"));
      return;
    }
    if (action === "creator") {
      run(() => navigateWithRouteTransition("./creator.html?v=20260724_creator_templates1", "creator"));
      return;
    }
    if (action === "tier") {
      run(() => navigateWithRouteTransition("./tier.html", "tier"));
      return;
    }
    if (action === "carddex") {
      const url = new URL("./carddex.html", location.href);
      if (roomId) url.searchParams.set("room", roomId);
      if (playerId) url.searchParams.set("player", playerId);
      run(() => navigateWithRouteTransition(url.href, "carddex"));
      return;
    }
    if (action === "dice") {
      run(() => navigateWithRouteTransition("./axis/index.html", "dice"));
      return;
    }
    if (action === "status") {
      run(() => navigateWithRouteTransition("./status_guide.html", "status"));
      return;
    }
    if (action === "changelog") {
      run(() => navigateWithRouteTransition("./changelog.html", "changelog"));
    }
  };

  const conceptToggle = deckStartEl.querySelector("[data-concept-toggle]");
  const conceptDetails = deckStartEl.querySelector("[data-concept-details]");
  const conceptPanel = deckStartEl.querySelector(".deckStartConcept");
  if (conceptToggle && conceptDetails) {
    const setConceptOpen = (open) => {
      conceptToggle.setAttribute("aria-expanded", open ? "true" : "false");
      conceptDetails.hidden = !open;
      conceptPanel?.classList.toggle("isOpen", open);
    };
    conceptToggle.addEventListener("pointerdown", (e) => e.stopPropagation());
    conceptToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setConceptOpen(conceptToggle.getAttribute("aria-expanded") !== "true");
    });
  }

  const lexicon = deckStartEl.querySelector("[data-lexicon]");
  const setLexiconOpen = (open) => {
    if (!lexicon) return;
    lexicon.hidden = !open;
  };
  deckStartEl.querySelectorAll("[data-lexicon-open]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLexiconOpen(true);
    });
  });
  deckStartEl.querySelectorAll("[data-lexicon-close]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setLexiconOpen(false);
    });
  });
  lexicon?.addEventListener("click", (e) => {
    if (e.target === lexicon) setLexiconOpen(false);
  });

  deckStartEl.querySelectorAll("[data-post-open]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.TCGPostBox?.open?.();
    });
  });

  const toolsWrap = deckStartEl.querySelector("[data-start-tools]");
  const toolsToggle = deckStartEl.querySelector("[data-start-tools-toggle]");
  const toolsPanel = deckStartEl.querySelector("[data-start-tools-panel]");
  const setToolsOpen = (open) => {
    if (!toolsToggle || !toolsPanel || !toolsWrap) return;
    toolsWrap.classList.toggle("open", !!open);
    toolsPanel.hidden = !open;
    toolsToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };
  if (toolsToggle && toolsPanel && !toolsToggle.dataset.boundStartTools) {
    toolsToggle.dataset.boundStartTools = "1";
    toolsToggle.addEventListener("pointerdown", (e) => e.stopPropagation());
    toolsToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setToolsOpen(toolsPanel.hidden);
    });
    toolsPanel.addEventListener("pointerdown", (e) => e.stopPropagation());
    toolsPanel.addEventListener("click", (e) => {
      if (e.target?.closest?.("[data-home-action]")) setToolsOpen(false);
    });
    deckStartEl.addEventListener("click", (e) => {
      if (!toolsWrap?.contains?.(e.target)) setToolsOpen(false);
    });
  }

  deckStartEl.querySelectorAll("[data-home-action]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleHomeAction(btn.getAttribute("data-home-action"), btn);
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      handleHomeAction(btn.getAttribute("data-home-action"), btn);
    });
  });

  deckStartEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
}
setupDeckStartScreen();

function ensureHomeReturnButton() {
  ensureDeckStartStyle();
  if ($("btnHome")) return;
  const topRight = document.querySelector(".topRight");
  const header = document.querySelector("header");
  const parent = topRight || header;
  if (!parent) return;

  const btn = document.createElement("button");
  btn.id = "btnHome";
  btn.type = "button";
  btn.textContent = "ホーム";
  btn.title = "ホームを開く";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setupDeckStartScreen({ force: true });
  });

  parent.insertBefore(btn, parent.firstElementChild || null);
}
ensureHomeReturnButton();

function openDetail() {
  if (!detailWrap) return;
  detailWrap.style.display = "block";

  // 左下固定にするので、位置調整ロジックは不要。
  detailWrap.style.position = "fixed";
  detailWrap.style.left = "14px";
  detailWrap.style.bottom = "14px";
  detailWrap.style.right = "auto";
  detailWrap.style.top = "auto";
}

function closeDetail() {
  if (!detailWrap) return;
  detailWrap.style.display = "none";
  detailWrap.setAttribute("aria-hidden", "true");
}

detailClose?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeDetail();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetail();
});

const roomIdLabel = $("roomIdLabel");
const playerIdLabel = $("playerIdLabel");

const typeSelect = $("typeSelect");
const searchEl = $("search");
if (searchEl) searchEl.placeholder = "カード名 / ID / シリーズで検索";
const shownCountEl = $("shownCount");
const cardSectionsEl = $("cardSections");

const cardListEl = $("cardList");
const deckListEl = $("deckList");
const deckCountEl = $("deckCount");

const msgEl = $("msg") || $("deckMsg");

const btnSave = $("btnSave");
const randomDeckBtn = $("randomDeckBtn");
const btnClearDeck = $("btnClearDeck") || $("btnClear");

const createBtn = $("createBtn");
const joinBtn = $("joinBtn");
const joinCodeInput =
  $("joinCodeInput") || $("joinRoomId") || $("joinRoomCode");

const btnRule = $("btnRule");
const btnTutorial = $("btnTutorial");
const btnGuide = $("btnGuide");
const btnSettings =
  $("btnSettings") ||
  document.querySelector?.('button[data-action="settings"]');

const playerNameInput = $("playerNameInput") || $("playerName");
const btnSaveName = $("btnSaveName");
const nameHintEl = $("nameHint") || $("nameMsg");

const tabEls = Array.from(document.querySelectorAll?.("[data-tab]") || []);
const tabCreateBody = $("tabBodyCreate") || $("tab-create");
const tabJoinBody = $("tabBodyJoin") || $("tab-join");

// =====================
// Firestore refs
// =====================
const userRef = (uid) => doc(db, "users", uid);
const roomRef = (rid) => doc(db, "rooms", rid);
const playerRef = (rid, pid) => doc(db, "rooms", rid, "players", pid);
const playersCol = (rid) => collection(db, "rooms", rid, "players");

const matchRef = (rid) => doc(db, "rooms", rid, "game", "match");
const stateRef = (rid) => doc(db, "rooms", rid, "game", "state");

const btnArcade = document.getElementById("btnArcade");
btnArcade?.addEventListener("click", () => {
  navigateWithRouteTransition("./arcade.html", "arcade");
});

const btnCreator = document.getElementById("btnCreator");
btnCreator?.addEventListener("click", () => {
  navigateWithRouteTransition("./creator.html?v=20260724_creator_templates1", "creator");
});

// =====================
// State
// =====================
let cardDefs = {};
let cardIdsSorted = [];
let deckMap = {};
let filterType = "ALL";
let filterKind = document.body?.dataset?.kindFilter || "all";
let filterOwned = document.body?.dataset?.ownedFilter || "all";
let filterName = "";

let selectedExSupportId = "";
let currentProfileUid = "";
let ownedCounts = {};
let ownedReady = false;
let ownedUnsubscribe = null;
const DECK_LAB_OPEN_KEY = "tcg_deck_lab_open_v20260723";

function getUserDocUid() {
  const profile = (localStorage.getItem("uid") || "").trim();
  const anon = (localStorage.getItem("anonUid") || "").trim();
  return profile || anon || "";
}

const ADMIN_MODE_KEY = "tcg_admin_mode_enabled_v20260705";
let currentUserHasAdminPrivilege = false;
let adminModeEnabled = false;

function loadAdminModePreference() {
  try {
    return localStorage.getItem(ADMIN_MODE_KEY) !== "0";
  } catch {
    return true;
  }
}

function saveAdminModePreference(enabled) {
  try {
    localStorage.setItem(ADMIN_MODE_KEY, enabled ? "1" : "0");
  } catch {}
}

async function loadAdminFlag() {
  try {
    const uid = getUserDocUid();
    if (!uid) {
      currentUserHasAdminPrivilege = false;
      adminModeEnabled = false;
      return false;
    }

    const snap = await getDoc(userRef(uid));
    const data = snap.exists() ? snap.data() || {} : {};
    currentUserHasAdminPrivilege = data.isAdmin === true;
    adminModeEnabled =
      currentUserHasAdminPrivilege && loadAdminModePreference();
    return currentUserHasAdminPrivilege;
  } catch (e) {
    console.warn("loadAdminFlag failed:", e?.message || e);
    currentUserHasAdminPrivilege = false;
    adminModeEnabled = false;
    return false;
  }
}

function hasAdminPrivilege() {
  return currentUserHasAdminPrivilege === true;
}

function isAdminUser() {
  return hasAdminPrivilege() && adminModeEnabled === true;
}

function updateAdminModeBadge() {
  const topRight = document.querySelector(".topRight");
  if (!topRight) return;

  let badge = document.getElementById("adminModePill");
  if (!badge) {
    badge = document.createElement("button");
    badge.id = "adminModePill";
    badge.className = "pill adminModePill";
    badge.type = "button";
    const versionPill = document.getElementById("deckVersionPill");
    if (versionPill?.parentNode) {
      versionPill.parentNode.insertBefore(badge, versionPill.nextSibling);
    } else {
      topRight.appendChild(badge);
    }
  }

  if (!badge.dataset.adminToggleBound) {
    badge.dataset.adminToggleBound = "1";
    badge.addEventListener("click", () => {
      if (!hasAdminPrivilege()) return;
      adminModeEnabled = !adminModeEnabled;
      saveAdminModePreference(adminModeEnabled);
      updateAdminModeBadge();
      renderAll();
    });
  }

  badge.disabled = !hasAdminPrivilege();
  badge.textContent = hasAdminPrivilege()
    ? `管理: ${isAdminUser() ? "ON" : "OFF"}`
    : "管理: OFF";
  badge.title = hasAdminPrivilege()
    ? "クリックで管理モードのON/OFFを切り替えます"
    : "users/{uid}.isAdmin が true の時だけ管理モードを使えます";
  badge.style.borderColor = isAdminUser()
    ? "rgba(120,210,255,.46)"
    : "rgba(255,120,120,.32)";
  badge.style.color = isAdminUser()
    ? "rgba(216,242,255,.95)"
    : "rgba(255,210,215,.85)";
}

// =====================
// Utils
// =====================
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const ACTION_DISPLAY_HIDDEN_KEYS = new Set([
  "attr",
  "attrIn",
  "attrs",
  "attribute",
  "attributes",
  "cond",
  "condition",
  "conditions",
  "existing",
  "existingSkill",
  "fromExisting",
  "internal",
  "kind",
  "note",
  "owner",
  "ownerType",
  "raw",
  "role",
  "roles",
  "source",
  "sourceCard",
  "sourceCardId",
  "sourceId",
  "src",
  "tag",
  "theme",
  "type",
  "既存技",
]);

function hiddenActionDisplayKey(key) {
  const k = String(key || "").trim();
  if (!k) return true;
  return ACTION_DISPLAY_HIDDEN_KEYS.has(k) || ACTION_DISPLAY_HIDDEN_KEYS.has(k.toLowerCase());
}

function sanitizeActionDisplayText(text) {
  return String(text ?? "")
    .split(/\s*\/\s*|\n+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const power = x.match(/^power\s*[:：=+]?\s*(-?\d+)\s*$/i);
      if (power) return `威力${Number(power[1]) >= 0 ? "+" : ""}${Math.trunc(Number(power[1]))}`;
      const kb = x.match(/^(?:knockback|knockBack|kb|ノックバック)\s*[:：=+]?\s*(\d+)?\s*$/i);
      if (kb) return kb[1] ? `ノックバック${Math.trunc(Number(kb[1]))}` : "ノックバック";
      return x;
    })
    .filter((x) => {
      const m = x.match(/^([^:：=+\s]+)\s*[:：=]/);
      if (m && hiddenActionDisplayKey(m[1])) return false;
      if (/^(attr|role|source|raw|theme|type|kind|owner|cond|condition)\b/i.test(x)) return false;
      if (/(?:^|[^A-Za-z0-9_])(attr|role|source|raw|theme|type|kind|owner|cond|condition)(?:[:：=]|\b)/i.test(x)) return false;
      if (/既存技|カード内蔵技|元カード/.test(x)) return false;
      return true;
    })
    .join(" / ");
}

function vitalDeltaText(kind, delta) {
  const n = Math.trunc(Number(delta) || 0);
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

function actionOneLine(a) {
  if (!a) return "";
  let parts = null;
  try {
    parts = actionDetailPartsJa(a);
  } catch {}
  const cost = parts?.cost ?? a.cost ?? "";
  const name = parts?.name ?? a.name ?? "技";
  const range = parts?.range ?? rangeToArrowJa(a.range || "");
  const rate = parts?.rate ?? a.rate ?? "";
  const deltas = [];
  const hpDelta = Number(a.hpDelta ?? 0);
  const spDelta = Number(a.spDelta ?? 0);
  if (hpDelta) deltas.push(vitalDeltaText("HP", hpDelta));
  if (spDelta) deltas.push(vitalDeltaText("SP", spDelta));
  const meta = [
    cost !== "" ? `消費${cost}` : "",
    range ? `射程 ${range}` : "",
    rate !== "" ? `成功${rate}%` : "",
    ...deltas,
  ].filter(Boolean);
  return `${name}${meta.length ? ` / ${meta.join(" / ")}` : ""}`;
}

function sumDeck(m) {
  let total = 0;
  for (const v of Object.values(m || {})) {
    const n = Number(v || 0);
    total += Number.isFinite(n) ? n : 0;
  }
  return total;
}

function normalizeOwnedCounts(raw) {
  const next = {};
  for (const [cardId, countRaw] of Object.entries(raw || {})) {
    const id = String(cardId || "").trim();
    const count = Math.max(0, Math.trunc(Number(countRaw || 0)));
    if (id && Number.isFinite(count) && count > 0) next[id] = count;
  }
  return next;
}

function isOwnedSystemActive() {
  return ownedReady && !isAdminUser();
}

function ownedCount(cardId) {
  if (isAdminUser()) return MAX_SAME;
  return Math.max(0, Math.trunc(Number(ownedCounts?.[cardId] || 0)));
}

function deckLimitForCard(cardId) {
  if (isAdminUser()) return MAX_SAME;
  if (!ownedReady) return MAX_SAME;
  return Math.max(0, Math.min(MAX_SAME, ownedCount(cardId)));
}

function canUseCard(cardId) {
  return !isOwnedSystemActive() || ownedCount(cardId) > 0;
}

function isStarterLikeCard(cardId, def = cardDefs?.[cardId] || {}) {
  return isStarterCardDef(cardId, def || {});
}

function ownedBadgeText(cardId) {
  if (isAdminUser()) return "管理";
  if (!ownedReady) return "所持確認中";
  return `所持${ownedCount(cardId)}`;
}

function ownedBadgeHtml(cardId) {
  const zero = isOwnedSystemActive() && ownedCount(cardId) <= 0;
  const starter = !zero && isStarterLikeCard(cardId);
  return `<span class="ownedBadge ${zero ? "isZero" : starter ? "isStarter" : ""}">${esc(ownedBadgeText(cardId))}</span>`;
}

function cardSeriesInfo(cardId, def = {}) {
  const kind = normalizedKindOf(def, cardId);
  if (isStarterLikeCard(cardId, def)) return { label: "初期", cls: "starter" };
  if (isFairyTaleCardId(cardId)) return { label: "童話", cls: "fairy" };
  if (kind === "ex_support" || kind === "exsupport" || kind === "ex") {
    return { label: "EX", cls: "ex" };
  }
  if (kind === "support") return { label: "サポート", cls: "support" };
  if (def?.hidden) return { label: "非公開", cls: "hidden" };
  return { label: "ガチャ", cls: "gacha" };
}

function cardSeriesLabel(cardId, def = {}) {
  return cardSeriesInfo(cardId, def).label;
}

function cardSeriesHtml(cardId, def = {}) {
  const info = cardSeriesInfo(cardId, def);
  return `<span class="seriesBadge series-${esc(info.cls)}">${esc(info.label)}</span>`;
}

ownedBadgeText = function compactOwnedBadgeText(cardId) {
  if (isAdminUser()) return "管理";
  if (!ownedReady) return "...";
  return `×${ownedCount(cardId)}`;
};

ownedBadgeHtml = function compactOwnedBadgeHtml(cardId) {
  const zero = isOwnedSystemActive() && ownedCount(cardId) <= 0;
  const title = isAdminUser()
    ? "管理モード"
    : ownedReady
      ? `所持枚数: ${ownedCount(cardId)}`
      : "所持枚数を確認中";
  return `<span class="ownedBadge ${zero ? "isZero" : ""}" title="${esc(title)}">${esc(ownedBadgeText(cardId))}</span>`;
};

cardSeriesInfo = function compactCardSeriesInfo(cardId, def = {}) {
  const kind = normalizedKindOf(def, cardId);
  if (isStarterLikeCard(cardId, def)) return { label: "初", title: "初期カード", cls: "starter" };
  if (isFairyTaleCardId(cardId)) return { label: "童", title: "童話シリーズ", cls: "fairy" };
  if (kind === "ex_support" || kind === "exsupport" || kind === "ex") {
    return { label: "EX", title: "EXサポート", cls: "ex" };
  }
  if (kind === "support") return { label: "補", title: "サポート", cls: "support" };
  if (def?.hidden) return { label: "非", title: "非公開", cls: "hidden" };
  return { label: "G", title: "ガチャ", cls: "gacha" };
};

cardSeriesLabel = function compactCardSeriesLabel(cardId, def = {}) {
  return cardSeriesInfo(cardId, def).title || cardSeriesInfo(cardId, def).label;
};

cardSeriesHtml = function compactCardSeriesHtml(cardId, def = {}) {
  const info = cardSeriesInfo(cardId, def);
  return `<span class="seriesBadge series-${esc(info.cls)}" title="${esc(info.title || info.label)}">${esc(info.label)}</span>`;
};

cardSeriesInfo = function roundedCardSeriesInfo(cardId, def = {}) {
  const kind = normalizedKindOf(def, cardId);
  if (isStarterLikeCard(cardId, def)) return { label: "初期", title: "初期カード", cls: "starter" };
  if (isFairyTaleCardId(cardId)) return { label: "童話", title: "童話シリーズ", cls: "fairy" };
  if (kind === "ex_support" || kind === "exsupport" || kind === "ex") {
    return { label: "EX", title: "EXサポート", cls: "ex" };
  }
  if (kind === "support") return { label: "サポ", title: "サポート", cls: "support" };
  if (def?.hidden) return { label: "非公開", title: "非公開", cls: "hidden" };
  return { label: "ガチャ", title: "ガチャ", cls: "gacha" };
};

cardSeriesLabel = function roundedCardSeriesLabel(cardId, def = {}) {
  return cardSeriesInfo(cardId, def).title || cardSeriesInfo(cardId, def).label;
};

cardSeriesHtml = function roundedCardSeriesHtml(cardId, def = {}) {
  const info = cardSeriesInfo(cardId, def);
  return `<span class="seriesBadge series-${esc(info.cls)}" title="${esc(info.title || info.label)}">${esc(info.label)}</span>`;
};

const OWNED_BADGE_STYLE =
  "display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:22px;padding:0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.075);color:rgba(255,255,255,.92);font-size:12px;font-weight:950;line-height:1;box-sizing:border-box;white-space:nowrap;vertical-align:middle;";
const SERIES_BADGE_STYLE =
  "display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:25px;padding:0 11px;border-radius:999px;border:1px solid rgba(255,255,255,.34);background:rgba(255,255,255,.07);color:rgba(255,255,255,.92);font-size:12px;font-weight:950;line-height:1;box-sizing:border-box;white-space:nowrap;vertical-align:middle;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);";
const SERIES_BADGE_STYLES = {
  starter:
    "border-color:rgba(110,255,175,.56);background:rgba(70,210,125,.13);color:rgba(220,255,232,.98);",
  gacha:
    "border-color:rgba(125,195,255,.5);background:rgba(70,145,255,.12);color:rgba(220,240,255,.98);",
  fairy:
    "border-color:rgba(255,200,100,.5);background:rgba(255,180,80,.13);color:rgba(255,238,205,.98);",
  support:
    "border-color:rgba(185,155,255,.46);background:rgba(140,100,255,.12);color:rgba(235,226,255,.98);",
  ex:
    "border-color:rgba(255,220,90,.5);background:rgba(255,215,80,.12);color:rgba(255,246,205,.98);",
  hidden:
    "border-color:rgba(255,110,120,.5);background:rgba(255,75,95,.13);color:rgba(255,205,214,.98);",
};

function cardNameTypeSuffix(def = {}, cardId = "") {
  const type = String(def?.type || "").trim();
  if (!type) return "";
  const kind = normalizedKindOf(def, cardId);
  if ((kind === "support" || kind === "ex_support") && type.toLowerCase() === "support") {
    return "";
  }
  return ` ${esc(type)}`;
}

function cardAttrBadgeHtml(def = {}) {
  const attr = cardAttrForFilter(def);
  if (!attr || attr === "無" || String(attr).toLowerCase() === "support") return "";
  return `<span class="attrBadge attr-${esc(attr)}" title="${esc(attr)}属性">${esc(attr)}</span>`;
}

ownedBadgeHtml = function roundedOwnedBadgeHtml(cardId) {
  const zero = isOwnedSystemActive() && ownedCount(cardId) <= 0;
  const title = isAdminUser()
    ? "管理モード"
    : ownedReady
      ? `所持枚数: ${ownedCount(cardId)}`
      : "所持枚数を確認中";
  const zeroStyle = zero
    ? "border-color:rgba(255,110,120,.46);background:rgba(255,80,100,.11);color:rgba(255,190,200,.96);"
    : "";
  return `<span class="ownedBadge ${zero ? "isZero" : ""}" style="${OWNED_BADGE_STYLE}${zeroStyle}" title="${esc(title)}">${esc(ownedBadgeText(cardId))}</span>`;
};

cardSeriesHtml = function roundedSeriesBadgeHtml(cardId, def = {}) {
  const info = cardSeriesInfo(cardId, def);
  const style = `${SERIES_BADGE_STYLE}${SERIES_BADGE_STYLES[info.cls] || ""}`;
  return `<span class="seriesBadge series-${esc(info.cls)}" style="${style}" title="${esc(info.title || info.label)}">${esc(info.label)}</span>`;
};

function normalizeDeckMap(rawDeck) {
  const next = {};
  let total = 0;
  for (const [id, raw] of Object.entries(rawDeck || {})) {
    if (!cardDefs[id]) continue;
    const maxForCard = deckLimitForCard(id);
    const n = Math.max(0, Math.min(maxForCard, Math.trunc(Number(raw || 0))));
    if (!n) continue;
    const room = Math.max(0, DECK_SIZE - total);
    if (!room) break;
    const take = Math.min(n, room);
    next[id] = take;
    total += take;
  }
  return next;
}

function deckOwnershipIssues(rawDeck) {
  const issues = [];
  for (const [cardId, countRaw] of Object.entries(rawDeck || {})) {
    const requested = Math.max(0, Math.trunc(Number(countRaw || 0)));
    if (!requested) continue;
    const def = cardDefs[cardId];
    const allowed = def
      ? Math.min(requested, Math.max(0, deckLimitForCard(cardId)))
      : 0;
    if (allowed >= requested) continue;
    issues.push({
      cardId,
      name: def?.name || cardId,
      requested,
      allowed,
      missing: requested - allowed,
    });
  }
  return issues;
}

function formatDeckCopyWarning(issues) {
  if (!issues?.length) return "";
  const shown = issues
    .slice(0, 4)
    .map((x) => `${x.name} ${x.allowed}/${x.requested}`)
    .join(" / ");
  return `注意: 未所持または上限超過のカードを外してコピーしました (${shown}${issues.length > 4 ? " 他" : ""})`;
}

function pruneDeckByOwnership(reason = "") {
  const before = deckMap || {};
  const next = normalizeDeckMap(before);
  const removed = [];
  for (const [cardId, countRaw] of Object.entries(before)) {
    const beforeCount = Math.max(0, Math.trunc(Number(countRaw || 0)));
    const afterCount = Math.max(0, Math.trunc(Number(next[cardId] || 0)));
    if (beforeCount > afterCount) {
      removed.push({ cardId, count: beforeCount - afterCount });
    }
  }
  deckMap = next;
  if (removed.length && reason) {
    const names = removed
      .slice(0, 3)
      .map((x) => cardDefs[x.cardId]?.name || x.cardId)
      .join(" / ");
    setMsg(`${reason}: 未所持または上限超過のカードを外しました (${names}${removed.length > 3 ? " 他" : ""})`, false);
  }
  if (selectedExSupportId && !canUseCard(selectedExSupportId)) {
    selectedExSupportId = "";
    saveSelectedEx("");
  }
  return removed;
}

function ensureDeckControlCss() {
  if (document.getElementById("deckControlCss_v20260705_badge2")) return;
  const css = document.createElement("style");
  css.id = "deckControlCss_v20260705_badge2";
  css.textContent = `
    #deckList .cardRow{
      align-items:stretch !important;
      min-height:76px !important;
      overflow:visible !important;
    }
    #deckList .cardRow > div:first-child{
      min-width:0 !important;
      flex:1 1 auto !important;
    }
    #deckList .cardRow .btns{
      display:grid !important;
      grid-template-columns:76px 44px minmax(58px, 1fr) 44px !important;
      grid-template-areas:
        "detail plus count minus"
        "ex ex ex ex" !important;
      gap:7px !important;
      width:268px !important;
      min-width:268px !important;
      max-width:268px !important;
      flex:0 0 268px !important;
      align-self:center !important;
      overflow:visible !important;
    }
    #deckList{
      padding-top:6px !important;
    }
    #deckList .cardRow .sub{
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
    }
    .deckBuildSavePanel,
    .deckInfoPanel,
    .deckLibraryPanel{
      margin-bottom:8px !important;
    }
    .deckBuildSavePanel summary,
    .deckInfoPanel summary,
    .deckLibraryPanel summary{
      min-height:42px !important;
      padding:8px 11px !important;
    }
    .deckBuildSavePanel .panelBody,
    .deckInfoPanel .panelBody,
    .deckLibraryPanel .panelBody{
      padding:9px 10px !important;
    }
    #deckList .cardRow .btns [data-plus]{ grid-area:plus !important; }
    #deckList .cardRow .btns [data-minus]{ grid-area:minus !important; }
    #deckList .cardRow .btns .count,
    #deckList .cardRow .btns .cnt{ grid-area:count !important; }
    #deckList .cardRow .btns [data-ex],
    #deckList .cardRow .btns [data-expick]{ grid-area:ex !important; }
    #deckList .cardRow .btns [data-detail]{ grid-area:detail !important; }
    #deckList .cardRow .btns button,
    #deckList .cardRow .btns .count,
    #deckList .cardRow .btns .cnt{
      min-height:36px !important;
      height:36px !important;
      white-space:nowrap !important;
      line-height:1.05 !important;
    }
    #deckList .cardRow .btns [data-ex]{
      font-size:11px !important;
      overflow-wrap:normal !important;
      word-break:keep-all !important;
    }
    #deckList .cardRow .btns [data-expick]{
      font-size:11px !important;
      overflow-wrap:normal !important;
      word-break:keep-all !important;
    }
    .cardRow.notOwned,
    .card.notOwned{
      opacity:.48;
      filter:saturate(.55);
    }
    .cardRow.notOwned .name,
    .card.notOwned b{
      color:rgba(255,255,255,.7) !important;
    }
    .cardRow .name,
    .card b{
      display:flex;
      align-items:center;
      gap:5px;
      flex-wrap:wrap;
      min-width:0;
      line-height:1.25;
    }
    .ownedBadge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:28px;
      height:20px;
      padding:0 7px;
      margin-left:2px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06);
      color:rgba(255,255,255,.82);
      font-size:11px;
      font-weight:950;
      vertical-align:middle;
      white-space:nowrap;
      box-sizing:border-box;
    }
    .ownedBadge.isZero{
      border-color:rgba(255,110,120,.32);
      background:rgba(255,80,100,.08);
      color:rgba(255,180,190,.92);
    }
    .ownedBadge.isStarter{
      border-color:rgba(120,255,170,.24);
      background:rgba(120,255,170,.07);
      color:rgba(210,255,225,.9);
    }
    .seriesBadge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:22px;
      height:22px;
      padding:0;
      margin-left:0;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.05);
      color:rgba(255,255,255,.76);
      font-size:11px;
      font-weight:900;
      letter-spacing:0;
      vertical-align:middle;
      white-space:nowrap;
      box-sizing:border-box;
    }
    .seriesBadge.series-starter{
      border-color:rgba(95,230,150,.34);
      background:rgba(70,210,125,.09);
      color:rgba(210,255,228,.95);
    }
    .seriesBadge.series-fairy{
      border-color:rgba(255,190,105,.38);
      background:rgba(255,185,90,.1);
      color:rgba(255,232,190,.95);
    }
    .seriesBadge.series-gacha{
      border-color:rgba(130,195,255,.32);
      background:rgba(80,155,255,.08);
      color:rgba(210,235,255,.95);
    }
    .seriesBadge.series-support{
      border-color:rgba(180,150,255,.32);
      background:rgba(155,120,255,.08);
      color:rgba(232,222,255,.95);
    }
    .seriesBadge.series-ex{
      border-color:rgba(255,220,90,.38);
      background:rgba(255,215,80,.1);
      color:rgba(255,245,190,.95);
    }
    .seriesBadge.series-hidden{
      border-color:rgba(255,110,120,.34);
      background:rgba(255,75,95,.09);
      color:rgba(255,195,205,.95);
    }
    .cardRow .name .ownedBadge,
    .card b .ownedBadge{
      min-width:34px !important;
      height:22px !important;
      padding:0 8px !important;
      border-radius:999px !important;
      border:1px solid rgba(255,255,255,.28) !important;
      background:rgba(255,255,255,.075) !important;
      color:rgba(255,255,255,.92) !important;
      font-size:12px !important;
      line-height:1 !important;
    }
    .cardRow .name .seriesBadge,
    .card b .seriesBadge{
      width:auto !important;
      min-width:48px !important;
      height:25px !important;
      padding:0 11px !important;
      border-radius:999px !important;
      border:1px solid rgba(255,255,255,.34) !important;
      background:rgba(255,255,255,.07) !important;
      color:rgba(255,255,255,.92) !important;
      font-size:12px !important;
      font-weight:950 !important;
      line-height:1 !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08) !important;
    }
    .cardRow .name .seriesBadge.series-starter,
    .card b .seriesBadge.series-starter{
      border-color:rgba(110,255,175,.56) !important;
      background:rgba(70,210,125,.13) !important;
      color:rgba(220,255,232,.98) !important;
    }
    .cardRow .name .seriesBadge.series-gacha,
    .card b .seriesBadge.series-gacha{
      border-color:rgba(125,195,255,.5) !important;
      background:rgba(70,145,255,.12) !important;
      color:rgba(220,240,255,.98) !important;
    }
    .cardRow .name .seriesBadge.series-fairy,
    .card b .seriesBadge.series-fairy{
      border-color:rgba(255,200,100,.5) !important;
      background:rgba(255,180,80,.13) !important;
      color:rgba(255,238,205,.98) !important;
    }
    .cardRow .name .seriesBadge.series-support,
    .card b .seriesBadge.series-support{
      border-color:rgba(185,155,255,.46) !important;
      background:rgba(140,100,255,.12) !important;
      color:rgba(235,226,255,.98) !important;
    }
    .cardRow.deckAddFlash{
      position:relative;
      isolation:isolate;
      animation:deckAddPulse .62s ease-out;
      box-shadow:
        0 0 0 1px color-mix(in srgb, var(--deck-add-color, #6ab7ff) 74%, transparent),
        0 0 24px color-mix(in srgb, var(--deck-add-color, #6ab7ff) 48%, transparent) !important;
    }
    .cardRow.deckAddFlash::after{
      content:"";
      position:absolute;
      inset:-2px;
      border-radius:inherit;
      pointer-events:none;
      z-index:-1;
      background:
        radial-gradient(circle at 18% 50%, color-mix(in srgb, var(--deck-add-color, #6ab7ff) 36%, transparent), transparent 38%),
        linear-gradient(90deg, color-mix(in srgb, var(--deck-add-color, #6ab7ff) 28%, transparent), transparent 62%);
      opacity:.9;
      animation:deckAddSweep .62s ease-out;
    }
    @keyframes deckAddPulse{
      0%{ transform:translateY(0) scale(1); }
      34%{ transform:translateY(-1px) scale(1.012); }
      100%{ transform:translateY(0) scale(1); }
    }
    @keyframes deckAddSweep{
      0%{ opacity:0; transform:scaleX(.82); filter:blur(6px); }
      32%{ opacity:1; }
      100%{ opacity:0; transform:scaleX(1.04); filter:blur(12px); }
    }
    .fieldPickDeck{
      display:flex;
      align-items:center;
      gap:8px;
      min-height:44px;
      padding:7px 10px;
      border:1px solid rgba(255,255,255,.14);
      border-radius:14px;
      background:rgba(255,255,255,.045);
    }
    .fieldPickDeck label{
      font-size:12px;
      font-weight:900;
      color:rgba(255,255,255,.74);
      white-space:nowrap;
    }
    .fieldPickDeck select{
      height:32px;
      min-width:110px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.2);
      background:rgba(0,0,0,.34);
      color:#fff;
      font-weight:800;
      padding:0 10px;
    }
    .fieldPickDeck .fieldPickDeckNote{
      font-size:11px;
      color:rgba(255,255,255,.58);
      white-space:nowrap;
    }
    #roomFieldMount .fieldPickDeck{
      width:100%;
      justify-content:space-between;
      background:
        radial-gradient(260px 90px at 10% 0%, rgba(105,180,255,.13), transparent 62%),
        rgba(255,255,255,.045);
    }
    #roomFieldMount .fieldPickDeck select{
      flex:1;
      min-width:0;
    }
    .roomPlayerSummary{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      gap:10px;
      align-items:center;
      min-height:54px;
      padding:10px 12px;
      border:1px solid rgba(120,255,190,.16);
      border-radius:14px;
      background:
        radial-gradient(260px 90px at 0% 0%, rgba(120,255,190,.12), transparent 62%),
        rgba(255,255,255,.04);
    }
    .roomPlayerSummaryLabel{
      font-size:11px;
      color:rgba(255,255,255,.58);
      margin-bottom:3px;
    }
    .roomPlayerSummaryName{
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      color:rgba(255,255,255,.95);
      font-weight:950;
      font-size:16px;
    }
    .roomPlayerSummaryNote{
      margin-top:8px;
      color:rgba(255,255,255,.58);
      font-size:12px;
      line-height:1.45;
    }
    #deckPanel{
      --deck-list-control-w:190px;
      --deck-fill:0%;
      position:relative !important;
      overflow:hidden !important;
      border-color:rgba(120,255,190,.16) !important;
      background:
        radial-gradient(720px 260px at 22% -12%, rgba(105,180,255,.13), transparent 58%),
        radial-gradient(680px 300px at 95% 8%, rgba(120,255,170,.11), transparent 62%),
        linear-gradient(180deg, rgba(17,25,32,.92), rgba(6,10,14,.96)) !important;
      box-shadow:
        0 24px 70px rgba(0,0,0,.52),
        inset 0 1px 0 rgba(255,255,255,.075) !important;
    }
    #deckPanel::before{
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:
        linear-gradient(90deg, rgba(120,255,190,.09), transparent var(--deck-fill)),
        linear-gradient(115deg, transparent 0 58%, rgba(105,180,255,.045) 58.4%, transparent 59% 100%);
      opacity:.62;
      z-index:0;
    }
    #deckPanel > *{
      position:relative;
      z-index:1;
    }
    #deckPanel > .hd{
      border-bottom:1px solid rgba(255,255,255,.09) !important;
      background:
        linear-gradient(90deg, rgba(105,180,255,.10), rgba(120,255,170,.055)),
        rgba(0,0,0,.12) !important;
    }
    #deckPanel > .hd > b{
      display:inline-flex;
      align-items:center;
      gap:8px;
      letter-spacing:.04em;
    }
    #deckPanel > .hd > b::before{
      content:"";
      width:10px;
      height:18px;
      border-radius:999px;
      background:linear-gradient(180deg, #7dd3fc, #78e3ad);
      box-shadow:0 0 18px rgba(110,220,255,.42);
    }
    #deckPanel > .hd .row{
      gap:7px !important;
      flex-wrap:wrap !important;
    }
    #deckPanel .pill{
      position:relative;
      overflow:hidden;
      border-color:rgba(120,255,190,.30) !important;
      background:rgba(0,0,0,.24) !important;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,.035);
    }
    #deckPanel .pill::after{
      content:"";
      position:absolute;
      left:0;
      top:0;
      bottom:0;
      width:var(--deck-fill);
      background:linear-gradient(90deg, rgba(105,180,255,.25), rgba(120,255,170,.25));
      z-index:-1;
      transition:width .18s ease;
    }
    #deckPanel.deckFull .pill{
      border-color:rgba(185,255,80,.62) !important;
      color:rgba(242,255,225,.98) !important;
      box-shadow:0 0 22px rgba(160,255,120,.20), inset 0 1px 0 rgba(255,255,255,.08);
    }
    #deckPanel.deckAlmost .pill{
      border-color:rgba(255,220,120,.48) !important;
      color:rgba(255,240,190,.96) !important;
    }
    .deckPanelActions{
      display:flex;
      align-items:center;
      gap:6px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .deckPanelActions button{
      position:relative;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      min-height:34px;
      padding:7px 12px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(0,0,0,.24);
      color:#fff;
      font-weight:950;
      cursor:pointer;
      white-space:nowrap;
      transition:transform .08s ease, border-color .12s ease, background .12s ease, box-shadow .14s ease;
    }
    .deckPanelActions button::before{
      width:18px;
      height:18px;
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      font-size:11px;
      line-height:1;
      color:rgba(255,255,255,.9);
    }
    .deckPanelActions button[data-deck-panel-action="save"]::before{ content:"D"; }
    .deckPanelActions button[data-deck-panel-action="library"]::before{ content:"L"; }
    .deckPanelActions button[data-deck-panel-action="public"]::before{ content:"P"; }
    .deckPanelActions button[data-deck-panel-action="play"]::before{ content:"▶"; }
    .deckPanelActions button:hover{
      transform:translateY(-1px);
      border-color:rgba(105,180,255,.44);
      background:rgba(105,180,255,.12);
    }
    .deckPanelActions button.isActive{
      border-color:rgba(100,210,255,.62);
      background:linear-gradient(180deg, rgba(70,150,220,.22), rgba(35,95,150,.16));
      box-shadow:0 0 16px rgba(90,170,255,.22), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .deckPanelActions button[data-deck-panel-action="play"]{
      border-color:rgba(125,255,180,.34);
      background:linear-gradient(180deg, rgba(90,210,145,.16), rgba(50,130,90,.12));
    }
    .deckPanelActions button[data-deck-panel-action="play"].isReady{
      border-color:rgba(185,255,80,.68);
      color:#efffd9;
      background:
        linear-gradient(90deg, rgba(190,255,65,.34), rgba(55,220,160,.20)),
        rgba(0,0,0,.22);
      box-shadow:0 0 22px rgba(170,255,80,.30), inset 0 1px 0 rgba(255,255,255,.12);
    }
    #deckPanel > .bd{
      min-height:0 !important;
      display:flex !important;
      flex-direction:column !important;
      gap:8px !important;
    }
    #deckPanel > .hd{
      flex-wrap:nowrap !important;
      gap:8px !important;
      min-width:0 !important;
    }
    #deckPanel > .hd > b{
      flex:0 0 auto !important;
      min-width:max-content !important;
      white-space:nowrap !important;
      word-break:keep-all !important;
      line-height:1.2 !important;
    }
    #deckPanel > .hd > .row{
      min-width:0 !important;
      flex:1 1 auto !important;
    }
    #deckPanel .deckSaveDock{
      position:relative !important;
      flex:0 0 auto !important;
      transition:max-height .2s ease, opacity .16s ease, transform .18s ease;
      border-color:rgba(105,180,255,.24) !important;
      border-radius:18px !important;
      padding:10px !important;
      background:
        radial-gradient(520px 160px at 18% 0%, rgba(105,180,255,.18), transparent 62%),
        radial-gradient(520px 180px at 88% 0%, rgba(120,255,170,.10), transparent 64%),
        rgba(0,0,0,.24) !important;
      box-shadow:0 18px 48px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.07);
      overflow:hidden !important;
    }
    #deckPanel .deckSaveDock::before{
      content:"";
      position:absolute;
      right:-16px;
      top:-12px;
      width:150px;
      height:112px;
      background:
        linear-gradient(90deg, rgba(0,0,0,.22), transparent 44%),
        url("./assets/deck/deck-lab-art.webp") center/cover no-repeat;
      opacity:.22;
      filter:saturate(1.12) contrast(1.04);
      border-radius:0 18px 0 38px;
      pointer-events:none;
      mix-blend-mode:screen;
    }
    #deckPanel .deckSaveDock::after{
      content:"";
      position:absolute;
      right:18px;
      top:18px;
      width:62px;
      height:62px;
      border-radius:18px;
      border:1px solid rgba(120,255,190,.16);
      background:
        radial-gradient(circle at 42% 38%, rgba(185,255,55,.30), transparent 36%),
        linear-gradient(135deg, rgba(105,180,255,.16), rgba(0,0,0,.08));
      box-shadow:0 0 30px rgba(120,255,190,.08), inset 0 1px 0 rgba(255,255,255,.08);
      opacity:.34;
      pointer-events:none;
      transform:rotate(-8deg);
    }
    #deckPanel .deckSaveDock.isCollapsed{
      display:none !important;
    }
    #deckPanel .deckSaveDock.isCollapsed{
      padding:8px 10px !important;
    }
    #deckPanel .deckSaveDock.isCollapsed .deckSaveDockHead{
      margin-bottom:0 !important;
    }
    #deckPanel .deckSaveDockHead{
      position:relative;
      z-index:1;
      margin-bottom:8px !important;
      padding:8px 10px !important;
      border-radius:13px !important;
      border:1px solid rgba(255,255,255,.10) !important;
      background:
        linear-gradient(90deg, rgba(105,180,255,.12), rgba(120,255,190,.06)),
        rgba(0,0,0,.18) !important;
    }
    #deckPanel .deckSaveDockHeadMain b{
      font-size:0 !important;
    }
    #deckPanel .deckSaveDockHeadMain b::before{
      content:"デッキ管理";
      font-size:14px !important;
      letter-spacing:.04em;
    }
    #deckPanel .deckSaveDockHeadMain span{
      font-size:11px !important;
      color:rgba(220,240,255,.70) !important;
    }
    #deckPanel .deckSaveRow{
      position:relative;
      z-index:1;
      display:grid !important;
      grid-template-columns:minmax(0, 1fr) auto !important;
      gap:8px !important;
      align-items:center !important;
      padding:9px !important;
      border:1px solid rgba(255,255,255,.10) !important;
      border-radius:14px !important;
      background:rgba(0,0,0,.18) !important;
      margin-bottom:8px !important;
    }
    #deckPanel .deckSaveRow #deckTitle{
      width:100% !important;
      min-width:0 !important;
      flex:1 1 auto !important;
      height:42px !important;
      border-radius:13px !important;
      background:rgba(0,0,0,.26) !important;
    }
    #deckPanel .deckSaveRow #btnSave{
      min-width:126px !important;
      min-height:42px !important;
      border-radius:13px !important;
      white-space:nowrap !important;
      box-shadow:0 0 0 1px rgba(255,225,150,.18), 0 12px 30px rgba(0,0,0,.30) !important;
    }
    #deckPanel .deckInfoDock{
      flex:1 1 auto !important;
      min-height:0 !important;
      gap:7px !important;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.10);
      background:
        radial-gradient(520px 160px at 10% 0%, rgba(120,255,190,.09), transparent 62%),
        rgba(0,0,0,.13);
      padding:10px;
    }
    .roomOpHero{
      position:relative;
      min-height:164px;
    }
    .roomOpHero::after{
      content:"";
      position:absolute;
      right:-20px;
      bottom:-24px;
      width:190px;
      height:128px;
      background:
        linear-gradient(90deg, rgba(0,0,0,.26), transparent 42%),
        url("./assets/home/menu-room.webp") center/cover no-repeat;
      opacity:.30;
      filter:saturate(1.18) contrast(1.05);
      border-radius:44px 0 18px 0;
      pointer-events:none;
      mix-blend-mode:screen;
    }
    .roomOpHero .roomOpKicker,
    .roomOpHero .roomOpTitle,
    .roomOpHero .roomOpLead{
      position:relative;
      z-index:1;
      max-width:68%;
    }
    .roomOpMapCardHidden{
      display:none !important;
    }
    .roomOpHero.isBattleGate{
      min-height:150px;
      border-color:rgba(120,255,190,.22) !important;
      background:
        radial-gradient(380px 190px at 82% 18%, rgba(105,180,255,.23), transparent 64%),
        radial-gradient(360px 180px at 0% 0%, rgba(185,255,55,.10), transparent 58%),
        linear-gradient(135deg, rgba(20,30,40,.95), rgba(8,10,14,.94)) !important;
      box-shadow:0 20px 48px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.08) !important;
    }
    .roomOpHero.isBattleGate::before{
      content:"";
      position:absolute;
      inset:0;
      background:
        linear-gradient(110deg, transparent 0 30%, rgba(255,255,255,.08) 40%, transparent 52%),
        repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 1px, transparent 1px 12px);
      opacity:.48;
      pointer-events:none;
    }
    .roomOpHero.isBattleGate .roomOpKicker{
      display:inline-flex;
      width:max-content;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(185,255,55,.26);
      background:rgba(185,255,55,.09);
    }
    .roomOpHero.isBattleGate .roomOpTitle{
      font-size:26px;
      line-height:1.1;
      text-shadow:0 0 24px rgba(120,255,190,.16);
    }
    .roomOpHero.isBattleGate .roomOpLead{
      max-width:74%;
      color:rgba(235,245,255,.76);
    }
    .roomStartBody{
      gap:12px !important;
    }
    .roomActionGrid{
      display:grid;
      grid-template-columns:repeat(2, minmax(0, 1fr));
      gap:10px;
    }
    .roomActionCard,
    .roomJoinCard{
      position:relative;
      overflow:hidden;
      border:1px solid rgba(255,255,255,.11);
      border-radius:17px;
      background:
        radial-gradient(240px 120px at 20% 0%, rgba(105,180,255,.13), transparent 62%),
        rgba(255,255,255,.045);
      padding:12px;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
    }
    .roomActionCard::after,
    .roomJoinCard::after{
      content:"";
      position:absolute;
      right:-30px;
      top:-40px;
      width:110px;
      height:110px;
      border-radius:50%;
      background:rgba(120,255,190,.10);
      pointer-events:none;
    }
    .roomActionCard b,
    .roomJoinCard b{
      display:block;
      font-size:15px;
      letter-spacing:.04em;
      margin-bottom:4px;
    }
    .roomActionCard small,
    .roomJoinCard small{
      display:block;
      min-height:32px;
      color:rgba(220,235,245,.64);
      font-size:12px;
      line-height:1.35;
      margin-bottom:10px;
    }
    .roomActionCard .btn,
    .roomActionCard .btnGhost,
    .roomJoinCard .btn{
      width:100%;
      min-height:44px;
      border-radius:14px;
      position:relative;
      z-index:1;
    }
    .roomJoinLine{
      display:grid;
      grid-template-columns:minmax(0, 1fr) 92px;
      gap:8px;
      align-items:center;
    }
    .roomJoinLine .input{
      height:44px;
      border-radius:14px;
      position:relative;
      z-index:1;
    }
    .roomEntryNote{
      padding:10px 12px;
      border-radius:14px;
      border:1px solid rgba(185,255,55,.14);
      background:rgba(185,255,55,.055);
      color:rgba(235,245,255,.72);
      font-size:12px;
      line-height:1.45;
    }
    @media (max-width:620px){
      .roomOpHero.isBattleGate{
        min-height:128px;
      }
      .roomOpHero.isBattleGate .roomOpLead{
        max-width:100%;
      }
      .roomActionGrid{
        grid-template-columns:1fr;
      }
      .roomJoinLine{
        grid-template-columns:1fr;
      }
    }
    #deckPanel .deckInfoDockHead{
      padding:9px 11px !important;
      min-height:38px !important;
      border-color:rgba(255,255,255,.10) !important;
      background:
        linear-gradient(90deg, rgba(120,255,190,.10), rgba(105,180,255,.07)),
        rgba(0,0,0,.24) !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
    }
    #deckPanel .deckInfoDockHeadMain b{
      font-size:14px !important;
    }
    #deckPanel .deckInfoDockHeadMain b::before{
      content:"採用カード";
    }
    #deckPanel .deckInfoDockHeadMain b{
      font-size:0 !important;
    }
    #deckPanel .deckInfoDockHeadMain b::before{
      font-size:14px !important;
    }
    #deckPanel .deckInfoDockHeadMain span{
      font-size:11px !important;
    }
    #deckPanel .listHead{
      min-height:34px !important;
      padding:7px 11px !important;
      border-radius:10px !important;
      border:1px solid rgba(255,255,255,.09) !important;
      background:
        linear-gradient(90deg, rgba(255,255,255,.055), rgba(255,255,255,.015)),
        rgba(0,0,0,.22) !important;
    }
    #deckPanel .listHead b{
      font-size:13px !important;
      display:inline-flex;
      align-items:center;
      gap:7px;
    }
    #deckPanel .listHead b::before{
      content:"";
      width:7px;
      height:7px;
      border-radius:50%;
      background:#78e3ad;
      box-shadow:0 0 12px rgba(120,255,190,.8);
    }
    #deckPanel .deckInfoBody{
      min-height:0 !important;
      flex:1 1 auto !important;
      display:flex !important;
      flex-direction:column !important;
      gap:7px !important;
    }
    #deckList{
      flex:1 1 auto !important;
      min-height:160px !important;
      overflow:auto !important;
      display:flex !important;
      flex-direction:column !important;
      gap:6px !important;
      padding:4px 2px 8px !important;
      scroll-behavior:auto !important;
      scrollbar-width:thin;
      scrollbar-color:rgba(120,255,190,.30) rgba(0,0,0,.12);
    }
    #deckList::-webkit-scrollbar{
      width:9px;
    }
    #deckList::-webkit-scrollbar-track{
      background:rgba(0,0,0,.12);
      border-radius:999px;
    }
    #deckList::-webkit-scrollbar-thumb{
      background:linear-gradient(180deg, rgba(105,180,255,.38), rgba(120,255,190,.34));
      border:2px solid rgba(0,0,0,0);
      background-clip:padding-box;
      border-radius:999px;
    }
    #deckList .cardRow{
      --row-attr:#7dd3fc;
      position:relative !important;
      isolation:isolate;
      min-height:52px !important;
      padding:7px 9px 7px 14px !important;
      border-radius:12px !important;
      gap:8px !important;
      align-items:center !important;
      border:1px solid rgba(255,255,255,.095) !important;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--row-attr) 9%, transparent), rgba(255,255,255,.018)),
        rgba(0,0,0,.22) !important;
      box-shadow:0 10px 22px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04);
      transition:transform .08s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease;
    }
    #deckList .cardRow::before{
      content:"";
      position:absolute;
      left:0;
      top:8px;
      bottom:8px;
      width:4px;
      border-radius:0 999px 999px 0;
      background:var(--row-attr);
      box-shadow:0 0 14px color-mix(in srgb, var(--row-attr) 72%, transparent);
      z-index:-1;
    }
    #deckList .cardRow:hover{
      transform:translateY(-1px);
      border-color:color-mix(in srgb, var(--row-attr) 44%, rgba(255,255,255,.12)) !important;
      box-shadow:0 14px 30px rgba(0,0,0,.30), 0 0 18px color-mix(in srgb, var(--row-attr) 18%, transparent);
    }
    #deckList .cardRow.isMaxed{
      border-color:color-mix(in srgb, var(--row-attr) 34%, rgba(255,255,255,.18)) !important;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--row-attr) 15%, transparent), rgba(255,255,255,.025)),
        rgba(0,0,0,.26) !important;
    }
    #deckList .cardRow.isMaxed::after{
      content:"MAX";
      position:absolute;
      right:calc(var(--deck-list-control-w) + 12px);
      top:8px;
      padding:1px 6px;
      border-radius:999px;
      border:1px solid color-mix(in srgb, var(--row-attr) 42%, rgba(255,255,255,.16));
      color:color-mix(in srgb, var(--row-attr) 72%, white);
      background:rgba(0,0,0,.36);
      font-size:9px;
      font-weight:950;
      letter-spacing:.08em;
      pointer-events:none;
    }
    #cardList .cardRow{
      --row-attr:#7dd3fc;
      position:relative !important;
      isolation:isolate;
      border-color:color-mix(in srgb, var(--row-attr) 26%, rgba(255,255,255,.10)) !important;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--row-attr) 9%, transparent), rgba(255,255,255,.018)),
        rgba(0,0,0,.22) !important;
    }
    #cardList .cardRow::before{
      content:"";
      position:absolute;
      left:0;
      top:12px;
      bottom:12px;
      width:5px;
      border-radius:0 999px 999px 0;
      background:var(--row-attr);
      box-shadow:0 0 16px color-mix(in srgb, var(--row-attr) 70%, transparent);
      pointer-events:none;
      z-index:0;
    }
    #cardList .cardRow > *{
      position:relative;
      z-index:1;
    }
    #cardList .cardRow[data-type="火"],
    #deckList .cardRow[data-type="火"]{ --row-attr:#ff5a58; }
    #cardList .cardRow[data-type="水"],
    #deckList .cardRow[data-type="水"]{ --row-attr:#45a9ff; }
    #cardList .cardRow[data-type="雷"],
    #deckList .cardRow[data-type="雷"]{ --row-attr:#ffe05c; }
    #cardList .cardRow[data-type="草"],
    #deckList .cardRow[data-type="草"]{ --row-attr:#60d978; }
    #cardList .cardRow[data-type="風"],
    #deckList .cardRow[data-type="風"]{ --row-attr:#7ee7d2; }
    #cardList .cardRow[data-type="鋼"],
    #deckList .cardRow[data-type="鋼"]{ --row-attr:#b9c3d6; }
    #cardList .cardRow[data-type="光"],
    #deckList .cardRow[data-type="光"]{ --row-attr:#fff1a8; }
    #cardList .cardRow[data-type="闇"],
    #deckList .cardRow[data-type="闇"]{ --row-attr:#b066ff; }
    #cardList .cardRow[data-type="幻"],
    #deckList .cardRow[data-type="幻"]{ --row-attr:#ff92d6; }
    #cardList .cardRow[data-type="呪"],
    #deckList .cardRow[data-type="呪"]{ --row-attr:#c084fc; }
    .attrBadge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:28px;
      height:21px;
      padding:0 8px;
      margin-left:2px;
      border-radius:999px;
      border:1px solid color-mix(in srgb, var(--row-attr) 54%, rgba(255,255,255,.18));
      background:color-mix(in srgb, var(--row-attr) 16%, rgba(0,0,0,.24));
      color:color-mix(in srgb, var(--row-attr) 68%, white);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 0 13px color-mix(in srgb, var(--row-attr) 20%, transparent);
      font-size:11px;
      font-weight:950;
      line-height:1;
      white-space:nowrap;
    }
    #cardList .cardRow[data-kind="support"],
    #cardList .cardRow[data-kind="ex_support"]{
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--row-attr) 7%, transparent), rgba(255,255,255,.012)),
        linear-gradient(90deg, rgba(174,180,188,.16), rgba(174,180,188,.04) 58%, transparent),
        rgba(0,0,0,.24) !important;
    }
    #deckList .cardRow[data-kind="support"],
    #deckList .cardRow[data-kind="ex_support"]{
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--row-attr) 8%, transparent), rgba(255,255,255,.012)),
        linear-gradient(90deg, rgba(174,180,188,.14), rgba(174,180,188,.035) 58%, transparent),
        rgba(0,0,0,.24) !important;
    }
    #deckList .cardRow .name{
      display:block !important;
      white-space:nowrap !important;
      overflow:hidden !important;
      text-overflow:ellipsis !important;
      font-size:13px !important;
      line-height:1.25 !important;
      color:rgba(255,255,255,.96) !important;
      text-shadow:0 1px 8px rgba(0,0,0,.45);
    }
    #deckList .cardRow .sub{
      margin-top:3px !important;
      -webkit-line-clamp:1 !important;
      font-size:11px !important;
      line-height:1.28 !important;
      color:rgba(255,255,255,.62) !important;
    }
    #deckList .cardRow .btns{
      width:var(--deck-list-control-w) !important;
      min-width:var(--deck-list-control-w) !important;
      max-width:var(--deck-list-control-w) !important;
      flex:0 0 var(--deck-list-control-w) !important;
      grid-template-columns:62px 38px minmax(58px,1fr) 38px !important;
      grid-template-areas:
        "detail plus count minus"
        "ex ex ex ex" !important;
      gap:5px !important;
    }
    #deckList .cardRow .btns button,
    #deckList .cardRow .btns .count,
    #deckList .cardRow .btns .cnt{
      min-height:28px !important;
      height:28px !important;
      border-radius:10px !important;
      font-size:12px !important;
      line-height:1 !important;
      border-color:rgba(255,255,255,.11) !important;
      background:rgba(0,0,0,.24) !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.045);
      white-space:nowrap !important;
      overflow:hidden !important;
      text-overflow:ellipsis !important;
      word-break:keep-all !important;
      overflow-wrap:normal !important;
    }
    #deckList .cardRow .btns [data-plus]{
      border-color:color-mix(in srgb, var(--row-attr) 42%, rgba(255,255,255,.12)) !important;
      background:color-mix(in srgb, var(--row-attr) 14%, rgba(0,0,0,.34)) !important;
      color:#fff !important;
    }
    #deckList .cardRow .btns .count,
    #deckList .cardRow .btns .cnt{
      color:rgba(255,255,255,.9) !important;
      font-weight:950;
    }
    #deckList .cardRow .btns [data-detail]{
      font-size:12px !important;
    }
    #deckList .cardRow .btns [data-ex],
    #deckList .cardRow .btns [data-expick]{
      font-size:11px !important;
      letter-spacing:0 !important;
      white-space:nowrap !important;
      word-break:keep-all !important;
      overflow-wrap:normal !important;
    }
    .deckEmptyHint{
      min-height:120px;
      display:grid;
      place-items:center;
      text-align:center;
      padding:20px;
      border:1px dashed rgba(120,255,190,.24);
      border-radius:16px;
      color:rgba(255,255,255,.65);
      background:
        radial-gradient(300px 120px at 50% 20%, rgba(105,180,255,.12), transparent 64%),
        rgba(255,255,255,.025);
      line-height:1.6;
    }
    .deckEmptyHint b{
      color:rgba(235,255,245,.96);
      font-size:15px;
    }
    .deckExSummary{
      margin-top:2px !important;
      padding:8px 10px !important;
      border:1px solid rgba(255,220,120,.17) !important;
      border-radius:12px !important;
      background:
        linear-gradient(90deg, rgba(255,210,100,.07), rgba(0,0,0,.14)),
        rgba(0,0,0,.14) !important;
      flex:0 0 auto;
    }
    .deckExSummary[data-empty="true"]{
      opacity:.72;
    }
    #deckPanel:not(.showDeckLab) .deckLab{
      display:none !important;
    }
    #deckPanel.showDeckLab .deckLab{
      display:block !important;
      flex:0 0 auto;
    }
    #deckPanel.showDeckLab #deckList{
      min-height:120px !important;
    }
    #deckPanel .deckLab{
      max-height:min(44vh, 420px);
      overflow:auto;
    }
    #deckPanel .deckSaveDock .deckLibBox{
      max-height:none !important;
      overflow:hidden !important;
      border-radius:16px !important;
      border-color:rgba(105,180,255,.24) !important;
      margin-top:0 !important;
      box-shadow:0 12px 34px rgba(0,0,0,.32) !important;
    }
    #deckPanel .deckSaveDock .deckLibHd{
      padding:9px 11px !important;
      min-height:40px !important;
    }
    #deckPanel .deckSaveDock .deckLibBd{
      padding:10px !important;
      display:grid !important;
      gap:9px !important;
      min-width:0 !important;
    }
    #deckPanel .deckSaveDock .deckLibModeTabs{
      margin:0 !important;
      border-radius:14px !important;
      gap:5px !important;
    }
    #deckPanel .deckSaveDock .deckLibModeBtn{
      min-height:34px !important;
      border-radius:11px !important;
      font-size:12px !important;
    }
    #deckPanel .deckSaveDock .deckLibSection{
      border-radius:14px !important;
    }
    #deckPanel .deckSaveDock .deckLibSectionHd,
    #deckPanel .deckSaveDock .deckLibSectionBd{
      padding:9px !important;
    }
    #deckPanel .deckSaveDock .deckLibSub{
      display:none !important;
    }
    #deckPanel .deckSaveDock .deckLibSaveBtns{
      display:grid !important;
      grid-template-columns:1fr 1fr !important;
      gap:8px !important;
    }
    #deckPanel .deckSaveDock .deckLibSaveBtns .btn,
    #deckPanel .deckSaveDock .deckLibSaveBtns .btnGhost{
      min-height:40px !important;
      padding:8px 10px !important;
      font-size:12px !important;
      min-width:0 !important;
    }
    #deckPanel .deckSaveDock .deckLibSelect{
      width:100% !important;
      min-width:0 !important;
      min-height:40px !important;
    }
    #deckPanel .deckSaveDock .deckLibRow{
      gap:7px !important;
      min-width:0 !important;
    }
    #deckPanel .deckSaveDock .deckLibRow .input{
      min-width:0 !important;
      flex:1 1 150px !important;
    }
    #deckPanel .deckSaveDock .deckLibMini:last-child{
      display:none !important;
    }
    #deckPanel .deckSaveDock .deckLibLine{
      grid-template-columns:30px minmax(0, 1fr) auto auto auto !important;
      gap:6px !important;
      min-width:0 !important;
    }
    #deckPanel .deckSaveDock .deckLibTitleOne{
      font-size:13px !important;
    }
    #deckPanel .deckSaveDock .deckLibLine .btn,
    #deckPanel .deckSaveDock .deckLibLine .btnGhost{
      min-height:34px !important;
      padding:7px 10px !important;
      font-size:12px !important;
    }
    #deckPanel .deckSaveDock .deckLibList{
      max-height:min(24vh, 230px) !important;
      overflow-y:auto !important;
      overflow-x:hidden !important;
      padding-right:4px !important;
      gap:7px !important;
    }
    #deckPanel .deckSaveDock .deckLibCard{
      padding:9px 9px 9px 12px !important;
      border-radius:13px !important;
    }
    #deckPanel .deckSaveDock .deckLibDetails{
      margin-top:7px !important;
      padding-top:7px !important;
    }
    #deckPanel .deckSaveDock .deckLibMeta{
      grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
      gap:6px !important;
    }
    #deckPanel .deckSaveDock .deckLibPager{
      margin:7px 0 0 !important;
      padding:6px !important;
    }
    .deckSaveDock.isDeckDockSpotlight{
      box-shadow:0 0 0 1px rgba(105,180,255,.36), 0 0 28px rgba(105,180,255,.16);
    }
    @media (max-width:640px){
      #deckPanel{
        --deck-list-control-w:176px;
      }
      .deckPanelActions{
        width:100%;
        justify-content:space-between;
      }
      .deckPanelActions button{
        flex:1 1 auto;
        padding:7px 8px;
        font-size:12px;
      }
      #deckList .cardRow .btns{
        width:var(--deck-list-control-w) !important;
        min-width:var(--deck-list-control-w) !important;
        max-width:var(--deck-list-control-w) !important;
        flex-basis:var(--deck-list-control-w) !important;
        grid-template-columns:36px minmax(56px,1fr) 54px !important;
      }
      #deckList .cardRow{
        min-height:68px !important;
        padding:7px 8px 7px 12px !important;
      }
      #deckPanel .deckSaveRow{
        grid-template-columns:1fr !important;
      }
      #deckPanel .deckSaveRow #btnSave{
        width:100% !important;
      }
      #deckPanel .deckSaveDock .deckLibSaveBtns{
        grid-template-columns:1fr !important;
      }
      #deckPanel .deckSaveDock .deckLibLine{
        grid-template-columns:28px minmax(0, 1fr) auto !important;
        grid-template-areas:
          "toggle title vis"
          ". load del" !important;
      }
      #deckPanel .deckSaveDock .deckLibExpand{ grid-area:toggle; }
      #deckPanel .deckSaveDock .deckLibTitleOne{ grid-area:title; }
      #deckPanel .deckSaveDock .deckLibLine > .deckLibBadge{ grid-area:vis; }
      #deckPanel .deckSaveDock .deckLibLine [data-load]{ grid-area:load; }
      #deckPanel .deckSaveDock .deckLibLine [data-del]{ grid-area:del; }
      #deckPanel .deckSaveDock .deckLibList{
        max-height:220px !important;
      }
      #deckList .cardRow .name{
        font-size:12px !important;
      }
      #deckList .cardRow .sub{
        font-size:10.5px !important;
      }
    }
  `;
  document.head.appendChild(css);
}

function ensureDeckPanelLayoutGuardCss() {
  if (document.getElementById("deckPanelLayoutGuardCss_v20260912")) return;
  const css = document.createElement("style");
  css.id = "deckPanelLayoutGuardCss_v20260912";
  css.textContent = `
    #deckPanel > .hd{
      display:grid !important;
      grid-template-columns:minmax(128px, 1fr) auto auto 42px !important;
      grid-template-areas:
        "title count clear min"
        "actions actions actions actions" !important;
      align-items:center !important;
      gap:8px !important;
      min-height:auto !important;
      padding:10px 12px !important;
    }
    #deckPanel > .hd .panelHdText{
      grid-area:title !important;
      display:flex !important;
      flex-direction:column !important;
      justify-content:center !important;
      min-width:0 !important;
      max-width:100% !important;
      white-space:nowrap !important;
      writing-mode:horizontal-tb !important;
      word-break:keep-all !important;
      overflow:hidden !important;
    }
    #deckPanel > .hd .panelHdText b{
      display:inline-flex !important;
      align-items:center !important;
      gap:8px !important;
      max-width:100% !important;
      white-space:nowrap !important;
      writing-mode:horizontal-tb !important;
      word-break:keep-all !important;
      overflow:hidden !important;
      text-overflow:ellipsis !important;
      line-height:1.2 !important;
      letter-spacing:.04em !important;
    }
    #deckPanel > .hd .panelHdText b::before{
      content:"" !important;
      flex:0 0 auto !important;
      width:10px !important;
      height:18px !important;
      border-radius:999px !important;
      background:linear-gradient(180deg, #7dd3fc, #78e3ad) !important;
      box-shadow:0 0 18px rgba(110,220,255,.42) !important;
    }
    #deckPanel > .hd .panelHdText span{
      display:block !important;
      max-width:100% !important;
      overflow:hidden !important;
      text-overflow:ellipsis !important;
      white-space:nowrap !important;
      font-size:11px !important;
      color:rgba(220,240,255,.68) !important;
    }
    #deckPanel > .hd > .row{
      display:contents !important;
    }
    #deckPanel > .hd .pill{
      grid-area:count !important;
      justify-self:end !important;
      white-space:nowrap !important;
      min-width:max-content !important;
      margin:0 !important;
    }
    #deckPanel #btnClearDeck{
      grid-area:clear !important;
      position:static !important;
      inset:auto !important;
      transform:none !important;
      justify-self:end !important;
      min-width:76px !important;
      min-height:38px !important;
      margin:0 !important;
      white-space:nowrap !important;
      z-index:auto !important;
    }
    #deckPanel #deckPanelMinBtn{
      grid-area:min !important;
      position:static !important;
      inset:auto !important;
      transform:none !important;
      justify-self:end !important;
      width:38px !important;
      height:38px !important;
      min-width:38px !important;
      margin:0 !important;
      z-index:auto !important;
    }
    #deckPanel .deckPanelActions{
      grid-area:actions !important;
      width:100% !important;
      min-width:0 !important;
      display:grid !important;
      grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
      gap:8px !important;
      justify-content:stretch !important;
      align-items:stretch !important;
    }
    #deckPanel .deckPanelActions button{
      width:100% !important;
      min-width:0 !important;
      min-height:36px !important;
      padding:7px 9px !important;
      overflow:hidden !important;
      text-overflow:ellipsis !important;
      white-space:nowrap !important;
    }
    #deckPanel .deckPanelActions button[data-deck-panel-action="public"],
    #deckPanel .deckPanelActions button[data-deck-panel-action="play"]{
      display:none !important;
    }
    @media (max-width:720px){
      #deckPanel > .hd{
        grid-template-columns:minmax(88px, 1fr) auto 36px !important;
        grid-template-areas:
          "title clear min"
          "actions actions actions" !important;
        gap:7px !important;
        padding:9px 10px !important;
      }
      #deckPanel > .hd .pill{
        display:none !important;
      }
      #deckPanel #btnClearDeck{
        min-width:64px !important;
        min-height:34px !important;
        padding:6px 9px !important;
        font-size:12px !important;
      }
      #deckPanel #deckPanelMinBtn{
        width:34px !important;
        height:34px !important;
        min-width:34px !important;
      }
      #deckPanel .deckPanelActions{
        grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
        gap:6px !important;
      }
      #deckPanel .deckPanelActions button{
        min-height:34px !important;
        padding:6px 6px !important;
        font-size:12px !important;
      }
      #deckPanel > .hd .panelHdText b{
        font-size:14px !important;
      }
      #deckPanel > .hd .panelHdText span{
        display:none !important;
      }
    }
  `;
  document.head.appendChild(css);
}

function attrGlowColor(cardId) {
  const t = String(cardDefs?.[cardId]?.type || "").trim();
  const map = {
    火: "#ff5a58",
    水: "#45a9ff",
    雷: "#ffe05c",
    草: "#60d978",
    風: "#7ee7d2",
    鋼: "#b9c3d6",
    光: "#fff1a8",
    闇: "#b066ff",
    幻: "#ff92d6",
    呪: "#c084fc",
  };
  return map[t] || "#6ab7ff";
}

function flashDeckAdd(cardId) {
  const color = attrGlowColor(cardId);
  requestAnimationFrame(() => {
    const safeId =
      window.CSS?.escape?.(String(cardId)) ||
      String(cardId).replace(/["\\]/g, "\\$&");
    const rows = document.querySelectorAll(`[data-card-id="${safeId}"]`);
    rows.forEach((row) => {
      row.style.setProperty("--deck-add-color", color);
      row.classList.remove("deckAddFlash");
      void row.offsetWidth;
      row.classList.add("deckAddFlash");
      setTimeout(() => row.classList.remove("deckAddFlash"), 700);
    });
  });
}

function ensureFieldPicker() {
  if (document.getElementById("fieldPickDeck")) return;
  const wrap = document.createElement("div");
  wrap.id = "fieldPickDeck";
  wrap.className = "fieldPickDeck";
  wrap.innerHTML = `
    <label for="fieldSelect">マップ</label>
    <select id="fieldSelect" title="対戦で使うフィールド">
      ${FIELD_OPTIONS.map((f) => `<option value="${esc(f.id)}">${esc(f.label)}</option>`).join("")}
    </select>
    <span class="fieldPickDeckNote">この対戦に反映</span>
  `;
  const sel = wrap.querySelector("#fieldSelect");
  if (sel) {
    sel.value = loadDesiredField();
    sel.addEventListener("change", () => saveDesiredField(sel.value));
  }

  const roomFieldMount = document.getElementById("roomFieldMount");
  if (roomFieldMount) {
    roomFieldMount.appendChild(wrap);
  } else if (btnSettings?.parentElement) {
    btnSettings.parentElement.insertBefore(wrap, btnSettings);
  } else if (btnRule?.parentElement) {
    btnRule.parentElement.insertBefore(wrap, btnRule);
  } else {
    document.querySelector?.("header")?.appendChild(wrap);
  }
}

function setDeckDockCollapsed(box, btn, collapsed) {
  if (!box) return;
  box.classList.toggle("isCollapsed", !!collapsed);
  if (btn) {
    btn.textContent = collapsed ? "+" : "-";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "開く" : "最小化";
  }
  try {
    const key =
      box.id === "deckSaveDock"
        ? "tcg_deck_save_collapsed_v20260715"
        : "tcg_deck_info_collapsed_v20260715";
    localStorage.setItem(key, collapsed ? "1" : "0");
  } catch {}
}

function syncDeckPanelActionState() {
  const saveDock = document.getElementById("deckSaveDock");
  const panel = document.getElementById("deckPanel");
  const saveBtn = document.querySelector('[data-deck-panel-action="save"]');
  const listBtn = document.querySelector('[data-deck-panel-action="library"]');
  const publicBtn = document.querySelector('[data-deck-panel-action="public"]');
  const playBtn = document.querySelector('[data-deck-panel-action="play"]');
  const total = sumDeck(deckMap);
  saveBtn?.classList.toggle("isActive", !!saveDock && !saveDock.classList.contains("isCollapsed"));
  listBtn?.classList.remove("isActive");
  publicBtn?.classList.remove("isActive");
  playBtn?.classList.toggle("isReady", total === DECK_SIZE);
  panel?.classList.toggle("deckFull", total === DECK_SIZE);
  panel?.classList.toggle("deckAlmost", total >= DECK_SIZE - 5 && total < DECK_SIZE);
}

function openDeckLibraryDock(options = {}) {
  const panel = document.getElementById("deckPanel");
  const saveDock = document.getElementById("deckSaveDock");
  const saveMin = document.getElementById("deckSaveMinBtn");
  if (!panel || !saveDock) return;
  setDeckDockCollapsed(saveDock, saveMin, false);
  if (options.mode || options.tab) {
    window.dispatchEvent(
      new CustomEvent("tcg:deckLibraryOpen", {
        detail: { mode: options.mode || "search", tab: options.tab || "my" },
      }),
    );
  }
  saveDock.classList.add("isDeckDockSpotlight");
  syncDeckPanelActionState();
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => saveDock.classList.remove("isDeckDockSpotlight"), 900);
}

function setupDeckPanelWorkbench() {
  const panel = document.getElementById("deckPanel");
  const headRow = panel?.querySelector(":scope > .hd .row");
  if (!panel || !headRow) return;

  const saveDock = document.getElementById("deckSaveDock");
  const infoDock = document.getElementById("deckInfoDock");
  const saveMin = document.getElementById("deckSaveMinBtn");
  const infoMin = document.getElementById("deckInfoMinBtn");

  setDeckDockCollapsed(saveDock, saveMin, true);
  setDeckDockCollapsed(infoDock, infoMin, false);

  let actions = document.getElementById("deckPanelActions");
  if (!actions) {
    actions = document.createElement("div");
    actions.id = "deckPanelActions";
    actions.className = "deckPanelActions";
    const clearBtn = document.getElementById("btnClearDeck");
    headRow.insertBefore(actions, clearBtn || null);
  }

  if (actions.dataset.layoutVersion !== "20260926_deck_meta2") {
    actions.innerHTML = `
      <button type="button" data-deck-panel-action="save">保存</button>
      <button type="button" data-deck-panel-action="library">自分のデッキ</button>
    `;
    actions.dataset.layoutVersion = "20260926_deck_meta2";
    actions.dataset.bound = "";
  }

  if (actions.dataset.bound === "1") {
    syncDeckPanelActionState();
    return;
  }
  actions.dataset.bound = "1";

  actions.querySelector('[data-deck-panel-action="save"]')?.addEventListener("click", () => {
    const nextCollapsed = !saveDock?.classList.contains("isCollapsed") ? true : false;
    setDeckDockCollapsed(saveDock, saveMin, nextCollapsed);
    syncDeckPanelActionState();
    if (!nextCollapsed) {
      saveDock?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  actions.querySelector('[data-deck-panel-action="library"]')?.addEventListener("click", () => {
    const url = new URL("./deck_list.html", location.href);
    url.searchParams.set("mode", "my");
    if (roomId) url.searchParams.set("room", roomId);
    if (playerId) url.searchParams.set("player", playerId);
    navigateWithRouteTransition(url.href, "settings", {
      title: "MY DECKS",
      sub: "保存済みデッキを開きます。公開デッキもここから確認できます。",
    });
  });

  saveMin?.addEventListener("click", () => setTimeout(syncDeckPanelActionState, 0));
  infoMin?.addEventListener("click", () => setTimeout(syncDeckPanelActionState, 0));
  syncDeckPanelActionState();
}

function ensureDeckCriticalBlockCss() {
  if (document.getElementById("deckCriticalBlockCss")) return;
  const css = document.createElement("style");
  css.id = "deckCriticalBlockCss";
  css.textContent = `
    .libraryPanel,
    #deckPanel {
      min-height: 0 !important;
    }
    .libraryPanel:not(.isPanelCollapsed),
    #deckPanel:not(.isPanelCollapsed) {
      display: flex !important;
      flex-direction: column !important;
    }
    .libraryPanel > .hd {
      position: relative !important;
      padding-right: 64px !important;
    }
    .libraryPanel #libraryPanelMinBtn {
      position: absolute !important;
      top: 50% !important;
      right: 14px !important;
      transform: translateY(-50%) !important;
      width: 42px !important;
      height: 42px !important;
      min-width: 42px !important;
      z-index: 6 !important;
    }
    .libraryPanel.isPanelCollapsed > .bd,
    #deckPanel.isPanelCollapsed > .bd {
      display: none !important;
    }
    .libraryPanel > .bd {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
      display: grid !important;
      grid-template-rows: auto auto minmax(220px, 1fr) !important;
      gap: 10px !important;
    }
    .libraryPanel .listHead {
      display: grid !important;
      grid-template-columns: minmax(78px, auto) minmax(0, 1fr) !important;
      gap: 10px !important;
      align-items: center !important;
    }
    .libraryPanel .attrHintBox {
      min-height: 0 !important;
      max-width: 100% !important;
      padding: 8px 12px !important;
    }
    .libraryPanel .attrHintTitle {
      font-size: 14px !important;
      line-height: 1.2 !important;
    }
    .libraryPanel .attrHintText {
      max-height: 2.8em !important;
      overflow: hidden !important;
      font-size: 12px !important;
      line-height: 1.35 !important;
    }
    #cardFilters {
      flex: 0 0 auto !important;
    }
    #cardList {
      flex: 1 1 auto !important;
      min-height: 220px !important;
      max-height: clamp(260px, calc(100vh - 390px), 680px) !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding-right: 6px !important;
      scrollbar-gutter: stable !important;
      overscroll-behavior: contain !important;
      -webkit-overflow-scrolling: touch !important;
    }
    #deckPanel > .bd,
    #deckPanel .deckInfoDock,
    #deckPanel .deckInfoBody {
      min-height: 0 !important;
    }
    #deckPanel > .bd,
    #deckPanel .deckInfoBody {
      flex: 1 1 auto !important;
      overflow: hidden !important;
    }
    #deckPanel .deckInfoBody {
      display: flex !important;
      flex-direction: column !important;
    }
    #deckList {
      flex: 1 1 auto !important;
      min-height: 230px !important;
      max-height: clamp(240px, calc(100vh - 520px), 620px) !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding-right: 6px !important;
      scrollbar-gutter: stable !important;
      overscroll-behavior: contain !important;
      -webkit-overflow-scrolling: touch !important;
    }
    @media (max-width: 720px) {
      .libraryPanel > .hd,
      #deckPanel > .hd {
        position: relative !important;
      }
      .libraryPanel #libraryPanelMinBtn {
        right: 10px !important;
        width: 36px !important;
        height: 36px !important;
        min-width: 36px !important;
      }
      .libraryPanel > .bd {
        grid-template-rows: auto auto minmax(210px, 1fr) !important;
        gap: 8px !important;
        padding: 10px !important;
      }
      .libraryPanel .listHead {
        grid-template-columns: 1fr !important;
      }
      .libraryPanel .listHead > b {
        display: none !important;
      }
      .libraryPanel .attrHintBox {
        align-items: flex-start !important;
        padding: 6px 8px !important;
        text-align: left !important;
      }
      .libraryPanel .attrHintTitle {
        font-size: 12px !important;
      }
      .libraryPanel .attrHintText {
        max-height: 2.6em !important;
        font-size: 11px !important;
      }
      #cardFilters .filterRow {
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
      }
      #cardList {
        min-height: 260px !important;
        max-height: 55vh !important;
      }
      #deckList {
        min-height: 240px !important;
        max-height: 52vh !important;
      }
    }
  `;
  document.head.appendChild(css);
}

function ensureMobileDeckStackCss() {
  if (document.getElementById("deckMobileStackCss_20260926")) return;
  const css = document.createElement("style");
  css.id = "deckMobileStackCss_20260926";
  css.textContent = `
    @media (max-width: 860px) {
      html,
      body {
        overflow-x: hidden !important;
        max-width: 100vw !important;
      }
      body.deckMobileStackActive #mobileDeckStackShell,
      body.deckMobileStackActive .mobileDeckStackHost {
        display: flex !important;
        flex-direction: column !important;
        grid-template-columns: 1fr !important;
        align-items: stretch !important;
        gap: 12px !important;
        width: min(100%, calc(100vw - 16px)) !important;
        max-width: calc(100vw - 16px) !important;
        min-width: 0 !important;
        margin: 0 auto 16px !important;
        padding: 0 !important;
        overflow: visible !important;
        transform: none !important;
      }
      body.deckMobileStackActive #mobileDeckStackShell > .libraryPanel,
      body.deckMobileStackActive #mobileDeckStackShell > #deckPanel,
      body.deckMobileStackActive .mobileDeckStackHost > .libraryPanel,
      body.deckMobileStackActive .mobileDeckStackHost > #deckPanel {
        order: initial !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        position: relative !important;
        left: auto !important;
        right: auto !important;
        transform: none !important;
        float: none !important;
        overflow: hidden !important;
        flex: 0 0 auto !important;
        box-sizing: border-box !important;
      }
      body.deckMobileStackActive .libraryPanel {
        order: 1 !important;
      }
      body.deckMobileStackActive #deckPanel {
        order: 2 !important;
      }
      body.deckMobileStackActive .libraryPanel:not(.isPanelCollapsed) {
        max-height: 64vh !important;
      }
      body.deckMobileStackActive #deckPanel:not(.isPanelCollapsed) {
        max-height: 66vh !important;
      }
      body.deckMobileStackActive .libraryPanel.isPanelCollapsed,
      body.deckMobileStackActive #deckPanel.isPanelCollapsed {
        max-height: 88px !important;
        min-height: 0 !important;
      }
      body.deckMobileStackActive .libraryPanel > .hd,
      body.deckMobileStackActive #deckPanel > .hd {
        flex: 0 0 auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      body.deckMobileStackActive .libraryPanel > .bd,
      body.deckMobileStackActive #deckPanel > .bd {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
        max-width: 100% !important;
      }
      body.deckMobileStackActive #cardList,
      body.deckMobileStackActive #cardSections,
      body.deckMobileStackActive #deckList {
        min-height: 220px !important;
        max-height: none !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-y !important;
        overscroll-behavior: contain !important;
        max-width: 100% !important;
      }
      body.deckMobileStackActive .libraryPanel:not(.isPanelCollapsed) #cardList {
        height: calc(64vh - 190px) !important;
        min-height: 250px !important;
      }
      body.deckMobileStackActive .libraryPanel:not(.isPanelCollapsed) #cardSections {
        height: calc(64vh - 190px) !important;
        min-height: 250px !important;
      }
      body.deckMobileStackActive #deckPanel:not(.isPanelCollapsed) #deckList {
        height: calc(66vh - 255px) !important;
        min-height: 220px !important;
      }
      body.deckMobileStackActive #deckPanel .deckPanelActions {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        max-width: 100% !important;
        padding-bottom: 4px !important;
      }
      body.deckMobileStackActive #deckPanel .deckPanelActions button {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }
      body.deckMobileStackActive #cardList .cardRow,
      body.deckMobileStackActive #deckList .cardRow {
        max-width: 100% !important;
        min-width: 0 !important;
      }
    }
    @media (max-width: 480px) {
      body.deckMobileStackActive .libraryPanel,
      body.deckMobileStackActive #deckPanel {
        width: calc(100vw - 14px) !important;
        max-width: calc(100vw - 14px) !important;
      }
      body.deckMobileStackActive .libraryPanel:not(.isPanelCollapsed) {
        max-height: 65vh !important;
      }
      body.deckMobileStackActive #deckPanel:not(.isPanelCollapsed) {
        max-height: 67vh !important;
      }
      body.deckMobileStackActive .libraryPanel:not(.isPanelCollapsed) #cardList {
        height: calc(65vh - 180px) !important;
      }
      body.deckMobileStackActive .libraryPanel:not(.isPanelCollapsed) #cardSections {
        height: calc(65vh - 180px) !important;
      }
      body.deckMobileStackActive #deckPanel:not(.isPanelCollapsed) #deckList {
        height: calc(67vh - 245px) !important;
      }
    }
  `;
  document.head.appendChild(css);
}

function isMobileDeckStackViewport() {
  return (
    (window.matchMedia &&
      window.matchMedia("(max-width: 860px)").matches) ||
    window.innerWidth <= 860
  );
}

let mobileDeckStackOriginalSlots = null;

function rememberMobileDeckStackSlots(library, deck) {
  if (mobileDeckStackOriginalSlots) return;
  mobileDeckStackOriginalSlots = {
    libraryParent: library.parentNode,
    libraryNext: library.nextSibling,
    deckParent: deck.parentNode,
    deckNext: deck.nextSibling,
  };
}

function restoreMobileDeckStackSlots() {
  const shell = document.getElementById("mobileDeckStackShell");
  const library = document.querySelector(".libraryPanel");
  const deck = document.getElementById("deckPanel");

  if (mobileDeckStackOriginalSlots) {
    const { libraryParent, libraryNext, deckParent, deckNext } =
      mobileDeckStackOriginalSlots;
    if (library && libraryParent && library.parentNode !== libraryParent) {
      libraryParent.insertBefore(
        library,
        libraryNext && libraryNext.parentNode === libraryParent
          ? libraryNext
          : null,
      );
    }
    if (deck && deckParent && deck.parentNode !== deckParent) {
      deckParent.insertBefore(
        deck,
        deckNext && deckNext.parentNode === deckParent ? deckNext : null,
      );
    }
  }

  if (shell && shell.parentNode && !shell.children.length) shell.remove();
  document.body.classList.remove("deckMobileStackActive");
}

function enforceMobileDeckStack() {
  const library = document.querySelector(".libraryPanel");
  const deck = document.getElementById("deckPanel");
  if (!library || !deck) return;

  if (!isMobileDeckStackViewport()) {
    restoreMobileDeckStackSlots();
    return;
  }

  rememberMobileDeckStackSlots(library, deck);

  let shell = document.getElementById("mobileDeckStackShell");
  if (!shell) {
    shell = document.createElement("div");
    shell.id = "mobileDeckStackShell";
    shell.className = "mobileDeckStackHost";
    const anchor =
      mobileDeckStackOriginalSlots?.libraryParent &&
      mobileDeckStackOriginalSlots.libraryParent.contains(library)
        ? library
        : deck;
    const parent = anchor?.parentNode || document.body;
    parent.insertBefore(shell, anchor);
  }

  if (library.parentNode !== shell) shell.appendChild(library);
  if (deck.parentNode !== shell) shell.appendChild(deck);
  document.body.classList.add("deckMobileStackActive");
  library.style.removeProperty("transform");
  deck.style.removeProperty("transform");
}

function setupMobileDeckStack() {
  ensureMobileDeckStackCss();
  enforceMobileDeckStack();
  if (window.__deckMobileStackBound) return;
  window.__deckMobileStackBound = true;
  window.addEventListener("resize", () => setTimeout(enforceMobileDeckStack, 0), {
    passive: true,
  });
  window.addEventListener(
    "orientationchange",
    () => setTimeout(enforceMobileDeckStack, 120),
    { passive: true },
  );
  requestAnimationFrame(enforceMobileDeckStack);
  setTimeout(enforceMobileDeckStack, 250);
  setTimeout(enforceMobileDeckStack, 800);
}

function setupLibraryPanelWorkbench() {
  const panel = document.querySelector(".libraryPanel");
  const btn = document.getElementById("libraryPanelMinBtn");
  const wrap = document.querySelector(".wrap");
  if (!panel || !btn) return;

  const sync = () => {
    const collapsed = panel.classList.contains("isPanelCollapsed");
    btn.textContent = collapsed ? "+" : "-";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.title = collapsed ? "カード一覧を開く" : "カード一覧を最小化";
    wrap?.classList.toggle("libraryCollapsed", collapsed);
  };

  if (btn.dataset.deckCriticalBound !== "1") {
    btn.addEventListener("click", () => setTimeout(sync, 0));
    btn.dataset.deckCriticalBound = "1";
  }
  sync();
}

function setMsg(text, ok = false) {
  if (!msgEl) return;
  msgEl.style.color = ok ? "#9cff9c" : "#ff8080";
  msgEl.textContent = text || "";
}

async function toggleCardHidden(cardId, hidden) {
  try {
    const def = cardDefs[cardId];
    if (!def) return false;

    const targets = [];
    const kind = normalizedKindOf(def, cardId);

    if (kind === "support") {
      targets.push("support_cards", "supports", "supportCards");
    } else if (kind === "ex_support" || kind === "exsupport" || kind === "ex") {
      targets.push(
        "ex_support_cards",
        "ex_supports",
        "exSupportCards",
        "ex_support",
      );
    } else {
      targets.push("cards");
    }

    for (const col of targets) {
      await setDoc(
        doc(db, col, cardId),
        {
          hidden: !!hidden,
          hiddenUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (cardDefs[cardId]) {
      cardDefs[cardId].hidden = !!hidden;
    }

    return true;
  } catch (e) {
    console.error("toggleCardHidden failed:", e);
    setMsg("非公開更新に失敗しました", false);
    return false;
  }
}

function setHint(el, text, ok = true) {
  if (!el) return;
  el.style.color = ok ? "#9cff9c" : "#ff8080";
  el.textContent = text || "";
}
function shuffleInPlace(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== deck title =====
function loadDeckTitle() {
  try {
    return localStorage.getItem(DECK_TITLE_KEY) || "";
  } catch {
    return "";
  }
}
function saveDeckTitle(t) {
  try {
    localStorage.setItem(DECK_TITLE_KEY, String(t || ""));
  } catch {}
}
function normalizeDeckTitle(t) {
  const s = String(t || "").trim();
  return s ? s.slice(0, 32) : "";
}

// ===== inject deck title input under save row =====
function ensureDeckTitleInput() {
  const btn = document.getElementById("btnSave");
  if (!btn) return null;
  const row = btn.closest(".roomRow") || btn.parentElement;
  if (!row) return null;

  let input = document.getElementById("deckTitle");
  if (input) return input;

  input = document.createElement("input");
  input.id = "deckTitle";
  input.className = "input";
  input.placeholder = "デッキ名（例：速攻型）";
  input.maxLength = 32;
  input.style.flex = "1 1 220px";

  // 保存ボタンの手前に差し込む。
  row.insertBefore(input, btn);

  // restore
  const saved = normalizeDeckTitle(loadDeckTitle());
  if (saved) input.value = saved;

  input.addEventListener("input", () => {
    saveDeckTitle(normalizeDeckTitle(input.value));
  });

  return input;
}

const deckTitleInput = ensureDeckTitleInput();

// =====================
// Labels
// =====================
function kindLabel(kind) {
  const k = String(kind || "");
  if (!k) return "";
  if (k === "card" || k === "unit") return "unit";
  if (k === "support") return "サポート";
  if (k === "ex_support" || k === "exSupport") return "EXサポート";
  return k;
}

function normalizeKind(kind, def = null) {
  const direct = String(kind || "").trim().toLowerCase();
  const idText = String(def?.id || def?.cardId || "").trim().toLowerCase();
  const tokens = [
    direct,
    String(def?.kind || "").trim().toLowerCase(),
    String(def?.cardKind || "").trim().toLowerCase(),
    String(def?.cardType || "").trim().toLowerCase(),
    String(def?.type2 || "").trim().toLowerCase(),
    String(def?.category || "").trim().toLowerCase(),
  ].filter(Boolean);

  if (tokens.some((k) => k === "ex_support" || k === "exsupport" || k === "ex")) return "ex_support";
  if (tokens.some((k) => k === "support" || k === "サポート")) return "support";

  const typeText = String(def?.type || "").trim().toLowerCase();
  if (typeText === "support" || typeText === "サポート") return "support";
  if (/^s\d{3,}$/i.test(idText)) return "support";

  // 古いカード定義では kind が空でも effect だけを持つサポートがある。
  // cards コレクションから来た場合でも、効果カードはキャラ扱いにしない。
  if (!direct || direct === "card" || direct === "unit") {
    const hasSupportEffect =
      def && (def.effect != null || def.effects != null || def.effectText != null);
    const hasUnitActions =
      def &&
      ((Array.isArray(def.actions) && def.actions.length > 0) ||
        (Array.isArray(def.skills) && def.skills.length > 0));
    const hpNum = Number(def?.hp ?? def?.maxHp ?? def?.HP ?? 0);
    const spNum = Number(def?.sp ?? def?.maxSp ?? def?.SP ?? 0);
    const hasMeaningfulStats =
      (Number.isFinite(hpNum) && hpNum > 0) ||
      (Number.isFinite(spNum) && spNum > 0);
    if (hasSupportEffect && !hasUnitActions && !hasMeaningfulStats) return "support";
  }

  if (!direct || direct === "card" || direct === "character" || direct === "char") return "unit";
  return direct;
}

function normalizedKindOf(def, cardId = "") {
  const src = def ? { ...def, id: def.id || def.cardId || cardId } : { id: cardId };
  return normalizeKind(src?.kind || "", src);
}

function isExSupport(def, cardId = "") {
  const k = normalizedKindOf(def, cardId);
  return k === "ex_support" || k === "exsupport" || k === "ex";
}
function isSupport(def, cardId = "") {
  const k = normalizedKindOf(def, cardId);
  return k === "support";
}
function isSupportLike(def, cardId = "") {
  return isSupport(def, cardId) || isExSupport(def, cardId);
}
function filterKindForCard(def, cardId = "") {
  return isSupportLike(def, cardId) ? "support" : "unit";
}
function normalizeKindFilterValue(value) {
  const v = String(value || "all").trim().toLowerCase();
  if (!v || v === "all" || v === "全部" || v === "すべて") return "all";
  if (
    v === "unit" ||
    v === "card" ||
    v === "cards" ||
    v === "character" ||
    v === "chara" ||
    v === "char" ||
    v === "キャラ" ||
    v === "ユニット"
  ) {
    return "unit";
  }
  if (
    v === "support" ||
    v === "supports" ||
    v === "support_card" ||
    v === "サポート" ||
    v === "補助" ||
    v === "ex" ||
    v === "ex_support" ||
    v === "exsupport"
  ) {
    return "support";
  }
  return v;
}
function normalizeOwnedFilterValue(value) {
  const v = String(value || "all").trim().toLowerCase();
  if (!v || v === "all" || v === "全部" || v === "すべて") return "all";
  if (v === "owned" || v === "ownedonly" || v === "所持済み") return "owned";
  if (
    v === "missing" ||
    v === "unowned" ||
    v === "notowned" ||
    v === "未所持"
  ) {
    return "missing";
  }
  return v;
}
function activeKindFilter() {
  return normalizeKindFilterValue(document.body?.dataset?.kindFilter || filterKind || "all");
}
function activeOwnedFilter() {
  return normalizeOwnedFilterValue(document.body?.dataset?.ownedFilter || filterOwned || "all");
}
function passesCurrentCardFilters(cardId, def, notOwned = false) {
  const kindFilter = activeKindFilter();
  const ownedFilter = activeOwnedFilter();
  const kind = filterKindForCard(def, cardId);

  if (kindFilter === "unit" && kind !== "unit") return false;
  if (kindFilter === "support" && kind !== "support") return false;

  if (filterType !== "ALL" && kindFilter !== "support") {
    // 属性フィルタ中は、属性を持つキャラカードだけを対象にする。
    // サポートを見たい時は「サポート」タブで一覧できるようにする。
    if (kind !== "unit") return false;
    if (cardAttrForFilter(def) !== filterType) return false;
  }

  if (ownedFilter === "owned" && notOwned) return false;
  if ((ownedFilter === "missing" || ownedFilter === "unowned") && !notOwned) return false;

  return true;
}

function cardSearchText(cardId, def = {}) {
  return [
    cardId,
    def?.id,
    def?.name,
    def?.ruby,
    def?.series,
    def?.source,
    def?.theme,
    def?.pack,
    def?.type,
    def?.attr,
    def?.attribute,
    kindLabel(normalizedKindOf(def, cardId)),
  ]
    .filter((x) => x != null && String(x).trim())
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}
function cardAttrForFilter(def = {}) {
  const type = String(def?.type || "").trim();
  const attr = String(def?.attr || def?.attribute || def?.element || "").trim();
  const raw = type && type.toLowerCase() !== "support" ? type : attr;
  const aliases = {
    "炎": "火",
    "火属性": "火",
    "水属性": "水",
    "雷属性": "雷",
    "草属性": "草",
    "風属性": "風",
    "鋼属性": "鋼",
    "光属性": "光",
    "闇属性": "闇",
    "幻属性": "幻",
    "呪属性": "呪",
    curse: "呪",
    cursed: "呪",
    hex: "呪",
  };
  return aliases[raw] || raw;
}
function cardSubLine(def, cardId = "") {
  const kind = normalizedKindOf(def, cardId);
  const kindText = kind ? `${kindLabel(kind)} / ` : "";
  const statsText = isSupportLike(def, cardId)
    ? ""
    : def?.hp !== undefined || def?.sp !== undefined
      ? `HP:${esc(def.hp)} SP:${esc(def.sp)} / `
      : "";
  return `${kindText}${statsText}${esc(firstActionLine(def))}`;
}
function cardSmallMetaLine(def, cardId = "") {
  const kind = normalizedKindOf(def, cardId);
  const kindText = kind ? `種別:${esc(kindLabel(kind))}` : "";
  if (isSupportLike(def, cardId)) return kindText;
  const statsText =
    def?.hp !== undefined || def?.sp !== undefined
      ? `HP:${esc(def.hp)} / SP:${esc(def.sp)}`
      : "";
  return [kindText, statsText].filter(Boolean).join(" / ");
}
function isExSelectable(def, cardId = "") {
  return isExSupport(def, cardId) || isSupport(def, cardId);
}

function parseEffect(effect) {
  if (!effect) return null;
  if (typeof effect === "object") return effect;
  if (typeof effect === "string") {
    const s = effect.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return { raw: s };
    }
  }
  return null;
}

function supportSummaryText(def = {}) {
  const sources = [def?.effect, def?.effects, def?.effectText, def?.description, def?.text, def?.desc];
  for (const source of sources) {
    if (source === undefined || source === null || source === "") continue;
    let t = "";
    try {
      t = typeof source === "object" ? supportEffectTextJa(source) : String(source);
    } catch {
      t = String(source ?? "");
    }
    t = String(t || "").replace(/^(?:効果[:：]?\\s*)?/u, "").trim();
    if (t && !/^(?:効果)?なし$/u.test(t)) return t;
  }
  const a = (Array.isArray(def?.actions) ? def.actions : [])[0];
  if (a) return actionOneLine(a);
  return "";
}

function firstActionLine(def) {
  const a = def?.actions?.[0];
  if (!a) {
    const t = supportSummaryText(def);
    return t ? `効果: ${t}` : "効果: 詳細を確認";
  }
  return `行動: ${actionOneLine(a)}`;
}

function deckRowMetaLine(def, cardId = "") {
  const cost = esc(def?.cost ?? 0);
  if (isSupportLike(def, cardId)) {
    return `サポート / マナ:${cost} / 効果・条件は詳細へ`;
  }
  const hp = esc(def?.hp ?? "?");
  const sp = esc(def?.sp ?? "?");
  return `HP:${hp} SP:${sp} / マナ:${cost}`;
}

const DECK_SORT_KEY = "tcg_deck_sort_mode_v20260808";
let deckSortMode = (() => {
  try {
    return localStorage.getItem(DECK_SORT_KEY) || "auto";
  } catch {
    return "auto";
  }
})();

function effectTextForTags(def) {
  const chunks = [];
  if (def?.effect) chunks.push(supportEffectTextJa(def.effect));
  for (const a of def?.actions || []) {
    chunks.push(actionOneLine(a));
    if (a?.status) chunks.push(String(a.status));
    if (a?.tags) chunks.push(String(a.tags));
  }
  return chunks.filter(Boolean).join(" ");
}

function deckRoleTags(def, max = 3, cardId = "") {
  const tags = [];
  const add = (label) => {
    if (label && !tags.includes(label) && tags.length < max) tags.push(label);
  };
  const text = effectTextForTags(def);
  const actions = def?.actions || [];
  if (isSupportLike(def, cardId)) add("補助");
  if (actions.some((a) => Number(a.hpDelta || 0) < 0) || /ダメージ|HP-|火力|攻撃/.test(text)) add("攻撃");
  if (actions.some((a) => Number(a.spDelta || 0) < 0) || /SP-|SP攻/.test(text)) add("SP攻め");
  if (actions.some((a) => Number(a.hpDelta || 0) > 0 || Number(a.spDelta || 0) > 0) || /回復|HP\+|SP\+/.test(text)) add("回復");
  if (/ドロー|draw|手札/.test(text)) add("ドロー");
  if (/移動|swap|位置|ノックバック|move/.test(text)) add("位置");
  if (/状態|毒|出血|盲目|沈黙|骨折|失魂|におい|カウンター|洗脳|ヘドロ/.test(text)) add("妨害");
  if (/命中|成功|強化|power|modRate/.test(text)) add("強化");
  if (!isSupportLike(def, cardId)) {
    if (Number(def?.hp || 0) >= 60) add("耐久");
    if (Number(def?.cost || 0) <= 2) add("軽量");
  }
  return tags.slice(0, max);
}

function deckRoleTagsHtml(def, max = 3, cardId = "") {
  const tags = deckRoleTags(def, max, cardId);
  return tags.length
    ? `<div class="deckRoleTags">${tags.map((t) => `<span class="deckRoleTag">${esc(t)}</span>`).join("")}</div>`
    : "";
}

function deckActionListHtml(def) {
  const effText = supportEffectTextJa(def?.effect);
  const rows = [];
  if (effText) rows.push(`<div class="deckQuickAction"><b>効果</b><span>${esc(effText)}</span></div>`);
  for (const a of def?.actions || []) {
    rows.push(`<div class="deckQuickAction"><b>${esc(a?.name || "技")}</b><span>${esc(actionOneLine(a))}</span></div>`);
  }
  return rows.length ? rows.join("") : `<div class="deckQuickAction"><b>詳細</b><span>効果・技なし</span></div>`;
}

function ensureDeckFlowCss() {
  if (document.getElementById("deckFlowCss_v20260808")) return;
  const css = document.createElement("style");
  css.id = "deckFlowCss_v20260808";
  css.textContent = `
    .deckProgressMini{
      margin:8px 12px 10px;
      padding:9px 10px;
      border-radius:12px;
      border:1px solid rgba(120,227,173,.18);
      background:linear-gradient(135deg, rgba(120,227,173,.10), rgba(90,170,255,.07));
    }
    .deckProgressMiniHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin-bottom:7px;
      font-size:12px;
      color:rgba(255,255,255,.72);
      font-weight:850;
    }
    .deckProgressMiniHead b{color:rgba(255,255,255,.94);font-size:13px;}
    .deckProgressBar{
      height:8px;
      border-radius:999px;
      background:rgba(0,0,0,.26);
      border:1px solid rgba(255,255,255,.10);
      overflow:hidden;
    }
    .deckProgressBar i{
      display:block;
      height:100%;
      width:var(--deck-progress, 0%);
      border-radius:inherit;
      background:linear-gradient(90deg, #5aa7ff, #6cffb6, #d4ff3f);
      box-shadow:0 0 18px rgba(108,255,182,.42);
      transition:width .22s ease;
    }
    .deckProgressMini.ready{
      border-color:rgba(180,255,80,.42);
      box-shadow:0 0 22px rgba(140,255,90,.16);
    }
    .deckSortRail{
      display:flex;
      align-items:center;
      gap:7px;
      flex-wrap:wrap;
      margin:0 12px 9px;
      padding:8px;
      border-radius:12px;
      background:rgba(0,0,0,.14);
      border:1px solid rgba(255,255,255,.08);
    }
    .deckSortLabel{
      color:rgba(255,255,255,.58);
      font-size:11px;
      font-weight:900;
      letter-spacing:.08em;
      margin-right:2px;
    }
    .deckSortRail button{
      min-height:30px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.13);
      background:rgba(255,255,255,.06);
      color:rgba(255,255,255,.82);
      font-size:12px;
      font-weight:900;
      cursor:pointer;
    }
    .deckSortRail button.active{
      border-color:rgba(90,170,255,.7);
      background:rgba(90,170,255,.22);
      color:#fff;
      box-shadow:0 0 16px rgba(90,170,255,.22);
    }
    .deckRoleTags{
      display:flex;
      flex-wrap:wrap;
      gap:4px;
      margin-top:4px;
    }
    .deckRoleTag{
      display:inline-flex;
      align-items:center;
      min-height:18px;
      padding:2px 7px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.13);
      background:rgba(255,255,255,.06);
      color:rgba(255,255,255,.74);
      font-size:10px;
      font-weight:850;
      line-height:1;
    }
    #deckList .cardRow.deckAddFlash{
      animation:deckAddFlash_v20260808 .72s ease both;
      border-color:var(--deck-add-color, #6cffb6) !important;
    }
    @keyframes deckAddFlash_v20260808{
      0%{transform:translateX(0);box-shadow:0 0 0 rgba(0,0,0,0);}
      18%{transform:translateX(-4px);box-shadow:0 0 26px color-mix(in srgb, var(--deck-add-color, #6cffb6) 52%, transparent);}
      48%{transform:translateX(3px);}
      100%{transform:translateX(0);box-shadow:0 0 0 rgba(0,0,0,0);}
    }
    .deckQuickDetail{
      display:none;
      margin:0 12px 10px;
      padding:10px;
      border-radius:14px;
      border:1px solid rgba(90,170,255,.24);
      background:
        radial-gradient(220px 120px at 0% 0%, rgba(90,170,255,.16), transparent 64%),
        rgba(0,0,0,.26);
    }
    .deckQuickDetail.open{display:block;animation:deckQuickIn_v20260808 .18s ease both;}
    @keyframes deckQuickIn_v20260808{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .deckQuickTop{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:start;
      gap:8px;
      margin-bottom:8px;
    }
    .deckQuickTitle{font-weight:950;line-height:1.25;}
    .deckQuickMeta{margin-top:4px;color:rgba(255,255,255,.62);font-size:12px;}
    .deckQuickClose{
      width:32px;
      height:32px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(255,255,255,.06);
      color:#fff;
      font-weight:950;
      cursor:pointer;
    }
    .deckQuickActions{display:grid;gap:6px;}
    .deckQuickAction{
      display:grid;
      gap:3px;
      padding:8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.08);
      background:rgba(0,0,0,.18);
      font-size:12px;
      line-height:1.45;
    }
    .deckQuickAction b{color:rgba(255,255,255,.93);}
    .deckQuickAction span{color:rgba(255,255,255,.72);}
    @media (max-width:720px){
      .deckSortRail{gap:5px;margin-inline:8px;}
      .deckSortRail button{padding:6px 8px;font-size:11px;}
      .deckProgressMini,.deckQuickDetail{margin-inline:8px;}
      .deckRoleTags{display:none;}
    }
  `;
  document.head.appendChild(css);
}

function deckProgressLabel(total) {
  if (total >= DECK_SIZE) return "READY";
  if (total >= 24) return "あと少し";
  if (total >= 15) return "骨組みOK";
  if (total >= 6) return "構築中";
  return "カード選択";
}

function renderDeckProgress(total) {
  const panel = document.getElementById("deckPanel");
  if (!panel) return;
  let box = document.getElementById("deckProgressMini");
  if (!box) {
    box = document.createElement("div");
    box.id = "deckProgressMini";
    box.className = "deckProgressMini";
    const mount = document.getElementById("deckList");
    if (mount?.parentElement) mount.parentElement.insertBefore(box, mount);
    else panel.insertBefore(box, panel.firstElementChild || null);
  }
  const pct = Math.max(0, Math.min(100, Math.round((total / DECK_SIZE) * 100)));
  box.classList.toggle("ready", total === DECK_SIZE);
  box.style.setProperty("--deck-progress", `${pct}%`);
  box.innerHTML = `
    <div class="deckProgressMiniHead">
      <b>${esc(deckProgressLabel(total))}</b>
      <span>${esc(total)} / ${esc(DECK_SIZE)}枚</span>
    </div>
    <div class="deckProgressBar"><i></i></div>
  `;
}

function renderDeckSortControls() {
  const panel = document.getElementById("deckPanel");
  if (!panel || !deckListEl) return;
  let rail = document.getElementById("deckSortRail");
  if (!rail) {
    rail = document.createElement("div");
    rail.id = "deckSortRail";
    rail.className = "deckSortRail";
    deckListEl.parentElement?.insertBefore(rail, deckListEl);
  }
  const modes = [
    ["auto", "おまかせ"],
    ["cost", "コスト"],
    ["type", "種別"],
    ["attr", "属性"],
    ["count", "枚数"],
  ];
  rail.innerHTML = `<span class="deckSortLabel">並び</span>${modes
    .map(([key, label]) => `<button type="button" data-deck-sort="${key}" class="${deckSortMode === key ? "active" : ""}">${label}</button>`)
    .join("")}`;
  rail.querySelectorAll("[data-deck-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      deckSortMode = btn.dataset.deckSort || "auto";
      try {
        localStorage.setItem(DECK_SORT_KEY, deckSortMode);
      } catch {}
      renderDeck();
    });
  });
}

function compareDeckCards(a, b) {
  const A = cardDefs[a] || {};
  const B = cardDefs[b] || {};
  const byName = () => String(A.name || a).localeCompare(String(B.name || b), "ja");
  const byAuto = () => {
    const kA = String(filterKindForCard(A, a));
    const kB = String(filterKindForCard(B, b));
    if (kA !== kB) return kA.localeCompare(kB, "ja");
    const tA = String(A.type || "");
    const tB = String(B.type || "");
    if (tA !== tB) return tA.localeCompare(tB, "ja");
    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;
    return byName();
  };
  if (deckSortMode === "count") {
    const c = Number(deckMap[b] || 0) - Number(deckMap[a] || 0);
    return c || byAuto();
  }
  if (deckSortMode === "cost") {
    const c = Number(A.cost || 0) - Number(B.cost || 0);
    return c || byAuto();
  }
  if (deckSortMode === "type") {
    const k = String(filterKindForCard(A, a)).localeCompare(String(filterKindForCard(B, b)), "ja");
    return k || byAuto();
  }
  if (deckSortMode === "attr") {
    const t = String(A.type || "").localeCompare(String(B.type || ""), "ja");
    return t || byAuto();
  }
  return byAuto();
}

function ensureDeckQuickDetail() {
  if (!deckListEl) return null;
  let panel = document.getElementById("deckQuickDetail");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "deckQuickDetail";
    panel.className = "deckQuickDetail";
    deckListEl.parentElement?.insertBefore(panel, deckListEl);
  }
  return panel;
}

function showDeckQuickDetail(cardId) {
  const d = cardDefs[cardId];
  const panel = ensureDeckQuickDetail();
  if (!d || !panel) {
    showCardDetail(cardId);
    return;
  }
  const supportLike = isSupportLike(d, cardId);
  panel.innerHTML = `
    <div class="deckQuickTop">
      <div>
        <div class="deckQuickTitle">【${esc(d.cost ?? 0)}】${esc(d.name || cardId)}</div>
        <div class="deckQuickMeta">
          ${esc(supportLike ? "サポート" : `HP:${d.hp ?? "?"} SP:${d.sp ?? "?"}`)}
          / ${esc(d.type || "無属性")} / ${esc(deckMap[cardId] || 0)}枚採用
        </div>
        ${deckRoleTagsHtml(d, 5, cardId)}
      </div>
      <button type="button" class="deckQuickClose" data-deck-quick-close>×</button>
    </div>
    <div class="deckQuickActions">${deckActionListHtml(d)}</div>
  `;
  panel.classList.add("open");
  panel.querySelector("[data-deck-quick-close]")?.addEventListener("click", () => {
    panel.classList.remove("open");
  });
}

const DECK_LAB_SP_VALUE = 2;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function deckLabCss() {
  if (document.getElementById("deckLabCss_v20260723_compact1")) return;
  const css = document.createElement("style");
  css.id = "deckLabCss_v20260723_compact1";
  css.textContent = `
    .deckLab{
      margin-top:8px;
      border:1px solid rgba(120,210,255,.22);
      border-radius:12px;
      background:
        linear-gradient(135deg, rgba(90,170,255,.12), rgba(120,255,190,.055)),
        rgba(0,0,0,.2);
      overflow:hidden;
    }
    .deckLabSummary{
      display:grid;
      grid-template-columns:minmax(0,1fr) auto auto;
      align-items:center;
      gap:10px;
      min-height:46px;
      padding:9px 11px;
      cursor:pointer;
      list-style:none;
    }
    .deckLabSummary::-webkit-details-marker{display:none;}
    .deckLabSummary::after{
      content:"+";
      width:28px;
      height:28px;
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(0,0,0,.22);
      color:rgba(255,255,255,.8);
      font-weight:1000;
      line-height:1;
    }
    .deckLab[open] .deckLabSummary::after{content:"-";}
    .deckLabSummaryText{min-width:0;}
    .deckLabBody{
      display:grid;
      gap:8px;
      padding:0 11px 11px;
    }
    .deckLabHead{display:flex;align-items:center;justify-content:space-between;gap:10px;}
    .deckLabTitle{font-weight:950;font-size:13px;}
    .deckLabScore{
      min-width:50px;
      height:38px;
      display:grid;
      place-items:center;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(0,0,0,.22);
      font-weight:950;
    }
    .deckLabSummary .deckLabScore{
      min-width:38px;
      height:34px;
      border-radius:10px;
      font-size:14px;
    }
    .deckLabType{font-size:12px;color:rgba(255,255,255,.72);line-height:1.45;}
    .deckLabStats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
    .deckLabStat{
      min-width:0;
      padding:8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.11);
      background:rgba(0,0,0,.18);
    }
    .deckLabStat b{display:block;font-size:12px;}
    .deckLabStat span{display:block;margin-top:3px;font-size:12px;color:rgba(255,255,255,.7);}
    .deckLabCurve{display:grid;gap:5px;}
    .deckLabCurveRow{display:grid;grid-template-columns:34px 1fr 28px;gap:7px;align-items:center;font-size:11px;color:rgba(255,255,255,.72);}
    .deckLabBar{height:7px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden;}
    .deckLabBar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg, rgba(90,170,255,.85), rgba(120,255,190,.8));}
    .deckLabChips{display:flex;gap:5px;flex-wrap:wrap;}
    .deckLabChip{
      border:1px solid rgba(255,255,255,.13);
      background:rgba(255,255,255,.055);
      color:rgba(255,255,255,.82);
      border-radius:999px;
      padding:4px 7px;
      font-size:11px;
      font-weight:800;
    }
    .deckLabFlags{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:6px;
    }
    .deckLabFlag{
      padding:7px 8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.11);
      background:rgba(0,0,0,.18);
      font-size:11px;
      line-height:1.45;
      color:rgba(255,255,255,.78);
    }
    .deckLabFlag b{display:block;margin-bottom:2px;font-size:12px;color:rgba(255,255,255,.92);}
    .deckLabFlag.good{border-color:rgba(120,227,173,.24);background:rgba(120,227,173,.08);}
    .deckLabFlag.warn{border-color:rgba(255,209,102,.26);background:rgba(255,209,102,.075);}
    .deckLabFlag.bad{border-color:rgba(255,122,144,.26);background:rgba(255,122,144,.075);}
    .deckLabNotes{display:grid;gap:5px;margin:0;padding:0;list-style:none;}
    .deckLabNotes li{
      padding:7px 8px;
      border-radius:10px;
      background:rgba(0,0,0,.18);
      border:1px solid rgba(255,255,255,.09);
      font-size:12px;
      line-height:1.45;
      color:rgba(255,255,255,.78);
    }
    .deckLabRecs{display:grid;gap:6px;}
    .deckLabRec{
      display:grid;
      grid-template-columns:1fr 38px;
      gap:7px;
      align-items:center;
      padding:8px;
      border-radius:10px;
      background:rgba(0,0,0,.2);
      border:1px solid rgba(255,255,255,.1);
    }
    .deckLabRec b{font-size:12px;}
    .deckLabRec span{display:block;margin-top:3px;font-size:11px;color:rgba(255,255,255,.64);line-height:1.35;}
    .deckLabRec button{
      width:38px;
      height:34px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.17);
      background:rgba(90,170,255,.16);
      color:#fff;
      font-weight:950;
      cursor:pointer;
    }
    @media (max-width:640px){
      .deckLabStats{grid-template-columns:1fr;}
      .deckLabFlags{grid-template-columns:1fr;}
      .deckLabHead{align-items:flex-start;}
      .deckLabSummary .deckLabType{display:none;}
    }
  `;
  document.head.appendChild(css);
}

function actionProfile(a) {
  const hpDelta = num(a?.hpDelta);
  const spDelta = num(a?.spDelta);
  const hpDamage = Math.max(0, -hpDelta);
  const spDamage = Math.max(0, -spDelta);
  const hpHeal = Math.max(0, hpDelta);
  const spHeal = Math.max(0, spDelta);
  const draw = Math.max(0, num(a?.draw));
  const status = a?.addStatus || a?.tags || a?.bonus || a?.effect || a?.effects ? 1 : 0;
  const range = String(a?.range || "");
  const longRange = /[234]/.test(range) || range.includes("front3") || range.includes("front4") ? 1 : 0;
  const raw = JSON.stringify(a || {}).toLowerCase();
  const move = /(moveto|swappos|swap|knockback|push|pull|移動|入替|ノック)/.test(raw) ? 1 : 0;
  return {
    hpDamage,
    spDamage,
    weightedDamage: hpDamage + spDamage * DECK_LAB_SP_VALUE,
    hpHeal,
    spHeal,
    weightedHeal: hpHeal + spHeal,
    draw,
    status,
    longRange,
    move,
    rate: num(a?.rate),
  };
}

function effectProfile(effect) {
  const eff = parseEffect(effect);
  const out = { damage: 0, heal: 0, draw: 0, mana: 0, status: 0, move: 0, text: supportEffectTextJa(effect) };
  const walk = (x) => {
    if (!x) return;
    if (Array.isArray(x)) {
      x.forEach(walk);
      return;
    }
    if (typeof x !== "object") return;
    const type = String(x.type || "").toLowerCase();
    if (type.includes("draw") || x.draw != null || x.n != null && type === "draw") out.draw += Math.max(1, num(x.n ?? x.draw, 1));
    if (type.includes("search") || type.includes("tutor")) out.draw += 1.5;
    if (type.includes("heal") || x.heal != null || x.hp != null && type === "heal") out.heal += Math.abs(num(x.hp ?? x.heal ?? x.amount));
    if (type.includes("damage") || x.damage != null || x.dmg != null) out.damage += Math.abs(num(x.damage ?? x.dmg));
    if (type.includes("mana") || x.mana != null || x.delta != null && type === "manaup") out.mana += Math.abs(num(x.delta ?? x.mana, 1));
    if (type.includes("status") || type.includes("setcard") || type.includes("facedown") || type.includes("cardlock") || x.addStatus != null || x.grantEvade || x.bounce || x.swapPos || x.moveTo) out.status += 1;
    if (type.includes("move") || type.includes("swap") || x.swapPos || x.moveTo || x.knockback) out.move += 1;
    if (x.effect) walk(x.effect);
    if (x.effects) walk(x.effects);
    if (x.table) walk(x.table);
  };
  walk(eff);
  return out;
}

function profileCard(def, cardId = "") {
  const p = {
    kind: normalizedKindOf(def, cardId),
    cost: num(def?.cost),
    hp: num(def?.hp),
    sp: num(def?.sp),
    damage: 0,
    heal: 0,
    draw: 0,
    status: 0,
    hpDamage: 0,
    spDamage: 0,
    move: 0,
    longRange: 0,
    accuracy: 0,
    actionCount: 0,
    supportText: "",
  };

  for (const a of def?.actions || []) {
    const ap = actionProfile(a);
    p.damage += ap.weightedDamage;
    p.hpDamage += ap.hpDamage;
    p.spDamage += ap.spDamage;
    p.heal += ap.weightedHeal;
    p.draw += ap.draw;
    p.status += ap.status;
    p.longRange += ap.longRange;
    p.move += ap.move;
    p.accuracy += ap.rate;
    p.actionCount += 1;
  }

  if (isSupport(def, cardId)) {
    const ep = effectProfile(def.effect);
    p.damage += ep.damage;
    p.heal += ep.heal;
    p.draw += ep.draw;
    p.status += ep.status;
    p.move += ep.move;
    p.supportText = ep.text || "";
  }

  return p;
}

function analyzeDeck() {
  const total = sumDeck(deckMap);
  const stats = {
    total,
    units: 0,
    supports: 0,
    avgCost: 0,
    avgHp: 0,
    avgSp: 0,
    damage: 0,
    heal: 0,
    draw: 0,
    status: 0,
    hpDamage: 0,
    spDamage: 0,
    move: 0,
    longRange: 0,
    accuracy: 0,
    actionCount: 0,
    attrCounts: {},
    curve: {},
  };

  for (const [cardId, rawCnt] of Object.entries(deckMap || {})) {
    const cnt = Math.max(0, num(rawCnt));
    const def = cardDefs[cardId] || {};
    if (!cnt || !def) continue;
    const p = profileCard(def, cardId);
    const attr = String(def.type || def.attr || "辟｡");
    const costKey = String(Math.max(0, Math.min(8, Math.trunc(p.cost))));
    stats.curve[costKey] = (stats.curve[costKey] || 0) + cnt;
    stats.attrCounts[attr] = (stats.attrCounts[attr] || 0) + cnt;
    stats.avgCost += p.cost * cnt;
    if (isSupport(def, cardId)) {
      stats.supports += cnt;
    } else {
      stats.units += cnt;
      stats.avgHp += p.hp * cnt;
      stats.avgSp += p.sp * cnt;
    }
    stats.damage += p.damage * cnt;
    stats.hpDamage += (p.hpDamage || 0) * cnt;
    stats.spDamage += (p.spDamage || 0) * cnt;
    stats.heal += p.heal * cnt;
    stats.draw += p.draw * cnt;
    stats.status += p.status * cnt;
    stats.longRange += p.longRange * cnt;
    stats.move += (p.move || 0) * cnt;
    stats.accuracy += p.accuracy * cnt;
    stats.actionCount += p.actionCount * cnt;
  }

  stats.avgCost = total ? stats.avgCost / total : 0;
  stats.avgHp = stats.units ? stats.avgHp / stats.units : 0;
  stats.avgSp = stats.units ? stats.avgSp / stats.units : 0;
  stats.avgActionDamage = stats.actionCount ? stats.damage / stats.actionCount : 0;
  stats.avgAccuracy = stats.actionCount ? stats.accuracy / stats.actionCount : 0;
  stats.topAttrs = Object.entries(stats.attrCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, 4);

  const aggro = stats.avgActionDamage + (stats.avgCost <= 3 ? 9 : 0) + stats.longRange * 1.2;
  const control = stats.status * 4 + stats.supports * 1.4 + stats.avgSp * 0.25;
  const sustain = stats.heal * 0.7 + stats.avgHp * 0.35 + stats.supports * 0.8;
  const tempo = stats.draw * 5 + stats.longRange * 2 + (stats.avgCost <= 3.2 ? 8 : 0);
  const types = [
    ["速攻", aggro],
    ["制圧", control],
    ["耐久", sustain],
    ["展開", tempo],
  ].sort((a, b) => b[1] - a[1]);
  stats.archetype = types[0]?.[0] || "未定";
  stats.subtype = types[1]?.[0] || "";

  const sizeScore = Math.max(0, 100 - Math.abs(DECK_SIZE - total) * 8);
  const roleScore = Math.max(0, 100 - Math.abs(stats.supports - 8) * 7 - Math.max(0, 18 - stats.units) * 4);
  const costScore = Math.max(0, 100 - Math.abs(stats.avgCost - 3.4) * 22);
  const planScore = Math.min(100, stats.avgActionDamage * 3.4 + stats.draw * 7 + stats.status * 5 + stats.heal * 1.2);
  stats.score = Math.round((sizeScore * 0.32 + roleScore * 0.22 + costScore * 0.2 + planScore * 0.26));

  stats.notes = buildDeckNotes(stats);
  stats.flags = buildDeckFlags(stats);
  stats.recommendations = buildDeckRecommendations(stats);
  return stats;
}

function buildDeckFlags(stats) {
  const flags = [];
  const lowCurve = num(stats.curve["0"]) + num(stats.curve["1"]) + num(stats.curve["2"]);
  const highCurve = num(stats.curve["5"]) + num(stats.curve["6"]) + num(stats.curve["7"]) + num(stats.curve["8"]);
  const topAttrCount = stats.topAttrs?.[0]?.[1] || 0;
  flags.push(lowCurve >= 10
    ? { cls: "good", title: "初動", text: `0-2コストが${lowCurve}枚。序盤はかなり動きやすいです。` }
    : { cls: "warn", title: "初動", text: `0-2コストが${lowCurve}枚。低コストや支援の入りが遅れるかも。` });
  flags.push(stats.move >= 3
    ? { cls: "good", title: "位置干渉", text: `移動・入替・ノック系が${stats.move}枚。盤面ゲームらしい強みがあります。` }
    : { cls: "warn", title: "位置干渉", text: "移動や入替が少なめ。射程外へ逃げられると追いにくいです。" });
  flags.push(stats.spDamage >= 40
    ? { cls: "good", title: "SP圧", text: `SPダメージ${stats.spDamage}相当。相手の行動を止めやすい構成。` }
    : { cls: "warn", title: "SP圧", text: "SPへの圧が薄め。高火力相手に動かれ続ける可能性があります。" });
  flags.push(highCurve <= 7
    ? { cls: "good", title: "重さ", text: `5コスト以上は${highCurve}枚。事故は比較的少なそう。` }
    : { cls: "bad", title: "重さ", text: `5コスト以上が${highCurve}枚。強いけど手札で詰まりやすいです。` });
  if (topAttrCount >= 18) {
    flags.push({ cls: "warn", title: "属性偏り", text: `${stats.topAttrs[0][0]}が${topAttrCount}枚。強みは濃いですが弱点も出やすいです。` });
  }
  return flags.slice(0, 5);
}

function buildDeckNotes(stats) {
  const notes = [];
  if (stats.total < DECK_SIZE) notes.push(`あと${DECK_SIZE - stats.total}枚で完成。途中でも診断は動いています。`);
  if (stats.total > DECK_SIZE) notes.push(`${stats.total - DECK_SIZE}枚多いです。30枚ちょうどに整えると対戦へ進めます。`);
  if (stats.units < 18) notes.push("キャラが少なめ。盤面を作る前に手札が細くなる可能性があります。");
  if (stats.supports < 5 && stats.total >= 20) notes.push("サポートが薄め。ドロー、回復、マナ補助を少し入れると事故が減ります。");
  if (stats.supports > 12) notes.push("サポート多め。初動でキャラを置けない手札が増えやすいです。");
  if (stats.avgCost > 4.4) notes.push("平均コストが高め。低コストの先行役やドロー役を混ぜると動き出しが早くなります。");
  if (stats.avgCost > 0 && stats.avgCost < 2.2 && stats.total >= 20) notes.push("かなり軽い構成。息切れ対策に中コストの決定札がほしいです。");
  if (stats.avgActionDamage < 13 && stats.actionCount) notes.push("HP火力が控えめ。倒し切る役を数枚足すと勝ち筋が太くなります。");
  if (stats.draw < 3 && stats.total >= 20) notes.push("ドロー源が少なめ。長期戦で手札が細くなりやすいです。");
  if (stats.status >= 5) notes.push("状態異常の圧が強め。相手の行動を崩す制圧プランが見えます。");
  if (stats.heal >= 8) notes.push("回復・耐久が厚め。盤面を維持してじわじわ勝つ形に向いています。");
  if (stats.topAttrs[0]) notes.push(`主軸属性は${stats.topAttrs[0][0]}、${stats.topAttrs[0][1]}枚入っています。`);
  if (!notes.length) notes.push("かなり素直な構成。あとは実戦ログで足りない役割を見ていけばOKです。");
  return notes.slice(0, 5);
}

function cardRecommendationScore(def, need) {
  const cardId = String(def?.id || def?.cardId || "").trim();
  if (!def || isExSupport(def, cardId)) return -Infinity;
  if (def.hidden && !isAdminUser()) return -Infinity;
  if (!canUseCard(def.id)) return -Infinity;
  const p = profileCard(def, cardId);
  let s = 0;
  if (need === "damage") s += p.damage * 2 + p.longRange * 8 + p.accuracy * 0.08;
  if (need === "draw") s += p.draw * 28 + (isSupport(def, cardId) ? 8 : 0) - p.cost * 0.8;
  if (need === "sustain") s += p.heal * 2 + p.hp * 0.5 + p.sp * 0.35;
  if (need === "curve") s += Math.max(0, 5 - p.cost) * 9 + (isSupport(def, cardId) ? -3 : 4);
  if (need === "control") s += p.status * 25 + p.damage + p.sp * 0.2;
  s -= num(deckMap[def.id]) >= MAX_SAME ? 999 : 0;
  s -= num(deckMap[def.id]) * 3;
  return s;
}

function buildDeckRecommendations(stats) {
  const needs = [];
  if (stats.avgActionDamage < 15) needs.push(["damage", "火力"]);
  if (stats.draw < 3) needs.push(["draw", "手札"]);
  if (stats.heal < 5 && stats.avgHp < 34) needs.push(["sustain", "耐久"]);
  if (stats.avgCost > 4 || stats.units < 18) needs.push(["curve", "初動"]);
  if (stats.status < 3) needs.push(["control", "妨害"]);
  if (!needs.length) needs.push(["damage", "決定力"], ["draw", "継戦"]);

  const picked = [];
  const seen = new Set();
  for (const [need, label] of needs) {
    const best = Object.entries(cardDefs)
      .map(([id, def]) => ({ id, def: { ...def, id }, score: cardRecommendationScore({ ...def, id }, need) }))
      .filter((x) => Number.isFinite(x.score) && x.score > 0 && !seen.has(x.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)[0];
    if (best) {
      seen.add(best.id);
      picked.push({ id: best.id, label, def: best.def });
    }
    if (picked.length >= 3) break;
  }
  return picked;
}

function renderDeckLab() {
  deckLabCss();
  const stats = analyzeDeck();
  const lab = document.createElement("details");
  lab.className = "deckLab";
  try {
    if (localStorage.getItem(DECK_LAB_OPEN_KEY) === "1") lab.open = true;
  } catch {}

  const maxCurve = Math.max(1, ...Object.values(stats.curve).map((v) => num(v)));
  const curveHtml = Array.from({ length: 9 }, (_, i) => {
    const label = i === 8 ? "8+" : String(i);
    const count = num(stats.curve[String(i)]);
    const pct = Math.min(100, Math.round((count / maxCurve) * 100));
    return `
      <div class="deckLabCurveRow">
        <span>${label}</span>
        <div class="deckLabBar"><i style="width:${pct}%"></i></div>
        <span>${count}</span>
      </div>
    `;
  }).join("");

  const attrHtml = stats.topAttrs.length
    ? stats.topAttrs.map(([a, c]) => `<span class="deckLabChip">${esc(a)} ${c}</span>`).join("")
    : `<span class="deckLabChip">属性なし</span>`;

  const notesHtml = stats.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  const flagHtml = (stats.flags || []).map((f) => `
    <div class="deckLabFlag ${esc(f.cls || "")}">
      <b>${esc(f.title || "CHECK")}</b>
      ${esc(f.text || "")}
    </div>
  `).join("");
  const recHtml = stats.recommendations.length
    ? stats.recommendations.map((r) => `
        <div class="deckLabRec">
          <div>
            <b>${esc(r.label)}: 【${esc(r.def.cost)}】${esc(r.def.name || r.id)}</b>
            <span>${esc(r.def.type || "")} ${esc(kindLabel(normalizedKindOf(r.def, r.id)))} / ${esc(firstActionLine(r.def))}</span>
          </div>
          <button type="button" data-lab-add="${esc(r.id)}">+</button>
        </div>
      `).join("")
    : `<div class="deckLabType">候補を出すにはカードを読み込んでください。</div>`;

  lab.innerHTML = `
    <summary class="deckLabSummary">
      <div class="deckLabSummaryText">
        <div class="deckLabTitle">デッキラボ</div>
        <div class="deckLabType">${esc(stats.archetype)} / ${esc(stats.subtype)}型</div>
      </div>
      <div class="deckLabScore">${stats.score}</div>
    </summary>
    <div class="deckLabBody">
      <div class="deckLabType">SPダメージはHPの${DECK_LAB_SP_VALUE}倍価値で評価</div>
      <div class="deckLabStats">
        <div class="deckLabStat"><b>構成</b><span>キャラ${stats.units} / サポート${stats.supports}</span></div>
        <div class="deckLabStat"><b>平均</b><span>コスト${stats.avgCost.toFixed(1)} / HP${stats.avgHp.toFixed(1)} / SP${stats.avgSp.toFixed(1)}</span></div>
        <div class="deckLabStat"><b>攻め</b><span>行動火力${stats.avgActionDamage.toFixed(1)} / 命中${stats.avgAccuracy.toFixed(0)}%</span></div>
        <div class="deckLabStat"><b>補助</b><span>ドロー${stats.draw} / 回復${stats.heal} / 妨害${stats.status}</span></div>
      </div>
      <div class="deckLabChips">${attrHtml}</div>
      <div class="deckLabFlags">${flagHtml}</div>
      <div class="deckLabCurve">${curveHtml}</div>
      <ul class="deckLabNotes">${notesHtml}</ul>
      <div class="deckLabRecs">
        <div class="deckLabTitle">おすすめ候補</div>
        ${recHtml}
      </div>
    </div>
  `;

  lab.addEventListener("toggle", () => {
    try {
      localStorage.setItem(DECK_LAB_OPEN_KEY, lab.open ? "1" : "0");
    } catch {}
  });

  lab.querySelectorAll("[data-lab-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation?.();
      addToDeck(btn.getAttribute("data-lab-add"));
    });
  });

  return lab;
}

// =====================
// Deck ops
// =====================
function canAdd(cardId) {
  const def = cardDefs[cardId] || {};
  if (isExSupport(def, cardId)) {
    return {
      ok: false,
      reason: "EXサポート(kind:ex_support)はデッキに入れません。EX枠で指定してください。",
    };
  }
  const total = sumDeck(deckMap);
  if (total >= DECK_SIZE)
    return { ok: false, reason: `${DECK_SIZE}枚ちょうどにしてください` };
  const c = Number(deckMap[cardId] || 0);
  const ownedLimit = deckLimitForCard(cardId);
  if (ownedLimit <= 0) {
    return { ok: false, reason: "このカードは未所持です（ガチャなどで入手してね）" };
  }
  if (c >= ownedLimit) {
    return {
      ok: false,
      reason: `所持枚数の上限です（所持${ownedLimit}枚）`,
    };
  }
  if (c >= MAX_SAME) return { ok: false, reason: "同名は最大4枚までです" };
  return { ok: true };
}

function keepCardListScroll(run) {
  const el = cardListEl;
  const deckEl = deckListEl;
  const top = el ? el.scrollTop : 0;
  const left = el ? el.scrollLeft : 0;
  const deckTop = deckEl ? deckEl.scrollTop : 0;
  const deckLeft = deckEl ? deckEl.scrollLeft : 0;
  const pageX = window.scrollX || 0;
  const pageY = window.scrollY || document.documentElement.scrollTop || 0;
  run();
  const restore = () => {
    if (el) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
    if (deckEl) {
      deckEl.scrollTop = deckTop;
      deckEl.scrollLeft = deckLeft;
    }
    window.scrollTo(pageX, pageY);
  };
  restore();
  requestAnimationFrame(restore);
  setTimeout(restore, 0);
}

function addToDeck(cardId) {
  const chk = canAdd(cardId);
  if (!chk.ok) return setMsg(chk.reason, false);
  setMsg("", true);
  deckMap[cardId] = Number(deckMap[cardId] || 0) + 1;
  saveLocalDeck();
  keepCardListScroll(renderAll);
  flashDeckAdd(cardId);
}
function removeFromDeck(cardId) {
  setMsg("", true);
  const c = Number(deckMap[cardId] || 0);
  if (c <= 0) return;
  const next = c - 1;
  if (next <= 0) delete deckMap[cardId];
  else deckMap[cardId] = next;

  if (selectedExSupportId === cardId && !deckMap[cardId]) {
    selectedExSupportId = "";
    saveSelectedEx("");
  }

  saveLocalDeck();
  keepCardListScroll(renderAll);
}
function clearDeck() {
  deckMap = {};
  selectedExSupportId = "";
  saveSelectedEx("");
  saveLocalDeck();
  renderAll();
  setMsg("デッキを全消ししました", true);
  setTimeout(() => setMsg("", true), 800);
}

// ===== EX =====
function loadSelectedEx() {
  try {
    return localStorage.getItem(EX_KEY) || "";
  } catch {
    return "";
  }
}
function saveSelectedEx(id) {
  try {
    localStorage.setItem(EX_KEY, String(id || ""));
  } catch {}
}

function selectExSupport(cardId) {
  const def = cardDefs[cardId];
  if (!def) return;

  if (!isExSelectable(def)) {
    setMsg("このカードはEXにできません（サポートのみ）", false);
    return;
  }
  if (!canUseCard(cardId)) {
    setMsg("このカードは未所持なのでEXにできません", false);
    return;
  }

  selectedExSupportId = cardId;
  saveSelectedEx(cardId);
  setMsg(`EXを選択: ${def.name || cardId}`, true);
  setTimeout(() => setMsg("", true), 900);
  renderAll();
}
function clearExSupport() {
  selectedExSupportId = "";
  saveSelectedEx("");
  setMsg("EXを解除しました", true);
  setTimeout(() => setMsg("", true), 900);
  renderAll();
}

// ===== Player name =====
function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}
function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, String(name || ""));
  } catch {}
}
function normalizeName(name) {
  const s = String(name || "").trim();
  return s ? s.slice(0, 16) : "";
}

function ensureNameInUI() {
  if (!playerNameInput) return;
  const saved = normalizeName(loadName());
  if (saved && !playerNameInput.value.trim()) playerNameInput.value = saved;
}
function askNameIfNeeded() {
  if (playerNameInput) {
    let n = normalizeName(playerNameInput.value);
    if (!n) n = normalizeName(loadName());
    if (!n) n = "player";
    playerNameInput.value = n;
    saveName(n);
    return n;
  }
  let name = normalizeName(loadName());
  if (!name) {
    name = prompt("デッキネームを入力してね", "")?.trim() || "";
    name = normalizeName(name) || "player";
    saveName(name);
  }
  return name;
}
async function syncNameToFirestore(name) {
  try {
    await setDoc(
      playerRef(roomId, playerId),
      {
        name: name || "player",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn("syncNameToFirestore skipped:", e?.message || e);
  }
}
btnSaveName?.addEventListener("click", async () => {
  if (!playerNameInput) return;
  const n = normalizeName(playerNameInput.value);
  if (!n) return setHint(nameHintEl, "名前が空です", false);
  saveName(n);
  await syncNameToFirestore(n);
  setHint(nameHintEl, `保存しました: ${n}`, true);
  setTimeout(() => setHint(nameHintEl, "", true), 1200);
});

function updateRoomPlayerSummary() {
  const name = normalizeName(loadName()) || "未設定";
  const nameEl = document.getElementById("roomPlayerNameCurrent");
  if (nameEl) nameEl.textContent = name;
}

function simplifyRoomPlayerPanel() {
  const card = playerNameInput?.closest?.(".roomOpCard");
  if (!card || document.getElementById("roomPlayerNameCurrent")) return;
  const head = card.querySelector(".roomOpCardHd");
  const body = card.querySelector(".roomOpCardBd");
  const title = head?.querySelector("b");
  const sub = head?.querySelector(".small");
  if (title) title.textContent = "プレイヤー名";
  if (sub) sub.textContent = "ユーザー画面で変更";
  if (!body) return;
  body.innerHTML = `
    <div class="roomPlayerSummary">
      <div>
        <div class="roomPlayerSummaryLabel">現在の名前</div>
        <div id="roomPlayerNameCurrent" class="roomPlayerSummaryName"></div>
      </div>
      <button id="roomGoProfile" class="btnGhost" type="button">ユーザー画面へ</button>
    </div>
    <div class="roomPlayerSummaryNote">ジェム配布や対戦表示に使う名前はユーザー画面で保存してね。</div>
  `;
  document.getElementById("roomGoProfile")?.addEventListener("click", () => {
    location.href = "./profile.html";
  });
  updateRoomPlayerSummary();
}

function polishRoomEntryPanel() {
  const hero = document.querySelector(".roomOpHero");
  if (hero) {
    hero.classList.add("isBattleGate");
    const kicker = hero.querySelector(".roomOpKicker");
    const title = hero.querySelector(".roomOpTitle");
    const lead = hero.querySelector(".roomOpLead");
    if (kicker) kicker.textContent = "BATTLE ENTRY";
    if (title) title.textContent = "対戦ルーム";
    if (lead) {
      lead.textContent =
        "名前を確認して、ソロ開始・ルーム作成・ルーム参加を選ぶだけ。デッキが30枚ならすぐ戦場へ行けます。";
    }
  }

  document.getElementById("roomFieldMount")?.closest(".roomOpCard")?.classList.add("roomOpMapCardHidden");

  const startCard = btnSolo?.closest?.(".roomOpCard") || createBtn?.closest?.(".roomOpCard") || joinBtn?.closest?.(".roomOpCard");
  if (!startCard || startCard.dataset.polished === "1") return;
  startCard.dataset.polished = "1";

  const head = startCard.querySelector(".roomOpCardHd");
  const body = startCard.querySelector(".roomOpCardBd");
  const title = head?.querySelector("b");
  const sub = head?.querySelector(".small");
  if (title) title.textContent = "開始";
  if (sub) sub.textContent = "30枚で有効";
  if (!body) return;

  const soloBtn = btnSolo;
  const createRoomBtn = createBtn;
  const joinInput = joinCodeInput;
  const joinRoomBtn = joinBtn;
  if (soloBtn) soloBtn.textContent = "ソロ開始";
  if (createRoomBtn) createRoomBtn.textContent = "ルーム作成";
  if (joinRoomBtn) joinRoomBtn.textContent = "参加";
  if (joinInput) {
    joinInput.placeholder = "参加コード 例: 1234";
    joinInput.setAttribute("aria-label", "参加コード");
  }

  const actionGrid = document.createElement("div");
  actionGrid.className = "roomActionGrid";

  const soloCard = document.createElement("div");
  soloCard.className = "roomActionCard roomActionSolo";
  soloCard.innerHTML = `<b>ソロで練習</b><small>CPU相手に、今のデッキをすぐ試す。</small>`;
  if (soloBtn) soloCard.appendChild(soloBtn);

  const createCard = document.createElement("div");
  createCard.className = "roomActionCard roomActionCreate";
  createCard.innerHTML = `<b>ルーム作成</b><small>新しい4桁ルームを作って待機する。</small>`;
  if (createRoomBtn) createCard.appendChild(createRoomBtn);

  actionGrid.append(soloCard, createCard);

  const joinCard = document.createElement("div");
  joinCard.className = "roomJoinCard";
  const joinTitle = document.createElement("b");
  joinTitle.textContent = "ルーム参加";
  const joinDesc = document.createElement("small");
  joinDesc.textContent = "相手の4桁コードを入力して合流する。";
  const joinLine = document.createElement("div");
  joinLine.className = "roomJoinLine";
  if (joinInput) joinLine.appendChild(joinInput);
  if (joinRoomBtn) joinLine.appendChild(joinRoomBtn);
  joinCard.append(joinTitle, joinDesc, joinLine);

  const note = document.createElement("div");
  note.className = "roomEntryNote";
  note.textContent = "プレイヤー名はユーザー画面で変更。マップ選択はここでは表示せず、対戦開始の操作だけに絞っています。";

  body.classList.add("roomStartBody");
  body.replaceChildren(actionGrid, joinCard, note);
}

// =====================
// TTL / Reset
// =====================
function expiresAtFromNow() {
  return Timestamp.fromMillis(Date.now() + ROOM_TTL_MS);
}
function isExpiredRoomDoc(roomDocData) {
  const exp = roomDocData?.expiresAt;
  const ms = exp && typeof exp.toMillis === "function" ? exp.toMillis() : null;
  return !!(ms && ms < Date.now());
}
async function touchRoom(rid, extra = {}) {
  await setDoc(
    roomRef(rid),
    {
      lastActiveAt: serverTimestamp(),
      expiresAt: expiresAtFromNow(),
      ...extra,
    },
    { merge: true },
  );
}
async function resetRoomHardish(rid) {
  try {
    const ps = await getDocs(playersCol(rid));
    for (const d of ps.docs) await deleteDoc(d.ref);
  } catch (e) {
    console.warn("resetRoom: players delete failed", e);
  }
  try {
    await deleteDoc(matchRef(rid));
  } catch {}
  try {
    await deleteDoc(stateRef(rid));
  } catch {}
}

// =====================
// Data load
// =====================
async function loadCollectionSafe(colName, kindLabel) {
  try {
    const snap = await getDocs(collection(db, colName));
    const m = {};
    snap.forEach((d) => {
      const data = d.data() || {};
      if (!data.kind && kindLabel) data.kind = kindLabel;
      const cardId = String(data.id || d.id || "").trim();
      if (!cardId) return;
      data.id = cardId;
      data.kind = normalizeKind(data.kind, data);
      data._sourceDocId = d.id;
      data._sourceCollection = colName;
      m[cardId] = data;
    });
    return m;
  } catch (e) {
    console.warn("loadCollectionSafe skip:", colName, e?.message || e);
    return {};
  }
}

function stableCardValue(v) {
  if (Array.isArray(v)) return v.map(stableCardValue);
  if (!v || typeof v !== "object") return v;
  return Object.keys(v).sort().reduce((out, key) => {
    out[key] = stableCardValue(v[key]);
    return out;
  }, {});
}

function duplicateSupportKey(cardId, def = {}) {
  const kind = normalizedKindOf(def, cardId);
  if (kind !== "support" && kind !== "ex_support") return "";
  const name = String(def.name || "").trim();
  if (!name) return "";
  const effect = def.effect ?? def.effects ?? def.action ?? def.actions ?? "";
  const effectText = JSON.stringify(stableCardValue(effect));
  return [
    kind,
    name,
    String(def.cost ?? ""),
    String(def.type || def.attr || ""),
    effectText,
    firstActionLine(def),
  ].join("|");
}

function dedupeCardDefinitions(defs) {
  const out = {};
  const seenSupport = new Map();
  for (const [rawId, rawDef] of Object.entries(defs || {})) {
    const id = String(rawDef?.id || rawId || "").trim();
    if (!id || !rawDef) continue;
    const def = { ...rawDef, id };
    def.kind = normalizeKind(def.kind || "", def);
    const dupKey = duplicateSupportKey(id, def);
    if (dupKey && seenSupport.has(dupKey)) {
      const keepId = seenSupport.get(dupKey);
      out[keepId] = {
        ...def,
        ...out[keepId],
        _duplicateIds: [...new Set([...(out[keepId]._duplicateIds || []), id])],
      };
      continue;
    }
    out[id] = def;
    if (dupKey) seenSupport.set(dupKey, id);
  }
  return out;
}

async function loadCards() {
  const base = await loadCollectionSafe("cards", "unit");

  const supportsA = await loadCollectionSafe("support_cards", "support");
  const supportsB = await loadCollectionSafe("supports", "support");
  const supportsC = await loadCollectionSafe("supportCards", "support");

  const exA = await loadCollectionSafe("ex_support_cards", "ex_support");
  const exB = await loadCollectionSafe("ex_supports", "ex_support");
  const exC = await loadCollectionSafe("exSupportCards", "ex_support");
  const exD = await loadCollectionSafe("ex_support", "ex_support");

  cardDefs = dedupeCardDefinitions({
    ...STARTER_SUPPORT_CARD_MAP,
    ...supportsA,
    ...supportsB,
    ...supportsC,
    ...exA,
    ...exB,
    ...exC,
    ...exD,
    ...base,
    ...FAIRY_TALE_CARDS,
    ...JEWEL_CARDS,
  });

  // 一般ユーザーは hidden カードを見せない
  if (!isAdminUser()) {
    for (const id of Object.keys(cardDefs)) {
      if (cardDefs[id]?.hidden) {
        delete cardDefs[id];
      }
    }
  }

  cardIdsSorted = Object.keys(cardDefs).sort((a, b) => {
    const A = cardDefs[a] || {};
    const B = cardDefs[b] || {};
    const kA = normalizedKindOf(A, a);
    const kB = normalizedKindOf(B, b);
    if (kA !== kB) return kA.localeCompare(kB, "ja");

    const tA = String(A.type || "");
    const tB = String(B.type || "");
    if (tA !== tB) return tA.localeCompare(tB, "ja");

    const cA = Number(A.cost || 0);
    const cB = Number(B.cost || 0);
    if (cA !== cB) return cA - cB;

    return String(A.name || a).localeCompare(String(B.name || b), "ja");
  });
}

async function initOwnedCards() {
  try {
    const profile = await ensureUserProfile();
    currentProfileUid = profile?.uid || getUserDocUid();
    if (!currentProfileUid) return;
    const youCard = normalizeYouCard(profile?.data?.youCard, currentProfileUid);
    cardDefs[YOU_CARD_ID] = youCard;
    if (!cardIdsSorted.includes(YOU_CARD_ID)) cardIdsSorted.unshift(YOU_CARD_ID);

    const starter = await ensureStarterOwnedCards(currentProfileUid, cardDefs);
    ownedCounts = normalizeOwnedCounts(starter?.ownedCounts || await getOwnedCounts(currentProfileUid));
    ownedReady = true;

    if (ownedUnsubscribe) {
      try {
        ownedUnsubscribe();
      } catch {}
    }
    ownedUnsubscribe = watchOwnedCards(
      currentProfileUid,
      (ownedList) => {
        const next = {};
        for (const item of ownedList || []) {
          next[item.cardId] = item.count;
        }
        ownedCounts = normalizeOwnedCounts(next);
        ownedReady = true;
        if (deckMap && Object.keys(deckMap).length) {
          pruneDeckByOwnership("");
          saveLocalDeck();
        }
        renderAll();
      },
      (e) => console.warn("watchOwnedCards failed:", e?.message || e),
    );
  } catch (e) {
    console.warn("initOwnedCards failed:", e?.message || e);
    ownedCounts = {};
    ownedReady = false;
  }
}

async function loadDeckFromUser() {
  try {
    const uid = getUserDocUid();
    if (!uid) return false;
    const us = await getDoc(userRef(uid));

    if (!us.exists()) return false;

    const d = us.data() || {};
    const dm = d.deck || {};
    if (dm && typeof dm === "object" && !Array.isArray(dm)) {
      deckMap = normalizeDeckMap(dm);
    }

    if (d.exSupport) selectedExSupportId = String(d.exSupport || "");
    if (d.desiredField) {
      const fid = saveDesiredField(d.desiredField);
      const sel = document.getElementById("fieldSelect");
      if (sel) sel.value = fid;
    }
    if (typeof d.deckTitle === "string" && d.deckTitle.trim()) {
      const t = normalizeDeckTitle(d.deckTitle);
      if (t) {
        saveDeckTitle(t);
        if (deckTitleInput) deckTitleInput.value = t;
      }
    }

    // 名前も保存されていれば拾う
    const storedName = d.playerName || d.displayName || d.name || "";
    if (typeof storedName === "string" && storedName.trim()) {
      const n = normalizeName(storedName);
      if (n) {
        saveName(n);
        if (playerNameInput && !playerNameInput.value.trim())
          playerNameInput.value = n;
        updateRoomPlayerSummary();
      }
    }

    return true;
  } catch (e) {
    console.warn("loadDeckFromUser failed:", e?.message || e);
    return false;
  }
}

async function saveDeckToUser(name) {
  try {
    const user = await ensureSignedIn();
    if (!user?.uid) return false;

    const title = normalizeDeckTitle(
      deckTitleInput?.value || loadDeckTitle() || "",
    );
    const safeName = normalizeName(name || loadName() || "") || "player";
    await setDoc(
      userRef(user.uid),
      {
        name: safeName,
        nameLower: safeName.toLowerCase(),
        playerName: safeName,
        playerNameLower: safeName.toLowerCase(),
        displayName: safeName,
        displayNameLower: safeName.toLowerCase(),
        deck: deckMap || {},
        exSupport: selectedExSupportId || "",
        deckTitle: title || "",
        desiredField: desiredField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  } catch (e) {
    console.warn("saveDeckToUser failed:", e?.message || e);
    return false;
  }
}

async function loadDeckPreferFirestore(rid, pid) {
  try {
    const ps = await getDoc(playerRef(rid, pid));
    if (ps.exists()) {
      const d = ps.data() || {};
      const dm = d.deck || {};
    if (dm && typeof dm === "object" && !Array.isArray(dm)) {
      deckMap = normalizeDeckMap(dm);
    }

      if (d.exSupport) selectedExSupportId = String(d.exSupport || "");
      if (d.desiredField) {
        const fid = saveDesiredField(d.desiredField);
        const sel = document.getElementById("fieldSelect");
        if (sel) sel.value = fid;
      }

      // deck title
      if (typeof d.deckTitle === "string" && d.deckTitle.trim()) {
        const t = normalizeDeckTitle(d.deckTitle);
        if (t) {
          saveDeckTitle(t);
          if (deckTitleInput) deckTitleInput.value = t;
        }
      }
      return;
    }
  } catch (e) {
    console.warn("loadDeckPreferFirestore fallback to local", e);
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    deckMap = normalizeDeckMap(raw ? JSON.parse(raw) || {} : {});
  } catch {
    deckMap = {};
  }

  // local title
  const t = normalizeDeckTitle(loadDeckTitle());
  if (deckTitleInput && t) deckTitleInput.value = t;
}

function consumePendingCloudDeck() {
  try {
    const raw = localStorage.getItem(PENDING_CLOUD_DECK_KEY);
    if (!raw) return false;
    localStorage.removeItem(PENDING_CLOUD_DECK_KEY);

    const snap = JSON.parse(raw) || {};
    const deck = snap.deck && typeof snap.deck === "object" ? snap.deck : {};
    deckMap = normalizeDeckMap(deck);

    if (typeof snap.exSupport === "string") {
      selectedExSupportId = snap.exSupport || "";
      saveSelectedEx(selectedExSupportId);
    }

    if (snap.desiredField) {
      const fid = saveDesiredField(snap.desiredField);
      const sel = document.getElementById("fieldSelect");
      if (sel) sel.value = fid;
    }

    const title = normalizeDeckTitle(snap.title || "");
    if (title) {
      saveDeckTitle(title);
      if (deckTitleInput) deckTitleInput.value = title;
    }

    if (snap.sourceId) {
      try {
        localStorage.setItem("tcg_cloud_deck_last_id_v20260204", String(snap.sourceId));
      } catch {}
    }

    return true;
  } catch (e) {
    console.warn("consumePendingCloudDeck failed:", e?.message || e);
    try {
      localStorage.removeItem(PENDING_CLOUD_DECK_KEY);
    } catch {}
    return false;
  }
}

function saveLocalDeck() {
  try {
    deckMap = normalizeDeckMap(deckMap || {});
    localStorage.setItem(LOCAL_KEY, JSON.stringify(deckMap || {}));
  } catch {}
}

// =====================
// Detail
// =====================
function ensureDeckDetailStyle() {
  if (document.getElementById("deckDetailStyle_v20260725_dark_illusion_gen1")) return;
  const css = document.createElement("style");
  css.id = "deckDetailStyle_v20260725_dark_illusion_gen1";
  css.textContent = `
    .deckDetailHero{
      display:grid;
      grid-template-columns:96px minmax(0,1fr);
      gap:12px;
      align-items:start;
      margin-bottom:12px;
    }
    .deckDetailArt{
      position:relative;
      width:96px;
      aspect-ratio:5 / 7;
      min-height:0;
      overflow:hidden;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:linear-gradient(135deg, rgba(255,255,255,.10), rgba(0,0,0,.26));
      box-shadow:inset 0 0 22px rgba(255,255,255,.04), 0 14px 30px rgba(0,0,0,.22);
    }
    .deckDetailArtImg{
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
      object-position:center top;
      display:block;
      background:#f8f8f5;
    }
    .deckDetailCost{
      position:absolute;
      top:7px;left:7px;
      min-width:30px;height:30px;
      display:grid;place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.24);
      background:rgba(0,0,0,.48);
      font-weight:1000;
    }
    .deckDetailInfo{
      min-width:0;
      display:flex;
      flex-direction:column;
      gap:8px;
      padding:3px 0;
    }
    .deckDetailName{
      display:block;
      font-size:18px;
      line-height:1.24;
      word-break:break-word;
    }
    .deckDetailBadges,.deckDetailMetaGrid{
      display:flex;
      gap:6px;
      flex-wrap:wrap;
    }
    .deckDetailBadge,.deckDetailMeta{
      display:inline-flex;
      align-items:center;
      min-height:26px;
      padding:4px 8px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.13);
      background:rgba(255,255,255,.055);
      color:rgba(255,255,255,.78);
      font-size:11px;
      font-weight:850;
    }
    .deckDetailMeta{border-radius:10px;background:rgba(0,0,0,.18);}
    .deckDetailSection{
      margin-top:10px;
      padding:9px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.10);
      background:rgba(0,0,0,.18);
    }
    .deckDetailSection b{font-size:13px;}
    .deckDetailAction{
      margin-top:8px;
      padding:9px;
      border-radius:12px;
      border:1px solid rgba(255,255,255,.10);
      background:linear-gradient(135deg, rgba(255,255,255,.06), rgba(0,0,0,.20));
      font-size:12px;
      line-height:1.55;
    }
    .deckDetailActionHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin-bottom:5px;
      font-weight:1000;
    }
    .deckDetailDelta{
      display:flex;
      gap:6px;
      flex-wrap:wrap;
      margin:5px 0;
    }
    .deckDetailHeart{
      display:inline-flex;
      min-height:24px;
      align-items:center;
      padding:3px 7px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.13);
      background:rgba(255,255,255,.055);
      font-weight:900;
    }
    .deckDetailHeart.hpDmg{color:#ffb0bb;border-color:rgba(255,100,120,.30);background:rgba(255,80,100,.10);}
    .deckDetailHeart.spDmg{color:#a8d7ff;border-color:rgba(90,170,255,.30);background:rgba(90,170,255,.10);}
    .deckDetailHeart.heal{color:#a8ffd0;border-color:rgba(120,255,170,.28);background:rgba(70,220,130,.10);}
    @media (max-width:520px){
      .deckDetailHero{grid-template-columns:76px minmax(0,1fr);}
      .deckDetailArt{width:76px;}
      .deckDetailName{font-size:15px;}
    }
  `;
  document.head.appendChild(css);
}

function showCardDetail(cardId) {
  openDetail();
  ensureDeckDetailStyle();
  const d = cardDefs[cardId];
  if (!d || !detailEl) return;

  const supportLike = isSupportLike(d, cardId);
  const ownedLabel = isAdminUser() ? "管理: 表示" : ownedReady ? `${ownedCount(cardId)}枚` : "確認中";
  let html = `
    <div class="deckDetailHero">
      <div class="deckDetailArt">
        ${cardArtImgHtml(cardId, d, "deckDetailArtImg")}
        <span class="deckDetailCost">${esc(d.cost ?? 0)}</span>
      </div>
      <div class="deckDetailInfo">
        <div class="deckDetailBadges">
          <span class="deckDetailBadge">${esc(kindLabel(normalizedKindOf(d, cardId) || (supportLike ? "support" : "unit")))}</span>
          ${d.type ? `<span class="deckDetailBadge">${esc(d.type)}</span>` : ""}
          <span class="deckDetailBadge">${esc(cardSeriesLabel(cardId, d))}</span>
        </div>
        <b class="deckDetailName">${esc(d.name || cardId)}</b>
        <div class="small">${esc(cardId)}</div>
        <div class="deckDetailMetaGrid">
          <span class="deckDetailMeta">所持 ${esc(ownedLabel)}</span>
          <span class="deckDetailMeta">上限 ${esc(deckLimitForCard(cardId))}</span>
          ${!supportLike && (d.hp !== undefined || d.sp !== undefined) ? `<span class="deckDetailMeta">HP ${esc(d.hp ?? "?")} / SP ${esc(d.sp ?? "?")}</span>` : ""}
        </div>
      </div>
    </div>
  `;

  // サポート/effect 表示
  const effText = supportSummaryText(d);
  if (effText) {
    html += `<div class="deckDetailSection"><b>効果</b><br>${esc(effText)}</div>`;
  }

  // 行動(actions)を表示
  const acts = d.actions || [];
  if (acts.length) {
    html += `<b>行動</b><br>`;
    acts.forEach((a) => {
      // debug: console から参照できるように
      try {
        window.__lastDetail = { cardId, action: a, card: d };
      } catch {}

      // action_text.js 側の parts を優先
      let parts = null;
      try {
        parts = window.actionDetailPartsJa
          ? window.actionDetailPartsJa(a)
          : null;
      } catch {}

      const cost = parts?.cost ?? a.cost ?? "";
      const name = parts?.name ?? a.name ?? "";
      const rate = parts?.rate ?? a.rate ?? "";
      const range =
        parts?.range ??
        (window.rangeToArrowJa
          ? window.rangeToArrowJa(a.range)
          : (a.range ?? ""));

      // ダメージ/回復(delta符号対応)
      const hpDmg = parts?.hpDmg ?? Math.max(0, -(Number(a.hpDelta) || 0));
      const spDmg = parts?.spDmg ?? Math.max(0, -(Number(a.spDelta) || 0));
      const hpHeal = parts?.hpHeal ?? Math.max(0, Number(a.hpDelta) || 0);
      const spHeal = parts?.spHeal ?? Math.max(0, Number(a.spDelta) || 0);

      // 特殊効果
      let special = parts?.effectText ?? "";
      if (!special) {
        try {
          special = window.actionSpecialTextJa
            ? window.actionSpecialTextJa(a)
            : "";
        } catch {}
      }
      special = sanitizeActionDisplayText(special);

      html += `<div class="deckDetailAction">`;
      html += `<div class="deckDetailActionHead"><span>【${esc(cost)}】${esc(name)}</span><span>成功率 ${esc(rate)}%</span></div>`;

      const dmgLine = [];
      if (hpDmg) dmgLine.push(`<span class="deckDetailHeart hpDmg">${esc(vitalDeltaText("HP", -hpDmg))}</span>`);
      if (spDmg) dmgLine.push(`<span class="deckDetailHeart spDmg">${esc(vitalDeltaText("SP", -spDmg))}</span>`);
      if (hpHeal) dmgLine.push(`<span class="deckDetailHeart heal">${esc(vitalDeltaText("HP", hpHeal))}</span>`);
      if (spHeal) dmgLine.push(`<span class="deckDetailHeart heal">${esc(vitalDeltaText("SP", spHeal))}</span>`);
      if (dmgLine.length) html += `<div class="deckDetailDelta">${dmgLine.join("")}</div>`;

      html += `射程: ${esc(range)}<br>`;

      if (special && String(special).trim()) {
        html += `効果: ${esc(special)}<br>`;
      }

      html += `</div>`;
    });
  } else if (!effText) {
    html += `<div class="deckDetailSection">詳細情報なし</div>`;
  }

  if (isExSelectable(d)) {
    const isSel = selectedExSupportId === cardId;
    html += `<hr style="border:0;border-top:1px solid rgba(255,255,255,.15);margin:10px 0;">`;
    html += isSel
      ? `<b>このカードは現在EXに指定中</b>`
      : `<b>このカードはEX未指定</b>`;
  }

  detailEl.innerHTML = html;
}

// =====================
// Tabs
// =====================
function setTab(key) {
  if (tabEls.length) {
    for (const el of tabEls) {
      const k = String(el.dataset.tab || "");
      el.classList.toggle("active", k === key);
    }
  }
  if (tabCreateBody) tabCreateBody.hidden = key !== "create";
  if (tabJoinBody) tabJoinBody.hidden = key !== "join";
}
function initTabs() {
  if (!tabEls.length && !tabCreateBody && !tabJoinBody) return;
  for (const el of tabEls)
    el.addEventListener("click", () =>
      setTab(String(el.dataset.tab || "create")),
    );
  setTab("create");
}

// =====================
// Enable/disable
// =====================
let injectedCreateBtn = null;
let injectedJoinBtn = null;

function updatePlayButtons() {
  const total = sumDeck(deckMap);
  const okDeck = total === DECK_SIZE;

  if (createBtn) createBtn.disabled = !okDeck;

  let okJoin = okDeck;
  if (joinCodeInput) {
    const code = (joinCodeInput.value || "").trim();
    okJoin = okJoin && /^\d{4}$/.test(code);
  }
  if (joinBtn) joinBtn.disabled = !okJoin;

  if (!okDeck) setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);
  else setMsg("", true);

  if (injectedCreateBtn) injectedCreateBtn.disabled = !okDeck;
  if (injectedJoinBtn) injectedJoinBtn.disabled = !okJoin;
}

// =====================
// Render
// =====================
function renderDeck() {
  ensureDeckControlCss();
  ensureDeckFlowCss();
  ensureDeckPanelLayoutGuardCss();
  const total = sumDeck(deckMap);
  if (deckCountEl) deckCountEl.textContent = String(total);
  const deckPanelEl = document.getElementById("deckPanel");
  if (deckPanelEl) {
    const fill = Math.max(0, Math.min(100, Math.round((total / DECK_SIZE) * 100)));
    deckPanelEl.style.setProperty("--deck-fill", `${fill}%`);
    deckPanelEl.classList.toggle("deckFull", total === DECK_SIZE);
    deckPanelEl.classList.toggle("deckAlmost", total >= DECK_SIZE - 5 && total < DECK_SIZE);
  }
  renderDeckProgress(total);
  renderDeckSortControls();

  if (!deckListEl) return;
  deckListEl.innerHTML = "";

  const idsInDeck = Object.keys(deckMap).sort(compareDeckCards);

  if (!idsInDeck.length) {
    const empty = document.createElement("div");
    empty.className = "deckEmptyHint";
    empty.innerHTML = `
      <div>
        <b>まだカードが入っていません</b><br />
        左のカード一覧から＋で追加できます。
      </div>
    `;
    deckListEl.appendChild(empty);
  }

  for (const cardId of idsInDeck) {
    const def = cardDefs[cardId] || {};
    const cnt = Number(deckMap[cardId] || 0);
    const limit = deckLimitForCard(cardId);

    const isSupportRow = isSupport(def, cardId);
    const isSelEx = selectedExSupportId === cardId;

    const exBtnHtml = isSupportRow
      ? `<button class="miniBtn" data-ex="${esc(cardId)}" title="${isSelEx ? "EX解除" : "EXにする"}">${isSelEx ? "解除" : "EX"}</button>`
      : ``;

    const row = document.createElement("div");
    row.className = cardListEl ? "cardRow" : "card";
    row.dataset.cardId = cardId;
    row.dataset.kind = filterKindForCard(def, cardId);
    const rowAttr = cardAttrForFilter(def);
    if (rowAttr) row.dataset.type = rowAttr;
    row.dataset.cost = String(def.cost ?? "");
    row.dataset.count = String(cnt);
    row.classList.toggle("isMaxed", limit > 0 && cnt >= limit);
    row.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";

    if (cardListEl) {
      row.innerHTML = `
        <div>
          <div class="name">【${esc(def.cost)}】${esc(def.name || cardId)}${cardNameTypeSuffix(def, cardId)}${cardAttrBadgeHtml(def)}${ownedBadgeHtml(cardId)}${cardSeriesHtml(cardId, def)}</div>
          <div class="sub">
            ${deckRowMetaLine(def, cardId)}
          </div>
          ${deckRoleTagsHtml(def, 2, cardId)}
        </div>
        <div class="btns">
          ${exBtnHtml}
          <button class="miniBtn" data-minus="${esc(cardId)}">-</button>
          <div class="count">${cnt} / ${limit}</div>
          <button class="miniBtn" data-plus="${esc(cardId)}" ${cnt >= limit ? "disabled" : ""}>+</button>
          <button class="miniBtn" data-detail="${esc(cardId)}">詳細</button>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="cardHead">
          <div>
            <b>【${esc(def.cost)}】${esc(def.name || cardId)}${cardNameTypeSuffix(def, cardId)}${cardAttrBadgeHtml(def)}${ownedBadgeHtml(cardId)}${cardSeriesHtml(cardId, def)}</b>
            <div class="small">${deckRowMetaLine(def, cardId)}</div>
            ${deckRoleTagsHtml(def, 2, cardId)}
          </div>
          <div class="btns">
            ${exBtnHtml.replaceAll('class="miniBtn"', "")}
            <button data-minus="${esc(cardId)}">-</button>
            <div class="cnt">${cnt} / ${limit}</div>
            <button data-plus="${esc(cardId)}" ${cnt >= limit ? "disabled" : ""}>+</button>
            <button data-detail="${esc(cardId)}">詳細</button>
          </div>
        </div>
      `;
    }

    row.querySelector("[data-minus]")?.addEventListener("click", (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      removeFromDeck(cardId);
    });
    row.querySelector("[data-plus]")?.addEventListener("click", (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      addToDeck(cardId);
    });
    row.querySelector("[data-detail]")?.addEventListener("click", (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      showDeckQuickDetail(cardId);
    });

    row.querySelector("[data-ex]")?.addEventListener("click", (e) => {
      e.preventDefault?.();
      e.stopPropagation?.();
      if (isSelEx) clearExSupport();
      else selectExSupport(cardId);
    });

    deckListEl.appendChild(row);
  }

  // EXまとめ表示
  const box = document.createElement("div");
  box.className = "deckExSummary";
  if (!selectedExSupportId) box.dataset.empty = "true";
  box.style.marginTop = "10px";
  box.style.padding = "10px";
  box.style.border = "1px solid rgba(255,255,255,.15)";
  box.style.borderRadius = "12px";
  box.style.background = "rgba(0,0,0,.18)";
  const selName = selectedExSupportId
    ? cardDefs[selectedExSupportId]?.name || selectedExSupportId
    : "未選択";
  box.innerHTML = `
    <div style="font-weight:900;">EX: ${esc(selName)}</div>
    <div style="opacity:.8;font-size:12px;margin-top:4px;">
      デッキ内のサポートカードから「EXにする」で指定できます（1枚だけ）。
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <button ${selectedExSupportId ? "" : "disabled"} data-ex-clear>EX解除</button>
    </div>
  `;
  box
    .querySelector("[data-ex-clear]")
    ?.addEventListener("click", clearExSupport);
  deckListEl.appendChild(box);
  deckListEl.appendChild(renderDeckLab());

  updatePlayButtons();
}

function renderCardListNewUI() {
  if (!cardListEl) return;
  cardListEl.innerHTML = "";
  const nameQ = (filterName || "").trim().normalize("NFKC").toLowerCase();

  for (const cardId of cardIdsSorted) {
    const def = cardDefs[cardId] || {};
    const notOwned = isOwnedSystemActive() && ownedCount(cardId) <= 0;
    if (!passesCurrentCardFilters(cardId, def, notOwned)) continue;
    if (nameQ && !cardSearchText(cardId, def).includes(nameQ)) continue;
    const cnt = Number(deckMap[cardId] || 0);
    const limit = deckLimitForCard(cardId);

    const exOnly = isExSupport(def, cardId);
    const canAddMore = !exOnly && limit > 0 && cnt < limit && sumDeck(deckMap) < DECK_SIZE;
    const isSelEx = exOnly && selectedExSupportId === cardId;

    const row = document.createElement("div");
    row.className = "cardRow";
    row.classList.toggle("notOwned", notOwned);
    row.dataset.cardId = cardId;
    row.dataset.kind = filterKindForCard(def, cardId);
    const rowAttr = cardAttrForFilter(def);
    if (rowAttr) row.dataset.type = rowAttr;
    row.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";
    const adminHiddenUi = isAdminUser()
      ? `
        <button
          class="miniBtn adminHideToggle ${def.hidden ? "isHidden" : ""}"
          data-hide-toggle="${esc(cardId)}"
          type="button"
        >${def.hidden ? "公開に戻す" : "非公開にする"}</button>
      `
      : "";

    row.innerHTML = `
      <div>
        <div class="name">
          【${esc(def.cost)}】${esc(def.name || cardId)}${cardNameTypeSuffix(def, cardId)}
          ${cardAttrBadgeHtml(def)}
          ${ownedBadgeHtml(cardId)}
          ${cardSeriesHtml(cardId, def)}
          ${def.hidden ? `<span style="color:#ff8a8a;font-size:12px;">[非公開中]</span>` : ""}
        </div>
        <div class="sub">
          ${cardSubLine(def, cardId)}
        </div>
      </div>
      <div class="btns">
        ${adminHiddenUi}
        ${
          exOnly
            ? `<button class="miniBtn" data-expick ${canUseCard(cardId) ? "" : "disabled"}>${isSelEx ? "選択中" : "EXにする"}</button>`
            : `
              <button class="miniBtn" data-minus="${esc(cardId)}" ${cnt <= 0 ? "disabled" : ""}>-</button>
              <div class="count">${cnt} / ${limit}</div>
              <button class="miniBtn" data-plus="${esc(cardId)}" ${canAddMore ? "" : "disabled"}>+</button>
            `
        }
        <button class="miniBtn" data-detail="${esc(cardId)}">詳細</button>
      </div>
    `;

    if (def.hidden) {
      row.style.opacity = "0.55";
      row.style.border = "1px solid rgba(255,80,80,.6)";
    }
    row.querySelector("[data-minus]")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeFromDeck(cardId);
    });

    row.querySelector("[data-plus]")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      addToDeck(cardId);
    });

    row.querySelector("[data-detail]")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCardDetail(cardId);
    });

    row
      .querySelector(`[data-hide-toggle="${cardId}"]`)
      ?.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const nextHidden = !def.hidden;
        const ok = await toggleCardHidden(cardId, nextHidden);
        if (!ok) return;

        if (cardDefs[cardId]) {
          cardDefs[cardId].hidden = nextHidden;
        }

        setMsg(
          nextHidden
            ? `非公開にしました: ${def.name || cardId}`
            : `公開に戻しました: ${def.name || cardId}`,
          true,
        );

        renderAll();
      });

    row.querySelector("[data-expick]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isSelEx) clearExSupport();
      else selectExSupport(cardId);
    });
    cardListEl.appendChild(row);
  }
}

function renderCardSectionsOldUI() {
  if (!cardSectionsEl) return;
  cardSectionsEl.innerHTML = "";

  const nameQ = (filterName || "").trim().normalize("NFKC").toLowerCase();
  const matches = cardIdsSorted.filter((id) => {
    const def = cardDefs[id] || {};
    const notOwned = isOwnedSystemActive() && ownedCount(id) <= 0;
    if (!passesCurrentCardFilters(id, def, notOwned)) return false;
    if (nameQ && !cardSearchText(id, def).includes(nameQ)) return false;
    return true;
  });

  if (shownCountEl) shownCountEl.textContent = String(matches.length);

  const byType = new Map();
  for (const id of matches) {
    const t = cardAttrForFilter(cardDefs[id] || {}) || "その他";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(id);
  }

  const typesOrdered = Array.from(byType.keys()).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );

  for (const t of typesOrdered) {
    const ids = byType.get(t) || [];
    const wrap = document.createElement("details");
    wrap.open = filterType === "ALL" || filterType === t;

    const summary = document.createElement("summary");
    summary.textContent = `${t}: ${ids.length}枚`;
    wrap.appendChild(summary);

    const inner = document.createElement("div");
    inner.className = "sectionInner";

    for (const cardId of ids) {
      const def = cardDefs[cardId] || {};
      const cnt = Number(deckMap[cardId] || 0);

      const exOnly = isExSupport(def, cardId);
      const limit = deckLimitForCard(cardId);
      const canAddMore = !exOnly && limit > 0 && cnt < limit && sumDeck(deckMap) < DECK_SIZE;
      const notOwned = isOwnedSystemActive() && ownedCount(cardId) <= 0;
      const isSelEx = exOnly && selectedExSupportId === cardId;

      const div = document.createElement("div");
      div.className = "card";
      div.classList.toggle("notOwned", notOwned);
      div.dataset.cardId = cardId;
      div.dataset.kind = filterKindForCard(def, cardId);
      const rowAttr = cardAttrForFilter(def);
      if (rowAttr) div.dataset.type = rowAttr;
      div.style.outline = isSelEx ? "2px solid rgba(90,170,255,.7)" : "";
      div.innerHTML = `
        <div class="cardHead">
          <div>
            <b>【${esc(def.cost)}】${esc(def.name || cardId)}${cardNameTypeSuffix(def, cardId)}${cardAttrBadgeHtml(def)}${ownedBadgeHtml(cardId)}${cardSeriesHtml(cardId, def)}</b>
            <div class="small">${cardSmallMetaLine(def, cardId)}</div>
            <div class="small">${esc(firstActionLine(def))}</div>
          </div>
          <div class="btns">
            ${
              exOnly
                ? `<button data-expick ${canUseCard(cardId) ? "" : "disabled"}>${isSelEx ? "選択中" : "EXにする"}</button>`
                : `
                  <button data-minus="${esc(cardId)}" ${cnt <= 0 ? "disabled" : ""}>-</button>
                  <div class="cnt">${cnt || 0} / ${limit}</div>
                  <button data-plus="${esc(cardId)}" ${canAddMore ? "" : "disabled"}>+</button>
                `
            }
            <button data-detail="${esc(cardId)}">詳細</button>
          </div>
        </div>
      `;

      div
        .querySelector("[data-minus]")
        ?.addEventListener("click", (e) => {
          e.preventDefault?.();
          e.stopPropagation?.();
          removeFromDeck(cardId);
        });
      div
        .querySelector("[data-plus]")
        ?.addEventListener("click", (e) => {
          e.preventDefault?.();
          e.stopPropagation?.();
          addToDeck(cardId);
        });
      div
        .querySelector("[data-detail]")
        ?.addEventListener("click", (e) => {
          e.preventDefault?.();
          e.stopPropagation?.();
          showCardDetail(cardId);
        });
      div.querySelector("[data-expick]")?.addEventListener("click", (e) => {
        e.preventDefault?.();
        e.stopPropagation?.();
        if (isSelEx) clearExSupport();
        else selectExSupport(cardId);
      });

      inner.appendChild(div);
    }

    wrap.appendChild(inner);
    cardSectionsEl.appendChild(wrap);
  }

  if (!typesOrdered.length) {
    cardSectionsEl.innerHTML = `<div class="small" style="opacity:0.85;">該当するカードがありません</div>`;
  }
}

// Detail buttons are re-rendered by mobile/card-layout hotfixes.
document.addEventListener("click", (e) => {
  const btn = e.target instanceof Element ? e.target.closest("[data-detail]") : null;
  if (!btn || (!btn.closest("#cardList") && !btn.closest("#deckList") && !btn.closest("#cardSections"))) return;
  const cardId = String(btn.getAttribute("data-detail") || btn.closest("[data-card-id]")?.getAttribute("data-card-id") || "").trim();
  if (!cardId || !cardDefs[cardId]) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  showCardDetail(cardId);
}, true);

function renderAll() {
  ensureDeckCriticalBlockCss();
  setupMobileDeckStack();
  setupLibraryPanelWorkbench();
  if (cardListEl) renderCardListNewUI();
  if (cardSectionsEl) renderCardSectionsOldUI();
  renderDeck();
  enforceMobileDeckStack();
}

// =====================
// Save / Create / Join
// =====================
async function ensurePlayerDoc(rid, pid, name) {
  const user = await ensureSignedIn();
  await setDoc(
    playerRef(rid, pid),
    {
      uid: user?.uid || "",
      name: name || "player",
      deck: deckMap || {},
      exSupport: selectedExSupportId || "",
      desiredField: desiredField(),
      deckTitle: normalizeDeckTitle(
        deckTitleInput?.value || loadDeckTitle() || "",
      ),
      ready: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function saveDeckOnly(rid, pid) {
  try {
    const name = askNameIfNeeded();

    const title = normalizeDeckTitle(
      deckTitleInput?.value || loadDeckTitle() || "",
    );
    if (title) saveDeckTitle(title);

    await setDoc(
      playerRef(rid, pid),
      {
        name,
        deck: deckMap || {},
        exSupport: selectedExSupportId || "",
        deckTitle: title || "",
        desiredField: desiredField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await saveDeckToUser(name);
    saveLocalDeck();
    saveSelectedEx(selectedExSupportId || "");
    setMsg("保存しました。", true);
    setTimeout(() => setMsg("", true), 900);
  } catch (e) {
    console.error(e);
    saveLocalDeck();
    saveSelectedEx(selectedExSupportId || "");
    setMsg("保存に失敗しました（ローカル保存は完了）。", false);
  }
}

btnSave?.addEventListener("click", async () => {
  await saveDeckOnly(roomId, playerId);
});

function updateUrlAndLabels() {
  const p = new URLSearchParams(location.search);
  p.set("room", roomId);
  p.set("player", playerId);
  history.replaceState(null, "", `${location.pathname}?${p.toString()}`);
  if (roomIdLabel) roomIdLabel.textContent = roomId;
  if (playerIdLabel) playerIdLabel.textContent = playerId;
}

function readJoinCode() {
  if (joinCodeInput) return (joinCodeInput.value || "").trim();
  return prompt("参加する部屋番号（4桁）を入力", "")?.trim() || "";
}

async function handleCreateRoom() {
  const total = sumDeck(deckMap);
  if (total !== DECK_SIZE)
    return setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);

  const name = askNameIfNeeded();

  roomId = newRoomCode4();
  playerId = newPlayerId();
  updateUrlAndLabels();

  try {
    const rs = await getDoc(roomRef(roomId));
    if (rs.exists()) await resetRoomHardish(roomId);
  } catch {}

  const fid = desiredField();
  await touchRoom(roomId, {
    createdAt: serverTimestamp(),
    desiredField: fid,
    fieldId: fid,
    field: { id: fid },
  });
  await ensurePlayerDoc(roomId, playerId, name);
  await saveDeckToUser(name);

  saveLocalDeck();
  saveSelectedEx(selectedExSupportId || "");

  await launchBattleWithTransition(battleUrl(), "battle", {
    title: "ROOM READY",
    sub: "ルームを作成しました。対戦フィールドへ移動します。",
  });
}

async function handleJoinRoom() {
  const total = sumDeck(deckMap);
  if (total !== DECK_SIZE)
    return setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);

  const name = askNameIfNeeded();
  const code = readJoinCode();
  if (!isValidRoomCode4(code))
    return setMsg("部屋番号は0000以外の4桁（例: 1234）で入力してね", false);

  roomId = code;
  playerId = newPlayerId();
  updateUrlAndLabels();

  try {
    const rs = await getDoc(roomRef(roomId));
    if (rs.exists()) {
      const d = rs.data() || {};
      if (isExpiredRoomDoc(d)) await resetRoomHardish(roomId);
    }
  } catch {}

  const fid = desiredField();
  await touchRoom(roomId, {
    createdAt: serverTimestamp(),
    desiredField: fid,
    fieldId: fid,
    field: { id: fid },
  });
  await ensurePlayerDoc(roomId, playerId, name);
  await saveDeckToUser(name);

  saveLocalDeck();
  saveSelectedEx(selectedExSupportId || "");

  await launchBattleWithTransition(battleUrl(), "join", {
    title: "JOIN READY",
    sub: "参加情報を同期しました。対戦フィールドへ移動します。",
  });
}

// 既存ボタンにイベントを付ける
createBtn?.addEventListener("click", handleCreateRoom);
joinBtn?.addEventListener("click", handleJoinRoom);
btnSolo?.addEventListener("click", handleSoloRoom);

// =====================
// Solo (1人用)
// =====================

async function ensureCpuPlayerDoc(rid) {
  try {
    await setDoc(
      playerRef(rid, "cpu"),
      {
        name: "CPU",
        deck: deckMap || {},
        exSupport: "",
        deckTitle: "CPU",
        desiredField: desiredField(),
        ready: true,
        isCpu: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn("ensureCpuPlayerDoc failed:", e?.message || e);
  }
}

let soloStartInFlight = false;

async function handleSoloRoom() {
  if (soloStartInFlight) return;

  try {
    const total = sumDeck(deckMap);
    if (total !== DECK_SIZE) {
      setMsg(`${DECK_SIZE}枚ちょうどにしてください`, false);
      return;
    }

    soloStartInFlight = true;
    if (btnSolo) {
      btnSolo.disabled = true;
      btnSolo.dataset.prevText = btnSolo.textContent || "";
      btnSolo.textContent = "準備中...";
    }

    const name = askNameIfNeeded();

    // 新規ルーム作成
    roomId = newRoomCode4();
    playerId = newPlayerId();
    updateUrlAndLabels();

    // 既存があればリセット
    try {
      const rs = await getDoc(roomRef(roomId));
      if (rs.exists()) await resetRoomHardish(roomId);
    } catch {}

    // ルーム情報（ソロフラグ）
    const fid = desiredField();
    await touchRoom(roomId, {
      createdAt: serverTimestamp(),
      mode: "solo",
      solo: true,
      desiredField: fid,
      fieldId: fid,
      field: { id: fid },
    });

    // 自分
    await ensurePlayerDoc(roomId, playerId, name);
    await saveDeckToUser(name);

    // CPU
    await ensureCpuPlayerDoc(roomId);

    saveLocalDeck();
    saveSelectedEx(selectedExSupportId || "");

    await launchBattleWithTransition(battleUrl({ solo: "1", mode: "solo" }), "solo", {
      solo: true,
      title: "SOLO READY",
      sub: "CPUとデッキを同期しました。ソロバトルへ移動します。",
    });
  } catch (err) {
    console.error("handleSoloRoom failed:", err);
    soloStartInFlight = false;
    if (btnSolo) {
      btnSolo.disabled = false;
      btnSolo.textContent = btnSolo.dataset.prevText || "ソロで開始";
    }
    setMsg("ソロ開始に失敗しました。Consoleの赤いエラーを貼ってください。", false);
    alert("ソロ開始に失敗しました。\nコンソールの赤いエラーを貼ってください。");
  }
}

// index.html fallback から呼べるように公開
if (!window.__tcg_solo_bound) {
  window.__tcg_solo_bound = true;
  window.__tcg_handleSoloRoom = handleSoloRoom;
  window.addEventListener("tcg:solo", () => {
    try {
      handleSoloRoom();
    } catch (e) {
      console.error("[solo] failed", e);
    }
  });
}

// ランダムデッキ（ex_support は混ぜない）
randomDeckBtn?.addEventListener("click", () => {
  setMsg("", true);
  const ids = [...cardIdsSorted].filter(
    (id) => !isExSupport(cardDefs[id]) && deckLimitForCard(id) > 0,
  );
  if (!ids.length) return;

  const next = {};
  shuffleInPlace(ids);

  let guard = 9999;
  while (sumDeck(next) < DECK_SIZE && guard-- > 0) {
    for (const id of ids) {
      if (sumDeck(next) >= DECK_SIZE) break;
      const c = Number(next[id] || 0);
      if (c >= deckLimitForCard(id)) continue;
      next[id] = c + 1;
      if (sumDeck(next) >= DECK_SIZE) break;
    }
  }

  deckMap = next;
  renderAll();
  setMsg("ランダムデッキを作成しました（保存は「保存」ボタン）。", true);
});

btnClearDeck?.addEventListener("click", clearDeck);

typeSelect?.addEventListener("change", () => {
  filterType = typeSelect.value || "ALL";
  renderAll();
});
document.querySelectorAll("[data-kind-filter], [data-kind]").forEach((btn) => {
  btn.addEventListener("click", () => {
    filterKind = normalizeKindFilterValue(
      btn.dataset.kindFilter || btn.dataset.kind || "all",
    );
    document.body.dataset.kindFilter = filterKind;
    document
      .querySelectorAll("[data-kind-filter], [data-kind]")
      .forEach((el) => {
        const value = normalizeKindFilterValue(
          el.dataset.kindFilter || el.dataset.kind || "all",
        );
        const active = value === filterKind;
        el.classList.toggle("active", active);
        el.classList.toggle("isSelected", active);
        el.setAttribute("aria-pressed", active ? "true" : "false");
      });
    renderAll();
  });
});
document.querySelectorAll("[data-owned-filter], [data-owned]").forEach((btn) => {
  btn.addEventListener("click", () => {
    filterOwned = normalizeOwnedFilterValue(
      btn.dataset.ownedFilter || btn.dataset.owned || "all",
    );
    document.body.dataset.ownedFilter = filterOwned;
    document
      .querySelectorAll("[data-owned-filter], [data-owned]")
      .forEach((el) => {
        const value = normalizeOwnedFilterValue(
          el.dataset.ownedFilter || el.dataset.owned || "all",
        );
        const active = value === filterOwned;
        el.classList.toggle("active", active);
        el.classList.toggle("isSelected", active);
        el.setAttribute("aria-pressed", active ? "true" : "false");
      });
    renderAll();
  });
});
searchEl?.addEventListener("input", () => {
  filterName = searchEl.value || "";
  renderAll();
});
joinCodeInput?.addEventListener("input", updatePlayButtons);

const tutorial = new TutorialSystem();
btnTutorial?.addEventListener("click", () => tutorial.openMenu());
btnRule?.addEventListener("click", (e) => {
  e.preventDefault();
  navigateWithRouteTransition("./rule.html?v=20260829_attr_lines1", "settings", {
    title: "RULE BOOK",
    sub: "勝利条件、ターン、マナ、属性、状態異常、カード効果を確認します。",
  });
});

function injectRoomButtonsNearSettings() {
  if (
    document.getElementById("createBtn") ||
    document.getElementById("joinBtn")
  )
    return;
  if (document.querySelector?.('[data-injected="roomButtons"]')) return;

  const wrap = document.createElement("span");
  wrap.dataset.injected = "roomButtons";
  wrap.style.display = "inline-flex";
  wrap.style.gap = "8px";
  wrap.style.alignItems = "center";

  const c = document.createElement("button");
  c.textContent = "ルーム作成";
  c.addEventListener("click", () => handleCreateRoom());

  const j = document.createElement("button");
  j.textContent = "ルーム参加";
  j.addEventListener("click", () => handleJoinRoom());

  injectedCreateBtn = c;
  injectedJoinBtn = j;

  wrap.appendChild(c);
  wrap.appendChild(j);

  if (btnSettings && btnSettings.parentElement) {
    btnSettings.parentElement.insertBefore(wrap, btnSettings);
  } else if (btnRule && btnRule.parentElement) {
    btnRule.parentElement.insertBefore(wrap, btnRule);
  } else {
    document.querySelector?.("header")?.appendChild(wrap);
  }
}

function setupRoomDrawer() {
  if (window.__tcg_room_drawer_inline_bound) return;
  const drawer = document.getElementById("roomDrawer");
  const openBtn = document.getElementById("roomDrawerToggle");
  const closeBtn = document.getElementById("roomDrawerClose");
  const overlay = document.getElementById("roomDrawerOverlay");
  if (!drawer || !openBtn) return;

  const setOpenButtonLabel = (opened) => {
    openBtn.textContent = opened
      ? "閉じる ◀"
      : openBtn.classList.contains("deckReady")
        ? "開始 ▶"
        : "プレイ ▶";
  };

  const open = () => {
    drawer.classList.add("open");
    overlay?.classList?.add("open");
    drawer.setAttribute("aria-hidden", "false");
    overlay?.setAttribute?.("aria-hidden", "false");
    setOpenButtonLabel(true);
  };
  const close = () => {
    drawer.classList.remove("open");
    overlay?.classList?.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    overlay?.setAttribute?.("aria-hidden", "true");
    setOpenButtonLabel(false);
  };

  openBtn.addEventListener("click", () =>
    drawer.classList.contains("open") ? close() : open(),
  );
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);

  addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function setupBeginnerGuide() {
  const overlay = $("guideOverlay");
  const focus = $("guideFocus");
  const card = $("guideCard");
  const stepEl = $("guideStep");
  const titleEl = $("guideTitle");
  const textEl = $("guideText");

  const btnNext = $("guideNext");
  const btnPrev = $("guidePrev");
  const btnSkip = $("guideSkip");

  if (!overlay || !focus || !card || !stepEl || !titleEl || !textEl) return;

  const steps = [
    {
      target: "#search",
      title: "探す",
      text:
        "カード名、ID、シリーズで検索できます。\n" +
        "キャラ/サポートと属性ボタンで、候補を絞り込んでください。",
      place: "left",
    },
    {
      target: "#cardList",
      title: "候補を選ぶ",
      text:
        "カード一覧から入れたいカードを選びます。\n" +
        "詳細で性能を確認し、＋でデッキに追加します。",
      place: "left",
    },
    {
      target: "#deckPanel",
      title: "30枚に整える",
      text:
        "右側に現在のデッキ内容が表示されます。\n" +
        "30枚ちょうど、同名4枚までを目標に組みます。",
      place: "left",
    },
    {
      target: ".deckPanelActions",
      title: "保存と評価",
      text:
        "保存、自分のデッキ、評価はここにまとまっています。\n" +
        "対戦前にレーダーでデッキの尖り方を確認できます。",
      place: "left",
    },
    {
      target: "#roomDrawerToggle",
      title: "対戦を始める",
      text:
        "プレイボタンからルーム操作を開きます。\n" +
        "ルーム作成、参加、ソロ開始をここから選べます。",
      place: "left",
      onShow: () => {
        try {
          const drawer = $("roomDrawer");
          const overlayEl = $("roomDrawerOverlay");
          if (drawer && !drawer.classList.contains("open")) {
            drawer.classList.add("open");
            drawer.setAttribute("aria-hidden", "false");
            overlayEl?.classList.add("open");
            overlayEl?.setAttribute("aria-hidden", "false");
            const toggle = $("roomDrawerToggle");
            if (toggle) toggle.textContent = "閉じる ◀";
          }
        } catch {}
      },
    },
  ];

  let current = 0;

  function getRect(selector) {
    const el = document.querySelector(selector) || document.querySelector("#cardList") || document.body;
    if (!el) return null;
    return el.getBoundingClientRect();
  }

  function placeCard(rect, place = "left") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 14;

    let left = rect.left;
    let top = rect.bottom + 12;

    if (place === "left") {
      left = Math.max(margin, rect.left);
    }
    if (place === "right") {
      left = Math.min(
        vw - card.offsetWidth - margin,
        rect.right - card.offsetWidth,
      );
    }

    if (top + card.offsetHeight > vh - margin) {
      top = Math.max(margin, rect.top - card.offsetHeight - 12);
    }

    left = Math.max(margin, Math.min(left, vw - card.offsetWidth - margin));
    top = Math.max(margin, Math.min(top, vh - card.offsetHeight - margin));

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function renderStep() {
    const s = steps[current];
    const rect = getRect(s.target);
    if (!rect) return;

    stepEl.textContent = `STEP ${current + 1} / ${steps.length}`;
    titleEl.textContent = s.title;
    textEl.textContent = s.text;

    focus.style.left = `${rect.left - 8}px`;
    focus.style.top = `${rect.top - 8}px`;
    focus.style.width = `${rect.width + 16}px`;
    focus.style.height = `${rect.height + 16}px`;

    requestAnimationFrame(() => placeCard(rect, s.place));

    btnPrev.style.display = current === 0 ? "none" : "inline-flex";
    btnNext.textContent = current === steps.length - 1 ? "OK" : "次へ";

    if (typeof s.onShow === "function") {
      s.onShow();
      requestAnimationFrame(() => {
        const rect2 = getRect(s.target);
        if (!rect2) return;
        focus.style.left = `${rect2.left - 8}px`;
        focus.style.top = `${rect2.top - 8}px`;
        focus.style.width = `${rect2.width + 16}px`;
        focus.style.height = `${rect2.height + 16}px`;
        placeCard(rect2, s.place);
      });
    }
  }

  function openGuide() {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    current = 0;
    renderStep();
  }

  window.openTcgBeginnerGuide = openGuide;

  function closeGuide() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }

  btnGuide?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGuide();
  });

  btnSkip?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeGuide();
  });

  btnPrev?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (current > 0) {
      current -= 1;
      renderStep();
    }
  });

  btnNext?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (current < steps.length - 1) {
      current += 1;
      renderStep();
    } else {
      closeGuide();
    }
  });

  overlay.querySelector("#guideDim")?.addEventListener("click", closeGuide);

  window.addEventListener("resize", () => {
    if (overlay.classList.contains("open")) renderStep();
  });

  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") closeGuide();
  });
}
setupRoomDrawer();
setupBeginnerGuide();

// =====================
// Boot
// =====================
if (roomIdLabel) roomIdLabel.textContent = roomId;
if (playerIdLabel) playerIdLabel.textContent = playerId;

ensureNameInUI();
simplifyRoomPlayerPanel();
polishRoomEntryPanel();
updateRoomPlayerSummary();

selectedExSupportId = loadSelectedEx() || "";

// load title to input
if (deckTitleInput) {
  const t = normalizeDeckTitle(loadDeckTitle());
  if (t && !deckTitleInput.value.trim()) deckTitleInput.value = t;
}

await loadAdminFlag();
updateAdminModeBadge();
await loadCards();
await initOwnedCards();
const loadedPendingDeck = consumePendingCloudDeck();
if (!loadedPendingDeck) {
  let loadedLocalDeck = false;
  try {
    const rawLocalDeck = localStorage.getItem(LOCAL_KEY);
    if (rawLocalDeck) {
      const parsedLocalDeck = normalizeDeckMap(JSON.parse(rawLocalDeck) || {});
      if (Object.keys(parsedLocalDeck).length > 0) {
        deckMap = parsedLocalDeck;
        loadedLocalDeck = true;
      }
    }
  } catch {}
  if (!loadedLocalDeck) {
    const okUser = await loadDeckFromUser();
    if (!okUser) await loadDeckPreferFirestore(roomId, playerId);
  }
}
updateRoomPlayerSummary();
pruneDeckByOwnership("デッキ調整");
// Firestore優先で反映した値を local にも保存。
saveSelectedEx(selectedExSupportId || "");
saveLocalDeck();

renderAll();
initTabs();
injectRoomButtonsNearSettings();
ensureFieldPicker();

touchRoom(roomId, { createdAt: serverTimestamp() }).catch(() => {});

// =====================
// Cloud Deck Library init
// =====================

function getPlayerNameForLibrary() {
  return normalizeName(playerNameInput?.value || loadName() || "") || "player";
}
function getSnapshotForLibrary() {
  const title =
    normalizeDeckTitle(deckTitleInput?.value || loadDeckTitle() || "") ||
    "無題デッキ";
  return {
    title,
    deck: deckMap || {},
    exSupport: selectedExSupportId || "",
    desiredField: desiredField(),
  };
}
function applySnapshotFromLibrary(snap) {
  const deck = snap?.deck && typeof snap.deck === "object" ? snap.deck : {};
  const copyIssues = deckOwnershipIssues(deck);
  deckMap = normalizeDeckMap(deck);

  const ex = String(snap?.exSupport || "");
  selectedExSupportId = deckMap[ex] ? ex : "";
  saveSelectedEx(selectedExSupportId || "");

  const title = normalizeDeckTitle(snap?.title || "");
  if (title) {
    saveDeckTitle(title);
    if (deckTitleInput) deckTitleInput.value = title;
  }

  if (snap?.desiredField) {
    const fid = saveDesiredField(snap.desiredField);
    const sel = document.getElementById("fieldSelect");
    if (sel) sel.value = fid;
  }

  renderAll();
  const copyWarning = formatDeckCopyWarning(copyIssues);
  if (copyWarning) {
    setMsg(copyWarning, false);
    return;
  }
  setMsg("クラウドデッキをロードしました", true);
  setTimeout(() => setMsg("", true), 1000);
}

initDeckLibrary({
  db,
  getSnapshot: getSnapshotForLibrary,
  applySnapshot: applySnapshotFromLibrary,
  getPlayerName: getPlayerNameForLibrary,
  getCardDefs: () => cardDefs,
  deckTitleInputId: "deckTitle",
});
setupDeckPanelWorkbench();
syncDeckPanelActionState();

function prettyEffect(eff) {
  if (eff == null) return "";

  if (Array.isArray(eff)) {
    return eff.map(prettyEffect).filter(Boolean).join(" / ");
  }

  if (typeof eff === "string") {
    const s = eff.trim();
    if (!s) return "";
    try {
      eff = JSON.parse(s);
    } catch {
      return s;
    }
  }

  if (eff == null) return "";
  if (typeof eff !== "object") return String(eff);

  const type = String(eff.type || eff.kind || eff.action || "").toLowerCase();
  const rate = eff.rate !== undefined ? `成功${eff.rate}%` : "";
  const target = eff.target ? `対象:${eff.target}` : "";
  const tag = eff.tag ? `タグ:${eff.tag}` : "";

  const join = (...xs) => xs.filter(Boolean).join(" / ");

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const hpDelta =
    num(eff.hpDelta) ??
    (num(eff.dmg) != null ? -Math.abs(num(eff.dmg)) : null) ??
    (num(eff.hp) != null ? -Math.abs(num(eff.hp)) : null);

  const spDelta =
    num(eff.spDelta) ??
    (num(eff.spDmg) != null ? -Math.abs(num(eff.spDmg)) : null) ??
    (num(eff.sp) != null ? -Math.abs(num(eff.sp)) : null);

  switch (type) {
    case "draw":
      return join(
        "ドロー",
        num(eff.n) != null ? `+${num(eff.n)}枚` : "",
        rate,
        target,
      );

    case "heal":
    case "recoverhp":
    case "recoversp": {
      const hp = num(eff.hp) ?? num(eff.hpDelta);
      const sp = num(eff.sp) ?? num(eff.spDelta);
      return join(
        "回復",
        hp != null ? `HP+${hp}` : "",
        sp != null ? `SP+${sp}` : "",
        rate,
        target,
      );
    }

    case "dmg":
    case "damage":
    case "attack":
    case "atk": {
      const parts = [];
      if (hpDelta != null && hpDelta !== 0)
        parts.push(`HP${hpDelta > 0 ? "+" : ""}${hpDelta}`);
      if (spDelta != null && spDelta !== 0)
        parts.push(`SP${spDelta > 0 ? "+" : ""}${spDelta}`);

      if (!parts.length) {
        const p = num(eff.power);
        return join("攻撃", p != null ? `威力:${p}` : "", rate, target, tag);
      }
      return join("攻撃", parts.join(" / "), rate, target, tag);
    }

    case "modrate":
    case "rate":
    case "hitrate": {
      const d = num(eff.delta);
      return join(
        "成功率補正",
        d != null ? `${d > 0 ? "+" : ""}${d}%` : "",
        rate,
        target,
      );
    }

    case "addstatus":
    case "status": {
      const turn = num(eff.turn);
      return join(
        "状態付与",
        eff.name || eff.status || "",
        turn != null ? `${turn}T` : "",
        rate,
        target,
        tag,
      );
    }

    case "moveto":
    case "move": {
      const to = eff.to !== undefined ? `to:${String(eff.to)}` : "";
      const dir = eff.dir ? `dir:${String(eff.dir)}` : "";
      const step = num(eff.step);
      return join(
        "移動",
        to,
        dir,
        step != null ? `step:${step}` : "",
        rate,
        target,
      );
    }

    case "rest":
    case "recover":
    case "fatigue": {
      const d = num(eff.delta);
      return join(
        "回復(行動回数/疲労)",
        d != null ? `${d > 0 ? "+" : ""}${d}` : "",
        rate,
        target,
      );
    }

    default: {
      const skip = new Set([
        "attr",
        "attrIn",
        "attrs",
        "attribute",
        "attributes",
        "balance",
        "cond",
        "condition",
        "conditions",
        "existing",
        "existingSkill",
        "fromExisting",
        "id",
        "internal",
        "kind",
        "note",
        "owner",
        "ownerType",
        "raw",
        "role",
        "roles",
        "source",
        "sourceCard",
        "sourceCardId",
        "sourceId",
        "src",
        "tag",
        "theme",
        "type",
        "既存技",
      ]);
      const keys = Object.keys(eff)
        .filter((k) => !skip.has(k) && !skip.has(String(k).toLowerCase()))
        .slice(0, 8);
      const compact = keys.map((k) => `${k}:${String(eff[k])}`).join(" / ");
      return join(`効果:${eff.type || "?"}`, compact, rate, target, tag);
    }
  }
}
