import { TeamStats, MatchContext } from '../types';
import { getFirebaseDb } from '../lib/firebaseAdmin';

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

    private static collectionName = 'modelMetadata';
    private static modelId = 'logistic_over15';

    /**
     * TRAIN: Fits the weights using Gradient Descent
     * Minimizes Log-Loss between predicted Over 1.5 and actual Over 1.5 outcome.
     */
    static async train(matches: { home: TeamStats, away: TeamStats, context: MatchContext, isOver15: boolean }[]): Promise<void> {
        console.log(`[ENSEMBLE] Training LogisticEnsemble on ${matches.length} samples...`);
        const learningRate = 0.05;
        const epochs = 100;
        let finalLogLoss = 0;

        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            const gradients = new Array(this.weights.length).fill(0);

            for (const m of matches) {
                const features = this.extractFeatures(m.home, m.away, m.context);
                const prediction = this.predictOver15(m.home, m.away, m.context);
                const target = m.isOver15 ? 1 : 0;
                const error = prediction - target;
                
                // Cross-Entropy Loss (Log Loss)
                totalLoss += target === 1 ? -Math.log(prediction + 1e-15) : -Math.log(1 - prediction + 1e-15);

                for (let i = 0; i < features.length; i++) {
                    gradients[i] += error * features[i];
                }
            }

            // Update weights
            for (let i = 0; i < this.weights.length; i++) {
                this.weights[i] -= (learningRate * gradients[i]) / matches.length;
            }

            if (epoch === epochs - 1) {
                finalLogLoss = totalLoss / matches.length;
                console.log(`[ENSEMBLE] Final LogLoss: ${finalLogLoss.toFixed(4)}`);
            }
        }
        console.log(`[ENSEMBLE] Trained weights: ${this.weights.map(w => w.toFixed(3)).join(', ')}`);
        
        // Persist to Firestore
        await this.save(finalLogLoss);
    }

    static async save(loss: number): Promise<void> {
        try {
            const db = getFirebaseDb();
            await db.collection(this.collectionName).doc(this.modelId).set({
                weights: this.weights,
                lastTrained: new Date().toISOString(),
                logLoss: loss
            });
            console.log(`[ENSEMBLE] Weights persisted to Firestore.`);
        } catch (e) {
            console.error(`[ENSEMBLE] Error persisting weights:`, e);
        }
    }

    static async load(): Promise<void> {
        try {
            const db = getFirebaseDb();
            const doc = await db.collection(this.collectionName).doc(this.modelId).get();
            if (doc.exists) {
                const data = doc.data();
                if (data && data.weights) {
                    this.weights = data.weights;
                    console.log(`[ENSEMBLE] Loaded trained weights from Firestore: ${this.weights.map(w => w.toFixed(3)).join(', ')}`);
                }
            } else {
                console.log(`[ENSEMBLE] No trained weights found. Using pre-calibrated seeds.`);
            }
        } catch (e) {
            console.error(`[ENSEMBLE] Error loading weights:`, e);
        }
    }

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
