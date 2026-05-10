/**
 * LoginForm — FUTURE USE (AuthPage)
 *
 * Extracts the inline login form from AuthPage into a reusable component.
 * Will call authService.login() and update userStore on success.
 * AuthPage currently renders this inline — refactor AuthPage to use this component.
 */
export function LoginForm() {
  return (
    <form className="space-y-4 rounded-3xl bg-slate-900 p-5 text-slate-200">
      <label className="block text-sm">
        Email
        <input type="email" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="you@example.com" />
      </label>
      <label className="block text-sm">
        Password
        <input type="password" className="mt-2 w-full rounded-2xl bg-slate-800 p-3 text-white" placeholder="••••••••" />
      </label>
      <button type="submit" className="w-full rounded-full bg-purple-600 py-3 text-white">Log in</button>
    </form>
  );
}
