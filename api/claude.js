// Anthropic APIへのサーバー側プロキシ。
// APIキーはこの関数の実行環境（Vercel）にのみ存在し、ブラウザには一切送られない。
export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'サーバー側にANTHROPIC_API_KEYが設定されていません' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'リクエストボディが不正です' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    // ストリーミング・非ストリーミングどちらもそのまま透過する
    return new Response(anthropicRes.body, {
      status: anthropicRes.status,
      headers: {
        'Content-Type': anthropicRes.headers.get('content-type') ?? 'application/json',
      },
    })
  },
}
