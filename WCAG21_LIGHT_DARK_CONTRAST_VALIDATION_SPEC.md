# CoachMgr：WCAG 2.1 コントラスト検証仕様

## 1. 目的と適用範囲

高コントラストモードを廃止するCoachMgrでは、**ライトモードとダークモードの各々が、そのままWCAG 2.1 AAのコントラスト要件を満たす**ことをリリース条件にします。これは、利用者が追加の表示モードへ切り替えなくても、練習・試合・設定・名簿・同期の主要情報を識別できる状態を意味します。

対象は、Field Greenなどのすべてのチームテーマ、light/darkの双方、320pxから1440pxまでの表示幅です。達成基準の判定は、表示されたピクセルの見た目だけでなく、実際にCSSが指定した前景色・背景色・境界色から行います。WCAGはアンチエイリアスの影響を避けるため、ユーザーエージェントまたはスタイルシートで得られる色を用いて評価するよう説明しています。[1]

> **モードを増やして読めるようにするのではなく、すべての通常モードを最初から読めるようにする。**

## 2. 採用するWCAG 2.1達成基準

CoachMgrの色設計と直接関係する達成基準は、SC 1.4.3、SC 1.4.11、SC 1.4.1、SC 2.4.7です。目標水準はAAとします。

| 達成基準 | レベル | 閾値・要件 | CoachMgrでの対象 |
|---|---:|---|---|
| **1.4.3 Contrast (Minimum)** | AA | 通常の文字・文字画像は**4.5:1以上**。大きい文字は**3:1以上**。 | 本文、フォームラベル、ボタン文字、メタ情報、エラー文、バッジ文字、placeholder、リンク |
| **1.4.11 Non-text Contrast** | AA | UI部品・状態を認識する重要な視覚情報、意味を持つ図形は隣接色と**3:1以上**。 | input境界、checkbox、select矢印、focus ring、選択状態、アイコン、グラフ線、ピッチ図 |
| **1.4.1 Use of Color** | A | 色だけを情報・操作・状態の唯一の手掛かりにしない。 | 成功・警告・エラー、必須項目、出欠、同期状態、選手比較、グラフ系列 |
| **2.4.7 Focus Visible** | AA | キーボード操作時にフォーカスが視認可能。SC 1.4.11と組み、表示部は3:1以上を満たす。 | ボタン、リンク、input、select、checkbox、modal内の操作、bottom navigation |

通常テキストの4.5:1および大きい文字の3:1はSC 1.4.3の規定です。大きい文字は、通常ウェイトで18pt（約24px）以上、太字で14pt（約18.67px）以上が目安です。[1] CoachMgrでは、日本語UIの小さなラベル・メタ情報・ボタン文言を「大きい文字」扱いにせず、原則として**4.5:1以上**を要求します。

SC 1.4.11では、inputの輪郭、checkboxのチェック、focus表示、選択状態、情報理解に必要なグラフ線などが3:1以上必要です。単に部品が存在するだけではなく、利用者が部品と状態を認識できることが対象です。[2]

## 3. コントラスト比の計算と判定規則

コントラスト比は、明るい側の相対輝度を`L1`、暗い側を`L2`とし、次式で求めます。

```text
contrast ratio = (L1 + 0.05) / (L2 + 0.05)
```

相対輝度は、sRGBを線形RGBへ変換した後に計算します。閾値は丸めません。つまり、**4.499:1は4.5:1を満たさず不合格**、**2.999:1は3:1を満たさず不合格**です。[1] [2]

CoachMgrのテストでは安全余裕を持たせ、設計目標値を次のように上乗せします。

| 対象 | WCAG 2.1 AAの最低値 | CoachMgrの設計目標 | 理由 |
|---|---:|---:|---|
| 本文・小さいラベル・ボタン文字 | 4.5:1 | **5.0:1以上** | フォント描画・屋外利用・小型端末の余裕を確保 |
| 大きい見出し | 3:1 | **4.5:1以上** | 日本語見出しでも一貫した可読性を優先 |
| muted text・日時・補足 | 4.5:1 | **4.5:1以上** | 「補足」でも情報である以上は下げない |
| input境界・checkbox・focus | 3:1 | **3.5:1以上** | 暗い面での細線の見えにくさを補う |
| グラフ線・ピッチ線・アイコン | 3:1 | **3.5:1以上** | 細線・小アイコンに安全余裕を持たせる |
| 主操作内の文字 | 4.5:1 | **5.0:1以上** | 重要な即時操作を確実に読めるようにする |

