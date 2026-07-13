import { TeamStats, Provenance } from '../types';
import { StatsCleaner } from '../cleaning/statsCleaner';
import { FootballDataProvider } from '../ingestion/sources/footballDataProvider';
import { RawMatchData } from '../ingestion/schema';
import { TeamMappingService } from './teamMappingService';
import { IngestionCache } from '../ingestion/cache';

import { DixonColes } from '../core/dixonColes';

/**
 * INGESTION SERVICE
 * Coordinates data entry and initial standardization across multiple providers.
 */
export class IngestionService {
    private static clean(v: any, f: number = 0): number {
        if (typeof v === 'number') return isNaN(v) ? f : v;
        if (typeof v === 'string') {
            const p = parseFloat(v.replace(/%/g, '').replace(/[^0-9.-]/g, ''));
            return isNaN(p) ? f : (v.includes('%') && p > 1 ? p / 100 : p);
        }
        return f;
    }

    static deduplicateMatches(matches: RawMatchData[]): RawMatchData[] {
        return matches.filter(m => {
            if (!m.signature) return true;
            if (IngestionCache.get(`sig_${m.signature}`)) return false;
            IngestionCache.setPermanent(`sig_${m.signature}`, true);
            return true;
        });
    }

    static async getLeagueContext(league: string, season?: string): Promise<{ rhoData: { rho: number, sigmaRho: number }, matches: RawMatchData[] }> {
        const y = new Date().getFullYear(), m = new Date().getMonth();
        const sY = m >= 6 ? y : y - 1;
        const s = season || `${sY.toString().slice(-2)}/${(sY + 1).toString().slice(-2)}`;
        const hist = this.deduplicateMatches(await FootballDataProvider.fetchSeasonData(league, s));
        
        let rho = { rho: -0.11, sigmaRho: 0.05 };
        if (hist.length > 50) {
            const avgs = new Map<string, { s: number, c: number, n: number }>();
            hist.forEach(match => {
                if (match.homeGoals == null) return;
                [[TeamMappingService.canonicalize(match.homeTeam).id, match.homeGoals, match.awayGoals], [TeamMappingService.canonicalize(match.awayTeam).id, match.awayGoals, match.homeGoals]].forEach(([id, gs, gc]) => {
                    const e = avgs.get(id as string) || { s: 0, c: 0, n: 0 };
                    e.s += gs as number; e.c += gc as number; e.n++;
                    avgs.set(id as string, e);
                });
            });

            const fit = hist.filter(m => m.homeGoals != null).map(m => ({ x: m.homeGoals!, y: m.awayGoals!, lambda: avgs.get(TeamMappingService.canonicalize(m.homeTeam).id)!.s / avgs.get(TeamMappingService.canonicalize(m.homeTeam).id)!.n, mu: avgs.get(TeamMappingService.canonicalize(m.awayTeam).id)!.s / avgs.get(TeamMappingService.canonicalize(m.awayTeam).id)!.n })).slice(-200);
            if (fit.length > 20) rho = DixonColes.fitRho(fit);
        }
        return { rhoData: rho, matches: hist };
    }

    static standardize(team: Record<string, any>, matrix: Record<string, any>): TeamStats {
        return this.standardizeWithProvenance(team, matrix).stats;
    }

    static standardizeWithProvenance(team: Record<string, any>, matrix: Record<string, any>): { stats: TeamStats; provenance: Provenance } {
        const rel = StatsCleaner.clamp(this.clean(matrix?.reliabilityScore, 0.5), 0, 1.0);
        const raw = StatsCleaner.clamp(this.clean(team.npxG), 0, 5.5);
        const bXG = StatsCleaner.clamp(this.clean(team.avgXG), 0, 5.0);
        const aiW = StatsCleaner.clamp(rel * 0.95, 0.45, 0.95);
        const sug = StatsCleaner.clamp(this.clean(matrix?.aiScoringBaseline), 0.5, 4.5);
        const eXG = sug > 0.5 ? (bXG * 0.3 + sug * 0.7) : bXG;

        return StatsCleaner.cleanTeamStats({
            ...team, npxG: (raw * aiW) + (eXG * (1 - aiW)), avgXG: eXG,
            dataPurity: team.dataPurity ?? team.purity ?? 0.5
        });
    }
}

