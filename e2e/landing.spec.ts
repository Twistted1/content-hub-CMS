import { test, expect } from "@playwright/test";

test.describe("Landing page (unauthenticated)", () => {
  test("loads and links to sign in / sign up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign Up" }).first()).toBeVisible();
  });

  test("Login link navigates to the sign-in tab", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Login" }).first().click();
    await expect(page).toHaveURL(/\/auth\?tab=signin/);
    await expect(page.getByRole("heading", { name: "Welcome to Content Hub" })).toBeVisible();
  });

  test("visiting a protected route while signed out redirects to /auth", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  });
});
