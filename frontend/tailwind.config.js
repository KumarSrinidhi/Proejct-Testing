export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Dark base palette
        surface: {
          DEFAULT: "#0d1117",
          1: "#161b22",
          2: "#1c2433",
          3: "#21293a",
          4: "#2d3748",
        },
        // Cyan accent
        cyan: {
          DEFAULT: "#00d4ff",
          50: "#e0fbff",
          100: "#b3f5ff",
          200: "#7eedff",
          300: "#00d4ff",
          400: "#00b8e0",
          500: "#009cbe",
          600: "#007a96",
        },
        // Violet secondary
        violet: {
          DEFAULT: "#8b5cf6",
          50: "#f3f0ff",
          100: "#ede9fe",
          200: "#c4b5fd",
          300: "#a78bfa",
          400: "#8b5cf6",
          500: "#7c3aed",
          600: "#6d28d9",
        },
        // Status colors
        emerald: {
          DEFAULT: "#10b981",
          400: "#34d399",
          500: "#10b981",
        },
        rose: {
          DEFAULT: "#f43f5e",
          400: "#fb7185",
          500: "#f43f5e",
        },
        amber: {
          DEFAULT: "#f59e0b",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        // Text
        "text-primary": "#e2e8f0",
        "text-secondary": "#94a3b8",
        "text-muted": "#64748b",
        // Borders
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          bright: "rgba(255,255,255,0.16)",
        },
      },
      backgroundImage: {
        "grad-dark": "linear-gradient(135deg, #0d1117 0%, #0f172a 50%, #0d1117 100%)",
        "grad-cyan": "linear-gradient(135deg, #00d4ff, #0099cc)",
        "grad-violet": "linear-gradient(135deg, #8b5cf6, #6d28d9)",
        "grad-emerald": "linear-gradient(135deg, #10b981, #059669)",
        "glow-cyan": "radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)",
        "glow-violet": "radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        glass: "0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        glow: "0 0 20px rgba(0,212,255,0.3), 0 0 40px rgba(0,212,255,0.1)",
        "glow-violet": "0 0 20px rgba(139,92,246,0.3), 0 0 40px rgba(139,92,246,0.1)",
        "glow-emerald": "0 0 20px rgba(16,185,129,0.3)",
        float: "0 20px 60px rgba(0,0,0,0.5)",
        card: "0 1px 3px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.2)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        display: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in": "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
        shimmer: "shimmer 1.5s infinite",
        glow: "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,212,255,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(0,212,255,0.6)" },
        },
      },
    },
  },
  plugins: [],
};
