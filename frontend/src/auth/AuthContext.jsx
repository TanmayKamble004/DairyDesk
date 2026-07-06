import { createContext, useCallback, useContext, useState } from 'react'
import * as client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => client.getAuth()?.user ?? null)

  const login = useCallback(async (username, password) => {
    const loggedIn = await client.login(username, password)
    setUser(loggedIn)
    return loggedIn
  }, [])

  const logout = useCallback(() => {
    client.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
