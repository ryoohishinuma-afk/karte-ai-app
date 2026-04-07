import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTemplates(doctorId) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!doctorId) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('use_count', { ascending: false })
      setTemplates(data ?? [])
    } catch { setTemplates([]) }
    finally { setLoading(false) }
  }, [doctorId])

  useEffect(() => { fetch() }, [fetch])

  async function addTemplate({ symptom, age_group, gender, template_text }) {
    const { error } = await supabase.from('templates').insert({ doctor_id: doctorId, symptom, age_group, gender, template_text })
    if (error) throw error
    await fetch()
  }

  async function deleteTemplate(id) {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  async function incrementUseCount(id) {
    await supabase.rpc('increment_template_use', { template_id: id }).catch(() => {})
  }

  // 患者情報に合うテンプレートを検索
  function findMatching(chiefComplaint, age, gender) {
    if (!chiefComplaint) return []
    const keywords = chiefComplaint.split(/[\s、。,，]+/).filter(k => k.length >= 2)
    return templates.filter(t => {
      const symptomMatch = keywords.some(k => t.symptom.includes(k) || k.includes(t.symptom))
      if (!symptomMatch) return false
      const genderMatch = !t.gender || t.gender === '問わず' || t.gender === gender
      const ageMatch = !t.age_group || !age || t.age_group === `${Math.floor(Number(age) / 10) * 10}代`
      return genderMatch && ageMatch
    }).slice(0, 3)
  }

  return { templates, loading, addTemplate, deleteTemplate, findMatching, refresh: fetch }
}
