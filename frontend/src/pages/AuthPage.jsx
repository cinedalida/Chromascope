import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Lock } from "lucide-react";
import { motion } from "framer-motion";

export function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.log("Sign in with:", email, password);
      navigate("/home");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      console.log("Sign in with Google");
      navigate("/home");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="fixed inset-0 w-screen h-screen m-0 p-0 flex bg-white font-body overflow-hidden z-50" style={{ overscrollBehavior: 'none' }}>
      {/* Left Side - Design/Visual */}
      <div
        className="hidden lg:flex lg:flex-1 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #7700CF 0%, #BA6CF4 100%)",
        }}
      >
        {/* Background Logo */}
        <div className="absolute inset-0 flex items-end justify-center">
          <img
            src="/src/assets/logos/chro-glass-white.png"
            alt="Chromascope Glass Logo"
            className="w-[85%] h-auto object-contain opacity-40"
          />
        </div>

        {/* Gradient background decorations */}
        <div
          className="absolute top-0 left-1/4 opacity-20 rounded-full"
          style={{
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)",
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 opacity-30 rounded-full"
          style={{
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle, rgba(219,183,255,1) 0%, rgba(219,183,255,0) 70%)",
            filter: "blur(80px)",
          }}
        />

        {/* Content Overlay */}
        <div className="relative z-10 flex h-full flex-col px-10 py-12 w-full">
          {/* Logo + Heading + Subheading (centered vertically) */}
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center space-y-4 max-w-lg">
              {/* Logo */}
              <motion.img
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                src="/src/assets/logos/chro-round-icon.png"
                alt="Chromascope Round Icon"
                className="h-20 w-20 opacity-95"
              />

              {/* Main Text */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="font-heading text-5xl font-black tracking-tight text-center text-white"
              >
                Chromascope
              </motion.h2>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-lg leading-relaxed text-center text-white/85"
              >
                Experience strong-grade skin analysis powered by advanced color
                science and personalized AI-driven beauty insights.
              </motion.p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex flex-col relative bg-white overflow-y-auto">
        {/* Top Left Logo — visible on mobile, hidden on lg (left panel takes over) */}
        <div className="lg:hidden flex items-center gap-2 text-[#6800B8] font-heading font-bold text-lg px-6 pt-8 pb-2">
          <img src="/src/assets/logos/chro-round-icon.png" alt="Logo" className="w-6 h-6" style={{ filter: "invert(17%) sepia(90%) saturate(4529%) hue-rotate(272deg) brightness(81%) contrast(115%)" }} />
          Chromascope
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-10 lg:p-12 w-full">
          <div className="w-full max-w-[440px] mx-auto">
            <header className="mb-8 text-center">
              <h2 className="text-[22px] font-heading font-medium text-[#374151]">Welcome Back</h2>
              <p className="text-[15px] text-[#4B5563] mt-2">Sign in to access your clinical dashboard</p>
            </header>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="bg-[#FAEDFF] p-6 sm:p-8 lg:p-10 rounded-2xl border border-primary-light/10 shadow-sm"
            >
              <form onSubmit={handleSignIn} className="space-y-6">
                <div>
                  <label className="text-[14px] text-[#4B5563] block mb-2 font-medium">Email Address</label>
                  <div className="relative flex items-center">
                    <Mail size={18} className="absolute left-0 text-[#6B7280]" strokeWidth={1.5} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 py-2 bg-transparent border-b border-[#9CA3AF] focus:border-[#6800B8] transition-colors outline-none text-[15px] text-[#374151] placeholder:text-[#9CA3AF]"
                      placeholder="name@company.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[14px] text-[#4B5563] font-medium">Password</label>
                    <a href="#forgot" className="text-[14px] text-[#6800B8] hover:text-[#4A0082] transition-colors font-medium">Forgot?</a>
                  </div>
                  <div className="relative flex items-center">
                    <Lock size={18} className="absolute left-0 text-[#6B7280]" strokeWidth={1.5} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-8 py-2 bg-transparent border-b border-[#9CA3AF] focus:border-[#6800B8] transition-colors outline-none text-[15px] text-[#374151] placeholder:text-[#9CA3AF] tracking-widest font-medium"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-[#7700CF] text-white py-3.5 rounded-full font-medium text-[15px] flex items-center justify-center gap-2 hover:bg-[#5C00A3] transition-all disabled:opacity-50 shadow-md"
                >
                  {isLoading ? "Authenticating..." : "Log in"}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
              </form>

              <div className="my-8 flex items-center gap-4">
                <div className="flex-1 h-px bg-[#D1D5DB]" />
                <span className="text-[13px] text-[#6B7280] uppercase tracking-wide font-medium">OR CONTINUE WITH</span>
                <div className="flex-1 h-px bg-[#D1D5DB]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3 bg-transparent border border-[#D1D5DB] rounded-xl hover:bg-white/50 transition-all font-medium text-[15px] text-[#374151]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                Continue with Google
              </button>
            </motion.div>

            <p className="mt-8 text-center text-[15px] font-medium text-[#4B5563]">
              Don't have an account? <a href="#request" className="text-[#6800B8] hover:underline">Request Access</a>
            </p>

            {/* Footer Links */}
            <div className="mt-10 lg:mt-16 flex flex-wrap justify-center gap-4 sm:gap-6 text-[11px] text-[#6B7280] uppercase tracking-wide">
              <a href="#privacy" className="hover:text-[#6800B8] transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-[#6800B8] transition-colors">Terms of Service</a>
              <a href="#support" className="hover:text-[#6800B8] transition-colors">Support</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
