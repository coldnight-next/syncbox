import type { IpcChannel, IpcParams, IpcReturn, IpcRendererEvents } from '@shared/types/ipc'

export interface SyncboxApi {
  invoke: <C extends IpcChannel>(channel: C, ...args: IpcParams<C>) => Promise<IpcReturn<C>>
  on: <E extends keyof IpcRendererEvents>(
    event: E,
    callback: (data: IpcRendererEvents[E]) => void,
  ) => () => void
}

declare global {
  interface Window {
    syncboxApi: SyncboxApi
  }
  /** Injected by Vite at build time from package.json */
  const __APP_VERSION__: string
}

export const ipc = window.syncboxApi
