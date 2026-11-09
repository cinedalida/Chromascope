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
  LayoutGrid,
  Percent,
  Play,
  ScanFace,
  ShieldCheck,
  Sparkles,
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
        <section className="relative bg-primary-lighter pb-20 pt-8 sm:pt-56 lg:pt-64">
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
        <section className="relative overflow-hidden bg-primary-lightest py-20 sm:py-24">
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

        {/* ── How does Chromascope work? ── */}
        <section id="demo" className="bg-primary-lighter py-20">
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
