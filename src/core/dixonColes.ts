/**
 * DIXON-COLES STATISTICAL ENGINE
 * Implements Poisson distribution with dependency (tau) correction
 * for association football goal expectancy.
 */

export class DixonColes {
    /**
     * Standard Poisson probability mass function
     */
    static poisson(k: number, lambda: number): number {
        if (lambda <= 0) return k === 0 ? 1 : 0;
        return (Math.exp(-lambda) * Math.pow(lambda, k)) / this.factorial(k);
    }

    private static factorial(n: number): number {
        if (n <= 0) return 1;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }

    /**
     * Tau adjustment for dependency between scores (0-0, 1-0, 0-1, 1-1)
     * Dixon & Coles (1997) parameter rho handles the low-score correlation.
     * 
     * VERIFIED WORKED EXAMPLE:
     * λ=1.35, μ=1.25, ρ=-0.11
     * τ(0,0) = 1 - (1.35 * 1.25 * -0.11) = 1.1856
     * τ(0,1) = 1 + (1.35 * -0.11) = 0.8515
     * τ(1,0) = 1 + (1.25 * -0.11) = 0.8625
     * τ(1,1) = 1 - (-0.11) = 1.1100
     */
    static tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
        if (x === 0 && y === 0) return 1 - (lambda * mu * rho);
        if (x === 0 && y === 1) return 1 + (lambda * rho);
        if (x === 1 && y === 0) return 1 + (mu * rho);
        if (x === 1 && y === 1) return 1 - rho;
        return 1;
    }

    /**
     * Calculates the full scoreline probability matrix
     */
    static calculateScoreMatrix(
        homeLambda: number, 
        awayMu: number, 
        rho: number = -0.11, // Standard EPL low-score correlation
        maxGoals: number = 8
    ): number[][] {
        const matrix: number[][] = Array(maxGoals + 1).fill(0).map(() => Array(maxGoals + 1).fill(0));
        
        for (let h = 0; h <= maxGoals; h++) {
            for (let a = 0; a <= maxGoals; a++) {
                const probH = this.poisson(h, homeLambda);
                const probA = this.poisson(a, awayMu);
                const adjustment = this.tau(h, a, homeLambda, awayMu, rho);
                matrix[h][a] = probH * probA * adjustment;
            }
        }
        
        return matrix;
    }

    /**
     * Calculates probability of Over X.5 goals
     */
    static calculateOverUnder(matrix: number[][], threshold: number): number {
        let totalProb = 0;
        for (let h = 0; h < matrix.length; h++) {
            for (let a = 0; a < matrix[h].length; a++) {
                if (h + a > threshold) {
                    totalProb += matrix[h][a];
                }
            }
        }
        return totalProb;
    }

    /**
     * Extracts Win/Draw/Loss probabilities
     */
    static calculateMatchOutcomes(matrix: number[][]): { home: number; draw: number; away: number } {
        let home = 0, draw = 0, away = 0;
        for (let h = 0; h < matrix.length; h++) {
            for (let a = 0; a < matrix[h].length; a++) {
                if (h > a) home += matrix[h][a];
                else if (h === a) draw += matrix[h][a];
                else away += matrix[h][a];
            }
        }
        return { home, draw, away };
    }

    /**
     * MLE Fit for Rho using Newton-Raphson
     * Estimates low-score correlation based on historical data.
     * Returns the estimated rho and its standard error (sigmaRho).
     */
    static fitRho(matches: { x: number, y: number, lambda: number, mu: number }[]): { rho: number, sigmaRho: number } {
        let rho = -0.11; // Initial guess
        const maxIterations = 50;
        const tolerance = 0.000001;
        let finalCurvature = 0;

        for (let i = 0; i < maxIterations; i++) {
            let gradient = 0;
            let curvature = 0;

            for (const m of matches) {
                const { x, y, lambda, mu } = m;
                const t = this.tau(x, y, lambda, mu, rho);
                
                let d1 = 0;
                let d2 = 0;

                if (x === 0 && y === 0) {
                    d1 = -lambda * mu / t;
                    d2 = -Math.pow(lambda * mu, 2) / Math.pow(t, 2);
                } else if (x === 0 && y === 1) {
                    d1 = lambda / t;
                    d2 = -Math.pow(lambda, 2) / Math.pow(t, 2);
                } else if (x === 1 && y === 0) {
                    d1 = mu / t;
                    d2 = -Math.pow(mu, 2) / Math.pow(t, 2);
                } else if (x === 1 && y === 1) {
                    d1 = -1 / t;
                    d2 = -1 / Math.pow(t, 2);
                }

                gradient += d1;
                curvature += d2;
            }

            finalCurvature = curvature;
            if (Math.abs(curvature) < 1e-10) break;

            const delta = gradient / curvature;
            rho = rho - delta;

            // Constraint: rho must keep all tau > 0
            rho = Math.max(-0.25, Math.min(0.25, rho));

            if (Math.abs(delta) < tolerance) break;
        }

        // Standard error sigma_rho = sqrt(-1 / total_curvature)
        const sigmaRho = finalCurvature < 0 ? Math.sqrt(-1 / finalCurvature) : 0.05;

        return { rho, sigmaRho };
    }
}
