(() => {
  "use strict";
  const STYLE_ID = "deckMobileCardLayout7Style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
@media (max-width:900px), (pointer:coarse) and (max-width:1180px) {
  /* カードを「丸い箱の集合」にせず、フラットな3行表示に固定する。 */
  #cardList .cardRow,
  #deckList .cardRow {
    display:grid!important;
    grid-template-columns:minmax(0,1fr) 108px!important;
    align-items:start!important;
    gap:8px!important;
    width:100%!important;
    min-width:0!important;
    min-height:92px!important;
    height:auto!important;
    margin:0!important;
    padding:9px 8px 9px 10px!important;
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

  /* 1行目: 【マナ】名前 ×枚数 HP/SP */
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
    row-gap:2px!important;
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
    text-overflow:clip!important;
  }

  /* 属性・シリーズ・種別・ロールは一覧では出さない。 */
  #cardList .attrBadge,#deckList .attrBadge,
  #cardList .seriesBadge,#deckList .seriesBadge,
  #cardList .deckRoleTags,#deckList .deckRoleTags,
  #cardList .kindBadge,#deckList .kindBadge,
  #cardList .typeBadge,#deckList .typeBadge {
    display:none!important;
  }

  /* 枚数 / HP / SP はチップにしない。文字だけ。 */
  #cardList .ownedBadge,#deckList .ownedBadge,
  #cardList .mobileInlineStats,#deckList .mobileInlineStats {
    display:inline!important;
    flex:0 0 auto!important;
    min-height:0!important;
    height:auto!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    background:none!important;
    box-shadow:none!important;
    color:rgba(255,255,255,.78)!important;
    font-size:11.5px!important;
    font-weight:750!important;
    line-height:1.35!important;
    white-space:nowrap!important;
    writing-mode:horizontal-tb!important;
  }
  #cardList .ownedBadge,#deckList .ownedBadge { color:rgba(255,255,255,.70)!important; }
  #cardList .mobileInlineStats,#deckList .mobileInlineStats { color:rgba(190,226,255,.88)!important; }

  /* 元の HP/SP・種別・行動要約は完全に隠す。重複表示を許さない。 */
  #cardList .cardRow .sub,
  #deckList .cardRow .sub,
  #cardList .cardRow .small,
  #deckList .cardRow .small,
  #cardList .cardRow .cardMeta,
  #deckList .cardRow .cardMeta {
    display:none!important;
  }

  /* 2〜3行目: 行動1 / 行動2、サポートだけ効果。 */
  #cardList .mobileSkillLines,
  #deckList .mobileSkillLines {
    display:block!important;
    width:100%!important;
    min-width:0!important;
    margin:5px 0 0!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    background:none!important;
    color:rgba(255,255,255,.72)!important;
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

  /* 操作部もピルを廃止。 */
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
  #cardList .cardRow [data-plus],#deckList .cardRow [data-plus] {
    width:100%!important;
    min-width:0!important;
    height:30px!important;
    min-height:30px!important;
    padding:0!important;
    border-radius:2px!important;
    background:rgba(255,255,255,.035)!important;
    box-shadow:none!important;
    font-size:12px!important;
    line-height:1!important;
  }
  #cardList .cardRow .count,#deckList .cardRow .count,
  #cardList .cardRow .cnt,#deckList .cardRow .cnt {
    width:100%!important;
    min-width:0!important;
    height:30px!important;
    min-height:30px!important;
    padding:0!important;
    border:0!important;
    border-radius:0!important;
    background:none!important;
    box-shadow:none!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:11px!important;
    white-space:nowrap!important;
  }
  #cardList .cardRow [data-detail],
  #deckList .cardRow [data-detail] {
    width:100%!important;
    min-width:0!important;
    height:31px!important;
    min-height:31px!important;
    margin:0!important;
    padding:0 4px!important;
    border-radius:2px!important;
    background:rgba(255,255,255,.035)!important;
    box-shadow:none!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:11.5px!important;
    font-weight:850!important;
    letter-spacing:0!important;
    line-height:1!important;
    white-space:nowrap!important;
    word-break:keep-all!important;
    writing-mode:horizontal-tb!important;
    overflow:hidden!important;
    text-overflow:clip!important;
  }
}
`;
    document.head.appendChild(style);
  }

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function titleOf(row) {
    return row.querySelector(":scope > .name, .cardHead > div:first-child > b, :scope > div:first-child > .name");
  }

  function tidyOwnedBadge(row) {
    const badge = row.querySelector(".ownedBadge");
    if (!badge) return;
    const text = String(badge.textContent || "").trim();
    const m = text.match(/(?:所持|枚数)?\s*[×x]?\s*(\d+)/i);
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
      if (node.textContent !== t) node.textContent = t;
    });
  }

  function ensureSkillBox(row, title) {
    let box = row.querySelector(".mobileSkillLines");
    if (box) return box;
    box = document.createElement("div");
    box.className = "mobileSkillLines";
    const host = title?.parentElement || row.firstElementChild || row;
    host.appendChild(box);
    return box;
  }

  function fallbackStats(row) {
    const texts = [...row.querySelectorAll(".sub,.small,.cardMeta")]
      .map((el) => String(el.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    for (const s of texts) {
      const hp = s.match(/HP\s*[:：]\s*([^\s/]+)/i)?.[1];
      const sp = s.match(/SP\s*[:：]\s*([^\s/]+)/i)?.[1];
      if (hp || sp) return [hp ? `HP:${hp}` : "", sp ? `SP:${sp}` : ""].filter(Boolean).join(" ");
    }
    return "";
  }

  function polishRow(row) {
    if (!(row instanceof HTMLElement)) return;
    const title = titleOf(row);
    if (!title) return;
    tidyOwnedBadge(row);
    cleanTitleText(title);

    let stat = title.querySelector(".mobileInlineStats");
    const stats = fallbackStats(row);
    if (stats && !stat) {
      stat = document.createElement("span");
      stat.className = "mobileInlineStats";
      stat.textContent = stats;
      title.appendChild(stat);
    }

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

  function addedCardRow(records) {
    return records.some((record) => [...record.addedNodes].some((node) => {
      if (!(node instanceof Element)) return false;
      return node.matches?.(".cardRow") || !!node.querySelector?.(".cardRow");
    }));
  }

  function boot() {
    injectStyle();
    polishAll();
    const observer = new MutationObserver((records) => {
      if (!addedCardRow(records)) return;
      requestAnimationFrame(() => polishAll());
    });
    [document.getElementById("cardList"), document.getElementById("deckList")]
      .filter(Boolean)
      .forEach((el) => observer.observe(el, { childList:true, subtree:true }));
    window.addEventListener("pageshow", () => requestAnimationFrame(() => polishAll()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
  else boot();
})();
