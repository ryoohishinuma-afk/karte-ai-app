import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const PHRASE_CATEGORIES = ['所見', '診断', '処方', '指示', 'その他']

export function usePhrases(doctorId) {
  const [phrases, setPhrases] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!doctorId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('phrases')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('category')
        .order('trigger')
      setPhrases(data ?? [])
    } catch { setPhrases([]) }
    finally { setLoading(false) }
  }, [doctorId])

  useEffect(() => { fetch() }, [fetch])

  async function addPhrase({ trigger, expansion, category, reading = '' }) {
    const { error } = await supabase.from('phrases').insert({ doctor_id: doctorId, trigger, expansion, category, reading })
    if (error) throw error
    await fetch()
  }

  async function addPhrasesBulk(items) {
    const records = items.map(p => ({
      doctor_id: doctorId,
      trigger: p.trigger,
      expansion: p.expansion,
      category: p.category || 'その他',
      reading: p.reading || '',
    }))
    const { error } = await supabase.from('phrases').insert(records)
    if (error) throw error
    await fetch()
  }

  async function deletePhrase(id) {
    const { error } = await supabase.from('phrases').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  // 読み仮名ベースで書き起こしテキストを補正
  function applyPhrasesToTranscript(text) {
    let result = text
    for (const p of phrases) {
      if (p.reading && p.reading.trim()) {
        const regex = new RegExp(p.reading.trim(), 'g')
        result = result.replace(regex, p.trigger)
      }
    }
    return result
  }

  return { phrases, loading, addPhrase, addPhrasesBulk, deletePhrase, applyPhrasesToTranscript }
}
