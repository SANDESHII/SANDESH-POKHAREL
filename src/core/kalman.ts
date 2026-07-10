/**
 * KALMAN SIGNAL FILTER
 * Tracks team latent ability (npxG) over time using Bayesian updates.
 */

import { getFirebaseDb } from '../lib/firebaseAdmin';

export interface TeamState {
    estimatedNpxG: number;
    variance: number;
    lastUpdate: string;
    volatility: number;
}

export class SignalFilter {
    private static readonly Q_BASE = 0.05; // Base drift per week
    private static readonly R_BASE = 0.20; // Base distrust for high-fidelity data
    private static collectionName = 'teamStates';
    private static cache = new Map<string, TeamState>();

    static setCollection(name: string): void {
        this.collectionName = name;
        this.cache.clear(); // Clear cache when switching collections (e.g. to backtest)
    }

    /**
     * KALMAN UPDATE
     * x_k = x_{k-1} + K_k * (z_k - x_{k-1})
     * P_k = (1 - K_k) * P_{k-1}
     */
    static async update(teamId: string, observedNpxG: number, date: string, confidence: number = 0.6, persist: boolean = true): Promise<TeamState> {
        const current = (await this.get(teamId)) || { 
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
         */
        const ik = 1 - kalmanGain;
        const newVariance = Math.pow(ik, 2) * predictedVariance + Math.pow(kalmanGain, 2) * r;

        const newState: TeamState = {
            estimatedNpxG: Math.max(0.2, newEstimate),
            variance: Math.max(0.01, newVariance),
            lastUpdate: date,
            volatility: current.volatility
        };

        if (persist) {
            await this.set(teamId, newState);
        }
        return newState;
    }

    static async updateStateAfterMatch(teamId: string, goalsScored: number, _goalsConceded: number, date: string, confidence: number = 1.0, persist: boolean = true): Promise<TeamState> {
        /**
         * SCALE MAPPING (Goals to npxG Signal)
         * Raw goals are noisy discrete measurements. We map them to the npxG scale (0.8 - 2.3)
         * to prevent a single high-scoring match from over-tilting the latent estimate.
         */
        const npxGSignal = 0.8 + (Math.min(5, goalsScored) * 0.3);
        
        // We use a lower default confidence for "Goal" measurements than for "xG" measurements
        // because goals have higher Poisson variance than xG.
        const goalConfidence = confidence * 0.7; 
        
        return await this.update(teamId, npxGSignal, date, goalConfidence, persist);
    }

    static async get(teamId: string): Promise<TeamState | undefined> {
        if (this.cache.has(teamId)) return this.cache.get(teamId);

        try {
            const db = getFirebaseDb();
            const doc = await db.collection(this.collectionName).doc(teamId).get();
            const state = doc.exists ? (doc.data() as TeamState) : undefined;
            if (state) this.cache.set(teamId, state);
            return state;
        } catch (e) {
            console.error(`[KALMAN] Error reading from ${this.collectionName}:`, e);
            return undefined;
        }
    }

    static async set(teamId: string, state: TeamState): Promise<void> {
        this.cache.set(teamId, state);
        try {
            const db = getFirebaseDb();
            await db.collection(this.collectionName).doc(teamId).set(state);
        } catch (e) {
            console.error(`[KALMAN] Error writing to ${this.collectionName}:`, e);
        }
    }

    static async getAll(): Promise<Map<string, TeamState>> {
        if (this.cache.size > 0) return new Map(this.cache);

        try {
            const db = getFirebaseDb();
            const snapshot = await db.collection(this.collectionName).get();
            const map = new Map<string, TeamState>();
            snapshot.forEach(doc => {
                const data = doc.data() as TeamState;
                map.set(doc.id, data);
                this.cache.set(doc.id, data);
            });
            return map;
        } catch (e) {
            console.error(`[KALMAN] Error reading collection ${this.collectionName} from Firestore:`, e);
            return new Map();
        }
    }

    static async saveAll(states: Map<string, TeamState>): Promise<void> {
        try {
            const db = getFirebaseDb();
            const batch = db.batch();
            states.forEach((state, teamId) => {
                this.cache.set(teamId, state);
                const ref = db.collection(this.collectionName).doc(teamId);
                batch.set(ref, state);
            });
            await batch.commit();
        } catch (e) {
            console.error(`[KALMAN] Error batch saving states to ${this.collectionName}:`, e);
        }
    }

    static async reset(): Promise<void> {
        this.cache.clear();
        try {
            const db = getFirebaseDb();
            const snapshot = await db.collection(this.collectionName).get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`[KALMAN] Reset collection: ${this.collectionName}`);
        } catch (e) {
            console.error(`[KALMAN] Error resetting Firestore collection ${this.collectionName}:`, e);
        }
    }

    private static getDaysBetween(d1: string, d2: string): number {
        if (d1 === 'INITIAL') return 7;
        const t1 = new Date(d1).getTime();
        const t2 = new Date(d2).getTime();
        if (isNaN(t1) || isNaN(t2)) return 7;
        return Math.max(1, (t2 - t1) / (1000 * 3600 * 24));
    }
}

