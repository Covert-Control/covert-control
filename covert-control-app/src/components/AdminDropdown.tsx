// src/components/AdminDropdown.tsx
import { useMemo } from 'react';
import { Menu, Button } from '@mantine/core';
import { ShieldAlert, UserX, UserCheck, Trash2 } from 'lucide-react';
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

  // 🔹 Cloud functions
  const adminBanUserCallable = useMemo(
    () =>
      httpsCallable<{ uid: string; banned: boolean; reason?: string }, { ok: true }>(
        functions,
        'adminBanUser'
      ),
    []
  );

  const adminDeleteUserCallable = useMemo(
    () =>
      httpsCallable<{ uid: string; reason?: string }, { ok: true }>(
        functions,
        'adminDeleteUser'
      ),
    []
  );

  // NOTE: this one expects **targetUid**, matching the Cloud Function's checks
  const adminDeleteAndBanUserCallable = useMemo(
    () =>
      httpsCallable<{ targetUid: string; reason?: string }, { ok: true }>(
        functions,
        'adminDeleteAndBanUser'
      ),
    []
  );

  // If not admin or no valid target, render nothing
  if (!isAdmin || !targetUid) return null;

  const label = displayName || targetUid;

  // ----------------- Handlers -----------------

  async function handleBanUser() {
    if (!currentUser) return;

    const extra = bannedReason ? `\n\nCurrent ban reason: ${bannedReason}` : '';
    const confirmed = window.confirm(
      `Ban this user?\n\nUser: ${label}\n\n` +
        `They will be logged out and unable to sign in until unbanned.${extra}`
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

  async function handleDeleteUser() {
    if (!currentUser) return;

    // Don’t let an admin nuke themselves from here
    if (currentUser.uid === targetUid) {
      window.alert(
        'You cannot delete your own account from this menu. Use the account settings page instead.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete this user?\n\nUser: ${label}\n\n` +
        `This will delete their Firebase Auth account and (via your Delete User Data extension) their stories/profile.\n\n` +
        `They WILL be able to sign up again with the same email later.\n\n` +
        `This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await adminDeleteUserCallable({
        uid: targetUid,
        reason: 'Manual delete from author page (no ban)',
      });

      notifications.show({
        title: 'User deleted',
        message: `User ${label} has been deleted (not banned).`,
        color: 'orange',
        position: 'bottom-center',
      });
    } catch (err) {
      console.error('Failed to delete user', err);
      notifications.show({
        title: 'Delete failed',
        message: 'Failed to delete user. Check console for details.',
        color: 'red',
        position: 'bottom-center',
      });
    }
  }

  async function handleDeleteAndBanUser() {
    if (!currentUser) return;

    if (currentUser.uid === targetUid) {
      window.alert(
        'You cannot delete and ban your own account from this menu. Use the account settings page instead.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete AND ban this user?\n\nUser: ${label}\n\n` +
        `• Their Firebase Auth account will be deleted.\n` +
        `• Their stories/profile will be removed (via Delete User Data).\n` +
        `• Their email will be added to the banned email list so they cannot sign up again.\n\n` +
        `This action is very destructive and cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await adminDeleteAndBanUserCallable({
        targetUid: targetUid,
        reason: 'Manual delete+ban from author page',
      });

      notifications.show({
        title: 'User deleted & banned',
        message: `User ${label} has been deleted and their email banned.`,
        color: 'red',
        position: 'bottom-center',
      });
    } catch (err) {
      console.error('Failed to delete & ban user', err);
      notifications.show({
        title: 'Delete & ban failed',
        message: 'Failed to delete & ban user. Check console for details.',
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
          color="red"
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

        <Menu.Divider />

        <Menu.Label>Danger zone</Menu.Label>
        <Menu.Item
          color="red"
          leftSection={<Trash2 size={16} />}
          onClick={handleDeleteUser}
        >
          Delete user (no ban)
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<ShieldAlert size={16} />}
          onClick={handleDeleteAndBanUser}
        >
          Delete user &amp; ban email
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
