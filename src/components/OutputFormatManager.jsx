import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'

const DEFAULT_SECTIONS = [
  { id: 'chief_complaint', label: '主訴', enabled: true },
  { id: 'present_illness', label: '現病歴', enabled: true },
  { id: 'medical_history', label: '既往歴', enabled: true },
  { id: 'findings', label: '所見', enabled: true },
  { id: 'diagnosis', label: '診断', enabled: true },
  { id: 'prescription', label: '処方/指示', enabled: true },
]

const LENGTH_OPTIONS = [
  { value: 'brief', label: '簡潔', desc: '各セクション1〜2文' },
  { value: 'standard', label: '標準', desc: '各セクション3〜4文' },
  { value: 'detailed', label: '詳しく', desc: '各セクション詳細に記載' },
]

export default function OutputFormatManager({ doctor, onUpdate }) {
  const saved = doctor?.output_format
  const [sections, setSections] = useState(
    saved?.sections ?? DEFAULT_SECTIONS
  )
  const [length, setLength] = useState(saved?.length ?? 'standard')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const s = doctor?.output_format
    setSections(s?.sections ?? DEFAULT_SECTIONS)
    setLength(s?.length ?? 'standard')
    setMsg('')
  }, [doctor?.id])

  function toggleSection(id) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      await onUpdate(doctor.id, { sections, length })
      setMsg('✓ 保存しました')
    } catch (e) {
      setMsg(`エラー: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        AIが生成するカルテに含めるセクションと文章の長さを設定します。次回のカルテ生成から反映されます。
      </p>

      {/* セクション選択 */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>含めるセクション</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sections.map(s => (
            <label key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '10px 14px', borderRadius: 8, border: '1px solid',
              borderColor: s.enabled ? 'rgba(16,185,129,0.4)' : 'var(--border)',
              background: s.enabled ? 'rgba(16,185,129,0.06)' : 'var(--bg)',
              transition: 'all 0.15s',
            }}>
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={() => toggleSection(s.id)}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: s.enabled ? 'var(--text)' : 'var(--text-faint)' }}>
                {s.label}
              </span>
              {!s.enabled && (
                <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto' }}>省略</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* 文章の長さ */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>文章の長さ</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {LENGTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLength(opt.value)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8, border: '1px solid', cursor: 'pointer',
                borderColor: length === opt.value ? 'var(--primary)' : 'var(--border)',
                background: length === opt.value ? 'rgba(16,185,129,0.12)' : 'var(--bg)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: length === opt.value ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 2 }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p style={{ fontSize: 13, color: msg.startsWith('エラー') ? 'var(--danger)' : 'var(--primary)', marginBottom: 10 }}>
          {msg}
        </p>
      )}

      <button
        className="btn btn-primary"
        type="button"
        onClick={handleSave}
        disabled={saving}
      >
        <Save size={15} />
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}
