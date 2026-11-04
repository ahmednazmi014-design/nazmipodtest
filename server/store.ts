import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  isSupabaseStoreConfigured,
  loadSupabaseStore,
  saveSupabaseStore,
} from "./supabase-store";

export type Role =
  | "Owner"
  | "Director"
  | "Dispatch Manager"
  | "Dispatch Staff"
  | "Delivery Supervisor"
  | "Driver"
  | "Accounts"
  | "Custom";

export type DeliveryStatus =
  | "Scheduled"
  | "Ready for Dispatch"
  | "Assigned"
  | "Out for Delivery"
  | "Arrived"
  | "Delivered"
  | "Partially Delivered"
  | "Failed"
  | "Cancelled";

export type GpsPoint = {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
};

export type StoredUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: Role;
  passwordHash: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastSignedIn: string | null;
};

export type StoredDelivery = {
  id: string;
  customer: string;
  address: string;
  contact: string;
  challan: string;
  reference: string;
  product: string;
  cartons: number;
  deliveredCartons: number;
  rejectedCartons: number;
  scheduledAt: string;
  assignedDriverId: string | null;
  vehicle: string;
  route: string;
  status: DeliveryStatus;
  notes: string;
  proofStatus: "Missing" | "Ready" | "Verified";
  proofNotes: string;
  photos: string[];
  gps: GpsPoint | null;
  gpsTrail: GpsPoint[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  verifiedAt: string | null;
  unitPrice?: number | null;
  taxPercent?: number | null;
  expectedDurationMinutes?: number;
  startedAt?: string | null;
  arrivedAt?: string | null;
  parentDeliveryId?: string | null;
  recurrenceGroupId?: string | null;
  scannedBarcodes?: string[];
  photoMetadata?: {
    capturedAt: string;
    lat?: number;
    lng?: number;
    note?: string;
  }[];
  proofSubmissionIds?: string[];
};

export type AuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string;
  targetId: string | null;
  details: string;
  createdAt: string;
};

export type CustomerConfirmation = {
  id: string;
  deliveryId: string;
  tokenHash: string;
  customerName: string;
  received: boolean;
  notes: string;
  createdAt: string;
};

