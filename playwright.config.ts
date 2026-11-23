import { defineConfig } from "@playwright/test";

// End-to-end tests run against the full `docker compose` stack (external APIs mocked).
// Every flow runs at phone (390×844) and laptop (1440×900) size.
const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];

export default defineConfig({
  testDir: "e2e",
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:8080",
    browserName: "chromium",
    trace: "off",
    ...(executablePath === undefined ? {} : { launchOptions: { executablePath } }),
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    {
      name: "phone",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: "laptop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
