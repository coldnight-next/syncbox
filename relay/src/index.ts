import http from 'node:http'
import { WebSocketServer } from 'ws'
import { verifyToken } from './auth.js'
import { addClient, getStats } from './relay.js'

const PORT = Number(process.env.PORT) || 8080

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const stats = getStats()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', ...stats }))
    return
  }
  res.writeHead(404)
  res.end('Not Found')
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')
    const deviceId = url.searchParams.get('deviceId')

    if (!token || !deviceId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    const userId = await verifyToken(token)

    wss.handleUpgrade(req, socket, head, (ws) => {
      console.log(`Client connected: device=${deviceId} user=${userId}`)
      addClient(ws, deviceId, userId)
    })
  } catch (err) {
    console.error('Auth failed:', err)
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
  }
})

server.listen(PORT, () => {
  console.log(`Syncbox relay server listening on port ${PORT}`)
})
