import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

// Local tests run against the Firebase Emulator Suite (`npm run dev:emulators`, or VITE_USE_FIREBASE_EMULATORS=true) so they never touch the
// real database. The "demo-" project ID can only ever reach the emulators, never a real Firebase project.
const useEmulators = import.meta.env.MODE === "emulators" || import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

const firebaseConfig = {
  apiKey: "AIzaSyBNLzlcHAmlXQTRa46tWbZ3pH1BI_r5uuc",
  authDomain: "chromascopedatabase.firebaseapp.com",
  projectId: useEmulators ? "demo-chromascope" : "chromascopedatabase",
  storageBucket: "chromascopedatabase.firebasestorage.app",
  messagingSenderId: "813520758158",
  appId: "1:813520758158:web:1610341ed3decae5cb70df"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
