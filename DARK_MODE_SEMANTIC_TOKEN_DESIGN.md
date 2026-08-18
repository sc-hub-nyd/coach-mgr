# CoachMgr：セマンティックカラートークンによるダークモード拡張設計

## 1. 結論

CoachMgrのダークモードは、`body`へ暗い背景色を追加するだけの「色反転」ではなく、**チームテーマ・色彩モード・高コントラストを独立した軸として合成する**方式にするべきです。現在の実装は、チームテーマの基礎変数を`base.css`、部品が使う意味トークンを`tokens.css`に分けているため、この方式を採用しやすい構造です。

> **チームテーマはブランド・チームらしさを決め、カラーモードは明暗を決め、高コントラストは視認性を強める。**
>
> この3つを同じ設定値に混ぜず、CSS変数の層で合成します。

| 軸 | 役割 | 例 | 保存先 |
|---|---|---|---|
| チームテーマ | 主色・補助色・印象 | Field Green、Ocean Blue、Redline | チーム設定（既存） |
| カラーモード | 表面・文字・境界の明暗 | system、light、dark | 端末別UI設定 |
| 視認性モード | 高コントラスト・動きの抑制 | standard、high-contrast | 端末別UI設定 |

この分離により、たとえば「Ocean Blue × dark × high-contrast」でも、部品のコードを変えずに一貫した表示が可能になります。

## 2. なぜセマンティックトークンが必要か

`#ffffff`や`#16231e`のような具体色を各コンポーネントへ書くと、ダークモードで置換漏れが発生します。一方、`--color-surface`、`--color-text`、`--color-border`、`--color-action`のように**用途名**で参照すれば、モード切替ではトークンの値だけを交換できます。

デジタル庁は、色がブランドを体現すると同時にコンポーネントの意味・機能に一貫性を与えると説明しています。[1] SmartHRも、部品で色を選ぶ負担を減らすため、役割に応じた色名を定義しています。[2] CoachMgrではこの考え方を、テーマ変更とダークモード変更の両方に適用します。

### 2.1 現行構造の評価

CoachMgrには既に以下の2層があります。

| 現在の層 | 代表変数 | 評価 | ダークモードでの扱い |
|---|---|---|---|
| テーマプリミティブ | `--primary`、`--bg-color`、`--card-bg`、`--text-primary` | チームテーマを表現できる | light/darkごとに値を持たせる |
| セマンティックトークン | `--color-surface`、`--color-text`、`--color-action`、`--color-danger` | 部品から具体色を分離できる | 原則として名前を増やさず値を差し替える |
| コンポーネント | `c-form-field`、`c-roster-row`、`c-practice-card`、`c-modal` | 表面・境界・状態を共通利用できる | セマンティックトークンのみ参照する |

ここで不足しているのは、**明暗モード専用のプリミティブ階調**と、オーバーレイ・スクロールバー・グラフ・画像・ネイティブフォームまでを含む切替契約です。

## 3. 推奨するトークン階層

### 3.1 4層に分ける

```text
Layer 0  固定値・基礎階調      neutral-0…1000 / green-… / blue-…
Layer 1  テーマプリミティブ      theme-primary / theme-accent / theme-status-*
Layer 2  セマンティックトークン  color-surface / color-text / color-action / …
Layer 3  部品トークン            button-primary-bg / roster-row-border / …
```

| 層 | 変更してよい場所 | 変更しない場所 | 目的 |
|---|---|---|---|
| Layer 0 | デザイントークン定義 | コンポーネント | 明度・彩度の一貫した材料を提供 |
| Layer 1 | チームテーマ・light/darkモード | 部品 | チームらしさと明暗モードを合成 |
| Layer 2 | 光・暗・高コントラストで値を上書き | コンポーネントのHTML | 意味を安定させる |
| Layer 3 | 部品実装 | 画面固有CSS | 部品内の役割を明確にする |

### 3.2 必要なセマンティックトークン

現在のトークンを拡張して、ダークモードでは次の役割を明示します。

