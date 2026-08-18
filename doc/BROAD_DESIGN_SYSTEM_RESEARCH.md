# デザインシステム広域調査

**対象:** 国内外で公開されているデザインシステム、UIライブラリ、ヒューマンインターフェースガイドライン、および公開された運用事例。  
**目的:** 特定のデザインシステムを先に推奨せず、公開情報に基づいて比較可能な候補母集団と選定方法を作る。  
**調査時点:** 2026年8月18日。

## 1. 調査の前提

デザインシステムには、再利用可能なUI実装を提供するもの、デザインのガイドラインとパターンを中心に提供するもの、組織内の運用知見を公開するものがあります。これらは同じ「デザインシステム」という名称でも目的が異なるため、単一のランキングにはしません。

本調査では、候補を次の4類型に分けます。**実装ライブラリ**はすぐにコードへ導入できる可能性があるもの、**設計参照システム**はトークン・コンポーネント・パターンの設計に活用するもの、**プラットフォーム指針**はOSや特定環境での体験品質を担保するもの、**運用事例**はコンポーネント境界やガバナンスを学ぶ対象です。

| 類型 | 説明 | 導入時に確認すること |
|---|---|---|
| 実装ライブラリ | CSS、Web Components、React等の実装を公開する | フレームワーク依存、ライセンス、バンドル、既存CSSとの共存 |
| 設計参照システム | トークン、コンポーネント、パターン、アクセシビリティを体系化する | そのままの見た目を採用せず、規則を移植できるか |
| プラットフォーム指針 | OS固有の操作・入力・ナビゲーションを定義する | PWAやネイティブ利用時の慣習との整合 |
| 運用事例 | 設計・開発・Figma・リリースの統制方法を公開する | 組織規模に見合うガバナンスへ縮小できるか |

## 2. 中立的な評価軸

候補の評価は、視覚的な好みやブランドの知名度ではなく、公開資料で確認できる資産と運用能力を軸にします。ここでの「高い」はCoachMgrへの適合を意味せず、その分野の公開資産が厚いことを意味します。

| 評価軸 | 観点 | 確認方法 |
|---|---|---|
| 設計資産の範囲 | トークン、基礎、コンポーネント、パターン、テンプレート、アイコン、Figma | 公式ドキュメントとリポジトリ |
| 実装独立性 | CSS/HTML、Web Components、React等への依存度 | 公式実装ガイド、依存関係、配布形態 |
| 適応レイアウト | ブレークポイント、グリッド、ナビ切替、密度、端末別の複雑性制御 | 公式レイアウト・レスポンシブ指針 |
| アクセシビリティ | WCAG、キーボード、フォーカス、コントラスト、ズーム、支援技術 | 専用ガイドライン、コンポーネント仕様 |
| 高密度業務UI | 表、フォーム、ステータス、一覧、複数操作、ワークフロー | コンポーネント・パターンの範囲 |
| テーマ・ブランド | 意味トークン、ダークモード、高コントラスト、密度、サブブランド | トークン・テーマの公式仕様 |
| 日本語・国内文脈 | 日本語組版、国内公共サービス、国内SaaS、国内運用知見 | 日本語資料、公開実装、実使用文脈 |
| 運用成熟度 | バージョン、リリース、Storybook、テスト、変更管理、コミュニティ | 公式ロードマップ、リポジトリ、更新情報 |
| 再利用条件 | OSSライセンス、商標・ブランド制約、社内前提の有無 | 公式ライセンス、利用規約 |

> **選定上の注意:** すべての軸で最も充実したシステムが、必ずしも最も導入しやすいわけではありません。設計資産が厚いほど、既存アプリへの移行範囲やフレームワーク依存が大きくなる場合があります。

## 3. 国際候補の比較

### 3.1 汎用・モバイル・クロスプラットフォーム

| 候補 | 主な公開資産 | 実装・運用形態 | 強く参照できる領域 | 留意点 |
|---|---|---|---|---|
| Material Design 3 | 基礎、コンポーネント、適応レイアウト、ブレークポイント、アクセシビリティ | Android、Compose、Flutter、Web向けの設計・実装資産 | CompactからExtra-largeまでの適応、ペイン・ナビの切替、safe region | ブランド表現や情報密度の決定をそのまま転用しない [1] [2] |
| Fluent 2 | グローバル/エイリアストークン、レイアウト、Web/iOS/Android/Windowsコンポーネント | 複数プラットフォーム向けのFigma・コード資産 | 意味トークン、4px余白、ズーム、再フロー、フォーカス | Microsoft製品の視覚言語と実装依存を切り分ける [3] [4] [5] |
| Apple HIG | 原則、基礎、パターン、コンポーネント、入力方式 | Appleプラットフォーム向けガイドライン | モバイルの入力・操作・ナビゲーション、ネイティブ慣習 | 汎用Webコンポーネント集ではない [6] |

