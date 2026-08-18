# CoachMgr カラー・タイポグラフィ統合詳細仕様書

**文書版：1.0**
**適用実装：CoachMgr v1.23.0**
**対象：CoachMgr PWAのアプリシェル、ナビゲーション、共通コンポーネント、設定、試合・練習・振り返り、保護者画面、南陽台FCアイコン**

---

## 1. 目的と設計原則

CoachMgrは、サッカーチームの運営情報を、試合中・練習中・保護者対応などの異なる状況で継続して扱う業務PWAである。本仕様は、南陽台FCの赤系ブランドを既定の出発点としながら、他チームの任意色にも対応し、日本語の高密度な情報を誤読なく提示するための**カラーシステム**と**タイポグラフィ体系**を定義する。

> **基本原則：利用者が選ぶのは種色だけであり、コンポーネントが参照するのは意味トークンだけである。**

> **基本原則：フォントはブランド装飾ではなく、試合記録・数値比較・保護者連絡を正確に読むための情報設計である。**

以下の原則を満たさない実装は追加しない。

| 原則 | 規約 |
|---|---|
| 役割の分離 | 種色、生成プリミティブ、セマンティックトークン、コンポーネント利用の4層を混同しない。 |
| テーマの合成 | チーム種色は共有データ、light/darkは端末ローカル設定として独立に合成する。 |
| 状態の独立 | success / warning / danger / infoをチーム色やブランド赤から生成しない。 |
| 文字の可読性 | 日本語UIにはNoto Sans JP、英数字・比較数値にはInterを使う。 |
| アクセシビリティ | 通常のlight/dark表示そのものを出荷基準とし、文字とUI境界のコントラストを検証する。 |
| 再発防止 | トークン、アイコン、フォント読み込み、数値表示、レスポンシブを契約テストと自動検証で保護する。 |

---

## 2. 適用範囲と責務分担

| レイヤー | 実装ファイル | 責務 | コンポーネントからの直接参照 |
|---|---|---|---|
| チーム設定 | `teamInfo.theme.seed` | チームが選ぶ種色を保存する。既定は`#EF3340`。 | 禁止 |
| テーマ生成 | `color-theme-service.js` | HEX正規化、HSL変換、light/darkパレット、コントラスト評価、CSS変数適用。 | 禁止 |
| 基底プリミティブ | `CSS/base.css` | `--theme-*`のフォールバックとレガシー変数の橋渡し。 | 原則禁止 |
| セマンティックトークン | `CSS/tokens.css` | 色・フォント・余白・サイズ・行間の安定した公開API。 | 必須 |
| 部品 | `CSS/components*.css` | 役割トークンだけを使い、画面固有の具体色・フォント指定を避ける。 | セマンティック層のみ |
| 設定・適用 | `settings.js`、`experience-service.js`、`app.js` | 種色保存、端末カラーモード保存、起動時のテーマ適用。 | 該当なし |

### 2.1 永続化の境界

| データ | 保存先・同期範囲 | 備考 |
|---|---|---|
| `teamInfo.theme.seed` | チーム共有データ | 利用者が選ぶ正規化済みHEX。既存の`teamInfo.color`は互換移行対象。 |
| `teamInfo.theme.algorithm` | チーム共有データ | `coachmgr-tonal-v1`。 |
| `teamInfo.theme.algorithmVersion` | チーム共有データ | 現行は`1`。 |
| `coachMgrUiPreferences.colorMode` | 端末ローカル | `light`または`dark`。他端末へ同期しない。 |
| `--theme-*` / `--color-*` | DOMルートの実行時スタイル | 保存しない。起動・変更時に再生成する。 |
| フォントトークン | CSS | 全チーム・全端末に共通。チームデータへ保存しない。 |

---

# Part I — カラーシステム

## 3. ブランド基準とカラー階層

南陽台FC公式サイトの赤系表現を、CoachMgrの新規・未設定チームにおける既定ブランド種色として採用する。[1] 既定値は`#EF3340`である。ただし、この色はコンポーネントの完成色ではない。種色を起点に、利用状況と表示モードに応じた役割色を生成する。

