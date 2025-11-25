// src/components/AdminDropdown.tsx
import { useMemo } from 'react';
import { Menu, Button } from '@mantine/core';
import { ShieldAlert, UserX, UserCheck } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { httpsCallable } from 'firebase/functions';

import { functions } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

interface AdminDropdownProps {
  targetUid: string;
  displayName?: string | null;
  isBanned?: boolean;
  bannedReason?: string | null;
}

export function AdminDropdown({
  targetUid,
  displayName,
  isBanned,
  bannedReason,
}: AdminDropdownProps) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const currentUser = useAuthStore((s) => s.user);

  const adminBanUserCallable = useMemo(
    () =>
      httpsCallable<{ uid: string; banned: boolean; reason?: string }, { ok: true }>(
        functions,
        'adminBanUser'
      ),
    []
  );

  // If not admin or no valid target, render nothing
  if (!isAdmin || !targetUid) return null;

  async function handleBanUser() {
    if (!currentUser) return;

    const label = displayName || targetUid;

    const confirmed = window.confirm(
      `Ban this user?\n\nUser: ${label}\n\nThey will be logged out and unable to sign in until unbanned.`
    );
    if (!confirmed) return;

    try {
      await adminBanUserCallable({
        uid: targetUid,
        banned: true,
        reason: 'Manual ban from author page',
      });

      notifications.show({
        title: 'User banned',
        message: `User ${label} has been banned.`,
        color: 'red',
        position: 'bottom-center',
      });
    } catch (err) {
      console.error('Failed to ban user', err);
      notifications.show({
        title: 'Ban failed',
        message: 'Failed to ban user. Check console for details.',
        color: 'red',
        position: 'bottom-center',
      });
    }
  }

  async function handleUnbanUser() {
    if (!currentUser) return;

    const label = displayName || targetUid;

    const confirmed = window.confirm(
      `Unban this user?\n\nUser: ${label}\n\nThey will be allowed to sign in again.`
    );
    if (!confirmed) return;

    try {
      await adminBanUserCallable({
        uid: targetUid,
        banned: false,
        reason: 'Manual unban from author page',
      });

      notifications.show({
        title: 'User unbanned',
        message: `User ${label} has been unbanned.`,
        color: 'green',
        position: 'bottom-center',
      });
    } catch (err) {
      console.error('Failed to unban user', err);
      notifications.show({
        title: 'Unban failed',
        message: 'Failed to unban user. Check console for details.',
        color: 'red',
        position: 'bottom-center',
      });
    }
  }

  const buttonLabel = isBanned ? 'Admin (banned)' : 'Admin actions';

  return (
    <Menu withArrow shadow="md" position="bottom-end">
      <Menu.Target>
        <Button
          variant="outline"
          color={isBanned ? 'red' : 'red'}
          leftSection={<ShieldAlert size={16} />}
          size="xs"
        >
          {buttonLabel}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Moderation</Menu.Label>

        {isBanned ? (
          <Menu.Item
            color="green"
            leftSection={<UserCheck size={16} />}
            onClick={handleUnbanUser}
          >
            Unban user
          </Menu.Item>
        ) : (
          <Menu.Item color="red" leftSection={<UserX size={16} />} onClick={handleBanUser}>
            Ban user
          </Menu.Item>
        )}

        {/* Later: Delete user, Ban + delete, etc. */}
      </Menu.Dropdown>
    </Menu>
  );
}
