import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";

const sections = [
  {
    title: "1. What We Collect",
    body: "When you create an account, we collect your display name and email through Firebase Authentication. During onboarding, we collect your skin type, skin concerns, and ingredients you want to avoid.",
  },
  {
    title: "2. Your Photos",
    body: "Photos you submit for color analysis or AR try-on are processed in memory for that single request only. They are not saved to a database, file storage, or any long-term location. Only the numeric results of that analysis (such as your color-season classification) are saved to your profile.",
  },
  {
    title: "3. Where Your Data Lives",
    body: "Your account details and profile data (skin type, concerns, ingredient preferences, and analysis results) are stored in our Firestore database, protected by Firebase's standard infrastructure security. We do not apply additional custom encryption on top of this.",
  },
  {
    title: "4. How We Use Your Data",
    body: "Your profile data is used to power Chromascope's own features for you: personalized color analysis, product recommendations, and ingredient-safety filtering. We do not sell your data.",
  },
  {
    title: "5. Data Retention & Deletion",
    body: "If your account is inactive for 30 days, we permanently delete the profile and analysis-result data associated with it. You may also request deletion of your account and data at any time.",
  },
  {
    title: "6. Third-Party Services",
    body: "Chromascope uses Firebase (Authentication and Firestore) as its backend infrastructure provider. These services are subject to Google's own privacy and security practices.",
  },
  {
    title: "7. Changes to This Policy",
    body: "This is placeholder Privacy Policy text describing our current data practices, pending formal legal review. It may be updated as the app evolves.",
  },
  {
    title: "8. Contact",
    body: "Questions about this Privacy Policy can be directed to the Chromascope research team via the project's GitHub repository.",
  },
];

export function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FAF4FF] font-body">
      <SplashNavbar />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <h1 className="font-heading text-4xl font-black tracking-tight text-black sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray">
          This is placeholder Privacy Policy text for Chromascope, pending formal legal
          review. It reflects how the app actually handles your data today.
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