export type CustomerIssue = {
  id: string;
  deliveryId: string;
  tokenHash: string;
  issue: string;
  message: string;
  contact: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type Store = {
  version: 1;
  users: StoredUser[];
  sessions: {
    tokenHash: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
  }[];
  deliveries: StoredDelivery[];
  audit: AuditEntry[];
  notifications?: {
    id: string;
    userId: string;
    deliveryId: string;
    type: string;
    message: string;
    createdAt: string;
    readAt: string | null;
  }[];
  trackingTokens?: {
    hash: string;
    deliveryId: string;
    expiresAt: string;
    revokedAt: string | null;
  }[];
  customerConfirmations?: CustomerConfirmation[];
  customerIssues?: CustomerIssue[];
  settings: {
    companyName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
    currency: string;
  };
};

const dataFile =
  process.env.NAZMI_DATA_FILE ||
  join(
    process.env.NAZMI_DATA_DIR || join(process.cwd(), "data"),
    "nazmi-pod.json"
  );

let memoryStore: Store | null = null;
let remoteSaveChain = Promise.resolve();

const blankStore = (): Store => ({
  version: 1,
  users: [],
  sessions: [],
  deliveries: [],
  audit: [],
  notifications: [],
  trackingTokens: [],
  customerConfirmations: [],
  customerIssues: [],
  settings: {
    companyName: "Nazmi Packaging Company (Pvt.) Ltd.",
    address: "",
    phone: "",
    email: "",
    website: "",
    timezone: "Asia/Karachi",
    currency: "PKR",
  },
});

function ensureParent() {
  mkdirSync(dirname(dataFile), { recursive: true });
}

function normalizeStore(parsed: Store): Store {
  return {
    ...blankStore(),
    ...parsed,
    notifications: parsed.notifications ?? [],
    trackingTokens: parsed.trackingTokens ?? [],
    customerConfirmations: parsed.customerConfirmations ?? [],
    customerIssues: parsed.customerIssues ?? [],
    deliveries: (parsed.deliveries ?? []).map(delivery => ({
      ...delivery,
      photos: delivery.photos ?? [],
      gpsTrail: delivery.gpsTrail ?? [],
      deliveredCartons: delivery.deliveredCartons ?? 0,
      rejectedCartons: delivery.rejectedCartons ?? 0,
      scannedBarcodes: delivery.scannedBarcodes ?? [],
      photoMetadata: delivery.photoMetadata ?? [],
      proofSubmissionIds: delivery.proofSubmissionIds ?? [],
      startedAt: delivery.startedAt ?? null,
      arrivedAt: delivery.arrivedAt ?? null,
      parentDeliveryId: delivery.parentDeliveryId ?? null,
    })),
    users: (parsed.users ?? []).map(user => ({
      ...user,
      username: user.username ?? "",
      mustChangePassword: user.mustChangePassword ?? false,
    })),
  };
}

function readDiskStore(): Store {
  try {
    if (!existsSync(dataFile)) return blankStore();
    const parsed = JSON.parse(readFileSync(dataFile, "utf8")) as Store;
    if (parsed.version !== 1) return blankStore();
    return normalizeStore(parsed);
  } catch (error) {
    console.error("[Store] Could not read data file:", error);
    return blankStore();
  }
}

export async function initializeStore() {
  if (memoryStore) return memoryStore;
  if (isSupabaseStoreConfigured()) {
    try {
      const remote = await loadSupabaseStore();
      memoryStore = remote ? normalizeStore(remote) : blankStore();
      if (!remote) await saveSupabaseStore(memoryStore);
      return memoryStore;
    } catch (error) {
      console.error("[Store] Supabase storage initialization failed:", error);
      throw error;
    }
  }
  memoryStore = readDiskStore();
  return memoryStore;
}

export function readStore(): Store {
  if (!isSupabaseStoreConfigured()) return readDiskStore();
  if (!memoryStore) memoryStore = readDiskStore();
  return memoryStore;
}

export function writeStore(store: Store) {
  if (isSupabaseStoreConfigured()) {
    memoryStore = store;
    remoteSaveChain = remoteSaveChain
      .then(() => saveSupabaseStore(store))
      .catch(error => console.error("[Store] Supabase save failed:", error));
    return;
  }
  ensureParent();
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(store, null, 2), { mode: 0o600 });
  renameSync(temporaryFile, dataFile);
}

export function withStore<T>(mutator: (store: Store) => T): T {
  const store = readStore();
  const result = mutator(store);
  writeStore(store);
  return result;
}

export function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? "",
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    lastSignedIn: user.lastSignedIn,
    mustChangePassword: user.mustChangePassword ?? false,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}

export function createUser(input: {
  name: string;
  username?: string;
  email?: string;
  phone?: string;
  role: Role;
  password: string;
}) {
  const now = new Date().toISOString();
  return withStore(store => {
    const email = normalizeEmail(input.email ?? "");
    const username = input.username?.trim() ?? "";
    if (email && store.users.some(user => user.email === email))
      throw new Error("An account with this email already exists");
    if (
      username &&
      store.users.some(
        user => (user.username ?? "").toLowerCase() === username.toLowerCase()
      )
    )
      throw new Error("An account with this username already exists");
    const user: StoredUser = {
      id: randomUUID(),
      name: input.name.trim(),
      username,
      email,
      phone: input.phone?.trim() ?? "",
      role: input.role,
      passwordHash: hashPassword(input.password),
      active: true,
      mustChangePassword: false,
      createdAt: now,
      lastSignedIn: null,
    };
    store.users.push(user);
    return user;
  });
}

export function findUserByEmail(email: string, store = readStore()) {
  return store.users.find(user => user.email === normalizeEmail(email));
}

