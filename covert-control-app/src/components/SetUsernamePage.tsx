import { Button, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { notifications } from '@mantine/notifications';
import { auth } from '../config/firebase'; // Ensure 'auth' is imported for potential logout
import { useAuthStore } from '../stores/authStore'; // To update state on success
import { CheckIcon, XIcon } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router'; // For navigation after successful username set

export function SetUsernamePage() {
  const functions = getFunctions();
  const completeGoogleRegistrationCallable = httpsCallable(functions, 'completeGoogleRegistration');
  const navigate = useNavigate(); 

  // Get the setAuthState action and current user from the Zustand store
  const { setAuthState, user: currentUser } = useAuthStore(); 

  const usernameForm = useForm({
    initialValues: {
      newUsername: '',
    },

    validate: {
      newUsername: (value) => {
        if (!value.trim()) {
          return 'Username cannot be empty';
        }
        if (value.length < 3 || value.length > 20) {
          return 'Username must be between 3 and 20 characters';
        }
        return null;
      },
    },
  });

  const handleUsernameSubmission = async (values: { newUsername: string }) => {
    // User must be authenticated to reach this page, but a final check is good.
    if (!currentUser) { 
      notifications.show({
        title: 'Error',
        message: 'No authenticated user found. Please sign in again.',
        color: 'red',
        icon: <XIcon size={18} />,
      });

      // If for some reason there's no current user, log out to prevent being stuck
      auth.signOut(); 
      return;
    }

    try {
      // Call the Cloud Function to set the username
      await completeGoogleRegistrationCallable({ username: values.newUsername });

      notifications.show({
        title: 'Username Set!',
        message: `Welcome, ${values.newUsername}! Your profile is now complete.`,
        color: 'teal',
        icon: <CheckIcon size={18} />,
        autoClose: 9000,
      });

      // Crucial: Update the Zustand store to reflect that the profile is now complete.
      // This will cause `__root.tsx` to re-evaluate and allow navigation to the main app.
      // We pass `currentUser` again to ensure the user object remains fresh in the store.
      setAuthState(currentUser, true, currentUser.uid); 
      navigate({ to: '/' });

    } catch (error: any) {
      console.error('Error setting username:', error);
      let errorMessage = 'Failed to set username. Please try again.';
      if (error.message) { 
        errorMessage = error.message;
      }

      notifications.show({
        title: 'Username Error',
        message: errorMessage,
        color: 'red',
        icon: <XIcon size={18} />,
        autoClose: 9000,
      });

      // Set the error on the form field itself
      usernameForm.setFieldError('newUsername', errorMessage); 
    }
  };


  return (
    // This Paper component effectively serves as the visual container for your page.
    // It's centered and has a max-width, mimicking a "card" but it will be the *only* thing rendered
    // in the AppShell.Main area when active.
    <Paper 
      p="xl" 
      shadow="md" 
      radius="md" 
      style={{ 
        maxWidth: 400, 
        margin: '50px auto', 
        height: 'calc(100vh - 100px)', // Make it visually fill available height, adjust as needed
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >

      <Text size="lg" fw={500} ta="center" mb="md">
        Complete Your Profile
      </Text>
      <Text size="sm" color="dimmed" ta="center" mb="lg">
        Please choose a unique username to get started. This cannot be changed later.
      </Text>
      <form onSubmit={usernameForm.onSubmit(handleUsernameSubmission)} style={{ width: '100%' }}>
        <Stack>
          <TextInput
            required
            label="Username"
            placeholder="Your unique username"
            {...usernameForm.getInputProps('newUsername')}
            radius="md"
          />

          <Button type="submit" fullWidth mt="md" radius="xl">
            Set Username
          </Button>

          {/* Optional: If you *really* wanted to let them bail, you'd need a logout button */}
          <Button variant="subtle" fullWidth onClick={() => auth.signOut()} mt="sm">
            Logout
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}