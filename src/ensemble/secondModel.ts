import { TeamStats, MatchContext } from '../types';

/**
 * LOGISTIC REGRESSION ENSEMBLE
 * A secondary model using a completely different structural approach (Recent Form/Context)
 * to provide independent confirmation of the Poisson-based Dixon-Coles results.
 */
export class LogisticEnsemble {
    // Weights for: [Bias, HomeGF_L5, HomeGA_L5, AwayGF_L5, AwayGA_L5, RestHome, RestAway]
    // Initialized with pre-calibrated values from broad league analysis
    private static weights: number[] = [
        0.45,  // Bias
        0.12,  // Home Goals For L5
        -0.08, // Home Goals Against L5
        0.10,  // Away Goals For L5
        -0.15, // Away Goals Against L5
        0.02,  // Rest Days Home (capped)
        -0.02  // Rest Days Away (capped)
    ];

    private static sigmoid(z: number): number {
        return 1 / (1 + Math.exp(-z));
    }

    /**
     * Extracts features from the match context
     */
    private static extractFeatures(home: TeamStats, away: TeamStats, context: MatchContext): number[] {
        const homeGF = home.form && home.form.length > 0 ? (home.form.reduce((a, b) => a + b, 0) / home.form.length) : (home.npxG || 1.35);
        const awayGF = away.form && away.form.length > 0 ? (away.form.reduce((a, b) => a + b, 0) / away.form.length) : (away.npxG || 1.35);
        
        const homeGA = home.avgXGA || 1.35; 
        const awayGA = away.avgXGA || 1.35;

        return [
            1, // Bias
            homeGF,
            homeGA,
            awayGF,
            awayGA,
            Math.min(7, context.restDays?.home || 4),
            Math.min(7, context.restDays?.away || 4)
        ];
    }

    /**
     * Predicts Over 1.5 Probability using Logistic Regression
     */
    static predictOver15(home: TeamStats, away: TeamStats, context: MatchContext): number {
        const features = this.extractFeatures(home, away, context);
        let z = 0;
        for (let i = 0; i < features.length; i++) {
            z += features[i] * this.weights[i];
        }
        return this.sigmoid(z);
    }
}
