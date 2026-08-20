# CoachMgr アイコンシステム

**現行基準：v1.30.84**

## 目的

CoachMgrは、南陽台FCの44個のSVGをチーム固有の視覚言語として維持し、ローカル配信のTabler Icons 3.46.0を業務操作・試合記録・サッカー補助語彙として併用する。アイコンは単なる装飾ではなく、ナビゲーション、記録、練習、保護者連絡、状態表示、戦術作図に一貫した手掛かりを与えるデザインシステム部品である。

SVGは`assets/icons/nanyodai/`にカテゴリ・ファイル名を変えずに格納する。`CSS/icon-system.css`はSVGをCSSマスクとして参照し、`currentColor`相当の`background-color: currentColor`で描画する。Tablerは`assets/vendor/tabler-icons/`からローカル配信し、どちらもlight/darkモード、チーム色、主操作上の前景色へ適応させる。

## コンポーネント契約

> 新しいUIでは、チーム固有概念にはカスタムSVG、汎用業務・サッカー補助語彙にはローカルTablerを優先する。Font Awesomeまたは外部アイコンCDNを新しい必須依存として追加しない。どちらにも意味が一致する資産がない競技固有概念は、カスタムSVGとして設計し、台帳へ登録する。

| 要素 | 規則 |
|---|---|
| カスタムSVG | `c-icon`を必ず付ける。 |
| SVGの意味クラス | `c-icon--home`、`c-icon--trophy`、`c-icon--rising-pass`のように意味で指定する。ファイル名や色名をUIから参照しない。 |
| Tabler | `.ti .ti-*`を使い、ローカルCSSに定義される意味クラスだけを指定する。操作にラベルがある場合はアイコンを装飾として扱う。 |
| サイズ | `c-icon--xs`、`--sm`、`--md`、`--lg`、`--xl`を使う。任意の固定px指定は追加しない。 |
| 色 | 親要素の`color`を継承する。ブランド表示には`c-icon--brand`と`--color-brand`、ブランド面上には`c-icon--on-brand`と`--color-text-on-brand`、主操作面では`--color-text-on-action`、本文では`--color-text`、補助情報では`--color-text-muted`を使う。 |
| 装飾 | 隣接テキストが同じ意味を示す場合は`aria-hidden="true"`を付ける。 |
| 単独アイコン | アイコンだけの操作には、ボタンの`aria-label`で日本語の操作名を必ず与える。アイコンの色だけで状態を示さない。 |

## 意味マッピング

| 画面・目的 | 使用アイコン | 役割 |
|---|---|---|
| ブランドとチーム関連 | `c-icon--team-signal` | アプリシェル、チームのまとまり |
| ホーム | `c-icon--home` | ダッシュボード、モバイルのホーム |
| 試合 | `c-icon--trophy` | 試合記録、結果の入口 |
| 練習 | `c-icon--cone`、`c-icon--calendar` | 練習管理、予定 |
| 振り返り | `c-icon--rising-pass` | 成長、改善、分析の入口 |
| 戦術 | `c-icon--pass-ladder` | 戦術管理、組立の入口 |
| 選手・チーム | `c-icon--team`、`c-icon--user` | 名簿、参加者、チーム状態 |
| 保護者共有 | `c-icon--bell`、`c-icon--message`、`c-icon--document` | 通知、連絡、資料 |
| 状態・操作 | `c-icon--check`、`c-icon--warning`、`c-icon--error`、`c-icon--save` | 完了、注意、エラー、保存 |

## テーマとアクセシビリティ

アイコンは`currentColor`を継承するため、テーマごとに別のSVGを作成しない。南陽台FC向けの新規・未設定チームでは公式サイトの赤系`#EF3340`を種色とするが、SVGへ赤を固定しない。light/darkともに、アイコンを置く親コンポーネントがセマンティック前景トークンを選択する。ブランド表示では`--color-brand`、主操作ボタンでは`--color-text-on-action`、本文のアイコンは`--color-text`を使う。利用者がチーム色を変えた場合も同じ役割が追随する。

強制配色モードでは`CanvasText`へ委譲する。状態を色やアイコンだけで伝えず、日本語の状態名、ボタンラベル、数値などを併記する。キーボードフォーカスはアイコン自体でなく、操作要素の可視フォーカスで提示する。

## 導入・検証

新しいアイコンを使う前に、`CSS/icon-system.css`またはローカルTabler CSSの定義、サイズ、表示コンテキスト、`c-icon--brand`／`c-icon--on-brand`の役割を確認する。導入後は、P42（Tabler資産）、P43（作図アイコンの意味・ラベル・ARIA）、必要に応じてP40（作図機能）、light/dark、320px幅、PWAオフラインキャッシュを確認する。詳細な品質基準は[`ICON_SYSTEM_VALIDATION.md`](./ICON_SYSTEM_VALIDATION.md)を正本とする。

## Tabler Iconsとの役割分担

