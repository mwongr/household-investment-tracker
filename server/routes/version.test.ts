import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRemoteVersion, createVersionRouter, resetVersionCache } from './version.js';
import express from 'express';
import type http from 'http';

describe('Version Route and Check', () => {
    let server: http.Server | null = null;

    beforeEach(() => {
        resetVersionCache();
    });

    afterEach(async () => {
        if (server) {
            await new Promise<void>(resolve => server!.close(() => resolve()));
            server = null;
        }
    });

    it('identifies update available when latest > current (with v prefix)', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                tag_name: 'v1.1.0',
                published_at: '2026-12-01T14:30:00Z',
                html_url: 'https://github.com/mwongr/household-investment-tracker/releases/tag/v1.1.0',
                body: 'New tax features and bug fixes',
            }),
        } as unknown as Response);

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.currentVersion).toBe('1.0.0');
        expect(status.latestVersion).toBe('1.1.0');
        expect(status.updateAvailable).toBe(true);
        expect(status.releaseDate).toBe('2026-12-01');
        expect(status.githubUrl).toBe(
            'https://github.com/mwongr/household-investment-tracker/releases/tag/v1.1.0'
        );
        expect(status.releaseNotes).toBe('New tax features and bug fixes');
        expect(status.distribution).toBe('diy');
        expect(status.error).toBeUndefined();
    });

    it('identifies up-to-date when latest <= current and handles null body', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                tag_name: '1.0.0',
                published_at: '2026-11-13T00:00:00Z',
                html_url: 'https://github.com/mwongr/household-investment-tracker/releases/tag/v1.0.0',
                body: null,
            }),
        } as unknown as Response);

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.updateAvailable).toBe(false);
        expect(status.latestVersion).toBe('1.0.0');
        expect(status.releaseNotes).toBeNull();
        expect(status.error).toBeUndefined();
    });

    it('handles remote fetch failures gracefully without crashing', async () => {
        const mockFetcher = vi.fn().mockRejectedValue(new Error('Network error'));

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.updateAvailable).toBe(false);
        expect(status.latestVersion).toBeNull();
        expect(status.error).toBe('Network error');
    });

    it('treats 404 (no published releases) as up-to-date without error', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        } as unknown as Response);

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.updateAvailable).toBe(false);
        expect(status.latestVersion).toBeNull();
        expect(status.error).toBeUndefined();
    });

    it('reports rate limit error on 403 responses', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
        } as unknown as Response);

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.updateAvailable).toBe(false);
        expect(status.latestVersion).toBeNull();
        expect(status.error).toContain('rate limit');
    });

    it('handles HTTP 500 error responses gracefully', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        } as unknown as Response);

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.updateAvailable).toBe(false);
        expect(status.latestVersion).toBeNull();
        expect(status.error).toContain('HTTP 500');
    });

    it('handles malformed JSON schema gracefully', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                unknown_field: 123,
            }),
        } as unknown as Response);

        const status = await checkRemoteVersion({ currentVersion: '1.0.0', fetcher: mockFetcher });

        expect(status.updateAvailable).toBe(false);
        expect(status.error).toContain('Invalid GitHub release format');
    });

    it('serves GET /version via express router', async () => {
        const mockFetcher = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                tag_name: 'v1.0.5',
                published_at: '2026-11-20T10:00:00Z',
                html_url: 'https://github.com/mwongr/household-investment-tracker/releases/tag/v1.0.5',
                body: 'Patch update',
            }),
        } as unknown as Response);

        const app = express();
        app.use(createVersionRouter({ currentVersion: '1.0.0', fetcher: mockFetcher }));

        server = app.listen(0);
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;

        const res = await fetch(`http://127.0.0.1:${port}/version`);
        expect(res.status).toBe(200);

        const data = (await res.json()) as { updateAvailable: boolean; latestVersion: string };
        expect(data.updateAvailable).toBe(true);
        expect(data.latestVersion).toBe('1.0.5');
    });
});
