# CoachMgr v1.17.1 CSS差分・レイアウト標準化の解説

## 1. まず区別すべき点

v1.17.1で追加された主なCSS変更は、**v1.17.0で導入した標準レイアウト基盤の上に行った、小型端末向けの横溢れ修正**です。カード、ページ幅、グリッド、セクション見出し、操作群などの大規模な標準化そのものは、主にv1.17.0で導入されています。

したがって、今回の差分は次の二層に分けて読むと理解しやすくなります。

| 層 | 主な内容 | 対象バージョン |
|---|---|---|
| レイアウト基盤 | トークン、共通ページ幅、スタック、グリッド、カード、見出し、操作群、空状態、フォーム部品 | v1.17.0 |
| レスポンシブ補正 | 320px・390pxでのトップバー、ランキング、設定フォームの横溢れ解消 | v1.17.1 |

## 2. v1.17.1の修正①：トップバーを極小幅でアイコン主体に変更

### 変更前の問題

320px幅では、トップバーにタイトル、ロールバッジ、屋外モード、モード切替、同期、バージョン、アバターなどが同時に並びます。各操作に`white-space: nowrap`と`flex-shrink: 0`が指定されていたため、操作を縮められず、本文よりトップバーの内容が広くなるケースがありました。

### 変更後の主要コード

```css
@media (max-width: 420px) {
    .topbar {
        gap: 0.25rem !important;
        padding-inline: 0.5rem !important;
    }

    .topbar-title {
        min-width: 0;
        margin-right: 0 !important;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .topbar #user-role-badge {
        display: none !important;
    }

    .topbar-btn,
    .topbar-badge,
    .topbar button.topbar-btn,
    .topbar div.topbar-badge {
        flex: 0 0 32px;
        width: 32px;
        padding: 0 !important;
    }

    .topbar .topbar-btn-text,
    .topbar-btn span,
    .topbar-badge span,
    .topbar button span {
        display: none !important;
    }
}
```

この変更のポイントは、**操作の優先順位を保ったまま、文字ラベルをアイコンへ縮退させる**ことです。タイトルは`min-width: 0`と`text-overflow: ellipsis`によって残り幅だけを使い、操作ボタンは32pxの固定スロットへ収めています。ロールバッジはトップバーから省略しますが、ロール切替機能そのものを削除したわけではありません。

## 3. v1.17.1の修正②：詳細画面では戻る操作を優先

詳細画面では、戻るボタンとバージョン履歴ボタンが同じトップバーに並ぶと、320px幅で競合します。そこで、戻るボタンが表示されている場合に限り、バージョン履歴ボタンを極小幅で非表示にしています。

```css
@media (max-width: 420px) {
    #topbar-back:not(.hidden) ~ div #topbar-version-badge {
        display: none !important;
    }
}
```

これは情報を恒久的に削除する仕様ではなく、**試合詳細やField Companionで最も重要な「戻る」操作を優先する一時的な表示制御**です。バージョン情報は設定・更新通知など別の導線で確認できます。

## 4. v1.17.1の修正③：コーチ専用ランキングを520px以下で一列化

### 変更前の問題

ダッシュボードの出席率・出場時間ランキングは、HTML上では`.dash-row-2`の二列グリッドです。別の古いCSSに、次のような高特異性指定が残っていました。

```css
body #app .dash-widget-grid #dash-coach-row.dash-row-2 {
    grid-template-columns: 1fr 1fr;
}
```

一般的な`.dash-row-2`のモバイル上書きよりも、この指定の方が優先されるため、320px・390pxでも二列が維持され、カードの一部が右側へ押し出されていました。

### 変更後の主要コード

```css
@media (max-width: 520px) {
    body #app .dash-widget-grid #dash-coach-row.dash-row-2 {
        grid-template-columns: 1fr;
    }
}
```

さらに、一般の二列行にも同じ方針を適用しています。

```css
@media (max-width: 520px) {
    .dash-row-2 {
        grid-template-columns: 1fr;
    }
}
```

ここでは、既存ルールを無理に削除するのではなく、**同じ特異性を持つモバイル用の後置ルールで安全に上書き**しています。これにより、デスクトップ・タブレットでは従来どおり二列、520px以下では一列になります。

## 5. v1.17.1の修正④：設定追加フォームの入力欄を縮小可能にする

### 変更前の問題

設定画面の追加行は、ラベル、入力欄、保存ボタンを横並びにしています。Flexアイテムの入力欄が十分に縮小できない場合、320px幅でフォーム全体が画面外へはみ出す可能性がありました。

### 変更後の主要コード

```css
@media (max-width: 360px) {
    .sl-row {
        min-width: 0;
        padding-inline: 0.75rem;
    }

    .sl-add-row > form {
        width: 100%;
        min-width: 0;
    }

    .sl-add-row .sl-input {
        width: 0;
        min-width: 0;
    }

    .sl-add-row form .btn {
        flex: 0 0 auto;
    }
}
```

`width: 0`は入力欄を消す指定ではありません。Flexレイアウトにおいて、入力欄が利用可能な残り幅まで縮小できるようにするための指定です。一方、保存ボタンは`flex: 0 0 auto`で操作可能な幅を維持します。つまり、**入力欄を縮め、アクションボタンを守る**設計です。

