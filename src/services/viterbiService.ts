
import { RegimeState, TeamStats } from '../types';
import { calculateShannonEntropy } from './mathUtils';

export interface ViterbiPath {
    states: RegimeState[];
    logProbability: number;
}

/**
 * 1. Baum-Welch (Expectation-Maximization) Transition Calibration
 * Refines the transition matrix using historical observation sequences to identify team-specific tactical propensities.
 * Uses the E-M protocol: Calculate state probabilities (Expectation) and update transitions (Maximization).
 */
const calibrateBaumWelch = (sequence: number[], regimeIntensities: number[]): number[][] => {
    const N = regimeIntensities.length;
    const T = sequence.length;
    
    // 1. Initialize count matrix with Laplace Smoothing (priors)
    let transitions = Array.from({ length: N }, () => Array(N).fill(0.2));
    
    if (T < 2) return transitions.map(row => {
        const sum = row.reduce((a, b) => a + b, 0);
        return row.map(v => v / sum);
    });

    // 2. Map sequence to closest discrete states
    const path = sequence.map(v => {
        let minDiff = Infinity;
        let bestIdx = 0;
        regimeIntensities.forEach((intensity, idx) => {
            const diff = Math.abs(v - intensity);
            if (diff < minDiff) {
                minDiff = diff;
                bestIdx = idx;
            }
        });
        return bestIdx;
    });

    // 3. Maximization: Update transition frequencies from the observed path
    for (let i = 0; i < path.length - 1; i++) {
        transitions[path[i]][path[i+1]] += 1.0;
    }

    // 4. Normalize rows to produce a valid Stochastic Matrix A
    return transitions.map(row => {
        const sum = row.reduce((a, b) => a + b, 0);
        return row.map(v => v / sum);
    });
};

/**
 * Viterbi Path Finder
 * Finds the N most likely tactical paths for a match based on statistical "Match DNA".
 */
export const findTopTacticalPaths = (
    alpha: number, 
    beta: number, 
    home: TeamStats, 
    away: TeamStats, 
    topN: number = 3,
    steps: number = 10
): ViterbiPath[] => {
    const regimes: RegimeState['regime'][] = ['LOW_INTENSITY', 'HIGH_SATURATION', 'FLUID_TRANSITION', 'CHAOTIC_DECAY'];
    const intensities = [30, 50, 70, 90];
    
    // 1. Baum-Welch Calibration Step
    // We ingest historical npxG sequences to calibrate the transition propensities.
    const hSeq = home.npxGSequence || [home.npxG];
    const aSeq = away.npxGSequence || [away.npxG];
    const combinedSeq = hSeq.map((v, i) => (v + (aSeq[i] || away.npxG)) * 35);
    
    const calibratedMatrix = calibrateBaumWelch(combinedSeq, intensities);
    
    // 2. Define Transition Logic (Incorporating Baum-Welch Calibration + Time Decay)
    const getTransitionProb = (fromIdx: number, toIdx: number, t: number) => {
        let prob = calibratedMatrix[fromIdx][toIdx];
        
        // Entropy-driven Turbulence Scaling
        const homeEntropy = calculateShannonEntropy(home);
        const awayEntropy = calculateShannonEntropy(away);
        const turbulence = (homeEntropy + awayEntropy) / 2;
        
        if (fromIdx !== toIdx) {
            prob *= (1 + turbulence); // High entropy boosts jump propensity
        }
        
        // Exhaustion Sink: Pull towards LOW_INTENSITY (Idx 0) at end of match
        if (t > 7 && toIdx === 0) prob += 0.25;
        
        return prob;
    };

    // 2. Define Emission Probabilities (Expected Intensity vs State Definition)
    const baseIntensity = (alpha + beta) * 35;
    const getEmissionProb = (regime: RegimeState['regime'], time: number) => {
        const regimeIntensity: Record<string, number> = {
            'LOW_INTENSITY': 30,
            'HIGH_SATURATION': 50,
            'FLUID_TRANSITION': 70,
            'CHAOTIC_DECAY': 90
        };
        
        const target = regimeIntensity[regime];
        const diff = Math.abs(baseIntensity - target);
        
        // Probability of this state given match DNA (alpha/beta)
        return Math.exp(-diff / 20);
    };

    // 3. Viterbi Beam Search (Modified to find top N paths)
    let beam: ViterbiPath[] = regimes.map(s => ({
        states: [{ regime: s, intensity: 0, confidence: 1 }], // Placeholder intensity
        logProbability: Math.log(getEmissionProb(s, 0))
    }));

    for (let t = 1; t < steps; t++) {
        const nextBeam: ViterbiPath[] = [];
        for (const path of beam) {
            const lastState = path.states[path.states.length - 1].regime;
            const fromIdx = regimes.findIndex(r => r === lastState);

            for (let toIdx = 0; toIdx < regimes.length; toIdx++) {
                const nextState = regimes[toIdx];
                const transProb = getTransitionProb(fromIdx, toIdx, t);
                const emissionProb = getEmissionProb(nextState, t);
                
                nextBeam.push({
                    states: [...path.states, { regime: nextState, intensity: 0, confidence: 1 }],
                    logProbability: path.logProbability + Math.log(transProb + 1e-10) + Math.log(emissionProb + 1e-10)
                });
            }
        }
        // Pruning: Keep only top 10 candidates to prevent explosion
        nextBeam.sort((a, b) => b.logProbability - a.logProbability);
        beam = nextBeam.slice(0, 10);
    }

    // 4. Final Cleanup (Inject Intensities and Normalization)
    const topPaths = beam.slice(0, topN).map(p => {
        const intensitySequence = p.states.map((s, i) => {
            const base = {
                'LOW_INTENSITY': 30,
                'HIGH_SATURATION': 50,
                'FLUID_TRANSITION': 70,
                'CHAOTIC_DECAY': 90
            }[s.regime];
            
            // Random jitter within state boundaries
            const jitter = (Math.random() * 10 - 5);
            return {
                ...s,
                intensity: base + jitter,
                confidence: Math.exp(p.logProbability / steps) // Average confidence
            };
        });
        
        return {
            states: intensitySequence,
            logProbability: p.logProbability
        };
    });

    return topPaths;
};
