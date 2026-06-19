
import { RegimeState, TeamStats } from '../types';
import { calculateShannonEntropy } from './mathUtils';

export interface ViterbiPath {
    states: RegimeState[];
    logProbability: number;
}

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
    const states: RegimeState['regime'][] = ['LOW_INTENSITY', 'HIGH_SATURATION', 'FLUID_TRANSITION', 'CHAOTIC_DECAY'];
    
    // 1. Define Transition Matrix (Match DNA)
    // Home/Away Entropy defines the "Turbulence" of transitions.
    const homeEntropy = calculateShannonEntropy(home);
    const awayEntropy = calculateShannonEntropy(away);
    const turbulence = (homeEntropy + awayEntropy) / 2;

    const getTransitionProb = (from: RegimeState['regime'], to: RegimeState['regime'], t: number) => {
        // High turbulence increases jump probability between distant states (Low <-> Chaotic)
        // High t (time) increases transition to Exhaustion (Low Intensity)
        
        const distances: Record<string, number> = {
            'LOW_INTENSITY': 0,
            'HIGH_SATURATION': 1,
            'FLUID_TRANSITION': 2,
            'CHAOTIC_DECAY': 3
        };

        const dist = Math.abs(distances[from] - distances[to]);
        
        let baseProb = 0;
        if (dist === 0) baseProb = 0.6 - (turbulence * 0.2); // Stickiness
        else if (dist === 1) baseProb = 0.3 + (turbulence * 0.1); // Gradual shift
        else baseProb = 0.1 + (turbulence * 0.1); // Sudden jump

        // Exhaustion pull towards end of match
        if (t > 7 && to === 'LOW_INTENSITY') baseProb += 0.3;
        
        return baseProb;
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
    let beam: ViterbiPath[] = states.map(s => ({
        states: [{ regime: s, intensity: 0, confidence: 1 }], // Placeholder intensity
        logProbability: Math.log(getEmissionProb(s, 0))
    }));

    for (let t = 1; t < steps; t++) {
        const nextBeam: ViterbiPath[] = [];
        for (const path of beam) {
            const lastState = path.states[path.states.length - 1].regime;
            for (const nextState of states) {
                const transProb = getTransitionProb(lastState, nextState, t);
                const emissionProb = getEmissionProb(nextState, t);
                
                nextBeam.push({
                    states: [...path.states, { regime: nextState, intensity: 0, confidence: 1 }],
                    logProbability: path.logProbability + Math.log(transProb) + Math.log(emissionProb)
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
