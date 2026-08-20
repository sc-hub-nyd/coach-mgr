# 直接指定色の段階移行ロードマップ — 戦術Canvas・レガシー画面

**対象**: CoachMgr v1.30.86

**目的**: 画面・部品CSSに残る直接指定色のうち、戦術・Canvas視覚表現92件と、`CSS/components.css` に残るレガシー画面・モーダル互換規則66件を、機能・視認性・保存データ・PWAオフライン動作を維持したまま、意味のあるトークンまたは共通部品へ段階移行する。

## 1. 基本方針

直接指定色の削減は、色値を一律に置換する作業ではない。特に戦術盤では、ピッチ、線、選手、ボール、コーン、軌跡、選択状態が操作そのものの意味を持つ。レガシー画面では、表示されたDOMの新旧が同居しているため、CSSの読み込み順や既存IDへの依存を壊すと機能退行につながる。

したがって、移行の完了条件は「HEX/RGBAが減ったこと」ではなく、次の四つをすべて満たすことである。

| 観点 | 完了条件 |
|---|---|
| 意味 | 色が値ではなく、ピッチ・線・警告・surfaceなどの役割で参照される。 |
| 視認性 | light/dark、任意のチームカラー、ホーム/アウェイの組合せで操作対象を識別できる。 |
| 互換性 | 既存のDOM ID、イベント、保存済み`objects[].color`、モーダル呼出しを変更しない。 |
| 配信 | CSS・JS・Service Worker世代を同時に更新し、オンライン・オフラインの両方で同一表示になる。 |

> **許容する具体色の置き場所**は、テーマの基底値とCanvasパレット定義だけである。`drawing.css`、`tactical.css`、`components.css`、および描画関数の分岐に、意味を説明できない個別HEX/RGBAを残さない。

## 2. 現状と移行境界

監査対象の278件はCSSの画面・部品層だけを数えたものであり、Canvasへ実際に描画する`drawing.js`内の`fillStyle`／`strokeStyle`の値は別管理である。したがって、CSS上の92件をゼロにしても、JavaScript側の色分岐を中央化しなければ、再発の入口は残る。

| 対象 | CSS内の残件数 | 主な現行実装 | 移行先 |
|---|---:|---|---|
| `CSS/drawing.css` | 61 | キャンバス周囲、ピッチ枠、ツールチップ、選択UI、プレーヤーバー、インスペクタ、ドロワー | UIセマンティックトークン、Canvas操作UIトークン |
| `CSS/tactical.css` | 31 | ピッチ地面、ライン、グリッド、フォーメーションノード、名前ラベル | Canvasピッチトークン、Canvas注釈トークン |
| `drawing.js`（監査外） | 別途台帳化 | `fillStyle`／`strokeStyle`、オブジェクト初期色、アウトライン、ホーム/アウェイのフォールバック | `canvas-palette.js`の解決関数 |
| `CSS/components.css` | 66 | 旧`.modal`／`.modal-overlay`、更新通知、共有・ワークスペース・シーズンレポート・インサイト等の画面固有規則 | `c-modal`、`c-notice`、`c-toast`、surface・状態トークン |

## 3. 戦術Canvas（92件）の移行ロードマップ

### C0 — 色台帳と描画パレットの固定

最初に、色値そのものではなく用途を台帳化する。`drawing.css`、`tactical.css`、`drawing.js`の各色を、ピッチ・線・チーム・練習器具・選択・注釈・補助UI・exportのどれか一つに必ず分類する。同じ`#ffffff`でも、ボール本体、選手ラベルの文字、ポップオーバーsurface、export背景は別の役割として扱う。

