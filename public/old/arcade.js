// public/arcade.js
// MVP: tutorial_game.html への入口だけ作る。
// 後でここを「ステージ選択」「敵デッキ生成」「報酬」などのハブに拡張する。

function qs(k){ return document.querySelector(k); }

const btnBack = qs('#btnBack');
if (btnBack) btnBack.addEventListener('click', ()=>{ location.href = './index.html'; });

// Start buttons
for (const el of document.querySelectorAll('button[data-start]')){
  el.addEventListener('click', ()=>{
    const t = Number(el.getAttribute('data-start') || '2') || 2;
    // tutorial_game.html は既存資産を流用（プロジェクト側に存在する前提）
    // back= で戻り先も渡す
    const url = new URL('./tutorial_game.html', location.href);
    url.searchParams.set('t', String(t));
    url.searchParams.set('back', './arcade.html');
    location.href = url.toString();
  });
}
