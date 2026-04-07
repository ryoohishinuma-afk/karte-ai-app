const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'
const MODEL_HAIKU = 'claude-haiku-4-5-20251001'  // バッチ処理用（低コスト）

// カルテ生成（ストリーミング）
export async function generateKarte({ transcript, patientInfo, styleProfile, phrases, template, onChunk, onDone }) {
  const phrasesText = phrases && phrases.length > 0
    ? `\n\n【定型表現・略語辞書】\n${phrases.map(p => `${p.trigger} → ${p.expansion}`).join('\n')}\n上記の略語・定型表現をカルテ内で積極的に使用すること。`
    : ''

  const templateText = template
    ? `\n\n【参考テンプレート（同症状の過去カルテパターン）】\n${template}\n上記を参考にしつつ、今回の診察内容に合わせて記載すること。`
    : ''

  const hasTranscript = transcript && transcript.trim().length > 0

  const systemPrompt = `あなたは日本のフットケアクリニックで使用するカルテ自動生成AIです。
以下の情報をもとに、この医師のスタイルに完全に合わせた日本語カルテを生成してください。

【この医師の書き方・文体・癖】
${styleProfile || '標準的な日本語カルテ形式で記載すること'}

【生成ルール】
- 医師のスタイルプロファイルに記載された文体・表現・構成を忠実に再現する
- テンプレートがある場合はその構成・語彙・文体を最優先で参考にする
- 診察記録がある場合はその内容を反映し、ない場合はテンプレートと患者情報から適切に推定する
- 患者名・IDは一切記載しない
- カルテとしてそのまま使える完成文章にする
- 冗長な説明は不要、医療現場で実際に使われる簡潔な表現にする${phrasesText}${templateText}`

  const userPrompt = `【患者情報】
年齢: ${patientInfo.age || '不明'}歳
性別: ${patientInfo.gender || '不明'}
主訴: ${patientInfo.chiefComplaint || '記載なし'}

${hasTranscript ? `【診察記録】\n${transcript}` : '【備考】診察記録なし。テンプレートと患者情報をもとにカルテを生成すること。'}

上記をもとにカルテを生成してください。`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API エラー: ${err}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text)
        }
      } catch {}
    }
  }
  onDone()
}

// 書き癖プロファイル生成
export async function analyzeStyle(samples) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `以下は医師が書いたカルテのサンプルです。この医師の書き方の癖・特徴・よく使う表現・文体・構成パターンを詳しく分析し、「カルテ生成AIへの指示文」として300〜500文字でまとめてください。

${samples.map((s, i) => `【サンプル${i + 1}】\n${s}`).join('\n\n')}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// バッチ1件分の特徴抽出（Haiku使用・低コスト）
async function extractBatchFeatures(texts) {
  const combined = texts.map((t, i) => `【カルテ${i + 1}】\n${t.slice(0, 800)}`).join('\n\n')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_HAIKU,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `以下のカルテ群から、医師の文体・表現・構成の特徴を箇条書きで5〜8点抽出してください。患者情報は無視し、医師の記載スタイルのみ注目してください。\n\n${combined}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// 特徴リストを統合してプロファイル生成（Sonnet使用）
export async function synthesizeStyleProfile(featuresList, existingProfile) {
  const allFeatures = featuresList.join('\n\n---\n\n')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `以下は大量のカルテから抽出した医師の記載特徴リストです。${existingProfile ? `\n\n既存プロファイル:\n${existingProfile}\n\n上記も踏まえて` : ''}これらを統合し、カルテ自動生成AIへの指示文として400〜600文字でまとめてください。文体・よく使う表現・構成・略語・特徴的なパターンを含めてください。\n\n${allFeatures}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// PDF一括学習のメイン処理
export async function analyzePDFBatch(texts, existingProfile, onProgress) {
  const BATCH_SIZE = 10  // 1回のAPI呼び出しで処理するカルテ数
  const batches = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE))
  }

  const featuresList = []
  for (let i = 0; i < batches.length; i++) {
    onProgress({ current: i + 1, total: batches.length, phase: 'extract' })
    const features = await extractBatchFeatures(batches[i])
    featuresList.push(features)
    // レート制限対策
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 500))
  }

  onProgress({ current: batches.length, total: batches.length, phase: 'synthesize' })
  return await synthesizeStyleProfile(featuresList, existingProfile)
}

// PDFから医療用語・略語を自動抽出
export async function extractMedicalTermsFromPDFs(texts, onProgress) {
  const BATCH = 10
  const allTerms = []

  for (let i = 0; i < texts.length; i += BATCH) {
    onProgress({ current: Math.floor(i / BATCH) + 1, total: Math.ceil(texts.length / BATCH) })
    const batch = texts.slice(i, i + BATCH)
    const combined = batch.map((t, j) => `【カルテ${i + j + 1}】\n${t.slice(0, 800)}`).join('\n\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL_HAIKU,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `以下のカルテ文章から医療略語・専門用語を抽出してください。
JSON配列のみ返してください（他のテキスト不要）：
[{"trigger":"略語または専門用語","reading":"読み仮名（ひらがな）","expansion":"正式名称または意味","category":"所見/診断/処方/指示/その他"}]

重複は除き、明らかな医療用語・略語のみ抽出してください。

${combined}`,
        }],
      }),
    })
    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        allTerms.push(...parsed)
      }
    } catch {}
    if (i + BATCH < texts.length) await new Promise(r => setTimeout(r, 500))
  }

  // 重複排除（同じtriggerは最初の1件のみ）
  const seen = new Set()
  return allTerms.filter(t => {
    if (seen.has(t.trigger)) return false
    seen.add(t.trigger)
    return true
  })
}

// PDFから症状別テンプレートを自動抽出
export async function extractTemplatesFromPDFs(texts, onProgress) {
  const BATCH = 15
  const allTemplates = []

  for (let i = 0; i < texts.length; i += BATCH) {
    onProgress({ current: Math.floor(i / BATCH) + 1, total: Math.ceil(texts.length / BATCH) })
    const batch = texts.slice(i, i + BATCH)
    const combined = batch.map((t, j) => `【カルテ${i + j + 1}】\n${t.slice(0, 600)}`).join('\n\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL_HAIKU,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `以下のカルテ群から、症状パターンを抽出してください。
各パターンをJSON配列で返してください（他のテキスト不要）：
[{"symptom":"症状名","age_group":"年齢層または空","gender":"男性/女性/問わず","template_text":"典型的なカルテ記載例"}]

${combined}`,
        }],
      }),
    })
    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        allTemplates.push(...parsed)
      }
    } catch {}
    if (i + BATCH < texts.length) await new Promise(r => setTimeout(r, 500))
  }

  // 重複を統合（同じsymptom+age_group+genderは最初の1件のみ）
  const seen = new Set()
  return allTemplates.filter(t => {
    const key = `${t.symptom}_${t.age_group}_${t.gender}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
