# CoachMgr Release Candidate — P10–P12

**対象ブランチ:** `feat/p0-ux-redesign`  
**対象版:** `v1.11.0` / Service Worker `coachmgr-v56`  
**判定日:** 2026-08-18

## 判定

> **条件付きリリース候補**です。アプリケーション側の契約テストとブラウザ受け入れ試験は完了しています。ただし、安全モードを本番で有効にする前に、リポジトリの `gas/Code.gs` をGoogle Apps Scriptへ配置し、Script Propertiesの認証トークン設定とPOST認証を実環境で確認する必要があります。

| フェーズ | 主要成果 | 検証結果 |
|---|---|---|
| P10 | 認証情報をURLに露出しないPOST受信の安全モード、GASテンプレート、旧API互換モード | 契約テスト成功。既存の`test`シートは互換モードで維持 |
| P11 | 自動復旧ポイント、復旧用JSON書き出し、同期失敗の端末診断、バックアップ鮮度警告 | 契約テストおよびPWA画面試験成功 |
| P12 | 試合時計連動の画面常時表示、触覚フィードバック、視認可能な「画面オン」状態 | 対応ブラウザで時計の開始・停止に伴う有効化・解除を確認 |

## 総合回帰試験

次のテストを実行し、すべて成功しました。

| テスト | 対象 |
|---|---|
| `p4-core-test.mjs` | 保存・スキーマ移行・同期サービス |
| `p5-field-companion-contract.mjs` | Field Companionの時計・イベント履歴 |
| `review-remediation-test.mjs` | 複数ピリオド・競合・PWA資産 |
| `p6-team-operations-test.mjs` | 出欠・テンプレート・共有文 |
| `p7-insights-test.mjs` | 振り返り・選手活動・共有文 |
| `p8-operations-test.mjs` | バックアップ・運用診断・PWA更新 |
| `p10-sync-security-test.mjs` | URL非露出の安全同期・互換モード |
| `p11-reliability-test.mjs` | 復旧ポイント・同期障害診断 |
| `p12-field-session-test.mjs` | 画面常時表示・触覚フィードバック |

## ブラウザ受け入れ試験

| 項目 | 結果 |
|---|---|
| PWA更新 | 利用者確認を経て`v1.11.0`と`coachmgr-v56`へ更新できることを確認 |
| Field Companion | 得点・失点・交代・警告・メモ・Undo・ピリオド切替・再読込後の復元を確認済み |
| Field session | 時計開始時に画面常時表示が有効化され、停止時に解除されることを確認 |
| 自動復旧ポイント | 設定の運用チェック表示とJSON出力処理を確認 |
| GAS互換同期 | `test`シートに限定してpush/pull・競合・復元を確認済み |

## リリース前の必須手順

1. `gas/README.md` に従い、`gas/Code.gs` と `gas/appsscript.json` を独立したApps Scriptプロジェクトへ配置します。
2. Apps ScriptのScript Propertiesに秘密トークンを登録し、Web Appを再デプロイします。
3. 設定画面で **安全モード（POST認証・推奨）** を選択し、`test`シートでPOSTのpush/pullを確認します。
4. 旧Web Appは検証が終わるまで保持し、問題がある場合だけ設定で互換モードに戻します。
5. 本番の`2022`シートへ切り替える前に、設定画面の「今すぐバックアップ」で端末JSONを保管します。

## 既知の注意事項

安全モードへの切替は、GASテンプレートのデプロイ完了前には行えません。実運用中のGASエンドポイントでは、P9で無効な認証トークンのGET要求に対する拒否を確認できなかったため、旧APIの互換モードを使用し続ける場合でも、GAS側のGET認証実装を監査してください。

機密情報はリポジトリへ含めていません。認証トークンはブラウザのローカル設定およびApps ScriptのScript Propertiesで管理してください。
