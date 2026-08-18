# CoachMgr：任意チームカラーに対応する動的テーマ設計

## 1. 結論

チームカラーを自由に選べるようにしても、**入力された色をボタン、背景、警告、グラフへそのまま配る方式**では統一感も可読性も保てません。CoachMgrでは、チームが選んだ1色を**種色（seed color）**として保存し、実行時に以下の4段階で役割別の色へ変換します。

```text
任意のチームカラー（#RRGGBB）
        ↓
色相・彩度・明度を正規化したトーンパレット
        ↓
light / dark別のセマンティックカラーロール
        ↓
フォーム、カード、名簿、モーダル、グラフの共通部品
```

この方式では、黒、白、グレー、蛍光色、濃い赤、淡い黄色など、どの色が入力されてもUIを破綻させません。チームらしさは主操作・選択・チーム識別に残し、文字、背景、境界、状態、グラフは常に読みやすい役割色へ変換します。

> **チームカラーは見た目の素材であり、UIに直接使う完成色ではない。**
>
> UIが使うのは、種色から生成し、用途とコントラストが検証されたセマンティックトークンだけです。

## 2. 現行実装からの変更点

現在のCoachMgrは、チーム情報の`color`を主に`--primary`へ直接代入する構造です。このままでは、任意色が主操作や文字にそのまま流入し、light/darkの両方で前景・背景のコントラストを保証できません。また、画面中には`#3b82f6`や`#eab308`などの固定色も残っており、選んだチームカラーと競合します。

| 項目 | 現在 | 新設計 |
|---|---|---|
| 保存する値 | `teamInfo.color`をそのまま主色として使用 | `teamInfo.theme.seed`と生成器のバージョンのみ保存 |
| 主操作色 | 任意のHEXを直接使用し得る | light/dark用に正規化された`--color-action` |
| 文字色 | `white`前提の箇所がある | `--color-text-on-action`を生成・検証 |
| 背景・カード | テーマによっては固定色が混在 | ニュートラルパレットから一貫生成 |
| success/warning/danger | チーム色や固定色と混在 | チーム色から独立した状態色セット |
| グラフ・ピッチ | 個別固定色が残り得る | 専用のカテゴリトークンと線種・凡例を併用 |

## 3. 色の責務を分ける

任意色の入力を安全に扱うため、色には次の3種類の責務を与えます。

| 色の種類 | 生成元 | 使用箇所 | チーム色への追従 |
|---|---|---|---|
| **ブランド色** | 利用者が選んだ種色 | チーム識別、主操作、選択状態、強調 | 追従する |
| **ニュートラル色** | 種色の色相を薄く反映した低彩度パレット | canvas、surface、text、border、modal、nav | 間接的に追従する |
| **状態色** | 固定・監査済みパレット | success、warning、danger、info、出欠 | 原則追従しない |

状態色をチームカラーから生成しないことが重要です。たとえばチームカラーが赤の場合、dangerとブランド色が近づくと削除・エラーの意味が失われます。チームカラーはチームらしさに、状態色は操作結果の意味に専念させます。

## 4. 生成アルゴリズム

### 4.1 採用方針：HCTトーンパレット + CoachMgrのコントラストゲート

Materialの動的カラーモデルは、1つの種色からprimary、secondary、tertiary、neutral、neutral variantの複数キーカラーを生成し、トーンパレットと色の役割へ割り当てます。[1] HCT（Hue / Chroma / Tone）は、色相・鮮やかさ・明暗を分けて扱えるため、任意のチームカラーから規則的にlight/darkテーマを作るのに適しています。[1]

CoachMgrでは、Materialの役割モデルを**設計参照**として利用し、以下の追加ルールを必ず通します。

1. 種色をHCTへ変換する。
2. 色相はチームらしさとして維持する。
3. 極端に低い彩度は最小値へ補正し、極端な高彩度は上限で抑える。
4. primary、companion、neutral、neutral variantのトーンパレットを生成する。
5. light/darkそれぞれの役割色を割り当てる。
6. WCAG 2.1の文字・非テキストUIペアを実測する。
7. 基準を満たさない役割は、同じパレット内でトーンを離すか、`on-*`前景を黒/白のどちらかへ置換する。
8. それでも満たせない場合のみ、主操作を安全な近似色へフォールバックする。

