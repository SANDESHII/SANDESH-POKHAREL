/**
 * CENTRALIZED INGESTION CACHE
 * Prevents redundant API calls and respects rate limits.
 */
export class IngestionCache {
    private static cache = new Map<string, { data: any; expiry: number }>();
    static DEFAULT_TTL = 3600000; // 1 hour
    static MATCH_DATA_TTL = 86400000; // 24 hours
    static ODDS_DATA_TTL = 1800000; // 30 minutes
    static WEATHER_DATA_TTL = 43200000; // 12 hours
    private static PERMANENT_TTL = 315360000000; // ~10 years (forever)

    static set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl
        });
    }

    static setPermanent(key: string, data: any): void {
        this.set(key, data, this.PERMANENT_TTL);
    }

    static get<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (!cached) return null;
        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }
        return cached.data as T;
    }

    static clear(): void {
        this.cache.clear();
    }
}
