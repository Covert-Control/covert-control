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
import { createUserWithEmailAndPassword, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider, db } from '../config/firebase.tsx';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useState } from 'react';

type ModalConfig = {
  opened: boolean;
  title: string;
  body: React.ReactNode;
  onConfirm?: () => void;
  confirmLabel?: string;
};

export function AuthenticationForm(props: PaperProps) {
  const userCollectionRef = collection(db, 'users')
  const [type, toggle] = useToggle(['login', 'register']);
  const [modal, setModal] = useState<ModalConfig>({
    opened: false,
    title: '',
    body: null,
    onConfirm: () => {},
    confirmLabel: 'OK',
  });

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

      if (values.password.length <= 6) {
        errors.password = 'Password should include at least 6 characters';
      }
      
      // Validation for registration section only
      if (type === 'register') {
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

    const usernameToCheck = form.getValues().name.trim();

    const existingUsernameSnapshot = await getDocs(
      query(userCollectionRef, where('username', '==', usernameToCheck))
    );

    if (!existingUsernameSnapshot.empty) {
      showError('This username is already taken. Please choose a different one.');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, form.getValues().email, form.getValues().password)
      console.log('User successfully registered!');
    } catch (error) {
      showError("Error registering user: " + error)
      console.error("Error registering user: ", error);
    }
    await addDoc(userCollectionRef, {username: form.values.name, userId: auth.currentUser.uid, createdAt: new Date()});
  }

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      console.error(err);
    }
  }

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

  return (
    <Paper radius="md" p="xl" withBorder {...props}>
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