Material Color Utilitiesは、HCT、tonal palette、コントラスト計算、light/dark等の状態に応じたdynamic colorの機能を提供し、TypeScript実装もApache-2.0で公開しています。[2] CoachMgrではPWAのオフライン性を守るため、CDN参照ではなくローカルに固定バージョンを同梱します。

### 4.2 任意色を拒否しない正規化規則

「何色を選んでも」を守るため、入力は拒否せず、必要な補正をUI色生成側で行います。

| 種色の特徴 | 直接使用した場合の問題 | 生成時の補正 |
|---|---|---|
| 黒・非常に暗い色 | darkモードの背景と溶ける | 色相を保持し、主操作には明るいトーンを割当 |
| 白・非常に明るい色 | lightモードの背景と溶ける | 主操作には暗いトーンを割当 |
| グレー・低彩度 | チームらしい強調色にならない | 中程度の彩度を持つ補助アクセントを生成。原色は識別用に保存 |
| 蛍光色・高彩度 | 眩しさ、文字コントラストの破綻 | 彩度上限を設定し、主操作にはトーン補正済み色を使用 |
| 黄・黄緑 | 白文字と低コントラストになりやすい | `on-action`を濃色へ自動選択、またはactionトーンを暗くする |
| 赤・橙 | danger/warningと意味が競合 | 状態色は固定。ブランド色をdangerの代用にしない |

入力欄で「この色は使えません」と拒否するのではなく、プレビューに「チームカラーを基に、操作・文字の視認性を自動調整します」と示します。選んだ原色はチーム識別やエンブレムに残せますが、操作色は検証済みの派生色を用います。

### 4.3 最小トーン構成

MaterialはUIの役割を`primary`、`on primary`、`primary container`、`on primary container`のように前景・背景の対として扱います。[3] CoachMgrでは次の最小構成を採用します。

| パレット | 目的 | 代表ロール |
|---|---|---|
| Primary | チームの主要な表現 | action、action-hover、selected、brand-mark |
| Companion | 控えめな補助表現 | secondary action、filter、metadata accent |
| Neutral | 読みやすい面と文字 | canvas、surface、raised、text、muted text |
| Neutral variant | 境界・区切り | border、border-strong、divider |
| Status static | 業務上の状態 | success、warning、danger、info |

対応するセマンティックトークン例は次の通りです。

```css
:root {
  /* ユーザーが選ぶのはseedだけ。以下は生成値。 */
  --team-seed: #ef3340;

  /* brand-derived */
  --color-action: var(--role-primary);
  --color-action-hover: var(--role-primary-hover);
  --color-text-on-action: var(--role-on-primary);
  --color-surface-selected: var(--role-primary-container);
  --color-text-on-selected: var(--role-on-primary-container);

  /* neutral-derived */
  --color-canvas: var(--role-surface);
  --color-surface: var(--role-surface-container);
  --color-surface-raised: var(--role-surface-container-high);
  --color-text: var(--role-on-surface);
  --color-text-muted: var(--role-on-surface-variant);
  --color-border: var(--role-outline);
  --color-border-subtle: var(--role-outline-variant);

  /* static status */
  --color-success-text: var(--status-success-text);
  --color-success-surface: var(--status-success-surface);
  --color-danger-text: var(--status-danger-text);
  --color-danger-surface: var(--status-danger-surface);
}
```

## 5. light / darkでの役割割当

lightとdarkで名前は変えず、トーンだけを変えます。コンポーネントはモードを知りません。

| セマンティックロール | lightでの相対トーン | darkでの相対トーン | 用途 |
|---|---:|---:|---|
| `canvas` | 最も明るいニュートラル | 最も暗いニュートラル | ページ全体 |
| `surface` | canvasより少し濃い・または白 | canvasより少し明るい | カード・入力 |
| `surface-raised` | surfaceより明確な浮上面 | surfaceより明確な浮上面 | modal、popover |
| `text` | 最も暗いニュートラル | 最も明るいニュートラル | 本文 |
| `text-muted` | textより低い強調 | textより低い強調 | 補足・日時 |
| `action` | surface上で読める中〜濃トーン | surface上で読める明トーン | 主操作・リンク |
| `text-on-action` | actionと4.5:1以上になる黒または白 | actionと4.5:1以上になる黒または白 | 主操作ラベル |
| `selected` | actionより控えめなcontainer | dark向け低彩度container | active navigation、選択行 |

