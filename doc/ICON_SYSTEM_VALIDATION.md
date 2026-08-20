# CoachMgr アイコンシステム・検証基準

**現行基準：CoachMgr v1.30.84**

## 1. 目的と対象

本書は、CoachMgrのアイコンを単なる視覚装飾ではなく、操作・状態・戦術表現を補助するデザインシステム部品として維持するための検証基準である。対象は、カスタムSVG、Tabler Icons、絵文字、Canvas作図、テーマ適合性、PWAオフライン配信、アクセシビリティである。

> **基本原則：アイコンの形、可視ラベル、アクセシブルな名称、状態表現、Canvas上の表現は、同じ意図を伝えなければならない。**

## 2. 資産と役割

| 層 | 実装 | 担当する意味 | 検証対象 |
|---:|---|---|---|
| 1 | 44個の南陽台FCカスタムSVGと`.c-icon` | チーム固有、主要ナビ、Tablerにない競技固有概念 | `currentColor`、意味クラス、装飾時の`aria-hidden` |
| 2 | ローカルTabler Icons 3.46.0のCSS・WOFF2と`.ti` | 操作、試合記録、サッカー補助語彙 | ローカル定義、未定義クラス、Font Awesome再導入禁止 |
| 3 | 絵文字 | ランキング順位などの非操作的な補助 | 単独の主要操作へ使わない |
| 4 | `pitch-renderer.js`のCanvas描画 | 選手位置、パス、ドリブル、エリア、器具 | ツール選択の意味と線種・オブジェクトの整合 |

TablerのCSSとWOFF2は`assets/vendor/tabler-icons/`へ同梱し、Service Workerのprecacheへ登録する。外部アイコンCDNをPWAの必須経路にしない。

## 3. 作図ツールのD1〜D3契約

作図ツールは、選択前から利用者が意図を判断でき、選択後には視覚状態と支援技術向け状態が一致することを必須とする。

| `data-tool` | 可視ラベル | 第一候補 | Canvas上の表現 | 禁止する再導入 |
|---|---|---|---|---|
| `line-move` | 移動 | `ti-route` | 実線・矢印 | `ti-arrow-right`単独 |
| `line-pass` | パス | `ti-arrow-right-dashed` | 点線・矢印 | `ti-dots` |
| `line-dribble` | ドリブル | `ti-arrow-zig-zag` | ジグザグ・矢印 | `ti-activity` |
| `cone` | コーン | `ti-cone` | コーンオブジェクト | `ti-caret-up` |
| `ladder` | ラダー | `ti-ladder` | 横桟付きラダー | `ti-menu-2` |
| `player` | 選手 | `ti-shirt-sport` | 選手オブジェクト | 汎用追加記号だけの表現 |
| `ball` | ボール | `ti-ball-football` | ボールオブジェクト | 他競技のボール |

すべての`data-tool`ボタンは、操作名を表す日本語`aria-label`、初期状態の`aria-pressed`、装飾アイコンの`aria-hidden="true"`を持つ。ツールドックのラベルは未選択時も表示し、デスクトップでは68px、モバイルでは64pxの幅を確保する。選択状態は背景色だけでなく、可視ラベル、アイコン、`aria-pressed`、`focus-visible`で伝える。

## 4. D4：台帳と変更レビュー

新しいアイコンまたは作図ツールを追加・変更するプルリクエストでは、[`ICON_SYSTEM.md`](./ICON_SYSTEM.md)の台帳へ、意図、第一候補、禁止代替、ラベル、ARIA、Canvas上の表現を記録する。

| レビュー項目 | 合格基準 |
|---|---|
| 意味 | 既存の4層のうち、最も近い表現層を選択している。 |
| 色 | 色相・テーマの違いだけで意味を作らず、セマンティック前景色を継承する。 |
| 可視性 | タッチ端末でも、選択前に日本語ラベルを読める。 |
| アクセシビリティ | アイコン単独の操作に日本語`aria-label`があり、状態を`aria-pressed`等へ同期する。 |
| PWA | 新しい資産がローカル配信・precache・キャッシュ世代の設計と矛盾しない。 |

Tablerに意味の一致する笛やサッカー固有の警告・退場アイコンがない場合は、曖昧な汎用アイコンで代用しない。カスタムSVGとして設計し、同じ台帳・テーマ・PWA契約へ登録する。

## 5. D5：自動品質ゲート

| 検証 | 保護する内容 | 現行の基準 |
|---|---|---|
| P40 | Canvas作図の機能 | 配置、線・図形、履歴、フォーメーション、保存・復帰を保護する。 |
| P42 | Tabler移行 | Font Awesome再導入禁止、ローカルCSS・WOFF2、サッカー主要アイコン、全利用クラスの定義を確認する。 |
| P43 | 作図の識別性 | D1の第一候補、旧アイコンの再導入禁止、常時ラベル、ARIA、モバイル幅、戦術導線を確認する。 |
| P34 | テーマ | 15種色×light/darkで、文字・主操作・境界・フォーカスの対比を確認する。 |
| レスポンシブ検証 | 操作面の表示 | 主要画面で横方向の違反が0件であることを確認する。 |

公開前には、対象変更に応じた契約テストを実行し、`git diff --check`、JavaScript構文確認、PWAのService Workerキャッシュ更新を完了する。作図またはアイコン体系を変更した場合、P40・P42・P43を省略しない。

## 6. 現行検証記録

v1.30.84のD1〜D5更新では、P40、P42、P43を通過し、契約テストは34/34成功、レスポンシブ検証は20件・違反0件、動的テーマは15種色×light/darkで成功した。公開PWAはService Workerの`coachmgr-v194`で更新され、v1.30.84表示を確認している。

## 7. 運用上の禁止事項

- Font Awesomeまたは外部アイコンCDNを新たな必須依存として追加しない。
- 画面固有の都合だけで、台帳にない`ti-*`クラスや曖昧な代替アイコンを追加しない。
- ラベルをホバー時だけに隠し、タッチ端末で操作の意味を判別不能にしない。
- 色だけ、アイコンだけ、ツールチップだけで、選択状態または業務状態を伝えない。
- Canvas上の線種とツールドックの操作アイコンの意味を食い違わせない。
- アイコンの都合でテーマ色をSVGやHTMLに固定しない。

## 関連文書

- [`NANYODAI_BRAND_DESIGN_SYSTEM_STANDARD.md`](./NANYODAI_BRAND_DESIGN_SYSTEM_STANDARD.md)
- [`ICON_SYSTEM.md`](./ICON_SYSTEM.md)
- [`DARK_MODE_SEMANTIC_TOKEN_DESIGN.md`](./DARK_MODE_SEMANTIC_TOKEN_DESIGN.md)
- [`WCAG21_LIGHT_DARK_CONTRAST_VALIDATION_SPEC.md`](./WCAG21_LIGHT_DARK_CONTRAST_VALIDATION_SPEC.md)
- [`../reports/drawing-icon-clarity-implementation-v13084.md`](../reports/drawing-icon-clarity-implementation-v13084.md)
