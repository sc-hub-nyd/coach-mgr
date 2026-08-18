# Text Effects Colorion 調査メモ

- 調査日：2026-08-18
- 参照URL：https://text-effects.colorion.co/

## 確認事項

Colorion Text Effectsは、78種類の純CSSテキストエフェクトを掲載するライブラリである。ページ上では、CSSのみ、依存関係なし、MITライセンス、`prefers-reduced-motion`を尊重することが明示されている。

確認できた演出カテゴリには、Aurora / Borealis、Glitchcore、Teletype、Neon-Haus、Aqua-Fill、Chromia、Lens-Drift、Tidal-Type、Bisect、Cipher、Redactor、Emberglowがある。CoachMgrでは、Liquid UIとの親和性からAqua-Fillの「液体的なグラデーション文字」の方向性、Frosted Glassとの親和性からBorealisの「低コントラストのオーロラ光沢」の方向性を参照する。ただし、原文CSSをそのまま移植せず、CoachMgrのセマンティックトークンと読みやすさ・動作軽減規約に合わせて再設計する。

## CoachMgrへの適用判断

- 使用対象：ダッシュボードの画面導入見出し、セクション見出しの補助ラベル、空状態の短い導線、公開済み・同期済みなど一回限りの肯定的なフィードバック。
- 使用しない対象：試合中の得点・失点・交代・警告操作、データ表、タイムライン、長文、エラー・警告・削除操作、入力ラベル。
- 実装要件：テーマ由来の`--liquid-*`、`--glass-*`、`--color-*`のみを参照し、固定色を持ち込まない。モーションはtransformとopacityを中心にし、`prefers-reduced-motion`とアプリの`data-reduce-motion`で非アニメーション表示へ戻す。文字列自体は常時読め、アニメーションの完了を情報伝達に必要としない。
