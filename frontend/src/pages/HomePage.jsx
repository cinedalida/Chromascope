import { useUserStore } from "../store/userStore";

const quickActions = [
  {
    title: "Start Color Analysis",
    description:
      "Discover your seasonal palette with AI-driven spectral scanning.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-primary"
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
    accent: "bg-primary-light text-primary",
  },
  {
    title: "Scan Ingredient",
    description:
      "Molecular breakdown of skincare components for allergen safety.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-primary"
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
    accent: "bg-primary-light text-primary",
  },
  {
    title: "Open Try-On",
    description:
      "Hyper-realistic AR visualization of clinical makeup suggestions.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-primary"
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
    accent: "bg-secondary-light text-secondary",
  },
  {
    title: "View Palette",
    description: "Access your clinical color vault and curated shade matches.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-primary"
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
    accent: "bg-primary-light text-primary",
  },
];

const recentSessions = [
  {
    type: "Full Color Profile",
    date: "Oct 12, 2023",
    result: "True Winter",
    status: "Analyzed",
    badge: "badge-primary",
  },
  {
    type: "Ingredient Scan",
    date: "Oct 10, 2023",
    result: "Sulfates Found",
    status: "Analyzed",
    badge: "badge-danger",
  },
  {
    type: "AR Try-On",
    date: "Oct 08, 2023",
    result: "Cool Tones",
    status: "Saved",
    badge: "badge-secondary",
  },
];

const restrictedIngredients = ["Parabens", "Sulfates", "Fragrance"];

export function HomePage() {
  const user = useUserStore((state) => state.user);
  const displayName = user?.fullName || user?.name || "";
  const firstName = displayName ? displayName.split(" ")[0] : "";
  const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : "U";

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
          {/* Full-bleed background image */}
          <img
            src="/src/assets/images/home-page-img.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/80" />

          {/* Content */}
          <div className="relative z-10 flex h-full flex-col gap-6 px-8 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <span className="inline-flex w-fit rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-white backdrop-blur-sm">
                True Winter
              </span>
              <div className="mt-8">
                <p className="mb-1 text-xs uppercase tracking-[0.3em] text-white/70">
                  Clinical report
                </p>
                <h2 className="text-4xl font-heading font-black tracking-tight text-white sm:text-5xl">
                  Good day{firstName ? `, ${firstName}` : ""}!
                </h2>
                <p className="mt-2 text-base text-white/70 sm:text-lg">
                  Your personalized clinical report is ready for review.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </button>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a9 9 0 0 0 0 18" />
                  <path d="M12 2a9 9 0 0 1 0 18" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.75fr_0.95fr]">
          {/* ── Left Column ── */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid gap-4 sm:grid-cols-2">
              {quickActions.map((action) => (
                <article
                  key={action.title}
                  className="rounded-xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${action.accent}`}
                  >
                    {action.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-black">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-gray">
                    {action.description}
                  </p>
                </article>
              ))}
            </div>

            {/* Session History */}
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

              <div className="overflow-x-auto rounded-xl bg-white">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-[1.8fr_1fr_1fr_0.8fr] gap-3 px-4 py-3 text-xs uppercase tracking-[0.2em] text-gray-light">
                    <span>Session Type</span>
                    <span>Date</span>
                    <span>Result</span>
                    <span>Status</span>
                  </div>
                  <div className="divide-y divide-primary/5">
                  {recentSessions.map((session) => (
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
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${session.badge}`}
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
            {/* Color Profile */}
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-2xl font-black text-primary shadow-sm">
                  {firstLetter}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-gray">
                    Your Color Profile
                  </p>
                  <p className="mt-2 text-xl font-semibold text-black">
                    True Winter
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-light">
                    Primary Season
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {[
                  "#000000",
                  "#FFFFFF",
                  "#0033A0",
                  "#C30B17",
                  "#7C00C0",
                  "#2D52B2",
                ].map((color) => (
                  <div
                    key={color}
                    className="group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:scale-110 hover:shadow-md"
                  >
                    <span
                      className="absolute inset-[3px] rounded-full shadow-inner transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundColor: color }}
                    >
                      {/* Premium shine and inner rim */}
                      <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/25 to-transparent" />
                      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/10" />
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Skin Profile */}
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-black">
                    Skin Profile
                  </p>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.25em] text-gray">
                    Diagnosis
                  </p>
                </div>
                <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                  Combination Skin
                </span>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-gray">
                  Restricted Ingredients
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {restrictedIngredients.map((ingredient) => (
                    <span key={ingredient} className="badge badge-danger">
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary mt-5 w-full text-sm">
                Update Profile
              </button>
            </section>

            {/* Clinical Tip */}
            <section className="rounded-xl bg-primary-lightest p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Clinical Tip
              </p>
              <p className="mt-2 text-sm leading-6 text-gray">
                "Winter skin requires deep hydration with hyaluronic acid based
                on your molecular profile."
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