Materialは種色から複数のトーンパレットを作り、light/dark双方のカラー役割へ割り当てることで、同じ役割名を保ったままUIを切り替える方式を示しています。[1] ただしMaterialの一般的な役割関係だけに依存せず、CoachMgrでは次節のWCAGゲートで最終確認します。

## 6. WCAG 2.1コントラストゲート

生成器の出力は、保存・適用前に必ずコントラストを評価します。高コントラストモードを廃止するため、light/darkの通常表示がそのまま基準を満たす必要があります。

| ペア | WCAG 2.1の下限 | CoachMgr目標 | 補正方法 |
|---|---:|---:|---|
| `text` × `canvas` | 4.5:1 | 5.0:1 | neutralのトーンを離す |
| `text` × `surface` | 4.5:1 | 5.0:1 | on-surfaceを再選択 |
| `text-muted` × `surface` | 4.5:1 | 4.5:1 | mutedトーンを上げる / 下げる |
| `text-on-action` × `action` | 4.5:1 | 5.0:1 | 黒/白を選択、actionトーンを補正 |
| `border` × `surface` | 3:1 | 3.5:1 | neutral variantトーンを補正 |
| `focus` × 隣接surface | 3:1 | 3.5:1 | focus専用トーンを補正 |
| status text × status surface | 4.5:1 | 4.5:1 | 状態パレットは種色から独立 |

色比は前景と背景の両方を指定した実際のペアで計測し、閾値を丸めません。WCAG 2.1は通常テキストを4.5:1以上、意味を持つUI部品・状態表示を3:1以上と定めています。[4] [5]

`--color-text-on-action`を固定で白にすることは禁止します。チームが黄色や明るい水色を選んだ場合、白文字は不合格になり得るためです。

```js
function chooseOnColor(background, minimum = 5.0) {
  const blackRatio = contrast('#0f172a', background);
  const whiteRatio = contrast('#ffffff', background);
  if (blackRatio >= minimum || whiteRatio >= minimum) {
    return blackRatio >= whiteRatio ? '#0f172a' : '#ffffff';
  }
  return null; // actionのトーン再選択へ戻す
}
```

## 7. 実装アーキテクチャ

### 7.1 保存形式

生成済みの数十色をチームデータへ永続保存しません。保存するのは種色、生成器の方式、生成器バージョンだけです。これにより、将来のコントラスト改善を全チームへ安全に反映できます。

```js
teamInfo.theme = {
  seed: '#ef3340',
  algorithm: 'tonal-v1',
  algorithmVersion: 1
};
```

既存の`teamInfo.color`は移行時に`theme.seed`へコピーします。値がないチームは、南陽台FC公式サイトの赤系を表す既定種色`#EF3340`を使います。利用者は設定画面から任意のチームカラーへ変更できます。

### 7.2 生成・適用の責務

```text
settings.js
  └─ 種色を保存、light/darkプレビューを表示

color-theme-service.js（新設）
  ├─ HEX検証・HCT変換・彩度正規化
  ├─ light/darkのrole生成
  ├─ コントラストゲート
  ├─ CSS Custom Properties適用
  └─ PWA theme-color更新

components-system.css
  └─ 色を直接書かず、セマンティックトークンだけを利用
```

```js
applyTeamTheme({ seed: teamInfo.theme.seed, mode: uiPreferences.colorMode });
```

この分離により、チームカラーの変更、カラーモードの変更、コンポーネントの描画が互いに副作用を持ちません。

### 7.3 PWAと端末別設定

チームカラーはチーム共有設定です。light/darkは各端末の表示設定です。両者を混ぜないため、同じチームでも各ユーザーは好みのモードを選べます。

| 設定 | 保存範囲 | 例 |
|---|---|---|
| `teamInfo.theme.seed` | チーム共有 | チームの緑、青、赤、黄など |
| `uiPreferences.colorMode` | この端末のみ | light / dark |
| `meta[name="theme-color"]` | 実行時 | 生成済みcanvas色へ同期 |

## 8. 編集UI

カラー設定UIでは、色選択だけで終わらせません。利用者に安全な結果を確認させます。

