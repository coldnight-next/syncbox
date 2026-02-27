import { useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { ipc } from '../lib/ipc-client'

export function useAuth() {
  const auth = useAuthStore((s) => s.auth)
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    void ipc.invoke('auth:get-state').then(setAuth)

    const unsubscribe = ipc.on('auth:state-changed', (state) => {
      setAuth(state)
    })

    return unsubscribe
  }, [setAuth])

  const signIn = useCallback(() => {
    void ipc.invoke('auth:sign-in')
  }, [])

  const signOut = useCallback(() => {
    void ipc.invoke('auth:sign-out')
  }, [])

  return { auth, signIn, signOut }
}
