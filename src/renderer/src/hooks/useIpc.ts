import { useCallback } from 'react'
import type { IpcChannel, IpcParams, IpcReturn } from '@shared/types/ipc'
import { ipc } from '../lib/ipc-client'

export function useIpc() {
  const invoke = useCallback(
    <C extends IpcChannel>(channel: C, ...args: IpcParams<C>): Promise<IpcReturn<C>> => {
      return ipc.invoke(channel, ...args)
    },
    [],
  )

  return { invoke }
}
