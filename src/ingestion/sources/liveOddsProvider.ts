import { IngestionCache } from '../cache';
import { IngestionRetry } from '../retry';
import { fetchWithTimeout } from '../../lib/fetchUtils';
import { IngestionValidator } from '../validator';

/**
 * THE ODDS API PROVIDER
 * Fetches pre-match odds from global bookmakers.
 */
export class LiveOddsProvider {
    private static API_KEY = process.env.ODDS_API_KEY;
    private static BASE_URL = 'https://api.the-odds-api.com/v4/sports';

    static async getOdds(league: string, matchId: string): Promise<any> {
        if (!this.API_KEY) {
            console.warn('ODDS_API_KEY missing - using simulated market data');
            return this.getSimulatedOdds();
        }

        const cacheKey = `odds_${matchId}`;
        const cached = IngestionCache.get(cacheKey);
        if (cached) return cached;

        const result = await IngestionRetry.execute(async () => {
            const url = `${this.BASE_URL}/${league}/odds/?regions=uk&markets=h2h,totals&apiKey=${this.API_KEY}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`Odds API Error: ${response.status}`);
            const raw = await response.json();
            
            const validated = IngestionValidator.validateOdds(raw);
            if (!validated) throw new Error('Invalid odds data format from API');
            
            return validated;
        }, `OddsAPI_${matchId}`);

        if (result) {
            IngestionCache.set(cacheKey, result, IngestionCache.ODDS_DATA_TTL);
            return result;
        }

        return null;
    }

    private static getSimulatedOdds() {
        return {
            home: 2.1,
            draw: 3.4,
            away: 3.2,
            over15: 1.3,
            under35: 1.4
        };
    }
}
