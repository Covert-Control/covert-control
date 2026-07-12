// src/components/AdminEditTagsModal.tsx
//
// Admin-only modal for overwriting a story's full tag list. Uses the shared
// TagPicker, seeded from the story's current tags (no extra read), and calls the
// adminSetStoryTags callable with "set" semantics. On success it hands the saved
// tags back to the parent so the tags row updates immediately without a re-read.
import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TagPicker, PRIMARY_TAG_GROUPS } from './TagPicker';
import { adminSetStoryTagsCallable } from '../config/firebase';

// Keep these in sync with the server (cleanTags in functions/src/lib/tags.ts).
const TAGS_MIN = 3;
const TAGS_MAX = 30;

type AdminEditTagsModalProps = {
  opened: boolean;
  onClose: () => void;
  storyId: string;
  initialTags: string[];
  onSaved: (tags: string[]) => void;
};

export function AdminEditTagsModal({
  opened,
  onClose,
  storyId,
  initialTags,
  onSaved,
}: AdminEditTagsModalProps) {
  const [value, setValue] = useState<string[]>(initialTags);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed from the story's current tags each time the modal opens.
  useEffect(() => {
    if (opened) setValue(initialTags);
  }, [opened, initialTags]);

  const tagCount = value.length;
  const tooFew = tagCount < TAGS_MIN;
  const tooMany = tagCount > TAGS_MAX;
  const canSave = !submitting && !tooFew && !tooMany;

  async function handleSave() {
    if (!canSave) return;
    setSubmitting(true);
    try {
      const res = await adminSetStoryTagsCallable({ storyId, tags: value });
      const savedTags = res.data.tags;
      console.log('[ADMIN TAGS WRITE] adminSetStoryTags —', savedTags.length, 'tags');

      onSaved(savedTags);
      notifications.show({
        title: 'Tags updated',
        message: "The story's tags have been saved.",
        color: 'green',
        position: 'bottom-center',
      });
      onClose();
    } catch (err: any) {
      const code: string = err?.code ?? '';
      let msg: string;

      if (
        code === 'functions/invalid-argument' ||
        code === 'functions/failed-precondition'
      ) {
        // Server sends the specific reason (e.g. "Please add at least 3 tags.").
        msg = err?.message ?? 'Those tags are not valid.';
      } else if (code === 'functions/permission-denied') {
        msg = 'You do not have permission to edit tags on this story.';
      } else if (code === 'functions/not-found') {
        msg = 'Story not found.';
      } else if (code === 'functions/unauthenticated') {
        msg = 'You must be logged in.';
      } else {
        console.error('adminSetStoryTags failed', err);
        msg = 'Something went wrong while saving tags. Please try again.';
      }

      notifications.show({
        title: 'Update failed',
        message: msg,
        color: 'red',
        position: 'bottom-center',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const helperColor = tooFew || tooMany ? 'red' : 'dimmed';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit tags (admin)"
      size="lg"
      centered
    >
      <Stack gap="sm">
        <TagPicker
          value={value}
          onChange={setValue}
          maxTags={TAGS_MAX}
          minTagLength={3}
          featuredTitle="Recommended tags"
          featuredGroups={PRIMARY_TAG_GROUPS}
        />

        <Text size="xs" c={helperColor}>
          {TAGS_MIN}–{TAGS_MAX} tags required (currently {tagCount}).
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={submitting} disabled={!canSave}>
            Save tags
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
