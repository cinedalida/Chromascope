import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";

const skinTypes = ["OILY", "DRY", "NORMAL", "COMBO", "SENSITIVE"];

const allergenToggles = [
  { label: "Parabens", active: true },
  { label: "Sulfates (SLS/SLES)", active: false },
  { label: "Synthetic Fragrance", active: true },
  { label: "Retinoids / Vitamin A", active: false },
];

const focusAreas = [
  "Hyperpigmentation",
  "Fine Lines & Wrinkles",
  "Acne & Congestion",
  "Rosacea / Redness",
  "Large Pores",
  "Elasticity Loss",
  "Dullness",
];

export function ProfilePage() {
  const navigate = useNavigate();
  const updateProfile = useUserStore((state) => state.updateProfile);
  const user = useUserStore((state) => state.user);

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState({ mm: "", dd: "", yyyy: "" });
  const [melaninTier, setMelaninTier] = useState("");
  const [selectedSkinType, setSelectedSkinType] = useState("OILY");
  const [allergens, setAllergens] = useState(allergenToggles);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [addedIngredients, setAddedIngredients] = useState(["Phenoxyethanol"]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState([
    "Hyperpigmentation",
    "Acne & Congestion",
  ]);

  const toggleAllergen = (index) => {
    setAllergens((prev) =>
      prev.map((a, i) => (i === index ? { ...a, active: !a.active } : a)),
    );
  };

  const addIngredient = () => {
    const trimmed = ingredientSearch.trim();
    if (trimmed && !addedIngredients.includes(trimmed)) {
      setAddedIngredients((prev) => [...prev, trimmed]);
      setIngredientSearch("");
    }
  };

  const removeIngredient = (ingredient) => {
    setAddedIngredients((prev) => prev.filter((i) => i !== ingredient));
  };

  const toggleFocusArea = (area) => {
    setSelectedFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  const activeAllergens = allergens.filter((a) => a.active);

  const handleSaveAndContinue = () => {
    const avoidIngredients = [
      ...activeAllergens.map((a) => a.label),
      ...addedIngredients,
    ];

    updateProfile({
      fullName,
      dob,
      melaninTier,
      skinType: selectedSkinType,
      concerns: selectedFocusAreas,
      avoidIngredients,
    });

    navigate("/ingredient-filter");
  };

  // Pre-fill if user data exists
  useEffect(() => {
    if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.dob) setDob(user.dob);
      if (user.melaninTier) setMelaninTier(user.melaninTier);
      if (user.skinType) setSelectedSkinType(user.skinType);
      if (user.concerns) setSelectedFocusAreas(user.concerns);
      if (user.avoidIngredients) {
        setAllergens((prev) =>
          prev.map((a) => ({
            ...a,
            active: user.avoidIngredients.includes(a.label),
          }))
        );
        const toggleLabels = allergenToggles.map((t) => t.label);
        setAddedIngredients(
          user.avoidIngredients.filter((i) => !toggleLabels.includes(i))
        );
      }
    }
  }, [user]);

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* ── Two-column layout ── */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left Column: Form Sections ── */}
          <div className="flex-1 space-y-6">
            {/* Header */}
            <div>
              <h1 className="font-heading text-[28px] font-bold leading-[34px] tracking-[-2%] text-[#1F1924]">
                Patient Onboarding
              </h1>
              <p className="mt-1 text-sm leading-5 text-[#4C4354]">
                Precision profile for dermatological synthesis.
              </p>
            </div>

            {/* ── Section 1: Patient Biometrics ── */}
            <section className="page-card">
              <div className="mb-6 flex items-center gap-3">
                {/* Icon */}
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 flex-shrink-0 text-[#7700CF]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <h2 className="font-heading text-[22px] font-bold leading-7 text-[#1F1924]">
                  Patient Biometrics
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Full Legal Name */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[8%] text-[#4C4354]">
                    FULL LEGAL NAME
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Julianne Sterling"
                    className="w-full border-b border-b-[#CFC2D7] bg-transparent px-3 pb-2.5 pt-2 text-sm text-[#1F1924] placeholder:text-[#6B7280] outline-none transition focus:border-b-[#7700CF]"
                  />
                </div>

                {/* Date of Birth */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[8%] text-[#4C4354]">
                    DATE OF BIRTH
                  </label>
                  <div className="flex items-center border-b border-b-[#CFC2D7] px-3 pb-2 pt-2">
                    <div className="flex flex-1 items-center gap-1 text-sm text-[#1F1924]">
                      <input
                        type="text"
                        value={dob.mm}
                        onChange={(e) =>
                          setDob((p) => ({ ...p, mm: e.target.value }))
                        }
                        placeholder="mm"
                        maxLength={2}
                        className="w-7 bg-transparent text-center outline-none"
                      />
                      <span className="text-[#1F1924]">/</span>
                      <input
                        type="text"
                        value={dob.dd}
                        onChange={(e) =>
                          setDob((p) => ({ ...p, dd: e.target.value }))
                        }
                        placeholder="dd"
                        maxLength={2}
                        className="w-7 bg-transparent text-center outline-none"
                      />
                      <span className="text-[#1F1924]">/</span>
                      <input
                        type="text"
                        value={dob.yyyy}
                        onChange={(e) =>
                          setDob((p) => ({ ...p, yyyy: e.target.value }))
                        }
                        placeholder="yyyy"
                        maxLength={4}
                        className="w-10 bg-transparent text-center outline-none"
                      />
                    </div>
                    {/* Calendar icon */}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 flex-shrink-0 text-[#CFC2D7]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                </div>

                {/* Ethnic Origin / Melanin Tier */}
                <div className="col-span-2">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[8%] text-[#4C4354]">
                    ETHNIC ORIGIN / MELANIN TIER
                  </label>
                  <div className="relative flex items-center border-b border-b-[#CFC2D7]">
                    <select
                      value={melaninTier}
                      onChange={(e) => setMelaninTier(e.target.value)}
                      className="w-full appearance-none bg-transparent px-3 pb-2.5 pt-2 text-sm text-[#1F1924] outline-none"
                    >
                      <option value="" disabled>
                        Type I: Highly Sensitive, Always Burns
                      </option>
                      <option value="Type I">
                        Type I: Highly Sensitive, Always Burns
                      </option>
                      <option value="Type II">
                        Type II: Sensitive, Often Burns
                      </option>
                      <option value="Type III">
                        Type III: Normal, Sometimes Burns
                      </option>
                      <option value="Type IV">
                        Type IV: Olive, Rarely Burns
                      </option>
                      <option value="Type V">
                        Type V: Brown, Very Rarely Burns
                      </option>
                      <option value="Type VI">
                        Type VI: Dark, Never Burns
                      </option>
                    </select>
                    <svg
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute right-3 h-4 w-4 text-[#CFC2D7]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Section 2: Primary Skin Classification ── */}
            <section className="page-card">
              <div className="mb-6 flex items-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 flex-shrink-0 text-[#7700CF]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <h2 className="font-heading text-[22px] font-bold leading-7 text-[#1F1924]">
                  Primary Skin Classification
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {skinTypes.map((type) => {
                  const isActive = selectedSkinType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedSkinType(type)}
                      className={`rounded-2xl border-2 px-8 py-4 text-[10px] font-bold uppercase leading-[15px] tracking-wide transition ${isActive
                        ? "border-[#7700CF] bg-[#7700CF]/5 text-[#7700CF]"
                        : "border-transparent bg-[#F5EAF9] text-[#7E7386] hover:bg-[#EADFEE]"
                        }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Section 3: Ingredient Allergens & Avoidance ── */}
            <section className="page-card">
              <div className="mb-6 flex items-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 flex-shrink-0 text-[#7700CF]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <h2 className="font-heading text-[22px] font-bold leading-7 text-[#1F1924]">
                  Ingredient Allergens
                </h2>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {/* Allergen Toggle List */}
                <div className="space-y-4">
                  {allergens.map((allergen, index) => (
                    <div
                      key={allergen.label}
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => toggleAllergen(index)}
                    >
                      <span className="text-sm font-medium text-[#1F1924]">
                        {allergen.label}
                      </span>
                      <span
                        className={`inline-flex h-5 w-10 items-center rounded-full px-0.5 transition-colors ${allergen.active ? "bg-[#7700CF]" : "bg-[#CFC2D7]"
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${allergen.active
                            ? "translate-x-[18px]"
                            : "translate-x-[2px]"
                            }`}
                        />
                      </span>
                    </div>
                  ))}
                </div>

                {/* Specific Ingredient Search */}
                <div>
                  <label className="mb-4 block text-xs font-medium uppercase tracking-[8%] text-[#4C4354]">
                    SPECIFIC INGREDIENT SEARCH
                  </label>

                  {/* Input + Add button */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addIngredient()}
                      placeholder="Add ingredient to avoid..."
                      className="flex-1 rounded-xl border border-[#F3E8FF] bg-[#FBF0FF] px-4 py-2.5 text-sm text-[#1F1924] placeholder:text-[#6B7280] outline-none transition focus:border-[#7700CF]"
                    />
                    <button
                      onClick={addIngredient}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7700CF] text-white transition hover:bg-[#5500A0]"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>

                  {/* Ingredient tags */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {addedIngredients.map((ingredient) => (
                      <span
                        key={ingredient}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#F3E8FF] bg-[#EADFEE] px-3 py-1.5 text-[11px] font-bold leading-[16.5px] text-[#1F1924]"
                      >
                        {ingredient}
                        <button
                          onClick={() => removeIngredient(ingredient)}
                          className="text-[#7E7386] hover:text-[#1F1924]"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <button className="rounded-full border-2 border-[#57009A]/20 px-3 py-1.5 text-xs font-bold leading-[18px] text-[#57009A] transition hover:bg-[#57009A]/5">
                      None / Default
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Section 4: Pathological Focus Areas ── */}
            <section className="page-card">
              <div className="mb-6 flex items-center gap-3">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 flex-shrink-0 text-[#7700CF]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <h2 className="font-heading text-[22px] font-bold leading-7 text-[#1F1924]">
                  Pathological Focus Areas
                </h2>
              </div>

              <div className="flex max-w-[600px] flex-wrap gap-2.5">
                {focusAreas.map((area) => {
                  const isActive = selectedFocusAreas.includes(area);
                  const hasCheck = isActive;
                  return (
                    <button
                      key={area}
                      onClick={() => toggleFocusArea(area)}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] leading-[19.5px] transition ${isActive
                        ? "bg-[#7700CF] text-white"
                        : "bg-[#F5EAF9] text-[#4C4354] hover:bg-[#EADFEE]"
                        }`}
                    >
                      {hasCheck && (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {area}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Right Column: Summary & Profile Preview ── */}
          <div className="w-full lg:w-[312px] shrink-0 space-y-6">
            {/* Profile Summary Card */}
            <div className="relative overflow-hidden rounded-2xl bg-[#7700CF] p-6 shadow-[0px_4px_6px_-4px_rgba(119,0,207,0.2),0px_10px_15px_-3px_rgba(119,0,207,0.2)]">
              {/* Decorative glow */}
              <div className="pointer-events-none absolute -top-10 right-[-16px] h-32 w-32 rounded-full bg-white/10 blur-[64px]" />

              <div className="relative z-10 space-y-6">
                <h3 className="font-heading text-lg font-bold leading-6 text-white">
                  Profile Summary
                </h3>

                <div className="space-y-4">
                  {/* Skin Type */}
                  <div className="flex items-center justify-between border-b border-b-white/20 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[10%] text-white/70">
                      SKIN TYPE
                    </span>
                    <span className="text-base font-medium leading-6 text-white">
                      {selectedSkinType === "OILY"
                        ? "Oily / Lipid-Rich"
                        : selectedSkinType === "DRY"
                          ? "Dry / Dehydrated"
                          : selectedSkinType === "NORMAL"
                            ? "Balanced"
                            : selectedSkinType === "COMBO"
                              ? "Combination"
                              : "Sensitive / Reactive"}
                    </span>
                  </div>

                  {/* Melanin Tier */}
                  <div className="flex items-center justify-between border-b border-b-white/20 pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-[10%] text-white/70">
                      MELANIN TIER
                    </span>
                    <span className="text-base font-medium leading-6 text-white">
                      {melaninTier || "Not set"}
                    </span>
                  </div>

                  {/* Allergen Toggles */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[10%] text-white/70">
                      ALLERGEN TOGGLES
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAllergens.slice(0, 2).map((a) => (
                        <span
                          key={a.label}
                          className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] leading-[15px] text-white"
                        >
                          {a.label === "Synthetic Fragrance"
                            ? "Fragrance"
                            : a.label === "Sulfates (SLS/SLES)"
                              ? "Sulfates"
                              : a.label}
                        </span>
                      ))}
                      {activeAllergens.length > 2 && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] leading-[15px] text-white">
                          +{activeAllergens.length - 2} Other
                        </span>
                      )}
                      {activeAllergens.length === 0 && (
                        <span className="text-[10px] leading-[15px] text-white/50">
                          None
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Primary Focus */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold uppercase tracking-[10%] text-white/70">
                      PRIMARY FOCUS
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFocusAreas.slice(0, 2).map((area) => (
                        <span
                          key={area}
                          className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] leading-[15px] text-white"
                        >
                          {area === "Acne & Congestion" ? "Acne" : area}
                        </span>
                      ))}
                      {selectedFocusAreas.length > 2 && (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] leading-[15px] text-white">
                          +{selectedFocusAreas.length - 2} More
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ready for Molecular Mapping Card */}
            <div className="rounded-2xl bg-primary-lightest p-6 text-center shadow-sm">
              {/* Avatar */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#57009A]/10 bg-white">
                <span className="font-heading text-xl font-bold text-[#7700CF]">
                  {fullName
                    ? fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "JD"
                    : "JD"}
                </span>
              </div>

              <p className="mt-4 text-sm font-medium leading-5 text-[#1F1924]">
                Ready for molecular mapping
              </p>

              <p className="mx-auto mt-1 max-w-[200px] text-[12px] leading-[18px] text-[#4C4354]">
                Your profile data will be used to synthesize a bespoke
                diagnostic report and custom skincare formulation.
              </p>

              <button
                onClick={handleSaveAndContinue}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#7700CF] px-4 py-4 text-[15px] font-semibold leading-[18px] text-white shadow-[0px_4px_6px_-4px_rgba(87,0,154,0.3),0px_10px_15px_-3px_rgba(87,0,154,0.3)] transition hover:bg-[#5500A0]">
                Save & Continue
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
