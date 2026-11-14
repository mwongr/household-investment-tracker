import express, { type Express } from 'express';
import { ALLOWED_ORIGIN, HOST, PORT } from './config.js';
import { db } from './lib/db.js';
import { applyRateLimiters, applySecurityMiddleware, errorHandler } from './middleware/security.js';
import { createMarketRouter } from './routes/market.js';
import { createPortfolioRouter } from './routes/portfolio.js';
import { createStateRouter } from './routes/state.js';
import { createTaxRouter } from './routes/tax.js';
import { createVersionRouter } from './routes/version.js';

export function createApp(options?: {
    store?: typeof db;
    allowedOrigin?: string;
    enableRateLimit?: boolean;
}): Express {
    const store = options?.store ?? db;
    const app = express();

    applySecurityMiddleware(app, options?.allowedOrigin ?? ALLOWED_ORIGIN);
    if (options?.enableRateLimit !== false) {
        applyRateLimiters(app);
    }

    app.use('/api', createStateRouter(store));
    app.use('/api', createTaxRouter(store));
    app.use('/api', createPortfolioRouter());
    app.use('/api', createMarketRouter());
    app.use('/api', createVersionRouter());

    app.use(errorHandler);
    return app;
}

const isDirectRun =
    process.argv[1] &&
    (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isDirectRun) {
    db.init();
    const app = createApp();
    const server = app.listen(PORT, HOST, () => {
        console.log(`Server listening on http://${HOST}:${PORT}`);
    });

    const shutdown = async () => {
        server.close();
        await db.flush();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
