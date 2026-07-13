import { TeamStats, MatchContext } from '../types';
import { getFirebaseDb } from '../lib/firebaseAdmin';

/**
 * LOGISTIC REGRESSION ENSEMBLE
 * A secondary model using a completely different structural approach (Recent Form/Context)
 * to provide independent confirmation of the Poisson-based Dixon-Coles results.
 */
export class LogisticEnsemble {
    private static weights: number[] = [0.45, 0.12, -0.08, 0.10, -0.15, 0.02, -0.02];
    private static coll = 'modelMetadata';
    private static mid = 'logistic_over15';

    static async train(matches: { home: TeamStats, away: TeamStats, context: MatchContext, isOver15: boolean }[]): Promise<void> {
        const lr = 0.05, ep = 100;
        let loss = 0;

        for (let e = 0; e < ep; e++) {
            let tl = 0;
            const g = new Array(this.weights.length).fill(0);
            for (const m of matches) {
                const f = this.feat(m.home, m.away, m.context), p = this.predictOver15(m.home, m.away, m.context), err = p - (m.isOver15 ? 1 : 0);
                tl += m.isOver15 ? -Math.log(p + 1e-15) : -Math.log(1 - p + 1e-15);
                f.forEach((v, i) => g[i] += err * v);
            }
            this.weights = this.weights.map((w, i) => w - (lr * g[i]) / matches.length);
            if (e === ep - 1) loss = tl / matches.length;
        }
        await this.save(loss);
    }

    static async save(loss: number): Promise<void> {
        try { await getFirebaseDb().collection(this.coll).doc(this.mid).set({ weights: this.weights, lastTrained: new Date().toISOString(), logLoss: loss }); } catch {}
    }

    static async load(): Promise<void> {
        try {
            const doc = await getFirebaseDb().collection(this.coll).doc(this.mid).get();
            if (doc.exists) this.weights = doc.data()?.weights || this.weights;
        } catch {}
    }

    private static feat(h: TeamStats, a: TeamStats, c: MatchContext): number[] {
        const hGF = h.form?.length ? h.form.reduce((x, y) => x + y, 0) / h.form.length : (h.npxG ?? 1.35);
        const aGF = a.form?.length ? a.form.reduce((x, y) => x + y, 0) / a.form.length : (a.npxG ?? 1.35);
        return [1, hGF, h.avgXGA ?? 1.35, aGF, a.avgXGA ?? 1.35, Math.min(7, c.restDays?.home ?? 4), Math.min(7, c.restDays?.away ?? 4)];
    }

    static predictOver15(h: TeamStats, a: TeamStats, c: MatchContext): number {
        return 1 / (1 + Math.exp(-this.feat(h, a, c).reduce((z, f, i) => z + f * this.weights[i], 0)));
    }
}
