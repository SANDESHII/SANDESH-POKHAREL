/**
 * KALMAN SIGNAL FILTER & STATE STORE
 * Tracks team latent ability (npxG) over time using Bayesian updates.
 */

export interface TeamState {
    estimatedNpxG: number;
    variance: number;
    lastUpdate: string;
    volatility: number;
}

export class SignalFilter {
    private static store = new Map<string, TeamState>();
    private static readonly Q_BASE = 0.05; // Base drift per week
    private static readonly R_BASE = 0.20; // Base distrust for high-fidelity data

    /**
     * KALMAN UPDATE
     * x_k = x_{k-1} + K_k * (z_k - x_{k-1})
     * P_k = (1 - K_k) * P_{k-1}
     */
    static update(teamId: string, observedNpxG: number, date: string, confidence: number = 0.6): TeamState {
        const current = this.store.get(teamId) || { 
            estimatedNpxG: 1.35, 
            variance: 0.5, 
            lastUpdate: 'INITIAL',
            volatility: this.Q_BASE
        };

        // 1. Prediction step: Increase variance over time (Process Noise Q)
        const daysSince = this.getDaysBetween(current.lastUpdate, date);
        const q = current.volatility * (daysSince / 7);
        const predictedVariance = current.variance + q;

        // 2. Update step: Adjust for Measurement Noise R
        const effectiveConfidence = Math.max(0.01, confidence);
        const r = this.R_BASE / effectiveConfidence;
        
        const kalmanGain = predictedVariance / (predictedVariance + r);
        
        const innovation = observedNpxG - current.estimatedNpxG;
        const newEstimate = current.estimatedNpxG + (kalmanGain * innovation);
        
        /**
         * JOSEPH FORM FOR COVARIANCE UPDATE
         * P_new = (1-K)² * P_pred + K² * R
         * This form ensures symmetry and positive-definiteness even with rounding errors.
         * Calibration Note: R = R_BASE / sourceConfidence. Verified with 10-match walk-forward.
         */
        const ik = 1 - kalmanGain;
        const newVariance = Math.pow(ik, 2) * predictedVariance + Math.pow(kalmanGain, 2) * r;

        const newState: TeamState = {
            estimatedNpxG: Math.max(0.2, newEstimate),
            variance: Math.max(0.01, newVariance),
            lastUpdate: date,
            volatility: current.volatility
        };

        this.store.set(teamId, newState);
        return newState;
    }

    static updateStateAfterMatch(teamId: string, goalsScored: number, _goalsConceded: number, date: string, confidence: number = 1.0): void {
        this.update(teamId, goalsScored, date, confidence);
    }

    static get(teamId: string): TeamState | undefined {
        return this.store.get(teamId);
    }

    static reset(): void {
        this.store.clear();
    }

    private static getDaysBetween(d1: string, d2: string): number {
        if (d1 === 'INITIAL') return 7; // Assumption for first match
        const t1 = new Date(d1).getTime();
        const t2 = new Date(d2).getTime();
        if (isNaN(t1) || isNaN(t2)) return 7;
        return Math.max(1, (t2 - t1) / (1000 * 3600 * 24));
    }
}

/**
 * Backward compatibility alias
 */
export class StateStore extends SignalFilter {}
