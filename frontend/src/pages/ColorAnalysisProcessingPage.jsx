// ColorAnalysisProcessingPage shows progress while the analysis engine runs.

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Microscope, Check, Loader2, X, Fingerprint } from "lucide-react";
import { auth } from "../firebase";

export function ColorAnalysisProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const image = location.state?.image;
  const [currentStep, setCurrentStep] = useState(0); 

  useEffect(() => {
    if (!image) {
      navigate("/color-analysis");
      return;
    }

    const runAnalysis = async () => {
      try {
        const response = await fetch(image);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append("file", blob, "upload.png");

        setCurrentStep(1);

        const idToken = await auth.currentUser?.getIdToken();

        const apiRes = await fetch("http://localhost:8000/api/analyze-color", {
          method: "POST",
          headers: idToken ? { "Authorization": `Bearer ${idToken}` } : {},
          body: formData,
        });

        if (!apiRes.ok) throw new Error("Analysis failed");
        
        const data = await apiRes.json();
        
        if (idToken) {
          await fetch("http://localhost:8000/api/user/profile", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              seasonal_label: data.seasonal_label || data.season,
              user_lab: data.user_lab || data.lab_color,
              season_confidence_level: data.confidence
            }),
          });
        }

        setCurrentStep(2);
        
        navigate("/color-analysis/subtype", { state: { analysisResult: data } });

      } catch (error) {
        console.error("Pipeline error:", error);
        alert("There was an error analyzing your image. Please try again.");
        navigate("/color-analysis");
      }
    };

    runAnalysis();
  }, [navigate, image]);

  return (
    <main className="page-shell bg-[#FAF4FF] font-body text-black flex flex-col items-center justify-center">
      <section className="max-w-4xl w-full flex flex-col items-center space-y-12">
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

        <div className="text-center space-y-3">
          <h1 className="font-heading text-4xl font-bold text-black italic">
            Analyzing Your Profile
          </h1>
          <p className="text-gray-light max-w-md mx-auto leading-relaxed text-sm">
            Our clinical AI is currently mapping 142 facial data points to
            determine your precise seasonal palette and sub-tone.
          </p>
        </div>

        <div className="w-full max-w-2xl bg-white p-8 rounded-[32px] shadow-sm border border-primary-light/10 relative overflow-hidden">
          <div className="flex items-center justify-between relative px-8">
            <div className="absolute top-[18px] left-16 right-16 h-[2px] bg-gray-lightest z-0">
              <div className="h-full bg-primary w-1/2 transition-all duration-700 ease-in-out" />
            </div>
            <Step status="complete" icon={<Check size={16} />} label="Preprocessing" active />
            <Step status="loading" icon={<Loader2 size={16} className="animate-spin" />} label="Extracting Features" active />
            <Step status="pending" icon={<Fingerprint size={16} />} label="Classifying Season" />
          </div>
          <div className="flex gap-3 mt-10 px-4">
            <div className="h-1.5 flex-1 bg-primary rounded-full" />
            <div className="h-1.5 flex-1 bg-primary rounded-full" />
            <div className="h-1.5 flex-1 bg-gray-lightest rounded-full" />
          </div>
        </div>

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
      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${getStyles()}`}>
        {icon}
      </div>
      <span className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-500 ${active ? "text-primary" : "text-gray-lighter"}`}>
        {label}
      </span>
    </div>
  );
}
