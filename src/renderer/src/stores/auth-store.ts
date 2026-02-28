import { create } from 'zustand'
import { ipc } from '../lib/ipc-client'
import type { AuthState } from '@shared/types/auth'
import { AUTH_INITIAL_STATE } from '@shared/types/auth'

interface AuthStore {
  auth: AuthState
  loading: boolean
  setAuth: (auth: AuthState) => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  loadState: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: { ...AUTH_INITIAL_STATE },
  loading: true,
  setAuth: (auth) => set({ auth }),

  signIn: async () => {
    await ipc.invoke('auth:sign-in')
    // Auth state will be updated via the 'auth:state-changed' event listener below
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
