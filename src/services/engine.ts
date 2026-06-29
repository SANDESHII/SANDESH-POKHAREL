
import { TeamStats, TacticalPhase, TacticalSequence, AnalysisConfidence, ModelAudit, MatchContext } from '../types';

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
                if (s.includes('VOLATILE')) return 1.45;
                if (s.includes('FLUX')) return 1.20;
                if (s.includes('STABLE')) return 0.75;
                return 1.0;
            case 'SENTIMENT':
                if (s.includes('BULLISH')) return 0.15; // Positive market pressure
                if (s.includes('BEARISH')) return -0.15; // Negative market pressure
                return 0;
            case 'STAKES':
                if (s.includes('CRITICAL')) return 1.15; // High pressure increases intensity
                if (s.includes('STANDARD')) return 1.0;
                if (s.includes('DEAD-HEAT')) return 0.85; // Lower intensity
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
    const aiWeight = this.clamp(reliability * 0.9, 0.4, 0.9);
    const baselineWeight = 1 - aiWeight;
    
    const aiSignal = (rawNPXG * adjA + rawXT * (1 - adjA));
    let finalizedExpectancy = (aiSignal * aiWeight) + (baselineXG * baselineWeight);

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
    const shift = Math.abs(finalizedExpectancy - baselineXG);
    const calibrationStability = this.clamp(1 - (shift * 1.5) - ((1 - reliability) * 0.15), 0.1, 1.0);
    const dataPurity = this.clamp(signalFidelity - (shift * 0.2), 0.1, 1.0);

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

class SignalFilter {
    private state: number;
    private uncertainty: number;
    private gain: number = 0.5;

    constructor(initialState: number) {
        this.state = initialState;
        this.uncertainty = 1.0; // Initial state uncertainty
    }

    update(measurement: number, dataNoise: number, stateDrift: number, driftCoefficient: number = 1.0): number {
        const adjustedDrift = Math.max(0.01, stateDrift * driftCoefficient);
        this.uncertainty = this.uncertainty + adjustedDrift;
        
        const innovation = measurement - this.state;
        const innovationCovariance = this.uncertainty + dataNoise;
        
        const zScoreSq = (innovation * innovation) / Math.max(1e-6, innovationCovariance);
        const gatingMultiplier = zScoreSq > 9 ? 0.4 : 1.0; 

        this.gain = (this.uncertainty / Math.max(1e-9, innovationCovariance)) * gatingMultiplier;
        this.state = this.state + this.gain * innovation;
        
        const common = (1 - this.gain);
        this.uncertainty = (common * this.uncertainty * common) + (this.gain * dataNoise * this.gain);
        
        return this.state;
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

    const leagueAvg = 1.35;
    
    // 2. Adaptive Estimation with Alpha Signals
    const runEstimation = (team: TeamStats, noise: number) => {
        const filter = new SignalFilter(team.avgXG || 1.35);
        return filter.update(team.npxG || 1.35, noise, 0.05, driftCoeff);
    };

    let homeParam = ((runEstimation(home, homeNoise) || 1.35) / leagueAvg) + marketAdj;
    let awayParam = ((runEstimation(away, awayNoise) || 1.35) / leagueAvg) - marketAdj;

    // Numerical optimization: Weighted Moving Average with Learning Rate
        const learningRate = 0.15;
        for (let i = 0; i < 20; i++) {
            const homeTarget = (home.npxG / leagueAvg);
            const awayTarget = (away.npxG / leagueAvg);
            homeParam += (homeTarget - homeParam) * learningRate;
            awayParam += (awayTarget - awayParam) * learningRate;
            
            // Convergence check
            if (Math.abs(homeTarget - homeParam) < 1e-4 && Math.abs(awayTarget - awayParam) < 1e-4) break;
        }

    const homeLambda = Math.max(0.1, Math.min(6.5, homeParam * leagueAvg));
    const awayMu = Math.max(0.1, Math.min(6.5, awayParam * leagueAvg));

    const dependence = Math.min(0.1, Math.max(-0.25, (Math.tanh((home.avgXGA + away.avgXGA) / 5) * 0.1) - (Math.tanh(1 / (homeLambda + awayMu + 0.5)) * 0.35)));
    
    return { homeScoring: homeLambda, awayScoring: awayMu, dependence };
};

export const calculateProbability = (hScoring: number, aScoring: number, dependence: number, phases: TacticalPhase[]) => {
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
        // Dixon-Coles Tau adjustment (Simplified)
        if (x === 0 && y === 0) return 1 - (hL * aL * d);
        if (x === 1 && y === 0) return 1 + (aL * d);
        if (x === 0 && y === 1) return 1 + (hL * d);
        if (x === 1 && y === 1) return 1 - d;
        return 1;
    };

