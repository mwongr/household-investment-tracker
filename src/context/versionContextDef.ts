import { createContext } from 'react';
import type { UpdaterState } from '../../electron/types';
import type { Distribution, VersionInfo } from '../types/version';

export interface VersionContextValue {
    versionInfo: VersionInfo | null;
    distribution: Distribution;
    dataDir: string | null;
    updateState: UpdaterState;
    downloadPercent: number | null;
    isChecking: boolean;
    showModal: boolean;
    openModal: () => void;
    closeModal: () => void;
    dismissForSession: () => void;
    skipThisVersion: () => void;
    checkForUpdates: (force?: boolean) => Promise<VersionInfo | null>;
    installUpdate: () => Promise<void>;
}

export const VersionContext = createContext<VersionContextValue | undefined>(undefined);