| 層 | 主な値・接頭辞 | 役割 | 禁止事項 |
|---|---|---|---|
| 種色 | `#EF3340`、任意のHEX | チームの視覚的な出発点。 | 部品へ直接書かない。 |
| 生成プリミティブ | `--theme-primary`、`--theme-canvas`、`--theme-text` | 種色とlight/darkの計算結果。 | 部品から直接使わない。 |
| セマンティックトークン | `--color-action`、`--color-brand`、`--color-text` | UIの意味ごとに安定した公開APIを提供する。 | 目的が異なるロールを代用しない。 |
| 静的状態色 | success / warning / danger / info | 監査可能な業務状態を示す。 | チーム色・ブランド赤から生成しない。 |
| コンポーネント表現 | `c-*`、`l-*`、`u-*` | レイアウトと意味トークンを組み合わせてUIを構成する。 | HEX、フォント名、状態の意味を直書きしない。 |

### 3.1 既定赤のフォールバックパレット

動的テーマの適用前、または初期描画中にも一貫した表示を保つため、`base.css`に赤系フォールバックを置く。以下は**フォールバック専用**であり、通常の部品は対応するセマンティックトークンを参照する。

| 役割 | 値 | 用途 |
|---|---:|---|
| ブランド種色 | `#EF3340` | 新規・未設定チームの種色。 |
| 主操作 | `#C72C38` | 主操作の背景。 |
| 主操作hover | `#A92330` | 主操作のhover。 |
| 主操作上の文字 | `#FFFFFF` | フォールバック時の主操作ラベル。動的テーマでは自動選択する。 |
| 控えめなブランド面 | `#FDE8EB` | 選択行、控えめな強調。 |
| キャンバス | `#FAF6F6` | 画面の背景。 |
| 控えめな表面 | `#F7EFF0` | 軽い補助面。 |
| 境界 | `#B9A5A8` | 入力・カード・区切り。 |
| 強い境界 | `#85666C` | 強調が必要な区切り。 |
| 本文 | `#24171A` | lightの本文。 |
| 補助本文 | `#635257` | lightの補助説明。 |
| フォーカス | `#C72C38` | キーボードフォーカス。 |

### 3.2 既存チームの保護

既に`teamInfo.color`または`teamInfo.theme.seed`が保存されているチームの色は、既定赤へ自動変更しない。既存チームが赤を使う場合は設定画面から`#EF3340`を選択する。これは、ブランド基準の導入によって過去のチーム設定や運用上の識別を損なわないためである。

---

## 4. 動的テーマ生成仕様

### 4.1 入力の正規化

`normalizeHex()`は、`#RGB`、`RGB`、`#RRGGBB`、`RRGGBB`を受け入れ、常に小文字の`#rrggbb`へ正規化する。無効な入力は既定種色`#EF3340`へ戻す。

```text
入力             正規化結果
#EF3340          #ef3340
EF3340           #ef3340
#e34             #ee3344
invalid          #ef3340
```

### 4.2 色相・彩度の扱い

種色はRGBからHSLへ変換する。色相は0〜359度へ正規化する。主操作用の彩度は、低彩度のグレーや黒でもチームらしい強調色を作れるよう、**48〜78%**の範囲へ補正する。ニュートラル面は種色の色相を残しながら、彩度を10〜15%程度へ落として可読性と統一感を両立させる。

| パレット | 彩度・明度の基本方針 | 目的 |
|---|---|---|
| action | 種色の色相、彩度48〜78% | 主操作とリンクを明確にする。 |
| soft / selected | actionより24ポイント程度低い彩度 | 選択状態を過剰に強調せず示す。 |
| neutral | 彩度10〜15% | canvas、surface、border、textの読みやすさを保つ。 |
| companion | 色相を+32度、彩度24〜55% | 二次的な強調やメタデータに使う。 |
| status | 固定値 | 業務上の状態をチーム色から独立させる。 |

### 4.3 light / darkの合成

カラーモードは種色と別に扱う。lightでは明るいニュートラル面と暗い本文、darkでは暗いニュートラル面と明るい本文を作る。

