//VerifyEmailBanner.tsx
import * as React from 'react';
import { Alert, Button, Text, Stack, Group } from '@mantine/core';
import { useAuthStore } from '../stores/authStore';
import { auth, sendVerificationEmailCallable } from '../config/firebase';
import { notifications } from '@mantine/notifications';

const VERIFICATION_COOLDOWN_MS = 60_000;

export function EmailVerificationBanner() {
  const { user, isEmailVerified, email } = useAuthStore();

  const [dismissed, setDismissed] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);

  const cooldownKey = React.useMemo(() => {
    return user?.uid
      ? `cc:verify-cooldown:${user.uid}`
      : `cc:verify-cooldown:anonymous`;
  }, [user?.uid]);

  const [cooldownUntil, setCooldownUntil] = React.useState<number>(0);
  const [now, setNow] = React.useState(() => Date.now());

  // Load cooldown from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(cooldownKey);
      const parsed = raw ? Number(raw) : 0;
      setCooldownUntil(Number.isFinite(parsed) ? parsed : 0);
    } catch {
      setCooldownUntil(0);
    }
  }, [cooldownKey]);

  // Tick timer while cooling down
  React.useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const isCoolingDown = secondsLeft > 0;

  const handleResendVerification = async () => {
    if (resendLoading || isCoolingDown) return;
    if (!auth.currentUser) return;

    setResendLoading(true);

    try {
      const currentUser = auth.currentUser;

      if (!currentUser?.email) {
        throw new Error('No email found for current user.');
      }

      // Optional but good if you later enforce auth on backend
      console.log('[VERIFY EMAIL] Refreshing ID token');
      await currentUser.getIdToken(true);

      console.log('[VERIFY EMAIL] Calling sendVerificationEmailCallable');
      await sendVerificationEmailCallable();

      const until = Date.now() + VERIFICATION_COOLDOWN_MS;
      setCooldownUntil(until);

      try {
        localStorage.setItem(cooldownKey, String(until));
      } catch {
        // ignore
      }

      notifications.show({
        title: 'Verification email sent',
        message:
          'We sent a new link to your email. Check your inbox (and spam folder).',
        color: 'teal',
      });
    } catch (err) {
      console.error('Error resending verification email:', err);

      const code = (err as { code?: string })?.code ?? '';
      const message = (err as { message?: string })?.message ?? '';

      if (code === 'functions/resource-exhausted') {
        // Server-side cooldown/cap — e.g. an email was already sent at signup,
        // which the banner's local cooldown didn't know about. Sync our cooldown
        // from the server's wait time so the button reflects the real countdown.
        const waitMatch = message.match(/(\d+)\s*s/);
        const waitSec = waitMatch
          ? Number(waitMatch[1])
          : VERIFICATION_COOLDOWN_MS / 1000;
        const until = Date.now() + waitSec * 1000;
        setCooldownUntil(until);
        try {
          localStorage.setItem(cooldownKey, String(until));
        } catch {
          // ignore
        }
        notifications.show({
          title: 'Please wait a moment',
          message:
            message ||
            'You recently requested a verification email. Please wait before trying again.',
          color: 'yellow',
        });
      } else if (code === 'functions/failed-precondition') {
        notifications.show({
          title: 'Heads up',
          message: message || 'Could not send a verification email right now.',
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Could not resend',
          message:
            'Something went wrong sending the verification email. Please try again shortly.',
          color: 'red',
        });
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Don't render if not needed
  if (!user || isEmailVerified || dismissed) {
    return null;
  }

  return (
    <Alert
      color="yellow"
      variant="light"
      radius="md"
      mb="md"
      style={{ border: '1px solid rgba(255, 255, 0, 0.3)' }}
    >
      <Stack gap="xs">
        <Text fw={500}>
          Please verify your email to unlock full features.
        </Text>

        <Text size="sm" c="dimmed">
          You must verify your email to submit and like stories. We sent a link to{' '}
          <b>{email ?? 'your email address'}</b>. Please check your spam folder, or click the button to resend the verification.
        </Text>

        <Group justify="space-between" wrap="wrap">
          <Button
            size="xs"
            radius="sm"
            onClick={handleResendVerification}
            variant="default"
            loading={resendLoading}
            disabled={resendLoading || isCoolingDown}
          >
            {isCoolingDown
              ? `Resend available in ${secondsLeft}s`
              : 'Resend verification email'}
          </Button>

          <Button
            size="xs"
            radius="sm"
            color="gray"
            variant="subtle"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}