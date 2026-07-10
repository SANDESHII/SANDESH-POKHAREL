import { TeamStats } from '../types';
import { StatsCleaner, Provenance } from '../cleaning/statsCleaner';
import { FootballDataProvider } from '../ingestion/sources/footballDataProvider';
import { RawMatchData } from '../ingestion/schema';

import { DixonColes } from '../core/dixonColes';

/**
 * INGESTION SERVICE
 * Coordinates data entry and initial standardization across multiple providers.
 */
export class IngestionService {
    private static clean(v: any, fallback: number = 0): number {
        if (typeof v === 'number') return isNaN(v) ? fallback : v;
        if (typeof v === 'string') {
            const sanitized = v.replace(/%/g, '').replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(sanitized);
            if (isNaN(parsed)) return fallback;
            if (v.includes('%') && parsed > 1) return parsed / 100;
            return parsed;
        }
        return fallback;
    }

    /**
     * Provides league-wide metrics like rhoData from historical matches.
     */
    static async getLeagueContext(league: string): Promise<{ rhoData: { rho: number, sigmaRho: number }, matches: RawMatchData[] }> {
        const historicalData = await FootballDataProvider.fetchSeasonData(league, '23/24');
        let rhoData = { rho: -0.11, sigmaRho: 0.05 };

        if (historicalData.length > 50) {
            const teamAvgs = new Map<string, { scored: number, conceded: number, count: number }>();
            historicalData.forEach(m => {
                if (m.homeGoals === undefined || m.awayGoals === undefined) return;
                
                const h = teamAvgs.get(m.homeTeam) || { scored: 0, conceded: 0, count: 0 };
                h.scored += m.homeGoals;
                h.conceded += m.awayGoals;
                h.count++;
                teamAvgs.set(m.homeTeam, h);

                const a = teamAvgs.get(m.awayTeam) || { scored: 0, conceded: 0, count: 0 };
                a.scored += m.awayGoals;
                a.conceded += m.homeGoals;
                a.count++;
                teamAvgs.set(m.awayTeam, a);
            });

            const fitInputs = historicalData
                .filter(m => m.homeGoals !== undefined && m.awayGoals !== undefined)
                .map(m => {
                    const hStats = teamAvgs.get(m.homeTeam)!;
                    const aStats = teamAvgs.get(m.awayTeam)!;
                    return {
                        x: m.homeGoals!,
                        y: m.awayGoals!,
                        lambda: hStats.scored / hStats.count,
                        mu: aStats.scored / aStats.count
                    };
                })
                .slice(-200);

            if (fitInputs.length > 20) {
                rhoData = DixonColes.fitRho(fitInputs);
            }
        }

        return { rhoData, matches: historicalData };
    }

    static standardize(team: Record<string, any>, matrix: Record<string, any>): TeamStats {
        return this.standardizeWithProvenance(team, matrix).stats;
    }

    static standardizeWithProvenance(team: Record<string, any>, matrix: Record<string, any>): { stats: TeamStats; provenance: Provenance } {
        const reliability = StatsCleaner.clamp(this.clean(matrix?.reliabilityScore, 0.5), 0, 1.0);
        const rawNPXG = StatsCleaner.clamp(this.clean(team.npxG), 0, 5.5);
        const baselineXG = StatsCleaner.clamp(this.clean(team.avgXG), 0, 5.0);
        
        const aiWeight = StatsCleaner.clamp(reliability * 0.95, 0.45, 0.95);
        const baselineWeight = 1 - aiWeight;
        
        const suggestedBaseline = StatsCleaner.clamp(this.clean(matrix?.aiScoringBaseline), 0.5, 4.5);
        const effectiveBaselineXG = suggestedBaseline > 0.5 ? (baselineXG * 0.3 + suggestedBaseline * 0.7) : baselineXG;

        const finalizedExpectancy = (rawNPXG * aiWeight) + (effectiveBaselineXG * baselineWeight);

        return StatsCleaner.cleanTeamStats({
            ...team,
            npxG: finalizedExpectancy,
            avgXG: effectiveBaselineXG,
            dataPurity: team.purity || 0.85
        });
    }
}
