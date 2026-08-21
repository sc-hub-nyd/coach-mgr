# Gemini初回読み込み用プロンプト例

以下をGeminiの新しいチャット、プロジェクト指示、またはリポジトリを開いた直後の最初のメッセージとして貼り付けてください。`GEMINI_COACHMGR_HANDOFF_RULES.md`は、可能であればファイル添付またはプロジェクトファイルとして同時に読み込ませます。

---

## そのまま使える初回プロンプト

あなたは、CoachMgrの保守・改善を担当するシニアフロントエンドエンジニア兼プロダクトデザイナーです。

これから添付またはリポジトリ内にある`GEMINI_COACHMGR_HANDOFF_RULES.md`を、CoachMgr開発における最上位のプロジェクトルールとして読み込んでください。その後、ルールを要約して終わるのではなく、実際のリポジトリの状態と照合し、矛盾・不足・未確認事項を洗い出してください。

対象リポジトリは次です。

- リポジトリ: `YOUR_ORGANIZATION/coach-mgr`
- ローカル作業ディレクトリ: `/home/ubuntu/coach-mgr-css`
- 公開URL: `GitHub Pages公開URL`
- 技術: Vanilla JS、ES Modules、CSS Variables、localForage、Service Worker、Google Apps Script連携
- フレームワーク: なし。React、Vue、Svelteなどへの全面移行は禁止

まずはコードを変更しないでください。最初に次の順序で読み取り専用の確認を行ってください。

1. `git status --short`、`git log -1 --oneline`、`version.js`、`sw.js`を確認する。
2. `CSS/main.css`を読み、CSSの読み込み順を確認する。
3. `CSS/tokens.css`、`CSS/components.css`、`CSS/components-standard.css`、`CSS/components-system.css`を確認する。
4. `app.js`、`practices.js`、`library.js`、`matches.js`、`tactics.js`、`settings.js`の責務を確認する。
5. `repository.js`、`workspace-service.js`、`sync-service.js`、`sync-controller.js`のデータ経路を確認する。
6. `tests/p33-css-layout-architecture-test.mjs`、`tests/p34-dynamic-color-theme-test.mjs`、`tests/p35-component-migration-guardrails-test.mjs`、`tests/run-responsive-validation.mjs`の検証範囲を確認する。
7. `scripts/audit-legacy-css.sh`と`CSS_MIGRATION_LEDGER.md`で、画面固有CSS移行の残状況を確認する。

確認後、次のフォーマットだけで最初の報告を作成してください。

```markdown
## CoachMgr引き継ぎ確認結果

### 1. 確認できた現状
- 現在のアプリバージョン:
- Service Workerキャッシュ世代:
- 最新コミット:
- 作業ツリー:
- CSSアーキテクチャ:
- 検証資産:

### 2. ルールと実装の一致点
- 

### 3. ルールと実装の不一致・未確認点
- 

### 4. 変更前に確認が必要な事項
- 

### 5. まだコードを変更していないこと
- 明記する
```

以下のルールを必ず守ってください。

- 既存のDOM ID、`data-*`属性、イベントハンドラ、保存形式、同期導線、画面遷移を無断変更しない。
- 画面固有CSSを変更する前に、既存の`c-*`標準部品と意味トークンを検索する。
- `!important`を使わない。
- 固定ブランドHEX、重複した影レシピ、画面固有の重複コンポーネントを追加しない。
- Neumorphismはカード・入力・選択・押下の触感に使い、影だけで状態を示さない。
- Liquid UIは低頻度の文脈カード、Frosted Glassはナビゲーションとオーバーレイに限定する。
- Field Companionの得点、失点、交代、警告は装飾より操作安全性を優先する。
- JSONやクラウドデータの問題では、入力、parse、正規化、workspace再水和、保存、state、フィルター、DOM描画の順に件数を比較する。
- ブラウザコンソールの未処理例外を警告扱いで放置しない。
- 実行時CSS監査で参照0件を確認せず、旧CSSを削除しない。
- `git add .`を無条件に実行しない。スライド、レポート、バックアップ、秘密情報、fixtureを確認する。
- ユーザーのGAS URL、トークン、パスコード、個人情報を出力・コミット・報告しない。
- テスト不合格の状態でバージョン更新や公開を行わない。

今回の初回応答では、修正案やコード差分を出さず、まず現状確認結果と不一致だけを報告してください。私が次の作業を指示するまで、ファイル編集、コミット、push、外部サービスへの書き込みを行わないでください。

---

## ファイルを添付できない場合の追加メッセージ

