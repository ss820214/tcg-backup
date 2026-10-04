(() => {
  "use strict";

  const VERSION = "20261004_spark1";
  const STYLE_ID = "tcgPressSparkStyle20261004";
  const TARGET_SELECTOR = [
    "button",
    "a[href]",
    "[role='button']",
    "[data-home-action]",
    "[data-plus]",
    "[data-minus]",
    "[data-detail]",
    "[data-ex]",
    "[data-expick]",
  ].join(",");

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .tcgPressSpark {
        --spark-size: 42px;
        position: fixed;
        left: var(--spark-x);
        top: var(--spark-y);
        width: var(--spark-size);
        height: var(--spark-size);
        margin-left: calc(var(--spark-size) / -2);
        margin-top: calc(var(--spark-size) / -2);
        z-index: 2147483000;
        pointer-events: none;
        contain: layout paint style;
        filter: drop-shadow(0 0 5px rgba(115,225,255,.72));
      }
      .tcgPressSparkCore {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        transform: translate(-50%,-50%);
        border: 1px solid rgba(235,252,255,.95);
        background: rgba(150,235,255,.90);
        box-shadow:
          0 0 7px rgba(120,225,255,.95),
          0 0 15px rgba(120,225,255,.45);
        animation: tcgPressSparkCore .34s ease-out forwards;
      }
      .tcgPressSparkRing {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid rgba(205,248,255,.88);
        transform: translate(-50%,-50%) scale(.35);
        opacity: .95;
        animation: tcgPressSparkRing .38s cubic-bezier(.16,.72,.2,1) forwards;
      }
      .tcgPressSparkRay {
        --ray-angle: 0deg;
        --ray-distance: 13px;
        position: absolute;
        left: 50%;
        top: 50%;
        width: 2px;
        height: 8px;
        margin-left: -1px;
        margin-top: -4px;
        border-radius: 999px;
        transform-origin: 50% 50%;
        transform: rotate(var(--ray-angle)) translateY(-3px) scaleY(.35);
        background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(105,220,255,.12));
        box-shadow: 0 0 5px rgba(125,230,255,.82);
        opacity: 0;
        animation: tcgPressSparkRay .34s ease-out forwards;
      }
      .tcgPressSparkRay:nth-child(3n) {
        height: 6px;
        background: linear-gradient(180deg, rgba(235,255,190,.98), rgba(180,255,100,.08));
        box-shadow: 0 0 5px rgba(200,255,120,.66);
      }
      @keyframes tcgPressSparkCore {
        0% { opacity: 0; transform: translate(-50%,-50%) scale(.35); }
        24% { opacity: 1; transform: translate(-50%,-50%) scale(1.18); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(.35); }
      }
      @keyframes tcgPressSparkRing {
        0% { opacity: .95; transform: translate(-50%,-50%) scale(.3); }
        100% { opacity: 0; transform: translate(-50%,-50%) scale(2.1); }
      }
      @keyframes tcgPressSparkRay {
        0% {
          opacity: 0;
          transform: rotate(var(--ray-angle)) translateY(-2px) scaleY(.2);
        }
        22% { opacity: 1; }
        100% {
          opacity: 0;
          transform: rotate(var(--ray-angle)) translateY(calc(var(--ray-distance) * -1)) scaleY(.75);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .tcgPressSparkRay { display:none !important; }
        .tcgPressSparkRing { animation-duration:.18s !important; }
        .tcgPressSparkCore { animation-duration:.18s !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function actionableFrom(node) {
    const el = node?.closest?.(TARGET_SELECTOR);
    if (!el) return null;
    if (el.matches("button:disabled,[disabled],[aria-disabled='true']")) return null;
    if (el.closest("[inert]")) return null;
    return el;
  }

  function centerOf(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function sparkAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    injectStyle();

    const root = document.createElement("span");
    root.className = "tcgPressSpark";
    root.setAttribute("aria-hidden", "true");
    root.style.setProperty("--spark-x", `${Math.round(x)}px`);
    root.style.setProperty("--spark-y", `${Math.round(y)}px`);

    const core = document.createElement("i");
    core.className = "tcgPressSparkCore";
    root.appendChild(core);

    const ring = document.createElement("i");
    ring.className = "tcgPressSparkRing";
    root.appendChild(ring);

    const rayCount = 7;
    const angleOffset = Math.random() * 18;
    for (let i = 0; i < rayCount; i += 1) {
      const ray = document.createElement("i");
      ray.className = "tcgPressSparkRay";
      ray.style.setProperty("--ray-angle", `${angleOffset + (360 / rayCount) * i}deg`);
      ray.style.setProperty("--ray-distance", `${11 + Math.random() * 7}px`);
      root.appendChild(ray);
    }

    document.body.appendChild(root);
    window.setTimeout(() => root.remove(), 460);
  }

  function handlePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const target = actionableFrom(event.target);
    if (!target) return;
    sparkAt(event.clientX, event.clientY);
  }

  function handleKeyboardClick(event) {
    // Pointer-generated click already got its spark on pointerdown.
    if (event.detail !== 0) return;
    const target = actionableFrom(event.target);
    if (!target) return;
    const pos = centerOf(target);
    sparkAt(pos.x, pos.y);
  }

  function install() {
    injectStyle();
    if (document.documentElement.dataset.pressSparkBound === VERSION) return;
    document.documentElement.dataset.pressSparkBound = VERSION;
    document.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: true });
    document.addEventListener("click", handleKeyboardClick, { capture: true, passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  window.TCG_PRESS_SPARK = {
    version: VERSION,
    fire(x, y) { sparkAt(Number(x), Number(y)); },
  };

  console.log("[press_spark] ready", VERSION);
})();
