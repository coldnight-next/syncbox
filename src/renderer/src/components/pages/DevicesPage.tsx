import { usePeers } from '../../hooks/usePeers'
import { ipc } from '../../lib/ipc-client'
import { useCallback, useEffect, useState } from 'react'
import type { DeviceInfo } from '@shared/types/auth'

export function DevicesPage(): React.JSX.Element {
  const { discoveredPeers, connectedPeers } = usePeers()
  const [pairedDevices, setPairedDevices] = useState<DeviceInfo[]>([])
  const [localDeviceId, setLocalDeviceId] = useState('')

  useEffect(() => {
    void ipc.invoke('auth:get-device-id').then(setLocalDeviceId)
    void ipc.invoke('device:get-paired').then(setPairedDevices)
  }, [])

  const handleUnpair = useCallback((deviceId: string) => {
    void ipc.invoke('device:unpair', deviceId).then(() => {
      void ipc.invoke('device:get-paired').then(setPairedDevices)
    })
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold text-gray-900">Devices</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage paired devices and nearby peers</p>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-8">
        {/* Nearby peers */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Nearby Peers</h2>
          {discoveredPeers.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                <svg className="h-5 w-5 animate-pulse text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="1" />
                  <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z" />
                  <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Scanning for devices...</p>
                <p className="text-xs text-gray-400">Looking for Syncbox on your local network</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {discoveredPeers.map((peer) => {
                const isConnected = connectedPeers.some((p) => p.deviceId === peer.deviceId)
                return (
                  <div key={peer.deviceId} className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3.5 transition-colors hover:bg-surface-secondary">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{peer.name}</p>
                      <p className="text-xs text-gray-400">{peer.deviceId.slice(0, 12)}...</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isConnected ? 'Connected' : 'Discovered'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Paired devices */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Paired Devices</h2>
          {pairedDevices.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-surface py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50">
                <svg className="h-7 w-7 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-700">No paired devices</p>
              <p className="mt-1 text-xs text-gray-400">Sign in on another device to pair them</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pairedDevices.map((device) => (
                <div key={device.deviceId} className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-accent">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{device.name}</p>
                      {device.deviceId === localDeviceId && (
                        <span className="rounded-full bg-accent-light px-2 py-0.5 text-[10px] font-medium text-accent">This device</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {device.platform} &middot; Last seen {new Date(device.lastSeenAt).toLocaleDateString()}
                    </p>
                  </div>
                  {device.deviceId !== localDeviceId && (
                    <button
                      onClick={() => handleUnpair(device.deviceId)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      Unpair
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
