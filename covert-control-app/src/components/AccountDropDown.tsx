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
import { ActionIcon, Avatar, Group, Menu, Text, useMantineTheme } from '@mantine/core';
import { useAuthStore } from '../stores/authStore'

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
            <Group>
              <div>
                <Text fw={500}>{username}</Text>
                <Text size="xs" c="dimmed">
                  {email}
                </Text>
              </div>
            </Group>
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
          <Menu.Item leftSection={<SettingsIcon size={16} />}>
            Account settings
          </Menu.Item>
          <Menu.Item leftSection={<LogOut size={16} />}>Logout</Menu.Item>

        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}