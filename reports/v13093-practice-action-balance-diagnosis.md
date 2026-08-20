# v1.30.93 練習操作群の均整診断

添付のv1.30.92実画面では、1段目のメニュー・テンプレートはカード幅を2等分している一方、2段目の共有だけが内容幅へ縮み、編集・削除が広く残る不均衡が確認された。

公開CSSで同じDOMを一時生成して計測したところ、共有ボタンの`grid-column`実効値は`auto`、幅は約48pxとなった。これは、コンテナクエリ内の`.c-practice-card .c-practice-card__actions .btn-share-practice { grid-column: auto; }`が、v1.30.92の`.c-practice-card--toolbar-actions .btn-share-practice { grid-column: 1 / 3; }`より詳細度が高く、後者を上書きしていることが原因である。

v1.30.93では、最終レイアウトのすべての子操作セレクタを`.c-practice-card.c-practice-card--toolbar-actions .c-practice-card__actions`から始める高詳細度の専用規則へ統一する。これにより、1段目は2等分、2段目は共有・編集・削除の3等分をコンテナ幅にかかわらず保証する。
