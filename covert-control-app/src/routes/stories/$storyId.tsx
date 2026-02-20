// src/routes/stories/$storyId.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

type StorySearch = {
  chapter?: number; // optional so <Link> doesn't require `search`
};

export const Route = createFileRoute('/stories/$storyId')({
  validateSearch: (search: Record<string, unknown>): StorySearch => {
    const raw = (search as any).chapter;

    // No chapter provided => fine (defaults handled in UI)
    if (raw == null || raw === '') return {};

    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return {};

    const chapter = Math.trunc(n);
    if (chapter < 1) return {};

    return { chapter };
  },

  loader: async ({ params }) => {
    const ref = doc(db, 'stories', params.storyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Story ${params.storyId} not found`);

    const d = snap.data() as any;

    const chapterCount =
      typeof d?.chapterCount === 'number' && d.chapterCount > 0
        ? d.chapterCount
        : 1;

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
        createdAt,
        updatedAt,
        viewCount: d?.viewCount ?? 0,
        likesCount: d?.likesCount ?? 0,
        tags: Array.isArray(d?.tags) ? d.tags : [],
        chapterCount,
      },
    };
  },

  component: () => <Outlet />,
});