| 新しい役割名 | 初期値の例 | 用途 | テーマ切替方針 |
|---|---|---|---|
| `--canvas-workspace-surface` | 現行の淡い背景 | ピッチ外の作業領域 | light/darkで切替 |
| `--canvas-pitch-surface` | 現行の芝面 | ピッチ本体 | 原則一定。テーマでは周囲だけを変える |
| `--canvas-pitch-line` | 現行の濃いライン | センターライン、枠、ペナルティエリア | 芝とのコントラストを基準に固定 |
| `--canvas-grid-line` | 低不透明度のライン | カスタム配置用グリッド | ピッチ面との識別を維持 |
| `--canvas-object-player` | チーム色または既定選手色 | 選手オブジェクト | チーム入力値を優先 |
| `--canvas-object-marker` / `--canvas-object-cone` | 橙／黄 | 練習器具 | 種別識別を優先して固定 |
| `--canvas-object-ball` / `--canvas-object-outline` | 白／濃色 | ボールと小物の輪郭 | 背景とのコントラストで解決 |
| `--canvas-object-vision` / `--canvas-object-annotation` | 水色系 | 視野、軌跡、テキストなどの注釈 | ピッチ面との識別を優先 |
| `--canvas-selection` | 現行の強調色 | 選択中の枠、操作ハンドル | テーマのaction色に追従 |
| `--canvas-overlay-surface` / `--canvas-overlay-text` | 半透明暗色／白 | ツールチップ、名前ラベル、テロップ | light/darkで最小限調整 |

この段階では既存の保存データを一切変更しない。`red`、`blue`、旧HEX、任意のチームカラーはそのまま保存し、描画時にだけ新しい解決関数へ渡す。

### C1 — CSSピッチ構造をトークン化する

`CSS/tactical.css`の31件を最初の実装波とする。ここはピッチ面、ライン、グリッド、ノード名ラベルが中心であり、Canvasのマウス・タッチ操作、保存処理、フォーメーション配置には触れずに移行できる。

具体的には、`#f1f5f9`を`--canvas-workspace-surface`または`--canvas-pitch-surface`へ、`#334155`を`--canvas-pitch-line`へ、グリッド用`rgba(51, 65, 85, 0.07)`を`--canvas-grid-line`へ置換する。`.tactical-pitch`の背景、センターライン、円、ペナルティエリア、ゴールエリア、コーナーアーク、スポットはすべて同じ`--canvas-pitch-line`を用いる。これにより、同じラインに異なる色が混ざることを防ぐ。

**C1の完了条件**は、`CSS/tactical.css`の直接指定色を0件にし、カスタムフォーメーション、ハーフコート、通常ピッチ、モバイル表示で線・枠・ノード名が読めることである。

### C2 — 作図周辺UIを「一般UI」と「Canvas専用UI」に分離する

`CSS/drawing.css`の61件は、Canvasそのものではない作業領域UIを多く含む。まず一般UIへ戻せるものを既存の`--color-surface`、`--color-surface-subtle`、`--color-border`、`--color-text`、`--color-text-muted`、`--color-focus`、`--shadow-*`へ寄せる。対象はインスペクタ、プレーヤーバー、入力欄、ドロワー、ポップオーバー、ツールチップ、同期状態である。

一方、ピッチ外の作業面、選択ハンドル、Canvas上の注釈、オブジェクト選択色は、画面一般のsurfaceトークンと混ぜず、C0で定義したCanvas専用トークンを使う。この分離により、ダークモードでアプリ画面を暗くしても芝・線・ボールの意味が崩れない。

**C2の禁止事項**は、`var(--token, #hex)`のように新しいフォールバックHEXを画面規則へ残すことである。フォールバックが必要なら、トークンの定義側に一箇所だけ置く。

### C3 — JavaScriptの描画色を解決層へ集約する

`drawing.js`には、オブジェクト種別別の初期色、`red`／`blue`などの旧名称、輪郭色、ホーム・アウェイの既定色、画像export用の背景色が分散している。ここを`canvas-palette.js`（または既存作図モジュール内の単一`resolveCanvasColor()`）へ集約する。

