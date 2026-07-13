import { TacticalPhase, TacticalSequence, MatchContext } from '../types';

export class ViterbiDecoder {
    static findTopTacticalPaths(hExp: number, aExp: number, context: MatchContext, limit: number = 3): TacticalSequence[] {
        const states: TacticalPhase['state'][] = ['CONSERVATIVE', 'TRANSITIONAL', 'DOMINANT', 'HIGH_VARIANCE'];
        const baseInt = context.stakes === 'CRITICAL' ? 0.85 : 0.65;
        const combXG = hExp + aExp;
        const sequences: TacticalSequence[] = [];

        states.forEach(s1 => {
            states.forEach(s2 => {
                states.forEach(s3 => {
                    const phases: TacticalPhase[] = [
                        { state: s1, confidence: 0.8, intensity: baseInt },
                        { state: s2, confidence: 0.7, intensity: baseInt * 1.1 },
                        { state: s3, confidence: 0.6, intensity: baseInt * 1.2 }
                    ];

                    const fitness = phases.reduce((acc, p) => {
                        if (combXG > 3.0 && p.state === 'HIGH_VARIANCE') acc += 0.4;
                        if (combXG < 1.5 && p.state === 'CONSERVATIVE') acc += 0.4;
                        if (p.state === 'DOMINANT') acc += 0.2;
                        return acc;
                    }, 0);

                    sequences.push({ phases, likelihood: Math.min(0.98, 0.4 + (fitness / 3)), accuracyScore: fitness / 1.2 });
                });
            });
        });

        return sequences.sort((a, b) => b.likelihood - a.likelihood).slice(0, limit);
    }
}
