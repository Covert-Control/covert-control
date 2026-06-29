//toggleLike.ts
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const toggleLike = onCall(async (request) => {
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

  // Check story exists and isn't the user's own
  const storySnap = await storyRef.get();
  if (!storySnap.exists) throw new HttpsError('not-found', 'Story not found.');
  if (storySnap.data()?.ownerId === uid) {
    throw new HttpsError('failed-precondition', "You can't like your own story.");
  }

  // Atomic batch: update user likes map + story count together
  const batch = db.batch();
  if (liked) {
    batch.update(userRef, {
      [`likedStories.${storyId}`]: true,
    });
    batch.update(storyRef, {
      likesCount: admin.firestore.FieldValue.increment(1),
    });
  } else {
    batch.update(userRef, {
      [`likedStories.${storyId}`]: admin.firestore.FieldValue.delete(),
    });
    batch.update(storyRef, {
      likesCount: admin.firestore.FieldValue.increment(-1),
    });
  }

  await batch.commit();
  return { success: true };
});