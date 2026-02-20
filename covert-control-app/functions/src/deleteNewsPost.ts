// functions/src/deleteNewsPost.ts
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

type CallableAuth = {
  uid: string;
  token?: Record<string, unknown>;
};

interface DeleteNewsPostRequest {
  postId?: string;
}

function getIsAdmin(auth: CallableAuth | undefined): boolean {
  const token = auth?.token;
  return token?.admin === true || token?.isAdmin === true;
}

export const deleteNewsPost = onCall(async (req: CallableRequest<DeleteNewsPostRequest>) => {
  const auth = req.auth as CallableAuth | undefined;

  if (!auth) throw new HttpsError('unauthenticated', 'You must be signed in.');
  if (!getIsAdmin(auth)) throw new HttpsError('permission-denied', 'Admins only.');

  const postId = typeof req.data?.postId === 'string' ? req.data.postId.trim() : '';
  if (!postId) throw new HttpsError('invalid-argument', 'postId is required.');

  await db.collection('newsPosts').doc(postId).delete();
  return { ok: true };
});
