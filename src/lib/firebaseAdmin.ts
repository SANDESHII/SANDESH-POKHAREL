import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  writeBatch, 
  deleteDoc,
  Firestore,
  DocumentReference,
  CollectionReference,
  WriteBatch,
  query,
  where,
  Query
} from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

let app: FirebaseApp;
let db: Firestore;

/**
 * COMPATIBILITY WRAPPER
 * Mimics the firebase-admin (Firestore) interface using the Client SDK functional API.
 * This is necessary because the environment's service account lacks permissions,
 * but the Client SDK (using API Key) works.
 */
class FirestoreWrapper {
  constructor(private firestore: Firestore) {}

  collection(path: string) {
    return new CollectionWrapper(this.firestore, path);
  }

  batch() {
    return new BatchWrapper(writeBatch(this.firestore));
  }
}

class CollectionWrapper {
  private ref: CollectionReference;
  constructor(private firestore: Firestore, private path: string) {
    this.ref = collection(this.firestore, path);
  }

  doc(id: string) {
    return new DocumentWrapper(this.firestore, this.path, id);
  }

  async get() {
    const snap = await getDocs(this.ref);
    return {
      forEach: (cb: (doc: any) => void) => {
        snap.forEach(s => {
          cb({
            id: s.id,
            data: () => s.data(),
            ref: s.ref
          });
        });
      },
      size: snap.size,
      empty: snap.empty,
      docs: snap.docs.map(s => ({
        id: s.id,
        data: () => s.data(),
        ref: s.ref
      }))
    };
  }
}

class DocumentWrapper {
  public ref: DocumentReference;
  constructor(private firestore: Firestore, collectionPath: string, id: string) {
    this.ref = doc(this.firestore, collectionPath, id);
  }

  async get() {
    const snap = await getDoc(this.ref);
    return {
      exists: snap.exists(),
      data: () => snap.data(),
      id: snap.id,
      ref: this.ref
    };
  }

  async set(data: any) {
    return await setDoc(this.ref, data);
  }

  async delete() {
    return await deleteDoc(this.ref);
  }
}

class BatchWrapper {
  constructor(private _batch: WriteBatch) {}

  set(docRef: any, data: any) {
    this._batch.set(docRef.ref || docRef, data);
    return this;
  }

  delete(docRef: any) {
    this._batch.delete(docRef.ref || docRef);
    return this;
  }

  async commit() {
    return await this._batch.commit();
  }
}

export function getFirebaseDb(): any {
  if (db) return new FirestoreWrapper(db);

  if (!getApps().length) {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    });
  } else {
    app = getApp();
  }

  const dbId = config.firestoreDatabaseId || '(default)';
  console.log(`[FIREBASE] Using Client SDK Wrapper for database: ${dbId}`);
  db = getFirestore(app, dbId);
  
  return new FirestoreWrapper(db);
}
