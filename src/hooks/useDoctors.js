import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useDoctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('doctors').select('*').order('name')
      setDoctors(data ?? [])
    } catch {
      setDoctors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createDoctor({ name, specialty }) {
    const { error } = await supabase.from('doctors').insert({ name, specialty })
    if (error) throw error
    await fetch()
  }

  async function updateStyleProfile(doctorId, styleProfile) {
    const { error } = await supabase
      .from('doctors')
      .update({ style_profile: styleProfile })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  async function deleteDoctor(id) {
    const { error } = await supabase.from('doctors').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  return { doctors, loading, createDoctor, updateStyleProfile, deleteDoctor, refresh: fetch }
}
