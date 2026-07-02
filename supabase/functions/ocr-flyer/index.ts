// チラシ画像をOCRし、商品名・産地/メーカー名・価格の候補を抽出するEdge Function
//
// 事前準備（Supabaseダッシュボード or CLIで実施）:
//   1. Google Cloud ConsoleでVision APIを有効化し、APIキーを発行する
//   2. `supabase secrets set GOOGLE_VISION_API_KEY=<取得したキー>` でシークレット登録する
//      （このキーはEdge Function内でのみ使用し、フロントエンドには一切渡さない）
//   3. `supabase functions deploy ocr-flyer` でデプロイする
//
// リクエスト: POST { path: string } ※flyer-imagesバケット内のStorageパス
// レスポンス: { rawText: string, candidates: Array<{ origin_or_maker, product_name, price }> }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OCRで抽出した1行のテキストから「産地」「商品名」「価格」を推定する
// 想定フォーマット例: "北海道産　玉ねぎ　198円"
function extractCandidates(rawText) {
  const priceLinePattern = /(\d{1,6})\s*円/
  const originPattern = /([^\s　]{2,10}産)/

  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const candidates = []

  for (const line of lines) {
    const priceMatch = line.match(priceLinePattern)
    if (!priceMatch) continue

    const originMatch = line.match(originPattern)
    let productName = line
      .replace(priceMatch[0], '')
      .replace(originMatch?.[0] ?? '', '')
      .trim()

    if (!productName) continue

    candidates.push({
      origin_or_maker: originMatch?.[1] ?? '',
      product_name: productName,
      price: Number(priceMatch[1]),
    })
  }

  return candidates
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { path } = await req.json()
    if (!path) {
      return new Response(JSON.stringify({ error: 'pathが指定されていません' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const visionApiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
    if (!visionApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_VISION_API_KEYが未設定です' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Service Role権限でStorageから画像を取得する
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('flyer-images')
      .download(path)

    if (downloadError) {
      return new Response(JSON.stringify({ error: downloadError.message }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ''),
    )

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: 'TEXT_DETECTION' }],
              imageContext: { languageHints: ['ja'] },
            },
          ],
        }),
      },
    )

    const visionResult = await visionResponse.json()
    const rawText =
      visionResult.responses?.[0]?.fullTextAnnotation?.text ?? ''

    const candidates = extractCandidates(rawText)

    return new Response(JSON.stringify({ rawText, candidates }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
