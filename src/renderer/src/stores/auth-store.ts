import { create } from 'zustand'
import type { AuthState } from '@shared/types/auth'
import { AUTH_INITIAL_STATE } from '@shared/types/auth'

interface AuthStore {
  auth: AuthState
  setAuth: (auth: AuthState) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: { ...AUTH_INITIAL_STATE },
  setAuth: (auth) => set({ auth }),
}))
