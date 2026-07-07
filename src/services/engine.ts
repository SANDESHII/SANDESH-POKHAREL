
import { TeamStats, TacticalPhase, TacticalSequence, AnalysisConfidence, MatchContext } from '../types';

// --- INGESTION LOGIC ---

export class IngestionService {
    private static clean(v: any, fallback: number = 0): number {
        if (typeof v === 'number') return isNaN(v) ? fallback : v;
        if (typeof v === 'string') {
            const sanitized = v.replace(/%/g, '').replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(sanitized);
            if (isNaN(parsed)) return fallback;
            // Handle percentages (e.g. "75%" -> 0.75)
            if (v.includes('%') && parsed > 1) return parsed / 100;
            return parsed;
        }
        return fallback;
    }

    private static clamp(v: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, v));
    }

    /**
     * TACTICAL SIGNAL QUANTIFICATION
     * Converts soft textual signals into mathematical coefficients for the engine.
     */
    static quantifySignal(signal: string, type: 'DRIFT' | 'SENTIMENT' | 'STAKES'): number {
        const s = (signal || '').toUpperCase();
        switch (type) {
            case 'DRIFT':
                if (s.includes('CRITICAL-ROTATION') || s.includes('INJURY-CRISIS')) return 1.65;
                if (s.includes('VOLATILE') || s.includes('ATTACKING-SHIFT')) return 1.45;
                if (s.includes('FLUX') || s.includes('TACTICAL-REBOOT')) return 1.20;
                if (s.includes('STABLE') || s.includes('DEFENSIVE-LOCK')) return 0.65;
                return 1.0;
            case 'SENTIMENT':
                if (s.includes('BULLISH') || s.includes('OVER-BET')) return 0.22;
                if (s.includes('BEARISH') || s.includes('UNDER-VALUED')) return -0.22;
                return 0;
            case 'STAKES':
                if (s.includes('KNOCKOUT') || s.includes('RELEGATION-BATTLE')) return 1.25;
                if (s.includes('CRITICAL') || s.includes('DERBY')) return 1.15;
                if (s.includes('STANDARD')) return 1.0;
                if (s.includes('DEAD-RUBBER') || s.includes('FRIENDLY')) return 0.75;
                return 1.0;
            default:
                return 1.0;
        }
    }

    /**
     * Standardizes raw input data into structured signals.
     */
    static standardize(team: Record<string, any>, matrix: Record<string, any>): TeamStats {
        const adjA = this.clamp(this.clean(matrix?.adjustmentA, 0.88), 0.5, 1.2);
        const reliability = this.clamp(this.clean(matrix?.reliabilityScore, 0.5), 0, 1.0);

    // 1. Signal Extraction
    const rawNPXG = this.clamp(this.clean(team.npxG), 0, 5.5);
    const rawXT = this.clamp(this.clean(team.xT), 0, 5.5);
    const baselineXG = this.clamp(this.clean(team.avgXG), 0, 5.0);
    
    // 2. Data Harmonization
    const aiWeight = this.clamp(reliability * 0.95, 0.45, 0.95);
    const baselineWeight = 1 - aiWeight;
    
    // Factor in AI suggested baseline if available
    const suggestedBaseline = this.clamp(this.clean(matrix?.aiScoringBaseline), 0.5, 4.5);
    const effectiveBaselineXG = suggestedBaseline > 0.5 ? (baselineXG * 0.3 + suggestedBaseline * 0.7) : baselineXG;

    const aiSignal = (rawNPXG * adjA + rawXT * (1 - adjA));
    let finalizedExpectancy = (aiSignal * aiWeight) + (effectiveBaselineXG * baselineWeight);

    // 3. Volatility Analysis
    const sterilizeArray = (arr: any[], limit: number = 5) => {
        const cleanArr = (Array.isArray(arr) ? arr : []).map(v => this.clamp(this.clean(v), 0, 6.0));
        return cleanArr.slice(-limit);
    };

    const npxGSeq = sterilizeArray(team.npxGSequence);
    const xGASeq = sterilizeArray(team.xGASequence);

    // 4. Signal Fidelity Check
    let signalFidelity = 1.0;
    const divergence = Math.abs(rawNPXG - rawXT);
    if (divergence > 1.2) signalFidelity *= 0.92;

    if (npxGSeq.length >= 3) {
        const mean = npxGSeq.reduce((a, b) => a + b, 0) / npxGSeq.length;
        const variance = npxGSeq.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / npxGSeq.length;
        const stdDev = Math.sqrt(variance);
        
        const zScore = stdDev > 0 ? Math.abs(finalizedExpectancy - mean) / stdDev : 0;
        if (zScore > 2.0) {
            finalizedExpectancy = mean + (Math.sign(finalizedExpectancy - mean) * 2.0 * stdDev);
            signalFidelity = 0.85; 
        }
    }

    // 5. Stability Metrics
    const basePurity = team.purity || 0.85; 
    const shift = Math.abs(finalizedExpectancy - baselineXG);
    const calibrationStability = this.clamp(1 - (shift * 1.5) - ((1 - reliability) * 0.15), 0.1, 1.0);
    const dataPurity = this.clamp((signalFidelity * basePurity) - (shift * 0.2), 0.1, 1.0);

        return {
            name: String(team.name || "Unknown"),
            npxG: finalizedExpectancy,
            xT: rawXT,
            avgXG: baselineXG,
            avgXGA: this.clamp(this.clean(team.avgXGA), 0, 5.0),
            goalsScored: this.clean(team.goalsScored),
            goalsConceded: this.clean(team.goalsConceded),
            defensiveStability: this.clamp(this.clean(team.defensiveStability, 0.5), 0.05, 1.0),
            offensiveVolatility: this.clamp(this.clean(team.offensiveVolatility, 0.5), 0.05, 1.0),
            form: (Array.isArray(team.form) ? team.form : [0.5]).map((v: number) => this.clamp(this.clean(v, 0.5), 0, 1.0)),
            cleanSheets: this.clean(team.cleanSheets),
            calibrationStability,
            dataPurity,
            npxGSequence: npxGSeq,
            xGASequence: xGASeq,
            matchHistory: Array.isArray(team.matchHistory) ? team.matchHistory.slice(-5) : []
        };
    }
}

