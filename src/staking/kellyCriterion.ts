import { StakingPlan } from '../types';

/**
 * KELLY CRITERION STAKING
 * Optimizes bet sizing based on the perceived edge and confidence.
 */
export class KellyCriterion {
    /**
     * Calculates the Kelly percentage
     * f* = (bp - q) / b
     * where:
     * f* is the fraction of the bankroll to bet
     * b is the decimal odds - 1
     * p is the probability of winning
     * q is the probability of losing (1 - p)
     */
    static calculate(
        prob: number, 
        odds: number, 
        fraction: number = 0.25 // Standard "Quarter Kelly" to reduce volatility
    ): StakingPlan {
        const p = prob;
        const q = 1 - p;
        const b = odds - 1;

        if (b <= 0) return { strategy: 'FLAT', suggestedStake: 0, expectedValue: 0 };

        const kelly = (b * p - q) / b;
        const suggestedStake = Math.max(0, kelly * fraction);
        const ev = (p * b) - q;

        return {
            strategy: fraction === 1 ? 'KELLY' : 'FRACTIONAL_KELLY',
            suggestedStake: parseFloat(suggestedStake.toFixed(4)),
            expectedValue: parseFloat(ev.toFixed(4))
        };
    }
}
