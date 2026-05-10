import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { motion } from "framer-motion";
import { Shield, Server, Trash2, ArrowLeft } from "lucide-react";

const dataCards = [
  {
    title: "Encrypted Storage",
    description: "AES-256 bank-level encryption standards for all visual data.",
    icon: <Shield size={24} className="text-[#7700CF]" strokeWidth={1.5} />,
  },
  {
    title: "Secure Processing",
    description:
      "On-device neural analysis ensures data never leaves your control unnecessarily.",
    icon: <Server size={24} className="text-[#7700CF]" strokeWidth={1.5} />,
  },
  {
    title: "Automatic Disposal",
    description:
      "All biometric markers are purged after 30 days of user inactivity.",
    icon: <Trash2 size={24} className="text-[#7700CF]" strokeWidth={1.5} />,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export function DataEthicsPage() {
  const navigate = useNavigate();
  const [shareWithScience, setShareWithScience] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  return (
    <main className="min-h-screen bg-[#FAF4FF] font-body relative overflow-hidden text-[#374151]">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#E5D5F5]/60 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#DBB7FF]/30 blur-[120px] pointer-events-none" />

      <SplashNavbar />

      <div className="mx-auto max-w-5xl px-6 py-32 relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.button
            variants={itemVariants}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#6800B8] hover:text-[#4A0082] transition-colors font-medium mb-8"
          >
            <ArrowLeft size={18} />
            Back
          </motion.button>

          <motion.div variants={itemVariants} className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block px-3 py-1 mb-4 text-[11px] font-bold uppercase tracking-widest text-[#7700CF] bg-[#FAEDFF] rounded-full">
              Commitment to Transparency
            </span>
            <h1 className="text-4xl sm:text-5xl font-heading font-black tracking-tight text-[#111827] mb-4">
              Data Privacy & Ethical Use
            </h1>
            <p className="text-lg leading-relaxed text-[#4B5563]">
              Review how your biological data informs our AI and how we protect
              your privacy through medical-grade encryption and ethical
              standards.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-sm border border-[#E5D5F5] max-w-4xl mx-auto">
            <div className="mb-8 border-b border-[#E5D5F5] pb-8">
              <h2 className="text-xl font-heading font-bold text-[#111827] mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#FAEDFF] text-[#7700CF] flex items-center justify-center">
                  <Shield size={16} />
                </span>
                Data Life Cycle
              </h2>

              <div className="grid gap-6 md:grid-cols-3">
                {dataCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-2xl bg-[#FAEDFF]/50 p-6 shadow-sm border border-[#F3E8FF]"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#7700CF] shadow-sm">
                      {card.icon}
                    </div>
                    <h3 className="mb-2 text-base font-semibold text-[#111827]">
                      {card.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[#4B5563]">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl p-6 border border-[#E5D5F5] shadow-sm">
                <div className="space-y-1 mb-4 sm:mb-0 pr-4">
                  <h3 className="text-base font-semibold text-[#111827]">
                    Contribute to Science (Optional)
                  </h3>
                  <p className="text-sm leading-relaxed text-[#6B7280]">
                    Allow my anonymized photos to be used for improving our
                    skin-tone AI accuracy.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShareWithScience((current) => !current)}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    shareWithScience ? "bg-[#7700CF]" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-1 ml-1 ${
                      shareWithScience ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-6 bg-[#FAEDFF]/30 rounded-2xl p-6 border border-[#E5D5F5]">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(event) => setAgreedToTerms(event.target.checked)}
                    className="peer appearance-none h-5 w-5 border border-[#D1D5DB] rounded bg-white checked:bg-[#7700CF] checked:border-[#7700CF] focus:outline-none focus:ring-2 focus:ring-[#7700CF]/20 transition-all cursor-pointer"
                  />
                  <svg
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm leading-relaxed text-[#4B5563] group-hover:text-[#374151] transition-colors">
                  I agree to the{" "}
                  <a href="#" className="font-semibold text-[#7700CF] hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="font-semibold text-[#7700CF] hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <button
                type="button"
                disabled={!agreedToTerms}
                className="w-full bg-[#7700CF] text-white py-4 rounded-full font-medium text-[15px] hover:bg-[#5C00A3] transition-all disabled:opacity-50 shadow-md"
              >
                Confirm & Complete Setup
              </button>
            </div>

            <p className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] font-semibold">
              ISO 27001 compliant system
            </p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
