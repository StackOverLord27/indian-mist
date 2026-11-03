import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const ARTIFACTS = path.resolve(process.cwd(), "e2e-artifacts");

// End-to-end payment tests in a real browser, against the local app, a LOCAL throwaway database
// and Razorpay TEST MODE. See e2e/README.md. Run with: npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  outputDir: path.join(ARTIFACTS, "results"),
  reporter: [["list"], ["html", { outputFolder: path.join(ARTIFACTS, "report"), open: "never" }]],
  // Every scenario reseeds the same local database, so they run one at a time
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "node e2e/serve.mjs",
    url: `http://localhost:${PORT}/api/settings`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    stdout: "pipe",
  },
});
