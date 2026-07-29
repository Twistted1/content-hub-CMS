import { test, expect } from "@playwright/test";

test.describe("Auth form validation (unauthenticated)", () => {
  test("blocks submission for a malformed email via native browser validation", async ({ page }) => {
    await page.goto("/auth?tab=signin");
    const email = page.getByLabel("Email", { exact: true });
    await email.fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("whatever1");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // The input is type="email" + required, so the browser's own constraint
    // validation blocks the form before React's onSubmit runs — the zod
    // "Invalid email address" toast is unreachable for this input type and
    // never fires. Assert the behavior that's actually reachable: submission
    // is blocked and the field reports itself invalid.
    await expect(page).toHaveURL(/\/auth/);
    await expect(email).toHaveJSProperty("validity.valid", false);
  });

  test("rejects a short password on sign in", async ({ page }) => {
    await page.goto("/auth?tab=signin");
    await page.getByLabel("Email", { exact: true }).fill("someone@example.com");
    await page.getByLabel("Password", { exact: true }).fill("abc");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Password must be at least 6 characters", {
      timeout: 10_000,
    });
  });

  test("switching to the Sign Up tab shows the full name field", async ({ page }) => {
    await page.goto("/auth?tab=signup");
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeVisible();
  });
});
