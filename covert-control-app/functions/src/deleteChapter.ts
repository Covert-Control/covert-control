import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type DeleteChapterInput = {
  storyId: string;
  chapter: number;
};

interface StoryDocData {
  ownerId?: string;
  chapterCount?: number;
}

interface ChapterDocData {
  index?: number;
  [key: string]: unknown;
}

function asPositiveInt(n: unknown): number {
  const v = typeof n === 'string' ? Number(n) : (n as number);
  if (!Number.isFinite(v) || v <= 0) return NaN;
  return Math.floor(v);
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

export const deleteChapter = onCall<DeleteChapterInput>(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'You must be logged in.');
  }

  const storyId = String(data?.storyId ?? '').trim();
  const chapterNum = asPositiveInt(data?.chapter);

  if (!storyId) {
    throw new HttpsError('invalid-argument', 'storyId is required.');
  }
  if (!Number.isFinite(chapterNum)) {
    throw new HttpsError(
      'invalid-argument',
      'chapter must be a positive integer.'
    );
  }

  // Optional safety: do not allow deletion of Chapter 1
  if (chapterNum < 2) {
    throw new HttpsError(
      'failed-precondition',
      'Chapter 1 cannot be deleted. Delete the story instead.'
    );
  }

  const db = getFirestore();

  const storyRef = db.collection('stories').doc(storyId);
  const storySnap = await storyRef.get();

  if (!storySnap.exists) {
    throw new HttpsError('not-found', 'Story not found.');
  }

  const storyData = storySnap.data() as StoryDocData | undefined;
  const ownerId = storyData?.ownerId;
  const chapterCountRaw = storyData?.chapterCount;
  const chapterCount = Math.max(1, Number(chapterCountRaw ?? 1));

  const isAdmin = auth.token?.isAdmin === true;
  const isOwner = auth.uid === ownerId;

  if (!isAdmin && !isOwner) {
    throw new HttpsError('permission-denied', 'Not allowed.');
  }

  if (chapterNum > chapterCount) {
    throw new HttpsError('out-of-range', 'Chapter does not exist.');
  }

  const chaptersCol = storyRef.collection('chapters');

  // Fetch chapters that need to slide down
  const movingSnap = await chaptersCol
    .where('index', '>', chapterNum)
    .orderBy('index', 'asc')
    .get();

  const moving = movingSnap.docs.map((docSnap) => {
    const data = docSnap.data() as ChapterDocData;
    const oldIndex =
      typeof data.index === 'number'
        ? data.index
        : Number(docSnap.id);
    return { oldIndex, data };
  });

  // ---------- Phase 1: write temp backups ----------
  const tempOps: Array<
    (batch: FirebaseFirestore.WriteBatch) => void
  > = [];

  for (const m of moving) {
    const tempId = `__tmp__${m.oldIndex}`;
    const tempRef = chaptersCol.doc(tempId);

    const tempData: Record<string, unknown> = {
      ...m.data,
      __tmp: true,
      __tmpFrom: m.oldIndex,
      updatedAt: FieldValue.serverTimestamp(),
    };

    tempOps.push((batch) => {
      batch.set(tempRef, tempData, { merge: true });
    });
  }

  await commitBatches(db, tempOps);

  // ---------- Phase 2: delete target + old moving docs, update story count ----------
  const deleteOps: Array<
    (batch: FirebaseFirestore.WriteBatch) => void
  > = [];

  const targetRef = chaptersCol.doc(String(chapterNum));
  deleteOps.push((batch) => {
    batch.delete(targetRef);
  });

  for (const m of moving) {
    const oldRef = chaptersCol.doc(String(m.oldIndex));
    deleteOps.push((batch) => {
      batch.delete(oldRef);
    });
  }

  deleteOps.push((batch) => {
    batch.update(storyRef, {
      chapterCount: chapterCount - 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await commitBatches(db, deleteOps);

  // ---------- Phase 3: write new shifted docs + remove temps ----------
  const shiftOps: Array<
    (batch: FirebaseFirestore.WriteBatch) => void
  > = [];

  for (const m of moving) {
    const newIndex = m.oldIndex - 1;

    const newRef = chaptersCol.doc(String(newIndex));
    const tempRef = chaptersCol.doc(`__tmp__${m.oldIndex}`);

    const cleaned: ChapterDocData & Record<string, unknown> = {
      ...m.data,
    };
    delete cleaned.__tmp;
    delete cleaned.__tmpFrom;

    shiftOps.push((batch) => {
      batch.set(
        newRef,
        {
          ...cleaned,
          index: newIndex,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    shiftOps.push((batch) => {
      batch.delete(tempRef);
    });
  }

  await commitBatches(db, shiftOps);

  return {
    ok: true,
    storyId,
    deletedChapter: chapterNum,
    newChapterCount: chapterCount - 1,
  };
});
