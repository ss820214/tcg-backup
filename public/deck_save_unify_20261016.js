(() => {
  "use strict";
  const style = document.createElement("style");
  style.textContent = `
    /* Keep the single cloud save action visible, without duplicate save buttons. */
    #deckPanelActions [data-deck-panel-action="save"],
    #deckLibModeSave,
    #deckLibUploadNew { display:none !important; }
    #deckSaveDock .deckSaveRow #btnSave { display:inline-flex !important; min-height:46px !important; align-items:center; justify-content:center; }
    #deckSaveDock .deckSaveRow #btnSave { width:100% !important; }
    @media (min-width:861px) {
      /* Same card stats and skill presentation as mobile, without changing layout columns. */
      #cardList .cardRow .mobileInlineStats,
      #deckList .cardRow .mobileInlineStats { display:inline-flex !important; gap:5px !important; margin-left:8px !important; font-weight:700 !important; }
      #cardList .cardRow .mobileSkillLines,
      #deckList .cardRow .mobileSkillLines { display:grid !important; gap:5px !important; margin-top:7px !important; white-space:normal !important; }
      #cardList .cardRow .mobileSkillLine,
      #deckList .cardRow .mobileSkillLine { display:block !important; line-height:1.5 !important; overflow-wrap:anywhere !important; font-size:13px !important; }
    }
  `;
  document.head.appendChild(style);
  function update() {
    const newSave = document.getElementById("deckLibUploadNew");
    if (newSave && newSave.textContent.trim() !== "保存") newSave.textContent = "保存";
    const mode = document.getElementById("deckLibModeSave");
    if (mode) mode.setAttribute("aria-hidden", "true");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", update, {once:true});
  else update();
  // Watch only the save UI when present; avoid a document-wide observer on every card redraw.
  const saveHost = document.getElementById("deckSaveDock") || document.getElementById("deckPanel");
  if (saveHost) {
    let queued = false;
    const mo = new MutationObserver(() => {
      const button = document.getElementById("deckLibUploadNew");
      if (!button || button.textContent.trim() === "保存" || queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; update(); });
    });
    mo.observe(saveHost, {childList:true,subtree:true});
    window.addEventListener("pagehide", () => mo.disconnect(), {once:true});
  }
})();