import { z } from 'zod';
import { GITHUB_REPO_URL } from '../config.js';

export function compareSemver(v1: string, v2: string): number {
    const parse = (v: string): number[] => {
        const clean = v.trim().replace(/^v/i, '').split('-')[0]!.split('+')[0]!;
        const parts = clean.split('.').map(n => {
            const num = parseInt(n, 10);
            return Number.isNaN(num) ? 0 : num;
        });
        while (parts.length < 3) {
            parts.push(0);
        }
        return parts;
    };

    const p1 = parse(v1);
    const p2 = parse(v2);
    const maxLen = Math.max(p1.length, p2.length);

    for (let i = 0; i < maxLen; i++) {
        const num1 = p1[i] ?? 0;
        const num2 = p2[i] ?? 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

export function cleanGithubUrl(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) {
        return GITHUB_REPO_URL;
    }
    const mdMatch = raw.match(/\((https?:\/\/[^\s)]+)\)/);
    if (mdMatch?.[1]) {
        return mdMatch[1];
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return GITHUB_REPO_URL;
}

export const remoteVersionManifestSchema = z.object({
    latest_version: z.string().min(1),
    release_date: z.string().optional().default(''),
    github_url: z.unknown().transform(cleanGithubUrl),
    release_notes: z.string().optional().default(''),
});

export type RemoteVersionManifest = z.infer<typeof remoteVersionManifestSchema>;

export interface VersionStatus {
    currentVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
    releaseDate: string | null;
    githubUrl: string;
    releaseNotes: string | null;
    checkedAt: string;
    error?: string;
}
