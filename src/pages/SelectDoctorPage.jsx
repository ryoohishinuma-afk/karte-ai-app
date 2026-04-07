import { useState } from 'react'
import { UserCircle, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDoctors } from '../hooks/useDoctors'

export default function SelectDoctorPage({ onAdmin }) {
  const { selectDoctor } = useAuth()
  const { doctors, loading } = useDoctors()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>カルテAI</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>担当の医師を選択してください</p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b' }}>読み込み中...</p>
        ) : doctors.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#64748b' }}>
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
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#1d4ed8'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCircle size={26} color="#1d4ed8" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                  {d.specialty && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{d.specialty}</div>}
                  {d.style_profile ? (
                    <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✓ スタイル学習済み</div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠ スタイル未学習</div>
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
