import { Sidebar, type NavPage } from './components/layout/Sidebar'
import { FoldersPage } from './components/pages/FoldersPage'
import { ActivityPage } from './components/pages/ActivityPage'
import { DevicesPage } from './components/pages/DevicesPage'
import { SettingsPage } from './components/pages/SettingsPage'
import { DashboardPage } from './components/pages/DashboardPage'
import { useSyncStatus } from './hooks/useSyncStatus'
import { useSyncStore } from './stores/sync-store'
import { useSettingsStore } from './stores/settings-store'
import { useAuthStore } from './stores/auth-store'
import { useState, useEffect } from 'react'

export function App(): React.JSX.Element {
  const { auth, loading, loadState, signIn } = useAuthStore()

  useEffect(() => {
    void loadState()
  }, [loadState])

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/30 animate-pulse">
            <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">Loading Syncbox...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onSignIn={signIn} />
  }

  return <AppShell />
}

function LoginScreen({ onSignIn }: { onSignIn: () => Promise<void> }): React.JSX.Element {
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async (): Promise<void> => {
    setSigningIn(true)
    try {
      await onSignIn()
    } finally {
      // Don't reset signingIn — the auth:state-changed event will
      // flip isAuthenticated to true which unmounts this component
      setSigningIn(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-sm px-6 text-center">
        {/* Logo */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/30">
          <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Syncbox</h1>
        <p className="mt-1 text-sm text-slate-400">Sync your files across all your devices</p>

        <div className="mt-8">
          <button
            onClick={() => void handleSignIn()}
            disabled={signingIn}
            className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-blue-600 hover:shadow-accent/40 disabled:opacity-60"
          >
            {signingIn ? 'Opening browser...' : 'Sign in'}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            {signingIn
              ? 'Complete sign-in in your browser, then return here'
              : 'You\'ll be redirected to sign in securely in your browser'}
          </p>
        </div>
      </div>
    </div>
  )
}

function AppShell(): React.JSX.Element {
  const { status } = useSyncStatus()
  const conflicts = useSyncStore((s) => s.conflicts)
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard')
  const loadConfig = useSettingsStore((s) => s.loadConfig)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  return (
    <div className="flex h-screen bg-surface-secondary text-gray-900">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        status={status}
        conflictCount={conflicts.length}
      />
      <main className="flex-1 overflow-hidden">
        {currentPage === 'dashboard' && <DashboardPage />}
        {currentPage === 'folders' && <FoldersPage status={status} />}
        {currentPage === 'activity' && <ActivityPage status={status} conflicts={conflicts} />}
        {currentPage === 'devices' && <DevicesPage />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
