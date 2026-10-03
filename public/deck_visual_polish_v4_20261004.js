(() => {
  "use strict";

  const VERSION = "20261004_visual4";
  const STYLE_ID = "deckVisualPolishV420261004";
  const BODY_CLASS = "deckVisualPolishV4";
  let scheduled = false;
  let observer = null;

  function isDeckBuilder() {
    return !!(document.getElementById("cardList") && document.getElementById("deckPanel"));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* =========================================================
   0bato final visual polish v4
   Layout/function neutral except specifically requested mobile refinements.
   ========================================================= */
body.${BODY_CLASS}{
  --lux-cyan:#68d9ff;
  --lux-mint:#6fffc2;
  --lux-lime:#c8ff46;
  --lux-violet:#a888ff;
  --lux-gold:#ffd878;
}

/* ---------- Shared deck luxury ---------- */
body.${BODY_CLASS} .libraryPanel,
body.${BODY_CLASS} #deckPanel{
  border-color:rgba(125,220,255,.20)!important;
  background:
    radial-gradient(680px 220px at 12% -8%, rgba(80,205,255,.13), transparent 60%),
    radial-gradient(520px 200px at 92% 0%, rgba(105,255,185,.08), transparent 64%),
    linear-gradient(180deg, rgba(14,28,37,.94), rgba(7,12,18,.96))!important;
  box-shadow:
    0 18px 46px rgba(0,0,0,.42),
    inset 0 1px 0 rgba(255,255,255,.07),
    inset 0 0 40px rgba(80,190,255,.025)!important;
}
body.${BODY_CLASS} .libraryPanel>.hd,
body.${BODY_CLASS} #deckPanel>.hd{
  background:
    linear-gradient(90deg, rgba(75,190,235,.13), rgba(20,30,40,.74) 48%, rgba(105,255,185,.07))!important;
  border-bottom-color:rgba(125,220,255,.16)!important;
  box-shadow:inset 0 -1px 0 rgba(255,255,255,.025)!important;
}
body.${BODY_CLASS} .libraryPanel>.hd b,
body.${BODY_CLASS} #deckPanel>.hd b{
  text-shadow:0 0 18px rgba(105,220,255,.18)!important;
}
body.${BODY_CLASS} .libraryPanel>.hd::after,
body.${BODY_CLASS} #deckPanel>.hd::after{
  content:"";
  position:absolute;
  left:10px;right:10px;bottom:-1px;height:1px;
  background:linear-gradient(90deg, transparent, rgba(100,220,255,.5), rgba(105,255,185,.34), transparent);
  pointer-events:none;
}
body.${BODY_CLASS} .filterBar{
  border-color:rgba(105,205,245,.18)!important;
  background:
    radial-gradient(380px 100px at 16% 0%, rgba(90,205,255,.09), transparent 70%),
    rgba(3,10,15,.68)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 26px rgba(0,0,0,.22)!important;
}
body.${BODY_CLASS} .filterTab,
body.${BODY_CLASS} .filterChip,
body.${BODY_CLASS} .deckSortRail button{
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06)!important;
}
body.${BODY_CLASS} .filterTab.active,
body.${BODY_CLASS} .filterChip.active,
body.${BODY_CLASS} .deckSortRail button.active{
  box-shadow:0 0 0 1px rgba(105,210,255,.22),0 0 18px rgba(80,190,255,.13),inset 0 1px 0 rgba(255,255,255,.10)!important;
}
body.${BODY_CLASS} #cardList .cardRow,
body.${BODY_CLASS} #deckList .cardRow{
  border-color:color-mix(in srgb, var(--typeColor, #68d9ff) 26%, rgba(255,255,255,.10))!important;
  background:
    radial-gradient(220px 90px at 0% 0%, color-mix(in srgb, var(--typeColor, #68d9ff) 11%, transparent), transparent 72%),
    linear-gradient(135deg, rgba(255,255,255,.045), rgba(0,0,0,.22))!important;
  box-shadow:
    inset 3px 0 0 color-mix(in srgb, var(--typeColor, #68d9ff) 52%, transparent),
    inset 0 1px 0 rgba(255,255,255,.055),
    0 8px 20px rgba(0,0,0,.19)!important;
}
body.${BODY_CLASS} #cardList .cardRow:active,
body.${BODY_CLASS} #deckList .cardRow:active{
  filter:brightness(1.08)!important;
}
body.${BODY_CLASS} .deckEmptyHint{
  border-color:rgba(105,210,255,.18)!important;
  background:
    radial-gradient(320px 130px at 50% 0%, rgba(85,205,255,.08), transparent 70%),
    rgba(0,0,0,.22)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important;
}
body.${BODY_CLASS} #deckPanel .deckPanelActions button{
  border-color:rgba(105,210,255,.20)!important;
  background:
    linear-gradient(180deg, rgba(85,195,235,.10), rgba(0,0,0,.24))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 5px 15px rgba(0,0,0,.18)!important;
}
body.${BODY_CLASS} #deckPanel .deckPanelActions button[data-deck-panel-action="save"]{
  border-color:rgba(105,220,255,.30)!important;
}
body.${BODY_CLASS} #deckPanel .deckPanelActions button[data-deck-panel-action="library"]{
  border-color:rgba(105,255,185,.26)!important;
}
body.${BODY_CLASS} #deckProgressMini{
  border-color:rgba(105,220,255,.13)!important;
  background:rgba(4,13,18,.56)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important;
}
body.${BODY_CLASS} #deckProgressMini .deckProgressBar{
  box-shadow:0 0 14px rgba(90,230,210,.12)!important;
}

