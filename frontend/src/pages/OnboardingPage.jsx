import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Shield, Server, Trash2 } from "lucide-react";

const SKIN_TYPES = ["Normal", "Oily", "Dry", "Combination", "Acne-prone"];
const SKIN_CONCERNS = ["Sensitive", "Rosacea", "Eczema", "Pregnancy-safe", "Metal allergy", "Melasma", "PIH / Dark spots"];
const AVOID_INGREDIENTS = ["Fragrance / Parfum", "Alcohol (Drying)", "Parabens", "Coconut Oil", "Sulfates (SLS/SLES)", "Silicones", "Essential Oils", "Lanolin", "Bismuth Oxychloride", "Formaldehyde Releaser", "Chemical UV Filters", "Phthalates", "Metallic Pigments", "MI / MIT (Preservative)", "PPD (Hair Dye Chemical)"];

const dataCards = [
  {
    title: "Encrypted Storage",
    description: "Your photos and color results are locked with strong encryption, so only Chromascope can read them.",
    icon: <Shield size={24} className="text-[#7700CF]" strokeWidth={1.5} />,
  },
  {
    title: "Secure Processing",
    description: "Your photo is analyzed right on your device, so it isn't sent anywhere else unless it has to be.",
    icon: <Server size={24} className="text-[#7700CF]" strokeWidth={1.5} />,
  },
  {
    title: "Automatic Disposal",
    description: "If you don't use Chromascope for 30 days, we permanently delete your photos and face data.",
    icon: <Trash2 size={24} className="text-[#7700CF]" strokeWidth={1.5} />,
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
    } else if (!showConfirmModal) {
      setShowConfirmModal(true);
    } else {
      setShowConfirmModal(false);
      setIsSubmitting(true);
      try {
        const payload = {
          skin_profile: {
            base_type: skinType,
            primary_concerns: concerns,
            blacklisted_ingredients: avoidIngredients
          },
          ethics_consent: {
            agreed_to_terms: agreedToTerms
          },
          completed_at: new Date().toISOString()
        };
        
        console.log("POST /api/user/profile/setup", JSON.stringify(payload, null, 2));
        await new Promise(resolve => setTimeout(resolve, 1000));
        navigate("/home"); 
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Logic to handle going back (even on Step 1)
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      // Step 1: Navigates back to the Auth/Login screen
      navigate(-1); 
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
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#FAF4FF] p-6 font-body text-[#374151] md:p-12 [-webkit-tap-highlight-color:transparent]">
      
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#E5D5F5]/60 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#DBB7FF]/30 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mt-4 w-full max-w-3xl sm:mt-8">
        
        {/* Progress Header */}
        <div className="mb-8">
          <div className="mb-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#7700CF]">Step {step} of 4</span>
            <h2 className="mt-1 font-heading text-2xl font-bold text-[#111827]">
              {stepTitles[step]}
            </h2>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5D5F5]/80">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#9D4EDD] to-[#5A009D] transition-all duration-500 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-[32px] border border-[#E5D5F5] bg-white/80 p-8 shadow-sm backdrop-blur-xl sm:p-10 md:p-12">
          
          {/* STEP 1: Skin Type */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="mb-2 font-heading text-3xl font-bold text-[#111827]">What is your skin type?</h1>
              <p className="mb-8 text-[15px] text-[#4B5563]">Select the one that best describes your skin on a daily basis.</p>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {SKIN_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSkinType(type)}
                    className={`group flex items-center justify-between rounded-2xl border-2 p-4 text-left transition-all focus:outline-none ${
                      skinType === type 
                        ? "border-[#7700CF] bg-[#FAEDFF] text-[#4A0082] shadow-sm" 
                        : "border-gray-100 bg-white text-[#4B5563] hover:border-[#D1D5DB] hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium">{type}</span>
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${skinType === type ? "border-[#7700CF] bg-[#7700CF]" : "border-gray-300 group-hover:border-gray-400"}`}>
                      {skinType === type && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Skin Concerns */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="mb-2 font-heading text-3xl font-bold text-[#111827]">Any specific concerns?</h1>
              <p className="mb-8 text-[15px] text-[#4B5563]">Select all that apply. This helps our AI filter out harsh formulas.</p>
              
              <div className="flex flex-wrap gap-3">
                {SKIN_CONCERNS.map((concern) => {
                  const isSelected = concerns.includes(concern);
                  return (
                    <button
                      key={concern}
                      onClick={() => toggleSelection(concern, concerns, setConcerns)}
                      className={`rounded-full border px-5 py-3 text-[14px] font-medium transition-all active:scale-95 focus:outline-none ${
                        isSelected 
                          ? "border-[#7700CF] bg-[#7700CF] text-white shadow-md shadow-purple-600/20" 
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
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h1 className="mb-2 font-heading text-3xl font-bold text-[#111827]">Ingredients to avoid</h1>
              <p className="mb-8 text-[15px] text-[#4B5563]">Select any specific ingredients or allergens you want to exclude.</p>
              
              <div className="flex flex-wrap gap-3">
                {AVOID_INGREDIENTS.map((ingredient) => {
                  const isSelected = avoidIngredients.includes(ingredient);
                  return (
                    <button
                      key={ingredient}
                      onClick={() => toggleSelection(ingredient, avoidIngredients, setAvoidIngredients)}
                      className={`rounded-full border px-4 py-2.5 text-[14px] font-medium transition-all active:scale-95 focus:outline-none ${
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
             <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <h1 className="mb-2 font-heading text-3xl font-bold text-[#111827]">Commitment to Transparency</h1>
                <p className="mb-8 text-[15px] text-[#4B5563]">Review how your biological data informs our AI and how we protect your privacy.</p>
                
                <div className="grid gap-4 sm:grid-cols-3 mb-8">
                  {dataCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-2xl bg-[#FAEDFF]/50 p-5 shadow-sm border border-[#F3E8FF]"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#7700CF] shadow-sm">
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

                <div className="bg-[#FAEDFF]/40 rounded-2xl p-5 border border-[#E5D5F5]">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(event) => setAgreedToTerms(event.target.checked)}
                        className="peer appearance-none h-5 w-5 border border-[#D1D5DB] rounded bg-white checked:bg-[#7700CF] checked:border-[#7700CF] focus:outline-none focus:ring-2 focus:ring-[#7700CF]/20 transition-all cursor-pointer"
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
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#7700CF] hover:underline focus:outline-none">Terms of Service</a>
                      {" "}and{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#7700CF] hover:underline focus:outline-none">Privacy Policy</a>.
                    </span>
                  </label>
                </div>
             </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-10 flex items-center justify-between border-t border-[#E5D5F5] pt-6">
            
            {/* Back button is now active on Step 1 */}
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-2 py-2 font-medium text-[#6B7280] transition-colors hover:text-[#111827] focus:outline-none"
            >
              <ArrowLeft size={18} /> Back
            </button>

            <div className="flex items-center gap-4">
              {(step === 2 || step === 3) && (
                <button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="px-2 py-2 font-medium text-[#6B7280] transition-colors hover:text-[#111827] focus:outline-none"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={(step === 1 && !skinType) || (step === 2 && concerns.length === 0) || (step === 3 && avoidIngredients.length === 0) || (step === 4 && !agreedToTerms) || isSubmitting}
                className="flex items-center gap-2 rounded-2xl bg-[#7700CF] px-8 py-3.5 font-medium text-white shadow-lg shadow-purple-600/20 transition-all hover:bg-[#5C00A3] hover:shadow-purple-600/30 active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 focus:outline-none"
              >
                {isSubmitting ? "Saving..." : (step === 4 ? "Confirm & Complete" : "Continue")}
                {!isSubmitting && step !== 4 && <ArrowRight size={18} />}
                {!isSubmitting && step === 4 && <Check size={18} />}
              </button>
            </div>
          </div>

        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F3E8FF]">
              <Check size={28} className="text-[#7700CF]" />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-[#111827]">Complete your profile?</h3>
            <p className="mb-6 text-[14px] leading-relaxed text-[#4B5563]">
              You're about to save your skin profile and finish setup. You can always update these preferences later from your profile.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-full rounded-2xl border border-gray-200 py-3 font-medium text-[#4B5563] transition-colors hover:bg-gray-50 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-2xl bg-[#7700CF] py-3 font-medium text-white transition-colors hover:bg-[#5C00A3] focus:outline-none"
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