| ロール | light | dark |
|---|---|---|
| canvas | 種色の色相を薄く含む明面（概ね明度97） | 種色の色相を薄く含む暗面（概ね明度10） |
| surface | `#FFFFFF` | 概ね明度15の低彩度面 |
| raised | 概ね明度99の低彩度面 | 概ね明度20の低彩度面 |
| subtle | 概ね明度94の低彩度面 | 概ね明度13の低彩度面 |
| text | `#14201C` | `#F3F7F5` |
| text-muted | `#52635A` | `#C4D0C9` |
| actionの目標明度 | 38付近 | 66付近 |

### 4.4 actionと前景色の選択

`buildActionColor()`は、候補の明度を14〜86の範囲で走査する。次の条件を同時に満たす候補だけを採用する。

1. `#14201C`または白のいずれかがaction背景に対して**5:1以上**であること。
2. actionがcanvasに対して**3.5:1以上**であること。
3. 条件を満たす候補のうち、表示モード別の目標明度に最も近いこと。

前景色は白へ固定しない。明るい黄や水色など、白文字が読めない種色でも、暗い前景を選択できるようにする。候補が得られない場合は、lightでは赤系`#EF3340`、darkでは緑系の安全色`#5BD3A5`を用いる。

### 4.5 静的状態色

状態色はチーム種色と完全に分離する。たとえばチームの種色が赤でも、dangerは破壊的操作・エラーだけに使う。

| 状態 | light文字色 | light surface | dark文字色 | dark surface |
|---|---:|---:|---:|---:|
| success | `#167C5A` | `#E6F5EE` | `#5BD3A5` | `#123C30` |
| warning | `#925F00` | `#FFF5D9` | `#F4C35E` | `#453514` |
| danger | `#B42318` | `#FCEBEA` | `#FFB4AB` | `#4D201B` |
| info | `#1769AA` | `#E8F2FC` | `#A9C7FF` | `#1C3458` |

---

## 5. カラートークン仕様

### 5.1 生成プリミティブ

`applyTeamTheme()`は、テーマパレットから以下の変数を`document.documentElement`へ設定する。

| トークン | 役割 |
|---|---|
| `--team-seed` | 正規化済みのチーム種色。 |
| `--theme-mode` | `light`または`dark`。 |
| `--theme-primary` / `--theme-primary-hover` | 生成された主操作色とhover。 |
| `--theme-primary-soft` | 選択・控えめなブランド面。 |
| `--theme-on-primary` / `--theme-on-primary-hover` / `--theme-on-primary-soft` | 各ブランド面上の前景。 |
| `--theme-companion` | 二次的な強調。 |
| `--theme-canvas` / `--theme-surface` / `--theme-surface-raised` / `--theme-surface-subtle` | 背景と表面の階層。 |
| `--theme-border` / `--theme-border-strong` | 境界の階層。 |
| `--theme-text` / `--theme-text-muted` | 本文と補助本文。 |
| `--theme-focus` | 可視フォーカス。 |
| `--theme-success`〜`--theme-info-surface` | 静的状態色と状態面。 |

### 5.2 公開セマンティックトークン

コンポーネントは`--theme-*`を直接参照せず、次の`--color-*`を使う。

| 区分 | トークン | 用途 |
|---|---|---|
| 表面 | `--color-canvas`、`--color-surface`、`--color-surface-raised`、`--color-surface-subtle` | ページ背景、カード、モーダル、控えめな領域。 |
| 文字・境界 | `--color-text`、`--color-text-muted`、`--color-border`、`--color-border-strong` | 本文、補足、入力、区切り。 |
| ブランド | `--color-brand`、`--color-brand-surface`、`--color-text-on-brand` | チームシグナル、ブランド表示、ブランド面。 |
| 操作 | `--color-action`、`--color-action-hover`、`--color-text-on-action`、`--color-text-on-action-hover` | 主ボタン、主リンク、操作上の文字。 |
| 選択・フォーカス | `--color-surface-selected`、`--color-text-on-selected`、`--color-focus` | 選択行、タブ、キーボードフォーカス。 |
| 状態 | `--color-success`、`--color-warning`、`--color-danger`、`--color-info` | 成功、注意、危険、情報。 |
| 状態面 | `--color-success-surface`、`--color-warning-surface`、`--color-danger-surface`、`--color-info-surface` | バッジ、インライン通知、淡い状態背景。 |

