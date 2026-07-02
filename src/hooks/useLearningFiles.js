import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useLearningFiles(doctorId) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!doctorId) return
    setLoading(true)
    supabase
      .from('learning_files')
      .select('id, doctor_id, filename, file_type, file_size, learned_at, visit_type, chief_complaint')
      .eq('doctor_id', doctorId)
      .order('learned_at', { ascending: false })
      .then(({ data }) => {
        setFiles(data ?? [])
        setLoading(false)
      })
  }, [doctorId])

  // records: [{ file, content, visit_type, chief_complaint }]
  async function saveFiles(doctorId, records) {
    const rows = records.map(r => {
      const ext = r.file.name.split('.').pop().toLowerCase()
      return {
        doctor_id: doctorId,
        filename: r.file.name,
        file_type: ext,
        file_size: r.file.size,
        content: r.content ?? null,
        visit_type: r.visit_type ?? null,
        chief_complaint: r.chief_complaint ?? null,
      }
    })
    const { data } = await supabase.from('learning_files').insert(rows).select('id, doctor_id, filename, file_type, file_size, learned_at, visit_type, chief_complaint')
    if (data) setFiles(prev => [...data, ...prev])
  }

  return { files, loading, saveFiles }
}

// 生成時few-shot用: 同じ区分・近い主訴の原文カルテを取得（hookではなく通常関数）
// ソースは2つ: ①学習アップロードされた原文 ②医師が手直しした過去の生成カルテ（使いながら学習）
export async function fetchKarteExamples(doctorId, visitType, chiefComplaint, limit = 4) {
  const [{ data: learned }, { data: edited }] = await Promise.all([
    supabase
      .from('learning_files')
      .select('content, visit_type, chief_complaint')
      .eq('doctor_id', doctorId)
      .not('content', 'is', null)
      .limit(200),
    supabase
      .from('consultations')
      .select('final_karte, generated_karte, visit_type, chief_complaint')
      .eq('doctor_id', doctorId)
      .not('final_karte', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const candidates = [
    ...(learned ?? []).map(d => ({ content: d.content, visit_type: d.visit_type, chief_complaint: d.chief_complaint, bonus: 1 })),
    // 医師が実際に手を入れたものだけ採用（AI出力そのままの再学習ループを防ぐ）
    ...(edited ?? [])
      .filter(d => d.final_karte && d.final_karte !== d.generated_karte)
      .map(d => ({ content: d.final_karte, visit_type: d.visit_type, chief_complaint: d.chief_complaint, bonus: 0 })),
  ]

  const tokens = (chiefComplaint ?? '')
    .split(/[\s、。・,\/]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)

  const scored = candidates
    .filter(d => d.content && d.content.trim().length > 50)
    .map(d => {
      let score = d.bonus
      if (visitType && d.visit_type === visitType) score += 10
      for (const t of tokens) {
        if (d.chief_complaint && d.chief_complaint.includes(t)) score += 5
        else if (d.content.includes(t)) score += 2
      }
      return { ...d, score }
    })
    .sort((a, b) => b.score - a.score)

  // 区分一致が1件もない場合でも文体見本として上位を返す
  return scored.slice(0, limit)
}
