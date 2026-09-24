import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useUserStore } from "../../store/userStore";
import { LogOut, X, Menu } from "lucide-react";

const navItems = [
  { label: "Home", icon: "home", path: "/home" },
  { label: "Profile", icon: "profile", path: "/profile" },
  { label: "Try-On", icon: "tryon", path: "/ar-tryon" },
  // { label: "Palette Guide", icon: "palette", path: "/palette-product" }, // HIDDEN — re-enable when ready
  { label: "Color Analysis", icon: "color", path: "/color-analysis" },
  { label: "Ingredient Filter", icon: "ingredient", path: "/ingredient-filter" },
  { label: "Product Catalog", icon: "catalog", path: "/product-catalog" },
];

const navIcons = {
  home: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9" /><path d="M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  tryon: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a9 9 0 0 1 9 9v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3a9 9 0 0 1 9-9Z" /><path d="M8 14a4 4 0 0 0 8 0" />
    </svg>
  ),
  palette: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
      <path d="M12 2v4" /><path d="M12 18v4" /><path d="M2 12h4" /><path d="M18 12h4" />
    </svg>
  ),
  color: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 3" />
    </svg>
  ),
  ingredient: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3h10" /><path d="M12 3v18" /><path d="M6 7h12" /><path d="M8 11h8" /><path d="M10 15h4" />
    </svg>
  ),
  catalog: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11h16" /><path d="M4 7h16" /><path d="M9 15h6" />
    </svg>
  ),
};

// Navbar navigation and brand shell for the app.
export function Navbar({ onMenuToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const activeItem = navItems.find((item) => item.path === location.pathname)?.label ?? "Home";

  const displayName = user?.display_name || user?.fullName || user?.name || "";
  const accountLabel = displayName || user?.email || "Your Account";
  const accountInitial = (displayName || user?.email || "U").charAt(0).toUpperCase();
  // Only show the email as a subtitle when it isn't already the label above it.
  const accountSubtitle = displayName && user?.email ? user.email : "Manage settings & preferences";

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollY;
      setVisible(isScrollingUp || currentScrollY <= 0);
      setLastScrollY(currentScrollY);
      if (currentScrollY > lastScrollY) setMobileNavOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Close mobile nav on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileNavOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMobileNav = (item) => {
    navigate(item.path);
    setMobileNavOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout Error:", error);
    } finally {
      setShowLogoutConfirm(false);
    }
  };

  const handleHamburger = () => {
    // On mobile: toggle mobile nav drawer
    // On desktop: toggle sidebar collapse
    if (window.innerWidth < 1024) {
      setMobileNavOpen((o) => !o);
    } else {
      onMenuToggle();
    }
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 lg:left-(--sidebar-width,0px) z-50 bg-white/95 shadow-sm shadow-primary/5 backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="min-w-0 flex items-center gap-3">
            {/* Hamburger — opens sidebar on desktop, mobile drawer on mobile */}
            <button
              onClick={handleHamburger}
              className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-xl text-gray-light transition hover:bg-primary-light hover:text-primary"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            {/* Brand / Breadcrumb */}
            <div className="flex items-center gap-2 text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.32em] text-primary">
              <img
                src="/src/assets/logos/chro-logo-violet.png"
                alt="Chromascope"
                className="h-6 w-6 rounded-full lg:hidden"
              />
              <span className="font-heading font-black text-primary hidden sm:inline-block">
                Chromascope
              </span>
              <span className="text-gray-lighter hidden sm:inline-block">/</span>
              <span className="text-black font-medium truncate max-w-[140px] sm:max-w-none">
                {activeItem}
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-3">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex h-10 items-center gap-2 rounded-full bg-red-50 px-4 text-sm font-bold text-red-600 transition-all duration-300 hover:bg-red-100 active:scale-95"
              aria-label="Log out"
            >
              <LogOut size={18} strokeWidth={2.5} />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer — visible only on mobile when open */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-primary/10 bg-white/98 backdrop-blur-xl ${
            mobileNavOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <nav className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => handleMobileNav(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  <span className={isActive ? "text-primary" : "text-gray-light"}>
                    {navIcons[item.icon]}
                  </span>
                  {item.label}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Mobile drawer footer — links to the currently signed-in account's profile */}
          <button
            onClick={() => {
              setMobileNavOpen(false);
              navigate("/profile");
            }}
            className="w-full px-4 py-4 border-t border-primary/5 flex items-center gap-3 text-left transition-colors hover:bg-primary/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow-sm">
              {accountInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black truncate">{accountLabel}</p>
              <p className="text-xs text-gray-light truncate">{accountSubtitle}</p>
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile overlay — closes drawer on backdrop tap */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div
            className="modal max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <LogOut size={22} strokeWidth={2.5} />
            </div>
            <h3 className="mb-2 font-heading text-lg font-bold text-black">
              Log out?
            </h3>
            <p className="mb-6 text-sm text-gray-light">
              You'll need to sign back in to access your account.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-full border border-gray-lighter px-4 py-2.5 text-sm font-bold text-gray transition hover:bg-gray-lightest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
