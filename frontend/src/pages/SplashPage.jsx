import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  FlaskConical,
  LayoutGrid,
  Palette,
  Percent,
  Play,
  ScanFace,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  SwatchBook,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";
import { ScrollToTopButton } from "../components/common/ScrollToTopButton.jsx";
import splashFrame1 from "../assets/splash-animation/splash-animation-1.jpg";
import splashFrame2 from "../assets/splash-animation/splash-animation-2.jpg";
import splashFrame3 from "../assets/splash-animation/splash-animation-3.jpg";
import splashFrame4 from "../assets/splash-animation/splash-animation-4.jpg";
import splashFrame5 from "../assets/splash-animation/splash-animation-5.jpg";
import chroText from "../assets/logos/chro-text.svg";
import clinicalIntegrityImg from "../assets/images/clinical-integrity-img.png";
import aiPersonalizationImg from "../assets/images/ai-personalization-img.png";
import ingredientAnalysisImg from "../assets/images/ingredient-analysis-img.png";
import tryOn1Img from "../assets/images/tryon-1.png";
import tryOn2Img from "../assets/images/tryon-2.png";
import tryOn3Img from "../assets/images/tryon-3.png";
import chromaHomeImg from "../assets/images/chroma-home-img.png";
import { getColorName } from "../utils/colorNames";

// Hero background stills, crossfaded in a loop (last frame fades back into the first).
const splashFrames = [
  splashFrame1,
  splashFrame2,
  splashFrame3,
  splashFrame4,
  splashFrame5,
];
const SPLASH_FRAME_INTERVAL_MS = 3500;
const SPLASH_FADE_SECONDS = 1.5;

// ── Scroll reveal ──
// Content animates in when it scrolls into view and back out when it leaves, drifting in the
// direction it exits: up when it leaves through the top, down when it leaves through the bottom.
// States: "below" (off-screen under the viewport), "above" (scrolled past), "visible".
const REVEAL_EXIT = { duration: 0.35, ease: "easeIn" };

const revealContainer = {
  below: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  above: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  visible: { transition: { staggerChildren: 0.15 } },
};

const revealItem = (reduceMotion) => ({
  below: { opacity: 0, y: reduceMotion ? 0 : 40, transition: REVEAL_EXIT },
  above: { opacity: 0, y: reduceMotion ? 0 : -40, transition: REVEAL_EXIT },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
});

// Feature cards: land left-to-right, each icon popping in just after its card. The longer
// delay only applies to the first reveal (so they arrive after the hero intro on load);
// `custom` is how many times the grid has left the viewport.
const featureCardGrid = {
  below: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  above: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  visible: (timesLeft) => ({
    transition: {
      delayChildren: timesLeft === 0 ? 0.6 : 0.1,
      staggerChildren: 0.15,
    },
  }),
};

const featureCardRise = (reduceMotion) => ({
  below: reduceMotion
    ? { opacity: 0, transition: REVEAL_EXIT }
    : { opacity: 0, y: 60, scale: 0.92, transition: REVEAL_EXIT },
  above: reduceMotion
    ? { opacity: 0, transition: REVEAL_EXIT }
    : { opacity: 0, y: -60, scale: 0.92, transition: REVEAL_EXIT },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: reduceMotion
      ? { duration: 0.4 }
      : { type: "spring", stiffness: 120, damping: 18 },
  },
});

const featureIconPop = (reduceMotion) => {
  const hidden = reduceMotion
    ? { opacity: 0, transition: REVEAL_EXIT }
    : { opacity: 0, scale: 0.6, rotate: -8, transition: REVEAL_EXIT };
  return {
    below: hidden,
    above: hidden,
    visible: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: reduceMotion
        ? { duration: 0.4 }
        : { type: "spring", stiffness: 200, damping: 14, delay: 0.2 },
    },
  };
};

/* Drives the reveal states for its children. The wrapper itself never moves (only its
   children do), so its viewport intersection stays stable mid-animation. */
function Reveal({ variants = revealContainer, amount = 0.25, children, ...rest }) {
  const [state, setState] = useState("below");
  const [timesLeft, setTimesLeft] = useState(0);
  return (
    <motion.div
      initial="below"
      animate={state}
      variants={variants}
      custom={timesLeft}
      viewport={{ amount }}
      onViewportEnter={() => setState("visible")}
      onViewportLeave={(entry) => {
        setState(entry && entry.boundingClientRect.top < 0 ? "above" : "below");
        setTimesLeft((n) => n + 1);
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ── Section background texture ──
// Fine purple grain (an inline SVG noise tile, no image download) plus a soft dot grid that
// fades out from one edge. Decorative only; sections using it need `relative isolate`.
const GRAIN_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.43 0 0 0 0 0.31 0 0 0 0 0.78 0 0 0 0.6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const DOT_MASKS = {
  top: "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
  bottom: "radial-gradient(ellipse 80% 60% at 50% 100%, black, transparent 75%)",
  left: "radial-gradient(ellipse 60% 80% at 0% 50%, black, transparent 75%)",
  right: "radial-gradient(ellipse 60% 80% at 100% 50%, black, transparent 75%)",
};

function SectionTexture({ dots = "top" }) {
  const mask = DOT_MASKS[dots];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0 opacity-35 mix-blend-multiply"
        style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: "180px 180px" }}
      />
      {mask && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in srgb, var(--color-primary) 22%, transparent) 1px, transparent 1.5px)",
            backgroundSize: "22px 22px",
            WebkitMaskImage: mask,
            maskImage: mask,
          }}
        />
      )}
    </div>
  );
}

