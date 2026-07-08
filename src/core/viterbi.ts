import { TacticalPhase, TacticalSequence, MatchContext } from '../types';

/**
 * VITERBI TACTICAL DECODER
 * Identifies the most likely sequence of tactical states during a match.
 */
export class ViterbiDecoder {
    static findTopTacticalPaths(
        hExpectancy: number, 
        aExpectancy: number, 
        context: MatchContext,
        limit: number = 3
    ): TacticalSequence[] {
        const states: TacticalPhase['state'][] = ['CONSERVATIVE', 'TRANSITIONAL', 'DOMINANT', 'HIGH_VARIANCE'];
        
        // Intensity projection based on stakes
        const baseIntensity = context.stakes === 'CRITICAL' ? 0.85 : 0.65;
        
        const sequences: TacticalSequence[] = [];
        
        // Simple heuristic expansion for illustration
        // In a real Viterbi, we would use transition probabilities
        for (const s1 of states) {
            for (const s2 of states) {
                for (const s3 of states) {
                    const phases: TacticalPhase[] = [
                        { state: s1, confidence: 0.8, intensity: baseIntensity },
                        { state: s2, confidence: 0.7, intensity: baseIntensity * 1.1 },
                        { state: s3, confidence: 0.6, intensity: baseIntensity * 1.2 }
                    ];

                    // Score path based on xG alignment
                    let fitness = 0;
                    const combinedXG = hExpectancy + aExpectancy;
                    
                    phases.forEach(p => {
                        if (combinedXG > 3.0 && p.state === 'HIGH_VARIANCE') fitness += 0.4;
                        if (combinedXG < 1.5 && p.state === 'CONSERVATIVE') fitness += 0.4;
                        if (p.state === 'DOMINANT') fitness += 0.2;
                    });

                    sequences.push({
                        phases,
                        likelihood: Math.min(0.98, 0.4 + (fitness / 3)),
                        accuracyScore: fitness / 1.2
                    });
                }
            }
        }

        return sequences.sort((a, b) => b.likelihood - a.likelihood).slice(0, limit);
    }
}
