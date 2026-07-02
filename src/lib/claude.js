const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-6'
const MODEL_HAIKU = 'claude-haiku-4-5-20251001'  // バッチ処理用（低コスト）

// 音声文字起こし補正（足科専門用語）
export async function correctFootClinicTranscript(rawTranscript) {
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
        content: `あなたは足の専門クリニック（外反母趾・インソール・足部疾患専門）のカルテ文字起こし補正AIです。
音声認識で誤変換された以下のテキストを、足科・整形外科の正しい専門用語に補正してください。

【よくある誤変換パターン】
- 烏帽子・エボシ → 母趾球（ぼしきゅう）または凹足（おうそく／cavus foot）※文脈で判断
- エローション → びらん（erosion）
- 荷重（かじゅう）の誤変換 → 荷重
- 最低・催促 → 採型（さいけい）
- ポスト → ポスティング
- フル・ハーフ → フルレングス・ハーフレングス（インソール）
- 母趾球・ぼしきゅう の誤変換 → 母趾球
- MTP・エムティーピー の誤変換 → MTP関節
- 外反母趾・がいはんぼし の誤変換 → 外反母趾
- 内反小趾・ないはんしょうし の誤変換 → 内反小趾
- 足底筋膜炎・そくていきんまくえん の誤変換 → 足底筋膜炎
- 踵骨・しょうこつ の誤変換 → 踵骨
- 足根管・そっこんかん の誤変換 → 足根管
- モートン神経腫 の誤変換 → モートン神経腫
- 槌趾・つちゆび の誤変換 → 槌趾
- アーチ補正・サポート の誤変換 → アーチ補正
- ヒールカップ の誤変換 → ヒールカップ
- 近位・遠位 の誤変換 → 近位・遠位

【ルール】
- 文脈から推測して補正する
- 明らかに正しい部分は変更しない
- 補正後のテキストのみ返す（説明不要）
- 元の話し言葉のスタイルを保つ

【補正対象テキスト】
${rawTranscript}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? rawTranscript
}

function buildFormatInstruction(outputFormat) {
  if (!outputFormat) return ''
  const { sections, length } = outputFormat
  const enabled = sections?.filter(s => s.enabled).map(s => s.label) ?? []
  const disabled = sections?.filter(s => !s.enabled).map(s => s.label) ?? []
  const lengthMap = {
    brief: '各セクション1〜2文で簡潔に',
    standard: '各セクション3〜4文程度',
    detailed: '各セクション詳しく記載',
  }
  let text = '\n\n【出力フォーマット設定（必ず守ること）】\n'
  if (enabled.length) text += `含めるセクション: ${enabled.join('、')}\n`
  if (disabled.length) text += `省略するセクション: ${disabled.join('、')}（記載しない）\n`
  text += `文章の長さ: ${lengthMap[length] ?? lengthMap.standard}`
  return text
}

// カルテ生成（ストリーミング）
export async function generateKarte({ transcript, mondsin, prevKarte, patientInfo, visitType, styleProfile, phrases, template, examples, outputFormat, onChunk, onDone }) {
  const phrasesText = phrases && phrases.length > 0
    ? `\n\n【定型表現・略語辞書】\n${phrases.map(p => `${p.trigger} → ${p.expansion}`).join('\n')}\n上記の略語・定型表現をカルテ内で積極的に使用すること。`
    : ''

  // 医師の原文カルテ例（few-shot）— 文体再現の最重要材料
  const examplesText = examples && examples.length > 0
    ? `\n\n【この医師が実際に書いたカルテ例（最重要・文体をこれに合わせる）】\n${examples.map((ex, i) => `＜例${i + 1}${ex.chief_complaint ? `（${ex.chief_complaint}）` : ''}＞\n${ex.content.slice(0, 1500)}`).join('\n\n')}\n上記の例の文体・略語・構成・文末表現を忠実に模倣すること。内容は今回の診察情報から書き、文体だけを例に合わせる。`
    : ''

  const templateText = template
    ? `\n\n【参考テンプレート（同症状の過去カルテパターン）】\n${template}\n上記を参考にしつつ、今回の診察内容に合わせて記載すること。`
    : ''

  const hasTranscript = transcript && transcript.trim().length > 0
  const isFirstVisit = !visitType || visitType === '初診'

  const visitTypeInstruction = isFirstVisit
    ? `【初診カルテの注意点】
- 主訴・現病歴・既往歴・生活背景など初診に必要な情報を網羅的に記載する
- 初回なので詳細な問診内容・所見を丁寧に記録する`
    : `【再診カルテの注意点】
- 前回からの経過・変化を中心に簡潔に記載する
- 治療効果・症状の推移・本日の処置・次回方針を記録する
- 初診時の情報（既往歴等）の繰り返しは不要`

  const systemPrompt = `あなたは日本のフットケアクリニックで使用するカルテ自動生成AIです。
以下の情報をもとに、このスタイルプロファイルに完全に合わせた日本語カルテを生成してください。

【標準ルール（必ず守ること）】
- Markdownの**（太字）・#（見出し）などの記号は一切使用しない
- カルテと関係のない話題・内容・コメントは省く
- 医療記録として必要な情報のみ記載する
- 診察記録・問診・前回カルテにない所見・数値・処置を創作しない
- スタイル上「前回カルテの内容を再掲して矢印で変化を書く」記法を使う場合、再掲部分は一字一句変更しない（要約・言い換え・整形を禁止）

${visitTypeInstruction}

【スタイルプロファイル】
${styleProfile || '標準的な日本語カルテ形式で記載すること'}

【生成ルール】
- スタイルプロファイルに記載された文体・表現・構成を忠実に再現する
- テンプレートがある場合はその構成・語彙・文体を最優先で参考にする
- 診察記録がある場合はその内容を反映し、ない場合はテンプレートと患者情報から適切に推定する
- 患者名・IDは一切記載しない
- カルテとしてそのまま使える完成文章にする
- 冗長な説明は不要、医療現場で実際に使われる簡潔な表現にする${examplesText}${phrasesText}${templateText}${buildFormatInstruction(outputFormat)}`

  const hasMondsin = mondsin && mondsin.trim().length > 0
  const prevKarteSection = prevKarte?.trim()
    ? `\n\n【前回カルテ（参考）】\n${prevKarte}`
    : ''

  let contentSection = ''
  if (hasMondsin && hasTranscript) {
    contentSection = `【問診情報】\n${mondsin}\n\n${isFirstVisit ? '【診察記録】' : '【本日の診察記録】'}\n${transcript}`
  } else if (hasMondsin) {
    contentSection = `【問診情報】\n${mondsin}`
  } else if (hasTranscript) {
    contentSection = `${isFirstVisit ? '【診察記録】' : '【本日の診察記録】'}\n${transcript}`
  } else {
    contentSection = '【備考】診察記録なし。テンプレートと患者情報をもとにカルテを生成すること。'
  }

  const userPrompt = `【患者情報】
年齢: ${patientInfo.age || '不明'}歳
性別: ${patientInfo.gender || '不明'}
${patientInfo.chiefComplaint ? `主訴: ${patientInfo.chiefComplaint}` : ''}
区分: ${visitType || '初診'}${prevKarteSection}

${contentSection}

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
      max_tokens: 2048,
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

// カルテの区分・主訴を自動タグ付け（Haiku・バッチ処理）
export async function classifyKarteBatch(texts) {
  const BATCH = 10
  const results = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
    const combined = batch.map((t, j) => `【カルテ${j + 1}】\n${t.slice(0, 1500)}`).join('\n\n')
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
          content: `以下の${batch.length}件のカルテをそれぞれ分類してください。
JSON配列のみ返してください（他のテキスト不要、必ず${batch.length}要素）：
[{"visit_type":"初診または再診または不明","chief_complaint":"主訴を10文字程度で（例: 右外反母趾痛）"}]

判断基準: 主訴・現病歴・既往歴が網羅的に書かれていれば初診、前回比較・経過中心なら再診。

${combined}`,
        }],
      }),
    })
    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    let parsed = []
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) parsed = JSON.parse(match[0])
    } catch {}
    for (let j = 0; j < batch.length; j++) {
      results.push(parsed[j] ?? { visit_type: '不明', chief_complaint: '' })
    }
    if (i + BATCH < texts.length) await new Promise(r => setTimeout(r, 500))
  }
  return results
}

