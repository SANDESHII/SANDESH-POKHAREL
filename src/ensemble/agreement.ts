export class AgreementScorer {
    static calculate(a: number, b: number): { consensus: number; divergence: number; isRedFlag: boolean } {
        const d = Math.abs(a - b);
        return {
            consensus: parseFloat(Math.max(0, 1 - d * 2).toFixed(3)),
            divergence: parseFloat(d.toFixed(3)),
            isRedFlag: d > 0.20
        };
    }
}
