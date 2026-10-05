(() => {
  "use strict";
  const STYLE_ID = "deckMobileCardLayout5Style";
  const ROW_MARK = "deckCardLayout5Ready";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  #cardList .cardRow,
  #deckList .cardRow {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 126px!important;
    align-items:start!important;
    gap:8px!important;
    min-height:112px!important;
    height:auto!important;
    padding:10px!important;
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
  #cardList .cardRow .cardHead > div:first-child > b,
  #deckList .cardRow .cardHead > div:first-child > b {
    display:flex!important;
    align-items:center!important;
    justify-content:flex-start!important;
    flex-wrap:wrap!important;
    gap:5px!important;
    width:100%!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
    text-align:left!important;
    font-size:13px!important;
    line-height:1.35!important;
    white-space:normal!important;
    overflow:visible!important;
  }

  /* 属性・入手ジャンルは一覧では省き、枚数とHP/SPを優先する。 */
  #cardList .attrBadge,
  #deckList .attrBadge,
  #cardList .seriesBadge,
  #deckList .seriesBadge,
  #cardList .deckRoleTags,
  #deckList .deckRoleTags {
    display:none!important;
  }

  #cardList .ownedBadge,
  #deckList .ownedBadge,
  #cardList .mobileInlineStats,
  #deckList .mobileInlineStats {
    display:inline-flex!important;
    align-items:center!important;
    flex:0 0 auto!important;
    min-height:24px!important;
    padding:2px 7px!important;
    border-radius:999px!important;
    border:1px solid rgba(255,255,255,.16)!important;
    background:rgba(255,255,255,.055)!important;
    color:rgba(255,255,255,.9)!important;
    font-size:10.5px!important;
    font-weight:850!important;
    line-height:1!important;
    white-space:nowrap!important;
    writing-mode:horizontal-tb!important;
  }
  #cardList .mobileInlineStats,
  #deckList .mobileInlineStats {
    border-color:rgba(112,198,255,.30)!important;
    background:rgba(65,150,210,.11)!important;
  }

  /* 2〜3行目は技・効果の表示場所として固定。 */
  #cardList .mobileSkillLines,
  #deckList .mobileSkillLines {
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:2!important;
    overflow:hidden!important;
    width:100%!important;
    min-width:0!important;
    margin:7px 0 0!important;
    padding:0!important;
    color:rgba(255,255,255,.72)!important;
    font-size:10.5px!important;
    line-height:1.48!important;
    text-align:left!important;
    white-space:normal!important;
  }
  #cardList .cardRow .sub:not(.mobileSkillLines),
  #deckList .cardRow .sub:not(.mobileSkillLines),
  #cardList .cardRow .small:not(.mobileSkillLines),
  #deckList .cardRow .small:not(.mobileSkillLines) {
    display:none!important;
  }

  /* 操作は右上に固定。詳細は1文字も重ねない。 */
  #cardList .cardRow .btns,
  #deckList .cardRow .btns,
  #cardList .cardRow .cardCtrl,
  #deckList .cardRow .cardCtrl {
    align-self:start!important;
    width:126px!important;
    min-width:126px!important;
    max-width:126px!important;
    display:grid!important;
    grid-template-columns:36px 46px 36px!important;
    grid-template-areas:"minus count plus" "detail detail detail" "ex ex ex" "admin admin admin"!important;
    gap:5px 4px!important;
    align-content:start!important;
    justify-content:end!important;
    margin:0!important;
    padding:0!important;
  }
  #cardList .cardRow [data-minus],#deckList .cardRow [data-minus]{grid-area:minus!important;}
  #cardList .cardRow [data-plus],#deckList .cardRow [data-plus]{grid-area:plus!important;}
  #cardList .cardRow .count,#deckList .cardRow .count,
  #cardList .cardRow .cnt,#deckList .cardRow .cnt{grid-area:count!important;}
  #cardList .cardRow [data-detail],#deckList .cardRow [data-detail]{grid-area:detail!important;}
  #cardList .cardRow [data-ex],#deckList .cardRow [data-ex],
  #cardList .cardRow [data-expick],#deckList .cardRow [data-expick]{grid-area:ex!important;}

  #cardList .cardRow [data-minus],#deckList .cardRow [data-minus],
  #cardList .cardRow [data-plus],#deckList .cardRow [data-plus],
  #cardList .cardRow .count,#deckList .cardRow .count,
  #cardList .cardRow .cnt,#deckList .cardRow .cnt {
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:36px!important;
    min-height:36px!important;
    padding:0!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    white-space:nowrap!important;
    writing-mode:horizontal-tb!important;
    line-height:1!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  #cardList .cardRow [data-detail],
  #deckList .cardRow [data-detail] {
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:38px!important;
    min-height:38px!important;
    padding:0 8px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:12px!important;
    font-weight:900!important;
    letter-spacing:0!important;
    line-height:1!important;
    white-space:nowrap!important;
    word-break:keep-all!important;
    writing-mode:horizontal-tb!important;
    text-indent:0!important;
    text-shadow:none!important;
    overflow:hidden!important;
    text-overflow:clip!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
}
`;
    document.head.appendChild(style);
  }

  function tidyOwnedBadge(row) {
    const badge = row.querySelector(".ownedBadge");
    if (!badge) return;
    const text = String(badge.textContent || "").trim();
    const m = text.match(/(?:所持|枚数)\s*(\d+)/);
    if (m) badge.textContent = `×${m[1]}`;
  }

  function removeDuplicateAttrText(row, title) {
    const badge = row.querySelector(".attrBadge");
    const attr = String(badge?.textContent || "").trim();
    if (!attr || !title) return;
    const nodes = [...title.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE);
    const node = nodes[0];
    if (!node) return;
    const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    node.textContent = String(node.textContent || "").replace(new RegExp(`\\s+${escaped}\\s*$`), "");
  }

  function extractStats(text) {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    const hp = s.match(/HP\s*[:：]\s*([^\s/]+)/i)?.[1];
    const sp = s.match(/SP\s*[:：]\s*([^\s/]+)/i)?.[1];
    if (!hp && !sp) return "";
    return [hp ? `HP:${hp}` : "", sp ? `SP:${sp}` : ""].filter(Boolean).join(" ");
  }

  function extractSkill(text) {
    let s = String(text || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    const actionAt = s.search(/(?:行動|効果)\s*[:：]/);
    if (actionAt >= 0) s = s.slice(actionAt);
    s = s
      .replace(/^種別\s*[:：][^/]+\/?\s*/i, "")
      .replace(/HP\s*[:：]\s*[^\s/]+\s*/ig, "")
      .replace(/SP\s*[:：]\s*[^\s/]+\s*/ig, "")
      .replace(/マナ\s*[:：]\s*[^\s/]+\s*/ig, "")
      .replace(/^\s*\/\s*/, "")
      .trim();
    if (/^(?:サポート\s*\/\s*)?$/.test(s)) return "";
    return s;
  }

  function polishRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const title = row.querySelector(":scope > .name, .cardHead > div:first-child > b, :scope > div:first-child > .name");
    if (!title) return;

    tidyOwnedBadge(row);
    removeDuplicateAttrText(row, title);

    const textLines = [...row.querySelectorAll(".sub,.small")]
      .map((el) => String(el.textContent || "").trim())
      .filter(Boolean);
    const stats = textLines.map(extractStats).find(Boolean) || "";
    let stat = title.querySelector(".mobileInlineStats");
    if (stats) {
      if (!stat) {
        stat = document.createElement("span");
        stat.className = "mobileInlineStats";
        title.appendChild(stat);
      }
      stat.textContent = stats;
    } else if (stat) {
      stat.remove();
    }

    const skills = [...new Set(textLines.map(extractSkill).filter(Boolean))];
    let skillBox = row.querySelector(".mobileSkillLines");
    if (!skillBox) {
      skillBox = document.createElement("div");
      skillBox.className = "mobileSkillLines";
      const host = title.parentElement || row.firstElementChild || row;
      host.appendChild(skillBox);
    }
    skillBox.textContent = skills.length ? skills.slice(0, 2).join(" / ") : "技・効果は詳細へ";

    const detail = row.querySelector("[data-detail]");
    if (detail) {
      detail.textContent = "詳細";
      detail.setAttribute("aria-label", "詳細");
    }
    row.dataset[ROW_MARK] = "1";
  }

  function polishAll(root = document) {
    root.querySelectorAll?.("#cardList .cardRow,#deckList .cardRow").forEach(polishRow);
  }

  function boot() {
    injectStyle();
    polishAll();
    const observer = new MutationObserver((records) => {
      let needed = false;
      for (const r of records) {
        if (r.type === "childList" && r.addedNodes.length) { needed = true; break; }
      }
      if (needed) requestAnimationFrame(() => polishAll());
    });
    [document.getElementById("cardList"), document.getElementById("deckList")]
      .filter(Boolean)
      .forEach((el) => observer.observe(el, { childList:true, subtree:true }));
    window.addEventListener("pageshow", () => requestAnimationFrame(() => polishAll()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
