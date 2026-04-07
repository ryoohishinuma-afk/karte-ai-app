import * as pdfjsLib from 'pdfjs-dist'

// workerの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// PDF1ファイルからテキストを抽出
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += pageText + '\n'
  }
  return fullText
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
