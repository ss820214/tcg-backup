// public/dopagaki_mode.js
// A deliberately loud visual mode. Kept isolated so normal play stays clean.

(() => {
  if (window.__tcgDopagakiModeLoaded) return;
  window.__tcgDopagakiModeLoaded = true;

  const KEY = "tcg_dopagaki_mode_v1";
  const TECH_KEY = "tcg_dopagaki_tech_mode_v1";
  const POS_KEY = "tcg_dopagaki_button_pos_v1";
  const STYLE_ID = "tcgDopagakiStyle";
  const ROOT_ID = "tcgDopagakiRoot";
  const TOGGLE_ID = "tcgDopagakiToggle";
  const TECH_ASSET = "./assets/dopagaki/tech_face.jpg";
  const PARTICLE_LIMIT = 180;
  const TECH_HOLD_MS = 3000;
  const TECH_MAX_FACES = 9;
  let particleCount = 0;
  let unicornTimer = null;
  let creatureTimer = null;
  let techHoldTimer = null;
  let techHoldStarted = 0;
  let techHoldActivated = false;
  let techRaf = null;
  let techSplitTimer = null;
  let techChaosTimer = null;
  let techFaces = [];
  let toggleDrag = null;
  let suppressToggleClickUntil = 0;

  const readOn = () => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  };

  const saveOn = (on) => {
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {}
  };

  const readTech = () => {
    try {
      return localStorage.getItem(TECH_KEY) === "1";
    } catch {
      return false;
    }
  };

  const saveTech = (on) => {
    try {
      localStorage.setItem(TECH_KEY, on ? "1" : "0");
    } catch {}
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --dopa-pink:#ff4fd8;
        --dopa-cyan:#63f7ff;
        --dopa-gold:#ffe76b;
        --dopa-green:#7dff9f;
      }

      #${ROOT_ID}{
        position:fixed;
        inset:0;
        z-index:900;
        pointer-events:none;
        overflow:hidden;
      }

      #${TOGGLE_ID}{
        position:fixed;
        left:50%;
        right:auto;
        top:calc(env(safe-area-inset-top, 0px) + 10px);
        z-index:980;
        min-width:132px;
        min-height:42px;
        padding:9px 14px;
        border:2px solid rgba(255,255,255,.28);
        border-radius:999px;
        color:#fff;
        font-weight:1000;
        letter-spacing:.03em;
        background:
          linear-gradient(90deg, rgba(255,79,216,.72), rgba(99,247,255,.62), rgba(255,231,107,.72)),
          radial-gradient(circle at 20% 10%, rgba(255,255,255,.92), transparent 24%),
          rgba(0,0,0,.38);
        box-shadow:
          0 0 0 2px rgba(255,255,255,.08) inset,
          0 0 22px rgba(255,79,216,.28),
          0 10px 34px rgba(0,0,0,.45);
        text-shadow:0 2px 0 rgba(0,0,0,.45), 0 0 12px rgba(255,255,255,.75);
        cursor:pointer;
        user-select:none;
        touch-action:none;
        isolation:isolate;
        overflow:hidden;
        transform:translateX(-50%) translateZ(0);
      }

      #${TOGGLE_ID}::before{
        content:"";
        position:absolute;
        inset:-40%;
        z-index:-1;
        background:conic-gradient(from 0deg, transparent, rgba(255,255,255,.95), transparent, rgba(255,231,107,.72), transparent);
        opacity:.42;
        animation:dopaButtonSpin 2.2s linear infinite;
      }

      #${TOGGLE_ID}::after{
        content:"OFF";
        margin-left:8px;
        padding:2px 7px;
        border-radius:999px;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.22);
        font-size:11px;
      }

      #${TOGGLE_ID}.isOn{
        border-color:rgba(255,231,107,.95);
        animation:dopaButtonPulse .72s ease-in-out infinite;
      }

      #${TOGGLE_ID}.isOn::after{
        content:"ON";
        color:#111;
        background:linear-gradient(180deg, #fff8b4, #8cffba);
      }

      #${TOGGLE_ID}.isCharging{
        animation:dopaHoldCharge .28s ease-in-out infinite;
      }

      #${TOGGLE_ID}.isCharging::after{
        content:"HOLD";
        color:#111;
        background:linear-gradient(180deg, #fff, #63f7ff);
      }

      #${TOGGLE_ID}.isMoved{
        left:var(--dopa-left) !important;
        top:var(--dopa-top) !important;
        right:auto !important;
        transform:none !important;
      }

      #${TOGGLE_ID}.isTech{
        border-color:rgba(255,255,255,.98);
        background:
          linear-gradient(90deg, #ff2bd6, #63f7ff, #ffe76b, #7dff9f, #ff2bd6),
          rgba(0,0,0,.48);
        background-size:260% 100%;
        animation:dopaTechButton 1.1s linear infinite;
      }

      #${TOGGLE_ID}.isTech::after{
        content:"TECH";
        color:#05070d;
        background:linear-gradient(180deg, #fff, #ffe76b 48%, #ff4fd8);
      }

      body.dopagaki-mode{
        animation:dopaHue 4.6s linear infinite;
      }

      body.dopagaki-tech-mode{
        animation:dopaHue .72s linear infinite, dopaTechPageShake .42s steps(2,end) infinite;
      }

      body.dopagaki-tech-mode::before{
        content:"";
        position:fixed;
        inset:0;
        z-index:860;
        pointer-events:none;
        background:
          repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,79,216,.24) 0 10deg, rgba(99,247,255,.20) 12deg 20deg, rgba(255,231,107,.20) 21deg 31deg, transparent 32deg 42deg),
          radial-gradient(circle at 20% 24%, rgba(255,255,255,.20), transparent 18%),
          radial-gradient(circle at 82% 72%, rgba(255,79,216,.22), transparent 21%);
        mix-blend-mode:screen;
        opacity:.74;
        animation:dopaTechBackdrop .86s linear infinite;
      }

      body.dopagaki-mode::after{
        content:"";
        position:fixed;
        inset:0;
        z-index:870;
        pointer-events:none;
        background:
          radial-gradient(circle at 18% 14%, rgba(255,79,216,.24), transparent 22%),
          radial-gradient(circle at 82% 16%, rgba(99,247,255,.22), transparent 24%),
          radial-gradient(circle at 50% 92%, rgba(255,231,107,.20), transparent 28%),
          repeating-linear-gradient(118deg, transparent 0 26px, rgba(255,255,255,.035) 27px 28px);
        mix-blend-mode:screen;
        opacity:.52;
        animation:dopaBackdrop 1.8s ease-in-out infinite alternate;
      }

      body.dopagaki-mode button,
      body.dopagaki-mode .btn,
      body.dopagaki-mode .miniBtn,
      body.dopagaki-mode .tab,
      body.dopagaki-mode .filterChip,
      body.dopagaki-mode .filterTab{
        box-shadow:
          0 0 0 1px rgba(255,255,255,.13) inset,
          0 0 16px rgba(99,247,255,.16),
          0 0 28px rgba(255,79,216,.10);
      }

      body.dopagaki-mode .cardRow,
      body.dopagaki-mode .deckHomeBtn,
      body.dopagaki-mode .panel,
      body.dopagaki-mode .kv,
      body.dopagaki-mode .battleCardPreview{
        position:relative;
      }

      body.dopagaki-mode .cardRow::after,
      body.dopagaki-mode .deckHomeBtn::after,
      body.dopagaki-mode .panel::after,
      body.dopagaki-mode .battleCardPreview::after{
        content:"";
        position:absolute;
        inset:-1px;
        border-radius:inherit;
        pointer-events:none;
        background:linear-gradient(110deg, transparent 0 32%, rgba(255,255,255,.20) 42%, transparent 54% 100%);
        transform:translateX(-120%);
        animation:dopaSweep 2.4s ease-in-out infinite;
      }

      body.dopagaki-mode .stackHandCard{
        animation:dopaHandHop 1.05s ease-in-out infinite;
        animation-delay:calc(var(--i, 0) * -90ms);
      }

      body.dopagaki-mode .stackHandCard.selected{
        animation:dopaHandSelectedHop .72s ease-in-out infinite;
      }

      body.dopagaki-mode .handPreview{
        animation:dopaHandPreviewHop 1.18s ease-in-out infinite;
      }

      body.dopagaki-mode #handDrawerToggle,
      body.dopagaki-mode .handDrawerToggle{
        animation:dopaHandButtonHop .86s ease-in-out infinite;
      }

      .dopaParticle{
        position:fixed;
        left:0;
        top:0;
        width:10px;
        height:10px;
        z-index:920;
        pointer-events:none;
        transform:translate(-50%, -50%);
        opacity:0;
        will-change:transform, opacity;
      }

      .dopaParticle.flower{
        border-radius:60% 40% 60% 40%;
        background:var(--dopa-color, #fff);
        box-shadow:0 0 10px var(--dopa-color, #fff);
      }

      .dopaParticle.star{
        background:var(--dopa-color, #fff);
        clip-path:polygon(50% 0, 61% 35%, 98% 35%, 68% 56%, 79% 91%, 50% 70%, 21% 91%, 32% 56%, 2% 35%, 39% 35%);
        box-shadow:0 0 12px var(--dopa-color, #fff);
      }

      .dopaParticle.diamond{
        width:12px;
        height:12px;
        background:linear-gradient(135deg, #fff, var(--dopa-color, #fff));
        transform:translate(-50%, -50%) rotate(45deg);
        border-radius:2px;
        box-shadow:0 0 14px var(--dopa-color, #fff);
      }

      .dopaFloatingText{
        position:fixed;
        z-index:930;
        pointer-events:none;
        color:#fff;
        font-weight:1000;
        font-size:clamp(20px, 3vw, 38px);
        letter-spacing:.04em;
        text-shadow:
          0 2px 0 rgba(0,0,0,.65),
          0 0 12px var(--dopa-pink),
          0 0 24px var(--dopa-cyan);
        animation:dopaTextPop .72s ease-out forwards;
      }

      .dopaTechTitle{
        position:fixed;
        left:50%;
        top:45%;
        z-index:940;
        transform:translate(-50%, -50%);
        pointer-events:none;
        display:flex;
        gap:clamp(10px, 2.4vw, 34px);
        font-size:clamp(46px, 11vw, 168px);
        font-weight:1000;
        letter-spacing:.06em;
        color:#fff;
        text-shadow:
          0 4px 0 rgba(0,0,0,.62),
          0 0 18px #fff,
          0 0 34px var(--dopa-cyan),
          0 0 58px var(--dopa-pink),
          0 0 88px var(--dopa-gold);
        animation:dopaTechTitleSpin 1.25s cubic-bezier(.18,.88,.18,1) infinite;
      }

      .dopaTechTitle span{
        display:inline-block;
        animation:dopaTechLetter .54s ease-in-out infinite alternate;
      }
      .dopaTechTitle span:nth-child(2){ animation-delay:-.11s; color:#63f7ff; }
      .dopaTechTitle span:nth-child(3){ animation-delay:-.22s; color:#ffe76b; }
      .dopaTechTitle span:nth-child(4){ animation-delay:-.33s; color:#ff4fd8; }

      .dopaTechFace{
        position:fixed;
        left:0;
        top:0;
        z-index:935;
        width:var(--tech-size, 148px);
        aspect-ratio:4/3;
        object-fit:cover;
        object-position:center;
        border-radius:18px;
        border:3px solid rgba(255,255,255,.78);
        pointer-events:none;
        will-change:transform, filter;
        box-shadow:
          0 0 0 2px rgba(0,0,0,.38),
          0 0 28px rgba(255,79,216,.64),
          0 0 42px rgba(99,247,255,.48),
          0 16px 42px rgba(0,0,0,.52);
        filter:saturate(1.45) contrast(1.08) brightness(1.06);
      }

      .dopaTechFace.clone{
        border-color:rgba(255,231,107,.92);
        filter:hue-rotate(80deg) saturate(1.7) contrast(1.12);
      }

      .dopaUnicorn{
        position:fixed;
        left:-180px;
        top:var(--dopa-unicorn-y, 42vh);
        z-index:910;
        width:150px;
        height:82px;
        pointer-events:none;
        filter:
          drop-shadow(0 0 10px rgba(255,255,255,.92))
          drop-shadow(0 0 24px rgba(255,79,216,.62))
          drop-shadow(0 0 34px rgba(99,247,255,.45));
        animation:dopaUnicornRun var(--dopa-unicorn-dur, 3.8s) linear forwards;
      }

      .dopaUnicornBody{
        position:absolute;
        left:32px;
        top:30px;
        width:78px;
        height:30px;
        border-radius:48% 54% 46% 52%;
        background:linear-gradient(135deg, #fff, #dff8ff 46%, #ffd7fb);
        box-shadow:inset 0 -5px 0 rgba(99,247,255,.20);
      }

      .dopaUnicornNeck{
        position:absolute;
        left:92px;
        top:19px;
        width:23px;
        height:42px;
        border-radius:18px 18px 7px 7px;
        background:linear-gradient(145deg, #fff, #e8fbff);
        transform:rotate(-25deg);
      }

      .dopaUnicornHead{
        position:absolute;
        left:106px;
        top:12px;
        width:33px;
        height:22px;
        border-radius:58% 42% 48% 52%;
        background:linear-gradient(135deg, #fff, #e8fbff);
      }

      .dopaUnicornHorn{
        position:absolute;
        left:126px;
        top:-3px;
        width:9px;
        height:25px;
        clip-path:polygon(50% 0, 100% 100%, 0 100%);
        background:linear-gradient(180deg, #fff8b4, #ff4fd8);
        transform:rotate(28deg);
        transform-origin:bottom center;
      }

      .dopaUnicornMane{
        position:absolute;
        left:85px;
        top:14px;
        width:34px;
        height:42px;
        border-radius:50%;
        background:
          linear-gradient(90deg, #ff4fd8, #ffe76b, #63f7ff, #7dff9f);
        clip-path:polygon(35% 0, 68% 10%, 44% 26%, 72% 42%, 36% 52%, 62% 75%, 26% 100%, 14% 48%);
        opacity:.95;
        animation:dopaManeWave .22s ease-in-out infinite alternate;
      }

      .dopaUnicornTail{
        position:absolute;
        left:0;
        top:28px;
        width:48px;
        height:34px;
        border-radius:50%;
        background:linear-gradient(90deg, #63f7ff, #ff4fd8, #ffe76b);
        clip-path:polygon(100% 28%, 45% 0, 0 20%, 48% 45%, 4% 75%, 52% 100%, 100% 72%);
        animation:dopaTailWave .18s ease-in-out infinite alternate;
      }

      .dopaUnicornLeg{
        position:absolute;
        top:55px;
        width:8px;
        height:29px;
        border-radius:999px;
        background:linear-gradient(180deg, #fff, #bdf7ff);
        transform-origin:50% 0;
        animation:dopaLegGallop .22s ease-in-out infinite alternate;
      }
      .dopaUnicornLeg.l1{ left:45px; animation-delay:-.05s; }
      .dopaUnicornLeg.l2{ left:62px; animation-delay:-.13s; }
      .dopaUnicornLeg.l3{ left:88px; animation-delay:-.09s; }
      .dopaUnicornLeg.l4{ left:103px; animation-delay:-.18s; }

      .dopaUnicornSpark{
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at 22% 35%, #fff 0 3px, transparent 4px),
          radial-gradient(circle at 50% 8%, #ffe76b 0 3px, transparent 4px),
          radial-gradient(circle at 82% 42%, #63f7ff 0 3px, transparent 4px);
        animation:dopaSparkBlink .34s linear infinite;
      }

      .dopaUnicorn.pegasus .dopaUnicornBody{
        background:linear-gradient(90deg, #fff8d7, #86f7ff 58%, #ffe76b);
        box-shadow:0 0 28px rgba(255,255,255,.55), 0 0 40px rgba(99,247,255,.36);
      }
      .dopaUnicorn.pegasus .dopaUnicornHorn{
        background:linear-gradient(180deg, #fff, #63f7ff);
      }
      .dopaUnicorn.griffin .dopaUnicornBody{
        background:linear-gradient(90deg, #5b2d17, #ffb84d 56%, #ffe7a8);
        box-shadow:0 0 26px rgba(255,184,77,.46);
      }
      .dopaUnicorn.griffin .dopaUnicornHead{
        background:linear-gradient(135deg, #fff4bc, #ffb84d);
        border-radius:60% 46% 42% 55%;
      }
      .dopaUnicorn.griffin .dopaUnicornHorn{
        width:18px;
        height:10px;
        left:124px;
        top:22px;
        border-radius:100% 0 100% 0;
        background:#ffe76b;
        transform:rotate(-14deg);
      }
      .dopaWing{
        position:absolute;
        left:58px;
        top:-4px;
        width:64px;
        height:44px;
        border-radius:70% 20% 70% 20%;
        background:
          repeating-linear-gradient(130deg, rgba(255,255,255,.76) 0 8px, rgba(99,247,255,.22) 9px 15px),
          linear-gradient(135deg, rgba(255,255,255,.75), rgba(99,247,255,.22));
        transform-origin:14px 38px;
        animation:dopaWingFlap .25s ease-in-out infinite alternate;
        filter:drop-shadow(0 0 16px rgba(255,255,255,.36));
      }
      .dopaWing.back{
        left:70px;
        top:1px;
        opacity:.55;
        animation-delay:-.12s;
      }
      .dopaUnicorn.griffin .dopaWing{
        background:
          repeating-linear-gradient(130deg, rgba(255,231,107,.82) 0 8px, rgba(255,79,216,.20) 9px 15px),
          linear-gradient(135deg, rgba(255,231,107,.78), rgba(255,138,92,.32));
      }
      .dopaUnicorn.manualCreature{
        animation:none;
        left:0;
        top:0;
        will-change:transform;
      }
      .dopaEventCelebration{
        position:fixed;
        inset:0;
        z-index:925;
        pointer-events:none;
        background:
          radial-gradient(circle at 20% 22%, rgba(255,79,216,.44), transparent 24%),
          radial-gradient(circle at 76% 20%, rgba(99,247,255,.40), transparent 28%),
          radial-gradient(circle at 50% 72%, rgba(255,231,107,.38), transparent 32%),
          repeating-conic-gradient(from 0deg, rgba(255,255,255,.12) 0 8deg, transparent 9deg 18deg);
        mix-blend-mode:screen;
        opacity:0;
        animation:dopaEventBloom 3s ease-out forwards;
      }
      .dopaEventCelebration::before,
      .dopaEventCelebration::after{
        content:"";
        position:absolute;
        left:50%;
        top:50%;
        width:min(86vw, 920px);
        aspect-ratio:1;
        border-radius:50%;
        border:3px solid rgba(255,255,255,.42);
        transform:translate(-50%, -50%) scale(.34);
        animation:dopaEventRing 3s ease-out forwards;
        box-shadow:0 0 40px rgba(255,255,255,.22), inset 0 0 50px rgba(99,247,255,.18);
      }
      .dopaEventCelebration::after{
        animation-delay:.34s;
        border-color:rgba(255,231,107,.48);
      }
      .dopaEventText{
        position:fixed;
        left:50%;
        top:48%;
        z-index:945;
        transform:translate(-50%, -50%);
        pointer-events:none;
        color:#fff;
        font-weight:1000;
        font-size:clamp(36px, 8vw, 118px);
        letter-spacing:.06em;
        text-align:center;
        text-shadow:
          0 4px 0 rgba(0,0,0,.52),
          0 0 18px var(--dopa-pink),
          0 0 34px var(--dopa-cyan),
          0 0 58px var(--dopa-gold);
        animation:dopaEventText 3s cubic-bezier(.12,.86,.18,1) forwards;
      }
      .dopaScoreToast{
        position:fixed;
        left:50%;
        top:22%;
        z-index:942;
        transform:translate(-50%, -50%);
        pointer-events:none;
        min-width:220px;
        padding:13px 22px;
        border-radius:999px;
        border:2px solid rgba(255,255,255,.56);
        background:
          linear-gradient(135deg, rgba(255,79,216,.70), rgba(99,247,255,.62), rgba(255,231,107,.72)),
          rgba(0,0,0,.42);
        color:#fff;
        font-weight:1000;
        text-align:center;
        letter-spacing:.06em;
        box-shadow:0 0 28px rgba(99,247,255,.36), 0 0 42px rgba(255,79,216,.28);
        text-shadow:0 2px 0 rgba(0,0,0,.48);
        animation:dopaScorePop 1.45s ease-out forwards;
      }

      body.dopaShake{
        animation:dopaShake .34s cubic-bezier(.3,.05,.15,1) 1;
      }

      @keyframes dopaButtonSpin{ to{ transform:rotate(360deg); } }
      @keyframes dopaButtonPulse{
        0%,100%{ transform:translateX(-50%) translateY(0) scale(1); box-shadow:0 0 20px rgba(255,79,216,.36), 0 0 34px rgba(99,247,255,.22), 0 10px 34px rgba(0,0,0,.45); }
        50%{ transform:translateX(-50%) translateY(-1px) scale(1.035); box-shadow:0 0 30px rgba(255,79,216,.52), 0 0 48px rgba(99,247,255,.36), 0 12px 38px rgba(0,0,0,.48); }
      }
      @keyframes dopaHoldCharge{
        0%,100%{ transform:translateX(-50%) scale(1); filter:brightness(1); }
        50%{ transform:translateX(-50%) scale(1.08); filter:brightness(1.42); }
      }
      @keyframes dopaTechButton{
        0%{ transform:translateX(-50%) rotate(-1deg) scale(1); background-position:0% 50%; }
        50%{ transform:translateX(-50%) rotate(1deg) scale(1.06); background-position:100% 50%; }
        100%{ transform:translateX(-50%) rotate(-1deg) scale(1); background-position:0% 50%; }
      }
      @keyframes dopaHue{ to{ filter:hue-rotate(360deg) saturate(1.18); } }
      @keyframes dopaTechPageShake{
        0%,100%{ transform:translate(0,0); }
        25%{ transform:translate(2px,-1px); }
        50%{ transform:translate(-2px,1px); }
        75%{ transform:translate(1px,2px); }
      }
      @keyframes dopaBackdrop{
        from{ opacity:.34; transform:scale(1); }
        to{ opacity:.62; transform:scale(1.02); }
      }
      @keyframes dopaTechBackdrop{
        0%{ transform:scale(1) rotate(0deg); filter:hue-rotate(0deg) saturate(1.2); }
        50%{ transform:scale(1.035) rotate(12deg); filter:hue-rotate(180deg) saturate(2.1); }
        100%{ transform:scale(1) rotate(24deg); filter:hue-rotate(360deg) saturate(1.2); }
      }
      @keyframes dopaTechTitleSpin{
        0%{ transform:translate(-50%, -50%) rotateX(0deg) rotateZ(-4deg) scale(.96); }
        40%{ transform:translate(-50%, -50%) rotateX(360deg) rotateZ(4deg) scale(1.08); }
        100%{ transform:translate(-50%, -50%) rotateX(720deg) rotateZ(-4deg) scale(.96); }
      }
      @keyframes dopaTechLetter{
        from{ translate:0 -8px; filter:brightness(1); }
        to{ translate:0 10px; filter:brightness(1.65); }
      }
      @keyframes dopaSweep{
        0%,42%{ transform:translateX(-120%); opacity:0; }
        56%{ opacity:1; }
        100%{ transform:translateX(120%); opacity:0; }
      }
      @keyframes dopaTextPop{
        0%{ opacity:0; transform:translate(-50%, -10px) scale(.78) rotate(-3deg); }
        18%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%, -86px) scale(1.16) rotate(2deg); }
      }
      @keyframes dopaShake{
        0%,100%{ transform:translate(0,0) rotate(0); }
        12%{ transform:translate(-7px,4px) rotate(-.35deg); }
        25%{ transform:translate(8px,-5px) rotate(.42deg); }
        38%{ transform:translate(-5px,-3px) rotate(-.25deg); }
        52%{ transform:translate(5px,4px) rotate(.22deg); }
        70%{ transform:translate(-3px,2px) rotate(-.12deg); }
      }

      @keyframes dopaHandHop{
        0%,100%{ translate:0 0; filter:saturate(1.05); }
        50%{ translate:0 -10px; filter:saturate(1.35) brightness(1.08); }
      }
      @keyframes dopaHandSelectedHop{
        0%,100%{ translate:0 0; filter:saturate(1.2) brightness(1.05); }
        50%{ translate:0 -16px; filter:saturate(1.65) brightness(1.16); }
      }
      @keyframes dopaHandPreviewHop{
        0%,100%{ transform:translateY(0) rotate(0deg); }
        50%{ transform:translateY(-8px) rotate(-1deg); }
      }
      @keyframes dopaHandButtonHop{
        0%,100%{ transform:translateX(-50%) translateY(0) scale(1); }
        50%{ transform:translateX(-50%) translateY(-7px) scale(1.035); }
      }
      @keyframes dopaUnicornRun{
        0%{ transform:translateX(-180px) translateY(0) scale(.92); opacity:0; }
        8%{ opacity:1; }
        50%{ transform:translateX(calc(50vw + 30px)) translateY(-22px) scale(1.08); }
        92%{ opacity:1; }
        100%{ transform:translateX(calc(100vw + 240px)) translateY(8px) scale(.98); opacity:0; }
      }
      @keyframes dopaManeWave{
        from{ transform:rotate(-8deg) scaleX(.92); }
        to{ transform:rotate(8deg) scaleX(1.08); }
      }
      @keyframes dopaTailWave{
        from{ transform:rotate(10deg) scaleX(.92); }
        to{ transform:rotate(-12deg) scaleX(1.12); }
      }
      @keyframes dopaLegGallop{
        from{ transform:rotate(-22deg); }
        to{ transform:rotate(28deg); }
      }
      @keyframes dopaSparkBlink{
        0%,100%{ opacity:.45; transform:scale(.94); }
        50%{ opacity:1; transform:scale(1.08); }
      }
      @keyframes dopaWingFlap{
        from{ transform:rotate(-18deg) scaleY(.92); }
        to{ transform:rotate(18deg) scaleY(1.08); }
      }
      @keyframes dopaEventBloom{
        0%{ opacity:0; filter:hue-rotate(0deg) saturate(1.1); }
        12%{ opacity:.92; }
        72%{ opacity:.74; }
        100%{ opacity:0; filter:hue-rotate(210deg) saturate(1.85); }
      }
      @keyframes dopaEventRing{
        0%{ opacity:0; transform:translate(-50%, -50%) scale(.2) rotate(0deg); }
        16%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%, -50%) scale(1.25) rotate(160deg); }
      }
      @keyframes dopaEventText{
        0%{ opacity:0; transform:translate(-50%, -50%) scale(.52) rotate(-4deg); }
        12%{ opacity:1; transform:translate(-50%, -50%) scale(1.08) rotate(2deg); }
        72%{ opacity:1; transform:translate(-50%, -50%) scale(1) rotate(0deg); }
        100%{ opacity:0; transform:translate(-50%, -86%) scale(1.18) rotate(3deg); }
      }
      @keyframes dopaScorePop{
        0%{ opacity:0; transform:translate(-50%, -44%) scale(.64); }
        18%{ opacity:1; transform:translate(-50%, -50%) scale(1.08); }
        78%{ opacity:1; transform:translate(-50%, -50%) scale(1); }
        100%{ opacity:0; transform:translate(-50%, -96%) scale(.92); }
      }

      @media (max-width: 720px){
        #${TOGGLE_ID}{
          left:50%;
          right:auto;
          top:calc(env(safe-area-inset-top, 0px) + 8px);
          min-width:108px;
          min-height:38px;
          padding:8px 10px;
          font-size:12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.setAttribute("aria-hidden", "true");
      document.body.appendChild(root);
    }
    return root;
  }

  function updateState(on) {
    document.body.classList.toggle("dopagaki-mode", on);
    if (!on && readTech()) {
      saveTech(false);
      setTechMode(false, { silent: true });
    }
    const btn = document.getElementById(TOGGLE_ID);
    if (btn) {
      btn.classList.toggle("isOn", on);
      btn.classList.toggle("isTech", readTech());
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on
        ? "\u30c9\u30d1\u30ac\u30ad\u30e2\u30fc\u30c9\u3092OFF / 3\u79d2\u9577\u62bc\u3057\u3067TECH"
        : "\u30c9\u30d1\u30ac\u30ad\u30e2\u30fc\u30c9\u3092ON";
    }
    scheduleCreatures();
    if (on && Math.random() < 0.32) {
      setTimeout(() => spawnCreature("pegasus"), 900);
    }
  }
  function shake() {
    document.body.classList.remove("dopaShake");
    void document.body.offsetWidth;
    document.body.classList.add("dopaShake");
    setTimeout(() => document.body.classList.remove("dopaShake"), 380);
  }

  function spawnParticle(x, y, power = 1) {
    if (particleCount >= PARTICLE_LIMIT) return;
    const root = ensureRoot();
    const p = document.createElement("i");
    particleCount += 1;
    const colors = ["#ff4fd8", "#63f7ff", "#ffe76b", "#7dff9f", "#b889ff", "#ff8a5c"];
    const kinds = ["flower", "star", "diamond"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = (7 + Math.random() * 11) * power;
    const angle = Math.random() * Math.PI * 2;
    const dist = (42 + Math.random() * 116) * power;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30 * power;
    const rot = (Math.random() * 560 - 280).toFixed(1);
    const dur = 520 + Math.random() * 520;

    p.className = `dopaParticle ${kind}`;
    p.style.setProperty("--dopa-color", color);
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    root.appendChild(p);

    p.animate(
      [
        { opacity: 0, transform: "translate(-50%, -50%) scale(.35) rotate(0deg)" },
        { opacity: 1, offset: 0.14 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.92) rotate(${rot}deg)` },
      ],
      { duration: dur, easing: "cubic-bezier(.12,.76,.2,1)", fill: "forwards" },
    );
    setTimeout(() => {
      p.remove();
      particleCount = Math.max(0, particleCount - 1);
    }, dur + 60);
  }

  function burst(x, y, opts = {}) {
    const power = Number(opts.power || 1);
    const count = Math.max(12, Math.min(96, Math.round(Number(opts.count || 34) * power)));
    for (let i = 0; i < count; i += 1) spawnParticle(x, y, power);
    if (opts.text) {
      const t = document.createElement("div");
      t.className = "dopaFloatingText";
      t.textContent = opts.text;
      t.style.left = `${x}px`;
      t.style.top = `${y}px`;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 820);
    }
    if (opts.shake !== false) shake();
  }

  function creatureHtml(kind = "unicorn") {
    const wings = kind === "pegasus" || kind === "griffin"
      ? `<i class="dopaWing back"></i><i class="dopaWing"></i>`
      : "";
    return `
      <i class="dopaUnicornTail"></i>
      <i class="dopaUnicornBody"></i>
      ${wings}
      <i class="dopaUnicornNeck"></i>
      <i class="dopaUnicornHead"></i>
      <i class="dopaUnicornHorn"></i>
      <i class="dopaUnicornMane"></i>
      <i class="dopaUnicornLeg l1"></i>
      <i class="dopaUnicornLeg l2"></i>
      <i class="dopaUnicornLeg l3"></i>
      <i class="dopaUnicornLeg l4"></i>
      <i class="dopaUnicornSpark"></i>
    `;
  }

  function makeCreature(kind = "unicorn") {
    const root = ensureRoot();
    const el = document.createElement("div");
    el.className = `dopaUnicorn ${kind}`;
    el.innerHTML = creatureHtml(kind);
    root.appendChild(el);
    return el;
  }

  function spawnBouncingPegasus() {
    if (!readOn()) return;
    const p = makeCreature("pegasus");
    p.classList.add("manualCreature");

    let x = Math.random() * Math.max(80, window.innerWidth - 180);
    let y = 80 + Math.random() * Math.max(80, window.innerHeight * 0.46);
    let vx = (Math.random() < 0.5 ? -1 : 1) * (5.4 + Math.random() * 2.2);
    let vy = (Math.random() < 0.5 ? -1 : 1) * (2.7 + Math.random() * 1.8);
    let bounceCount = 0;
    let bounceBoost = 1.2;
    let alive = true;
    const born = performance.now();
    const life = 11800 + Math.random() * 4200;
    const w = 150;
    const h = 90;
    const capVelocity = (v, max) => Math.sign(v) * Math.min(Math.abs(v), max);

    function accelerateBounce(axis = "x") {
      bounceCount += 1;
      const boost = Math.min(1.62, bounceBoost + bounceCount * 0.055);
      if (axis === "x") {
        vx = capVelocity(-vx * boost, 30);
      } else {
        vy = capVelocity(-vy * boost, 22);
      }
      bounceBoost = Math.min(1.36, bounceBoost + 0.025);
      return boost;
    }

    function step(now) {
      if (!alive) return;
      const age = now - born;
      if (age > life) {
        alive = false;
        p.remove();
        return;
      }
      x += vx;
      y += vy;
      if (x < -20 || x > window.innerWidth - w) {
        const boost = accelerateBounce("x");
        x = Math.max(-20, Math.min(window.innerWidth - w, x));
        burst(x + w / 2, y + h / 2, {
          power: 0.82 + Math.min(0.8, bounceCount * 0.05),
          count: 26 + Math.min(22, bounceCount * 2),
          text: boost > 1.45 ? "BOOST!" : "BOING!",
          shake: true
        });
      }
      if (y < 38 || y > window.innerHeight - h - 30) {
        accelerateBounce("y");
        y = Math.max(38, Math.min(window.innerHeight - h - 30, y));
        if (bounceCount % 2 === 0) {
          burst(x + w / 2, y + h / 2, { power: 0.68, count: 16, text: "JUMP!", shake: false });
        }
      }
      const dir = vx < 0 ? -1 : 1;
      p.style.transform = `translate(${x}px, ${y}px) scaleX(${dir}) rotate(${Math.sin(age / 90) * 4}deg)`;
      if (Math.random() < 0.16) spawnParticle(x + 70, y + 44, 0.45);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function spawnCreature(kind = "unicorn") {
    if (!readOn()) return;
    if (kind === "pegasus") {
      spawnBouncingPegasus();
      return;
    }
    const el = makeCreature(kind);
    el.style.setProperty("--dopa-unicorn-y", `${16 + Math.random() * 58}vh`);
    el.style.setProperty("--dopa-unicorn-dur", `${2.8 + Math.random() * 1.8}s`);
    const trailY = window.innerHeight * (0.16 + Math.random() * 0.58);
    for (let i = 0; i < 18; i += 1) {
      setTimeout(() => spawnParticle(24 + i * 34, trailY + Math.sin(i) * 18, 0.6), i * 90);
    }
    setTimeout(() => el.remove(), 5400);
  }

  function spawnUnicorn() {
    if (!readOn()) return;
    const root = ensureRoot();
    const u = document.createElement("div");
    u.className = "dopaUnicorn";
    u.style.setProperty("--dopa-unicorn-y", `${18 + Math.random() * 54}vh`);
    u.style.setProperty("--dopa-unicorn-dur", `${3.1 + Math.random() * 1.5}s`);
    u.innerHTML = creatureHtml("unicorn");
    root.appendChild(u);

    const trailY = window.innerHeight * (0.18 + Math.random() * 0.54);
    for (let i = 0; i < 18; i += 1) {
      setTimeout(() => spawnParticle(24 + i * 34, trailY + Math.sin(i) * 18, 0.6), i * 90);
    }
    setTimeout(() => u.remove(), 5200);
  }

  function scheduleCreatures() {
    if (unicornTimer) clearTimeout(unicornTimer);
    if (creatureTimer) clearTimeout(creatureTimer);
    unicornTimer = null;
    creatureTimer = null;
    if (!readOn()) return;
    unicornTimer = setTimeout(() => {
      const r = Math.random();
      spawnCreature(r < 0.45 ? "unicorn" : r < 0.76 ? "pegasus" : "griffin");
      scheduleCreatures();
    }, 8500 + Math.random() * 13500);
    creatureTimer = setTimeout(() => {
      if (readOn() && Math.random() < 0.62) {
        spawnCreature(Math.random() < 0.55 ? "griffin" : "pegasus");
      }
    }, 4200 + Math.random() * 6000);
  }

  function showEventCelebration(label = "EVOLVE!!", opts = {}) {
    if (!readOn()) return;
    const root = ensureRoot();
    const veil = document.createElement("div");
    veil.className = "dopaEventCelebration";
    root.appendChild(veil);

    const text = document.createElement("div");
    text.className = "dopaEventText";
    text.textContent = label;
    document.body.appendChild(text);

    const until = Date.now() + Number(opts.duration || 3000);
    const pulse = () => {
      if (!readOn() || Date.now() > until) return;
      const x = window.innerWidth * (0.16 + Math.random() * 0.68);
      const y = window.innerHeight * (0.16 + Math.random() * 0.68);
      burst(x, y, { power: 1.15 + Math.random() * 0.55, count: 28, shake: false });
      setTimeout(pulse, 130 + Math.random() * 100);
    };
    pulse();
    shake();
    setTimeout(() => shake(), 420);
    setTimeout(() => shake(), 980);
    setTimeout(() => spawnCreature("pegasus"), 200);
    setTimeout(() => spawnCreature("griffin"), 700);
    setTimeout(() => spawnCreature("unicorn"), 1250);
    setTimeout(() => {
      veil.remove();
      text.remove();
    }, Number(opts.duration || 3000) + 180);
  }

  function showScoreProgress(kind = "score", detail = {}) {
    if (!readOn()) return;
    const labelKind = String(kind).toLowerCase().includes("infil") ? "INFIL" : "KILL";
    const owner = detail.owner ? ` ${detail.owner}` : "";
    const count = detail.current != null && detail.max != null ? ` ${detail.current}/${detail.max}` : "";
    const toast = document.createElement("div");
    toast.className = "dopaScoreToast";
    toast.textContent = `${labelKind}${owner}${count}`;
    document.body.appendChild(toast);
    const x = window.innerWidth / 2;
    const y = window.innerHeight * 0.28;
    burst(x, y, { power: labelKind === "INFIL" ? 1.15 : 1.05, count: 54, text: labelKind, shake: true });
    if (labelKind === "INFIL") {
      setTimeout(() => spawnCreature("pegasus"), 120);
    } else {
      setTimeout(() => spawnCreature("griffin"), 120);
    }
    setTimeout(() => toast.remove(), 1600);
  }

  function clearTechTimers() {
    if (techRaf) cancelAnimationFrame(techRaf);
    if (techSplitTimer) clearTimeout(techSplitTimer);
    if (techChaosTimer) clearTimeout(techChaosTimer);
    techRaf = null;
    techSplitTimer = null;
    techChaosTimer = null;
  }

  function removeTechVisuals() {
    clearTechTimers();
    document.querySelectorAll(".dopaTechTitle, .dopaTechFace").forEach((el) => el.remove());
    techFaces = [];
  }

  function ensureTechTitle() {
    if (document.querySelector(".dopaTechTitle")) return;
    const title = document.createElement("div");
    title.className = "dopaTechTitle";
    title.innerHTML = "<span>T</span><span>E</span><span>C</span><span>H</span>";
    document.body.appendChild(title);
  }

  function addTechFace(seed = {}) {
    if (!readTech() || techFaces.length >= TECH_MAX_FACES) return null;
    const root = ensureRoot();
    const size = Number(seed.size || (96 + Math.random() * 96));
    const face = document.createElement("img");
    face.className = "dopaTechFace" + (seed.clone ? " clone" : "");
    face.src = TECH_ASSET;
    face.alt = "";
    face.decoding = "async";
    face.style.setProperty("--tech-size", `${size}px`);
    root.appendChild(face);

    const maxX = Math.max(40, window.innerWidth - size);
    const maxY = Math.max(60, window.innerHeight - size * 0.75);
    const state = {
      el: face,
      size,
      x: Number.isFinite(seed.x) ? seed.x : Math.random() * maxX,
      y: Number.isFinite(seed.y) ? seed.y : 80 + Math.random() * Math.max(80, maxY - 80),
      vx: Number.isFinite(seed.vx) ? seed.vx : (Math.random() < 0.5 ? -1 : 1) * (4.8 + Math.random() * 5.2),
      vy: Number.isFinite(seed.vy) ? seed.vy : (Math.random() < 0.5 ? -1 : 1) * (3.8 + Math.random() * 4.6),
      rot: Math.random() * 360,
      vr: (Math.random() < 0.5 ? -1 : 1) * (3.4 + Math.random() * 5.8),
      born: performance.now(),
      life: Number(seed.life || (18000 + Math.random() * 12000)),
    };
    techFaces.push(state);
    return state;
  }

  function splitTechFace(source) {
    if (!readTech() || !source || techFaces.length >= TECH_MAX_FACES) return;
    const angle = Math.random() * Math.PI * 2;
    const speed = 7 + Math.random() * 5;
    addTechFace({
      clone: true,
      size: Math.max(68, source.size * (0.72 + Math.random() * 0.16)),
      x: source.x + 24,
      y: source.y + 18,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 9000 + Math.random() * 8500,
    });
    burst(source.x + source.size / 2, source.y + source.size / 2, {
      power: 1.18,
      count: 42,
      text: "SPLIT!",
      shake: true,
    });
  }

  function scheduleTechSplit() {
    if (techSplitTimer) clearTimeout(techSplitTimer);
    if (!readTech()) return;
    techSplitTimer = setTimeout(() => {
      if (readTech() && techFaces.length) {
        splitTechFace(techFaces[Math.floor(Math.random() * techFaces.length)]);
      }
      scheduleTechSplit();
    }, 3500 + Math.random() * 6200);
  }

  function scheduleTechChaos() {
    if (techChaosTimer) clearTimeout(techChaosTimer);
    if (!readTech()) return;
    techChaosTimer = setTimeout(() => {
      if (readTech()) {
        const x = window.innerWidth * (0.14 + Math.random() * 0.72);
        const y = window.innerHeight * (0.16 + Math.random() * 0.68);
        burst(x, y, { power: 1.1 + Math.random() * 0.75, count: 36, text: Math.random() < 0.5 ? "TECH!" : "T E C H", shake: true });
        if (Math.random() < 0.38) addTechFace({ clone: true, size: 74 + Math.random() * 58 });
      }
      scheduleTechChaos();
    }, 900 + Math.random() * 1400);
  }

  function runTechFaces(now) {
    if (!readTech()) {
      clearTechTimers();
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    techFaces = techFaces.filter((face) => {
      const age = now - face.born;
      if (!face.el?.isConnected || age > face.life) {
        face.el?.remove();
        return false;
      }
      face.x += face.vx;
      face.y += face.vy;
      face.rot += face.vr;
      const width = face.size;
      const height = face.size * 0.75;
      let bounced = false;
      if (face.x <= 0 || face.x >= w - width) {
        face.x = Math.max(0, Math.min(w - width, face.x));
        face.vx *= -1.08;
        face.vr *= -1.04;
        bounced = true;
      }
      if (face.y <= 36 || face.y >= h - height - 16) {
        face.y = Math.max(36, Math.min(h - height - 16, face.y));
        face.vy *= -1.08;
        face.vr *= -1.04;
        bounced = true;
      }
      if (bounced) {
        burst(face.x + width / 2, face.y + height / 2, { power: 0.55, count: 14, shake: false });
        if (Math.random() < 0.08) splitTechFace(face);
      }
      const pulse = 1 + Math.sin(age / 105) * 0.05;
      face.el.style.transform = `translate(${face.x}px, ${face.y}px) rotate(${face.rot}deg) scale(${pulse})`;
      if (Math.random() < 0.045) spawnParticle(face.x + width / 2, face.y + height / 2, 0.55);
      return true;
    });
    if (techFaces.length < 1) addTechFace({ clone: true });
    techRaf = requestAnimationFrame(runTechFaces);
  }

  function setTechMode(on, opts = {}) {
    const next = Boolean(on);
    saveTech(next);
    if (next && !readOn()) {
      saveOn(true);
      updateState(true);
    }
    document.body.classList.toggle("dopagaki-tech-mode", next);
    const btn = document.getElementById(TOGGLE_ID);
    btn?.classList.toggle("isTech", next);
    if (!next) {
      removeTechVisuals();
      if (!opts.silent) burst(window.innerWidth / 2, 92, { power: 0.75, count: 24, text: "TECH OFF", shake: false });
      return;
    }
    removeTechVisuals();
    ensureTechTitle();
    addTechFace({ size: 150 });
    addTechFace({ clone: true, size: 112 });
    techRaf = requestAnimationFrame(runTechFaces);
    scheduleTechSplit();
    scheduleTechChaos();
    if (!opts.silent) {
      burst(window.innerWidth / 2, window.innerHeight * 0.45, { power: 1.8, count: 94, text: "T E C H", shake: true });
      setTimeout(() => spawnCreature("pegasus"), 260);
      setTimeout(() => spawnCreature("griffin"), 760);
    }
  }

  function toggleTechMode() {
    setTechMode(!readTech());
  }

  function startTechHold(e) {
    if (e?.button != null && e.button !== 0) return;
    techHoldActivated = false;
    techHoldStarted = Date.now();
    const btn = document.getElementById(TOGGLE_ID);
    btn?.classList.add("isCharging");
    if (techHoldTimer) clearTimeout(techHoldTimer);
    techHoldTimer = setTimeout(() => {
      techHoldActivated = true;
      btn?.classList.remove("isCharging");
      toggleTechMode();
    }, TECH_HOLD_MS);
  }

  function cancelTechHold() {
    const btn = document.getElementById(TOGGLE_ID);
    btn?.classList.remove("isCharging");
    if (techHoldTimer) {
      clearTimeout(techHoldTimer);
      techHoldTimer = null;
    }
  }

  function clampTogglePosition(x, y, btn) {
    const rect = btn?.getBoundingClientRect?.();
    const w = rect?.width || 132;
    const h = rect?.height || 42;
    const pad = 8;
    return {
      x: Math.max(pad, Math.min(window.innerWidth - w - pad, x)),
      y: Math.max(pad, Math.min(window.innerHeight - h - pad, y)),
    };
  }

  function applyTogglePosition(btn, x, y) {
    if (!btn) return;
    const pos = clampTogglePosition(x, y, btn);
    btn.classList.add("isMoved");
    btn.style.setProperty("--dopa-left", `${Math.round(pos.x)}px`);
    btn.style.setProperty("--dopa-top", `${Math.round(pos.y)}px`);
  }

  function saveTogglePosition(btn) {
    try {
      const rect = btn.getBoundingClientRect();
      localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
    } catch {}
  }

  function restoreTogglePosition(btn) {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (!Number.isFinite(pos?.x) || !Number.isFinite(pos?.y)) return;
      applyTogglePosition(btn, pos.x, pos.y);
    } catch {}
  }

  function onTogglePointerDown(e) {
    if (e?.button != null && e.button !== 0) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    toggleDrag = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: rect.left,
      baseY: rect.top,
      moved: false,
    };
    try {
      btn.setPointerCapture?.(e.pointerId);
    } catch {}
    startTechHold(e);
  }

  function onTogglePointerMove(e) {
    if (!toggleDrag || toggleDrag.id !== e.pointerId) return;
    const dx = e.clientX - toggleDrag.startX;
    const dy = e.clientY - toggleDrag.startY;
    if (!toggleDrag.moved && Math.hypot(dx, dy) < 8) return;
    toggleDrag.moved = true;
    cancelTechHold();
    applyTogglePosition(e.currentTarget, toggleDrag.baseX + dx, toggleDrag.baseY + dy);
    e.preventDefault();
    e.stopPropagation();
  }

  function onTogglePointerEnd(e) {
    if (!toggleDrag || toggleDrag.id !== e.pointerId) {
      cancelTechHold();
      return;
    }
    const moved = toggleDrag.moved;
    toggleDrag = null;
    cancelTechHold();
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}
    if (moved) {
      saveTogglePosition(e.currentTarget);
      suppressToggleClickUntil = Date.now() + 360;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function createToggle() {
    if (document.getElementById(TOGGLE_ID)) return;
    const btn = document.createElement("button");
    btn.id = TOGGLE_ID;
    btn.type = "button";
    btn.textContent = "\u30c9\u30d1\u30ac\u30ad";
    btn.setAttribute("aria-pressed", "false");
    restoreTogglePosition(btn);
    btn.addEventListener("pointerdown", onTogglePointerDown);
    btn.addEventListener("pointermove", onTogglePointerMove);
    btn.addEventListener("pointerup", onTogglePointerEnd);
    btn.addEventListener("pointercancel", onTogglePointerEnd);
    btn.addEventListener("pointerleave", () => {
      if (!toggleDrag?.moved) cancelTechHold();
    });
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (Date.now() < suppressToggleClickUntil) return;
      if (techHoldActivated || (techHoldStarted && Date.now() - techHoldStarted >= TECH_HOLD_MS - 80)) {
        techHoldActivated = false;
        techHoldStarted = 0;
        return;
      }
      techHoldStarted = 0;
      const on = !readOn();
      saveOn(on);
      updateState(on);
      burst(e.clientX || window.innerWidth / 2, e.clientY || 90, {
        power: on ? 1.35 : 0.8,
        count: on ? 62 : 22,
        text: on ? "DOPA!" : "OFF",
      });
    });
    document.body.appendChild(btn);
  }
  function bindClickConfetti() {
    document.addEventListener(
      "click",
      (e) => {
        if (!readOn()) return;
        if (e.target?.closest?.(`#${TOGGLE_ID}`)) return;
        if (e.target?.closest?.("input, textarea, select, option")) return;
        burst(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, {
          power: 0.72,
          count: 18,
          shake: false,
        });
      },
      true,
    );
  }

  window.TCGDopagaki = {
    isOn: readOn,
    isTech: readTech,
    tech: (on = !readTech()) => setTechMode(on),
    burst,
    creature: spawnCreature,
    evolve: (detail = {}) => showEventCelebration(detail.label || "EVOLVE!!", { duration: 3000 }),
    score: showScoreProgress,
  };

  function boot() {
    if (!document.body) return;
    injectStyle();
    ensureRoot();
    createToggle();
    updateState(readOn());
    setTechMode(readOn() && readTech(), { silent: true });
    bindClickConfetti();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();



