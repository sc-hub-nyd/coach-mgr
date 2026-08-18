# CoachMgr：ライト／ダーク2モード・カラー設計仕様

## 方針

CoachMgrのカラーモードは、**ライトモード**と**ダークモード**の2種類のみとします。高コントラストモードは独立した設定・CSSクラス・トークン・テスト対象として廃止します。

アクセシビリティは追加モードで補うのではなく、ライト／ダークのそれぞれが通常利用時から十分な文字・境界・フォーカスのコントラストを満たすことで担保します。通常テキストは背景とのコントラスト比を4.5:1以上にし、境界・アイコン・フォーカスなどの非テキストUIは3:1以上を確認します。[1]

| カラー軸 | 採用 | 保存先 | 役割 |
|---|---|---|---|
| チームテーマ | 採用 | チーム設定 | Field Green、Ocean Blueなどの主色・印象 |
| カラーモード | 採用 | この端末のUI設定 | light / darkの明暗切替 |
| 高コントラスト | **廃止** | なし | light / darkの品質基準へ統合 |

## 設計原則

チームテーマは「何色らしいか」、カラーモードは「どの明度で読むか」を決めます。コンポーネントは両方を直接判断せず、用途を表すセマンティックトークンだけを参照します。

```text
チームテーマ（Field Green / Ocean Blue / Redline / …）
                         ×
カラーモード（light / dark）
                         ↓
セマンティックトークン（surface / text / border / action / state / focus）
                         ↓
共通コンポーネント（form / roster / practice-card / modal / …）
```

この構造により、`theme-ocean-blue × dark`のような組合せでも、`c-practice-card`や`c-modal`のCSSを追加・分岐させずに同じ意味の色を利用できます。

## トークン体系

### 1. テーマプリミティブ

チームテーマは、lightとdarkの双方に必要な基礎値を提供します。`theme-midnight`はカラーモードではなく、チームテーマの一種として扱います。

| プリミティブ | lightでの意味 | darkでの意味 |
|---|---|---|
| `--theme-primary` | 主操作・選択の基調色 | 暗い面で読める明るさの主色 |
| `--theme-primary-hover` | light時の押下・hover | dark時の押下・hover |
| `--theme-primary-soft` | 選択面・淡い強調面 | 暗い面での低彩度コンテナ |
| `--theme-canvas` | アプリ全体の背景 | 最も暗い背景面 |
| `--theme-surface` | カード・入力の標準面 | canvasより一段明るい面 |
| `--theme-surface-raised` | モーダル・浮上面 | surfaceよりわずかに明るい面 |
| `--theme-text` | 本文 | 暗い面で読める明るい本文 |
| `--theme-text-muted` | 補足・メタ情報 | 読めるが控えめな補足 |
| `--theme-border` | 控えめな境界 | 暗い面で認識できる境界 |

### 2. セマンティックトークン

部品は具体色・テーマ名・モード名を参照しません。

```css
:root {
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
  --color-text-on-action: var(--theme-on-primary);
  --color-focus: var(--theme-focus);

  --color-scrim: rgba(0, 0, 0, 0.56);
  --color-overlay-hover: color-mix(in srgb, var(--color-text) 8%, transparent);
}
```

状態色は単色ではなく、文字・面・境界の3点セットとします。

```css
--color-success-text: var(--theme-success-text);
--color-success-surface: var(--theme-success-surface);
--color-success-border: var(--theme-success-border);

--color-warning-text: var(--theme-warning-text);
--color-warning-surface: var(--theme-warning-surface);
--color-warning-border: var(--theme-warning-border);

--color-danger-text: var(--theme-danger-text);
--color-danger-surface: var(--theme-danger-surface);
--color-danger-border: var(--theme-danger-border);

--color-info-text: var(--theme-info-text);
--color-info-surface: var(--theme-info-surface);
--color-info-border: var(--theme-info-border);
```

## light / darkの切替仕様

端末の表示設定は、`light`または`dark`のみを保存します。`system`追従は採用しません。これは、練習・試合時の視認性を利用者が明示的かつ再現可能に決められるようにするためです。

| 設定値 | `data-color-mode` | CSSの適用 |
|---|---|---|
| ライト | `light` | light用テーマプリミティブ |
| ダーク | `dark` | dark用テーマプリミティブ |

```css
:root[data-color-mode="light"] {
  color-scheme: light;
  --theme-canvas: #f3f7f4;
  --theme-surface: #ffffff;
  --theme-surface-raised: #ffffff;
  --theme-text: #16231e;
  --theme-text-muted: #60736a;
  --theme-border: rgba(22, 35, 30, 0.14);
}

:root[data-color-mode="dark"] {
  color-scheme: dark;
  --theme-canvas: #0b1511;
  --theme-surface: #12211a;
  --theme-surface-raised: #193026;
  --theme-text: #edf7f1;
  --theme-text-muted: #b6c9bf;
  --theme-border: rgba(237, 247, 241, 0.16);
}
```