| UI要素 | 表示内容 | 目的 |
|---|---|---|
| カラーピッカー | 任意のHEX選択 | チームらしさを入力 |
| 2面プレビュー | light / darkの同一画面部品 | 各モードの統一感を確認 |
| ロール見本 | primary、selected、surface、text、border、danger | 生の色ではなくUI上の役割を確認 |
| コントラスト結果 | 「すべての必須ペアを確認済み」 | 実装品質を可視化 |
| 説明 | 「操作色は視認性のため自動調整されます」 | 任意色と派生色の関係を明示 |

保存ボタンは、生成器が常に安全な代替トーンを出せる限り有効にします。もし想定外の値で必須ペアを生成できなければ、利用者へ技術的な色比を要求するのではなく、既定テーマへ安全にフォールバックします。

## 9. グラフ・ピッチ・状態色の扱い

チーム種色からグラフの全系列を作ることは避けます。同系色の複数系列は区別しにくく、darkモードでさらに近づきます。

| 領域 | 方針 |
|---|---|
| 成功・警告・危険・情報 | 種色と独立した監査済みの状態色を使う |
| 複数系列グラフ | 固定カテゴリパレット、系列名、点形状・線種・値ラベルを併用する |
| ピッチ図 | 芝、線、選手マーカー、選択状態を専用トークンに分離する |
| チーム識別 | 選手マーカーの外形、エンブレム、見出し、主操作に種色を使う |
| アイコン | 原則`currentColor`。アイコンだけに意味を預けない |

色だけで情報を伝えないことはWCAG 2.1 SC 1.4.1の要件です。[6] したがって「赤の棒が欠席」「緑の棒が参加」のような表現には、凡例、ラベル、パターン、数値のいずれかを追加します。

## 10. 受入テスト

任意色を受け入れる設計では、開発者が好む数色だけでテストしてはいけません。以下の代表的な種色群を固定フィクスチャとして含めます。

| カテゴリ | 例 | 観測したいリスク |
|---|---|---|
| 有彩色 | 赤、橙、黄、緑、青、紫、桃 | 色相ごとの`on-action`と状態色の衝突 |
| 明度極端 | 黒、白、非常に暗い色、非常に明るい色 | actionとsurfaceの同化 |
| 彩度極端 | グレー、低彩度、蛍光色 | チームらしさの喪失、眩しさ、文字比 |
| 既定テーマ | Field Green、Ocean Blue、Redline、Midnight | 既存利用者の回帰 |

各種色について、次を実行します。

1. lightとdarkのroleを生成する。
2. WCAGペアのコントラストゲートを通す。
3. 320、390、768、1024、1440pxで設定、練習一覧、練習編集、選手比較を撮影する。
4. topbar、bottom nav、input、select、checkbox、focus、modal、danger確認を目視・computed styleで確認する。
5. PWAの`theme-color`と`color-scheme`が生成モードと一致することを確認する。

## 11. 導入順序

| フェーズ | 実施内容 | 完了条件 |
|---|---|---|
| T1 | `color-theme-service.js`と種色保存形式を追加 | 既存`teamInfo.color`を壊さず種色へ移行できる |
| T2 | primary / neutral / statusのセマンティックトークンを適用 | app shell、form、modal、cardで直書き色を削減 |
| T3 | light/dark生成とコントラストゲートを実装 | 代表種色群の必須ペアが全合格 |
| T4 | 設定画面の2面プレビューと説明を追加 | 任意色を保存前に確認できる |
| T5 | charts、pitch、固定色を移行 | 色だけに情報を依存しない |
| T6 | 視覚回帰・WCAGトークンテストをCIへ追加 | 任意の種色で回帰を検出できる |

## References

[1] [Material Design 3：Color system — How it works](https://m3.material.io/styles/color/system/how-the-system-works)

[2] [Material Color Utilities：公式GitHubリポジトリ（Apache-2.0）](https://github.com/material-foundation/material-color-utilities)

[3] [Material Design 3：Color roles](https://m3.material.io/styles/color/roles)

[4] [W3C WAI：Understanding SC 1.4.3 Contrast (Minimum), WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

[5] [W3C WAI：Understanding SC 1.4.11 Non-text Contrast, WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)

[6] [W3C WAI：Understanding SC 1.4.1 Use of Color, WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)

[7] [USWDS：Using color（theme / state / system tokenの分離とgradeによるコントラスト設計）](https://designsystem.digital.gov/design-tokens/color/overview/)
