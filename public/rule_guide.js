// public/rule_guide.js
// v20260823_rulebook3
(function () {
  "use strict";

  const mount = document.getElementById("ruleGuideMount");
  if (!mount) return;

  const entries = [
    {
      cat: "基本",
      title: "勝利条件",
      body: "相手キャラを3体行動不能にするか、相手陣地へ3体侵入すると勝利です。KILLとINFILのどちらを狙うかで、盤面の動かし方が変わります。",
      keys: "kill infil 破壊 侵入 勝利",
    },
    {
      cat: "基本",
      title: "マナ",
      body: "初期マナは2です。召喚、移動、技、進化で消費し、エンドフェイズで該当プレイヤーのマナが2増えます。画面では黄色いダイヤで表示します。",
      keys: "mana mp コスト エンドフェイズ 黄色 ダイヤ",
    },
    {
      cat: "基本",
      title: "移動",
      body: "移動は基本1マナです。移動だけでは疲労しません。侵入を狙う時は、相手陣地までの道と妨害されるマスを確認します。",
      keys: "move 位置 盤面 侵入",
    },
    {
      cat: "基本",
      title: "技",
      body: "技には消費マナ、射程、成功率があります。成功するとHP/SPダメージ、回復、状態付与、位置移動などが発生します。",
      keys: "action skill 射程 成功率 ダメージ 回復",
    },
    {
      cat: "基本",
      title: "盤面",
      body: "フィールドは縦7マス、横5マスです。自陣、中央、敵陣を使って、攻撃だけでなく侵入ルートも作ります。",
      keys: "field 7 5 盤面 フィールド",
    },
    {
      cat: "応用",
      title: "進化で再行動",
      body: "疲労中でも条件を満たせば進化できます。進化後は技を使えますが、移動回数はリセットされないため、移動はできません。",
      keys: "進化 疲労 再行動 移動不可",
    },
    {
      cat: "応用",
      title: "進化条件",
      body: "進化は同じ属性のカード同士で行います。属性が違うカードは進化先として扱いません。",
      keys: "進化 属性 同属性",
    },
    {
      cat: "応用",
      title: "デッキ構築",
      body: "デッキは30枚ちょうど。同名カードは最大4枚です。低コスト、主力、進化先、サポートの枚数を見ながら調整します。",
      keys: "deck build 30枚 同名4枚 マナカーブ",
    },
    {
      cat: "応用",
      title: "単属性と混色",
      body: "単属性は強みと弱みがはっきりします。混色は対応力が上がりますが、進化ラインや属性条件が揃いにくくなります。",
      keys: "属性 単色 混色 弱点 強み",
    },
    {
      cat: "応用",
      title: "SPダメージの価値",
      body: "SPダメージはHPダメージの約2倍の価値として評価します。SPを削ると、相手の強い技や進化後の行動を止めやすくなります。",
      keys: "HP SP 評価 ダメージ",
    },
    {
      cat: "裁定",
      title: "電子版の裁定",
      body: "電子版では、画面の処理順とログを優先します。自動処理された内容を公式処理として扱います。",
      keys: "ログ 自動処理 電子版",
    },
    {
      cat: "裁定",
      title: "紙版の裁定",
      body: "紙版では、カード本文、共通ルール、ターンプレイヤーの順に確認します。同時処理はターンプレイヤー側から解決します。",
      keys: "紙版 同時処理 ターンプレイヤー",
    },
    {
      cat: "裁定",
      title: "内部タグの扱い",
      body: "attr、role、powerなどは内部処理用タグです。公開テキストでは日本語の効果説明に置き換えて扱います。",
      keys: "attr role power tag json",
    },
    {
      cat: "裁定",
      title: "ダメージ表記",
      body: "赤いハートはHP変化、青いハートはSP変化、緑のハートは回復を表します。マイナスはダメージ、プラスは回復です。",
      keys: "HP SP ハート 表記 回復",
    },
    {
      cat: "裁定",
      title: "状態異常",
      body: "出血、毒、におい、盲目、沈黙、激怒、洗脳、ヘドロ、カウンターなどがあります。状態名、値、ターン数がある場合はカード本文を優先します。",
      keys: "状態異常 出血 毒 におい 盲目 沈黙 激怒 洗脳 ヘドロ カウンター",
    },
  ];

  const categories = ["すべて", "基本", "応用", "裁定"];
  let currentCat = "すべて";
  let query = "";

  const style = document.createElement("style");
  style.textContent = `
    .ruleGuideTool {
      display: grid;
      gap: 14px;
    }
    .ruleGuideControls {
      display: grid;
      grid-template-columns: minmax(220px, .8fr) 1fr;
      gap: 12px;
      align-items: center;
    }
    .ruleGuideSearch {
      width: 100%;
      min-height: 46px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 14px;
      padding: 0 14px;
      color: #f4f8ff;
      background: rgba(0,0,0,.26);
      outline: none;
    }
    .ruleGuideSearch:focus {
      border-color: rgba(110,215,255,.72);
      box-shadow: 0 0 0 3px rgba(110,215,255,.13);
    }
    .ruleGuideCats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .ruleGuideCat {
      min-height: 38px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      padding: 0 13px;
      color: #f4f8ff;
      background: rgba(255,255,255,.045);
      cursor: pointer;
      font-weight: 800;
    }
    .ruleGuideCat.isActive {
      border-color: rgba(157,255,122,.64);
      background: rgba(157,255,122,.12);
      box-shadow: 0 0 22px rgba(157,255,122,.16);
    }
    .ruleGuideResults {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .ruleGuideCard {
      min-height: 132px;
      padding: 15px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      background:
        radial-gradient(240px 120px at 100% 0%, rgba(110,215,255,.10), transparent 64%),
        rgba(8,12,18,.46);
    }
    .ruleGuideCard small {
      display: inline-flex;
      margin-bottom: 8px;
      padding: 4px 9px;
      border: 1px solid rgba(110,215,255,.24);
      border-radius: 999px;
      color: #9ee7ff;
      background: rgba(110,215,255,.08);
      font-weight: 800;
    }
    .ruleGuideCard b {
      display: block;
      margin-bottom: 7px;
      font-size: 16px;
    }
    .ruleGuideCard p {
      margin: 0;
      color: rgba(244,248,255,.72);
      line-height: 1.65;
      font-size: 14px;
    }
    .ruleGuideEmpty {
      padding: 18px;
      border: 1px dashed rgba(255,255,255,.18);
      border-radius: 16px;
      color: rgba(244,248,255,.72);
    }
    @media (max-width: 760px) {
      .ruleGuideControls,
      .ruleGuideResults {
        grid-template-columns: 1fr;
      }
      .ruleGuideCats {
        justify-content: flex-start;
      }
    }
  `;
  document.head.appendChild(style);

  const tool = document.createElement("div");
  tool.className = "ruleGuideTool";
  tool.innerHTML = `
    <div class="ruleGuideControls">
      <input class="ruleGuideSearch" type="search" placeholder="例：進化 / マナ / 裁定 / 射程" aria-label="ルール検索" />
      <div class="ruleGuideCats" role="list"></div>
    </div>
    <div class="ruleGuideResults" aria-live="polite"></div>
  `;
  mount.appendChild(tool);

  const search = tool.querySelector(".ruleGuideSearch");
  const catArea = tool.querySelector(".ruleGuideCats");
  const results = tool.querySelector(".ruleGuideResults");

  const renderCats = () => {
    catArea.innerHTML = "";
    categories.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ruleGuideCat${cat === currentCat ? " isActive" : ""}`;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        currentCat = cat;
        render();
      });
      catArea.appendChild(btn);
    });
  };

  const renderResults = () => {
    const q = query.trim().toLowerCase();
    const matched = entries.filter((entry) => {
      const catOk = currentCat === "すべて" || entry.cat === currentCat;
      const text = `${entry.cat} ${entry.title} ${entry.body} ${entry.keys}`.toLowerCase();
      return catOk && (!q || text.includes(q));
    });
    results.innerHTML = "";
    if (!matched.length) {
      const empty = document.createElement("div");
      empty.className = "ruleGuideEmpty";
      empty.textContent = "該当するルールが見つかりません。別の言葉で検索してみてください。";
      results.appendChild(empty);
      return;
    }
    matched.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "ruleGuideCard";
      card.innerHTML = `<small>${entry.cat}</small><b>${entry.title}</b><p>${entry.body}</p>`;
      results.appendChild(card);
    });
  };

  const render = () => {
    renderCats();
    renderResults();
  };

  search.addEventListener("input", () => {
    query = search.value || "";
    renderResults();
  });

  render();
})();