/* panel collapse +/- must match */
body.${BODY_CLASS} #libraryPanelMinBtn,
body.${BODY_CLASS} #deckPanelMinBtn{
  width:36px!important;
  height:36px!important;
  min-width:36px!important;
  min-height:36px!important;
  flex:0 0 36px!important;
  padding:0!important;
  border-radius:999px!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-size:16px!important;
  line-height:1!important;
  border-color:rgba(135,220,255,.24)!important;
  background:linear-gradient(180deg, rgba(110,210,245,.12), rgba(0,0,0,.26))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 14px rgba(90,210,255,.08)!important;
}

/* ---------- EX: title + search button; details only on demand ---------- */
body.${BODY_CLASS} .deckExSummary.exCompactV4{
  margin:7px 0 0!important;
  padding:8px 9px!important;
  border-radius:12px!important;
  border:1px solid rgba(160,130,255,.18)!important;
  background:
    radial-gradient(260px 100px at 0% 0%, rgba(160,120,255,.11), transparent 68%),
    rgba(3,8,13,.54)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04)!important;
}
body.${BODY_CLASS} .exCompactHeadV4{
  display:flex!important;
  align-items:center!important;
  gap:7px!important;
  min-height:30px!important;
}
body.${BODY_CLASS} .exCompactTitleV4{
  flex:1 1 auto!important;
  min-width:0!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
  font-size:13px!important;
  line-height:1.2!important;
  color:rgba(245,240,255,.94)!important;
}
body.${BODY_CLASS} .exInfoToggleV4,
body.${BODY_CLASS} .deckExSummary.exCompactV4 [data-ex-clear]{
  flex:0 0 auto!important;
  width:30px!important;
  height:30px!important;
  min-width:30px!important;
  min-height:30px!important;
  padding:0!important;
  border-radius:999px!important;
  display:inline-grid!important;
  place-items:center!important;
  border:1px solid rgba(180,155,255,.24)!important;
  background:rgba(125,95,200,.10)!important;
  color:#f6f0ff!important;
  font-size:14px!important;
  line-height:1!important;
  cursor:pointer!important;
}
body.${BODY_CLASS} .deckExSummary.exCompactV4 [data-ex-clear]{
  width:auto!important;
  min-width:42px!important;
  padding:0 8px!important;
  font-size:10px!important;
  font-weight:900!important;
}
body.${BODY_CLASS} .deckExSummary.exCompactV4[data-empty="true"] [data-ex-clear]{
  display:none!important;
}
body.${BODY_CLASS} .exCompactDetailsV4{
  margin-top:7px!important;
  padding:8px 9px!important;
  border-radius:9px!important;
  border:1px solid rgba(255,255,255,.09)!important;
  background:rgba(0,0,0,.24)!important;
  color:rgba(235,238,248,.70)!important;
  font-size:11px!important;
  line-height:1.5!important;
}
body.${BODY_CLASS} .exCompactDetailsV4[hidden]{display:none!important}

