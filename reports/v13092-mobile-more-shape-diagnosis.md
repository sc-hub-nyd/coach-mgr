# v1.30.92 モバイル「その他」メニュー面の角丸診断

- 対象URL: GitHub Pages公開URL
- 確認日時: 2026-08-20 (GMT+9)
- 対象要素: `.mobile-more-sheet.c-modal.c-modal--bottom-sheet`

## 実測結果

公開済みv1.30.91のブラウザで`getComputedStyle`を取得した結果、対象要素の角丸は`borderRadius: 0px`、および上下左右のすべてが`0px`であった。背景色は白、幅は`min(100%, 600px)`であった。

これは、共通コンポーネント層に`border-radius: var(--radius-lg)`があるにもかかわらず、最終適用値が全角0で上書きされていることを示す。現在のCSSはボトムシートの下端を意図的に0にしており、さらに既存の詳細度または後続規則によって上端の角丸も失われている。

## 修正方針

1. `.c-modal--bottom-sheet`で上端左右の角丸を明示し、下端0を仕様として明記する。
2. `mobile-more-sheet`専用の修飾子で共通surface（背景、枠、影、top radius）を明示する。全角0になる既存競合へは必要最小限の詳細度で勝ち、`!important`は追加しない。
3. モーダルの`overflow: hidden`を維持し、ヘッダー・本体の背景が角丸外へ漏れないようにする。
4. P54に実測されたトップ角丸・surface規則の契約を追加する。

## 実装結果

- `.c-modal--bottom-sheet`に`border-start-start-radius`および`border-start-end-radius`として`--radius-lg`を明示した。
- `.c-mobile-more__sheet`の未定義`--radius-xl`参照を`--radius-lg`へ置換し、上端左右の角丸、surface境界線、下端フラットを明示した。
- 練習カードは1段目をメニュー・テンプレートの2等分、2段目を共有・編集・削除の3等分へ変更した。すべての操作を44px以上の統一高とし、編集・削除にも可視ラベルを追加した。
- P49・P54にモバイルメニュー面の上端角丸、練習操作の均等幅・可視ラベルを契約として追加した。

## 初期検証

`node --check practices.js`、P47、P49、P54、`git diff --check`は成功した。公開前に全契約テスト、レスポンシブ検証、テーマ検証、監査を実行する。
