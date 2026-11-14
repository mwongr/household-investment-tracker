import { Router } from 'express';
import {
    APP_VERSION,
    CACHE_TTL,
    GITHUB_REPO_URL,
    VERSION_CHECK_URL,
} from '../config.js';
import {
    compareSemver,
    remoteVersionManifestSchema,
    type VersionStatus,
} from '../lib/version.js';

interface CacheEntry {
    data: VersionStatus;
    timestamp: number;
}

let versionCache: CacheEntry | null = null;

export async function checkRemoteVersion(options?: {
    currentVersion?: string;
    url?: string;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
}): Promise<VersionStatus> {
    const currentVersion = options?.currentVersion ?? APP_VERSION;
    const url = options?.url ?? VERSION_CHECK_URL;
    const fetchFn = options?.fetcher ?? globalThis.fetch;
    const nowIso = new Date().toISOString();

    try {
        const timeoutSignal = AbortSignal.timeout(6000);
        const signal = options?.signal
            ? AbortSignal.any([options.signal, timeoutSignal])
            : timeoutSignal;

        const res = await fetchFn(url, {
            signal,
            headers: {
                Accept: 'application/json',
                'User-Agent': `HouseholdInvestmentTracker/${currentVersion}`,
            },
        });

        if (!res.ok) {
            return {
                currentVersion,
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: nowIso,
                error: `HTTP ${res.status} when checking version`,
            };
        }

        const rawJson = await res.json();
        const parseResult = remoteVersionManifestSchema.safeParse(rawJson);

        if (!parseResult.success) {
            return {
                currentVersion,
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: nowIso,
                error: 'Invalid version manifest format',
            };
        }

        const manifest = parseResult.data;
        const updateAvailable = compareSemver(manifest.latest_version, currentVersion) > 0;

        return {
            currentVersion,
            latestVersion: manifest.latest_version,
            updateAvailable,
            releaseDate: manifest.release_date || null,
            githubUrl: manifest.github_url || GITHUB_REPO_URL,
            releaseNotes: manifest.release_notes || null,
            checkedAt: nowIso,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reach version server';
        return {
            currentVersion,
            latestVersion: null,
            updateAvailable: false,
            releaseDate: null,
            githubUrl: GITHUB_REPO_URL,
            releaseNotes: null,
            checkedAt: nowIso,
            error: message,
        };
    }
}

export function resetVersionCache(): void {
    versionCache = null;
}

export function createVersionRouter(options?: {
    currentVersion?: string;
    url?: string;
    fetcher?: typeof fetch;
}): Router {
    const router = Router();

    router.get('/version', async (req, res) => {
        const force = req.query['force'] === 'true';
        const now = Date.now();

        if (!force && versionCache && now - versionCache.timestamp < CACHE_TTL.VERSION_CHECK) {
            res.json(versionCache.data);
            return;
        }

        const status = await checkRemoteVersion(options);

        // Only cache successful checks (or checks with resolved latestVersion)
        if (!status.error) {
            versionCache = {
                data: status,
                timestamp: now,
            };
        }

        res.json(status);
    });

    return router;
}
