export class ApiError extends Error {
    readonly status: number;
    readonly requiresManualPrice?: boolean;

    constructor(message: string, status: number, requiresManualPrice?: boolean) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.requiresManualPrice = requiresManualPrice;
    }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, init);
    if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
            error?: string;
            requiresManualPrice?: boolean;
        };
        throw new ApiError(
            errBody.error || `HTTP ${response.status}`,
            response.status,
            errBody.requiresManualPrice
        );
    }
    return response.json() as Promise<T>;
}

export function apiPostJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return apiFetch<T>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
    });
}