// --- SIGNAL FILTERING ---

export interface TeamState {
    id: string;
    estimatedNpxG: number;
    uncertainty: number;
    elo: number; // Independent secondary rating
    lastUpdate: string;
}

export interface MatchResult {
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    date: string;
}

export interface LeagueState {
    rho: number;
    homeAdvantage: number;
    lastFitted: string;
}

/**
 * RECURSIVE STATE STORE
 * Persists team-level strength estimates and uncertainty across matches.
 */
export class StateStore {
    private static states: Map<string, TeamState> = new Map();

    static get(teamName: string): TeamState | null {
        return this.states.get(teamName) || null;
    }

    static set(state: TeamState) {
        this.states.set(state.id, state);
    }
    
    static reset() {
        this.states.clear();
    }
    
    /**
     * RECURSIVE STATE UPDATE
     * Called AFTER a match is played to update the team's latent state.
     */
    static updateStateAfterMatch(teamName: string, actualGoals: number, actualConceded: number, date: string) {
        const existing = StateStore.get(teamName);
        if (!existing) return;

        const lastDate = new Date(existing.lastUpdate);
        const currentDate = new Date(date);
        const daysSince = Math.max(0.5, (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        const filter = new SignalFilter(existing.estimatedNpxG, existing.uncertainty);
        
        // Measurement is the actual goals, with a higher noise (since goals are noisier than xG)
        const measurementNoise = 0.8; 
        const update = filter.update(actualGoals, measurementNoise, 0.05, 1.0, daysSince);

        // Update Elo based on goal difference
        const goalDiff = actualGoals - actualConceded;
        const eloChange = goalDiff * 20; 

        StateStore.set({
            ...existing,
            estimatedNpxG: update.state,
            uncertainty: update.uncertainty,
            elo: existing.elo + eloChange,
            lastUpdate: date
        });
    }
}

/**
 * LEAGUE PARAMETER STORE
 * Persists MLE-fitted league constants like Dixon-Coles rho and home advantage.
 */
export class LeagueStateStore {
    private static state: LeagueState = {
        rho: 0.08, // Initial principled prior
        homeAdvantage: 0.25, // Average PL home boost in xG terms
        lastFitted: new Date().toISOString()
    };

    static get() { return this.state; }
    static set(state: LeagueState) { this.state = state; }
}

/**
 * DIXON-COLES MLE OPTIMIZER
 * Calibrates the model parameters against historical match results.
 */
export class DixonColesOptimizer {
    /**
     * Newton-Raphson step for rho (dependency parameter).
     * Maximizes log-likelihood tau(x, y | lambda, mu, rho).
     */
    static calibrateRho(results: { hG: number; aG: number; hExp: number; aExp: number }[]): number {
        let rho = LeagueStateStore.get().rho;
        const iterations = 8;
        
        for (let i = 0; i < iterations; i++) {
            let firstDeriv = 0;
            let secondDeriv = 0;

            for (const m of results) {
                const { hG: x, aG: y, hExp: h, aExp: a } = m;
                let d = 0, hss = 0;

                // Dixon-Coles Tau Adjustment Derivatives
                if (x === 0 && y === 0) {
                    const val = 1 - h * a * rho;
                    d = -h * a / val;
                    hss = -(h * h * a * a) / (val * val);
                } else if (x === 0 && y === 1) {
                    const val = 1 + h * rho;
                    d = h / val;
                    hss = -(h * h) / (val * val);
                } else if (x === 1 && y === 0) {
                    const val = 1 + a * rho;
                    d = a / val;
                    hss = -(a * a) / (val * val);
                } else if (x === 1 && y === 1) {
                    const val = 1 - rho;
                    d = -1 / val;
                    hss = -1 / (val * val);
                }

                firstDeriv += d;
                secondDeriv += hss;
            }

            if (Math.abs(secondDeriv) < 1e-10) break;
            const step = firstDeriv / secondDeriv;
            rho -= step;
            rho = Math.max(-0.25, Math.min(0.25, rho)); // Constraint boundaries
            if (Math.abs(step) < 1e-6) break;
        }
        return rho;
    }

    /**
     * Coordinate-wise MLE for Home Advantage (gamma).
     */
    static calibrateHomeAdvantage(results: { hG: number; hExp: number }[]): number {
        let gamma = LeagueStateStore.get().homeAdvantage;
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
            let firstDeriv = 0;
            let secondDeriv = 0;

            for (const m of results) {
                // For Poisson lambda = base * exp(gamma)
                // dL/dgamma = x - lambda
                // d2L/dgamma2 = -lambda
                const lambda = m.hExp * Math.exp(gamma);
                firstDeriv += (m.hG - lambda);
                secondDeriv -= lambda;
            }

            if (Math.abs(secondDeriv) < 1e-10) break;
            const step = firstDeriv / secondDeriv;
            gamma -= step;
            if (Math.abs(step) < 1e-5) break;
        }
        return gamma;
    }
}

class SignalFilter {
    private state: number;
    private uncertainty: number;
    private gain: number = 0.5;

