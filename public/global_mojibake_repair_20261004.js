(() => {
  "use strict";

  const VERSION = "20261004_mojifix1";
  const AGGRESSIVE_PAGES = new Set(["profile.html", "gacha.html", "arcade.html", "creator.html"]);
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const aggressive = AGGRESSIVE_PAGES.has(page);
  let reverseMap = null;
  let scheduled = false;

  function buildReverseMap() {
    if (reverseMap) return reverseMap;
    const map = new Map();
    let decoder;
    try {
      decoder = new TextDecoder("shift_jis");
    } catch {
      reverseMap = map;
      return map;
    }

    const add = (bytes) => {
      const value = decoder.decode(Uint8Array.from(bytes));
      if (!value || value.includes("�") || map.has(value)) return;
      map.set(value, bytes);
    };

    for (let b = 0; b <= 0x7f; b += 1) add([b]);
    for (let b = 0xa1; b <= 0xdf; b += 1) add([b]);
    const leads = [];
    for (let b = 0x81; b <= 0x9f; b += 1) leads.push(b);
    for (let b = 0xe0; b <= 0xfc; b += 1) leads.push(b);
    for (const lead of leads) {
      for (let trail = 0x40; trail <= 0xfc; trail += 1) {
        if (trail === 0x7f) continue;
        add([lead, trail]);
      }
    }

    reverseMap = map;
    return map;
  }

  function suspiciousScore(value) {
    const text = String(value || "");
    const classic = (text.match(/[繧繝縺蜿謇螟荳譁驟遒邇窶莠逕蟇蜊闔髣驪螻謗蛯]/g) || []).length;
    const halfwidth = (text.match(/[\uFF61-\uFF9F]/g) || []).length;
    const oddScript = (text.match(/[эЁё]/g) || []).length;
    const brokenTag = (text.match(/\/(?:h[1-6]|div|span|label|option|button|b|p)>/gi) || []).length * 2;
    return classic + halfwidth + oddScript * 2 + brokenTag;
  }

  function clean(value) {
    return String(value || "")
      .replace(/\/(?:h[1-6]|div|span|label|option|button|b|p|section|header|small)>/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function encodeBack(value) {
    const map = buildReverseMap();
    if (!map.size) return null;
    const bytes = [];
    for (const ch of String(value || "")) {
      const code = ch.codePointAt(0);
      if (code <= 0x7f) {
        bytes.push(code);
        continue;
      }
      const mapped = map.get(ch);
      if (!mapped) return null;
      bytes.push(...mapped);
    }
    return bytes;
  }

  function recover(value) {
    const original = String(value || "");
    if (!original || /^[\x00-\x7f]*$/.test(original)) return original;
    if (!aggressive && suspiciousScore(original) < 2) return original;

    try {
      const bytes = encodeBack(original);
      if (!bytes) return original;
      const decoded = clean(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)));
      if (!decoded || decoded === original) return original;
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(decoded)) return original;
      if (decoded.length > original.length * 2 + 8) return original;

      if (aggressive) {
        // Known-broken legacy pages: a successful Shift_JIS->UTF-8 reversal is strong evidence.
        if (/[\u3040-\u30ff\u3400-\u9fff]/.test(decoded)) return decoded;
        return original;
      }

      return suspiciousScore(decoded) + 1 < suspiciousScore(original) ? decoded : original;
    } catch {
      return original;
    }
  }

  function repair(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,noscript,textarea,pre,code")) return NodeFilter.FILTER_REJECT;
        const text = String(node.nodeValue || "");
        if (!text.trim()) return NodeFilter.FILTER_REJECT;
        if (!aggressive && suspiciousScore(text) < 2) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const next = recover(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }

    document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => {
      for (const name of ["placeholder", "title", "aria-label"]) {
        const value = el.getAttribute(name);
        if (!value) continue;
        if (!aggressive && suspiciousScore(value) < 2) continue;
        const next = recover(value);
        if (next !== value) el.setAttribute(name, next);
      }
    });

    const fixedTitle = recover(document.title);
    if (fixedTitle !== document.title) document.title = fixedTitle;
    document.documentElement.dataset.mojibakeRepair = VERSION;
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      repair();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", repair, { once: true });
  else repair();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.TCG_MOJIBAKE_REPAIR = { version: VERSION, recover, refresh: repair };
  console.log("[mojibake_repair] ready", VERSION, aggressive ? "aggressive" : "safe");
})();
