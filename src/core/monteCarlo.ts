import { SimulationResult } from '../types';
import { DixonColes } from './dixonColes';

export class MonteCarloSimulator {
    static run(hL: number, aM: number, hV: number, aV: number, rho: number = -0.11, sR: number = 0.05, iters: number = 5000): SimulationResult {
        const hSD = Math.sqrt(hV), aSD = Math.sqrt(aV);
        const probs = Array.from({ length: iters }, () => {
            const hLS = Math.max(0.1, this.sampleNormal(hL, hSD));
            const aMS = Math.max(0.1, this.sampleNormal(aM, aSD));
            const rS = Math.max(-0.25, Math.min(0.25, this.sampleNormal(rho, sR)));
            return DixonColes.calculateOverUnder(DixonColes.calculateScoreMatrix(hLS, aMS, rS), 1.5);
        });

        const sorted = [...probs].sort((a, b) => a - b);
        const mean = probs.reduce((a, b) => a + b, 0) / iters;
        const stdDev = Math.sqrt(probs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / iters);
        const dist = Array(21).fill(0);
        probs.forEach(p => dist[Math.min(20, Math.floor(p * 20))]++);

        return {
            mean,
            median: sorted[Math.floor(iters / 2)],
            stdDev,
            confidenceInterval: [sorted[Math.floor(iters * 0.05)], sorted[Math.floor(iters * 0.95)]],
            distribution: dist.map(c => c / iters)
        };
    }

    private static sampleNormal(m: number, sd: number): number {
        const u1 = Math.random(), u2 = Math.random();
        return m + sd * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
}
