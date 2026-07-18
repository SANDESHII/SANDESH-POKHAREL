import { TeamStats, MatchContext } from '../types';
import { getFirebaseDb } from '../lib/firebaseAdmin';

/**
 * LOGISTIC REGRESSION ENSEMBLE
 * A secondary model using a completely different structural approach (Recent Form/Context)
 * to provide independent confirmation of the Poisson-based Dixon-Coles results.
 */
export class LogisticEnsemble {
    private static weightsO15: number[] = [0.45, 0.12, -0.08, 0.10, -0.15, 0.02, -0.02];
    private static weightsU35: number[] = [-0.30, -0.10, 0.15, -0.12, 0.20, -0.05, 0.05];
    private static coll = 'modelMetadata';
    private static midO15 = 'logistic_over15';
    private static midU35 = 'logistic_under35';

    static async train(matches: { home: TeamStats, away: TeamStats, context: MatchContext, isOver15: boolean, isUnder35: boolean }[]): Promise<void> {
        const lr = 0.05, ep = 100;

        // Train Over 1.5
        for (let e = 0; e < ep; e++) {
            const g = new Array(this.weightsO15.length).fill(0);
            for (const m of matches) {
                const f = this.feat(m.home, m.away, m.context), p = this.predictOver15(m.home, m.away, m.context), err = p - (m.isOver15 ? 1 : 0);
                f.forEach((v, i) => g[i] += err * v);
            }
            this.weightsO15 = this.weightsO15.map((w, i) => w - (lr * g[i]) / matches.length);
        }

        // Train Under 3.5
        for (let e = 0; e < ep; e++) {
            const g = new Array(this.weightsU35.length).fill(0);
            for (const m of matches) {
                const f = this.feat(m.home, m.away, m.context), p = this.predictUnder35(m.home, m.away, m.context), err = p - (m.isUnder35 ? 1 : 0);
                f.forEach((v, i) => g[i] += err * v);
            }
            this.weightsU35 = this.weightsU35.map((w, i) => w - (lr * g[i]) / matches.length);
        }

        await this.save();
    }

    static async save(): Promise<void> {
        try { 
            await getFirebaseDb().collection(this.coll).doc(this.midO15).set({ weights: this.weightsO15, lastTrained: new Date().toISOString() });
            await getFirebaseDb().collection(this.coll).doc(this.midU35).set({ weights: this.weightsU35, lastTrained: new Date().toISOString() });
        } catch {}
    }

    static async load(): Promise<void> {
        try {
            const dO15 = await getFirebaseDb().collection(this.coll).doc(this.midO15).get();
            if (dO15.exists) this.weightsO15 = dO15.data()?.weights || this.weightsO15;
            const dU35 = await getFirebaseDb().collection(this.coll).doc(this.midU35).get();
            if (dU35.exists) this.weightsU35 = dU35.data()?.weights || this.weightsU35;
        } catch {}
    }

    private static feat(h: TeamStats, a: TeamStats, c: MatchContext): number[] {
        const hGF = h.form?.length ? h.form.reduce((x, y) => x + y, 0) / h.form.length : (h.npxG ?? 1.35);
        const aGF = a.form?.length ? a.form.reduce((x, y) => x + y, 0) / a.form.length : (a.npxG ?? 1.35);
        return [1, hGF, h.avgXGA ?? 1.35, aGF, a.avgXGA ?? 1.35, Math.min(7, c.restDays?.home ?? 4), Math.min(7, c.restDays?.away ?? 4)];
    }

    static predictOver15(h: TeamStats, a: TeamStats, c: MatchContext): number {
        return 1 / (1 + Math.exp(-this.feat(h, a, c).reduce((z, f, i) => z + f * this.weightsO15[i], 0)));
    }

    static predictUnder35(h: TeamStats, a: TeamStats, c: MatchContext): number {
        return 1 / (1 + Math.exp(-this.feat(h, a, c).reduce((z, f, i) => z + f * this.weightsU35[i], 0)));
    }
}
