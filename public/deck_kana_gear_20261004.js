(() => {
  "use strict";

  const VERSION = "20261004_kana_gear1";
  const SEARCH_ID = "search";
  const GEAR_DURATION = 2000;

  // 読みがカード定義に入っていない旧カード用の補助辞書。
  // key はひらがなで統一。今後はここへ 1 行追加するだけで増やせる。
  const READING_ALIASES = new Map([
    ["したてや", ["仕立て屋"]],
  ]);

  const HOME_ROUTES = new Set([
    "deck",
    "play",
    "settings",
    "user",
    "login",
    "gacha",
    "arcade",
    "creator",
    "tier",
    "carddex",
    "dice",
    "status",
    "changelog",
  ]);

  function normalizeText(value) {
    return String(value || "").normalize("NFKC").trim().toLowerCase();
  }

  function katakanaToHiragana(value) {
    return normalizeText(value).replace(/[ァ-ヶ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60),
    );
  }

  function hiraganaToKatakana(value) {
    return normalizeText(value).replace(/[ぁ-ゖ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60),
    );
  }

  function readingKey(value) {
    return katakanaToHiragana(value).replace(/[\s　・･._-]+/g, "");
  }

  function visibleCardCount() {
    const modern = document.querySelectorAll("#cardList .cardRow[data-card-id]").length;
    const legacy = document.querySelectorAll("#cardSections .card[data-card-id]").length;
    return modern + legacy;
  }

  function aliasCandidates(query) {
    const key = readingKey(query);
    if (!key) return [];
    const out = [];
    for (const [reading, targets] of READING_ALIASES) {
      // 2文字以上なら入力途中でも候補を出す。例:「した」→「仕立て屋」
      const partial = key.length >= 2 && reading.startsWith(key);
      if (reading === key || partial) out.push(...targets);
    }
    return [...new Set(out)];
  }

  function installKanaSearch() {
    const search = document.getElementById(SEARCH_ID);
    if (!search || search.dataset.kanaSearchBound === "1") return false;
    search.dataset.kanaSearchBound = "1";
    search.placeholder = "カード名 / よみ / ID / シリーズで検索";

    let internalRewrite = false;
    let serial = 0;

    const runExistingSearch = (query) => {
      internalRewrite = true;
      search.value = query;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      internalRewrite = false;
    };

    const tryFallback = (visibleQuery, ticket) => {
      if (ticket !== serial) return;
      const original = String(visibleQuery || "");
      const normalized = normalizeText(original);
      if (!normalized || visibleCardCount() > 0) return;

      const candidates = [];
      const hira = katakanaToHiragana(normalized);
      const kata = hiraganaToKatakana(normalized);
      if (hira && hira !== normalized) candidates.push(hira);
      if (kata && kata !== normalized) candidates.push(kata);
      candidates.push(...aliasCandidates(normalized));

      let matchedQuery = "";
      for (const candidate of [...new Set(candidates)].filter(Boolean)) {
        runExistingSearch(candidate);
        if (visibleCardCount() > 0) {
          matchedQuery = candidate;
          break;
        }
      }

      if (matchedQuery) {
        // 内部の filterName は検索にヒットした語を維持し、入力欄だけユーザーの文字へ戻す。
        search.value = original;
        search.dataset.kanaFallback = matchedQuery;
        search.title = `よみ検索: ${original} → ${matchedQuery}`;
        return;
      }

      // どのフォールバックも該当しなければ、元の検索状態へ戻す。
      runExistingSearch(original);
      search.value = original;
      delete search.dataset.kanaFallback;
      search.removeAttribute("title");
    };

    search.addEventListener("input", () => {
      if (internalRewrite) return;
      const visibleQuery = search.value || "";
      const ticket = ++serial;
      // deck.js の既存 input ハンドラが先に renderAll() を終えた後で判定する。
      queueMicrotask(() => tryFallback(visibleQuery, ticket));
    });

    // 外部から読みを追加したい時用。ページ再読込までは有効。
    window.TCG_KANA_SEARCH = {
      version: VERSION,
      add(reading, target) {
        const key = readingKey(reading);
        const name = String(target || "").trim();
        if (!key || !name) return false;
        const next = new Set(READING_ALIASES.get(key) || []);
        next.add(name);
        READING_ALIASES.set(key, [...next]);
        return true;
      },
      normalize: readingKey,
    };

    return true;
  }

  function gearPoints(teeth = 14, outer = 50, root = 40) {
    const points = [];
    const count = teeth * 4;
    for (let i = 0; i < count; i += 1) {
      const phase = i % 4;
      const radius = phase === 0 || phase === 1 ? outer : root;
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / count;
      points.push(`${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`);
    }
    return points.join(" ");
  }

  function gearSpokes(count = 8) {
    const lines = [];
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count;
      const x1 = Math.cos(a) * 14;
      const y1 = Math.sin(a) * 14;
      const x2 = Math.cos(a) * 34;
      const y2 = Math.sin(a) * 34;
      lines.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`);
    }
    return lines.join("");
  }

  function gearSvg(className, teeth) {
    return `
      <div class="tcgGear ${className}" aria-hidden="true">
        <svg viewBox="-58 -58 116 116" role="presentation">
          <polygon class="tcgGearTeeth" points="${gearPoints(teeth)}"></polygon>
          <circle class="tcgGearRim" r="35"></circle>
          <g class="tcgGearSpokes">${gearSpokes(8)}</g>
          <circle class="tcgGearHubOuter" r="14"></circle>
          <circle class="tcgGearHub" r="7"></circle>
        </svg>
      </div>
    `;
  }

  function installGearStyle() {
    if (document.getElementById("tcgGearTransitionStyle")) return;
    const style = document.createElement("style");
    style.id = "tcgGearTransitionStyle";
    style.textContent = `
      .tcgGearTransition{
        position:fixed;
        inset:0;
        z-index:1001000;
        overflow:hidden;
        pointer-events:all;
        background:rgba(2,5,10,0);
        opacity:0;
        isolation:isolate;
        animation:tcgGearBackdrop ${GEAR_DURATION}ms cubic-bezier(.22,.78,.2,1) forwards;
        will-change:opacity,background;
      }
      .tcgGearTransition::before{
        content:"";
        position:absolute;
        inset:-12%;
        background:
          radial-gradient(circle at 50% 50%, rgba(190,255,90,.17), transparent 15%),
          radial-gradient(circle at 50% 50%, rgba(90,180,255,.17), transparent 34%),
          repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0 1px, transparent 1px 6px);
        opacity:0;
        transform:scale(.86);
        animation:tcgGearField ${GEAR_DURATION}ms ease forwards;
        pointer-events:none;
      }
      .tcgGearTransition::after{
        content:"";
        position:absolute;
        left:50%;
        top:50%;
        width:18vmin;
        aspect-ratio:1;
        translate:-50% -50%;
        border-radius:50%;
        background:radial-gradient(circle, rgba(255,255,255,.90) 0 2%, rgba(190,255,90,.44) 7%, rgba(90,180,255,.16) 24%, transparent 66%);
        opacity:0;
        transform:scale(.2);
        animation:tcgGearMeshFlash ${GEAR_DURATION}ms ease-out forwards;
        pointer-events:none;
        mix-blend-mode:screen;
      }
      .tcgGear{
        position:absolute;
        left:50%;
        top:50%;
        translate:-50% -50%;
        will-change:transform,opacity,filter;
        filter:drop-shadow(0 22px 34px rgba(0,0,0,.62));
      }
      .tcgGear svg{
        width:100%;
        height:100%;
        overflow:visible;
      }
      .tcgGearA{
        width:clamp(150px,38vmin,310px);
        aspect-ratio:1;
        color:#bfff58;
        animation:tcgGearFromTopRight ${GEAR_DURATION}ms cubic-bezier(.18,.82,.16,1) forwards;
      }
      .tcgGearB{
        width:clamp(135px,34vmin,278px);
        aspect-ratio:1;
        color:#69c9ff;
        animation:tcgGearFromBottomLeft ${GEAR_DURATION}ms cubic-bezier(.18,.82,.16,1) forwards;
      }
      .tcgGearTeeth{
        fill:rgba(12,20,26,.97);
        stroke:currentColor;
        stroke-width:2.2;
        stroke-linejoin:round;
      }
      .tcgGearRim{
        fill:none;
        stroke:rgba(255,255,255,.34);
        stroke-width:3.3;
      }
      .tcgGearSpokes{
        stroke:currentColor;
        stroke-width:5.4;
        stroke-linecap:round;
        opacity:.74;
      }
      .tcgGearHubOuter{
        fill:rgba(2,6,10,.96);
        stroke:currentColor;
        stroke-width:2.6;
      }
      .tcgGearHub{
        fill:currentColor;
        stroke:rgba(255,255,255,.72);
        stroke-width:1.7;
        filter:drop-shadow(0 0 7px currentColor);
      }
      .tcgGearStatus{
        position:absolute;
        left:50%;
        top:50%;
        z-index:3;
        translate:-50% -50%;
        display:grid;
        place-items:center;
        gap:5px;
        min-width:150px;
        padding:10px 18px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(0,0,0,.52);
        box-shadow:0 0 38px rgba(120,220,255,.15), inset 0 0 24px rgba(255,255,255,.04);
        backdrop-filter:blur(8px);
        color:#fff;
        text-align:center;
        opacity:0;
        transform:scale(.9);
        animation:tcgGearStatusIn ${GEAR_DURATION}ms ease forwards;
        pointer-events:none;
      }
      .tcgGearStatus b{
        font-size:12px;
        letter-spacing:.18em;
        color:#e9ffd0;
      }
      .tcgGearStatus span{
        font-size:9px;
        letter-spacing:.20em;
        color:rgba(210,235,255,.62);
      }
      @keyframes tcgGearBackdrop{
        0%{opacity:0;background:rgba(2,5,10,0)}
        10%{opacity:1}
        42%,88%{opacity:1;background:rgba(2,5,10,.90)}
        100%{opacity:1;background:rgba(2,5,10,.99)}
      }
      @keyframes tcgGearField{
        0%,18%{opacity:0;transform:scale(.86)}
        48%{opacity:.58;transform:scale(1)}
        82%{opacity:.82;transform:scale(1.04)}
        100%{opacity:.42;transform:scale(1.10)}
      }
      @keyframes tcgGearFromTopRight{
        0%{opacity:0;transform:translate(72vw,-72vh) rotate(-120deg) scale(.72);filter:blur(5px)}
        12%{opacity:1;filter:blur(0)}
        50%{transform:translate(36%,-28%) rotate(200deg) scale(1)}
        78%{transform:translate(36%,-28%) rotate(590deg) scale(1)}
        100%{opacity:.96;transform:translate(36%,-28%) rotate(850deg) scale(1.04)}
      }
      @keyframes tcgGearFromBottomLeft{
        0%{opacity:0;transform:translate(-72vw,72vh) rotate(120deg) scale(.72);filter:blur(5px)}
        12%{opacity:1;filter:blur(0)}
        50%{transform:translate(-36%,28%) rotate(-180deg) scale(1)}
        78%{transform:translate(-36%,28%) rotate(-540deg) scale(1)}
        100%{opacity:.96;transform:translate(-36%,28%) rotate(-790deg) scale(1.04)}
      }
      @keyframes tcgGearMeshFlash{
        0%,43%{opacity:0;transform:scale(.2)}
        50%{opacity:.95;transform:scale(1)}
        62%{opacity:.22;transform:scale(1.8)}
        100%{opacity:0;transform:scale(3.2)}
      }
      @keyframes tcgGearStatusIn{
        0%,45%{opacity:0;transform:scale(.9)}
        54%,82%{opacity:1;transform:scale(1)}
        100%{opacity:0;transform:scale(1.04)}
      }
      @media (prefers-reduced-motion:reduce){
        .tcgGearTransition,
        .tcgGearTransition::before,
        .tcgGearTransition::after,
        .tcgGear,
        .tcgGearStatus{
          animation-duration:320ms !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function actionLabel(action) {
    const labels = {
      deck: "DECK",
      play: "PLAY",
      settings: "DECK LIST",
      user: "USER",
      login: "LOGIN",
      gacha: "GACHA",
      arcade: "ARCADE",
      creator: "CREATOR",
      tier: "TIER",
      carddex: "CARDS",
      dice: "DICE",
      status: "STATUS",
      changelog: "NEWS",
    };
    return labels[action] || "SHIFT";
  }

  function currentParam(name) {
    try {
      return new URLSearchParams(location.search).get(name) || "";
    } catch {
      return "";
    }
  }

  function routeForHomeAction(action) {
    if (action === "settings") {
      const url = new URL("./deck_list.html", location.href);
      const room = currentParam("room");
      const player = currentParam("player");
      if (room) url.searchParams.set("room", room);
      if (player) url.searchParams.set("player", player);
      return url.href;
    }
    if (action === "carddex") {
      const url = new URL("./carddex.html", location.href);
      const room = currentParam("room");
      const player = currentParam("player");
      if (room) url.searchParams.set("room", room);
      if (player) url.searchParams.set("player", player);
      return url.href;
    }
    if (action === "login") {
      const ret = encodeURIComponent(location.pathname + location.search);
      return `./login.html?return=${ret}`;
    }
    const routes = {
      user: "./profile.html",
      gacha: "./gacha.html",
      arcade: "./arcade.html",
      creator: "./creator.html?v=20260724_creator_templates1",
      tier: "./tier.html",
      dice: "./axis/index.html",
      status: "./status_guide.html",
      changelog: "./changelog.html",
    };
    return routes[action] || "";
  }

  let gearTransitioning = false;

  function closeDeckHome() {
    const home = document.getElementById("deckStart");
    if (!home) return;
    home.classList.add("hide");
    home.setAttribute("aria-hidden", "true");
    try { home.remove(); } catch {}
  }

  function finishHomeAction(action) {
    if (action === "deck") {
      closeDeckHome();
      return;
    }
    if (action === "play") {
      closeDeckHome();
      setTimeout(() => document.getElementById("roomDrawerToggle")?.click(), 60);
      return;
    }
    const route = routeForHomeAction(action);
    if (route) location.href = route;
  }

  function runGearTransition(action) {
    if (gearTransitioning) return;
    gearTransitioning = true;
    installGearStyle();

    const old = document.querySelector(".tcgGearTransition");
    old?.remove();

    const overlay = document.createElement("div");
    overlay.className = "tcgGearTransition";
    overlay.setAttribute("role", "presentation");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      ${gearSvg("tcgGearA", 14)}
      ${gearSvg("tcgGearB", 12)}
      <div class="tcgGearStatus"><b>${actionLabel(action)}</b><span>GEAR LINK</span></div>
    `;
    document.body.appendChild(overlay);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const duration = reduce ? 330 : GEAR_DURATION;
    setTimeout(() => finishHomeAction(action), Math.max(300, duration - 40));
    setTimeout(() => {
      if (document.documentElement.contains(overlay)) overlay.remove();
      gearTransitioning = false;
    }, duration + 180);
  }

  function homeActionTarget(event) {
    const target = event.target?.closest?.("#deckStart [data-home-action]");
    if (!target) return null;
    const action = String(target.getAttribute("data-home-action") || "").trim();
    if (!HOME_ROUTES.has(action)) return null;
    return { target, action };
  }

  function interceptHomeClick(event) {
    const hit = homeActionTarget(event);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    runGearTransition(hit.action);
  }

  function interceptHomeKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const hit = homeActionTarget(event);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    runGearTransition(hit.action);
  }

  function installGearNavigation() {
    if (window.__tcgGearHomeNavigationBound) return;
    window.__tcgGearHomeNavigationBound = true;
    // capture で deck.js の従来 1.5秒ズームより先に受け、二重演出を防ぐ。
    document.addEventListener("click", interceptHomeClick, true);
    document.addEventListener("keydown", interceptHomeKey, true);
  }

  function install() {
    installKanaSearch();
    installGearStyle();
    installGearNavigation();
    document.documentElement.dataset.kanaGearUi = VERSION;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  // deck.js はmodule + Firestore読込で遅れて検索欄を用意する場合があるため軽く再確認。
  let attempts = 0;
  const waitSearch = setInterval(() => {
    attempts += 1;
    if (installKanaSearch() || attempts >= 30) clearInterval(waitSearch);
  }, 250);

  console.log("[deck_kana_gear] ready", VERSION);
})();