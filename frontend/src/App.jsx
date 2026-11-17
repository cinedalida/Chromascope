import { useEffect } from "react";
import "./App.css";
import AppRouter from "./routes/AppRouter.jsx";
import { auth, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useUserStore } from "./store/userStore";
import { apiUrl } from "./config";
import { startARPrefetch } from "./services/arPrefetch";
import { startServerWake, keepAnalyzerWarm } from "./services/serverWake";
import { clearRecommendedCache } from "./services/arRecommendedService";
import { clearCatalogCache } from "./services/catalogDataService";
import { PwaUpdatePrompt } from "./components/common/PwaUpdatePrompt.jsx";
import { OfflineBanner } from "./components/common/OfflineBanner.jsx";

export function App() {
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);
  const setAuthStatus = useUserStore((state) => state.setAuthStatus);

  // Wake a sleeping free-hosted backend right away, so its start-up overlaps with sign-in.
  useEffect(() => startServerWake(), []);

  // Load the color-analysis models as soon as the app opens (signed in or not) and keep them loaded while the tab is in use.
  useEffect(() => keepAnalyzerWarm(), []);

  // Warm the AR data in the background (and again after a color analysis or profile edit), so opening Try-On is instant.
  useEffect(() => startARPrefetch(), []);

  useEffect(() => {
    // The signed-in user's profile, kept live: a change from another tab, another device or the backend (a new color
    // result) reaches every page without a reload. Closed on sign-out and when the user changes.
    let stopProfile = () => {};
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      stopProfile();
      stopProfile = () => {};
      // Sign-in state is known before the profile loads, so a slow profile fetch never locks a user out.
      setAuthStatus(firebaseUser ? "signedIn" : "signedOut");
      if (firebaseUser) {
        // Records activity for the 30-day face-data retention (also covers users who only use AR try-on).
        firebaseUser.getIdToken()
          .then((token) => fetch(apiUrl("/user/active"), { method: "POST", headers: { Authorization: `Bearer ${token}` } }))
          .catch(() => {}); // best effort: never blocks or breaks the app
        const base = { uid: firebaseUser.uid, email: firebaseUser.email };
        stopProfile = onSnapshot(
          doc(db, "users", firebaseUser.uid),
          (userSnap) => setUser(userSnap.exists() ? { ...base, ...userSnap.data() } : base),
          // Offline or a rules error: keep the last profile shown; the listener resumes when it can.
          (error) => console.error("Profile sync error:", error),
        );
      } else {
        clearUser();
        clearRecommendedCache(); // saved recommendations are per person; drop them on sign-out
        clearCatalogCache();
      }
    });

    return () => {
      stopProfile();
      unsubscribe();
    };
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