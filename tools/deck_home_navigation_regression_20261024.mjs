// V5.1 mobile: home taps before module initialization and non-destructive deck clear UX.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const homeHtml = fs.readFileSync("public/index.html", "utf8");
const deckJs = fs.readFileSync("public/deck.js", "utf8");

// The mobile home badge must share the version shown by the deck editor.
const editorVersion = homeHtml.match(/id="deckVersionPill">([vV]\d+\.\d+\.\d+)<\/span>/);
const homeFallback = deckJs.match(/getElementById\("deckVersionPill"\)\?\.textContent \|\| "([vV]\d+\.\d+\.\d+)"/);
assert.ok(editorVersion && homeFallback, "home and deck version sources are present");
assert.equal(homeFallback[1].toLowerCase(), editorVersion[1].toLowerCase(),
  "standalone deck fallback must match the release");
assert.match(deckJs, /id="obHomeVersion"[^>]*>\$\{esc\(homeReleaseVersion\)\}<\/span>/,
  "visible home release badge must use the shared version");

const router = homeHtml.match(/<script id="obHomeNavigationGuardV5">([\s\S]*?)<\/script>/);
assert.ok(router, "early home router installed in HTML head");
assert.doesNotMatch(homeHtml, /id="directPlayNavigation20261014"/);
assert.doesNotMatch(homeHtml, /id="legacyHomeNavigationFallback20261021"/);
assert.ok(homeHtml.indexOf(router[0]) < homeHtml.indexOf('src="./deck.js'), "router is available before deck module");

const listeners = { document: new Map(), window: new Map() };
const navigations = [];
const timers = [];
class Target {
  constructor(action) { this.action = action; }
  closest(selector) { return selector === "#deckStart [data-home-action]" ? this : null; }
  matches() { return false; }
  getAttribute(name) { return name === "data-home-action" ? this.action : ""; }
}
const classes = new Set();
const home = {
  classList: {
    add: key => classes.add(key),
    remove: key => classes.delete(key),
  },
  setAttribute(name, val) { this[name] = val; },
  remove() { this.removed = true; },
};
const location = { href: "https://tcg-0bato.web.app/index.html?room=4371&player=a1", assign: url => navigations.push(url) };
const context = {
  URL, Element: Target,
  document: {
    baseURI: "https://tcg-0bato.web.app/index.html",
    addEventListener: (key, cb, capture) => {
      assert.equal(capture, true, "home router is capture-phase");
      listeners.document.set(key, cb);
    },
    getElementById: id => id === "deckStart" ? home : null,
  },
  window: { location, addEventListener: (key, cb) => listeners.window.set(key, cb) },
  setTimeout(fn, delay) { timers.push({ fn, delay }); },
};
new Function(router[1]); // compile
vm.runInNewContext(router[1], context);

