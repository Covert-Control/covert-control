import { createFileRoute, Outlet } from '@tanstack/react-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export const Route = createFileRoute('/stories/$storyId')({
  loader: async ({ params }) => {
    const ref = doc(db, 'stories', params.storyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Story ${params.storyId} not found`);

    const d = snap.data() as any;
    return {
      story: {
        id: snap.id,
        title: d?.title ?? '',
        description: d?.description ?? '',
        content: d?.content ?? '',
        ownerId: d?.ownerId ?? '',
        username: d?.username ?? 'Anonymous',
        createdAt: d?.createdAt?.toDate?.() ?? new Date(0),
        tags: Array.isArray(d?.tags) ? d.tags : [],
      },
    };
  },
  component: () => <Outlet />,
});
