import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  Modal,
  useMantineColorScheme,
  useMantineTheme,
  Group,
  ThemeIcon,
  PasswordInput,
  List,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { db } from '../config/firebase';
import { XIcon, CheckIcon, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '../stores/authStore';
import {
  getAuth,
  getIdTokenResult,
  signOut,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider,
} from 'firebase/auth';
import { deleteMyAccountCallable } from '../config/firebase';
import { ReauthModal } from '../components/ReauthModal';
import { auth, googleProvider } from '../config/firebase.tsx';
import { getFunctions, httpsCallable } from 'firebase/functions';

async function isRecentLogin(thresholdSeconds = 5 * 60): Promise<boolean> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return false;

  const res = await getIdTokenResult(user, /* forceRefresh */ true);
  const authTimeSec = Math.floor(new Date(res.authTime).getTime() / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec - authTimeSec <= thresholdSeconds;
}

/* ------------------------------------------------------------------ */
/*  Public profile constraints (frontend)                              */
/* ------------------------------------------------------------------ */

const ABOUT_MAX = 1000;
const CONTACT_EMAIL_MAX = 320;
const DISCORD_MAX = 64;
const PATREON_MAX = 128;
const OTHER_MAX = 200;

function hasBadControlChars(s: string) {
  // allow \n and \r; disallow other control chars
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s);
}

function isValidEmail(s: string) {
  return /^\S+@\S+\.\S+$/.test(s);
}

function isHttpUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateAboutMe(vRaw: string) {
  const v = vRaw ?? '';
  if (v.length > ABOUT_MAX) return `About Me must be ${ABOUT_MAX} characters or fewer.`;
  if (hasBadControlChars(v)) return 'About Me contains invalid characters.';
  return null;
}

function validateContactEmail(vRaw: string) {
  const v = (vRaw ?? '').trim();
  if (!v) return null;
  if (v.length > CONTACT_EMAIL_MAX) return `Contact email must be ${CONTACT_EMAIL_MAX} characters or fewer.`;
  if (hasBadControlChars(v)) return 'Contact email contains invalid characters.';
  if (!isValidEmail(v)) return 'Please enter a valid email address, or leave this blank.';
  return null;
}

