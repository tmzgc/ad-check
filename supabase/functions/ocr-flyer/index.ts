// チラシ画像をClaude APIで解析し、商品名・産地/メーカー名・価格の候補を抽出するEdge Function
//
// 事前準備（Supabaseダッシュボード or CLIで実施）:
//   1. Anthropicコンソールで APIキーを発行する
//   2. `supabase secrets set ANTHROPIC_API_KEY=<取得したキー>` でシークレット登録する
//      （このキーはEdge Function内でのみ使用し、フロントエンドには一切渡さない）
//   3. `supabase functions deploy ocr-flyer` でデプロイする
//
// リクエスト: POST { path: string } ※flyer-imagesバケット内のStorageパス
// レスポンス: { candidates: Array<{ origin_or_maker, product_name, price }> }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'claude-sonnet-5'

const CANDIDATE_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      description: 'チラシに掲載されている商品ごとの情報一覧。',
      type: 'array',
      items: {
        type: 'object',
        properties: {
          origin_or_maker: {
            description: '産地名またはメーカー名。読み取れない場合はnull。',
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          product_name: { type: 'string', description: '商品名' },
          price: { type: 'integer', description: '価格(円、本体価格の数値のみ)' },
        },
        required: ['origin_or_maker', 'product_name', 'price'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `あなたはスーパーのチラシ画像を読み取るアシスタントです。
画像に掲載されている商品ごとに、産地名またはメーカー名・商品名・価格を読み取ってください。
価格はチラシに印字されている数値をそのまま整数(円)で読み取ってください。
数字は0とO、1と7、3と8、6とB、5とSなど読み間違えやすいため、1つずつ注意して正確に読み取ってください。
産地名・メーカー名が記載されていない商品はnullにしてください。
商品情報が1件も読み取れない場合はcandidatesを空配列にしてください。`

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

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEYが未設定です' }),
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
    const mediaType = fileData.type || 'image/jpeg'

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        output_config: {
          format: { type: 'json_schema', schema: CANDIDATE_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Image },
              },
              { type: 'text', text: 'このチラシ画像から商品情報を読み取ってください。' },
            ],
          },
        ],
      }),
    })

    const claudeResult = await claudeResponse.json()

    if (!claudeResponse.ok) {
      return new Response(
        JSON.stringify({ error: claudeResult.error?.message ?? 'Claude APIの呼び出しに失敗しました' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (claudeResult.stop_reason === 'refusal') {
      return new Response(JSON.stringify({ error: '画像の解析がAPI側で拒否されました' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const textBlock = claudeResult.content?.find((block) => block.type === 'text')
    if (!textBlock) {
      return new Response(JSON.stringify({ error: '解析結果を取得できませんでした' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { candidates } = JSON.parse(textBlock.text)

    return new Response(JSON.stringify({ candidates }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
