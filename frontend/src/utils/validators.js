/**
 * validators — FUTURE USE (AuthPage / ProfilePage / forms)
 *
 * Lightweight input validation utilities shared across all form components.
 * isHexColor() validates swatch/palette color inputs in color editing tools.
 * validateEmail() is used in LoginForm and RegisterForm before form submission.
 * Extend with more validators (e.g. validatePassword, validateDate) as needed.
 */
export function isHexColor(value) {
  return /^#[0-9A-F]{6}$/i.test(value);
}

export function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
