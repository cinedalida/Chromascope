import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account or using Chromascope, you agree to these Terms of Service. If you do not agree, please do not use the app.",
  },
  {
    title: "2. What Chromascope Does",
    body: "Chromascope provides skin-tone color analysis, recommends products suited to your skin type, concerns, and ingredients-to-avoid using a dermatologist-supported algorithm and content, and lets you simulate colors and makeup on your face through AR simulation.",
  },
  {
    title: "3. Not a Replacement for Dermatologists",
    body: "Chromascope is not made to replace dermatologists. Its results are informational and are not medical, dermatological, or professional advice. It does not diagnose, treat, or prevent any skin condition. For skin concerns, allergies, or reactions, consult a licensed dermatologist.",
  },
  {
    title: "4. Your Account",
    body: "You are responsible for keeping your login credentials secure and for all activity under your account. Account access is managed through our authentication provider (Firebase Authentication).",
  },
  {
    title: "5. Acceptable Use",
    body: "You agree not to misuse the app, attempt to access accounts or data that are not yours, or use Chromascope's analysis features for any unlawful purpose.",
  },
  {
    title: "6. No Warranty",
    body: "Chromascope is provided \"as is.\" Color analysis and product recommendations are generated automatically and may not be fully accurate for every skin tone, lighting condition, or device camera.",
  },
  {
    title: "7. Changes to These Terms",
    body: "We may update these Terms from time to time. Continued use of the app after changes take effect means you accept the updated Terms.",
  },
  {
    title: "8. Contact",
    body: "Questions about these Terms can be directed to the Chromascope research team via the project's GitHub repository.",
  },
];

export function TermsOfServicePage() {
  return (
    <main className="min-h-dvh bg-primary-lightest font-body">
      <SplashNavbar />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-black sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray">
          These Terms of Service govern your use of Chromascope. Please read them carefully
          before creating an account or using the app.
        </p>

        <div className="mt-12 space-y-8">
          {sections.map(({ title, body }) => (
            <article key={title}>
              <h2 className="font-heading text-xl font-semibold text-black">{title}</h2>
              <p className="mt-2 leading-relaxed text-gray">{body}</p>
            </article>
          ))}
        </div>
      </div>

      <SplashFooter />
    </main>
  );
}
