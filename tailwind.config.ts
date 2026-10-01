import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Sampled from the Basma Society logo's red (#e4291d).
        brand: {
          50: "#fdf2f1",
          100: "#fbe1de",
          200: "#f7c3bd",
          300: "#f29b8f",
          400: "#ea6655",
          500: "#e4291d",
          600: "#c41f15",
          700: "#9e1912",
          800: "#7a130e",
          900: "#5c0f0b",
        },
      },
      fontFamily: {
        sans: ["var(--font-tajawal)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
