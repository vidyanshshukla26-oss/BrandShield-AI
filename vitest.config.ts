import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "server-only": path.resolve(__dirname, "tests/server-only.ts") } },
  test: { environment: "node", globals: true, include: ["lib/**/*.test.ts", "tests/integration/**/*.test.ts"], exclude: ["tests/e2e/**"] },
});
