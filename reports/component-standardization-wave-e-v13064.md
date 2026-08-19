# コンポーネント標準化監査 — 波E（選手詳細・アプリシェル・作図周辺UI）

**対象リリース:** v1.30.64（公開前）

**対象ブランチ:** `feat/label-shape-unification`

**対象領域:** 選手詳細、選手参加実績、PCサイドバー、トップバー、モバイル戻るコンテキストバー、ボトムナビ、同期ポップオーバー、作図ツールドック、作図設定ポップオーバー、クイックドロワー、詳細インスペクタ、試合詳細のピリオド情報表示

## 目的

波Eでは、画面固有の`player-notebook-*`、`player-participation-*`、`sidebar-*`、`topbar-*`、`bottom-nav`、`mobile-context-*`、`sync-popover`、`anim-tool-dock`、`dock-*`、`anim-settings-popover`、`anim-quick-drawer`、`drawer-*`、`side-info-*`、`side-panel-*`を、再利用可能な`c-*`部品へ移行した。キャンバスの座標、ドラッグ、ピッチ描画、フレーム操作、DOM ID、既存イベントハンドラは変更対象に含めず、周辺UIの構造とCSSの責務だけを置換した。

## 移行結果

| 領域 | 旧実装 | 正規部品 | 維持した契約 |
|---|---|---|---|
| 育成ノート | `player-notebook-*` | `c-focus-summary`、`c-metric-grid`、`c-data-list--notebook`、`c-settings-form` | ノート追加・削除、スキル評価、日付初期化、空状態 |
| 選手参加実績 | `player-participation-*` | `c-card`、`c-section-header`、`c-data-list--participation`、`c-progress-bar` | 選手別の参加率・得点・アシスト表示、選手詳細への遷移 |
| アプリシェル | `sidebar-*`、`topbar-*`、`bottom-nav`、`mobile-context-*` | `c-sidebar`、`c-topbar`、`c-bottom-nav`、`c-context-bar` | 役割切替、同期表示、モバイル5項目ナビ、戻る文脈復元、44px操作領域 |
| 同期ポップオーバー | `sync-popover*` | `c-popover--sync`、`c-popover__header`、`c-popover__body` | 同期状態、最終同期時刻、手動同期、外側クリックでの閉鎖 |
| 作図ツール | `anim-tool-dock`、`dock-*` | `c-tool-dock`、`c-tool-dock__button`、`c-tool-dock__label` | 選択ツールのアクティブ状態、戦術モードの表示制御、ツールチップ |
| 作図設定 | `anim-settings-popover` | `c-popover--canvas` | ピッチ・グリッド・一括配置・チームカラー設定 |
| 作図クイック編集 | `anim-quick-drawer`、`drawer-*` | `c-drawer`、`c-drawer__*` | テロップ、停止時間、プリセット、閉鎖、モバイル表示 |
| 詳細情報 | `anim-detail-side-panel`、`side-info-*` | `c-inspector-panel`、`c-inspector-panel__*` | パネル開閉、作図詳細、試合ピリオドの情報・編集表示 |

## 実装上の確認事項

選手参加実績の行はインラインの`onclick`を廃止し、`data-player-detail-id`を持つボタンへイベントリスナーを接続した。これにより表示行は共通データリストのボタン契約に沿いながら、従来と同じ選手詳細遷移を維持する。

試合詳細にも`side-info-*`が使われていたため、作図画面だけの変更に留めず、試合ピリオド情報の生成マークアップも`c-inspector-panel__item`、`__label`、`__value`へ統一した。この横断移行により、作図CSSを正本へ切り替えた後にも試合詳細の情報カードが無スタイル化しないことを担保している。

アプリシェルでは、DOM IDを保持し、JavaScriptの参照だけを`c-sidebar__nav`、`c-bottom-nav__item`、`c-sidebar__sync-row`、`c-sidebar__header`へ更新した。P38の戻る操作、セーフエリア、権限制御、一覧文脈復元はそのまま検証対象として維持した。

## 削除確認

旧クラスはテンプレート、動的HTML、JavaScriptのクラスセレクタ、対象CSSから除去した。IDに含まれる`sidebar`、`topbar`、`bottom-nav`、`mobile-context`、`sync-popover`、`anim-quick-drawer`、`anim-detail-side-panel`は機能・アクセシビリティ・テスト互換のため維持しており、旧CSSクラスではない。

P35には、波Eで導入した共通部品の存在確認と、旧クラスのCSS選択子・クラス属性への再導入禁止を追加した。P19は育成ノートの契約を旧`player-notebook-*`の存在確認から、共通メトリック、共通データリスト、共通空状態、共通フォームの利用確認へ更新した。P38はアプリシェルの新しい正規クラスを検証しつつ、44px操作領域とナビゲーション契約を継続して検証する。

## リリース前検証項目

| 検証 | 合格条件 |
|---|---|
| JavaScript構文 | `app.js`、`settings.js`、`players.js`、`drawing.js`、`matches.js`が構文エラーなし |
| 契約テスト | 全30件が成功し、P19・P35・P38を含む |
| レスポンシブ検証 | 全20項目で違反0件 |
| CSS監査 | 波E旧クラスの実行時参照およびCSS定義が0件 |
| 差分整合性 | `git diff --check`が成功 |

## 結論

波Eにより、選手詳細、アプリシェル、作図周辺UIの構造的な正本を`c-*`部品に移行した。機能IDとイベント接続を維持したまま、複数画面で散在していた表示部品を再利用可能な設計へ収束させた。今後、作図キャンバスの幾何や操作ロジックを変更する場合も、周辺UIの見た目・レイアウトは本移行で定義した共通部品契約に従う。
