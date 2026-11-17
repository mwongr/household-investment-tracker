import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ALLOWED_ORIGIN } from '../config.js';

export function applySecurityMiddleware(
    app: Express,
    allowedOrigin: string | string[] = ALLOWED_ORIGIN
): void {
    const origins = Array.isArray(allowedOrigin) ? allowedOrigin : [allowedOrigin];
    app.disable('x-powered-by');
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
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
                if (!origin || origins.includes(origin)) {
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
