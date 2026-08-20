# R1〜R6 直接指定色移行 完了監査（v1.30.87）

**対象:** CoachMgr v1.30.87  
**実施日:** 2026-08-20  
**対象範囲:** 戦術・Canvas視覚表現およびレガシー画面・モーダル互換規則

## 結論

R1〜R6により、v1.30.86時点で画面・部品層に残っていた直接指定色 **277件**のうち、戦術・Canvas視覚表現 **92件**とレガシー画面・モーダル互換規則 **66件**、合計 **158件**を意味トークンまたはCanvasパレットへ移行した。現作業ツリーの同一監査範囲は **119件**であり、v1.30.86から **158件削減（57.0%減）**、DS-R2開始前の325件から **206件削減（63.4%減）**である。

> `canvas-palette.js`内のフォールバック値と`tokens.css`内のトークン定義値は、色の所有者として意図的に残す。画面・部品・描画ロジックへ散在する直接指定色とは区別する。

| 比較基準 | 直接指定色 | 増減 | 意味 |
|---|---:|---:|---|
| DS-R2移行前 | 325 | — | 画面・部品層の基準値 |
| v1.30.85 | 278 | -47 | ダッシュボード・toast・overlay移行後 |
| v1.30.86 | 277 | -48 | モーダルoverlayの追加移行後 |
| **v1.30.87** | **119** | **-206** | R1〜R6完了後 |

## 実装した6つの波

| 波 | 実装 | 直接指定色への効果 | 互換性・安全策 |
|---|---|---:|---|
| R1 | `canvas-palette.js`、Canvas意味トークン、色台帳を追加 | 基盤整備 | 旧`red`／`blue`等、任意HEX、保存済みオブジェクトを解決時に互換処理 |
| R2 | レガシーモーダル、動画面、ピッチプレビュー、PWA更新通知を状態・surfaceトークンへ移行 | 66件の退出に必要なトークンを整備 | DOM ID、dialog属性、イベント、閉じる操作を維持 |
| R3 | `tactical.css`をCanvasトークンへ移行 | Canvas 92件のうち31件 | pitch、line、grid、注釈の役割を分離し、light/darkで再定義 |
| R4 | RSVP、インサイト、注意・情報表示、入力・フォーカス面を既存状態部品のトークンへ統合 | レガシー66件の退出を完了 | `c-notice`、`c-status`、`c-toast`の既存契約を再利用 |
| R5 | `drawing.css`、`drawing.js`、`pitch-renderer.js`をCanvasパレットへ接続 | Canvas 92件の残る61件 | 作図、選択、軌跡、画像・動画export、フォーメーション一括配置を同一パレットで描画 |
| R6 | 旧modal／overlay／bottom-sheet shellを削除し、`c-modal--bottom-sheet`、P51、P52、PWA precacheを追加 | 直接色の再追加を防止 | `coachmgr-v197`で新モジュールをオフライン配信し、互換CSSの再導入をテストで禁止 |

## Canvas 92件の移行設計

CanvasではCSSの値をそのまま`CanvasRenderingContext2D`へ渡さず、`getCanvasPalette()`が計算済みのテーマトークンを取得する。`resolveCanvasObjectColor()`は保存済みの名称付き色と任意HEXを解決し、保存データは書き換えない。これにより、過去の戦術ボード、undo/redo履歴、インポート済みデータ、ホーム／アウェイカラー、作図exportの互換性を保つ。

| 色の役割 | 所有者 | 利用箇所 |
|---|---|---|
| ピッチ、境界、センター線、ガイド | `--canvas-pitch-*` | tactical CSS、`drawPitchToCtx()` |
| 選手、ボール、コーン、マーカー、視野、文字 | `--canvas-object-*` | 新規オブジェクト、保存済みオブジェクト、軌跡 |
| 選択、ハンドル、輪郭、スナップライン | `--canvas-selection-*`、`--canvas-object-annotation` | 選択操作、ドラッグ、整列ガイド |
| ゴール、注釈、動画exportテロップ | `--canvas-chrome-*`、`--canvas-overlay-*` | ミニゴール、テキスト背景、動画書き出し |

## レガシー画面 66件の移行設計

レガシー画面では、同じ色値を機械的に置換せず、表示意図を状態、surface、text、border、shadowへ分解した。たとえば出席可否は成功・危険状態、PWA更新通知は更新状態、注意書きはwarning状態、動画面はmedia surface、ピッチプレビューはCanvas surfaceとして表す。これにより、チームカラー、light/dark、今後の状態部品追加が一貫して反映される。

| 旧領域 | 新しい役割トークン／部品 | 完了状態 |
|---|---|---|
| 旧modal、overlay、bottom-sheet | `c-modal`、`c-modal--bottom-sheet`、`--color-overlay-scrim` | 旧shell規則を削除 |
| RSVP・結果・インサイト | `--color-success`、`--color-danger`、`--color-warning`、状態surface | 状態別の可読性を維持 |
| PWA更新通知 | `--color-update-*` | 操作面・文字・境界・shadowを意味分離 |
| フィルター、ドロワー、ヘルプ | surface、border、focus、shadowトークン | 入力・hover・focusのテーマ追随を維持 |
| 動画・ピッチプレビュー | `--color-media-surface`、`--canvas-pitch-*` | 複数画面で同じ表現を共有 |

## 品質ゲートとリリース条件

| 領域 | 検証 |
|---|---|
| 作図機能 | P40でツール選択、個別配置、図形・軌跡、undo/redo、一括配置、保存導線を検証 |
| 作図の可読性 | P43で意味アイコン、常時ラベル、ARIA状態を検証 |
| テーマ | P34で15チームカラー×light/darkを検証 |
| 状態・モーダル | P45、P49、P52で状態部品、共通モーダル、旧shell削除を検証 |
| Canvas色所有者 | P51で直接指定色の再追加、保存値互換、PWA precacheを検証 |
| 色債務 | P50と監査スクリプトで基準コミット、v1.30.85、作業ツリーを比較 |
| 配信 | Service Workerを`coachmgr-v197`へ更新し、`canvas-palette.js`と`pitch-renderer.js`をprecache |

## 残る119件の扱い

残債は`components-system.css`、`dashboard.css`、`components-standard.css`、`main.css`にある。Canvas、レガシー画面、モーダルshellは今回の対象から退出済みである。次の改善では、共通部品の旧互換規則、静的テンプレート移行カタログ、ダッシュボード固有規則を、使用頻度と状態部品への収束度に基づいて優先順位付けする。

ロールバック時は、保存データを移行していないため、v1.30.87のCSS・JavaScript・Service Workerを直前リリースへ戻すだけでよい。PWAが古いアプリシェルを持つ場合は、更新通知から新しい`coachmgr-v197`を適用する。

## 再現コマンド

```bash
node tests/run-contract-tests.mjs
node tests/run-responsive-validation.mjs
node tests/p34-dynamic-color-theme-test.mjs
node scripts/analyze-direct-color-debt-v13086.mjs
git diff --check
```
