// ColorAnalysisSubtypePage shows the subtype-specific results after analysis.

import React from "react";
import { useLocation, Navigate } from "react-router-dom";
import {
  Dna,
  Sparkles,
  Sun,
  Droplets,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";

export function ColorAnalysisSubtypePage() {
  const location = useLocation();
  const result = location.state?.analysisResult;

   // Fallback in case a user navigates directly to this URL without analyzing
  if (!result) {
    return <Navigate to="/color-analysis" replace />;
  }

  // Destructure the payload from your pipeline.py
  const { season, confidence, lab_color } = result;


  const palette = [
    { name: "Royal Amethyst", hex: "bg-[#6D28D9]", subtype: "Core" },
    { name: "Deep Sapphire", hex: "bg-[#1E40AF]", subtype: "Accent" },
    { name: "Cool Crimson", hex: "bg-[#BE123C]", subtype: "Contrast" },
    { name: "Icy Mint", hex: "bg-[#CCFBF1]", subtype: "Light" },
    { name: "Charcoal Slate", hex: "bg-[#334155]", subtype: "Neutral" },
    { name: "Silver Mist", hex: "bg-[#E2E8F0]", subtype: "Base" },
  ];

  return (
    <main className="page-shell bg-[#FAF9FF] font-body text-black">
      <section className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="space-y-2">
          <div className="flex items-center gap-3 text-primary">
            <Dna size={20} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
              Genomic Color Profile
            </span>
          </div>
          {/* Inject Dynamic Season Here */}
          <h1 className="font-heading text-4xl font-bold text-black italic">
            Subtype Analysis: {season}
          </h1>
          <p className="text-gray-light max-w-2xl text-lg">
            High contrast and cool-toned saturation. Your subtype thrives on
            clarity and vivid pigments that mirror your natural biometric
            intensity. (AI Confidence: {confidence.toFixed(1)}%)
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Biometric Breakdown (4/12 on lg) */}
          <aside className="col-span-1 lg:col-span-4 space-y-6">
            <div className="page-card space-y-6">
              <h3 className="font-heading font-bold text-xl">
                Biometric Metrics
              </h3>

              <MetricRow
                icon={<Sun size={18} className="text-warning" />}
                label="Value"
                value="High Contrast"
                percent={88}
              />
              <MetricRow
                icon={<Droplets size={18} className="text-info" />}
                label="Undertone"
                value="Cool / Blue"
                percent={94}
              />
              <MetricRow
                icon={<Layers size={18} className="text-primary" />}
                label="Chroma"
                value="Vivid / Clear"
                percent={72}
              />

              <div className="pt-4 mt-4 border-t border-primary-light/10">
                <div className="flex items-start gap-3 p-4 bg-primary-lightest/50 rounded-xl border border-primary-light/20">
                  <Info size={16} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-[11px] text-gray leading-normal italic">
                    Your skin reflectance indicates a high tolerance for
                    metallic finishes and deep jewel tones. Avoid muted "dusty"
                    shades.
                  </p>
                </div>
              </div>
            </div>

            {/* Subtype Tip Card */}
            <div className="bg-primary text-white p-6 rounded-2xl shadow-md relative overflow-hidden group">
              <Sparkles className="absolute -right-4 -top-4 w-24 h-24 text-white/10 rotate-12 transition-transform group-hover:rotate-45" />
              <h4 className="font-heading font-bold text-lg mb-2">
                Clinical Tip
              </h4>
              <p className="text-white/80 text-xs leading-relaxed">
                Utilize silver-based primers to enhance your natural luminance.
                Silver-toned jewelry will harmonize with your L* color depth
                more effectively than gold.
              </p>
              <button className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:gap-3 transition-all">
                Shop Silver Tone Products <ArrowRight size={14} />
              </button>
            </div>
          </aside>

          {/* Right Column: Palette Discovery (8/12 on lg) */}
          <div className="col-span-1 lg:col-span-8 space-y-6">
            <div className="page-card">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-heading font-bold text-2xl italic">
                  Subtype Palette
                </h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-primary-light text-primary text-[10px] font-bold rounded-full uppercase">
                    Digital Accurate
                  </span>
                  <span className="px-3 py-1 bg-gray-lightest text-gray text-[10px] font-bold rounded-full uppercase">
                    Printable
                  </span>
                </div>
              </div>

              {/* Swatch Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {palette.map((color, idx) => (
                  <div key={idx} className="group cursor-pointer">
                    <div
                      className={`${color.hex} h-32 w-full rounded-xl shadow-inner border-2 border-white mb-3 transition-transform group-hover:scale-[1.02]`}
                    />
                    <div className="flex justify-between items-center px-1">
                      <div>
                        <p className="text-xs font-bold text-black">
                          {color.name}
                        </p>
                        <p className="text-[9px] font-bold text-gray-light uppercase tracking-tighter">
                          {color.subtype}
                        </p>
                      </div>
                      <div className="w-6 h-6 rounded-full border border-gray-lighter flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight size={12} className="text-primary" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasonal Transition Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <TransitionCard
                title="Sister Season"
                season="True Winter"
                desc="Leans slightly deeper and more neutral-cool."
              />
              <TransitionCard
                title="Contrast Season"
                season="Bright Spring"
                desc="Maintains clarity but shifts to warm undertones."
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// Helper Components
function MetricRow({ icon, label, value, percent }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gray-lightest rounded-lg">{icon}</div>
          <span className="text-[11px] font-bold text-gray-light uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span className="text-xs font-black text-black">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-lightest rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-1000"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function TransitionCard({ title, season, desc }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-primary-light/10 shadow-sm hover:border-primary-light/40 transition-colors cursor-pointer">
      <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">
        {title}
      </p>
      <h4 className="font-heading font-bold text-lg text-black mb-1 italic">
        {season}
      </h4>
      <p className="text-[11px] text-gray leading-snug">{desc}</p>
    </div>
  );
}
