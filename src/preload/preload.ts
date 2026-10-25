// Preload script: runs before the UI loads, with access to a small part of
// Electron's API. contextBridge exposes exactly the functions listed in
// DashboardApi as `window.api`, and nothing else: the UI gets no direct access
// to Node.js, the file system or ipcRenderer.

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type DashboardApi } from '../shared/api';

// One forwarding function per channel. Only these channels can be reached
// from the UI, whatever code runs there.
const api = Object.fromEntries(
  Object.entries(CHANNELS).map(([name, channel]) => [
    name,
    (...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  ]),
) as unknown as DashboardApi;

contextBridge.exposeInMainWorld('api', api);