/* ---------- Home: fix top tools + restore menu art ---------- */
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartTopbar{
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  min-height:40px!important;
  overflow:visible!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartPostBtn,
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartToolsWrap,
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartToolsBtn{
  height:40px!important;
  min-height:40px!important;
  box-sizing:border-box!important;
  margin:0!important;
  align-self:center!important;
  transform:none!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartToolsWrap{
  display:inline-flex!important;
  align-items:center!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartPostBtn,
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartToolsBtn{
  padding:0 11px!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartToolsBtn::before,
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartPostBtn::before{
  width:20px!important;
  height:20px!important;
  flex:0 0 20px!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartLeft{
  max-height:42dvh!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartMenu{
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:7px!important;
  overflow:visible!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeBtn{
  isolation:isolate!important;
  position:relative!important;
  min-height:clamp(72px,9.2dvh,88px)!important;
  height:auto!important;
  padding:8px 8px 9px!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-start!important;
  justify-content:flex-end!important;
  overflow:hidden!important;
  border-radius:14px!important;
  border-color:color-mix(in srgb,var(--homeAccent) 55%,rgba(255,255,255,.16))!important;
  background:rgba(4,9,14,.94)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.10),
    inset 0 -18px 38px rgba(0,0,0,.34),
    0 8px 20px rgba(0,0,0,.30),
    0 0 16px color-mix(in srgb,var(--homeAccent) 16%,transparent)!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeBtn::before{
  content:""!important;
  position:absolute!important;
  inset:0!important;
  z-index:0!important;
  background-image:var(--homeArt)!important;
  background-repeat:no-repeat!important;
  background-size:cover!important;
  background-position:center 24%!important;
  opacity:.82!important;
  filter:saturate(1.08) contrast(1.04) brightness(.90)!important;
  transform:scale(1.015)!important;
  pointer-events:none!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeBtn::after{
  content:""!important;
  position:absolute!important;
  inset:0!important;
  z-index:1!important;
  background:
    linear-gradient(180deg, rgba(0,0,0,.02) 0%, rgba(0,0,0,.10) 42%, rgba(2,5,10,.80) 80%, rgba(1,3,7,.94) 100%),
    radial-gradient(circle at 16% 16%, color-mix(in srgb,var(--homeAccent) 35%,transparent), transparent 44%)!important;
  pointer-events:none!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeIcon,
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeLabel,
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeSub{
  position:relative!important;
  z-index:2!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeIcon{
  position:absolute!important;
  top:6px!important;
  left:6px!important;
  width:25px!important;
  height:25px!important;
  font-size:10px!important;
  background:rgba(0,0,0,.52)!important;
  backdrop-filter:blur(5px)!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeLabel{
  font-size:13px!important;
  line-height:1.05!important;
  text-shadow:0 2px 9px #000,0 0 10px rgba(0,0,0,.72)!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckHomeSub{
  display:none!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartDuel{
  min-height:48px!important;
  height:48px!important;
  margin-top:-3px!important;
  border-radius:14px!important;
  box-shadow:0 0 24px rgba(115,255,150,.22),inset 0 1px 0 rgba(255,255,255,.28)!important;
}
body.${BODY_CLASS}.mobileHomeFit #deckStart .deckStartHero{
  min-height:0!important;
}

@media (max-width:900px), (pointer:coarse) and (max-width:1180px){
  body.${BODY_CLASS} #libraryPanelMinBtn,
  body.${BODY_CLASS} #deckPanelMinBtn{
    width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;
  }
  body.${BODY_CLASS} #deckPanel>.bd,
  body.${BODY_CLASS} .libraryPanel>.bd{
    background:
      linear-gradient(180deg, rgba(40,130,165,.025), rgba(0,0,0,.035))!important;
  }
  body.${BODY_CLASS} .attrHintBox{
    border-color:rgba(110,220,255,.13)!important;
    background:linear-gradient(90deg,rgba(70,180,220,.055),rgba(0,0,0,.12))!important;
  }
}
`;
    document.head.appendChild(style);
  }

  function compactExSummary(box) {
    if (!box || box.dataset.visualPolishV4 === "1") return;

    const clearBtn = box.querySelector("[data-ex-clear]");
    const titleSource = box.firstElementChild?.textContent?.trim() || "EX: 未選択";
    const detailSource = Array.from(box.children)
      .find((el) => el !== clearBtn && /デッキ内のサポートカード/.test(el.textContent || ""))
      ?.textContent?.trim() || "デッキ内のサポートカードから「EXにする」で1枚だけ指定できます。";

    const head = document.createElement("div");
    head.className = "exCompactHeadV4";

    const title = document.createElement("strong");
    title.className = "exCompactTitleV4";
    title.textContent = titleSource;

    const info = document.createElement("button");
    info.type = "button";
    info.className = "exInfoToggleV4";
    info.textContent = "🔍";
    info.title = "EXの説明を見る";
    info.setAttribute("aria-label", "EXの説明を見る");
    info.setAttribute("aria-expanded", "false");

    const details = document.createElement("div");
    details.className = "exCompactDetailsV4";
    details.textContent = detailSource;
    details.hidden = true;

    info.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = details.hidden;
      details.hidden = !open;
      info.setAttribute("aria-expanded", open ? "true" : "false");
      info.title = open ? "EXの説明を閉じる" : "EXの説明を見る";
    });

    box.replaceChildren(head, details);
    head.append(title, info);
    if (clearBtn) {
      clearBtn.textContent = "解除";
      head.appendChild(clearBtn);
    }

    box.classList.add("exCompactV4");
    box.dataset.visualPolishV4 = "1";
  }

  function apply() {
    if (!document.body || !isDeckBuilder()) return;
    injectStyle();
    document.body.classList.add(BODY_CLASS);

    document.querySelectorAll(".deckExSummary").forEach(compactExSummary);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  function init() {
    apply();
    if (!observer) {
      observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, { childList:true, subtree:true });
    }
    window.addEventListener("pageshow", schedule);
    window.addEventListener("resize", schedule, { passive:true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) schedule();
    });
    console.log("[deck_visual_polish_v4] ready", VERSION);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
