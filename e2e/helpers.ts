import * as fs from "fs";
import { expect, type Page } from "@playwright/test";
import { AUTH_STATE_PATH, type E2EAuthState } from "./global-setup";

export function readAuthState(): E2EAuthState {
  return JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf-8"));
}

export async function loginViaUI(page: Page, state: E2EAuthState) {
  await page.goto("/auth?tab=signin");
  await page.getByLabel("Email", { exact: true }).fill(state.email);
  await page.getByLabel("Password", { exact: true }).fill(state.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  try {
    await expect(page.getByText("Logout")).toBeVisible({ timeout: 15_000 });
  } catch (err) {
    const url = page.url();
    const toastText = await page
      .getByRole("status")
      .allTextContents()
      .catch(() => ["<could not read toast>"]);
    const bodyText = await page
      .locator("body")
      .innerText()
      .then((t) => t.slice(0, 500))
      .catch(() => "<could not read body>");
    console.error(
      `[e2e] loginViaUI failed for ${state.email}. URL: ${url}. Toast: ${JSON.stringify(
        toastText
      )}. Body snippet: ${bodyText}`
    );
    throw err;
  }
}
