import { useState, useRef } from 'react'
import { Upload, FileText, Brain, CheckCircle, AlertCircle, X } from 'lucide-react'
import { extractTextFromPDF, maskPersonalInfo } from '../lib/pdfExtractor'
import { analyzePDFBatch } from '../lib/claude'

export default function PDFBatchLearner({ doctor, onComplete }) {
  const [files, setFiles] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  function handleFiles(newFiles) {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf')
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...pdfs.filter(f => !existing.has(f.name))]
    })
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  async function handleLearn() {
    if (files.length === 0) return
    setProcessing(true)
    setError('')
    setResult('')

    try {
      // PDFからテキスト抽出 + マスキング
      setProgress({ phase: 'pdf', current: 0, total: files.length })
      const texts = []
      for (let i = 0; i < files.length; i++) {
        setProgress({ phase: 'pdf', current: i + 1, total: files.length })
        try {
          const raw = await extractTextFromPDF(files[i])
          const masked = maskPersonalInfo(raw)
          if (masked.trim().length > 50) texts.push(masked)
        } catch {
          // 読み取れないPDFはスキップ
        }
      }

      if (texts.length === 0) {
        setError('テキストを抽出できるPDFがありませんでした')
        setProcessing(false)
        return
      }

      // AI分析
      const profile = await analyzePDFBatch(
        texts,
        doctor.style_profile,
        ({ current, total, phase }) => {
          setProgress({ phase: phase === 'synthesize' ? 'synthesize' : 'analyze', current, total })
        }
      )

      setResult(profile)
      onComplete(profile)
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  const phaseLabel = progress
    ? progress.phase === 'pdf' ? `PDF読み取り中 ${progress.current}/${progress.total}`
    : progress.phase === 'analyze' ? `AI分析中 バッチ ${progress.current}/${progress.total}`
    : 'スタイルプロファイル生成中...'
    : ''

  const progressPct = progress
    ? progress.phase === 'pdf' ? (progress.current / progress.total) * 40
    : progress.phase === 'analyze' ? 40 + (progress.current / progress.total) * 50
    : 95
    : 0

  return (
    <div>
      {/* ドロップゾーン */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#1d4ed8' : '#cbd5e1'}`,
          borderRadius: 12,
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#eff6ff' : '#f8fafc',
          transition: 'all 0.15s',
          marginBottom: 14,
        }}
      >
        <Upload size={28} color={dragOver ? '#1d4ed8' : '#94a3b8'} style={{ marginBottom: 8 }} />
        <p style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>
          PDFをドラッグ＆ドロップ
        </p>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>または クリックしてファイルを選択（複数可）</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* ファイルリスト */}
      {files.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
              {files.length}件のPDF
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setFiles([])}>
              全てクリア
            </button>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {files.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f1f5f9', borderRadius: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <FileText size={13} color="#1d4ed8" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </div>
                <button type="button" onClick={() => removeFile(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* プログレスバー */}
      {processing && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
            <span>{phaseLabel}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#1d4ed8', borderRadius: 999, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            ※ 個人情報は自動マスキング後にAIへ送信されます
          </p>
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div style={{ marginBottom: 14, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <CheckCircle size={14} color="#16a34a" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>スタイルプロファイルを更新しました</span>
          </div>
          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{result}</p>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertCircle size={14} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: '#dc2626' }}>{error}</p>
        </div>
      )}

      <button
        className="btn btn-primary"
        type="button"
        onClick={handleLearn}
        disabled={processing || files.length === 0}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Brain size={15} />
        {processing ? '学習中...' : `${files.length}件のPDFから学習する`}
      </button>
    </div>
  )
}
