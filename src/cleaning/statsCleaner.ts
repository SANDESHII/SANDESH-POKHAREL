import { TeamStats } from '../types';

export interface Provenance {
    source: string;
    purity: number;
    imputed: boolean;
    flags: string[];
}

/**
 * STATS CLEANING & VALIDATION LAYER
 * Ensures input signals are within physical bounds and handles imputation.
 */
export class StatsCleaner {
    /**
     * Z-Score Gating for outlier detection
     */
    static outlierGate(value: number, history: number[], threshold: number = 2.5): { value: number; flagged: boolean } {
        if (history.length < 3) return { value, flagged: false };

        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return { value, flagged: false };

        const zScore = Math.abs(value - mean) / stdDev;
        if (zScore > threshold) {
            // Regress towards the mean (Imputation)
            const corrected = mean + (Math.sign(value - mean) * threshold * stdDev);
            return { value: corrected, flagged: true };
        }

        return { value, flagged: false };
    }

    /**
     * Physical bounds clamping
     */
    static clamp(v: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, v));
    }

    /**
     * Validates and cleans TeamStats with explicit provenance tagging
     */
    static cleanTeamStats(team: Partial<TeamStats>, leagueAvgXG: number = 1.35): { stats: TeamStats; provenance: Provenance } {
        const history = team.npxGSequence || [];
        const { value: npxG, flagged } = this.outlierGate(team.npxG || leagueAvgXG, history);
        
        const flags: string[] = [];
        if (flagged) flags.push('OUTLIER_DETECTED');
        if (!team.npxG) flags.push('MISSING_INPUT_IMPUTED');

        const stats: TeamStats = {
            name: team.name || 'Unknown',
            goalsScored: team.goalsScored || 0,
            goalsConceded: team.goalsConceded || 0,
            avgXG: team.avgXG || leagueAvgXG,
            avgXGA: team.avgXGA || leagueAvgXG,
            npxG: this.clamp(npxG, 0.2, 5.5),
            xT: this.clamp(team.xT || npxG, 0.2, 5.5),
            defensiveStability: this.clamp(team.defensiveStability || 0.5, 0.05, 1.0),
            offensiveVolatility: this.clamp(team.offensiveVolatility || 0.5, 0.05, 1.0),
            form: team.form || [0.5],
            cleanSheets: team.cleanSheets || 0,
            dataPurity: flagged ? (team.dataPurity || 1.0) * 0.8 : (team.dataPurity || 1.0),
            npxGVariance: team.npxGVariance || 0.1
        };

        const provenance: Provenance = {
            source: team.name === 'Unknown' ? 'IMPUTATION_ENGINE' : 'DATA_PROVIDER',
            purity: stats.dataPurity || 1.0,
            imputed: !team.npxG || flagged,
            flags
        };

        return { stats, provenance };
    }
}
