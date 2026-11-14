import { createContext } from 'react';
import type { VersionInfo } from '../types/version';

export interface VersionContextValue {
    versionInfo: VersionInfo | null;
    isChecking: boolean;
    showModal: boolean;
    openModal: () => void;
    closeModal: () => void;
    dismissForSession: () => void;
    skipThisVersion: () => void;
    checkForUpdates: (force?: boolean) => Promise<VersionInfo | null>;
}

export const VersionContext = createContext<VersionContextValue | undefined>(undefined);
