/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["MuseoModerno", "serif"],
        body: ["Google Sans Flex", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#7700CF",
          dark: "#5500A0",
          darker: "#3D007A",
          light: "#F4E5FF",
          lightest: "#FAF4FF",
        },
        secondary: {
          DEFAULT: "#BA6CF4",
          dark: "#9B4DD4",
          light: "#FAF4FF",
        },
        black: "#121212",
        gray: {
          DEFAULT: "#575654",
          light: "#8A8A88",
          lighter: "#D1D1CF",
          lightest: "#F5F5F4",
        },
        white: "#FFFFFF",
        success: "#1D9E75",
        warning: "#BA7517",
        danger: "#A32D2D",
        info: "#185FA5",
      },
      spacing: {
        18: "72px",
        22: "88px",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(119,0,207,0.08)",
        md: "0 4px 16px rgba(119,0,207,0.12)",
        lg: "0 8px 32px rgba(119,0,207,0.18)",
        xl: "0 16px 48px rgba(119,0,207,0.22)",
        card: "0 2px 12px rgba(18,18,18,0.08)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        scan: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(240px)" },
        },
      },
      animation: {
        scan: "scan 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
