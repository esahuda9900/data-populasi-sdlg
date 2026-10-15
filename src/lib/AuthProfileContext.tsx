import { createContext, useContext } from 'react'
import type { UserProfile } from './authProfile'

const AuthProfileContext = createContext<UserProfile | null>(null)

export function AuthProfileProvider({
  profile,
  children,
}: {
  profile: UserProfile
  children: React.ReactNode
}) {
  return (
    <AuthProfileContext.Provider value={profile}>{children}</AuthProfileContext.Provider>
  )
}

export function useAuthProfile(): UserProfile {
  const ctx = useContext(AuthProfileContext)
  if (!ctx) {
    throw new Error('useAuthProfile must be used within AuthProfileProvider')
  }
  return ctx
}

export function useAuthProfileOptional(): UserProfile | null {
  return useContext(AuthProfileContext)
}
