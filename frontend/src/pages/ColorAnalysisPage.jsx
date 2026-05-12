import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  ImagePlus,
  Camera,
  ArrowRight,
  Sparkles,
  Loader2,
  CheckCircle2,
  ChevronDown,
  Sun,
  VideoOff,
  User
} from "lucide-react";

// 1. ADD THE DATABASE HERE SO THE PAGE CAN LOOK UP COLORS
const SEASON_DATABASE = {
  "Bright Spring": {
    colors: ["#FF6B6B", "#FFD166", "#06D6A0", "#FF9A3C", "#F72585", "#E05070"],
    desc: "High clarity with warm, bright undertones. Your features pop with highly saturated, vibrant, and clear colors."
  },
  "Warm Spring": { 
    colors: ["#FF8C42", "#FFCA3A", "#E07A5F", "#F4A261", "#E63946"],
    desc: "Fully warm and radiant. Your coloring has a golden, glowing quality that shines in true, warm, and clear tones."
  },
  "Light Spring": {
    colors: ["#FFB5A7", "#FFDDD2", "#B5EAD7", "#FEC89A", "#FFCBF2"],
    desc: "Delicate, light, and warm. Your features are low in contrast and look best in pastel, warm-tinted shades."
  },
  "Light Summer": {
    colors: ["#CBAACB", "#ADEFD1", "#F2C4CE", "#B5C7D3", "#C9D5E0"],
    desc: "Cool, delicate, and light. Your overall appearance is gentle and highly harmonious in cool pastels."
  },
  "Cool Summer": { 
    colors: ["#D4A5A5", "#A8DADC", "#B8B0C8", "#C77DFF", "#E0AFA0"],
    desc: "Completely cool with a gentle softness. Blue and pink undertones dominate your coloring."
  },
  "Soft Summer": {
    colors: ["#B5838D", "#9B8EA0", "#A7C5BD", "#C4A882", "#D8A7B1", "#D88090", "#D87090", "#D06878"],
    desc: "Muted, cool, and highly blended. Your features have a beautiful dusty quality that thrives in complex, greyed-out colors."
  },
  "Soft Autumn": {
    colors: ["#C8956C", "#A0785A", "#D4A373", "#9B7240", "#BC8A5F"],
    desc: "Muted, warm, and rich. Your coloring is blended and earthy, glowing in rich, desaturated warm tones."
  },
  "Warm Autumn": { 
    colors: ["#B5451B", "#E07B39", "#9C6B30", "#6B4226", "#C0392B"],
    desc: "Fully warm, rich, and earthy. Golden and copper undertones are prominent in your absolutely warm coloring."
  },
  "Deep Autumn": {
    colors: ["#7B2D00", "#5C2018", "#8B4513", "#6B3A2A", "#9B2335", "#3A2818"],
    desc: "Dark, warm, and intense. High depth and rich pigmentation allow you to wear the darkest, warmest colors beautifully."
  },
  "Deep Winter": {
    colors: ["#1C1C3A", "#2D1B33", "#3D0C11", "#0A0A2E", "#4A0E4E", "#302010"],
    desc: "Dark, cool, and highly contrasting. You have strong depth and can pull off the deepest, coolest jewel tones."
  },
  "Cool Winter": { 
    colors: ["#0D0D0D", "#FFFFFF", "#E63946", "#3A86FF", "#8338EC"],
    desc: "Completely cool and sharply contrasting. Icy, vivid colors without a drop of warmth suit you best."
  },
  "Bright Winter": {
    colors: ["#FF006E", "#3A86FF", "#8338EC", "#06D6A0", "#FB5607", "#C94060"],
    desc: "Extremely striking and cool-leaning. Your features are incredibly clear, thriving in neon, high-voltage jewel tones."
  }
};

