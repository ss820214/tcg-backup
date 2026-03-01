// public/tutorial.js
// v1.5.0-b

const steps = [
  {
    title: "1) まずはデッキを作る",
    html: `
      <h2>デッキ構築</h2>
      <ul>
        <li>デッキは <b>20枚</b></li>
        <li>同名カードは <b>最大4枚</b></li>
        <li>20枚ちょうどになると、<b>バトルへ</b> が押せる</li>
      </ul>
      <div class="small">コツ：まずは低コスト多めで形を作ってから、上位カードを足すと楽。</div>
    `
  },
  {
    title: "2) カード詳細の見方",
    html: `
      <h2>カード詳細</h2>
      <ul>
        <li>カード一覧の <b>「詳細」</b> で、行動（攻撃方法）が見れる</li>
        <li>特に見るのは <b>射程(range)</b> と <b>成功率(rate)</b></li>
        <li>効果は <b>HPダメ / SPダメ / ドロー</b> など</li>
      </ul>
      <div class="small">例：<code>rf1+lf1</code> は「右前1 または 左前1」って意味。</div>
    `
  },
  {
    title: "3) 射程の読み方（8方向）",
    html: `
      <h2>射程(range)の例</h2>
      <ul>
        <li><code>f1</code> 前1、<code>f2</code> 前2</li>
        <li><code>lf1</code> 左前1、<code>rb1</code> 右後1</li>
        <li><code>adj4</code> 上下左右、<code>adj8</code> 周囲8マス</li>
        <li><code>frontArc1</code> = 前/左前/右前</li>
        <li><code>rf1+lf1</code> のように <b>+で複合</b> できる</li>
      </ul>
      <div class="small">※ 前/左/右 は「自分の向き 기준」なので、AとBで左右が入れ替わるよ。</div>
    `
  },
  {
    title: "4) ターンの流れ",
    html: `
      <h2>ターンの流れ</h2>
      <ol>
        <li><b>ターン開始</b>：マナが回復し、最大マナが増える</li>
        <li><b>行動</b>：召喚 / 移動 / 攻撃 / 進化</li>
        <li><b>ターンエンド</b></li>
      </ol>
      <div class="small">
        1ターン中に何を優先するかが重要。<br>
        盤面を作るか、攻め切るかを毎ターン考えよう。
      </div>
    `
  },
  {
    title: "5) マナと行動",
    html: `
      <h2>マナ</h2>
      <ul>
        <li><b>召喚</b>：カードのコスト分マナを消費</li>
        <li><b>移動</b>：マナ1消費（移動だけなら疲労しない）</li>
        <li><b>攻撃</b>：行動のコスト分マナを消費</li>
      </ul>
      <div class="small">
        マナは毎ターン回復＋最大値が増える。<br>
        序盤は軽く、中盤以降は重い行動が強い。
      </div>
    `
  },
  {
    title: "6) 疲労（連続行動の制限）",
    html: `
      <h2>疲労</h2>
      <ul>
        <li><b>攻撃</b> または <b>進化</b> をすると疲労する</li>
        <li>疲労中は <b>攻撃 / 進化ができない</b></li>
        <li><b>移動</b> は疲労中でも可能</li>
        <li>次の自分のターン開始時に解除</li>
      </ul>
      <div class="small">
        疲労があるので、1体で無双しにくい設計。
      </div>
    `
  },
  {
    title: "7) 勝利条件",
    html: `
      <h2>勝利条件</h2>
      <ul>
        <li><b>相手を3体倒す</b></li>
        <li>または <b>相手陣地に3体侵入</b></li>
      </ul>
      <div class="small">
        撃破だけでなく「前に出る」こと自体が勝ち筋になる。
      </div>
    `
  },
  {
    title: "8) 属性の考え方",
    html: `
      <h2>属性の特徴</h2>
      <ul>
        <li><b>鋼</b>：硬くて勝ち切れるが、展開力と安定性が低い</li>
        <li><b>雷</b>：加速が得意で展開力は高いが、制圧力は低め</li>
        <li><b>闇</b>：妨害・状態異常で崩すが、噛み合い依存</li>
      </ul>
      <div class="small">
        属性は「強さ」よりも「勝ち方の違い」。<br>
        自分の好みの勝ち筋を見つけよう。
      </div>
    `
  },
  {
    title: "9) まずは遊んでみよう",
    html: `
      <h2>まとめ</h2>
      <ul>
        <li>完璧なデッキは最初から作れない</li>
        <li>負けた理由＝次の改善点</li>
        <li>カードを触りながら理解するのが一番早い</li>
      </ul>
      <div class="small">
        まずは気軽に1戦。<br>
        このゲームは「考えた分だけ強くなる」タイプだよ。
      </div>
    `
  }
];

let idx = 0;

const stepBox = document.getElementById("stepBox");
const stepNum = document.getElementById("stepNum");
const stepMax = document.getElementById("stepMax");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");

stepMax.textContent = steps.length;

function render() {
  const s = steps[idx];
  stepNum.textContent = (idx + 1).toString();

  stepBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <b>${s.title}</b>
      <span class="pill">TIP</span>
    </div>
    <div style="margin-top:10px;">${s.html}</div>
  `;

  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === steps.length - 1;
}

prevBtn.onclick = () => { if (idx > 0) { idx--; render(); } };
nextBtn.onclick = () => { if (idx < steps.length - 1) { idx++; render(); } };

backBtn.onclick = () => { location.href = "./index.html"; };

render();