| トークン | light時の役割 | dark時の役割 | 備考 |
|---|---|---|---|
| `--color-canvas` | アプリ全体の背景 | 最も暗い背景面 | 純粋な黒は常用しない |
| `--color-surface` | カード・入力の基本表面 | canvasより一段明るい表面 | 境界と必ず対で定義 |
| `--color-surface-raised` | モーダル・浮上面 | surfaceよりわずかに明るい面 | 影ではなく明度差で分離 |
| `--color-surface-subtle` | 控えめな領域・行背景 | 明度差の小さい暗色面 | zebra・補足領域に使用 |
| `--color-surface-selected` | 選択行・active状態 | 主色の低彩度コンテナ | 強い主色で面を塗りつぶさない |
| `--color-text` | 標準本文 | 明るい本文 | 4.5:1以上を検証 |
| `--color-text-muted` | 補足・メタ情報 | 読めるが控えめな文字 | opacityで薄くしない |
| `--color-border` | 標準境界 | 暗い面で見える境界 | 3:1以上を検証 |
| `--color-border-strong` | 入力・区切り・強調境界 | より明瞭な境界 | focusと混同しない |
| `--color-action` | 主操作の背景・リンク基調 | 暗い面に対して読める主色 | `on-action`と対で定義 |
| `--color-text-on-action` | 主操作内の文字 | 同左 | action背景と4.5:1以上 |
| `--color-focus` | フォーカス輪郭 | 暗い面にも見える輪郭 | テーマ主色と独立可能にする |
| `--color-scrim` | モーダル背景の遮蔽 | 同じ意味の半透明暗幕 | `rgba(0,0,0,…)`を直書きしない |
| `--color-overlay-hover` | hover・pressの重ね色 | 同じ意味の透明色 | 色の濃淡ではなく状態名で参照 |
| `--color-success-*` | 成功の文字・面・境界 | dark用の文字・面・境界 | 3値セットに分ける |
| `--color-warning-*` | 注意の文字・面・境界 | dark用の文字・面・境界 | 黄文字を暗面へ直置きしない |
| `--color-danger-*` | エラーの文字・面・境界 | dark用の文字・面・境界 | 赤を黒へ直置きしない |
| `--color-info-*` | 情報の文字・面・境界 | dark用の文字・面・境界 | 同上 |

状態色は単一の`--color-danger`だけで済ませず、以下の3点を持たせます。これはdark面で「淡い面」「読める文字」「識別できる境界」が別の明度を必要とするためです。

```css
/* 状態色は text / surface / border の3点セットにする */
--color-danger-text: var(--theme-danger-strong);
--color-danger-surface: var(--theme-danger-subtle);
--color-danger-border: var(--theme-danger-border);
```

## 4. CSS設計：テーマ × モード × 視認性

### 4.1 適用優先順位

推奨優先順位は、**ユーザーが明示した端末設定 > 高コントラスト > OS設定 > 既定light**です。OSの`prefers-color-scheme`は、利用者がOSまたはブラウザで選んだ明暗設定を検出します。[3] ただし、CoachMgrは現場の屋外利用やチーム運用があるため、OS追従だけにせず明示的な選択を保存します。

```text
1. data-color-mode="light"  → 常にlight
2. data-color-mode="dark"   → 常にdark
3. data-color-mode="system" → prefers-color-schemeへ追従
4. high-contrast-mode        → 選択済み明暗モードの上から視認性だけを強化
```

### 4.2 HTMLとブラウザUI

`<head>`には、CSS読み込み前に次を置きます。`color-scheme`を宣言すると、対応ブラウザのcanvas、スクロールバー、ネイティブフォーム、スペルチェック表示などが選択中のスキームに整合します。[4]

```html
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f3f7f4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1715" media="(prefers-color-scheme: dark)">
```

CSSにも基準を置きます。

```css
:root {
  color-scheme: light dark;
}

:root[data-color-mode="light"] { color-scheme: light; }
:root[data-color-mode="dark"]  { color-scheme: dark; }
```

### 4.3 基礎階調とテーマプリミティブ

以下は設計例です。最終色はコントラスト自動テストで確定します。

```css
:root {
  /* Layer 0: neutral scale */
  --neutral-0: #ffffff;
  --neutral-25: #f8fafc;
  --neutral-50: #f1f5f9;
  --neutral-100: #e2e8f0;
  --neutral-200: #cbd5e1;
  --neutral-600: #475569;
  --neutral-700: #334155;
  --neutral-800: #1e293b;
  --neutral-900: #0f172a;
  --neutral-950: #08111f;
}

/* 既定：Field Green × light */
:root,
:root[data-color-mode="light"] {
  --theme-primary: #13795b;
  --theme-primary-hover: #095c43;
  --theme-primary-soft: #ddf3e9;
  --theme-canvas: #f3f7f4;
  --theme-surface: #ffffff;
  --theme-surface-raised: #ffffff;
  --theme-text: #16231e;
  --theme-text-muted: #60736a;
  --theme-border: rgba(22, 35, 30, 0.10);
}

/* Field Green × dark */
:root[data-color-mode="dark"] {
  --theme-primary: #53d49a;
  --theme-primary-hover: #79e6b2;
  --theme-primary-soft: #173c2d;
  --theme-canvas: #0b1511;
  --theme-surface: #12211a;
  --theme-surface-raised: #193026;
  --theme-text: #edf7f1;
  --theme-text-muted: #b6c9bf;
  --theme-border: rgba(237, 247, 241, 0.15);
}
```

