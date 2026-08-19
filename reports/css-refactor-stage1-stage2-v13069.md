# CoachMgr CSSリファクタリング実施報告

**対象バージョン:** v1.30.69  
**実施日:** 2026-08-20  
**対象:** 第一段階（`base.css`の局所整理）および第二段階（静的インライン装飾と重複CSSの共通部品化）

## 1. 完了範囲

今回のリファクタリングは、全CSSを機械的に書き換えるのではなく、見た目と操作を変えずに責務を正しい層へ戻せる高確度の領域に限定した。`!important`を使って通常装飾を固定していた規則は、`components-system.css`の共通部品、BEM修飾子、親コンテキストへ置換した。動的値、保護者モードの安全制御、モバイルSafe Areaに関わる例外は台帳化して維持した。

| 区分 | 変更 | 正本 |
|---|---|---|
| トップバー戻るボタン | 通常時の余白・文字サイズ・ウェイトの`!important`を詳細度設計へ置換 | `base.css`の`.c-topbar .c-topbar__back-button` |
| モバイル「その他」メニュー | シート、グリッド、項目、ヘッダー、カード、同期行、ユーティリティ行を`c-mobile-more__*`へ統合 | `components-system.css` |
| 同期ポップオーバー | サイドバー専用上書きを`c-popover--sync c-popover--sidebar`へ移行。`drawing.css`の重複定義を削除 | `components-system.css` |
| 練習カード操作列 | 一行ツールバーを`c-practice-card--toolbar-actions`として明示し、`body`起点の上書きを削除 | `components-system.css` |
| ローディング状態 | アプリ起動時の静的Flex・余白・文字装飾を`c-loading-state`へ移行 | `components-system.css` |
| モーダル閉じる操作 | 繰り返し出現していた絶対配置・色・大きさの静的インライン指定を`c-modal__close`と`c-modal__close--floating`へ移行 | `components-system.css` |

## 2. 定量結果

| 指標 | 開始時 | v1.30.69 | 変化 |
|---|---:|---:|---:|
| `base.css`の`!important` | 279件 | 233件 | 46件削減 |
| `index.html`の`style`属性 | 314件 | 284件 | 30件削減 |
| 同期ポップオーバーのレイアウト正本 | `base.css`と`drawing.css`に分散 | `components-system.css`へ一本化 | 重複解消 |
| モバイル「その他」メニューのレイアウト正本 | `base.css`と`components.css`に分散 | `components-system.css`へ一本化 | 重複解消 |

## 3. 残す例外

以下は通常装飾の競合ではなく、状態・権限・モバイルアプリシェルの保護に必要な例外である。削減対象にはせず、`css-refactor-exception-ledger-v13069.md`で理由と必須検証を管理する。

| 例外 | 理由 |
|---|---|
| `.hidden`および各部品の`.hidden` | JavaScriptの表示状態が通常の`display`規則を確実に打ち消す必要がある |
| `body.role-read-only` | 保護者モードで編集・危険操作・コーチ専用導線を確実に抑止する必要がある |
| 768px以下のボトムナビ・コンテキストバー | Safe Area、固定位置、親指到達域、戻る導線を同時に保護する必要がある |
| `style*="display: none"`に対するナビゲーション項目 | 権限に応じてDOMへ設定される動的表示を確実に上書きする必要がある |

## 4. 再発防止

P35は、`c-mobile-more__*`、`c-popover--sync`、`c-popover--sidebar`、`c-practice-card--toolbar-actions`、`c-loading-state`、`c-modal__close--floating`の存在とテンプレート利用を検証する。さらに、`base.css`および`components.css`に旧モバイルメニュー、旧同期ポップオーバー、旧練習操作列の正本が再導入されないことを検知する。

P38は、同期ポップオーバーの不透明背景と上向き配置、練習カードの一行ツールバー修飾子を`components-system.css`の正本に対して検証する。これにより、見た目を`!important`で偶発的に固定する回帰を防ぐ。

## 5. 完了判断

第一段階と第二段階の**今回対象範囲**は完了とする。ただし、CSSアーキテクチャ全体の将来的な改善余地は残る。残存するインライン指定のうちCanvas座標、ドラッグ位置、進捗幅、テーマ変数などの動的値は設計上保持する。その他の画面固有な静的装飾は、機能単位で本報告書と同じ手順（正本作成、契約追加、視覚確認、品質ゲート）により段階的に扱う。