Material Design 3は、幅ではなく利用可能なウィンドウ空間をCompact、Medium、Expanded、Large、Extra-largeで捉え、レイアウトを「表示、分割、拡大縮小、再配置、入れ替え」の観点で適応させる方法を公開しています。[1] [2] Fluent 2は、グローバル値と意味を持つエイリアストークンを分け、テーマやアクセシビリティをトークンで扱います。[3] Apple HIGは実装ライブラリではなく、モバイル入力とプラットフォーム一貫性の指針として位置付けられます。[6]

### 3.2 エンタープライズ・高密度業務UI

| 候補 | 主な公開資産 | 実装・運用形態 | 強く参照できる領域 | 留意点 |
|---|---|---|---|---|
| IBM Carbon | 2x Grid、余白、コンポーネント、React/Web Components、アクセシビリティ | OSSの実装・デザイン・ガイドライン | データ密度、グリッド、カード、表、業務UIの余白規律 | 視覚言語をそのまま採用すると企業業務製品らしさが強くなる [7] [8] [9] |
| SAP Fiori | レスポンシブ/アダプティブ、12列グリッド、密度、業務フロアプラン | SAPUI5を中心とする企業業務向け資産 | 端末別の機能密度、表の列を減らす・詳細に退避する判断 | SAP環境との結びつきが強い [10] |
| Salesforce Lightning Design System 2 | Foundations、display density、Utility、コンポーネント、パターン、ツール | CSS custom propertiesを重視した大規模な業務UI基盤 | 表、フォーム、モーダル、データ表示、検索、通知、テーマ | 提供範囲が広く、選択的な参照が必要 [11] |
| Ant Design | Design language、React/Angular/Vueライブラリ、モバイル、データ可視化 | フレームワーク別のOSS実装 | 管理画面、表、フォーム、テーマ、豊富なコンポーネント | React中心であり、アクセシビリティ評価は個別確認が必要 [12] |

Carbonは8pxのミニユニットと固定・流動・ハイブリッドのグリッドを公開し、動的な情報密度に合わせたボックス配置の判断を説明しています。[7] SAP Fioriは、画面を小さくするだけではなく、スマートフォンではフィルター・列・編集機能を削減または退避するアダプティブ設計を明確に示します。[10] SLDS 2は、表示密度をFoundationとして扱い、データ表示・検索・ナビゲーション・フィードバックのパターンも公開しています。[11]

### 3.3 SaaS・コラボレーション・開発者向け製品

| 候補 | 主な公開資産 | 実装・運用形態 | 強く参照できる領域 | 留意点 |
|---|---|---|---|---|
| Atlassian Design System | 意味トークン、テーマ、コンポーネント、ナビ、レスポンシブPrimitives | Atlaskit等の実装と設計ドキュメント | 状態、通知、チーム協働、意味トークン、情報階層 | 公開実装はReact寄り [13] |
| Shopify Polaris | Web Componentsを基盤とする統一UI、複数アプリ面、POS | Shopify環境のアプリ面に向けた実装 | 管理画面、複数面、POSを含む業務操作 | Shopifyプラットフォームとの関係を確認する [14] |
| GitHub Primer | Product UI、Brand UI、Octicons、アクセシビリティ、Primitives | GitHubのプロダクト・ブランド資産を分離 | 開発者向けSaaSの密度、状態、アイコン、アクセシビリティ | GitHub固有のプロダクト文脈を抽象化して使う [15] |
| Adobe Spectrum | Foundation、Content、Components、Patterns、CSS/React/Web Components | 複数実装を公式に案内 | コンテンツ制作系の複合UI、アクセシビリティ、実装選択 | Adobe製品のワークフロー文脈が強い [16] |

Atlassianは、デザイントークンを設計判断の単一情報源として扱い、色テーマだけでなくコンパクト表示、動きの軽減、文字スタイルもテーマとして考えられると説明します。[13] Shopify PolarisはWeb Componentsを統一UIフレームワークとし、管理画面だけでなくPOSなど複数のアプリ面を扱います。[14] PrimerはプロダクトUIとブランドUI、アイコン、アクセシビリティ、トークンを分離して公開しています。[15]

