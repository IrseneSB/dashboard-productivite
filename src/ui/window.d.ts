import type { DashboardApi } from '../shared/api';

// Tells TypeScript that the preload script adds `window.api` (see preload.ts).
declare global {
  interface Window {
    api: DashboardApi;
  }
}
