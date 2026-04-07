import { useState, useRef } from 'react'
import { Plus, Trash2, Sparkles, FileText, X } from 'lucide-react'
import { useTemplates } from '../hooks/useTemplates'
import { extractTextFromPDF, maskPersonalInfo } from '../lib/pdfExtractor'
import { extractTemplatesFromPDFs } from '../lib/claude'
import { supabase } from '../lib/supabase'

const AGE_GROUPS = ['', '10代', '20代', '30代', '40代', '50代', '60代', '70代', '80代以上']
const GENDERS = ['問わず', '男性', '女性']

export default function TemplatesManager({ doctorId }) {
  const { templates, loading, addTemplate, deleteTemplate, refresh } = useTemplates(doctorId)

  // 手動追加
  const [symptom, setSymptom] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [gender, setGender] = useState('問わず')
  const [templateText, setTemplateText] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // PDF一括抽出
  const [files, setFiles] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(null)
  const [extractMsg, setExtractMsg] = useState('')
  const inputRef = useRef(null)

  async function handleAdd() {
    if (!symptom.trim() || !templateText.trim()) return
    setAdding(true)
    try {
      await addTemplate({ symptom: symptom.trim(), age_group: ageGroup, gender, template_text: templateText.trim() })
      setSymptom(''); setTemplateText(''); setAgeGroup(''); setGender('問わず')
      setShowAddForm(false)
    } catch (e) { alert(e.message) }
    finally { setAdding(false) }
  }

  async function handleExtractFromPDF() {
    if (files.length === 0) return
    setExtracting(true)
    setExtractMsg('')
    try {
      // PDF読み取り
      const texts = []
      for (const file of files) {
        try {
          const raw = await extractTextFromPDF(file)
          const masked = maskPersonalInfo(raw)
          if (masked.trim().length > 50) texts.push(masked)
        } catch {}
      }
      if (texts.length === 0) { setExtractMsg('テキストを抽出できるPDFがありませんでした'); return }

      // テンプレート抽出
      const extracted = await extractTemplatesFromPDFs(texts, ({ current, total }) => {
        setExtractProgress({ current, total })
      })

      // Supabaseに保存
      if (extracted.length > 0) {
        const records = extracted.map(t => ({
          doctor_id: doctorId,
          symptom: t.symptom || '不明',
          age_group: t.age_group || '',
          gender: t.gender || '問わず',
          template_text: t.template_text || '',
        })).filter(r => r.template_text.length > 0)

        await supabase.from('templates').insert(records)
        await refresh()
        setExtractMsg(`✓ ${records.length}件のテンプレートを自動生成しました`)
        setFiles([])
      } else {
        setExtractMsg('テンプレートを抽出できませんでした')
      }
    } catch (e) {
      setExtractMsg('エラー: ' + e.message)
    } finally {
      setExtracting(false)
      setExtractProgress(null)
    }
  }

  return (
    <div>
      {/* PDF一括抽出 */}
      <div style={{ marginBottom: 20, padding: 16, background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 8 }}>
          <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          PDFから症状別テンプレートを自動生成
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={() => inputRef.current?.click()}>
            <FileText size={13} /> PDFを選択
          </button>
          <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={e => setFiles(Array.from(e.target.files))} />
          {files.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: '#64748b' }}>{files.length}件選択中</span>
              <button type="button" onClick={() => setFiles([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={13} /></button>
            </>
          )}
          <button className="btn btn-primary btn-sm" type="button" onClick={handleExtractFromPDF}
            disabled={extracting || files.length === 0}>
            <Sparkles size={13} /> {extracting ? '抽出中...' : '自動生成'}
          </button>
        </div>
        {extractProgress && (
          <div style={{ fontSize: 12, color: '#1d4ed8' }}>
            バッチ {extractProgress.current}/{extractProgress.total} 処理中...
          </div>
        )}
        {extractMsg && <p style={{ fontSize: 12, color: extractMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{extractMsg}</p>}
      </div>

      {/* 手動追加 */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => setShowAddForm(v => !v)}>
          <Plus size={13} /> 手動で追加
        </button>
      </div>

      {showAddForm && (
        <div style={{ marginBottom: 16, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>症状キーワード</label>
              <input type="text" value={symptom} onChange={e => setSymptom(e.target.value)} placeholder="例: 膝関節痛" autoComplete="off" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>年齢層</label>
              <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}>
                {AGE_GROUPS.map(a => <option key={a} value={a}>{a || '指定なし'}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>性別</label>
              <select value={gender} onChange={e => setGender(e.target.value)}>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>テンプレート本文</label>
            <textarea value={templateText} onChange={e => setTemplateText(e.target.value)} rows={4}
              placeholder="例: 右膝関節痛にて来院。ROM制限なし。関節裂隙に圧痛あり。X-P上、関節裂隙狭小化あり。..."
              style={{ resize: 'vertical', fontSize: 12 }} autoComplete="off" />
          </div>
          <button className="btn btn-primary btn-sm" type="button" onClick={handleAdd}
            disabled={adding || !symptom.trim() || !templateText.trim()}>
            <Plus size={13} /> 追加する
          </button>
        </div>
      )}

      {/* テンプレート一覧 */}
      {loading ? <p style={{ color: '#94a3b8', fontSize: 13 }}>読み込み中...</p>
      : templates.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>テンプレートがまだありません</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 }}>{t.symptom}</span>
                  {t.age_group && <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{t.age_group}</span>}
                  {t.gender && t.gender !== '問わず' && <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{t.gender}</span>}
                </div>
                <button type="button" onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {t.template_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
