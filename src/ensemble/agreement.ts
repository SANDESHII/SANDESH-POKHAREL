/**
 * MODEL AGREEMENT ENGINE
 * Measures consensus between Dixon-Coles and Logistic Ensemble.
 */
export class AgreementScorer {
    static calculate(probA: number, probB: number): { consensus: number; divergence: number; isRedFlag: boolean } {
        const divergence = Math.abs(probA - probB);
        // Consensus is high if divergence is low
        const consensus = Math.max(0, 1 - (divergence * 2));
        
        // Large disagreement (> 20 points) is a red flag
        const isRedFlag = divergence > 0.20;

        return {
            consensus: parseFloat(consensus.toFixed(3)),
            divergence: parseFloat(divergence.toFixed(3)),
            isRedFlag
        };
    }
}