`color-scheme`はスクロールバー、ネイティブフォーム、スペルチェックなどのブラウザ提供UIにも影響するため、アプリ内の`data-color-mode`と必ず一致させます。[2]

## 高コントラスト廃止の対象

現在の実装には、高コントラストに関するCSSが2箇所あります。導入実装時には、以下を完全に削除します。

| ファイル | 廃止対象 | 処置 |
|---|---|---|
| `CSS/base.css` | `body.high-contrast-mode`で始まる屋外用上書きブロック | ブロックを削除。個別の白・黒・濃紺固定値はlight/darkのセマンティックトークンへ移行 |
| `CSS/tokens.css` | `body.high-contrast-mode`のトークン上書き | ブロックを削除 |
| 将来の`experience-service.js` | `contrastMode`、`data-contrast-mode`、`high-contrast-mode`操作 | 追加しない。既存の参照があれば削除 |
| `settings.js` / 設定UI | 「高コントラスト」チェック・選択肢 | 新設しない。既存UIにあれば削除 |
| レスポンシブ・契約テスト | high-contrastの組合せケース | light/darkの2組へ置換 |
| スライド・仕様書 | 高コントラストを前提にした説明 | light/darkの品質基準へ差替え |

高コントラスト用CSSを削除しても、`--color-focus`、太さ・サイズ、状態テキスト、十分な境界コントラストは維持します。これはアクセシビリティを廃止するのではなく、**標準light/darkの品質基準に内包する**判断です。

## 設定UIと保存形式

表示・操作設定には次の項目だけを置きます。

| ラベル | control | 保存値 | 補足 |
|---|---|---|---|
| カラーモード | selectまたは2択セグメント | `light` / `dark` | 「この端末だけに保存」と説明 |

```js
export const DEFAULT_UI_PREFERENCES = Object.freeze({
  fontScale: 'normal',
  preferredHand: 'right',
  reduceMotion: false,
  compactMode: false,
  colorMode: 'light'
});

root.dataset.colorMode = next.colorMode === 'dark' ? 'dark' : 'light';
```

既存の端末別UI設定の保存・適用機構を再利用できます。新しい同期データやチーム共有設定には入れません。

## アクセシビリティ基準

高コントラストモードを廃止する代わりに、lightとdarkの各モードで次をリリース条件とします。

| 対象 | 最低基準 | 検証例 |
|---|---:|---|
| 通常テキスト・ラベル・状態テキスト | 4.5:1 | `text` × `canvas`、`text-muted` × `surface` |
| 大きい文字 | 3:1 | 24px相当以上の見出し |
| 非テキストUI・フォーカス・境界 | 3:1 | focus × 直下のsurface、border × 隣接surface |
| 主操作内の文字 | 4.5:1 | `text-on-action` × `action` |
| 状態表示 | 色以外の手掛かり | icon + テキスト + 状態面 |

WCAG 2.2は通常テキストのコントラスト比を4.5:1以上とし、前景・背景の両方を明示する必要があると示しています。[1] 高コントラスト専用モードがなくても、この閾値をすべての通常表示で満たせば、十分に一貫した表示基準を運用できます。

## 検証マトリクス

検証は、テーマごとにlight/darkの2モードだけを実行します。

| テーマ | light | dark | 代表確認画面 |
|---|---:|---:|---|
| Field Green | 必須 | 必須 | 設定、練習編集、練習一覧 |
| Ocean Blue | 必須 | 必須 | 選手比較、通知、データリスト |
| Redline | 必須 | 必須 | 危険操作、削除確認、状態表示 |
| Midnight | 必須 | 必須 | topbar、navigation、modal |

各組合せを320px、390px、768px、1024px、1440pxで確認します。`compactMode`や`reduceMotion`は色モードとは独立して保持し、検証を混在させません。

## 導入順序

| 段階 | 実施内容 | 完了条件 |
|---|---|---|
| L1 | `colorMode`、`data-color-mode`、`color-scheme`、light/darkプリミティブを追加 | 明示的にlight/darkを切替可能 |
| L2 | app shell、topbar、sidebar、bottom nav、modal scrimをセマンティックトークンへ移行 | 白固定・黒固定の基盤UIが残らない |
| L3 | form、名簿、カード、alert、badgeを移行 | 入力・状態・フォーカスが両モードで読める |
| L4 | charts、ピッチ図、SVG、PWA `theme-color`を移行 | 色だけに情報を預けない |
| L5 | light/darkのコントラスト・視覚回帰テストを追加 | 2モードの回帰を自動検出可能 |

## References

[1] [W3C WAI：WCAG 2.2 Understanding SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

[2] [MDN：color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)

[3] CoachMgr v1.18.0：`CSS/base.css`、`CSS/tokens.css`、`experience-service.js`、`settings.js`
