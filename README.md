# 魚加工日報 (Fish Processing Daily Report)

Google Sheets / Google Drive と連携する日報入力ツールです。仕入れ・在庫の報告と、寄生虫/異物写真のアップロードを Google Apps Script 経由で行います。

## セットアップ

1. 依存パッケージをインストールします。

   ```bash
   npm install
   ```

2. `.env` を作成し、Google Apps Script で発行した Web アプリ URL を含めて設定します。

   ```bash
   cp .env.example .env
   # .env を開いて値を入力
   ```

   | 変数名 | 説明 |
   | ------ | ---- |
   | `VITE_GAS_WEBAPP_URL` | Google Apps Script の Web アプリ URL |
   | `VITE_SPREADSHEET_ID` | 対象スプレッドシート ID |
   | `VITE_SHEET_LIST` | マスター候補を保持するシート名 |
   | `VITE_SHEET_ACTION` | 報告結果を書き込むシート名 |
   | `VITE_DRIVE_FOLDER_ID_PHOTOS` | 画像保存先 Google Drive フォルダ ID |

3. 開発サーバーを起動します。

   ```bash
   npm run dev
   ```

## Google Apps Script

`/docs` ディレクトリに GAS デプロイスクリプト例を格納してください（本リポジトリでは README に記載のコードを利用します）。Apps Script は匿名アクセスを許可して Web アプリとして公開してください。

## デプロイ

Vercel などのホスティングにデプロイする際は、`.env` と同じ値を Vercel の Environment Variables に設定し、`npm run build` でビルドした成果物をデプロイしてください。
