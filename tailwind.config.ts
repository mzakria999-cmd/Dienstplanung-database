import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#0b1426", 900: "#0f1d36", 800: "#16294a", 700: "#1f3a66", 600: "#2b4f86" },
        shift: {
          f: "#22c55e", fbg: "#dcfce7", ftext: "#14532d",
          s: "#eab308", sbg: "#fef9c3", stext: "#713f12",
          n: "#f97316", nbg: "#ffedd5", ntext: "#7c2d12",
        },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