### 3.4 公共サービス・アクセシビリティ重視

| 候補 | 主な公開資産 | 実装・運用形態 | 強く参照できる領域 | 留意点 |
|---|---|---|---|---|
| USWDS | コンポーネント、パターン、トークン、ユーティリティ、テンプレート | 米国政府向けOSS | モバイルフレンドリー、フォーム、公共性、アクセシビリティ | 米国政府の情報設計・ブランド文脈が前提 [17] |
| GOV.UK Design System | Styles、再利用コンポーネント、タスクパターン、アクセシビリティ戦略、ロードマップ | GOV.UK Frontendとサービス設計 | フォーム、入力エラー、タスク完了、明快な文言 | 視覚よりもサービス手続きに最適化される [18] |

USWDSは、アクセシブルでモバイルフレンドリーな政府Webサイトを構築するためのコンポーネント、パターン、トークン、ユーティリティ、テンプレートを公開しています。[17] GOV.UKは、UI部品だけでなく、氏名・住所入力、アカウント作成などの利用者タスクを完了するためのパターンを提供し、ロードマップ・コミュニティ・アクセシビリティ戦略も公開しています。[18]

## 4. 日本の公開候補と公開事例

### 4.1 デジタル庁デザインシステム（DADS）

デジタル庁は、Figmaデータ、HTML/CSS/JavaScriptのコードスニペット、React/Tailwind CSSのコードスニペット、Storybook、デザイントークン由来のTailwind CSSプラグイン、アクセシビリティ資料を公開しています。[19] HTML版コードスニペットはフレームワーク非依存で、コンポーネントごとにCSS、HTML、必要なJavaScript、Storybook、MDXを持ち、MITライセンスです。[20] デザイントークンはFigmaからGitHubへ同期し、Style DictionaryでCSS・JavaScriptをビルドしてnpm公開するワークフローを明記しています。[21]

| 評価観点 | 公開情報から確認できること |
|---|---|
| 日本語・公共サービス | 国内公共サービスの文脈、日本語資料、アクセシビリティガイドライン |
| 実装独立性 | HTML/CSS/JavaScript版があり、React移行を前提としない |
| トークン | Figma、GitHub、Style Dictionary、CSS/JavaScript、npmを結ぶ運用 |
| 再利用条件 | HTML版・トークンともにMITライセンス |
| 注意点 | β版であること、行政サービスの表現・規則をそのまま民間PWAへ適用しないこと |

### 4.2 SmartHR UI / SmartHR Design System

SmartHR UIは、SmartHR内の複数アプリケーションでUIコンポーネントを共通化するためのライブラリとして公開され、npm、Storybook、Figmaデザインデータを提供します。React、React DOM、styled-componentsを前提とし、MITライセンスです。[22] デザインシステムの文書リポジトリも公開され、ガイド文書、貢献方法、GitHub Actions、コンテンツ検証などの運用情報を確認できます。[23]

| 評価観点 | 公開情報から確認できること |
|---|---|
| 日本語業務SaaS | 日本語の業務フォーム・管理画面の実例として有用 |
| 実装 | React/styled-components依存のため、フレームワーク非依存ではない |
| 運用 | Figma、Storybook、npm、ガイド文書、リリースを組み合わせる |
| 再利用条件 | UIライブラリはMIT。ロゴ等は別途利用条件の確認が必要 |

### 4.3 三菱電機 Serendie Design System

Serendie Design Systemは、デザイントークン、UIコンポーネント、アイコン・イラスト、テーマ、Figmaとの同期を含む公開システムです。多様な事業ドメインに適応するため、共通の基盤とドメイン固有のテーマ・コンポーネントを分ける方針を公開しています。[24] Serendie UIはMITライセンスのReactライブラリで、5つの色テーマ、ダークモード、日本語・英語対応、Storybook、Figma UI Kit、トークン連携を提供します。[25]

| 評価観点 | 公開情報から確認できること |
|---|---|
| テーマ・サブブランド | トークンを基盤に複数テーマやブランド別の見た目を扱う |
| 設計と実装の同期 | Figma Variables、トークン、Storybook、Code Connectを結ぶ |
| 実装 | ReactとPanda CSSを中心にする。CSSカスケードレイヤーも取り入れる |
| 再利用条件 | UIライブラリはMIT。サブブランドのFigma同期フローには組織向け前提がある [26] |

