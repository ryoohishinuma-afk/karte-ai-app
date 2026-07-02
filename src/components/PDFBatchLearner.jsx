import { useState, useRef } from 'react'
import { Upload, FileText, FileType, FileSpreadsheet, Brain, AlertCircle, X, Clock, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react'
import { extractTextFromFile, maskPersonalInfo } from '../lib/pdfExtractor'
import { analyzePDFBatch, classifyKarteBatch } from '../lib/claude'
import { useLearningFiles } from '../hooks/useLearningFiles'

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function PDFBatchLearner({ doctor, onComplete }) {
  const { files: learnedFiles, saveFiles } = useLearningFiles(doctor?.id)
  const [method, setMethod] = useState('paste')  // 'paste' | 'file'
  const [showLearned, setShowLearned] = useState(false)
  const [files, setFiles] = useState([])
  const [pasteDraft, setPasteDraft] = useState('')
  const [pastedTexts, setPastedTexts] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const ACCEPTED_EXTS = ['.pdf', '.txt', '.md', '.csv', '.docx']

  function isAccepted(file) {
    const name = file.name.toLowerCase()
    return ACCEPTED_EXTS.some(ext => name.endsWith(ext))
  }

  function handleFiles(newFiles) {
    const accepted = Array.from(newFiles).filter(isAccepted)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...accepted.filter(f => !existing.has(f.name))]
    })
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  function addPastedText() {
    const t = pasteDraft.trim()
    if (t.length < 30) return
    setPastedTexts(prev => [...prev, t])
    setPasteDraft('')
  }

  const totalCount = files.length + pastedTexts.length

  async function handleLearn() {
    if (totalCount === 0) return
    setProcessing(true)
    setError('')

    try {
      const kept = []  // { file, text }

      // 貼り付けテキスト（1貼り付け=1カルテ扱い）+ マスキング
      const today = new Date().toISOString().slice(0, 10)
      for (let i = 0; i < pastedTexts.length; i++) {
        const masked = maskPersonalInfo(pastedTexts[i])
        if (masked.trim().length > 30) {
          kept.push({
            file: { name: `貼り付け学習-${today}-${i + 1}.txt`, size: pastedTexts[i].length },
            text: masked,
          })
        }
      }

      // PDFからテキスト抽出 + マスキング（原文はfew-shot用に保持）
      if (files.length > 0) setProgress({ phase: 'pdf', current: 0, total: files.length })
      for (let i = 0; i < files.length; i++) {
        setProgress({ phase: 'pdf', current: i + 1, total: files.length })
        try {
          const raw = await extractTextFromFile(files[i], ({ current, total }) => {
            setProgress({ phase: 'pdf', current: i + 1, total: files.length, page: current, pages: total })
          })
          const masked = maskPersonalInfo(raw)
          if (masked.trim().length > 50) kept.push({ file: files[i], text: masked })
        } catch {
          // 読み取れないPDFはスキップ
        }
      }

      if (kept.length === 0) {
        setError('テキストを抽出できるファイル・貼り付け内容がありませんでした')
        setProcessing(false)
        return
      }

      // 区分（初診/再診）・主訴の自動タグ付け
      setProgress({ phase: 'classify', current: 0, total: kept.length })
      const tags = await classifyKarteBatch(kept.map(k => k.text))

      // AI分析（初診/再診を分けて学習）
      const items = kept.map((k, i) => ({ text: k.text, visit_type: tags[i]?.visit_type ?? '不明' }))
      const profile = await analyzePDFBatch(
        items,
        doctor.style_profile,
        ({ current, total, phase }) => {
          setProgress({ phase: phase === 'synthesize' ? 'synthesize' : 'analyze', current, total })
        }
      )

      onComplete(profile)
      // 原文＋タグを保存（生成時のfew-shotに使用）
      await saveFiles(doctor.id, kept.map((k, i) => ({
        file: k.file,
        content: k.text,
        visit_type: tags[i]?.visit_type ?? '不明',
        chief_complaint: tags[i]?.chief_complaint ?? '',
      })))
      // 二重学習防止のため入力をクリア
      setFiles([])
      setPastedTexts([])
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
      setProgress(null)
    }
  }

  const phaseLabel = progress
    ? progress.phase === 'pdf'
      ? progress.pages
        ? `PDF ${progress.current}/${progress.total} — OCR処理中 ${progress.page}/${progress.pages}ページ`
        : `PDF読み取り中 ${progress.current}/${progress.total}`
      : progress.phase === 'classify' ? 'カルテの区分（初診/再診）を判定中...'
      : progress.phase === 'analyze' ? `AI分析中 バッチ ${progress.current}/${progress.total}`
      : 'スタイルプロファイル生成中...'
    : ''

  const progressPct = progress
    ? progress.phase === 'pdf' ? (progress.current / progress.total) * 30
    : progress.phase === 'classify' ? 35
    : progress.phase === 'analyze' ? 40 + (progress.current / progress.total) * 50
    : 95
    : 0

  const tabBtn = (key, label) => (
    <button
      key={key}
      type="button"
      onClick={() => setMethod(key)}
      style={{
        flex: 1, padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        background: method === key ? 'var(--surface)' : 'transparent',
        color: method === key ? 'var(--primary)' : 'var(--text-muted)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      {/* 学習方法タブ */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
        {tabBtn('paste', <><ClipboardList size={14} /> 貼り付けて学習</>)}
        {tabBtn('file', <><Upload size={14} /> ファイルから学習</>)}
      </div>

      {/* 貼り付けて学習 */}
      {method === 'paste' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ClipboardList size={14} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>電子カルテから本文をコピーして貼り付け（1回＝1件）</span>
          </div>
          <textarea
            value={pasteDraft}
            onChange={e => setPasteDraft(e.target.value)}
            placeholder="カルテ本文をここに貼り付け（患者名・IDは自動マスキングされます）"
            rows={4}
            style={{ width: '100%', fontSize: 13, lineHeight: 1.6, resize: 'vertical', marginBottom: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={addPastedText} disabled={pasteDraft.trim().length < 30}>
              ＋ リストに追加
            </button>
          </div>
          {pastedTexts.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pastedTexts.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    #{i + 1} {t.slice(0, 26)}…（{t.length}字）
                  </span>
                  <button type="button" onClick={() => setPastedTexts(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ファイルから学習 */}
      {method === 'file' && (
        <div style={{ marginBottom: 14 }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(16,185,129,0.08)' : 'var(--bg)', transition: 'all 0.15s',
            }}
          >
            <Upload size={28} color={dragOver ? 'var(--primary)' : 'var(--text-muted)'} style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>ファイルをドラッグ＆ドロップ</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF / TXT / MD / CSV / DOCX（複数可）</p>
            <input ref={inputRef} type="file" accept=".pdf,.txt,.md,.csv,.docx" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          </div>

          {files.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{files.length}件のファイル</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setFiles([])}>全てクリア</button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {files.map(f => (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      {f.name.endsWith('.csv') ? <FileSpreadsheet size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                        : f.name.endsWith('.docx') ? <FileType size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                        : <FileText size={13} color="var(--primary)" style={{ flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{f.name}</span>
                    </div>
                    <button type="button" onClick={() => removeFile(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* プログレスバー */}
      {processing && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>{phaseLabel}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--primary)', borderRadius: 999, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>※ 個人情報は自動マスキング後にAIへ送信されます</p>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      <button
        className="btn btn-primary"
        type="button"
        onClick={handleLearn}
        disabled={processing || totalCount === 0}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Brain size={15} />
        {processing ? '学習中...' : totalCount === 0 ? 'カルテを追加してください' : `${totalCount}件から学習する`}
      </button>

      {/* 学習済み一覧（折りたたみ・デフォルト閉じる） */}
      {learnedFiles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={() => setShowLearned(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, padding: 0 }}>
            {showLearned ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Clock size={12} /> 学習済み（{learnedFiles.length}件）
          </button>
          {showLearned && (
            <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {learnedFiles.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <FileText size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{f.filename}</span>
                    {f.visit_type && f.visit_type !== '不明' && <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 11 }}>{f.visit_type}</span>}
                  </div>
                  <span style={{ color: 'var(--text-faint)', flexShrink: 0, marginLeft: 8 }}>{formatDate(f.learned_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
