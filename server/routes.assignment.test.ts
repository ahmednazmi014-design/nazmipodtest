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

describe("delivery scheduling", () => {
  it("blocks overlapping Driver bookings and allows back-to-back windows", async () => {
    const { appRouter, createUser, publicUser, readStore } =
      await loadBackend();
    const owner = createUser({
      name: "Owner User",
      username: "owner-schedule",
      email: "owner-schedule@example.test",
      role: "Owner",
      password: "long-test-password",
    });
    const driver = createUser({
      name: "Driver One",
      username: "driver-schedule",
      email: "",
      role: "Driver",
      password: "another-long-password",
    });
    const caller = appRouter.createCaller(context(publicUser(owner)));
    const base = {
      customer: "Example Customer",
      address: "12 Example Road",
      challan: "CH-SCHEDULE-1",
      cartons: 10,
      scheduledAt: "2026-11-04T10:00:00.000Z",
      assignedDriverId: driver.id,
      vehicle: "Truck 1",
      expectedDurationMinutes: 60,
    };
    await caller.deliveries.create(base);
    await expect(
      caller.deliveries.create({
        ...base,
        challan: "CH-SCHEDULE-2",
        scheduledAt: "2026-11-04T10:30:00.000Z",
        vehicle: "Truck 2",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(readStore().deliveries).toHaveLength(1);

    await caller.deliveries.create({
      ...base,
      challan: "CH-SCHEDULE-3",
      scheduledAt: "2026-11-04T11:00:00.000Z",
      vehicle: "Truck 2",
    });
    expect(readStore().deliveries).toHaveLength(2);
  });

  it("creates monthly repeats with explicit unique challan suffixes and clamped dates", async () => {
    const { appRouter, createUser, publicUser, readStore } =
      await loadBackend();
    const owner = createUser({
      name: "Owner User",
      username: "owner-repeat",
      email: "owner-repeat@example.test",
      role: "Owner",
      password: "long-test-password",
    });
    const caller = appRouter.createCaller(context(publicUser(owner)));
    const result = await caller.deliveries.create({
      customer: "Example Customer",
      address: "12 Example Road",
      challan: "CH-REPEAT",
      cartons: 5,
      scheduledAt: "2027-01-31T09:00:00.000Z",
      recurrenceFrequency: "monthly",
      recurrenceCount: 3,
    });
    const records = readStore().deliveries.sort((a, b) =>
      a.scheduledAt.localeCompare(b.scheduledAt)
    );
    expect((result as any).seriesCreatedCount).toBe(3);
    expect(records.map(item => item.challan)).toEqual([
      "CH-REPEAT",
      "CH-REPEAT-R02",
      "CH-REPEAT-R03",
    ]);
    expect(records.map(item => item.scheduledAt)).toEqual([
      "2027-01-31T09:00:00.000Z",
      "2027-02-28T09:00:00.000Z",
      "2027-03-31T09:00:00.000Z",
    ]);
    expect(new Set(records.map(item => item.recurrenceGroupId)).size).toBe(1);
  });
});
