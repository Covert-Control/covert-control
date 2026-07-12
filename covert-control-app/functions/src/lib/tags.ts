// functions/src/lib/tags.ts
//
// Tag-count maintenance for the `tags` collection (one doc per tag, each with a
// `count`). Previously these ran from onStoryWrite Firestore triggers, which
// fired on EVERY story-doc write — including every view and every like — and
// no-opped. We now call these directly from the only three places tags actually
// change (story create, chapter-1 meta edit, story delete), so no work happens
// on views/likes.
import { HttpsError } from 'firebase-functions/v2/https';
import { admin } from './admin';

export function normalizeTagId(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // strip " (123)" suffix if present
    .replace(/\s+/g, ' '); // collapse spaces
}

// Shared tag-list validation (bounds + per-tag length), matching the rules in
// createStoryWithFirstChapter / saveChapter. Kept here so new callers (e.g.
// adminSetStoryTags) reuse one source of truth without touching those functions.
const TAGS_MIN = 3;
const TAGS_MAX = 30;
const TAG_MIN_LEN = 3;
const TAG_MAX_LEN = 30;

// Canonical short "primary" tags (dominant gender + gender pairing) that are
// exempt from the min-length rule. Mirrors SHORT_TAG_ALLOWLIST / PRIMARY_TAG_GROUPS
// on the client (src/components/TagPicker.tsx) — keep the two in sync.
export const SHORT_TAG_ALLOWLIST = new Set<string>(['fd', 'md', 'ff', 'mf', 'mm']);

/**
 * Normalize, dedupe, and validate a full desired tag list. Throws HttpsError on
 * any violation. Returns the cleaned, deduped, normalized array.
 */
export function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    throw new HttpsError('invalid-argument', 'tags must be an array.');
  }

  const cleaned: string[] = [];
  for (const raw of input) {
    const tag = normalizeTagId(String(raw ?? ''));
    if (!tag) continue;

    if (tag.length < TAG_MIN_LEN && !SHORT_TAG_ALLOWLIST.has(tag)) {
      throw new HttpsError(
        'invalid-argument',
        `Tag "${tag}" is too short (min ${TAG_MIN_LEN}).`
      );
    }
    if (tag.length > TAG_MAX_LEN) {
      throw new HttpsError(
        'invalid-argument',
        `Tag "${tag}" is too long (max ${TAG_MAX_LEN}).`
      );
    }

    cleaned.push(tag);
  }

  const deduped = Array.from(new Set(cleaned));

  if (deduped.length < TAGS_MIN) {
    throw new HttpsError('invalid-argument', `Please add at least ${TAGS_MIN} tags.`);
  }
  if (deduped.length > TAGS_MAX) {
    throw new HttpsError('invalid-argument', `Please use at most ${TAGS_MAX} tags.`);
  }

  return deduped;
}

/** Increment each tag's story-count, creating the tag doc if it doesn't exist. */
export async function incrementTags(tags: Iterable<string>): Promise<void> {
  const unique = Array.from(
    new Set(Array.from(tags).map(normalizeTagId).filter(Boolean))
  );
  if (unique.length === 0) return;

  const batch = admin.firestore().batch();
  for (const id of unique) {
    const ref = admin.firestore().collection('tags').doc(id);
    batch.set(
      ref,
      {
        name: id,
        count: admin.firestore.FieldValue.increment(1),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

/** Decrement each tag's count, then delete any tag doc that drops to <= 0. */
export async function decrementThenCleanupTags(
  tags: Iterable<string>
): Promise<void> {
  const unique = Array.from(
    new Set(Array.from(tags).map(normalizeTagId).filter(Boolean))
  );
  if (unique.length === 0) return;

  const decBatch = admin.firestore().batch();
  for (const id of unique) {
    const ref = admin.firestore().collection('tags').doc(id);
    decBatch.set(
      ref,
      { count: admin.firestore.FieldValue.increment(-1) },
      { merge: true }
    );
  }
  await decBatch.commit();

  const refs = unique.map((id) => admin.firestore().collection('tags').doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  const toDelete = snaps
    .filter((s) => !s.exists || (s.data()?.count ?? 0) <= 0)
    .map((s) => s.ref);

  if (toDelete.length > 0) {
    const delBatch = admin.firestore().batch();
    for (const ref of toDelete) delBatch.delete(ref);
    await delBatch.commit();
  }
}
