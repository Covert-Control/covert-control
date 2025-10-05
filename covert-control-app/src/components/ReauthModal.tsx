import { useState } from 'react';
import { Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import {
  getAuth,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';

export function ReauthModal({
  opened,
  onClose,
  onSuccess,
}: {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void; // call after successful reauth
}) {
  const auth = getAuth();
  const user = auth.currentUser!;
  const providers = new Set(user?.providerData?.map((p) => p?.providerId));
  const hasPassword = providers.has('password');
  const hasGoogle = providers.has('google.com');

  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reauthWithPassword() {
    if (!user?.email) {
      setError('This account has no email/password credential.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Re-authentication failed.');
    } finally {
      setPending(false);
    }
  }

  async function reauthWithGoogle() {
    setPending(true);
    setError(null);
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Re-authentication failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Please verify it’s you" centered>
      <Stack>
        <Text c="dimmed" size="sm">
          For your security, you need a recent sign-in to delete your account.
        </Text>

        {hasPassword && (
          <>
            <TextInput
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              disabled={pending}
            />
            <Button onClick={reauthWithPassword} loading={pending}>
              Verify with Password
            </Button>
          </>
        )}

        {hasGoogle && (
          <Button variant={hasPassword ? 'outline' : 'filled'} onClick={reauthWithGoogle} loading={pending}>
            Continue with Google
          </Button>
        )}

        {!hasPassword && !hasGoogle && (
          <Text c="red">
            No supported re-auth provider found on this account.
          </Text>
        )}

        {error && <Text c="red">{error}</Text>}
      </Stack>
    </Modal>
  );
}