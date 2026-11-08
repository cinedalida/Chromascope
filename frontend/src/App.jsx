import { useEffect } from "react";
import "./App.css";
import AppRouter from "./routes/AppRouter.jsx";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useUserStore } from "./store/userStore";
import { apiUrl } from "./config";
import { startARPrefetch } from "./services/arPrefetch";
import { clearRecommendedCache } from "./services/arRecommendedService";
import { clearCatalogCache } from "./services/catalogDataService";
import { PwaUpdatePrompt } from "./components/common/PwaUpdatePrompt.jsx";
import { OfflineBanner } from "./components/common/OfflineBanner.jsx";

export function App() {
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);
  const setAuthStatus = useUserStore((state) => state.setAuthStatus);

  // Warm the AR data in the background (and again after a color analysis or profile edit), so opening Try-On is instant.
  useEffect(() => startARPrefetch(), []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Sign-in state is known before the profile loads, so a slow profile fetch never locks a user out.
      setAuthStatus(firebaseUser ? "signedIn" : "signedOut");
      if (firebaseUser) {
        // Records activity for the 30-day face-data retention (also covers users who only use AR try-on).
        firebaseUser.getIdToken()
          .then((token) => fetch(apiUrl("/user/active"), { method: "POST", headers: { Authorization: `Bearer ${token}` } }))
          .catch(() => {}); // best effort: never blocks or breaks the app
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
        clearRecommendedCache(); // saved recommendations are per person; drop them on sign-out
        clearCatalogCache();
      }
    });

    return () => unsubscribe();
  }, [setUser, clearUser, setAuthStatus]);

  return (
    <>
      <AppRouter />
      {/* Bottom notice stack: the offline pill sits above the update prompt. Clicks pass through
          the empty space; only the prompt's buttons take them. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-80 flex flex-col items-center gap-2">
        <OfflineBanner />
        <PwaUpdatePrompt />
      </div>
    </>
  );
}

export default App;