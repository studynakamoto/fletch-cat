import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pump: {
          bg: "#0b0e11",
          card: "#151a21",
          border: "#242c37",
          green: "#22c55e",
          red: "#ef4444",
          accent: "#7dd3fc",
        },
      },
    },
  },
  plugins: [],
};

export default config;
