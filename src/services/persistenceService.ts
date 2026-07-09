import { getFirebaseDb } from '../lib/firebaseAdmin';
import { TeamState } from '../core/kalman';

export class PersistenceService {
    private static collectionName = 'teamStates';

    static setCollection(name: string): void {
        this.collectionName = name;
    }

    static async getTeamState(teamId: string): Promise<TeamState | null> {
        try {
            const db = getFirebaseDb();
            const doc = await db.collection(this.collectionName).doc(teamId).get();
            if (doc.exists) {
                return doc.data() as TeamState;
            }
            return null;
        } catch (error) {
            console.error(`[PERSISTENCE] Error fetching state for ${teamId} from ${this.collectionName}:`, error);
            return null;
        }
    }

    static async saveTeamState(teamId: string, state: TeamState): Promise<void> {
        try {
            const db = getFirebaseDb();
            await db.collection(this.collectionName).doc(teamId).set(state);
        } catch (error) {
            console.error(`[PERSISTENCE] Error saving state for ${teamId} to ${this.collectionName}:`, error);
        }
    }

    /**
     * Batch save for backtesting or bulk updates
     */
    static async saveTeamStates(states: Map<string, TeamState>): Promise<void> {
        try {
            const db = getFirebaseDb();
            const batch = db.batch();
            states.forEach((state, teamId) => {
                const ref = db.collection(this.collectionName).doc(teamId);
                batch.set(ref, state);
            });
            await batch.commit();
        } catch (error) {
            console.error(`[PERSISTENCE] Error batch saving states to ${this.collectionName}:`, error);
        }
    }
}
