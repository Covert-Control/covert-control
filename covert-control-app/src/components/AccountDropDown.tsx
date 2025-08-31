import {
  CircleUserRound,
  BookCopy,
  ChevronRight,
  CircleEllipsisIcon,
  HeartIcon,
  LogOut,
  MessageSquareText,
  SettingsIcon,
  StarIcon,
  ArrowRightLeftIcon,
} from 'lucide-react';
import { ActionIcon, Avatar, Group, Menu, Stack, Text, useMantineTheme } from '@mantine/core';
import { useAuthStore } from '../stores/authStore'
import { Link } from '@tanstack/react-router';

export function AccountDropDown() {
  const { username, email } = useAuthStore();
  const theme = useMantineTheme();
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
          <ActionIcon variant="default">
            <CircleUserRound size={28} strokeWidth={1.25} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>
            <Link
              key={username}
              to="/authors/$authorId"
              params={{ authorId: username ?? '' }}
              style={{
                textDecoration: 'none',
                display: 'block', // makes the whole menu item clickable
                width: '100%',
              }}
            >
              <Stack gap={0}>
                <Text fw={500}>{username}</Text>
                <Text size="xs" c="dimmed">{email}</Text>
              </Stack>
            </Link>
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<BookCopy size={16} color="#ffff00" strokeWidth={1.25} />}
          >
            Your submissions
          </Menu.Item>

          <Menu.Item leftSection={<HeartIcon size={16} color={theme.colors.red[6]} />}>
            Favorite Stories
          </Menu.Item>

          <Menu.Item
            leftSection={<MessageSquareText size={16} color={theme.colors.blue[6]} />}
          >
            Your comments
          </Menu.Item>

          <Menu.Label>Settings</Menu.Label>
          <Menu.Item
            component={Link}
            to="/account-settings"
            leftSection={<SettingsIcon size={16} />}
          >
            Account settings
          </Menu.Item>
          <Menu.Item leftSection={<LogOut size={16} />}>Logout</Menu.Item>

        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}