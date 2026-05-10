import { useState } from "react";
import { Navbar } from "../components/common/Navbar";
import { Sidebar } from "../components/navigation/Sidebar";

const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 72;

export function MainLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const sidebarWidth = sidebarCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="min-h-screen bg-surface text-black">
      {/* Pass sidebar width as CSS var for Navbar positioning on desktop */}
      <style>{`
        @media (min-width: 1024px) {
          :root { --sidebar-width: ${sidebarWidth}px; }
        }
        @media (max-width: 1023px) {
          :root { --sidebar-width: 0px; }
        }
      `}</style>

      {/* Sidebar — desktop only (hidden on mobile via its own CSS) */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggle} />

      {/* Main content area */}
      <main
        className="min-h-screen transition-all duration-300 ease-out"
        style={{
          // On desktop: push content right of sidebar
          // On mobile: no margin (sidebar is off-screen)
          marginLeft: 0,
        }}
      >
        {/* Desktop margin applied via Tailwind hidden class approach */}
        <div className="lg:transition-all lg:duration-300" style={{ marginLeft: `var(--sidebar-width, 0px)` }}>
          <Navbar onMenuToggle={handleToggle} />
          <div className="pt-16">{children}</div>
        </div>
      </main>
    </div>
  );
}