## 4. セマンティックトークンの検証マトリクス

コンポーネントの個別色ではなく、**セマンティックトークンの隣接ペア**を検証の起点にします。全コンポーネントはこの表のトークンだけを参照することを原則とします。

### 4.1 文字トークン

| 検証ID | 前景トークン | 背景トークン | 最低値 | 代表UI |
|---|---|---|---:|---|
| TXT-01 | `--color-text` | `--color-canvas` | 5.0:1 | 本文、ページ見出し |
| TXT-02 | `--color-text` | `--color-surface` | 5.0:1 | カード、入力、modal本文 |
| TXT-03 | `--color-text` | `--color-surface-raised` | 5.0:1 | modal、drawer、popover |
| TXT-04 | `--color-text-muted` | `--color-canvas` | 4.5:1 | 日時、説明、補足 |
| TXT-05 | `--color-text-muted` | `--color-surface` | 4.5:1 | カード内メタ情報 |
| TXT-06 | `--color-text-on-action` | `--color-action` | 5.0:1 | 追加、保存、同期の主操作 |
| TXT-07 | `--color-danger-text` | `--color-danger-surface` | 4.5:1 | エラー・削除確認 |
| TXT-08 | `--color-warning-text` | `--color-warning-surface` | 4.5:1 | 注意・未回答 |
| TXT-09 | `--color-success-text` | `--color-success-surface` | 4.5:1 | 同期完了・保存完了 |
| TXT-10 | `--color-info-text` | `--color-info-surface` | 4.5:1 | 説明・案内 |

### 4.2 非テキストUIトークン

| 検証ID | 要素・トークン | 隣接トークン | 最低値 | 確認内容 |
|---|---|---|---:|---|
| UI-01 | `--color-border` | `--color-surface` | 3.5:1 | input、select、textarea、名簿行の輪郭 |
| UI-02 | `--color-border-strong` | `--color-surface` | 3.5:1 | 区切り線、強調入力、table見出し |
| UI-03 | `--color-focus` | `--color-canvas` | 3.5:1 | 外側outlineの可視性 |
| UI-04 | `--color-focus` | `--color-surface` | 3.5:1 | input・カード上のoutline |
| UI-05 | checkbox / radioのチェック表示 | control内部背景 | 3.5:1 | 選択状態を読めること |
| UI-06 | select矢印・開閉アイコン | control背景 | 3.5:1 | 操作可能性を識別できること |
| UI-07 | `--color-surface-selected` | 隣接`surface` | 3:1、または文字・アイコン・枠で明示 | 選択行・active navigation |
| UI-08 | 主アイコンの`currentColor` | 直下の背景 | 3.5:1 | icon-only操作、bottom nav |

### 4.3 状態トークン

状態は色だけに依存させません。SC 1.4.1は、色が情報・操作・状態を伝える唯一の視覚手段であってはならないと定めています。[3]

| 状態 | 色の検証 | 非色の手掛かり | CoachMgrの例 |
|---|---|---|---|
| success | text/surface 4.5:1、border 3.5:1 | `✓`アイコンと「同期済み」「保存しました」 | 同期outbox、保存toast |
| warning | text/surface 4.5:1、border 3.5:1 | 警告アイコンと「未回答」「要確認」 | RSVP期限、未入力項目 |
| danger | text/surface 4.5:1、border 3.5:1 | 削除アイコンと「削除」「エラー内容」 | 削除確認、同期失敗 |
| info | text/surface 4.5:1、border 3.5:1 | 情報アイコンと説明文 | 初回案内、設定補足 |
| required | ラベル自体は4.5:1 | 「必須」テキストと`aria-required` | 日付、チーム名 |
| attendance | バッジ文字は4.5:1 | 参加・欠席・未回答の明示テキストとアイコン | 出欠名簿、練習カード |