### 5.3 ブランドと操作の違い

現在の生成では`--color-brand`と`--color-action`が同じprimaryに由来するが、目的は異なる。

- **brand**：チームの所属・識別・シグナルを示す。例：`c-icon--brand`。
- **action**：利用者に次の操作を促す。例：主ボタン、保存、追加。
- **danger**：削除、不可逆操作、同期エラーなどの状態を示す。brandやactionの代替にしない。

---

## 6. カラーのコンポーネント契約

| UI状況 | 使用するトークン | 使用しないもの |
|---|---|---|
| 主ボタン | `--color-action` + `--color-text-on-action` | 固定白文字、具体HEX。 |
| 主ボタンhover | `--color-action-hover` + `--color-text-on-action-hover` | primaryの自己流な濃淡。 |
| ブランド表示 | `--color-brand` | danger、具体的な赤。 |
| ブランド面上のアイコン | `--color-text-on-brand` | 親色を想定した固定白。 |
| 通常本文 | `--color-text` | brand色による本文表現。 |
| 補足 | `--color-text-muted` | opacityだけで薄くした本文。 |
| 選択行 | `--color-surface-selected` + `--color-text-on-selected` | action背景の流用。 |
| 危険操作 | `--color-danger` / `--color-danger-hover` | チーム種色、ブランド赤。 |
| 成功・警告・情報 | 対応する`--color-*`と`--color-*-surface` | チーム種色。 |

南陽台FC SVGはCSSマスクで描画し、`background-color: currentColor`を使う。`c-icon--brand`は`--color-brand`、`c-icon--on-brand`は`--color-text-on-brand`、`c-icon--on-action`は`--color-text-on-action`を使う。SVGファイル内部へテーマ色を固定してはならない。

---

# Part II — タイポグラフィ体系

## 7. フォント選定と役割

Noto Sans JPは日本語で使用されるひらがな、カタカナ、漢字をカバーし、複数ウェイトを提供する。[2] Interは詳細UI向けに設計され、画面上の英数字の可読性を支援するほか、固定幅数字を含むOpenType機能を持つ。[3]

| トークン | フォントスタック | 用途 | 規約 |
|---|---|---|---|
| `--font-jp` | `Noto Sans JP` → Hiragino Sans → Meiryo | 日本語の基盤フォールバック | 個別コンポーネントから通常参照しない。 |
| `--font-latin` | Inter → OS UI sans-serif | 英数字の基盤フォールバック | 個別コンポーネントから通常参照しない。 |
| `--font-ui` | Inter → Noto Sans JP → OSフォールバック | 本文、ボタン、入力、ナビゲーション | 標準UIに使う。日本語グリフはNoto Sans JPへ落ちる。 |
| `--font-heading` | `--font-ui` | 画面・セクション・モーダルの見出し | 表示書体を追加せず、ウェイトと余白で階層を作る。 |
| `--font-numeric` | Inter → Noto Sans JP | スコア、得点、時間、順位、比較表 | `tabular-nums slashed-zero`を併用する。 |
| `--font-mono` | OS等幅フォント | JSON、同期ログ、診断 | 本文・ボタン・通常UIには使わない。 |

### 7.1 読み込み仕様

`index.html`はGoogle Fontsへ`preconnect`を設定し、次のウェイトだけを`display=swap`で読み込む。

```text
Noto Sans JP: 400, 500, 600, 700, 800
Inter:        400, 500, 600, 700, 800
```

`display=swap`により、初回描画をWebフォントの完了待ちでブロックしない。利用不可時はOSの日本語ゴシック体・サンセリフ体へフォールバックする。

---

## 8. タイポグラフィトークンと文字階層

### 8.1 ウェイト・文字間・行間

| トークン | 値 | 意図 |
|---|---:|---|
| `--font-weight-regular` | 400 | 標準本文。 |
| `--font-weight-medium` | 500 | 一行操作、補助的な強調。 |
| `--font-weight-strong` | 600 | ラベル、重要な情報。 |
| `--font-weight-heading` | 700 | 見出し。 |
| `--font-weight-emphasis` | 800 | KPI、強調数値。 |
| `--tracking-body` | 0 | 本文の自然な日本語組版。 |
| `--tracking-meta` | 0.02em | ラベル・メタ情報の識別。 |
| `--tracking-heading` | 0.01em | 見出しの安定した階層。 |

