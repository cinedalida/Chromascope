# Chromascope — Copilot Instructions

## Design System

This project uses a custom design system. Always follow these rules:

### Fonts

- Headings (h1–h6): font-family: var(--font-heading) → 'MuseoModerno'
- Body, paragraphs, labels, inputs, buttons: font-family: var(--font-body) → 'Google Sans Flex'
- Never use Inter, Roboto, Arial, system-ui, or any other font family

### Colors

Never hardcode hex values. Always use CSS variables from src/styles/variables.css:

- Primary purple: var(--color-primary) → #7700CF
- Primary dark: var(--color-primary-dark) → #5500A0
- Primary light surface: var(--color-primary-light) → #F4E5FF
- Secondary: var(--color-secondary) → #BA6CF4
- Black: var(--color-black) → #121212
- Gray text: var(--color-gray) → #575654
- White: var(--color-white) → #FFFFFF
- Success/Warning/Danger/Info use their respective semantic variables

### Spacing

Always use spacing variables, never arbitrary px values:
var(--space-1) = 4px, --space-2 = 8px, --space-3 = 12px, --space-4 = 16px,
--space-6 = 24px, --space-8 = 32px, --space-12 = 48px, --space-16 = 64px

### Border Radius

var(--radius-xs) = 4px, --radius-sm = 8px, --radius-md = 12px,
--radius-lg = 16px, --radius-xl = 24px, --radius-full = 9999px

### Shadows

var(--shadow-sm), --shadow-md, --shadow-lg, --shadow-xl, --shadow-card

### Transitions

var(--transition-fast) = 150ms ease
var(--transition-base) = 250ms ease
var(--transition-spring) = 300ms cubic-bezier(0.34, 1.56, 0.64, 1)

### Z-index

var(--z-base/raised/dropdown/sticky/overlay/modal/toast)

## Component Classes

Reuse existing classes from src/styles/components.css before writing new CSS:

- Buttons: .btn .btn-primary .btn-secondary .btn-outline .btn-ghost .btn-sm .btn-lg
- Badges: .badge .badge-purple .badge-success .badge-warning .badge-danger .badge-gray
- Cards: .card .card-surface .card-elevated .card-glass .card-hover
- Inputs: .input .input-label .input-error .input-hint
- Tags: .tag .tag-removable
- Feedback: .spinner .spinner-sm .spinner-lg .progress .progress-fill
- Typography: .heading-hero .heading-section .text-label .text-caption

## Rules

- Never use inline styles unless absolutely necessary for dynamic values
- Never hardcode colors, spacing, or font names — always use variables
- Always import component styles from the design system before writing new CSS
- If a component class already exists in components.css, use it — don't recreate it
- Glass effect: background var(--glass-bg), backdrop-filter var(--glass-blur), border var(--glass-border)
