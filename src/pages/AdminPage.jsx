import { useState } from 'react'
import { Plus, Trash2, Brain, ArrowLeft } from 'lucide-react'
import { useDoctors } from '../hooks/useDoctors'
import { analyzeStyle } from '../lib/claude'
import PDFBatchLearner from '../components/PDFBatchLearner'
import PhrasesManager from '../components/PhrasesManager'
import TemplatesManager from '../components/TemplatesManager'
import ConsultationHistory from '../components/ConsultationHistory'

export default function AdminPage({ onBack }) {
  const { doctors, loading, createDoctor, updateStyleProfile, deleteDoctor } = useDoctors()

  const [newName, setNewName] = useState('')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [adding, setAdding] = useState(false)

  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [doctorTab, setDoctorTab] = useState('learn')  // 'learn' | 'phrases' | 'templates'
  const [samples, setSamples] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('')
  const [learnTab, setLearnTab] = useState('pdf')  // 'pdf' | 'text'

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    try {
      await createDoctor({ name: newName.trim(), specialty: newSpecialty.trim() })
      setNewName('')
      setNewSpecialty('')
    } catch (e) {
      alert(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleAnalyze(doctor) {
    const texts = samples.split('\n---\n').map(s => s.trim()).filter(Boolean)
    if (texts.length === 0) { alert('カルテサンプルを入力してください（---で区切る）'); return }
    setAnalyzing(true)
    setAnalyzeMsg('')
    try {
      const profile = await analyzeStyle(texts)
      await updateStyleProfile(doctor.id, profile)
      setAnalyzeMsg('✓ スタイルプロファイルを保存しました')
      setSamples('')
      setSelectedDoctorId(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-outline btn-sm" type="button" onClick={onBack}>
          <ArrowLeft size={14} /> 戻る
        </button>
        <span style={{ fontWeight: 700 }}>管理画面</span>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>

        {/* 医師追加 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>医師を登録する</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>氏名</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="例: 山田 太郎" autoComplete="off" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>専門科</label>
              <input type="text" value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)} placeholder="例: 整形外科" autoComplete="off" />
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
            <p style={{ color: '#64748b' }}>読み込み中...</p>
          ) : doctors.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>医師が登録されていません</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {doctors.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{d.name}</span>
                    {d.specialty && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{d.specialty}</span>}
                    <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: d.style_profile ? '#16a34a' : '#f59e0b' }}>
                      {d.style_profile ? '✓ スタイル学習済み' : '⚠ 未学習'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => setSelectedDoctorId(selectedDoctorId === d.id ? null : d.id)}
                      style={{ color: '#1d4ed8', borderColor: '#bfdbfe' }}
                    >
                      <Brain size={13} /> スタイル学習
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => { if (window.confirm(`${d.name}を削除しますか？`)) deleteDoctor(d.id) }}
                      style={{ color: '#dc2626', borderColor: '#fecaca' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 医師詳細パネル */}
        {selectedDoctor && (
          <div className="card" style={{ borderColor: '#bfdbfe', background: '#f0f7ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>
                {selectedDoctor.name} の設定
              </h2>
            </div>

            {/* 医師タブ */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#e0f2fe', borderRadius: 8, padding: 4 }}>
              {[
                { key: 'learn', label: '🧠 スタイル学習' },
                { key: 'phrases', label: '📝 略語辞書' },
                { key: 'templates', label: '📋 テンプレート' },
                { key: 'history', label: '📊 生成ログ' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDoctorTab(t.key)}
                  style={{
                    flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontWeight: 600, fontSize: 12,
                    background: doctorTab === t.key ? '#fff' : 'transparent',
                    color: doctorTab === t.key ? '#1d4ed8' : '#64748b',
                    boxShadow: doctorTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* スタイル学習タブ */}
            {doctorTab === 'learn' && (
              <div>
                {selectedDoctor.style_profile && (
                  <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>現在のスタイルプロファイル：</p>
                    <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{selectedDoctor.style_profile}</p>
                  </div>
                )}

                {/* 学習方法タブ */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#dbeafe', borderRadius: 8, padding: 4 }}>
                  {[
                    { key: 'pdf', label: '📄 PDF一括学習' },
                    { key: 'text', label: '✏️ テキスト入力' },
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setLearnTab(t.key)}
                      style={{
                        flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: 13,
                        background: learnTab === t.key ? '#fff' : 'transparent',
                        color: learnTab === t.key ? '#1d4ed8' : '#64748b',
                        boxShadow: learnTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {learnTab === 'pdf' ? (
                  <PDFBatchLearner
                    doctor={selectedDoctor}
                    onComplete={async (profile) => {
                      await updateStyleProfile(selectedDoctor.id, profile)
                      setAnalyzeMsg('✓ スタイルプロファイルを更新しました')
                      setSelectedDoctorId(null)
                    }}
                  />
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                      カルテを貼り付けてください。複数ある場合は <code style={{ background: '#e0f2fe', padding: '1px 6px', borderRadius: 4 }}>---</code> で区切ってください。
                    </p>
                    <div className="form-group">
                      <textarea
                        value={samples}
                        onChange={e => setSamples(e.target.value)}
                        rows={10}
                        placeholder={`S: 右膝痛 2週間前から\nO: 右膝関節軽度腫脹...\n\n---\n\nS: 腰痛 1ヶ月前から...`}
                        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                        autoComplete="off"
                      />
                    </div>
                    {analyzeMsg && <p style={{ color: '#16a34a', fontSize: 13, marginBottom: 10 }}>{analyzeMsg}</p>}
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => handleAnalyze(selectedDoctor)}
                      disabled={analyzing || !samples.trim()}
                    >
                      <Brain size={15} />
                      {analyzing ? 'AIが分析中...' : 'スタイルを学習させる'}
                    </button>
                  </div>
                )}
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