function press(action, type = "click", key = "") {
  const event = {
    type, key, target: new Target(action), prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  const listener = listeners.document.get(type);
  assert.equal(typeof listener, "function");
  listener(event);
  return event;
}

let event = press("deck");
assert.equal(event.prevented, true);
assert.equal(event.stopped, true);
assert.ok(classes.has("hide"), "early deck tap dismisses home, rather than redirects to deck.html");
assert.equal(navigations.length, 0);
for (const task of timers.splice(0)) task.fn();
assert.equal(home.removed, true);

event = press("gacha");
assert.equal(event.prevented, true);
assert.equal(navigations[0], "https://tcg-0bato.web.app/gacha.html");
press("user");
assert.equal(navigations.length, 1, "double-tap must not navigate twice");
listeners.window.get("pageshow")();
event = press("settings");
assert.ok(navigations.at(-1).includes("deck_list.html?mode=my"), "deck-list route");
assert.ok(navigations.at(-1).includes("room=4371"), "retain room code");
listeners.window.get("pageshow")();
event = press("login");
assert.match(navigations.at(-1), /login\.html\?return=%2Findex\.html/, "login returns to current route");
listeners.window.get("pageshow")();
event = press("play", "keydown", "Enter");
assert.equal(event.prevented, true);
assert.ok(navigations.at(-1).endsWith("/play.html"));
listeners.window.get("pageshow")();
event = press("beginner");
assert.equal(event.prevented, false, "local beginner menu must retain its native handler");

assert.match(deckJs, /function ensureDeckDangerActions\(\)/);
assert.match(deckJs, /controls = document\.createElement\("details"\)/);
assert.match(deckJs, /controls\.appendChild\(clearBtn\)/, "button is moved, not copied");
assert.match(deckJs, /ensureDeckDangerActions\(\);/, "workbench moves button");
assert.doesNotMatch(deckJs, /"title count clear min"/, "header no longer reserves a clear column");
assert.doesNotMatch(deckJs, /"clear clear"/, "mobile header no longer reserves a clear row");

const start = deckJs.indexOf("function ensureDeckDangerActions()");
const end = deckJs.indexOf("function setupDeckPanelWorkbench()", start);
const layoutSource = deckJs.slice(start, end);
assert.ok(start >= 0 && end > start, "move function isolated");

const nodes = new Map();
class Node {
  constructor(type) { this.type = type; this.children = []; this.parentElement = null; this.id = ""; }
  appendChild(child) {
    if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(x => x !== child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
}
const head = new Node("head");
const body = new Node("div");
const originalHeader = new Node("header");
const clearButton = new Node("button");
clearButton.id = "btnClearDeck";
originalHeader.appendChild(clearButton);
nodes.set("btnClearDeck", clearButton);
const dom = {
  head,
  getElementById: key => key === "btnClearDeck" ? clearButton : (key === "deckDangerActions" ? body.children.find(x => x.id === key) || null : head.children.find(x => x.id === key) || null),
  querySelector: selector => selector === "#deckInfoDock .deckInfoBody" ? body : null,
  createElement: name => new Node(name),
};
const layCtx = { document: dom };
vm.runInNewContext(layoutSource + "\nensureDeckDangerActions(); ensureDeckDangerActions();", layCtx);
assert.equal(body.children.length, 1, "collapsed maintenance panel created only once");
const details = body.children[0];
assert.equal(details.type, "details");
assert.equal(details.children[0], clearButton, "original clear button is moved from header");
assert.equal(originalHeader.children.length, 0);
assert.equal(head.children.length, 1, "style is installed once");
assert.equal(clearButton.textContent, "編集中のカードを全消し");

const clearStart = deckJs.indexOf("function clearDeck() {");
const clearEnd = deckJs.indexOf("// ===== EX =====", clearStart);
assert.ok(clearStart >= 0 && clearEnd > clearStart);
const events = [];
let permitted = false;
const clearContext = {
  deckMap: { a: 3 }, selectedExSupportId: "ex-a",
  sumDeck: value => Object.values(value).reduce((a,b)=>a+Number(b||0),0),
  document: { getElementById: id => id === "deckDangerActions" ? { removeAttribute: () => events.push("close") } : null },
  window: { confirm: () => { events.push("confirm"); return permitted; } },
  saveSelectedEx: value => events.push("ex:" + value),
  saveLocalDeck: () => events.push("save"),
  renderAll: () => events.push("render"),
  setMsg: () => {},
  setTimeout: () => {},
};
const clear = vm.runInNewContext(deckJs.slice(clearStart,clearEnd) + "\nclearDeck", clearContext);
clear();
assert.equal(clearContext.deckMap.a, 3, "cancel leaves deck untouched");
assert.deepEqual(events, ["confirm"]);
permitted = true;
clear();
assert.deepEqual(Object.keys(clearContext.deckMap), []);
assert.equal(clearContext.selectedExSupportId, "");
assert.deepEqual(events, ["confirm", "confirm", "close", "ex:", "save", "render"]);
clear();
assert.equal(events.filter(x=>x==="confirm").length, 2, "empty deck does not prompt");
console.log("PASS: early home navigation, double-tap lock, safe deck tab, relocated clear with confirmation.");
