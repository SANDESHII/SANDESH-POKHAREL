import { IngestionCache } from '../cache';
import { IngestionRetry } from '../retry';
import { fetchWithTimeout } from '../../lib/fetchUtils';

/**
 * API-FOOTBALL (RAPIDAPI) PROVIDER
 * Provides real-time match data, lineups, injuries, and high-fidelity statistics (including xG).
 */
export class RapidApiFootballProvider {
    private static BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';
    
    // Internal League Name -> API-Football League ID
    private static LEAGUE_ID_MAP: Record<string, number> = {
        'EPL': 39,
        'LA_LIGA': 140,
        'BUNDESLIGA': 78,
        'SERIE_A': 135,
        'LIGUE_1': 61,
        'EREDIVISIE': 88,
        'PRIMEIRA_LIGA': 94,
        'CHAMPIONSHIP': 40
    };

    private static getHeaders() {
        const key = process.env.RAPIDAPI_KEY;
        if (!key) {
            console.warn('[RAPIDAPI] Missing RAPIDAPI_KEY. Requests will likely fail.');
        }
        return {
            'x-rapidapi-key': key || '',
            'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
        };
    }

    /**
     * Fetches fixtures for a league and season
     */
    static async fetchFixtures(league: string, season: string): Promise<any[]> {
        const leagueId = this.LEAGUE_ID_MAP[league];
        if (!leagueId) return [];

        const cacheKey = `rapid_fixtures_${leagueId}_${season}`;
        const cached = IngestionCache.get<any[]>(cacheKey);
        if (cached) return cached;

        const url = `${this.BASE_URL}/fixtures?league=${leagueId}&season=${season}`;
        
        const result = await IngestionRetry.execute(async () => {
            const response = await fetchWithTimeout(url, { headers: this.getHeaders() });
            if (!response.ok) throw new Error(`RapidAPI Error: ${response.status}`);
            const data = await response.json();
            return data.response || [];
        }, `RapidAPI_Fixtures_${leagueId}`);

        if (result && result.length > 0) {
            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
        }
        return result || [];
    }

    /**
     * Fetches detailed statistics for a specific fixture (includes xG for top leagues)
     */
    static async fetchFixtureStatistics(fixtureId: number): Promise<any> {
        const cacheKey = `rapid_stats_${fixtureId}`;
        const cached = IngestionCache.get<any>(cacheKey);
        if (cached) return cached;

        const url = `${this.BASE_URL}/fixtures/statistics?fixture=${fixtureId}`;
        
        const result = await IngestionRetry.execute(async () => {
            const response = await fetchWithTimeout(url, { headers: this.getHeaders() });
            if (!response.ok) throw new Error(`RapidAPI Error: ${response.status}`);
            const data = await response.json();
            return data.response || [];
        }, `RapidAPI_Stats_${fixtureId}`);

        if (result) {
            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
        }
        return result;
    }

    /**
     * Fetches lineups for a specific fixture
     */
    static async fetchLineups(fixtureId: number): Promise<any> {
        const cacheKey = `rapid_lineups_${fixtureId}`;
        const cached = IngestionCache.get<any>(cacheKey);
        if (cached) return cached;

        const url = `${this.BASE_URL}/fixtures/lineups?fixture=${fixtureId}`;
        
        const result = await IngestionRetry.execute(async () => {
            const response = await fetchWithTimeout(url, { headers: this.getHeaders() });
            if (!response.ok) throw new Error(`RapidAPI Error: ${response.status}`);
            const data = await response.json();
            return data.response || [];
        }, `RapidAPI_Lineups_${fixtureId}`);

        if (result) {
            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
        }
        return result;
    }

    /**
     * Fetches injuries for a league and season
     */
    static async fetchInjuries(league: string, season: string): Promise<any[]> {
        const leagueId = this.LEAGUE_ID_MAP[league];
        if (!leagueId) return [];

        const cacheKey = `rapid_injuries_${leagueId}_${season}`;
        const cached = IngestionCache.get<any[]>(cacheKey);
        if (cached) return cached;

        const url = `${this.BASE_URL}/injuries?league=${leagueId}&season=${season}`;
        
        const result = await IngestionRetry.execute(async () => {
            const response = await fetchWithTimeout(url, { headers: this.getHeaders() });
            if (!response.ok) throw new Error(`RapidAPI Error: ${response.status}`);
            const data = await response.json();
            return data.response || [];
        }, `RapidAPI_Injuries_${leagueId}`);

        if (result && result.length > 0) {
            IngestionCache.set(cacheKey, result, IngestionCache.MATCH_DATA_TTL);
        }
        return result || [];
    }

    /**
     * Finds a fixture ID for a specific match-up on or near a date
     */
    static async findFixtureId(homeTeam: string, awayTeam: string, league: string, season: string): Promise<number | null> {
        const fixtures = await this.fetchFixtures(league, season);
        // Fuzzy match team names
        const fixture = fixtures.find(f => 
            (f.teams.home.name.toLowerCase().includes(homeTeam.toLowerCase()) || homeTeam.toLowerCase().includes(f.teams.home.name.toLowerCase())) &&
            (f.teams.away.name.toLowerCase().includes(awayTeam.toLowerCase()) || awayTeam.toLowerCase().includes(f.teams.away.name.toLowerCase()))
        );
        return fixture?.fixture.id || null;
    }
}
