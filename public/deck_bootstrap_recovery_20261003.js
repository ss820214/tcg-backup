(() => {
  "use strict";

  const VERSION = "20261003_recovery1";
  const ID = "deckRecoveryHome";
  const STYLE_ID = "deckRecoveryHomeStyle";
  let dynamicHomeSeen = false;
  let autoSuppressed = false;
  let observer = null;

  const $ = (id) => document.getElementById(id);

  function isDeckPage() {
    const name = (location.pathname.split("/").pop() || "deck.html").toLowerCase();
    return name === "deck.html" || name === "deck";
  }

  function dynamicPlay() {
    return document.querySelector("#deckStart [data-home-action='play']");
  }

  function roomIsOpen() {
    const d = $("roomDrawer");
    return !!d && (d.classList.contains("open") || d.getAttribute("aria-hidden") === "false");
  }

  function setRoom(open) {
    const d = $("roomDrawer");
    const o = $("roomDrawerOverlay");
    const t = $("roomDrawerToggle");
    if (!d) return false;
    d.classList.toggle("open", !!open);
    d.setAttribute("aria-hidden", open ? "false" : "true");
    o?.classList.toggle("open", !!open);
    o?.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("roomDrawerOpen", !!open);
    t?.setAttribute("aria-expanded", open ? "true" : "false");
    return true;
  }

  function injectStyle() {
    if ($(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${ID}{
        position:fixed;inset:0;z-index:100200;
        display:grid;place-items:center;
        padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom));
        box-sizing:border-box;
        background:
          radial-gradient(700px 440px at 72% 30%,rgba(166,104,255,.20),transparent 62%),
          radial-gradient(560px 360px at 18% 15%,rgba(80,190,255,.16),transparent 60%),
          linear-gradient(145deg,#060a10,#0a1018 56%,#05070a);
        color:#fff;
        font-family:system-ui,-apple-system,"Segoe UI","Noto Sans JP",sans-serif;
      }
      #${ID}[hidden]{display:none!important}
      #${ID} .drhCard{
        width:min(430px,100%);
        border:1px solid rgba(255,255,255,.14);
        border-radius:22px;
        padding:18px;
        background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.025));
        box-shadow:0 24px 80px rgba(0,0,0,.48);
      }
      #${ID} .drhKicker{font-size:10px;font-weight:950;letter-spacing:.18em;color:#caff62}
      #${ID} h2{margin:5px 0 4px;font-size:28px;line-height:1}
      #${ID} p{margin:0 0 14px;color:rgba(255,255,255,.68);font-size:11px;line-height:1.5}
      #${ID} .drhStatus{
        display:flex;align-items:center;gap:7px;
        min-height:30px;margin-bottom:12px;padding:6px 9px;
        border:1px solid rgba(120,220,255,.18);border-radius:11px;
        background:rgba(45,110,150,.10);font-size:10px;color:rgba(255,255,255,.76)
      }
      #${ID} .drhDot{width:7px;height:7px;border-radius:50%;background:#7dffbd;box-shadow:0 0 12px rgba(125,255,189,.65)}
      #${ID} .drhPlay{
        width:100%;min-height:52px;border:1px solid rgba(202,255,98,.55);border-radius:14px;
        background:linear-gradient(90deg,rgba(202,255,98,.96),rgba(169,244,70,.78));
        color:#142006;font-size:19px;font-weight:1000;letter-spacing:.12em;cursor:pointer
      }
      #${ID} .drhActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
      #${ID} .drhActions button{
        min-height:38px;border:1px solid rgba(255,255,255,.14);border-radius:12px;
        background:rgba(255,255,255,.055);color:#fff;font-weight:900;font-size:11px;cursor:pointer
      }
      @media(max-width:520px){
        #${ID}{place-items:end center;padding:10px}
        #${ID} .drhCard{padding:14px;border-radius:18px}
        #${ID} h2{font-size:24px}
      }
    `;
    document.head.appendChild(s);
  }

  function ensureHome() {
    let home = $(ID);
    if (home) return home;
    injectStyle();
    home = document.createElement("section");
    home.id = ID;
    home.hidden = true;
    home.setAttribute("aria-label", "デッキ復旧ホーム");
    home.innerHTML = `
      <div class="drhCard">
        <div class="drhKicker">TCG OBATO / SAFE START</div>
        <h2>0バト</h2>
        <p>通信初期化中でも、デッキ編集と対戦入口は安全に操作できます。</p>
        <div class="drhStatus"><span class="drhDot"></span><span>ゲームデータを読み込み中…</span></div>
        <button class="drhPlay" type="button" data-recovery-play>PLAY</button>
        <div class="drhActions">
          <button type="button" data-recovery-deck>デッキ編集</button>
          <button type="button" data-recovery-sitehome>サイトHOME</button>
        </div>
      </div>
    `;
    document.body.appendChild(home);

    home.querySelector("[data-recovery-play]")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      autoSuppressed = true;
      hideRecovery();
      const staticStart = $("deckStart");
      staticStart?.classList.add("hide");
      staticStart?.setAttribute("aria-hidden", "true");
      if (!setRoom(true)) location.href = "./deck.html?skipIntro=1";
      try {
        history.pushState({ ...(history.state || {}), tcgOverlay: "room" }, "", location.href);
      } catch {}
    });

    home.querySelector("[data-recovery-deck]")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      autoSuppressed = true;
      hideRecovery();
      const staticStart = $("deckStart");
      staticStart?.classList.add("hide");
      staticStart?.setAttribute("aria-hidden", "true");
    });

    home.querySelector("[data-recovery-sitehome]")?.addEventListener("click", () => {
      location.href = "./index.html";
    });
    return home;
  }

  function showRecovery(force = false) {
    if (!document.body || roomIsOpen()) return;
    if (dynamicPlay()) {
      dynamicHomeSeen = true;
      hideRecovery();
      return;
    }
    if (!force && (dynamicHomeSeen || autoSuppressed)) return;
    const home = ensureHome();
    home.hidden = false;
    document.body.classList.add("deckRecoveryOpen");
    document.documentElement.dataset.deckRecovery = VERSION;
  }

  function hideRecovery() {
    const home = $(ID);
    if (home) home.hidden = true;
    document.body?.classList.remove("deckRecoveryOpen");
  }

  function syncDynamicHome() {
    if (dynamicPlay()) {
      dynamicHomeSeen = true;
      hideRecovery();
    }
  }

  function bindSafeBackFallback() {
    document.addEventListener("click", (e) => {
      const back = e.target?.closest?.("#btnSafeBack");
      if (!back) return;
      if (roomIsOpen()) return; // runtime guard closes the room first.
      const detail = $("detailWrap");
      if (detail && getComputedStyle(detail).display !== "none") return;
      if (dynamicPlay()) return; // runtime guard handles the normal dynamic home.
      e.preventDefault();
      e.stopImmediatePropagation();
      autoSuppressed = false;
      showRecovery(true);
    }, true);

    window.addEventListener("popstate", () => {
      if (roomIsOpen()) setRoom(false);
    });
  }

  function install() {
    if (!isDeckPage() || !document.body) return;
    ensureHome();
    bindSafeBackFallback();

    observer = new MutationObserver(syncDynamicHome);
    observer.observe(document.body, { childList: true, subtree: true });

    // Dynamic home normally replaces the static splash almost immediately. If Firebase/auth
    // blocks module evaluation, expose a stable local-only entrance instead of a blank/half UI.
    setTimeout(() => showRecovery(false), 2200);
    setTimeout(syncDynamicHome, 3500);
    document.documentElement.dataset.deckBootstrapRecovery = VERSION;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
