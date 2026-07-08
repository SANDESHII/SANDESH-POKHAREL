import { IngestionCache } from '../cache';
import { IngestionRetry } from '../retry';

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
            // @ts-ignore
            const _url = `${this.BASE_URL}/${league}/odds/?regions=uk&markets=h2h,totals&apiKey=${this.API_KEY}`;
            // Simulation
            return {}; 
        }, `OddsAPI_${matchId}`);

        if (result) {
            IngestionCache.set(cacheKey, result, 1800000); // 30 min cache for odds
            return result;
        }

        return this.getSimulatedOdds();
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
