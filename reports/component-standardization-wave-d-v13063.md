# コンポーネント標準化監査 — 波D（設定・同期・保護者運用）

**対象リリース:** v1.30.63（公開前）

**対象ブランチ:** `feat/label-shape-unification`

**対象領域:** 設定、同期監査、運用診断、クラウド復旧、保護者招待、同期競合解決

## 目的

波Dでは、設定および運用画面に残っていた画面固有の構造・反復行・モーダルを、既存の共通部品体系へ統合した。移行の優先条件は、既存のDOM ID、`data-*`属性、イベント処理、同期・復旧・招待の機能契約を維持しながら、今後のテーマ変更やレスポンシブ修正を共通部品側で完結できる状態にすることである。

| 領域 | 旧構造 | 移行後の正本 | 維持した契約 |
|---|---|---|---|
| 設定セクション | `sl-section`、`sl-section-body` | `c-settings-section`、`c-settings-section__body` | 既存の設定セクションIDとフォームID |
| 同期監査 | `sync-audit-*` | `c-data-list--audit`、`c-data-list__header`、`c-data-list__item` | `sync-audit-history` ID |
| 運用診断 | `operations-check*` | `c-data-list--diagnostics`、`c-data-list__identity`、`c-data-list__actions` | `data-operation-action` と診断アクション |
| クラウド復旧 | `cloud-recovery-item`、`cloud-recovery-empty` | `c-data-list--recovery`、`c-empty-state__text` | `cloud-recovery-history` ID、復元ボタンの `data-revision` |
| 保護者招待 | `parent-access-invite*` | `c-data-list--parent-access`、`c-status`、`c-empty-state` | 招待一覧ID、コピー・失効の `data-*` 属性 |
| 同期競合 | `sync-conflict-*` | `c-modal--sync-conflict`、`c-data-list--conflict`、`c-modal__footer` | Esc取消、背景クリック取消、各 `data-action`、初期フォーカス |

## 実施内容

設定テンプレートから、すでに共通設定セクションと併記されていた `sl-section` および `sl-section-body` を除去した。これに伴い、旧設定行で使用されなくなった `sl-section-label`、`sl-row`、`sl-input`、`sl-add-row` のCSS規則も削除した。設定フォームの残存参照はすべて `c-input` と `c-form-field` に向けた。

同期監査、運用診断、クラウド復旧、保護者招待は、それぞれの用途に対応した `c-data-list` 修飾子で構成した。共通部品層には `c-data-list__content` と、診断・復旧・監査・招待・競合用の用途別修飾子を追加した。状態表示は、個別の色指定や `!important` を持つ旧招待ラベルではなく、`c-status--success`、`c-status--warning`、`c-status--muted` を使用する。

同期競合ダイアログは `c-modal` のヘッダー、本文、フッター構造へ移行した。重要な競合解決がPWA更新通知などに覆われないよう、共通の `c-modal-overlay--critical` を追加して重なり順を明示した。

## 削除確認

次の旧クラスは、実行時テンプレートおよびCSSからの参照ゼロを確認後に削除した。

| 削除群 | 削除した主なクラス |
|---|---|
| 旧設定構造 | `sl-section`、`sl-section-body`、`sl-section-label`、`sl-row`、`sl-input`、`sl-add-row` |
| 同期・診断 | `sync-audit-*`、`operations-check*` |
| 復旧・招待 | `cloud-recovery-item`、`cloud-recovery-empty`、`parent-access-invite*` |
| 競合解決 | `sync-conflict-*` |

`sync-audit-history`、`operations-diagnostics`、`cloud-recovery-history`、`parent-access-invites` は、JavaScriptのイベント接続先であるため **DOM IDとして維持** している。これらは旧CSSクラスではないため、部品標準化の削除対象には含めない。

## 回帰防止

`tests/p35-component-migration-guardrails-test.mjs` に波D契約を追加した。テストは、設定テンプレートにおける共通リストの利用、設定レンダラーにおける共通要素・状態ラベル・既存イベント属性、競合モーダルにおける共通モーダル構造を検証する。また、波Dで廃止した `sl-*`、`sync-audit-*`、`operations-check*`、対象の `cloud-recovery-*`、`parent-access-invite*`、`sync-conflict-*` のCSSおよびクラス属性への再導入を禁止する。

## 検証状況

| 検証項目 | 状況 |
|---|---|
| 波Dの旧クラス参照ゼロ監査 | 完了 |
| P35波D回帰防止契約 | 成功 |
| JavaScript構文・全契約・レスポンシブ検証 | リリース前の総合検証で実施予定 |
| レガシーCSS監査・差分検査 | リリース前の総合検証で実施予定 |

## 次段階

波Dの総合検証とリリース後、波Eでは選手詳細、アプリシェル、作図周辺UIを `c-*` 部品へ統合する。キャンバス幾何、ドラッグ操作、戦術ピッチ、およびP38のモバイル操作・権限制御・戻る文脈復元の契約は、波Eで維持条件として扱う。
