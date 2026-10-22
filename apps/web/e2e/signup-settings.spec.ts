import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, signup } from "./helpers";

// The deployment settings are stubbed: the suite shares one deployment, and a real
// allowlist would stop every later test from signing up.
test("the deployment owner chooses who can sign up", async ({ page }, testInfo) => {
  await signup(page, `signup-settings-${Date.now()}@rakazo.test`, "password12", "Owner");
  await completeOnboarding(page);
  const deployment = {
    ownerUserId: null,
    signupsEnabled: true,
    signupAllowlist: ["owner@example.com"],
    signupAllowlistFromEnv: false,
    ownerEmailVerified: true,
    hasDeploymentModelCredential: false,
    defaultProvider: null,
    defaultModel: null,
    computerHost: null,
    canChooseHostComputer: false,
    sandboxProvider: "fake",
  };
  const updates: unknown[] = [];
  await page.route(/\/rpc\/(me|bootstrap)$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const me = route.request().url().endsWith("/me") ? body.json : body.json.me;
    me.isDeploymentOwner = true;
    await route.fulfill({ response, json: body });
  });
  await page.route(/\/rpc\/deployment\/(get|update)$/, async (route) => {
    if (route.request().url().endsWith("/update")) {
      const input = route.request().postDataJSON().json;
      updates.push(input);
      Object.assign(deployment, input);
    }
    await route.fulfill({ json: { json: deployment } });
  });
  await page.reload();

  const settings = await openUserSettings(page, "signups");
  const allowlist = settings.getByTestId("signup-allowlist");
  await expect(allowlist).toContainText("owner@example.com");
  await expect(settings.getByRole("button", { name: "Remove owner@example.com" })).toBeDisabled();

  await settings.getByRole("textbox", { name: "Email or @domain" }).fill("@Example.org");
  await settings.getByRole("button", { name: "Add", exact: true }).click();
  await expect(allowlist).toContainText("@example.org");
  expect(updates).toEqual([{ signupAllowlist: ["owner@example.com", "@example.org"] }]);
  await expect(settings.getByRole("button", { name: "Remove owner@example.com" })).toBeEnabled();
  await captureScreenshot(page, testInfo, "settings-signups");
});
