/**
 * EXPONENTIAL BACKOFF RETRY WRAPPER
 * Implements 3 attempts with (500ms, 2s, 8s) backoff.
 */
export class IngestionRetry {
    static async execute<T>(
        fn: () => Promise<T>, 
        label: string = 'Fetch'
    ): Promise<T | null> {
        const backoffs = [500, 2000, 8000];
        
        for (let i = 0; i < backoffs.length; i++) {
            try {
                return await fn();
            } catch (error) {
                console.warn(`[${label}] Attempt ${i + 1} failed. Retrying in ${backoffs[i]}ms...`);
                if (i < backoffs.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, backoffs[i]));
                }
            }
        }
        
        console.error(`[${label}] All 3 attempts failed.`);
        return null;
    }
}