`body.theme-ocean-blue`などのチームテーマは、`--theme-primary`、`--theme-primary-hover`、`--theme-primary-soft`と、light/darkそれぞれのsurface・text・border値だけを上書きします。**チームテーマはセマンティックトークンを直接上書きしません。**

### 4.4 セマンティックAPIの固定

トークン名はlightとdarkで絶対に変えません。コンポーネントはモードを意識しません。

```css
:root {
  /* Layer 2: semantic API */
  --color-canvas: var(--theme-canvas);
  --color-surface: var(--theme-surface);
  --color-surface-raised: var(--theme-surface-raised);
  --color-surface-subtle: color-mix(in srgb, var(--theme-surface) 84%, var(--theme-canvas));
  --color-surface-selected: var(--theme-primary-soft);

  --color-text: var(--theme-text);
  --color-text-muted: var(--theme-text-muted);
  --color-border: var(--theme-border);
  --color-border-strong: color-mix(in srgb, var(--theme-text) 28%, var(--theme-border));

  --color-action: var(--theme-primary);
  --color-action-hover: var(--theme-primary-hover);
  --color-text-on-action: #ffffff;
  --color-focus: #f2c14e;

  --color-scrim: rgba(0, 0, 0, 0.56);
  --color-overlay-hover: color-mix(in srgb, var(--color-text) 8%, transparent);
}
```

> 注意：`--color-text-on-action: #ffffff`は常に安全ではありません。Ocean BlueやHigh Visibilityのように明るい主色を使うテーマでは、`--color-text-on-action`をテーマ別・モード別に`#0f172a`へ切り替える必要があります。**背景と前景は必ずセットでテスト**します。[5]

### 4.5 OS追従は「system」だけに限定する

明示設定がない場合だけ、OSの設定に従います。

```css
:root[data-color-mode="system"] {
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root[data-color-mode="system"] {
    --theme-primary: #53d49a;
    --theme-primary-hover: #79e6b2;
    --theme-primary-soft: #173c2d;
    --theme-canvas: #0b1511;
    --theme-surface: #12211a;
    --theme-surface-raised: #193026;
    --theme-text: #edf7f1;
    --theme-text-muted: #b6c9bf;
    --theme-border: rgba(237, 247, 241, 0.15);
  }
}
```

`@media (prefers-color-scheme: dark)`の中にコンポーネントセレクタを追加してはいけません。そこには**トークン値だけ**を置きます。これがテーマ数・画面数の増加に耐えるポイントです。

## 5. コンポーネントの実装規則

### 5.1 画面固有の具体色を禁止する

```css
/* 禁止：light前提の具体色 */
.practice-card { background: #ffffff; color: #16231e; }

/* 許可：意味トークン */
.c-practice-card {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}
```

移行対象の優先順位は次の通りです。

| 優先度 | 対象 | ダークモードで起きやすい問題 | 対処 |
|---:|---|---|---|
| 1 | app shell、topbar、sidebar、bottom nav | 白固定、半透明白、影が強すぎる | `surface`、`scrim`、`border`へ置換 |
| 2 | form、select、textarea、checkbox | ブラウザ標準のlight部品が残る | `color-scheme` + 背景・文字・境界を指定 |
| 3 | cards、modals、drawers | surfaceの階層が消える | canvas/surface/raisedを使い分ける |
| 4 | badges、status、alerts | 赤・黄・緑が読めない | `text/surface/border`の状態3点セットへ置換 |
| 5 | charts、pitch、画像、SVG | 色だけに情報を預ける | ラベル・パターン・凡例を併用し、別トークン化 |
| 6 | shadow・overlay・blur | darkで汚く見える、白く発光する | shadowを弱め、scrim・border中心へ変更 |

### 5.2 Component tokenを必要な場所だけ追加する

すべての部品に大量の変数を生やす必要はありません。共有可能な部品だけに「意味が一段具体化した」変数を持たせます。

```css
.c-modal {
  --modal-bg: var(--color-surface-raised);
  --modal-border: var(--color-border-strong);
  --modal-scrim: var(--color-scrim);
  background: var(--modal-bg);
  border-color: var(--modal-border);
}

.c-roster-row {
  --roster-row-bg: var(--color-surface);
  --roster-row-divider: var(--color-border);
  --roster-row-selected: var(--color-surface-selected);
}
```

