import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "../../context/SidebarContext";
import { Bell, User, X, Menu } from "lucide-react";

const navItems = [
  { label: "Home", icon: "home", path: "/home" },
  { label: "Profile", icon: "profile", path: "/profile" },
  { label: "Try-On", icon: "tryon", path: "/ar-tryon" },
  { label: "Palette Guide", icon: "palette", path: "/palette-product" },
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
  const { activeItem, setActiveItem } = useSidebar();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    setActiveItem(item.label);
    navigate(item.path);
    setMobileNavOpen(false);
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
        className={`fixed top-0 inset-x-0 z-50 bg-white/95 shadow-sm shadow-primary/5 backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ left: "var(--sidebar-width, 0px)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-3">
            <button
              className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-light/50 text-primary transition-all duration-300 hover:bg-primary-light active:scale-95"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={2.5} className="transition-transform group-hover:rotate-12" />
              {/* Notification Dot */}
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/20 transition-all duration-300 hover:bg-primary-dark active:scale-95"
              aria-label="Profile"
            >
              <User size={18} strokeWidth={2.5} />
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
              const isActive = activeItem === item.label;
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

          {/* Mobile drawer footer */}
          <div className="px-4 py-4 border-t border-primary/5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow-sm">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black truncate">Your Account</p>
              <p className="text-xs text-gray-light truncate">Manage settings & preferences</p>
            </div>
          </div>
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
    </>
  );
}
