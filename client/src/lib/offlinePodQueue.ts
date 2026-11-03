export type PendingProof = {
  submissionId: string;
  userId: string;
  deliveryId: string;
  deliveredCartons: number;
  rejectedCartons: number;
  notes: string;
  photos: string[];
  photoMetadata: {
    capturedAt: string;
    lat?: number;
    lng?: number;
    note?: string;
  }[];
  expectedUpdatedAt: string;
  queuedAt: string;
};

const DB_NAME = "nazmi-pod-offline-v1";
const STORE_NAME = "pending-proofs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(
        new Error("This browser does not support offline evidence storage.")
      );
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: "submissionId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Could not open offline evidence storage.")
      );
  });
}

export async function savePendingProof(proof: PendingProof): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(proof);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not queue proof."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Offline queue was interrupted."));
  }).finally(() => db.close());
}

export async function listPendingProofs(
  userId: string
): Promise<PendingProof[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as PendingProof[])
          .filter(item => item.userId === userId)
          .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
      );
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read offline queue."));
    transaction.oncomplete = () => db.close();
  });
}

export async function removePendingProof(submissionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(submissionId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not clear synced proof."));
  }).finally(() => db.close());
}
