import { useNavigate } from "react-router-dom";
import { ArrowLeft, Palette, Camera, FlaskConical, ShoppingBag, UserCog } from "lucide-react";
import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";

const sections = [
  {
    icon: UserCog,
    title: "1. Set up your profile",
    body: "Create an account and complete onboarding: tell Chromascope your skin type and any ingredients or concerns to watch out for. This profile powers every recommendation the app makes for you.",
  },
  {
    icon: Palette,
    title: "2. Run your color analysis",
    body: "Head to Color Analysis to map your undertone, contrast, and depth. Chromascope places you within the 12-season framework and shows your palette, your sister season, and your contrast season.",
  },
  {
    icon: Camera,
    title: "3. Try products on with AR",
    body: "Open Try-On to visualize makeup shades on your own face in real time, right from your camera, before you commit to a product.",
  },
  {
    icon: FlaskConical,
    title: "4. Filter for safety",
    body: "Use the Ingredient Filter to screen products against your restrictions and skin concerns. Flagged ingredients are called out so you can make an informed choice.",
  },
  {
    icon: ShoppingBag,
    title: "5. Browse the catalog",
    body: "Explore the Product Catalog, organized by season and safety status, to find products that already match your profile.",
  },
];

export function UserManualPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#FAF4FF] font-body">
      <SplashNavbar />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <button
          onClick={() => navigate("/")}
          className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary-dark"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to home
        </button>

        <h1 className="font-heading text-4xl font-black tracking-tight text-black sm:text-5xl">
          User Manual
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray">
          A quick walkthrough of how to get the most out of Chromascope, from your first
          color analysis to finding products you can trust.
        </p>

        <div className="mt-12 space-y-6">
          {sections.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="flex gap-5 rounded-lg bg-white p-6 shadow-sm"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-bold text-black">{title}</h2>
                <p className="mt-1 leading-relaxed text-gray">{body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-gray-lighter pt-6">
          <span className="text-sm font-medium text-gray">Legal:</span>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Privacy Policy
          </a>
        </div>
      </div>

      <SplashFooter />
    </main>
  );
}
