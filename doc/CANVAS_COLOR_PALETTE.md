# Canvas Color Palette

## 目的

戦術盤・作図・動画分析で使う色の意味を、一般UIのセマンティックトークンと分離して管理する。Canvas APIはCSSカスタムプロパティをそのまま解釈できないため、`canvas-palette.js`が計算済みCSS色を解決し、描画関数へ渡す唯一の窓口となる。

## 所有者と利用規則

| 層 | 責務 | 直接色の扱い |
|---|---|---|
| `CSS/tokens.css` | light/darkごとのCanvasパレット値を定義する | パレット定義として許可 |
| `canvas-palette.js` | CSS計算値の読み出し、保存済み色の互換解決、輪郭色の判定 | パレットフォールバックとして許可 |
| `CSS/drawing.css` / `CSS/tactical.css` | UI・ピッチの役割トークンを利用する | 直接色は禁止 |
| `drawing.js` / `pitch-renderer.js` | 解決済みパレットをCanvasへ描画する | 解決層外の直接色は禁止 |

## パレット役割

| 役割接頭辞 | 主な用途 | テーマとの関係 |
|---|---|---|
| `--canvas-workspace-*` | ピッチ外の作業領域 | アプリのlight/darkテーマへ追従 |
| `--canvas-pitch-*` | ピッチ面、ライン、ガイド、グリッド | 芝と線の視認性を優先して独立管理 |
| `--canvas-object-*` | 選手、ボール、コーン、マーカー、ラダー、視野、注釈 | 種別識別を優先し、保存済みのカスタム色を尊重 |
| `--canvas-selection-*` | 選択枠、ハンドル、選択面 | チームのaction色と操作識別を両立 |
| `--canvas-overlay-*` | 選手名、ツールチップ、テロップ | 文字可読性を優先 |
| `--canvas-chrome-*` | Canvas周辺の入力・補助UI | 一般surface・textトークンへ追従 |

## 保存互換性

既存の`objects[].color`、`objects[].team`、`objects[].type`の形式は変更しない。`red`、`blue`、`green`、`orange`などの旧名称は、`resolveCanvasObjectColor()`で対応する役割色へ解決する。HEX等の任意色は利用者の設定としてそのまま優先する。

## 新しい作図ツールを追加するとき

新しいツールには、オブジェクト種別、既定の`--canvas-object-*`役割、選択時輪郭、light/darkでの可読性、export表示を登録する。画面CSSや描画関数へ直接HEX/RGBAを追加してはならない。パレットに新しい役割が必要な場合だけ、`tokens.css`と`canvas-palette.js`を同じ変更で更新する。

## 検証

P40の作図機能回帰、P43のツール意味・ARIA、P51のCanvasパレット契約、レスポンシブ検証、dynamic theme検証を通す。さらに、既存データの読み込み、ホーム／アウェイの任意色、undo/redo、フォーメーション一括配置、exportを手動確認する。
