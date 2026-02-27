import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannel, IpcParams, IpcReturn, IpcRendererEvents } from '../shared/types/ipc'

const api = {
  invoke: <C extends IpcChannel>(channel: C, ...args: IpcParams<C>): Promise<IpcReturn<C>> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: <E extends keyof IpcRendererEvents>(
    event: E,
    callback: (data: IpcRendererEvents[E]) => void,
  ): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: IpcRendererEvents[E]): void =>
      callback(data)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  },
}

contextBridge.exposeInMainWorld('syncboxApi', api)

export type SyncboxApi = typeof api
