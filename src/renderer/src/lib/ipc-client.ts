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
}

export const ipc = window.syncboxApi
