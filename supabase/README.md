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

1. ログイン後の「場所の登録・選択」画面で、自宅・職場・最寄り駅など確認したい場所を登録し、一覧から「選択」を押す。
2. 遷移先の「登録店チラシ一覧」画面で、まず登録店（店名・住所・チラシ掲載URL）を登録する。
3. 「チラシ画像から自動登録する」エリアで対象の登録店を選び、チラシ画像をアップロードして「読み取って登録する」を押すと、
   OCRで読み取った商品名・産地/メーカー名・価格がそのまま自動保存される。誤りがあれば画面下部の商品一覧から「編集」で修正する。
   画像がない場合は「商品価格を手動で登録する」フォームから直接入力もできる。
4. 保存した商品情報は商品名ごとにグループ化され、複数登録店の価格を比較できる一覧として画面下部に表示される。

## 4. サインアップ制限（セキュリティ対応）

会員登録フォームは初期状態では誰でも利用できるため、`schema.sql`の末尾に
`restrict_signup_by_email_domain`というトリガーを追加している。

- **2026-07-06 07:41:07 UTC以降**、`@mg-shop.co.jp`以外のメールアドレスでの新規会員登録を拒否する
- それより前（公開直後の猶予期間）は制限なし
- 既存ユーザーのログインには影響しない（新規登録時のみチェック）
- ドメインや発効日時を変更したい場合は、`schema.sql`内の`restrict_signup_by_email_domain`関数を
  書き換えて、SQL Editorで再実行する

## 補足

- OCRの抽出ロジックは単純な正規表現（`◯◯産　商品名　価格円` のパターン）によるヒューリスティックです。
  レイアウトによっては正しく抽出できない場合があるため、保存後に一覧の内容を確認してください。
- チラシ画像は非公開のStorageバケット（`flyer-images`）に保存され、ログイン済みユーザーのみアクセスできます。
- データは`locations`（ユーザーごとの場所。本人のみ閲覧・編集可）、`competitors`（登録店：店名・住所・URL）、
  `competitor_products`（商品価格情報：商品名・産地/メーカー・価格）の3テーブルに分かれており、
  1登録店に対して複数の商品価格情報を持てる構成になっている。
