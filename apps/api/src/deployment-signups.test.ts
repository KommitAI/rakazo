import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const owner: Actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "owner@rakazo.test",
  isDeploymentOwner: true,
};

function setup({ signupAllowlistFromEnv = false, emailVerified = true } = {}) {
  let stored = {
    id: "default",
    ownerUserId: "user-1",
    signupsEnabled: true,
    signupAllowlist: "owner@rakazo.test",
  };
  const upsert = vi.fn(async ({ update }: { update: Partial<typeof stored> }) => {
    stored = { ...stored, ...update };
    return stored;
  });
  const prisma = {
    deploymentSettings: { findUnique: vi.fn(async () => stored), upsert },
    user: { findUnique: vi.fn(async () => ({ emailVerified })) },
  };
  const deps = {
    prisma,
    env: { sandboxProvider: "docker", signupAllowlistFromEnv },
  } as unknown as RouterDeps;
  const client = (actor: Actor) => createRouterClient(createRouter(deps), { context: { actor } });
  return { client, upsert };
}

describe("deployment signup settings", () => {
  it("normalizes and deduplicates allowlist entries", async () => {
    const { client } = setup();
    const settings = await client(owner).deployment.update({
      signupAllowlist: [" Owner@Rakazo.test ", "@Example.com", "owner@rakazo.test"],
    });
    expect(settings.signupAllowlist).toEqual(["owner@rakazo.test", "@example.com"]);
    expect(settings.signupAllowlistFromEnv).toBe(false);
  });

  it("rejects entries that are not an address or a domain", async () => {
    const { client, upsert } = setup();
    for (const entry of ["example.com", "a,b@example.com", "name@", "two words@example.com"]) {
      await expect(
        client(owner).deployment.update({ signupAllowlist: [entry] }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses to edit an allowlist that SIGNUP_ALLOWLIST sets on every start", async () => {
    const { client, upsert } = setup({ signupAllowlistFromEnv: true });
    await expect(client(owner).deployment.get()).resolves.toMatchObject({
      signupAllowlistFromEnv: true,
    });
    await expect(
      client(owner).deployment.update({ signupAllowlist: ["new@rakazo.test"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(client(owner).deployment.update({ signupsEnabled: false })).resolves.toMatchObject(
      { signupsEnabled: false },
    );
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("keeps an unverified owner from starting an allowlist that would sign them out", async () => {
    const { client, upsert } = setup({ emailVerified: false });
    await expect(client(owner).deployment.get()).resolves.toMatchObject({
      ownerEmailVerified: false,
    });
    await expect(
      client(owner).deployment.update({ signupAllowlist: ["owner@rakazo.test"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(client(owner).deployment.update({ signupAllowlist: [] })).resolves.toMatchObject({
      signupAllowlist: [],
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("is only available to the deployment owner", async () => {
    const { client, upsert } = setup();
    const member = { ...owner, userId: "user-2", isDeploymentOwner: false };
    await expect(client(member).deployment.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client(member).deployment.update({ signupAllowlist: ["member@rakazo.test"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsert).not.toHaveBeenCalled();
  });
});
