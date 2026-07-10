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
import { useEffect, useState } from 'react';
import { submitReportCallable } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';

const MAX_REPORT_COMMENT_LENGTH = 500;

// Mirror the server-side per-user cooldown (submitReport.ts
// MIN_SECONDS_BETWEEN_REPORTS) on the client so the Submit button reflects it
// rather than letting the user hit a confusing backend rejection. localStorage
// keeps it consistent across stories (each story mounts its own ReportModal)
// and page reloads. UX only — the server stays the real enforcer.
const REPORT_COOLDOWN_MS = 60_000;
const LAST_REPORT_KEY = 'cc:last-report-at';

function readLastReportAt(): number {
  try {
    const n = Number(localStorage.getItem(LAST_REPORT_KEY) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastReportAt(ms: number) {
  try {
    localStorage.setItem(LAST_REPORT_KEY, String(ms));
  } catch {
    // ignore storage failures (private mode, quota)
  }
}

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

  // Client mirror of the server cooldown, seeded from the last report time.
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    const last = readLastReportAt();
    return last ? last + REPORT_COOLDOWN_MS : 0;
  });
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      setNowTick(Date.now());
      if (Date.now() >= cooldownUntil) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemainingSec = Math.max(
    0,
    Math.ceil((cooldownUntil - nowTick) / 1000)
  );
  const cooldownActive = cooldownRemainingSec > 0;

  const disabled = !canReport || !user;

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
      console.log('[REPORT WRITE] submitReport', story.id);
      await submitReportCallable({
        storyId: story.id,
        reason,
        comment: comment.trim() || undefined,
      });

      const submittedAt = Date.now();
      writeLastReportAt(submittedAt);
      setCooldownUntil(submittedAt + REPORT_COOLDOWN_MS);

      setOpen(false);
      setReason('');
      setComment('');

      notifications.show({
        title: 'Report submitted',
        message: 'Thank you for helping us keep the site safe and enjoyable.',
        color: 'green',
        position: 'bottom-center',
      });
    } catch (err: any) {
      const code: string = err?.code ?? '';
      let title = 'Report failed';
      let color = 'red';
      let msg: string;

      if (code === 'functions/already-exists') {
        title = 'Already reported';
        color = 'blue';
        msg = 'You have already reported this story. Thank you for your feedback.';
      } else if (code === 'functions/resource-exhausted') {
        // Server sends the specific cooldown / daily-cap message.
        title = 'Slow down';
        color = 'yellow';
        msg =
          err?.message ??
          'You are reporting too frequently. Please try again later.';
      } else if (code === 'functions/failed-precondition') {
        msg = err?.message ?? "You can't report this story.";
      } else if (code === 'functions/unauthenticated') {
        msg = 'You must be logged in to report a story.';
      } else {
        console.error('Failed to submit report', err);
        msg = 'Something went wrong while submitting the report. Please try again.';
      }

      setError(msg);
      notifications.show({
        title,
        message: msg,
        color,
        position: 'bottom-center',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
<Tooltip
  label={
    disabled
      ? 'You must be logged in to report a story'
      : 'Report this story'
  }
  withArrow
>
  <ActionIcon
    variant="subtle"
    radius="md"
    aria-label="Report this story"
    onClick={() => {
      if (disabled) return;
      setError(null);
      setOpen(true);
    }}
    style={{
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
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
              <Radio value="tags" label="Improper/lack of tags" />
              <Radio value="plagiarism" label="Plagiarised content" />
              <Radio value="underage" label="Underage characters" />
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

          {cooldownActive && (
            <Text size="xs" c="dimmed">
              You can submit another report in {cooldownRemainingSec}s.
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
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={cooldownActive}
            >
              {cooldownActive ? `Wait ${cooldownRemainingSec}s` : 'Submit report'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}