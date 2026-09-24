import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account or using Chromascope, you agree to these Terms of Service. If you do not agree, please do not use the app.",
  },
  {
    title: "2. What Chromascope Does",
    body: "Chromascope provides skin-tone color analysis, AR makeup try-on, and ingredient-safety filtering based on the skin type, concerns, and ingredients-to-avoid you provide during onboarding. Results are informational and are not medical, dermatological, or professional advice.",
  },
  {
    title: "3. Your Account",
    body: "You are responsible for keeping your login credentials secure and for all activity under your account. Account access is managed through our authentication provider (Firebase Authentication).",
  },
  {
    title: "4. Acceptable Use",
    body: "You agree not to misuse the app, attempt to access accounts or data that are not yours, or use Chromascope's analysis features for any unlawful purpose.",
  },
  {
    title: "5. No Warranty",
    body: "Chromascope is provided \"as is.\" Color analysis and product recommendations are generated automatically and may not be fully accurate for every skin tone, lighting condition, or device camera.",
  },
  {
    title: "6. Changes to These Terms",
    body: "We may update these Terms from time to time. Continued use of the app after changes take effect means you accept the updated Terms.",
  },
  {
    title: "7. Contact",
    body: "Questions about these Terms can be directed to the Chromascope research team via the project's GitHub repository.",
  },
];

export function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#FAF4FF] font-body">
      <SplashNavbar />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <h1 className="font-heading text-4xl font-black tracking-tight text-black sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray">
          This is placeholder Terms of Service text for Chromascope, pending formal legal
          review. It describes how the app works today and will be replaced with finalized
          legal language before a public launch.
        </p>

        <div className="mt-12 space-y-8">
          {sections.map(({ title, body }) => (
            <article key={title}>
              <h2 className="font-heading text-xl font-bold text-black">{title}</h2>
              <p className="mt-2 leading-relaxed text-gray">{body}</p>
            </article>
          ))}
        </div>
      </div>

      <SplashFooter />
    </main>
  );
}