### 4.4 メルカリの公開運用事例

メルカリは、デザインシステムを4.0として刷新した背景とコンポーネント設計の知見を公式Engineering Blogで公開しています。旧システムでは、条件分岐やバリエーションを詰め込み過ぎたpolymorphic APIが複雑性を増したと説明し、Atomic Designを実装手法ではなくデザイナーとエンジニアの共通言語として位置付けています。[27] 同記事は、再利用可能なDesign System Components、設計図としてのBlueprint、Figma内のDesign Recipes、ワンオフのSnowflakesを区別する方法も示します。[27]

これは一般利用可能なライブラリではなく、**コンポーネントを過度に汎用化しないこと、設計システムの責任範囲とワンオフの境界を管理すること**を学ぶための公開運用事例です。

## 5. 横断比較マップ

以下は公式公開情報の厚さを、**非常に厚い / 厚い / 中程度 / 限定的**で整理したものです。これは製品品質の順位ではありません。公開情報をもとに、どの領域を参照しやすいかを示す地図です。

| 候補 | 実装資産 | 適応レイアウト | A11y | 高密度業務UI | テーマ | 日本語・国内文脈 | 運用知見 |
|---|---|---|---|---|---|---|---|
| Material 3 | 厚い | 非常に厚い | 厚い | 中程度 | 厚い | 限定的 | 厚い |
| Fluent 2 | 厚い | 厚い | 非常に厚い | 厚い | 非常に厚い | 限定的 | 厚い |
| Carbon | 厚い | 厚い | 非常に厚い | 非常に厚い | 厚い | 限定的 | 厚い |
| SAP Fiori | 厚い | 非常に厚い | 厚い | 非常に厚い | 厚い | 限定的 | 厚い |
| SLDS 2 | 厚い | 厚い | 厚い | 非常に厚い | 非常に厚い | 限定的 | 非常に厚い |
| Ant Design | 非常に厚い | 厚い | 中程度 | 非常に厚い | 非常に厚い | 中程度 | 厚い |
| Atlassian | 厚い | 厚い | 厚い | 厚い | 非常に厚い | 限定的 | 非常に厚い |
| Polaris | 厚い | 中程度 | 厚い | 厚い | 厚い | 限定的 | 厚い |
| Primer | 厚い | 中程度 | 厚い | 厚い | 厚い | 限定的 | 厚い |
| Spectrum | 厚い | 中程度 | 厚い | 厚い | 厚い | 限定的 | 厚い |
| Apple HIG | 限定的 | 厚い | 厚い | 中程度 | 中程度 | 限定的 | 厚い |
| USWDS | 厚い | 厚い | 非常に厚い | 中程度 | 中程度 | 限定的 | 厚い |
| GOV.UK | 厚い | 中程度 | 非常に厚い | 中程度 | 限定的 | 限定的 | 非常に厚い |
| デジタル庁 DADS | 厚い | 中程度 | 厚い | 中程度 | 厚い | 非常に厚い | 厚い |
| SmartHR UI | 厚い | 中程度 | 中程度 | 厚い | 厚い | 非常に厚い | 厚い |
| Serendie | 厚い | 中程度 | 中程度 | 中程度 | 非常に厚い | 非常に厚い | 厚い |
| メルカリ事例 | 限定的 | 限定的 | 限定的 | 中程度 | 限定的 | 非常に厚い | 非常に厚い |

## 6. 結論を先に決めない選定手順

本調査だけで単一候補を決めるべきではありません。次の順序で、候補を実際の製品要件に照合します。

| 手順 | 実施内容 | 成果物 |
|---|---|---|
| 1. 必須条件を合意 | 現行技術、ライセンス、予算、保守人員、オフラインPWA、対象端末、文字拡大、テーマ要件を「必須 / 望ましい / 対象外」に分類する | 制約一覧 |
| 2. 実画面を代表ケース化 | 練習一覧、出欠名簿、設定フォーム、試合詳細、選手比較を代表ケースにする | 5画面の利用シナリオ |
| 3. 3方式を小さく試作 | 直接導入型、設計参照型、独自軽量型を同じケースで試す | 比較用プロトタイプ |
| 4. 品質を測定 | 320px、横向き、タブレット、デスクトップ、文字拡大、長い名前、12人以上の名簿で比較する | 視覚回帰結果・A11y監査 |
| 5. 移行コストを測定 | 既存CSSの置換量、依存関係、PWAサイズ、学習コスト、ライセンス確認を見積もる | 移行コスト表 |
| 6. 意思決定 | 経験品質、保守性、ブランド性、導入コストの重みを合意して選ぶ | 選定記録（ADR） |