## 5. コンポーネント別の検証基準

### 5.1 フォーム：`c-form-field`と`c-fieldset`

フォームでは、ラベル、説明、入力文字、placeholder、境界、focus、エラー、requiredラベルを別々に検証します。placeholderも表示される文字であるため、背景とのコントラスト要件の対象です。[1]

| 状態 | 必須ペア | 追加確認 |
|---|---|---|
| 通常 | label × surface、input text × input bg、border × 周囲surface | ラベルをplaceholderだけにしない |
| focus | focus × 外側surface、focus × input bg | outlineを`none`にしない。3.5:1以上 |
| エラー | danger text × danger surface、danger border × input bg | 色に加えてエラー文・アイコンを表示 |
| disabled | WCAGのコントラスト要求の例外対象になり得る | ただし、disabledである理由・操作不可の意味を明確にする |

### 5.2 出欠名簿：`c-roster-row`

名簿は密度が高く、checkbox、選手名、出欠select、補足が並びます。以下を確認します。

| 要素 | 最低条件 | 設計上の注意 |
|---|---:|---|
| 選手名 | 5.0:1 | 親要素のopacityで薄くしない |
| 背番号・補足 | 4.5:1 | mutedであっても情報量を下げすぎない |
| checkbox外形 | 3.5:1 | 未選択でも部品の存在を認識可能にする |
| checkmark | 3.5:1 | チェック背景との対比を確認する |
| select文字 | 5.0:1 | control背景と対で確認する |
| 選択行面 | 3:1または非色の表示 | 左罫線、check、状態テキストを併用 |

### 5.3 練習カード：`c-practice-card`

カードでは、表面階層、統計バッジ、主操作、危険操作、共有、詳細トリガーを検証します。練習カードの`+ メニュー`、テンプレート、編集、削除、共有を同じ色だけで役割分担させず、文字、アイコン、配置、枠・面の組合せで区別します。

### 5.4 モーダル：`c-modal`

modalは`canvas`ではなく`surface-raised`を背景にし、scrim、ヘッダー境界、本文、フッター、primary/secondaryの操作を検証します。特にダークモードでは、暗いscrim上のdark surfaceが埋もれないよう、modalの境界かsurface差のどちらかを3.5:1以上にします。

### 5.5 ナビゲーション

sidebar、topbar、bottom navigationでは、通常・active・focus・disabledを分けます。activeは主色だけで示さず、選択面、文字ウェイト、アイコン、左罫線などを併用します。bottom navigationのicon-onlyに近い表示は、アイコンと背景のコントラストを3.5:1以上とします。

## 6. グラフ、ピッチ図、画像の検証

SC 1.4.11は、内容理解に必要なグラフ線、目盛線、図形、独立アイコンにも適用されます。[2] CoachMgrでは以下を必須にします。

| 対象 | 最低条件 | 色以外の補助 |
|---|---:|---|
| 折れ線・棒グラフの系列 | 背景に対して3.5:1 | 系列名、値、線種または点形状 |
| 目盛線・ピッチ線 | 背景に対して3.5:1 | 軸ラベル・数値・領域名 |
| 選手マーカー | ピッチに対して3.5:1 | 背番号・選手名・選択外形 |
| 成功/失敗の比較 | 値・見出しは4.5:1 | `勝/敗`、`参加/欠席`のテキスト |
| 写真上の文字 | 背景画像に対して4.5:1 | 読める専用面またはscrimを使う |

`filter: invert()`で写真・ピッチ画像を一括反転してはいけません。色が意味を持つユニフォーム、芝、エンブレム、写真の内容が崩れるためです。CSSで描画するピッチ・図形は専用トークンへ、写真はそのまま保持し、文字のために表面またはscrimを置きます。

## 7. 自動検証の実装方針

### 7.1 トークン対のユニットテスト

`tests/wcag-contrast-contract.mjs`を追加し、light/dark × 全テーマのトークン値を読み込み、RGBまたはRGBAを合成したうえでコントラスト比を計算します。

