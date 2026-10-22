// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) => String.raw(strings, ...values),
  }),
}));

vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
  Label: ({ children, ...props }: React.ComponentProps<"label">) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: test double forwards htmlFor
    <label {...props}>{children}</label>
  ),
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: { checked: boolean; onCheckedChange: (checked: boolean) => void } & Omit<
    React.ComponentProps<"input">,
    "checked"
  >) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      {...props}
    />
  ),
}));

const { settings, update } = vi.hoisted(() => {
  const settings = {
    current: {
      signupsEnabled: true,
      signupAllowlist: ["owner@example.com"],
      signupAllowlistFromEnv: false,
      ownerEmailVerified: true,
    },
  };
  const update = vi.fn(async (input: Record<string, unknown>) => {
    settings.current = { ...settings.current, ...input };
    return settings.current;
  });
  return { settings, update };
});
vi.mock("../lib/rpc", () => ({
  rpc: { deployment: { get: vi.fn(async () => settings.current), update } },
}));

import { SignupSettingsPanel } from "./SignupSettingsPanel";

async function render(initial: (typeof settings)["current"]) {
  settings.current = initial;
  update.mockClear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<SignupSettingsPanel />));
  const query = <T extends Element>(selector: string) => container.querySelector<T>(selector);
  return {
    container,
    query,
    entries: () =>
      [...container.querySelectorAll('[data-testid="signup-allowlist"] li span')].map(
        (item) => item.textContent,
      ),
    async type(value: string) {
      const input = query<HTMLInputElement>('[data-testid="signup-allowlist-entry"]');
      if (!input) throw new Error("no entry field");
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        input.form?.requestSubmit();
      });
    },
    cleanup: async () => {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

it("adds a normalized address and removes entries", async () => {
  const view = await render({
    signupsEnabled: true,
    signupAllowlist: ["owner@example.com"],
    signupAllowlistFromEnv: false,
    ownerEmailVerified: true,
  });
  try {
    await view.type("  Teammate@Example.com ");
    expect(update).toHaveBeenLastCalledWith({
      signupAllowlist: ["owner@example.com", "teammate@example.com"],
    });
    expect(view.entries()).toEqual(["owner@example.com", "teammate@example.com"]);
    await act(async () => {
      view.query<HTMLButtonElement>('[aria-label="Remove teammate@example.com"]')?.click();
    });
    expect(view.entries()).toEqual(["owner@example.com"]);
  } finally {
    await view.cleanup();
  }
});

it("rejects an entry that is neither an address nor a domain", async () => {
  const view = await render({
    signupsEnabled: true,
    signupAllowlist: ["owner@example.com"],
    signupAllowlistFromEnv: false,
    ownerEmailVerified: true,
  });
  try {
    await view.type("example.com");
    expect(update).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Enter an email address or @domain");
  } finally {
    await view.cleanup();
  }
});

it("keeps the last entry while sign-ups are on so the list cannot open sign-ups to anyone", async () => {
  const view = await render({
    signupsEnabled: true,
    signupAllowlist: ["@example.com"],
    signupAllowlistFromEnv: false,
    ownerEmailVerified: true,
  });
  try {
    expect(view.query<HTMLButtonElement>('[aria-label="Remove @example.com"]')?.disabled).toBe(
      true,
    );
    await act(async () => {
      view.query<HTMLInputElement>('[data-testid="signups-enabled"]')?.click();
    });
    expect(update).toHaveBeenLastCalledWith({ signupsEnabled: false });
    expect(view.query<HTMLButtonElement>('[aria-label="Remove @example.com"]')?.disabled).toBe(
      false,
    );
  } finally {
    await view.cleanup();
  }
});

it("says when anyone can sign up", async () => {
  const view = await render({
    signupsEnabled: true,
    signupAllowlist: [],
    signupAllowlistFromEnv: false,
    ownerEmailVerified: true,
  });
  try {
    expect(view.container.textContent).toContain("Anyone can sign up.");
  } finally {
    await view.cleanup();
  }
});

it("does not offer to start an allowlist that would sign out an unverified owner", async () => {
  const view = await render({
    signupsEnabled: true,
    signupAllowlist: [],
    signupAllowlistFromEnv: false,
    ownerEmailVerified: false,
  });
  try {
    expect(view.container.textContent).toContain("Verify your email address to limit sign-ups.");
    expect(view.query('[data-testid="signup-allowlist-entry"]')).toBeNull();
  } finally {
    await view.cleanup();
  }
});

it("shows a list set by SIGNUP_ALLOWLIST without editing controls", async () => {
  const view = await render({
    signupsEnabled: true,
    signupAllowlist: ["owner@example.com"],
    signupAllowlistFromEnv: true,
    ownerEmailVerified: true,
  });
  try {
    expect(view.entries()).toEqual(["owner@example.com"]);
    expect(view.container.textContent).toContain("Set by SIGNUP_ALLOWLIST on the server.");
    expect(view.query('[data-testid="signup-allowlist-entry"]')).toBeNull();
    expect(view.query('[aria-label="Remove owner@example.com"]')).toBeNull();
  } finally {
    await view.cleanup();
  }
});
