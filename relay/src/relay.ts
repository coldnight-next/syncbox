import { WebSocket } from 'ws'

interface Client {
  ws: WebSocket
  deviceId: string
  userId: string
}

/** Room-based message relay. Rooms are keyed by userId. */
const rooms = new Map<string, Map<string, Client>>()

export function addClient(ws: WebSocket, deviceId: string, userId: string): void {
  if (!rooms.has(userId)) {
    rooms.set(userId, new Map())
  }
  const room = rooms.get(userId)!
  room.set(deviceId, { ws, deviceId, userId })

  // Notify other clients in the room
  broadcastControl(userId, deviceId, { type: 'relay:peer-joined', deviceId })

  ws.on('message', (data) => {
    // Forward message to all other clients in the room
    const room = rooms.get(userId)
    if (!room) return

    for (const [id, client] of room) {
      if (id !== deviceId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data)
      }
    }
  })

  ws.on('close', () => {
    removeClient(userId, deviceId)
  })

  ws.on('error', () => {
    removeClient(userId, deviceId)
  })

  // Send list of existing peers to the new client
  const room2 = rooms.get(userId)!
  const existingPeers = Array.from(room2.keys()).filter((id) => id !== deviceId)
  for (const peerId of existingPeers) {
    try {
      ws.send(JSON.stringify({ type: 'relay:peer-joined', deviceId: peerId }))
    } catch {
      // Ignore send errors
    }
  }
}

function removeClient(userId: string, deviceId: string): void {
  const room = rooms.get(userId)
  if (!room) return

  room.delete(deviceId)

  if (room.size === 0) {
    rooms.delete(userId)
  } else {
    broadcastControl(userId, deviceId, { type: 'relay:peer-left', deviceId })
  }
}

function broadcastControl(userId: string, excludeDeviceId: string, message: object): void {
  const room = rooms.get(userId)
  if (!room) return

  const payload = JSON.stringify(message)
  for (const [id, client] of room) {
    if (id !== excludeDeviceId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload)
      } catch {
        // Ignore send errors
      }
    }
  }
}

export function getStats(): { rooms: number; clients: number } {
  let clients = 0
  for (const room of rooms.values()) {
    clients += room.size
  }
  return { rooms: rooms.size, clients }
}