// バッチ1件分の特徴抽出（Sonnet使用・原文引用つき）
async function extractBatchFeatures(texts, visitType) {
  const combined = texts.map((t, i) => `【カルテ${i + 1}】\n${t.slice(0, 4000)}`).join('\n\n')
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
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `以下は同一医師が書いた${visitType ? `${visitType}の` : ''}カルテ群です。この医師の記載スタイルの特徴を箇条書きで8〜12点抽出してください。

【ルール（重要）】
- 各特徴には必ず原文からの引用例を付けること。形式:「特徴の説明。例:『原文からの引用』」
- 「簡潔」「丁寧」のような抽象的な形容だけの項目は禁止。具体的な語彙・表記・構成のパターンを書く
- 注目する観点: 文末表現／略語・英語表記の使い方／頻出する定型句／所見の列挙形式／処方・指示の書き方／記載の順序と見出し／数値・単位の書き方
- 特に必ず確認する観点（該当があれば原文の表記をそのまま引用して報告）:
  a. 構成タイプ: SOAP型か、自由記述型か、箇条書き型か、それらの混合か
  b. 再診時の前回参照: 前回カルテを再掲して矢印（「↓」「→」等）で変化を書く記法があるか。あるなら矢印の正確な表記
  c. 処置の実施/未実施の書き方（例:「処置：◯◯施行」「軟膏処置のみ」「処置なし」等、実際の表記）
  d. 変化がないときの定型表現（例:「著変なし」「n.p.」「変わりなし」等、実際の表記）
  e. 患者の訴えの扱い: 患者の言葉をカギ括弧でそのまま残すか、医学用語に言い換えるか。陰性所見（〜なし）を書く習慣があるか
- 患者固有の情報は無視し、医師の書き方のみ注目する

${combined}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// 特徴リストを統合してプロファイル生成（Sonnet使用・長文対応）
export async function synthesizeStyleProfile(featuresList, existingProfile) {
  const allFeatures = featuresList
    .map(f => (f.visitType ? `＜${f.visitType}カルテの特徴＞\n${f.features}` : f.features ?? f))
    .join('\n\n---\n\n')
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
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `以下は大量のカルテから抽出した医師の記載特徴リスト（原文引用つき）です。${existingProfile ? `\n\n【既存プロファイル（積み上げ学習）】\n${existingProfile}\n\n上記の既存プロファイルを継承・強化しながら` : ''}これらを統合し、カルテ自動生成AIへの詳細な指示文を作成してください。

【構成（必ずこの4セクションに分ける）】
■ 構成タイプ（SOAP型/自由記述型/箇条書き型/混合。見出しの有無）
■ 共通の書き癖（文体・語調／頻出の定型句・口癖／略語・専門用語の表記／数値・単位の書き方／定型表記＝矢印記法・「変化なし」の言い回し・処置有無の書き方は原文の表記をそのまま列挙／患者の言葉の扱い・陰性所見の習慣）
■ 初診カルテの書き方（構成順序・各項目の詳細度・記載例）
■ 再診カルテの書き方（構成順序・前回内容の参照記法・経過の書き方・記載例）

【ルール】
- 元の特徴リストにある原文引用例をできるだけ残すこと（引用があるほど再現精度が上がる）
- 1200〜1800文字
- 初診または再診の特徴が抽出リストにない場合、そのセクションは「（学習データなし）」とする

【抽出された特徴】
${allFeatures}`,
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// 一括学習のメイン処理（items: [{ text, visit_type }]）
export async function analyzePDFBatch(items, existingProfile, onProgress) {
  const BATCH_SIZE = 8  // 切り捨て廃止でトークン量が増えたためバッチを縮小
  // 初診/再診/不明に分けてバッチ化（構成の違う種類を混ぜて平均化しない）
  const groups = { 初診: [], 再診: [], 不明: [] }
  for (const it of items) {
    const key = groups[it.visit_type] ? it.visit_type : '不明'
    groups[key].push(it.text)
  }

  const batches = []
  for (const [visitType, texts] of Object.entries(groups)) {
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      batches.push({ visitType, texts: texts.slice(i, i + BATCH_SIZE) })
    }
  }

  const featuresList = []
  for (let i = 0; i < batches.length; i++) {
    onProgress({ current: i + 1, total: batches.length, phase: 'extract' })
    const features = await extractBatchFeatures(batches[i].texts, batches[i].visitType === '不明' ? '' : batches[i].visitType)
    featuresList.push({ visitType: batches[i].visitType, features })
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
