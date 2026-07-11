// functions/src/lib/tags.ts
//
// Tag-count maintenance for the `tags` collection (one doc per tag, each with a
// `count`). Previously these ran from onStoryWrite Firestore triggers, which
// fired on EVERY story-doc write — including every view and every like — and
// no-opped. We now call these directly from the only three places tags actually
// change (story create, chapter-1 meta edit, story delete), so no work happens
// on views/likes.
import { admin } from './admin';

export function normalizeTagId(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // strip " (123)" suffix if present
    .replace(/\s+/g, ' '); // collapse spaces
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