// ── Decorative butterfly ──
// The Chromascope logo butterfly, using the shapes and colors of assets/logos/chro-logo-animate.svg
// (inlined so each side's wings can flap from the center line). The head piece stays still,
// the whole butterfly drifts and tilts gently, and everything holds still for reduced motion.
function Butterfly({ className = "", flapSeconds = 1.6, driftSeconds = 6, reduceMotion }) {
  const flap = reduceMotion ? undefined : { scaleX: [1, 0.3, 1] };
  const flapTransition = { duration: flapSeconds, repeat: Infinity, ease: "easeInOut" };

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute -z-10 ${className}`}>
      <motion.svg
        viewBox="0 0 990 990"
        fill="none"
        className="h-auto w-full"
        animate={reduceMotion ? undefined : { y: [0, -12, 0], rotate: [-5, 4, -5] }}
        transition={{ duration: driftSeconds, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Left wings */}
        <motion.g style={{ originX: 1, originY: 0.5 }} animate={flap} transition={flapTransition}>
          <path
            d="M58.631 147.78C56.0606 100.021 105.912 67.202 148.766 88.4404L431.163 228.397C451.229 238.342 464.438 258.266 465.785 280.621L487.405 639.467L115.939 504.691C92.3787 496.142 76.2066 474.342 74.8596 449.315L58.631 147.78Z"
            fill="#BEAEEE"
          />
          <path
            opacity="0.78"
            d="M165.605 868.562C168.755 915.456 220.605 942.212 260.65 917.61L463.607 792.924C483.253 780.854 494.655 758.944 493.268 735.928L476.856 463.705L187.247 601.318C164.089 612.322 150.004 636.358 151.723 661.94L165.605 868.562Z"
            fill="#8672BE"
          />
        </motion.g>
        {/* Right wings */}
        <motion.g style={{ originX: 0, originY: 0.5 }} animate={flap} transition={flapTransition}>
          <path
            d="M931.408 147.841C933.979 100.069 884.102 67.2489 841.246 88.5143L559.302 228.417C539.25 238.367 526.053 258.284 524.707 280.628L503.086 639.495L874.124 504.7C897.672 496.145 913.833 474.351 915.179 449.334L931.408 147.841Z"
            fill="#BEAEEE"
          />
          <path
            opacity="0.78"
            d="M825.009 868.857C821.858 915.751 770.009 942.507 729.963 917.905L527.007 793.219C507.36 781.149 495.958 759.239 497.345 736.223L513.757 464L803.366 601.613C826.524 612.617 840.609 636.653 838.89 662.235L825.009 868.857Z"
            fill="#8672BE"
          />
        </motion.g>
        {/* Head piece */}
        <path
          d="M328.142 51.4541L450.397 187.293C475.217 214.871 518.459 214.871 543.279 187.293L665.534 51.4541C628.046 92.0662 531.202 176.414 496.838 176.414C464.252 176.414 371.878 94.1488 328.142 51.4541Z"
          fill="#C3B0FA"
        />
      </motion.svg>
    </div>
  );
}

const heroFeatures = [
  {
    title: "Clinical Integrity",
    description:
      "Dermatologist-vetted algorithms ensuring safe and efficacious results.",
    image: clinicalIntegrityImg,
  },
  {
    title: "AI Personalization",
    description:
      "Generative beauty regimens tailored to your skin's unique genetic markers.",
    image: aiPersonalizationImg,
  },
  {
    title: "Ingredient Analysis",
    description:
      "Deep-scan imaging identifying ingredient interactions at a cellular level.",
    image: ingredientAnalysisImg,
  },
];

// The 12-season palette, grouped as it reads on screen: Winter/Spring on top, Autumn/Summer below.
// Each group of 3 swatches shares a hover state that reveals its season name.
const seasonGroups = [
  { season: "Winter", colors: ["#362781", "#005F73", "#C80678"] },
  { season: "Spring", colors: ["#E6334B", "#FFB813", "#F2E9AA"] },
  { season: "Autumn", colors: ["#35450E", "#983A08", "#D0B116"] },
  { season: "Summer", colors: ["#E1B0C5", "#1F8CAB", "#82CADD"] },
];

// "See it in action" showcase: one tab per feature, each with an app screenshot and a floating badge.
const SHOWCASE_INTERVAL_MS = 5000;

const tryOnSlides = [
  {
    id: "tryon",
    title: "Virtual Try-On",
    icon: Sparkles,
    image: tryOn1Img,
    alt: "Chromascope try-on screen with lipstick and blush shades applied live on a face, next to recommended shades",
    badge: { icon: ScanFace, text: "Real-time AR" },
    caption:
      "The virtual try-on lets you simulate shades and makeup on your own face in real time.",
  },
  {
    id: "safety",
    title: "Safety Filter",
    icon: ShieldCheck,
    image: tryOn2Img,
    alt: "Product details showing a Safe verdict, the shades that fit, and the full ingredient list",
    badge: { icon: ShieldCheck, text: "Safe for your skin", tone: "success" },
    caption:
      "The safety filter checks each product's ingredients against your skin profile and what you want to avoid.",
  },
  {
    id: "catalog",
    title: "Smart Catalog",
    icon: LayoutGrid,
    image: tryOn3Img,
    alt: "Catalog of products compatible with a Deep Winter season, each with a Safe badge and a match percentage",
    badge: { icon: Percent, text: "86% match" },
    caption:
      "The catalog shows products that are safe for your skin and match your season's colors.",
  },
];

// Every season color in one row, used as the "spectrum" accent line on the new sections.
const spectrumGradient = `linear-gradient(90deg, ${seasonGroups
  .flatMap((group) => group.colors)
  .join(", ")})`;

// ── Problem statement ──
const problemPoints = [
  {
    icon: Palette,
    title: "Shades that don't match",
    description:
      "Most people pick makeup by guesswork. Shades that clash with their undertone get used once and left in a drawer.",
    accent: "from-[#E6334B] to-[#FFB813]",
  },
  {
    icon: TriangleAlert,
    title: "Hidden ingredient risks",
    description:
      "Long, technical labels make it hard to spot irritants and allergens until the skin has already reacted.",
    accent: "from-[#C80678] to-[#362781]",
  },
  {
    icon: ShoppingBag,
    title: "No way to try before buying",
    description:
      "Shared testers raise hygiene concerns and online shopping offers no try-on, so every purchase is a gamble.",
    accent: "from-[#1F8CAB] to-[#82CADD]",
  },
];

// UN Sustainable Development Goals the project supports, in their official goal colors.
const sdgGoals = [
  {
    number: 3,
    title: "Good Health and Well-being",
    description:
      "Flags ingredients that clash with your skin profile, so the products you choose are safer to use.",
    color: "#4C9F38",
  },
  {
    number: 9,
    title: "Industry, Innovation and Infrastructure",
    description:
      "Brings AR try-on and ingredient analysis to beauty shopping, so trying products no longer depends on shared testers in a store.",
    color: "#FD6925",
  },
  {
    number: 12,
    title: "Responsible Consumption and Production",
    description:
      "Matching shades before you buy means fewer wrong purchases and less product thrown away.",
    color: "#BF8B2E",
  },
];

// ── Benefits (the first one is the featured bento card) ──
const benefits = [
  {
    icon: ShieldCheck,
    title: "Ingredient safety you can trust",
    description:
      "Every product is checked against your skin profile and the ingredients you want to avoid.",
  },
  {
    icon: ScanFace,
    title: "Try before you buy",
    description:
      "See lipstick and blush on your own face in real time, with no shared testers.",
  },
  {
    icon: Wallet,
    title: "Spend less, waste less",
    description:
      "Fewer mismatched purchases means more money saved and less product thrown out.",
  },
  {
    icon: Users,
    title: "Made for every skin tone",
    description:
      "The 12-season framework reads undertone, contrast, and depth across all complexions.",
  },
  {
    icon: SwatchBook,
    title: "Know your season inside out",
    description:
      "Learn your subtype, your sister season for safe alternatives, and the contrast season to avoid.",
  },
];

export function SplashPage() {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);
  // Showcase autoplay pauses while hovered or focused, and while the section is off-screen.
  const [showcasePaused, setShowcasePaused] = useState(false);
  const showcaseRef = useRef(null);
  const showcaseInView = useInView(showcaseRef, { amount: 0.3 });
  // Hero background crossfade: the incoming frame fades in on top while the
  // previous one stays fully opaque underneath, so the background never dips.
  const [splashFrame, setSplashFrame] = useState({ active: 0, prev: 0 });
  const prefersReducedMotion = useReducedMotion();
  const revealItemVariants = revealItem(prefersReducedMotion);
  // Hero background parallax: drifts down at ~70% of scroll speed as the hero scrolls out.
  const heroRef = useRef(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroBgY = useTransform(heroScrollProgress, [0, 1], ["0%", "30%"]);
  // Shade over the background that builds in as the hero scrolls out, so it reads as receding.
  const heroShadeOpacity = useTransform(heroScrollProgress, [0, 0.6], [0, 1]);

  // A fresh timer per slide, so picking a tab by hand restarts the countdown.
  const showcaseAutoplay =
    !prefersReducedMotion && showcaseInView && !showcasePaused;
  useEffect(() => {
    if (!showcaseAutoplay) return;
    const timer = setTimeout(() => {
      setActiveSlide((i) => (i + 1) % tryOnSlides.length);
    }, SHOWCASE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [showcaseAutoplay, activeSlide]);

  // Arrow keys move between showcase tabs (WAI-ARIA tabs pattern).
  function handleShowcaseKeyDown(event) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (activeSlide + step + tryOnSlides.length) % tryOnSlides.length;
    setActiveSlide(next);
    document.getElementById(`showcase-tab-${tryOnSlides[next].id}`)?.focus();
  }

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setSplashFrame(({ active }) => ({
        active: (active + 1) % splashFrames.length,
        prev: active,
      }));
    }, SPLASH_FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  const activeShowcase = tryOnSlides[activeSlide];
  const BadgeIcon = activeShowcase.badge.icon;

  return (
    <main className="min-h-dvh bg-primary-lightest font-body">
      <SplashNavbar />

      <div className="relative z-10">
        {/* ── Hero ── */}
        <section
          id="home"
          ref={heroRef}
          className="relative isolate overflow-hidden"
        >
          {/* Decorative crossfading background, scoped to this section so it can't bleed into the next one.
              Opacity sits on the wrapper (not each frame) so it stays constant mid-fade. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ y: prefersReducedMotion ? 0 : heroBgY }}
          >
            {/* Entrance on page load: fades in and settles from a slight zoom. */}
            <motion.div
              className="absolute inset-0"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            >
              {splashFrames.map((src, i) => {
                const isActive = i === splashFrame.active;
                const isPrev = i === splashFrame.prev && !isActive;
                return (
                  <motion.img
                    key={src}
                    src={src}
                    alt=""
                    decoding="async"
                    loading={i === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ zIndex: isActive ? 2 : isPrev ? 1 : 0 }}
                    initial={false}
                    animate={{ opacity: isActive || isPrev ? 1 : 0 }}
                    transition={{ duration: isActive ? SPLASH_FADE_SECONDS : 0 }}
                  />
                );
              })}
            </motion.div>
          </motion.div>

          {/* Scroll-linked depth shade: vignette plus soft top/bottom shadow, fixed to the section. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: prefersReducedMotion ? 0 : heroShadeOpacity,
              background:
                "radial-gradient(ellipse at center, transparent 40%, rgba(18,18,18,0.18) 100%), " +
                "linear-gradient(to bottom, rgba(18,18,18,0.12), transparent 25%, transparent 70%, rgba(18,18,18,0.15))",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-24 text-center sm:px-8 sm:pt-32 sm:pb-44 lg:px-12 lg:pt-40 lg:pb-48">
            <Reveal className="mx-auto flex max-w-4xl flex-col items-center">
              <motion.h1
                variants={revealItemVariants}
                className="relative w-60 sm:w-80 lg:w-[28rem]"
              >
                <img
                  src={chroText}
                  alt="Chromascope"
                  className="block h-auto w-full"
                />
                {/* Shimmer: a white highlight sweeping across, masked to the logo's letter shapes. */}
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 [background-size:200%_100%]"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, transparent 42%, rgba(255,255,255,0.9) 50%, transparent 58%)",
                    WebkitMaskImage: `url(${chroText})`,
                    maskImage: `url(${chroText})`,
                    WebkitMaskSize: "100% 100%",
                    maskSize: "100% 100%",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                  }}
                  animate={{ backgroundPositionX: ["150%", "-50%"] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </motion.h1>
              <motion.p
                variants={revealItemVariants}
                className="mt-3 max-w-2xl text-lg font-medium leading-relaxed text-gray sm:text-1g"
              >
                unlock the biological data beneath your surface.
              </motion.p>
              <motion.div variants={revealItemVariants} className="mt-8">
                <motion.button
                  onClick={() => navigate("/auth")}
                  animate={{
                    boxShadow: [
                      "0 0 50px 6px rgba(109,78,198,0.15)",
                      "0 0 90px 16px rgba(109,78,198,0.32)",
                      "0 0 50px 6px rgba(109,78,198,0.15)",
                    ],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    backgroundImage:
                      "linear-gradient(120deg, var(--color-secondary) 0%, var(--color-primary-darker) 100%)",
                  }}
                  className="group relative flex h-14 items-center justify-center gap-2 rounded-full px-6 font-bold text-white transition-transform hover:-translate-y-1 overflow-hidden sm:px-10"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <span className="relative z-10 whitespace-nowrap uppercase tracking-wide text-xs sm:tracking-widest sm:text-sm">
                    Start Your Analysis
                  </span>
                  <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </motion.div>
            </Reveal>
          </div>
        </section>

        {/* ── Get to know your palette ── */}
        <section className="relative isolate bg-primary-lighter pb-20 pt-8 sm:pt-56 lg:pt-64">
          <SectionTexture dots="right" />
          {/* Feature cards float on the seam between the hero above and this section — centered on
              the boundary via translateY(-50%) so half sits in each section, whatever their height. */}
          <div className="relative z-20 mx-auto max-w-5xl px-4 sm:absolute sm:inset-x-0 sm:top-0 sm:-translate-y-1/2 sm:px-8 lg:px-12">
            <Reveal
              id="features"
              variants={featureCardGrid}
              className="grid gap-5 pb-8 sm:grid-cols-3 sm:pb-0"
            >
              {heroFeatures.map((feature) => (
                <motion.article
                  key={feature.title}
                  variants={featureCardRise(prefersReducedMotion)}
                  // Hover lift lives in framer (not a Tailwind translate class) since framer owns this element's transform.
                  whileHover={{ y: -6 }}
                  className="group relative flex flex-col items-center rounded-lg border border-white/60 bg-gradient-to-br from-white/55 to-white/20 p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_32px_color-mix(in_srgb,var(--color-primary)_12%,transparent)] backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] duration-300 hover:border-white/80 hover:bg-white/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_40px_color-mix(in_srgb,var(--color-primary)_25%,transparent)]"
                >
                  {/* Outer wrapper takes framer's entrance pop; inner keeps the CSS hover tilt so they don't fight over transform. */}
                  <motion.div
                    variants={featureIconPop(prefersReducedMotion)}
                    className="mb-2 h-20 w-20 sm:h-24 sm:w-24"
                  >
                    <div className="h-full w-full transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                      <img
                        src={feature.image}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </motion.div>
                  <h3 className="font-heading text-sm font-semibold text-black">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray">
                    {feature.description}
                  </p>
                </motion.article>
              ))}
            </Reveal>
          </div>

          <Reveal className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 sm:px-8 lg:flex-row lg:px-12">
            <motion.div
              variants={revealItemVariants}
              className="flex-1 space-y-6 text-center lg:text-left"
            >
              <div>
                <h2 className="font-heading text-4xl font-semibold tracking-tight text-black sm:text-5xl">
                  Get to know your palette!
                </h2>
                <p className="mt-1 font-body text-xl italic text-gray">
                  Your palette isn't just a color
                </p>
              </div>
              <p className="text-lg leading-relaxed text-gray">
                AI maps your undertone, contrast, and depth to place you within
                the 12-season framework, then goes further: pinpointing your
                exact subtype, its sister season for safe alternatives, and its
                contrast season to know what to avoid.
              </p>
              <a
                href="https://feelgoodcolors.com/seasonal-color-analysis/12-seasonal-color-system/"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 bg-transparent font-body text-lg font-medium !text-primary no-underline transition-all duration-200 hover:scale-[1.03] hover:!text-primary-dark"
              >
                Read more about 12 Seasons
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </a>
            </motion.div>

            <motion.div
              variants={revealItemVariants}
              className="grid w-full grid-cols-2 gap-1 overflow-hidden rounded-2xl shadow-lg lg:w-auto lg:flex-1"
            >
              {seasonGroups.map((group) => (
                <div
                  key={group.season}
                  className="group relative grid grid-cols-3 gap-1"
                >
                  {group.colors.map((hex, i) => (
                    <div
                      key={`${hex}-${i}`}
                      className="aspect-2/5 transition-transform duration-300 group-hover:scale-[1.03]"
                      style={{ backgroundColor: hex }}
                      role="img"
                      aria-label={`${group.season} palette color ${getColorName(hex)}`}
                      title={getColorName(hex)}
                    />
                  ))}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/25 group-hover:opacity-100"
                  >
                    <span className="font-heading text-2xl italic tracking-wide text-white drop-shadow-md sm:text-3xl">
                      {group.season.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </section>

        {/* ── Virtual Try-on and Safety Filter ── */}
        <section className="relative isolate overflow-hidden bg-primary-lightest py-20 sm:py-24">
          <SectionTexture dots="top" />
          <Reveal className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
            <motion.div
              variants={revealItemVariants}
              className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center"
            >
              <h2 className="font-heading text-4xl font-semibold tracking-tight text-black sm:text-5xl">
                <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Virtual Try-On
                </span>{" "}
                and a{" "}
                <span className="bg-linear-to-r from-secondary to-primary-dark bg-clip-text text-transparent">
                  Safety Filter
                </span>
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray">
                Try shades on your face, then shop only what&apos;s safe for your skin.
              </p>
            </motion.div>

            <motion.div
              ref={showcaseRef}
              variants={revealItemVariants}
              onMouseEnter={() => setShowcasePaused(true)}
              onMouseLeave={() => setShowcasePaused(false)}
              onFocus={() => setShowcasePaused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setShowcasePaused(false);
                }
              }}
              className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14"
            >
              {/* Feature tabs: three equal columns on phones and tablets, a stack of cards on desktop. */}
              <div
                role="tablist"
                aria-label="Chromascope features"
                onKeyDown={handleShowcaseKeyDown}
                className="mx-auto grid w-full max-w-xl grid-cols-3 gap-2 lg:flex lg:max-w-none lg:flex-col lg:gap-3"
              >
                {tryOnSlides.map((slide, i) => {
                  const isActive = i === activeSlide;
                  const Icon = slide.icon;
                  return (
                    <button
                      key={slide.id}
                      id={`showcase-tab-${slide.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls="showcase-panel"
                      aria-labelledby={`showcase-title-${slide.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setActiveSlide(i)}
                      className={`relative rounded-2xl px-2 py-3 text-center transition-colors duration-300 lg:p-5 lg:text-left ${
                        isActive ? "text-black" : "text-gray hover:bg-white/50"
                      }`}
                    >
                      {/* The white card slides between tabs instead of blinking on and off. */}
                      {isActive && (
                        <motion.span
                          layoutId="showcase-active-tab"
                          aria-hidden="true"
                          className="absolute inset-0 rounded-2xl border border-white bg-white shadow-[0_12px_40px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                          transition={
                            prefersReducedMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 300, damping: 30 }
                          }
                        />
                      )}
                      <span className="relative flex flex-col items-center gap-1.5 lg:flex-row lg:gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 lg:h-10 lg:w-10 ${
                            isActive
                              ? "bg-primary text-white shadow-md shadow-primary/30"
                              : "bg-primary-lighter text-primary"
                          }`}
                        >
                          <Icon className="h-4 w-4 lg:h-5 lg:w-5" aria-hidden="true" />
                        </span>
                        <span
                          id={`showcase-title-${slide.id}`}
                          className="whitespace-nowrap font-heading text-xs font-semibold sm:text-sm lg:text-lg"
                        >
                          {slide.title}
                        </span>
                      </span>
                      {/* Desktop: the active tab opens to show its caption and a countdown to the next slide. */}
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.span
                            key="details"
                            className="relative hidden overflow-hidden lg:block"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: prefersReducedMotion ? 0 : 0.35,
                              ease: "easeOut",
                            }}
                          >
                            <span className="block pl-13 pt-2 text-base leading-relaxed text-gray">
                              {slide.caption}
                            </span>
                            <span className="ml-13 mt-4 block h-1 overflow-hidden rounded-full bg-primary-lighter">
                              <motion.span
                                key={`${activeSlide}-${showcaseAutoplay}`}
                                className="block h-full origin-left rounded-full bg-linear-to-r from-secondary to-primary"
                                initial={{ scaleX: showcaseAutoplay ? 0 : 1 }}
                                animate={{ scaleX: 1 }}
                                transition={{
                                  duration: showcaseAutoplay ? SHOWCASE_INTERVAL_MS / 1000 : 0,
                                  ease: "linear",
                                }}
                              />
                            </span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                {/* Soft color blobs drifting behind the app window. */}
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-10 -top-12 h-56 w-56 rounded-full bg-primary-light/50 blur-3xl sm:h-72 sm:w-72"
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }
                  }
                  transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-14 -right-8 h-60 w-60 rounded-full bg-secondary/40 blur-3xl sm:h-80 sm:w-80"
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { x: [0, -25, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }
                  }
                  transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* App window frame around the screenshot. */}
                <div className="relative rounded-3xl border border-white/70 bg-white/60 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_30px_80px_color-mix(in_srgb,var(--color-primary)_25%,transparent)] backdrop-blur-xl sm:p-3">
                  <div
                    aria-hidden="true"
                    className="flex items-center gap-1.5 px-2 pb-2 sm:px-3 sm:pb-3"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-light" />
                    <span className="h-2.5 w-2.5 rounded-full bg-secondary-light" />
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-lighter" />
                    <span className="ml-3 rounded-full bg-primary-lightest px-3 py-0.5 text-[11px] font-medium text-gray-light">
                      chromascope
                    </span>
                  </div>
                  <div
                    id="showcase-panel"
                    role="tabpanel"
                    aria-labelledby={`showcase-tab-${activeShowcase.id}`}
                    className="relative aspect-4/3 overflow-hidden rounded-2xl bg-primary-lightest"
                  >
                    <AnimatePresence initial={false}>
                      <motion.img
                        key={activeShowcase.id}
                        src={activeShowcase.image}
                        alt={activeShowcase.alt}
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover object-top"
                        initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </AnimatePresence>
                  </div>
                </div>

                {/* Floating badge for the current slide: pops in, then bobs gently. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeShowcase.id}
                    className="absolute -bottom-4 right-3 sm:-bottom-5 sm:-right-4 lg:-right-6"
                    initial={{ opacity: 0, y: 16, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.2 }
                        : { type: "spring", stiffness: 260, damping: 20, delay: 0.15 }
                    }
                  >
                    <motion.div
                      animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className="flex items-center gap-2.5 rounded-2xl border border-white/80 bg-white/90 py-2 pl-2 pr-4 shadow-[0_16px_40px_color-mix(in_srgb,var(--color-primary)_22%,transparent)] backdrop-blur-md"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                          activeShowcase.badge.tone === "success"
                            ? "bg-success/10 text-success"
                            : "bg-primary-lighter text-primary"
                        }`}
                      >
                        <BadgeIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-black">
                        {activeShowcase.badge.text}
                      </span>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Phones and tablets: the caption sits under the window (desktop shows it in the tab). */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={activeShowcase.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="mx-auto mt-2 max-w-xl text-center text-base leading-relaxed text-gray lg:hidden"
                >
                  {activeShowcase.caption}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </Reveal>
        </section>

        {/* ── Problem Statement and SDGs ── */}
        <section
          id="problem"
          className="relative isolate overflow-hidden bg-linear-to-b from-primary-lighter to-primary-lightest py-20 sm:py-28"
        >
          {/* Season spectrum along the top edge, texture, and two faint butterflies in opposite corners. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1"
            style={{ backgroundImage: spectrumGradient }}
          />
          <SectionTexture dots="left" />
          <Butterfly
            reduceMotion={prefersReducedMotion}
            className="left-2 top-8 w-20 -rotate-12 opacity-35 sm:left-8 sm:top-12 sm:w-32 lg:w-40"
          />
          <Butterfly
            reduceMotion={prefersReducedMotion}
            flapSeconds={2}
            driftSeconds={7.5}
            className="bottom-6 right-2 w-20 rotate-12 opacity-30 sm:bottom-10 sm:right-8 sm:w-32 lg:w-40"
          />

          <Reveal amount={0.15} className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
            <motion.div
              variants={revealItemVariants}
              className="mx-auto mb-12 flex max-w-3xl flex-col items-center text-center sm:mb-16"
            >
              <h2 className="font-heading text-4xl font-semibold tracking-tight text-black sm:text-5xl">
                Beauty wasn&apos;t made with{" "}
                <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                  every skin
                </span>{" "}
                in mind
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray">
                Choosing cosmetics still comes down to guesswork. The wrong shade
                wastes money, and the wrong ingredient can harm your skin.
              </p>
            </motion.div>

            <motion.div
              variants={revealContainer}
              className="grid gap-5 md:grid-cols-3"
            >
              {problemPoints.map((point, i) => {
                const Icon = point.icon;
                return (
                  <motion.article
                    key={point.title}
                    variants={revealItemVariants}
                    className="group relative overflow-hidden rounded-2xl border border-white bg-white/70 p-6 shadow-[0_8px_30px_color-mix(in_srgb,var(--color-primary)_10%,transparent)] backdrop-blur-xl transition-[box-shadow,border-color] duration-300 hover:border-primary-light/60 hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--color-primary)_20%,transparent)] sm:p-7"
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${point.accent}`}
                    />
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-lighter text-primary transition-all duration-300 group-hover:-rotate-6 group-hover:bg-primary group-hover:text-white">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span
                        aria-hidden="true"
                        className="font-heading text-4xl font-semibold leading-none text-primary-light/60"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-5 font-heading text-lg font-semibold text-black">
                      {point.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray">
                      {point.description}
                    </p>
                  </motion.article>
                );
              })}
            </motion.div>

            {/* SDGs laid out like a palette: one swatch per goal, in its official color. */}
            <motion.div variants={revealItemVariants} className="mt-16 sm:mt-20">
              <div className="mb-6 flex flex-col items-center gap-1 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
                <h3 className="font-heading text-2xl font-semibold text-black sm:text-3xl">
                  The goals we support
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-gray-light">
                  UN Sustainable Development Goals
                </p>
              </div>

              <ul className="flex flex-col gap-3 lg:h-80 lg:flex-row">
                {sdgGoals.map((goal) => (
                  <li
                    key={goal.number}
                    className="group relative isolate flex min-h-44 overflow-hidden rounded-2xl text-white shadow-[0_20px_50px_color-mix(in_srgb,var(--color-primary)_22%,transparent)] transition-[flex-grow] duration-500 ease-out lg:min-h-0 lg:flex-1 lg:hover:grow-[1.6]"
                    style={{ backgroundColor: goal.color }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 bg-linear-to-t from-black/55 via-black/15 to-transparent"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute right-3 -top-4 -z-10 font-heading text-[8rem] font-bold leading-none text-white/15 transition-transform duration-500 group-hover:-translate-x-2 group-hover:scale-105 sm:text-[10rem]"
                    >
                      {goal.number}
                    </span>
                    <div className="flex w-full flex-col justify-end p-6">
                      <span className="inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] backdrop-blur-sm">
                        SDG {goal.number}
                      </span>
                      <h4 className="mt-3 font-heading text-xl font-semibold leading-snug">
                        {goal.title}
                      </h4>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90">
                        {goal.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          </Reveal>
        </section>

        {/* ── Purpose and Benefits ── */}
        <section
          id="purpose"
          className="relative isolate overflow-hidden bg-primary-lightest py-20 sm:py-28"
        >
          <SectionTexture dots="top" />
          <Reveal amount={0.15} className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
            <motion.div
              variants={revealItemVariants}
              className="mx-auto mb-12 flex max-w-4xl flex-col items-center text-center sm:mb-16"
            >
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-black sm:text-4xl lg:text-5xl">
                Helping you choose cosmetics that{" "}
                <span className="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                  suit your colors
                </span>{" "}
                and are{" "}
                <span className="bg-linear-to-r from-secondary to-primary-dark bg-clip-text text-transparent">
                  safe for your skin
                </span>
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray">
                Chromascope brings AI color analysis, ingredient screening, and AR
                try-on together, so every beauty decision starts from your own
                profile.
              </p>
            </motion.div>

            {/* Bento: featured card spans 2x2 on desktop, full width on tablets. */}
            <motion.ul
              variants={revealContainer}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {/* Featured: one profile behind every decision. */}
              <motion.li
                variants={revealItemVariants}
                className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary to-primary-darker p-6 text-white shadow-[0_24px_60px_color-mix(in_srgb,var(--color-primary)_30%,transparent)] sm:col-span-2 sm:p-8 lg:row-span-2"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-secondary-light/30 blur-3xl"
                />
                <div className="relative flex h-full flex-col gap-8 lg:justify-between">
                  <div className="max-w-md">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                      <FlaskConical className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 font-heading text-2xl font-semibold sm:text-3xl">
                      One profile, every decision
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-white/80">
                      Your season palette and your skin profile work together, so
                      every product you see is matched to your colors and screened
                      for your skin.
                    </p>
                  </div>

                  {/* Mini preview: the season palette feeding a safe, matched result. */}
                  <div
                    aria-hidden="true"
                    className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-5"
                  >
                    <div className="flex h-10 overflow-hidden rounded-xl">
                      {seasonGroups.flatMap((group) => group.colors).map((hex, i) => (
                        <span
                          key={`${hex}-${i}`}
                          className="flex-1 transition-[flex-grow] duration-300 hover:grow-[2.5]"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-success">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Safe for your skin
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                        <Percent className="h-3.5 w-3.5" />
                        Season match
                      </span>
                    </div>
                  </div>
                </div>
              </motion.li>

              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <motion.li
                    key={benefit.title}
                    variants={revealItemVariants}
                    className="group relative overflow-hidden rounded-3xl border border-white bg-white/70 p-6 shadow-[0_8px_30px_color-mix(in_srgb,var(--color-primary)_10%,transparent)] backdrop-blur-xl transition-[box-shadow,border-color] duration-300 last:sm:col-span-2 last:lg:col-span-1 hover:border-primary-light/60 hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                      style={{ backgroundImage: spectrumGradient }}
                    />
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-lighter text-primary transition-all duration-300 group-hover:-rotate-6 group-hover:bg-primary group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-heading text-lg font-semibold text-black">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray">
                      {benefit.description}
                    </p>
                  </motion.li>
                );
              })}
            </motion.ul>
          </Reveal>
        </section>

        {/* ── How does Chromascope work? ── */}
        <section id="demo" className="relative isolate overflow-hidden bg-primary-lighter py-20">
          <SectionTexture dots="bottom" />
          <Reveal className="mx-auto max-w-5xl px-4 sm:px-8 lg:px-12">
            <motion.div variants={revealItemVariants} className="mb-10 text-center">
              <h2 className="font-heading text-4xl font-semibold tracking-tight text-black sm:text-5xl">
                How does <span className="text-primary">Chromascope</span> work?
              </h2>
              <p className="mt-4 text-lg font-medium text-gray">
                View the demonstration video here!
              </p>
            </motion.div>

            <motion.a
              href="https://youtu.be/YsNq9DVcJNE"
              target="_blank"
              rel="noopener noreferrer"
              variants={revealItemVariants}
              aria-label="Watch the Chromascope demo video on YouTube"
              className="group relative block overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(20,5,37,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(20,5,37,0.28)]"
            >
              <img
                src={chromaHomeImg}
                alt="Chromascope dashboard preview"
                className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#2E1740] via-[#2E1740]/40 to-transparent p-8 sm:p-10">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                  Chromascope Demo Video
                </p>
                <h3 className="mt-2 max-w-md font-heading text-2xl font-semibold text-white sm:text-3xl">
                  Precision Visualization of Dermal Layers
                </h3>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/15">
                <span className="flex h-16 w-16 scale-75 items-center justify-center rounded-full bg-white/90 text-primary opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </span>
              </div>
            </motion.a>
          </Reveal>
        </section>
      </div>

      <SplashFooter />
      <ScrollToTopButton targetId="home" />
    </main>
  );
}
