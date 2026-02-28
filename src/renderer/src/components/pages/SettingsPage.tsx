import { useEffect, useRef, useCallback, useState } from 'react'
import { ipc } from '../../lib/ipc-client'
import { useSettingsStore } from '../../stores/settings-store'
import type { BandwidthPreset } from '@shared/types/config'

type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export function SettingsPage(): React.JSX.Element {
  const { config, loading, loadConfig, updateConfig } = useSettingsStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const unsubs = [
      ipc.on('update:available', (data) => {
        setUpdateStatus('available')
        setUpdateVersion(data.version)
      }),
      ipc.on('update:not-available', () => {
        setUpdateStatus('not-available')
      }),
      ipc.on('update:progress', (data) => {
        setUpdateStatus('downloading')
        setDownloadPercent(Math.round(data.percent))
      }),
      ipc.on('update:downloaded', () => {
        setUpdateStatus('downloaded')
      }),
      ipc.on('update:error', (data) => {
        setUpdateStatus('error')
        setUpdateError(data.message)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [])

  const debouncedUpdate = useCallback(
    (partial: Parameters<typeof updateConfig>[0]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void updateConfig(partial)
      }, 300)
    },
    [updateConfig],
  )

  if (loading || !config) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-gray-500">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
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

        {/* Bandwidth */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">Bandwidth</h2>
          <p className="mt-0.5 text-xs text-gray-500">Control upload and download speed limits</p>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              {(['no-limit', 'auto', 'custom'] as BandwidthPreset[]).map((preset) => (
                <label key={preset} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bandwidthPreset"
                    checked={config.bandwidthPreset === preset}
                    onChange={() => void updateConfig({ bandwidthPreset: preset })}
                    className="h-4 w-4 text-accent"
                  />
                  <span className="text-sm text-gray-700 capitalize">
                    {preset === 'no-limit' ? 'No Limit' : preset === 'auto' ? 'Auto' : 'Custom'}
                  </span>
                </label>
              ))}
            </div>

            {config.bandwidthPreset === 'custom' && (
              <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                <SliderField
                  label="Upload"
                  value={config.customUploadKBps}
                  max={10000}
                  unit="KB/s"
                  onChange={(v) => debouncedUpdate({ customUploadKBps: v })}
                />
                <SliderField
                  label="Download"
                  value={config.customDownloadKBps}
                  max={10000}
                  unit="KB/s"
                  onChange={(v) => debouncedUpdate({ customDownloadKBps: v })}
                />
                <p className="text-xs text-gray-400">0 = unlimited</p>
              </div>
            )}

            {config.bandwidthPreset === 'auto' && (
              <p className="text-xs text-gray-500">
                Syncbox will automatically reduce bandwidth when your system is busy.
              </p>
            )}
          </div>
        </section>

        {/* General */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">General</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700">Theme</span>
                <p className="text-xs text-gray-400">Choose the appearance of the app</p>
              </div>
              <select
                value={config.theme}
                onChange={(e) => void updateConfig({ theme: e.target.value as 'light' | 'dark' | 'system' })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-700">Conflict Strategy</span>
                <p className="text-xs text-gray-400">How to handle conflicting file changes</p>
              </div>
              <select
                value={config.conflictStrategy}
                onChange={(e) => void updateConfig({ conflictStrategy: e.target.value as 'ask' | 'keep-both' | 'keep-newest' })}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700"
              >
                <option value="ask">Ask me</option>
                <option value="keep-both">Keep both</option>
                <option value="keep-newest">Keep newest</option>
              </select>
            </div>

            <ToggleField
              label="Auto-start"
              description="Launch Syncbox when your computer starts"
              checked={config.autoStart}
              onChange={(v) => void updateConfig({ autoStart: v })}
            />

            <ToggleField
              label="Notifications"
              description="Show notifications for sync events"
              checked={config.enableNotifications}
              onChange={(v) => void updateConfig({ enableNotifications: v })}
            />
          </div>
        </section>

        {/* Updates */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">Updates</h2>
          <p className="mt-0.5 text-xs text-gray-500">Syncbox automatically checks for updates on startup</p>
          <div className="mt-4 space-y-3">
            {updateStatus === 'idle' && (
              <SettingsButton
                label="Check for Updates"
                onClick={() => {
                  setUpdateStatus('checking')
                  void ipc.invoke('update:check')
                }}
              />
            )}
            {updateStatus === 'checking' && (
              <p className="text-sm text-gray-500">Checking for updates...</p>
            )}
            {updateStatus === 'not-available' && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-sm text-gray-700">You are on the latest version</p>
                <button
                  onClick={() => {
                    setUpdateStatus('checking')
                    void ipc.invoke('update:check')
                  }}
                  className="ml-2 text-xs text-accent hover:underline"
                >
                  Check again
                </button>
              </div>
            )}
            {updateStatus === 'available' && updateVersion && (
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  Version {updateVersion} is available
                </p>
                <div className="mt-2">
                  <SettingsButton
                    label="Download Update"
                    variant="primary"
                    onClick={() => void ipc.invoke('update:download')}
                  />
                </div>
              </div>
            )}
            {updateStatus === 'downloading' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">Downloading update... {downloadPercent}%</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${downloadPercent}%` }}
                  />
                </div>
              </div>
            )}
            {updateStatus === 'downloaded' && (
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-900">
                  Update downloaded. It will be installed when you restart.
                </p>
                <div className="mt-2">
                  <SettingsButton
                    label="Restart & Install"
                    variant="primary"
                    onClick={() => void ipc.invoke('update:install')}
                  />
                </div>
              </div>
            )}
            {updateStatus === 'error' && (
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-sm text-red-700">{updateError ?? 'Update check failed'}</p>
                <div className="mt-2">
                  <SettingsButton
                    label="Retry"
                    onClick={() => {
                      setUpdateStatus('checking')
                      setUpdateError(null)
                      void ipc.invoke('update:check')
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* About */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-semibold text-gray-900">About</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span className="font-medium text-gray-900">0.2.0</span>
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

function SliderField({ label, value, max, unit, onChange }: {
  label: string
  value: number
  max: number
  unit: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <span className="w-20 text-sm text-gray-600">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="w-24 text-right text-sm font-medium text-gray-700">
        {value === 0 ? 'Unlimited' : `${value} ${unit}`}
      </span>
    </div>
  )
}

function ToggleField({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
