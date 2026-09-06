import { useState } from 'react'
import { Check, X, Pencil, Trash2, Brain, RefreshCw, Copy, Clock } from 'lucide-react'
import { useConsultations } from '../hooks/useConsultations'
import { analyzeStyle } from '../lib/claude'

function timeUntilExpiry(expiresAt) {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '期限切れ'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `あと${h}時間${m}分で自動削除` : `あと${m}分で自動削除`
}

export default function ConsultationHistory({ doctor, onProfileUpdated }) {
  const { consultations, loading, approveConsultation, saveCorrection, deleteConsultation, getApprovedSamples } = useConsultations(doctor.id)

  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [relearning, setRelearning] = useState(false)
  const [relearningMsg, setRelearningMsg] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  async function handleCopy(c) {
    await navigator.clipboard.writeText(c.corrected_karte || c.generated_karte || '')
    setCopiedId(c.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditText(c.corrected_karte || c.generated_karte || '')
  }

  async function handleSaveEdit(id) {
    await saveCorrection(id, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  async function handleRelearn() {
    const samples = getApprovedSamples()
    if (samples.length === 0) { setRelearningMsg('承認済みのカルテがありません'); return }
    setRelearning(true)
    setRelearningMsg('')
    try {
      const profile = await analyzeStyle(samples)
      await onProfileUpdated(profile)
      setRelearningMsg(`✓ ${samples.length}件のカルテから再学習しました`)
    } catch (e) {
      setRelearningMsg('エラー: ' + e.message)
    } finally {
      setRelearning(false)
    }
  }

  const approvedCount = consultations.filter(c => c.is_approved).length

  if (loading) return <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>読み込み中...</p>

  return (
    <div>
      {/* 再学習パネル */}
      <div style={{ marginBottom: 20, padding: 14, background: 'var(--accent-weak)', border: '1px solid var(--accent-line)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>
              <Brain size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              承認済みカルテから再学習
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ✓ マークしたカルテ {approvedCount}件 が再学習に使われます
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={handleRelearn}
            disabled={relearning || approvedCount === 0}
          >
            <RefreshCw size={13} />
            {relearning ? '学習中...' : '再学習する'}
          </button>
        </div>
        {relearningMsg && (
          <p style={{ fontSize: 12, marginTop: 8, color: relearningMsg.startsWith('✓') ? 'var(--primary)' : 'var(--danger)' }}>
            {relearningMsg}
          </p>
        )}
      </div>

      {/* ログ一覧 */}
      {consultations.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: 24 }}>
          生成ログがまだありません
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {consultations.map(c => (
            <div
              key={c.id}
              style={{
                padding: '12px 14px',
                background: 'var(--surface)',
                border: `1px solid ${c.is_approved ? 'var(--accent-weak)' : 'var(--border)'}`,
                borderRadius: 8,
                borderLeft: `3px solid ${c.is_approved ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {/* ヘッダー */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    {new Date(c.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {c.patient_label && (
                    <span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--text)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, border: '1px solid var(--border)' }}>
                      {c.patient_label}
                    </span>
                  )}
                  {c.chief_complaint && (
                    <span style={{ fontSize: 11, background: 'var(--accent-weak)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                      {c.chief_complaint}
                    </span>
                  )}
                  {c.patient_age && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.patient_age}歳 / {c.patient_gender}</span>
                  )}
                  {c.is_approved && (
                    <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>✓ 承認済み</span>
                  )}
                  {c.corrected_karte && (
                    <span style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 600 }}>✎ 修正あり</span>
                  )}
                  {timeUntilExpiry(c.expires_at) && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Clock size={10} /> {timeUntilExpiry(c.expires_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    title="コピー"
                    onClick={() => handleCopy(c)}
                    style={{ background: copiedId === c.id ? 'var(--accent-weak)' : 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: copiedId === c.id ? 'var(--primary)' : 'var(--text-muted)' }}
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    type="button"
                    title={c.is_approved ? '承認取り消し' : '承認する'}
                    onClick={() => approveConsultation(c.id, !c.is_approved)}
                    style={{
                      background: c.is_approved ? 'var(--accent-weak)' : 'none',
                      border: `1px solid ${c.is_approved ? 'var(--accent-line)' : 'var(--border)'}`,
                      borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: c.is_approved ? 'var(--primary)' : 'var(--text-faint)',
                    }}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    title="修正・編集"
                    onClick={() => editingId === c.id ? setEditingId(null) : startEdit(c)}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: 'var(--text-muted)' }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    title="削除"
                    onClick={() => { if (window.confirm('このログを削除しますか？')) deleteConsultation(c.id) }}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '3px 6px', color: 'var(--border)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* カルテ本文 or 編集フォーム */}
              {editingId === c.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={6}
                    style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', marginBottom: 8 }}
                    autoComplete="off"
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => handleSaveEdit(c.id)}>
                      <Check size={12} /> 保存して承認
                    </button>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditingId(null)}>
                      <X size={12} /> キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                  {c.corrected_karte || c.generated_karte}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
