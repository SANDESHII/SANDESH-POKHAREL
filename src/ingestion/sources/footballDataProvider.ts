import Papa from 'papaparse';
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
            console.log(`[INGEST] Fetching historical data from ${url}`);
            const response = await fetchWithTimeout(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const csvText = await response.text();
            
            // PapaParse handles CSV to JSON conversion
            const parsed = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
            });

            if (parsed.errors.length > 0) {
                console.warn(`[INGEST] CSV Parsing errors for ${league}:`, parsed.errors);
            }

            const validated = parsed.data
                .map(r => IngestionValidator.validateRawMatch(r, league, season))
                .filter((r): r is RawMatchData => r !== null);

            console.log(`[INGEST] Successfully validated ${validated.length}/${parsed.data.length} rows for ${league}`);
            return validated;
        }, `FootballDataCSV_${league}`);

        if (result && result.length > 0) {
            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
            return result;
        }
        
        return [];
    }
}
