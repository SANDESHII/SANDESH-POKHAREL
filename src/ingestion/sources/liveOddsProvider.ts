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

    private static LEAGUE_MAP: Record<string, string> = {
        'EPL': 'soccer_epl',
        'PREMIER': 'soccer_epl',
        'CHAMPIONSHIP': 'soccer_efl_championship',
        'BUNDESLIGA': 'soccer_germany_bundesliga',
        'LA_LIGA': 'soccer_spain_la_liga',
        'SERIE_A': 'soccer_italy_serie_a',
        'LIGUE_1': 'soccer_france_ligue_one',
        'LIGUE_2': 'soccer_france_ligue_two',
        'EREDIVISIE': 'soccer_netherlands_eredivisie',
        'PRIMEIRA': 'soccer_portugal_primeira_liga'
    };

    static async getOdds(league: string, matchId: string): Promise<any> {
        if (!this.API_KEY) {
            console.warn('ODDS_API_KEY missing - using simulated market data');
            return this.getSimulatedOdds();
        }

        const cacheKey = `odds_${matchId}`;
        const cached = IngestionCache.get(cacheKey);
        if (cached) return cached;

        const normalizedLeague = String(league || '').toUpperCase();
        let oddsLeague = 'soccer_epl';
        
        for (const [key, value] of Object.entries(this.LEAGUE_MAP)) {
            if (normalizedLeague.includes(key) || key.includes(normalizedLeague)) {
                oddsLeague = value;
                break;
            }
        }

        const result = await IngestionRetry.execute(async () => {
            const url = `${this.BASE_URL}/${oddsLeague}/odds/?regions=uk&markets=h2h,totals&apiKey=${this.API_KEY}`;
            const response = await fetchWithTimeout(url);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const error: any = new Error(`Odds API Error: ${response.status} - ${errData.message || response.statusText}`);
                if (response.status === 401 || response.status === 403) {
                    error.isFatal = true;
                }
                throw error;
            }
            const raw = await response.json();
            
            // raw is an array of matches. Find the one matching matchId (which is "Home-Away")
            const [homeTarget, awayTarget] = matchId.split('-').map(s => s.trim().toUpperCase());
            const matchData = Array.isArray(raw) ? raw.find((m: any) => {
                const h = String(m.home_team || '').toUpperCase();
                const a = String(m.away_team || '').toUpperCase();
                return (h.includes(homeTarget) || homeTarget.includes(h)) && 
                       (a.includes(awayTarget) || awayTarget.includes(a));
            }) : raw;

            if (!matchData) throw new Error(`No odds found for match: ${matchId}`);
            
            const validated = IngestionValidator.validateOdds(matchData);
            if (!validated) throw new Error('Invalid odds data format from API');
            
            return validated;
        }, `OddsAPI_${matchId}`);

        if (result) {
            IngestionCache.set(cacheKey, result, IngestionCache.ODDS_DATA_TTL);
            return result;
        }

        console.warn(`[OddsAPI] Falling back to simulated data for ${matchId} due to API failure.`);
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
