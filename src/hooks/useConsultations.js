import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useConsultations(doctorId) {
  const [consultations, setConsultations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!doctorId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false })
        .limit(100)
      setConsultations(data ?? [])
    } catch { setConsultations([]) }
    finally { setLoading(false) }
  }, [doctorId])

  useEffect(() => { fetch() }, [fetch])

  async function approveConsultation(id, approved) {
    await supabase.from('consultations').update({ is_approved: approved }).eq('id', id)
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, is_approved: approved } : c))
  }

  async function saveCorrection(id, correctedKarte) {
    await supabase.from('consultations').update({ corrected_karte: correctedKarte, is_approved: true }).eq('id', id)
    setConsultations(prev => prev.map(c => c.id === id ? { ...c, corrected_karte: correctedKarte, is_approved: true } : c))
  }

  async function deleteConsultation(id) {
    await supabase.from('consultations').delete().eq('id', id)
    setConsultations(prev => prev.filter(c => c.id !== id))
  }

  // 承認済みのカルテを再学習用テキストとして返す
  function getApprovedSamples() {
    return consultations
      .filter(c => c.is_approved)
      .map(c => c.corrected_karte || c.generated_karte)
      .filter(Boolean)
  }

  return { consultations, loading, approveConsultation, saveCorrection, deleteConsultation, getApprovedSamples, refresh: fetch }
}
