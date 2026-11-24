import { defineConfig } from "vitest/config";

// Vitest runs only the tests kept in __tests__/ folders. The older src/utils/*.test.js files use node:test
// (npm run test:unit) and tests*/ hold Playwright specs, so neither is picked up here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.js"],
  },
});
