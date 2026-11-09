import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Shield, Server, Trash2, AlertCircle } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useUserStore } from "../store/userStore";
import { SKIN_TYPES, SKIN_CONCERNS, AVOID_INGREDIENTS, CONCERNS_WITHOUT_FILTER_RULE } from "../constants/profileOptions";


const dataCards = [
  {
    title: "Secure Storage",
    description: "Your skin profile and color results are stored encrypted, and only you can read them. Your photos are never stored.",
    icon: <Shield size={24} className="text-primary" strokeWidth={1.5} />,
  },
  {
    title: "Secure Processing",
    description: "Your photo is sent securely to our analysis server, analyzed in memory, and discarded right away. It is never saved.",
    icon: <Server size={24} className="text-primary" strokeWidth={1.5} />,
  },
  {
    title: "Automatic Disposal",
    description: "If you don't use Chromascope for 30 days, we permanently delete your face data (season and skin color results). You can delete your whole account anytime in Profile.",
    icon: <Trash2 size={24} className="text-primary" strokeWidth={1.5} />,
  },
];

// Keyboard focus ring (focus-visible only, so mouse and touch clicks show no outline).
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2";

// Steps slide in from the side they come from: forward from the right, back from the left.
const stepMotion = (reduceMotion) => ({
  enter: (direction) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 * direction }),
});

