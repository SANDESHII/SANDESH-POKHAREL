/**
 * DIXON-COLES STATISTICAL ENGINE
 * Implements Poisson distribution with dependency (tau) correction
 * for association football goal expectancy.
 */

export class DixonColes {
    static poisson(k: number, l: number): number {
        if (l <= 0) return k === 0 ? 1 : 0;
        let r = 1; for (let i = 2; i <= k; i++) r *= i;
        return (Math.exp(-l) * Math.pow(l, k)) / r;
    }

    static tau(x: number, y: number, l: number, m: number, r: number): number {
        let v = 1;
        if (x === 0 && y === 0) v = 1 - (l * m * r);
        else if (x === 0 && y === 1) v = 1 + (l * r);
        else if (x === 1 && y === 0) v = 1 + (m * r);
        else if (x === 1 && y === 1) v = 1 - r;
        return Math.max(0.0001, v);
    }

    static calculateScoreMatrix(hL: number, aM: number, r: number = -0.11, max: number = 8): number[][] {
        let s = 0;
        const m = Array.from({ length: max + 1 }, (_, h) => Array.from({ length: max + 1 }, (_, a) => {
            const p = this.poisson(h, hL) * this.poisson(a, aM) * this.tau(h, a, hL, aM, r);
            s += p; return p;
        }));
        return s > 0 ? m.map(row => row.map(p => p / s)) : m;
    }

    static calculateOverUnder(m: number[][], t: number): number {
        return m.reduce((acc, row, h) => acc + row.reduce((ra, p, a) => ra + (h + a > t ? p : 0), 0), 0);
    }

    static calculateMatchOutcomes(m: number[][]): { home: number; draw: number; away: number } {
        return m.reduce((acc, row, h) => {
            row.forEach((p, a) => {
                if (h > a) acc.home += p; else if (h === a) acc.draw += p; else acc.away += p;
            });
            return acc;
        }, { home: 0, draw: 0, away: 0 });
    }

    static fitRho(matches: { x: number, y: number, lambda: number, mu: number }[]): { rho: number, sigmaRho: number } {
        let r = -0.11, fC = 0;
        for (let i = 0; i < 50; i++) {
            let g = 0, c = 0;
            for (const { x, y, lambda: l, mu: m } of matches) {
                const t = this.tau(x, y, l, m, r);
                let d1 = 0, d2 = 0;
                if (x === 0 && y === 0) { d1 = -l * m / t; d2 = -Math.pow(l * m, 2) / (t * t); }
                else if (x === 0 && y === 1) { d1 = l / t; d2 = -(l * l) / (t * t); }
                else if (x === 1 && y === 0) { d1 = m / t; d2 = -(m * m) / (t * t); }
                else if (x === 1 && y === 1) { d1 = -1 / t; d2 = -1 / (t * t); }
                g += d1; c += d2;
            }
            fC = c; if (Math.abs(c) < 1e-10) break;
            const delta = g / c;
            r = Math.max(-0.25, Math.min(0.25, r - delta));
            if (Math.abs(delta) < 1e-6) break;
        }
        return { rho: r, sigmaRho: fC < 0 ? Math.sqrt(-1 / fC) : 0.05 };
    }
}

