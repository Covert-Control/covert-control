// src/routes/stories/$storyId.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

type StorySearch = {
  chapter?: number; // optional so <Link> doesn't require `search`
};

export const Route = createFileRoute('/stories/$storyId')({
  // The story doc (title, disclaimers, chapter index, counts) is identical
  // across chapters, so cache the loader result and reuse it when the reader
  // switches chapters (a ?chapter navigation on this same route) instead of
  // re-reading it every time. Default router staleTime is 0, which re-runs the
  // loader — and its getDoc — on every navigation. Mirrors the chapter-content
  // caching: authors hard-refresh to see their own edits.
  staleTime: Infinity,
  gcTime: 1000 * 60 * 60 * 24, // keep 24h so revisits within a session are free
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
    console.log('[STORY READ] loader getDoc', params.storyId);
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
        footerDisclaimer: typeof d?.footerDisclaimer === 'string' ? d.footerDisclaimer.trim() : null,
        headerDisclaimer: typeof d?.headerDisclaimer === 'string' ? d.headerDisclaimer.trim() : null,
        viewCount: d?.viewCount ?? 0,
        likesCount: d?.likesCount ?? 0,
        tags: Array.isArray(d?.tags) ? d.tags : [],
        chapterCount,
        // Per-chapter index (title + wordCount) for the reader's chapter selector.
        chapters: Array.isArray(d?.chapters)
          ? (d.chapters as { index: number; title: string | null; wordCount: number }[])
          : undefined,
      },
    };
  },

  component: () => <Outlet />,
});
