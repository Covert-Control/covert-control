import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';

// (No initializeApp here; index.ts already did it)

export const likeCreated = onDocumentCreated('users/{uid}/likes/{storyId}', async (event) => {
  const db = admin.firestore(); // safe because index.ts initialized
  const { storyId } = event.params;
  await db.collection('stories').doc(storyId).set(
    { likesCount: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );
});

export const likeDeleted = onDocumentDeleted('users/{uid}/likes/{storyId}', async (event) => {
  const db = admin.firestore();
  const { storyId } = event.params;
  await db.collection('stories').doc(storyId).set(
    { likesCount: admin.firestore.FieldValue.increment(-1) },
    { merge: true }
  );
});