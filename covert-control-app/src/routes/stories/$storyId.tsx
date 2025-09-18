import { createFileRoute, Outlet } from '@tanstack/react-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Story {
  id: string;
  title: string;
  description: string;
  content: string;   // JSON string (we'll parse in the index child)
  ownerId: string;
  username: string;
  createdAt: Date;
}

export const Route = createFileRoute('/stories/$storyId')({
  loader: async ({ params }) => {
    const ref = doc(db, 'stories', params.storyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // You can redirect to /stories if preferred
      throw new Error(`Story with ID "${params.storyId}" not found.`);
    }
    const d = snap.data() as any;
    return {
      story: {
        id: snap.id,
        title: d?.title ?? '',
        description: d?.description ?? '',
        content: d?.content ?? '',                // keep as string; child will parse
        ownerId: d?.ownerId ?? '',
        username: d?.username ?? 'Anonymous',
        createdAt: d?.createdAt?.toDate?.() ?? new Date(0),
      } as Story,
    };
  },
  component: StoryLayout,
});

function StoryLayout() {
  // Important: render children here so /edit can appear
  return <Outlet />;
}