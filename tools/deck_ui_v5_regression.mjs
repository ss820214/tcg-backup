// V5 deck UI regression: one observer, delegated row actions, and native tab/filter contracts.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const home = fs.readFileSync("public/index.html", "utf8");
const mobile = fs.readFileSync("public/mobile_deck_block_final_20260927.js", "utf8");
const deck = fs.readFileSync("public/deck.js", "utf8");

assert.match(home, /data-native-deck-tab="cards"/);
assert.match(home, /data-native-deck-tab="deck"/);
assert.match(home, /data-ob-deck-tab/);
assert.match(home, /data-owned="owned"/);
assert.match(home, /data-owned="unowned"/);
const filterStart = home.indexOf('id="indexFilterRepairStyle"');
const filterEnd = home.indexOf("</script>", filterStart);
assert.ok(filterStart > 0 && filterEnd > filterStart, "home filter adapter exists");
const filterAdapter = home.slice(filterStart, filterEnd);
assert.doesNotMatch(filterAdapter, /new MutationObserver\(apply\)/, "filters must not rescan every card-list DOM change");
assert.doesNotMatch(filterAdapter, /row\.hidden\s*=/, "deck.js owns filtering; index.html must not hide its rows");
assert.match(filterAdapter, /owned === "unowned" \? "missing" : owned/, "owned filter adapter maps unowned");

const scripts = [...home.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
for (const [, attributes, js] of scripts) {
  if (/\bsrc\s*=/.test(attributes) || /type\s*=\s*["']application\/json/.test(attributes)) continue;
  new Function(js); // Syntax-only compile, no DOM/Firebase execution.
}

const helperStart = mobile.indexOf("/* V5: one coalesced structural observer");
const helperEnd = mobile.indexOf("/* v20260930_mobile_deck_stable2", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "shared observer helper present");
const helperSource = mobile.slice(helperStart, helperEnd);
const activeMobile = mobile.slice(helperEnd);
assert.doesNotMatch(activeMobile, /new MutationObserver/, "legacy adapters use shared observer");
assert.equal((activeMobile.match(/__tcgDeckObserveV5\(/g) || []).length, 6, "six layout subscribers retained");
assert.match(activeMobile, /closest\("\.obNativeDeckTabs, #cardList, #deckList"\)/, "tab and list clicks avoid legacy full-page rescans");

const observers = [], frames = [];
const scope = {
  window: {},
  document: { body: {} },
  console,
  requestAnimationFrame(fn) { frames.push(fn); },
  MutationObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(host, options) { this.host = host; this.options = options; }
  },
};
vm.runInNewContext(helperSource, scope);
let first = 0, second = 0;
scope.window.__tcgDeckObserveV5(() => first++);
scope.window.__tcgDeckObserveV5(() => second++);
assert.equal(observers.length, 1, "only one native observer for six adapters");
assert.equal(observers[0].options.childList, true);
assert.equal(observers[0].options.subtree, true);
assert.equal(observers[0].options.attributes, undefined);
assert.equal(observers[0].options.characterData, undefined);
const cardRow = { nodeType: 1, matches: selector => selector.includes(".cardRow") };
const other = { nodeType: 1, matches: () => false, closest: () => null, querySelector: () => null };
const change = (type, node) => [{ type, addedNodes: [node], removedNodes: [] }];
observers[0].callback(change("attributes", cardRow));
observers[0].callback(change("childList", { nodeType: 3 }));
observers[0].callback(change("childList", other));
assert.equal(frames.length, 0, "ignore text, style and unrelated DOM changes");
observers[0].callback(change("childList", cardRow));
observers[0].callback(change("childList", cardRow));
assert.equal(frames.length, 1, "batch card row changes into one layout frame");
frames.shift()();
assert.equal(first, 1);
assert.equal(second, 1);

const delegateStart = deck.indexOf("// V5: card rows are replaced for filter/deck updates");
const delegateEnd = deck.indexOf("function renderCardListNewUI() {", delegateStart);
assert.ok(delegateStart >= 0 && delegateEnd > delegateStart);
const delegate = deck.slice(delegateStart, delegateEnd);
const cardListRenderEnd = deck.indexOf("function renderCardSectionsOldUI()", delegateEnd);
const renderBody = deck.slice(delegateEnd, cardListRenderEnd);
assert.doesNotMatch(renderBody, /row\.querySelector\("\[data-(?:plus|minus|detail)\]"\)\?\.addEventListener/,
  "card rows may not bind click listeners for each render");

class FakeElement {
  constructor(name, id = "test-card") { this.name = name; this.id = id; this.disabled = false; this.isConnected = true; }
  closest(selector) {
    if (selector.startsWith("button[")) return this;
    if (selector === "[data-card-id]") return { getAttribute: () => this.id };
    return null;
  }
  getAttribute(key) { return key === "data-" + this.name ? this.id : null; }
  hasAttribute(key) { return key === "data-" + this.name; }
}
const actions = [];
let handler;
const scopeDeck = {
  Element: FakeElement,
  cardListEl: { contains: () => true, addEventListener: (type, fn) => { assert.equal(type, "click"); handler = fn; } },
  cardDefs: { "test-card": { name: "Card", hidden: false } },
  removeFromDeck: id => actions.push("minus:" + id),
  addToDeck: id => actions.push("plus:" + id),
  showCardDetail: id => actions.push("detail:" + id),
  clearExSupport: () => actions.push("ex-clear"),
  selectExSupport: id => actions.push("ex:" + id),
  selectedExSupportId: "",
  isAdminUser: () => true,
  toggleCardHidden: async (id, next) => { actions.push("hide:" + id + ":" + next); return true; },
  setMsg: () => {},
  renderAll: () => actions.push("render"),
};
vm.runInNewContext(delegate, scopeDeck);
assert.equal(typeof handler, "function", "a single delegated list handler exists");
const invoke = async (name) => {
  const button = new FakeElement(name);
  let prevented = 0;
  await handler({ target: button, preventDefault() { prevented++; }, stopPropagation() {} });
  assert.equal(prevented, 1, name + " handled");
};
await invoke("plus");
await invoke("minus");
await invoke("detail");
await invoke("expick");
await invoke("hide-toggle");
assert.deepEqual(actions, [
  "plus:test-card", "minus:test-card", "detail:test-card",
  "ex:test-card", "hide:test-card:true", "render"
]);
console.log("V5 deck UI: one relevant DOM observer, native filters/tabs and delegated actions OK.");
