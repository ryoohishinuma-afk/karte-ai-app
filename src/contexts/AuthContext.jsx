import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [doctor, setDoctor] = useState(() => {
    try { return JSON.parse(localStorage.getItem('karte_doctor')) } catch { return null }
  })

  function selectDoctor(d) {
    localStorage.setItem('karte_doctor', JSON.stringify(d))
    setDoctor(d)
  }

  function logout() {
    localStorage.removeItem('karte_doctor')
    setDoctor(null)
  }

  return (
    <AuthContext.Provider value={{ doctor, selectDoctor, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
