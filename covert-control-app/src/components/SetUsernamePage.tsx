import { Button, Paper, Stack, Text, TextInput, Group } from '@mantine/core';
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
  // v2 callable HttpsError('permission-denied', ...) typically surfaces like:
  // code: "functions/permission-denied"
  if (code.includes('permission-denied')) return true;

  // fallback if code is missing
  if (msg.toLowerCase().includes('email address has been banned')) return true;

  return false;
}

export function SetUsernamePage() {
  const functions = getFunctions(); // ok if your project default region is fine
  const completeGoogleRegistrationCallable =
    httpsCallable<{ username: string }, any>(functions, 'completeGoogleRegistration');

  const navigate = useNavigate();

  const currentUser = useAuthStore((s) => s.user);
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const usernameForm = useForm({
    initialValues: { newUsername: '' },
    validate: {
      newUsername: (value) => {
        if (!value.trim()) return 'Username cannot be empty';
        if (value.length < 3 || value.length > 20) {
          return 'Username must be between 3 and 20 characters';
        }
        return null;
      },
    },
  });

  async function handleCancelRegistration() {
    try {
      await auth.signOut();
    } finally {
      // make the gate drop immediately, even before listener resolves
      clearAuth();
    }

    notifications.show({
      title: 'Registration cancelled',
      message: 'You can keep browsing without an account.',
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

    try {
      await completeGoogleRegistrationCallable({ username: values.newUsername });

      notifications.show({
        title: 'Username Set!',
        message: `Welcome, ${values.newUsername}! Your profile is now complete.`,
        color: 'teal',
        icon: <CheckIcon size={18} />,
        autoClose: 9000,
        position: 'bottom-center',
      });

      // Update store so __root gate releases immediately
      setAuthState(
        currentUser,
        true,
        currentUser.uid,
        values.newUsername,
        currentUser.email ?? null,
        null,
        !!currentUser.emailVerified
      );

      navigate({ to: '/' });
    } catch (error: any) {
      console.error('Error setting username:', error);

      // If banned, let them escape the gate
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
            placeholder="Your unique username"
            {...usernameForm.getInputProps('newUsername')}
            radius="md"
          />

          <Button type="submit" fullWidth radius="xl">
            Set Username
          </Button>

          <Group grow>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<LogOut size={16} />}
              onClick={handleCancelRegistration}
            >
              Cancel registration
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
