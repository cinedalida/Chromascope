// ColorAnalysisPage begins the skin tone and palette analysis flow.

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ImagePlus,
  Camera,
  Sun,
  UserSquare,
  Focus,
  ChevronDown,
  ArrowRight,
  Lock,
  Loader2,
  Dna,
  Target
} from "lucide-react";
import { auth, db } from "../firebase"; 
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const SEASON_DATABASE = {
  "Bright Spring": { colors: ["#FF6B6B", "#FFD166", "#06D6A0", "#FF9A3C", "#F72585", "#E05070"], desc: "High clarity with warm, bright undertones. Your features pop with highly saturated, vibrant, and clear colors." },
  "Warm Spring": { colors: ["#FF8C42", "#FFCA3A", "#E07A5F", "#F4A261", "#E63946"], desc: "Fully warm and radiant. Your coloring has a golden, glowing quality that shines in true, warm, and clear tones." },
  "Light Spring": { colors: ["#FFB5A7", "#FFDDD2", "#B5EAD7", "#FEC89A", "#FFCBF2"], desc: "Delicate, light, and warm. Your features are low in contrast and look best in pastel, warm-tinted shades." },
  "Light Summer": { colors: ["#CBAACB", "#ADEFD1", "#F2C4CE", "#B5C7D3", "#C9D5E0"], desc: "Cool, delicate, and light. Your overall appearance is gentle and highly harmonious in cool pastels." },
  "Cool Summer": { colors: ["#D4A5A5", "#A8DADC", "#B8B0C8", "#C77DFF", "#E0AFA0"], desc: "Completely cool with a gentle softness. Blue and pink undertones dominate your coloring." },
  "Soft Summer": { colors: ["#B5838D", "#9B8EA0", "#A7C5BD", "#C4A882", "#D8A7B1", "#D88090"], desc: "Muted, cool, and highly blended. Your features have a beautiful dusty quality that thrives in complex, greyed-out colors." },
  "Soft Autumn": { colors: ["#C8956C", "#A0785A", "#D4A373", "#9B7240", "#BC8A5F"], desc: "Muted, warm, and rich. Your coloring is blended and earthy, glowing in rich, desaturated warm tones." },
  "Warm Autumn": { colors: ["#B5451B", "#E07B39", "#9C6B30", "#6B4226", "#C0392B"], desc: "Fully warm, rich, and earthy. Golden and copper undertones are prominent in your absolutely warm coloring." },
  "Deep Autumn": { colors: ["#7B2D00", "#5C2018", "#8B4513", "#6B3A2A", "#9B2335", "#3A2818"], desc: "Dark, warm, and intense. High depth and rich pigmentation allow you to wear the darkest, warmest colors beautifully." },
  "Deep Winter": { colors: ["#1C1C3A", "#2D1B33", "#3D0C11", "#0A0A2E", "#4A0E4E", "#302010"], desc: "Dark, cool, and highly contrasting. You have strong depth and can pull off the deepest, coolest jewel tones." },
  "Cool Winter": { colors: ["#0D0D0D", "#FFFFFF", "#E63946", "#3A86FF", "#8338EC"], desc: "Completely cool and sharply contrasting. Icy, vivid colors without a drop of warmth suit you best." },
  "Bright Winter": { colors: ["#FF006E", "#3A86FF", "#8338EC", "#06D6A0", "#FB5607", "#C94060"], desc: "Extremely striking and cool-leaning. Your features are incredibly clear, thriving in neon, high-voltage jewel tones." }
};

