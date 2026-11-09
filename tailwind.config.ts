import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#ecf7f1", 100: "#d2ecdd", 200: "#a6d9bc", 500: "#1f8a55", 600: "#156e43", 700: "#0f5735", 800: "#0b4229", 900: "#072d1c" },
        navy: { 50: "#eef2f8", 100: "#d6e0ee", 500: "#2c4a7a", 600: "#1f3a66", 700: "#172c4f", 800: "#10203b", 900: "#0a1528" },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Nyala", "Ebrima", "Noto Sans Ethiopic", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
