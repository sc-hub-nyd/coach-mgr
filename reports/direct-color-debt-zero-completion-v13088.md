# 画面・部品層の直接指定色ゼロ完了監査（v1.30.88）

**対象:** CoachMgr v1.30.88

**実施日:** 2026-08-20

## 結論

N1〜N4を完了し、画面・部品層に残っていた直接指定色119件をセマンティックトークンまたはCanvas／静的カタログ用の所有トークンへ移行した。監査スクリプトの`componentOrPageOccurrences`は**0件**となった。

| 比較基準 | 画面・部品層の直接指定色 | 増減 |
|---|---:|---:|
| DS-R2開始前 | 325 | — |
| v1.30.85 | 278 | -47 |
| v1.30.86 | 277 | -48 |
| v1.30.87 | 119 | -206 |
| **v1.30.88** | **0** | **-325** |

`tokens.css`と`base.css`には120件の色値が残る。これらはlight/dark、チームテーマ、Canvasパレット、スウォッチを定義する基盤の所有値であり、画面・部品CSSに散在する直接指定色ではない。今後の完了条件は、この所有値をトークン層だけに限定し、画面・部品層への再流出を防ぐことである。

## N1〜N4の実施内容

| 波 | 対象 | 削減 | 実施内容 |
|---|---|---:|---|
| N1 | `components-standard.css`、`main.css` | 7件 | text effectの白色ハイライトを`--color-text-inverse`へ、タイムラインのブランドRGBAを`--color-action`由来の`color-mix()`へ移行 |
| N2 | `components-system.css`の名称付き共通部品 | 22件 | 参加者チップ、フレーム選択、メディアプレビュー、ピッチトークン、ポップオーバー、練習カードをsurface、media、shadow、状態トークンへ移行 |
| N3 | `dashboard.css` | 47件 | 注意表示、予定・結果、予定行、育成ノート、ヒートマップをbrand、success、warning、danger、info、heatmapトークンへ移行 |
| N4 | `components-system.css`の静的テンプレートカタログ | 43件 | 色見本、半透明面、メディア面、shadow、区切りを基盤トークンと`color-mix()`へ移行 |
| **合計** | 画面・部品層 | **119件** | 直接HEX／RGBAをゼロ化 |

## 追加した色の所有契約

| 契約 | 用途 |
|---|---|
| `--color-heatmap-level-0-*`〜`--color-heatmap-level-5-*` | 育成ヒートマップの六段階で、背景色と文字色を組として管理 |
| `--color-media-preview-surface`、`--color-media-overlay*` | メディアプレビューの暗い面とオーバーレイをテーマ追随で管理 |
| `--color-swatch-*`、`--color-accent-violet` | 静的カタログ由来の色見本・補助アクセントの所有値を基盤へ限定 |
| `--color-warning-hover` | 注意アクションのhover状態を役割として管理 |

## 再発防止

P53を追加し、画面・部品層の10ファイルにHEX、RGBA、HSLAを追加できないようにした。P53は基盤トークンと画面・部品層を区別する監査の存在、heatmap、media、swatchの所有トークンも確認する。

各リリースでは、P34の15チームカラー×light/dark、P40の作図回帰、P41のランキング、P45の状態部品、P47のPWA更新、P50の色債務履歴、P51のCanvasパレット、P52のレガシー退出、P53の色債務ゼロを通過させる。

## 再現コマンド

```bash
node tests/run-contract-tests.mjs
node tests/run-responsive-validation.mjs
node tests/p34-dynamic-color-theme-test.mjs
node scripts/audit-design-system-v13085.mjs
node scripts/analyze-direct-color-debt-v13086.mjs
git diff --check
```


## 公開PWA確認

2026-08-20にGitHub Pages公開版で更新通知から新しいService Workerを適用した。画面上のバージョン表示は`v1.30.88`へ更新され、最新データの読み込み開始を確認した。
公開PWAのダッシュボードは更新適用後に正常表示され、更新履歴モーダルには「画面・部品層の直接指定色をゼロ化」と4項目のリリースノートが共通`c-modal`で表示された。
