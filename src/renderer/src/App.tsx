import { SignIn, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { Sidebar, type NavPage } from './components/layout/Sidebar'
import { FoldersPage } from './components/pages/FoldersPage'
import { ActivityPage } from './components/pages/ActivityPage'
import { DevicesPage } from './components/pages/DevicesPage'
import { SettingsPage } from './components/pages/SettingsPage'
import { useSyncStatus } from './hooks/useSyncStatus'
import { useSyncStore } from './stores/sync-store'
import { useState, useEffect } from 'react'
import { ipc } from './lib/ipc-client'

export function App(): React.JSX.Element {
  const { status } = useSyncStatus()
  const conflicts = useSyncStore((s) => s.conflicts)
  const [currentPage, setCurrentPage] = useState<NavPage>('folders')

  return (
    <div className="flex h-screen bg-surface-secondary text-gray-900">
      <SignedOut>
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
          <div className="w-full max-w-md">
            {/* Logo area */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/30">
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Syncbox</h1>
              <p className="mt-1 text-sm text-slate-400">Sync your files across all your devices</p>
            </div>
            {/* Clerk sign in */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
              <SignIn
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'shadow-none border-0 rounded-none',
                  },
                }}
              />
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <AuthBridge />
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          status={status}
          conflictCount={conflicts.length}
        />
        <main className="flex-1 overflow-hidden">
          {currentPage === 'folders' && <FoldersPage status={status} />}
          {currentPage === 'activity' && <ActivityPage status={status} conflicts={conflicts} />}
          {currentPage === 'devices' && <DevicesPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </SignedIn>
    </div>
  )
}

/**
 * Invisible component that bridges Clerk auth state to the main process
 * so PeerManager can start with the userId.
 */
function AuthBridge(): null {
  const { user } = useUser()

  useEffect(() => {
    if (user) {
      void ipc.invoke('auth:set-user', user.id)
    }
  }, [user])

  return null
}