```js
// 設計例。保存値は変更せず、描画直前にだけ解決する。
const palette = getCanvasPalette(document.documentElement, { homeColor, awayColor });
const fill = resolveCanvasObjectColor(object, palette);
const outline = resolveCanvasOutline(fill, palette);
ctx.fillStyle = fill;
ctx.strokeStyle = outline;
```

`getCanvasPalette()`はCSSカスタムプロパティを`getComputedStyle()`から読み、Canvas APIが受け取れる実色値として返す。テーマ切替時はキャッシュを破棄して再描画する。保存済みの`objects[].color`、`team`、`type`、フォーメーションの座標、undo/redo履歴の形式は変更しない。

輪郭色は「白または黄なら濃い輪郭、それ以外なら白」というハードコード分岐を、相対輝度または定義済みの`--canvas-object-outline-light`／`--canvas-object-outline-dark`で解決する。これにより、ユーザーが任意チームカラーを設定しても選手番号・境界が読める。

exportは画面と同じ解決済みパレットを渡す。export専用に別の色を持つ場合も、`--canvas-export-background`などの明示的な役割に限定し、画面と出力で色の意味が変わらないようにする。

### C4 — 視覚回帰と操作回帰を追加する

既存P40は作図CanvasのDOM ID、ツールドック、個別配置、図形・線・ラダー、undo/redo、フォーメーション一括配置、フレーム、保存先を保護している。色移行ではP40を変更せずに通すことを前提とし、追加のP51（提案）で次を検証する。

| 検証 | 内容 |
|---|---|
| パレット契約 | `drawing.css`と`tactical.css`に直接指定色を追加しない。`drawing.js`の`fillStyle`／`strokeStyle`は解決層以外で直接色を使わない。 |
| 保存互換 | `red`、`blue`、旧HEX、カスタムHEXを含む既存オブジェクトを読み込み、同じ種別・位置・teamで再描画できる。 |
| 視認性 | light/dark、既定赤、青、緑、低明度の任意チーム色で、選手・ボール・コーン・マーカー・視野・軌跡・選択枠が識別できる。 |
| 操作 | マウス・タッチ、選択、回転、削除、undo/redo、一括配置、フレーム切替、保存、exportを確認する。 |
| レスポンシブ | 360px幅、タブレット幅、横向きスマホでツールドック、ピッチ、インスペクタ、プレーヤーバーが重ならない。 |

### C5 — Canvas移行の完了と運用化

C1からC4が通った後に、`CSS/drawing.css`と`CSS/tactical.css`の92件を0件にする。ただし、`tokens.css`や`canvas-palette.js`の「パレット定義値」までゼロにする必要はない。色を消すのではなく、値の所有者を一箇所に限定することが目的である。

完了後は、作図ツールを追加するときに、種別名・既定色役割・選択輪郭・暗いチーム色での可読性・export表示を`ICON_SYSTEM.md`またはCanvasパレット台帳に登録する。

## 4. レガシー画面・モーダル（66件）の移行ロードマップ

### L0 — セレクタ台帳とDOM依存の固定

`CSS/components.css`の66件は「すべてがモーダル」ではない。旧`.modal`／`.modal-overlay`、PWA更新通知、親共有、ワークスペース管理、シーズンレポート、コーチングインサイト、練習計画など、画面固有の古い規則を含む。移行前に各規則を「呼出し箇所」「DOM ID／クラス」「PC・モバイル状態」「使う意味色」「置換先部品」「削除予定リリース」で台帳化する。

この台帳を先に作る理由は、同名セレクタが後勝ちのCSS順序に依存している場合があるためである。`grep`で色だけを置換しても、旧規則が`c-modal`の後に勝つと、v1.30.86で解消した見た目の不一致が再発する。

### L1 — モーダルshellを完全に一本化する

