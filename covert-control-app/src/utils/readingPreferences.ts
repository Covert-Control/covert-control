//utils/readingPreferences.ts
import type { ReadingPreferences } from '../config/firebase';

const STORAGE_KEY = 'readingPreferences';

export function loadLocalReadingPreferences(): ReadingPreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveLocalReadingPreferences(prefs: ReadingPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore write failures (private mode, etc.)
  }
}