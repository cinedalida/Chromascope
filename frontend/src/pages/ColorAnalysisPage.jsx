// ColorAnalysisPage begins the skin tone and palette analysis flow.

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  X,
  ImagePlus,
  Camera,
  Sun,
  ZapOff,
  UserSquare,
  ScanFace,
  Focus,
  ChevronDown,
  ArrowRight,
  Info,
  Lock,
  Loader2,
  Dna
} from "lucide-react";
import { OfflineNote } from "../components/common/OfflineBanner.jsx";
import { auth, db } from "../firebase"; 
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getSkinToneName } from "../utils/colorNames";
import { ColorTooltip } from "../components/common/ColorTooltip";
import { SEASON_DATABASE } from "../constants/seasonDatabase";

// Keyed by the error code the analyze-color API returns. `tips` names the guideline(s) that fix the error, highlighted in the pop-up.
const PHOTO_ERRORS = {
  too_blurry: {
    title: "Photo Too Blurry",
    message: "Your photo looks out of focus. Hold your camera steady, tap your face to focus, and try again.",
    tips: ["Sharp photo"],
  },
  too_dark: {
    title: "Lighting Too Dim",
    message: "Your face is too dark for us to read your skin tone. Face a window or move to a brighter spot, then try again.",
    tips: ["Well-lit space"],
  },
  too_bright: {
    title: "Too Much Light",
    message: "Your skin looks washed out from bright light or flash. Avoid direct sunlight and turn off the flash, then try again.",
    tips: ["No harsh light"],
  },
  no_face: {
    title: "No Face Found",
    message: "We couldn't find a face in your photo. Make sure your whole face is visible and looking at the camera.",
    tips: ["Face fully visible", "Look straight ahead"],
  },
  face_unclear: {
    title: "Face Not Clear",
    message: "We couldn't get a clear view of your skin. Move hair, hands, or sunglasses away from your face and look straight at the camera.",
    tips: ["Face fully visible"],
  },
  invalid_image: {
    title: "Can't Open Photo",
    message: "We couldn't open that file. Please upload a JPG or PNG photo.",
  },
  // Set by ColorAnalysisProcessingPage when the device is offline or the request never reached the server.
  offline: {
    title: "You're Offline",
    message: "Your photo wasn't sent. Connect to the internet and try again.",
  },
  unknown: {
    title: "Something Went Wrong",
    message: "We couldn't analyze your photo. Please try again in a moment.",
  },
};

// Shown before upload. Each tip heads off one of the photo errors above.
const PHOTO_GUIDELINES = [
  { icon: Sun, title: "Well-lit space", detail: "Face a window or use soft daylight, not a dim room." },
  { icon: ZapOff, title: "No harsh light", detail: "No flash, direct sunlight, or colored lights." },
  { icon: UserSquare, title: "Bare face", detail: "No heavy makeup, foundation, or beauty filters." },
  { icon: ScanFace, title: "Face fully visible", detail: "Keep hair, hands, and sunglasses away from your face." },
  { icon: Focus, title: "Look straight ahead", detail: "Center your face and look at the camera." },
  { icon: Camera, title: "Sharp photo", detail: "Hold steady so the photo isn't blurry." },
];

// Phones and tablets (touch as the main input) have a camera; computers have a webcam.
const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

