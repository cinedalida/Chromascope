import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";
import { getSkinToneName } from "../utils/colorNames";
import { ColorTooltip } from "../components/common/ColorTooltip";
import homePageImg from "../assets/images/home-page-img.jpg";
import { Dna, History, UserRoundPen } from "lucide-react";
import { subscribeActivity } from "../services/activityService";
import { activityCategory, describeActivity, formatExact, formatRelative, toDate } from "../utils/activityLog";

const RECENT_COUNT = 5;
const ACTIVITY_ICONS = { analysis: Dna, profile: UserRoundPen };

function ActivityIcon({ entry }) {
  const Icon = ACTIVITY_ICONS[activityCategory(entry)] ?? History;
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-lighter text-primary">
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}

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
    title: "Open Try-On",
    description: "AR simulation of makeup shades on your face.",
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
    description: "See the full product catalog or view only the products that are safe for your skin.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11h16" />
        <path d="M4 7h16" />
        <path d="M9 15h6" />
      </svg>
    ),
    accent: "bg-primary shadow-md shadow-primary/30",
    path: "/catalog"
  },
  {
    title: "Favorites",
    description: "Save your preferred products and your favorite sets of looks in one place.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
    accent: "bg-primary shadow-md shadow-primary/30",
    path: "/favorites"
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

  // Recent activity: the newest entries of the activity log, live (a change on another tab or device shows at once).
  const uid = user?.uid;
  const [recent, setRecent] = useState({ uid: null, entries: [], error: null });
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeActivity(
      uid,
      RECENT_COUNT,
      (entries) => setRecent({ uid, entries, error: null }),
      (error) => {
        console.error("Recent activity error:", error);
        setRecent((prev) => ({ ...prev, uid, error }));
      },
    );
  }, [uid]);
  const recentLoading = Boolean(uid) && recent.uid !== uid;

  // Relative times ("5 min ago") refresh every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="page-shell bg-primary-lightest text-black">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-black sm:text-5xl">
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
            src={homePageImg}
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
                <h2 className="text-4xl font-heading font-semibold tracking-tight text-white sm:text-5xl">
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

        {/* ── Bento: 2x2 grid on xl so cards in the same row share edges ── */}
        <div className="grid gap-6 xl:grid-cols-[1.75fr_0.95fr]">
            <div className="grid h-full gap-6 sm:grid-cols-2 xl:col-start-1 xl:row-start-1">
              {quickActions.map((action) => (
                <article
                  key={action.title}
                  onClick={() => navigate(action.path)}
                  className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer group border border-transparent hover:border-primary/20"
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

            {/* Recent activity (live), newest first; View All opens the full log. min-w-0: the one-line (truncated)
                details must not widen the grid column on phones. */}
            <section className="h-full min-w-0 rounded-2xl bg-white p-5 shadow-sm xl:col-start-1 xl:row-start-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Recent activity
                  </p>
                  <p className="mt-0.5 text-xs text-gray-light">
                    Your latest color analyses and profile changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/activity")}
                  className="relative shrink-0 text-xs font-semibold text-primary transition hover:text-primary-dark after:absolute after:-inset-3 after:content-['']"
                >
                  View All
                </button>
              </div>

              {recentLoading ? (
                <div role="status" aria-busy="true" className="space-y-3 py-1">
                  <span className="sr-only">Loading activity</span>
                  {[0, 1, 2].map((i) => (
                    <div key={i} aria-hidden="true" className="flex items-center gap-3">
                      <span className="skeleton h-7 w-7 shrink-0 rounded-lg" />
                      <span className="skeleton h-3.5 w-1/2 rounded" />
                    </div>
                  ))}
                </div>
              ) : recent.entries.length === 0 ? (
                <div className="rounded-xl bg-primary-lightest/60 px-4 py-6 text-center">
                  <p className="text-sm text-gray">
                    {recent.error ? "Couldn't load your activity right now." : "No activity yet."}
                  </p>
                  {!recent.error && (
                    <button
                      type="button"
                      onClick={() => navigate("/color-analysis")}
                      className="mt-2 text-xs font-semibold text-primary transition hover:text-primary-dark"
                    >
                      Start a color analysis
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile: stacked rows, no horizontal scroll */}
                  <ul className="divide-y divide-primary/5 sm:hidden">
                    {recent.entries.map((entry) => {
                      const { title, details } = describeActivity(entry);
                      const date = toDate(entry.at);
                      return (
                        <li key={entry.id} className="flex items-start gap-3 py-3">
                          <ActivityIcon entry={entry} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-black">{title}</p>
                            {details[0] && (
                              <p className="truncate text-xs text-gray">
                                {details[0]}
                                {details.length > 1 ? ` +${details.length - 1} more` : ""}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-gray-light">
                              {date ? (
                                <time dateTime={date.toISOString()} title={formatExact(date)}>{formatRelative(date, now)}</time>
                              ) : (
                                "Time not recorded"
                              )}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Tablet/desktop: table */}
                  <div className="hidden sm:block">
                    <div className="grid grid-cols-[1.3fr_1.7fr_1fr] gap-3 px-4 py-3 text-xs uppercase tracking-[0.2em] text-gray-light">
                      <span>Activity</span>
                      <span>Details</span>
                      <span>When</span>
                    </div>
                    <ul className="divide-y divide-primary/5">
                      {recent.entries.map((entry) => {
                        const { title, details } = describeActivity(entry);
                        const date = toDate(entry.at);
                        return (
                          <li key={entry.id} className="grid grid-cols-[1.3fr_1.7fr_1fr] items-center gap-3 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2 text-sm text-black">
                              <ActivityIcon entry={entry} />
                              <span className="min-w-0">{title}</span>
                            </div>
                            <div className="min-w-0 text-xs text-gray">
                              {details.length ? (
                                <span className="line-clamp-2" title={details.join(" · ")}>{details.join(" · ")}</span>
                              ) : (
                                <span className="text-gray-light">-</span>
                              )}
                            </div>
                            <div className="text-sm text-gray">
                              {date ? (
                                <time dateTime={date.toISOString()} title={formatExact(date)}>{formatRelative(date, now)}</time>
                              ) : (
                                "Not recorded"
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}
            </section>

            {/* Dynamic Color Profile */}
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#1F2937] p-6 shadow-lg text-white xl:col-start-2 xl:row-start-1">
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
                          <ColorTooltip key={color} hex={color} variant="light">
                            <div
                              className="group relative flex h-12 w-12 cursor-default items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/10 transition-all duration-300 hover:scale-110 hover:shadow-md hover:ring-white/40"
                            >
                              <span
                                className="absolute inset-[3px] rounded-full shadow-inner transition-transform duration-300 group-hover:scale-105"
                                style={{ backgroundColor: color }}
                              >
                                <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
                              </span>
                            </div>
                          </ColorTooltip>
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
                            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">Your skin tone</p>
                          </div>
                        </div>
                        <ColorTooltip hex={skinHex} name={getSkinToneName(skinHex)} variant="light">
                          <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-sm font-bold text-[#C084FC] shadow-sm">
                            {getSkinToneName(skinHex)}
                          </span>
                        </ColorTooltip>
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
            <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm xl:col-start-2 xl:row-start-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Skin Profile
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.25em] text-gray">
                    Diagnosis
                  </p>
                </div>
                <span className="rounded-full bg-primary-lighter px-3 py-1 text-xs font-semibold text-primary capitalize shadow-inner">
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

              <div className="mb-5">
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
                className="group mt-auto flex items-center justify-center gap-2 w-full text-sm font-bold text-white bg-[#2D1B4E] hover:bg-[#1A0F2E] py-3 rounded-xl transition-all duration-300 shadow-md hover:shadow-[0_8px_20px_rgba(45,27,78,0.25)] hover:-translate-y-0.5"
              >
                Update Profile Data
                <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </section>
        </div>
      </div>
    </main>
  );
}