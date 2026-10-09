import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  outputDir: process.env.PERFORMANCE_AUDIT
    ? "performance-results"
    : "test-results",
  workers: process.env.PERFORMANCE_AUDIT ? 1 : undefined,
  testDir: "./tests",
  testMatch: process.env.PERFORMANCE_AUDIT
    ? "**/performance.audit.ts"
    : "**/*.spec.ts",
  timeout: 45_000,
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node node_modules/vite/bin/vite.js --host 127.0.0.1",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL,
    baseURL: process.env.BASE_URL || "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
