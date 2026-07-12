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
        const isPlaceholder = !this.API_KEY || this.API_KEY === 'undefined' || this.API_KEY.length < 5;
        if (isPlaceholder) {
            console.warn('ODDS_API_KEY missing or invalid - using simulated market data');
            return this.getSimulatedOdds(matchId);
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

        // If normalizedLeague is World Cup or similar, it might not be in LEAGUE_MAP
        // but we can try to use soccer_epl as a base or just fallback if it fails 404
        
        try {
            const result = await IngestionRetry.execute(async () => {
                const url = `${this.BASE_URL}/${oddsLeague}/odds/?regions=uk&markets=h2h,totals&apiKey=${this.API_KEY}`;
                const response = await fetchWithTimeout(url);
                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        const errData = await response.json().catch(() => ({}));
                        const msg = errData.message || response.statusText;
                        console.warn(`[OddsAPI] Authentication Failed: ${msg}. Falling back to simulated data.`);
                        const error = new Error(`Auth Error: ${msg}`) as any;
                        error.isAuthError = true;
                        throw error;
                    }
                    
                    if (response.status === 404) {
                        console.warn(`[OddsAPI] League ${oddsLeague} not found. Falling back to simulated data.`);
                        return null;
                    }

                    const errData = await response.json().catch(() => ({}));
                    const msg = errData.message || response.statusText;
                    throw new Error(`Odds API Error: ${response.status} - ${msg}`);
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
        } catch (e: any) {
            if (e.isAuthError) {
                console.warn(`[OddsAPI] Authentication failed. Using simulated data. (Check your ODDS_API_KEY)`);
                return this.getSimulatedOdds(matchId);
            }
            throw e;
        }

        console.warn(`[OddsAPI] Falling back to simulated data for ${matchId} due to API failure.`);
        return this.getSimulatedOdds(matchId);
    }

    private static getSimulatedOdds(matchId: string = "UNKNOWN") {
        const hash = matchId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const shift = (hash % 20) / 100; // +/- 0.10

        return {
            home: 2.1 + shift,
            draw: 3.4 - shift,
            away: 3.2 + shift,
            over15: 1.25 + shift,
            under35: 1.35 + shift,
            isSimulated: true
        };
    }
}
