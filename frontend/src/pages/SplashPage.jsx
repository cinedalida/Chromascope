import { useNavigate } from "react-router-dom";
import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

export function SplashPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#FAF4FF] font-body relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-lightest/60 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary-light/40 blur-[120px]" />

      <SplashNavbar />

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-8 sm:pb-24 lg:px-12 relative z-10">
        <section id="home" className="mt-24 sm:mt-32 lg:mt-40 flex flex-col lg:flex-row items-center gap-10 lg:gap-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex-1 space-y-8 lg:pr-12"
          >
            <motion.div variants={fadeUp} className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary shadow-sm backdrop-blur-sm border border-white/40">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                Next-Gen Beauty Intelligence
              </span>
              <h1 className="text-5xl font-heading font-black tracking-tight text-primary sm:text-7xl leading-[1.1]">
                Chromascope
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-gray-dark sm:text-xl font-medium">
                Unlock deep personalization with AI-driven clinical mapping, cellular-level ingredient analysis, and hyper-realistic AR try-ons.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} className="flex flex-col gap-4 sm:flex-row pt-4">
              <button
                onClick={() => navigate("/auth")}
                className="group relative flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 font-bold text-white shadow-[0_8px_30px_rgb(20,5,37,0.3)] transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(20,5,37,0.4)] overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative z-10 uppercase tracking-widest text-xs">Start Your Analysis</span>
                <svg className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2, type: "spring", stiffness: 100 }}
            className="flex-1 w-full max-w-lg lg:max-w-none relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent rounded-[2.5rem] transform rotate-3 scale-105 -z-10" />
            <img
              src="/src/assets/images/splash-hero.png"
              alt="Chromascope splash hero"
              className="w-full rounded-[2.5rem] object-cover shadow-2xl border-4 border-white/50 backdrop-blur-sm"
            />
          </motion.div>
        </section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          id="features"
          className="mt-32 grid gap-8 md:grid-cols-3"
        >
          <motion.article variants={fadeUp} className="group relative bg-white/60 backdrop-blur-xl rounded-3xl p-8 shadow-sm border border-white/50 hover:bg-white transition-colors duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-lightest rounded-bl-full rounded-tr-3xl -z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md p-3 mb-6 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
              <img
                src="/src/assets/images/clinical-integrity-img.png"
                alt="Clinical integrity"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-heading font-black text-primary tracking-tight">
              Clinical Integrity
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-dark font-medium">
              Dermatologist-vetted algorithms ensure safe and highly efficacious results mapped to your skin.
            </p>
          </motion.article>

          <motion.article variants={fadeUp} className="group relative bg-white/60 backdrop-blur-xl rounded-3xl p-8 shadow-sm border border-white/50 hover:bg-white transition-colors duration-300 mt-0 md:mt-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-light/20 rounded-bl-full rounded-tr-3xl -z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md p-3 mb-6 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
              <img
                src="/src/assets/images/ai-personalization-img.png"
                alt="AI personalization"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-heading font-black text-primary tracking-tight">
              AI Personalization
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-dark font-medium">
              Generative beauty regimens tailored seamlessly to your skin’s unique genetic markers.
            </p>
          </motion.article>

          <motion.article variants={fadeUp} className="group relative bg-white/60 backdrop-blur-xl rounded-3xl p-8 shadow-sm border border-white/50 hover:bg-white transition-colors duration-300 mt-0 md:mt-16">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-light/20 rounded-bl-full rounded-tr-3xl -z-10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 rounded-2xl bg-white shadow-md p-3 mb-6 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
              <img
                src="/src/assets/images/ingredient-analysis-img.png"
                alt="Ingredient analysis"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-heading font-black text-primary tracking-tight">
              Ingredient Analysis
            </h2>
            <p className="mt-3 text-base leading-relaxed text-gray-dark font-medium">
              Deep-scan imaging identifying ingredient interactions at a true cellular level.
            </p>
          </motion.article>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          id="demo"
          className="mt-32 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 rounded-3xl -z-10" />
          <div className="text-center mb-12">
            <h2 className="text-4xl font-heading font-black tracking-tight text-primary">Experience the dashboard</h2>
            <p className="mt-4 text-gray-dark text-lg font-medium">A unified hub for your entire beauty journey.</p>
          </div>
          <div className="flex justify-center px-4 sm:px-12">
            <img
              src="/src/assets/images/chroma-home-img.png"
              alt="Chromascope home preview"
              className="w-full max-w-5xl rounded-[2rem] shadow-[0_20px_50px_rgba(20,5,37,0.15)] border-8 border-white object-cover transform hover:scale-[1.01] transition-transform duration-500"
            />
          </div>
        </motion.section>
      </div>
    </main>
  );
}
