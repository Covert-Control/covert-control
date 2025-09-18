import { createFileRoute, redirect } from '@tanstack/react-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';

export const Route = createFileRoute('/stories/$storyId/edit')({
  // Load the story (guarding existence)
  loader: async ({ params }) => {
    const ref = doc(db, 'stories', params.storyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw redirect({ to: '/' });
    return { story: { id: snap.id, ...(snap.data() as any) } };
  },
  component: EditStoryPage,
});

function EditStoryPage() {
  const { story } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const user = useAuthStore((s) => s.user); // { uid, ... } from your Zustand store

  // Client-side guard so non-owners don't see the editor UI
  useEffect(() => {
    if (!user) return; // wait for auth to populate
    const isAdmin = (user as any)?.isAdmin === true; // if you store this in state
    if (user.uid !== story.ownerId && !isAdmin) {
      navigate({ to: '/stories/$storyId', params: { storyId: story.id } });
    }
  }, [user, story, navigate]);

  const form = useForm({
    initialValues: {
      title: story.title ?? '',
      description: story.description ?? '',
      content: story.content ?? '',
      // If you edit tags here, reuse your TagPicker & sanitize()
      // tags: story.tags ?? [],
    },
  });

  const onSubmit = form.onSubmit(async (values) => {
    await updateDoc(doc(db, 'stories', story.id), {
      title: values.title,
      description: values.description,
      content: values.content,
      updatedAt: serverTimestamp(),
    });
    navigate({ to: '/stories/$storyId', params: { storyId: story.id } });
  });

  return (
    <form onSubmit={onSubmit}>
      <Stack gap="md">
        <TextInput label="Title" {...form.getInputProps('title')} />
        <Textarea label="Description" autosize minRows={2} {...form.getInputProps('description')} />
        <Textarea label="Content" autosize minRows={8} {...form.getInputProps('content')} />

        <Group justify="end">
          <Button variant="default" onClick={() => navigate({ to: '/stories/$storyId', params: { storyId: story.id } })}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Group>
      </Stack>
    </form>
  );
}
