import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getUserBySessionToken, publicUser, type Role } from "../store";

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastSignedIn: string | null;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthUser | null;
};

const SESSION_COOKIE = COOKIE_NAME;

export function getSessionToken(req: {
  headers: { cookie?: string; authorization?: string };
}) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  if (bearer) return bearer;
  return parseCookieHeader(req.headers.cookie ?? "")[SESSION_COOKIE];
}

export function getRequestUser(req: {
  headers: { cookie?: string; authorization?: string };
}): AuthUser | null {
  const user = getUserBySessionToken(getSessionToken(req));
  if (!user || !user.active) return null;
  return publicUser(user);
}

export function getPasswordSessionCookieOptions(req?: { protocol?: string }) {
  const production =
    process.env.NODE_ENV === "production" || req?.protocol === "https";
  return {
    httpOnly: true,
    path: "/",
    sameSite: production ? ("none" as const) : ("lax" as const),
    secure: production,
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  return {
    req: opts.req,
    res: opts.res,
    user: getRequestUser(opts.req),
  };
}

export { SESSION_COOKIE };