function validateDiscord(vRaw: string) {
  const v = (vRaw ?? '').trim();
  if (!v) return null;
  if (v.length > DISCORD_MAX) return `Discord must be ${DISCORD_MAX} characters or fewer.`;
  if (hasBadControlChars(v)) return 'Discord contains invalid characters.';
  if (/\s/.test(v)) return 'Discord cannot contain spaces.';

  // Accept handle-like (with optional @), or a Discord URL
  const handleOk = /^@?[A-Za-z0-9._]{2,32}(?:#[0-9]{4})?$/.test(v); // supports legacy tag too
  let urlOk = false;
  if (isHttpUrl(v)) {
    try {
      const u = new URL(v);
      const host = u.hostname.toLowerCase();
      urlOk =
        host === 'discord.gg' ||
        host.endsWith('.discord.gg') ||
        host === 'discord.com' ||
        host === 'www.discord.com';
    } catch {
      urlOk = false;
    }
  }

  if (!handleOk && !urlOk) {
    return 'Enter a Discord handle (e.g., @name) or a Discord link (https://discord.gg/...).';
  }

  return null;
}

function validatePatreon(vRaw: string) {
  const v = (vRaw ?? '').trim();
  if (!v) return null;
  if (v.length > PATREON_MAX) return `Patreon must be ${PATREON_MAX} characters or fewer.`;
  if (hasBadControlChars(v)) return 'Patreon contains invalid characters.';

  // URL or slug
  const slugOk = /^[A-Za-z0-9_-]{1,64}$/.test(v);
  let urlOk = false;
  if (isHttpUrl(v)) {
    try {
      const u = new URL(v);
      const host = u.hostname.toLowerCase();
      urlOk = host === 'patreon.com' || host === 'www.patreon.com';
    } catch {
      urlOk = false;
    }
  }

  if (!slugOk && !urlOk) {
    return 'Enter a Patreon link (https://patreon.com/...) or a creator handle (letters/numbers/_/-).';
  }

  return null;
}

function validateOther(vRaw: string) {
  const v = (vRaw ?? '').trim();
  if (!v) return null;
  if (v.length > OTHER_MAX) return `Other must be ${OTHER_MAX} characters or fewer.`;
  if (hasBadControlChars(v)) return 'Other contains invalid characters.';

  // If it looks like a URL, require http/https
  if (v.includes('://') && !isHttpUrl(v)) {
    return 'Links must start with http:// or https://';
  }

  return null;
}

function normalizeProfileValues(values: {
  aboutMe: string;
  contactEmail: string;
  discord: string;
  patreon: string;
  other: string;
}) {
  return {
    aboutMe: (values.aboutMe ?? '').trim(),
    contactEmail: (values.contactEmail ?? '').trim().toLowerCase(),
    discord: (values.discord ?? '').trim(),
    patreon: (values.patreon ?? '').trim(),
    other: (values.other ?? '').trim(),
  };
}

type UpdatePublicProfileRequest = {
  aboutMe: string;
  contactEmail: string;
  discord: string;
  patreon: string;
  other: string;
};

type UpdatePublicProfileResponse = {
  profile: Partial<Pick<UserProfile, 'aboutMe' | 'contactEmail' | 'discord' | 'patreon' | 'other'>>;
};

export function AccountSettingsForm() {
  const { user, username } = useAuthStore();
  const expectedUsername = username ?? '';
  const navigate = useNavigate();
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const qc = useQueryClient();

  const accent = colorScheme === 'dark' ? theme.colors.red[7] : theme.colors.red[6];
  const subBg = colorScheme === 'dark' ? 'rgba(220, 38, 38, 0.08)' : theme.colors.red[0];
  const border = colorScheme === 'dark' ? theme.colors.red[8] : theme.colors.red[2];

  const [reauthOpen, setReauthOpen] = useState(false);

  // Callable for updating public profile (server-validated)
  const functions = getFunctions();
  const updatePublicProfileCallable = httpsCallable<UpdatePublicProfileRequest, UpdatePublicProfileResponse>(
    functions,
    'updatePublicProfile'
  );

  const profileForm = useForm({
    initialValues: {
      aboutMe: '',
      contactEmail: '',
      discord: '',
      patreon: '',
      other: '',
    },
    validateInputOnChange: true,
    validateInputOnBlur: true,
    validate: {
      aboutMe: validateAboutMe,
      contactEmail: validateContactEmail,
      discord: validateDiscord,
      patreon: validatePatreon,
      other: validateOther,
    },
  });

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [reauthNeeded, setReauthNeeded] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [providerIds, setProviderIds] = useState<string[]>([]);

  async function handleConfirmDeleteClick() {
    const recent = await isRecentLogin();
    if (!recent) {
      setReauthOpen(true);
      return;
    }
    deleteAccountMutation.mutate();
  }

  const { data: loadedProfile } = useQuery<Partial<UserProfile>>({
    queryKey: ['userProfile', user?.uid],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid));
      return (snap.data() as Partial<UserProfile>) ?? {};
    },
  });

  useEffect(() => {
    if (!loadedProfile) return;

    const next = { ...(useAuthStore.getState().profileData ?? {}), ...loadedProfile };
    useAuthStore.getState().setProfileData(next);

    profileForm.setValues({
      aboutMe: next.aboutMe ?? '',
      contactEmail: next.contactEmail ?? '',
      discord: next.discord ?? '',
      patreon: next.patreon ?? '',
      other: next.other ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProfile]);

  const mapEmailChangeError = (code?: string) => {
    switch (code) {
      case 'auth/invalid-email':
      case 'auth/invalid-new-email':
        return 'Please enter a valid email address.';
      case 'auth/email-already-in-use':
        return 'That email is already in use.';
      case 'auth/requires-recent-login':
        return 'For security, please confirm your identity to continue.';
      default:
        return 'Email update failed. Please try again.';
    }
  };

  const openChangeEmailModal = () => {
    const u = auth.currentUser;
    setNewEmail('');
    setReauthNeeded(false);
    setReauthPassword('');
    setProviderIds(u?.providerData?.map((p) => p.providerId) ?? []);
    setEmailModalOpen(true);
  };

  const sendVerificationToNewEmail = async () => {
    const u = auth.currentUser;
    if (!u) return;
    setChangeLoading(true);
    try {
      await verifyBeforeUpdateEmail(u, newEmail);

      notifications.show({
        title: 'Check your inbox',
        message:
          'We sent a verification link to your new email. Your sign-in email will update after you click the link.',
        color: 'teal',
      });
      setEmailModalOpen(false);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === 'auth/requires-recent-login') {
        setReauthNeeded(true);
      } else {
        notifications.show({
          title: 'Couldn’t send verification',
          message: mapEmailChangeError(code),
          color: 'red',
        });
      }
    } finally {
      setChangeLoading(false);
    }
  };

  const handleReauthAndRetry = async () => {
    const u = auth.currentUser;
    if (!u) return;
    setChangeLoading(true);
    try {
      if (providerIds.includes('password')) {
        const email = u.email ?? '';
        const cred = EmailAuthProvider.credential(email, reauthPassword);
        await reauthenticateWithCredential(u, cred);
      } else if (providerIds.includes('google.com')) {
        await reauthenticateWithPopup(u, googleProvider ?? new GoogleAuthProvider());
      } else {
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
      }

      await verifyBeforeUpdateEmail(u, newEmail);

      notifications.show({
        title: 'Verification sent',
        message:
          'We sent a verification link to your new email. Your sign-in email will update after you click the link.',
        color: 'teal',
      });
      setEmailModalOpen(false);
    } catch (e: any) {
      notifications.show({
        title: 'Reauthentication failed',
        message: mapEmailChangeError(e?.code),
        color: 'red',
      });
    } finally {
      setChangeLoading(false);
    }
  };

  const profileMutation = useMutation({
    mutationFn: async (values: UpdatePublicProfileRequest): Promise<Partial<UserProfile>> => {
      if (!user) throw new Error('User not authenticated.');

      // Server validates + writes. We still validate client-side for UX.
      const res = await updatePublicProfileCallable(values);
      return (res.data?.profile ?? {}) as Partial<UserProfile>;
    },
    onSuccess: (partial) => {
      const merged = { ...(useAuthStore.getState().profileData ?? {}), ...partial };
      useAuthStore.getState().setProfileData(merged);

      if (user) {
        qc.setQueryData<Partial<UserProfile>>(
          ['userProfile', user.uid],
          (old) => ({ ...(old ?? {}), ...partial })
        );
      }

      profileForm.setValues({
        aboutMe: merged.aboutMe ?? '',
        contactEmail: merged.contactEmail ?? '',
        discord: merged.discord ?? '',
        patreon: merged.patreon ?? '',
        other: merged.other ?? '',
      });

      notifications.show({
        title: 'Profile Updated',
        message: 'Your public profile information has been saved.',
        color: 'green',
        icon: <CheckIcon size={18} />,
      });
    },
    onError: (error: any) => {
      // Callable errors often surface as: error.code = "functions/invalid-argument"
      const msg = error?.message ?? 'Update failed. Please try again.';
      notifications.show({
        title: 'Update Failed',
        message: msg,
        color: 'red',
        icon: <XIcon size={18} />,
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await deleteMyAccountCallable({ reason: 'user requested' });
      return res.data;
    },
    onSuccess: async () => {
      await signOut(getAuth());
      notifications.show({
        title: 'Account Deleted',
        message: 'Your account was deleted. We’re sorry to see you go.',
        color: 'gray',
      });
      navigate({ to: '/' });
    },
    onError: (error: any) => {
      const msg = error?.message ?? '';
      if (msg.includes('RECENT_LOGIN_REQUIRED') || error?.code === 'functions/failed-precondition') {
        setReauthOpen(true);
        return;
      }
      notifications.show({
        title: 'Deletion Failed',
        message: msg || 'Something went wrong.',
        color: 'red',
        icon: <XIcon size={18} />,
      });
    },
  });

  if (!user) {
    return <Text>Please log in to view this page.</Text>;
  }

  return (
    <Paper withBorder p="md" radius="md" style={{ maxWidth: 800, margin: 'auto' }}>
      <Title order={2}>Welcome, {username}!</Title>
      <Text mt="xs">This is your account settings page.</Text>
      <Divider my="md" />

      <Button variant="outline" onClick={() => navigate({ to: `/authors/${username}` })} mb="md">
        View Public Profile Page
      </Button>
      <Divider my="md" />

      <Title order={3}>Email</Title>
      <Group justify="space-between" align="end" mt="md" mb="sm">
        <Stack gap={2}>
          <Text size="sm" c="dimmed">
            Current account email (private)
          </Text>
          <Text>{auth.currentUser?.email ?? '—'}</Text>
        </Stack>
        <Button variant="default" onClick={openChangeEmailModal}>
          Change email
        </Button>
      </Group>
      <Divider my="md" />

      <Title order={3}>Public Profile Information</Title>
      <Text mt="xs">This information will be displayed on your public profile page.</Text>

      <form
        onSubmit={profileForm.onSubmit((values) => {
          const normalized = normalizeProfileValues(values);
          profileMutation.mutate(normalized);
        })}
      >
        <Stack mt="md">


          <TextInput
            label="Contact Email"
            description={`Optional, public-facing email.`}
            placeholder="you@example.com"
            maxLength={CONTACT_EMAIL_MAX}
            {...profileForm.getInputProps('contactEmail')}
            disabled={profileMutation.isPending}
          />

          <TextInput
            label="Discord"
            description={`Enter @handle or a Discord link.`}
            placeholder="@yourname or https://discord.gg/..."
            maxLength={DISCORD_MAX}
            {...profileForm.getInputProps('discord')}
            disabled={profileMutation.isPending}
          />

          <TextInput
            label="Patreon"
            description={`Enter a Patreon link or creator handle.`}
            placeholder="patreon.com/your-page or your_handle"
            maxLength={PATREON_MAX}
            {...profileForm.getInputProps('patreon')}
            disabled={profileMutation.isPending}
          />

          <TextInput
            label="Other"
            description={`Links or other contact/info.`}
            placeholder="https://your-site.com or other info"
            maxLength={OTHER_MAX}
            {...profileForm.getInputProps('other')}
            disabled={profileMutation.isPending}
          />

          <Divider my="md" />
          <Textarea
            label="About Me"
            description={`Up to ${ABOUT_MAX} characters. This is shown publicly on your profile.`}
            placeholder="Tell readers a bit about yourself..."
            minRows={4}
            maxLength={ABOUT_MAX}
            {...profileForm.getInputProps('aboutMe')}
            disabled={profileMutation.isPending}
          />

          <Button type="submit" mt="md" loading={profileMutation.isPending}>
            Save Public Profile
          </Button>
        </Stack>
      </form>

      <Divider my="md" />

      <Paper
        p="md"
        radius="md"
        withBorder
        style={{
          position: 'relative',
          backgroundColor: subBg,
          borderColor: border,
        }}
      >
        <Box
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: 0,
            bottom: 0,
            width: 6,
            backgroundColor: accent,
            borderTopLeftRadius: theme.radius.md,
            borderBottomLeftRadius: theme.radius.md,
          }}
        />

        <Group align="flex-start" justify="space-between" wrap="nowrap" gap="md">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon color="red" variant="light" size="lg" radius="md">
              <AlertTriangle size={18} />
            </ThemeIcon>

            <Stack gap={2}>
              <Title order={4} c={colorScheme === 'dark' ? theme.colors.red[2] : theme.colors.red[7]}>
                Danger Zone
              </Title>
              <Text size="sm" c="dimmed" maw={640}>
                Deleting your account is a permanent action. All of your stories and data will be lost.
              </Text>
            </Stack>
          </Group>

          <Button
            color="red"
            variant="filled"
            onClick={() => setDeleteModalOpened(true)}
            loading={deleteAccountMutation.isPending}
            radius="md"
          >
            Delete Account
          </Button>
        </Group>
      </Paper>

      <Modal opened={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Change email" centered>
        <Stack>
          <Text size="sm" c="dimmed">
            We’ll email a verification link to your new address. Your sign-in email changes only after you click that
            link.
          </Text>

          <TextInput
            label="New email"
            placeholder="you@newdomain.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.currentTarget.value)}
            disabled={changeLoading}
            withAsterisk
          />

          {!reauthNeeded ? (
            <Button onClick={sendVerificationToNewEmail} loading={changeLoading} disabled={!newEmail.trim()}>
              Send verification
            </Button>
          ) : (
            <>
              {providerIds.includes('password') ? (
                <>
                  <PasswordInput
                    label="Confirm your password"
                    placeholder="Current password"
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.currentTarget.value)}
                    disabled={changeLoading}
                    withAsterisk
                  />
                  <Button onClick={handleReauthAndRetry} loading={changeLoading} disabled={!reauthPassword}>
                    Verify identity & send link
                  </Button>
                </>
              ) : (
                <Button onClick={handleReauthAndRetry} loading={changeLoading}>
                  Verify with your provider
                </Button>
              )}
              <Text size="xs" c="dimmed">
                For security, please confirm your identity to continue.
              </Text>
            </>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setDeleteConfirmInput('');
        }}
        title="Confirm Account Deletion"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">Deleting your account will permanently remove:</Text>

          <List size="sm" spacing="xs">
            <List.Item>All of your stories and all of their chapters</List.Item>
            <List.Item>All of your favorites, likes, and related activity</List.Item>
            <List.Item>Your profile information and account data</List.Item>
          </List>

          <Text size="sm" c="red">
            This action cannot be undone.
          </Text>

          <Text size="sm">
            To confirm, type your username <Text span fw={600}>{expectedUsername}</Text> below.
          </Text>

          <TextInput
            label="Confirm username"
            placeholder={expectedUsername || 'Your username'}
            value={deleteConfirmInput}
            onChange={(e) => setDeleteConfirmInput(e.currentTarget.value)}
            autoComplete="off"
          />

          <Button
            color="red"
            fullWidth
            mt="sm"
            onClick={handleConfirmDeleteClick}
            loading={deleteAccountMutation.isPending}
            disabled={deleteConfirmInput.trim() !== expectedUsername || deleteAccountMutation.isPending}
          >
            Yes, delete my account
          </Button>
        </Stack>
      </Modal>

      <ReauthModal opened={reauthOpen} onClose={() => setReauthOpen(false)} onSuccess={() => deleteAccountMutation.mutate()} />
    </Paper>
  );
}
