import { useState } from 'react'
import { Plus, Trash2, Brain, ArrowLeft, Star, Check, RotateCcw, Pencil, X, ChevronDown, ChevronRight, BookText, LayoutTemplate, Settings, BarChart3 } from 'lucide-react'
import { useDoctors } from '../hooks/useDoctors'
import PDFBatchLearner from '../components/PDFBatchLearner'
import PhrasesManager from '../components/PhrasesManager'
import TemplatesManager from '../components/TemplatesManager'
import ConsultationHistory from '../components/ConsultationHistory'
import OutputFormatManager from '../components/OutputFormatManager'
import ThemeToggle from '../components/ThemeToggle'

export default function AdminPage({ onBack }) {
  const { doctors, loading, createDoctor, updateDoctor, updateStyleProfile, updateOutputFormat, setActiveProfile, toggleSaveProfile, deleteProfileVersion, deleteDoctor } = useDoctors()

  const [newName, setNewName] = useState('')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [newRole, setNewRole] = useState('doctor')
  const [adding, setAdding] = useState(false)

  const [editingDoctorId, setEditingDoctorId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSpecialty, setEditSpecialty] = useState('')
  const [editRole, setEditRole] = useState('doctor')
  const [editSaving, setEditSaving] = useState(false)

  function startEdit(d) {
    setEditingDoctorId(d.id)
    setEditName(d.name)
    setEditSpecialty(d.specialty ?? '')
    setEditRole(d.role ?? 'doctor')
  }

  function cancelEdit() {
    setEditingDoctorId(null)
  }

  async function handleEdit(doctorId) {
    if (!editName.trim()) return
    setEditSaving(true)
    try {
      await updateDoctor(doctorId, { name: editName.trim(), specialty: editSpecialty.trim(), role: editRole })
      setEditingDoctorId(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [doctorTab, setDoctorTab] = useState('learn')  // 'learn' | 'phrases' | 'templates'
  const [analyzeMsg, setAnalyzeMsg] = useState('')
  const [showFullProfile, setShowFullProfile] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await createDoctor({ name: newName.trim(), specialty: newSpecialty.trim(), role: newRole })
      setNewName('')
      setNewSpecialty('')
      setNewRole('doctor')
    } catch (e) {
      alert(e.message)
    } finally {
      setAdding(false)
    }
  }

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={onBack}>
          <ArrowLeft size={14} /> 戻る
        </button>
        <span style={{ fontWeight: 700 }}>管理画面</span>
        <div style={{ marginLeft: 'auto' }}><ThemeToggle /></div>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>

        {/* 医師追加 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>医師を登録する</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>氏名</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="例: 山田 太郎" autoComplete="off" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>専門科</label>
              <input type="text" value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} placeholder="例: 整形外科" autoComplete="off" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>役割</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="doctor">医師</option>
                <option value="pt">PT（理学療法士）</option>
              </select>
            </div>
            <button className="btn btn-primary" type="button" onClick={handleAdd} disabled={adding || !newName.trim()}>
              <Plus size={15} /> 追加
            </button>
          </div>
        </div>

        {/* 医師一覧 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>登録済み医師</h2>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
          ) : doctors.length === 0 ? (
            <p style={{ color: 'var(--text-faint)', textAlign: 'center', padding: 24 }}>医師が登録されていません</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {doctors.map(d => (
                <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
                  {editingDoctorId === d.id ? (
                    <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text" value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder="氏名" autoComplete="off"
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                      />
                      <input
                        type="text" value={editSpecialty} onChange={e => setEditSpecialty(e.target.value)}
                        placeholder="専門科" autoComplete="off"
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                      />
                      <select value={editRole} onChange={e => setEditRole(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                        <option value="doctor">医師</option>
                        <option value="pt">PT（理学療法士）</option>
                      </select>
                      <button className="btn btn-primary btn-sm" type="button"
                        onClick={() => handleEdit(d.id)} disabled={editSaving || !editName.trim()}>
                        <Check size={13} /> {editSaving ? '...' : '保存'}
                      </button>
                      <button className="btn btn-outline btn-sm" type="button" onClick={cancelEdit}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{d.name}</span>
                        {d.specialty && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{d.specialty}</span>}
                        {d.role === 'pt' && (
                          <span style={{ marginLeft: 6, fontSize: 11, background: 'rgba(16,185,129,0.08)', color: 'var(--primary)', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 6px', borderRadius: 4 }}>PT</span>
                        )}
                        <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: d.style_profile ? 'var(--primary)' : 'var(--amber)' }}>
                          {d.style_profile ? '✓ スタイル学習済み' : '⚠ 未学習'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => startEdit(d)}
                          style={{ color: 'var(--text-muted)', borderColor: 'rgba(139,148,158,0.3)' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => setSelectedDoctorId(selectedDoctorId === d.id ? null : d.id)}
                          style={{ color: 'var(--primary)', borderColor: 'rgba(16,185,129,0.3)' }}
                        >
                          <Brain size={13} /> スタイル学習
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => { if (window.confirm(`${d.name}を削除しますか？`)) deleteDoctor(d.id) }}
                          style={{ color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.3)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 医師詳細パネル */}
        {selectedDoctor && (
          <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>
                {selectedDoctor.name} の設定
              {selectedDoctor.role === 'pt' && (
                <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(16,185,129,0.08)', color: 'var(--primary)', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: 4 }}>PT</span>
              )}
              </h2>
            </div>

            {/* 医師タブ */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface2)', borderRadius: 8, padding: 4 }}>
              {[
                { key: 'learn', icon: <Brain size={14} />, label: selectedDoctor.role === 'pt' ? 'リハスタイル学習' : '医師スタイル学習' },
                { key: 'phrases', icon: <BookText size={14} />, label: '略語辞書' },
                { key: 'templates', icon: <LayoutTemplate size={14} />, label: 'テンプレート' },
                { key: 'format', icon: <Settings size={14} />, label: '出力フォーマット' },
                { key: 'history', icon: <BarChart3 size={14} />, label: '生成ログ' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDoctorTab(t.key)}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    background: doctorTab === t.key ? 'var(--surface)' : 'transparent',
                    color: doctorTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: doctorTab === t.key ? 'var(--shadow)' : 'none',
                  }}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* スタイル学習タブ */}
            {doctorTab === 'learn' && (
              <div>
                {/* 現在のプロファイル（折りたたみ） */}
                {selectedDoctor.style_profile && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}>
                    <button type="button" onClick={() => setShowFullProfile(s => !s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, fontWeight: 600, padding: 0, marginBottom: showFullProfile ? 6 : 0 }}>
                      {showFullProfile ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      現在のスタイルプロファイル（学習済み）
                    </button>
                    {showFullProfile
                      ? <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{selectedDoctor.style_profile}</p>
                      : <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{selectedDoctor.style_profile}</p>}
                  </div>
                )}

                {/* プロファイル履歴（折りたたみ・デフォルト閉じる） */}
                {Array.isArray(selectedDoctor.style_profile_history) && selectedDoctor.style_profile_history.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <button type="button" onClick={() => setShowHistory(s => !s)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, padding: 0, marginBottom: showHistory ? 8 : 0 }}>
                      {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      学習履歴（{selectedDoctor.style_profile_history.length}件 / 保存は★5件まで）
                    </button>
                    {showHistory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedDoctor.style_profile_history.map((v, i) => (
                        <div key={v.id} style={{
                          padding: '8px 12px', background: i === 0 ? 'rgba(16,185,129,0.08)' : 'var(--bg)',
                          border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 8,
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              {i === 0 && <span style={{ fontSize: 10, background: 'var(--primary)', color: 'var(--surface)', padding: '1px 6px', borderRadius: 10 }}>最新</span>}
                              {v.saved && <span style={{ fontSize: 10, background: 'var(--amber)', color: 'var(--surface)', padding: '1px 6px', borderRadius: 10 }}>★ 保存済</span>}
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.label}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {v.profile?.slice(0, 80)}...
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button type="button" title={v.saved ? '保存解除' : '保存（★）'}
                              onClick={async () => { try { await toggleSaveProfile(selectedDoctor.id, v.id) } catch (e) { alert(e.message) } }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: v.saved ? 'var(--amber)' : 'var(--text-faint)', padding: 2 }}>
                              <Star size={13} fill={v.saved ? 'var(--amber)' : 'none'} />
                            </button>
                            <button type="button" title="このバージョンを使用"
                              onClick={async () => { await setActiveProfile(selectedDoctor.id, v.id); alert('プロファイルを切り替えました') }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 2 }}>
                              <RotateCcw size={13} />
                            </button>
                            <button type="button" title="削除"
                              onClick={async () => { if (confirm('このバージョンを削除しますか？')) await deleteProfileVersion(selectedDoctor.id, v.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 2 }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                )}

                {analyzeMsg && (
                  <p style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={14} /> {analyzeMsg}
                  </p>
                )}

                <PDFBatchLearner
                  doctor={selectedDoctor}
                  onComplete={async (profile) => {
                    await updateStyleProfile(selectedDoctor.id, profile)
                    setAnalyzeMsg('スタイルプロファイルを更新しました')
                    setShowFullProfile(true)
                  }}
                />
              </div>
            )}

            {/* 略語辞書タブ */}
            {doctorTab === 'phrases' && (
              <PhrasesManager doctorId={selectedDoctor.id} />
            )}

            {/* テンプレートタブ */}
            {doctorTab === 'templates' && (
              <TemplatesManager doctorId={selectedDoctor.id} />
            )}

            {/* 出力フォーマットタブ */}
            {doctorTab === 'format' && (
              <OutputFormatManager doctor={selectedDoctor} onUpdate={updateOutputFormat} />
            )}

            {/* 生成ログ・再学習タブ */}
            {doctorTab === 'history' && (
              <ConsultationHistory
                doctor={selectedDoctor}
                onProfileUpdated={async (profile) => {
                  await updateStyleProfile(selectedDoctor.id, profile)
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
