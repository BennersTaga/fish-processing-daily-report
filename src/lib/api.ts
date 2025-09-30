const BASE = import.meta.env.VITE_GAS_WEBAPP_URL as string;
const SSID = import.meta.env.VITE_SPREADSHEET_ID as string;
export const SHEET_LIST = import.meta.env.VITE_SHEET_LIST as string;
export const SHEET_ACTION = import.meta.env.VITE_SHEET_ACTION as string;
export const DRIVE_FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID_PHOTOS as string;

export type Master = Record<string, string[]>;

function requireEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

const BASE_URL = requireEnv(BASE, 'VITE_GAS_WEBAPP_URL');
const SPREADSHEET_ID = requireEnv(SSID, 'VITE_SPREADSHEET_ID');

export async function fetchMaster(): Promise<Master> {
  const url = `${BASE_URL}?action=master&spreadsheetId=${encodeURIComponent(SPREADSHEET_ID)}&sheet=${encodeURIComponent(SHEET_LIST)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('master fetch failed');
  return (await res.json()) as Master;
}

export async function postIntake(payload: unknown) {
  const res = await fetch(`${BASE_URL}?action=intake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('intake post failed');
  return await res.json();
}

export async function postInventory(payload: unknown) {
  const res = await fetch(`${BASE_URL}?action=inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('inventory post failed');
  return await res.json();
}

async function fileToDataURL(file: File) {
  const buffer = await file.arrayBuffer();
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  const base64 = btoa(binary);
  return `data:${file.type || 'image/jpeg'};base64,${base64}`;
}

export async function uploadPhotos(prefix: string, files: File[]) {
  if (!files.length) return { ok: true, files: [] };
  const dataUrls = await Promise.all(files.map(fileToDataURL));
  const form = new FormData();
  form.append('meta', JSON.stringify({ prefix }));
  dataUrls.forEach((value) => form.append('file', value));

  const res = await fetch(`${BASE_URL}?action=upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('upload failed');
  return await res.json();
}
