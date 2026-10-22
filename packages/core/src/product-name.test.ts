import { expect, it } from "vitest";
import { DEFAULT_PRODUCT_NAME, productNameFromEnv } from "./product-name.js";

it("uses PRODUCT_NAME when it is set", () => {
  expect(productNameFromEnv("  Acme Bots ")).toBe("Acme Bots");
});

it("falls back to Rakazo when PRODUCT_NAME is unset, blank or too long", () => {
  expect(productNameFromEnv(undefined)).toBe(DEFAULT_PRODUCT_NAME);
  expect(productNameFromEnv("   ")).toBe(DEFAULT_PRODUCT_NAME);
  expect(productNameFromEnv("x".repeat(41))).toBe(DEFAULT_PRODUCT_NAME);
});
