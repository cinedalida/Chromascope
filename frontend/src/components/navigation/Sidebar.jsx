import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const sidebarItems = [
  { label: "Home", icon: "home", path: "/home" },
  { label: "Profile", icon: "profile", path: "/profile" },
  { label: "Try-On", icon: "tryon", path: "/ar-tryon" },
  // { label: "Palette Guide", icon: "palette", path: "/palette-product" }, // HIDDEN — re-enable when ready
  { label: "Color Analysis", icon: "color", path: "/color-analysis" },
  {
    label: "Ingredient Filter",
    icon: "ingredient",
    path: "/ingredient-filter",
  },
  { label: "Product Catalog", icon: "catalog", path: "/product-catalog" },
];

function SidebarIcon({ icon, active, hovered }) {
  const colorClass = active || hovered ? "text-primary" : "text-gray-light";
  const size = "h-5 w-5";

  const icons = {
    home: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12l9-9 9 9" />
        <path d="M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
      </svg>
    ),
    tryon: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a9 9 0 0 1 9 9v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3a9 9 0 0 1 9-9Z" />
        <path d="M8 14a4 4 0 0 0 8 0" />
      </svg>
    ),
    palette: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
      </svg>
    ),
    color: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    ingredient: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 3h10" />
        <path d="M12 3v18" />
        <path d="M6 7h12" />
        <path d="M8 11h8" />
        <path d="M10 15h4" />
      </svg>
    ),
    profile: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    catalog: (
      <svg
        viewBox="0 0 24 24"
        className={`${size} ${colorClass}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11h16" />
        <path d="M4 7h16" />
        <path d="M9 15h6" />
      </svg>
    ),
  };

  return icons[icon] || null;
}

export function Sidebar({ collapsed = false, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Driven from React state rather than Tailwind's `hover:` variant: color/background/opacity
  // pseudo-class utilities were not taking effect in this build (verified directly — plain,
  // non-variant utility classes apply correctly, but any `hover:bg-*`/`hover:text-*`/
  // `hover:opacity-*` class silently no-ops), so onMouseEnter/onMouseLeave + plain classes
  // is used here to guarantee the hover actually renders.
  const [hoveredItem, setHoveredItem] = useState(null);
  const [collapseHovered, setCollapseHovered] = useState(false);

  return (
    <>
      {/* Desktop only — Navbar owns mobile navigation via its own hamburger drawer,
          which already defaults to closed. This component used to also render as a
          mobile overlay gated on `collapsed`, but that state means "desktop expanded"
          by default (false), so below `lg` it rendered as a full-screen backdrop
          blocking the page on every load. Scoping it to `lg:flex` removes that
          duplicate, broken mobile nav entirely. */}
      <aside
        className={`fixed top-0 left-0 z-50 hidden h-full flex-col bg-white transition-all duration-300 ease-out lg:flex ${
          collapsed ? "lg:w-[72px]" : "w-60"
        }`}
      >
        {/* Brand */}
        <div
          className={`flex items-center px-4 ${
            collapsed ? "justify-center h-16" : "gap-3 h-16"
          }`}
        >
          <img
            src="/src/assets/logos/chro-logo-violet.png"
            alt="Chromascope logo"
            className="h-8 w-8 flex-shrink-0 rounded-full"
          />
          {!collapsed && (
            <span className="text-base font-heading font-black text-primary tracking-tight">
              Chromascope
            </span>
          )}
        </div>

        {/* Sidebar items */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isHovered = hoveredItem === item.label;
            return (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  if (onToggle && window.innerWidth < 1024) onToggle();
                }}
                onMouseEnter={() => setHoveredItem(item.label)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`group relative flex w-full items-center gap-3 rounded-lg border-0 px-3 py-2.5 text-sm font-medium transition-all duration-200 outline-none focus:ring-0 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isHovered
                      ? "translate-x-0.5 bg-primary-light text-primary"
                      : "bg-transparent text-gray"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <SidebarIcon icon={item.icon} active={isActive} hovered={isHovered} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="hidden px-3 py-3 lg:block">
          <button
            onClick={onToggle}
            onMouseEnter={() => setCollapseHovered(true)}
            onMouseLeave={() => setCollapseHovered(false)}
            className={`flex w-full items-center gap-2 rounded-lg border-0 px-3 py-2 text-sm font-medium transition outline-none focus:ring-0 ${
              collapseHovered ? "bg-primary-light text-primary" : "text-gray"
            } ${collapsed ? "justify-center px-0" : ""}`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 transition-transform duration-200 ${
                collapsed ? "" : "rotate-180"
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
