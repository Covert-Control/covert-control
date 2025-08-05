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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAuthStore } from '../stores/authStore';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { auth, db } from '../config/firebase';
import { XIcon, CheckIcon } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc } from 'firebase/firestore';

export function AccountSettingsForm() {
  const { user, username, email, profileData } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const profileForm = useForm({
    initialValues: {
      aboutMe: profileData?.aboutMe || '',
      contactEmail: profileData?.contactEmail || '',
      discord: profileData?.discord || '',
      patreon: profileData?.patreon || '',
      other: profileData?.other || '',
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (values) => {
      if (!user) throw new Error('User not authenticated.');
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, values);
      return values;
    },
    onSuccess: (data) => {
      useAuthStore.getState().setProfileData(data);
      notifications.show({
        title: 'Profile Updated',
        message: 'Your public profile information has been saved.',
        color: 'green',
        icon: <CheckIcon size={18} />,
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Update Failed',
        message: error.message,
        color: 'red',
        icon: <XIcon size={18} />,
      });
    },
  });

  const handleDeleteAccount = () => {
    // Logic for account deletion
  };

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
        onClick={() => navigate({ to: `/user/${username}` })}
        mb="md"
      >
        View Public Profile Page
      </Button>
      <Divider my="md" />

      <Title order={3}>Email</Title>
      <Text mt="xs">Your account email is: **{email}**</Text>
      <Text fs="italic" c="dimmed">
        This is your authentication email and cannot be changed from this page.
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
        style={{ border: '2px solid red', borderRadius: 8, backgroundColor: '#ffebe6' }}
      >
        <Title order={3} color="red">
          Danger Zone
        </Title>
        <Text mt="xs">
          Deleting your account is a permanent action. All your stories and data will be lost.
        </Text>
        <Button color="red" mt="md" onClick={handleDeleteAccount}>
          Delete Account
        </Button>
      </Box>
    </Paper>
  );
}