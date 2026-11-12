// ColorAnalysisProcessingPage shows progress while the analysis engine runs.

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Microscope, Check, Loader2, X, Fingerprint, AlertTriangle } from "lucide-react";
import { auth } from "../firebase";
import { apiUrl } from "../config";
import { useUserStore } from "../store/userStore";

// A request that never reached the server, or a device with no connection. fetch throws a TypeError
// with "Failed to fetch" (Chrome), "NetworkError ..." (Firefox) or "Load failed" (Safari); other
// TypeErrors are bugs and stay "unknown". The upload page then says "You're Offline".
function failureCode(error) {
  const networkFailure =
    error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message);
  return !navigator.onLine || networkFailure ? "offline" : "unknown";
}

export function ColorAnalysisProcessingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const image = location.state?.image;
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const controllerRef = useRef(null);
  const confirmOpenRef = useRef(false);
  // Result that arrived while the cancel pop-up was open — saved only if the user keeps analyzing
  const pendingFinishRef = useRef(null);

  useEffect(() => {
    if (!image) {
      navigate("/color-analysis");
      return;
    }

    // Aborted on cancel or when leaving the page, so a cancelled analysis is never saved or shown
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    const saveAndShowResult = async (data, idToken) => {
      setSaving(true);
      try {
        if (idToken) {
          // Saved only now (the user did not cancel). The backend checks its signed receipt (result_token),
          // so only the exact result it produced for this user can be stored.
          const saveRes = await fetch(apiUrl("/user/analysis-result"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              season: data.season,
              lab_color: data.lab_color,
              confidence: data.confidence,
              result_token: data.result_token,
            }),
            signal,
          });
          if (!saveRes.ok) throw new Error(`Saving the result failed (${saveRes.status})`);
          // The server now holds the new season and skin color. Mirror exactly what it wrote into the store, so Browse
          // ranking and the Recommended cache (keyed on these fields) see it without a reload. Done even if the user
          // navigated away meanwhile: the save already happened.
          useUserStore.getState().updateProfile({
            seasonal_label: data.season,
            user_lab: data.lab_color,
            season_confidence_level: data.confidence,
            profile_completed: true,
          });
        }
        if (signal.aborted) return;

        navigate("/color-analysis/subtype", { state: { analysisResult: data } });
      } catch (error) {
        if (signal.aborted) return;
        console.error("Profile save error:", error);
        navigate("/color-analysis", { state: { photoError: failureCode(error) } });
      }
    };

    const runAnalysis = async () => {
      // Offline: go straight back instead of showing progress for a request that cannot be sent.
      if (!navigator.onLine) {
        navigate("/color-analysis", { state: { photoError: "offline" } });
        return;
      }
      try {
        const response = await fetch(image, { signal });
        const blob = await response.blob();

        const formData = new FormData();
        formData.append("file", blob, "upload.png");

        const idToken = await auth.currentUser?.getIdToken();
        if (signal.aborted) return;

        const apiRes = await fetch(apiUrl("/analyze-color"), {
          method: "POST",
          headers: idToken ? { "Authorization": `Bearer ${idToken}` } : {},
          body: formData,
          signal,
        });

        if (!apiRes.ok) {
          // 422 = photo problem (blurry, too dark, no face...) — the upload page explains it
          const body = await apiRes.json().catch(() => null);
          if (signal.aborted) return;
          navigate("/color-analysis", {
            state: { photoError: body?.detail?.code || "unknown" },
          });
          return;
        }

        const data = await apiRes.json();
        if (signal.aborted) return;

        if (confirmOpenRef.current) {
          pendingFinishRef.current = () => saveAndShowResult(data, idToken);
          return;
        }
        await saveAndShowResult(data, idToken);

      } catch (error) {
        if (signal.aborted) return;
        console.error("Pipeline error:", error);
        navigate("/color-analysis", { state: { photoError: failureCode(error) } });
      }
    };

    runAnalysis();
    return () => controller.abort();
  }, [navigate, image]);

  const openCancelConfirm = () => {
    confirmOpenRef.current = true;
    setConfirmCancelOpen(true);
  };

  const keepAnalyzing = () => {
    confirmOpenRef.current = false;
    setConfirmCancelOpen(false);
    const pendingFinish = pendingFinishRef.current;
    pendingFinishRef.current = null;
    pendingFinish?.();
  };

  const cancelAnalysis = () => {
    controllerRef.current?.abort();
    pendingFinishRef.current = null;
    navigate("/color-analysis");
  };

  return (
    <main className="page-shell px-4 sm:px-8 bg-primary-lightest font-body text-black flex flex-col items-center justify-center">
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
          <h1 className="font-heading text-4xl font-semibold text-black italic">
            Analyzing Your Profile
          </h1>
          <p className="text-gray-light max-w-md mx-auto leading-relaxed text-sm">
            Our clinical AI is currently mapping 142 facial data points to
            determine your precise seasonal palette and sub-tone.
          </p>
        </div>

        <div className="w-full max-w-2xl bg-white p-5 sm:p-8 rounded-[32px] shadow-sm border border-primary-light/10 relative overflow-hidden">
          <div className="grid grid-cols-3 gap-2 relative sm:px-8">
            <div className="absolute top-[18px] left-[16.667%] right-[16.667%] h-[2px] bg-gray-lightest z-0">
              <div className="h-full bg-primary w-1/2 transition-all duration-700 ease-in-out" />
            </div>
            <Step status="complete" icon={<Check size={16} />} label={"Pre­processing"} active />
            <Step status="loading" icon={<Loader2 size={16} className="animate-spin" />} label="Extracting Features" active />
            <Step status="pending" icon={<Fingerprint size={16} />} label="Classifying Season" />
          </div>
          <div className="flex gap-3 mt-8 sm:mt-10 sm:px-4">
            <div className="h-1.5 flex-1 bg-primary rounded-full" />
            <div className="h-1.5 flex-1 bg-primary rounded-full" />
            <div className="h-1.5 flex-1 bg-gray-lightest rounded-full" />
          </div>
        </div>

        {/* Hidden once saving starts — a save already sent can't be undone */}
        {!saving && (
          <button
            onClick={openCancelConfirm}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#DC2626] font-bold text-sm transition-colors group"
          >
            <X size={16} className="group-hover:rotate-90 transition-transform" />
            Cancel Analysis
          </button>
        )}
      </section>

      {confirmCancelOpen && (
        <CancelAnalysisModal onKeep={keepAnalyzing} onCancel={cancelAnalysis} />
      )}
    </main>
  );
}

function CancelAnalysisModal({ onKeep, onCancel }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onKeep();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onKeep]);

  return (
    <div className="modal-backdrop" onClick={onKeep}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-analysis-title"
        aria-describedby="cancel-analysis-message"
        className="modal max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onKeep}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-primary hover:bg-gray-50 transition-all"
        >
          <X size={18} />
        </button>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle size={22} strokeWidth={2.5} />
        </div>
        <h3 id="cancel-analysis-title" className="mb-2 font-heading text-lg font-semibold text-black">
          Cancel analysis?
        </h3>
        <p id="cancel-analysis-message" className="mb-6 text-sm text-gray-600 leading-relaxed">
          Your photo won't be analyzed and nothing will be saved. Your current results will stay the same.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
          >
            Keep Analyzing
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
          >
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
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
    <div className="flex flex-col items-center space-y-4 relative z-10 min-w-0 text-center">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${getStyles()}`}>
        {icon}
      </div>
      <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-normal sm:tracking-widest leading-tight transition-colors duration-500 ${active ? "text-primary" : "text-gray-lighter"}`}>
        {label}
      </span>
    </div>
  );
}
