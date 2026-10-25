import { expect, test } from "@playwright/test";

test("demo user can open the dashboard and review queue", async ({ page }) => {
  test.setTimeout(90_000);
  await page.request.post("/api/auth/demo");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Total submissions")).toBeVisible();
  await page.goto("/reviews");
  await expect(page.getByText("Reviewer inbox")).toBeVisible();
});
