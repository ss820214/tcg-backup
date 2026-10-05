(() => {
  "use strict";

  const STYLE_ID = "deckMobileHotfixTabs2Style";
  const TAB_ID = "deckAttrQuickTabs20261005";
  const MOBILE_QUERY = "(max-width: 900px), (pointer: coarse) and (max-width: 1180px)";
  const ATTR_ORDER = ["火", "水", "雷", "草", "風", "土", "鋼", "光", "闇", "夢", "幻", "呪", "無", "その他"];
  let scheduled = false;

  const $ = (id) => document.getElementById(id);
  const isMobile = () => window.matchMedia?.(MOBILE_QUERY)?.matches ?? window.innerWidth <= 900;

  function injectStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  /* ===== 「全部」表示は属性タブで1属性ずつ見る ===== */
  #${TAB_ID}{
    display:flex!important;
    align-items:center!important;
    gap:7px!important;
    width:100%!important;
    max-width:100%!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    padding:7px 2px 9px!important;
    margin:0 0 8px!important;
    scrollbar-width:none!important;
    -webkit-overflow-scrolling:touch!important;
    touch-action:pan-x!important;
  }
  #${TAB_ID}::-webkit-scrollbar{display:none!important;}
  #${TAB_ID} button{
    flex:0 0 auto!important;
    min-width:52px!important;
    min-height:38px!important;
    height:38px!important;
    padding:0 13px!important;
    border-radius:999px!important;
    border:1px solid rgba(255,255,255,.16)!important;
    background:rgba(0,0,0,.28)!important;
    color:#fff!important;
    font-size:13px!important;
    font-weight:950!important;
    line-height:1!important;
    white-space:nowrap!important;
    writing-mode:horizontal-tb!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  #${TAB_ID} button.active{
    border-color:rgba(110,205,255,.72)!important;
    background:linear-gradient(180deg,rgba(80,175,235,.34),rgba(30,90,130,.24))!important;
    box-shadow:0 0 0 1px rgba(110,205,255,.14),0 0 20px rgba(70,180,255,.18)!important;
  }

  body.deckAttrTabbedAll #cardList{
    display:block!important;
    width:100%!important;
    min-width:0!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    background:transparent!important;
  }
  body.deckAttrTabbedAll #cardList > details{
    display:none!important;
    width:100%!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  body.deckAttrTabbedAll #cardList > details.deckAttrTabVisible{
    display:block!important;
  }
  body.deckAttrTabbedAll #cardList > details.deckAttrTabVisible > summary{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    width:100%!important;
    min-height:42px!important;
    margin:0 0 7px!important;
    padding:9px 12px!important;
    border:1px solid rgba(255,255,255,.13)!important;
    border-radius:12px!important;
    background:rgba(255,255,255,.045)!important;
    color:rgba(255,255,255,.86)!important;
    font-size:12px!important;
    font-weight:900!important;
    line-height:1.2!important;
    list-style:none!important;
    cursor:pointer!important;
    writing-mode:horizontal-tb!important;
  }
  body.deckAttrTabbedAll #cardList > details.deckAttrTabVisible > summary::-webkit-details-marker{display:none!important;}
  body.deckAttrTabbedAll #cardList > details.deckAttrTabVisible > summary::after{
    content:"縮小 / 拡大";
    flex:0 0 auto;
    font-size:10px;
    font-weight:800;
    color:rgba(255,255,255,.52);
  }
  body.deckAttrTabbedAll #cardList > details.deckAttrTabVisible:not([open]) > summary::after{content:"拡大";}

  /* ===== カード増減: 必ず － | 枚数 | ＋、詳細は下 ===== */
  #cardList .cardRow,
  #deckList .cardRow{
    grid-template-columns:minmax(0,1fr) 142px!important;
    gap:8px!important;
    overflow:hidden!important;
  }
  #cardList .cardRow .btns,
  #deckList .cardRow .btns,
  #cardList .cardRow .cardCtrl,
  #deckList .cardRow .cardCtrl{
    position:relative!important;
    z-index:6!important;
    display:grid!important;
    grid-template-columns:40px minmax(54px,1fr) 40px!important;
    grid-template-areas:
      "minus count plus"
      "detail detail detail"
      "ex ex ex"!important;
    gap:6px!important;
    align-items:center!important;
    align-content:center!important;
    width:142px!important;
    min-width:142px!important;
    max-width:142px!important;
    overflow:visible!important;
    pointer-events:auto!important;
  }
  #cardList .cardRow .btns [data-minus],
  #deckList .cardRow .btns [data-minus],
  #cardList .cardRow .cardCtrl [data-minus],
  #deckList .cardRow .cardCtrl [data-minus]{grid-area:minus!important;}
  #cardList .cardRow .btns .count,
  #deckList .cardRow .btns .count,
  #cardList .cardRow .btns .cnt,
  #deckList .cardRow .btns .cnt,
  #cardList .cardRow .cardCtrl .count,
  #deckList .cardRow .cardCtrl .count,
  #cardList .cardRow .cardCtrl .cnt,
  #deckList .cardRow .cardCtrl .cnt{grid-area:count!important;}
  #cardList .cardRow .btns [data-plus],
  #deckList .cardRow .btns [data-plus],
  #cardList .cardRow .cardCtrl [data-plus],
  #deckList .cardRow .cardCtrl [data-plus]{grid-area:plus!important;}
  #cardList .cardRow .btns [data-detail],
  #deckList .cardRow .btns [data-detail],
  #cardList .cardRow .cardCtrl [data-detail],
  #deckList .cardRow .cardCtrl [data-detail]{grid-area:detail!important;}
  #cardList .cardRow .btns [data-ex],
  #deckList .cardRow .btns [data-ex],
  #cardList .cardRow .btns [data-expick],
  #deckList .cardRow .btns [data-expick],
  #cardList .cardRow .cardCtrl [data-ex],
  #deckList .cardRow .cardCtrl [data-ex],
  #cardList .cardRow .cardCtrl [data-expick],
  #deckList .cardRow .cardCtrl [data-expick]{grid-area:ex!important;}
  #cardList .cardRow .btns button,
  #deckList .cardRow .btns button,
  #cardList .cardRow .cardCtrl button,
  #deckList .cardRow .cardCtrl button{
    position:relative!important;
    z-index:8!important;
    min-width:40px!important;
    width:100%!important;
    max-width:none!important;
    min-height:38px!important;
    height:38px!important;
    margin:0!important;
    padding:0 6px!important;
    border-radius:10px!important;
    font-size:13px!important;
    line-height:1!important;
    writing-mode:horizontal-tb!important;
    overflow:visible!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  #cardList .cardRow .btns [data-minus],
  #deckList .cardRow .btns [data-minus],
  #cardList .cardRow .btns [data-plus],
  #deckList .cardRow .btns [data-plus]{font-size:18px!important;font-weight:950!important;}
  #cardList .cardRow .btns .count,
  #deckList .cardRow .btns .count,
  #cardList .cardRow .btns .cnt,
  #deckList .cardRow .btns .cnt{
    min-width:0!important;
    width:100%!important;
    min-height:38px!important;
    height:38px!important;
    display:grid!important;
    place-items:center!important;
    padding:0 4px!important;
    font-size:12px!important;
    white-space:nowrap!important;
    overflow:hidden!important;
  }

  /* ===== デッキ保存: 縦一列。名前 → 保存 → 色/公開設定 ===== */
  #deckPanel .deckSaveDock,
  #deckPanel #deckSaveDock,
  #deckPanel .deckSaveDock .deckLibBox,
  #deckPanel .deckSaveDock .deckLibBd,
  #deckPanel .deckSaveDock .deckLibSection,
  #deckPanel .deckSaveDock .deckLibSectionBd,
  #deckPanel .deckSaveDock .deckLibModePanel{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    box-sizing:border-box!important;
    writing-mode:horizontal-tb!important;
  }
  #deckPanel .deckSaveDock{
    display:block!important;
    overflow:visible!important;
    padding:10px!important;
  }
  #deckPanel .deckSaveDock .deckSaveRow{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    width:100%!important;
    padding:8px 0!important;
  }
  #deckPanel .deckSaveDock #deckTitle,
  #deckPanel .deckSaveDock #btnSave{
    display:block!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:44px!important;
    height:44px!important;
    writing-mode:horizontal-tb!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }

  /* 「保存する」の巨大な縦タブはスマホでは不要 */
  #deckPanel .deckSaveDock .deckLibModeTabs{display:none!important;}
  #deckPanel .deckSaveDock #deckLibSavePanel:not([hidden]){
    display:block!important;
    width:100%!important;
  }
  #deckPanel .deckSaveDock #deckLibSearchPanel[hidden],
  #deckPanel .deckSaveDock #deckLibModeSearch[hidden],
  #deckPanel .deckSaveDock .deckLibModePanel[hidden],
  #deckPanel .deckSaveDock .deckLibSection[hidden]{display:none!important;}
  #deckPanel .deckSaveDock .deckLibBox{
    display:block!important;
    margin:10px 0 0!important;
    overflow:hidden!important;
    border-radius:14px!important;
  }
  #deckPanel .deckSaveDock .deckLibHd{
    display:flex!important;
    width:100%!important;
    padding:10px 12px!important;
  }
  #deckPanel .deckSaveDock .deckLibBd{display:block!important;padding:9px!important;}
  #deckPanel .deckSaveDock .deckLibSectionBd{
    display:flex!important;
    flex-direction:column!important;
    gap:9px!important;
    padding:10px!important;
  }
  #deckPanel .deckSaveDock .deckLibRow{
    display:flex!important;
    flex-direction:column!important;
    align-items:stretch!important;
    gap:9px!important;
    width:100%!important;
    min-width:0!important;
  }
  #deckPanel .deckSaveDock .deckLibColorWrap{
    order:1!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 68px!important;
    align-items:center!important;
    gap:10px!important;
    width:100%!important;
    min-height:44px!important;
    padding:7px 10px!important;
    border:1px solid rgba(255,255,255,.10)!important;
    border-radius:12px!important;
    background:rgba(0,0,0,.18)!important;
  }
  #deckPanel .deckSaveDock #deckLibThemeColor{
    width:68px!important;
    min-width:68px!important;
    height:34px!important;
    padding:2px!important;
  }
  #deckPanel .deckSaveDock #deckLibVis{
    order:2!important;
    display:block!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:44px!important;
    height:44px!important;
  }
  #deckPanel .deckSaveDock .deckLibSaveBtns{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
  }
  #deckPanel .deckSaveDock .deckLibSaveBtns button{
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    min-height:44px!important;
    height:44px!important;
    padding:0 12px!important;
    white-space:normal!important;
    overflow:visible!important;
    writing-mode:horizontal-tb!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  #deckPanel .deckSaveDock .deckLibSub{
    width:100%!important;
    margin:0!important;
    padding-top:2px!important;
    font-size:10.5px!important;
    line-height:1.45!important;
    white-space:normal!important;
  }

  @media(max-width:390px){
    #cardList .cardRow,#deckList .cardRow{grid-template-columns:minmax(0,1fr) 132px!important;}
    #cardList .cardRow .btns,#deckList .cardRow .btns,#cardList .cardRow .cardCtrl,#deckList .cardRow .cardCtrl{
      width:132px!important;min-width:132px!important;max-width:132px!important;
      grid-template-columns:38px minmax(50px,1fr) 38px!important;
    }
  }
}
`;
    document.head.appendChild(style);
  }

  function summaryLabel(details) {
    const raw = String(details.querySelector(":scope > summary")?.textContent || "").trim();
    return raw.split(/[:：]/)[0].trim() || "その他";
  }

  function sortGroups(groups) {
    return [...groups].sort((a, b) => {
      const aa = summaryLabel(a);
      const bb = summaryLabel(b);
      const ai = ATTR_ORDER.indexOf(aa);
      const bi = ATTR_ORDER.indexOf(bb);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || aa.localeCompare(bb, "ja");
    });
  }

  function removeTabs() {
    $(TAB_ID)?.remove();
    document.body?.classList.remove("deckAttrTabbedAll");
    document.querySelectorAll("#cardList > details.deckAttrTabVisible").forEach((d) => d.classList.remove("deckAttrTabVisible"));
  }

  function buildTabs() {
    if (!isMobile()) {
      removeTabs();
      return;
    }
    const list = $("cardList");
    const typeSelect = $("typeSelect");
    if (!list || !typeSelect) return;

    const allMode = String(typeSelect.value || "ALL") === "ALL";
    const groups = sortGroups(list.querySelectorAll(":scope > details"));
    if (!allMode || groups.length <= 1) {
      removeTabs();
      return;
    }

    document.body.classList.add("deckAttrTabbedAll");
    let tabs = $(TAB_ID);
    if (!tabs) {
      tabs = document.createElement("div");
      tabs.id = TAB_ID;
      tabs.setAttribute("role", "tablist");
      list.insertAdjacentElement("beforebegin", tabs);
    }

    const labels = groups.map(summaryLabel);
    let active = String(tabs.dataset.active || "");
    if (!labels.includes(active)) active = labels[0] || "";
    tabs.dataset.active = active;

    const signature = labels.join("|");
    if (tabs.dataset.signature !== signature) {
      tabs.dataset.signature = signature;
      tabs.innerHTML = "";
      groups.forEach((details) => {
        const label = summaryLabel(details);
        const summary = String(details.querySelector(":scope > summary")?.textContent || label).trim();
        const countMatch = summary.match(/(\d+)\s*枚/);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.attrTab = label;
        btn.textContent = countMatch ? `${label} ${countMatch[1]}` : label;
        btn.setAttribute("role", "tab");
        btn.addEventListener("click", () => {
          tabs.dataset.active = label;
          applyActiveGroup(true);
        });
        tabs.appendChild(btn);
      });
    }

    applyActiveGroup(false);
  }

  function applyActiveGroup(openSelected) {
    const tabs = $(TAB_ID);
    const list = $("cardList");
    if (!tabs || !list) return;
    const active = String(tabs.dataset.active || "");
    let selected = null;
    list.querySelectorAll(":scope > details").forEach((details) => {
      const on = summaryLabel(details) === active;
      details.classList.toggle("deckAttrTabVisible", on);
      if (on) selected = details;
    });
    tabs.querySelectorAll("button[data-attr-tab]").forEach((btn) => {
      const on = btn.dataset.attrTab === active;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (selected && openSelected) {
      selected.open = true;
      list.scrollTop = 0;
    } else if (selected && !selected.hasAttribute("data-hotfix-seen")) {
      selected.open = true;
      selected.setAttribute("data-hotfix-seen", "1");
    }
  }

  function normalizeDeckButtons() {
    if (!isMobile()) return;
    document.querySelectorAll("#cardList .cardRow .btns, #deckList .cardRow .btns, #cardList .cardRow .cardCtrl, #deckList .cardRow .cardCtrl").forEach((ctrl) => {
      ctrl.style.pointerEvents = "auto";
      ctrl.querySelectorAll("button").forEach((btn) => {
        btn.style.pointerEvents = "auto";
        btn.style.touchAction = "manipulation";
      });
    });
  }

  function normalizeCloudSave() {
    if (!isMobile()) return;
    const box = $("deckLibBox");
    const savePanel = $("deckLibSavePanel");
    if (box) box.dataset.mobileSimpleSave = "1";
    if (savePanel && !savePanel.hidden) savePanel.style.display = "block";
  }

  function apply() {
    scheduled = false;
    injectStyle();
    buildTabs();
    normalizeDeckButtons();
    normalizeCloudSave();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  function boot() {
    if (!$("cardList") || !$("deckPanel")) return;
    apply();

    $("typeSelect")?.addEventListener("change", () => setTimeout(schedule, 0));
    document.addEventListener("click", (e) => {
      if (e.target?.closest?.("[data-kind-filter],[data-owned-filter],[data-attr-filter]")) {
        setTimeout(schedule, 0);
      }
    }, true);

    const listObserver = new MutationObserver(schedule);
    listObserver.observe($("cardList"), { childList: true, subtree: false });

    const deckObserver = new MutationObserver(schedule);
    deckObserver.observe($("deckPanel"), { childList: true, subtree: true });

    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(schedule, 100), { passive: true });
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });

    console.log("[deck mobile hotfix] tabs2 active");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
