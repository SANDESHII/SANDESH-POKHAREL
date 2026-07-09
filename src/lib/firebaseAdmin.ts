import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;

export function getFirebaseDb(): Firestore {
  if (db) return db;

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not defined in environment variables');
  }

  const serviceAccount = JSON.parse(serviceAccountKey);

  if (!getApps().length) {
    app = initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  return db;
}
