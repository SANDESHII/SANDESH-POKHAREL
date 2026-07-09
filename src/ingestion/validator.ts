import { RawMatchData } from './schema';

/**
 * DATA VALIDATION LAYER
 * Ensures raw external data conforms to expected types and ranges.
 */
export class IngestionValidator {
    
    static validateRawMatch(row: any, league: string, season: string): RawMatchData | null {
        try {
            if (!row || typeof row !== 'object') return null;
            
            const homeTeam = String(row.homeTeam || row.HomeTeam || '').trim().toUpperCase();
            const awayTeam = String(row.awayTeam || row.AwayTeam || '').trim().toUpperCase();
            const date = String(row.date || row.Date || '');
            
            if (!homeTeam || !awayTeam || !date) return null;

            // Normalize goals
            const homeGoals = row.homeGoals !== undefined ? Number(row.homeGoals) : (row.FTHG !== undefined ? Number(row.FTHG) : undefined);
            const awayGoals = row.awayGoals !== undefined ? Number(row.awayGoals) : (row.FTAG !== undefined ? Number(row.FTAG) : undefined);

            if (homeGoals !== undefined && !Number.isFinite(homeGoals)) return null;
            if (awayGoals !== undefined && !Number.isFinite(awayGoals)) return null;

            return {
                homeTeam,
                awayTeam,
                date,
                homeGoals,
                awayGoals,
                league,
                season
            };
        } catch (e) {
            console.error('[VALIDATOR] Failed to validate match row:', e);
            return null;
        }
    }

    static validateOdds(raw: any): { home: number, draw: number, away: number, over15?: number } | null {
        try {
            if (!raw || typeof raw !== 'object') return null;
            
            // Expected format from The Odds API (simplified for this validation)
            // find h2h market
            const bookmakers = raw.bookmakers || [];
            if (bookmakers.length === 0) return null;
            
            const firstBookie = bookmakers[0];
            const h2hMarket = firstBookie.markets?.find((m: any) => m.key === 'h2h');
            if (!h2hMarket) return null;

            const home = h2hMarket.outcomes.find((o: any) => o.name === raw.home_team)?.price;
            const away = h2hMarket.outcomes.find((o: any) => o.name === raw.away_team)?.price;
            const draw = h2hMarket.outcomes.find((o: any) => o.name === 'Draw')?.price;

            if (!home || !away || !draw) return null;

            return {
                home: Number(home),
                draw: Number(draw),
                away: Number(away)
            };
        } catch (e) {
            console.error('[VALIDATOR] Failed to validate odds:', e);
            return null;
        }
    }

    static validateWeather(raw: any): { temp: number, condition: string, precipitation: number } | null {
        try {
            if (!raw || !raw.daily) return null;
            
            const temp = raw.daily.temperature_2m_max?.[0];
            const precip = raw.daily.precipitation_sum?.[0];
            
            if (temp === undefined || precip === undefined) return null;

            return {
                temp: Number(temp),
                precipitation: Number(precip),
                condition: precip > 0.5 ? 'Rainy' : (temp > 25 ? 'Hot' : 'Clear')
            };
        } catch (e) {
            console.error('[VALIDATOR] Failed to validate weather:', e);
            return null;
        }
    }
}
