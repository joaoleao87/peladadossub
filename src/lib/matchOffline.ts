import { supabase } from "./supabase";

export interface PendingMatchCommand {
  id: string;
  rpc: string;
  args: Record<string, unknown>;
  createdAt: string;
}

const DB_NAME = "pelada-dos-sub-offline", STORE = "match-commands";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueMatchCommand(command: PendingMatchCommand) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(command);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function pendingMatchCommands() {
  const db = await database();
  const commands = await new Promise<PendingMatchCommand[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return commands.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function removeCommand(id: string) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function flushMatchCommands() {
  let synced = 0;
  for (const command of await pendingMatchCommands()) {
    const { error } = await supabase.rpc(command.rpc, command.args);
    if (error) {
      if (!navigator.onLine || /fetch|network/i.test(error.message)) break;
      continue;
    }
    await removeCommand(command.id);
    synced++;
  }
  return synced;
}

export function matchDeviceId() {
  const key = "pelada-match-device-id", current = localStorage.getItem(key);
  if (current) return current;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}
