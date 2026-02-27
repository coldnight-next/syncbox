import { contextBridge, ipcRenderer } from 'electron';
const api = {
    invoke: (channel, ...args) => {
        return ipcRenderer.invoke(channel, ...args);
    },
    on: (event, callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(event, listener);
        return () => ipcRenderer.removeListener(event, listener);
    },
};
contextBridge.exposeInMainWorld('syncboxApi', api);
