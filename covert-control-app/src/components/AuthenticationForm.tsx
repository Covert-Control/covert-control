import {
    Anchor,
    Button,
    Checkbox,
    Divider,
    Group,
    Modal,
    Paper,
    PaperProps,
    PasswordInput,
    Stack,
    Text,
    TextInput,
  } from '@mantine/core';
import { useForm } from '@mantine/form';
import { upperFirst, useToggle } from '@mantine/hooks';
import { GoogleButton } from './GoogleButton.tsx';
import { signInWithPopup, signInWithEmailAndPassword, getAdditionalUserInfo } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase.tsx';
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from '@tanstack/react-router';
import { notifications } from '@mantine/notifications';
import { PartyPopperIcon, CheckIcon, XIcon } from 'lucide-react';


type ModalConfig = {
  opened: boolean;
  title: string;
  body: React.ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
};

export function AuthenticationForm(props: PaperProps) {
  //const userCollectionRef = collection(db, 'users')
  const [type, toggle] = useToggle(['login', 'register']);
  const [modal, setModal] = useState<ModalConfig>({
    opened: false,
    title: '',
    body: null,
    onConfirm: () => {},
    confirmLabel: 'OK',
  });

  // Initialize Cloud Functions instance
  const functions = getFunctions();
  // Get a reference to your callable function
  const registerUserCallable = httpsCallable(functions, 'registerUser');

  const [usernameModalOpened, setUsernameModalOpened] = useState(false);
  const completeGoogleRegistrationCallable = httpsCallable(functions, 'completeGoogleRegistration');

  const navigate = useNavigate(); 

  const form = useForm({
    initialValues: {
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },

    validate: (values) => {
      const errors: Record<string, string> = {};

      if (!/^\S+@\S+$/.test(values.email)) {
        errors.email = 'Invalid email';
      }

      if (values.password.length < 6) {
        errors.password = 'Password should include at least 6 characters';
      }
      
      // Validation for registration section only
      if (type === 'register') {
        if (!values.name.trim()) {
          errors.name = 'Username is required';
        } else if (values.name.length < 3 || values.name.length > 20) {
          errors.name = 'Username must be between 3 and 20 characters';
        }
        if (values.confirmPassword !== values.password) {
          errors.confirmPassword = 'Passwords did not match';
        }
        if (!values.terms) {
          errors.terms = 'You must accept terms and conditions';
        }
      }

      return errors;
    },
  });

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

  const showError = (message: string) => {
    setModal({
      opened: true,
      title: 'Error',
      body: <Text color="red">{message}</Text>,
      onConfirm: () => setModal((m) => ({ ...m, opened: false })),
      confirmLabel: 'Close',
    });
  };

  const confirmRegistration = () => {
    setModal({
      opened: true,
      title: 'Confirm Registration',
      body: (
        <Text>
          You’re about to register as <b>{form.values.name}</b>. Is that correct? This cannot be changed.
        </Text>
      ),
      onConfirm: () => {
        setModal((m) => ({ ...m, opened: false }));
        onRegister();
      },
      confirmLabel: 'Yes, register',
    });
  };

  const onRegister = async () => {
    if (auth.currentUser) {
      console.error('User is already logged in');
      showError('You are already logged in. Please log out before registering a new account.');
      return;
    }

    try {
      // Call your Cloud Function
      const result = await registerUserCallable({
        email: form.getValues().email,
        password: form.getValues().password,
        username: form.getValues().name,
      });

      await signInWithEmailAndPassword(auth, form.getValues().email, form.getValues().password);

      // If the function returns successfully, result.data contains the returned data
      console.log('Registration successful:', result.data);
      navigate({ to: '/' });

      notifications.show({
        title: 'Registration Successful',
        message: `Welcome, ${form.values.name}! Your account has been created.`,
        color: 'green',
        autoClose:10000,
        icon: <PartyPopperIcon size={18} />,
        onClose: () => {
          navigate({ to: '/' }); 
        }
      })

    } catch (error: any) {
      console.error("Error calling registerUser function: ", error);
      // Handle HttpsError specifically
      if (error.message) {
        showError(`Registration failed: ${error.message}`);
      } else {
        // Fallback for truly unexpected errors where there's no message
        showError('An unexpected error occurred during registration. Please check your connection and try again.');
      }
    }
  };


  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const additionalUserInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalUserInfo?.isNewUser;

      console.log('Google Sign-in Result:', result);
      console.log('Is New User:', isNewUser);

      // Check if user already has a 'username_lc' field in their Firestore user document.
      // This is more robust than just `isNewUser` because a user might be old but never set a username,
      // or if you import users.
      if (user && user.uid) {
        if (isNewUser) {
          setUsernameModalOpened(true);
        } else {
          // User exists and has a username, proceed as normal login
          notifications.show({
            title: 'Welcome Back!',
            message: `Signed in as ${user.email}.`,
            color: 'teal',
            icon: <CheckIcon size={18} />,
            autoClose: 5000,
          });
          navigate({ to: '/' }); 
        }
      } else {
        throw new Error("Could not retrieve user information after Google sign-in.");
      }

    } catch (err: any) {
      console.error(err);
      notifications.show({
        title: 'Google Sign-in Failed',
        message: err.message || 'An unexpected error occurred during Google sign-in.',
        color: 'red',
        icon: <XIcon size={18} />,
        autoClose: 5000,
      });
    }
  }

  // --- NEW FUNCTION TO HANDLE USERNAME SUBMISSION FROM MODAL ---
  const handleUsernameSubmission = async (values: { newUsername: string }) => {

    // The user is already authenticated via Google, so auth.currentUser is available
    if (!auth.currentUser) {
      notifications.show({
        title: 'Error',
        message: 'No authenticated user found. Please try signing in again.',
        color: 'red',
      });

      setUsernameModalOpened(false);
      return;
    }

    try {
      const response = await completeGoogleRegistrationCallable({ username: values.newUsername });
      console.log('Username set successfully:', response.data);

      notifications.show({
        title: 'Registration Complete!',
        message: `Welcome, ${values.newUsername}! Your account is ready.`,
        color: 'teal',
        icon: <CheckIcon size={18} />,
        autoClose: 3000,
      });
      setUsernameModalOpened(false); // Close modal
      usernameForm.reset(); // Reset the form fields in the modal
      navigate({ to: '/' }); // Redirect to home page
    } catch (error: any) {
      console.error('Error setting username:', error);
      let errorMessage = 'Failed to set username. Please try again.';
      if (error.message) { // Use message from HttpsError
        errorMessage = error.message;
      }

      notifications.show({
        title: 'Username Error',
        message: errorMessage,
        color: 'red',
        icon: <XIcon size={18} />,
        autoClose: 5000,
      });

      // Optionally keep modal open for user to try again, clear input
      usernameForm.setFieldError('newUsername', errorMessage); // Show error directly on input
    }
  };

  const onLogin = async () => {
    console.log("onLogin called");
    if (auth.currentUser) {
      console.error('User is already logged in');
      showError('You are already logged in');
      return;
    } 
    try {
      await signInWithEmailAndPassword(auth, form.getValues().email, form.getValues().password)
    } catch (err) {
      console.error(err);
    }
  }

  const handleSubmit = () => {
    if (type === 'register') {
      confirmRegistration();
    } else {
      onLogin();
    }
  };

