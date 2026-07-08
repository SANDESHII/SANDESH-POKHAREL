import { SimulationResult } from '../types';
import { DixonColes } from './dixonColes';

/**
 * MONTE CARLO SIMULATION LAYER
 * Propagates parameter uncertainty (lambda, mu, rho) through the 
 * exact Dixon-Coles Poisson model.
 */
export class MonteCarloSimulator {
    /**
     * Runs N simulations by sampling from parameter distributions
     */
    static run(
        homeLambda: number, 
        awayMu: number, 
        homeVariance: number, 
        awayVariance: number,
        rho: number = -0.11,
        sigmaRho: number = 0.05,
        iterations: number = 5000
    ): SimulationResult {
        const over15Probs: number[] = [];
        const homeStdDev = Math.sqrt(homeVariance);
        const awayStdDev = Math.sqrt(awayVariance);
        
        for (let i = 0; i < iterations; i++) {
            // 1. Draw λ_sample ~ Normal(λ, sqrt(P_home))
            // Using Box-Muller for Normal sampling
            const hL = Math.max(0.1, this.sampleNormal(homeLambda, homeStdDev));
            
            // 2. Draw μ_sample ~ Normal(μ, sqrt(P_away))
            const aM = Math.max(0.1, this.sampleNormal(awayMu, awayStdDev));
            
            // 3. Draw ρ_sample ~ Normal(ρ, σ_ρ)
            const rS = Math.max(-0.25, Math.min(0.25, this.sampleNormal(rho, sigmaRho)));

            // 4. Run exact Dixon-Coles calculation for this sample
            const matrix = DixonColes.calculateScoreMatrix(hL, aM, rS);
            const pOver15 = DixonColes.calculateOverUnder(matrix, 1.5);
            
            over15Probs.push(pOver15);
        }

        const sorted = [...over15Probs].sort((a, b) => a - b);
        const mean = over15Probs.reduce((a, b) => a + b, 0) / iterations;
        const median = sorted[Math.floor(iterations / 2)];
        
        const variance = over15Probs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / iterations;
        const stdDev = Math.sqrt(variance);

        // 5% / 95% Confidence Interval (Genuine parameter uncertainty)
        const ci: [number, number] = [
            sorted[Math.floor(iterations * 0.05)],
            sorted[Math.floor(iterations * 0.95)]
        ];

        // Distribution of probabilities (0.0 to 1.0)
        const distribution = Array(21).fill(0);
        over15Probs.forEach(p => {
            const bin = Math.min(20, Math.floor(p * 20));
            distribution[bin]++;
        });

        return {
            mean,
            median,
            stdDev,
            confidenceInterval: ci,
            distribution: distribution.map(count => count / iterations)
        };
    }

    private static sampleNormal(mean: number, stdDev: number): number {
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return mean + stdDev * z;
    }
}
