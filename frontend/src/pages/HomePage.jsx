import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";

// Supporting both True/Warm and True/Cool naming conventions so the DB value always finds its colors
const SEASON_PALETTES = {
  "Bright Spring": ["#FF6B6B", "#FFD166", "#06D6A0", "#FF9A3C", "#F72585", "#E05070"],
  "Warm Spring": ["#FF8C42", "#FFCA3A", "#E07A5F", "#F4A261", "#E63946"],
  "True Spring": ["#FF8C42", "#FFCA3A", "#E07A5F", "#F4A261", "#E63946"], 
  "Light Spring": ["#FFB5A7", "#FFDDD2", "#B5EAD7", "#FEC89A", "#FFCBF2"],
  "Light Summer": ["#CBAACB", "#ADEFD1", "#F2C4CE", "#B5C7D3", "#C9D5E0"],
  "Cool Summer": ["#D4A5A5", "#A8DADC", "#B8B0C8", "#C77DFF", "#E0AFA0"],
  "True Summer": ["#D4A5A5", "#A8DADC", "#B8B0C8", "#C77DFF", "#E0AFA0"],
  "Soft Summer": ["#B5838D", "#9B8EA0", "#A7C5BD", "#C4A882", "#D8A7B1", "#D88090", "#D87090", "#D06878"],
  "Soft Autumn": ["#C8956C", "#A0785A", "#D4A373", "#9B7240", "#BC8A5F"],
  "Warm Autumn": ["#B5451B", "#E07B39", "#9C6B30", "#6B4226", "#C0392B"],
  "True Autumn": ["#B5451B", "#E07B39", "#9C6B30", "#6B4226", "#C0392B"],
  "Deep Autumn": ["#7B2D00", "#5C2018", "#8B4513", "#6B3A2A", "#9B2335", "#3A2818"],
  "Deep Winter": ["#1C1C3A", "#2D1B33", "#3D0C11", "#0A0A2E", "#4A0E4E", "#302010", "#403020"],
  "Cool Winter": ["#0D0D0D", "#FFFFFF", "#E63946", "#3A86FF", "#8338EC"],
  "True Winter": ["#0D0D0D", "#FFFFFF", "#E63946", "#3A86FF", "#8338EC"],
  "Bright Winter": ["#FF006E", "#3A86FF", "#8338EC", "#06D6A0", "#FB5607", "#C94060", "#E04868"]
};

