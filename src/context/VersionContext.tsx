import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../api/client';
import type { VersionInfo } from '../types/version';
import { VersionContext } from './versionContextDef';

const SKIPPED_VERSION_KEY = 'hit_skipped_version';
const REMIND_LATER_KEY = 'hit_remind_later';

export const VersionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [isChecking, setIsChecking] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);

    const checkForUpdates = useCallback(async (force = false): Promise<VersionInfo | null> => {
        setIsChecking(true);
        try {
            const query = force ? '?force=true' : '';
            const data = await apiFetch<VersionInfo>(`/api/version${query}`);
            setVersionInfo(data);

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
                githubUrl: 'https://github.com/mwongr/household-investment-tracker',
                releaseNotes: null,
                checkedAt: new Date().toISOString(),
                error: err instanceof Error ? err.message : 'Failed to reach version server',
            };
            setVersionInfo(fallback);
            return fallback;
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        checkForUpdates().then(info => {
            if (!isMounted || !info || !info.updateAvailable || !info.latestVersion) {
                return;
            }

            const skipped = localStorage.getItem(SKIPPED_VERSION_KEY);
            if (skipped === info.latestVersion) {
                return;
            }

            const remindLater = sessionStorage.getItem(REMIND_LATER_KEY);
            if (remindLater === 'true') {
                return;
            }

            setShowModal(true);
        });

        return () => {
            isMounted = false;
        };
    }, [checkForUpdates]);

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

    return (
        <VersionContext.Provider
            value={{
                versionInfo,
                isChecking,
                showModal,
                openModal,
                closeModal,
                dismissForSession,
                skipThisVersion,
                checkForUpdates,
            }}
        >
            {children}
        </VersionContext.Provider>
    );
};
