import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let directory = "";
let previousDataFile: string | undefined;
let previousBootstrap: Record<string, string | undefined> = {};

async function loadBackend() {
  vi.resetModules();
  const store = await import("./store");
  const routers = await import("./routers");
  return { ...store, appRouter: routers.appRouter };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "nazmi-auth-test-"));
  previousDataFile = process.env.NAZMI_DATA_FILE;
  process.env.NAZMI_DATA_FILE = join(directory, "test-store.json");
  previousBootstrap = {
    username: process.env.NAZMI_BOOTSTRAP_USERNAME,
    ownerName: process.env.NAZMI_BOOTSTRAP_OWNER_NAME,
    password: process.env.NAZMI_BOOTSTRAP_PASSWORD,
  };
});

afterEach(() => {
  if (previousDataFile === undefined) delete process.env.NAZMI_DATA_FILE;
  else process.env.NAZMI_DATA_FILE = previousDataFile;
  for (const [key, value] of Object.entries({
    NAZMI_BOOTSTRAP_USERNAME: previousBootstrap.username,
    NAZMI_BOOTSTRAP_OWNER_NAME: previousBootstrap.ownerName,
    NAZMI_BOOTSTRAP_PASSWORD: previousBootstrap.password,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(directory, { recursive: true, force: true });
  vi.resetModules();
});

function context(user: any = null, authorization?: string) {
  return {
    user,
    req: { protocol: "http", headers: authorization ? { authorization } : {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as any;
}

describe("secure auth bootstrap", () => {
  it("does not expose unauthenticated auth.setup", async () => {
    const { appRouter } = await loadBackend();
    await expect(
      (appRouter.createCaller(context()).auth as any).setup({
        name: "Intruder",
        email: "intruder@example.test",
        password: "not-a-real-password",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("logs in by case-insensitive username or email, including legacy email records", async () => {
    const { appRouter, createUser, withStore } = await loadBackend();
    const usernameUser = createUser({
      name: "User One",
      username: "RoadRunner",
      email: "one@example.test",
      role: "Owner",
      password: "a-long-test-password",
    });
    const legacyUser = createUser({
      name: "Legacy User",
      email: "legacy@example.test",
      role: "Driver",
      password: "legacy-test-password",
    });
    withStore(store => {
      const legacy = store.users.find(user => user.id === legacyUser.id)!;
      delete (legacy as any).username;
      delete (legacy as any).mustChangePassword;
    });
    const caller = appRouter.createCaller(context());
    expect(
      (
        await caller.auth.login({
          identifier: "roadrunner",
          password: "a-long-test-password",
        })
      ).id
    ).toBe(usernameUser.id);
    expect(
      (
        await caller.auth.login({
          identifier: "LEGACY@EXAMPLE.TEST",
          password: "legacy-test-password",
        })
      ).id
    ).toBe(legacyUser.id);
  });

  it("requires authentication and clears forced-change flag while preserving current session", async () => {
    const {
      appRouter,
      createUser,
      createSession,
      readStore,
      publicUser,
      verifyPassword,
    } = await loadBackend();
    const user = createUser({
      name: "Ahmed",
      username: "Ahmed",
      email: "",
      role: "Owner",
      password: "bootstrap-test-password",
    });
    const token = createSession(user.id);
    const unauthenticated = appRouter.createCaller(context());
    await expect(
      unauthenticated.auth.changePassword({
        newPassword: "a-new-password-long",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const caller = appRouter.createCaller(
      context(
        publicUser({ ...user, mustChangePassword: true }),
        `Bearer ${token}`
      )
    );
    await expect(caller.dashboard.summary()).resolves.toMatchObject({
      total: 0,
    });
    await expect(
      caller.auth.changePassword({ newPassword: "short" })
    ).rejects.toThrow();
    await caller.auth.changePassword({ newPassword: "a-new-password-long" });
    const persisted = readStore();
    const changed = persisted.users.find(item => item.id === user.id)!;
    expect(changed.mustChangePassword).toBe(false);
    expect(verifyPassword("a-new-password-long", changed.passwordHash)).toBe(
      true
    );
    expect(persisted.sessions.some(item => item.userId === user.id)).toBe(true);
    expect(persisted.audit[0]?.action).toBe("password_changed");
  });

  it("bootstraps only with all runtime values, adds only missing Ahmed, and never alters existing users", async () => {
    process.env.NAZMI_BOOTSTRAP_USERNAME = "configured-username";
    process.env.NAZMI_BOOTSTRAP_OWNER_NAME = "configured-owner-name";
    process.env.NAZMI_BOOTSTRAP_PASSWORD = "secret-test-password";
    const {
      bootstrapOwnerFromEnvironment,
      createUser,
      readStore,
      verifyPassword,
    } = await loadBackend();
    const existing = createUser({
      name: "Existing Owner",
      username: "already-there",
      email: "owner@example.test",
      role: "Owner",
      password: "existing-test-password",
    });
    expect(bootstrapOwnerFromEnvironment()).toBe(true);
    expect(bootstrapOwnerFromEnvironment()).toBe(false);
    const store = readStore();
    const added = store.users.find(
      item => item.username === "configured-username"
    )!;
    expect(store.users).toHaveLength(2);
    expect(added.name).toBe("configured-owner-name");
    expect(added.email).toBe("");
    expect(added.role).toBe("Owner");
    expect(added.mustChangePassword).toBe(false);
    expect(verifyPassword("secret-test-password", added.passwordHash)).toBe(
      true
    );
    expect(
      store.users.find(item => item.id === existing.id)?.passwordHash
    ).toBe(existing.passwordHash);
  });
});
