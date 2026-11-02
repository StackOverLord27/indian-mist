import { defineConfig } from "vitest/config";

// Three separate vitest PROCESSES (see the test:live:cold script) so the delete step runs in a
// process that has never uploaded anything: a cold server instance. Real Cloudinary, confined
// to the folder indian-mist-test/prompt5/.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["tests/live-cold/**/*.step.ts"],
    setupFiles: ["tests/live/setup.ts"],
    testTimeout: 60000,
    fileParallelism: false,
  },
});
