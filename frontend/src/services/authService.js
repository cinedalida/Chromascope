/**
 * authService — FUTURE USE (AuthPage)
 *
 * Handles user authentication: login (email/password) and new user registration.
 * On success, the returned user object should be saved to userStore via userStore.login().
 * Replace Promise.resolve stubs with real Firebase Auth / backend API calls.
 */
export async function login(credentials) {
  return Promise.resolve({ id: "user-1", name: "Chromascope User" });
}

export async function register(data) {
  return Promise.resolve({ id: "user-2", name: data.name });
}
