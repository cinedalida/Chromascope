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
  Sparkles,
} from "lucide-react";

export function ColorAnalysisPage() {
  const navigate = useNavigate();
  const signaturePalette = [
    "bg-[#121212]", // Black
    "bg-[#FFFFFF]", // White
    "bg-[#C4002D]", // Deep Red
    "bg-[#0051B3]", // Royal Blue
    "bg-[#55008C]", // Deep Purple
    "bg-[#00A36C]", // Emerald
  ];
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
    }
  };

  const triggerFileInput = () => {
    if (!isWebcamActive) {
      fileInputRef.current?.click();
    }
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

  return (
    <main className="page-shell px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-screen bg-[#FAF9FF] font-body text-black">
      <section className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Page Header */}
        <header className="space-y-1">
          <h1 className="font-heading text-2xl sm:text-4xl font-bold text-black">Color Analysis</h1>
          <p className="text-gray-light text-sm sm:text-base">Upload a photo or use your webcam to discover your seasonal color profile.</p>
        </header>
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Checklist (5/12 on lg) */}
          <div className="col-span-1 lg:col-span-5 space-y-6">
            {/* Upload Area */}
            <div 
              onClick={triggerFileInput}
              className={`bg-white border-2 border-dashed border-[#E5D5F5] rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-sm transition-all relative overflow-hidden min-h-[280px] ${!isWebcamActive ? 'cursor-pointer hover:border-[#7700CF] hover:shadow-md group' : ''}`}
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
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                      className="bg-white text-[#111827] px-6 py-2.5 rounded-full font-bold shadow-xl flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm"
                    >
                      <Camera size={16} />
                      Capture
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stopWebcam(); }}
                      className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-6 py-2.5 rounded-full font-bold shadow-xl hover:bg-black/70 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : uploadedImage ? (
                <div className="absolute inset-0 w-full h-full">
                  <img src={uploadedImage} alt="Uploaded preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-[#374151]/50 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white font-medium bg-[#111827]/60 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-xl">
                      <ImagePlus size={18} />
                      Change Photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-[#FAEDFF] rounded-full flex items-center justify-center text-[#7700CF] mx-auto group-hover:scale-110 group-hover:bg-[#F3E8FF] transition-all duration-300">
                    <ImagePlus size={32} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-xl text-[#111827]">
                      Upload your photo
                    </h3>
                    <p className="text-[#6B7280] text-sm mt-2 max-w-[250px] mx-auto">
                      Drag and drop or click to upload a clear face photo in natural
                      lighting.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Webcam Button */}
            {!isWebcamActive && (
              <button 
                onClick={startWebcam}
                className="w-full py-4 border border-primary text-primary rounded-full font-bold flex items-center justify-center gap-2 hover:bg-primary-lightest transition-colors transition-spring"
              >
                <Camera size={18} />
                Use Webcam
              </button>
            )}

            {/* Lighting Checklist */}
            <div className="bg-[#F6F0FF] p-8 rounded-3xl space-y-6 border border-primary-light/20">
              <h3 className="font-heading font-bold text-xl">
                Lighting Checklist
              </h3>
              <div className="space-y-3">
                <ChecklistItem
                  icon={<Sun size={18} />}
                  text="Natural daylight is preferred"
                />
                <ChecklistItem
                  icon={<UserSquare size={18} />}
                  text="Remove heavy makeup or filters"
                />
                <ChecklistItem
                  icon={<Focus size={18} />}
                  text="Ensure face is centered and in focus"
                />
              </div>
            </div>

            <button 
              onClick={() => navigate("/color-analysis/processing")}
              disabled={!uploadedImage}
              className="w-full py-4 bg-[#7700CF] text-white rounded-full font-bold shadow-lg hover:bg-[#5C00A3] transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analyze My Colors
            </button>
          </div>

          {/* Right Column: Analysis Result (7/12 on lg) */}
          <div className="col-span-1 lg:col-span-7 bg-[#F3E8FF]/50 rounded-3xl p-6 sm:p-10 border border-primary-light/20 shadow-sm relative overflow-hidden">
            <div className="space-y-8 relative z-10">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">
                  Your Analysis Result
                </p>
                <h2 className="font-heading text-4xl sm:text-6xl font-bold text-black italic">
                  Deep Winter
                </h2>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-sm font-bold text-gray">
                    AI Confidence Score
                  </p>
                  <p className="text-sm font-black text-primary">98%</p>
                </div>
                <div className="w-full h-2 bg-primary-light rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[98%] rounded-full" />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h4 className="font-heading font-bold text-xl">
                  Your Signature Palette
                </h4>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {signaturePalette.map((color, i) => (
                    <div
                      key={i}
                      className={`${color} w-10 h-14 sm:w-12 sm:h-16 rounded-lg shadow-sm border border-white/50`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-gray-dark text-sm leading-relaxed max-w-xl">
                Deep Winters are characterized by high contrast and cool,
                saturated undertones. Your features are strikingly vivid,
                requiring bold, icy, and intense colors to highlight your
                natural radiance. Avoid dusty pastels or warm, earthy tones that
                may dull your complexion.
              </p>

              <div className="pt-4 border-t border-primary-light/30">
                <div className="flex justify-between items-center cursor-pointer group">
                  <p className="font-bold text-black group-hover:text-primary transition-colors">
                    What does this mean?
                  </p>
                  <ChevronDown size={20} className="text-gray-light" />
                </div>
              </div>

              <button className="w-full py-4 bg-white border border-primary-light text-primary rounded-full font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all">
                View Curated Products <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Related Palettes Footer */}
        <section className="space-y-6 pt-8">
          <h3 className="font-heading font-bold text-xl sm:text-2xl">Related Palettes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <PaletteCard
              name="Cool Winter"
              desc="Focuses on pure cool undertones without the deep intensity of your profile."
              color="bg-gradient-to-br from-[#1E293B] to-[#0F172A]"
            />
            <PaletteCard
              name="Deep Autumn"
              desc="Shares your depth but leans towards warm, golden-based intensities."
              color="bg-gradient-to-br from-[#2D1B4D] to-[#120826]"
            />
            <PaletteCard
              name="Bright Winter"
              desc="Prioritizes clarity and high-chroma brilliance over deep saturation."
              color="bg-gradient-to-br from-[#818CF8] to-[#C084FC]"
            />
          </div>
        </section>
      </section>
    </main>
  );
}

// Helper Components
function ChecklistItem({ icon, text }) {
  return (
    <div className="bg-white/80 p-4 rounded-xl flex items-center gap-4 border border-primary-light/10">
      <div className="text-primary">{icon}</div>
      <span className="text-sm font-semibold text-gray-dark">{text}</span>
    </div>
  );
}

function PaletteCard({ name, desc, color }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-primary-light/10 shadow-sm hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-center gap-4 mb-3">
        <div className={`w-12 h-12 rounded-full ${color} shadow-inner`} />
        <h4 className="font-bold text-lg group-hover:text-primary transition-colors">
          {name}
        </h4>
      </div>
      <p className="text-xs text-gray-light leading-relaxed">{desc}</p>
    </div>
  );
}
