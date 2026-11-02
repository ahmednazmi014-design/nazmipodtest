import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getPasswordSessionCookieOptions,
  getSessionToken,
  SESSION_COOKIE,
} from "./_core/context";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
  findUserById,
  hashPassword,
  nextDeliveryId,
  publicUser,
  readStore,
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
    setup: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100),
          email: z.string().email(),
          password: passwordSchema,
          phone: z.string().max(40).optional(),
        })
      )
      .mutation(({ input, ctx }) => {
        const store = readStore();
        if (store.users.length > 0)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Owner setup is already complete. Please sign in.",
          });
        const user = createUser({ ...input, role: "Owner" });
        const token = createSession(user.id);
        withStore(next =>
          addAudit(next, {
            action: "owner_setup",
            actorId: user.id,
            actorName: user.name,
            targetId: user.id,
            details: "Owner account created",
          })
        );
        ctx.res.cookie(SESSION_COOKIE, token, {
          ...getPasswordSessionCookieOptions(ctx.req),
          maxAge: 1000 * 60 * 60 * 24 * 30,
        });
        return publicUser(user);
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(({ input, ctx }) => {
        const user = findUserByEmail(input.email);
        if (
          !user ||
          !user.active ||
          !verifyPassword(input.password, user.passwordHash)
        ) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Email or password is incorrect.",
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
          email: z.string().email(),
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
        const user = createUser(input);
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
          if (
            store.deliveries.some(
              item =>
                item.challan.toLowerCase() ===
                input.challan.trim().toLowerCase()
            )
          )
            throw new TRPCError({
              code: "CONFLICT",
              message: "A delivery with this challan already exists.",
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
          };
          store.deliveries.unshift(delivery);
          addAudit(store, {
            action: "delivery_created",
            actorId: ctx.user.id,
            actorName: ctx.user.name,
            targetId: delivery.id,
            details: `${delivery.id} created for ${delivery.customer}`,
          });
          return serializeDelivery(delivery, store);
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
          deliveredCartons: z.number().int().nonnegative(),
          rejectedCartons: z.number().int().nonnegative().optional(),
          notes: z.string().max(1000).optional(),
          photos: z.array(z.string().max(180)).max(8).optional(),
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
          delivery.proofStatus = "Ready";
          delivery.status =
            input.deliveredCartons === delivery.cartons
              ? "Delivered"
              : "Partially Delivered";
          delivery.completedAt = new Date().toISOString();
          delivery.updatedAt = delivery.completedAt;
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
  }),

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
