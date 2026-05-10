/**
 * RegisterForm — FUTURE USE (AuthPage)
 *
 * New user registration form (name, email, password).
 * Will call authService.register() and auto-login on success.
 * Add a tab or toggle in AuthPage to switch between LoginForm and RegisterForm.
 */
export function RegisterForm() {
  return (
    <form className="space-y-4 rounded-3xl bg-slate-900 p-5 text-slate-200">
      <label className="block text-sm">
        Name
        <input type="text" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="Full name" />
      </label>
      <label className="block text-sm">
        Email
        <input type="email" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="you@example.com" />
      </label>
      <button type="submit" className="w-full rounded-full bg-purple-600 py-3 text-white">Register</button>
    </form>
  );
}
