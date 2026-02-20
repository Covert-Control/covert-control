// src/routes/admin/reports.lazy.tsx
import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute, Link as RouterLink } from '@tanstack/react-router';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  Spoiler,
  Tooltip,
} from '@mantine/core';
import { AlertTriangle, Trash2 } from 'lucide-react';

import { db, deleteStoryCallable } from '../../config/firebase';
import { useAuthStore } from '../../stores/authStore';

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

export const Route = createLazyFileRoute('/admin/reports')({
  component: AdminReportsPage,
});

type ReportStatus = 'open' | 'dismissed' | 'action_taken' | string;

interface Report {
  id: string;
  storyId: string;
  storyTitle: string;
  storyOwnerId: string;
  storyOwnerUsername?: string | null;

  reportedBy: string;
  reporterEmail?: string | null;
  reporterDisplayName?: string | null;

  reason: string;
  comment: string | null;

  status: ReportStatus;
  resolution: string | null;
  createdAt: Date | null;
  handledAt: Date | null;
  handledBy: string | null;
}

function AdminReportsPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const authLoading = useAuthStore((s) => s.loading);
  const currentUser = useAuthStore((s) => s.user);

  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to reports when admin + filter changes
  useEffect(() => {
    if (!isAdmin || !currentUser) {
      setReports([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const baseRef = collection(db, 'reports');
    const q =
      filter === 'open'
        ? query(baseRef, where('status', '==', 'open'), orderBy('createdAt', 'desc'))
        : query(baseRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Report[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            storyId: data.storyId,
            storyTitle: data.storyTitle ?? '(untitled story)',
            storyOwnerId: data.storyOwnerId,
            storyOwnerUsername: data.storyOwnerUsername ?? null,
            reportedBy: data.reportedBy,
            reporterEmail: data.reporterEmail ?? null,
            reporterDisplayName: data.reporterDisplayName ?? null,
            reason: data.reason ?? 'other',
            comment: data.comment ?? null,
            status: data.status ?? 'open',
            resolution: data.resolution ?? null,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            handledAt: data.handledAt?.toDate ? data.handledAt.toDate() : null,
            handledBy: data.handledBy ?? null,
          };
        });
        setReports(items);
        setLoading(false);
        setError(null); // clear any previous error once we have data
      },
      (err) => {
        console.error('Failed to load reports', err);
        setError('Failed to load reports.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin, currentUser, filter]);

  const openCount = useMemo(
    () => reports.filter((r) => r.status === 'open').length,
    [reports]
  );

  const hasReports = reports.length > 0;

  // Guard non-admins
  if (authLoading) {
    return (
      <Container size="lg" py="xl">
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  };

  if (!isAdmin) {
    return (
      <Container size="md" py="xl">
        <Paper p="lg" radius="lg" withBorder>
          <Group align="flex-start" gap="md">
            <AlertTriangle size={24} />
            <div>
              <Title order={3}>Access denied</Title>
              <Text size="sm" c="dimmed">
                You must be an administrator to view moderation reports.
              </Text>
            </div>
          </Group>
        </Paper>
      </Container>
    );
  }

  async function handleDismiss(report: Report) {
    if (!currentUser) return;
    try {
      const ref = doc(db, 'reports', report.id);
      await updateDoc(ref, {
        status: 'dismissed',
        handledAt: serverTimestamp(),
        handledBy: currentUser.uid,
      });
    } catch (err) {
      console.error('Failed to dismiss report', err);
      alert('Failed to dismiss report. Check console for details.');
    }
  }

  async function handleDeleteStory(report: Report) {
    if (!currentUser) return;

    const confirmDelete = window.confirm(
      `Delete this story?\n\nTitle: ${report.storyTitle}\nThis will remove the story for all readers.`
    );
    if (!confirmDelete) return;

    try {
      // ❗ Use the Cloud Function so chapters + authors_with_stories are updated
      await deleteStoryCallable({ storyId: report.storyId });

      // Then mark this report as resolved
      const reportRef = doc(db, 'reports', report.id);
      await updateDoc(reportRef, {
        status: 'action_taken',
        resolution: 'story_deleted',
        handledAt: serverTimestamp(),
        handledBy: currentUser.uid,
      });

      // (Optional) You can also remove the report from local state here
      // so the UI updates immediately.
    } catch (err) {
      console.error('Failed to delete story / update report', err);
      alert('Failed to delete story. Check console for details.');
    }
  }


  async function handleDeleteReport(report: Report) {
    if (!currentUser) return;
    const confirmRemove = window.confirm(
      'Remove this report from the moderation list? This action cannot be undone.'
    );
    if (!confirmRemove) return;

    try {
      const reportRef = doc(db, 'reports', report.id);
      await deleteDoc(reportRef);
    } catch (err) {
      console.error('Failed to delete report', err);
      alert('Failed to delete report. Check console for details.');
    }
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>Moderation Reports</Title>
            <Text size="sm" c="dimmed">
              Review and act on stories reported by readers.
            </Text>
          </div>

          <Group gap="xs">
            <Button
              component={RouterLink}
              to="/admin/news"
              size="xs"
              variant="light"
            >
              News
            </Button>

            <Button
              size="xs"
              variant={filter === 'open' ? 'filled' : 'outline'}
              onClick={() => setFilter('open')}
            >
              Open ({openCount})
            </Button>
            <Button
              size="xs"
              variant={filter === 'all' ? 'filled' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All ({reports.length})
            </Button>
          </Group>

        </Group>

        {error && reports.length === 0 && (
          <Paper radius="md" p="sm" withBorder>
            <Text size="sm" c="red">
              {error}
            </Text>
          </Paper>
        )}

        {loading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : !hasReports ? (
          <Paper radius="md" p="lg" withBorder>
            <Text size="sm" c="dimmed">
              No reports found for the selected filter.
            </Text>
          </Paper>
        ) : (
          <Stack gap="sm">
            {reports.map((r) => {
              const storyDeleted =
                r.status === 'action_taken' && r.resolution === 'story_deleted';

              return (
                <Paper
                  key={r.id}
                  radius="lg"
                  withBorder
                  p="md"
                  style={{
                    backgroundColor:
                      'var(--mantine-color-dark-7, var(--mantine-color-body))',
                  }}
                >
                  <Stack gap="xs">
                    {/* Top row: Story + Reason */}
                    <Group justify="space-between" align="flex-start">
                      <Box style={{ minWidth: 0 }}>
                        <RouterLink
                          to="/stories/$storyId"
                          params={{ storyId: r.storyId }}
                          style={{
                            textDecoration: 'underline',
                            wordBreak: 'break-word',
                            fontWeight: 500,
                            fontSize: 'var(--mantine-font-size-sm)',
                            color: 'inherit',
                          }}
                        >
                          {r.storyTitle ?? r.storyId}
                        </RouterLink>
                        <Text size="xs" c="dimmed">
                          Owner: {r.storyOwnerUsername || r.storyOwnerId || '(unknown)'}
                        </Text>
                      </Box>

                      <Tooltip label={formatReason(r.reason)} withArrow>
                        <Badge
                          size="sm"
                          radius="xl"
                          variant="light"
                          color="red"
                          style={{ textTransform: 'none', fontWeight: 500 }}
                        >
                          {formatReason(r.reason)}
                        </Badge>
                      </Tooltip>
                    </Group>

                    {/* Reporter */}
                    <Box>
                      <Text size="sm">
                        {r.reporterDisplayName || r.reporterEmail || r.reportedBy}
                      </Text>
                      {r.reporterEmail && (
                        <Text size="xs" c="dimmed">
                          {r.reporterEmail}
                        </Text>
                      )}
                      {r.comment && (
                        <Box mt={4}>
                          <Spoiler
                            maxHeight={40}
                            showLabel="Show more"
                            hideLabel="Show less"
                          >
                            <Text size="xs" c="dimmed">
                              “{r.comment}”
                            </Text>
                          </Spoiler>
                        </Box>
                      )}
                    </Box>

                    {/* Meta row: Created + Status */}
                    <Group justify="space-between" align="center">
                      <Text size="xs" c="dimmed">
                        {r.createdAt
                          ? r.createdAt.toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Created: —'}
                      </Text>

                      <StatusBadge status={r.status} resolution={r.resolution} />
                    </Group>

                    {/* Actions */}
                    <Group gap="xs" mt="xs" wrap="wrap">
                      {r.status === 'open' && (
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleDismiss(r)}
                        >
                          Dismiss
                        </Button>
                      )}

                      {/* Only show "Delete story" if we haven't already deleted it */}
                      {!storyDeleted && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          leftSection={<Trash2 size={14} />}
                          onClick={() => handleDeleteStory(r)}
                        >
                          Delete story
                        </Button>
                      )}

                      {/* Allow manual removal of resolved reports */}
                      {r.status !== 'open' && (
                        <Button
                          size="xs"
                          variant="outline"
                          color="red"
                          onClick={() => handleDeleteReport(r)}
                        >
                          Remove report
                        </Button>
                      )}
                    </Group>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

function formatReason(reason: string): string {
  switch (reason) {
    case 'nsfw':
      return 'NSFW / sexual content';
    case 'harassment':
      return 'Harassment / hate speech';
    case 'violence':
      return 'Graphic violence / gore';
    case 'spam':
      return 'Spam / scam';
    case 'other':
      return 'Other';
    default:
      return reason;
  }
}

function StatusBadge({
  status,
  resolution,
}: {
  status: ReportStatus;
  resolution: string | null;
}) {
  let color: string = 'gray';
  let label = status;

  if (status === 'open') {
    color = 'yellow';
    label = 'Open';
  } else if (status === 'dismissed') {
    color = 'gray';
    label = 'Dismissed';
  } else if (status === 'action_taken') {
    if (resolution === 'story_deleted') {
      color = 'red';
      label = 'Story deleted';
    } else {
      color = 'green';
      label = 'Action taken';
    }
  }

  return (
    <Badge
      size="sm"
      radius="xl"
      variant="light"
      color={color}
      style={{ textTransform: 'none', fontWeight: 500 }}
      title={label}
    >
      {label}
    </Badge>
  );
}
