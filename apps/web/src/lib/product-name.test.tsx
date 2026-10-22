// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const capabilities = vi.hoisted(() => ({ productName: undefined as string | undefined }));
vi.mock("./auth-capabilities", () => ({
  fetchAuthCapabilities: vi.fn(async () => ({
    sso: null,
    passwordAuth: true,
    passwordReset: false,
    resetUrl: null,
    productName: capabilities.productName,
  })),
}));

async function renderName() {
  vi.resetModules();
  const { useProductName } = await import("./product-name");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  function Name() {
    return <span>{useProductName()}</span>;
  }
  await act(async () => root.render(<Name />));
  const text = container.textContent;
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  return text;
}

it("shows the deployment's PRODUCT_NAME", async () => {
  capabilities.productName = "Acme Bots";
  expect(await renderName()).toBe("Acme Bots");
});

it("keeps Rakazo for a server that does not send a name", async () => {
  capabilities.productName = undefined;
  expect(await renderName()).toBe("Rakazo");
});
