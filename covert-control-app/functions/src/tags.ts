// functions/src/updateTagsOnStoryEvents.ts
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const db = admin.firestore();

interface Story {
  tags?: string[];
  [key: string]: any; // allow other fields
}

/** Normalize a tag ID (must match how you store IDs in /tags) */
function normalizeTagId(tag: string) {
  return tag.trim().toLowerCase(); // keep simple; change to slug if you prefer
}

/** Add (increment) these tags in one batch */
async function batchIncrementTags(tags: Iterable<string>) {
  const batch = db.batch();
  for (const raw of tags) {
    const id = normalizeTagId(raw);
    const ref = db.collection("tags").doc(id);
    batch.set(
      ref,
      {
        name: raw, // keep original casing for display
        count: admin.firestore.FieldValue.increment(1),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

/**
 * Decrement these tags in one batch, then post-check counts
 * and batch-delete any that reached 0.
 */
async function batchDecrementThenCleanup(tags: Iterable<string>) {
  const unique = Array.from(new Set(Array.from(tags).map(normalizeTagId)));
  if (unique.length === 0) return;

  // 1) Batch decrement all
  {
    const batch = db.batch();
    for (const id of unique) {
      const ref = db.collection("tags").doc(id);
      batch.set(
        ref,
        { count: admin.firestore.FieldValue.increment(-1) },
        { merge: true }
      );
    }
    await batch.commit();
  }

  // 2) Fetch all affected tag docs in ONE call
  const refs = unique.map((id) => db.collection("tags").doc(id));
  const snaps = await db.getAll(...refs);

  // 3) Batch-delete those with count <= 0 (or missing)
  const toDelete = snaps
    .filter((s) => !s.exists || ((s.data()?.count ?? 0) <= 0))
    .map((s) => s.ref);

  if (toDelete.length > 0) {
    const delBatch = db.batch();
    for (const ref of toDelete) {
      delBatch.delete(ref);
    }
    await delBatch.commit();
  }
}

// ---------------------------
// Story Created -> increment all tags on the new story
// ---------------------------
export const updateTagsOnStoryCreate = onDocumentCreated(
  "stories/{storyId}",
  async (event) => {
    const newStory = event.data?.data() as Story | undefined;
    const tags = newStory?.tags ?? [];
    if (tags.length === 0) return;

    await batchIncrementTags(tags);
    console.log("Tags incremented for new story:", event.params.storyId);
  }
);

// ---------------------------
// Story Updated -> diff tags, increment added, decrement+cleanup removed
// ---------------------------
export const updateTagsOnStoryUpdate = onDocumentUpdated(
  "stories/{storyId}",
  async (event) => {
    const before = event.data?.before.data() as Story | undefined;
    const after = event.data?.after.data() as Story | undefined;
    if (!before && !after) return;

    const oldSet = new Set<string>(before?.tags ?? []);
    const newSet = new Set<string>(after?.tags ?? []);

    const added: string[] = [];
    const removed: string[] = [];

    for (const t of newSet) if (!oldSet.has(t)) added.push(t);
    for (const t of oldSet) if (!newSet.has(t)) removed.push(t);

    // Batch increment added tags
    if (added.length > 0) {
      await batchIncrementTags(added);
    }

    // Batch decrement removed tags, then cleanup zeros
    if (removed.length > 0) {
      await batchDecrementThenCleanup(removed);
    }

    if (added.length || removed.length) {
      console.log("Tags diff applied for story:", event.params.storyId, {
        added,
        removed,
      });
    }
  }
);

// ---------------------------
// Story Deleted -> decrement all tags on the deleted story, then cleanup
// ---------------------------
export const updateTagsOnStoryDelete = onDocumentDeleted(
  "stories/{storyId}",
  async (event) => {
    const deleted = event.data?.data() as Story | undefined;
    const tags = deleted?.tags ?? [];
    if (tags.length === 0) return;

    await batchDecrementThenCleanup(tags);
    console.log("Tags decremented for deleted story:", event.params.storyId);
  }
);
