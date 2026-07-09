import { CircuitBreaker } from './circuitBreaker';

/**
 * EXPONENTIAL BACKOFF RETRY WRAPPER
 * Implements 3 attempts with (500ms, 2s, 8s) backoff.
 */
export class IngestionRetry {
    private static backoffWithJitter(baseMs: number): number {
        return baseMs + Math.random() * baseMs * 0.5; // up to 50% random extra delay
    }

    static async execute<T>(
        fn: () => Promise<T>, 
        label: string = 'Fetch'
    ): Promise<T | null> {
        if (CircuitBreaker.isOpen(label)) {
            return null;
        }

        const backoffs = [500, 2000, 8000];
        
        for (let i = 0; i < backoffs.length; i++) {
            try {
                const result = await fn();
                CircuitBreaker.recordSuccess(label);
                return result;
            } catch (error) {
                const waitTime = this.backoffWithJitter(backoffs[i]);
                console.warn(`[${label}] Attempt ${i + 1} failed. Retrying in ${Math.round(waitTime)}ms (includes jitter)...`);
                if (i < backoffs.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    CircuitBreaker.recordFailure(label);
                }
            }
        }
        
        console.error(`[${label}] All 3 attempts failed.`);
        return null;
    }
}
