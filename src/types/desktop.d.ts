import type { HitDesktopApi } from '../../electron/types';

declare global {
    interface Window {
        hitDesktop?: HitDesktopApi;
    }
}

export {};
