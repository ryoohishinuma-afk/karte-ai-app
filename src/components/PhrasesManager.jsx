import { useState, useRef } from 'react'
import { Plus, Trash2, Sparkles, FileText, X, Check } from 'lucide-react'
import { usePhrases, PHRASE_CATEGORIES } from '../hooks/usePhrases'
import { extractTextFromPDF, maskPersonalInfo } from '../lib/pdfExtractor'
import { extractMedicalTermsFromPDFs } from '../lib/claude'

export default function PhrasesManager({ doctorId }) {
  const { phrases, loading, addPhrase, addPhrasesBulk, deletePhrase } = usePhrases(doctorId)

  // 手動追加
  const [trigger, setTrigger] = useState('')
  const [reading, setReading] = useState('')
  const [expansion, setExpansion] = useState('')
  const [category, setCategory] = useState('所見')
  const [adding, setAdding] = useState(false)

  // PDF一括抽出
  const [files, setFiles] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(null)
  const [extractMsg, setExtractMsg] = useState('')
  const [extracted, setExtracted] = useState([])   // 抽出結果（確認用）
  const [selected, setSelected] = useState(new Set())
  const inputRef = useRef(null)

  async function handleAdd() {
    if (!trigger.trim() || !expansion.trim()) return
    setAdding(true)
    try {
      await addPhrase({ trigger: trigger.trim(), expansion: expansion.trim(), category, reading: reading.trim() })
      setTrigger(''); setExpansion(''); setReading('')
    } catch (e) { alert(e.message) }
    finally { setAdding(false) }
  }

  async function handleExtract() {
    if (files.length === 0) return
    setExtracting(true)
    setExtractMsg('')
    setExtracted([])
    setSelected(new Set())
    try {
      const texts = []
      for (const file of files) {
        try {
          const raw = await extractTextFromPDF(file)
          const masked = maskPersonalInfo(raw)
          if (masked.trim().length > 50) texts.push(masked)
        } catch {}
      }
      if (texts.length === 0) { setExtractMsg('テキストを抽出できるPDFがありませんでした'); return }

      const terms = await extractMedicalTermsFromPDFs(texts, ({ current, total }) => {
        setExtractProgress({ current, total })
      })

      // すでに登録済みのtriggerを除外
      const existingTriggers = new Set(phrases.map(p => p.trigger))
      const newTerms = terms.filter(t => !existingTriggers.has(t.trigger))

      if (newTerms.length === 0) {
        setExtractMsg('新しい用語は見つかりませんでした（すべて登録済み）')
      } else {
        setExtracted(newTerms)
        setSelected(new Set(newTerms.map((_, i) => i)))
        setExtractMsg(`${newTerms.length}件の医療用語が見つかりました。登録するものを選択してください。`)
      }
      setFiles([])
    } catch (e) {
      setExtractMsg('エラー: ' + e.message)
    } finally {
      setExtracting(false)
      setExtractProgress(null)
    }
  }

  async function handleBulkAdd() {
    const items = extracted.filter((_, i) => selected.has(i))
    if (items.length === 0) return
    try {
      await addPhrasesBulk(items)
      setExtractMsg(`✓ ${items.length}件を登録しました`)
      setExtracted([])
      setSelected(new Set())
    } catch (e) {
      setExtractMsg('エラー: ' + e.message)
    }
  }

  function toggleSelect(i) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const grouped = PHRASE_CATEGORIES.reduce((acc, cat) => {
    const items = phrases.filter(p => p.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <div>
      {/* PDF一括抽出 */}
      <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
          <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          PDFから医療用語・略語を自動抽出
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => inputRef.current?.click()}>
            <FileText size={13} /> PDFを選択
          </button>
          <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={e => setFiles(Array.from(e.target.files))} />
          {files.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{files.length}件選択中</span>
              <button type="button" onClick={() => setFiles([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}><X size={13} /></button>
            </>
          )}
          <button className="btn btn-primary btn-sm" type="button" onClick={handleExtract}
            disabled={extracting || files.length === 0}>
            <Sparkles size={13} /> {extracting ? '抽出中...' : '用語を抽出'}
          </button>
        </div>
        {extractProgress && (
          <div style={{ fontSize: 12, color: 'var(--primary)' }}>
            バッチ {extractProgress.current}/{extractProgress.total} 処理中...
          </div>
        )}
        {extractMsg && (
          <p style={{ fontSize: 12, color: extractMsg.startsWith('✓') ? 'var(--primary)' : extractMsg.startsWith('エラー') ? 'var(--danger)' : 'var(--primary)', marginBottom: extracted.length > 0 ? 8 : 0 }}>
            {extractMsg}
          </p>
        )}

        {/* 抽出結果確認 */}
        {extracted.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" type="button"
                  onClick={() => setSelected(new Set(extracted.map((_, i) => i)))}>
                  全選択
                </button>
                <button className="btn btn-outline btn-sm" type="button"
                  onClick={() => setSelected(new Set())}>
                  全解除
                </button>
              </div>
              <button className="btn btn-primary btn-sm" type="button" onClick={handleBulkAdd}
                disabled={selected.size === 0}>
                <Check size={13} /> 選択した{selected.size}件を登録
              </button>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {extracted.map((t, i) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    background: selected.has(i) ? 'var(--accent-weak)' : 'var(--surface2)',
                    border: `1px solid ${selected.has(i) ? 'var(--border)' : 'var(--border)'}`,
                    borderRadius: 6, cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSelect(i)}
                    style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'var(--accent-weak)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{t.trigger}</span>
                  {t.reading && <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>({t.reading})</span>}
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>→ {t.expansion}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{t.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 手動追加フォーム */}
      <div style={{ marginBottom: 16, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>手動追加</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>略語・用語</label>
            <input type="text" value={trigger} onChange={e => setTrigger(e.target.value)} placeholder="例: ROM" autoComplete="off" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>読み仮名</label>
            <input type="text" value={reading} onChange={e => setReading(e.target.value)} placeholder="例: ろむ" autoComplete="off" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>展開テキスト</label>
            <input type="text" value={expansion} onChange={e => setExpansion(e.target.value)} placeholder="例: ROM制限なし、筋力低下なし" autoComplete="off" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>カテゴリ</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {PHRASE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" type="button" onClick={handleAdd} disabled={adding || !trigger.trim() || !expansion.trim()}>
            <Plus size={13} /> 追加
          </button>
        </div>
      </div>

      {/* 一覧 */}
      {loading ? <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>読み込み中...</p>
      : phrases.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: 20 }}>
          定型表現がまだ登録されていません
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 6, textTransform: 'uppercase' }}>{cat}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'var(--accent-weak)', padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>{p.trigger}</span>
                      {p.reading && <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>({p.reading})</span>}
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>→</span>
                      <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.expansion}</span>
                    </div>
                    <button type="button" onClick={() => deletePhrase(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)', flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
