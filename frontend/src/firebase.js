import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

// Local tests run against the Firebase Emulator Suite (`npm run dev:emulators`, or VITE_USE_FIREBASE_EMULATORS=true) so they never touch the
// real database. The "demo-" project ID can only ever reach the emulators, never a real Firebase project.
const useEmulators = import.meta.env.MODE === "emulators" || import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

// Firebase web config: these values are public (they identify the project; the security is in firestore.rules).
// Project "chromascope-new" since 2026-11 (PLAN_MIGRATION.md); override with VITE_FIREBASE_* env vars if it changes.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyAP9Wf7c3u_4X_qusDd7pby33hTmqRe3b0",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "chromascope-new.firebaseapp.com",
  projectId: useEmulators ? "demo-chromascope" : env.VITE_FIREBASE_PROJECT_ID || "chromascope-new",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "chromascope-new.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1039221241593",
  appId: env.VITE_FIREBASE_APP_ID || "1:1039221241593:web:ea7bac0bf2ee8367a21428",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
