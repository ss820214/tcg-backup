// public/tutorial.js
// v1.3.0
// - facePath: .jpg
// - Menu item 2 opens tutorial_game.html?t=2&back=...
// - Menu item 3 opens tutorial_game.html?t=3&back=...
// - Menu item 4 opens tutorial_game.html?t=4&back=...   ← NEW
// - Item 5 runs overlay-only tips on current page        ← NEW
// - _showDialog supports { pos:"mid" } to avoid covering buttons

const ASSET_BASE = "/assets/tutorial/";

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "style") n.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
}

function removeNode(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

function facePath(face) {
  // ★jpg 前提
  return `${ASSET_BASE}${face}.jpg`;
}

export class TutorialSystem {
  constructor() {
    this.root = null;
    this.menuLayer = null;
    this.titleLayer = null;
    this.tipsLayer = null;
    this.dialogLayer = null;
    this.exitBtn = null;

    this._runnerAbort = null;
    this._resolveWait = null;

    this.name = "説明AI_Aoi";
    this.defaultFace = "Aoi_default";
  }

  openMenu() {
    this._ensureRoot();
    this._stopRunner();
    this._clearAllLayersExceptRoot();
    this.menuLayer = this._buildMenuLayer();
    this.root.appendChild(this.menuLayer);
  }

  closeAll() {
    this._stopRunner();
    removeNode(this.root);
    this.root = null;
    this.menuLayer = null;
    this.titleLayer = null;
    this.tipsLayer = null;
    this.dialogLayer = null;
    this.exitBtn = null;
  }

  start(id) {
    this._ensureRoot();
    this._stopRunner();

    removeNode(this.menuLayer);
    this.menuLayer = null;

    // チュートリアル2/3/4はローカル戦闘へ遷移
    if (id === "t2" || id === "t3" || id === "t4") {
      const t = (id === "t2") ? 2 : (id === "t3" ? 3 : 4);
      const back = encodeURIComponent(location.href);
      location.href = `./tutorial_game.html?t=${t}&back=${back}`;
      return;
    }

    this._ensureExit();

    if (id === "t1") {
      this._runTutorial1();
      return;
    }
    if (id === "t5") {
      this._runTutorial5();
      return;
    }

    if (id === "t6") {
    this._runTutorial6();
      return;
    }

    this._showDialog({
      face: this.defaultFace,
      name: this.name,
      text: "その項目はまだ未実装だよ！\nまずは「1. 初めに」から作っていこう。",
      choices: [{ label: "項目選択へ戻る", action: () => this.openMenu() }],
      hint: "あとで実装するよ"
    });
  }

  // ===== base =====
  _ensureRoot() {
    if (this.root && this.root.parentNode) return;

    this.root = el("div", {
      id: "tutorialRoot",
      style: `
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        font-family: sans-serif;
      `
    });

    const style = el("style", {}, [`
      #tutorialRoot .t-backdrop{
        position:absolute; inset:0;
        background: rgba(0,0,0,.62);
        pointer-events:auto;
      }
      #tutorialRoot .t-card{
        width: min(760px, 92vw);
        background:#1a1a1a;
        border:1px solid #444;
        border-radius:14px;
        color:#fff;
        overflow:hidden;
        box-shadow: 0 12px 34px rgba(0,0,0,.55);
      }
      #tutorialRoot .t-hd{
        padding:10px 12px;
        border-bottom:1px solid #333;
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        background:#141414;
      }
      #tutorialRoot .t-bd{ padding:12px; }
      #tutorialRoot .t-title{ font-weight:800; letter-spacing:.2px; }
      #tutorialRoot .t-sub{ font-size:12px; opacity:.85; }
      #tutorialRoot .t-btn{
        cursor:pointer;
        padding:7px 10px;
        border-radius:10px;
        border:1px solid #666;
        background:#2b2b2b;
        color:#fff;
        font-size:14px;
      }
      #tutorialRoot .t-btn:hover{ filter: brightness(1.08); }
      #tutorialRoot .t-btn:active{ transform: translateY(1px); }
      #tutorialRoot .t-btn.primary{ border-color:#6a8cff; background:#263357; }
      #tutorialRoot .t-btn.danger{ border-color:#ff8080; background:#402020; }

      #tutorialRoot .t-menuGrid{
        display:grid;
        grid-template-columns: 1fr;
        gap:10px;
      }
      #tutorialRoot .t-menuItem{
        width:100%;
        text-align:left;
        padding:10px 12px;
        border-radius:12px;
        border:1px solid #444;
        background:#202020;
        cursor:pointer;
      }
      #tutorialRoot .t-menuItem:hover{ border-color:#6a8cff; }
      #tutorialRoot .t-menuItem .k{ font-weight:800; }
      #tutorialRoot .t-menuItem .d{ font-size:12px; opacity:.85; margin-top:4px; line-height:1.4; }

      /* Exit */
      #tutorialRoot .t-exit{
        position:absolute;
        top:12px;
        right:12px;
        pointer-events:auto;
      }

      /* Dialog */
      #tutorialRoot .t-dialog{
        position:absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        pointer-events:auto;
        border:1px solid #444;
        border-radius:14px;
        background: rgba(20,20,20,.92);
        display:flex;
        gap:12px;
        padding:10px;
        align-items:flex-end;
      }
      #tutorialRoot .t-dialog.mid{
        top: 50%;
        bottom: auto;
        transform: translateY(-50%);
        left: 12px;
        right: 12px;
      }

      #tutorialRoot .t-face{
        width:110px; height:110px;
        border:1px solid #444;
        border-radius:12px;
        background:#222;
        overflow:hidden;
        flex:0 0 auto;
      }
      #tutorialRoot .t-face img{ width:100%; height:100%; object-fit: cover; }
      #tutorialRoot .t-box{ flex:1 1 auto; min-width:0; }
      #tutorialRoot .t-name{ font-weight:900; margin-bottom:6px; }
      #tutorialRoot .t-text{ white-space:pre-wrap; line-height:1.55; font-size:15px; }
      #tutorialRoot .t-actions{
        display:flex; justify-content:flex-end; gap:8px;
        margin-top:10px; flex-wrap:wrap;
      }
      #tutorialRoot .t-choices{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      #tutorialRoot .t-hint{ margin-top:6px; font-size:12px; opacity:.75; }

      /* Title */
      #tutorialRoot .t-splash{
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,.65);
        pointer-events:auto;
      }
      #tutorialRoot .t-splashBox{
        padding: 16px 18px;
        border:1px solid #444;
        border-radius:16px;
        background:#1a1a1a;
        font-weight:1000;
        font-size:28px;
        letter-spacing:.6px;
      }

      /* Tips */
      #tutorialRoot .t-tips{
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        padding: 16px;
        background: rgba(0,0,0,.7);
        pointer-events:auto;
      }
      #tutorialRoot .t-tipsCard{
        width: min(760px, 92vw);
        background:#141414;
        border:1px solid #444;
        border-radius:14px;
        overflow:hidden;
      }
      #tutorialRoot .t-tipsCard .hd{
        padding:10px 12px;
        border-bottom:1px solid #333;
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        background:#101010;
        font-weight:900;
      }
      #tutorialRoot .t-tipsCard .bd{
        padding:12px;
        line-height:1.65;
        font-size:14px;
      }
      #tutorialRoot .t-tipsCard ul{ margin:10px 0 0 18px; }
      #tutorialRoot .t-tipsCard li{ margin:6px 0; }
    `]);

    this.root.appendChild(style);
    document.body.appendChild(this.root);
  }

  _clearAllLayersExceptRoot() {
    removeNode(this.menuLayer); this.menuLayer = null;
    removeNode(this.titleLayer); this.titleLayer = null;
    removeNode(this.tipsLayer); this.tipsLayer = null;
    removeNode(this.dialogLayer); this.dialogLayer = null;
    removeNode(this.exitBtn); this.exitBtn = null;
  }

  _ensureExit() {
    if (this.exitBtn && this.exitBtn.parentNode) return;
    this.exitBtn = el("div", { class: "t-exit" }, [
      el("button", { class: "t-btn danger", type: "button" }, ["終了"])
    ]);
    this.exitBtn.querySelector("button").addEventListener("click", () => this.openMenu());
    this.root.appendChild(this.exitBtn);
  }

  _buildMenuLayer() {
    const backdrop = el("div", { class: "t-backdrop" });

    const wrap = el("div", {
      style: `
        position:absolute; inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
        pointer-events:none;
      `
    });

    const card = el("div", { class: "t-card", style: "pointer-events:auto;" });

    const hd = el("div", { class: "t-hd" }, [
      el("div", {}, [
        el("div", { class: "t-title" }, ["チュートリアル"]),
        el("div", { class: "t-sub" }, ["項目を選んでね（2/3/4はローカル戦闘へ移動）"])
      ]),
      el("div", {}, [
        el("button", { class: "t-btn", type: "button" }, ["閉じる"])
      ])
    ]);
    hd.querySelector("button").addEventListener("click", () => this.closeAll());

    const items = [
      { id: "t1", k: "1. 初めに", d: "ゲームの超ざっくり概要（説明キャラ登場）" },
      { id: "t2", k: "2. 召喚してみよう", d: "バトル画面へ（手札／召喚とマナ）" },
      { id: "t3", k: "3. 移動して殴る", d: "移動→攻撃（prototype_A vs decoy）" },
      { id: "t4", k: "4. 進化してみる", d: "進化（prototype_A → Aoiに進化）" },
      { id: "t5", k: "5. デッキ編成について", d: "デッキ20枚／同名4枚／属性フィルタ" },
      { id: "t6", k: "6. 状態異常の種類", d: "効果一覧を見る（未実装）" },
    ];

    const grid = el("div", { class: "t-menuGrid" });
    for (const it of items) {
      const b = el("button", { class: "t-menuItem", type: "button" }, [
        el("div", { class: "k" }, [it.k]),
        el("div", { class: "d" }, [it.d])
      ]);
      b.addEventListener("click", () => this.start(it.id));
      grid.appendChild(b);
    }

    const bd = el("div", { class: "t-bd" }, [grid]);

    card.appendChild(hd);
    card.appendChild(bd);

    wrap.appendChild(card);

    const layer = el("div", { style: "position:absolute; inset:0; pointer-events:none;" });
    layer.appendChild(backdrop);
    layer.appendChild(wrap);

    // menu中はexit消す
    removeNode(this.exitBtn); this.exitBtn = null;

    return layer;
  }

  // ===== dialog helpers =====
  _hideDialog() {
    removeNode(this.dialogLayer);
    this.dialogLayer = null;
  }

  _showDialog({ face, name, text, nextLabel = "次へ", onNext = null, choices = null, hint = "タップで進む", pos = "bottom" }) {
    this._hideDialog();

    const layer = el("div", { style: "position:absolute; inset:0; pointer-events:none;" });

    const dialog = el("div", { class: `t-dialog ${pos === "mid" ? "mid" : ""}` });

    const faceBox = el("div", { class: "t-face" }, [
      el("img", { src: facePath(face), alt: "face" })
    ]);

    const box = el("div", { class: "t-box" }, [
      el("div", { class: "t-name" }, [name]),
      el("div", { class: "t-text" }, [text]),
    ]);

    const actions = el("div", { class: "t-actions" });
    const nextBtn = el("button", { class: "t-btn primary", type: "button" }, [nextLabel]);

    nextBtn.addEventListener("click", () => {
      this._hideDialog();
      if (onNext) onNext();
      else this._resolveWait?.();
    });

    actions.appendChild(nextBtn);
    box.appendChild(actions);

    if (choices && Array.isArray(choices) && choices.length) {
      nextBtn.style.display = "none";
      const ch = el("div", { class: "t-choices" });
      for (const c of choices) {
        const cb = el("button", { class: "t-btn", type: "button" }, [c.label]);
        cb.addEventListener("click", () => {
          this._hideDialog();
          c.action?.();
        });
        ch.appendChild(cb);
      }
      box.appendChild(ch);
    }

    box.appendChild(el("div", { class: "t-hint" }, [hint]));

    dialog.appendChild(faceBox);
    dialog.appendChild(box);

    dialog.addEventListener("click", (e) => {
      if (choices && choices.length) return;
      if (e.target.closest("button")) return;
      this._hideDialog();
      this._resolveWait?.();
    });

    layer.appendChild(dialog);
    this.root.appendChild(layer);
    this.dialogLayer = layer;
  }

  _showTitle(text) {
    removeNode(this.titleLayer);
    const layer = el("div", { class: "t-splash" }, [
      el("div", { class: "t-splashBox" }, [text])
    ]);
    layer.addEventListener("click", () => this._resolveWait?.());
    this.titleLayer = layer;
    this.root.appendChild(layer);
  }
  _hideTitle() { removeNode(this.titleLayer); this.titleLayer = null; }

  _showTips({ title, lines }) {
    removeNode(this.tipsLayer);

    const layer = el("div", { class: "t-tips" });
    const card = el("div", { class: "t-tipsCard" });

    const hd = el("div", { class: "hd" }, [
      el("div", {}, [title]),
      el("button", { class: "t-btn", type: "button" }, ["閉じる"])
    ]);
    hd.querySelector("button").addEventListener("click", () => this._resolveWait?.());

    const bd = el("div", { class: "bd" });
    const ul = el("ul");
    for (const s of lines) ul.appendChild(el("li", {}, [s]));
    bd.appendChild(ul);

    card.appendChild(hd);
    card.appendChild(bd);
    layer.appendChild(card);

    layer.addEventListener("click", (e) => {
      if (!e.target.closest(".t-tipsCard")) this._resolveWait?.();
    });

    this.tipsLayer = layer;
    this.root.appendChild(layer);
  }
  _hideTips() { removeNode(this.tipsLayer); this.tipsLayer = null; }

  _stopRunner() {
    if (this._runnerAbort) this._runnerAbort.aborted = true;
    this._runnerAbort = null;
    this._resolveWait = null;
  }
  _wait(abort) {
    return new Promise((resolve) => {
      if (abort.aborted) return resolve(false);
      this._resolveWait = () => resolve(true);
    });
  }

  // ===== Tutorial 1 =====
  async _runTutorial1() {
    const abort = { aborted: false };
    this._runnerAbort = abort;

    this._showDialog({
      face: "Aoi_default",
      name: this.name,
      text: "はじめまして！私は説明ロボのAoI!",
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_default",
      name: this.name,
      text: "君はわが社・T社の新人だね？？",
      choices: [
        { label: "はい（新人です）", action: () => this._resolveWait?.() },
        { label: "いいえ", action: () => this._resolveWait?.() },
      ],
      hint: "ストーリとかないのでどちらでもOK"
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_niko",
      name: this.name,
      text: "新しいどれ…人間が入ってきてくれて嬉しいよ！\nさぁ一緒に業務を進めていこう！",
    });
    if (!(await this._wait(abort))) return;

    this._showTitle("1. 初めに");
    if (!(await this._wait(abort))) return;
    this._hideTitle();

    this._showDialog({
      face: "Aoi_default",
      name: this.name,
      text: "このゲームについて簡単に説明するね。\nまぁここに入れてるってことは1回で理解できる優秀な人材ってことだけど！",
    });
    if (!(await this._wait(abort))) return;

    this._showTips({
      title: "ゲーム概要（Tips）",
      lines: [
        "ターン制のカードバトルだよ。",
        "マナを使って「召喚」「移動」「行動（攻撃など）」をする。",
        "敵を倒す／侵入などで勝利を目指す（細かい勝ち方は実戦で！）。",
        "進化・状態異常を使うと有利を作れるよ。",
      ]
    });
    if (!(await this._wait(abort))) return;
    this._hideTips();

    this._showDialog({
      face: "Aoi_kirakira",
      name: this.name,
      text: "こんなもんかな！初日は残業させると怒られるからこの辺にしようか！\nまた次の機会に！",
      nextLabel: "完了",
      onNext: () => this.openMenu(),
      hint: "完了すると項目選択に戻る"
    });
  }

  // ===== Tutorial 5 (overlay only) =====
  async _runTutorial5() {
    const abort = { aborted: false };
    this._runnerAbort = abort;

    this._showTitle("5. デッキ編成について");
    if (!(await this._wait(abort))) return;
    this._hideTitle();

    this._showDialog({
      face: "Aoi_nazo",
      name: this.name,
      text: "そういえば、デッキ編成に困ったことない？",
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_",
      name: this.name,
      text: "まかせて！万能AIの自分がすべて解決できる！　人間より優れているんだ！",
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_default",
      name: this.name,
      text: "ということで今日は、デッキ編成の話をしよう。\n手札の元になる山札を指す言葉と同義だよ",
    });
    if (!(await this._wait(abort))) return;

    this._showTips({
      title: "Tips：デッキ編成（基本）",
      lines: [
        "デッキは基本30枚。(ルールによって変更あり）まずはここを埋めないと出撃できない。",
        "同名カードは最大4枚まで。",
        "属性フィルタで、欲しい属性だけ表示できる（迷子防止）。",
        "検索で名前を絞り込める（例：剣士）。",
      ]
    });
    if (!(await this._wait(abort))) return;
    this._hideTips();

    this._showDialog({
      face: "Aoi_angry",
      name: this.name,
      text: "デッキが弱いと、現場に出ても即死だ。\nまずは30枚＋同名4枚制限を守って、安定した山札を作ろう。",
      nextLabel: "完了",
      onNext: () => this.openMenu(),
      hint: "完了で項目選択に戻る"
    });
  }

    // ===== Tutorial 6 (overlay only) =====
  async _runTutorial6() {
    const abort = { aborted: false };
    this._runnerAbort = abort;

    this._showTitle("6. 状態異常の種類");
    if (!(await this._wait(abort))) return;
    this._hideTitle();

    this._showDialog({
      face: "Aoi_sick",
      name: this.name,
      text: "未来のロボも、病気になったりするんだ。インフルM型とかね！",
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_default",
      name: this.name,
      text: "ということで、この項目では状態異常について話していこう。\n病気でも働くのが、社会人でしょ",
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_sick",
      name: this.name,
      text:
        '今私がなっている、"毒"みたいに直接ダメージではないけど悪影響がある効果があるんだ',
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_hakken",
      name: this.name,
      text:
        "例えば骨折。足が折れたら歩きづらくなるよね。\nこのゲームでは移動命令ができなくなる、などの効果があるんだ。",
    });
    if (!(await this._wait(abort))) return;

    this._showDialog({
      face: "Aoi_yami",
      name: this.name,
      text:
        "状態異常によっては相手を完封できることもあるし、割と重要な要素になっているんだ",
    });
    if (!(await this._wait(abort))) return;

    this._showTips({
      title: "Tips：状態異常一覧（例）",
      lines: [
        "出血：移動時10ダメ",
        "骨折：移動命令不可",
        "匂い：ターン終了時、SP-10",
        "盲目：命中率半減（成功率半減と同じ）",
        "封印：攻撃技（行動）を封じる",
        "失魂：あらゆる回復・サポートを受けられなくなる",
        "疲労：行動命令不可 など",
        "弱体：攻撃力・防御力などステータス低下",
        "【バフ】回避：一定回数/一定確率で攻撃を回避",
        "【バフ】装甲：被ダメ軽減／無効化",
        "【バフ】追撃：疲労が回復し、もう一度行動できる。",
        "【バフ】コンボ：もう一度同じ技を使える",
      ]
    });

    
    if (!(await this._wait(abort))) return;
    this._hideTips();

    this._showDialog({
      face: "Aoi_default",
      name: this.name,
      text:
        "こんなもんかな。あとは実際に戦ってみてどの組み合わせが強いか...とか試すのも面白いよ",
      nextLabel: "完了",
      onNext: () => this.openMenu(),
      hint: "完了で項目選択に戻る"
    });
  }
}