### 比較時の禁止事項

比較では、候補の見た目だけを同じにしません。各方式について、カード内に複数操作がある状態、名簿が長い状態、長い日本語テキスト、固定フッター、ネットワーク遅延、保護者・コーチの権限差を入れます。また、同じ画面をデスクトップで快適に見せるために、スマートフォンで情報・操作を無理に縮めないことを原則にします。

## 7. 次の調査判断

次の段階では、上記候補を以下の3群へ分け、CoachMgrの実画面へ当てます。これは現時点の推奨ではなく、比較実験の設計です。

| 比較群 | 比較対象 | 検証する問い |
|---|---|---|
| 直接導入型 | デジタル庁HTML、USWDS、Spectrum CSS等 | Vanilla JS/CSSのまま実装部品を導入すると、品質と保守性は向上するか |
| 設計参照型 | Material 3、Fluent 2、Carbon、Fiori、SLDS、Atlassian、GOV.UK、Apple HIG | 現行CSSを維持したまま、トークン・レイアウト・パターンをどこまで体系化できるか |
| 国内運用参照型 | デジタル庁、SmartHR、Serendie、メルカリ | 日本語業務UI、テーマ、コンポーネント境界、Figma・コード・テストの統制をどう設計するか |

この比較実験を行った後に初めて、CoachMgrに対して「採用」「部分採用」「参照のみ」「不採用」を根拠付きで決めます。

## References

[1]: https://m3.material.io/foundations/layout/layout-overview "Material Design 3 — Layout overview"
[2]: https://m3.material.io/foundations/layout/breakpoints "Material Design 3 — Breakpoints"
[3]: https://fluent2.microsoft.design/design-tokens "Fluent 2 — Design tokens"
[4]: https://fluent2.microsoft.design/layout "Fluent 2 — Layout"
[5]: https://fluent2.microsoft.design/accessibility "Fluent 2 — Accessibility"
[6]: https://developer.apple.com/design/human-interface-guidelines/ "Apple — Human Interface Guidelines"
[7]: https://carbondesignsystem.com/elements/2x-grid/overview/ "Carbon — 2x Grid"
[8]: https://carbondesignsystem.com/elements/spacing/overview/ "Carbon — Spacing"
[9]: https://carbondesignsystem.com/guidelines/accessibility/overview/ "Carbon — Accessibility"
[10]: https://www.sap.com/design-system/fiori-design-web/v1-148/discover/sap-design-system/vision-and-mission/responsiveness-adaptiveness "SAP Fiori — Multi-Device Support"
[11]: https://www.lightningdesignsystem.com/ "Salesforce Lightning Design System 2"
[12]: https://ant.design/ "Ant Design"
[13]: https://atlassian.design/tokens/design-tokens "Atlassian Design System — Design tokens"
[14]: https://shopify.dev/docs/api/polaris "Shopify Polaris references"
[15]: https://primer.style/ "GitHub Primer"
[16]: https://spectrum.adobe.com/ "Adobe Spectrum"
[17]: https://designsystem.digital.gov/ "U.S. Web Design System"
[18]: https://design-system.service.gov.uk/ "GOV.UK Design System"
[19]: https://design.digital.go.jp/dads/resources/ "デジタル庁デザインシステム — リソース"
[20]: https://github.com/digital-go-jp/design-system-example-components-html "デジタル庁デザインシステム — HTMLコードスニペット"
[21]: https://github.com/digital-go-jp/design-tokens "デジタル庁デザインシステム — Design Tokens"
[22]: https://github.com/kufu/smarthr-ui "SmartHR UI"
[23]: https://github.com/kufu/smarthr-design-system "SmartHR Design System"
[24]: https://serendie.design/en/about/ "Serendie Design System — About"
[25]: https://github.com/serendie/serendie "Serendie UI"
[26]: https://github.com/serendie/subbrands-template "Serendie — SubBrands Template"
[27]: https://engineering.mercari.com/blog/entry/20250624-the-story-behind-mercari-design-system-rebuild/ "メルカリの Design System をリニューアルしました"