### 8.2 サイズ・行間

| 役割 | トークン | サイズ | 行間 | 推奨ウェイト | 主な用途 |
|---|---|---:|---:|---:|---|
| 本文 | `--text-body-size` / `--text-body-leading` | 16px | 1.65 | 400 | 説明、振り返り、保護者連絡。 |
| 高密度本文 | `--text-dense-size` / `--text-dense-leading` | 14px | 1.40 | 400 / 600 | 名簿、日時、練習カード、表の補助情報。 |
| メタ | `--text-meta-size` / `--text-meta-leading` | 13px | 1.45 | 500 / 700 | ラベル、補足、状態名。 |
| 一行操作 | `--text-one-line-size` / `--text-one-line-leading` | 14px | 1.20 | 500 / 600 | ボタン、セグメント、ツールバー。 |
| 見出し | `--font-heading` | コンポーネント別 | コンポーネント別 | 700 | 画面、カード、モーダル。 |
| 強調数値 | `--font-numeric` | 文脈別 | 文脈別 | 800 | 得点、KPI、順位。 |

通常本文を14px未満へ下げない。320px幅で情報が収まらない場合は、文字を縮めず、`l-grid`、`l-cluster`、`c-data-list`などを用いて構造を切り替える。

### 8.3 数値・時刻・識別子

比較が必要な数値には`font-variant-numeric: tabular-nums slashed-zero`を設定する。`tabular-nums`は各数字の幅を揃え、列の比較を助ける。`slashed-zero`はゼロと英字Oの識別を助ける。[3]

| 利用場面 | 指定方法 |
|---|---|
| `c-data-list__metric-value` | コンポーネントが自動で`--font-numeric`、800、`tabular-nums slashed-zero`を適用する。 |
| 新しい成績、時間、集計、順位UI | `u-tabular-nums`を付ける。 |
| JSON、同期ログ、開発診断 | `u-mono`を付ける。 |
| 本文中の通常の数字 | `--font-ui`のままにする。 |

---

## 9. タイポグラフィのコンポーネント契約

| 部品・要素 | 必須規則 |
|---|---|
| body | `--font-ui`、16px、行間1.65、通常ウェイトを基準とする。 |
| `h1`〜`h6` | `--font-heading`、見出しウェイト、見出し字間を適用する。 |
| input / select / textarea / button | `font-family: inherit`とし、本文のフォント環境を継承する。 |
| `c-data-list__metric-value` | 数値フォント、強調ウェイト、等幅数字、斜線ゼロを使う。 |
| c-icon | 色は親コンポーネントのセマンティック色を継承する。フォントをアイコンの代替にしない。 |
| 新しい部品 | `font-family`、`font-weight`、`line-height`を具体値で繰り返さず、トークンを使う。 |

以下の実装は行わない。

- 装飾目的で筆文字、表示書体、極端に細いウェイトを追加する。
- 本文を14px未満へ縮小して情報を詰め込む。
- 数値比較が必要なUIで可変幅数字だけに依存する。
- JavaScriptで個別画面にフォント指定を注入する。
- 文字色だけで見出し・状態・重要度を表す。

---

# Part III — アクセシビリティ、検証、変更管理

## 10. アクセシビリティ基準

WCAG 2.1のコントラスト最小基準は、通常テキストで4.5:1、意味を持つ非テキストUIで3:1である。[4] CoachMgrは高コントラストモードを別途設けず、通常のlight/dark出力そのものを検証対象とする。

