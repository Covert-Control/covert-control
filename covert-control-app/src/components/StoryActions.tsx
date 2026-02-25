// src/components/StoryActions.tsx
import { useState } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

type Props = {
  storyId?: string;
  ownerId: string;
  isAdmin?: boolean;
};

export default function StoryActions({ storyId: propStoryId, ownerId, isAdmin }: Props) {
  const { storyId: routeStoryId } = useParams({ from: '/stories/$storyId' });
  const storyId = propStoryId ?? routeStoryId;

  const uid = useAuthStore((s) => s.user?.uid);
  const canManage = !!uid && (uid === ownerId || isAdmin);

  const navigate = useNavigate({ from: '/stories/$storyId' });
  const qc = useQueryClient();

  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!canManage || !storyId) return null;

  const handleEdit = () => navigate({ to: './edit' } as any);

  const confirmDelete = async () => {
    try {
      setBusy(true);
      setErr(null);

      await deleteDoc(doc(db, 'stories', storyId));

      // ✅ Update the SAME query keys your pages use
      qc.setQueryData<any[]>(['storiesList'], old =>
        Array.isArray(old) ? old.filter(s => s?.id !== storyId) : old
      );
      qc.setQueryData<any[]>(['authorStories', ownerId], old =>
        Array.isArray(old) ? old.filter(s => s?.id !== storyId) : old
      );

      // Optional: background reconcile (won't cause a flash since we already removed it)
      qc.invalidateQueries({ queryKey: ['storiesList'] });
      qc.invalidateQueries({ queryKey: ['authorStories', ownerId] });

      setOpened(false);
      navigate({ to: '/stories', replace: true }); // now it paints the cache without the deleted row
    } catch (e: any) {
      setErr(e?.message ?? 'Delete failed. Check permissions and try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <Group gap="xs">
        <Button variant="outline" onClick={handleEdit} disabled={busy}>Edit</Button>
        <Button color="red" onClick={() => setOpened(true)} disabled={busy}>Delete</Button>
      </Group>

      <Modal opened={opened} onClose={() => !busy && setOpened(false)} title="Delete story?" centered>
        <Text mb="sm">This will permanently remove your story. This action cannot be undone.</Text>
        {err && <Text c="red" size="sm" mb="sm">{err}</Text>}
        <Group justify="end" mt="md">
          <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Cancel</Button>
          <Button color="red" onClick={confirmDelete} loading={busy}>Delete</Button>
        </Group>
      </Modal>
    </>
  );
}
