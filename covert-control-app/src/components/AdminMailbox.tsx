// src/components/AdminMailbox.tsx
import { useEffect, useState } from 'react';
import { ActionIcon, Indicator, Tooltip } from '@mantine/core';
import { Mail } from 'lucide-react';
import { Link as RouterLink } from '@tanstack/react-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '../config/firebase'; // adjust path if needed
import { useAuthStore } from '../stores/authStore';

export function AdminMailbox() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const user = useAuthStore((s) => s.user);

  // null = loading (or not listening yet)
  const [openCount, setOpenCount] = useState<number | null>(null);

  useEffect(() => {
    // If not admin or not logged in, don't attach any listener
    if (!isAdmin || !user) {
      setOpenCount(null);
      return;
    }

    const q = query(
      collection(db, 'reports'),
      where('status', '==', 'open')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOpenCount(snapshot.size);
      },
      (error) => {
        console.error('Failed to listen for reports', error);
        setOpenCount(null);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, user]);

  // Never render anything for non-admins or logged-out users
  if (!isAdmin || !user) {
    return null;
  }

  const hasBadge = typeof openCount === 'number' && openCount > 0;
  const tooltipLabel =
    typeof openCount === 'number'
      ? openCount > 0
        ? `${openCount} open report${openCount === 1 ? '' : 's'}`
        : 'No open reports'
      : 'Loading reports…';

  return (
    <Tooltip label={tooltipLabel} withArrow position="bottom">
      <Indicator
        inline
        size={16}
        radius="xl"
        disabled={!hasBadge}
        label={hasBadge ? String(openCount) : undefined}
      >
        <ActionIcon
          component={RouterLink}
          to="/admin/reports"
          variant="subtle"
          radius="md"
          aria-label="Open moderation reports"
        >
          <Mail size={18} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
}
