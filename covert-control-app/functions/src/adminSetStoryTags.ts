// functions/src/adminSetStoryTags.ts
//
// Admin-only: overwrite the full tag list on any story. Uses "set" semantics —
// the client sends the complete desired tag array and we diff it against the
// story's current tags to maintain the `tags` collection counts, exactly like
// saveChapter does for owners. Deliberately narrow so it doesn't touch the
// fragile owner-facing story functions.
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { db } from './lib/db';
import {
  cleanTags,
  normalizeTagId,
  incrementTags,
  decrementThenCleanupTags,
} from './lib/tags';

type CallableAuth = {
  uid: string;
  token?: Record<string, unknown>;
};

interface AdminSetStoryTagsRequest {
  storyId?: string;
  tags?: string[];
}

interface StoryDocData {
  tags?: string[];
}

function getIsAdmin(auth: CallableAuth | undefined): boolean {
  // Matches the custom claim set by updateAdmin.ts (`isAdmin`).
  return auth?.token?.isAdmin === true;
}

export const adminSetStoryTags = onCall(
  { region: 'us-central1', enforceAppCheck: true },
  async (req: CallableRequest<AdminSetStoryTagsRequest>) => {
    const auth = req.auth as CallableAuth | undefined;

    if (!auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
    if (!getIsAdmin(auth)) throw new HttpsError('permission-denied', 'Admins only.');

    const storyId =
      typeof req.data?.storyId === 'string' ? req.data.storyId.trim() : '';
    if (!storyId) throw new HttpsError('invalid-argument', 'storyId is required.');

    // Validate + normalize the full desired tag list (throws on any violation).
    const nextTags = cleanTags(req.data?.tags);

    const storyRef = db.collection('stories').doc(storyId);
    const storySnap = await storyRef.get();
    if (!storySnap.exists) {
      throw new HttpsError('not-found', 'Story not found.');
    }

    const storyData = storySnap.data() as StoryDocData | undefined;
    const prevTags = (Array.isArray(storyData?.tags) ? storyData.tags : [])
      .map(normalizeTagId)
      .filter(Boolean);

    // Write ONLY the tags field. We intentionally do NOT bump `updatedAt`, since
    // that drives the "recently updated" feed (weeklynew) — an admin tag fix
    // shouldn't promote the story there.
    await storyRef.update({ tags: nextTags });

    // Maintain tag-collection counts for only the tags that actually changed.
    // Non-fatal: the story tags are already saved, so a count hiccup shouldn't
    // fail the request.
    try {
      const before = new Set(prevTags);
      const after = new Set(nextTags);
      const added = nextTags.filter((t) => !before.has(t));
      const removed = prevTags.filter((t) => !after.has(t));
      if (added.length) await incrementTags(added);
      if (removed.length) await decrementThenCleanupTags(removed);
    } catch (err) {
      console.error('adminSetStoryTags: tag count maintenance failed', err);
    }

    return { ok: true as const, storyId, tags: nextTags };
  }
);
