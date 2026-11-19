import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Asset } from '../types';
import type { DividendMetadata, DividendMetadataResponse } from '../types/dividends';

function isCryptoTicker(symbol: string): boolean {
    return symbol.endsWith('-USD') || symbol.endsWith('-CAD');
}

export interface UseDividendMetadataResult {
    metadataMap: Map<string, DividendMetadata>;
    fetchedAt: string | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

interface FetchState {
    requestKey: string;
    items: DividendMetadata[];
    fetchedAt: string | null;
    error: string | null;
}

export function useDividendMetadata(assets: Asset[]): UseDividendMetadataResult {
    const [fetchState, setFetchState] = useState<FetchState | null>(null);
    const [refreshTick, setRefreshTick] = useState<number>(0);

    const tickersKey = useMemo(() => {
        const unique = Array.from(
            new Set(
                assets
                    .filter((a) => a.quantity > 0)
                    .map((a) => a.ticker.trim().toUpperCase())
                    .filter((sym) => sym.length > 0 && !isCryptoTicker(sym))
            )
        ).sort();
        return unique.join(',');
    }, [assets]);

    const requestKey = tickersKey ? `${tickersKey}#${refreshTick}` : '';

    const refresh = useCallback(() => {
        setRefreshTick((t) => t + 1);
    }, []);

    useEffect(() => {
        if (!tickersKey || !requestKey) return;

        const controller = new AbortController();
        const query = encodeURIComponent(tickersKey);

        apiFetch<DividendMetadataResponse>(`/api/dividends/metadata?symbols=${query}`, {
            signal: controller.signal,
        })
            .then((res) => {
                setFetchState({
                    requestKey,
                    items: res.items ?? [],
                    fetchedAt: res.fetchedAt ?? null,
                    error: null,
                });
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                const msg = err instanceof Error ? err.message : 'Failed to load dividend metadata';
                setFetchState({
                    requestKey,
                    items: [],
                    fetchedAt: null,
                    error: msg,
                });
            });

        return () => {
            controller.abort();
        };
    }, [tickersKey, requestKey]);

    const loading = Boolean(requestKey) && fetchState?.requestKey !== requestKey;
    const error = requestKey && fetchState?.requestKey === requestKey ? fetchState.error : null;
    const fetchedAt =
        requestKey && fetchState?.requestKey === requestKey ? fetchState.fetchedAt : null;

    const metadataMap = useMemo(() => {
        const map = new Map<string, DividendMetadata>();
        if (!requestKey || fetchState?.requestKey !== requestKey) {
            return map;
        }
        for (const item of fetchState.items) {
            map.set(item.symbol.toUpperCase(), item);
        }
        return map;
    }, [fetchState, requestKey]);

    return { metadataMap, fetchedAt, loading, error, refresh };
}
