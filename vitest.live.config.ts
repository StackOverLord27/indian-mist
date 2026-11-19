import { defineConfig } from "vitest/config";

// Opt-in suite against REAL services (Upstash, Cloudinary, Razorpay Test Mode).
// Run with: npm run test:live. Never part of `npm test`.
export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["tests/live/**/*.live.ts"],
    setupFiles: ["tests/live/setup.ts"],
    testTimeout: 40000,
    fileParallelism: false,
  },
});
