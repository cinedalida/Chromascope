import { SplashNavbar } from "../components/common/SplashNavbar.jsx";
import { SplashFooter } from "../components/common/SplashFooter.jsx";

// Kept in line with the research manuscript (Sec. 3.7, 3.7.1 to 3.7.3, 4.5.1, 4.5.2) and with what the app does
// (backend/app/core/retention.py, DELETE /api/user/account). Update both together.
const LAST_UPDATED = "November 14, 2026";

const sections = [
  {
    title: "1. Who We Are",
    body: "Chromascope is a research prototype built by Computer Science students of De La Salle University-Dasmariñas, College of Information and Computer Studies, for the study \"Chromascope: An Intelligent System for Personal Color Analysis and Virtual Cosmetic Recommendation.\" The study was cleared by the Department Ethics Review Committee (DERC), and all data are handled in line with Republic Act No. 10173, the Data Privacy Act of 2012.",
  },
  {
    title: "2. What We Collect",
    body: "We collect only what each feature needs. When you create an account: your name and email address. During onboarding and in your Profile: your skin type, skin concerns, and the ingredients you want to avoid. After a color analysis: your color result (seasonal label, season confidence level, and skin color values). We also save the products and looks you add to Favorites, your agreement to this policy, and the dates you signed in and last used the app. Allergies, skin conditions, and pregnancy or breastfeeding status are health information, which the law treats as sensitive personal information.",
  },
  {
    title: "3. Your Photos and Camera",
    body: "Facial photos are never stored. A photo you upload or capture for color analysis is sent to our analysis server over an encrypted (HTTPS) connection, processed in memory, and discarded as soon as your result is returned. It is never written to disk, logged, saved to a database, or viewed by the researchers. The live camera feed for AR try-on is processed only on your device and is never recorded or sent anywhere.",
  },
  {
    title: "4. How We Use Your Data",
    body: "Your data is used only to run Chromascope's features for you: personal color analysis, ingredient safety filtering, product recommendations, and AR try-on. Your results come from AI models, may be wrong, and are recommendations, not medical advice. Chromascope does not replace a dermatologist.",
  },
  {
    title: "5. Where Your Data Is Stored and Who Can See It",
    body: "Your account data is stored in Cloud Firestore (Google Firebase) under your account. Every page of the app requires you to log in, and our database rules let each account read and write only its own records. Data is encrypted in transit and at rest. Access to study data is limited to the three researchers and the research adviser, whose accounts are protected by passwords and two-step verification. Study results are reported only as group-level figures, so no individual can be identified.",
  },
  {
    title: "6. Sharing",
    body: "We do not sell your data, and we do not share personal data with cosmetic brands, retailers, or advertisers. Recommendations are based only on color matching and ingredient compatibility, with no sponsored placements. The app runs on third-party infrastructure (Vercel for the web app, and Google Cloud and Firebase for the server, database, and sign-in), which process data only to provide these services.",
  },
  {
    title: "7. Data Retention and Deletion",
    body: "If your account is inactive for 30 days, your color result (seasonal label, season confidence level, and skin color values) is deleted automatically. Your account, skin profile, and ingredient choices are kept until you delete them. You can delete your whole account and all data saved with it at any time with the Delete Account button on your Profile page. All study data are kept only until data analysis is completed, and no later than December 31, 2027. After that, all accounts and their data are deleted and the app and server are shut down.",
  },
  {
    title: "8. Your Rights",
    body: "Under the Data Privacy Act of 2012, you may access, correct, or ask for deletion of your data. You can view and edit your skin profile at any time from the Profile page. Using Chromascope is voluntary, and you may withdraw your consent at any time by deleting your account.",
  },
  {
    title: "9. Data Breaches",
    body: "If a data breach occurs, the researchers will inform the affected users, the research adviser, and the DERC as soon as it is discovered, and will report it as required by the Data Privacy Act of 2012.",
  },
  {
    title: "10. Changes to This Policy",
    body: "If we change how Chromascope handles your data, we will update this page and the date at the top.",
  },
  {
    title: "11. Contact",
    body: "Questions or concerns about your data can be raised with the principal investigator or the research adviser, whose contact details are listed in the informed consent form.",
  },
];

export function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh bg-primary-lightest font-body">
      <SplashNavbar />

      <div className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-black sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray">Last updated: {LAST_UPDATED}</p>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray">
          This policy explains what Chromascope collects, why, how long it is kept, and how you
          can delete it.
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
