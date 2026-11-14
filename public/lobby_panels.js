// Independent of network/auth boot: both panels remain operable while loading.
(() => {
  "use strict";
  for (const button of document.querySelectorAll(".lobbyPanelToggle")) {
    const content = document.getElementById(button.getAttribute("aria-controls"));
    if (!content || button.dataset.panelBound === "1") continue;
    button.dataset.panelBound = "1";
    const label = button.dataset.panelLabel || "パネル";
    const key = `0bato:lobby:${content.id}:collapsed`;
    function setCollapsed(collapsed) {
      content.hidden = collapsed;
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", `${label}を${collapsed ? "最大化" : "最小化"}`);
      button.textContent = collapsed ? "□ 最大化" : "− 最小化";
    }
    let collapsed = false;
    try { collapsed = sessionStorage.getItem(key) === "1"; } catch {}
    setCollapsed(collapsed);
    button.addEventListener("click", () => {
      const next = !content.hidden;
      setCollapsed(next);
      try { sessionStorage.setItem(key, next ? "1" : "0"); } catch {}
    });
  }
})();
