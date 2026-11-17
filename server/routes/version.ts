import { Router } from 'express';
import {
    APP_VERSION,
    CACHE_TTL,
    GITHUB_REPO_URL,
    VERSION_CHECK_URL,
    type Distribution,
} from '../config.js';
import {
    compareSemver,
    githubReleaseSchema,
    type VersionStatus,
} from '../lib/version.js';

interface CacheEntry {
    data: VersionStatus;
    timestamp: number;
}

let versionCache: CacheEntry | null = null;

function formatReleaseDate(publishedAt: string | null | undefined): string | null {
    if (!publishedAt) return null;
    const trimmed = publishedAt.trim();
    if (!trimmed) return null;
    const isoDate = trimmed.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : trimmed;
}

export async function checkRemoteVersion(options?: {
    currentVersion?: string;
    url?: string;
    distribution?: Distribution;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
}): Promise<VersionStatus> {
    const currentVersion = options?.currentVersion ?? APP_VERSION;
    const distribution = options?.distribution ?? 'diy';
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
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': `HouseholdInvestmentTracker/${currentVersion}`,
            },
        });

        if (res.status === 404) {
            // No published releases on GitHub yet — treat cleanly as up-to-date rather than an error
            return {
                currentVersion,
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: nowIso,
                distribution,
            };
        }

        if (res.status === 403 || res.status === 429) {
            return {
                currentVersion,
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: nowIso,
                distribution,
                error: 'GitHub API rate limit exceeded. Please try again later.',
            };
        }

        if (!res.ok) {
            return {
                currentVersion,
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: nowIso,
                distribution,
                error: `HTTP ${res.status} when checking version`,
            };
        }

        const rawJson = await res.json();
        const parseResult = githubReleaseSchema.safeParse(rawJson);

        if (!parseResult.success) {
            return {
                currentVersion,
                latestVersion: null,
                updateAvailable: false,
                releaseDate: null,
                githubUrl: GITHUB_REPO_URL,
                releaseNotes: null,
                checkedAt: nowIso,
                distribution,
                error: 'Invalid GitHub release format',
            };
        }

        const release = parseResult.data;
        const latestVersion = release.tag_name.trim().replace(/^v/i, '');
        const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;
        const releaseNotes = release.body?.trim() ? release.body : null;

        return {
            currentVersion,
            latestVersion,
            updateAvailable,
            releaseDate: formatReleaseDate(release.published_at),
            githubUrl: release.html_url || GITHUB_REPO_URL,
            releaseNotes,
            checkedAt: nowIso,
            distribution,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reach GitHub Releases API';
        return {
            currentVersion,
            latestVersion: null,
            updateAvailable: false,
            releaseDate: null,
            githubUrl: GITHUB_REPO_URL,
            releaseNotes: null,
            checkedAt: nowIso,
            distribution,
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
    distribution?: Distribution;
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

        // Only cache successful checks
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
