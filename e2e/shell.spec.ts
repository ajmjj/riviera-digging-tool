import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Foundation flow: the PWA shell loads through the proxy and reaches the backend.
// Visual-regression screenshots start with the first main screen (003, Dig); until then
// there is no main screen to snapshot.

test("the shell loads and reports the backend as reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Riviera Dig");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Riviera Dig");
  await expect(page.getByRole("status")).toHaveText("Backend reachable");
});

test("the shell links an installable PWA manifest", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("application/manifest+json");
});

test("the shell has no serious or critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
