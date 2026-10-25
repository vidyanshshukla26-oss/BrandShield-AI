import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#101B33",
        royal: "#4169E1",
        teal: "#12B8A6",
        ink: "#172033",
        muted: "#65728A",
        canvas: "#F6F8FC",
      },
      boxShadow: { soft: "0 10px 32px rgba(16,27,51,0.08)" },
    },
  },
  plugins: [],
};

export default config;
