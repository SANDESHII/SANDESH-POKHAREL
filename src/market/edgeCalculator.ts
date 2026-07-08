import { MarketData } from '../types';

/**
 * MARKET EDGE CALCULATOR
 * Identifies value by comparing model probabilities against bookmaker odds.
 */
export class EdgeCalculator {
    /**
     * Converts decimal odds to implied probability
     */
    static impliedProbability(decimalOdds: number): number {
        return 1 / decimalOdds;
    }

    /**
     * Removes vigorish (margin) from a set of probabilities
     */
    static removeVig(probs: number[]): number[] {
        const total = probs.reduce((a, b) => a + b, 0);
        return probs.map(p => p / total);
    }

    /**
     * Calculates the edge as the difference between model and market probability
     */
    static calculateEdge(modelProb: number, trueMarketProb: number): number {
        return modelProb - trueMarketProb;
    }

    /**
     * Formulates the complete MarketData object
     */
    static analyze(
        modelOver15: number, 
        odds: MarketData['odds']
    ): MarketData {
        const overImplied = this.impliedProbability(odds.over15);
        const underImplied = this.impliedProbability(odds.under15);
        
        // Remove vig from the Over/Under 1.5 pair
        const [trueOverProb] = this.removeVig([overImplied, underImplied]);

        return {
            odds,
            impliedProb: {
                over15: trueOverProb,
                under35: 0 // Placeholder
            },
            edge: {
                over15: this.calculateEdge(modelOver15, trueOverProb),
                under35: 0
            },
            source: 'Aggregate Market'
        };
    }
}
