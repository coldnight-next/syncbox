import type { DeviceInfo } from '@shared/types/auth'
import { Button } from '../ui/Button'
import { ipc } from '../../lib/ipc-client'
import { useCallback, useEffect, useState } from 'react'

interface DeviceListProps {
  devices: DeviceInfo[]
  currentDeviceId: string
}

export function DeviceList({ devices, currentDeviceId }: DeviceListProps): React.JSX.Element {
  const [localDeviceId, setLocalDeviceId] = useState(currentDeviceId)

  useEffect(() => {
    if (!currentDeviceId) {
      void ipc.invoke('auth:get-device-id').then(setLocalDeviceId)
    }
  }, [currentDeviceId])

  const handleUnpair = useCallback((deviceId: string) => {
    void ipc.invoke('device:unpair', deviceId)
  }, [])

  if (devices.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Paired Devices</h3>
        <p className="text-xs text-gray-400">No devices paired yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Paired Devices</h3>
      <ul className="space-y-2">
        {devices.map((device) => (
          <li key={device.deviceId} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
            <div>
              <span className="text-sm font-medium text-gray-800">
                {device.name}
                {device.deviceId === localDeviceId && (
                  <span className="ml-2 text-xs text-syncbox-500">(this device)</span>
                )}
              </span>
              <div className="text-xs text-gray-400">
                {device.platform} &middot; Last seen {new Date(device.lastSeenAt).toLocaleDateString()}
              </div>
            </div>
            {device.deviceId !== localDeviceId && (
              <Button variant="ghost" size="sm" onClick={() => handleUnpair(device.deviceId)}>
                Unpair
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
