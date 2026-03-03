import type { SyncStatus } from '@shared/types/sync'
import { useAuthStore } from '../../stores/auth-store'

export type NavPage = 'dashboard' | 'folders' | 'activity' | 'devices' | 'settings'

interface SidebarProps {
  currentPage: NavPage
  onNavigate: (page: NavPage) => void
  status: SyncStatus
  conflictCount: number
}

export function Sidebar({ currentPage, onNavigate, status, conflictCount }: SidebarProps): React.JSX.Element {
  const isSyncing = status.state === 'syncing'

  return (
    <aside className="flex h-full w-56 flex-col bg-sidebar">
      {/* Brand */}
      <div className="drag flex items-center gap-2.5 px-5 pb-2 pt-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <svg className={`h-4 w-4 text-white ${isSyncing ? 'animate-sync-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
        </div>
        <span className="text-base font-semibold tracking-tight text-white">Syncbox</span>
      </div>

      {/* Sync status pill */}
      <div className="no-drag mx-4 mt-4 mb-6">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-hover px-3 py-2">
          <span className={`h-2 w-2 rounded-full ${
            isSyncing ? 'animate-pulse bg-blue-400' :
            status.state === 'error' ? 'bg-red-400' :
            status.state === 'paused' ? 'bg-yellow-400' :
            'bg-emerald-400'
          }`} />
          <span className="text-xs font-medium text-sidebar-text">
            {isSyncing ? 'Syncing...' :
             status.state === 'error' ? 'Error' :
             status.state === 'paused' ? 'Paused' :
             'All synced'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="no-drag flex-1 space-y-1 px-3">
        <NavItem
          icon={<DashboardIcon />}
          label="Dashboard"
          active={currentPage === 'dashboard'}
          onClick={() => onNavigate('dashboard')}
        />
        <NavItem
          icon={<FolderIcon />}
          label="Folders"
          active={currentPage === 'folders'}
          onClick={() => onNavigate('folders')}
        />
        <NavItem
          icon={<ActivityIcon />}
          label="Activity"
          active={currentPage === 'activity'}
          onClick={() => onNavigate('activity')}
          badge={conflictCount > 0 ? conflictCount : undefined}
        />
        <NavItem
          icon={<DevicesIcon />}
          label="Devices"
          active={currentPage === 'devices'}
          onClick={() => onNavigate('devices')}
        />
        <NavItem
          icon={<SettingsIcon />}
          label="Settings"
          active={currentPage === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </nav>

      {/* Version */}
      <div className="px-4 pb-1">
        <span className="text-[10px] text-sidebar-text/50">v{__APP_VERSION__}</span>
      </div>

      {/* User */}
      <UserSection />
    </aside>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-sidebar-active text-sidebar-text-active'
          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
      }`}
    >
      <span className="h-4 w-4 shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  )
}

function DashboardIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}

function FolderIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ActivityIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function DevicesIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function UserSection(): React.JSX.Element {
  const { auth, signOut } = useAuthStore()

  return (
    <div className="no-drag border-t border-white/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {auth.avatarUrl ? (
          <img src={auth.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-hover text-xs font-medium text-sidebar-text">
            {(auth.displayName ?? auth.email ?? '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-medium text-sidebar-text-active">
            {auth.displayName ?? auth.email ?? 'Account'}
          </p>
        </div>
        <button
          onClick={() => void signOut()}
          title="Sign out"
          className="shrink-0 rounded p-1 text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