```js
const requiredPairs = [
  { id: 'TXT-01', fg: '--color-text', bg: '--color-canvas', min: 5.0 },
  { id: 'TXT-02', fg: '--color-text', bg: '--color-surface', min: 5.0 },
  { id: 'TXT-04', fg: '--color-text-muted', bg: '--color-canvas', min: 4.5 },
  { id: 'TXT-06', fg: '--color-text-on-action', bg: '--color-action', min: 5.0 },
  { id: 'UI-01', fg: '--color-border', bg: '--color-surface', min: 3.5 },
  { id: 'UI-03', fg: '--color-focus', bg: '--color-canvas', min: 3.5 }
];
```

テストの失敗出力は、テーマ・モード・トークン名・実測比・必要値を明示します。

```text
FAIL Ocean Blue / dark / TXT-06
--color-text-on-action (#FFFFFF) × --color-action (#58C7D9)
actual 2.04:1; required 5.00:1
```

### 7.2 ブラウザ統合テスト

トークン対の単体検証だけでは、部品が誤ったトークンを参照する問題を検出できません。そのため、Chromiumの既存レスポンシブ検証を拡張します。

| テスト | 実施内容 |
|---|---|
| mode切替 | `data-color-mode="light"`と`"dark"`を明示設定してスクリーンショットを取得 |
| computed style | 代表要素の`color`、`background-color`、`border-color`、`outline-color`を取得 |
| 対象画面 | 設定、練習一覧、練習編集モーダル、選手比較、試合詳細 |
| 表示幅 | 320、390、768、1024、1440px |
| 状態 | 通常、focus-visible、選択、エラー、disabled、read-only |
| アサーション | 横溢れなし、focusの可視性、コントラストペア、必要テキストの存在 |

### 7.3 目視確認

自動値だけで完結させず、少なくとも以下を目視確認します。

| 確認対象 | 見るべき不具合 |
|---|---|
| darkのsurface階層 | カード・modal・ページ背景が同じ黒に潰れていないか |
| muted text | 基準を満たしても小さく・細く見えすぎていないか |
| focus | topbar、bottom nav、modal内でoutlineが背景に消えないか |
| 状態表示 | 色を区別できなくても、アイコン・文言・形で理解できるか |
| 写真・ピッチ | 文字が画像上で読め、意味を持つ色が反転していないか |
| 低照度環境 | darkテーマで眩しい純白面・過度な彩度がないか |

## 8. 合格・不合格の扱い

| 条件 | 判定 | リリース対応 |
|---|---|---|
| `TXT-*`が必要値未満 | 不合格 | リリース不可。前景または背景トークンを修正 |
| `UI-*`が必要値未満 | 不合格 | リリース不可。境界・outline・icon色を修正 |
| 色だけで状態を示す | 不合格 | テキスト、アイコン、形状、位置のいずれかを追加 |
| disabled部品の低コントラスト | 条件付き | WCAG例外でも、理由と非活性状態を明瞭にする |
| ロゴ・装飾テキストの低コントラスト | 条件付き | UI操作に使う場合は通常テキストとして再評価 |
| 閾値ちょうど | 技術的には合格 | CoachMgrでは設計目標値未満なら不合格として調整 |

## 9. 実装チェックリスト

新しい色・部品・テーマを追加する際は、次をプルリクエストの完了条件にします。

- [ ] 具体色ではなく既存セマンティックトークンを使用している。
- [ ] 新しい意味が必要なら、先にトークンの責務とlight/dark値を定義している。
- [ ] 文字前景と背景を両方指定し、最小コントラストを測定している。
- [ ] input、checkbox、select、icon-only操作、focus表示の3.5:1以上を確認している。
- [ ] 成功・警告・危険・必須・出欠を、色以外の情報でも識別できる。
- [ ] light/dark × 代表テーマ × 代表画面の自動検証を通過している。
- [ ] 320pxのモーダル・固定bottom navigation・長い日本語ラベルを目視確認している。

## References

[1] [W3C WAI：Understanding SC 1.4.3 Contrast (Minimum), WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

[2] [W3C WAI：Understanding SC 1.4.11 Non-text Contrast, WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)

[3] [W3C WAI：Understanding SC 1.4.1 Use of Color, WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)

[4] [W3C：Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/)