export function ColorAnalysisPage() {
  const navigate = useNavigate();
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [animateIn, setAnimateIn] = useState(false);

  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
      setIsLoadingProfile(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => stopWebcam();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
    }
  };

  const triggerFileInput = () => {
    if (!isWebcamActive) fileInputRef.current?.click();
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setIsWebcamActive(true);
      setUploadedImage(null);
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Could not access webcam. Please check your permissions.");
    }
  };

  useEffect(() => {
    if (isWebcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isWebcamActive]);

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageUrl = canvas.toDataURL("image/png");
      setUploadedImage(imageUrl);
      stopWebcam();
    }
  };

  const userSeason = userProfile?.seasonal_label;
  const userConfidence = userProfile?.season_confidence_level; 
  const currentSeasonData = userSeason && SEASON_DATABASE[userSeason] ? SEASON_DATABASE[userSeason] : null;

  // Convert the user's DB lab values to Hex to display their raw shade
  const skinHex = userProfile?.user_lab ? labToHex(userProfile.user_lab[0], userProfile.user_lab[1], userProfile.user_lab[2]) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FAF9FF] via-[#F6F0FF] to-[#FAF9FF] font-body text-black pb-12">

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        
        <header className={`space-y-4 transition-all duration-1000 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h1 className="font-heading text-4xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#111827] to-[#7700CF] italic tracking-tight">
            Color Analysis
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Upload a photo or use your webcam to run our clinical AI model and map your genomic color profile.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className={`col-span-1 lg:col-span-5 space-y-6 transition-all duration-1000 delay-150 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            
            <div 
              onClick={triggerFileInput}
              className={`bg-white/80 backdrop-blur-xl border-2 border-dashed border-[#E5D5F5] rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-sm transition-all duration-300 relative overflow-hidden min-h-[300px] ${!isWebcamActive ? 'cursor-pointer hover:border-[#7700CF] hover:bg-[#7700CF]/5 hover:shadow-md group' : ''}`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />

              {isWebcamActive ? (
                <div className="absolute inset-0 w-full h-full bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-90" />

                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                      className="bg-white text-[#111827] px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform text-sm"
                    >
                      <Camera size={18} />
                      Capture Frame
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stopWebcam(); }}
                      className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full font-bold shadow-xl hover:bg-black/70 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : uploadedImage ? (
                <div className="absolute inset-0 w-full h-full group">
                  <img src={uploadedImage} alt="Uploaded preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-[#111827]/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white font-medium bg-white/20 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-2 shadow-xl border border-white/30">
                      <ImagePlus size={18} />
                      Replace Photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#FAEDFF] to-[#F3E8FF] rounded-full flex items-center justify-center text-[#7700CF] mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-inner">
                    <ImagePlus size={36} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-2xl text-[#111827]">
                      Upload Portrait
                    </h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-[250px] mx-auto leading-relaxed">
                      Drag and drop or click to upload a clear face photo in natural lighting.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!isWebcamActive && (
              <button
                onClick={startWebcam}
                className="w-full py-4 border-2 border-[#7700CF]/20 bg-white/50 backdrop-blur-sm text-[#7700CF] rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#7700CF] hover:text-white hover:border-[#7700CF] transition-all duration-300 shadow-sm"
              >
                <Camera size={18} />
                Activate Webcam
              </button>
            )}

            <button
              onClick={() => navigate("/color-analysis/processing", { state: { image: uploadedImage } })}
              disabled={!uploadedImage}
              className="w-full py-5 bg-gradient-to-r from-[#7700CF] to-[#5C00A3] text-white rounded-full font-bold shadow-xl hover:shadow-2xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none text-lg flex justify-center items-center gap-2"
            >
              <Dna size={20} />
              Run Analysis
            </button>

            <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[32px] space-y-6 border border-white shadow-sm">
              <h3 className="font-heading font-bold text-xl text-[#111827]">Lighting Protocol</h3>
              <div className="space-y-3">
                <ChecklistItem icon={<Sun size={18} />} text="Natural daylight is heavily preferred" />
                <ChecklistItem icon={<UserSquare size={18} />} text="Remove heavy makeup or filters" />
                <ChecklistItem icon={<Focus size={18} />} text="Ensure face is centered and in focus" />
              </div>
            </div>
          </div>

          <div className={`col-span-1 lg:col-span-7 transition-all duration-1000 delay-300 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 sm:p-10 border border-white shadow-sm h-full flex flex-col relative overflow-hidden">
              
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#7700CF]/10 rounded-full blur-[60px] pointer-events-none" />

              {isLoadingProfile ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[#7700CF]/60 space-y-4">
                  <Loader2 size={40} className="animate-spin" />
                  <p className="font-bold text-sm tracking-widest uppercase">Syncing Profile...</p>
                </div>
              ) : currentSeasonData ? (
                
                <div className="space-y-6 relative z-10 flex-1 flex flex-col justify-center">
                  <div>
                    <p className="text-[10px] font-black text-[#7700CF] uppercase tracking-[0.2em] mb-2">
                      Active Profile Match
                    </p>
                    <h2 className="font-heading text-4xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#111827] to-[#7700CF] italic">
                      {userSeason}
                    </h2>
                  </div>

                  <div className="bg-gray-50/50 p-4 rounded-2xl border border-white shadow-inner">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <Target size={16} className="text-[#7700CF]" />
                        <p className="text-sm font-bold text-[#111827]">AI Confidence Score</p>
                      </div>
                      <p className="text-lg font-black text-[#7700CF]">
                        {userConfidence !== undefined && userConfidence !== null ? `${Number(userConfidence).toFixed(1)}%` : "N/A"}
                      </p>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#7700CF] to-[#C084FC] rounded-full transition-all duration-1000 ease-out"
                        style={{ width: userConfidence ? `${userConfidence}%` : '0%' }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h4 className="font-heading font-bold text-xl text-[#111827]">
                      Signature Palette
                    </h4>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {currentSeasonData.colors.map((hex, i) => (
                        <div
                          key={i}
                          style={{ backgroundColor: hex }}
                          className="w-10 h-14 sm:w-12 sm:h-16 rounded-xl shadow-sm border-2 border-white hover:scale-110 transition-transform duration-300 cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm leading-relaxed max-w-xl pt-2">
                    {currentSeasonData.desc}
                  </p>

                  {/* Moved and Upgraded Raw Facial Skin Shade UI below Description */}
                  {skinHex && (
                    <div className="mt-6 bg-white/80 backdrop-blur-xl p-5 rounded-[24px] border border-white shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300 w-full max-w-md">
                      <div className="flex items-center gap-4">
                         <div className="relative">
                           <div className="w-14 h-14 rounded-full shadow-inner border-2 border-white/50 relative z-10 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: skinHex }} />
                           <div className="absolute inset-0 rounded-full blur-[12px] opacity-50 -z-10 group-hover:opacity-70 transition-opacity duration-300" style={{ backgroundColor: skinHex }} />
                         </div>
                         <div>
                           <p className="text-sm font-bold text-[#111827]">Raw Facial Skin Shade</p>
                           <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Biometric Base Hue</p>
                         </div>
                      </div>
                      <div className="bg-white/60 px-4 py-2 rounded-xl border border-white shadow-inner">
                         <p className="font-mono font-bold text-[#7700CF] text-sm">{skinHex}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 mt-auto">
                    <button 
                      onClick={() => navigate("/ingredient-filter")}
                      className="w-full py-4 bg-white border-2 border-[#7700CF] text-[#7700CF] hover:bg-[#7700CF] hover:text-white rounded-full font-bold flex items-center justify-center gap-2 shadow-md transition-all duration-300 group"
                    >
                      Shop Curated Products <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ) : (
                
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 z-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-gray-200 relative">
                    <Lock size={32} className="text-gray-400" />
                    <div className="absolute inset-0 rounded-full border border-gray-300 animate-ping opacity-20" />
                  </div>
                  <div>
                    <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#111827] italic mb-3">
                      Profile Locked
                    </h2>
                    <p className="text-gray-600 max-w-sm mx-auto leading-relaxed text-sm">
                      You haven't completed your color analysis yet. Upload a portrait on the left to map your facial features and unlock your seasonal palette.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className={`space-y-6 pt-8 transition-all duration-1000 delay-500 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h3 className="font-heading font-bold text-xl sm:text-2xl text-[#111827]">Discover Other Palettes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <PaletteCard
              name="Cool Winter"
              desc="Focuses on pure cool undertones without the deep intensity."
              color="bg-gradient-to-br from-[#1E293B] to-[#0F172A]"
            />
            <PaletteCard
              name="Deep Autumn"
              desc="Shares depth but leans towards warm, golden-based intensities."
              color="bg-gradient-to-br from-[#2D1B4D] to-[#120826]"
            />
            <PaletteCard
              name="Bright Spring"
              desc="Prioritizes clarity and high-chroma brilliance with warm undertones."
              color="bg-gradient-to-br from-[#FF9A3C] to-[#F72585]"
            />
          </div>
        </section>
      </section>
    </main>
  );
}

function ChecklistItem({ icon, text }) {
  return (
    <div className="bg-white/50 p-4 rounded-xl flex items-center gap-4 border border-white/40 shadow-sm">
      <div className="text-[#7700CF]">{icon}</div>
      <span className="text-sm font-semibold text-[#111827]">{text}</span>
    </div>
  );
}

function PaletteCard({ name, desc, color }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[24px] border border-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
      <div className="flex items-center gap-4 mb-3">
        <div className={`w-12 h-12 rounded-full ${color} shadow-inner border border-white/20`} />
        <h4 className="font-bold text-lg text-[#111827] group-hover:text-[#7700CF] transition-colors">
          {name}
        </h4>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}

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