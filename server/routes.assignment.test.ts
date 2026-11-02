import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let directory = "";
let previousDataFile: string | undefined;

async function loadBackend() {
  vi.resetModules();
  const store = await import("./store");
  const routers = await import("./routers");
  return { ...store, appRouter: routers.appRouter };
}

function context(user: any = null) {
  return {
    user,
    req: { protocol: "http", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as any;
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "nazmi-route-test-"));
  previousDataFile = process.env.NAZMI_DATA_FILE;
  process.env.NAZMI_DATA_FILE = join(directory, "test-store.json");
});

afterEach(() => {
  if (previousDataFile === undefined) delete process.env.NAZMI_DATA_FILE;
  else process.env.NAZMI_DATA_FILE = previousDataFile;
  rmSync(directory, { recursive: true, force: true });
  vi.resetModules();
});

describe("staff creation and route assignment", () => {
  it("creates username-only staff with empty email and enforces case-insensitive usernames", async () => {
    const { appRouter, createUser, publicUser } = await loadBackend();
    const owner = createUser({
      name: "Owner User",
      username: "owner",
      email: "owner@example.test",
      role: "Owner",
      password: "long-test-password",
    });
    const caller = appRouter.createCaller(context(publicUser(owner)));
    const driver = await caller.staff.create({
      name: "Driver One",
      username: "RoadDriver",
      role: "Driver",
      password: "another-long-password",
    });
    expect(driver.email).toBe("");
    expect(driver.username).toBe("RoadDriver");
    await expect(
      caller.staff.create({
        name: "Driver Two",
        username: "roaddriver",
        role: "Driver",
        password: "another-long-password",
      })
    ).rejects.toThrow(/username already exists/i);
    await expect(
      (caller.staff.create as any)({
        name: "No Username",
        email: "valid@example.test",
        role: "Driver",
        password: "another-long-password",
      })
    ).rejects.toThrow();
  });

  it("restricts optimized route assignment by role and validates stop count", async () => {
    const { appRouter, createUser, publicUser } = await loadBackend();
    const driver = createUser({
      name: "Driver User",
      username: "driver",
      email: "",
      role: "Driver",
      password: "long-test-password",
    });
    const driverCaller = appRouter.createCaller(context(publicUser(driver)));
    await expect(
      driverCaller.deliveries.optimizeAndAssign({
        origin: "Karachi",
        deliveryIds: ["unknown"],
        driverId: driver.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const manager = createUser({
      name: "Dispatch Manager",
      username: "manager",
      email: "manager@example.test",
      role: "Dispatch Manager",
      password: "long-test-password",
    });
    const managerCaller = appRouter.createCaller(context(publicUser(manager)));
    await expect(
      managerCaller.deliveries.optimizeAndAssign({
        origin: "Karachi",
        deliveryIds: [],
        driverId: driver.id,
      })
    ).rejects.toThrow();
    await expect(
      managerCaller.deliveries.optimizeAndAssign({
        origin: "Karachi",
        deliveryIds: Array.from({ length: 24 }, (_, i) => `id-${i}`),
        driverId: driver.id,
      })
    ).rejects.toThrow();
  });
});
