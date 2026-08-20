# Tabler Icons移行調査メモ

**対象:** CoachMgr v1.30.82
**調査日:** 2026-08-20

## 調査結論

CoachMgrの汎用アイコンパックを**Font AwesomeからTabler Iconsへ移行することは実現可能**です。Tabler IconsはMITライセンスのSVGアイコンセットで、公式サイト上で6,184個のアイコン、24pxグリッド、2pxストロークの一貫した仕様を示しています。[1] リポジトリでは、outline 5,130個、filled 1,054個を含むこと、Webfont、SVG、SVG spriteなどの利用形態が提供されることを確認しました。[2]

CoachMgrはVanilla JSとPWAであり、既存のFont Awesomeも`<i>`要素とCSSクラスを中心に使っています。このため、**Tabler Webfontをローカル配信する方式**が、既存DOMの改変を最小化しつつ、PWAのオフライン動作を守る最適解です。公式ドキュメントは`@tabler/icons-webfont`のWebfontと`ti ti-*`クラスによる利用を案内しています。[3]

> 推奨方針は、Tabler Webfontをローカル資産としてService Workerのprecacheへ追加し、Font AwesomeのCDN依存を除去することです。CDNの`latest`指定ではなく、固定バージョンを使います。

## Tablerの採用根拠

| 観点 | 確認結果 | CoachMgrへの意味 |
|---|---|---|
| ライセンス | MIT | 配布・改変・商用利用を含むアプリへの組込みに適する [1] [2] |
| デザイン整合 | 24pxグリッド、2pxストローク | カスタムSVGマスクアイコンと線画のトーンを合わせやすい [1] [2] |
| 提供形態 | SVG、Webfont、Sprite、各種フレームワーク用パッケージ | Vanilla JSではWebfontまたはSVGマスクを選べる [2] [3] |
| サッカー文脈 | `ball-football`、`soccer-field`、`shirt-sport`、`shoe`、`run`、`trophy`、`target`を確認 | 試合・練習・戦術・選手分析の語彙をより自然に揃えられる |
| オフライン | WebfontのCSS/WOFF2をローカルへ同梱可能 | PWAのService Workerで確実にprecacheできる |

## 現行Font Awesome利用実態

現行のCDN参照は`index.html`のFont Awesome 6.4.0です。Service Workerは該当CDNの外部リクエストをネットワーク優先として扱っていますが、アイコンフォント自体はローカルprecacheされていません。

静的HTML／JSから、**約150種類のFont Awesome名**を検出しました。出現回数の多いものは、`plus` 35回、`xmark` 20回、`futbol` 20回、`bullseye` 16回、`trash` 15回、`pen` 15回、`chevron-right` 15回、`users` 14回、`trophy` 11回です。利用は、`index.html`、`app.js`、`drawing.js`、`insights.js`、`library.js`、`matches.js`、`players.js`、`practices.js`、`settings.js`、`sync-conflict-dialog.js`、`tactics.js`、`utils.js`にまたがります。

| 現行のFont Awesome用途 | Tablerの代表候補 | 移行時の扱い |
|---|---|---|
| サッカーボール `futbol` | `ti-ball-football` | 高優先で置換。Tabler採用の価値を最も示しやすい |
| 戦術テーマ `bullseye` | `ti-target` / `ti-target-arrow` | 文脈ごとに選択。戦術指示は`target-arrow`を優先 |
| アシスト `shoe-prints` | `ti-shoe` | 高優先で置換。スポーツ文脈を明確化 |
| 選手・走力 `person-running` | `ti-run` / `ti-run-sprint` | 走力・移動では`run`、スプリント分析では`run-sprint` |
| ピッチ・戦術盤 | `ti-soccer-field` | 戦術導線、作図の補助アイコンへ適用候補 |
| 汎用操作 | `ti-plus`、`ti-pencil`、`ti-trash`、`ti-device-floppy`、`ti-search` | 自動変換候補。意味が一対一で近い |
| 同期・クラウド | `ti-cloud-download`、`ti-cloud-upload`、`ti-refresh`、`ti-cloud-check` | 通信状態の視認性を統一 |
| 画面操作 | `ti-chevron-*`、`ti-arrow-*`、`ti-menu-2`、`ti-x` | ナビゲーション・モーダル・開閉を一括変換 |
| YouTube | `ti-brand-youtube` | 外部サービス識別に限定して使用 |

## ローカル配信の設計判断

調査時点の`@tabler/icons-webfont`最新版は**3.46.0**です。公式Webfont CSSは`tabler-icons.woff2`を相対パスで参照します。完全版はCSS約258KB、WOFF2約462KBで、初回インストール時にはService Workerのprecacheへ追加できます。

| 選択肢 | 利点 | 懸念 | 判定 |
|---|---|---|---|
| Tabler CDN | 置換が最短 | 初回オフライン時に依存が残る。外部版変更の影響を受ける | 不採用 |
| Tabler Webfontをローカル同梱 | 現行の`<i>`要素を活かせる。PWAでオフライン保証可能 | 完全版WOFF2が約462KB | **採用** |
| 個別SVGを全画面へ配置 | 転送量を最適化できる。カスタムSVGと同じ見え方 | 150前後の対応・マークアップ変更が必要 | 将来のPhase 3で一部導線に適用 |
| Font Awesomeと併用 | 段階移行が容易 | 二重依存・二重設計が長期化する | 一時的な移行期間のみ許容 |

## 外部ソース

[1] [Tabler Icons — Official icon browser](https://tabler.io/icons)
[2] [tabler/tabler-icons — GitHub repository](https://github.com/tabler/tabler-icons)
[3] [Tabler Icons Webfont documentation](https://docs.tabler.io/icons/libraries/webfont)

## ローカル表示確認

ローカルPWAを更新通知から再読み込みし、**v1.30.83**への切替を確認しました。サイドナビ、ダッシュボードの予定・成績・空状態、下部の役割・同期操作でTablerの線画アイコンが表示され、アイコンフォント未読込時の文字化けは確認されませんでした。

さらにDOM検証では、ローカル`tabler-icons.css`が読み込まれ、画面上のTablerアイコン106個に対して計算済みフォント`tabler-icons`が適用されることを確認しました。サンプルとして得点アイコンは`ti ti-ball-football`で表示されています。

## 公開確認

GitHub Pagesの契約テストとPagesビルドの成功後、公開PWAを確認しました。旧Workerがアクティブな端末でも、v1.30.83のService Workerが`waiting`状態で配信されており、アプリ内の更新通知から適用できる状態です。

更新を適用して再読み込み後、公開版のバージョン表示が**v1.30.83**へ切り替わり、ダッシュボードとサイドナビのTabler線画アイコンを確認しました。
