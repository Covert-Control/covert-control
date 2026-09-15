//toggleLike.ts
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const toggleLike = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in.');

  const { storyId, liked } = request.data as { storyId: string; liked: boolean };
  if (!storyId || typeof liked !== 'boolean') {
    throw new HttpsError('invalid-argument', 'storyId and liked are required.');
  }

  // Verify email
  const token = request.auth?.token;
  if (!token?.email_verified) {
    throw new HttpsError('failed-precondition', 'Email must be verified to like stories.');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const storyRef = db.collection('stories').doc(storyId);

  // Run in a transaction so likesCount only ever moves on a *real* state change.
  // This makes the call idempotent: repeated liked:true can't inflate the count,
  // and repeated liked:false can't drive it negative. Reads must precede writes.
  const changed = await db.runTransaction(async (tx) => {
    const storySnap = await tx.get(storyRef);
    if (!storySnap.exists) throw new HttpsError('not-found', 'Story not found.');
    if (storySnap.data()?.ownerId === uid) {
      throw new HttpsError('failed-precondition', "You can't like your own story.");
    }

    const userSnap = await tx.get(userRef);
    const likedMap =
      (userSnap.get('likedStories') as Record<string, unknown> | undefined) ?? {};
    const alreadyLiked = likedMap[storyId] === true;

    // Requested state already matches what's stored — touch nothing.
    if (liked === alreadyLiked) return false;

    if (liked) {
      tx.update(userRef, { [`likedStories.${storyId}`]: true });
      tx.update(storyRef, { likesCount: admin.firestore.FieldValue.increment(1) });
    } else {
      tx.update(userRef, { [`likedStories.${storyId}`]: admin.firestore.FieldValue.delete() });
      tx.update(storyRef, { likesCount: admin.firestore.FieldValue.increment(-1) });
    }

    return true;
  });

  return { success: true, liked, changed };
});