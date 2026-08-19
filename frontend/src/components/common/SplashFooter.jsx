import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";

// lucide-react no longer ships brand/logo marks (Github, Twitter, etc.), so the
// GitHub icon is inlined here instead of imported.
function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.44-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.26 5.67.42.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}

const researchers = [
  "Francine Ysabel B. Dalida",
  "Jan Lorenze B. Escander",
  "Marti Kier V. Trance",
];

const GITHUB_URL = "https://github.com/cinedalida/Chromascope";

// Static footer for the SplashPage.
export function SplashFooter() {
  const navigate = useNavigate();

  return (
    <footer className="relative z-10 bg-white px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="font-heading text-lg font-bold text-primary">
              Chromascope
            </span>
            <span className="border-l border-gray-lighter pl-2 text-xs text-gray-light">
              © 2026 Bulgogi
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-gray-lighter px-4 py-2 text-xs font-semibold text-gray transition-colors hover:border-primary hover:text-primary"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
            <button
              onClick={() => navigate("/user-manual")}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-primary-light px-4 py-2 text-xs font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary-dark hover:shadow-md hover:shadow-primary/20"
            >
              <BookOpen className="h-4 w-4" />
              User Manual
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-gray sm:text-left">
          Research Team: {researchers.join(" · ")}
        </div>
      </div>
    </footer>
  );
}
