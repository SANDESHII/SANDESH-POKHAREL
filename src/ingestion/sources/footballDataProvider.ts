import { RawMatchData } from '../schema';
import { IngestionCache } from '../cache';
import { IngestionRetry } from '../retry';

import { IngestionValidator } from '../validator';
import { fetchWithTimeout } from '../../lib/fetchUtils';

/**
 * FOOTBALL-DATA.CO.UK PROVIDER
 * Fetches historical results and odds from free CSV sources.
 */
export class FootballDataProvider {
    private static BASE_URL = 'https://www.football-data.co.uk/mmz4281';

    /**
     * Maps internal league names to CSV codes
     */
    private static LEAGUE_MAP: Record<string, string> = {
        'EPL': 'E0',
        'CHAMPIONSHIP': 'E1',
        'BUNDESLIGA': 'D1',
        'LA_LIGA': 'SP1',
        'SERIE_A': 'I1',
        'LIGUE_1': 'F1'
    };

    static async fetchSeasonData(league: string, season: string): Promise<RawMatchData[]> {
        const cacheKey = `fd_${league}_${season}`;
        const cached = IngestionCache.get<RawMatchData[]>(cacheKey);
        if (cached) return cached;

        const leagueCode = this.LEAGUE_MAP[league] || 'E0';
        const seasonCode = season.replace('/', ''); // e.g., 2324
        const url = `${this.BASE_URL}/${seasonCode}/${leagueCode}.csv`;

        const result = await IngestionRetry.execute(async () => {
            console.log(`Fetching historical data from ${url}`);
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            // In a real system, we would parse CSV here.
            // For this simulation, we'll imagine we have rows and validate them.
            const rows: any[] = []; 
            const validated = rows
                .map(r => IngestionValidator.validateRawMatch(r, league, season))
                .filter((r): r is RawMatchData => r !== null);

            return validated;
        }, `FootballDataCSV_${league}`);

        if (result) {
            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
            return result;
        }
        
        return [];
    }
}
