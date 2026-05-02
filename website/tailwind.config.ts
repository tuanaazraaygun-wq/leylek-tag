import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          violet: "#6C63FF",
          orange: "#FF7A18",
        },
        midnight: "#07111f",
        ink: "#0b1526",
        leylek: {
          50: "#ecfeff",
          100: "#cffafe",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        violetGlow: "#8b5cf6",
      },
      boxShadow: {
        glow: "0 0 60px rgba(34, 211, 238, 0.2)",
        "soft-card": "0 24px 80px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)",
        "gradient-secondary": "linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)",
        "gradient-hero":
          "linear-gradient(165deg, #0a1628 0%, #0d2d52 45%, #1a1240 100%)",
        "radial-glow":
          "radial-gradient(circle at top left, rgba(34, 211, 238, 0.28), transparent 32%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.22), transparent 28%)",
      },
      animation: {
        "fade-in-up": "fade-in-up 0.65s ease-out forwards",
        "slow-float": "slow-float 7s ease-in-out infinite",
        "pulse-soft": "pulse-soft 3s ease-in-out infinite",
        "feed-slide": "feed-slide 18s linear infinite",
        "scan-map": "scan-map 5s linear infinite",
        "scan-map-premium": "scan-map-premium 9s linear infinite",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slow-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        "feed-slide": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" },
        },
        "scan-map": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "12%": { opacity: "1" },
          "88%": { opacity: "1" },
          "100%": { transform: "translateY(620px)", opacity: "0" },
        },
        "scan-map-premium": {
          "0%": { transform: "translateY(-115%)", opacity: "0" },
          "14%": { opacity: "1" },
          "86%": { opacity: "1" },
          "100%": { transform: "translateY(560px)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
