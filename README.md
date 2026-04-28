# YouTubeリサーチツール（Web版）

Google Apps Script 版を Web アプリ（React + TypeScript + Vite）として作り直したものです。
購入者（非エンジニア）が自分のブラウザで完結するように設計してあり、
- データは外部サーバーに送信されない（YouTube API直叩き）
- APIキーは購入者のブラウザの `localStorage` のみに保存
- 販売者はライセンスキーで利用者を絞り込める

## 機能

- キーワード検索（期間・動画尺・並び替え・取得件数の指定）
- 動画リスト：タイトル/チャンネル/再生数/1日平均/登録者比 などを表形式で
- チャンネル分析：再現性スコア、運営月数、伸びチャンス判定
- 競合分析：頻出ワード TOP20、文字数/曜日/時間帯/動画尺の分布
- サムネ一覧
- Excel / CSV エクスポート
- 初回オンボーディング（APIキー取得手順を画面内ガイド）

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に静的ファイルを書き出し
npm run preview  # 本番ビルドのローカル検証
npm run typecheck
```

## ライセンスキーで配布する手順

1. 環境変数を本番に設定する（Vercel の Project Settings → Environment Variables など）
   - `VITE_LICENSE_KEYS` … カンマ区切りで有効キーを並べる
   - `VITE_LICENSE_BYPASS` … 開発時のみ `true`、本番は空 or `false`
2. ライセンスキー生成は `node scripts/generate-license-key.mjs 10` で10個など
3. デプロイ（後述）。
4. 購入者にはツールのURLとライセンスキーをメールで送付する。

ライセンスキーはクライアント側でチェックするため完全な防止策ではありませんが、
URL を共有しただけでは入れず、追加の行動コストを発生させる効果があります。

## デプロイ（Vercel 例）

1. このフォルダを GitHub リポジトリにアップロード
2. Vercel で「New Project」→ リポジトリを選択 → そのままインポート
3. Environment Variables に `VITE_LICENSE_KEYS` を追加
4. デプロイ後、`https://your-project.vercel.app` が販売用 URL

Netlify でも同様に動きます（`vercel.json` は不要）。

## ファイル構成

```
src/
  App.tsx                    画面遷移とアプリ全体
  main.tsx                   エントリ
  index.css                  Tailwind + 共通クラス
  components/
    Layout.tsx               ヘッダ・ナビ・フッタ
    OnboardingWizard.tsx     初回ガイド（3ステップ）
    LicenseGate.tsx          ライセンスキー入力画面
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
    license.ts               ライセンス検証
    utils.ts                 共通処理
    types.ts                 型定義
scripts/
  generate-license-key.mjs   ライセンスキー発行
```
