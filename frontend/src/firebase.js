import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyBNLzlcHAmlXQTRa46tWbZ3pH1BI_r5uuc",
  authDomain: "chromascopedatabase.firebaseapp.com",
  projectId: "chromascopedatabase",
  storageBucket: "chromascopedatabase.firebasestorage.app",
  messagingSenderId: "813520758158",
  appId: "1:813520758158:web:1610341ed3decae5cb70df"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);