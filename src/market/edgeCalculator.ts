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
        modelUnder35: number,
        odds: MarketData['odds']
    ): MarketData {
        const over15Implied = this.impliedProbability(odds.over15);
        const under15Implied = this.impliedProbability(odds.under15);
        
        const over35Implied = this.impliedProbability(odds.over35);
        const under35Implied = this.impliedProbability(odds.under35);
        
        // Remove vig from the Over/Under pairs
        const [trueOver15] = this.removeVig([over15Implied, under15Implied]);
        const [, trueUnder35] = this.removeVig([over35Implied, under35Implied]);

        return {
            odds,
            impliedProb: {
                over15: trueOver15,
                under35: trueUnder35
            },
            edge: {
                over15: this.calculateEdge(modelOver15, trueOver15),
                under35: this.calculateEdge(modelUnder35, trueUnder35)
            },
            source: 'Aggregate Market'
        };
    }
}
