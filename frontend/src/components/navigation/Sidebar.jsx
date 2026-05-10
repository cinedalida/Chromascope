import { useNavigate } from "react-router-dom";
import { useSidebar } from "../../context/SidebarContext";

const sidebarItems = [
  { label: "Home", icon: "home", path: "/home" },
  { label: "Profile", icon: "profile", path: "/profile" },
  { label: "Try-On", icon: "tryon", path: "/ar-tryon" },
  { label: "Palette Guide", icon: "palette", path: "/palette-product" },
  { label: "Color Analysis", icon: "color", path: "/color-analysis" },
  {
    label: "Ingredient Filter",
    icon: "ingredient",
    path: "/ingredient-filter",
  },
  { label: "Product Catalog", icon: "catalog", path: "/product-catalog" },
];

function SidebarIcon({ icon, active }) {
  const colorClass = active
    ? "text-primary"
    : "text-gray-light group-hover:text-primary";
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
  const { activeItem, setActiveItem } = useSidebar();
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-full flex-col bg-white transition-all duration-300 ease-out ${
          collapsed
            ? "-translate-x-full lg:translate-x-0 lg:w-[72px]"
            : "translate-x-0 w-60"
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
            const isActive = activeItem === item.label;
            return (
              <button
                key={item.label}
                onClick={() => {
                  setActiveItem(item.label);
                  navigate(item.path);
                  if (onToggle && window.innerWidth < 1024) onToggle();
                }}
                className={`group flex w-full items-center gap-3 rounded-lg border-0 px-3 py-2.5 text-sm font-medium transition-all duration-200 outline-none focus:ring-0 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-transparent text-gray hover:bg-primary/5 hover:text-primary"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <SidebarIcon icon={item.icon} active={isActive} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="hidden px-3 py-3 lg:block">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-0 px-3 py-2 text-sm font-medium text-gray transition hover:bg-primary/5 hover:text-primary outline-none focus:ring-0"
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
