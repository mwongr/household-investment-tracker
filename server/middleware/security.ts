import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ALLOWED_ORIGIN } from '../config.js';

/** True when the origin's host is loopback, a .local/.lan mDNS name, or a private IPv4/IPv6 address. */
export function isPrivateNetworkOrigin(origin: string): boolean {
    let host: string;
    try {
        const url = new URL(origin);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    } catch {
        return false;
    }
    if (!host) return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host.endsWith('.local') || host.endsWith('.lan') || host.endsWith('.home.arpa')) return true;
    if (!host.includes('.') && !host.includes(':')) return true; // bare LAN hostname, e.g. "myhost"
    const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        const [a, b] = [Number(v4[1]), Number(v4[2])];
        return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
    }
    // IPv6 loopback, unique-local (fc00::/7) and link-local (fe80::/10)
    return host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}

/**
 * Allowed-origin entries may be exact origins, "private" (any private-network origin)
 * or "*" (any origin). Entries can also be comma-separated, e.g. ALLOWED_ORIGIN="private,https://x.y".
 */
export function isOriginAllowed(origin: string, entries: string[]): boolean {
    return entries.some((entry) => {
        if (entry === '*') return true;
        if (entry === 'private') return isPrivateNetworkOrigin(origin);
        return entry === origin;
    });
}

export function applySecurityMiddleware(
    app: Express,
    allowedOrigin: string | string[] = ALLOWED_ORIGIN
): void {
    const configured = Array.isArray(allowedOrigin) ? allowedOrigin : [allowedOrigin];
    // Normalised per request: startServer appends its bound origin to this array after setup.
    const currentOrigins = () =>
        configured
            .flatMap((o) => o.split(','))
            .map((o) => o.trim().toLowerCase())
            .filter(Boolean);
    app.disable('x-powered-by');
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    fontSrc: ["'self'", 'data:'],
                    imgSrc: ["'self'", 'data:', 'blob:'],
                    connectSrc: ["'self'"],
                    upgradeInsecureRequests: null,
                },
            },
        })
    );
    app.use(
        cors({
            origin(origin, callback) {
                // Allow same-origin / server-to-server / curl (no Origin header) and configured origins
                if (!origin || isOriginAllowed(origin.toLowerCase(), currentOrigins())) {
                    callback(null, true);
                    return;
                }
                callback(new Error('CORS origin denied'));
            },
            methods: ['GET', 'POST', 'DELETE'],
        })
    );
    app.use(express.json({ limit: '10mb' }));
}

export function applyRateLimiters(app: Express): void {
    app.use(
        '/api',
        rateLimit({
            windowMs: 60_000,
            limit: 300,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many requests, please slow down.' },
        })
    );

    app.use(
        '/api/sync',
        rateLimit({
            windowMs: 60_000,
            limit: 60,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Sync rate limit exceeded.' },
        })
    );
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof Error && err.message === 'CORS origin denied') {
        res.status(403).json({ error: 'Origin not allowed' });
        return;
    }
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
}