    constructor(initialState: number, initialUncertainty: number = 1.0) {
        this.state = initialState;
        this.uncertainty = initialUncertainty;
    }

    /**
     * RECURSIVE UPDATE
     * @param measurement Current match npxG
     * @param dataNoise Measurement Noise (R) - linked to reliability
     * @param baseDrift Process Noise (Q) - base drift per 7 days
     * @param driftCoefficient Tactical drift multiplier
     * @param daysSinceLast Time-aware decay for uncertainty
     */
    update(
        measurement: number, 
        dataNoise: number, 
        baseDrift: number, 
        driftCoefficient: number, 
        daysSinceLast: number = 7
    ): { state: number; uncertainty: number } {
        // 1. Prediction Step: Grow uncertainty (Q) based on time elapsed
        const processNoise = baseDrift * (daysSinceLast / 7) * driftCoefficient;
        this.uncertainty = this.uncertainty + processNoise;
        
        // 2. Innovation Step
        const innovation = measurement - this.state;
        const innovationCovariance = this.uncertainty + dataNoise;
        
        // 3. Kalman Gain calculation with outlier gating
        const zScoreSq = (innovation * innovation) / Math.max(1e-6, innovationCovariance);
        const gatingMultiplier = zScoreSq > 9 ? 0.35 : 1.0; 

        this.gain = (this.uncertainty / Math.max(1e-9, innovationCovariance)) * gatingMultiplier;
        
        // 4. Update Step (State)
        this.state = this.state + this.gain * innovation;
        
        // 5. Update Step (Uncertainty) - Joseph Form for stability
        const common = (1 - this.gain);
        this.uncertainty = (common * this.uncertainty * common) + (this.gain * dataNoise * this.gain);
        
        return { state: this.state, uncertainty: this.uncertainty };
    }
}

// --- CORE MODELS ---

export const calculateMatchExpectancy = (
    home: TeamStats, 
    away: TeamStats, 
    maxVariance: number, 
    marketSignal: number, 
    context?: MatchContext
) => {
    // 1. Signal Quantification Layer
    const driftCoeff = IngestionService.quantifySignal(context?.tacticalDrift || 'STABLE', 'DRIFT');
    const stakeCoeff = IngestionService.quantifySignal(context?.stakes || 'STANDARD', 'STAKES');
    const marketAdj = IngestionService.quantifySignal(context?.marketSentiment || 'NEUTRAL', 'SENTIMENT');
    
    const marketEffect = (marketSignal > 0 ? 0.9 : 1.1) * stakeCoeff;
    const calculateNoise = (team: TeamStats) => Math.max(0.05, (
        ((1 - (team.defensiveStability || 0.5)) * 0.2) + 
        ((team.offensiveVolatility || 0.5) * 0.1) + 
        maxVariance + 
        (1 - (team.dataPurity || 1)) * 0.15
    ) * marketEffect);

    const homeNoise = calculateNoise(home);
    const awayNoise = calculateNoise(away);

    const league = LeagueStateStore.get();
    const leagueAvg = 1.35;
    
    let totalUncertainty = 0;

    // 2. Adaptive Recursive Estimation
    const runEstimation = (team: TeamStats, noise: number) => {
        const existing = StateStore.get(team.name);
        
        // 2a. Principled Initialization
        const initialState = existing ? existing.estimatedNpxG : (team.avgXG || 1.35);
        const initialP = existing ? existing.uncertainty : 1.2;
        const initialElo = existing ? existing.elo : 1500;
        const lastDate = existing ? new Date(existing.lastUpdate) : new Date(Date.now() - 7 * 86400000);
        
        const matchDate = context?.date ? new Date(context.date) : new Date();
        const daysSince = Math.max(0.5, (matchDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // 2b. Kalman Execution
        const filter = new SignalFilter(initialState, initialP);
        const update = filter.update(team.npxG || 1.35, noise, 0.05, driftCoeff, daysSince);
        
        totalUncertainty += update.uncertainty;

        // 2c. Simple Elo Update (Secondary Independent Method)
        // This acts as the "Second Opinion" for Lock 4
        const eloChange = ((team.npxG - (team.avgXGA || 1.35)) * 15);
        const updatedElo = initialElo + eloChange;

        // 2d. Sequential Persistence
        StateStore.set({
            id: team.name,
            estimatedNpxG: update.state,
            uncertainty: update.uncertainty,
            elo: updatedElo,
            lastUpdate: matchDate.toISOString()
        });
        
        return { state: update.state, elo: updatedElo };
    };

    const hResult = runEstimation(home, homeNoise);
    const aResult = runEstimation(away, awayNoise);

    const homeParam = (hResult.state / leagueAvg) + marketAdj;
    const awayParam = (aResult.state / leagueAvg) - marketAdj;

    // Apply Home Advantage (gamma) and league scaling
    const homeLambda = Math.max(0.1, Math.min(6.5, homeParam * leagueAvg * Math.exp(league.homeAdvantage)));
    const awayMu = Math.max(0.1, Math.min(6.5, awayParam * leagueAvg));

    // 3. Calibrated Dependency (Dixon-Coles rho)
    const dependence = league.rho;
    
    // 4. Independent Purity Score (Data Quality + State Stability)
    const inputPurity = ((home.dataPurity || 0.8) + (away.dataPurity || 0.8)) / 2;
    const stateStability = Math.max(0, 1 - (totalUncertainty / 2.5)); 
    const finalizedPurity = (inputPurity * 0.6) + (stateStability * 0.4);

    return { 
        homeScoring: homeLambda, 
        awayScoring: awayMu, 
        dependence, 
        purity: finalizedPurity,
        eloDiff: hResult.elo - aResult.elo 
    };
};

export const calculateProbability = (
    hScoring: number, 
    aScoring: number, 
    dependence: number, 
    phases: TacticalPhase[], 
    dataPurity: number, 
    eloDiff: number,
    context?: MatchContext
) => {
    // Log-space Factorial to prevent overflow
    const logFactorial = (n: number): number => {
        let res = 0;
        for (let i = 2; i <= n; i++) res += Math.log(i);
        return res;
    };

    const logPoisson = (k: number, lambda: number) => {
        if (lambda <= 0) return k === 0 ? 0 : -Infinity;
        return k * Math.log(lambda) - lambda - logFactorial(k);
    };

    const getAdj = (x: number, y: number, hL: number, aL: number, d: number) => {
        if (x === 0 && y === 0) return 1 - (hL * aL * d);
        if (x === 1 && y === 0) return 1 + (aL * d);
        if (x === 0 && y === 1) return 1 + (hL * d);
        if (x === 1 && y === 1) return 1 - d;
        return 1;
    };

    let pW = 0, pD = 0, pL = 0, total = 0;
    let pOver15 = 0, pUnder35 = 0;

    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            const logP = logPoisson(h, hScoring) + logPoisson(a, aScoring);
            const p = Math.exp(logP) * getAdj(h, a, hScoring, aScoring, dependence);
            
            if (h > a) pW += p; 
            else if (h === a) pD += p; 
            else pL += p;

            if (h + a > 1.5) pOver15 += p;
            if (h + a < 3.5) pUnder35 += p;
            
            total += p;
        }
    }

    const norm = (val: number) => val / Math.max(1e-6, total);
    const chaos = phases.length > 0 ? phases.filter(p => p.state === 'HIGH_VARIANCE').length / phases.length : 0;
    const stability = phases.length > 0 ? phases.filter(p => p.state === 'CONSERVATIVE').length / phases.length : 0;
    const avgIntensity = phases.length > 0 ? phases.reduce((sum, p) => sum + p.intensity, 0) / phases.length : 50;

    // --- DYNAMIC THRESHOLD CALIBRATION ---
    const d = (context?.tacticalDrift || '').toUpperCase();
    
    // Instead of binary thresholds, we use base values that are modified by context
    const chaosWeight = d.includes('VOLATILE') ? 1.2 : 1.0;

    const outcomes = [
        { 
            type: 'OVER_15', 
            prob: norm(pOver15), 
            baseline: 0.72,
            label: 'Over 1.5',
            signals: {
                statistical: Math.min(1.0, norm(pOver15) / 0.75),
                tactical: Math.min(1.0, (chaos * chaosWeight) / (stability + 0.1)),
                intensity: Math.min(1.0, avgIntensity / 100),
                convergence: Math.min(1.0, (hScoring + aScoring) / 3.0)
            }
        },
        { 
            type: 'UNDER_35', 
            prob: norm(pUnder35), 
            baseline: 0.76,
            label: 'Under 3.5',
            signals: {
                statistical: Math.min(1.0, norm(pUnder35) / 0.75),
                tactical: Math.min(1.0, (stability * 1.1) / (chaos + 0.1)),
                intensity: Math.min(1.0, 40 / (avgIntensity + 1)),
                convergence: Math.min(1.0, 2.2 / (hScoring + aScoring + 0.1))
            }
        }
    ];

    const processed = outcomes.map(o => {
        // Edge is the deviation from the league baseline
        const edge = o.prob / o.baseline;
        const signalStrength = (o.signals.statistical * 0.4) + 
                              (o.signals.tactical * 0.2) + 
                              (o.signals.intensity * 0.2) + 
                              (o.signals.convergence * 0.2);
        
        return {
            ...o,
            edge,
            signalStrength,
            finalProb: o.prob 
        };
    });

    // Corridor Detection: Are both O1.5 and U3.5 showing positive edge?
    const oEdge = processed[0].edge;
    const uEdge = processed[1].edge;
    const isCorridor = oEdge > 1.05 && uEdge > 1.05;

    // Selection: Pick the outcome with the highest statistical Edge
    const strongest = processed.reduce((prev, curr) => (prev.edge > curr.edge) ? prev : curr);

    // --- NUCLEAR FORTRESS PROTOCOL (INDEPENDENT LOCKS) ---
    const viterbi = findTopTacticalPaths(hScoring, aScoring, context)[0];
    
    const lock1 = strongest.prob > 0.72; // Statistical Lock
    const lock2 = viterbi.likelihood > 0.82; // Convergence Lock (Independent of score)
    const lock3 = dataPurity > 0.82; // Data Quality Lock
    
    // Lock 4: Independent Elo Agreement (Second Opinion)
    const homeAdvantageAdjustedElo = eloDiff + 40;
    const eloAgreement = (strongest.type === 'OVER_15') 
        ? homeAdvantageAdjustedElo > -50 // Over 1.5 likely if not extreme mismatch
        : (strongest.type === 'UNDER_35') 
            ? Math.abs(homeAdvantageAdjustedElo) < 160 // Under 3.5 likely in balanced matches
            : true;
    const lock4 = eloAgreement;

    const lockCount = [lock1, lock2, lock3, lock4].filter(Boolean).length;
    const isVoid = strongest.finalProb < 0.55 || lockCount < 1;

    let displayLabel = isVoid ? 'NO CLEAR SIGNAL' : strongest.label;
    if (!isVoid && isCorridor) {
        displayLabel = `STABLE CORRIDOR (2-3)`;
    }

    return { 
        probability: Math.round(strongest.finalProb * 100), 
        predictionType: isVoid ? 'VOID' : strongest.type as any,
        predictionLabel: displayLabel,
        homeXG: hScoring, 
        awayXG: aScoring,
        allOutcomes: outcomes,
        lockCount,
        signalStrength: strongest.signalStrength,
        purity: Math.round(dataPurity * 100),
        isSureshot: strongest.finalProb > 0.82 && strongest.signalStrength > 0.80 && lockCount >= 3 && !isVoid
    };
};

export const findTopTacticalPaths = (_homeScoring: number, _awayScoring: number, context?: MatchContext): TacticalSequence[] => {
    const states: TacticalPhase['state'][] = ['CONSERVATIVE', 'DOMINANT', 'TRANSITIONAL', 'HIGH_VARIANCE'];
    const T = 10;
    
    const transitions: Record<TacticalPhase['state'], Record<TacticalPhase['state'], number>> = {
        'CONSERVATIVE': { 'CONSERVATIVE': 0.6, 'DOMINANT': 0.3, 'TRANSITIONAL': 0.1, 'HIGH_VARIANCE': 0.0 },
        'DOMINANT': { 'CONSERVATIVE': 0.2, 'DOMINANT': 0.5, 'TRANSITIONAL': 0.2, 'HIGH_VARIANCE': 0.1 },
        'TRANSITIONAL': { 'CONSERVATIVE': 0.1, 'DOMINANT': 0.3, 'TRANSITIONAL': 0.4, 'HIGH_VARIANCE': 0.2 },
        'HIGH_VARIANCE': { 'CONSERVATIVE': 0.0, 'DOMINANT': 0.1, 'TRANSITIONAL': 0.3, 'HIGH_VARIANCE': 0.6 }
    };

    // DRIFT influence on base intensity (Independent of direct Poisson output)
    const driftCoeff = context?.tacticalDrift?.includes('VOLATILE') ? 1.4 : 1.0;
    const stakeCoeff = context?.stakes?.includes('CRITICAL') ? 1.2 : 1.0;
    const baseIntensity = Math.min(95, 45 * driftCoeff * stakeCoeff); 
    
    const pdf = (x: number, mean: number, stdDev: number) => {
        const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
        return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    };

    const getEmission = (state: TacticalPhase['state'], timeStep: number) => {
        const drift = Math.sin(timeStep * 0.4) * 5;
        const obs = Math.max(0, Math.min(100, baseIntensity + drift));
        
        switch (state) {
            case 'CONSERVATIVE': return pdf(obs, 35, 12);
            case 'DOMINANT':     return pdf(obs, 52, 10);
            case 'TRANSITIONAL': return pdf(obs, 72, 12);
            case 'HIGH_VARIANCE': return pdf(obs, 90, 15);
            default: return 0.001;
        }
    };

    const runViterbi = (biasTransitions: typeof transitions, label: string): TacticalSequence => {
        const viterbi: number[][] = Array.from({ length: T }, () => Array(states.length).fill(-Infinity));
        const backpointer: number[][] = Array.from({ length: T }, () => Array(states.length).fill(0));
        const margins: number[] = Array(T).fill(1.0);

        const logTransitions: Record<string, Record<string, number>> = {};
        states.forEach(s1 => {
            logTransitions[s1] = {};
            const rowSum = states.reduce((sum, s2) => sum + biasTransitions[s1][s2], 0);
            states.forEach(s2 => {
                const prob = (biasTransitions[s1][s2] + 1e-6) / (rowSum + 1e-6 * states.length);
                logTransitions[s1][s2] = Math.log(prob);
            });
        });

        for (let s = 0; s < states.length; s++) {
            viterbi[0][s] = Math.log(1 / states.length) + Math.log(getEmission(states[s], 0) + 1e-10);
        }

        for (let t = 1; t < T; t++) {
            for (let s = 0; s < states.length; s++) {
                const logEmission = Math.log(getEmission(states[s], t) + 1e-10);
                for (let prevS = 0; prevS < states.length; prevS++) {
                    const prob = viterbi[t - 1][prevS] + logTransitions[states[prevS]][states[s]] + logEmission;
                    if (prob > viterbi[t][s]) {
                        viterbi[t][s] = prob;
                        backpointer[t][s] = prevS;
                    }
                }
            }
            
            // Calculate Margin Confidence for timestep T
            const stepProbs = states.map((_, sIdx) => viterbi[t][sIdx]).sort((a, b) => b - a);
            const margin = Math.exp(stepProbs[0] - stepProbs[1]);
            margins[t] = Math.min(1.0, 0.4 + (Math.log(margin + 1) / 5));
        }

        let maxLogProb = -Infinity;
        let lastStateIdx = 0;
        for (let s = 0; s < states.length; s++) {
            if (viterbi[T - 1][s] > maxLogProb) {
                maxLogProb = viterbi[T - 1][s];
                lastStateIdx = s;
            }
        }

        const pathIdx: number[] = [lastStateIdx];
        for (let t = T - 1; t > 0; t--) {
            lastStateIdx = backpointer[t][lastStateIdx];
            pathIdx.unshift(lastStateIdx);
        }

        let totalFitness = 0;
        let currentIntensity = baseIntensity;
        
        const phases: TacticalPhase[] = pathIdx.map((idx, t) => {
            const state = states[idx];
            const drift = 0.25 * (baseIntensity - currentIntensity);
            currentIntensity += drift;
            const refinedIntensity = Math.max(20, Math.min(100, currentIntensity + Math.sin(t * 0.5) * 5));
            const emissionProb = getEmission(state, t);
            const fitness = Math.min(1.0, 0.4 + (emissionProb * 20)); // Adjusted scaling
            totalFitness += fitness;

            return {
                state,
                intensity: refinedIntensity,
                confidence: margins[t]
            };
        });

        // Calibrated Convergence Score (More sensitive mapping)
        const avgLogLikelihood = maxLogProb / T;
        const normalizedLikelihood = Math.min(0.98, Math.max(0.4, (avgLogLikelihood + 18) / 15));

        return { 
            label, 
            phases, 
            likelihood: parseFloat(normalizedLikelihood.toFixed(3)), 
            accuracyScore: totalFitness / T
        };
    };

    return [runViterbi(transitions, 'OPTIMAL')];
};

// --- AUDITS & METRICS ---

export const calculateConfidenceAudit = (
    probability: number,
    convergence: number,
    purity: number,
    surety: number
): AnalysisConfidence => {
    // Each component contributes independently (Max 100)
    const score = (probability * 0.25) + (convergence * 25) + (purity * 25) + (surety * 25);
    const verdict = score > 82 ? 'GOLD' : (score > 65 ? 'SILVER' : (score > 45 ? 'BRONZE' : 'VOID'));
    
    const reasoning = [
        `Convergence: ${(convergence * 100).toFixed(0)}% (Path Likelihood)`,
        `Purity: ${(purity * 100).toFixed(0)}% (Data Quality)`,
        `Surety: ${(surety * 100).toFixed(0)}% (Tactical Margin)`
    ];
    
    return {
        confidenceScore: Math.min(100, score),
        verdict,
        analysisReasoning: reasoning
    };
};
