import { useState } from 'react';
import { Button, Paper, Stack, Text, TextInput, Group, Loader } from '@mantine/core';
import { useForm } from '@mantine/form';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { notifications } from '@mantine/notifications';
import { auth } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { CheckIcon, XIcon, LogOut } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

function isBannedEmailError(err: any) {
  const code = String(err?.code ?? '');
  const msg = String(err?.message ?? '');
  if (code.includes('permission-denied')) return true;
  if (msg.toLowerCase().includes('email address has been banned')) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// Username constraints (must match backend)
//  - 3–30 chars
//  - letters/numbers/underscore only
//  - underscore is a separator: no leading/trailing underscore, no "__"
//  - reserved words blocked
// ─────────────────────────────────────────────────────────────
const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 30;

// Letters/numbers, underscore only as a separator between alnum runs
// Examples allowed: "Eric_Dev", "user123", "a_b_c"
// Examples rejected: "_user", "user_", "user__name", "____", "user-name", "user.name"
const USERNAME_REGEX = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/;

const RESERVED_USERNAMES = new Set<string>([
  // roles / staff / system-ish
  'admin', 'administrator', 'kike', 'nigger', 'nigga', 'nazi', 'jiggaboo', 'jigaboo',
  'jailbait', 'lolita', 'pedophile', 'paedophile', 'underage'
]);

function normalizeUsernameForChecks(raw: string) {
  return raw.trim().toLowerCase();
}

function validateUsername(raw: string): string | null {
  const v = raw.trim();

  if (!v) return 'Username is required.';
  if (v.length < USERNAME_MIN_LEN || v.length > USERNAME_MAX_LEN) {
    return `Username must be between ${USERNAME_MIN_LEN} and ${USERNAME_MAX_LEN} characters.`;
  }

  // Keep logs/UI sane
  if (/[\r\n\t]/.test(v)) {
    return 'Username cannot contain tabs or newlines.';
  }

  if (!USERNAME_REGEX.test(v)) {
    return 'Username may contain only letters, numbers, and single underscores (no leading/trailing or double underscores).';
  }

  const vLc = normalizeUsernameForChecks(v);
  if (RESERVED_USERNAMES.has(vLc)) {
    return 'That username contains a reserved word. Please choose a different one.';
  }

  return null;
}

export function SetUsernamePage() {
  const functions = getFunctions(); // ok if your project default region is fine
  const completeGoogleRegistrationCallable =
    httpsCallable<{ username: string }, any>(functions, 'completeGoogleRegistration');

  const navigate = useNavigate();

  const deleteMyAccountCallable = httpsCallable<void, any>(functions, 'deleteMyAccount');

  const currentUser = useAuthStore((s) => s.user);
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [submitting, setSubmitting] = useState(false);

  const usernameForm = useForm({
    initialValues: { newUsername: '' },
    validateInputOnChange: true,
    validateInputOnBlur: true,
    validate: {
      newUsername: (value) => validateUsername(value),
    },
  });

  async function handleCancelRegistration() {
    const user = auth.currentUser;

    try {
      if (user) {
        await deleteMyAccountCallable();
        await auth.signOut();
      }
    } catch (err: any) {
      console.error('Cancel registration deletion failed:', err);

      try {
        await auth.signOut();
      } catch {}

      notifications.show({
        title: 'Registration cancelled',
        message:
          'We signed you out. If your account could not be deleted automatically, please try again or contact support.',
        color: 'gray',
        position: 'bottom-center',
        icon: <LogOut size={18} />,
      });

      clearAuth();
      navigate({ to: '/' });
      return;
    }

    clearAuth();

    notifications.show({
      title: 'Registration cancelled',
      message: 'Your account was removed and you can keep browsing without an account.',
      color: 'gray',
      position: 'bottom-center',
      icon: <LogOut size={18} />,
    });

    navigate({ to: '/' });
  }

  const handleUsernameSubmission = async (values: { newUsername: string }) => {
    if (!currentUser) {
      notifications.show({
        title: 'Error',
        message: 'No authenticated user found. Please sign in again.',
        color: 'red',
        icon: <XIcon size={18} />,
        position: 'bottom-center',
      });

      await handleCancelRegistration();
      return;
    }

    // Ensure we send the trimmed value (matches backend normalization expectations)
    const trimmedUsername = values.newUsername.trim();

    setSubmitting(true);

    try {
      await completeGoogleRegistrationCallable({ username: trimmedUsername });

      notifications.show({
        title: 'Username Set!',
        message: `Welcome, ${trimmedUsername}! Your profile is now complete.`,
        color: 'teal',
        icon: <CheckIcon size={18} />,
        autoClose: 9000,
        position: 'bottom-center',
      });

      setAuthState(
        currentUser,
        true,
        currentUser.uid,
        trimmedUsername,
        currentUser.email ?? null,
        null,
        !!currentUser.emailVerified
      );

      navigate({ to: '/' });
    } catch (error: any) {
      console.error('Error setting username:', error);

      if (isBannedEmailError(error)) {
        notifications.show({
          title: 'Email banned',
          message:
            'This email address has been banned from registering. You can continue browsing without an account.',
          color: 'red',
          icon: <XIcon size={18} />,
          autoClose: 9000,
          position: 'bottom-center',
        });

        await handleCancelRegistration();
        return;
      }

      const errorMessage =
        error?.message || 'Failed to set username. Please try again.';

      notifications.show({
        title: 'Username Error',
        message: errorMessage,
        color: 'red',
        icon: <XIcon size={18} />,
        autoClose: 9000,
        position: 'bottom-center',
      });

      usernameForm.setFieldError('newUsername', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      p="xl"
      shadow="md"
      radius="md"
      style={{
        maxWidth: 420,
        margin: '50px auto',
        height: 'calc(100vh - 100px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Text size="lg" fw={600} ta="center" mb="xs">
        Complete Your Profile
      </Text>
      <Text size="sm" c="dimmed" ta="center" mb="lg">
        Choose a unique username to finish creating your account.
      </Text>

      <form onSubmit={usernameForm.onSubmit(handleUsernameSubmission)}>
        <Stack>
          <TextInput
            required
            label="Username"
            placeholder="3–30 characters (letters, numbers, underscore)"
            description="Allowed: letters, numbers, underscore. Must start/end with a letter or number. No double underscores."
            {...usernameForm.getInputProps('newUsername')}
            radius="md"
            disabled={submitting}
          />

          <Button type="submit" fullWidth radius="xl" loading={submitting}>
            Set Username
          </Button>

          {submitting && (
            <Group justify="center" gap="xs">
              <Loader size="sm" />
              <Text size="xs" c="dimmed">
                Setting your username…
              </Text>
            </Group>
          )}

          <Group grow>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<LogOut size={16} />}
              onClick={handleCancelRegistration}
              disabled={submitting}
            >
              Cancel registration
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