## 6. v1.17.0で導入されたレイアウト標準化

### 6.1 CSSの読み込み順

`CSS/main.css`では、責務を次の順で読み込んでいます。

```css
@import url('base.css');
@import url('tokens.css');
@import url('layouts.css');
@import url('components.css');
@import url('components-standard.css');
@import url('dashboard.css');
@import url('tactical.css');
@import url('drawing.css');
@import url('utilities.css');
```

基盤、トークン、共通レイアウト、共通部品、画面固有スタイル、ユーティリティという順に整理し、**新規部品を先に定義し、画面固有の調整を後段で行う**構成です。既存画面を一括置換せず、画面ごとに段階移行できるようにしています。

### 6.2 意味トークン

`CSS/tokens.css`では、余白・角丸・影・表示幅・操作サイズなどを直接値ではなく変数で扱います。

```css
:root {
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.25rem;
    --space-6: 1.5rem;

    --radius-sm: 0.5rem;
    --radius-md: 0.75rem;
    --radius-lg: 1rem;
    --radius-pill: 999px;

    --shadow-sm: 0 1px 3px rgb(15 23 42 / 0.08);
    --shadow-md: 0 8px 24px rgb(15 23 42 / 0.12);
    --content-wide: 76rem;
    --tap-target: 44px;
}
```

これにより、画面ごとに`padding: 13px`や`border-radius: 15px`のような値が増殖することを防ぎます。テーマ変更や全体の密度調整も、トークンを変更するだけで適用できます。

### 6.3 共通レイアウト部品

`CSS/layouts.css`では、画面の骨格を`l-`接頭辞で統一しています。

```css
.l-page {
    width: min(100%, var(--content-wide));
    margin-inline: auto;
    padding: var(--space-5);
}

.l-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
}

.l-grid {
    display: grid;
    grid-template-columns: repeat(
        auto-fit,
        minmax(min(100%, var(--grid-min)), 1fr)
    );
    gap: var(--space-4);
    min-width: 0;
}

.l-form-grid {
    display: grid;
    grid-template-columns: repeat(
        auto-fit,
        minmax(min(100%, 12.5rem), 1fr)
    );
    gap: var(--space-3);
}
```

特に`minmax(min(100%, ...), 1fr)`と`min-width: 0`が重要です。カードの最小幅が画面幅を超えないようにし、長いテキストやフォーム項目が親コンテナを押し広げることを防ぎます。

### 6.4 共通コンポーネント

`CSS/components-standard.css`では、再利用部品を`c-`接頭辞で定義しています。

```css
.card.c-card {
    min-width: 0;
    padding: var(--space-4);
    background: var(--card-bg);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

.c-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    min-width: 0;
}

.c-action-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
}

.c-empty-state {
    display: grid;
    place-items: center;
    min-height: 8rem;
    padding: var(--space-5);
    border: 1px dashed var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-muted);
    color: var(--text-muted);
    text-align: center;
}
```

クラスの責務は、`l-`が配置、`c-`が再利用可能な見た目、`is-`が状態、`u-`が限定的なユーティリティです。この分離により、画面固有のセレクタやIDへ依存せずに新しい画面を追加できます。

## 7. Field Companionでの標準化との関係

Field Companionは試合当日の誤操作コストが高いため、一般画面と完全に同じレイアウトにはせず、共通トークンを使いながら専用の操作帯を持たせています。

```css
@media (max-width: 760px) {
    .field-action-bar {
        position: sticky;
        bottom: calc(env(safe-area-inset-bottom) + .45rem);
        min-height: 52px;
        z-index: 8;
    }
}

@media (max-width: 520px) {
    .field-action-bar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .field-action-bar .btn:last-child {
        grid-column: 1 / -1;
    }
}
```

標準化の目的はすべてを同じ見た目にすることではなく、**共通トークンと共通部品を使いつつ、利用文脈に応じて操作密度を最適化すること**です。

## 8. 検証結果

v1.17.1では、次の5種類の幅で主要画面を確認しました。

| 幅 | 対象 |
|---:|---|
| 320px | 最小スマートフォン相当。トップバー、設定フォーム、Field Companionを重点確認 |
| 390px | 標準スマートフォン相当。コーチ用ランキングとカード行を重点確認 |
| 768px | タブレット相当。二列から一列への切替を確認 |
| 1024px | 小型デスクトップ相当。サイドバーとコンテンツ幅を確認 |
| 1440px | デスクトップ相当。最大可読幅とカード密度を確認 |

保護者・コーチのダッシュボード、設定、振り返り、試合詳細・Field Companionの合計25画面幅組合せで、`scrollWidth`と画面外要素を検査した結果、修正後の横溢れは**0件**でした。既存契約テストも**24/24件成功**しています。

## 9. 変更の要約

v1.17.1のCSS差分は、単に画面を縮小したものではありません。トップバーでは情報の優先順位を整理し、ランキングでは高特異性による意図しない二列表示を解消し、設定フォームでは入力欄と操作ボタンのどちらを守るかを明確にしました。その上で、v1.17.0で導入したトークン・レイアウト・コンポーネント基盤を維持し、今後の画面追加でも同じレスポンシブ原則を再利用できる構造にしています.