export function ColorAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [photoError, setPhotoError] = useState(location.state?.photoError || null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [showSeasonInfo, setShowSeasonInfo] = useState(false);
  // Photo guidelines pop-up: "upload" and "camera" continue to that step on "Got it"; "info" only shows the tips.
  const [guidelinesFor, setGuidelinesFor] = useState(null);
  const [isTouch] = useState(isTouchDevice);
  const cameraWord = isTouch ? "camera" : "webcam";

  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      }
      setIsLoadingProfile(false);
    });
    return () => unsubscribe();
  }, []);

  // Clear the error from history so a refresh doesn't reopen the pop-up
  useEffect(() => {
    if (location.state?.photoError) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state?.photoError, navigate]);

  const closePhotoError = () => setPhotoError(null);

  const retryPhoto = () => {
    setPhotoError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
    }
  };

  // Every upload starts with the guidelines; the file picker opens from the pop-up's button (still a user tap).
  const triggerFileInput = () => {
    if (!isWebcamActive) setGuidelinesFor("upload");
  };

  const closeGuidelines = () => setGuidelinesFor(null);

  const continueFromGuidelines = () => {
    const next = guidelinesFor;
    setGuidelinesFor(null);
    if (next === "upload") fileInputRef.current?.click();
    else if (next === "camera") startWebcam();
  };

  const startWebcam = async () => {
    try {
      // Front camera on phones; a hint only, so single-webcam computers are unaffected
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setIsWebcamActive(true);
      setUploadedImage(null);
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert(`Could not access ${cameraWord}. Please check your permissions.`);
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

  useEffect(() => {
    return () => stopWebcam();
  }, []);

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

  const userSeason = userProfile?.seasonal_label;
  const currentSeasonData = userSeason && SEASON_DATABASE[userSeason] ? SEASON_DATABASE[userSeason] : null;

  // Convert the user's DB lab values to Hex to display their raw shade
  const skinHex = userProfile?.user_lab ? labToHex(userProfile.user_lab[0], userProfile.user_lab[1], userProfile.user_lab[2]) : null;

  return (
    <main className="min-h-dvh bg-primary-lightest font-body text-black pb-12">

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        
        <header className={`space-y-4 transition-all duration-1000 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h1 className="font-heading text-4xl sm:text-6xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#111827] to-primary italic tracking-tight">
            Color Analysis
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Upload a photo or use your {cameraWord} to run our clinical AI model and map your genomic color profile.
          </p>
        </header>

        {/* Shown before the user takes or uploads a photo, so they do not wait for an analysis that cannot run. */}
        <OfflineNote>Color analysis needs internet. Connect to analyze your photo.</OfflineNote>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className={`col-span-1 lg:col-span-5 space-y-6 transition-all duration-1000 delay-150 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>

            <button
              type="button"
              onClick={() => setGuidelinesFor("info")}
              aria-haspopup="dialog"
              className="w-full bg-white/60 backdrop-blur-xl px-5 sm:px-8 py-5 rounded-[32px] border border-white shadow-sm flex justify-between items-center gap-4 text-left transition hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>
                <span className="block font-heading font-semibold text-lg text-[#111827]">
                  Photo guidelines
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {PHOTO_GUIDELINES.length} tips for an accurate result
                </span>
              </span>
              <Info size={20} className="shrink-0 text-primary" />
            </button>

            <div
              onClick={triggerFileInput}
              className={`bg-white/80 backdrop-blur-xl border-2 border-dashed border-secondary-light rounded-[32px] p-8 flex flex-col items-center justify-center text-center shadow-sm transition-all duration-300 relative overflow-hidden min-h-[300px] ${!isWebcamActive ? 'cursor-pointer hover:border-primary hover:bg-primary/5 hover:shadow-md group' : ''}`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
                // The picker's own click must not bubble to the upload box, which would open the guidelines again.
                onClick={(e) => e.stopPropagation()}
              />

              {isWebcamActive ? (
                <div className="absolute inset-0 w-full h-full bg-black">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-90" />

                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
                    <button 
                      onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                      className="bg-white text-[#111827] px-4 sm:px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform text-sm"
                    >
                      <Camera size={18} />
                      Capture Frame
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stopWebcam(); }}
                      className="bg-black/50 backdrop-blur-md border border-white/20 text-white px-4 sm:px-6 py-3 rounded-full font-bold shadow-xl hover:bg-black/70 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : uploadedImage ? (
                <div className="absolute inset-0 w-full h-full group">
                  <img src={uploadedImage} alt="Uploaded preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-[#111827]/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-white font-medium bg-white/20 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-2 shadow-xl border border-white/30">
                      <ImagePlus size={18} />
                      Replace Photo
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary-lightest to-primary-lighter rounded-full flex items-center justify-center text-primary mx-auto group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-inner">
                    <ImagePlus size={36} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-2xl text-[#111827]">
                      Upload Portrait
                    </h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-[250px] mx-auto leading-relaxed">
                      {isTouch ? "Tap" : "Click"} to upload a clear, front-facing photo in natural light.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!isWebcamActive && (
              <button
                onClick={() => setGuidelinesFor("camera")}
                className="w-full py-4 border-2 border-primary/20 bg-white/50 backdrop-blur-sm text-primary rounded-full font-bold flex items-center justify-center gap-2 hover:bg-primary hover:text-white hover:border-primary active:bg-primary active:text-white active:border-primary active:scale-[0.98] transition-all duration-300 shadow-sm"
              >
                <Camera size={18} />
                {isTouch ? "Activate Camera" : "Activate Webcam"}
              </button>
            )}

            <button
              onClick={() => navigate("/color-analysis/processing", { state: { image: uploadedImage } })}
              disabled={!uploadedImage}
              className="w-full py-4 sm:py-5 bg-gradient-to-r from-primary to-primary-dark text-white rounded-full font-bold shadow-xl hover:shadow-2xl transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none text-base sm:text-lg flex justify-center items-center gap-2"
            >
              <Dna size={20} />
              Run Analysis
            </button>
          </div>

          <div className={`col-span-1 lg:col-span-7 transition-all duration-1000 delay-300 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 sm:p-10 border border-white shadow-sm h-full flex flex-col relative overflow-hidden">
              
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[60px] pointer-events-none" />

              {isLoadingProfile ? (
                <div className="flex-1 flex flex-col items-center justify-center text-primary/60 space-y-4">
                  <Loader2 size={40} className="animate-spin" />
                  <p className="font-bold text-sm tracking-widest uppercase">Syncing Profile...</p>
                </div>
              ) : currentSeasonData ? (
                
                <div className="space-y-6 relative z-10 flex-1 flex flex-col justify-center">
                  <div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">
                      Active Profile Match
                    </p>
                    <h2 className="font-heading text-4xl sm:text-6xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#111827] to-primary italic">
                      {userSeason}
                    </h2>
                  </div>

                  <div className="space-y-4 pt-2">
                    <h4 className="font-heading font-semibold text-xl text-[#111827]">
                      Signature Palette
                    </h4>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {currentSeasonData.colors.map((hex, i) => (
                        <ColorTooltip key={i} hex={hex}>
                          <div
                            style={{ backgroundColor: hex }}
                            className="w-10 h-14 sm:w-12 sm:h-16 rounded-xl shadow-sm border-2 border-white hover:scale-110 transition-transform duration-300 cursor-pointer"
                          />
                        </ColorTooltip>
                      ))}
                    </div>
                  </div>

                  <div className="max-w-xl border-t border-primary/10 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSeasonInfo((open) => !open)}
                      aria-expanded={showSeasonInfo}
                      className="w-full flex justify-between items-center py-3 text-left"
                    >
                      <span className="text-xs font-bold text-gray-800">What does this mean?</span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${showSeasonInfo ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      aria-hidden={!showSeasonInfo}
                      className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none ${showSeasonInfo ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-gray-600 text-sm leading-relaxed pb-2">
                          {currentSeasonData.desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  {skinHex && (
                    <div className="mt-6 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-[24px] border border-white shadow-sm flex items-center gap-4 w-full max-w-md">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-inner border-2 border-white/50 relative z-10" style={{ backgroundColor: skinHex }} />
                        <div className="absolute inset-0 rounded-full blur-[12px] opacity-50 -z-10" style={{ backgroundColor: skinHex }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider sm:tracking-widest">Raw facial skin shade</p>
                        <ColorTooltip hex={skinHex} name={getSkinToneName(skinHex)} className="mt-0.5">
                          <p className="font-bold text-primary text-lg leading-tight">{getSkinToneName(skinHex)}</p>
                        </ColorTooltip>
                      </div>
                    </div>
                  )}

                  <div className="pt-8 mt-auto">
                    <button 
                      onClick={() => navigate("/catalog?view=safe")}
                      className="w-full py-4 bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-full font-bold flex items-center justify-center gap-2 shadow-md transition-all duration-300 group"
                    >
                      Shop Curated Products <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ) : (
                
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 z-10">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full flex items-center justify-center mx-auto shadow-inner border border-gray-200 relative">
                    <Lock size={32} className="text-gray-400" />
                    <div className="absolute inset-0 rounded-full border border-gray-300 animate-ping opacity-20" />
                  </div>
                  <div>
                    <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-[#111827] italic mb-3">
                      Profile Locked
                    </h2>
                    <p className="text-gray-600 max-w-sm mx-auto leading-relaxed text-sm">
                      You haven't completed your color analysis yet. Upload a portrait on the left to map your facial features and unlock your seasonal palette.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <section className={`space-y-6 pt-8 transition-all duration-1000 delay-500 transform ${animateIn ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h3 className="font-heading font-semibold text-xl sm:text-2xl text-[#111827]">Discover Other Palettes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <PaletteCard
              name="Cool Winter"
              desc="Focuses on pure cool undertones without the deep intensity."
              color="bg-gradient-to-br from-[#1E293B] to-[#0F172A]"
            />
            <PaletteCard
              name="Deep Autumn"
              desc="Shares depth but leans towards warm, golden-based intensities."
              color="bg-gradient-to-br from-[#2D1B4D] to-[#120826]"
            />
            <PaletteCard
              name="Bright Spring"
              desc="Prioritizes clarity and high-chroma brilliance with warm undertones."
              color="bg-gradient-to-br from-[#FF9A3C] to-[#F72585]"
            />
          </div>
        </section>
      </section>

      {photoError && (
        <PhotoErrorModal
          error={PHOTO_ERRORS[photoError] || PHOTO_ERRORS.unknown}
          onClose={closePhotoError}
          onRetry={retryPhoto}
        />
      )}

      {guidelinesFor && (
        <PhotoGuidelinesModal
          mode={guidelinesFor}
          cameraWord={cameraWord}
          onClose={closeGuidelines}
          onContinue={continueFromGuidelines}
        />
      )}
    </main>
  );
}

// Shared by both pop-ups: Escape closes, the page behind does not scroll, focus moves to the main button and back
// to whatever opened the pop-up when it closes.
// Runs once per opening: the latest onClose is read from a ref, so a parent re-render does not move focus again.
function useModalBehavior(onClose, initialFocusRef) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    initialFocusRef.current?.focus();
    function handleKeyDown(e) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [initialFocusRef]);
}

// The modal's frame: header (fixed), the tips (scroll on short screens), and the buttons (fixed). Widths are set per
// modal in rem steps (this theme's max-w-lg is 1024px, see --container-lg in variables.css).
const MODAL_FRAME = "modal flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0";

// The guidelines pop-up shows the 6 tips as 3 slides of 2 (revision after the dermatologist session).
const GUIDELINE_SLIDES = [
  { title: "Lighting", tips: ["Well-lit space", "No harsh light"] },
  { title: "Your face", tips: ["Bare face", "Face fully visible"] },
  { title: "Taking the photo", tips: ["Look straight ahead", "Sharp photo"] },
].map((slide) => ({ ...slide, tips: slide.tips.map((title) => PHOTO_GUIDELINES.find((tip) => tip.title === title)) }));

const SWIPE_PX = 60; // a horizontal drag this long changes the slide

function ModalCloseButton({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:text-primary hover:bg-gray-50 transition-all"
    >
      <X size={18} />
    </button>
  );
}

// All 6 tips at once (the failed-upload pop-up), fading in one after another, the fix for the error highlighted.
function GuidelinesList({ highlight = [] }) {
  const reduceMotion = useReducedMotion();
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
      {PHOTO_GUIDELINES.map(({ icon: Icon, title, detail }, i) => (
        <motion.li
          key={title}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 + i * 0.05 }}
        >
          <ChecklistItem icon={<Icon size={18} />} text={title} detail={detail} highlighted={highlight.includes(title)} />
        </motion.li>
      ))}
    </ul>
  );
}

