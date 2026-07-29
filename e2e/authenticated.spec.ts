import { test, expect } from "@playwright/test";
import { loginViaUI, readAuthState } from "./helpers";

const state = readAuthState();

test.describe("Authenticated flows", () => {
  test.skip(
    !state.authAvailable,
    "E2E_SUPABASE_SERVICE_ROLE_KEY not set — see .env.e2e.example to enable these specs."
  );

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, state);
  });

  test("sign in lands on the dashboard with a real greeting", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  });

  test("can sign out", async ({ page }) => {
    await page.getByText("Logout").click();
    await expect(page).toHaveURL(/\/auth|\/$/);
  });

  test("creating a template makes it appear in the templates list", async ({ page }) => {
    const templateName = `E2E Template ${Date.now()}`;

    await page.goto("/templates");
    await page.getByRole("button", { name: "Create Template" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("#name").fill(templateName);
    await dialog.locator("#description").fill("Created by Playwright E2E");
    await dialog.getByRole("button", { name: "Create Template" }).click();

    await expect(page.getByText(templateName)).toBeVisible({ timeout: 10_000 });
  });
});
