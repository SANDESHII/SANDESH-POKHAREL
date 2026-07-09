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

    static validateOdds(raw: any): { home: number, draw: number, away: number, over15?: number, under35?: number } | null {
        try {
            if (!raw || typeof raw !== 'object') return null;
            
            // The Odds API returns an array of matches or a single match object depending on the endpoint
            // Our LiveOddsProvider currently handles single match data passing (or the first element if it's an array)
            const match = Array.isArray(raw) ? raw[0] : raw;
            if (!match) return null;

            const bookmakers = match.bookmakers || [];
            if (bookmakers.length === 0) return null;
            
            const firstBookie = bookmakers[0];
            const markets = firstBookie.markets || [];

            // 1. Parse H2H Market
            const h2hMarket = markets.find((m: any) => m.key === 'h2h');
            if (!h2hMarket) return null;

            const home = h2hMarket.outcomes.find((o: any) => o.name === match.home_team)?.price;
            const away = h2hMarket.outcomes.find((o: any) => o.name === match.away_team)?.price;
            const draw = h2hMarket.outcomes.find((o: any) => o.name === 'Draw')?.price;

            if (!home || !away || !draw) return null;

            const result: any = {
                home: Number(home),
                draw: Number(draw),
                away: Number(away)
            };

            // 2. Parse Totals Market (Over 1.5 / Under 3.5)
            const totalsMarket = markets.find((m: any) => m.key === 'totals');
            if (totalsMarket) {
                const over15 = totalsMarket.outcomes.find((o: any) => o.name === 'Over' && o.point === 1.5)?.price;
                const under35 = totalsMarket.outcomes.find((o: any) => o.name === 'Under' && o.point === 3.5)?.price;
                
                if (over15) result.over15 = Number(over15);
                if (under35) result.under35 = Number(under35);
            }

            return result;
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