export function findUserByIdentifier(identifier: string, store = readStore()) {
  const normalized = identifier.trim().toLowerCase();
  return store.users.find(
    user =>
      user.email.toLowerCase() === normalized ||
      (!!user.username && user.username.toLowerCase() === normalized)
  );
}

export function bootstrapOwnerFromEnvironment() {
  const configuredUsername = process.env.NAZMI_BOOTSTRAP_USERNAME?.trim();
  const configuredName = process.env.NAZMI_BOOTSTRAP_OWNER_NAME?.trim();
  const password = process.env.NAZMI_BOOTSTRAP_PASSWORD;
  if (!configuredUsername || !configuredName || !password) return false;
  return withStore(store => {
    if (
      store.users.some(
        user =>
          user.username?.toLowerCase() === configuredUsername.toLowerCase()
      )
    )
      return false;
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      name: configuredName,
      username: configuredUsername,
      email: "",
      phone: "",
      role: "Owner",
      passwordHash: hashPassword(password),
      active: true,
      mustChangePassword: false,
      createdAt: now,
      lastSignedIn: null,
    };
    store.users.push(user);
    addAudit(store, {
      action: "owner_bootstrap",
      actorId: null,
      actorName: "System",
      targetId: user.id,
      details: "Initial Owner account bootstrapped",
    });
    return true;
  });
}

export function findUserById(id: string, store = readStore()) {
  return store.users.find(user => user.id === id);
}

export function hashSessionToken(token: string) {
  return scryptSync(token, "nazmi-session", 32).toString("hex");
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 1000 * 60 * 60 * 24 * 30
  ).toISOString();
  withStore(store => {
    store.sessions = store.sessions.filter(
      session => new Date(session.expiresAt) > now && session.userId !== userId
    );
    store.sessions.push({
      tokenHash: hashSessionToken(token),
      userId,
      createdAt: now.toISOString(),
      expiresAt,
    });
  });
  return token;
}

export function deleteSession(token: string | undefined) {
  if (!token) return;
  withStore(store => {
    store.sessions = store.sessions.filter(
      session => session.tokenHash !== hashSessionToken(token)
    );
  });
}

export function revokeOtherSessions(userId: string, currentToken: string) {
  const currentHash = hashSessionToken(currentToken);
  withStore(store => {
    store.sessions = store.sessions.filter(
      session => session.userId !== userId || session.tokenHash === currentHash
    );
  });
}

export function getUserBySessionToken(token: string | undefined) {
  if (!token) return undefined;
  const store = readStore();
  const session = store.sessions.find(
    item =>
      item.tokenHash === hashSessionToken(token) &&
      new Date(item.expiresAt) > new Date()
  );
  if (!session) return undefined;
  return findUserById(session.userId, store);
}

export function addAudit(
  store: Store,
  input: Omit<AuditEntry, "id" | "createdAt">
) {
  store.audit.unshift({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  });
  store.audit = store.audit.slice(0, 1000);
}

export function nextDeliveryId(store: Store) {
  const year = new Date().getFullYear();
  const prefix = `NAZ-POD-${year}-`;
  const max = store.deliveries.reduce((highest, delivery) => {
    if (!delivery.id.startsWith(prefix)) return highest;
    return Math.max(highest, Number(delivery.id.slice(prefix.length)) || 0);
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export function findDelivery(id: string, store = readStore()) {
  return store.deliveries.find(delivery => delivery.id === id);
}

export function canManageOperations(role: Role) {
  return [
    "Owner",
    "Director",
    "Dispatch Manager",
    "Dispatch Staff",
    "Delivery Supervisor",
    "Accounts",
  ].includes(role);
}

export function canManageStaff(role: Role) {
  return ["Owner", "Director", "Dispatch Manager"].includes(role);
}

export function canVerifyPod(role: Role) {
  return [
    "Owner",
    "Director",
    "Delivery Supervisor",
    "Dispatch Manager",
  ].includes(role);
}

export function canCreateDelivery(role: Role) {
  return ["Owner", "Director", "Dispatch Manager", "Dispatch Staff"].includes(
    role
  );
}

export function dataFilePath() {
  return dataFile;
}
