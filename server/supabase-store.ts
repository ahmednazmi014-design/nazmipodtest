import type { Store } from "./store";

const projectUrl = (
  process.env.SUPABASE_URL ?? "https://oknmpelsuyhemaextbso.supabase.co"
).replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseStoreConfigured() {
  return Boolean(projectUrl && serviceRoleKey);
}

function headers() {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function request(path: string, init: RequestInit) {
  const response = await fetch(`${projectUrl}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase store request failed (${response.status}): ${body.slice(0, 240)}`
    );
  }
  return response;
}

export async function loadSupabaseStore(): Promise<Store | null> {
  if (!isSupabaseStoreConfigured()) return null;
  const response = await request(
    "/rest/v1/nazmi_pod_store?id=eq.singleton&select=state&limit=1",
    { method: "GET" }
  );
  const rows = (await response.json()) as { state?: Store }[];
  return rows[0]?.state ?? null;
}

export async function saveSupabaseStore(store: Store) {
  if (!isSupabaseStoreConfigured()) return;
  await request("/rest/v1/nazmi_pod_store", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: "singleton",
      state: store,
      updated_at: new Date().toISOString(),
    }),
  });
}
