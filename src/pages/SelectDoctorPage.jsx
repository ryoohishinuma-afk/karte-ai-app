import { UserCircle, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDoctors } from '../hooks/useDoctors'
import ThemeToggle from '../components/ThemeToggle'

export default function SelectDoctorPage({ onAdmin }) {
  const { selectDoctor } = useAuth()
  const { doctors, loading } = useDoctors()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><ThemeToggle /></div>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>karte · ai</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>担当の医師を選択</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>CliniTech by FOOTSHAKE</p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</p>
        ) : doctors.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: 16 }}>医師が登録されていません</p>
            <button className="btn btn-primary" type="button" onClick={onAdmin}>
              <Settings size={15} /> 管理画面で登録する
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {doctors.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDoctor(d)}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  boxShadow: 'var(--shadow)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCircle size={26} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</span>
                    {d.role === 'pt' && (
                      <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.1)', color: 'var(--primary)', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 6px', borderRadius: 4 }}>PT</span>
                    )}
                  </div>
                  {d.specialty && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{d.specialty}</div>}
                  {d.style_profile ? (
                    <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 4 }}>✓ {d.role === 'pt' ? 'リハスタイル' : '医師スタイル'}学習済み</div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ スタイル未学習</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={onAdmin}>
            <Settings size={13} /> 管理
          </button>
        </div>
      </div>
    </div>
  )
}
