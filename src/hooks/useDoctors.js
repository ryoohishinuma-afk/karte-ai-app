import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MAX_HISTORY = 10
const MAX_SAVED = 5

function makeVersionId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

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

  async function createDoctor({ name, specialty, role = 'doctor' }) {
    const { error } = await supabase.from('doctors').insert({ name, specialty, role })
    if (error) throw error
    await fetch()
  }

  // 新しいプロファイルを履歴に追加しつつ、アクティブにする
  async function updateStyleProfile(doctorId, styleProfile) {
    const doctor = doctors.find(d => d.id === doctorId)
    const history = Array.isArray(doctor?.style_profile_history) ? doctor.style_profile_history : []

    const newVersion = {
      id: makeVersionId(),
      created_at: new Date().toISOString(),
      profile: styleProfile,
      label: new Date().toLocaleDateString('ja-JP') + ' 学習',
      saved: false,
    }

    // 古い非保存版を削除して MAX_HISTORY 以内に収める
    let updated = [newVersion, ...history]
    const savedOnes = updated.filter(v => v.saved)
    const unsavedOnes = updated.filter(v => !v.saved)
    if (updated.length > MAX_HISTORY) {
      const keep = unsavedOnes.slice(0, MAX_HISTORY - savedOnes.length)
      updated = [newVersion, ...savedOnes, ...keep.filter(v => v.id !== newVersion.id)]
    }

    const { error } = await supabase
      .from('doctors')
      .update({ style_profile: styleProfile, style_profile_history: updated })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  // バージョンをアクティブプロファイルに設定
  async function setActiveProfile(doctorId, versionId) {
    const doctor = doctors.find(d => d.id === doctorId)
    const history = Array.isArray(doctor?.style_profile_history) ? doctor.style_profile_history : []
    const version = history.find(v => v.id === versionId)
    if (!version) return

    const { error } = await supabase
      .from('doctors')
      .update({ style_profile: version.profile })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  // バージョンの保存フラグを切り替え（最大5件）
  async function toggleSaveProfile(doctorId, versionId) {
    const doctor = doctors.find(d => d.id === doctorId)
    const history = Array.isArray(doctor?.style_profile_history) ? doctor.style_profile_history : []
    const target = history.find(v => v.id === versionId)
    if (!target) return

    const savedCount = history.filter(v => v.saved && v.id !== versionId).length
    if (!target.saved && savedCount >= MAX_SAVED) {
      throw new Error(`保存できるプロファイルは${MAX_SAVED}件までです`)
    }

    const updated = history.map(v => v.id === versionId ? { ...v, saved: !v.saved } : v)
    const { error } = await supabase
      .from('doctors')
      .update({ style_profile_history: updated })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  // バージョンを削除
  async function deleteProfileVersion(doctorId, versionId) {
    const doctor = doctors.find(d => d.id === doctorId)
    const history = Array.isArray(doctor?.style_profile_history) ? doctor.style_profile_history : []
    const updated = history.filter(v => v.id !== versionId)
    const { error } = await supabase
      .from('doctors')
      .update({ style_profile_history: updated })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  async function updateDoctor(doctorId, { name, specialty, role }) {
    const { error } = await supabase
      .from('doctors')
      .update({ name, specialty, role })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  async function updateOutputFormat(doctorId, outputFormat) {
    const { error } = await supabase
      .from('doctors')
      .update({ output_format: outputFormat })
      .eq('id', doctorId)
    if (error) throw error
    await fetch()
  }

  async function deleteDoctor(id) {
    const { error } = await supabase.from('doctors').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  return {
    doctors, loading,
    createDoctor, updateDoctor, updateStyleProfile, updateOutputFormat,
    setActiveProfile, toggleSaveProfile, deleteProfileVersion,
    deleteDoctor, refresh: fetch,
  }
}
