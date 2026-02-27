import { ipc } from '../../lib/ipc-client'

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure Syncbox preferences</p>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-8">
        {/* Sync controls */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">Sync Controls</h2>
          <p className="mt-0.5 text-xs text-gray-500">Start, stop, or force sync manually</p>
          <div className="mt-4 flex gap-3">
            <SettingsButton label="Start Sync" onClick={() => void ipc.invoke('sync:start')} variant="primary" />
            <SettingsButton label="Pause Sync" onClick={() => void ipc.invoke('sync:stop')} />
            <SettingsButton label="Force Sync" onClick={() => void ipc.invoke('sync:force')} />
          </div>
        </section>

        {/* Updates */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">Updates</h2>
          <p className="mt-0.5 text-xs text-gray-500">Check for the latest version of Syncbox</p>
          <div className="mt-4">
            <SettingsButton label="Check for Updates" onClick={() => void ipc.invoke('update:check')} />
          </div>
        </section>

        {/* About */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">About</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="font-medium text-gray-900">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Platform</span>
              <span className="font-medium text-gray-900">Windows</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function SettingsButton({ label, onClick, variant }: { label: string; onClick: () => void; variant?: 'primary' }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        variant === 'primary'
          ? 'bg-accent text-white hover:bg-blue-600'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
