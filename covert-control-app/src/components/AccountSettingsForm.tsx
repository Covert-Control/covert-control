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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { db } from '../config/firebase';
import { XIcon, CheckIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '../stores/authStore';

export function AccountSettingsForm() {
  const { user, username, email } = useAuthStore();
  const navigate = useNavigate();
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const qc = useQueryClient();

  const profileForm = useForm({
    initialValues: {
      aboutMe: '',
      contactEmail: '',
      discord: '',
      patreon: '',
      other: '',
    },
  });

  // Load the profile on mount (only when logged in) and hydrate store + form
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

    // merge into store (so the rest of the app can use it)
    const next = { ...(useAuthStore.getState().profileData ?? {}), ...loadedProfile };
    useAuthStore.getState().setProfileData(next);

    // hydrate form fields
    profileForm.setValues({
      aboutMe: next.aboutMe ?? '',
      contactEmail: next.contactEmail ?? '',
      discord: next.discord ?? '',
      patreon: next.patreon ?? '',
      other: next.other ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedProfile]); // runs once when query returns

  const profileMutation = useMutation({
    mutationFn: async (values: Partial<UserProfile>): Promise<Partial<UserProfile>> => {
      if (!user) throw new Error('User not authenticated.');
      await updateDoc(doc(db, 'users', user.uid), values);
      return values; // return partial to merge
    },
    onSuccess: (partial) => {
      // merge into store
      const merged = { ...(useAuthStore.getState().profileData ?? {}), ...partial };
      useAuthStore.getState().setProfileData(merged);

      // merge into query cache
      if (user) {
        qc.setQueryData<Partial<UserProfile>>(
          ['userProfile', user.uid],
          (old) => ({ ...(old ?? {}), ...partial })
        );
      }

      // reflect immediately in the form
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
      notifications.show({
        title: 'Update Failed',
        message: error.message,
        color: 'red',
        icon: <XIcon size={18} />,
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // wire up real deletion when ready
      return new Promise((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      notifications.show({
        title: 'Account Deleted',
        message: 'Your account has been successfully deleted.',
        color: 'gray',
      });
      navigate({ to: '/' });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Deletion Failed',
        message: error.message,
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

      <Button
        variant="outline"
        onClick={() => navigate({ to: `/authors/${username}` })}
        mb="md"
      >
        View Public Profile Page
      </Button>
      <Divider my="md" />

      <Title order={3}>Email</Title>
      <Text mt="xs">Your account email is: {email}</Text>
      <Text fs="italic" c="dimmed">
        Your authentication email cannot be changed from this page.
      </Text>
      <Divider my="md" />

      <Title order={3}>Public Profile Information</Title>
      <Text mt="xs">This information will be displayed on your public profile page.</Text>

      <form onSubmit={profileForm.onSubmit((values) => profileMutation.mutate(values))}>
        <Stack mt="md">
          <Textarea
            label="About Me"
            placeholder="Tell us about yourself..."
            minRows={4}
            {...profileForm.getInputProps('aboutMe')}
            disabled={profileMutation.isPending}
          />
          <TextInput
            label="Contact Email"
            placeholder="A public-facing email (optional)"
            {...profileForm.getInputProps('contactEmail')}
            disabled={profileMutation.isPending}
          />
          <TextInput
            label="Discord"
            placeholder="@your-discord-tag"
            {...profileForm.getInputProps('discord')}
            disabled={profileMutation.isPending}
          />
          <TextInput
            label="Patreon"
            placeholder="patreon.com/your-page"
            {...profileForm.getInputProps('patreon')}
            disabled={profileMutation.isPending}
          />
          <TextInput
            label="Other"
            placeholder="Any other link or information"
            {...profileForm.getInputProps('other')}
            disabled={profileMutation.isPending}
          />
          <Button type="submit" mt="md" loading={profileMutation.isPending}>
            Save Public Profile
          </Button>
        </Stack>
      </form>

      <Divider my="md" />

      <Box
        p="md"
        style={{
          border: '2px solid red',
          borderRadius: theme.radius.md,
          backgroundColor: colorScheme === 'dark' ? theme.colors.red[9] : theme.colors.red[0],
        }}
      >
        <Title order={3} >
          Danger Zone
        </Title>
        <Text mt="xs" c={colorScheme === 'dark' ? 'white' : 'black'}>
          Deleting your account is a permanent action. All of your stories and data will be lost.
        </Text>
        <Button
          color="red"
          mt="md"
          onClick={() => setDeleteModalOpened(true)}
          loading={deleteAccountMutation.isPending}
        >
          Delete Account
        </Button>
      </Box>

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirm Account Deletion"
        centered
      >
        <Text>
          Are you absolutely sure you want to delete your account? This action cannot be undone.
        </Text>
        <Button
          color="red"
          fullWidth
          mt="md"
          onClick={() => deleteAccountMutation.mutate()}
          loading={deleteAccountMutation.isPending}
        >
          Yes, Delete My Account
        </Button>
      </Modal>
    </Paper>
  );
}
