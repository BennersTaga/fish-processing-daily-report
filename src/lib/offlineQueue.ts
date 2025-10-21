import { recordToSheet } from './api';

type Item = { type: 'intake' | 'inventory'; payload: unknown };
const KEY = 'fish-demo.pendingSubmissions';

function readQueue(): Item[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Item[]) : [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

function writeQueue(items: Item[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueue(item: Item) {
  const items = readQueue();
  items.push(item);
  writeQueue(items);
}

export function dequeueAll(): Item[] {
  const items = readQueue();
  localStorage.removeItem(KEY);
  return items;
}

export async function syncPending() {
  const tasks = dequeueAll();
  if (!tasks.length) return;
  const retry: Item[] = [];
  for (const task of tasks) {
    try {
      await recordToSheet(task.payload, task.type);
    } catch (err) {
      console.error('sync failed', err);
      retry.push(task);
    }
  }
  if (retry.length) {
    const existing = readQueue();
    writeQueue([...retry, ...existing]);
  }
}
