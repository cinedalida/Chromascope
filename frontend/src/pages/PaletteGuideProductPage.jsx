// PaletteGuideProductPage presents curated cosmetic products for the user palette.

import { useState } from "react";
import {
  LayoutGrid,
  List,
  Check,
  ShieldCheck,
  Fingerprint,
} from "lucide-react";

export function PaletteGuideProductPage() {
  const [viewMode, setViewMode] = useState("grid");

  const matches = [
    {
      brand: "AURA BIOTICS",
      name: "Serum Foundation 04",
      badges: ["CRUELTY FREE", "NON-COMEDO"],
      deltaE: "0.82",
      matchType: "ULTRA MATCH",
      verified: true,
    },
    {
      brand: "LUMIÈRE SKIN",
      name: "Glass Veil Tint",
      badges: ["SPF 50+"],
      deltaE: "1.45",
      matchType: "NATURAL",
    },
    {
      brand: "DERMAVANCE",
      name: "Bio-Active Concealer",
      badges: ["CLINICAL GRADE"],
      deltaE: "2.11",
      matchType: "CLOSE",
    },
    {
      brand: "PRISM CLINICAL",
      name: "Photo-Ready Base",
      badges: ["ANTI-OXIDANT"],
      deltaE: "0.98",
      matchType: "ULTRA MATCH",
    },
    {
      brand: "PRISM CLINICAL",
      name: "Photo-Ready Base",
      badges: ["ANTI-OXIDANT"],
      deltaE: "0.98",
      matchType: "ULTRA MATCH",
    },
    {
      brand: "PRISM CLINICAL",
      name: "Photo-Ready Base",
      badges: ["ANTI-OXIDANT"],
      deltaE: "0.98",
      matchType: "ULTRA MATCH",
    },
  ];

  return (
    <main className="page-shell bg-[#FAF4FF] font-body text-black">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar (3/12 on lg) */}
        <aside className="col-span-1 lg:col-span-3 space-y-6">
          {/* Refine Match Card */}
          <div className="page-card space-y-6">
            <h2 className="font-heading text-xl font-bold italic">
              Refine Match
            </h2>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Product Category
              </label>
              <div className="space-y-3">
                <CheckboxItem label="Foundation" checked />
                <CheckboxItem label="Concealer" />
                <CheckboxItem label="Tinted Moisturizer" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  ΔE Precision
                </label>
                <span className="bg-primary-light text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                  ≤ 2.4
                </span>
              </div>
              <input
                type="range"
                className="w-full accent-primary"
                min="0"
                max="5"
                defaultValue="2.4"
              />
              <div className="flex justify-between text-[9px] text-gray-light font-bold">
                <span>0.0 (Perfect)</span>
                <span>5.0 (Noticeable)</span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Brand Laboratory
              </label>
              <select className="w-full p-3 bg-primary-lightest border border-primary-light rounded-lg text-xs font-medium focus:outline-none">
                <option>All Premium Brands</option>
              </select>
            </div>

            <div className="pt-4 border-t border-gray-lightest">
              <div className="bg-primary-lightest p-4 rounded-xl flex items-center justify-between border border-primary-light">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-primary shadow-sm">
                    <ShieldCheck size={18} />
                  </div>
                  <span className="text-[11px] font-bold leading-tight">
                    Safe-Scan Only
                  </span>
                </div>
                <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="bg-primary-lightest p-6 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-heading font-bold text-lg">Your Profile</h3>
              <Fingerprint size={20} className="text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div>
                <p className="text-gray-light mb-1">Luminance</p>
                <p className="text-primary">L* 64.2</p>
              </div>
              <div>
                <p className="text-gray-light mb-1">Surface Type</p>
                <p className="text-primary">Hydrated-Normal</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content (9/12 on lg) */}
        <div className="col-span-1 lg:col-span-9 space-y-8">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-0">
            <div>
              <h1 className="font-heading text-3xl font-bold text-black">
                Curated Matches
              </h1>
              <p className="text-gray-light text-sm mt-1">
                24 clinical matches found for your current biometric scan.
              </p>
            </div>
            <div className="flex bg-white rounded-full p-1 border border-gray-light shadow-sm ring-1 ring-black/5">
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-2 px-3 rounded-full transition-all ${viewMode === "grid" ? "bg-primary-light text-primary shadow-sm" : "text-gray-light hover:bg-gray-lightest/50 hover:text-black"}`}
              >
                <LayoutGrid size={18} strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={`p-2 px-3 rounded-full transition-all ${viewMode === "list" ? "bg-primary-light text-primary shadow-sm" : "text-gray-light hover:bg-gray-lightest/50 hover:text-black"}`}
              >
                <List size={18} strokeWidth={2.5} />
              </button>
            </div>
          </header>

          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" : "flex flex-col gap-4"}>
            {matches.map((item, idx) => (
              <div
                key={idx}
                className={`bg-white rounded-2xl border border-gray-lightest shadow-card relative overflow-hidden group transition-all duration-300 ${
                  viewMode === "grid"
                    ? "flex flex-col items-center text-center p-6 space-y-4"
                    : "flex flex-col sm:flex-row items-start sm:items-center text-left p-5 gap-4 sm:gap-6"
                }`}
              >
                {/* Circle Swatch */}
                <div className="relative shrink-0">
                  <div className={`rounded-full bg-[#E3C3A3] shadow-inner ${viewMode === "grid" ? "w-24 h-24" : "w-16 h-16"}`} />
                  {item.verified && (
                    <div className={`absolute bottom-0 right-1 bg-white rounded-full flex items-center justify-center shadow-md ${viewMode === "grid" ? "w-6 h-6" : "w-5 h-5"}`}>
                      <div className={`bg-success rounded-full flex items-center justify-center text-white ${viewMode === "grid" ? "w-4 h-4" : "w-3 h-3"}`}>
                        <Check size={viewMode === "grid" ? 10 : 8} strokeWidth={4} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div className={`flex-1 w-full ${viewMode === "grid" ? "space-y-4" : "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0"}`}>
                  <div className={viewMode === "grid" ? "" : "flex-1"}>
                    <p className="text-[10px] font-bold text-primary tracking-[0.15em] uppercase">
                      {item.brand}
                    </p>
                    <h4 className={`font-heading font-bold italic leading-tight ${viewMode === "grid" ? "text-base" : "text-lg"}`}>
                      {item.name}
                    </h4>
                    
                    <div className={`flex flex-wrap gap-1.5 pt-1 ${viewMode === "grid" ? "justify-center" : "justify-start"}`}>
                      {item.badges.map((b) => (
                        <span
                          key={b}
                          className="bg-primary-lightest text-primary border border-primary-light px-2 py-0.5 rounded text-[8px] font-black tracking-tighter"
                        >
                          {b}
                        </span>
                      ))}
                      {item.name === "Bio-Active Concealer" && (
                        <span className="bg-[#FFE9D5] text-[#BA7517] px-2 py-0.5 rounded text-[8px] font-black tracking-tighter">
                          CLINICAL GRADE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={`${viewMode === "grid" ? "w-full pt-4 border-t border-gray-lightest flex justify-between items-center" : "flex flex-wrap items-center gap-4 sm:gap-6"}`}>
                    <div className={viewMode === "grid" ? "text-left" : "text-right"}>
                      <p className="text-[8px] font-bold text-gray-lighter uppercase tracking-widest">
                        Delta-E
                      </p>
                      <p className={`font-heading font-bold leading-none ${viewMode === "grid" ? "text-lg" : "text-xl"}`}>
                        {item.deltaE}
                      </p>
                    </div>
                    
                    {viewMode === "list" && <div className="w-px h-8 bg-gray-lightest" />}

                    <span
                      className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                        item.matchType === "ULTRA MATCH"
                          ? "bg-[#F4E5FF] text-primary"
                          : item.matchType === "NATURAL"
                            ? "bg-[#F5F5F4] text-gray"
                            : "bg-gray-lightest text-gray-light"
                      }`}
                    >
                      {item.matchType}
                    </span>
                    
                    {viewMode === "list" && (
                      <div className="w-full sm:w-32 mt-2 sm:mt-0 sm:ml-4">
                        <TryOnButton />
                      </div>
                    )}
                  </div>
                </div>

                {viewMode === "grid" && <TryOnButton />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

/* Try On button with guaranteed hover via React state */
function TryOnButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? "#7700CF" : "#ffffff",
        color: hovered ? "#ffffff" : "#7700CF",
        border: "1.5px solid #7700CF",
        transition: "background-color 0.18s ease, color 0.18s ease",
      }}
      className="w-full py-2.5 rounded-full font-bold text-xs uppercase tracking-widest active:scale-95"
    >
      Try On
    </button>
  );
}

function CheckboxItem({ label, checked }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group">
      <div
        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          checked
            ? "bg-primary border-primary"
            : "bg-white border-gray-lighter group-hover:border-primary-light"
        }`}
      >
        {checked && <Check size={14} className="text-white" />}
      </div>
      <span
        className={`text-sm font-medium ${checked ? "text-black" : "text-gray-light group-hover:text-black"}`}
      >
        {label}
      </span>
    </div>
  );
}
