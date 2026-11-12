import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("public/deck_boot_20261112.js", "utf8");
function harness() {
  const listeners = new Map(), timers = new Map(), frames = [], images = [];
  let timerId = 0;
  const node = () => ({ dataset:{}, hidden:false, textContent:"", children:[],
    setAttribute() {}, addEventListener() {},
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
  });
  const main = node(), root = node(), body = node();
  const window = { addEventListener(name, fn) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
  }, dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); } };
  const document = { documentElement:root, head:node(), body, hidden:false,
    createElement:node, querySelector:selector => selector === "main" ? main : null,
    addEventListener:window.addEventListener,
  };
  const context = { window, document, navigator:{ hardwareConcurrency:8 },
    location:{ reload() {} }, CustomEvent:class { constructor(type) { this.type = type; } },
    Image:class { constructor() { images.push(this); } decode() { return Promise.resolve(); } },
    requestAnimationFrame(fn) { frames.push(fn); },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(source, context);
  const flush = async () => {
    for (let i = 0; i < 12; i++) {
      await Promise.resolve();
      for (const fn of frames.splice(0)) fn();
      for (const [id, t] of [...timers]) if (t.delay <= 200) { timers.delete(id); t.fn(); }
    }
  };
  return { api:window.TCG_DECK_BOOT, root, main, body, window, images, timers, flush,
    runtime() { root.dataset.deckRuntimeReady = "true"; window.dispatchEvent({type:"tcg:deck-runtime-ready"}); },
    message() { return body.children[0].children[1].textContent; },
  };
}

// DOM/page loads and an arbitrary completed request cannot declare app readiness.
{
  const h = harness();
  h.window.dispatchEvent({type:"load"});
  await h.api.step("通信", async () => "response");
  await h.flush();
  assert.equal(h.api.state, "loading");
  assert.equal(h.main.inert, true);
  assert.notEqual(h.message(), "準備完了");
  h.api.complete();
  await h.flush();
  assert.equal(h.api.state, "loading", "late UI/runtime handlers are still missing");
  h.runtime();
  await h.flush();
  assert.equal(h.api.state, "ready");
  assert.equal(h.main.inert, false);
}

// Decoding the chosen image must finish even when data and controls finished earlier.
{
  const h = harness();
  h.api.asset("mascot.png");
  h.api.asset("mascot.png");
  assert.equal(h.images.length, 1, "one image load shared by artwork and afterimage");
  h.runtime(); h.api.complete(); await h.flush();
  assert.equal(h.api.state, "loading");
  await h.images[0].onload(); await h.flush();
  assert.equal(h.api.state, "ready");
  assert.equal(h.message(), "準備完了");
}

// Layout helpers can still be downloading after both application data and runtime entry loaded.
{
  const h = harness();
  let resolveLayout;
  h.window.TCG_DECK_LAYOUT_READY = new Promise(resolve => { resolveLayout = resolve; });
  h.runtime(); h.api.complete(); await h.flush();
  assert.equal(h.api.state, "loading", "async layout scripts must also finish");
  resolveLayout(); await h.flush();
  assert.equal(h.api.state, "ready");
}

// Data/initialization errors remain errors even if late assets/runtime subsequently load.
{
  const h = harness();
  await assert.rejects(h.api.step("カード読込", () => Promise.reject(new Error("network"))));
  h.runtime(); h.api.complete(); await h.flush();
  assert.equal(h.api.state, "error");
  assert.equal(h.main.inert, true);
  assert.notEqual(h.message(), "準備完了");
}

// Decorative image failures must not permanently lock a functioning editor.
{
  const h = harness();
  h.api.asset("missing.png"); h.runtime(); h.api.complete();
  h.images[0].onerror(); await h.flush();
  assert.equal(h.api.state, "ready");
  assert.match(h.message(), /画像を読み込めません/);
  assert.equal(h.main.inert, false);
}

// Slow initialization exposes retry, with no timer-based success.
{
  const h = harness();
  for (const [id, t] of [...h.timers]) if (t.delay === 15000) { h.timers.delete(id); t.fn(); }
  await h.flush();
  assert.equal(h.api.state, "loading");
  assert.equal(h.body.children[0].children[2].hidden, false);
}

// Re-running the metrics observer without a deck change must produce no DOM writes.
{
  const js = fs.readFileSync("public/ui_stability_20260825.js", "utf8");
  const fn = js.slice(js.indexOf("  function updateDeckMetrics()"), js.indexOf("  function installMetricObserver()"));
  const elements = new Map(); let writes = 0;
  const $ = id => {
    if (!elements.has(id)) {
      let text = id === "#deckCount" ? "0" : "";
      elements.set(id, { get textContent() { return text; }, set textContent(value) { text = value; writes++; } });
    }
    return elements.get(id);
  };
  const context = { $, $$:() => [], classifyRow:() => "unit" };
  vm.runInNewContext(fn + "\nupdateDeckMetrics();", context);
  writes = 0;
  vm.runInNewContext("updateDeckMetrics();", context);
  assert.equal(writes, 0, "self-observation must settle instead of rescanning every frame");
}
// CSS insertion must be one-time: identical stylesheet writes triggered a page-wide loop.
{
  const js = fs.readFileSync("public/deck_mobile_density_20261003.js", "utf8");
  const fn = js.slice(js.indexOf("  function injectStyle()"), js.indexOf("  function normalizeHeader()"));
  const nodes = new Map(); let writes = 0;
  const context = { STYLE_ID:"density", BODY_CLASS:"mobile", $:id => nodes.get(id),
    document:{ head:{ appendChild(el) { nodes.set(el.id, el); } },
      createElement() { return { set textContent(value) { writes++; } }; } },
  };
  vm.runInNewContext(fn + "\ninjectStyle();", context);
  assert.equal(writes, 1);
  vm.runInNewContext("injectStyle();injectStyle();", context);
  assert.equal(writes, 1, "re-running layout must not mutate the stylesheet");
}
// Finishing a network request must never announce the application's readiness.
{
  const js = fs.readFileSync("public/global_experience_20261005.js", "utf8");
  const fn = js.slice(js.indexOf("  function end()"), js.indexOf("  function showError("));
  let hidden = false;
  vm.runInNewContext(fn + "\nend();", {
    activeCount:1, root:{ dataset:{ tcgNetState:"loading" } }, showTimer:0, longTimer:0,
    clearTimeout() {}, hideStatus() { hidden = true; },
    setState() { assert.fail("a finished request must not emit a ready/success notification"); },
  });
  assert.equal(hidden, true);
}
console.log("PASS: explicit boot readiness, pending assets/runtime, failure, image fallback, slow retry, stable metrics and CSS");
