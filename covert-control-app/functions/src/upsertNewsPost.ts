// functions/src/upsertNewsPost.ts
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';

const db = getFirestore();

type CallableAuth = {
  uid: string;
  token?: Record<string, unknown>;
};

interface UpsertNewsPostRequest {
  postId?: string | null;
  title?: string;
  pinned?: boolean;
  isPublished?: boolean;
  contentJSON?: unknown;
  plainText?: string;
}

function getIsAdmin(auth: CallableAuth | undefined): boolean {
  const token = auth?.token;
  return token?.admin === true || token?.isAdmin === true;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const upsertNewsPost = onCall(async (req: CallableRequest<UpsertNewsPostRequest>) => {
  const auth = req.auth as CallableAuth | undefined;

  if (!auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  if (!getIsAdmin(auth)) throw new HttpsError('permission-denied', 'Admins only.');

  const data = req.data ?? {};

  const postId =
    typeof data.postId === 'string' && data.postId.trim() ? data.postId.trim() : null;

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const pinned = data.pinned === true;
  const isPublished = data.isPublished === true;

  const contentJSON = data.contentJSON;
  const plainText = typeof data.plainText === 'string' ? data.plainText : '';

  if (title.length < 3) throw new HttpsError('invalid-argument', 'Title must be at least 3 characters.');
  if (title.length > 140) throw new HttpsError('invalid-argument', 'Title is too long (max 140).');

  // TipTap JSON sanity checks
  if (!isPlainObject(contentJSON)) {
    throw new HttpsError('invalid-argument', 'contentJSON must be an object.');
  }
  if (typeof contentJSON.type !== 'string') {
    throw new HttpsError('invalid-argument', 'contentJSON must include a string "type".');
  }

  // Keep size under control (Firestore doc max ~1 MiB)
  if (plainText.length > 50_000) {
    throw new HttpsError('invalid-argument', 'Post is too long (max 50,000 characters).');
  }

  const previewText = plainText.trim().replace(/\s+/g, ' ').slice(0, 200);

  const col = db.collection('newsPosts');
  const ref = postId ? col.doc(postId) : col.doc();
  const snap = await ref.get();
  const exists = snap.exists;

  const now = FieldValue.serverTimestamp();

  const payload: DocumentData = {
    title,
    contentJSON,
    plainText,
    previewText,
    pinned,
    isPublished,
    updatedAt: now,
  };

  if (!exists) {
    payload.createdAt = now;
    payload.authorUid = auth.uid;
  }

  if (isPublished) {
    const hadPublishedAt = exists && !!snap.data()?.publishedAt;
    if (!hadPublishedAt) payload.publishedAt = now;
  } else {
    payload.publishedAt = null;
  }

  await ref.set(payload, { merge: true });

  return { postId: ref.id, isNew: !exists };
});
