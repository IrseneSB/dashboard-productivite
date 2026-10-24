// Preload script: runs before the UI loads, with access to a small part of
// Electron's API. contextBridge exposes exactly the functions listed in
// DashboardApi as `window.api`, and nothing else: the UI gets no direct access
// to Node.js, the file system or ipcRenderer.

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type DashboardApi } from '../shared/api';

const api: DashboardApi = {
  getDashboard: () => ipcRenderer.invoke(CHANNELS.getDashboard),
  createGoal: (input) => ipcRenderer.invoke(CHANNELS.createGoal, input),
  createProject: (input) => ipcRenderer.invoke(CHANNELS.createProject, input),
  createTask: (input) => ipcRenderer.invoke(CHANNELS.createTask, input),
  setTaskStatus: (taskId, status) =>
    ipcRenderer.invoke(CHANNELS.setTaskStatus, taskId, status),
};

contextBridge.exposeInMainWorld('api', api);