CoachMgrのアイコンは、以下の優先順で選択する。チーム・コーチング固有の意味を持つ概念は第1層のカスタムSVG、業務操作・試合記録・サッカー補助語彙は第2層のTabler Icons、ランキング順位などの非操作的な補助は第3層の絵文字、戦術盤上で位置・線種・図形自体が意味を持つものは第4層のCanvas描画で表す。

| 優先度 | 表現層 | 担当する概念 | 例 | 判断規則 |
|---:|---|---|---|---|
| 1 | カスタムSVG（`.c-icon`） | チーム固有、主要ナビ、独自の戦術概念 | チームシグナル、戦術入口、ミニゴール | Tablerに意味の一致する形状がない場合に採用する。 |
| 2 | Tabler Icons（`.ti`） | 汎用操作、試合記録、サッカー補助語彙 | ボール、シューズ、ピッチ、経路、コーン、ラダー | ローカル同梱版の定義に存在し、意味が直接一致する場合に採用する。 |
| 3 | 絵文字 | 順位や軽い補助表現 | 1位〜3位 | 単独の主要操作には使わない。 |
| 4 | Canvas | 位置・方向・線種・作図オブジェクト | 選手、パス、ドリブル、エリア | 表示記号ではなく、実際の戦術表現そのものとして描画する。 |

Tablerの単独アイコン操作では、`aria-label`、`title`、可視ラベルを同じ意味にそろえる。装飾アイコンには`aria-hidden="true"`を付ける。アイコンフォントの未読込を前提にした文字記号や絵文字での代替は行わず、PWAのローカルWebfont precacheを維持する。

## 作図ツールのアイコン台帳

作図ツールは、**アイコン、常時表示ラベル、Canvas上の線種**の三つを同じ意味にそろえる。色だけ、選択状態だけ、ホバー説明だけで操作内容を伝えてはならない。ツールドックはデスクトップ68px・モバイル64pxの幅を確保し、未選択時にも日本語ラベルを表示する。

| `data-tool` | 可視ラベル | Tabler／SVGの第一候補 | Canvas上の表現 | 禁止する曖昧な代替 |
|---|---|---|---|---|
| `line-move` | 移動 | `ti-route` | 実線・矢印 | `ti-arrow-right`だけで経路を表すこと |
| `line-pass` | パス | `ti-arrow-right-dashed` | 点線・矢印 | `ti-dots`（三点リーダー） |
| `line-dribble` | ドリブル | `ti-arrow-zig-zag` | ジグザグ・矢印 | `ti-activity`（心電図に見える形） |
| `cone` | コーン | `ti-cone` | コーンオブジェクト | `ti-caret-up`（単なる上向き三角） |
| `ladder` | ラダー | `ti-ladder` | 横桟付きラダー | `ti-menu-2`（メニュー記号） |
| `ball` | ボール | `ti-ball-football` | ボールオブジェクト | 他競技のボールアイコン |
| `minigoal` | ゴール | カスタムSVGマスク | ミニゴールオブジェクト | 意味の一致しない汎用図形 |
| `marker` | マーカー | `ti-circle` | 円形マーカー | ラベルなしで円エリアと区別しないこと |
| `line-circle` | 円 | `ti-circle` | 円エリア | ラベルなしでマーカーと区別しないこと |

> Tabler 3.46.0のローカルWebfontには、笛およびサッカーの警告・退場を直接表す専用アイコンは定義されていない。将来これらを追加する場合は、意味が曖昧な汎用アイコンや`ti-cards`を代用せず、カスタムSVGとして設計・台帳化する。

## 変更レビュー規約

作図・試合・練習のアイコンを変更するプルリクエストでは、以下を確認する。

1. 台帳の第一候補と異なる場合、その理由と採用する意味を変更記録に明記する。
2. アイコンの意味、可視ラベル、`aria-label`、`title`、Canvas上の表現が矛盾しないことを確認する。
3. アイコン単独でのみ意味を伝えず、タッチ端末で選択前に読める日本語ラベルを維持する。
4. 新しい`.ti-*`クラスがローカルTabler CSSに定義され、P42の未定義クラス検査を通過することを確認する。
5. 追加・変更した作図ツールはP40・P42・P43、ライト／ダーク、縦横スマートフォンで確認する。

## 関連文書

- [`NANYODAI_BRAND_DESIGN_SYSTEM_STANDARD.md`](./NANYODAI_BRAND_DESIGN_SYSTEM_STANDARD.md)
- [`ICON_SYSTEM_VALIDATION.md`](./ICON_SYSTEM_VALIDATION.md)
- [`DESIGN_SYSTEM_EVOLUTION_ROADMAP_V13084.md`](./DESIGN_SYSTEM_EVOLUTION_ROADMAP_V13084.md)
- [`../reports/tabler-subset-evaluation-v13085.md`](../reports/tabler-subset-evaluation-v13085.md)
