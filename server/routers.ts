import { createHash, randomBytes, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getPasswordSessionCookieOptions,
  getSessionToken,
  SESSION_COOKIE,
} from "./_core/context";
import {
  passwordChangeProcedure,
  publicProcedure,
  protectedProcedure,
  router,
} from "./_core/trpc";
import { makeRequest, type DirectionsResult } from "./_core/map";
import {
  addAudit,
  canCreateDelivery,
  canManageOperations,
  canManageStaff,
  canVerifyPod,
  createSession,
  createUser,
  findDelivery,
  findUserByEmail,
  findUserByIdentifier,
  findUserById,
  hashPassword,
  hashSessionToken,
  nextDeliveryId,
  publicUser,
  readStore,
  revokeOtherSessions,
  verifyPassword,
  withStore,
  type DeliveryStatus,
  type Role,
} from "./store";

const roles = [
  "Owner",
  "Director",
  "Dispatch Manager",
  "Dispatch Staff",
  "Delivery Supervisor",
  "Driver",
  "Accounts",
  "Custom",
] as const;
const statuses = [
  "Scheduled",
  "Ready for Dispatch",
  "Assigned",
  "Out for Delivery",
  "Arrived",
  "Delivered",
  "Partially Delivered",
  "Failed",
  "Cancelled",
] as const;
const roleSchema = z.enum(roles);
const statusSchema = z.enum(statuses);
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

function requireRole(user: { role: Role }, allowed: Role[]) {
  if (!allowed.includes(user.role))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission for this action.",
    });
}

function serializeDelivery(
  delivery: ReturnType<typeof findDelivery>,
  store = readStore()
) {
  if (!delivery) return null;
  const driver = delivery.assignedDriverId
    ? findUserById(delivery.assignedDriverId, store)
    : undefined;
  return {
    ...delivery,
    driver: driver
      ? { id: driver.id, name: driver.name, phone: driver.phone }
      : null,
    gps: delivery.gps,
    gpsTrailCount: delivery.gpsTrail.length,
  };
}

const terminalDeliveryStatuses = new Set([
  "Delivered",
  "Partially Delivered",
  "Failed",
  "Cancelled",
]);

function addRecurrenceDate(
  value: string,
  frequency: "weekly" | "monthly",
  step: number
) {
  const date = new Date(value);
  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + step * 7);
  } else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + step);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString();
}

function assertScheduleAvailable(
  store: ReturnType<typeof readStore>,
  input: {
    scheduledAt: string;
    expectedDurationMinutes: number;
    assignedDriverId?: string | null;
    vehicle?: string | null;
    ignoreDeliveryId?: string;
  }
) {
  const start = Date.parse(input.scheduledAt);
  if (!Number.isFinite(start))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a valid delivery date and time.",
    });
  const end = start + input.expectedDurationMinutes * 60_000;
  const vehicle = input.vehicle?.trim().toLocaleLowerCase() ?? "";
  if (!input.assignedDriverId && !vehicle) return;
  const conflict = store.deliveries.find(item => {
    if (
      item.id === input.ignoreDeliveryId ||
      terminalDeliveryStatuses.has(item.status)
    )
      return false;
    const sameDriver =
      !!input.assignedDriverId &&
      item.assignedDriverId === input.assignedDriverId;
    const sameVehicle =
      !!vehicle && item.vehicle?.trim().toLocaleLowerCase() === vehicle;
    if (!sameDriver && !sameVehicle) return false;
    const existingStart = Date.parse(item.scheduledAt);
    if (!Number.isFinite(existingStart)) return false;
    const existingDuration = item.expectedDurationMinutes ?? 120;
    const existingEnd = existingStart + existingDuration * 60_000;
    return start < existingEnd && end > existingStart;
  });
  if (conflict) {
    const resource =
      input.assignedDriverId &&
      conflict.assignedDriverId === input.assignedDriverId
        ? "Driver"
        : "vehicle";
    throw new TRPCError({
      code: "CONFLICT",
      message: `${resource} is already booked for ${conflict.id} (${conflict.challan}) at ${conflict.scheduledAt}. Choose a different time, Driver, or vehicle.`,
    });
  }
}

