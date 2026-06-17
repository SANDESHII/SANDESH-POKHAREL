import { TeamStats } from '../types';

/**
 * INSTITUTIONAL DATA INGESTION SERVICE
 * Handles consensus-driven standardization, sequence rehydration, and live covariance tracking.
 */
export class IngestionService {
    /**
     * Consensus Ingestion Fetcher
     * Runs a Median-Absolute-Deviation (MAD) inspired check across multiple sources 
     * to eliminate single-source bias or typographical errors.
     */
    static standardize(team: any, matrix: any): TeamStats {
        const uBias = matrix?.understatBias || 0.88;
        const sBias = matrix?.sofaScoreBias || 0.94;

        // 1. Multi-Source Consensus (MAD Filter) with Sanity Guards
        // Filter out extreme outliers (e.g., > 6.0 xG) and non-numeric garbage
        const parse = (v: any) => {
            const num = typeof v === 'number' ? v : parseFloat(v);
            return isNaN(num) ? 0.1 : Math.min(5.5, Math.max(0.01, num));
        };

        const v1 = parse(team.npxG);
        const v2 = parse(team.npxG_Understat) * uBias;
        const v3 = parse(team.npxG_SofaScore) * sBias;

        const values = [v1, v2, v3].sort((a, b) => a - b);
        const consensusNpxG = values[1]; // Median of 3 sources

        // 2. MEC (Missing Expected Contribution) Verification Loop
        const missingG = team.missingExpectedG || 0;
        const missingT = team.missingExpectedT || 0;

        const finalNpxG = Math.min(6.0, Math.max(0.05, consensusNpxG - missingG));
        const finalXT = Math.min(5.0, Math.max(0.05, (team.xT || 0) - missingT));

        // 3. Sequence Rehydration
        const rehydrate = (seq: number[] | undefined, fallback: number) => {
            const s = [...(seq || [])]
                .filter(v => typeof v === 'number' && !isNaN(v))
                .map(v => Math.max(0.01, v));
            
            // Backfill with the current consensus median if telemetry is dropped
            while (s.length < 10) s.unshift(fallback);
            return s.slice(-10);
        };

        const npxGSequence = rehydrate(team.npxGSequence, finalNpxG);
        const xGASequence = rehydrate(team.xGASequence, team.avgXGA || team.goalsConceded / 10 || 1.1);

        return {
            ...team,
            npxG: finalNpxG,
            xT: finalXT,
            npxGSequence,
            xGASequence,
            // Preserve raw values for live covariance tracking
            npxG_Raw: v1,
            npxG_Understat_Standardized: v2,
            npxG_SofaScore_Standardized: v3
        };
    }

    /**
     * Live Covariance Tracking
     * Calculates the empirical variance across sources as the "Measurement Noise" (R).
     * This variance is passed directly to the Kalman Filter.
     */
    static calculateEmpiricalVariance(team: any): number {
        const vals = [
            team.npxG_Raw || 0.1,
            team.npxG_Understat_Standardized || 0.1,
            team.npxG_SofaScore_Standardized || 0.1
        ];
        
        const mean = vals.reduce((a, b) => a + b, 0) / 3;
        // Return variance: Σ(x - μ)² / N
        const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / 3;
        
        // Return a stabilized variance metric
        return Math.max(0.001, variance);
    }
}
