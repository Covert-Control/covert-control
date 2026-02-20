import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { admin } from './lib/admin';

/* ------------------------------------------------------------------ */
/*  Tag counters (create / update / delete)                            */
/* ------------------------------------------------------------------ */

interface Story {
  tags?: string[];
  [key: string]: unknown;
}

function normalizeTagId(tag: string) {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, '') // strip " (123)" suffix if present
    .replace(/\s+/g, ' ');         // collapse spaces
}

async function batchIncrementTags(tags: Iterable<string>) {
  const batch = admin.firestore().batch();
  for (const raw of tags) {
    const id = normalizeTagId(raw);
    const ref = admin.firestore().collection('tags').doc(id);
    batch.set(
      ref,
      {
        name: id,
        count: admin.firestore.FieldValue.increment(1),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
}

async function batchDecrementThenCleanup(tags: Iterable<string>) {
  const unique = Array.from(new Set(Array.from(tags).map(normalizeTagId)));
  if (unique.length === 0) return;

  {
    const batch = admin.firestore().batch();
    for (const id of unique) {
      const ref = admin.firestore().collection('tags').doc(id);
      batch.set(ref, { count: admin.firestore.FieldValue.increment(-1) }, { merge: true });
    }
    await batch.commit();
  }

  const refs = unique.map((id) => admin.firestore().collection('tags').doc(id));
  const snaps = await Promise.all(refs.map((r) => r.get()));

  const toDelete = snaps.filter((s) => !s.exists || ((s.data()?.count ?? 0) <= 0)).map((s) => s.ref);
  if (toDelete.length > 0) {
    const delBatch = admin.firestore().batch();
    for (const ref of toDelete) delBatch.delete(ref);
    await delBatch.commit();
  }
}

export const updateTagsOnStoryCreate = onDocumentCreated('stories/{storyId}', async (event) => {
  const newStory = event.data?.data() as Story | undefined;
  const tags = newStory?.tags ?? [];
  if (tags.length === 0) return;

  await batchIncrementTags(tags);
  logger.log('Tags incremented for new story:', event.params.storyId);
});

export const updateTagsOnStoryUpdate = onDocumentUpdated('stories/{storyId}', async (event) => {
  const before = event.data?.before.data() as Story | undefined;
  const after = event.data?.after.data() as Story | undefined;
  if (!before && !after) return;

  const oldSet = new Set<string>(before?.tags ?? []);
  const newSet = new Set<string>(after?.tags ?? []);

  const added: string[] = [];
  const removed: string[] = [];

  for (const t of newSet) if (!oldSet.has(t)) added.push(t);
  for (const t of oldSet) if (!newSet.has(t)) removed.push(t);

  if (added.length > 0) await batchIncrementTags(added);
  if (removed.length > 0) await batchDecrementThenCleanup(removed);

  if (added.length || removed.length) {
    logger.log('Tags diff applied for story:', event.params.storyId, { added, removed });
  }
});

export const updateTagsOnStoryDelete = onDocumentDeleted('stories/{storyId}', async (event) => {
  const deleted = event.data?.data() as Story | undefined;
  const tags = deleted?.tags ?? [];
  if (tags.length === 0) return;

  await batchDecrementThenCleanup(tags);
  logger.log('Tags decremented for deleted story:', event.params.storyId);
});
