// functions/src/updateNewsPostFlags.ts
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { db } from './lib/db';

type CallableAuth = {
  uid: string;
  token?: Record<string, unknown>;
};

interface UpdateNewsPostFlagsRequest {
  postId?: string;
  pinned?: boolean;
  isPublished?: boolean;
}

function getIsAdmin(auth: CallableAuth | undefined): boolean {
  // Matches the custom claim set by updateAdmin.ts (`isAdmin`).
  return auth?.token?.isAdmin === true;
}

export const updateNewsPostFlags = onCall(
  { enforceAppCheck: true },
  async (req: CallableRequest<UpdateNewsPostFlagsRequest>) => {
    const auth = req.auth as CallableAuth | undefined;

    if (!auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
    if (!getIsAdmin(auth)) throw new HttpsError('permission-denied', 'Admins only.');

    const data = req.data ?? {};
    const postId = typeof data.postId === 'string' ? data.postId.trim() : '';
    if (!postId) throw new HttpsError('invalid-argument', 'postId is required.');

    const ref = db.collection('newsPosts').doc(postId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'News post not found.');

    const now = FieldValue.serverTimestamp();

    const updates: DocumentData = {
      updatedAt: now,
    };

    if (typeof data.pinned === 'boolean') updates.pinned = data.pinned;

    if (typeof data.isPublished === 'boolean') {
      updates.isPublished = data.isPublished;
      updates.publishedAt = data.isPublished ? now : null;
    }

    await ref.update(updates);
    return { ok: true };
  }
);
