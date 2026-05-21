import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0fdfa",   // teal-50
          100: "#ccfbf1",   // teal-100
          500: "#14b8a6",   // teal-500
          600: "#0d9488",   // teal-600
          700: "#0f766e",   // teal-700
        },
        accent: {
          500: "#f59e0b",   // amber-500 (acentos secundarios)
          600: "#d97706",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
