import { getFirebaseDb } from '../lib/firebaseAdmin';

export interface TeamState {
    estimatedNpxG: number;
    variance: number;
    lastUpdate: string;
    volatility: number;
}

export class SignalFilter {
    private static readonly Q_BASE = 0.05;
    private static readonly R_BASE = 0.20;
    private static coll = 'teamStates';
    private static cache = new Map<string, TeamState>();

    static setCollection(name: string): void {
        this.coll = name;
        this.cache.clear();
    }

    static async update(id: string, obs: number, date: string, conf: number = 0.6, persist: boolean = true): Promise<TeamState> {
        const cur = (await this.get(id)) || { estimatedNpxG: 1.35, variance: 0.5, lastUpdate: 'INITIAL', volatility: this.Q_BASE };
        const q = cur.volatility * (this.getDays(cur.lastUpdate, date) / 7);
        const pVar = cur.variance + q;
        const r = this.R_BASE / Math.max(0.01, conf);
        const k = pVar / (pVar + r);
        const ik = 1 - k;

        const res: TeamState = {
            estimatedNpxG: Math.max(0.2, cur.estimatedNpxG + k * (obs - cur.estimatedNpxG)),
            variance: Math.max(0.01, ik * ik * pVar + k * k * r),
            lastUpdate: date,
            volatility: cur.volatility
        };

        if (persist) await this.set(id, res);
        return res;
    }

    static async updateStateAfterMatch(id: string, gs: number, _gc: number, date: string, conf: number = 1.0, persist: boolean = true): Promise<TeamState> {
        return this.update(id, 0.8 + (Math.min(5, gs) * 0.3), date, conf * 0.7, persist);
    }

    static async get(id: string): Promise<TeamState | undefined> {
        if (this.cache.has(id)) return this.cache.get(id);
        try {
            const doc = await getFirebaseDb().collection(this.coll).doc(id).get();
            const state = doc.exists ? doc.data() as TeamState : undefined;
            if (state) this.cache.set(id, state);
            return state;
        } catch { return undefined; }
    }

    static async set(id: string, state: TeamState): Promise<void> {
        this.cache.set(id, state);
        try { await getFirebaseDb().collection(this.coll).doc(id).set(state); } catch {}
    }

    static async getAll(): Promise<Map<string, TeamState>> {
        if (this.cache.size > 0) return new Map(this.cache);
        try {
            const snap = await getFirebaseDb().collection(this.coll).get();
            const map = new Map<string, TeamState>();
            snap.forEach((doc: any) => {
                const data = doc.data() as TeamState;
                map.set(doc.id, data);
                this.cache.set(doc.id, data);
            });
            return map;
        } catch { return new Map(); }
    }

    static async saveAll(states: Map<string, TeamState>): Promise<void> {
        try {
            const db = getFirebaseDb();
            const batch = db.batch();
            states.forEach((s, id) => {
                this.cache.set(id, s);
                batch.set(db.collection(this.coll).doc(id), s);
            });
            await batch.commit();
        } catch {}
    }

    static async reset(): Promise<void> {
        this.cache.clear();
        try {
            const db = getFirebaseDb();
            const snap = await db.collection(this.coll).get();
            const batch = db.batch();
            snap.forEach((doc: any) => batch.delete(doc.ref));
            await batch.commit();
        } catch {}
    }

    private static getDays(d1: string, d2: string): number {
        if (d1 === 'INITIAL') return 7;
        const t1 = new Date(d1).getTime(), t2 = new Date(d2).getTime();
        return isNaN(t1) || isNaN(t2) ? 7 : Math.max(1, (t2 - t1) / 86400000);
    }
}


