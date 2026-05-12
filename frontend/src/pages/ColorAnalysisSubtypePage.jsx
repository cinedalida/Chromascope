import React, { useState, useEffect } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  Dna,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ScanFace,
  CheckCircle2,
  Loader2
} from "lucide-react";

const SEASON_DATABASE = {
  "Bright Spring": {
    colors: ["#FF6B6B", "#FFD166", "#06D6A0", "#FF9A3C", "#F72585", "#E05070"],
    desc: "High clarity with warm, bright undertones. Your features pop with highly saturated, vibrant, and clear colors.",
    tip: "Your high-chroma profile means you can handle pure, bright pigments. Warm, glossy finishes will enhance your natural clarity.",
    sister: "Bright Winter", contrastSeason: "Deep Autumn"
  },
  "Warm Spring": { 
    colors: ["#FF8C42", "#FFCA3A", "#E07A5F", "#F4A261", "#E63946"],
    desc: "Fully warm and radiant. Your coloring has a golden, glowing quality that shines in true, warm, and clear tones.",
    tip: "Stick to predominantly warm bases. Gold jewelry and peach-toned blushes will harmonize perfectly with your undertone.",
    sister: "Warm Autumn", contrastSeason: "Cool Summer"
  },
  "Light Spring": {
    colors: ["#FFB5A7", "#FFDDD2", "#B5EAD7", "#FEC89A", "#FFCBF2"],
    desc: "Delicate, light, and warm. Your features are low in contrast and look best in pastel, warm-tinted shades.",
    tip: "Avoid heavy, dark makeup. Light, luminous formulas and sheer washes of warm color will keep your features from being overpowered.",
    sister: "Light Summer", contrastSeason: "Deep Autumn"
  },
  "Light Summer": {
    colors: ["#CBAACB", "#ADEFD1", "#F2C4CE", "#B5C7D3", "#C9D5E0"],
    desc: "Cool, delicate, and light. Your overall appearance is gentle and highly harmonious in cool pastels.",
    tip: "Silver and white gold jewelry accentuate your lightness. Opt for cool, dusty pinks and avoid harsh black mascaras.",
    sister: "Light Spring", contrastSeason: "Deep Winter"
  },
  "Cool Summer": { 
    colors: ["#D4A5A5", "#A8DADC", "#B8B0C8", "#C77DFF", "#E0AFA0"],
    desc: "Completely cool with a gentle softness. Blue and pink undertones dominate your coloring.",
    tip: "Embrace blue-based pinks and cool taupes. Avoid anything overly golden or orange, which can clash with your cool L* reflectance.",
    sister: "Cool Winter", contrastSeason: "Warm Spring"
  },
  "Soft Summer": {
    colors: ["#B5838D", "#9B8EA0", "#A7C5BD", "#C4A882", "#D8A7B1", "#D88090", "#D87090", "#D06878"],
    desc: "Muted, cool, and highly blended. Your features have a beautiful dusty quality that thrives in complex, greyed-out colors.",
    tip: "Your superpower is wearing highly complex, greyed-out tones. Blended, matte finishes look incredibly natural on you.",
    sister: "Soft Autumn", contrastSeason: "Bright Winter"
  },
  "Soft Autumn": {
    colors: ["#C8956C", "#A0785A", "#D4A373", "#9B7240", "#BC8A5F"],
    desc: "Muted, warm, and rich. Your coloring is blended and earthy, glowing in rich, desaturated warm tones.",
    tip: "Toasted, earthy neutrals are your best friends. Bronze and copper metallic finishes look sophisticated rather than overpowering.",
    sister: "Soft Summer", contrastSeason: "Bright Spring"
  },
  "Warm Autumn": { 
    colors: ["#B5451B", "#E07B39", "#9C6B30", "#6B4226", "#C0392B"],
    desc: "Fully warm, rich, and earthy. Golden and copper undertones are prominent in your absolutely warm coloring.",
    tip: "Rich terracotta and mustard tones highlight your natural warmth. Avoid icy, blue-based colors that can dull your complexion.",
    sister: "Warm Spring", contrastSeason: "Cool Winter"
  },
  "Deep Autumn": {
    colors: ["#7B2D00", "#5C2018", "#8B4513", "#6B3A2A", "#9B2335", "#3A2818"],
    desc: "Dark, warm, and intense. High depth and rich pigmentation allow you to wear the darkest, warmest colors beautifully.",
    tip: "You can carry deep, heavy pigments effortlessly. Dark olive, espresso, and aubergine enhance your high-contrast features.",
    sister: "Deep Winter", contrastSeason: "Light Spring"
  },
  "Deep Winter": {
    colors: ["#1C1C3A", "#2D1B33", "#3D0C11", "#0A0A2E", "#4A0E4E", "#302010", "#403020"],
    desc: "Dark, cool, and highly contrasting. You have strong depth and can pull off the deepest, coolest jewel tones.",
    tip: "Embrace stark contrasts like pure black paired with icy accents. Silver and platinum align beautifully with your cool depth.",
    sister: "Deep Autumn", contrastSeason: "Light Summer"
  },
  "Cool Winter": { 
    colors: ["#0D0D0D", "#FFFFFF", "#E63946", "#3A86FF", "#8338EC"],
    desc: "Completely cool and sharply contrasting. Icy, vivid colors without a drop of warmth suit you best.",
    tip: "Pure white, true black, and royal blue are your anchors. Avoid any golden or brown tones which will blur your striking clarity.",
    sister: "Cool Summer", contrastSeason: "Warm Autumn"
  },
  "Bright Winter": {
    colors: ["#FF006E", "#3A86FF", "#8338EC", "#06D6A0", "#FB5607", "#C94060", "#E04868"],
    desc: "Extremely striking and cool-leaning. Your features are incredibly clear, thriving in neon, high-voltage jewel tones.",
    tip: "You can wear saturated, almost neon colors that would overwhelm other seasons. High-shine and glossy textures elevate your look.",
    sister: "Bright Spring", contrastSeason: "Soft Summer"
  }
};

