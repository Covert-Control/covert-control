// src/components/AdminDropdown.tsx
import { useMemo } from 'react';
import { Menu, Button, Text } from '@mantine/core';
import { ShieldAlert, UserX, UserCheck, Trash2 } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
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

  function handleBanUser() {
    if (!currentUser) return;

    modals.openConfirmModal({
      title: 'Ban user',
      centered: true,
      children: (
        <Text size="sm">
          Ban <b>{label}</b>? They will be logged out and unable to sign in
          until unbanned.
          {bannedReason ? (
            <>
              <br />
              <br />
              Current ban reason: {bannedReason}
            </>
          ) : null}
        </Text>
      ),
      labels: { confirm: 'Ban user', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
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
      },
    });
  }

  function handleUnbanUser() {
    if (!currentUser) return;

    modals.openConfirmModal({
      title: 'Unban user',
      centered: true,
      children: (
        <Text size="sm">
          Unban <b>{label}</b>? They will be allowed to sign in again.
        </Text>
      ),
      labels: { confirm: 'Unban user', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
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
      },
    });
  }

  function handleDeleteUser() {
    if (!currentUser) return;

    // Don’t let an admin nuke themselves from here
    if (currentUser.uid === targetUid) {
      window.alert(
        'You cannot delete your own account from this menu. Use the account settings page instead.'
      );
      return;
    }

    modals.openConfirmModal({
      title: 'Delete user (no ban)',
      centered: true,
      children: (
        <Text size="sm">
          Delete <b>{label}</b>? This will delete their Firebase Auth account
          and (via your Delete User Data extension) their stories/profile.
          <br />
          <br />
          They <b>will</b> be able to sign up again with the same email later.
          <br />
          <br />
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete user', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
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
      },
    });
  }

  function handleDeleteAndBanUser() {
    if (!currentUser) return;

    if (currentUser.uid === targetUid) {
      window.alert(
        'You cannot delete and ban your own account from this menu. Use the account settings page instead.'
      );
      return;
    }

    modals.openConfirmModal({
      title: 'Delete user & ban email',
      centered: true,
      children: (
        <Text size="sm" component="div">
          Delete <b>AND</b> ban <b>{label}</b>?
          <ul style={{ marginTop: 8, marginBottom: 8, paddingLeft: 18 }}>
            <li>Their Firebase Auth account will be deleted.</li>
            <li>Their stories/profile will be removed (via Delete User Data).</li>
            <li>
              Their email will be added to the banned email list so they cannot
              sign up again.
            </li>
          </ul>
          This action is very destructive and cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete & ban', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
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
      },
    });
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