export const appRouter = router({
  auth: router({
    status: publicProcedure.query(() => {
      const store = readStore();
      return {
        setupRequired: store.users.length === 0,
        hasOwner: store.users.some(user => user.role === "Owner"),
      };
    }),
    me: publicProcedure.query(({ ctx }) => ctx.user),
    login: publicProcedure
      .input(
        z.object({
          identifier: z.string().min(1).max(320),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(({ input, ctx }) => {
        const user = findUserByIdentifier(input.identifier);
        if (
          !user ||
          !user.active ||
          !verifyPassword(input.password, user.passwordHash)
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Username/email or password is incorrect.",
          });
        }
        const token = createSession(user.id);
        withStore(store => {
          const current = store.users.find(item => item.id === user.id);
          if (current) current.lastSignedIn = new Date().toISOString();
          addAudit(store, {
            action: "login",
            actorId: user.id,
            actorName: user.name,
            targetId: user.id,
            details: "Password sign-in",
          });
        });
        ctx.res.cookie(SESSION_COOKIE, token, {
          ...getPasswordSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 30,
        });
        return publicUser(user);
      }),
    changePassword: passwordChangeProcedure
      .input(z.object({ newPassword: z.string().min(12).max(128) }))
      .mutation(({ input, ctx }) => {
        const token = getSessionToken(ctx.req);
        if (!token)
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Sign in required.",
          });
        withStore(store => {
          const user = store.users.find(item => item.id === ctx.user.id);
          if (!user)
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Sign in required.",
            });
          user.passwordHash = hashPassword(input.newPassword);
          user.mustChangePassword = false;
          addAudit(store, {
            action: "password_changed",
            actorId: user.id,
            actorName: user.name,
            targetId: user.id,
            details: "Account password changed",
          });
        });
        revokeOtherSessions(ctx.user.id, token);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const token = getSessionToken(ctx.req);
      if (token) {
        withStore(store => {
          const actor = ctx.user;
          if (actor)
            addAudit(store, {
              action: "logout",
              actorId: actor.id,
              actorName: actor.name,
              targetId: actor.id,
              details: "Password sign-out",
            });
        });
      }
      ctx.res.clearCookie(SESSION_COOKIE, {
        ...getPasswordSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      return { success: true } as const;
    }),
    sessions: protectedProcedure.query(({ ctx }) => {
      const currentToken = getSessionToken(ctx.req);
      const currentHash = currentToken ? hashSessionToken(currentToken) : "";
      return readStore()
        .sessions.filter(session => session.userId === ctx.user.id)
        .map(session => ({
          id: session.tokenHash,
          label: `Session · ${session.tokenHash.slice(-8)}`,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          current: session.tokenHash === currentHash,
        }));
    }),
    revokeSession: protectedProcedure
      .input(z.object({ sessionId: z.string().min(20).max(200) }))
      .mutation(({ input, ctx }) =>
        withStore(store => {
          const before = store.sessions.length;
          store.sessions = store.sessions.filter(
            session =>
              !(
                session.tokenHash === input.sessionId &&
                session.userId === ctx.user.id
              )
          );
          return { revoked: store.sessions.length < before } as const;
        })
      ),
  }),

  dashboard: router({
    summary: protectedProcedure.query(({ ctx }) => {
      const store = readStore();
      const deliveries =
        ctx.user.role === "Driver"
          ? store.deliveries.filter(
              item => item.assignedDriverId === ctx.user.id
            )
          : store.deliveries;
      return {
        total: deliveries.length,
        delivered: deliveries.filter(item => item.status === "Delivered")
          .length,
        pendingVerification: deliveries.filter(
          item => item.proofStatus === "Ready"
        ).length,
        active: deliveries.filter(item =>
          ["Out for Delivery", "Arrived"].includes(item.status)
        ).length,
        partial: deliveries.filter(
          item => item.status === "Partially Delivered"
        ).length,
        failed: deliveries.filter(item => item.status === "Failed").length,
        cartons: deliveries.reduce((sum, item) => sum + item.cartons, 0),
        deliveredCartons: deliveries.reduce(
          (sum, item) => sum + item.deliveredCartons,
          0
        ),
        staff: store.users.filter(item => item.active).length,
      };
    }),
  }),

  staff: router({
    list: protectedProcedure.query(({ ctx }) => {
      const store = readStore();
      const users =
        ctx.user.role === "Driver"
          ? store.users.filter(user => user.id === ctx.user.id)
          : store.users;
      return users.map(publicUser);
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100),
          username: z.string().trim().min(1).max(80),
          email: z.string().email().optional(),
          phone: z.string().max(40).optional(),
          role: roleSchema,
          password: passwordSchema,
        })
      )
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, ["Owner", "Director", "Dispatch Manager"]);
        if (input.role === "Owner" && ctx.user.role !== "Owner")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the Owner can create another Owner account.",
          });
        const user = createUser({ ...input, email: input.email ?? "" });
        withStore(store =>
          addAudit(store, {
            action: "staff_created",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: user.id,
            details: `${user.name} added as ${user.role}`,
          })
        );
        return publicUser(user);
      }),
    setActive: protectedProcedure
      .input(z.object({ userId: z.string().uuid(), active: z.boolean() }))
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, ["Owner", "Director", "Dispatch Manager"]);
        if (input.userId === ctx.user.id && !input.active)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot deactivate your own account.",
          });
        return withStore(store => {
          const user = store.users.find(item => item.id === input.userId);
          if (!user)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Staff account not found.",
            });
          user.active = input.active;
          addAudit(store, {
            action: input.active ? "staff_activated" : "staff_deactivated",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: user.id,
            details: `${user.name} ${input.active ? "activated" : "deactivated"}`,
          });
          return publicUser(user);
        });
      }),
    resetPassword: protectedProcedure
      .input(z.object({ userId: z.string().uuid(), password: passwordSchema }))
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, ["Owner", "Director", "Dispatch Manager"]);
        return withStore(store => {
          const user = store.users.find(item => item.id === input.userId);
          if (!user)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Staff account not found.",
            });
          user.passwordHash = hashPassword(input.password);
          addAudit(store, {
            action: "password_reset",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: user.id,
            details: `Password reset for ${user.name}`,
          });
          return { success: true } as const;
        });
      }),
  }),

  deliveries: router({
    optimizeAndAssign: protectedProcedure
      .input(
        z.object({
          origin: z.string().trim().min(1).max(500),
          deliveryIds: z.array(z.string().min(1)).min(1).max(23),
          driverId: z.string().uuid(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        requireRole(ctx.user, [
          "Owner",
          "Director",
          "Dispatch Manager",
          "Dispatch Staff",
        ]);
        if (new Set(input.deliveryIds).size !== input.deliveryIds.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose each delivery only once.",
          });
        const initialStore = readStore();
        const driver = findUserById(input.driverId, initialStore);
        if (!driver || driver.role !== "Driver" || !driver.active)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose an active Driver account.",
          });
        const deliveries = input.deliveryIds.map(id =>
          findDelivery(id, initialStore)
        );
        if (deliveries.some(item => !item))
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "One or more deliveries were not found.",
          });
        if (
          deliveries.some(
            item => item!.status === "Delivered" || item!.status === "Cancelled"
          )
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Delivered or cancelled deliveries cannot be routed.",
          });
        const karachi = /\b(karachi|pakistan)\b/i;
        const qualify = (value: string) =>
          karachi.test(value) ? value : `${value}, Karachi, Pakistan`;
        const origin = qualify(input.origin.trim());
        let directions: DirectionsResult;
        try {
          directions = await makeRequest<DirectionsResult>(
            "/maps/api/directions/json",
            {
              origin,
              destination: origin,
              mode: "driving",
              optimize: true,
              waypoints: `optimize:true|${deliveries.map(item => qualify(item!.address)).join("|")}`,
            }
          );
        } catch {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message:
              "Route optimization is unavailable. Check Maps service configuration and try again.",
          });
        }
        const route = directions.routes?.[0];
        if (
          directions.status !== "OK" ||
          !route ||
          route.waypoint_order?.length !== deliveries.length
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Maps could not calculate this route. Check the origin and delivery addresses, then try again.",
          });
        const ordered = route.waypoint_order.map(index => deliveries[index]!);
        const distance = route.legs.reduce(
          (sum, leg) => sum + leg.distance.value,
          0
        );
        const duration = route.legs.reduce(
          (sum, leg) => sum + leg.duration.value,
          0
        );
        const formatDistance = (meters: number) =>
          meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
        const formatDuration = (seconds: number) => {
          const minutes = Math.round(seconds / 60);
          return minutes >= 60
            ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
            : `${minutes} min`;
        };
        withStore(store => {
          const currentDriver = findUserById(input.driverId, store);
          if (
            !currentDriver ||
            currentDriver.role !== "Driver" ||
            !currentDriver.active
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose an active Driver account.",
            });
          ordered.forEach((routed, index) => {
            const delivery = findDelivery(routed.id, store);
            if (
              !delivery ||
              delivery.status === "Delivered" ||
              delivery.status === "Cancelled"
            )
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "A delivery changed while the route was being calculated. Refresh and try again.",
              });
            delivery.assignedDriverId = currentDriver.id;
            if (
              ["Scheduled", "Ready for Dispatch", "Assigned"].includes(
                delivery.status
              )
            )
              delivery.status = "Assigned";
            delivery.route = `Optimized loop from ${origin} — stop ${index + 1} of ${ordered.length}`;
            delivery.updatedAt = new Date().toISOString();
            addAudit(store, {
              action: "route_assigned",
              actorId: ctx.user.id,
              actorName: ctx.user.name,
              targetId: delivery.id,
              details: `Assigned to ${currentDriver.name}; optimized route stop ${index + 1} of ${ordered.length}`,
            });
          });
        });
        return {
          driverName: driver.name,
          routeSummary: route.summary,
          distanceText: formatDistance(distance),
          durationText: formatDuration(duration),
          orderedStops: ordered.map(item => ({
            deliveryId: item.id,
            customer: item.customer,
            address: item.address,
          })),
          encodedPolyline: route.overview_polyline.points,
        };
      }),
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            status: z.string().optional(),
          })
          .optional()
      )
      .query(({ input, ctx }) => {
        const store = readStore();
        const search = input?.search?.trim().toLowerCase() ?? "";
        return store.deliveries
          .filter(
            item =>
              ctx.user.role !== "Driver" ||
              item.assignedDriverId === ctx.user.id
          )
          .filter(
            item =>
              !input?.status ||
              input.status === "All statuses" ||
              item.status === input.status
          )
          .filter(
            item =>
              !search ||
              [
                item.id,
                item.customer,
                item.address,
                item.challan,
                item.reference,
                item.vehicle,
                item.route,
              ]
                .join(" ")
                .toLowerCase()
                .includes(search)
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map(item => serializeDelivery(item, store));
      }),
    create: protectedProcedure
      .input(
        z.object({
          customer: z.string().min(2).max(160),
          address: z.string().min(3).max(500),
          contact: z.string().max(120).optional(),
          challan: z.string().min(1).max(80),
          reference: z.string().max(80).optional(),
          product: z.string().max(160).optional(),
          cartons: z.number().int().positive().max(100000),
          scheduledAt: z.string().min(1),
          assignedDriverId: z.string().uuid().nullable().optional(),
          vehicle: z.string().max(50).optional(),
          route: z.string().max(100).optional(),
          notes: z.string().max(1000).optional(),
          unitPrice: z.number().nonnegative().max(1_000_000).optional(),
          taxPercent: z.number().min(0).max(100).optional(),
          expectedDurationMinutes: z.number().int().min(1).max(1440).optional(),
          recurrenceFrequency: z.enum(["none", "weekly", "monthly"]).optional(),
          recurrenceCount: z.number().int().min(1).max(12).optional(),
        })
      )
      .mutation(({ input, ctx }) => {
        if (!canCreateDelivery(ctx.user.role))
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to create deliveries.",
          });
        return withStore(store => {
          const assignedDriver = input.assignedDriverId
            ? findUserById(input.assignedDriverId, store)
            : undefined;
          if (
            input.assignedDriverId &&
            (!assignedDriver ||
              assignedDriver.role !== "Driver" ||
              !assignedDriver.active)
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose an active Driver account.",
            });
          const frequency = input.recurrenceFrequency ?? "none";
          const recurrenceCount = input.recurrenceCount ?? 1;
          if (frequency === "none" && recurrenceCount > 1)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose a repeat frequency for multiple deliveries.",
            });
          const recurrenceGroupId = recurrenceCount > 1 ? randomUUID() : null;
          const challans = Array.from(
            { length: recurrenceCount },
            (_, index) =>
              index === 0
                ? input.challan.trim()
                : `${input.challan.trim()}-R${String(index + 1).padStart(2, "0")}`
          );
          if (challans.some(challan => challan.length > 80))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "The base challan is too long for the generated repeat suffixes.",
            });
          const challanKeys = challans.map(challan => challan.toLowerCase());
          if (
            new Set(challanKeys).size !== challanKeys.length ||
            challanKeys.some(challan =>
              store.deliveries.some(
                item => item.challan.toLowerCase() === challan
              )
            )
          )
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "One or more challans in this delivery series already exist.",
            });
          const now = new Date().toISOString();
          const delivery = {
            id: nextDeliveryId(store),
            customer: input.customer.trim(),
            address: input.address.trim(),
            contact: input.contact?.trim() ?? "",
            challan: input.challan.trim(),
            reference: input.reference?.trim() ?? "",
            product: input.product?.trim() ?? "",
            cartons: input.cartons,
            deliveredCartons: 0,
            rejectedCartons: 0,
            scheduledAt: input.scheduledAt,
            assignedDriverId: input.assignedDriverId ?? null,
            vehicle: input.vehicle?.trim() ?? "",
            route: input.route?.trim() ?? "",
            status: (input.assignedDriverId
              ? "Assigned"
              : "Scheduled") as DeliveryStatus,
            notes: input.notes?.trim() ?? "",
            proofStatus: "Missing" as const,
            proofNotes: "",
            photos: [],
            gps: null,
            gpsTrail: [],
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            verifiedAt: null,
            unitPrice: input.unitPrice ?? null,
            taxPercent: input.taxPercent ?? null,
            expectedDurationMinutes: input.expectedDurationMinutes ?? 120,
            startedAt: null,
            arrivedAt: null,
            parentDeliveryId: null,
            recurrenceGroupId,
            scannedBarcodes: [],
            photoMetadata: [],
            proofSubmissionIds: [],
          };
          assertScheduleAvailable(store, delivery);
          store.deliveries.unshift(delivery);
          for (let index = 1; index < recurrenceCount; index += 1) {
            const repeated = {
              ...delivery,
              id: nextDeliveryId(store),
              challan: challans[index],
              scheduledAt: addRecurrenceDate(
                input.scheduledAt,
                frequency as "weekly" | "monthly",
                index
              ),
              startedAt: null,
              arrivedAt: null,
              completedAt: null,
              verifiedAt: null,
              createdAt: now,
              updatedAt: now,
            };
            assertScheduleAvailable(store, repeated);
            store.deliveries.unshift(repeated);
          }
          addAudit(store, {
            action: "delivery_created",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: delivery.id,
            details: `${delivery.id} created for ${delivery.customer}${recurrenceCount > 1 ? ` with ${recurrenceCount - 1} scheduled repeats` : ""}`,
          });
          return {
            ...serializeDelivery(delivery, store),
            seriesCreatedCount: recurrenceCount,
          };
        });
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          deliveryId: z.string(),
          status: statusSchema,
          reason: z.string().max(500).optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        withStore(store => {
          const delivery = findDelivery(input.deliveryId, store);
          if (!delivery)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          if (
            ctx.user.role === "Driver" &&
            delivery.assignedDriverId !== ctx.user.id
          )
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Drivers can only update their own assignments.",
            });
          if (
            ctx.user.role === "Driver" &&
            ["Delivered", "Partially Delivered", "Cancelled"].includes(
              input.status
            )
          )
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Submit the POD before completing a delivery.",
            });
          const previous = delivery.status;
          delivery.status = input.status as DeliveryStatus;
          delivery.updatedAt = new Date().toISOString();
          if (input.status === "Out for Delivery")
            delivery.startedAt ??= delivery.updatedAt;
          if (input.status === "Arrived")
            delivery.arrivedAt ??= delivery.updatedAt;
          if (
            ["Delivered", "Partially Delivered", "Failed"].includes(
              input.status
            )
          )
            delivery.completedAt = delivery.completedAt ?? delivery.updatedAt;
          addAudit(store, {
            action: "status_changed",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: delivery.id,
            details: `${previous} → ${input.status}${input.reason ? ` · ${input.reason}` : ""}`,
          });
          return serializeDelivery(delivery, store);
        })
      ),
    updateLocation: protectedProcedure
      .input(
        z.object({
          deliveryId: z.string(),
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          accuracy: z.number().nonnegative().nullable().optional(),
          speed: z.number().nullable().optional(),
          heading: z.number().nullable().optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        withStore(store => {
          const delivery = findDelivery(input.deliveryId, store);
          if (!delivery)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          if (
            ctx.user.role === "Driver" &&
            delivery.assignedDriverId !== ctx.user.id
          )
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Drivers can only share location for their own assignment.",
            });
          const point = {
            lat: input.lat,
            lng: input.lng,
            accuracy: input.accuracy ?? null,
            speed: input.speed ?? null,
            heading: input.heading ?? null,
            recordedAt: new Date().toISOString(),
          };
          delivery.gps = point;
          delivery.gpsTrail.push(point);
          delivery.gpsTrail = delivery.gpsTrail.slice(-100);
          delivery.updatedAt = point.recordedAt;
          return { success: true, gps: point } as const;
        })
      ),
    submitProof: protectedProcedure
      .input(
        z.object({
          deliveryId: z.string(),
          submissionId: z.string().min(8).max(120).optional(),
          expectedUpdatedAt: z.string().max(80).optional(),
          photoMetadata: z
            .array(
              z.object({
                capturedAt: z.string().max(80),
                lat: z.number().min(-90).max(90).optional(),
                lng: z.number().min(-180).max(180).optional(),
                note: z.string().max(200).optional(),
              })
            )
            .max(3)
            .optional(),
          deliveredCartons: z.number().int().nonnegative(),
          rejectedCartons: z.number().int().nonnegative().optional(),
          notes: z.string().max(1000).optional(),
          photos: z
            .array(
              z
                .string()
                .max(1_340_000)
                .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/i)
            )
            .max(3)
            .optional(),
        })
      )
      .mutation(({ input, ctx }) =>
        withStore(store => {
          const delivery = findDelivery(input.deliveryId, store);
          if (!delivery)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          if (
            ctx.user.role === "Driver" &&
            delivery.assignedDriverId !== ctx.user.id
          )
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Drivers can only submit POD for their own assignment.",
            });
          if (
            input.submissionId &&
            delivery.proofSubmissionIds?.includes(input.submissionId)
          )
            return serializeDelivery(delivery, store);
          if (
            input.expectedUpdatedAt &&
            input.expectedUpdatedAt !== delivery.updatedAt
          )
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Delivery changed since this POD was queued. Resolve the conflict before retrying.",
            });
          if (
            input.photoMetadata &&
            input.photoMetadata.length !== (input.photos ?? []).length
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Each POD photo must have exactly one matching metadata record.",
            });
          if (
            input.deliveredCartons + (input.rejectedCartons ?? 0) >
            delivery.cartons
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Delivered plus rejected cartons cannot exceed the dispatched quantity.",
            });
          delivery.deliveredCartons = input.deliveredCartons;
          delivery.rejectedCartons = input.rejectedCartons ?? 0;
          delivery.proofNotes = input.notes?.trim() ?? "";
          delivery.photos = input.photos ?? delivery.photos;
          delivery.photoMetadata = input.photoMetadata ?? [];
          if (input.submissionId)
            delivery.proofSubmissionIds = [
              ...(delivery.proofSubmissionIds ?? []),
              input.submissionId,
            ].slice(-100);
          delivery.proofStatus = "Ready";
          delivery.status =
            input.deliveredCartons === delivery.cartons
              ? "Delivered"
              : "Partially Delivered";
          delivery.completedAt = new Date().toISOString();
          delivery.updatedAt = delivery.completedAt;
          store.notifications ??= [];
          for (const u of store.users.filter(
            u =>
              u.active &&
              [
                "Owner",
                "Director",
                "Dispatch Manager",
                "Dispatch Staff",
                "Delivery Supervisor",
              ].includes(u.role)
          ))
            store.notifications.unshift({
              id: randomUUID(),
              userId: u.id,
              deliveryId: delivery.id,
              type: "pod_submitted",
              message: `POD submitted for ${delivery.id}`,
              createdAt: delivery.updatedAt,
              readAt: null,
            });
          addAudit(store, {
            action: "proof_submitted",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: delivery.id,
            details: `${input.deliveredCartons}/${delivery.cartons} cartons submitted for verification`,
          });
          return serializeDelivery(delivery, store);
        })
      ),
    verifyProof: protectedProcedure
      .input(
        z.object({
          deliveryId: z.string(),
          approved: z.boolean(),
          reason: z.string().max(500).optional(),
        })
      )
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, [
          "Owner",
          "Director",
          "Delivery Supervisor",
          "Dispatch Manager",
        ]);
        return withStore(store => {
          const delivery = findDelivery(input.deliveryId, store);
          if (!delivery)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          delivery.proofStatus = input.approved ? "Verified" : "Missing";
          if (!input.approved) delivery.status = "Arrived";
          delivery.verifiedAt = input.approved
            ? new Date().toISOString()
            : null;
          delivery.updatedAt = new Date().toISOString();
          store.notifications ??= [];
          for (const u of store.users.filter(
            u =>
              u.active &&
              ([
                "Owner",
                "Director",
                "Dispatch Manager",
                "Dispatch Staff",
                "Delivery Supervisor",
              ].includes(u.role) ||
                u.id === delivery.assignedDriverId)
          ))
            store.notifications.unshift({
              id: randomUUID(),
              userId: u.id,
              deliveryId: delivery.id,
              type: input.approved ? "pod_verified" : "pod_correction",
              message: `${input.approved ? "POD verified" : "Correction requested"} for ${delivery.id}`,
              createdAt: delivery.updatedAt,
              readAt: null,
            });
          addAudit(store, {
            action: input.approved ? "pod_verified" : "pod_flagged",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: delivery.id,
            details:
              input.reason ??
              (input.approved ? "POD verified" : "Correction requested"),
          });
          return serializeDelivery(delivery, store);
        });
      }),
    bulkCreate: protectedProcedure
      .input(
        z.object({
          items: z
            .array(
              z.object({
                customer: z.string().min(2).max(160),
                address: z.string().min(3).max(500),
                contact: z.string().max(120).optional(),
                challan: z.string().min(1).max(80),
                reference: z.string().max(80).optional(),
                product: z.string().max(160).optional(),
                cartons: z.number().int().positive().max(100000),
                scheduledAt: z.string().min(1),
                assignedDriverId: z.string().uuid().nullable().optional(),
                driverUsername: z.string().trim().max(80).optional(),
                vehicle: z.string().max(50).optional(),
                route: z.string().max(100).optional(),
                notes: z.string().max(1000).optional(),
                unitPrice: z.number().nonnegative().optional(),
                taxPercent: z.number().min(0).max(100).optional(),
                expectedDurationMinutes: z
                  .number()
                  .int()
                  .min(1)
                  .max(1440)
                  .optional(),
              })
            )
            .min(1)
            .max(200),
        })
      )
      .mutation(({ input, ctx }) => {
        if (!canCreateDelivery(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN", message: "Not permitted." });
        return withStore(store => {
          const seen = new Set<string>();
          const resolved = input.items.map((x, i) => {
            const challan = x.challan.trim().toLowerCase();
            if (
              seen.has(challan) ||
              store.deliveries.some(d => d.challan.toLowerCase() === challan)
            )
              throw new TRPCError({
                code: "CONFLICT",
                message: `Duplicate challan at row ${i + 1}.`,
              });
            seen.add(challan);
            const u = x.driverUsername
              ? store.users.find(
                  v =>
                    v.active &&
                    v.role === "Driver" &&
                    v.username.toLowerCase() === x.driverUsername!.toLowerCase()
                )
              : undefined;
            if (x.driverUsername && !u)
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Unknown active Driver username at row ${i + 1}.`,
              });
            const driverId = x.driverUsername
              ? u!.id
              : (x.assignedDriverId ?? null);
            if (driverId) {
              const assigned = findUserById(driverId, store);
              if (!assigned || assigned.role !== "Driver" || !assigned.active)
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Inactive or invalid Driver at row ${i + 1}.`,
                });
            }
            return { x, driverId };
          });
          const created = resolved.map(({ x, driverId }) => {
            const now = new Date().toISOString();
            const d: any = {
              id: nextDeliveryId(store),
              customer: x.customer.trim(),
              address: x.address.trim(),
              contact: x.contact ?? "",
              challan: x.challan.trim(),
              reference: x.reference ?? "",
              product: x.product ?? "",
              cartons: x.cartons,
              deliveredCartons: 0,
              rejectedCartons: 0,
              scheduledAt: x.scheduledAt,
              assignedDriverId: driverId,
              vehicle: x.vehicle ?? "",
              route: x.route ?? "",
              status: driverId ? "Assigned" : "Scheduled",
              notes: x.notes ?? "",
              proofStatus: "Missing",
              proofNotes: "",
              photos: [],
              photoMetadata: [],
              gps: null,
              gpsTrail: [],
              scannedBarcodes: [],
              proofSubmissionIds: [],
              expectedDurationMinutes: x.expectedDurationMinutes ?? 120,
              unitPrice: x.unitPrice ?? null,
              taxPercent: x.taxPercent ?? null,
              startedAt: null,
              arrivedAt: null,
              parentDeliveryId: null,
              createdAt: now,
              updatedAt: now,
              completedAt: null,
              verifiedAt: null,
            };
            assertScheduleAvailable(store, d);
            store.deliveries.unshift(d);
            addAudit(store, {
              action: "delivery_created",
              actorId: ctx.user.id,
              actorName: ctx.user.name,
              targetId: d.id,
              details: `${d.id} created by CSV import for ${d.customer}`,
            });
            return serializeDelivery(d, store)!;
          });
          return { created: created.length, deliveries: created };
        });
      }),
    createFollowUp: protectedProcedure
      .input(
        z.object({
          deliveryId: z.string(),
          challan: z.string().min(1).max(80),
          scheduledAt: z.string().min(1),
          assignedDriverId: z.string().uuid().optional(),
          vehicle: z.string().max(50).optional(),
          expectedDurationMinutes: z.number().int().min(1).max(1440).optional(),
        })
      )
      .mutation(({ input, ctx }) => {
        if (!canCreateDelivery(ctx.user.role))
          throw new TRPCError({ code: "FORBIDDEN", message: "Not permitted." });
        return withStore(store => {
          const parent = findDelivery(input.deliveryId, store);
          if (!parent)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          if (parent.status !== "Partially Delivered")
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Follow-up deliveries are only available after a partial POD.",
            });
          const challan = input.challan.trim();
          if (
            store.deliveries.some(
              d => d.challan.toLowerCase() === challan.toLowerCase()
            )
          )
            throw new TRPCError({
              code: "CONFLICT",
              message: "Challan already exists.",
            });
          const remaining =
            parent.cartons - parent.deliveredCartons - parent.rejectedCartons;
          if (remaining <= 0)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "No cartons remain for follow-up.",
            });
          const driver = input.assignedDriverId
            ? findUserById(input.assignedDriverId, store)
            : undefined;
          if (
            input.assignedDriverId &&
            (!driver || driver.role !== "Driver" || !driver.active)
          )
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Choose an active Driver account.",
            });
          const now = new Date().toISOString();
          const d: any = {
            ...parent,
            id: nextDeliveryId(store),
            challan,
            cartons: remaining,
            deliveredCartons: 0,
            rejectedCartons: 0,
            scheduledAt: input.scheduledAt,
            assignedDriverId: input.assignedDriverId ?? null,
            vehicle: input.vehicle ?? parent.vehicle,
            expectedDurationMinutes:
              input.expectedDurationMinutes ??
              parent.expectedDurationMinutes ??
              120,
            status: input.assignedDriverId ? "Assigned" : "Scheduled",
            parentDeliveryId: parent.id,
            recurrenceGroupId: null,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
            verifiedAt: null,
            proofStatus: "Missing",
            proofNotes: "",
            photos: [],
            photoMetadata: [],
            gps: null,
            gpsTrail: [],
            scannedBarcodes: [],
            proofSubmissionIds: [],
          };
          assertScheduleAvailable(store, d);
          store.deliveries.unshift(d);
          addAudit(store, {
            action: "delivery_followup_created",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: d.id,
            details: `${d.id} follow-up for ${parent.id} (${remaining} cartons)`,
          });
          return serializeDelivery(d, store);
        });
      }),
    recordCartonScan: protectedProcedure
      .input(
        z.object({
          deliveryId: z.string(),
          barcode: z.string().trim().min(1).max(160),
        })
      )
      .mutation(({ input, ctx }) =>
        withStore(store => {
          const d = findDelivery(input.deliveryId, store);
          if (!d)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          if (ctx.user.role === "Driver" && d.assignedDriverId !== ctx.user.id)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not assigned.",
            });
          d.scannedBarcodes ??= [];
          const duplicate = d.scannedBarcodes.includes(input.barcode);
          if (!duplicate && d.scannedBarcodes.length >= d.cartons)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "All dispatched cartons have already been scanned.",
            });
          if (!duplicate) d.scannedBarcodes.push(input.barcode);
          return { scannedCount: d.scannedBarcodes.length, duplicate };
        })
      ),
    createTrackingLink: protectedProcedure
      .input(z.object({ deliveryId: z.string() }))
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, [
          "Owner",
          "Director",
          "Dispatch Manager",
          "Dispatch Staff",
        ]);
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        withStore(store => {
          if (!findDelivery(input.deliveryId, store))
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          store.trackingTokens ??= [];
          store.trackingTokens = store.trackingTokens.filter(
            t => t.deliveryId !== input.deliveryId
          );
          store.trackingTokens.push({
            hash: createHash("sha256").update(token).digest("hex"),
            deliveryId: input.deliveryId,
            expiresAt,
            revokedAt: null,
          });
        });
        return { url: `/track/${token}`, expiresAt };
      }),
    revokeTrackingLink: protectedProcedure
      .input(z.object({ deliveryId: z.string() }))
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, [
          "Owner",
          "Director",
          "Dispatch Manager",
          "Dispatch Staff",
        ]);
        withStore(store => {
          for (const t of store.trackingTokens ?? [])
            if (t.deliveryId === input.deliveryId)
              t.revokedAt = new Date().toISOString();
        });
        return { success: true as const };
      }),
    getPublicTracking: publicProcedure
      .input(z.object({ token: z.string().min(30).max(200) }))
      .query(({ input }) => {
        const store = readStore();
        const hash = createHash("sha256").update(input.token).digest("hex");
        const t = (store.trackingTokens ?? []).find(
          x =>
            x.hash === hash &&
            !x.revokedAt &&
            new Date(x.expiresAt) > new Date()
        );
        if (!t)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tracking link unavailable.",
          });
        const d = findDelivery(t.deliveryId, store)!;
        const live = ["Out for Delivery", "Arrived"].includes(d.status);
        const confirmation = (store.customerConfirmations ?? [])
          .filter(item => item.deliveryId === d.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        const etaMinutes = live
          ? Math.max(5, Math.round((d.expectedDurationMinutes ?? 120) / 2))
          : null;
        const timeline = [
          {
            key: "created",
            label: "Order created",
            at: d.createdAt,
            complete: true,
          },
          {
            key: "scheduled",
            label: "Scheduled",
            at: d.scheduledAt,
            complete: true,
          },
          {
            key: "started",
            label: "On the way",
            at: d.startedAt ?? null,
            complete: live || terminalDeliveryStatuses.has(d.status),
          },
          {
            key: "arrived",
            label: "Arrived",
            at: d.arrivedAt ?? null,
            complete:
              d.status === "Arrived" || terminalDeliveryStatuses.has(d.status),
          },
          {
            key: "completed",
            label: "Completed",
            at: d.completedAt,
            complete: terminalDeliveryStatuses.has(d.status),
          },
        ];
        return {
          companyName: store.settings.companyName,
          deliveryId: d.id,
          status: d.status,
          scheduledAt: d.scheduledAt,
          deliveredCartons: d.deliveredCartons,
          cartons: d.cartons,
          customer: d.customer,
          address: d.address,
          route: d.route,
          etaMinutes,
          estimatedArrival: etaMinutes
            ? new Date(Date.now() + etaMinutes * 60_000).toISOString()
            : null,
          timeline,
          confirmation: confirmation
            ? {
                received: confirmation.received,
                customerName: confirmation.customerName,
                notes: confirmation.notes,
                createdAt: confirmation.createdAt,
              }
            : null,
          updatedAt: d.updatedAt,
          gps:
            live && d.gps
              ? { lat: d.gps.lat, lng: d.gps.lng, recordedAt: d.gps.recordedAt }
              : null,
        };
      }),
    customerConfirm: publicProcedure
      .input(
        z.object({
          token: z.string().min(30).max(200),
          customerName: z.string().min(2).max(120),
          received: z.boolean(),
          notes: z.string().max(500).optional(),
        })
      )
      .mutation(({ input }) =>
        withStore(store => {
          const hash = createHash("sha256").update(input.token).digest("hex");
          const tracking = (store.trackingTokens ?? []).find(
            item =>
              item.hash === hash &&
              !item.revokedAt &&
              new Date(item.expiresAt) > new Date()
          );
          if (!tracking)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Tracking link unavailable.",
            });
          const delivery = findDelivery(tracking.deliveryId, store);
          if (!delivery)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          store.customerConfirmations ??= [];
          const confirmation = {
            id: randomUUID(),
            deliveryId: delivery.id,
            tokenHash: hash,
            customerName: input.customerName.trim(),
            received: input.received,
            notes: input.notes?.trim() ?? "",
            createdAt: new Date().toISOString(),
          };
          store.customerConfirmations.unshift(confirmation);
          addAudit(store, {
            action: "customer_confirmation",
            actorId: null,
            actorName: confirmation.customerName,
            targetId: delivery.id,
            details: input.received
              ? "Customer confirmed receipt"
              : "Customer reported a delivery issue from tracking page",
          });
          return { success: true as const };
        })
      ),
    customerIssue: publicProcedure
      .input(
        z.object({
          token: z.string().min(30).max(200),
          issue: z.enum([
            "Missing cartons",
            "Damaged goods",
            "Wrong delivery",
            "Late delivery",
            "Other",
          ]),
          message: z.string().min(2).max(1000),
          contact: z.string().max(160).optional(),
        })
      )
      .mutation(({ input }) =>
        withStore(store => {
          const hash = createHash("sha256").update(input.token).digest("hex");
          const tracking = (store.trackingTokens ?? []).find(
            item =>
              item.hash === hash &&
              !item.revokedAt &&
              new Date(item.expiresAt) > new Date()
          );
          if (!tracking)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Tracking link unavailable.",
            });
          const delivery = findDelivery(tracking.deliveryId, store);
          if (!delivery)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Delivery not found.",
            });
          store.customerIssues ??= [];
          const issue = {
            id: randomUUID(),
            deliveryId: delivery.id,
            tokenHash: hash,
            issue: input.issue,
            message: input.message.trim(),
            contact: input.contact?.trim() ?? "",
            createdAt: new Date().toISOString(),
            resolvedAt: null,
          };
          store.customerIssues.unshift(issue);
          addAudit(store, {
            action: "customer_issue_reported",
            actorId: null,
            actorName: "Customer",
            targetId: delivery.id,
            details: `${input.issue}: ${input.message.trim()}`,
          });
          return { success: true as const };
        })
      ),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) =>
      (readStore().notifications ?? [])
        .filter(n => n.userId === ctx.user.id)
        .slice(0, 50)
    ),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.string() }))
      .mutation(({ input, ctx }) =>
        withStore(store => {
          const n = (store.notifications ?? []).find(
            x => x.id === input.notificationId && x.userId === ctx.user.id
          );
          if (!n)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Notification not found.",
            });
          n.readAt = new Date().toISOString();
          return { success: true as const };
        })
      ),
  }),
  deliveriesExtra: router({}),
  settings: router({
    get: protectedProcedure.query(({ ctx }) => {
      if (!canManageOperations(ctx.user.role))
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view settings.",
        });
      return readStore().settings;
    }),
    update: protectedProcedure
      .input(
        z.object({
          companyName: z.string().min(2).max(160),
          address: z.string().max(500),
          phone: z.string().max(80),
          email: z.string().max(160),
          website: z.string().max(160),
          timezone: z.string().min(1).max(80),
          currency: z.string().min(1).max(10),
        })
      )
      .mutation(({ input, ctx }) => {
        requireRole(ctx.user, ["Owner", "Director"]);
        return withStore(store => {
          store.settings = { ...input };
          addAudit(store, {
            action: "settings_updated",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: null,
            details: "Company settings updated",
          });
          return store.settings;
        });
      }),
  }),

  audit: router({
    list: protectedProcedure.query(({ ctx }) => {
      requireRole(ctx.user, ["Owner", "Director", "Delivery Supervisor"]);
      return readStore().audit.slice(0, 100);
    }),
  }),
});

export type AppRouter = typeof appRouter;
