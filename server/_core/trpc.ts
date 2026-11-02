import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const requireChangedPassword = t.middleware(async opts => {
  if (opts.ctx.user?.mustChangePassword) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Change your temporary password before continuing.",
    });
  }
  return opts.next();
});

export const passwordChangeProcedure = t.procedure.use(requireUser);
export const protectedProcedure = t.procedure
  .use(requireUser)
  .use(requireChangedPassword);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "Owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (ctx.user.mustChangePassword) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Change your temporary password before continuing.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
