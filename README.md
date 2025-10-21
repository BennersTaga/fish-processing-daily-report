# 魚加工日報 (Fish Processing Daily Report)

Google Sheets / Google Drive と連携する日報入力ツールです。仕入れ・在庫の報告と、寄生虫/異物写真のアップロードを Google Apps Script 経由で行います。

## セットアップ

1. 依存パッケージをインストールします。

   ```bash
   npm install
   ```

2. `.env` を作成し、Google Apps Script で発行した Web アプリ URL などを設定します。

   ```bash
   cp .env.example .env
   # .env を開いて値を入力
   ```

   | 変数名 | 説明 |
   | ------ | ---- |
   | `VITE_MASTER_CSV_URL` | Google スプレッドシートから公開した CSV の URL |
   | `VITE_GAS_URL` | Google Apps Script の Web アプリ（/exec）URL |
   | `VITE_USE_PROXY` | Vercel Functions 経由で GAS を呼び出す場合は `1`（既定）、直接呼び出す場合は `0` |

3. 開発サーバーを起動します。

   ```bash
   npm run dev
   ```

## GAS setup

1. Google スプレッドシートでマスター候補（工場・担当者など）を管理し、「ウェブに公開」→ CSV 形式で公開した URL を `VITE_MASTER_CSV_URL` に設定します。
2. Google Apps Script で Web アプリを作成し、日報データの保存と Drive へのファイル保存処理を実装します。
3. 「デプロイ > 新しいデプロイ」で Web アプリとして公開し、アクセス権限を「全員」に設定します。
4. 発行された Web アプリの `/exec` URL を `VITE_GAS_URL` に設定します。
5. Vercel デプロイでは、`api/gas.ts` が同一オリジンのプロキシとして動作します。`GAS_URL` 環境変数に `/exec` URL を設定し、必要に応じて `VITE_USE_PROXY=1` を指定してください。
5. Apps Script 側では `action=upload` と `action=record` を受け取り、JSON で `files: [{ url: "https://..." }]` の形でレスポンスを返すようにしてください。

## デプロイ

Vercel などのホスティングにデプロイする際は、`.env` と同じ値を Vercel の Environment Variables に設定し、`npm run build` でビルドした成果物をデプロイしてください。