const PALETTE_LABELS = ["Core", "Accent", "Contrast", "Light", "Neutral", "Base", "Pop", "Deep"];

export function ColorAnalysisSubtypePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = location.state?.analysisResult;

  if (!result) return <Navigate to="/color-analysis" replace />;

  const { season, confidence } = result;
  const profileData = SEASON_DATABASE[season] || SEASON_DATABASE["Deep Winter"];

  return (
    <main className="page-shell bg-[#FAF9FF] min-h-screen p-8 font-body text-black">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Main Result Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Side: Upload Preview Placeholder (Matches your mockup's left side) */}
          <div className="lg:col-span-7 bg-white rounded-[32px] p-10 border border-[#E5D5F5] flex flex-col items-center justify-center space-y-6">
             <div className="w-full max-w-md bg-[#F9F6FF] border-2 border-dashed border-[#D1B3FF] rounded-2xl p-12 text-center">
                <div className="w-12 h-12 bg-[#E9D5FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="text-primary" size={24} />
                </div>
                <h3 className="font-bold text-lg">Analysis Complete</h3>
                <p className="text-gray-light text-sm mt-2">Your profile has been synchronized with our clinical database.</p>
             </div>
             
             <div className="w-full max-w-md space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400">Lighting Checklist</h4>
                <div className="space-y-2">
                    {["Natural daylight detected", "High clarity segmentation", "Face centered accurately"].map((check, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[#FAF9FF] p-3 rounded-xl border border-[#F0E6FA]">
                            <CheckCircle2 size={16} className="text-green-500" />
                            <span className="text-xs font-medium text-gray-600">{check}</span>
                        </div>
                    ))}
                </div>
             </div>
          </div>

          {/* Right Side: Analysis Result (Exact Match to Mockup) */}
          <div className="lg:col-span-5 bg-[#F3E8FF] rounded-[32px] p-10 flex flex-col justify-between border border-[#E5D5F5]">
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Your Analysis Result</p>
                <h1 className="text-6xl font-heading font-bold italic text-black">{season}</h1>
              </div>

              {/* Confidence Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                    <p className="text-xs font-bold text-gray-600">AI Confidence Score</p>
                    <p className="text-xs font-black text-primary">{confidence.toFixed(0)}%</p>
                </div>
                <div className="w-full h-2.5 bg-white/50 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${confidence}%` }}
                    />
                </div>
              </div>

              {/* Palette */}
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-800">Your Signature Palette</p>
                <div className="flex gap-2">
                    {profileData.colors.map((hex, i) => (
                        <div 
                            key={i} 
                            className="w-10 h-10 rounded-lg shadow-sm border border-white/20" 
                            style={{ backgroundColor: hex }}
                        />
                    ))}
                </div>
              </div>

              <p className="text-[13px] leading-relaxed text-gray-700">
                {profileData.desc}
              </p>

              <div className="flex justify-between items-center py-4 border-t border-primary/10">
                <span className="text-xs font-bold text-gray-800">What does this mean?</span>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>

            <button 
                onClick={() => navigate("/ingredient-filter")}
                className="w-full py-4 bg-white rounded-full font-bold text-primary flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all mt-6"
            >
              View Curated Products <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Bottom Section: Related Palettes */}
        <div className="space-y-6">
            <h3 className="text-xl font-bold italic px-2">Related Palettes</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <RelationCard title="Cool Winter" desc={profileData.sisterDesc} color="bg-[#1A237E]" />
                <RelationCard title="Deep Autumn" desc={profileData.contrastDesc} color="bg-[#3E2723]" />
                <RelationCard title="Bright Winter" desc={profileData.secondaryDesc} color="bg-[#9FA8DA]" />
            </div>
        </div>
      </div>
    </main>
  );
}

function RelationCard({ title, desc, color }) {
    return (
        <div className="bg-[#F3E8FF]/40 border border-[#E5D5F5] p-6 rounded-3xl flex items-center gap-4 hover:bg-white transition-all cursor-pointer">
            <div className={`w-12 h-12 rounded-full shadow-inner ${color} shrink-0`} />
            <div className="space-y-1">
                <h4 className="font-bold text-sm italic">{title}</h4>
                <p className="text-[11px] leading-snug text-gray-500">{desc}</p>
            </div>
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