import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Dna, Palette, Target, Lock,
  AlertCircle, Edit2, X, Check, RefreshCw
} from "lucide-react";

const SKIN_TYPES = ["Normal", "Oily", "Dry", "Combination", "Acne Prone"];

const SKIN_CONCERNS = [
  "Sensitive", "Rosacea", "Eczema", "Pregnancy-safe", 
  "Metal allergy", "Melasma", "PIH / Dark spots"
];

const INGREDIENTS_TO_AVOID = [
  "Fragrance / Parfum", "Alcohol (Drying)", "Parabens", "Coconut Oil", 
  "Sulfates (SLS/SLES)", "Silicones", "Essential Oils", "Lanolin", 
  "Bismuth Oxychloride", "Formaldehyde Releaser", "Chemical UV Filters", 
  "Phthalates", "Metallic Pigments", "MI / MIT", "PPD"
];

const SEASON_PALETTES = {
  "Bright Spring": ["#FF6B6B", "#FFD166", "#06D6A0", "#FF9A3C", "#F72585", "#E05070"],
  "True Spring": ["#FF8C42", "#FFCA3A", "#E07A5F", "#F4A261", "#E63946"],
  "Light Spring": ["#FFB5A7", "#FFDDD2", "#B5EAD7", "#FEC89A", "#FFCBF2"],
  "Light Summer": ["#CBAACB", "#ADEFD1", "#F2C4CE", "#B5C7D3", "#C9D5E0"],
  "True Summer": ["#D4A5A5", "#A8DADC", "#B8B0C8", "#C77DFF", "#E0AFA0"],
  "Soft Summer": ["#B5838D", "#9B8EA0", "#A7C5BD", "#C4A882", "#D8A7B1", "#D88090", "#D87090", "#D06878"],
  "Soft Autumn": ["#C8956C", "#A0785A", "#D4A373", "#9B7240", "#BC8A5F"],
  "True Autumn": ["#B5451B", "#E07B39", "#9C6B30", "#6B4226", "#C0392B"],
  "Deep Autumn": ["#7B2D00", "#5C2018", "#8B4513", "#6B3A2A", "#9B2335", "#3A2818"],
  "Deep Winter": ["#1C1C3A", "#2D1B33", "#3D0C11", "#0A0A2E", "#4A0E4E", "#302010", "#403020"],
  "True Winter": ["#0D0D0D", "#FFFFFF", "#E63946", "#3A86FF", "#8338EC"],
  "Bright Winter": ["#FF006E", "#3A86FF", "#8338EC", "#06D6A0", "#FB5607", "#C94060", "#E04868"]
};

