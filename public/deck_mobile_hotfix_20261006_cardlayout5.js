(() => {
  "use strict";
  const STYLE_ID = "deckMobileCardLayout8Style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#cardList .cardRow .btns button[data-plus],
#cardList .cardRow .btns button[data-minus],
#deckList .cardRow .btns button[data-plus],
#deckList .cardRow .btns button[data-minus] {
  min-width:32px!important;
  min-height:32px!important;
  height:32px!important;
  touch-action:manipulation;
}
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  #cardList .cardRow,
  #deckList .cardRow {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 110px!important;
    align-items:start!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
    min-height:76px!important;
    height:auto!important;
    margin:0!important;
    padding:6px 8px!important;
    border:0!important;
    border-left:3px solid var(--row-attr,#7dd3fc)!important;
    border-bottom:1px solid rgba(255,255,255,.13)!important;
    border-radius:0!important;
    box-shadow:none!important;
    background:rgba(7,12,16,.54)!important;
    overflow:hidden!important;
  }

  #cardList .cardRow > :first-child,
  #deckList .cardRow > :first-child,
  #cardList .cardRow .cardHead > :first-child,
  #deckList .cardRow .cardHead > :first-child {
    min-width:0!important;
    align-self:start!important;
    text-align:left!important;
  }

  #cardList .cardRow .name,
  #deckList .cardRow .name,
  #cardList .cardRow .cardName,
  #deckList .cardRow .cardName,
  #cardList .cardRow .cardHead > div:first-child > b,
  #deckList .cardRow .cardHead > div:first-child > b {
    display:flex!important;
    align-items:baseline!important;
    justify-content:flex-start!important;
    flex-wrap:wrap!important;
    column-gap:7px!important;
    row-gap:1px!important;
    width:100%!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
    text-align:left!important;
    font-size:13.5px!important;
    font-weight:900!important;
    line-height:1.35!important;
    white-space:normal!important;
    overflow:visible!important;
  }

  #cardList .attrBadge,#deckList .attrBadge,
  #cardList .seriesBadge,#deckList .seriesBadge,
  #cardList .deckRoleTags,#deckList .deckRoleTags,
  #cardList .kindBadge,#deckList .kindBadge,
  #cardList .typeBadge,#deckList .typeBadge {
    display:none!important;
  }

  #cardList .ownedBadge,#deckList .ownedBadge,
  #cardList .mobileInlineStats,#deckList .mobileInlineStats {
    display:inline!important;
    min-height:0!important;
    height:auto!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    background:none!important;
    box-shadow:none!important;
    font-size:11.5px!important;
    font-weight:750!important;
    line-height:1.35!important;
    white-space:nowrap!important;
  }
  #cardList .ownedBadge,#deckList .ownedBadge{color:rgba(255,255,255,.70)!important;}
  #cardList .mobileInlineStats,#deckList .mobileInlineStats{color:rgba(190,226,255,.88)!important;}

  #cardList .mobileSkillLines,
  #deckList .mobileSkillLines {
    display:block!important;
    width:100%!important;
    min-width:0!important;
    margin:4px 0 0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    background:none!important;
    color:rgba(255,255,255,.74)!important;
    font-size:11px!important;
    line-height:1.48!important;
    text-align:left!important;
    white-space:normal!important;
    overflow:visible!important;
  }
  #cardList .mobileSkillLine,
  #deckList .mobileSkillLine {
    display:block!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    background:none!important;
    white-space:normal!important;
    overflow:visible!important;
    overflow-wrap:anywhere!important;
  }
  #cardList .deckStatusVisual,
  #deckList .deckStatusVisual {
    display:inline-flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:16px!important;
    height:16px!important;
    margin:0 2px!important;
    vertical-align:-3px!important;
    flex:0 0 auto!important;
  }
  #cardList .deckStatusIcon,
  #deckList .deckStatusIcon {
    display:block!important;
    width:16px!important;
    height:16px!important;
    object-fit:contain!important;
    border:0!important;
    border-radius:0!important;
    background:none!important;
    box-shadow:none!important;
  }
  #cardList .deckStatusGlyph,
  #deckList .deckStatusGlyph {
    width:auto!important;
    min-width:15px!important;
    font-size:14px!important;
    line-height:1!important;
    color:rgba(255,255,255,.92)!important;
  }

  #cardList .cardRow .btns,
  #deckList .cardRow .btns,
  #cardList .cardRow .cardCtrl,
  #deckList .cardRow .cardCtrl {
    align-self:start!important;
    width:110px!important;
    min-width:110px!important;
    max-width:110px!important;
    display:grid!important;
    grid-template-columns:32px 38px 32px!important;
    grid-template-areas:"minus count plus" "detail detail detail" "ex ex ex" "admin admin admin"!important;
    gap:4px!important;
    margin:0!important;
    padding:0!important;
  }
  #cardList .cardRow [data-minus],#deckList .cardRow [data-minus]{grid-area:minus!important;}
  #cardList .cardRow [data-plus],#deckList .cardRow [data-plus]{grid-area:plus!important;}
  #cardList .cardRow .count,#deckList .cardRow .count,
  #cardList .cardRow .cnt,#deckList .cardRow .cnt{grid-area:count!important;}
  #cardList .cardRow [data-detail],#deckList .cardRow [data-detail]{grid-area:detail!important;}

  #cardList .cardRow [data-minus],#deckList .cardRow [data-minus],
  #cardList .cardRow [data-plus],#deckList .cardRow [data-plus],
  #cardList .cardRow .count,#deckList .cardRow .count,
  #cardList .cardRow .cnt,#deckList .cardRow .cnt,
  #cardList .cardRow [data-detail],#deckList .cardRow [data-detail] {
    border-radius:2px!important;
    box-shadow:none!important;
  }
  #cardList .cardRow [data-minus],#deckList .cardRow [data-minus],
  #cardList .cardRow [data-plus],#deckList .cardRow [data-plus],
  #cardList .cardRow .count,#deckList .cardRow .count,
  #cardList .cardRow .cnt,#deckList .cardRow .cnt {
    width:100%!important;
    height:32px!important;
    min-height:32px!important;
    padding:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
  }
  #cardList .cardRow [data-detail],#deckList .cardRow [data-detail] {
    width:100%!important;
    height:28px!important;
    min-height:28px!important;
    padding:0 4px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:11.5px!important;
    font-weight:850!important;
    line-height:1!important;
    white-space:nowrap!important;
  }
}
`;
    document.head.appendChild(style);
  }

  function titleOf(row) {
    return row.querySelector(":scope > .name, .cardHead > div:first-child > b, :scope > div:first-child > .name");
  }

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function tidyOwnedBadge(row) {
    const badge = row.querySelector(".ownedBadge");
    if (!badge) return;
    const m = String(badge.textContent || "").trim().match(/(?:所持|枚数)?\s*[×x]?\s*(\d+)/i);
    if (m) setText(badge, `×${m[1]}`);
  }

  function cleanTitleText(title) {
    if (!title) return;
    const attr = String(title.querySelector(".attrBadge")?.textContent || "").trim();
    [...title.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      let t = String(node.textContent || "");
      if (attr) {
        const safe = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(`\\s+${safe}\\s*$`), "");
      }
      t = t.replace(/\s+(?:UNIT|Unit|unit|ユニット|キャラ|サポート|サポ)\s*$/g, "");
      node.textContent = t;
    });
  }

  function removeLegacyMeta(row) {
    row.querySelectorAll(".small,.sub,.cardMeta").forEach((el) => {
      if (!el.classList.contains("mobileSkillLines") && !el.closest(".mobileSkillLines")) el.remove();
    });
  }

  function ensureSkillBox(row, title) {
    let box = row.querySelector(".mobileSkillLines");
    if (box) return box;
    box = document.createElement("div");
    box.className = "mobileSkillLines";
    (title?.parentElement || row.firstElementChild || row).appendChild(box);
    return box;
  }

  function polishRow(row) {
    if (!(row instanceof HTMLElement)) return;
    // Legacy density rules have higher selector specificity than the modern CSS.
    // Keep the actual tap targets and their grid tracks in sync after every render.
    row.style.setProperty("display", "grid", "important");
    row.style.setProperty("grid-template-columns", "minmax(0,1fr) 110px", "important");
    row.style.setProperty("grid-template-areas", '"main ctrl"', "important");
    row.style.setProperty("flex", "0 0 auto", "important");
    row.style.setProperty("height", "auto", "important");
    row.style.setProperty("min-height", "76px", "important");
    row.style.setProperty("padding", "6px 8px", "important");
    row.style.setProperty("grid-template-rows", "auto", "important");
    row.style.setProperty("align-items", "stretch", "important");
    row.style.setProperty("gap", "8px", "important");
    // Scroll containers must size every grid track to its complete card content.
    const list = row.parentElement;
    if (list?.matches("#cardList,#deckList")) {
      list.style.setProperty("grid-template-rows", "none", "important");
      list.style.setProperty("grid-auto-rows", "max-content", "important");
      list.style.setProperty("align-content", "start", "important");
    }
    const controls = row.querySelector(".btns,.cardCtrl");
    const main = row.firstElementChild;
    if (main && main !== controls) {
      main.style.setProperty("grid-area", "main", "important");
      main.style.setProperty("min-width", "0", "important");
      main.style.setProperty("display", "flex", "important");
      main.style.setProperty("flex-direction", "column", "important");
      main.style.setProperty("justify-content", "space-between", "important");
      main.style.setProperty("align-self", "stretch", "important");
      main.style.setProperty("gap", "3px", "important");
    }
    if (controls) {
      controls.style.setProperty("display","grid","important");
      controls.style.setProperty("width","100%","important");
      controls.style.setProperty("min-width","0","important");
      controls.style.setProperty("max-width","100%","important");
      controls.style.setProperty("grid-area","ctrl","important");
      controls.style.setProperty("grid-template-columns","32px 38px 32px","important");
      const areas = [];
      const tracks = [];
      if (controls.querySelector("[data-minus],[data-plus]")) { areas.push('"minus count plus"'); tracks.push("32px"); }
      else if (controls.querySelector(".count,.cnt")) { areas.push('"count count count"'); tracks.push("32px"); }
      if (controls.querySelector("[data-ex],[data-expick]")) { areas.push('"ex ex ex"'); tracks.push("32px"); }
      if (controls.querySelector("[data-hide-toggle]")) { areas.push('"admin admin admin"'); tracks.push("32px"); }
      if (controls.querySelector("[data-detail]")) { areas.push('"detail detail detail"'); tracks.push("28px"); }
      controls.style.setProperty("grid-template-areas",areas.join(" "),"important");
      controls.style.setProperty("grid-template-rows",tracks.join(" "),"important");
      controls.style.setProperty("grid-auto-rows","minmax(32px, auto)","important");
      controls.style.setProperty("height","auto","important");
      controls.style.setProperty("align-self","stretch","important");
      controls.style.setProperty("align-items","stretch","important");
      controls.style.setProperty("gap","4px","important");
      for (const [selector,area] of [["[data-minus]","minus"],[".count,.cnt","count"],["[data-plus]","plus"],["[data-detail]","detail"],["[data-ex],[data-expick]","ex"],["[data-hide-toggle]","admin"]]) {
        controls.querySelectorAll(selector).forEach(control => {
          control.style.setProperty("grid-area",area,"important");
          control.style.setProperty("position","static","important");
          control.style.setProperty("margin","0","important");
          control.style.setProperty("min-height",area === "detail" ? "28px" : "32px","important");
          control.style.setProperty("height",area === "detail" ? "28px" : "32px","important");
          control.style.setProperty("align-self",area === "detail" ? "end" : "start","important");
          if (["detail","ex","admin"].includes(area)) {
            control.style.setProperty("width","100%","important");
            control.style.setProperty("min-width","0","important");
            control.style.setProperty("max-width","100%","important");
          }
        });
      }
    }
    row.querySelectorAll("[data-plus],[data-minus]").forEach(button => {
      for (const key of ["width","min-width","max-width","height","min-height"]) button.style.setProperty(key,"32px","important");
      button.style.setProperty("padding","0","important");
      button.style.setProperty("touch-action","manipulation","important");
    });
    const title = titleOf(row);
    if (!title) return;
    for (const [key,value] of Object.entries({display:"flex","flex-wrap":"wrap","white-space":"normal","overflow":"visible","max-height":"none","min-width":"0",gap:"4px"})) title.style.setProperty(key,value,"important");
    tidyOwnedBadge(row);
    cleanTitleText(title);
    removeLegacyMeta(row);
    const skills = ensureSkillBox(row, title);
    for (const [key,value] of Object.entries({"margin-top":"auto",display:"-webkit-box","-webkit-box-orient":"vertical","-webkit-line-clamp":"2",overflow:"hidden","line-height":"1.35"})) skills.style.setProperty(key,value,"important");
    const detail = row.querySelector("[data-detail]");
    if (detail) {
      setText(detail, "詳細");
      detail.setAttribute("aria-label", "詳細");
    }
  }

  function polishAll(root = document) {
    root.querySelectorAll?.("#cardList .cardRow,#deckList .cardRow").forEach(polishRow);
  }

  function boot() {
    injectStyle();
    polishAll();
    const observer = new MutationObserver((records) => {
      const added = records.some((r) => [...r.addedNodes].some((n) => n instanceof Element && (n.matches?.(".cardRow") || n.querySelector?.(".cardRow"))));
      if (added) requestAnimationFrame(() => polishAll());
    });
    [document.getElementById("cardList"), document.getElementById("deckList")].filter(Boolean)
      .forEach((el) => observer.observe(el, { childList:true, subtree:true }));
    window.addEventListener("pageshow", () => requestAnimationFrame(() => polishAll()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