export function OnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const updateStoreProfile = useUserStore((state) => state.updateProfile);
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const prefersReducedMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Form State
  const [skinType, setSkinType] = useState("");
  const [concerns, setConcerns] = useState([]);
  const [avoidIngredients, setAvoidIngredients] = useState([]);
  
  // Ethics State (Step 4)
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const toggleSelection = (item, list, setList) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Each step starts at the top, even after scrolling down a long list on the previous one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [step, prefersReducedMotion]);

  // Escape closes the "Complete your profile?" dialog.
  useEffect(() => {
    if (!showConfirmModal) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowConfirmModal(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showConfirmModal]);

  const handleNext = async () => {
    if (step < 4) {
      setDirection(1);
      setStep(step + 1);
    } else if (!showConfirmModal) {
      setShowConfirmModal(true);
    } else {
      setShowConfirmModal(false);
      setIsSubmitting(true);
      setSaveError(null);
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate("/auth");
          return;
        }

        const now = new Date().toISOString();
        // Top-level fields match what ProfilePage and /api/run-filter read
        const profileData = {
          skin_type: skinType,
          concerns,
          avoid_ingredients: avoidIngredients,
          ethics_consent: {
            agreed_to_terms: agreedToTerms,
            agreed_at: now
          },
          profile_completed: true,
          setup_at: now
        };

        await updateDoc(doc(db, "users", user.uid), profileData);
        updateStoreProfile(profileData);
        navigate("/home");
      } catch (error) {
        console.error("Error saving profile:", error);
        setSaveError("Couldn't save your profile. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Logic to handle going back (even on Step 1)
  const handleBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    } else {
      // Step 1: back to the Auth/Login screen. With no earlier page in this session (the installed
      // app opened from the home screen), navigate(-1) would do nothing, so go to /auth directly.
      if (location.key === "default") navigate("/auth");
      else navigate(-1);
    }
  };

  const stepTitles = {
    1: "Skin Type",
    2: "Concerns",
    3: "Ingredient Filters",
    4: "Data Privacy & Ethics"
  };

  return (
    // Added [-webkit-tap-highlight-color:transparent] globally to the main wrapper
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-primary-lightest px-4 py-6 font-body sm:p-6 text-[#374151] md:p-12 [-webkit-tap-highlight-color:transparent]">
      
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-light/60 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#DBB7FF]/30 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mt-4 w-full max-w-3xl sm:mt-8">
        
        {/* Progress Header */}
        <div className="mb-8">
          <div className="mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Step {step} of 4</span>
            <h2 className="mt-1 font-heading text-2xl font-semibold text-[#111827]">
              {stepTitles[step]}
            </h2>
          </div>
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={4}
            aria-valuenow={step}
            aria-valuetext={`Step ${step} of 4: ${stepTitles[step]}`}
            className="h-2 w-full overflow-hidden rounded-full bg-secondary-light/80"
          >
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#9D4EDD] to-[#5A009D] transition-all duration-500 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-secondary-light bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:rounded-[32px] sm:p-10 md:p-12">

          <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepMotion(prefersReducedMotion)}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeOut" }}
          >

          {/* STEP 1: Skin Type */}
          {step === 1 && (
            <div>
              <h1 className="mb-2 font-heading text-3xl font-semibold text-[#111827]">What is your skin type?</h1>
              <p className="mb-8 text-[15px] text-[#4B5563]">Select the one that best describes your skin on a daily basis.</p>
              
              <div role="radiogroup" aria-label="Skin type" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {SKIN_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={skinType === type}
                    onClick={() => setSkinType(type)}
                    className={`group flex items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${FOCUS_RING} ${
                      skinType === type 
                        ? "border-primary bg-primary-lightest text-[#4A0082] shadow-sm" 
                        : "border-gray-100 bg-white text-[#4B5563] hover:border-[#D1D5DB] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium">{type}</span>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${skinType === type ? "border-primary bg-primary" : "border-gray-300 group-hover:border-gray-400"}`}>
                      {skinType === type && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Skin Concerns */}
          {step === 2 && (
            <div>
              <h1 className="mb-2 font-heading text-3xl font-semibold text-[#111827]">Any specific concerns?</h1>
              <p className="mb-2 text-[15px] text-[#4B5563]">Select all that apply. This helps the safety filter flag products that may not suit your skin.</p>
              <p className="mb-8 text-[13px] text-[#6B7280]" data-testid="concerns-note">
                {CONCERNS_WITHOUT_FILTER_RULE.join(", ")} are saved to your profile but don&apos;t change the safety verdict yet.
              </p>
              
              <div className="flex flex-wrap gap-3">
                {SKIN_CONCERNS.map((concern) => {
                  const isSelected = concerns.includes(concern);
                  return (
                    <button
                      key={concern}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSelection(concern, concerns, setConcerns)}
                      className={`rounded-full border px-5 py-3 text-[14px] font-medium transition-all active:scale-95 ${FOCUS_RING} ${
                        isSelected 
                          ? "border-primary bg-primary text-white shadow-md shadow-purple-600/20" 
                          : "border-gray-200 bg-white text-[#4B5563] hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {concern}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Avoid Ingredients */}
          {step === 3 && (
            <div>
              <h1 className="mb-2 font-heading text-3xl font-semibold text-[#111827]">Ingredients to avoid</h1>
              <p className="mb-8 text-[15px] text-[#4B5563]">Select any specific ingredients or allergens you want to exclude.</p>
              
              <div className="flex flex-wrap gap-3">
                {AVOID_INGREDIENTS.map((ingredient) => {
                  const isSelected = avoidIngredients.includes(ingredient);
                  return (
                    <button
                      key={ingredient}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleSelection(ingredient, avoidIngredients, setAvoidIngredients)}
                      className={`rounded-full border px-4 py-2.5 text-[14px] font-medium transition-all active:scale-95 ${FOCUS_RING} ${
                        isSelected 
                          ? "border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/20" 
                          : "border-gray-200 bg-white text-[#4B5563] hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {ingredient}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Data Ethics */}
          {step === 4 && (
             <div>
                <h1 className="mb-2 font-heading text-3xl font-semibold text-[#111827]">Commitment to Transparency</h1>
                <p className="mb-8 text-[15px] text-[#4B5563]">Review how your skin profile is used and how we protect your privacy.</p>
                
                <div className="grid gap-4 sm:grid-cols-3 mb-8">
                  {dataCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-2xl bg-primary-lightest/50 p-5 shadow-sm border border-primary-lighter"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                        {card.icon}
                      </div>
                      <h3 className="mb-1.5 text-sm font-semibold text-[#111827]">
                        {card.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-[#4B5563]">
                        {card.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-primary-lightest/40 rounded-2xl p-5 border border-secondary-light">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(event) => setAgreedToTerms(event.target.checked)}
                        className={`peer appearance-none h-5 w-5 border border-[#D1D5DB] rounded bg-white checked:bg-primary checked:border-primary transition-all cursor-pointer ${FOCUS_RING}`}
                      />
                      <svg
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm leading-relaxed text-[#4B5563] group-hover:text-[#374151] transition-colors">
                      I agree to the{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className={`rounded font-semibold text-primary hover:underline ${FOCUS_RING}`}>Terms of Service</a>
                      {" "}and{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className={`rounded font-semibold text-primary hover:underline ${FOCUS_RING}`}>Privacy Policy</a>.
                    </span>
                  </label>
                </div>
             </div>
          )}

          </motion.div>
          </AnimatePresence>

          {saveError && (
            <p className="mt-8 flex items-center gap-1.5 text-[14px] text-rose-500">
              <AlertCircle size={16} />{saveError}
            </p>
          )}

          {/* Navigation Controls */}
          {/* Phones: full-width Continue on top, Back and Skip in a row under it.
              Desktop: Back on the left, Skip and Continue on the right. */}
          <div className="mt-8 grid grid-cols-2 items-center gap-3 border-t border-secondary-light pt-6 sm:mt-10 sm:flex sm:gap-4">

            {/* Back works on Step 1 too (returns to sign-in). */}
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className={`order-2 flex items-center gap-2 justify-self-start rounded-lg px-2 py-2 font-medium text-[#6B7280] transition-colors hover:text-[#111827] sm:order-1 sm:mr-auto ${FOCUS_RING}`}
            >
              <ArrowLeft size={18} /> Back
            </button>

            {(step === 2 || step === 3) && (
              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className={`order-3 justify-self-end rounded-lg px-2 py-2 font-medium text-[#6B7280] transition-colors hover:text-[#111827] sm:order-2 ${FOCUS_RING}`}
              >
                Skip for now
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={(step === 1 && !skinType) || (step === 2 && concerns.length === 0) || (step === 3 && avoidIngredients.length === 0) || (step === 4 && !agreedToTerms) || isSubmitting}
              className={`order-1 col-span-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3.5 font-medium text-white shadow-lg shadow-purple-600/20 transition-all hover:bg-primary-dark hover:shadow-purple-600/30 active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 sm:order-3 sm:w-auto ${FOCUS_RING}`}
            >
              {isSubmitting ? "Saving..." : (step === 4 ? "Confirm & Complete" : "Continue")}
              {!isSubmitting && step !== 4 && <ArrowRight size={18} />}
              {!isSubmitting && step === 4 && <Check size={18} />}
            </button>
          </div>

        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-confirm-title"
            className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-lighter">
              <Check size={28} className="text-primary" />
            </div>
            <h3 id="onboarding-confirm-title" className="mb-2 font-heading text-lg font-semibold text-[#111827]">Complete your profile?</h3>
            <p className="mb-6 text-[14px] leading-relaxed text-[#4B5563]">
              You're about to save your skin profile and finish setup. You can always update these preferences later from your profile.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className={`w-full rounded-2xl border border-gray-200 py-3 font-medium text-[#4B5563] transition-colors hover:bg-gray-50 ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                className={`w-full rounded-2xl bg-primary py-3 font-medium text-white transition-colors hover:bg-primary-dark ${FOCUS_RING}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}