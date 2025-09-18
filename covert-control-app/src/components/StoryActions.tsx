import { Button, Group } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useNavigate } from '@tanstack/react-router';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

type Props = {
  storyId: string;
  ownerId: string;
  isAdmin?: boolean; // derive from your user profile/custom claim
};

export default function StoryActions({ storyId, ownerId, isAdmin }: Props) {
  const navigate = useNavigate();
  const uid = useAuthStore((s) => s.user?.uid);
  const canManage = !!uid && (uid === ownerId || isAdmin);

  if (!canManage) return null;

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Delete story?',
      children: 'This will permanently remove your story. This action cannot be undone.',
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'stories', storyId));
          // Cloud Function you already have will fix tag counters
          navigate({ to: '/' }); // or navigate to your profile or list
        } catch (e) {
          // surface the rules error if any
          console.error(e);
        }
      },
    });
  };

  const handleEdit = () => {
    navigate({ to: '/stories/$storyId/edit', params: { storyId } });
  };

  return (
    <Group gap="xs">
      <Button variant="outline" onClick={handleEdit}>Edit</Button>
      <Button color="red" onClick={handleDelete}>Delete</Button>
    </Group>
  );
}