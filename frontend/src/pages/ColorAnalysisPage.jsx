import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import {
  ImagePlus,
  Camera,
  ArrowRight,
  Sparkles,
  Loader2
} from "lucide-react";

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
      alert("Webcam access denied.");
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
          seasonal_label: result.seasonal_label,
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

  return (
    <main className="page-shell px-4 py-6 min-h-screen bg-[#FAF9FF] font-body text-black">
      <section className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-bold">Color Analysis</h1>
          <p className="text-gray-light">Upload a photo to discover your seasonal profile.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="col-span-1 lg:col-span-5 space-y-6">
            <div 
              onClick={triggerFileInput}
              className="bg-white border-2 border-dashed border-[#E5D5F5] rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[280px] cursor-pointer hover:border-[#7700CF]"
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              {isWebcamActive ? (
                <div className="absolute inset-0 bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); capturePhoto(); }} className="bg-white px-6 py-2 rounded-full font-bold flex items-center gap-2 text-sm"><Camera size={16} /> Capture</button>
                    <button onClick={(e) => { e.stopPropagation(); stopWebcam(); }} className="bg-black/50 text-white px-6 py-2 rounded-full text-sm">Cancel</button>
                  </div>
                </div>
              ) : uploadedImage ? (
                <img src={uploadedImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="text-center space-y-4">
                  <ImagePlus size={32} className="mx-auto text-primary" />
                  <h3 className="font-bold text-xl">Upload photo</h3>
                </div>
              )}
            </div>

            {!isWebcamActive && (
              <button onClick={startWebcam} className="w-full py-4 border border-primary text-primary rounded-full font-bold flex items-center justify-center gap-2">
                <Camera size={18} /> Use Webcam
              </button>
            )}

            <button 
              onClick={handleAnalyze}
              disabled={!uploadedImage || isAnalyzing}
              className="w-full py-4 bg-[#7700CF] text-white rounded-full font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
              {isAnalyzing ? "Processing..." : "Analyze My Colors"}
            </button>
          </div>

          <div className="col-span-1 lg:col-span-7 bg-[#F3E8FF]/50 rounded-3xl p-10 border border-primary-light/20 relative">
            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Result</p>
                <h2 className="text-6xl font-bold italic uppercase">
                  {analysisResult?.seasonal_label ? analysisResult.seasonal_label.replace("-", " ") : "Pending..."}
                </h2>
              </div>

              {analysisResult && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-sm font-bold text-gray">AI Confidence</p>
                    <p className="text-sm font-black text-primary">
                      {analysisResult?.confidence ? (analysisResult.confidence * 100).toFixed(0) : "0"}%
                    </p>
                  </div>
                  <div className="w-full h-2 bg-primary-light rounded-full">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-1000" 
                      style={{ width: `${(analysisResult?.confidence || 0) * 100}%` }} 
                    />
                  </div>
                </div>
              )}

              <button 
                onClick={() => navigate("/ingredient-filter")}
                className="w-full py-4 bg-white border border-primary-light text-primary rounded-full font-bold flex items-center justify-center gap-2"
              >
                View Curated Products <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}