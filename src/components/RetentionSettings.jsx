import { Clock } from 'lucide-react'
import { useAppSettings } from '../hooks/useAppSettings'

const OPTIONS = [
  { hours: 1, label: '1時間' },
  { hours: 6, label: '6時間' },
  { hours: 12, label: '12時間' },
  { hours: 24, label: '1日' },
]

export default function RetentionSettings() {
  const { retentionHours, loading, updateRetentionHours } = useAppSettings()

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={15} /> データ保持期間
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        生成したカルテ（録音の文字起こし・カルテ本文）は、ここで選んだ時間が経つと自動的に削除されます（15分ごとにチェック）。クリニック全体で共通の設定です。
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {OPTIONS.map(opt => (
          <button
            key={opt.hours}
            type="button"
            disabled={loading}
            onClick={() => updateRetentionHours(opt.hours)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid',
              borderColor: retentionHours === opt.hours ? 'var(--primary)' : 'var(--border)',
              background: retentionHours === opt.hours ? 'rgba(16,185,129,0.12)' : 'var(--surface2)',
              color: retentionHours === opt.hours ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: retentionHours === opt.hours ? 700 : 400, fontSize: 13, cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
