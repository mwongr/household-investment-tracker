import { AlertTriangle } from 'lucide-react';
import type { QuoteStatus } from '../context/DataContext';

const YAHOO_EXCHANGE_SUFFIXES = ['TO', 'V', 'CN', 'NE', 'L', 'AX', 'HK', 'DE', 'PA', 'SW', 'AS'];

/** A short hint about what the Yahoo-format symbol probably looks like. */
function yahooSymbolHint(ticker: string): string {
    const t = ticker.toUpperCase();
    const dot = t.lastIndexOf('.');
    if (dot > 0) {
        const suffix = t.slice(dot + 1);
        if (!YAHOO_EXCHANGE_SUFFIXES.includes(suffix)) {
            // e.g. BRK.B → BRK-B on Yahoo, or a TSX share class like CTC.A → CTC-A.TO
            const dashed = `${t.slice(0, dot)}-${suffix}`;
            return `Yahoo writes share classes with a dash, e.g. ${dashed} (US) or ${dashed}.TO (TSX).`;
        }
        return 'Check the symbol is still listed under this exchange suffix on Yahoo Finance.';
    }
    return `Canadian listings need an exchange suffix, e.g. ${t}.TO (TSX) or ${t}.V (TSX Venture).`;
}

function describe(ticker: string, status: QuoteStatus): string {
    return status === 'not_found'
        ? `Yahoo Finance doesn't recognise "${ticker}", so its price isn't being updated. ${yahooSymbolHint(ticker)} Use the pencil icon to rename it.`
        : `Couldn't fetch a live price for "${ticker}" — showing the last known price.`;
}

export function QuoteStatusBadge({ ticker, status }: { ticker: string; status?: QuoteStatus }) {
    if (!status) return null;
    const notFound = status === 'not_found';
    return (
        <span
            role="status"
            title={describe(ticker, status)}
            className={`inline-flex items-center gap-1 text-[10px] font-sans font-bold px-1.5 py-0.5 rounded border ${
                notFound
                    ? 'bg-red-500/15 border-red-500/40 text-red-400'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
            }`}
        >
            <AlertTriangle size={11} aria-hidden="true" />
            {notFound ? 'Symbol not found' : 'Price stale'}
        </span>
    );
}

/** Banner listing tickers Yahoo didn't recognise. Renders nothing when all symbols resolved. */
export function UnknownSymbolsBanner({
    quoteErrors,
    tickers,
}: {
    quoteErrors: Record<string, QuoteStatus>;
    /** Limit to these tickers (e.g. one account's holdings); defaults to all. */
    tickers?: string[];
}) {
    const scope = tickers ? new Set(tickers) : null;
    const unknown = Object.entries(quoteErrors)
        .filter(([t, s]) => s === 'not_found' && (!scope || scope.has(t)))
        .map(([t]) => t)
        .sort();
    if (unknown.length === 0) return null;

    return (
        <div
            role="alert"
            className="bg-red-500/15 border border-red-500/40 text-red-400 px-4 py-3.5 rounded-xl flex items-start gap-2.5 text-sm"
        >
            <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div>
                <p className="font-semibold">
                    {unknown.length === 1 ? 'Symbol' : 'Symbols'} not found on Yahoo Finance:{' '}
                    <span className="font-mono">{unknown.join(', ')}</span>
                </p>
                <p className="mt-1 text-red-300/90">
                    Their prices aren't updating, so values shown use the last known or purchase price.{' '}
                    {yahooSymbolHint(unknown[0]!)} Rename the holding with the pencil icon on its account page.
                </p>
            </div>
        </div>
    );
}