この部品トークンは、将来「試合当日用の高視認モードでは名簿選択面だけをさらに明確にする」といった要求に対して有効です。

## 6. 高コントラストとの関係

現在の`high-contrast-mode`は、個別セレクタへ白・黒・濃紺を上書きする実装が多く、darkモードを追加すると競合が増えます。新設計では、`high-contrast-mode`もセマンティックトークンを上書きするだけに寄せます。

```css
:root.high-contrast-mode,
body.high-contrast-mode {
  --color-text: #ffffff;
  --color-text-muted: #f1f5f9;
  --color-border: #ffffff;
  --color-border-strong: #ffffff;
  --color-focus: #fde047;
  --color-surface-subtle: var(--color-surface);
  --shadow-sm: 0 0 0 2px var(--color-border-strong);
}
```

ただし、light × high contrastとdark × high contrastは異なる最終ペアになります。以下のようにテストケースを分けます。

| モード | canvas | text | border | 主操作 |
|---|---|---|---|---|
| light / standard | 淡いチーム背景 | 濃い本文 | 控えめな境界 | チーム主色 |
| dark / standard | 深い中性色 | 明るい本文 | 明るい低彩度境界 | 明るい主色 |
| light / high contrast | 白〜淡灰 | 黒〜濃紺 | 濃紺 | 濃紺または十分暗い主色 |
| dark / high contrast | 黒〜濃紺 | 白 | 白 | 高輝度だが十分な文字コントラストを満たす色 |

WCAG 2.2では通常テキストに4.5:1以上を求め、文字・背景の組を明示的に指定しなければ評価できないとしています。[5] また、色相の違いだけでは可読性を担保できないため、ダークモードでは特に「赤文字を黒背景へ置く」「低彩度グレーを背景と近づける」ことを避けます。[5]

## 7. PWA・設定画面の統合

### 7.1 端末別設定を追加する

CoachMgrには既に、`fontScale`、`preferredHand`、`reduceMotion`、`compactMode`を端末別に保存・適用する仕組みがあります。ここへ次の値を加えます。

```js
export const DEFAULT_UI_PREFERENCES = Object.freeze({
  fontScale: 'normal',
  preferredHand: 'right',
  reduceMotion: false,
  compactMode: false,
  colorMode: 'system',       // system | light | dark
  contrastMode: 'standard'   // standard | high
});
```

`applyUiPreferences`は、現在の`data-font-scale`等と同様に、`document.documentElement`へ属性を設定します。

```js
root.dataset.colorMode = ['system', 'light', 'dark'].includes(next.colorMode)
  ? next.colorMode
  : 'system';
root.dataset.contrastMode = next.contrastMode === 'high' ? 'high' : 'standard';
```

高コントラストは既存クラスとの互換のため、移行中は`body.classList.toggle('high-contrast-mode', ...)`も併用し、最終的に`data-contrast-mode`へ寄せます。

### 7.2 設定UIの構成

表示・操作設定には、次の選択肢を追加します。

| 項目 | 選択肢 | 説明 |
|---|---|---|
| カラーモード | 端末に合わせる / ライト / ダーク | 夜間練習・屋外・個人の視認性に合わせる |
| コントラスト | 標準 / 高コントラスト | 文字・境界・フォーカスをより明瞭にする |

説明文には「この設定はこの端末だけに保存され、チームの他利用者には影響しない」と明記します。初回既定は`system`とし、ユーザーが明示的に選べることを優先します。

### 7.3 PWAのtheme-color

`meta[name="theme-color"]`は、OS追従だけでなく、明示的なlight/dark設定変更時にもJavaScriptで更新します。これにより、Androidのブラウザ・インストール済みPWAでアドレスバーやタスクスイッチャーの色がアプリ面と整合します。`color-scheme`はブラウザ提供UIの色にも影響するため、アプリ本体のトークンと必ず同じモードを示します。[4]

## 8. データ可視化・画像・試合当日UIの追加注意点

### 8.1 グラフ

グラフには`--chart-series-1`など、画面用トークンを別に持たせます。カテゴリは色だけで区別せず、凡例、値、線種、パターン、選択状態を併用します。WCAGはグラフなどの非テキスト情報について、近傍のテキストや代替説明で値の認識を補うよう示しています。[1]

```css
:root {
  --chart-grid: var(--color-border);
  --chart-label: var(--color-text-muted);
  --chart-series-1: var(--color-action);
  --chart-series-2: var(--color-info-text);
  --chart-series-3: var(--color-success-text);
  --chart-series-4: var(--color-warning-text);
}
```

