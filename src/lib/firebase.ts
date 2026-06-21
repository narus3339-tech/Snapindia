import { initializeApp, FirebaseApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { Database, getDatabase } from "firebase/database";

export const isFirebaseConfigured =
  !!(import.meta.env.VITE_FIREBASE_API_KEY &&
     import.meta.env.VITE_FIREBASE_PROJECT_ID &&
     import.meta.env.VITE_FIREBASE_APP_ID);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _rtdb: Database | null = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    ...(import.meta.env.VITE_FIREBASE_DATABASE_URL
      ? { databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL }
      : {}),
  };

  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app);
  _db = getFirestore(_app);

  if (import.meta.env.VITE_FIREBASE_DATABASE_URL) {
    _rtdb = getDatabase(_app);
  }
}

export const app = _app;
export const auth = _auth as Auth;
export const db = _db as Firestore;
export function getRtdb(): Database | null { return _rtdb; }
