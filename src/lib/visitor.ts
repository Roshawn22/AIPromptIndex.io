/**
 * Generates a persistent anonymous visitor ID for fingerprint-based dedup.
 * Stored in localStorage — no auth required.
 */
const STORAGE_KEY = 'api-visitor-id';

function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
