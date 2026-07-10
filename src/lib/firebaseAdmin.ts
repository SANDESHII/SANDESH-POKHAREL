import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let app: App;
let db: Firestore;

export function getFirebaseDb(): Firestore {
  if (db) return db;

  // Load project config if available
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let config: any = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.warn('[FIREBASE] Could not read firebase-applet-config.json', e);
  }

  if (!getApps().length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let serviceAccount: any = null;

    if (serviceAccountKey) {
      try {
        // If it starts with '{', it's likely JSON. Otherwise it might be a literal name or path.
        if (serviceAccountKey.trim().startsWith('{')) {
          serviceAccount = JSON.parse(serviceAccountKey);
        } else {
          console.warn(`[FIREBASE] FIREBASE_SERVICE_ACCOUNT_KEY does not appear to be JSON: "${serviceAccountKey.substring(0, 20)}..."`);
        }
      } catch (e) {
        console.error('[FIREBASE] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e);
      }
    }

    const options: any = {
      projectId: config.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT
    };

    if (serviceAccount && Object.keys(serviceAccount).length > 0) {
      try {
        options.credential = cert(serviceAccount);
      } catch (e) {
        console.error('[FIREBASE] Error creating credential from service account:', e);
      }
    }

    try {
      app = initializeApp(options);
    } catch (e) {
      console.error('[FIREBASE] Error initializing Firebase Admin App with options:', options, e);
      // Fallback to minimal initialization if possible
      if (getApps().length > 0) {
        app = getApps()[0];
      } else {
        app = initializeApp({ projectId: options.projectId || 'fallback-project-id' });
      }
    }
  } else {
    app = getApps()[0];
  }

  // Use the specific database ID if provided in config
  if (config.firestoreDatabaseId) {
    db = getFirestore(app, config.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
  
  return db;
}
