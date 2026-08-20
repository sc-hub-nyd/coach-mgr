# Tabler Icons Webfontサブセット化評価

**対象リリース：CoachMgr v1.30.85**
**評価日：2026-08-20**

## 結論

実行時に利用するTabler Iconsを自動抽出し、**144クラスだけを含むCSS・WOFF2サブセットを本番PWAへ採用**した。PWAがprecacheするアイコン資産は720,051 bytesから26,023 bytesへ減り、**694,028 bytes、96.38%削減**した。

フル版のCSS・WOFF2はライセンス・再生成の正本としてリポジトリへ残す。一方、`index.html`とService Workerはサブセットだけを参照し、初回オフライン起動でダウンロードするアイコン資産を最小化する。

## 計測結果

| 資産 | フル版 | サブセット | 削減量 | 削減率 |
|---|---:|---:|---:|---:|
| CSS | 257,851 bytes | 7,155 bytes | 250,696 bytes | 97.23% |
| WOFF2 | 462,200 bytes | 18,868 bytes | 443,332 bytes | 95.92% |
| **PWA precache対象合計** | **720,051 bytes** | **26,023 bytes** | **694,028 bytes** | **96.38%** |

サブセットは、`index.html`、`CSS/components-system.css`、`CSS/dashboard.css`、ルート直下の全ランタイムJavaScriptから`ti-*`クラスを抽出して生成した。未定義クラスは0件であり、P42は144クラスすべてがサブセットCSSに定義されることを確認する。

## 実装構成

| 要素 | パスまたは責務 |
|---|---|
| フル版の正本 | `assets/vendor/tabler-icons/tabler-icons.css`、`fonts/tabler-icons.woff2` |
| サブセットCSS | `assets/vendor/tabler-icons/tabler-icons-subset.css` |
| サブセットWOFF2 | `assets/vendor/tabler-icons/fonts/tabler-icons-subset.woff2` |
| Unicode一覧 | `assets/vendor/tabler-icons/subset-unicodes.txt` |
| 利用アイコン台帳 | `reports/tabler-subset-manifest-v13085.json` |
| 再生成スクリプト | `scripts/build-tabler-subset-v13085.mjs` |
| PWA配信 | `index.html`と`sw.js`はサブセットのみを参照・precache |
| 回帰検証 | P42がローカル配信、precache、主要サッカー語彙、全利用クラスを検証 |

## 再生成手順

新しいTablerクラスを追加・削除した場合は、アプリケーション変更と同じプルリクエストで以下を実行する。

```bash
node scripts/build-tabler-subset-v13085.mjs
pyftsubset assets/vendor/tabler-icons/fonts/tabler-icons.woff2 \
  --unicodes-file=assets/vendor/tabler-icons/subset-unicodes.txt \
  --flavor=woff2 \
  --output-file=assets/vendor/tabler-icons/fonts/tabler-icons-subset.woff2 \
  --layout-features='*' --name-IDs='*' --name-legacy --glyph-names \
  --symbol-cmap --legacy-cmap --notdef-glyph --notdef-outline --recommended-glyphs
node tests/p42-tabler-icon-migration-test.mjs
```

サブセット生成後は、CSS・WOFF2・マニフェストが同じクラス集合を表すこと、`sw.js`のキャッシュ世代を更新すること、P42・P44・全契約テストを通すことを必須とする。

## リスクと統制

| リスク | 防止策 |
|---|---|
| 新しい`ti-*`クラスを追加してもサブセットを再生成しない | P42がサブセットCSSの未定義クラスとして失敗する。PRチェックリストへ再生成を明記する。 |
| 動的テンプレート内のクラスを監査対象から漏らす | 抽出対象をルート直下の全ランタイムJavaScriptに固定し、P42と同じ範囲を使う。 |
| フル版を誤ってprecacheし、容量が戻る | P42がフル版CSS・WOFF2のprecache再導入を失敗させる。 |
| サブセットCSSを手編集してコードポイントがずれる | 生成ファイルにスクリプト名を明記し、手編集を禁止する。 |
| 将来のTabler更新でコードポイントが変わる | バージョンを固定し、更新時はフル版を差し替え、再生成・P42・目視確認を同時実施する。 |

## 採用判断

**採用する。** 実使用の全144クラスを含み、サッカー主要語彙、PWAのローカル配信、オフラインprecache、契約テストを維持したまま、PWAのアイコン資産を96.38%削減できるためである。将来は、アイコン追加時の再生成をDS-R6の変更テンプレートとリリース手順へ組み込む。