//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  return (
    <Paper radius="md" p="md" {...props}>
      <Modal
        opened={modal.opened}
        onClose={() => setModal((m) => ({ ...m, opened: false }))}
        title={modal.title}
        centered
      >
        {modal.body}
        <Button fullWidth mt="md" onClick={modal.onConfirm}>
          {modal.confirmLabel}
        </Button>
      </Modal>

      <Modal
        opened={usernameModalOpened}
        onClose={() => {

          // Consider what happens if user closes modal without setting username.
          // They might be left in an authenticated but un-profiled state.
          // For now, let's just close it. You might want to log out the user here.
          setUsernameModalOpened(false);
          usernameForm.reset(); // Reset form when closing
        }}

        title="Choose a Username"
        centered
        closeOnClickOutside={false} // Prevent closing without action
        withCloseButton={false} // Force user to submit or navigate away (if you implement that)
      >
        <Text>Welcome! To get started, please choose a unique username.</Text>
        <form onSubmit={usernameForm.onSubmit(handleUsernameSubmission)}>
          <Stack>
            <TextInput
              required
              label="Username"
              placeholder="Your unique username"
              {...usernameForm.getInputProps('newUsername')} // Binds input to form state and validation
              radius="md"
              mt="md"
            />

            <Button type="submit" fullWidth mt="md" radius="xl">
              Set Username
            </Button>
          </Stack>
        </form>
      </Modal>

      <Text size="lg" fw={500}>
        Welcome to Covert Control, {type} with
      </Text>

      <Group grow mb="md" mt="md">
        <GoogleButton radius="xl" onClick={signInWithGoogle}>
          Google
        </GoogleButton>
      </Group>

      <Divider label="Or continue with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          {type === 'register' && (
            <TextInput
              required
              label="Username"
              placeholder="Other users will see this"
              value={form.values.name}
              onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
              error={form.errors.name && 'Username must be between 3 and 20 characters'}
              radius="md"
            />
          )}

          <TextInput
            required
            label="Email"
            placeholder="Email here..."
            value={form.values.email}
            onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
            error={form.errors.email && 'Invalid email'}
            radius="md"
          />

          <PasswordInput
            required
            label="Password"
            placeholder="Your password..."
            value={form.values.password}
            onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
            error={form.errors.password && 'Password should include at least 6 characters'}
            radius="md"
          />

          {type === 'register' && (
            <PasswordInput
              required
              label="Confirm password"
              placeholder="Confirm password..."
              value={form.values.confirmPassword}
              onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
              error={form.errors.confirmPassword && 'Passwords do not match'}
              radius="md"
            />
          )}

          {type === 'register' && (
            <Checkbox
              required
              label="I accept terms and conditions"
              checked={form.values.terms}
              onChange={(event) => form.setFieldValue('terms', event.currentTarget.checked)}
            />
          )}
        </Stack>

        <Group justify="space-between" mt="xl">
          <Anchor component="button" type="button" c="dimmed" onClick={() => toggle()} size="xs">
            {type === 'register'
              ? 'Already have an account? Login'
              : "Don't have an account? Register"}
          </Anchor>
          <Button type="submit" radius="xl">
            {upperFirst(type)}
          </Button> 

        </Group>
      </form>
    </Paper>
  );
}


