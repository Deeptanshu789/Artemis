import { test, expect } from "@playwright/test";

test("has title and loads login page", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Artemis/);

  // The page should have a sign-in heading or form
  const heading = page.getByRole("heading", { name: /Sign In/i });
  await expect(heading).toBeVisible();
});
