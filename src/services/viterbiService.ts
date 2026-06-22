
import { RegimeState, TeamStats } from '../types';

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
    
    // 2. Define Transition Logic (Incorporating Baum-Welch Calibration + Dynamic Normalization)
    const getTransitionProbs = (fromIdx: number, t: number) => {
        let probs = [...calibratedMatrix[fromIdx]];
        
        // Dynamic tactical shifts
        for (let j = 0; j < probs.length; j++) {
            // Exhaustion Sink: Pull towards LOW_INTENSITY (Idx 0) at end of match
            if (t > 7 && j === 0) probs[j] += 0.15;
            if (t > 8 && j === 0) probs[j] += 0.15;
        }
        
        // RE-NORMALIZE: Essential for "Conservation of Probability Mass"
        const sum = probs.reduce((a, b) => a + b, 0);
        return probs.map(p => p / (sum || 1e-10));
    };

    // 2.1 Define Emission Probabilities (Gaussian Intensity Kernel)
    const baseIntensity = (alpha + beta) * 35;
    const totalVolatility = (home.offensiveVolatility || 0.5) + (away.offensiveVolatility || 0.5);
    
    const getEmissionProb = (regime: RegimeState['regime']) => {
        const regimeIntensity: Record<string, number> = {
            'LOW_INTENSITY': 30,
            'HIGH_SATURATION': 50,
            'FLUID_TRANSITION': 70,
            'CHAOTIC_DECAY': 90
        };
        
        const target = regimeIntensity[regime];
        const sigma = 15 * (1 + totalVolatility * 0.5); // Variance scales with volatility
        const diff = Math.abs(baseIntensity - target);
        
        // Robust Emission Kernel (Laplacian-driven for outlier resilience)
        return (1 / (sigma * 2)) * Math.exp(-Math.abs(diff / sigma));
    };

    // 3. Viterbi Beam Search (Modified to find top N paths)
    let beam: ViterbiPath[] = regimes.map(s => ({
        states: [{ regime: s, intensity: 0, confidence: 1 }], 
        logProbability: Math.log(getEmissionProb(s) + 1e-12)
    }));

    for (let t = 1; t < steps; t++) {
        const nextBeam: ViterbiPath[] = [];
        for (const path of beam) {
            const lastState = path.states[path.states.length - 1].regime;
            const fromIdx = regimes.findIndex(r => r === lastState);
            const transitionProbs = getTransitionProbs(fromIdx, t);

            for (let toIdx = 0; toIdx < regimes.length; toIdx++) {
                const nextState = regimes[toIdx];
                const transProb = transitionProbs[toIdx];
                const emissionProb = getEmissionProb(nextState);
                
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
            const baseMapping: Record<string, number> = {
                'LOW_INTENSITY': 30,
                'HIGH_SATURATION': 50,
                'FLUID_TRANSITION': 70,
                'CHAOTIC_DECAY': 90
            };
            const base = baseMapping[s.regime];
            
            // Forensic Intensity Dispersion: Tied to total volatility instead of random jitter
            // We use a deterministic pseudo-random seed based on the path probability to preserve "Match DNA"
            const seed = Math.sin(p.logProbability + i) * 10000;
            const pseudoRandom = seed - Math.floor(seed);
            const dispersion = (pseudoRandom * 10 - 5) * (1 + totalVolatility);
            
            return {
                ...s,
                intensity: Math.max(10, Math.min(100, base + dispersion)),
                confidence: Math.exp(p.logProbability / steps) 
            };
        });
        
        return {
            states: intensitySequence,
            logProbability: p.logProbability
        };
    });

    return topPaths;
};
