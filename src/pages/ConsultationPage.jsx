import { useState, useRef } from 'react'
import { Mic, MicOff, Sparkles, Copy, Check, RotateCcw, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { usePhrases } from '../hooks/usePhrases'
import { useTemplates } from '../hooks/useTemplates'
import { generateKarte } from '../lib/claude'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'

const GENDERS = ['男性', '女性', 'その他']

function ConsultationInner() {
  const { doctor, logout } = useAuth()
  const { isRecording, transcript, interimText, recError, start, stop, reset, setTranscript } = useVoiceRecorder()
  const { phrases, applyPhrasesToTranscript } = usePhrases(doctor?.id)
  const { findMatching, incrementUseCount } = useTemplates(doctor?.id)

  const [age, setAge] = useState('')
  const [gender, setGender] = useState(GENDERS[0])
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [mondsin, setMondsin] = useState('')
  const [generatedKarte, setGeneratedKarte] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [matchedTemplate, setMatchedTemplate] = useState(null)

  const karteRef = useRef(null)

  async function handleGenerate(useTemplateOnly = false, useMondsin = false) {
    if (!useTemplateOnly && !useMondsin && !transcript.trim()) { setError('診察の音声・テキストがありません'); return }
    if (useMondsin && !mondsin.trim()) { setError('問診内容を入力してください'); return }
    if (!useMondsin && !chiefComplaint.trim()) { setError('主訴を入力してください'); return }
    setGenerating(true)
    setGeneratedKarte('')
    setError('')

    // テンプレートマッチング
    const matched = findMatching(chiefComplaint, age, gender)
    const template = matched[0] || null
    setMatchedTemplate(template)
    if (template) incrementUseCount(template.id)

    const sourceTranscript = useMondsin ? mondsin : transcript

    let finalKarte = ''
    try {
      await generateKarte({
        transcript: sourceTranscript,
        patientInfo: { age, gender, chiefComplaint },
        styleProfile: doctor.style_profile,
        phrases,
        template: template?.template_text ?? null,
        onChunk: (text) => {
          finalKarte += text
          setGeneratedKarte(prev => prev + text)
        },
        onDone: async () => {
          setGenerating(false)
          // 履歴保存
          try {
            await supabase.from('consultations').insert({
              doctor_id: doctor.id,
              patient_age: age ? parseInt(age) : null,
              patient_gender: gender,
              chief_complaint: chiefComplaint,
              transcript: sourceTranscript,
              generated_karte: finalKarte,
            })
          } catch {}
        },
      })
    } catch (e) {
      setError(e.message)
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!generatedKarte) return
    await navigator.clipboard.writeText(generatedKarte)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    reset()
    setGeneratedKarte('')
    setAge('')
    setGender(GENDERS[0])
    setChiefComplaint('')
    setMondsin('')
    setError('')
    setMatchedTemplate(null)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* ヘッダー */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏥</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>カルテAI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{doctor.name} 先生</span>
          <button className="btn btn-outline btn-sm" type="button" onClick={logout}>
            <LogOut size={13} /> 変更
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 20, maxWidth: 1200, margin: '0 auto', width: '100%' }}>

        {/* 左カラム：入力 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 患者情報 */}
          <div className="card">
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: '#1e293b' }}>患者情報</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>年齢</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="例: 45" min="0" max="120" autoComplete="off" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>性別</label>
                <select value={gender} onChange={e => setGender(e.target.value)}>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>主訴</label>
              <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="例: 右膝の痛み、2週間前から" autoComplete="off" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>問診内容（任意）</label>
              <textarea
                value={mondsin}
                onChange={e => setMondsin(e.target.value)}
                placeholder="問診票や問診の内容をここに貼り付けてください"
                style={{ minHeight: 100, resize: 'vertical', fontSize: 13, lineHeight: 1.7 }}
                autoComplete="off"
              />
            </div>
          </div>

          {/* 録音 */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>診察録音</h2>
              {isRecording && (
                <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="recording-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                  録音中
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {!isRecording ? (
                <button className="btn btn-danger" type="button" onClick={start} style={{ flex: 1, justifyContent: 'center' }}>
                  <Mic size={16} /> 録音開始
                </button>
              ) : (
                <button className="btn btn-outline" type="button" onClick={() => { stop(); setTranscript(prev => applyPhrasesToTranscript(prev)) }} style={{ flex: 1, justifyContent: 'center' }}>
                  <MicOff size={16} /> 録音停止
                </button>
              )}
              <button className="btn btn-outline btn-sm" type="button" onClick={handleReset} title="リセット">
                <RotateCcw size={14} />
              </button>
            </div>

            {recError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{recError}</p>}

            {/* 書き起こし表示 */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, minHeight: 160, maxHeight: 300, overflowY: 'auto', fontSize: 13, lineHeight: 1.7 }}>
              {transcript || interimText ? (
                <>
                  <span style={{ color: '#1e293b' }}>{transcript}</span>
                  {interimText && <span style={{ color: '#94a3b8' }}>{interimText}</span>}
                </>
              ) : (
                <span style={{ color: '#94a3b8' }}>録音開始すると、ここにリアルタイムで文字起こしが表示されます</span>
              )}
            </div>
          </div>

          {/* 生成ボタン */}
          {matchedTemplate && (
            <p style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px' }}>
              📋 テンプレート適用中: {matchedTemplate.symptom}{matchedTemplate.age_group && ` / ${matchedTemplate.age_group}`}
            </p>
          )}
          {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 問診からカルテ生成 */}
            {mondsin.trim() && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => handleGenerate(false, true)}
                disabled={generating}
                style={{ justifyContent: 'center', padding: '12px', fontSize: 15 }}
              >
                <Sparkles size={17} />
                {generating ? 'カルテ生成中...' : '問診からカルテを生成'}
              </button>
            )}

            {/* テンプレートから即生成（録音・問診なし） */}
            {chiefComplaint.trim() && !transcript.trim() && !mondsin.trim() && (
              <button
                className="btn btn-success"
                type="button"
                onClick={() => handleGenerate(true)}
                disabled={generating}
                style={{ justifyContent: 'center', padding: '12px', fontSize: 15 }}
              >
                <Sparkles size={17} />
                {generating ? 'カルテ生成中...' : 'テンプレートから生成'}
              </button>
            )}

            {/* 録音ありの通常生成 */}
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => handleGenerate(false)}
              disabled={generating || !transcript.trim()}
              style={{ justifyContent: 'center', padding: '12px', fontSize: 15 }}
            >
              <Sparkles size={17} />
              {generating ? 'カルテ生成中...' : '録音からカルテを生成'}
            </button>
          </div>
        </div>

        {/* 右カラム：生成結果 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>生成されたカルテ</h2>
              <button
                className="btn btn-outline btn-sm"
                type="button"
                onClick={handleCopy}
                disabled={!generatedKarte}
              >
                {copied ? <><Check size={13} /> コピー済み</> : <><Copy size={13} /> コピー</>}
              </button>
            </div>

            <textarea
              ref={karteRef}
              value={generatedKarte}
              onChange={e => setGeneratedKarte(e.target.value)}
              placeholder={generating ? '生成中...' : '「カルテを生成する」ボタンを押すとここに表示されます'}
              style={{ flex: 1, minHeight: 400, resize: 'vertical', lineHeight: 1.8, fontSize: 14, background: generating ? '#fafafa' : '#fff' }}
              autoComplete="off"
            />

            {generatedKarte && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleCopy}
                  style={{ fontSize: 15, padding: '10px 24px' }}
                >
                  {copied ? <><Check size={15} /> コピー済み</> : <><Copy size={15} /> コピーしてウィーメックスへ</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConsultationPage() {
  return (
    <ErrorBoundary>
      <ConsultationInner />
    </ErrorBoundary>
  )
}
