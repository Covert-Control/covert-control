import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type DeleteStoryInput = {
  storyId: string;
};

interface StoryDocData {
  ownerId?: string;
  chapterCount?: number;
}

async function commitBatches(
  db: FirebaseFirestore.Firestore,
  ops: Array<(batch: FirebaseFirestore.WriteBatch) => void>
): Promise<void> {
  let batch = db.batch();
  let count = 0;

  const flush = async () => {
    if (count === 0) return;
    await batch.commit();
    batch = db.batch();
    count = 0;
  };

  for (const op of ops) {
    op(batch);
    count += 1;
    if (count >= 450) {
      await flush();
    }
  }

  await flush();
}

export const deleteStory = onCall<DeleteStoryInput>(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }

  const storyId = String(data?.storyId ?? '').trim();
  if (!storyId) {
    throw new HttpsError('invalid-argument', 'storyId is required.');
  }

  const db = getFirestore();

  const storyRef = db.collection('stories').doc(storyId);
  const storySnap = await storyRef.get();

  if (!storySnap.exists) {
    throw new HttpsError('not-found', 'Story not found.');
  }

  const storyData = storySnap.data() as StoryDocData | undefined;
  const ownerId = storyData?.ownerId;

  const isAdmin = auth.token?.isAdmin === true;
  const isOwner = auth.uid === ownerId;

  if (!isAdmin && !isOwner) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }

  const chaptersCol = storyRef.collection('chapters');
  const chaptersSnap = await chaptersCol.get();

  const ops: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

  for (const docSnap of chaptersSnap.docs) {
    ops.push((batch) => {
      batch.delete(docSnap.ref);
    });
  }

  if (ownerId) {
    const authorRef = db.collection('authors_with_stories').doc(ownerId);
    ops.push((batch) => {
      batch.set(
        authorRef,
        {
          storyCount: FieldValue.increment(-1),
          lastStoryDate: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  ops.push((batch) => {
    batch.delete(storyRef);
  });

  await commitBatches(db, ops);

  return { ok: true, storyId };
});