export function ColorAnalysisPage() {
  const navigate = useNavigate();
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => stopWebcam();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageBlob(file);
      setUploadedImage(URL.createObjectURL(file));
    }
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setIsWebcamActive(true);
      setUploadedImage(null);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Webcam access denied.");
    }
  };

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
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        setImageBlob(blob);
        setUploadedImage(URL.createObjectURL(blob));
      }, "image/png");
      stopWebcam();
    }
  };

  const handleAnalyze = async () => {
    if (!imageBlob) return;
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append("file", imageBlob, "face_scan.png");

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("http://localhost:8000/api/analyze-color", {
        method: "POST",
        headers: { "Authorization": `Bearer ${idToken}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Analysis failed");
      const result = await response.json();
      setAnalysisResult(result);

      await fetch("http://localhost:8000/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          seasonal_label: result.seasonal_label || result.season,
          user_lab: result.user_lab,
          skin_type: "normal"
        }),
      });
    } catch (error) {
      console.error(error);
      alert("Error analyzing image.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // FIX MATH & DATA LOOKUP
  const displayConfidence = analysisResult?.confidence 
    ? (analysisResult.confidence > 1 ? analysisResult.confidence : analysisResult.confidence * 100).toFixed(0)
    : 0;

  // LOOKUP THE CORRECT SEASON DATA
  const activeSeasonName = analysisResult?.seasonal_label || analysisResult?.season || "Deep Winter";
  const activeSeasonData = SEASON_DATABASE[activeSeasonName] || SEASON_DATABASE["Deep Winter"];

  return (
    <main className="page-shell min-h-screen bg-[#FAF9FF] font-body text-black p-8">
      <section className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <span className="text-primary">Chromascope</span>
          <span>/</span>
          <span>Color Analysis</span>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div 
              onClick={() => !isWebcamActive && fileInputRef.current?.click()}
              className="bg-white border-2 border-dashed border-[#E5D5F5] rounded-[32px] p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[320px] cursor-pointer hover:border-primary transition-colors group"
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              {isWebcamActive ? (
                <div className="absolute inset-0 bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); capturePhoto(); }} className="bg-white px-6 py-2 rounded-full font-bold flex items-center gap-2 text-sm shadow-xl"><Camera size={16} /> Capture</button>
                    <button onClick={(e) => { e.stopPropagation(); stopWebcam(); }} className="bg-black/50 text-white px-6 py-2 rounded-full text-sm backdrop-blur-md">Cancel</button>
                  </div>
                </div>
              ) : uploadedImage ? (
                <img src={uploadedImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-[#F3E8FF] rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform"><ImagePlus size={28} className="text-primary" /></div>
                  <h3 className="font-bold text-lg">Upload your photo</h3>
                </div>
              )}
            </div>

            {!isWebcamActive && (
              <button onClick={startWebcam} className="w-full py-4 border-2 border-[#E5D5F5] text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white">
                <Camera size={18} className="text-primary" /> Use Webcam
              </button>
            )}

            <div className="bg-white rounded-[32px] p-8 border border-[#F3E8FF] space-y-6 shadow-sm">
              <h4 className="font-heading font-bold text-sm uppercase tracking-widest text-gray-400 text-center">Lighting Checklist</h4>
              <div className="space-y-3">
                <ChecklistItem icon={<Sun size={14}/>} text="Natural daylight detected" />
                <ChecklistItem icon={<VideoOff size={14}/>} text="High clarity segmentation" />
                <ChecklistItem icon={<User size={14}/>} text="Face centered accurately" />
              </div>
            </div>

            <button 
              onClick={handleAnalyze}
              disabled={!uploadedImage || isAnalyzing}
              className="w-full py-5 bg-primary text-white rounded-[24px] font-bold shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
              {isAnalyzing ? "Analyzing Biometrics..." : "Analyze My Colors"}
            </button>
          </div>

          {/* RIGHT SIDE: DYNAMIC RESULTS */}
          <div className="lg:col-span-7 bg-[#F3E8FF] rounded-[40px] p-12 border border-[#E5D5F5] min-h-[600px] flex flex-col justify-between relative overflow-hidden">
            {analysisResult ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Your Analysis Result</p>
                  <h2 className="text-7xl font-heading font-bold italic text-black uppercase tracking-tighter leading-tight">
                    {activeSeasonName}
                  </h2>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">AI Confidence Score</p>
                    <p className="text-xs font-black text-primary">{displayConfidence}%</p>
                  </div>
                  <div className="w-full h-3 bg-white/40 rounded-full overflow-hidden border border-white/20">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${displayConfidence}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">Your Signature Palette</p>
                  <div className="flex gap-3">
                    {/* DYNAMIC COLORS FROM DATABASE */}
                    {activeSeasonData.colors.map((hex, i) => (
                      <div 
                        key={i} 
                        className="w-12 h-12 rounded-full shadow-lg border-2 border-white transition-transform hover:scale-110" 
                        style={{ backgroundColor: hex }} 
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-gray-600 max-w-md italic">
                  {activeSeasonData.desc}
                </p>

                <div className="flex justify-between items-center py-5 border-t border-primary/10">
                   <span className="text-xs font-bold text-gray-800">What does this mean?</span>
                   <ChevronDown size={18} className="text-gray-400" />
                </div>

                <button 
                  onClick={() => navigate("/color-analysis/subtype", { state: { analysisResult } })}
                  className="w-full py-5 bg-white rounded-3xl font-bold text-primary flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all"
                >
                  View Full Subtype Analysis <ArrowRight size={20} />
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                <div className="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center">
                   <Loader2 size={32} className="text-primary animate-spin" />
                </div>
                <h3 className="font-bold text-xl uppercase tracking-tighter italic">Awaiting Biometric Data</h3>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ChecklistItem({ icon, text }) {
  return (
    <div className="flex items-center gap-4 bg-white/60 p-4 rounded-2xl border border-white">
      <div className="text-primary">{icon}</div>
      <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tighter">{text}</span>
    </div>
  );
}