### 8.2 ピッチ図・写真・外部画像

サッカーのピッチ図や写真をdark化するためにCSSの`filter: invert()`を使ってはいけません。チームユニフォーム、選手写真、芝の意味が崩れ、画像内テキストの可読性も悪化するためです。以下を分けます。

| 資産 | 方針 |
|---|---|
| CSSで描くピッチ・図形 | `pitch-surface`、`pitch-line`、`pitch-marker`を個別トークン化 |
| アイコン | `currentColor`を使い、親の`color`へ追従させる |
| 写真 | 原則そのまま。必要ならscrimまたは読める文字面を重ねる |
| ロゴ・チームエンブレム | light/darkの正規バリアントを用意。自動反転しない |
| SVG | `fill="#fff"`の固定値を避け、`currentColor`またはテーマ変数を使う |

## 9. 検証仕様

ダークモード導入の品質は、色が「黒っぽくなった」ことで判断しません。以下をリリースゲートにします。

| 分類 | 検証内容 | 最低ケース |
|---|---|---|
| 表示組合せ | theme × color mode × contrast mode | Field Green / Ocean Blue / Midnight × light/dark × standard/high |
| 画面幅 | 横溢れ・安全領域・入力の可視性 | 320、390、768、1024、1440px |
| 色ペア | text・border・focus・action・statusの前景/背景 | すべてのセマンティックペア |
| 操作 | select、date入力、checkbox、focus-visible、disabled | 設定、練習編集、名簿、モーダル |
| 状態 | success、warning、danger、info | 通知、同期、出欠、削除確認 |
| 回帰 | 既存機能 | 契約テスト24件とレスポンシブ検証 |

テストは、CSS変数の名前存在だけでは不十分です。各モードで実際に計算された`color`、`background-color`、`border-color`を取り出し、既知の隣接背景とのコントラストを計算します。WCAG 2.2の4.5:1は閾値であり、4.499:1を丸めて合格にしてはいけません。[5]

## 10. 段階的な導入順序

| フェーズ | 実施内容 | 完了条件 |
|---|---|---|
| D1：基盤 | `colorMode`、`contrastMode`、`color-scheme`、dark用テーマプリミティブを追加 | 現行lightの見た目を変えず、system/light/darkを切替可能 |
| D2：シェル | body、topbar、sidebar、bottom nav、modal scrimをトークン化 | PWAのブラウザUIを含め、白固定要素が残らない |
| D3：入力と状態 | form、checkbox、select、alerts、badgesを状態3点セットへ移行 | 入力・フォーカス・エラーがdarkで読める |
| D4：データ面 | cards、lists、charts、pitch図を移行 | 高密度画面の選択・比較・凡例が識別可能 |
| D5：品質化 | モード横断のスクリーンショットとコントラストテストをCIへ追加 | theme × mode × contrastの回帰を検出可能 |

最初の実装対象は、**表示・操作設定、topbar、bottom navigation、練習編集モーダル、練習カード**です。この範囲はダークモードの印象を決めると同時に、入力・固定領域・状態色という最もリスクの高い要素を含みます。

## 11. 実装上の判断

ダークモードを実装する際、現行の`theme-midnight`を「ダークモードそのもの」とは扱わないでください。`theme-midnight`はチームテーマの一つであり、darkモードはすべてのチームテーマに適用される**表示環境の軸**です。したがって、`body.theme-midnight`と`[data-color-mode="dark"]`は競合ではなく、合成対象です。

最終的な原則は次の通りです。

> **テーマは何色らしいかを決める。ダークモードはどの明度で見せるかを決める。セマンティックトークンは部品に何の意味を与えるかを決める。**

この責務分離を守れば、Dark Mode、High Contrast、追加チームテーマ、屋外向け表示、将来のカラーユニバーサルデザインを、画面ごとの作り直しなしに拡張できます。

## References

[1] [デジタル庁デザインシステムβ版：カラー（概要）](https://design.digital.go.jp/dads/foundations/color/)

[2] [SmartHR Design System：デザイントークン／色](https://smarthr.design/products/design-tokens/color/)

[3] [MDN：prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme)

[4] [MDN：color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)

[5] [W3C WAI：WCAG 2.2 Understanding SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

[6] [Material Design 3：Color system](https://m3.material.io/styles/color/system/overview)

[7] CoachMgr v1.18.0：`CSS/base.css`、`CSS/tokens.css`、`experience-service.js`、`settings.js`
