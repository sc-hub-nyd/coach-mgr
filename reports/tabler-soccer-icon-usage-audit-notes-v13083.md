# Tablerサッカー関連アイコン利用監査メモ（v1.30.83）

## 公式カタログ確認

- 調査日: 2026-08-20（JST）
- 公式カタログ: https://tabler.io/icons
- アプリ同梱版: Tabler Icons Webfont 3.46.0

Tabler公式カタログはv3.46.0として公開され、24×24グリッド・基本2pxストロークの一貫した線画セットであると説明している。公式ページ上で、6184個のオープンソースアイコン、MIT License、HTML/SVG sprite/React等の利用形態を確認した。CoachMgrはこのうちローカル配信Webfontを採用しており、PWAのオフライン要件に適合する。

## 調査対象の意味づけ

サッカー固有の概念は `ball-football`、`soccer-field`、`shirt-sport`、`shoe` を優先対象とする。競技の記録・試合運営は `flag`、`trophy`、`target`、`run`、`clock`、`calendar-event`、`user`/`users-group`、`route`・方向矢印を候補として、用途の混同を起こさない範囲で評価する。なお、同梱Webfontには笛およびサッカーの警告・退場を直接表す専用カードは定義されていない。

## 参照

- Tabler Icons: https://tabler.io/icons
- Tabler Icons repository: https://github.com/tabler/tabler-icons

## 公開版の確認状況

公開PWAはv1.30.83でTablerアイコンの正常表示を確認した。作図ツールはコーチモード配下であり、公開データを保護するためのパスコード入力が必要である。パスコードを推測・回避せず、以下の作図ツールの評価はリポジトリの実装（ツールバーHTML、Canvas描画コード、スタイル）を根拠に行う。

## 作図ツールの形状比較（36px）

比較プレビューで、現在の `ti-dots`（パス）は単なる三点リーダーに見え、方向・送球という意味を担えないことを確認した。`ti-activity`（ドリブル）は心電図・稼働状況としても読めるため、ボールを運ぶ動線とは連想しにくい。`ti-caret-up`（コーン）は小さな三角形であり、`ti-menu-2`（ラダー）はハンバーガーメニューに見えるため、両者とも練習器具としての形状認識が弱い。

同一セットには、方向性を含む `ti-arrow-right-dashed`、ジグザグの `ti-arrow-zig-zag`、経路の `ti-route`、器具の実形状に近い `ti-cone`、`ti-ladder` が存在する。これらは現在の候補より操作対象を直接表す。移動・パス・ドリブルはアイコンだけで完結させず、常時表示される日本語ラベルと選択時のスタイルを組み合わせることが必要である。

視覚比較ファイル: `reports/tabler-soccer-icon-preview-v13083.html`
