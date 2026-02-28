import { create } from 'zustand'
import { ipc } from '../lib/ipc-client'
import type { AuthState } from '@shared/types/auth'
import { AUTH_INITIAL_STATE } from '@shared/types/auth'

interface AuthStore {
  auth: AuthState
  loading: boolean
  error: string | null
  setAuth: (auth: AuthState) => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  loadState: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: { ...AUTH_INITIAL_STATE },
  loading: true,
  error: null,
  setAuth: (auth) => set({ auth }),
  clearError: () => set({ error: null }),

  signIn: async () => {
    set({ error: null })
    await ipc.invoke('auth:sign-in')
    // State is normally pushed via 'auth:state-changed' event during signIn,
    // but re-fetch as a safety net in case the event was missed.
    const authState = await ipc.invoke('auth:get-state')
    set({ auth: authState, loading: false })
  },

  signOut: async () => {
    await ipc.invoke('auth:sign-out')
    set({ auth: { ...AUTH_INITIAL_STATE } })
  },

  loadState: async () => {
    const authState = await ipc.invoke('auth:get-state')
    set({ auth: authState, loading: false })
  },
}))

// Listen for auth state changes pushed from the main process (AuthManager)
ipc.on('auth:state-changed', (data) => {
  useAuthStore.setState({ auth: data, loading: false })
})

// Listen for auth events (errors, sign-in, sign-out)
ipc.on('auth:event', (event) => {
  if (event.type === 'auth-error') {
    useAuthStore.setState({ error: event.error, loading: false })
  }
})
