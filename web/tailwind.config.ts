import type { Config } from "tailwindcss";

/**
 * Color + type tokens extracted from design/quiver-prototype.html
 * (the single source of truth for UI/UX). Full token extraction into
 * design/tokens.ts happens in M2 alongside the 1:1 UI build.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050E10",
        "ink-2": "#081416",
        basin: "#0D1E21",
        "basin-2": "#122528",
        "basin-3": "#183034",
        stratum: "#1F393D",
        spring: "#3FE0AE",
        "spring-bright": "#6FF5CB",
        "spring-deep": "#2FCB9A",
        limestone: "#CBB891",
        silt: "#82989B",
        "silt-dark": "#546A6D",
        foam: "#EDF7F4",
        coral: "#F0705C",
        amber: "#E8B45A",
      },
      fontFamily: {
        // Real faces (Bricolage Grotesque / Albert Sans / IBM Plex Mono) are
        // self-hosted in M2; system stacks keep M0 builds hermetic.
        disp: ["system-ui", "sans-serif"],
        body: ["system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        sm: "9px",
        md: "13px",
        lg: "18px",
      },
    },
  },
  plugins: [],
};

export default config;