// Utility to convert LAB array to Hex for raw skin shade display
function labToHex(l, a, b) {
  let y = (l + 16) / 116,
      x = a / 500 + y,
      z = y - b / 200;

  x = 0.95047 * (Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787);
  y = 1.00000 * (Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787);
  z = 1.08883 * (Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787);

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bl = x * 0.0557 + y * -0.2040 + z * 1.0570;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bl = bl > 0.0031308 ? 1.055 * Math.pow(bl, 1 / 2.4) - 0.055 : 12.92 * bl;

  r = Math.max(0, Math.min(1, r)) * 255;
  g = Math.max(0, Math.min(1, g)) * 255;
  bl = Math.max(0, Math.min(1, bl)) * 255;

  const toHex = c => Math.round(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`.toUpperCase();
}

const quickActions = [
  {
    title: "Start Color Analysis",
    description: "Discover your seasonal palette with AI-driven spectral scanning.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    accent: "bg-primary shadow-md shadow-primary/30",
    path: "/color-analysis"
  },
  {
    title: "Ingredient Filter",
    description: "Filter products safely based on your molecular breakdown and allergens.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h10" />
        <path d="M12 3v18" />
        <path d="M6 7h12" />
        <path d="M8 11h8" />
        <path d="M10 15h4" />
      </svg>
    ),
    accent: "bg-primary shadow-md shadow-primary/30",
    path: "/ingredient-filter"
  },
  {
    title: "Open Try-On",
    description: "Hyper-realistic AR visualization of clinical makeup suggestions.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a9 9 0 0 1 9 9v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3a9 9 0 0 1 9-9Z" />
        <path d="M8 14a4 4 0 0 0 8 0" />
      </svg>
    ),
    accent: "bg-primary shadow-md shadow-primary/30",
    path: "/ar-tryon"
  },
  {
    title: "Product Catalog",
    description: "Browse clinical-grade products matching your unique profile.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11h16" />
        <path d="M4 7h16" />
        <path d="M9 15h6" />
      </svg>
    ),
    accent: "bg-primary shadow-md shadow-primary/30",
    path: "/product-catalog"
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  
  const displayName = user?.display_name || user?.fullName || user?.name || "";
  const firstName = displayName ? displayName.split(" ")[0] : "";
  const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : "U";

  // Strictly use the database value
  const userSeason = user?.seasonal_label;

  // Match colors for display
  const matchedSeasonKey = userSeason 
    ? Object.keys(SEASON_PALETTES).find(
        (key) => 
          key.toLowerCase() === userSeason.toLowerCase() || 
          key.toLowerCase().replace(" ", "_") === userSeason.toLowerCase()
      ) 
    : null;

  const currentSeasonColors = matchedSeasonKey ? SEASON_PALETTES[matchedSeasonKey] : [];

  const skinHex = user?.user_lab && user.user_lab.length >= 3 
    ? labToHex(user.user_lab[0], user.user_lab[1], user.user_lab[2]) 
    : null;

  // Dynamically generated session history based on actual user data
  const dynamicSessions = [
    {
      type: "Full Color Profile",
      date: user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : "Latest",
      result: userSeason || "Pending Analysis",
      status: userSeason ? "Analyzed" : "Pending",
      badge: userSeason ? "badge-primary" : "badge-secondary",
    },
    {
      type: "Ingredient Restrictions",
      date: "Latest",
      result: user?.avoid_ingredients?.length ? `${user.avoid_ingredients.length} Filters` : "Safe",
      status: "Logged",
      badge: user?.avoid_ingredients?.length ? "badge-danger" : "badge-secondary",
    },
    {
      type: "Skin Concerns",
      date: "Latest",
      result: user?.concerns?.length ? `${user.concerns.length} Logged` : "None",
      status: "Saved",
      badge: "badge-secondary",
    },
  ];

  return (
    <main className="page-shell min-h-screen bg-surface p-6 text-black">
      <div className="mx-auto max-w-7xl pt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-black tracking-tight text-black sm:text-5xl">
            Clinical beauty at your fingertips
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-gray sm:text-lg">
            Monitor your color profile, ingredient safety, and AR try-on results
            from one medical-grade dashboard.
          </p>
        </div>

        {/* ── Hero Banner ── */}
        <section className="relative mb-8 min-h-[280px] overflow-hidden rounded-2xl shadow-md sm:min-h-[320px]">
          <img
            src="/src/assets/images/home-page-img.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/80" />

          <div className="relative z-10 flex h-full flex-col gap-6 px-8 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <span className="inline-flex w-fit rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-white backdrop-blur-sm">
                {userSeason || "Profile Status"}
              </span>
              <div className="mt-8">
                <p className="mb-1 text-xs uppercase tracking-[0.3em] text-white/70">
                  Clinical report
                </p>
                <h2 className="text-4xl font-heading font-black tracking-tight text-white sm:text-5xl">
                  Good day{firstName ? `, ${firstName}` : ""}!
                </h2>
                <p className="mt-2 text-base text-white/70 sm:text-lg">
                  {userSeason 
                    ? "Your personalized clinical report is ready for review."
                    : "Complete your profile diagnostics to map your skin profile."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.75fr_0.95fr]">
          {/* ── Left Column ── */}
          <div className="space-y-6">
            
            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map((action) => (
                <article
                  key={action.title}
                  onClick={() => navigate(action.path)}
                  className="rounded-xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer group border border-transparent hover:border-primary/20"
                >
                  <div
                    className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${action.accent}`}
                  >
                    {action.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-black group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray">
                    {action.description}
                  </p>
                </article>
              ))}
            </div>

            {/* Session History (Now pulls from actual User Data) */}
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Recent session history
                  </p>
                  <p className="mt-0.5 text-xs text-gray-light">
                    Review your latest color and ingredient sessions.
                  </p>
                </div>
                <button className="text-xs font-semibold text-primary transition hover:text-primary-dark">
                  View All
                </button>
              </div>

              {/* Mobile: stacked cards, no horizontal scroll */}
              <div className="sm:hidden divide-y divide-primary/5">
                {dynamicSessions.map((session) => (
                  <div
                    key={session.type}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm text-black">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 6v6l4 2" />
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{session.type}</p>
                        <p className="text-xs text-gray-light">{session.date}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${session.badge} capitalize`}
                      >
                        {session.result}
                      </span>
                      <span className="text-xs font-semibold text-success">
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tablet/desktop: table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl bg-white">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-[1.8fr_1fr_1fr_0.8fr] gap-3 px-4 py-3 text-xs uppercase tracking-[0.2em] text-gray-light">
                    <span>Session Type</span>
                    <span>Date</span>
                    <span>Result</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y divide-primary/5">
                    {dynamicSessions.map((session) => (
                      <div
                        key={session.type}
                        className="grid grid-cols-[1.8fr_1fr_1fr_0.8fr] gap-3 px-4 py-3"
                      >
                        <div className="flex items-center gap-2 text-sm text-black">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light text-primary">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 6v6l4 2" />
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          </span>
                          {session.type}
                        </div>
                        <div className="text-sm text-gray">{session.date}</div>
                        <div className="text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${session.badge} capitalize`}
                          >
                            {session.result}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-success">
                          {session.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Right Sidebar ── */}
          <aside className="space-y-5">
            
            {/* Dynamic Color Profile */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#1F2937] p-6 shadow-lg text-white">
              <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/40 blur-[80px] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-black text-white shadow-inner border border-white/20 backdrop-blur-md">
                  {firstLetter}
                </div>
                
                {userSeason ? (
                  <div className="w-full">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400">
                      Your Color Profile
                    </p>
                    <p className="mt-2 text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white to-[#C084FC]">
                      {userSeason}
                    </p>
                    
                    {/* The Color Swatches */}
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {currentSeasonColors.length > 0 ? (
                        currentSeasonColors.slice(0, 6).map((color) => (
                          <div
                            key={color}
                            className="group relative flex h-12 w-12 cursor-default items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/10 transition-all duration-300 hover:scale-110 hover:shadow-md hover:ring-white/40"
                          >
                            <span
                              className="absolute inset-[3px] rounded-full shadow-inner transition-transform duration-300 group-hover:scale-105"
                              style={{ backgroundColor: color }}
                            >
                              <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">Palette details unavailable.</p>
                      )}
                    </div>

                    {/* Prominent Raw Skin Hex Card */}
                    {skinHex && (
                      <div className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition-colors hover:bg-white/10">
                        <div className="flex items-center gap-3">
                          <div 
                            className="h-10 w-10 rounded-full border-2 border-white/80 shadow-inner" 
                            style={{ backgroundColor: skinHex }} 
                          />
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">Raw Skin Shade</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">Base Hex</p>
                          </div>
                        </div>
                        <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 font-mono text-sm font-bold text-[#C084FC] shadow-sm">
                          {skinHex}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400">
                      Your Color Profile
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-300 italic">
                      Analysis Pending
                    </p>
                    <p className="mt-2 text-xs text-gray-400 max-w-[200px] mx-auto leading-relaxed">
                      Start your color analysis to map your features and unlock your palette.
                    </p>
                    <button 
                      onClick={() => navigate("/color-analysis")}
                      className="mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-[#111827] shadow-lg transition-transform hover:scale-105"
                    >
                      Run Diagnostics
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Dynamic Skin Profile */}
            <section className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Skin Profile
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.25em] text-gray">
                    Diagnosis
                  </p>
                </div>
                <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary capitalize shadow-inner">
                  {user?.skin_type ? `${user.skin_type} Skin` : "Not Logged"}
                </span>
              </div>

              {user?.concerns && user.concerns.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold text-gray">
                    Active Concerns
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.concerns.map((concern) => (
                      <span key={concern} className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-700 capitalize border border-gray-200">
                        {concern}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold text-gray">
                  Restricted Ingredients
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {user?.avoid_ingredients && user.avoid_ingredients.length > 0 ? (
                    user.avoid_ingredients.map((ingredient) => (
                      <span key={ingredient} className="badge badge-danger capitalize shadow-sm">
                        {ingredient}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-gray-400">
                      No ingredients restricted.
                    </span>
                  )}
                </div>
              </div>

              <button 
                onClick={() => navigate("/profile")}
                className="group flex items-center justify-center gap-2 mt-5 w-full text-sm font-bold text-white bg-[#2D1B4E] hover:bg-[#1A0F2E] py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-[0_8px_20px_rgba(45,27,78,0.25)] hover:-translate-y-0.5"
              >
                Update Profile Data
                <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </section>

            {/* Clinical Tip */}
            <section className="rounded-xl bg-primary-lightest p-5 shadow-sm border border-primary/10">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Clinical Tip
              </p>
              <p className="mt-2 text-sm leading-6 text-gray">
                "Adjusting your seasonal profile and restricted ingredients guarantees our AI engine only recommends safe, harmonized products."
              </p>
            </section>

          </aside>
        </div>
      </div>
    </main>
  );
}