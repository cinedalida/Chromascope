/**
 * PatientProfileForm — FUTURE USE (OnboardingPage)
 *
 * Full multi-section profile form for new users: name, DOB, Fitzpatrick type, allergens, focus areas.
 * OnboardingPage is currently a stub — build it out using this component.
 * On submit, calls userStore.updateProfile() and navigates to /home.
 */
export function PatientProfileForm() {
  return (
    <form className="space-y-4 rounded-3xl bg-slate-900 p-5 text-slate-200">
      <label className="block text-sm">
        Birthday
        <input className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" />
      </label>
    </form>
  );
}
