# CoachMgr タイポグラフィ標準

**適用開始：CoachMgr v1.23.0**

## 1. 目的

CoachMgrは、試合記録、練習計画、名簿、保護者向け連絡のように、日本語本文と短い英数字・数値が混在する高密度な業務UIである。そのため、見出し用の装飾書体を追加するのではなく、**日本語の読みやすさ、数値比較の正確さ、長時間利用時の疲れにくさ**を優先する。

本文と日本語のUIには`Noto Sans JP`を、英数字・スコア・時刻・比較可能な数値には`Inter`を使う。Noto Sans JPは日本語で使われるひらがな、カタカナ、漢字をカバーし、複数のウェイトを提供する。[1] Interは画面上の詳細UIを想定して設計され、固定幅数字を含むOpenType機能を提供する。[2]

> **原則：フォントはブランド装飾ではなく、試合中・練習中・保護者対応で誤読しないための情報設計である。**

## 2. フォントファミリーの役割

| トークン | フォント | 用途 | 使用規則 |
|---|---|---|---|
| `--font-ui` | Inter → Noto Sans JP → OSフォールバック | アプリの標準本文、ボタン、入力、ナビゲーション | 原則すべての通常UIに使う。日本語グリフはNoto Sans JPへフォールバックする。 |
| `--font-heading` | `--font-ui` | 画面見出し、セクション見出し、モーダル見出し | 別書体にせず、ウェイト・サイズ・余白で階層を作る。 |
| `--font-numeric` | Inter → Noto Sans JP | スコア、得点、時間、順位、出欠数、比較表 | `font-variant-numeric: tabular-nums slashed-zero`を併用する。 |
| `--font-mono` | OS等幅フォント | JSON、同期ログ、開発・診断情報 | 通常UI、本文、ボタンには使わない。 |

## 3. 文字役割とスケール

| 役割 | トークン | 基準サイズ | ウェイト | 行間 | 文字間 | 代表用途 |
|---|---|---:|---:|---:|---:|---|
| 本文 | `--text-body-size` | 16px | 400 | 1.65 | 0 | 説明、記録、保護者向け文面 |
| 高密度本文 | `--text-dense-size` | 14px | 400 / 600 | 1.40 | 0 | 名簿、日付、練習カードの補助情報 |
| メタデータ | `--text-meta-size` | 13px | 500 / 700 | 1.45 | 0.02em | ラベル、補足、状態名 |
| 一行操作 | `--text-one-line-size` | 14px | 500 / 600 | 1.20 | 0 | ボタン、選択肢、ツールバー |
| 見出し | `--font-heading` | 既存コンポーネントのサイズ | 700 | コンポーネント固有 | 0.01em | 画面・カード・モーダルの見出し |
| 強調数値 | `--font-numeric` | 文脈に応じる | 800 | 文脈に応じる | 0 | KPI、スコア、集計、順位 |

通常本文を14px未満へ下げない。モバイルの小さな表示幅でも、情報量を増やすために文字を縮めるより、`c-data-list`やGridのレイアウト規則で情報の構造を変える。

## 4. 数値と時刻の規約

比較が必要な数値は`--font-numeric`と`tabular-nums`を使う。固定幅数字により、得点、出欠数、時間、順位の列が視覚的に揃う。`slashed-zero`はゼロとアルファベットのOを見分ける補助であり、識別子・コード・スコア表示に有効である。[2]

| 適用対象 | 指定方法 |
|---|---|
| `c-data-list__metric-value` | コンポーネント側で自動適用する。 |
| 新しい成績・時間・集計UI | `u-tabular-nums`を付ける。 |
| JSONや同期ログ | `u-mono`を付ける。 |
| 本文中の一般的な数字 | 通常の`--font-ui`のままにする。 |

## 5. コンポーネント契約

新しい部品は`font-family`、`font-weight`、`line-height`を具体値で繰り返さず、タイポグラフィトークンを参照する。色と同様に、個別画面にフォントの例外を作らない。

- 本文には`--font-ui`、`--text-body-size`、`--text-body-leading`を使う。
- 見出しには`--font-heading`、`--font-weight-heading`、`--tracking-heading`を使う。
- ラベルには`--text-meta-size`、`--text-meta-leading`、`--tracking-meta`を使う。
- 比較可能な数値には`--font-numeric`と`font-variant-numeric: tabular-nums slashed-zero`を使う。
- 入力、選択、ボタンは`font: inherit`とし、本文と同じフォント環境を継承する。
- 装飾目的で別の表示書体、筆文字、極端に細いウェイトを導入しない。

## 6. 配信・アクセシビリティ規約

フォントはGoogle Fontsから`display=swap`で読み込む。初回表示をブロックせず、Webフォントが利用できない環境ではOSの日本語ゴシック体へフォールバックする。Noto Sans JPとInterは400、500、600、700、800だけを読み込み、未使用のウェイトは要求しない。

ブラウザの文字拡大を妨げない。`html`へ固定の文字サイズを置かず、`-webkit-text-size-adjust: 100%`を維持する。`font-synthesis: none`により、読み込んでいない太字・斜体の疑似合成を避ける。色だけで階層を作らず、サイズ、ウェイト、行間、見出し構造を組み合わせる。

## 7. 検証ゲート

フォント体系を変更した場合は、次のすべてを確認する。

| 項目 | 基準 |
|---|---|
| 読み込み | `index.html`にNoto Sans JPとInter、`preconnect`、`display=swap`がある。 |
| トークン | font family、ウェイト、行間、数値役割が`tokens.css`に定義されている。 |
| 部品 | 数値用`c-data-list__metric-value`が`--font-numeric`と等幅数字を使う。 |
| アクセシビリティ | 日本語本文16px、密度テキスト14pxを維持し、文字拡大を阻害しない。 |
| 表示 | light/dark、320px〜1440px、設定・ダッシュボード・記録画面で崩れがない。 |

## 参考

[1] [Google Fonts — Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)

[2] [Inter — Official typeface documentation](https://rsms.me/inter/)
