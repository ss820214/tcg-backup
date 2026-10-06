(() => {
  "use strict";
  const STYLE_ID = "deckMobileCardLayout8Style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  #cardList .cardRow,
  #deckList .cardRow {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 108px!important;
    align-items:start!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
    min-height:86px!important;
    height:auto!important;
    margin:0!important;
    padding:8px 8px 8px 10px!important;
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
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
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
    width:108px!important;
    min-width:108px!important;
    max-width:108px!important;
    display:grid!important;
    grid-template-columns:30px 40px 30px!important;
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
    height:30px!important;
    min-height:30px!important;
    padding:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
  }
  #cardList .cardRow [data-detail],#deckList .cardRow [data-detail] {
    width:100%!important;
    height:31px!important;
    min-height:31px!important;
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
    const title = titleOf(row);
    if (!title) return;
    tidyOwnedBadge(row);
    cleanTitleText(title);
    removeLegacyMeta(row);
    ensureSkillBox(row, title);
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