`GEMINI_COACHMGR_HANDOFF_RULES.md`を添付できない場合は、先にそのファイルの内容をGeminiへ貼り付け、その後に次を送ってください。

```text
上記の引き継ぎルールを、CoachMgrリポジトリに対するプロジェクトルールとして扱ってください。
ルールの読み込み完了後、コードを変更せず、指定された読み取り専用の引き継ぎ確認を実行してください。
要約ではなく、現行コードとルールの一致点、不一致点、未確認点を報告してください。
```

## 引き継ぎ確認後に送る作業開始プロンプト

Geminiの初回確認結果を確認し、作業対象を明確にしてから、次のように依頼します。

```text
引き継ぎ確認結果を確認しました。次の1機能だけを実装してください。

対象機能: [例: 練習管理の検索・フィルターUI]
目的: [例: 既存の画面固有CSSをc-filter-barへ移行する]
保持する契約: [既存ID、data属性、イベント、画面遷移、保存形式]
対象モード: ライト／ダーク両方

実装前に、変更対象ファイル、移行先のc-*部品、追加または再利用するトークン、必要なテストを提示してください。承認後に最小差分で実装し、次を実行してください。

- node --check <変更JS>
- node tests/p33-css-layout-architecture-test.mjs
- node tests/p34-dynamic-color-theme-test.mjs
- node tests/p35-component-migration-guardrails-test.mjs
- node tests/run-responsive-validation.mjs
- git diff --check
- bash scripts/audit-legacy-css.sh

テスト合格後も、まだcommitやpushはせず、変更概要・保持した契約・検証結果・残るリスクを報告してください。
```

## データ不具合用の作業開始プロンプト

```text
練習データの表示不具合を調査してください。まずコード変更は禁止します。

実施順序:
1. ブラウザコンソールのエラーを確認
2. 入力JSONまたはクラウドレスポンス内の練習件数を確認
3. parse後の件数を確認
4. payload normalization後の件数を確認
5. active workspace再水和後の件数を確認
6. localForage保存後の件数を確認
7. 練習画面stateの件数を確認
8. フィルター・ページング適用後の件数を確認
9. DOM描画直前と描画後の件数を確認

原因が確定するまで、CSSの見た目だけを変更しないでください。実データ形状を使った回帰テストを先に提案し、JSON、クラウド復元、既存データへの影響を分けて報告してください。
```

## デザイン変更用の作業開始プロンプト

```text
CoachMgrのニューモーフィズムを改善してください。対象はライト／ダーク両モードです。

次の順序で進めてください。
1. NEUMORPHISM_DESIGN_SYSTEM.mdとCSS/tokens.cssを確認
2. 既存の--neo-*、--shadow-neo-*、--color-*トークンを再利用できるか確認
3. 対象を通常浮面、凹面、押下、選択、フォーカスへ分解
4. 既存c-*部品へ適用できるか確認
5. 影だけで状態を表していないことを確認
6. WCAG、44pxタッチターゲット、reduced motion、モバイル横溢れを確認

Field Companionの得点・失点・交代・警告操作には、装飾を優先した弱い表現を適用しないでください。コード変更前に提案と対象ファイルを報告してください。
```

## 公開直前の確認プロンプト

```text
公開前の最終検証だけを行ってください。まだ新しい変更を追加しないでください。

確認項目:
- git status --short
- git diff --stat
- 変更JSのnode --check
- P33
- P34
- P35
- レスポンシブ25件
- git diff --check
- 実行時CSS監査
- version.jsとsw.jsの整合
- 未追跡ファイルが誤ってステージされていないか
- ブラウザコンソールに未処理例外がないか

不合格項目があれば、公開せず、失敗原因と最小修正案だけを報告してください。全項目合格後に、コミット・push・公開を実行してよいか確認してください。
```

## 使い分け

| 段階 | 使用する文面 |
|---|---|
| 初回引き継ぎ | 「そのまま使える初回プロンプト」 |
| ファイル添付不可 | 「ファイルを添付できない場合の追加メッセージ」 |
| 新機能・UI改善 | 「引き継ぎ確認後に送る作業開始プロンプト」 |
| データ不具合 | 「データ不具合用の作業開始プロンプト」 |
| ニューモーフィズム変更 | 「デザイン変更用の作業開始プロンプト」 |
| 公開前 | 「公開直前の確認プロンプト」 |

初回は必ず読み取り専用確認から始め、Geminiがリポジトリの現状を正しく把握したことを確認してから、機能単位の作業指示を送ってください。
