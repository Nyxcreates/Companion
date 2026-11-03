import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/context/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy flat aliases — kept so existing pages keep working unchanged.
        space: "var(--bg-primary)",
        galaxy: "var(--accent-primary)",
        moon: "var(--text-primary)",
        aurora: "var(--accent-secondary)",
        emerald: "var(--accent-emerald)",
        sunset: "var(--accent-sunset)",
        rose: "var(--accent-rose)",
        gold: "var(--accent-gold)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",

        // Design-system tokens (use these in new components)
        surface: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          elevated: "var(--bg-elevated)",
        },
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent-primary)",
          primary: "var(--accent-primary)",
          secondary: "var(--accent-secondary)",
          emerald: "var(--accent-emerald)",
          sunset: "var(--accent-sunset)",
          rose: "var(--accent-rose)",
          gold: "var(--accent-gold)",
        },
        mood: {
          joy: "var(--mood-joy)",
          calm: "var(--mood-calm)",
          proud: "var(--mood-proud)",
          tender: "var(--mood-tender)",
          low: "var(--mood-low)",
          stressed: "var(--mood-stressed)",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.6" }],
        base: ["1rem", { lineHeight: "1.7" }],
        lg: ["1.125rem", { lineHeight: "1.6" }],
        xl: ["1.25rem", { lineHeight: "1.5" }],
        "2xl": ["1.5rem", { lineHeight: "1.4" }],
        "3xl": ["1.875rem", { lineHeight: "1.3" }],
        "4xl": ["2.25rem", { lineHeight: "1.2" }],
        "5xl": ["3rem", { lineHeight: "1.15" }],
      },
      spacing: {
        "gap-sm": "0.5rem",
        "gap-md": "1rem",
        "gap-lg": "1.5rem",
        "gap-xl": "2rem",
        "gap-2xl": "3rem",
      },
      borderRadius: {
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        card: "0 8px 32px rgba(0, 0, 0, 0.25)",
        float: "0 16px 48px rgba(0, 0, 0, 0.35)",
        glow: "0 0 40px rgba(124, 92, 255, 0.35)",
        modal: "0 24px 70px rgba(0, 0, 0, 0.5)",
      },
      backgroundImage: {
        "companion-gradient":
          "radial-gradient(circle at 20% 20%, rgba(124,92,255,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(94,231,224,0.15), transparent 40%), linear-gradient(180deg, var(--bg-primary) 0%, #0c0b1f 100%)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.03)" },
        },
      },
      animation: {
        breathe: "breathe 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;