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
