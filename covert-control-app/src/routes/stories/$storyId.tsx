// src/routes/stories/$storyId.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export const Route = createFileRoute('/stories/$storyId')({
  loader: async ({ params }) => {
    const ref = doc(db, 'stories', params.storyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Story ${params.storyId} not found`);

    const d = snap.data() as any;

    const chapterCount =
      typeof d?.chapterCount === 'number' && d.chapterCount > 0
        ? d.chapterCount
        : 1;

    // 🔹 Safely convert Firestore Timestamps to JS Dates (or null)
    const createdAt =
      d?.createdAt && typeof d.createdAt.toDate === 'function'
        ? (d.createdAt.toDate() as Date)
        : null;

    const updatedAt =
      d?.updatedAt && typeof d.updatedAt.toDate === 'function'
        ? (d.updatedAt.toDate() as Date)
        : null;

    return {
      story: {
        id: snap.id,
        title: d?.title ?? '',
        description: d?.description ?? '',
        ownerId: d?.ownerId ?? '',
        username: d?.username ?? 'Anonymous',
        createdAt,         // ✅ now a real Date | null
        updatedAt,         // ✅ NEW FIELD
        viewCount: d?.viewCount ?? 0,
        likesCount: d?.likesCount ?? 0,
        tags: Array.isArray(d?.tags) ? d.tags : [],
        chapterCount,
      },
    };
  },
  component: () => <Outlet />,
});
