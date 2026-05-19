// ColorAnalysisSubtypePage shows the subtype-specific results after analysis.

import React, { useEffect, useState } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
import {
  Dna,
  Sparkles,
  ArrowRight,
  ScanFace,
  Target,
  ShieldCheck,
  Droplet
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
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.analysisResult;
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  if (!result) {
    return <Navigate to="/color-analysis" replace />;
  }

  const { season, confidence, lab_color } = result;
  const profileData = SEASON_DATABASE[season] || SEASON_DATABASE["Cool Winter"];

  const skinHex = labToHex(lab_color[0], lab_color[1], lab_color[2]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FAF9FF] via-[#F6F0FF] to-[#FAF9FF] font-body text-black pb-12">
      <div className="bg-white/60 backdrop-blur-md border-b border-primary/10 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <Dna size={24} className="animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">
              Chromascope Profile
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-dark bg-white px-4 py-2 rounded-full shadow-sm">
            <ShieldCheck size={16} className="text-green-500" />
            Verified Analysis
          </div>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        
        <header className={`space-y-4 transition-all duration-1000 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h1 className="font-heading text-5xl sm:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#111827] to-[#7700CF] italic tracking-tight">
            {season}
          </h1>
          <p className="text-gray-dark max-w-2xl text-lg sm:text-xl leading-relaxed">
            {profileData.desc}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <aside className={`col-span-1 lg:col-span-4 space-y-6 transition-all duration-1000 delay-150 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-white flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex items-center gap-2 mb-2 text-primary">
                <ScanFace size={20} />
                <h3 className="font-heading font-bold text-xl text-[#111827]">
                  Raw Skin Shade
                </h3>
              </div>
              
              <p className="text-xs text-gray mb-8 px-4 leading-relaxed">
                Extracted directly from your facial map using our clinical AI segmentation model.
              </p>

              <div className="relative mb-8">
                <div 
                  className="w-36 h-36 rounded-full shadow-2xl border-4 border-white relative z-10 transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundColor: skinHex }}
                />
                <div 
                  className="absolute inset-0 rounded-full blur-[32px] opacity-40 -z-10 transition-all duration-500 group-hover:opacity-70 group-hover:blur-[40px] scale-110"
                  style={{ backgroundColor: skinHex }}
                />
              </div>

              <div className="space-y-2 bg-gray-50/50 w-full py-4 rounded-2xl border border-gray-100">
                <p className="font-mono font-bold text-xl text-black">{skinHex}</p>
                <div className="flex items-center justify-center gap-2 text-[10px] text-gray-dark uppercase tracking-widest font-bold">
                  <span className="flex items-center gap-1"><Droplet size={10}/> L* {lab_color[0].toFixed(1)}</span>
                  <span className="text-gray-lighter">•</span>
                  <span>a* {lab_color[1].toFixed(1)}</span>
                  <span className="text-gray-lighter">•</span>
                  <span>b* {lab_color[2].toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#7700CF] to-[#5C00A3] text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden group transition-transform hover:-translate-y-1 duration-300">
              <Sparkles className="absolute -right-6 -top-6 w-32 h-32 text-white/10 rotate-12 transition-transform duration-700 group-hover:rotate-45 group-hover:scale-110" />
              <h4 className="font-heading font-bold text-xl mb-3 relative z-10">
                Clinical Tip
              </h4>
              <p className="text-white/90 text-sm leading-relaxed relative z-10">
                {profileData.tip}
              </p>
              <button 
                onClick={() => navigate("/ingredient-filter")}
                className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-white text-primary hover:bg-gray-50 shadow-lg px-6 py-3.5 rounded-full transition-all group-hover:gap-3 w-fit relative z-10"
              >
                Shop Curated Products <ArrowRight size={14} />
              </button>
            </div>
          </aside>

          <div className={`col-span-1 lg:col-span-8 space-y-6 transition-all duration-1000 delay-300 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            
            <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] shadow-sm border border-white">
              <div className="flex justify-between items-end mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Target size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111827]">AI Confidence Score</p>
                    <p className="text-[10px] text-gray uppercase tracking-wider">Model accuracy calculation</p>
                  </div>
                </div>
                <p className="text-3xl font-black text-[#7700CF]">
                  {confidence.toFixed(1)}%
                </p>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-[#7700CF] via-[#A855F7] to-[#C084FC] rounded-full transition-all duration-1500 ease-out shadow-inner"
                  style={{ width: animateIn ? `${confidence}%` : '0%' }}
                />
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-[32px] shadow-sm border border-white">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-heading font-bold text-2xl text-[#111827]">
                  Signature Palette
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {profileData.colors.map((hex, idx) => (
                  <div key={idx} className="group cursor-pointer">
                    <div
                      style={{ backgroundColor: hex }}
                      className="h-32 w-full rounded-2xl shadow-inner border-2 border-white/50 mb-3 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:rounded-xl"
                    />
                    <div className="flex justify-between items-center px-1">
                      <div>
                        <p className="text-sm font-bold text-[#111827] uppercase">
                          {hex}
                        </p>
                        <p className="text-[10px] font-bold text-gray uppercase tracking-widest">
                          {PALETTE_LABELS[idx % PALETTE_LABELS.length]}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        <ArrowRight size={14} className="text-primary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <TransitionCard
                title="Sister Season"
                season={profileData.sister}
                desc="Your closest neighboring palette, sharing similar depth and clarity."
              />
              <TransitionCard
                title="Contrast Season"
                season={profileData.contrastSeason}
                desc="Opposite temperature but shared intensity. Use for unexpected styling."
              />
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}

function TransitionCard({ title, season, desc }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[24px] border border-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
          {title}
        </p>
        <ArrowRight size={14} className="text-gray-light group-hover:text-primary transition-colors" />
      </div>
      <h4 className="font-heading font-bold text-xl text-[#111827] mb-2">
        {season}
      </h4>
      <p className="text-xs text-gray leading-relaxed">{desc}</p>
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