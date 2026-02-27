import { usePeers } from '../../hooks/usePeers'

export function PeerStatus(): React.JSX.Element {
  const { discoveredPeers, connectedPeers } = usePeers()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Nearby Peers</h3>
      {discoveredPeers.length === 0 ? (
        <p className="text-xs text-gray-400">Scanning for peers on your network...</p>
      ) : (
        <ul className="space-y-2">
          {discoveredPeers.map((peer) => {
            const isConnected = connectedPeers.some((p) => p.deviceId === peer.deviceId)
            return (
              <li key={peer.deviceId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-400'}`}
                  />
                  <span className="text-gray-700">{peer.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {isConnected ? 'Connected' : 'Discovered'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
