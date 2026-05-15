import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Radio,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';

const MAX_REPORT_COMMENT_LENGTH = 500;

interface ReportModalProps {
  storyId: string;
  story: {
    id: string;
    title: string;
    ownerId: string;
    username: string;
  };
  canReport: boolean;
}

export function ReportModal({ story, canReport }: ReportModalProps) {
  const user = useAuthStore((s) => s.user);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canReport) return null;

  async function handleSubmit() {
    if (!user) {
      setError('You must be logged in to report this story.');
      notifications.show({
        title: 'Not logged in',
        message: 'You must be logged in to report a story.',
        color: 'red',
        position: 'bottom-center',
      });
      return;
    }
    if (!reason) {
      setError('Please select a reason.');
      notifications.show({
        title: 'Reason required',
        message: 'Please select a reason before submitting your report.',
        color: 'yellow',
        position: 'bottom-center',
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const reportsRef = collection(db, 'reports');
      const existingQ = query(
        reportsRef,
        where('storyId', '==', story.id),
        where('reportedBy', '==', user.uid),
        limit(1)
      );
      const existingSnap = await getDocs(existingQ);

      if (!existingSnap.empty) {
        const msg =
          'You have already reported this story. Thank you for your feedback.';
        setError(msg);
        notifications.show({
          title: 'Already reported',
          message: msg,
          color: 'blue',
          position: 'bottom-center',
        });
        setSubmitting(false);
        return;
      }

      await addDoc(reportsRef, {
        storyId: story.id,
        storyTitle: story.title ?? '',
        storyOwnerId: story.ownerId,
        storyOwnerUsername: story.username ?? null,
        reportedBy: user.uid,
        reporterEmail: user.email ?? null,
        reporterDisplayName: user.displayName ?? null,
        reason,
        comment: comment.trim() || null,
        status: 'open',
        createdAt: serverTimestamp(),
        handledAt: null,
        handledBy: null,
      });

      setOpen(false);
      setReason('');
      setComment('');

      notifications.show({
        title: 'Report submitted',
        message: 'Thank you for helping us keep the site safe and enjoyable.',
        color: 'green',
        position: 'bottom-center',
      });
    } catch (err) {
      console.error('Failed to submit report', err);
      const msg =
        'Something went wrong while submitting the report. Please try again.';
      setError(msg);
      notifications.show({
        title: 'Report failed',
        message: msg,
        color: 'red',
        position: 'bottom-center',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Tooltip label="Report this story" withArrow position="bottom">
        <ActionIcon
          variant="subtle"
          radius="md"
          aria-label="Report this story"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <Flag size={18} />
        </ActionIcon>
      </Tooltip>

      <Modal
        opened={open}
        onClose={() => {
          if (!submitting) {
            setOpen(false);
            setError(null);
          }
        }}
        title="Report this story"
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Please tell us why you are reporting this story. Reports are
            reviewed by the site admins.
          </Text>

          <Radio.Group value={reason} onChange={setReason} label="Reason" required>
            <Stack gap={4} mt="xs">
              <Radio value="nsfw" label="NSFW / sexual content" />
              <Radio value="harassment" label="Harassment or hate speech" />
              <Radio value="violence" label="Graphic violence or gore" />
              <Radio value="spam" label="Spam or scam" />
              <Radio value="other" label="Other" />
            </Stack>
          </Radio.Group>

          <Textarea
            label="Additional details (optional)"
            placeholder="Add any details that might help the admins understand the issue"
            minRows={3}
            maxLength={MAX_REPORT_COMMENT_LENGTH}
            description={`${comment.length}/${MAX_REPORT_COMMENT_LENGTH} characters`}
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
          />

          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}

          <Group justify="flex-end" mt="sm">
            <Button
              variant="default"
              onClick={() => {
                if (!submitting) {
                  setOpen(false);
                  setError(null);
                }
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Submit report
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}