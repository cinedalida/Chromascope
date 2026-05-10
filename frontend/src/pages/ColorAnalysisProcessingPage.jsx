// ColorAnalysisProcessingPage shows progress while the analysis engine runs.

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Microscope, Check, Loader2, X, Fingerprint } from "lucide-react";

export function ColorAnalysisProcessingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate API processing delay before transitioning to the results/subtype page
    const timer = setTimeout(() => {
      navigate("/color-analysis/subtype");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="page-shell bg-[#FAF4FF] font-body text-black flex flex-col items-center justify-center">
      <section className="max-w-4xl w-full flex flex-col items-center space-y-12">
        {/* Central Animated Icon */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/5 rounded-[40px] blur-3xl group-hover:bg-primary/10 transition-all duration-1000" />
          <div className="relative w-48 h-48 bg-white rounded-[40px] shadow-xl border border-primary-light/20 flex flex-col items-center justify-center space-y-4">
            <Microscope size={56} className="text-primary animate-pulse" />
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
            </div>
          </div>
        </div>

        {/* Textual Feedback */}
        <div className="text-center space-y-3">
          <h1 className="font-heading text-4xl font-bold text-black italic">
            Analyzing Your Profile
          </h1>
          <p className="text-gray-light max-w-md mx-auto leading-relaxed text-sm">
            Our clinical AI is currently mapping 142 facial data points to
            determine your precise seasonal palette and sub-tone.
          </p>
        </div>

        {/* Progress Stepper Card */}
        <div className="w-full max-w-2xl bg-white p-8 rounded-[32px] shadow-sm border border-primary-light/10 relative overflow-hidden">
          <div className="flex items-center justify-between relative px-8">
            {/* Connecting Lines */}
            <div className="absolute top-[18px] left-16 right-16 h-[2px] bg-gray-lightest z-0">
              <div className="h-full bg-primary w-1/2 transition-all duration-700 ease-in-out" />
            </div>

            {/* Step 1: Complete */}
            <Step
              status="complete"
              icon={<Check size={16} />}
              label="Preprocessing"
              active
            />

            {/* Step 2: In Progress */}
            <Step
              status="loading"
              icon={<Loader2 size={16} className="animate-spin" />}
              label="Extracting Features"
              active
            />

            {/* Step 3: Pending */}
            <Step
              status="pending"
              icon={<Fingerprint size={16} />}
              label="Classifying Season"
            />
          </div>

          {/* Bottom Progress Bars (Matching Image Detail) */}
          <div className="flex gap-3 mt-10 px-4">
            <div className="h-1.5 flex-1 bg-primary rounded-full" />
            <div className="h-1.5 flex-1 bg-primary rounded-full" />
            <div className="h-1.5 flex-1 bg-gray-lightest rounded-full" />
          </div>
        </div>

        {/* Action Buttons */}
        <button 
          onClick={() => navigate("/color-analysis")}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#DC2626] font-bold text-sm transition-colors group"
        >
          <X size={16} className="group-hover:rotate-90 transition-transform" />
          Cancel Analysis
        </button>
      </section>
    </main>
  );
}

// Internal Stepper Component
function Step({ status, icon, label, active }) {
  const getStyles = () => {
    switch (status) {
      case "complete":
        return "bg-primary text-white border-primary";
      case "loading":
        return "bg-primary text-white border-primary ring-4 ring-primary-light/30";
      default:
        return "bg-gray-lightest text-gray-lighter border-gray-lighter";
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 relative z-10">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${getStyles()}`}
      >
        {icon}
      </div>
      <span
        className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-500 ${
          active ? "text-primary" : "text-gray-lighter"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
