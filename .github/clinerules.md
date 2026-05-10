# Chromascope — Cline Rules

## Project Stack

- React + Vite
- Tailwind CSS with custom design system in tailwind.config.js
- React Router v6
- Zustand for state management

## Design System Rules

ALWAYS follow these — never override them:

### Fonts

- Headings h1–h6: font-heading (MuseoModerno)
- Body, buttons, inputs, labels: font-body (Google Sans Flex)
- Never use any other font family

### Colors

Never hardcode hex values. Use only Tailwind tokens from tailwind.config.js:

- Primary: text-primary, bg-primary, border-primary
- Primary dark: text-primary-dark, bg-primary-dark
- Primary light: text-primary-light, bg-primary-light
- Secondary: text-secondary, bg-secondary
- Grays: text-gray, text-gray-light, bg-gray-lightest

### Spacing & Radius

Use only Tailwind spacing and radius tokens — no arbitrary values like p-[13px].
Allowed arbitrary use: only for one-off layout values not in the scale.

### Component Classes

Reuse @layer components classes from src/styles/globals.css:
.btn-primary, .btn-secondary, .btn-outline, .btn-ghost
.card, .card-glass, .card-hover
.badge-purple, .badge-success, .badge-warning, .badge-danger
.input, .tag, .spinner, .progress

### Never Do This

- No hardcoded hex colors
- No inline style={{ color: '#7700CF' }} unless value is dynamic
- No arbitrary Tailwind values for colors e.g. text-[#7700CF]
- No new CSS files — all styles go through Tailwind or globals.css @layer

## File Structure

src/
pages/ ← one file per screen
components/ ← grouped by feature (common, auth, onboarding, etc.)
hooks/ ← useColorAnalysis, useARCamera, etc.
services/ ← API calls (colorAnalysisService, productService, etc.)
store/ ← Zustand stores (userStore, analysisStore, productStore)
utils/ ← colorConversion, deltaE, imagePreprocessing, validators
routes/ ← AppRouter, ProtectedRoute, AdminRoute
styles/ ← globals.css, tailwind.config.js, variables.css (fonts only)
assets/ ← images/, icons/, fonts/

## Behavior Rules

- Before editing any file, read it first
- Make the smallest change that solves the problem
- After editing, check for broken imports
- Never delete files without confirming first
- Always preserve existing component logic when only fixing styles
- Run npm run dev mentally — if your change would break a build, fix it first
