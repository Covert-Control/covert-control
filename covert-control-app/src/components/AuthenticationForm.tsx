import {
  Anchor,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Overlay,
  Paper,
  PaperProps,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Center,
  Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { upperFirst, useToggle } from '@mantine/hooks';
import { GoogleButton } from './GoogleButton.tsx';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  getAdditionalUserInfo,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  registerUserCallable,
  completeGoogleRegistrationCallable,
} from '../config/firebase.tsx';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { notifications } from '@mantine/notifications';
import { CheckIcon, XIcon } from 'lucide-react';

type ModalConfig = {
  opened: boolean;
  title: string;
  body: React.ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
};

const mapFirebaseLoginError = (code?: string) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        email: 'Email or password is incorrect',
        password: 'Email or password is incorrect',
      };
    case 'auth/too-many-requests':
      return {
        password: 'Too many attempts. Please try again later.',
      };
    case 'auth/invalid-email':
      return { email: 'Invalid email address' };
    default:
      return { email: 'Login failed. Please try again.' };
  }
};

export function AuthenticationForm(props: PaperProps) {
  const [type, toggle] = useToggle(['login', 'register']);
  const [modal, setModal] = useState<ModalConfig>({
    opened: false,
    title: '',
    body: null,
    onConfirm: () => {},
    confirmLabel: 'OK',
  });

  const [usernameModalOpened, setUsernameModalOpened] = useState(false);

  // NEW: global-ish "I'm doing work" state for this screen
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Working...');

  const [verifyModalOpened, setVerifyModalOpened] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>('');

  const navigate = useNavigate();

  const [termsModalOpened, setTermsModalOpened] = useState(false);
  const [canAcceptTerms, setCanAcceptTerms] = useState(false); // becomes true after scroll-to-end
  const [ackChecked, setAckChecked] = useState(false); 

  const [forgotModalOpened, setForgotModalOpened] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');

  // Main login/register form
  const form = useForm({
    initialValues: {
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
      terms: false,
      validateInputOnChange: true,
      validateInputOnBlur: true,
    },

    validate: (values) => {
      const errors: Record<string, string> = {};

      if (!/^\S+@\S+$/.test(values.email)) {
        errors.email = 'Invalid email';
      }

      if (values.password.length < 6) {
        errors.password = 'Password should include at least 6 characters';
      }

      // Registration-only validation
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

  // Username form for Google new-user modal
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

  const openTermsModal = () => {
    setCanAcceptTerms(false);
    setAckChecked(false);
    setTermsModalOpened(true);
  };

  // Enable acceptance once the user has scrolled to the bottom
  const onTermsScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 12;
    if (atBottom) setCanAcceptTerms(true);
  };


  const openForgotPassword = () => {
    setForgotEmail(form.values.email || '');
    setForgotModalOpened(true);
  };

  const handleSendReset = async () => {
    const email = forgotEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notifications.show({
        title: 'Invalid email',
        message: 'Please enter a valid email address.',
        color: 'red',
      });
      return;
    }

    setForgotLoading(true);
    try {
      // Optional: add a continue URL if you want to bring users back to your site:
      // await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/authentication` });
      await sendPasswordResetEmail(auth, email);

      // Best practice: generic success message
      notifications.show({
        title: 'Reset link sent',
        message: 'If an account exists for that email, a password reset link has been sent.',
        color: 'teal',
      });
      setForgotModalOpened(false);
    } catch (err) {
      console.error('sendPasswordResetEmail error:', err);
      // Still show generic success to avoid user enumeration
      notifications.show({
        title: 'Reset link sent',
        message: 'If an account exists for that email, a password reset link has been sent.',
        color: 'teal',
      });
      setForgotModalOpened(false);
    } finally {
      setForgotLoading(false);
    }
  };
  // Helper: show red error modal
  const showError = (message: string) => {
    setModal({
      opened: true,
      title: 'Error',
      body: <Text c="red">{message}</Text>,
      onConfirm: () => setModal((m) => ({ ...m, opened: false })),
      confirmLabel: 'Close',
    });
  };

  const showVerifyNotice = (email: string) => {
    setIsProcessing(false); 
    setPendingEmail(email);
    setVerifyModalOpened(true);
  };

  // Ask "Are you sure this username can't change?" before we actually hit Firebase
  const confirmRegistration = () => {
    setModal({
      opened: true,
      title: 'Confirm Registration',
      body: (
        <Text>
          You’re about to register as <b>{form.values.name}</b>. Is that
          correct? This cannot be changed.
        </Text>
      ),
      onConfirm: () => {
        setModal((m) => ({ ...m, opened: false }));
        // Move on to actually create account
        onRegister();
      },
      confirmLabel: 'Yes, register',
    });
  };

  // EMAIL+PASSWORD REGISTRATION
  const onRegister = async () => {
    if (auth.currentUser) {
      console.error('User is already logged in');
      showError('You are already logged in. Please log out before registering a new account.');
      return;
    }

    // START LOADING UI
    setIsProcessing(true);
    setLoadingMessage('Creating your account...');

    try {
      // 1. Call backend to create account + Firestore doc
      const result = await registerUserCallable({
        email: form.getValues().email,
        password: form.getValues().password,
        username: form.getValues().name,
      });

      // 2. Immediately sign them in so we have auth.currentUser
      await signInWithEmailAndPassword(
        auth,
        form.getValues().email,
        form.getValues().password
      );

      console.log('Registration successful:', result.data);

      // 3. Send verification email
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }

      // 4. Tell them to verify
      notifications.show({
        title: 'Almost done!',
        message: `We sent a verification link to ${form.values.email}.`,
        color: 'teal',
        icon: <CheckIcon size={18} />,
        autoClose: 7000,
      });

      // 5. Show "please verify" modal instead of navigating away
      showVerifyNotice(form.values.email);

      // DO NOT navigate('/') yet.
      // We want them to verify first, then log in again.
      // Also: leave isProcessing=true until they dismiss modal? We can drop it now:
      // We drop it in the modal "Got it" button so UI unlocks.

    } catch (error: any) {
      console.error('Error calling registerUser function: ', error);

      // STOP LOADING
      setIsProcessing(false);

      if (error.message) {
        showError(`Registration failed: ${error.message}`);
      } else {
        showError('An unexpected error occurred during registration. Please check your connection and try again.');
      }
    }
  };

  // GOOGLE SIGN-IN
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const additionalUserInfo = getAdditionalUserInfo(result);
      const isNewUser = additionalUserInfo?.isNewUser;

      console.log('Google Sign-in Result:', result);
      console.log('Is New User:', isNewUser);

      if (user && user.uid) {
        if (isNewUser) {
          // brand new account -> force username modal
          setUsernameModalOpened(true);
        } else {
          // Returning user, good to go
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
        throw new Error(
          'Could not retrieve user information after Google sign-in.'
        );
      }
    } catch (err: any) {
      console.error(err);
      notifications.show({
        title: 'Google Sign-in Failed',
        message:
          err.message ||
          'An unexpected error occurred during Google sign-in.',
        color: 'red',
        icon: <XIcon size={18} />,
        autoClose: 5000,
      });
    }
  };

  // HANDLE USERNAME SUBMISSION (GOOGLE NEW USER FINAL STEP)
  const handleUsernameSubmission = async (values: { newUsername: string }) => {
    if (!auth.currentUser) {
      notifications.show({
        title: 'Error',
        message: 'No authenticated user found. Please try signing in again.',
        color: 'red',
      });

      setUsernameModalOpened(false);
      return;
    }

    // START LOADING: show global overlay and message
    setIsProcessing(true);
    setLoadingMessage('Finishing setup...');

    // Hide the modal so the user clearly sees we're "working"
    setUsernameModalOpened(false);

    try {
      const response = await completeGoogleRegistrationCallable({
        username: values.newUsername,
      });

      console.log('Username set successfully:', response.data);

      notifications.show({
        title: 'Registration Complete!',
        message: `Welcome, ${values.newUsername}! Your account is ready.`,
        color: 'teal',
        icon: <CheckIcon size={18} />,
        autoClose: 3000,
      });

      // Clean up and go home. We intentionally
      // DO NOT clear isProcessing here because we're navigating away.
      usernameForm.reset();
      navigate({ to: '/' });
    } catch (error: any) {
      console.error('Error setting username:', error);

      // Something went wrong:
      // 1. Stop overlay
      // 2. Reopen the username modal so they can try again
      setIsProcessing(false);
      setUsernameModalOpened(true);

      let errorMessage = 'Failed to set username. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }

      notifications.show({
        title: 'Username Error',
        message: errorMessage,
        color: 'red',
        icon: <XIcon size={18} />,
        autoClose: 5000,
      });

      // Surface error directly under the username field
      usernameForm.setFieldError('newUsername', errorMessage);
    }
  };


  // EMAIL+PASSWORD LOGIN
  const onLogin = async () => {
    console.log('onLogin called');

    if (auth.currentUser) {
      console.error('User is already logged in');
      showError('You are already logged in');
      return;
    }

    // Clear previous server-side errors
    form.clearErrors();

    setIsProcessing(true);
    setLoadingMessage('Signing you in...');

    try {
      await signInWithEmailAndPassword(
        auth,
        form.getValues().email,
        form.getValues().password
      );

      // success -> go home
      navigate({ to: '/' });
    } catch (err: any) {
      console.error(err);

      // Drop loader so they can correct credentials
      setIsProcessing(false);

      const code = err?.code as string | undefined;
      form.setErrors(mapFirebaseLoginError(code));
    }
  };

  const handleSubmit = () => {
    if (type === 'register') {
      confirmRegistration();
    } else {
      onLogin();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // We wrap everything in a Box that can paint a blocking overlay
  // over just this "main" content (not header/nav/footer).
  // ─────────────────────────────────────────────────────────────
  return (
    <Box pos="relative">
      {/* Global lightweight error/confirm modal */}
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

      {/* Username chooser for brand-new Google users */}
      <Modal
        opened={usernameModalOpened}
        onClose={() => {
          // Currently: allow closing (user will technically be signed in
          // but maybe not fully profiled). You could also force logout here.
          setUsernameModalOpened(false);
          usernameForm.reset();
        }}
        title="Choose a Username"
        centered
        closeOnClickOutside={false}
        withCloseButton={false} // force them to submit or navigate away
      >
        <Text>
          Welcome! To get started, please choose a unique username.
        </Text>

        <form onSubmit={usernameForm.onSubmit(handleUsernameSubmission)}>
          <Stack>
            <TextInput
              required
              label="Username"
              placeholder="Your unique username"
              radius="md"
              mt="md"
              disabled={isProcessing}
              {...usernameForm.getInputProps('newUsername')}
            />

            <Button
              type="submit"
              fullWidth
              mt="md"
              radius="xl"
              loading={isProcessing}
              disabled={isProcessing}
            >
              Set Username
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={verifyModalOpened}
        onClose={() => {
          setVerifyModalOpened(false);
          // optional: navigate them to login screen so they can log in after verifying
          // toggle() if you want to flip to "login" view automatically
        }}
        title="Verify your email"
        centered
      >
        <Stack>
          <Text>
            We just sent a verification link to <b>{pendingEmail}</b>. Please open that email and click the link to activate your account.
          </Text>

          <Button
            fullWidth
            radius="xl"
            onClick={() => {
              setVerifyModalOpened(false);
              setIsProcessing(false); 
              navigate({ to: '/' });   
            }}
          >
            Got it
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={termsModalOpened}
        onClose={() => setTermsModalOpened(false)}
        title="Terms & Conditions"
        centered
        size="lg"
      >
        <Stack gap="sm">
          {/* Scrollable terms body */}
          <div
            onScroll={onTermsScroll}
            style={{
              maxHeight: 320,
              overflowY: 'auto',
              paddingRight: 8,
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: '8px',
              padding: '12px',
            }}
          >
            {/* TODO: Replace with your real terms text/markup */}
            <Text size="sm">
              <b>1. Introduction.</b> Welcome to Covert Control. By creating an account, you agree to these Terms…
            </Text>
            <Text size="sm" mt="xs">
              <b>2. Your Content.</b> You retain ownership of your stories. You grant Covert Control a license to host and display…
            </Text>
            <Text size="sm" mt="xs">
              <b>3. Prohibited Conduct.</b> No illegal content, harassment, spam, or copyright infringement…
            </Text>
            <Text size="sm" mt="xs">
              <b>4. Termination.</b> We may suspend or terminate accounts that violate these Terms…
            </Text>
            <Text size="sm" mt="xs">
              <b>5. Disclaimers; Limitation of Liability.</b> Service is provided “as is”…
            </Text>
            <Text size="sm" mt="xs">
              <b>6. Changes.</b> We may update these Terms. Continued use after changes constitutes acceptance…
            </Text>
            <Text size="sm" mt="xs">
              <b>7. Contact.</b> For questions: support@covertcontrol.example
            </Text>
            <Text size="xs" c="dimmed" mt="md">
              Scroll to the bottom to enable acceptance.
            </Text>
          </div>

          <Checkbox
            checked={ackChecked}
            onChange={(e) => setAckChecked(e.currentTarget.checked)}
            disabled={!canAcceptTerms}
            label={
              canAcceptTerms
                ? 'I have read and agree to the Terms & Conditions.'
                : 'Scroll to the bottom to enable this checkbox.'
            }
          />

          <Group justify="space-between" mt="xs">

            <Group>
              <Button variant="default" onClick={() => setTermsModalOpened(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  form.setFieldValue('terms', true);
                  form.clearFieldError('terms');  // <-- clear error immediately
                  setTermsModalOpened(false);
                }}
                disabled={!ackChecked || !canAcceptTerms}
              >
                Accept & continue
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={forgotModalOpened}
        onClose={() => setForgotModalOpened(false)}
        title="Reset your password"
        centered
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Enter your account email and we’ll email you a link to reset your password.
          </Text>

          <TextInput
            label="Email"
            placeholder="you@example.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.currentTarget.value)}
            disabled={forgotLoading || isProcessing}
          />

          <Button
            onClick={handleSendReset}
            loading={forgotLoading}
            disabled={isProcessing}
          >
            Email me a reset link
          </Button>
        </Stack>
      </Modal>

      {/* Actual auth card */}
      <Paper radius="md" p="md" {...props}>
        <Text size="lg" fw={500}>
          Welcome to Covert Control, {type} with
        </Text>

        <Group grow mb="md" mt="md">
          <GoogleButton
            radius="xl"
            onClick={signInWithGoogle}
            disabled={isProcessing}
          >
            Google
          </GoogleButton>
        </Group>

        <Divider
          label="Or continue with email"
          labelPosition="center"
          my="lg"
        />

          <form
            onSubmit={form.onSubmit(
              handleSubmit,
              (errors) => {
                if (errors.terms) setTermsModalOpened(true); // <-- auto-open Terms modal
              }
            )}
          >
          <Stack>
            {type === 'register' && (
              <TextInput
                required
                label="Username"
                placeholder="Other users will see this"
                value={form.values.name}
                onChange={(event) =>
                  form.setFieldValue('name', event.currentTarget.value)
                }
                error={form.errors.name}
                radius="md"
                disabled={isProcessing}
              />
            )}

            <TextInput
              required
              label="Email"
              placeholder="Email here..."
              value={form.values.email}
              onChange={(event) =>
                form.setFieldValue('email', event.currentTarget.value)
              }
              error={form.errors.email}
              radius="md"
              disabled={isProcessing}
            />

            <PasswordInput
              required
              label="Password"
              placeholder="Your password..."
              value={form.values.password}
              onChange={(event) =>
                form.setFieldValue('password', event.currentTarget.value)
              }
              error={form.errors.password}
              radius="md"
              disabled={isProcessing}
            />

            {type === 'login' && (
              <Anchor
                component="button"
                type="button"
                size="xs"
                onClick={openForgotPassword}
                style={{ alignSelf: 'flex-end' }}
                disabled={isProcessing}
              >
                Forgot password?
              </Anchor>
            )}

            {type === 'register' && (
              <PasswordInput
                required
                label="Confirm password"
                placeholder="Confirm password..."
                value={form.values.confirmPassword}
                onChange={(event) =>
                  form.setFieldValue(
                    'confirmPassword',
                    event.currentTarget.value
                  )
                }
                error={form.errors.confirmPassword}
                radius="md"
                disabled={isProcessing}
              />
            )}

          {type === 'register' && (
            <Checkbox
              // no "required" so we avoid any native validation quirks                            // visual cue it's required
              checked={form.values.terms}
              readOnly
              disabled={isProcessing}
              error={form.errors.terms || undefined}     // <-- single source of error text
              onClick={(e) => {
                e.preventDefault();
                if (!form.values.terms) openTermsModal();  // force reading first
                else form.setFieldValue('terms', false);   // allow un-check if already accepted
              }}
              label={
                <>
                  I accept the{' '}
                  <Anchor component="button" onClick={openTermsModal}>
                    Terms & Conditions
                  </Anchor>
                </>
              }
            />
          )}


          </Stack>

          <Group justify="space-between" mt="xl">
            <Anchor
              component="button"
              type="button"
              c="dimmed"
              size="xs"
              onClick={() => {
                if (isProcessing) return;
                toggle();
                form.clearErrors();
              }}
              style={{
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              {type === 'register'
                ? 'Already have an account? Login'
                : "Don\'t have an account? Register"}
            </Anchor>

            <Button
              type="submit"
              radius="xl"
              loading={isProcessing}
              disabled={isProcessing}
            >
              {upperFirst(type)}
            </Button>
          </Group>
        </form>
      </Paper>

      {/* Processing overlay for just the <AppShell.Main> content area */}
      {isProcessing && (
        <>
          {/* Dim / blur background */}
          <Overlay
            // Mantine Overlay is already absolute/fills parent;
            // we bump z-index and tweak blur/opacity
            opacity={0.4}
            blur={3}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 200,
            }}
          />

          {/* Centered loader + message */}
          <Center
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 201,
            }}
          >
            <Stack align="center" gap="xs">
              <Loader size="lg" />
              <Text c="dimmed" size="sm" ta="center" maw={260}>
                {loadingMessage || 'Please wait...'}
              </Text>
            </Stack>
          </Center>
        </>
      )}
    </Box>
  );
}