const slideVariants = {
  enter: ({ direction, reduceMotion }) => ({ x: reduceMotion ? 0 : direction * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: ({ direction, reduceMotion }) => ({ x: reduceMotion ? 0 : direction * -48, opacity: 0 }),
};

// One slide's content: "1 of 3 · Lighting" and its 2 tips. `animate` fades the tips in one after the other.
function SlideBody({ slide, index, animate = false }) {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
        {index + 1} of {GUIDELINE_SLIDES.length} · {slide.title}
      </p>
      <ul className="mt-3 space-y-3">
        {slide.tips.map(({ icon: Icon, title, detail }, i) => (
          <motion.li
            key={title}
            initial={animate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 + i * 0.12 }}
            className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-primary-lightest/50 p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-[#111827]">{title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-gray-600">{detail}</span>
            </span>
          </motion.li>
        ))}
      </ul>
    </>
  );
}

// Before every upload: the 6 tips as 3 slides of 2. Next / Back, the dots, a sideways swipe, or the arrow keys move
// between slides; the last slide continues to the upload (or the camera).
function PhotoGuidelinesModal({ mode, cameraWord, onClose, onContinue }) {
  const primaryRef = useRef(null);
  useModalBehavior(onClose, primaryRef);
  const reduceMotion = useReducedMotion();
  const [[index, direction], setSlide] = useState([0, 1]);
  const slide = GUIDELINE_SLIDES[index];
  const isLast = index === GUIDELINE_SLIDES.length - 1;
  const continueLabel = mode === "upload" ? "Got it, upload photo" : mode === "camera" ? `Got it, open ${cameraWord}` : "Got it";

  const goTo = useCallback((next) => {
    setSlide(([current]) => {
      const target = Math.max(0, Math.min(GUIDELINE_SLIDES.length - 1, next));
      return target === current ? [current, 1] : [target, target > current ? 1 : -1];
    });
  }, []);

  // Left / right arrow keys change the slide (Escape is handled by useModalBehavior).
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goTo, index]);

  return (
    <div className="modal-backdrop p-4 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-guidelines-title"
        aria-describedby="photo-guidelines-intro"
        className={`${MODAL_FRAME} max-w-112`}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClose={onClose} />
        <div className="shrink-0 px-6 pt-6 pb-3 sm:px-8 sm:pt-8">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-lighter text-primary">
            <Camera size={20} strokeWidth={2.25} />
          </div>
          <h3 id="photo-guidelines-title" className="pr-8 font-heading text-lg sm:text-xl font-semibold text-[#111827]">
            Before you take your photo
          </h3>
          <p id="photo-guidelines-intro" className="mt-1 text-sm text-gray-600 leading-relaxed">
            {PHOTO_GUIDELINES.length} quick tips for an accurate color result.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pb-2 sm:px-8">
          {/* One slide at a time; min-height keeps the pop-up the same size on every slide. */}
          {/* All 3 slides sit invisibly in the same grid cell, so the area is as tall as the tallest slide at any width
              and the pop-up keeps one height; the visible, animated slide is drawn on top of them. */}
          <div className="grid">
            {GUIDELINE_SLIDES.map((s, i) => (
              <div key={s.title} aria-hidden="true" className="invisible col-start-1 row-start-1">
                <SlideBody slide={s} index={i} />
              </div>
            ))}
            <div aria-live="polite" className="col-start-1 row-start-1">
              <AnimatePresence mode="wait" initial={false} custom={{ direction, reduceMotion }}>
                <motion.section
                  key={index}
                  aria-label={`Tips ${index + 1} of ${GUIDELINE_SLIDES.length}: ${slide.title}`}
                  custom={{ direction, reduceMotion }}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: "easeOut" }}
                  drag={reduceMotion ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -SWIPE_PX) goTo(index + 1);
                    else if (info.offset.x > SWIPE_PX) goTo(index - 1);
                  }}
                  className="touch-pan-y select-none"
                >
                  <SlideBody slide={slide} index={index} animate={!reduceMotion} />
                </motion.section>
              </AnimatePresence>
            </div>
          </div>

          {/* Progress dots: tap one to jump to that slide. */}
          <div className="flex justify-center gap-1 py-3" role="group" aria-label="Tips">
            {GUIDELINE_SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show tips ${i + 1} of ${GUIDELINE_SLIDES.length}: ${s.title}`}
                aria-current={i === index ? "step" : undefined}
                className="flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-300 motion-reduce:transition-none ${
                    i === index ? "w-6 bg-primary" : "w-2 bg-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Fixed button height (fits a two-line label such as "Got it, upload photo" on a phone), so the pop-up
            keeps one height on every slide. */}
        <div className="flex shrink-0 gap-3 border-t border-gray-100 px-6 py-4 sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={index === 0 ? onClose : () => goTo(index - 1)}
            className="min-h-13 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm leading-tight font-bold text-gray-600 transition hover:bg-gray-50"
          >
            {index > 0 ? "Back" : mode === "info" ? "Close" : "Cancel"}
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={isLast ? onContinue : () => goTo(index + 1)}
            className="flex min-h-13 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm leading-tight font-bold text-white transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {isLast ? continueLabel : (
              <>
                Next <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoErrorModal({ error, onClose, onRetry }) {
  const primaryRef = useRef(null);
  useModalBehavior(onClose, primaryRef);

  return (
    <div className="modal-backdrop p-4 sm:p-6" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="photo-error-title"
        aria-describedby="photo-error-message"
        className={`${MODAL_FRAME} max-w-160`}
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClose={onClose} />
        <div className="shrink-0 px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <h3 id="photo-error-title" className="pr-8 font-heading text-lg sm:text-xl font-semibold text-[#111827]">
            {error.title}
          </h3>
          <p id="photo-error-message" className="mt-1 text-sm text-gray-600 leading-relaxed">
            {error.message}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 sm:px-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
            Photo guidelines
          </p>
          <GuidelinesList highlight={error.tips} />
        </div>
        <div className="flex shrink-0 gap-3 border-t border-gray-100 px-6 py-4 sm:px-8 sm:py-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
          >
            Close
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Try Another Photo
          </button>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ icon, text, detail, highlighted = false }) {
  return (
    <div
      className={`h-full px-4 py-3 rounded-xl flex items-center gap-3 sm:gap-4 border shadow-sm ${
        highlighted ? "bg-primary-lightest border-primary" : "bg-white/50 border-gray-100"
      }`}
    >
      <div className="text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#111827]">
          {text}
          {highlighted && (
            <span className="ml-2 inline-block rounded-full bg-primary px-2 py-px align-middle text-[10px] font-bold uppercase tracking-wider text-white">
              Try this
            </span>
          )}
        </p>
        {detail && <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

function PaletteCard({ name, desc, color }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[24px] border border-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
      <div className="flex items-center gap-4 mb-3">
        <div className={`w-12 h-12 rounded-full ${color} shadow-inner border border-white/20`} />
        <h4 className="font-semibold text-lg text-[#111827] group-hover:text-primary transition-colors">
          {name}
        </h4>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
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