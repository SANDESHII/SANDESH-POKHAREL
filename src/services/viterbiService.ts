
import { RegimeState, TeamStats } from '../types';
import { calculateShannonEntropy } from './mathUtils';

export interface ViterbiPath {
    states: RegimeState[];
    logProbability: number;
}

/**
 * 1. Baum-Welch (Soft Expectation-Maximization) Transition Calibration
 * Refines the transition matrix using historical observation sequences.
 * Uses the Forward-Backward protocol with scaling factors to prevent numerical underflow.
 */
const calibrateBaumWelch = (sequence: number[], intensities: number[]): number[][] => {
    const N = intensities.length;
    const T = sequence.length;
    if (T < 2) return Array.from({ length: N }, () => Array(N).fill(1/N));

    // Initialize Transition Matrix A with institutional priors (Tactical Stickiness)
    let A = Array.from({ length: N }, (_, i) => 
        Array.from({ length: N }, (_, j) => (i === j ? 0.75 : 0.25 / (N - 1)))
    );

    let pi = [0.5, 0.2, 0.2, 0.1]; // Prior: Matches usually start in lower intensity
    let iterations = 0;
    const maxIterations = 5; // Balanced for client-side performance vs precision
    let lastLogLikelihood = -Infinity;

    while (iterations < maxIterations) {
        // Forward Pass (Alpha) with scaling
        let alpha = Array.from({ length: T }, () => Array(N).fill(0));
        let c = Array(T).fill(0);

        const getB = (stateIdx: number, obs: number) => {
            const diff = Math.abs(obs - intensities[stateIdx]);
            return Math.exp(-0.5 * Math.pow(diff / 12, 2)) + 1e-8;
        };

        for (let i = 0; i < N; i++) {
            alpha[0][i] = pi[i] * getB(i, sequence[0]);
            c[0] += alpha[0][i];
        }
        c[0] = 1.0 / (c[0] || 1e-12);
        for (let i = 0; i < N; i++) alpha[0][i] *= c[0];

        for (let t = 1; t < T; t++) {
            for (let j = 0; j < N; j++) {
                let sum = 0;
                for (let i = 0; i < N; i++) sum += alpha[t-1][i] * A[i][j];
                alpha[t][j] = sum * getB(j, sequence[t]);
                c[t] += alpha[t][j];
            }
            c[t] = 1.0 / (c[t] || 1e-12);
            for (let j = 0; j < N; j++) alpha[t][j] *= c[t];
        }

        // Backward Pass (Beta)
        let beta = Array.from({ length: T }, () => Array(N).fill(0));
        for (let i = 0; i < N; i++) beta[T-1][i] = c[T-1];
        for (let t = T - 2; t >= 0; t--) {
            for (let i = 0; i < N; i++) {
                let sum = 0;
                for (let j = 0; j < N; j++) {
                    sum += A[i][j] * getB(j, sequence[t+1]) * beta[t+1][j];
                }
                beta[t][i] = sum * c[t];
            }
        }

        // Convergence Check: Calculate Log-Likelihood
        let currentLogLikelihood = 0;
        for (let t = 0; t < T; t++) currentLogLikelihood -= Math.log(c[t] || 1e-12);
        
        if (Math.abs(currentLogLikelihood - lastLogLikelihood) < 1e-4) break;
        lastLogLikelihood = currentLogLikelihood;

        // E-Step & M-Step Combined
        let newA = Array.from({ length: N }, () => Array(N).fill(0));
        for (let t = 0; t < T - 1; t++) {
            // Apply Temporal Bias: Recent observations are 20% more influential
            const temporalWeight = 1 + (t / T) * 0.2;
            
            let denom = 0;
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    denom += alpha[t][i] * A[i][j] * getB(j, sequence[t+1]) * beta[t+1][j];
                }
            }
            for (let i = 0; i < N; i++) {
                for (let j = 0; j < N; j++) {
                    const xi = (alpha[t][i] * A[i][j] * getB(j, sequence[t+1]) * beta[t+1][j]) / (denom || 1e-12);
                    newA[i][j] += xi * temporalWeight;
                }
            }
        }

        A = newA.map(row => {
            const sum = row.reduce((a, b) => a + b, 0);
            return sum > 0 ? row.map(v => v / sum) : row.map(() => 1/N);
        });

        iterations++;
    }

    return A;
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
