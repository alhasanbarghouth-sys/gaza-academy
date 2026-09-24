import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf3",
          100: "#d6f5e1",
          200: "#aeebc7",
          300: "#7adba8",
          400: "#45c186",
          500: "#22a56c",
          600: "#158556",
          700: "#136a47",
          800: "#12543a",
          900: "#104631",
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
