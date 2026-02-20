import {
  CircleUserRound,
  BookCopy,
  HeartIcon,
  LogOut,
  SettingsIcon,
} from 'lucide-react';
import { ActionIcon, Group, Menu, Stack, Text, useMantineTheme } from '@mantine/core';
import { useAuthStore } from '../stores/authStore';
import { Link } from '@tanstack/react-router';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth'

export function AccountDropDown() {
  const { user, username, email, clearAuth } = useAuthStore();
  const theme = useMantineTheme();

  const logOut = async () => {
      try {
          await signOut(auth) 
          clearAuth();
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <Group justify="center">
      <Menu
        withArrow
        width={300}
        position="bottom"
        transitionProps={{ transition: 'pop' }}
        withinPortal
      >
        <Menu.Target>
          <ActionIcon 
          title="Account menu"
          variant="default">
            <CircleUserRound size={28} strokeWidth={1.25} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          {!user ? (
            <>
              <Menu.Label>Not signed in</Menu.Label>
              <Menu.Item
                component={Link}
                to="/authentication"
                leftSection={<CircleUserRound size={16} />}
              >
                Log in
              </Menu.Item>
            </>
          ) : (
            <>
              <Menu.Item>
                <Link
                  to="/authors/$authorId"
                  params={{ authorId: username ?? '' }}
                  style={{ textDecoration: 'none', display: 'block', width: '100%' }}
                >
                  <Stack gap={0}>
                    <Text fw={500}>{username}</Text>
                    <Text size="xs" c="dimmed">
                      {email}
                    </Text>
                  </Stack>
                </Link>
              </Menu.Item>

              <Menu.Divider />

              <Menu.Item
                component={Link}
                to={`/authors/${username ?? ''}`}
                leftSection={<BookCopy size={16} strokeWidth={1.25} />}
              >
                Your profile
              </Menu.Item>

              <Menu.Item 
                component={Link}
                to={`/favorites/`}
                leftSection={<HeartIcon size={16} color={theme.colors.red[6]} />}>
                Favorite Stories
              </Menu.Item>

              <Menu.Label>Settings</Menu.Label>
              <Menu.Item
                component={Link}
                to="/account-settings"
                leftSection={<SettingsIcon size={16} />}
              >
                Account settings
              </Menu.Item>
              <Menu.Item onClick={logOut} leftSection={<LogOut size={16} />}>Logout</Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
