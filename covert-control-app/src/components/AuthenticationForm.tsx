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
import { upperFirst, useToggle, useDisclosure } from '@mantine/hooks';
import { GoogleButton } from './GoogleButton.tsx';
import { createUserWithEmailAndPassword, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase.tsx';

export function AuthenticationForm(props: PaperProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [type, toggle] = useToggle(['login', 'register']);
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

    // only validate these in “register” mode
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
      open();
      return;
    } 
    try {
      await signInWithEmailAndPassword(auth, form.getValues().email, form.getValues().password)
    } catch (err) {
      console.error(err);
    }
  }


  const onRegister = async () => {
    if (auth.currentUser) {
      console.error('User is already logged in');
      open();
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, form.getValues().email, form.getValues().password)
      console.log('User successfully registered!');
    } catch (error) {
      console.error("Error registering user: ", error);
    }
  }

  const logType = () => {
    console.log("This is type: "+type)
  }

  return (
    <Paper radius="md" p="xl" withBorder {...props}>
      <Modal opened={opened} onClose={close} title="Error" centered>
          {type === 'login' ? 'You are already logged in' : 'You are already logged in. Logout first to register.'}
      </Modal>

      <Text size="lg" fw={500}>
        Welcome to Covert Control, {type} with
      </Text>

      <Group grow mb="md" mt="md">
        <GoogleButton radius="xl">Google</GoogleButton>
      </Group>

      <Divider label="Or continue with email" labelPosition="center" my="lg" />

      <form onSubmit={form.onSubmit(type === 'register' ? onRegister : onLogin)}>
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
          <Button type="submit" radius="xl" onClick={(logType)}>
            {upperFirst(type)}
          </Button> 

        </Group>
      </form>
    </Paper>
  );
}