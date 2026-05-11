import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { auth } from "../firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth";

export function AuthPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      navigate("/home");
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 m-0 flex h-screen w-screen overflow-hidden bg-[#FAF4FF] p-0 font-body [-webkit-tap-highlight-color:transparent]">
      {/* Left Side - Visual Branding (EXACT DESIGN PRESERVED) */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-1"
        style={{ background: "linear-gradient(135deg, #5A009D 0%, #9D4EDD 100%)" }}
      >
        <div className="absolute inset-0 flex items-end justify-center">
          <img src="/src/assets/logos/chro-glass-white.png" alt="Logo" className="h-auto w-[85%] object-contain opacity-20 mix-blend-overlay" />
        </div>
        
        <motion.div 
          animate={{ opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] left-[10%] rounded-full bg-white blur-[120px]" 
          style={{ width: "600px", height: "600px" }} 
        />
        <motion.div 
          animate={{ opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-[10%] right-[10%] rounded-full bg-[#E0AAFF] blur-[100px]" 
          style={{ width: "500px", height: "500px" }} 
        />

        <div className="relative z-10 flex h-full w-full flex-col px-10 py-12">
          <div className="flex flex-1 items-center justify-center">
            <div className="flex max-w-lg flex-col items-center space-y-6">
              <img src="/src/assets/logos/chro-round-icon.png" alt="Icon" className="h-24 w-24 opacity-95 drop-shadow-2xl" />
              <h2 className="text-center font-heading text-5xl font-bold tracking-tight text-white drop-shadow-sm">Chromascope</h2>
              <p className="text-center text-lg leading-relaxed text-white/90">Experience clinical-grade skin analysis powered by advanced color science and personalized AI-driven beauty insights.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form (EXACT DESIGN PRESERVED) */}
      <div className="relative flex flex-1 flex-col overflow-y-auto bg-white">
        
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#E5D5F5]/60 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#DBB7FF]/30 blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2 px-6 pb-2 pt-8 font-heading text-lg font-bold text-[#6800B8] lg:hidden">
          <img src="/src/assets/logos/chro-round-icon.png" alt="Logo" className="h-6 w-6" style={{ filter: "invert(17%) sepia(90%) saturate(4529%) hue-rotate(272deg) brightness(81%) contrast(115%)" }} />
          Chromascope
        </div>

        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:p-12">
          <div className="mx-auto w-full max-w-[440px]">
            <header className="mb-8 text-center">
              <h2 className="font-heading text-3xl font-bold text-[#111827]">Welcome Back</h2>
              <p className="mt-2 text-[15px] text-[#4B5563]">Sign in to access your clinical dashboard</p>
            </header>

            <div className="rounded-[24px] border border-[#E5D5F5] bg-white/80 p-6 shadow-sm backdrop-blur-xl sm:p-8 lg:p-10">
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="mb-1.5 block font-medium text-[14px] text-[#4B5563]">Email Address</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex h-full items-center text-[#9CA3AF]">
                      <Mail size={18} strokeWidth={2} />
                    </div>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3.5 pl-11 pr-4 text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#7700CF] focus:bg-white focus:ring-4 focus:ring-[#7700CF]/10"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-end justify-between">
                    <label className="font-medium text-[14px] text-[#4B5563]">Password</label>
                    <button type="button" className="font-medium text-[13px] text-[#7700CF] hover:underline focus:outline-none">Forgot password?</button>
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex h-full items-center text-[#9CA3AF]">
                      <Lock size={18} strokeWidth={2} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className={`w-full rounded-2xl border border-gray-200 bg-gray-50/50 py-3.5 pl-11 pr-12 font-medium ${!showPassword && formData.password ? 'tracking-widest' : 'tracking-normal'} text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#7700CF] focus:bg-white focus:ring-4 focus:ring-[#7700CF]/10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 flex h-full items-center text-[#9CA3AF] focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {error && <p className="mt-2 text-xs text-rose-500 flex items-center gap-1"><AlertCircle size={14}/> {error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7700CF] py-4 font-medium text-[15px] text-white shadow-lg shadow-purple-600/20 transition-all hover:bg-[#5C00A3] active:scale-[0.98] disabled:opacity-70 focus:outline-none"
                >
                  {isLoading ? "Signing in..." : "Log in"}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
              </form>
            </div>

            <p className="mt-8 text-center font-medium text-[15px] text-[#4B5563]">
              Don't have an account? 
              <button 
                onClick={() => navigate("/register")} 
                className="ml-1 font-semibold text-[#7700CF] hover:underline"
              >
                Request Access
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}