import { defineConfig } from "vitest/config";

// Vitest runs only the tests kept in __tests__/ folders: the app's (src/) and the replay harness's
// (../tools/replay/). The older src/utils/*.test.js files use node:test (npm run test:unit) and tests*/
// hold Playwright specs, so neither is picked up here. Component tests opt into jsdom per file.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.js", "../tools/replay/__tests__/**/*.test.js"],
  },
});
