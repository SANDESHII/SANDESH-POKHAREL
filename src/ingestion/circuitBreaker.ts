/**
 * CIRCUIT BREAKER
 * Prevents redundant calls to failing external sources.
 */
export class CircuitBreaker {
    private static failures = new Map<string, { count: number; openedAt: number }>();
    private static readonly THRESHOLD = 3;
    private static readonly COOLDOWN_MS = 60000; // 1 minute

    static isOpen(source: string): boolean {
        const state = this.failures.get(source);
        if (!state) return false;
        if (state.count < this.THRESHOLD) return false;
        
        // Check if cooldown has expired
        if (Date.now() - state.openedAt > this.COOLDOWN_MS) {
            console.log(`[CIRCUIT] Cooldown expired for ${source}. Allowing retry.`);
            this.failures.delete(source); 
            return false;
        }
        
        console.warn(`[CIRCUIT] Breaker is OPEN for ${source}. Skipping call.`);
        return true; 
    }

    static recordFailure(source: string): void {
        const state = this.failures.get(source) || { count: 0, openedAt: Date.now() };
        state.count++;
        if (state.count === this.THRESHOLD) {
            console.error(`[CIRCUIT] Threshold reached. Opening breaker for ${source}.`);
            state.openedAt = Date.now();
        }
        this.failures.set(source, state);
    }

    static recordSuccess(source: string): void {
        if (this.failures.has(source)) {
            console.log(`[CIRCUIT] Resetting breaker for ${source} after success.`);
            this.failures.delete(source);
        }
    }
}
