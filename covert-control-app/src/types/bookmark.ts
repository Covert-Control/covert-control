// src/types/bookmark.ts

// Maximum favorite "sections" a user may save per story.
export const MAX_SECTIONS_PER_STORY = 10;

// Quote text is stored only as a short anchor/preview, not the full passage.
// Used for the list preview, re-highlighting the start, and re-finding the
// paragraph if its index ever drifts after an author edit.
export const MAX_QUOTE_LEN = 100;

/**
 * The singular "resume reading" bookmark for a story. Overwritten each time
 * the user saves their place.
 *
 * `from`/`to` are ProseMirror document positions in the chapter — the precise,
 * disambiguating anchor (the 47th "The" has a different position than the 1st).
 * `quote` verifies the position still matches on restore and is the fallback
 * when an author edit shifts positions. `paragraphIndex` is legacy: bookmarks
 * saved before the from/to scheme only have it.
 */
export interface BookmarkPlace {
  chapter: number;
  // First ~100 chars of the selection (preview + verify + re-find fallback).
  quote: string;
  // ProseMirror doc positions of the selection (primary, precise anchor).
  from?: number;
  to?: number;
  // Legacy top-level block index (pre-from/to bookmarks only).
  paragraphIndex?: number;
}

/**
 * A saved "favorite section" — a passage the user wants to jump back to and
 * re-read. Many allowed per story (up to MAX_SECTIONS_PER_STORY).
 */
export interface BookmarkSection {
  chapter: number;
  quote: string;
  from?: number;
  to?: number;
  paragraphIndex?: number;
  // Optional user-supplied name; falls back to a snippet of `quote` for display.
  label?: string;
  // Doubles as the stable identity for React keys and removal.
  createdAtMs: number;
}

/**
 * Everything stored for one story under `users/{uid}.bookmarks[storyId]`.
 */
export interface StoryBookmarks {
  // Denormalized story metadata (title + author username) so the /bookmarks
  // list renders straight from this map with zero per-story reads. Written when
  // a bookmark is saved; may be absent on bookmarks created before this scheme.
  title?: string;
  username?: string;
  place?: BookmarkPlace;
  sections: BookmarkSection[];
}

/** The full map keyed by storyId, hydrated from the user doc at sign-in. */
export type BookmarksByStory = Record<string, StoryBookmarks>;

/** Truncate selected text to the stored quote length, collapsing whitespace. */
export function toQuote(raw: string): string {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim();
  return cleaned.length > MAX_QUOTE_LEN
    ? cleaned.slice(0, MAX_QUOTE_LEN).trimEnd()
    : cleaned;
}

/** Display name for a section: user label if present, else a snippet of the quote. */
export function sectionDisplayName(section: BookmarkSection): string {
  const label = section.label?.trim();
  if (label) return label;

  const quote = (section.quote ?? '').trim();
  if (!quote) return 'Untitled section';

  // First ~8 words, capped, with an ellipsis if we truncated.
  const words = quote.split(' ');
  const snippet = words.slice(0, 8).join(' ');
  const truncated = words.length > 8 || snippet.length < quote.length;
  return truncated ? `${snippet}…` : snippet;
}
