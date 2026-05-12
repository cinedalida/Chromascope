import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Lock, User, AlertCircle, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "../firebase"; 
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!isLogin && !formData.name.trim()) {
      newErrors.name = "Display name is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = "Email is required.";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!formData.password) {
      newErrors.password = "Password is required.";
    } else if (!passwordRegex.test(formData.password)) {
      newErrors.password = "Must be at least 8 characters, with 1 letter and 1 number.";
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        // Teammate's Login Logic
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        navigate("/home");
      } else {
        // Teammate's Register Logic
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          formData.email, 
          formData.password
        );
        
        await setDoc(doc(db, "users", userCredential.user.uid), {
          display_name: formData.name.trim(),
          email: formData.email,
          created_at: new Date().toISOString(),
          profile_completed: false,
          concerns: [],
          avoidIngredients: [],
          seasonal_label: null
        });

        // Routing to onboarding as you originally intended
        navigate("/onboarding"); 
      }
    } catch (error) {
      const newErrors = {};
      if (error.code === "auth/email-already-in-use") {
        newErrors.email = "Email already registered.";
      } else if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        newErrors.email = "Invalid email or password.";
      } else {
        newErrors.email = "Authentication failed. Try again.";
      }
      setErrors(newErrors);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await setDoc(doc(db, "users", result.user.uid), {
        display_name: result.user.displayName,
        email: result.user.email,
        last_login: new Date().toISOString()
      }, { merge: true });
      navigate("/home");
    } catch (error) {
      console.error("Google Sign-In Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setFormData({ name: "", email: "", password: "", confirmPassword: "" });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <main className="fixed inset-0 z-50 m-0 flex h-screen w-screen overflow-hidden bg-[#FAF4FF] p-0 font-body [-webkit-tap-highlight-color:transparent]">
      {/* Left Side - Soft Beauty Brand Visual */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-1"
        style={{ background: "linear-gradient(135deg, #5A009D 0%, #9D4EDD 100%)" }}
      >
        <div className="absolute inset-0 flex items-end justify-center">
          <img src="/src/assets/logos/chro-glass-white.png" alt="Chromascope Logo" className="h-auto w-[85%] object-contain opacity-20 mix-blend-overlay" />
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
              <img src="/src/assets/logos/chro-round-icon.png" alt="Chromascope Icon" className="h-24 w-24 opacity-95 drop-shadow-2xl" />
              <h2 className="text-center font-heading text-5xl font-bold tracking-tight text-white drop-shadow-sm">Chromascope</h2>
              <p className="text-center text-lg leading-relaxed text-white/90">Experience clinical-grade skin analysis powered by advanced color science and personalized AI-driven beauty insights.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
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
              <h2 className="font-heading text-3xl font-bold text-[#111827]">
                {isLogin ? "Welcome Back" : "Join Chromascope"}
              </h2>
              <p className="mt-2 text-[15px] text-[#4B5563]">
                {isLogin ? "Sign in to access your clinical dashboard" : "Create your personalized beauty profile"}
              </p>
            </header>

            <motion.div
              layout
              className="rounded-[24px] border border-[#E5D5F5] bg-white/80 p-6 shadow-sm backdrop-blur-xl sm:p-8 lg:p-10"
            >
              <form onSubmit={handleSubmit} noValidate>
                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4">
                        <label className="mb-1.5 block font-medium text-[14px] text-[#4B5563]">Display Name</label>
                        <div className="relative flex items-center">
                          <div className="absolute left-4 flex h-full items-center text-[#9CA3AF]">
                            <User size={18} strokeWidth={2} />
                          </div>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className={`w-full rounded-2xl border ${errors.name ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50/50'} py-3.5 pl-11 pr-4 text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#7700CF] focus:bg-white focus:ring-4 focus:ring-[#7700CF]/10`}
                            placeholder="Jane Doe"
                          />
                        </div>
                        {errors.name && <p className="mt-1.5 flex items-center gap-1 text-[13px] text-rose-500"><AlertCircle size={14}/>{errors.name}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pb-4">
                  <label className="mb-1.5 block font-medium text-[14px] text-[#4B5563]">Email Address</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex h-full items-center text-[#9CA3AF]">
                      <Mail size={18} strokeWidth={2} />
                    </div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border ${errors.email ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50/50'} py-3.5 pl-11 pr-4 text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] outline-none transition-all focus:border-[#7700CF] focus:bg-white focus:ring-4 focus:ring-[#7700CF]/10`}
                      placeholder="name@company.com"
                    />
                  </div>
                  {errors.email && <p className="mt-1.5 flex items-center gap-1 text-[13px] text-rose-500"><AlertCircle size={14}/>{errors.email}</p>}
                </div>

                <div className="pb-4">
                  <div className="mb-1.5 flex items-end justify-between">
                    <label className="font-medium text-[14px] text-[#4B5563]">Password</label>
                    {isLogin && (
                      <button 
                        type="button" 
                        className="font-medium text-[13px] text-[#7700CF] transition-colors hover:text-[#4A0082] focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex h-full items-center text-[#9CA3AF]">
                      <Lock size={18} strokeWidth={2} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full rounded-2xl border ${errors.password ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50/50'} py-3.5 pl-11 pr-12 font-medium ${!showPassword && formData.password ? 'tracking-widest' : 'tracking-normal'} text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:tracking-normal outline-none transition-all focus:border-[#7700CF] focus:bg-white focus:ring-4 focus:ring-[#7700CF]/10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 flex h-full items-center text-[#9CA3AF] transition-colors hover:text-[#4B5563] focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1.5 flex items-start gap-1 text-[13px] leading-tight text-rose-500"><AlertCircle size={14} className="mt-0.5 shrink-0"/>{errors.password}</p>}
                </div>

                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="confirm-password-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-4">
                        <label className="mb-1.5 block font-medium text-[14px] text-[#4B5563]">Confirm Password</label>
                        <div className="relative flex items-center">
                          <div className="absolute left-4 flex h-full items-center text-[#9CA3AF]">
                            <Lock size={18} strokeWidth={2} />
                          </div>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`w-full rounded-2xl border ${errors.confirmPassword ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50/50'} py-3.5 pl-11 pr-12 font-medium ${!showConfirmPassword && formData.confirmPassword ? 'tracking-widest' : 'tracking-normal'} text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] placeholder:tracking-normal outline-none transition-all focus:border-[#7700CF] focus:bg-white focus:ring-4 focus:ring-[#7700CF]/10`}
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 flex h-full items-center text-[#9CA3AF] transition-colors hover:text-[#4B5563] focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {errors.confirmPassword && <p className="mt-1.5 flex items-center gap-1 text-[13px] text-rose-500"><AlertCircle size={14}/>{errors.confirmPassword}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7700CF] py-4 font-medium text-[15px] text-white shadow-lg shadow-purple-600/20 transition-all hover:bg-[#5C00A3] hover:shadow-purple-600/30 active:scale-[0.98] disabled:opacity-70 focus:outline-none"
                >
                  {isLoading ? "Processing..." : (isLogin ? "Log in" : "Create Account")}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
              </form>

              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-[#E5D5F5]" />
                <span className="font-semibold uppercase tracking-wide text-[12px] text-gray-400">Or</span>
                <div className="h-px flex-1 bg-[#E5D5F5]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-3.5 font-medium text-[15px] text-[#374151] shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] focus:outline-none"
              >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                Continue with Google
              </button>
            </motion.div>

            <p className="mt-8 text-center font-medium text-[15px] text-[#4B5563]">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={toggleAuthMode} 
                className="font-semibold text-[#7700CF] transition-colors hover:text-[#4A0082] hover:underline focus:outline-none"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}