import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_RETENTION_HOURS = 24

export function useAppSettings() {
  const [retentionHours, setRetentionHours] = useState(DEFAULT_RETENTION_HOURS)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('app_settings').select('retention_hours').eq('id', true).single()
      if (data) setRetentionHours(data.retention_hours)
    } catch {
      // 未設定ならデフォルト値のまま
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function updateRetentionHours(hours) {
    const { error } = await supabase.from('app_settings').update({ retention_hours: hours, updated_at: new Date().toISOString() }).eq('id', true)
    if (error) throw error
    setRetentionHours(hours)
  }

  return { retentionHours, loading, updateRetentionHours }
}
