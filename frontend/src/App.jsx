import { useEffect } from "react";
import "./App.css";
import AppRouter from "./routes/AppRouter.jsx";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useUserStore } from "./store/userStore";

export function App() {
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);
  const setAuthStatus = useUserStore((state) => state.setAuthStatus);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Sign-in state is known before the profile loads, so a slow profile fetch never locks a user out.
      setAuthStatus(firebaseUser ? "signedIn" : "signedOut");
      if (firebaseUser) {
        try {
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              ...userSnap.data(),
            });
          } else {
            setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          }
        } catch (error) {
          console.error("Profile sync error:", error);
        }
      } else {
        clearUser();
      }
    });

    return () => unsubscribe();
  }, [setUser, clearUser, setAuthStatus]);

  return <AppRouter />;
}

export default App;