v1.30.86で`c-modal`と`c-modal--legacy`のsurface、radius、shadow、overlay、header、actions、hidden遷移は共通化済みである。次の波では、旧`.modal`／`.modal-overlay`を「未移行マークアップにのみ暫定適用」する状態から、呼出し元のマークアップを順番に`c-modal`へ置き換える。

| 移行対象 | 置換先 | 維持するもの | 削除判定 |
|---|---|---|---|
| 旧overlayの黒アルファ、白面、枠線、shadow | `--color-overlay-scrim`、`--color-surface-raised`、`--color-border`、`--shadow-md` | 開閉イベント、focus復帰、背景スクロール制御、DOM ID | `:not(.c-modal-overlay)`の対象が0件になった時点 |
| 画面ごとの見出し・本文・footer | `c-modal__header`、`c-modal__body`、`c-modal__actions` | ボタン文言、submit/cancelのイベント、入力値 | 個別のmodal shell規則が不要になった時点 |
| 旧glass面・独自RGBA | 共通surface／glassは必要時だけ`--glass-*` | 読みやすい本文surfaceを優先 | 旧glass前提の個別背景が0件になった時点 |

この波では、モーダルのDOM IDや`openModal`呼出しを変更しない。クラスを追加して既存イベントをそのまま使い、各モーダルを一つずつ切り替える。更新履歴モーダルで確立した方式を基準実装とする。

### L2 — 状態通知を`c-notice`／`c-toast`に統合する

`pwa-update-banner`、共有時の注意、ワークスペース・シーズンレポートの補助文、警告メッセージには、成功・情報・警告・危険の面、文字、境界、操作色が重複している。これらを値で置換せず、`c-notice--info`、`c-notice--warning`、`c-notice--success`、`c-toast--*`へ移す。

追加が必要な場合は、`--color-notice-<status>-surface`、`--color-notice-<status>-text`、`--color-notice-<status>-border`のように状態名を持つトークンだけを定義する。例えば、親共有の注意表示にある黄系の文字・面・境界は、警告として一組にし、別画面の注意にも同じ役割で再利用する。

PWA更新通知は「新しい版を適用する」という強い操作を含むため、単なる緑色の個別バナーとして残さない。`c-notice--success`または更新用の`c-update-notice`を基盤部品として定義し、文字、更新ボタン、閉じるボタン、safe-area、キーボード操作を共通化する。

### L3 — 画面固有ブロックを共通レイアウトへ寄せる

親共有、ワークスペース管理、シーズンレポート、コーチングインサイト、練習計画は、次の順で移す。ユーザー影響の小さい説明・注意ブロックから始め、入力・保存を含む画面は最後にする。

| 順序 | 対象 | 置換先 | リスクと確認 |
|---:|---|---|---|
| 1 | 親共有・ワークスペース・レポートの補助文 | `c-notice`、`c-text-muted`、`c-actions` | 文章折返し、警告色、360px表示 |
| 2 | 更新通知・成功／失敗状態 | `c-update-notice`、`c-toast` | Service Worker待機、閉じる操作、再読込 |
| 3 | 指標・比較・情報カード | `c-data-row`、`c-metric`、`c-section` | 長い日本語名、数値右寄せ、空状態 |
| 4 | 練習計画・共有・ワークスペースの入力モーダル | `c-modal`、`c-input`、`c-modal__actions` | 入力値、保存・取消、focus、モバイルキーボード |

L3では、一画面ごとに「色の移行」「クラスの標準化」「レスポンシブ確認」を同じコミットに含める。複数画面をまとめて置き換えないため、視覚差分が起きたときに原因を切り分けられる。

### L4 — 互換セレクタの隔離・削除と再発防止

全呼出し元が`c-modal`、`c-notice`、`c-toast`、`c-section`へ移った後に、旧`.modal`、`.modal-overlay`、個別RGBA、画面固有の成功・警告面を削除する。削除前には未参照セレクタを検索し、テンプレート文字列を含めて利用箇所ゼロであることを確認する。

