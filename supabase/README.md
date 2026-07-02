# Supabaseセットアップ手順

## 1. テーブル・Storage・RLSの適用

Supabaseダッシュボードの **SQL Editor** で [schema.sql](schema.sql) を実行する。
既存環境に対しても再実行可能（`if not exists` / `or replace` で冪等）。

## 2. OCR機能（Google Cloud Vision）のセットアップ

1. Google Cloud ConsoleでVision APIを有効化し、APIキーを発行する。
2. ローカルにSupabase CLIをインストール、またはこのプロジェクトでは `npx supabase` を利用する。
3. Supabaseにログインし、このプロジェクトとリンクする。

   ```bash
   npx supabase login
   npx supabase link --project-ref kkgowntdofwevpxmykzl
   ```

4. Vision APIキーをEdge Functionのシークレットとして登録する（**チャットや.envには書かず、ここで直接設定する**）。

   ```bash
   npx supabase secrets set GOOGLE_VISION_API_KEY=<取得したAPIキー>
   ```

5. Edge Functionをデプロイする。

   ```bash
   npx supabase functions deploy ocr-flyer
   ```

## 3. 動作確認

アプリの「競合店チラシ一覧」画面で、チラシ画像をアップロードして「画像から読み取る」ボタンを押す。
OCR結果の候補一覧から「この内容を使う」を押すと、商品名・産地/メーカー名・価格がフォームに自動入力される。
内容を確認・修正のうえ「登録する」で保存する。

## 補足

- OCRの抽出ロジックは単純な正規表現（`◯◯産　商品名　価格円` のパターン）によるヒューリスティックです。
  レイアウトによっては正しく抽出できない場合があるため、保存前に必ず内容を確認してください。
- チラシ画像は非公開のStorageバケット（`flyer-images`）に保存され、ログイン済みユーザーのみアクセスできます。