| 対象 | WCAG下限 | CoachMgr実装目標 | 実装上の措置 |
|---|---:|---:|---|
| 本文 × canvas / surface | 4.5:1 | 5:1 | 本文とニュートラル面を離す。 |
| 補助本文 × surface | 4.5:1 | 4.5:1 | muted文字のトーンを固定する。 |
| 主操作文字・アイコン × action | 4.5:1 | 5:1 | 黒または白を実測で選ぶ。 |
| action × canvas | 3:1 | 3.5:1 | action候補の明度を走査する。 |
| border / focus × surface | 3:1 | 3.5:1 | ニュートラル境界を実測で選ぶ。 |
| 状態文字 × 状態surface | 4.5:1 | 4.5:1 | 状態色を静的ロールとして管理する。 |
| 文字拡大 | — | 阻害しない | `html`の固定文字サイズを置かず、`-webkit-text-size-adjust: 100%`を維持する。 |

色だけで意味を伝えない。danger、成功、警告、情報には日本語の状態名、アイコン、ボタンラベル、数値などを併記する。単独アイコン操作には日本語の`aria-label`を必ず付ける。

## 11. 検証ゲート

| 変更内容 | 必須検証 | 合格条件 |
|---|---|---|
| 種色・生成ロジック | P34動的テーマテスト | 代表15種色 × light/darkで全コントラストチェックに合格。 |
| トークン・ブランド・アイコン・フォント | P33 CSSアーキテクチャテスト | トークン、アイコン資産、Webフォント読み込み、標準書、禁止規則の契約に合格。 |
| フォント・余白・部品 | レスポンシブ検証 | 320px、390px、768px、1024px、1440px × 主要5画面で横方向違反0件。 |
| PWAキャッシュ | `sw.js`確認 | CSS、テーマサービス、アイコン、キャッシュ世代の更新を確認。 |
| 視覚品質 | モバイル・デスクトップ確認 | 日本語の折返し、見出し階層、数値密度、操作領域を確認。 |

現行の実装では、P33、P34、5ビューポート × 5画面のレスポンシブ検証を通過し、レスポンシブの25チェックで違反0件を確認している。

## 12. 実装変更の手順

### 12.1 新しい色用途を追加する場合

1. 既存の意味ロールで表現できるか確認する。
2. 新しい役割が必要な場合だけ、`--theme-*`ではなく`--color-*`としてトークンを設計する。
3. light/dark双方、任意種色、状態色との衝突を定義する。
4. P34に実測対象を追加し、P33に契約を追加する。
5. 共通部品へ実装してから画面へ展開する。

### 12.2 新しい文字役割を追加する場合

1. 本文、見出し、メタ、数値、コードの既存役割で表現できるか確認する。
2. 新しいサイズ・行間・ウェイトが必要なら、`tokens.css`へ意味名で追加する。
3. 日本語の長文、英数字、320px幅、light/darkで確認する。
4. 文字を小さくして解決せず、必要ならレイアウト部品を改善する。
5. `TYPOGRAPHY_SYSTEM.md`とP33契約テストを更新する。

### 12.3 新しいチームの初期化

1. 新規・未設定チームには`#EF3340`を種色として設定する。
2. `coachmgr-tonal-v1`とバージョン`1`をテーマメタデータへ設定する。
3. 端末の`colorMode`を読み、light/darkを合成する。
4. CSSカスタムプロパティとPWAメタテーマ色を更新する。

---

## 13. 実装上の禁止事項一覧

| 分類 | 禁止事項 |
|---|---|
| 色 | コンポーネント・HTMLへ`#EF3340`、`#C72C38`などの具体色を直接書く。 |
| 前景 | 主操作文字を固定白にする。 |
| 状態 | ブランド赤をdanger、チーム色を状態色の代替に使う。 |
| SVG | アイコンSVG本体へテーマ色を固定する。 |
| データ | 既存チームの保存済み種色を既定赤へ無断移行する。 |
| フォント | 画面単位でフォント名を直書きする。 |
| タイポグラフィ | 本文を14px未満へ下げる、装飾書体を導入する、数値比較で等幅数字を使わない。 |
| CSS | 例外解消のため`!important`を追加する。 |

---

## 14. 参照資料

[1] [南陽台FC 公式サイト](https://nanyodai-fc.com/)

[2] [Google Fonts — Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)

[3] [Inter — Official typeface documentation](https://rsms.me/inter/)

[4] [WCAG 2.1 — Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

[5] [Material Design 3 — Color system](https://m3.material.io/styles/color/system/overview)