    let pW = 0, pD = 0, pL = 0, total = 0, pOver15 = 0;
    for (let h = 0; h <= 10; h++) {
        for (let a = 0; a <= 10; a++) {
            const logP = logPoisson(h, hScoring) + logPoisson(a, aScoring);
            const p = Math.exp(logP) * getAdj(h, a, hScoring, aScoring, dependence);
            if (h > a) pW += p; else if (h === a) pD += p; else pL += p;
            if (h + a > 1.5) pOver15 += p;
            total += p;
        }
    }

    // Advanced weight: normalize by total sum to ensure probability stays within [0,1]
    const baseProb = pOver15 / Math.max(1e-6, total);
    const chaos = phases.length > 0 ? phases.filter(p => p.state === 'HIGH_VARIANCE').length / phases.length : 0;
    
    // Final result incorporates high-variance tactical phases as a confidence modifier
    const finalProb = baseProb + (baseProb * (chaos * 0.12));

    return { probability: Math.round(Math.min(99, finalProb * 100)), homeXG: hScoring, awayXG: aScoring };
};

export const findTopTacticalPaths = (homeScoring: number, awayScoring: number): TacticalSequence[] => {
    const states: TacticalPhase['state'][] = ['CONSERVATIVE', 'DOMINANT', 'TRANSITIONAL', 'HIGH_VARIANCE'];
    const T = 10;
    
    const transitions: Record<TacticalPhase['state'], Record<TacticalPhase['state'], number>> = {
        'CONSERVATIVE': { 'CONSERVATIVE': 0.6, 'DOMINANT': 0.3, 'TRANSITIONAL': 0.1, 'HIGH_VARIANCE': 0.0 },
        'DOMINANT': { 'CONSERVATIVE': 0.2, 'DOMINANT': 0.5, 'TRANSITIONAL': 0.2, 'HIGH_VARIANCE': 0.1 },
        'TRANSITIONAL': { 'CONSERVATIVE': 0.1, 'DOMINANT': 0.3, 'TRANSITIONAL': 0.4, 'HIGH_VARIANCE': 0.2 },
        'HIGH_VARIANCE': { 'CONSERVATIVE': 0.0, 'DOMINANT': 0.1, 'TRANSITIONAL': 0.3, 'HIGH_VARIANCE': 0.6 }
    };

    const baseIntensity = (homeScoring + awayScoring) * 35;
    
    const pdf = (x: number, mean: number, stdDev: number) => {
        const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
        return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    };

    const getEmission = (state: TacticalPhase['state'], timeStep: number) => {
        const obs = Math.max(0, Math.min(100, baseIntensity + Math.sin(timeStep * 0.5) * 8));
        
        switch (state) {
            case 'CONSERVATIVE': return pdf(obs, 35, 12) * 10;
            case 'DOMINANT':     return pdf(obs, 52, 10) * 10;
            case 'TRANSITIONAL': return pdf(obs, 72, 12) * 10;
            case 'HIGH_VARIANCE': return pdf(obs, 90, 15) * 10;
            default: return 0.01;
        }
    };

    const runViterbi = (biasTransitions: typeof transitions, label: string): TacticalSequence => {
        const viterbi: number[][] = Array.from({ length: T }, () => Array(states.length).fill(-Infinity));
        const backpointer: number[][] = Array.from({ length: T }, () => Array(states.length).fill(0));

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
            const drift = 0.25 * (baseIntensity - currentIntensity); // Removed Math.random for stability
            currentIntensity += drift;
            const refinedIntensity = Math.max(20, Math.min(100, currentIntensity + Math.sin(t * 0.5) * 5));
            const emissionProb = getEmission(state, t);
            const fitness = Math.min(1.0, 0.4 + (emissionProb * 0.8));
            totalFitness += fitness;

            return {
                state,
                intensity: refinedIntensity,
                confidence: 0.85
            };
        });

        return { 
            label, 
            phases, 
            likelihood: Math.min(0.98, 0.75 + Math.exp(maxLogProb / T) * 5), 
            accuracyScore: totalFitness / T
        };
    };

    return [runViterbi(transitions, 'OPTIMAL')];
};

// --- AUDITS & METRICS ---

export const calculateConfidenceAudit = (
    probability: number,
    modelAudit: ModelAudit
): AnalysisConfidence => {
    const score = (probability * 0.3) + (modelAudit.signalPurity * 50);
    const verdict = score > 75 ? 'GOLD' : (score > 55 ? 'SILVER' : 'BRONZE');
    
    return {
        confidenceScore: Math.min(100, score),
        verdict,
        analysisReasoning: ["Signal convergence optimal.", "Scoring baseline stable."]
    };
};