追加のP52（提案）では、`CSS/components.css`の直接指定色を0件とし、新規`.modal`／`.modal-overlay`規則、`var(--token, #hex)`形式、許可されない状態色が入らないことを検査する。P45の状態部品・toast・確認ダイアログ、P49のモーダル・ランキング・練習管理を合わせて必須ゲートにする。

## 5. 推奨リリース順序

以下の順なら、戦術盤の安全性を優先しながら、優先度P0であるレガシーモーダルの残債を先に減らせる。各波は単独でリリース・ロールバックできる小さな変更単位にする。

| リリース波 | 実装内容 | 削減見込み | 必須ゲート |
|---|---|---:|---|
| R1 | L0台帳、C0台帳、Canvasパレット契約・基準スクリーンショット | 0件 | 既存41テスト、P40、P43、P45、P49 |
| R2 | L1モーダル呼出しの移行、状態トークンの不足分追加 | レガシーから段階削減 | P45、P49、モバイルfocus確認 |
| R3 | C1の`tactical.css`置換 | 31件 | P40、P43、light/dark・カスタム編成確認 |
| R4 | L2/L3の通知・説明ブロック・更新通知の共通化 | レガシーから段階削減 | P45、P47、PWA更新・オフライン確認 |
| R5 | C2/C3の`drawing.css`と描画解決層の移行 | 61件 | P40、P43、P51、export・保存互換確認 |
| R6 | L4の未参照規則削除、監査・文書更新 | レガシー66件を0件 | P45、P49、P50、P52、レスポンシブ検証 |

「件数が減った」だけでR6へ進まず、各波で`node tests/run-contract-tests.mjs`、`node tests/run-responsive-validation.mjs`、`node tests/p34-dynamic-color-theme-test.mjs`、`node scripts/analyze-direct-color-debt-v13086.mjs`、`git diff --check`を実行する。Canvasを変更するR3/R5では、P40・P43に加えて、実機相当のマウスとタッチ操作を確認する。

## 6. PWA・ロールバック運用

CSSトークン、`drawing.js`、新しいパレットモジュールを同じリリースに含める場合、Service Workerのprecache世代を更新し、新規資産を必ずprecache一覧へ追加する。HTMLだけが新しく、オフライン時に旧JSが残る状態は避ける。

ロールバックは、データ形式を変えないことを前提に「前リリースのCSS・JS・Service Worker世代へ戻す」だけで成立させる。保存済み`objects[].color`を新フォーマットに書き換えないため、Canvasパレットの不具合があっても利用者データの変換・復元は不要である。

## 7. 目標状態

最終的に、`CSS/tactical.css`と`CSS/drawing.css`の92件、`CSS/components.css`の66件を画面・部品層からなくす。具体色はトークンとCanvasパレットにだけ存在し、各色の意味、テーマ時の振る舞い、保存値との関係、テストが台帳化されている状態を目標とする。

この状態になれば、新しい作図ツール、モーダル、通知、チームカラーを追加しても、個別HEX/RGBAを画面へ足すのではなく、既存の役割トークンまたは台帳化済みのCanvasパレットを選ぶだけで拡張できる。

## 参照

- `reports/direct-color-debt-analysis-v13086.md` — 278件の監査基準、ファイル別残債、優先順位
- `CSS/tokens.css` — 現行セマンティックトークンとlight/dark設計
- `CSS/drawing.css`、`CSS/tactical.css` — Canvas・戦術盤の92件の直接指定色
- `drawing.js` — Canvas描画、保存、export、チームカラー解決
- `tests/p40-drawing-regression-test.mjs` — 作図機能の既存回帰契約
- `tests/p43-drawing-icon-clarity-test.mjs` — 作図ツールの意味・ラベル・ARIA契約
- `tests/p45-state-components-test.mjs`、`tests/p49-modal-ranking-practice-consistency-test.mjs` — 状態部品・モーダル関連の既存契約
