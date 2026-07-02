import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// workerの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

// PDFページを画像（base64）に変換
async function pageToBase64(page, scale = 2.0) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
}

// Claude VisionでOCR（スキャンPDF用）
async function ocrPageWithClaude(base64Image) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
          },
          {
            type: 'text',
            text: 'これは医療カルテのスキャン画像です。画像内のテキストをすべて正確に書き起こしてください。医療用語・略語・数値はそのまま出力してください。テキスト以外の説明は不要です。',
          },
        ],
      }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

// PDF1ファイルからテキストを抽出（スキャンPDFは自動でOCRにフォールバック）
export async function extractTextFromPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress({ current: i, total: pdf.numPages })
    const page = await pdf.getPage(i)

    // まずテキストレイヤーで試みる
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ').trim()

    if (pageText.length > 30) {
      // テキストPDF：通常抽出
      fullText += pageText + '\n'
    } else {
      // スキャンPDF：Claude Visionでフォールバック
      const base64 = await pageToBase64(page)
      const ocrText = await ocrPageWithClaude(base64)
      fullText += ocrText + '\n'
    }
  }
  return fullText
}

// テキストファイル（TXT / MD / CSV）を読み込む
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

// DOCXからテキストを抽出
async function extractTextFromDOCX(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

// ファイル形式を自動判別してテキストを抽出
export async function extractTextFromFile(file, onProgress) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    return extractTextFromPDF(file, onProgress)
  }
  if (name.endsWith('.docx')) {
    return extractTextFromDOCX(file)
  }
  // TXT / MD / CSV はそのままテキストとして読む
  return readAsText(file)
}

// 個人情報マスキング
export function maskPersonalInfo(text) {
  return text
    // 氏名パターン（漢字2〜4文字 + 様/さん/氏）
    .replace(/[\u4e00-\u9faf]{2,4}[様さん氏]/g, '患者')
    // 生年月日
    .replace(/\d{4}[年/\-]\d{1,2}[月/\-]\d{1,2}日?/g, '生年月日省略')
    // 患者ID（5〜8桁の数字）
    .replace(/\b\d{5,8}\b/g, 'ID省略')
    // 電話番号
    .replace(/\d{2,4}[-\u30FC]\d{2,4}[-\u30FC]\d{4}/g, '電話省略')
    // 住所（都道府県から始まるパターン）
    .replace(/[東西南北]?[都道府県].{2,20}[市区町村丁目番号]/g, '住所省略')
}
