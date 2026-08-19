import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";
import { ScrollToTopButton } from "../components/common/ScrollToTopButton.jsx";
import marbleBg from "../assets/images/MarbleBG.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 },
  },
};

const heroFeatures = [
  {
    title: "Clinical Integrity",
    description:
      "Dermatologist-vetted algorithms ensuring safe and efficacious results.",
    image: "/src/assets/images/clinical-integrity-img.png",
  },
  {
    title: "AI Personalization",
    description:
      "Generative beauty regimens tailored to your skin's unique genetic markers.",
    image: "/src/assets/images/ai-personalization-img.png",
  },
  {
    title: "Ingredient Analysis",
    description:
      "Deep-scan imaging identifying ingredient interactions at a cellular level.",
    image: "/src/assets/images/ingredient-analysis-img.png",
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

const tryOnSlides = [
  {
    image: "/src/assets/images/tryon-1.png",
    caption:
      "The virtual try-on lets users simulate exactly what a shade or product looks like on their own skin, in real time.",
  },
  {
    image: "/src/assets/images/tryon-2.png",
    caption:
      "The scientific filter cross-checks every product against your restrictions, flagging anything that doesn't clear your clinical profile.",
  },
  {
    image: "/src/assets/images/tryon-3.png",
    caption:
      "The product catalog stays organized by season and safety status, so recommendations always match who you actually are.",
  },
];

export function SplashPage() {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((i) => (i + 1) % tryOnSlides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[#FAF4FF] font-body">
      <SplashNavbar />

      <div className="relative z-10">
        {/* ── Hero ── */}
        <section id="home" className="relative isolate overflow-hidden">
          {/* Decorative marble background, scoped to this section so it can't bleed into the next one. */}
          <img
            src={marbleBg}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
          />

          <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-24 text-center sm:px-8 sm:pt-32 sm:pb-44 lg:px-12 lg:pt-40 lg:pb-48">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="mx-auto flex max-w-4xl flex-col items-center"
            >
              <motion.h1
                variants={fadeUp}
                className="font-heading text-6xl font-black leading-none tracking-tight sm:text-7xl lg:text-8xl"
              >
                <motion.span
                  className="bg-clip-text text-transparent [background-size:200%_100%]"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #121212 0%, #121212 42%, #ffffff 50%, #121212 58%, #121212 100%)",
                  }}
                  animate={{ backgroundPositionX: ["150%", "-50%"] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  Chromascope
                </motion.span>
              </motion.h1>
              <motion.p
                variants={fadeUp}
                className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-gray sm:text-2xl"
              >
                Unlock the biological data beneath your surface.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8">
                <motion.button
                  onClick={() => navigate("/auth")}
                  animate={{
                    boxShadow: [
                      "0 0 50px 6px rgba(119,0,207,0.15)",
                      "0 0 90px 16px rgba(119,0,207,0.32)",
                      "0 0 50px 6px rgba(119,0,207,0.15)",
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
            </motion.div>
          </div>
        </section>

        {/* ── Get to know your palette ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="relative bg-primary-light pb-20 pt-8 sm:pt-56 lg:pt-64"
        >
          {/* Feature cards float on the seam between the hero above and this section — centered on
              the boundary via translateY(-50%) so half sits in each section, whatever their height. */}
          <div className="relative z-20 mx-auto max-w-5xl px-4 sm:absolute sm:inset-x-0 sm:top-0 sm:-translate-y-1/2 sm:px-8 lg:px-12">
            <motion.div
              id="features"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid gap-5 pb-8 sm:grid-cols-3 sm:pb-0"
            >
              {heroFeatures.map((feature) => (
                <motion.article
                  key={feature.title}
                  variants={fadeUp}
                  className="group relative flex flex-col items-center rounded-lg bg-white/70 p-5 text-center shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_12px_40px_rgba(119,0,207,0.25)]"
                >
                  <div className="mb-2 h-20 w-20 transform transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 sm:h-24 sm:w-24">
                    <img
                      src={feature.image}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <h3 className="font-heading text-sm font-bold text-black">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray">
                    {feature.description}
                  </p>
                </motion.article>
              ))}
            </motion.div>
          </div>

          <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-4 sm:px-8 lg:flex-row lg:px-12">
            <motion.div
              variants={fadeUp}
              className="flex-1 space-y-6 text-center lg:text-left"
            >
              <div>
                <h2 className="font-heading text-4xl font-black tracking-tight text-black sm:text-5xl">
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
              variants={fadeUp}
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
                      aria-label={`${group.season} palette color ${hex}`}
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
          </div>
        </motion.section>

        {/* ── Virtual Try-on and Safety Filter ── */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="bg-secondary-light py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-12">
            <motion.h2
              variants={fadeUp}
              className="mb-12 text-center font-heading text-4xl font-black tracking-tight text-primary sm:text-5xl"
            >
              Virtual Try-On and a Safety Filter
            </motion.h2>

            <motion.div
              variants={fadeUp}
              className="relative left-1/2 right-1/2 mx-[-50vw] w-screen overflow-hidden py-8"
              style={{
                maskImage:
                  "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
              }}
            >
              <motion.div
                className="flex"
                animate={{ x: `${-activeSlide * 55 + 22.5}%` }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              >
                {tryOnSlides.map((slide, i) => (
                  <div key={slide.image} className="w-[55%] shrink-0 px-3">
                    <div
                      className={`overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition-all duration-500 ${
                        i === activeSlide
                          ? "scale-100 opacity-100"
                          : "scale-95 opacity-40"
                      }`}
                    >
                      <img
                        src={slide.image}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-4 text-center"
            >
              <div className="flex items-center gap-2">
                {tryOnSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    aria-label={`Show slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === activeSlide ? "w-16 bg-primary" : "w-7 bg-secondary"
                    }`}
                  />
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeSlide}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="text-lg leading-relaxed text-gray"
                >
                  {tryOnSlides[activeSlide].caption}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.section>

        {/* ── How does Chromascope work? ── */}
        <motion.section
          id="demo"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="bg-[#F8EFFF] py-20"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-8 lg:px-12">
            <motion.div variants={fadeUp} className="mb-10 text-center">
              <h2 className="font-heading text-4xl font-black tracking-tight text-black sm:text-5xl">
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
              variants={fadeUp}
              aria-label="Watch the Chromascope demo video on YouTube"
              className="group relative block overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(20,5,37,0.15)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(20,5,37,0.28)]"
            >
              <img
                src="/src/assets/images/chroma-home-img.png"
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
          </div>
        </motion.section>
      </div>

      <SplashFooter />
      <ScrollToTopButton targetId="home" />
    </main>
  );
}