// Utility to convert LAB array to Hex for raw skin shade display
function labToHex(l, a, b) {
  let y = (l + 16) / 116,
      x = a / 500 + y,
      z = y - b / 200;

  x = 0.95047 * (Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787);
  y = 1.00000 * (Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787);
  z = 1.08883 * (Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787);

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bl = x * 0.0557 + y * -0.2040 + z * 1.0570;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bl = bl > 0.0031308 ? 1.055 * Math.pow(bl, 1 / 2.4) - 0.055 : 12.92 * bl;

  r = Math.max(0, Math.min(1, r)) * 255;
  g = Math.max(0, Math.min(1, g)) * 255;
  bl = Math.max(0, Math.min(1, bl)) * 255;

  const toHex = c => Math.round(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`.toUpperCase();
}

export function ProfilePage() {
  const navigate = useNavigate();
  const updateStoreProfile = useUserStore((state) => state.updateProfile);

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedSkinType, setSelectedSkinType] = useState("Normal");
  const [selectedConcerns, setSelectedConcerns] = useState([]);
  const [selectedAvoidIngredients, setSelectedAvoidIngredients] = useState([]);
  
  // Color Analysis Data State
  const [seasonalLabel, setSeasonalLabel] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [skinHex, setSkinHex] = useState(null);

  // Direct Firestore Fetch
  const fetchUserData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      if (currentUser.email) setEmail(currentUser.email);
      
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        setFullName(data.display_name || "");
        setSelectedSkinType(data.skin_type || "Normal");
        setSelectedConcerns(data.concerns || []);
        setSelectedAvoidIngredients(data.avoid_ingredients || []);

        // Map Analysis Results directly from DB
        setSeasonalLabel(data.seasonal_label || null);
        setConfidence(data.season_confidence_level || null);
        
        if (data.user_lab && data.user_lab.length >= 3) {
          setSkinHex(labToHex(data.user_lab[0], data.user_lab[1], data.user_lab[2]));
        }
      }
    } catch (error) {
      console.error("Error fetching user data directly from Firestore:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserData();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCancelEdit = () => {
    fetchUserData(); // Pull fresh data to reset form
    setIsEditing(false);
  };

  const toggleArrayItem = (setter, array, item) => {
    const normalizedItem = item.toLowerCase();
    if (array.some(i => i.toLowerCase() === normalizedItem)) {
      setter(array.filter((i) => i.toLowerCase() !== normalizedItem));
    } else {
      setter([...array, item]);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No authenticated user found");

      const profileData = {
        display_name: fullName,
        skin_type: selectedSkinType,
        concerns: selectedConcerns,
        avoid_ingredients: selectedAvoidIngredients,
        updated_at: new Date().toISOString()
      };

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, profileData);

      updateStoreProfile(profileData);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert("Error saving profile: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const currentSeasonColors = seasonalLabel && SEASON_PALETTES[seasonalLabel] 
    ? SEASON_PALETTES[seasonalLabel] 
    : [];

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pt-10">
        
        <header className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-[#1F1924]">Your Profile</h1>
          <p className="text-[#4C4354] mt-1">Manage your health data, skin profile, and privacy settings.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT COLUMN: Data Entry / View */}
          <div className="flex-1 space-y-6">
            
            {/* Action Bar for Modes */}
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="font-heading text-xl font-bold text-[#1F1924]">
                {isEditing ? "Editing Profile Data" : "Active Profile Data"}
              </h2>
              
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 text-sm font-bold text-[#7700CF] bg-[#F5EAF9] px-4 py-2 rounded-full hover:bg-[#EADFEE] transition-colors"
                >
                  <Edit2 size={16} /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCancelEdit}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-700 px-3 py-2 disabled:opacity-50"
                  >
                    <X size={16} /> Cancel
                  </button>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-sm font-bold text-white bg-[#7700CF] hover:bg-[#5C00A3] px-4 py-2 rounded-full transition-colors disabled:opacity-50 shadow-md"
                  >
                    {isLoading ? "Saving..." : <><Check size={16} /> Save</>}
                  </button>
                </div>
              )}
            </div>

            {/* General Settings */}
            <section className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 transition-all">
              <h3 className="font-heading text-lg font-bold text-[#1F1924] mb-4">Account Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#7E7386]">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full border-b-2 border-gray-200 bg-transparent px-2 py-2 text-sm outline-none focus:border-[#7700CF] transition-colors"
                    />
                  ) : (
                    <p className="font-medium text-[#111827] px-2 py-2">{fullName || "Not set"}</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#7E7386]">Email Address</label>
                  <p className="font-medium text-gray-500 px-2 py-2 bg-gray-50 rounded-lg">{email || "Loading..."}</p>
                  {isEditing && <p className="text-xs text-gray-400 mt-1 pl-2">Email cannot be changed.</p>}
                </div>
              </div>
            </section>

            {/* Skin Profile */}
            <section className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
              <h3 className="font-heading text-lg font-bold text-[#1F1924] mb-4">Skin Profile</h3>
              
              <div className="mb-6">
                <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-[#7E7386]">Base Skin Type</label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    {SKIN_TYPES.map((type) => {
                      const isActive = selectedSkinType?.toLowerCase() === type.toLowerCase();
                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedSkinType(type)}
                          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors border ${
                            isActive 
                              ? "bg-[#7700CF] text-white border-[#7700CF]" 
                              : "bg-[#F5EAF9] text-[#4C4354] border-transparent hover:bg-[#EADFEE]"
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="inline-block bg-[#F5EAF9] text-[#7700CF] font-bold px-4 py-2 rounded-full text-sm capitalize">
                    {selectedSkinType || "Not Logged"}
                  </span>
                )}
              </div>

              <div>
                <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-[#7E7386]">Active Conditions / Concerns</label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    {SKIN_CONCERNS.map((concern) => {
                      // Case insensitive matching to handle DB normalization
                      const isActive = selectedConcerns.some(c => c.toLowerCase() === concern.toLowerCase());
                      return (
                        <button
                          key={concern}
                          onClick={() => toggleArrayItem(setSelectedConcerns, selectedConcerns, concern)}
                          className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors border ${
                            isActive 
                              ? "bg-[#111827] text-white border-[#111827]" 
                              : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
                          }`}
                        >
                          {concern}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedConcerns && selectedConcerns.length > 0 ? (
                      selectedConcerns.map(concern => (
                        <span key={concern} className="bg-[#111827] text-white px-4 py-2 rounded-full text-sm font-semibold capitalize">
                          {concern}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No specific conditions logged.</p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Ingredients */}
            <section className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={20} className={isEditing ? "text-orange-500" : "text-gray-400"} />
                <h3 className="font-heading text-lg font-bold text-[#1F1924]">Ingredients to Filter</h3>
              </div>
              
              {isEditing ? (
                <>
                  <p className="text-sm text-gray-500 mb-4">Select the ingredients you need our safety engine to block during product recommendations.</p>
                  <div className="flex flex-wrap gap-2">
                    {INGREDIENTS_TO_AVOID.map((ingredient) => {
                      const isBlocked = selectedAvoidIngredients.some(i => i.toLowerCase() === ingredient.toLowerCase());
                      return (
                        <button
                          key={ingredient}
                          onClick={() => toggleArrayItem(setSelectedAvoidIngredients, selectedAvoidIngredients, ingredient)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                            isBlocked 
                              ? "bg-orange-50 text-orange-700 border-orange-200" 
                              : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                          }`}
                        >
                          {ingredient}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAvoidIngredients && selectedAvoidIngredients.length > 0 ? (
                    selectedAvoidIngredients.map(ingredient => (
                      <span key={ingredient} className="bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg text-sm font-medium capitalize">
                        {ingredient}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic">No ingredients blocked.</p>
                  )}
                </div>
              )}
            </section>

          </div>

          {/* RIGHT COLUMN: Color Analysis Block (Always View-Only) */}
          <div className="w-full lg:w-[400px] shrink-0 space-y-6 self-start sticky top-6">
            <div className="bg-gradient-to-br from-[#111827] to-[#1F2937] p-8 rounded-[32px] shadow-xl text-white relative overflow-hidden flex flex-col transition-all">
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#7700CF] rounded-full blur-[80px] opacity-40 pointer-events-none" />
              
              <div className="flex items-center gap-2 text-[#C084FC] mb-6">
                <Dna size={20} />
                <span className="text-xs font-black uppercase tracking-widest">Skin Analysis Result</span>
              </div>

              {seasonalLabel ? (
                <div className="flex flex-col relative z-10">
                  <h3 className="font-heading text-4xl font-bold italic mb-6">
                    {seasonalLabel}
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400 font-medium">Engine Confidence</span>
                        <span className="font-bold">{confidence ? `${Number(confidence).toFixed(1)}%` : "N/A"}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#C084FC] to-white rounded-full"
                          style={{ width: confidence ? `${confidence}%` : '0%' }}
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Signature Palette</span>
                      <div className="flex flex-wrap gap-2">
                        {currentSeasonColors.map((hex, i) => (
                          <div
                            key={i}
                            style={{ backgroundColor: hex }}
                            className="w-10 h-10 rounded-full shadow-md border-2 border-white/80 hover:scale-110 transition-transform cursor-default"
                          />
                        ))}
                      </div>
                    </div>

                    {skinHex && (
                      <div className="bg-white/15 p-4 rounded-2xl flex items-center justify-between border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full border-2 border-white shadow-inner" 
                            style={{ backgroundColor: skinHex }} 
                          />
                          <div>
                            <p className="text-sm font-bold text-white">Raw Facial Shade</p>
                            <p className="text-[10px] text-gray-300 uppercase tracking-wider mt-0.5">Raw Hex Signature</p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-white bg-white/20 px-3 py-1 rounded-lg border border-white/20 shadow-sm">{skinHex}</span>
                      </div>
                    )}
                  </div>

                  {/* Re-analysis Button */}
                  <button 
                    onClick={() => navigate("/color-analysis")}
                    className="mt-8 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full font-bold flex items-center justify-center gap-2 transition-colors text-sm shadow-sm"
                  >
                    <RefreshCw size={16} />
                    Retake Diagnostics
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-4 relative z-10 py-6">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                    <Lock size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-2">Analysis Pending</h3>
                    <p className="text-gray-400 text-sm mb-6">You haven't run the AI color engine on your features yet.</p>
                    <button 
                      onClick={() => navigate("/color-analysis")}
                      className="bg-white text-[#111827] px-6 py-3 rounded-full font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-105 transition-transform mx-auto"
                    >
                      <Palette size={18} />
                      Run Diagnostics
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}