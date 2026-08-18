# P10 外部参照メモ

- Google Apps Script Web Apps: <https://developers.google.com/apps-script/guides/web>
  - Web App は `doGet(e)` または `doPost(e)` を実装し、TextOutput/HtmlOutput を返す必要がある。
  - GET/POST のパラメータはイベントオブジェクトで取得でき、POST本文は `e.postData.contents` に含まれる。
  - Web App の実行主体と共有範囲はデプロイ設定で決まる。
  - `c` と `sid` は予約済みパラメータのためAPIパラメータとして使用しない。

- Google Apps Script Properties Service: <https://developers.google.com/apps-script/guides/properties>
  - Script Properties はスクリプト全体で共有する設定値向けのキー・バリューストアである。
  - Project Settings から Script Properties を設定できる。

- Google Apps Script Content Service: <https://developers.google.com/apps-script/guides/content>
  - ContentService はJSON TextOutputを返すWeb APIに使用できる。
  - Content Service の応答は `script.googleusercontent.com` のワンタイムURLへリダイレクトされるため、クライアントはリダイレクト追従が必要である。

参照日: 2026-08-18 JST

## 2026-08-18: POST応答のリダイレクト経路

- 公開済み安全モードWeb Appへの無効トークンPOSTは初回応答として短時間の`302`を返し、`script.googleusercontent.com`の一時URLへ誘導された。
- Content ServiceはPOST・GETを問わず一時URLへリダイレクトする。クライアントはリダイレクトを追従する必要がある。
- Google Cloud Communityの技術検証では、POST後の一時URLはGETで取得する必要があると説明されている。出典: <https://medium.com/google-cloud/understanding-flow-of-request-to-web-apps-created-by-google-apps-script-ac49e80f7c6b>

この結果はクライアント側のタイムアウト診断に用いる。秘密情報は記録しない。
