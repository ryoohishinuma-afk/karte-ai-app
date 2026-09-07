import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Sparkles, Copy, Check, RotateCcw, LogOut, Columns2, PanelLeft, Settings, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { usePhrases } from '../hooks/usePhrases'
import { useTemplates } from '../hooks/useTemplates'
import { useLayoutPreference } from '../hooks/useLayoutPreference'
import { generateKarte, correctFootClinicTranscript } from '../lib/claude'
import { fetchKarteExamples } from '../hooks/useLearningFiles'
import { useAppSettings } from '../hooks/useAppSettings'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'
import ThemeToggle from '../components/ThemeToggle'

const GENDERS = ['男性', '女性', 'その他']

function ConsultationInner({ onAdmin }) {
  const { doctor, logout } = useAuth()
  const { isRecording, transcript, interimText, recError, start, stop, reset, setTranscript } = useVoiceRecorder()
  const { phrases, applyPhrasesToTranscript } = usePhrases(doctor?.id)
  const { findMatching, incrementUseCount } = useTemplates(doctor?.id)
  const { layout, toggleLayout } = useLayoutPreference()
  const { retentionHours } = useAppSettings()

  const [age, setAge] = useState('')
  const [gender, setGender] = useState(GENDERS[0])
  const [visitType, setVisitType] = useState('初診')
  const VISIT_TYPES = ['初診', '再診']
  const [patientLabel, setPatientLabel] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [mondsin, setMondsin] = useState('')
  const [generatedKarte, setGeneratedKarte] = useState('')
  const [generating, setGenerating] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [matchedTemplate, setMatchedTemplate] = useState(null)
  const [consultationId, setConsultationId] = useState(null)
  const [segments, setSegments] = useState([])
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('karte-sessions') || '[]') } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem('karte-sessions', JSON.stringify(sessions)) } catch {}
  }, [sessions])

  const karteRef = useRef(null)

  function currentPatientInfo() {
    return { age, gender, visitType, chiefComplaint, mondsin, patientLabel }
  }

  function restorePatientInfo(info) {
    setAge(info.age)
    setGender(info.gender)
    setVisitType(info.visitType)
    setChiefComplaint(info.chiefComplaint)
    setMondsin(info.mondsin)
    setPatientLabel(info.patientLabel ?? '')
  }

  function makeLabel(info, segs) {
    if (info.patientLabel?.trim()) return info.patientLabel.trim()
    const parts = []
    if (info.age) parts.push(`${info.age}歳`)
    if (info.gender) parts.push(info.gender)
    if (info.chiefComplaint) parts.push(info.chiefComplaint)
    const base = parts.length ? parts.join(' ') : '患者'
    return segs.length > 0 ? `${base}（録音${segs.length}件保留）` : base
  }

  async function handleGenerate(useTemplateOnly = false) {
    const allSegments = [...segments, transcript].filter(s => s.trim())
    const hasRecording = allSegments.length > 0
    const hasMondsin = mondsin.trim().length > 0
    if (!useTemplateOnly && !hasRecording && !hasMondsin) {
      setError('録音または問診内容を入力してください'); return
    }
    setGenerating(true); setGeneratedKarte(''); setError(''); setConsultationId(null)
    const matched = findMatching(chiefComplaint, age, gender)
    const template = matched[0] || null
    setMatchedTemplate(template)
    if (template) incrementUseCount(template.id)
    const sourceTranscript = allSegments.join('\n\n')
    const sourceMondsin = visitType === '再診' ? '' : mondsin
    const prevKarte = visitType === '再診' ? mondsin : ''
    let finalKarte = ''
    try {
      // 医師の原文カルテ例を取得（同区分・近い主訴を優先。文体再現の最重要材料）
      let examples = []
      try {
        examples = await fetchKarteExamples(doctor.id, visitType, chiefComplaint)
      } catch {}
      await generateKarte({
        transcript: sourceTranscript, mondsin: sourceMondsin, prevKarte,
        patientInfo: { age, gender, chiefComplaint }, visitType,
        styleProfile: doctor.style_profile, phrases,
        template: template?.template_text ?? null,
        examples,
        outputFormat: doctor.output_format ?? null,
        onChunk: (text) => { finalKarte += text; setGeneratedKarte(prev => prev + text) },
        onDone: async () => {
          setGenerating(false)
          try {
            const expiresAt = new Date(Date.now() + retentionHours * 60 * 60 * 1000).toISOString()
            const { data } = await supabase.from('consultations').insert({
              doctor_id: doctor.id, patient_age: age ? parseInt(age) : null,
              patient_gender: gender, visit_type: visitType, chief_complaint: chiefComplaint,
              patient_label: patientLabel.trim() || null,
              transcript: [sourceTranscript, sourceMondsin].filter(Boolean).join('\n\n---問診---\n\n'),
              generated_karte: finalKarte,
              expires_at: expiresAt,
            }).select('id').single()
            if (data?.id) setConsultationId(data.id)
          } catch {}
        },
      })
    } catch (e) { setError(e.message); setGenerating(false) }
  }

  async function handleCopy() {
    if (!generatedKarte) return
    await navigator.clipboard.writeText(generatedKarte)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    // 医師の手直し後の最終版を保存（使いながら学習の教師データ）
    if (consultationId) {
      try {
        await supabase.from('consultations').update({ final_karte: generatedKarte }).eq('id', consultationId)
      } catch {}
    }
  }

  async function handleHold() {
    stop()
    let text = applyPhrasesToTranscript([transcript, interimText].filter(s => s?.trim()).join(' ').trim())
    setTranscript(text)
    if (text.trim()) {
      setCorrecting(true)
      try { text = await correctFootClinicTranscript(text); setTranscript(text) } catch {}
      setCorrecting(false)
    }
    if (text.trim()) setSegments(prev => [...prev, text])
    reset()
  }

  async function handleSwitchPatient() {
    stop()
    let text = [transcript, interimText].filter(s => s?.trim()).join(' ').trim()
    if (text.trim()) {
      text = applyPhrasesToTranscript(text)
      setCorrecting(true)
      try { text = await correctFootClinicTranscript(text) } catch {}
      setCorrecting(false)
    }
    const savedSegments = text.trim() ? [...segments, text] : [...segments]
    const hasKarte = generatedKarte.trim().length > 0
    // 録音・生成済みカルテ・識別メモのいずれかがあれば保留リストに退避する（新規作成ボタンとしても使う）
    if (savedSegments.length > 0 || hasKarte || patientLabel.trim()) {
      const info = currentPatientInfo()
      setSessions(prev => [...prev, {
        id: Date.now(),
        label: makeLabel(info, savedSegments),
        segments: savedSegments,
        patientInfo: info,
        generatedKarte,
        consultationId,
      }])
    }
    reset(); setSegments([]); setGeneratedKarte(''); setConsultationId(null)
    setAge(''); setGender(GENDERS[0]); setVisitType('初診')
    setChiefComplaint(''); setMondsin(''); setPatientLabel(''); setError(''); setMatchedTemplate(null)
  }

  function handleResumeSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    restorePatientInfo(session.patientInfo)
    setSegments(session.segments)
    setGeneratedKarte(session.generatedKarte ?? '')
    setConsultationId(session.consultationId ?? null)
    setError(''); setMatchedTemplate(null)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  function handleReset() {
    reset(); setSegments([]); setGeneratedKarte('')
    setAge(''); setGender(GENDERS[0]); setVisitType('初診')
    setChiefComplaint(''); setMondsin(''); setPatientLabel(''); setError(''); setMatchedTemplate(null)
  }

  // ---- JSX ブロック（関数コンポーネントにしない） ----

  const allSegs = [...segments, transcript].filter(s => s.trim())
  const hasRec = allSegs.length > 0
  const hasMon = mondsin.trim().length > 0
  const hasContent = hasRec || hasMon
  let generateLabel = generating ? 'カルテ生成中...' : 'カルテを生成する'
  if (!generating) {
    if (hasRec && hasMon && visitType !== '再診') generateLabel = `問診＋録音（${allSegs.length}件）からカルテを生成`
    else if (hasRec) generateLabel = allSegs.length > 1 ? `録音（${allSegs.length}件）からカルテを生成` : '録音からカルテを生成'
    else if (hasMon) generateLabel = visitType === '再診' ? '前回カルテからカルテを生成' : '問診からカルテを生成'
    else if (chiefComplaint.trim()) generateLabel = 'テンプレートから生成'
  }

  const headerJsx = (
    <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1 }}>karte·ai</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doctor.name} 先生</span>
        <ThemeToggle />
        <button type="button" onClick={toggleLayout} title={layout === 'split' ? 'サイドバーレイアウト' : 'シンプルレイアウト'} style={{
          width: 30, height: 30, borderRadius: 6,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          {layout === 'split' ? <PanelLeft size={15} /> : <Columns2 size={15} />}
        </button>
        {onAdmin && (
          <button className="btn btn-outline btn-sm" type="button" onClick={onAdmin} title="管理画面">
            <Settings size={13} /> 管理
          </button>
        )}
        <button className="btn btn-outline btn-sm" type="button" onClick={logout}>
          <LogOut size={13} /> 変更
        </button>
      </div>
    </header>
  )

  const patientFormJsx = (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>患者情報</h2>
        <button className="btn btn-primary btn-sm" type="button" onClick={handleSwitchPatient} title="今の内容を保留して新しい患者を始める">
          <UserPlus size={13} /> 新規作成
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {VISIT_TYPES.map(v => (
            <button key={v} type="button" onClick={() => setVisitType(v)} style={{
              flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid',
              borderColor: visitType === v ? 'var(--primary)' : 'var(--border)',
              background: visitType === v ? 'rgba(16,185,129,0.12)' : 'var(--surface2)',
              color: visitType === v ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: visitType === v ? 700 : 400, fontSize: 13, cursor: 'pointer',
            }}>{v}</button>
          ))}
        </div>
      </div>
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
        <label>識別メモ（任意・自分だけ分かればOK）</label>
        <input type="text" value={patientLabel} onChange={e => setPatientLabel(e.target.value)} placeholder="例: カルテ番号・診察順・イニシャルなど" autoComplete="off" />
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>朝まとめて生成した後、誰の分か見分けるための項目です。患者名は入力しないでください。</p>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>主訴</label>
        <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="例: 右膝の痛み、2週間前から" autoComplete="off" />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>{visitType === '再診' ? '前回カルテ（任意）' : '問診内容（任意）'}</label>
        <textarea
          value={mondsin} onChange={e => setMondsin(e.target.value)}
          placeholder={visitType === '再診' ? '前回のカルテ内容をここに貼り付けてください' : '問診票や問診の内容をここに貼り付けてください'}
          style={{ minHeight: 100, resize: 'vertical', fontSize: 13, lineHeight: 1.7 }}
          autoComplete="off"
        />
      </div>
    </div>
  )

  const recorderJsx = (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>診察録音</h2>
        {isRecording && (
          <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="recording-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
            録音中
          </span>
        )}
      </div>
      {segments.map((seg, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>
            {'①②③④⑤'[i] || `(${i+1})`}診察録音（保留済み）
          </div>
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: 10, fontSize: 13, lineHeight: 1.7, color: 'var(--text)', maxHeight: 120, overflowY: 'auto' }}>
            {seg}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {!isRecording ? (
          <button className="btn btn-danger" type="button" onClick={start} style={{ flex: 1, justifyContent: 'center' }}>
            <Mic size={16} /> {segments.length > 0 ? `録音開始（${['②','③','④','⑤'][segments.length - 1] || `${segments.length + 1}回目`}）` : '録音開始'}
          </button>
        ) : (
          <>
            <button className="btn btn-outline" type="button" onClick={async () => {
              stop()
              const applied = applyPhrasesToTranscript([transcript, interimText].filter(s => s?.trim()).join(' ').trim())
              setTranscript(applied)
              if (applied.trim()) {
                setCorrecting(true)
                try { const c = await correctFootClinicTranscript(applied); setTranscript(c) } catch {}
                setCorrecting(false)
              }
            }} style={{ flex: 1, justifyContent: 'center' }}>
              <MicOff size={16} /> 録音停止
            </button>
            <button className="btn btn-outline" type="button" onClick={handleHold} style={{ flex: 1, justifyContent: 'center', color: 'var(--amber)', borderColor: 'var(--amber)' }}>同患者・続きへ</button>
            <button className="btn btn-outline" type="button" onClick={handleSwitchPatient} style={{ flex: 1, justifyContent: 'center', color: 'var(--purple)', borderColor: 'var(--purple)' }}>別患者へ</button>
          </>
        )}
        <button className="btn btn-outline btn-sm" type="button" onClick={handleReset} title="リセット"><RotateCcw size={14} /></button>
      </div>
      {!isRecording && (transcript.trim() || segments.length > 0) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {transcript.trim() && (
            <button className="btn btn-outline" type="button" onClick={handleHold} style={{ flex: 1, justifyContent: 'center', color: 'var(--amber)', borderColor: 'var(--amber)', fontSize: 13 }}>同じ患者・続きを録音</button>
          )}
          <button className="btn btn-outline" type="button" onClick={handleSwitchPatient} style={{ flex: 1, justifyContent: 'center', color: 'var(--purple)', borderColor: 'var(--purple)', fontSize: 13 }}>別患者に切り替え</button>
        </div>
      )}
      {recError && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{recError}</p>}
      {correcting && <p style={{ color: 'var(--primary)', fontSize: 13, marginBottom: 8 }}>🔄 医療用語を補正中...</p>}
      {(transcript || interimText || segments.length === 0) && (
        <>
          {segments.length > 0 && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
              {'①②③④⑤'[segments.length] || `(${segments.length + 1})`}診察録音（現在）
            </div>
          )}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, minHeight: 120, maxHeight: 240, overflowY: 'auto', fontSize: 13, lineHeight: 1.7 }}>
            {transcript || interimText ? (
              <><span style={{ color: 'var(--text)' }}>{transcript}</span>{interimText && <span style={{ color: 'var(--text-faint)' }}>{interimText}</span>}</>
            ) : (
              <span style={{ color: 'var(--text-faint)' }}>録音開始すると、ここにリアルタイムで文字起こしが表示されます</span>
            )}
          </div>
        </>
      )}
      {sessions.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border2)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>保留中の患者録音 ({sessions.length}件)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <div key={s.id} style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', marginBottom: 6 }}>{s.label}</div>
                <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px', fontSize: 12, lineHeight: 1.7, color: 'var(--text)', maxHeight: 160, overflowY: 'auto', wordBreak: 'break-all', marginBottom: 8 }}>
                  {s.segments.join('\n\n') || '（録音データなし）'}
                </div>
                <button type="button" onClick={() => handleResumeSession(s.id)} style={{ background: 'var(--amber)', color: 'var(--bg)', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  この患者に戻る
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const generateJsx = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {matchedTemplate && (
        <p style={{ fontSize: 12, color: 'var(--primary)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '6px 10px' }}>
          📋 テンプレート適用中: {matchedTemplate.symptom}{matchedTemplate.age_group && ` / ${matchedTemplate.age_group}`}
        </p>
      )}
      {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      <button className="btn btn-primary" type="button"
        onClick={() => handleGenerate(!hasContent)}
        disabled={generating || (!hasContent && !chiefComplaint.trim())}
        style={{ justifyContent: 'center', padding: '12px', fontSize: 15 }}>
        <Sparkles size={17} />{generateLabel}
      </button>
    </div>
  )

  const karteJsx = (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>生成されたカルテ</h2>
        <button className="btn btn-outline btn-sm" type="button" onClick={handleCopy} disabled={!generatedKarte}>
          {copied ? <><Check size={13} /> コピー済み</> : <><Copy size={13} /> コピー</>}
        </button>
      </div>
      <textarea ref={karteRef} value={generatedKarte} onChange={e => setGeneratedKarte(e.target.value)}
        placeholder={generating ? '生成中...' : '「カルテを生成する」ボタンを押すとここに表示されます'}
        style={{ flex: 1, minHeight: 400, resize: 'vertical', lineHeight: 1.8, fontSize: 14, background: 'var(--surface2)', color: 'var(--text)' }}
        autoComplete="off"
      />
      {generatedKarte && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" type="button" onClick={handleCopy} style={{ fontSize: 15, padding: '10px 24px' }}>
            {copied ? <><Check size={15} /> コピー済み</> : <><Copy size={15} /> コピーしてウィーメックスへ</>}
          </button>
        </div>
      )}
    </div>
  )

  const sidebarJsx = (
    <aside style={{ width: 220, minWidth: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>現在の患者</div>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>
          {patientLabel.trim() && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{patientLabel.trim()}</div>}
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{chiefComplaint || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{[age ? `${age}歳` : null, gender, visitType].filter(Boolean).join(' · ')}</div>
          {segments.length > 0 && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4 }}>録音 {segments.length}件保留中</div>}
          {generatedKarte.trim() && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4 }}>✓ カルテ生成済み</div>}
        </div>
      </div>
      {sessions.length > 0 && (
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>保留中の患者 ({sessions.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessions.map(s => (
              <div key={s.id} onClick={() => handleResumeSession(s.id)} style={{
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>{s.label}</span>
                  {s.generatedKarte?.trim() && (
                    <span style={{ fontSize: 10, color: 'var(--primary)', background: 'rgba(16,185,129,0.15)', padding: '0 5px', borderRadius: 4, fontWeight: 700 }}>生成済</span>
                  )}
                </div>
                {s.generatedKarte?.trim() ? (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5, maxHeight: 60, overflowY: 'auto', wordBreak: 'break-all' }}>
                    {s.generatedKarte.slice(0, 100)}{s.generatedKarte.length > 100 ? '…' : ''}
                  </div>
                ) : s.segments.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5, maxHeight: 60, overflowY: 'auto', wordBreak: 'break-all' }}>
                    {s.segments.join(' ').slice(0, 120)}{s.segments.join(' ').length > 120 ? '…' : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4, display: 'inline-block', background: 'rgba(251,191,36,0.15)', padding: '1px 6px', borderRadius: 4 }}>タップして再開</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )

  // ---- レイアウトA: シンプル2カラム ----
  if (layout === 'split') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {headerJsx}
        {sessions.length > 0 && (
          <div style={{ background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.25)', padding: '10px 20px' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>一時保留中の患者（{sessions.length}件）— 「再開」を押してください</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sessions.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13, maxWidth: 360 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      {s.segments.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, wordBreak: 'break-all' }}>
                          {s.segments.join(' ').slice(0, 100)}{s.segments.join(' ').length > 100 ? '…' : ''}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => handleResumeSession(s.id)} style={{ background: 'var(--amber)', color: 'var(--bg)', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>再開</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 20, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {patientFormJsx}
            {recorderJsx}
            {generateJsx}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {karteJsx}
          </div>
        </div>
      </div>
    )
  }

  // ---- レイアウトB: サイドバー ----
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {headerJsx}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {sidebarJsx}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
            {patientFormJsx}
            {recorderJsx}
            {generateJsx}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: 16, overflowY: 'auto' }}>
            {karteJsx}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConsultationPage({ onAdmin }) {
  return (
    <ErrorBoundary>
      <ConsultationInner onAdmin={onAdmin} />
    </ErrorBoundary>
  )
}
