import { RawMatchData } from './schema';
import { TeamMappingService } from '../services/teamMappingService';

/**
 * DATA VALIDATION LAYER
 * Ensures raw external data conforms to expected types and ranges.
 */
export class IngestionValidator {
    
    /**
     * Parses and validates dates from football-data.co.uk format (DD/MM/YY or DD/MM/YYYY)
     */
    private static parseDate(dateStr: string): string | null {
        if (!dateStr) return null;
        
        // Matches DD/MM/YY or DD/MM/YYYY
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (!match) return null;

        let [_, day, month, year] = match.map(Number);
        
        // Handle 2-digit year (assume 20xx)
        if (year < 100) year += 2000;
        
        // Validate ranges
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;

        const date = new Date(year, month - 1, day);
        
        // Check for plausibility (e.g. Feb 31st)
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return null;
        }

        // Return ISO format YYYY-MM-DD
        return date.toISOString().split('T')[0];
    }

    /**
     * Robust numeric parsing that handles "NA", empty strings, and NaN.
     */
    private static safeNumber(val: any): number | undefined {
        if (val === undefined || val === null) return undefined;
        
        let num: number;
        if (typeof val === 'string') {
            const clean = val.trim().toUpperCase();
            if (clean === 'NA' || clean === '') return undefined;
            num = Number(clean);
        } else if (typeof val === 'number') {
            num = val;
        } else {
            return undefined;
        }

        return Number.isFinite(num) ? num : undefined;
    }

    static validateRawMatch(row: any, league: string, season: string): RawMatchData | null {
        try {
            if (!row || typeof row !== 'object') return null;
            
            const rawHome = String(row.homeTeam || row.HomeTeam || '').trim();
            const rawAway = String(row.awayTeam || row.AwayTeam || '').trim();
            const date = this.parseDate(String(row.date || row.Date || ''));
            
            if (!rawHome || !rawAway || !date) return null;

            const homeMap = TeamMappingService.canonicalize(rawHome);
            const awayMap = TeamMappingService.canonicalize(rawAway);

            const homeTeam = homeMap.id;
            const awayTeam = awayMap.id;
            const unresolved = !homeMap.isMapped || !awayMap.isMapped;

            if (!homeMap.isMapped) {
                console.error(`[VALIDATOR] UNRESOLVED_ENTITY detected: "${rawHome}" (Home)`);
            }
            if (!awayMap.isMapped) {
                console.error(`[VALIDATOR] UNRESOLVED_ENTITY detected: "${rawAway}" (Away)`);
            }

            // Normalize goals with strict NA/NaN verification
            const homeGoals = this.safeNumber(row.homeGoals ?? row.FTHG);
            const awayGoals = this.safeNumber(row.awayGoals ?? row.FTAG);
            const homeShots = this.safeNumber(row.homeShots ?? row.HS);
            const awayShots = this.safeNumber(row.awayShots ?? row.AS);
            const homeShotsOnTarget = this.safeNumber(row.homeShotsOnTarget ?? row.HST);
            const awayShotsOnTarget = this.safeNumber(row.awayShotsOnTarget ?? row.AST);

            if (homeGoals !== undefined && (homeGoals < 0 || homeGoals > 15)) {
                console.warn(`[VALIDATOR] Rejected match: Goals out of range (${homeGoals}-${awayGoals})`);
                return null;
            }
            if (awayGoals !== undefined && (awayGoals < 0 || awayGoals > 15)) {
                console.warn(`[VALIDATOR] Rejected match: Goals out of range (${homeGoals}-${awayGoals})`);
                return null;
            }

            return {
                homeTeam,
                awayTeam,
                date,
                homeGoals,
                awayGoals,
                homeShots,
                awayShots,
                homeShotsOnTarget,
                awayShotsOnTarget,
                league,
                season,
                signature: `${date}_${homeTeam}_${awayTeam}_${league}`,
                unresolved
            };
        } catch (e) {
            console.error('[VALIDATOR] Failed to validate match row:', e);
            return null;
        }
    }

    static validateOdds(raw: any): { home: number, draw: number, away: number, over15?: number, under15?: number, over35?: number, under35?: number } | null {
        try {
            if (!raw || typeof raw !== 'object') return null;
            
            const match = Array.isArray(raw) ? raw[0] : raw;
            if (!match) return null;

            const bookmakers = match.bookmakers || [];
            if (bookmakers.length === 0) return null;
            
            const firstBookie = bookmakers[0];
            const markets = firstBookie.markets || [];

            // 1. Parse H2H Market
            const h2hMarket = markets.find((m: any) => m.key === 'h2h');
            if (!h2hMarket) return null;

            const hPrice = h2hMarket.outcomes.find((o: any) => o.name === match.home_team)?.price;
            const aPrice = h2hMarket.outcomes.find((o: any) => o.name === match.away_team)?.price;
            const dPrice = h2hMarket.outcomes.find((o: any) => o.name === 'Draw')?.price;

            const home = this.safeNumber(hPrice);
            const away = this.safeNumber(aPrice);
            const draw = this.safeNumber(dPrice);

            // Odds range check (1.01 to 1000)
            const isPlausible = (v: number | undefined) => v !== undefined && v >= 1.01 && v <= 1000;
            if (!isPlausible(home) || !isPlausible(away) || !isPlausible(draw)) {
                console.warn(`[VALIDATOR] Rejected odds: Out of plausible range (${home}, ${draw}, ${away})`);
                return null;
            }

            const result: any = { home, draw, away };

            // 2. Parse Totals Market
            const totalsMarket = markets.find((m: any) => m.key === 'totals');
            if (totalsMarket) {
                const o15 = totalsMarket.outcomes.find((o: any) => o.name === 'Over' && o.point === 1.5)?.price;
                const u15 = totalsMarket.outcomes.find((o: any) => o.name === 'Under' && o.point === 1.5)?.price;
                const o35 = totalsMarket.outcomes.find((o: any) => o.name === 'Over' && o.point === 3.5)?.price;
                const u35 = totalsMarket.outcomes.find((o: any) => o.name === 'Under' && o.point === 3.5)?.price;
                
                const over15 = this.safeNumber(o15);
                const under15 = this.safeNumber(u15);
                const over35 = this.safeNumber(o35);
                const under35 = this.safeNumber(u35);

                if (over15 !== undefined) result.over15 = over15;
                if (under15 !== undefined) result.under15 = under15;
                if (over35 !== undefined) result.over35 = over35;
                if (under35 !== undefined) result.under35 = under35;
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
            
            const t = raw.daily.temperature_2m_max?.[0];
            const p = raw.daily.precipitation_sum?.[0];
            
            const temp = this.safeNumber(t);
            const precipitation = this.safeNumber(p);
            
            // Weather range check (-30C to 50C, 0 to 500mm rain)
            if (temp === undefined || temp < -30 || temp > 50) {
                console.warn(`[VALIDATOR] Rejected weather: Temp out of range (${temp})`);
                return null;
            }
            if (precipitation === undefined || precipitation < 0 || precipitation > 500) {
                console.warn(`[VALIDATOR] Rejected weather: Precipitation out of range (${precipitation})`);
                return null;
            }

            return {
                temp,
                precipitation,
                condition: precipitation > 0.5 ? 'Rainy' : (temp > 25 ? 'Hot' : 'Clear')
            };
        } catch (e) {
            console.error('[VALIDATOR] Failed to validate weather:', e);
            return null;
        }
    }

    /**
     * PLAUSIBILITY CHECK
     * Dampens or rejects LLM-derived adjustments that deviate too far from deterministic baselines.
     * Prevents "AI Slop" hallucinations from overwhelming real data.
     */
    static validateReasonedAdjustments(adjustments: any, baselines: { home: any, away: any }): any {
        const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
        
        // Define a "Suspicion Threshold" (approx 1.5 SDs for xG/npxG)
        // In top leagues, a swing of > 0.45 xG is massive (e.g. losing Mbappe + Rodri).
        const MAX_UNVETTED_DELTA = 0.45;
        
        const sanitize = (delta: number, baseline: number) => {
            const absoluteDelta = Math.abs(delta);
            if (absoluteDelta > MAX_UNVETTED_DELTA) {
                // Heavily discount the excess
                const excess = absoluteDelta - MAX_UNVETTED_DELTA;
                const dampenedExcess = excess * 0.3; // Only trust 30% of the "outlier" part
                const signedDelta = (delta / absoluteDelta) * (MAX_UNVETTED_DELTA + dampenedExcess);
                return clamp(signedDelta, -baseline * 0.5, baseline * 0.5); // Never swing more than 50% of total strength
            }
            return clamp(delta, -baseline * 0.5, baseline * 0.5);
        };

        return {
            ...adjustments,
            homeOffenseDelta: sanitize(adjustments.homeOffenseDelta ?? 0, baselines.home.npxG),
            homeDefenseDelta: sanitize(adjustments.homeDefenseDelta ?? 0, baselines.home.avgXGA),
            awayOffenseDelta: sanitize(adjustments.awayOffenseDelta ?? 0, baselines.away.npxG),
            awayDefenseDelta: sanitize(adjustments.awayDefenseDelta ?? 0, baselines.away.avgXGA),
        };
    }
}
