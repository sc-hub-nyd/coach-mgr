## 変更の目的

<!-- 利用者のタスク、変更する画面、意図を日本語で説明してください。 -->

## デザインシステム影響

該当する項目を確認し、該当しない場合は理由を記載してください。

- [ ] **カラー**：具体HEXを画面・部品CSSへ追加していない。`--color-*`の役割トークンを使用した。
- [ ] **状態**：success / warning / danger / info / disabled / loading / validation / emptyの影響を確認した。
- [ ] **共通部品**：既存の`c-*`部品・レイアウトプリミティブを再利用し、画面固有の重複規則を増やしていない。
- [ ] **アイコン**：4層体系（カスタムSVG／Tabler／絵文字／Canvas）に沿って役割を選んだ。装飾アイコンには`aria-hidden`、操作アイコンには名称を設定した。
- [ ] **Tablerサブセット**：`ti-*`を追加・削除した場合、`scripts/build-tabler-subset-v13085.mjs`と`pyftsubset`を実行し、CSS・WOFF2・マニフェストを更新した。
- [ ] **作図**：作図に関係する場合、ツールドックの常時ラベル、`aria-pressed`、Canvas表現、モバイル幅を確認した。
- [ ] **高密度表示**：長い日本語名、12名の選手、複数操作、未回答・注意状態で崩れないことを確認した。
- [ ] **アクセシビリティ**：キーボードフォーカス、ダイアログ名・説明、live region、色以外の状態表現を確認した。
- [ ] **PWA**：アプリシェル・静的資産を変更した場合、`sw.js`のキャッシュ世代、precache、更新通知の適用を確認した。

## 品質ゲート

- [ ] `node tests/run-contract-tests.mjs`
- [ ] `node tests/run-responsive-validation.mjs`
- [ ] `node tests/p34-dynamic-color-theme-test.mjs`
- [ ] `bash scripts/audit-legacy-css.sh`
- [ ] `node scripts/audit-design-system-v13085.mjs`
- [ ] `git diff --check`

## 確認記録

<!-- 代表画面、テーマ、ビューポート、PWA更新など、実施した確認と結果を記載してください。 -->

## 変更履歴

<!-- 破壊的変更・非推奨化・移行期限・追加または変更した契約テストを記載してください。 -->
