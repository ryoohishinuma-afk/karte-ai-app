import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SelectDoctorPage from './pages/SelectDoctorPage'
import ConsultationPage from './pages/ConsultationPage'
import AdminPage from './pages/AdminPage'
import './index.css'

function AppContent() {
  const { doctor } = useAuth()
  const [showAdmin, setShowAdmin] = useState(false)

  if (showAdmin) return <AdminPage onBack={() => setShowAdmin(false)} />
  if (doctor) return <ConsultationPage onAdmin={() => setShowAdmin(true)} />
  return <SelectDoctorPage onAdmin={() => setShowAdmin(true)} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
