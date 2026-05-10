import { useState, useEffect } from "react";
import { X, Menu } from "lucide-react";

// Scroll-aware navbar with glossy effect for the SplashPage.
// Hides on scroll down, appears on scroll up. Has a mobile drawer.
export function SplashNavbar() {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 0) {
        setVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setVisible(false);
        setMobileOpen(false);
      } else {
        setVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleNavClick = (e, sectionId) => {
    e.preventDefault();
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileOpen(false);
  };

  const navLinks = [
    { label: "Home", id: "home" },
    { label: "Features", id: "features" },
    { label: "Demo", id: "demo" },
  ];

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 bg-white/90 shadow-sm shadow-primary/5 backdrop-blur-xl backdrop-saturate-150 transition-transform duration-300 ease-out ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Brand */}
        <a
          href="#home"
          onClick={(e) => handleNavClick(e, "home")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200 no-underline"
        >
          <img
            src="/src/assets/logos/chro-logo-violet.png"
            alt="Chromascope logo"
            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full"
          />
          <span className="text-lg sm:text-xl font-heading font-black text-primary">
            Chromascope
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-8 lg:gap-10">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => handleNavClick(e, link.id)}
              className="font-body text-base text-primary/70 transition-all duration-200 hover:text-primary cursor-pointer no-underline"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-primary/70 hover:bg-primary/5 hover:text-primary transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-primary/10 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => handleNavClick(e, link.id)}
              className="block py-3 px-4 rounded-lg text-base font-medium text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors no-underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
