import React, { useEffect, useState, useCallback } from 'react';
import type { UpdaterState, UpdaterStatus } from '../../electron/types';
import { apiFetch } from '../api/client';
import type { Distribution, VersionInfo } from '../types/version';
import { VersionContext } from './versionContextDef';

const SKIPPED_VERSION_KEY = 'hit_skipped_version';
const REMIND_LATER_KEY = 'hit_remind_later';
const GITHUB_REPO_URL = 'https://github.com/mwongr/household-investment-tracker';

function mapUpdaterStatusToVersionInfo(status: UpdaterStatus, distribution: Distribution): VersionInfo {
    const updateAvailable =
        status.state === 'available' ||
        status.state === 'downloading' ||
        status.state === 'downloaded';

    return {
        currentVersion: status.currentVersion,
        latestVersion: status.latestVersion,
        updateAvailable,
        releaseDate: status.releaseDate,
        githubUrl: status.githubUrl || GITHUB_REPO_URL,
        releaseNotes: status.releaseNotes,
        checkedAt: status.checkedAt,
        distribution,
        error: status.error,
    };
}

export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [distribution, setDistribution] = useState<Distribution>('diy');
    const [dataDir, setDataDir] = useState<string | null>(null);
    const [updateState, setUpdateState] = useState<UpdaterState>('idle');
    const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
    const [isChecking, setIsChecking] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);

    const shouldSuppressModal = useCallback((latestVersion: string | null): boolean => {
        if (!latestVersion) return true;
        if (localStorage.getItem(SKIPPED_VERSION_KEY) === latestVersion) return true;
        if (sessionStorage.getItem(REMIND_LATER_KEY) === 'true') return true;
        return false;
    }, []);

    const checkForUpdates = useCallback(async (force = false): Promise<VersionInfo | null> => {
        const desktop = window.hitDesktop;
        if (desktop && distribution === 'exe') {
            setIsChecking(true);
            try {
                await desktop.checkForUpdates();
                const latest = await desktop.getUpdaterStatus();
                if (latest) {
                    const mapped = mapUpdaterStatusToVersionInfo(latest, 'exe');
                    setVersionInfo(mapped);
                    setUpdateState(latest.state);
                    setDownloadPercent(latest.percent ?? null);
                    if (force && mapped.updateAvailable) {
                        setShowModal(true);
                    }
                    return mapped;
                }
                return null;
            } catch (err) {
                console.warn('[VersionCheck] Desktop update check failed:', err);
                return null;
            } finally {
                setIsChecking(false);
            }
        }

        setIsChecking(true);
        try {
            const query = force ? '?force=true' : '';
            const data = await apiFetch<VersionInfo>(`/api/version${query}`);
            setVersionInfo(data);
            if (data.distribution) {
                setDistribution(data.distribution);
            }

            if (force && data.updateAvailable) {
                setShowModal(true);
            }

            return data;
        } catch (err) {
            console.warn('[VersionCheck] Unable to check version:', err);
            const fallback: VersionInfo = {
                currentVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0',
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: new Date().toISOString(),
                distribution,
                error: err instanceof Error ? err.message : 'Failed to reach version server',
            };
            setVersionInfo(fallback);
            return fallback;
        } finally {
            setIsChecking(false);
        }
    }, [distribution]);

    useEffect(() => {
        let isMounted = true;
        const desktop = window.hitDesktop;

        const applyDesktopStatus = (status: UpdaterStatus) => {
            if (!isMounted) return;
            const mapped = mapUpdaterStatusToVersionInfo(status, 'exe');
            setVersionInfo(mapped);
            setUpdateState(status.state);
            setDownloadPercent(status.percent ?? null);
            setIsChecking(status.state === 'checking');

            if (status.state === 'downloaded' && !shouldSuppressModal(status.latestVersion)) {
                setShowModal(true);
            }
        };

        if (desktop) {
            let unsubscribe: (() => void) | undefined;
            void desktop.getAppInfo().then((info) => {
                if (!isMounted) return;
                setDistribution(info.distribution);
                setDataDir(info.dataDir);

                if (info.distribution === 'exe') {
                    unsubscribe = desktop.onUpdaterStatus(applyDesktopStatus);
                    void desktop.getUpdaterStatus().then((existing) => {
                        if (existing) applyDesktopStatus(existing);
                    });
                } else {
                    void checkForUpdates().then((data) => {
                        if (!isMounted || !data || !data.updateAvailable) return;
                        if (!shouldSuppressModal(data.latestVersion)) {
                            setShowModal(true);
                        }
                    });
                }
            });

            return () => {
                isMounted = false;
                unsubscribe?.();
            };
        }

        void checkForUpdates().then((info) => {
            if (!isMounted || !info || !info.updateAvailable) {
                return;
            }
            if (!shouldSuppressModal(info.latestVersion)) {
                setShowModal(true);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [checkForUpdates, shouldSuppressModal]);

    const openModal = useCallback(() => {
        setShowModal(true);
    }, []);

    const closeModal = useCallback(() => {
        setShowModal(false);
    }, []);

    const dismissForSession = useCallback(() => {
        sessionStorage.setItem(REMIND_LATER_KEY, 'true');
        setShowModal(false);
    }, []);

    const skipThisVersion = useCallback(() => {
        if (versionInfo?.latestVersion) {
            localStorage.setItem(SKIPPED_VERSION_KEY, versionInfo.latestVersion);
        }
        setShowModal(false);
    }, [versionInfo]);

    const installUpdate = useCallback(async () => {
        if (window.hitDesktop && distribution === 'exe') {
            await window.hitDesktop.installUpdate();
        }
    }, [distribution]);

    return (
        <VersionContext.Provider
            value={{
                versionInfo,
                distribution,
                dataDir,
                updateState,
                downloadPercent,
                isChecking,
                showModal,
                openModal,
                closeModal,
                dismissForSession,
                skipThisVersion,
                checkForUpdates,
                installUpdate,
            }}
        >
            {children}
        </VersionContext.Provider>
    );
};
