/**
 * Robust fetching utility with AbortController timeout.
 * Prevents application hanging on slow external API responses.
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, ms: number = 5000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error(`Fetch request timed out after ${ms}ms: ${url}`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
