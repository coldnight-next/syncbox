import type { IpcChannel, IpcParams, IpcReturn, IpcRendererEvents } from '../shared/types/ipc';
declare const api: {
    invoke: <C extends IpcChannel>(channel: C, ...args: IpcParams<C>) => Promise<IpcReturn<C>>;
    on: <E extends keyof IpcRendererEvents>(event: E, callback: (data: IpcRendererEvents[E]) => void) => (() => void);
};
export type SyncboxApi = typeof api;
export {};
//# sourceMappingURL=api.d.ts.map