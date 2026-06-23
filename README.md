# YouTubeリサーチツール

YouTubeのキーワードリサーチ・競合分析を、**ブラウザだけで完結**できる無料のWebアプリです。
手作業で数時間かかる競合調査を、キーワードを入れてボタン1つで一括取得できます。

- 🔒 **データは外部サーバーに送信されません** — YouTube API を直接呼び出し、結果はあなたのブラウザ内だけで処理されます
- 🔑 **APIキーはあなたのブラウザ（localStorage）にのみ保存** — 開発者を含む第三者には渡りません
- 💸 **完全無料・オープンソース（MIT License）** — 自由に使えて、改造・再配布もOK
- 🧩 **インストール不要で使うことも可能** — 自分でビルドして公開すれば、URLを開くだけで動きます

> ⚠️ このツールを使うには、**あなた自身のYouTube Data API v3 のAPIキー**（無料枠あり）が必要です。
> 取得手順はアプリ初回起動時のガイド、または下記「APIキーの取得」を参照してください。

---

## 🤖 非エンジニアの方へ（Claude Code / Codex で丸ごとお任せ）

「git clone とか npm とか言われても分からない…」という方は、**AIコーディングツール（Claude Code または Codex）にそのまま任せられます**。難しい操作は一切いりません。

1. 適当なフォルダで **Claude Code**（または **Codex**）を開く
2. 下のメッセージを **そのままコピペして送る** だけ：

> ```
> https://github.com/meguta12/youtube-research-tool をこのフォルダに clone して、
> 必要なものをインストールし、ローカルで起動してください。
> 起動できたら「表示されたURLをブラウザで開く方法」と
> 「YouTube Data API v3 のAPIキーを取得して入力する手順」を、
> 専門用語なしで1ステップずつ案内してください。私は非エンジニアです。
> ```

3. あとは **AIの案内どおりにクリック／コピペするだけ**。APIキーを入れたら、すぐに使えます。

> 💡 APIキーは Googleアカウントがあれば **無料** で取得できます（1日10,000ユニットの無料枠）。取得の操作もAIが手取り足取り案内してくれます。

---

## 🚀 使い方（3ステップ）

### 1. このリポジトリを取得して起動

```bash
git clone https://github.com/meguta12/youtube-research-tool.git
cd youtube-research-tool
npm install
npm run dev      # http://localhost:5173 が開きます
```

> Node.js（v18以上）が必要です。インストールされていない場合は <https://nodejs.org/> から入れてください。

### 2. YouTube APIキーを取得して入力

初回起動時にガイドが表示されます。APIキーを入力すれば準備完了です（→ [APIキーの取得](#-apiキーの取得)）。

### 3. キーワードを入れてリサーチ

調べたいキーワードを入力して「リサーチ実行」を押すだけ。動画リスト・競合分析・サムネ一覧・Excel出力まで使えます。

---

## ✨ 主な機能

- **キーワード検索** — 期間／検索地域／動画タイプ／並び替え／取得件数（最大300件）／チャンネル開設日／子ども向けで絞り込み
- **動画リスト** — タイトル・チャンネル・再生数・1日平均再生数・登録者比 などを表形式で表示
- **チャンネル分析** — 再現性スコア、運営月数、「伸びチャンス」判定で新興チャンネルを発見
- **競合分析** — タイトル頻出ワードTOP20、文字数／曜日／時間帯／動画尺の分布
- **サムネ一覧** — ヒット動画のサムネをグリッド表示
- **Excel / CSV エクスポート** — 4シート構成（動画リスト／チャンネル分析／頻出ワード／サマリー）。ChatGPT等に読ませて分析するのに便利
- **検索地域** — 日本／アメリカ／韓国／台湾／イギリス／フランス／ドイツ

---

## 🔑 APIキーの取得

YouTube Data API v3 のキーは無料で取得できます（1日10,000ユニットの無料枠あり）。

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成
3. 「YouTube Data API v3」を有効化
4. 「認証情報」→「APIキーを作成」
5. 表示された `AIza...` で始まる文字列をコピーして、アプリの設定画面に貼り付け

> アプリ内のオンボーディングガイドでも、同じ手順を画面付きで案内しています。

---

## 🛠 開発

```bash
npm install
npm run dev        # 開発サーバー http://localhost:5173
npm run build      # dist/ に静的ファイルを書き出し
npm run preview    # 本番ビルドのローカル検証
npm run typecheck  # 型チェック
```

### 自分でWeb公開したい場合

このツールは静的サイトとして書き出せるので、無料のホスティングサービスにそのまま置けます。

- **Vercel** / **Netlify** / **Cloudflare Pages** / **GitHub Pages** いずれもOK
- ビルドコマンド: `npm run build`、出力ディレクトリ: `dist`

---

## 📁 ファイル構成

```
src/
  App.tsx                    画面遷移とアプリ全体
  main.tsx                   エントリ
  index.css                  Tailwind + 共通クラス
  components/
    Layout.tsx               ヘッダ・ナビ・フッタ
    OnboardingWizard.tsx     初回ガイド（3ステップ）
    HomePanel.tsx            検索フォーム + 進捗 + 結果サマリ
    SearchForm.tsx           検索条件
    VideoList.tsx            動画リスト
    ChannelAnalysis.tsx      チャンネル分析
    CompetitorAnalysis.tsx   競合分析
    ThumbnailGallery.tsx     サムネ一覧
    SettingsPanel.tsx        設定モーダル中身
    ApiKeySetup.tsx          APIキー入力＋接続テスト
    HelpPanel.tsx            使い方
    Modal.tsx                共通モーダル
  lib/
    youtube.ts               YouTube Data API クライアント
    analyzer.ts              チャンネル集計・タイトル解析
    research.ts              検索 → 取得 → 分析の一連フロー
    exporter.ts              Excel/CSV ダウンロード
    storage.ts               localStorage ラッパ
    utils.ts                 共通処理
    types.ts                 型定義
```

---

## 🧪 技術スタック

React 18 / TypeScript / Vite / Tailwind CSS / xlsx

---

## 📜 ライセンス

[MIT License](./LICENSE) — 自由に使用・改変・再配布できます。

## 🙋 作者

**めぐペン**

- note: <https://note.com/megupen12/portal>
- Substack: <https://substack.com/@megupen>

> このツールが役に立ったら、X などでシェアしてもらえると嬉しいです。
> 不具合の報告・改善提案は Issue / Pull Request でお気軽にどうぞ。
