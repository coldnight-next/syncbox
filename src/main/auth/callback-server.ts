import http from 'node:http'
import { URL } from 'node:url'
import type { Logger } from '../../sync-engine/logger'

const CALLBACK_PORT = 19876

export interface CallbackResult {
  code: string
  state: string
}

export function startCallbackServer(
  expectedState: string,
  logger: Logger,
): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`)

        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Authentication failed</h2><p>You can close this window.</p></body></html>')
          server.close()
          reject(new Error(`OAuth error: ${error}`))
          return
        }

        if (!code || !state) {
          res.writeHead(400)
          res.end('Missing code or state')
          return
        }

        if (state !== expectedState) {
          logger.warn('State mismatch in OAuth callback', { expected: expectedState, received: state })
          res.writeHead(400)
          res.end('Invalid state')
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<html><body style="font-family:system-ui;text-align:center;padding:40px">
<h2>Signed in to Syncbox!</h2><p>This window will close automatically...</p>
<script>setTimeout(function(){window.close()},1000)</script>
</body></html>`)

        server.close()
        resolve({ code, state })
      } catch (err) {
        logger.error('Callback server error', { error: String(err) })
        res.writeHead(500)
        res.end('Internal error')
      }
    })

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      logger.info('OAuth callback server listening', { port: CALLBACK_PORT })
    })

    server.on('error', (err) => {
      logger.error('Callback server failed to start', { error: String(err) })
      reject(err)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth callback timed out'))
    }, 5 * 60 * 1000)
  })
}
