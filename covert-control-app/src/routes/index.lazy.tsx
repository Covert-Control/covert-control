// src/routes/index.lazy.tsx
import { createLazyFileRoute, Link as RouterLink } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
  Accordion,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  ExternalLink,
  Megaphone,
  Dices,
  Search,
  BookOpen,
  HeartHandshake,
  CalendarDays,
  Users,
  Pin,
} from 'lucide-react';

import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query as fsQuery,
  where,
} from 'firebase/firestore';

// TipTap (read-only)
import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

import type { FirestoreError } from 'firebase/firestore';

export const Route = createLazyFileRoute('/')({
  component: HomePage,
});

type NewsPost = {
  id: string;
  title: string;
  pinned: boolean;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date | null;
  previewText: string;
  contentJSON: unknown;
};

function formatDate(d: Date | null) {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function sortNewsForDisplay(items: NewsPost[]) {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const at = (a.publishedAt ?? a.createdAt)?.getTime() ?? 0;
    const bt = (b.publishedAt ?? b.createdAt)?.getTime() ?? 0;
    return bt - at;
  });
}

async function fetchPublishedNews(): Promise<NewsPost[]> {
  const ref = collection(db, 'newsPosts');

  const qPrimary = fsQuery(
    ref,
    where('isPublished', '==', true),
    orderBy('publishedAt', 'desc'),
    limit(10)
  );

  try {
    const snap = await getDocs(qPrimary);
    return sortNewsForDisplay(normalizeNewsDocs(snap));
  } catch (err) {
    const e = err as FirestoreError;

    console.error('News query failed:', {
      code: e.code,
      message: e.message,
      name: e.name,
    });

    const qFallback = fsQuery(ref, where('isPublished', '==', true), limit(10));
    const snap2 = await getDocs(qFallback);

    return sortNewsForDisplay(normalizeNewsDocs(snap2));
  }
}

function normalizeNewsDocs(snap: any): NewsPost[] {
  return snap.docs.map((d: any) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title ?? '(untitled)',
      pinned: !!data.pinned,
      isPublished: !!data.isPublished,
      publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : null,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
      previewText: data.previewText ?? '',
      contentJSON: data.contentJSON ?? null,
    } as NewsPost;
  });
}

function ReadOnlyNewsContent({ contentJSON }: { contentJSON: unknown }) {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
      }),
    ],
    content: (contentJSON as any) ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  });

  // If editor isn't ready yet, avoid flashing blank content
  if (!editor) return <Skeleton h={120} radius="md" />;

  return (
    <RichTextEditor editor={editor}>
      {/* No toolbar on home page */}
      <RichTextEditor.Content />
    </RichTextEditor>
  );
}

function HomePage() {
  const [betaDismissed, setBetaDismissed] = useLocalStorage<boolean>({
    key: 'cc_beta_banner_dismissed_v1',
    defaultValue: false,
  });

  const newsQuery = useQuery({
    queryKey: ['news', 'homepage', 'published'],
    queryFn: fetchPublishedNews,

    // Aggressive caching (you said updates are rare)
    staleTime: 1000 * 60 * 60 * 24 * 30, // 30 days
    gcTime: 1000 * 60 * 60 * 24 * 60, // 60 days
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const defaultOpenNewsIds = React.useMemo(() => {
    const items = newsQuery.data ?? [];
    if (!items.length) return [];

    const pinnedIds = items.filter((p) => p.pinned).map((p) => p.id);
    const newestRegular = items.find((p) => !p.pinned);

    return newestRegular ? [...pinnedIds, newestRegular.id] : pinnedIds;
  }, [newsQuery.data]);

  return (
    <Container size="lg" pt="sm" pb="xl">
      <Stack gap="lg">
        {/* 1) Beta disclaimer */}
        {!betaDismissed && (
          <Alert
            radius="lg"
            variant="light"
            title="Beta notice"
            icon={<Megaphone size={18} />}
            withCloseButton
            onClose={() => setBetaDismissed(true)}
          >
            <Text size="sm" c="dimmed">
              This site is in beta. You may experience bugs, and the UI is subject to change at any time.
            </Text>
          </Alert>
        )}

        {/* Hero */}
        <Paper radius="xl" p="lg" withBorder>
          <Stack gap="xs">
            <Title order={1} style={{ letterSpacing: -0.5 }}>
              Covert Control: Mind Control Erotica
            </Title>
            <Text c="dimmed">
              Discover stories, explore tags, and track your favorites. 
            </Text>

            <Group mt="sm" wrap="wrap" justify="center">
              <Button
                variant="light"
                component={RouterLink}
                to="/stories"
                leftSection={<BookOpen size={16} />}
              >
                Browse stories
              </Button>

              <Button
                component={RouterLink}
                to="/stories/random"
                variant="light"
                leftSection={<Dices size={16} />}
              >
                Random picks
              </Button>

              <Button
                component={RouterLink}
                to="/advanced-search"
                variant="default"
                leftSection={<Search size={16} />}
              >
                Advanced search
              </Button>

              <Button
                component={RouterLink}
                to="/stories/weeklynew"
                variant="light"
                leftSection={<CalendarDays size={16} />}
              >
                Last week&apos;s stories
              </Button>

              <Button
                component={RouterLink}
                to="/authors"
                variant="light"
                leftSection={<Users size={16} />}
              >
                Browse authors
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Bento grid (quick utility tiles) */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Paper radius="xl" p="md" withBorder>
            <Stack gap={6}>
              <Group justify="space-between">
                <Text fw={600}>Start exploring</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Jump straight into the library. No account needed to read.
              </Text>
              <Button component={RouterLink} to="/stories" variant="light" size="sm" mt="xs">
                View all stories
              </Button>
            </Stack>
          </Paper>

          <Paper radius="xl" p="md" withBorder>
            <Stack gap={6}>
              <Group justify="space-between">
                <Text fw={600}>Site Features</Text>
              </Group>
              <Text size="sm" c="dimmed">
                See a list of the site features as well as review content guidelines and other questions at the FAQ
              </Text>
              <Button component={RouterLink} to="/faq" variant="light" size="sm" mt="xs">
                FAQ
              </Button>
            </Stack>
          </Paper>

          <Paper radius="xl" p="md" withBorder>
            <Stack gap={6}>
              <Group justify="space-between">
                <Text fw={600}>Support the project</Text>
                <Badge variant="light" style={{ textTransform: 'none' }}>
                  Coming soon
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Patreon will help cover hosting, moderation tools, and feature development.
              </Text>

              <Group gap="xs" mt="xs">
                <Tooltip label="Placeholder for now — you can wire your real Patreon later." withArrow>
                  <Button
                    component="a"
                    href="https://www.patreon.com/your_placeholder"
                    target="_blank"
                    rel="noreferrer"
                    variant="light"
                    size="sm"
                    leftSection={<HeartHandshake size={16} />}
                  >
                    Patreon (placeholder)
                  </Button>
                </Tooltip>

                <Anchor
                  href="https://www.patreon.com/your_placeholder"
                  target="_blank"
                  rel="noreferrer"
                  size="sm"
                >
                  Learn more <ExternalLink size={14} style={{ verticalAlign: 'text-bottom' }} />
                </Anchor>
              </Group>
            </Stack>
          </Paper>
        </SimpleGrid>

        <Divider />

        {/* 3) News section */}
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>News</Title>
          </div>
        </Group>

        {newsQuery.isLoading ? (
          <Stack gap="sm">
            <Skeleton h={90} radius="lg" />
            <Skeleton h={90} radius="lg" />
            <Skeleton h={90} radius="lg" />
          </Stack>
        ) : newsQuery.isError ? (
          <Paper withBorder radius="lg" p="md">
            <Text c="red" size="sm">
              Failed to load news posts.
            </Text>
            <Text size="sm" c="dimmed">
              If this persists, check Firestore indexes and rules for <code>newsPosts</code>.
            </Text>
          </Paper>
        ) : (newsQuery.data?.length ?? 0) === 0 ? (
          <Paper withBorder radius="lg" p="md">
            <Text size="sm" c="dimmed">
              No updates yet.
            </Text>
          </Paper>
        ) : (
            <Accordion
              variant="contained"
              radius="lg"
              multiple
              defaultValue={defaultOpenNewsIds}
            >
              {newsQuery.data!.map((p) => (
                <Accordion.Item key={p.id} value={p.id}>
                  <Accordion.Control>
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Group gap="xs" wrap="wrap">
                          <Text fw={600} style={{ wordBreak: 'break-word' }}>
                            {p.title}
                          </Text>
                          {p.pinned && (
                          <Badge
                            variant="light"
                            color="yellow"
                            leftSection={<Pin size={10} style={{ display: 'block' }} />}
                            style={{ textTransform: 'none' }}
                          >
                            Pinned
                          </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {formatDate(p.publishedAt ?? p.createdAt)}
                        </Text>
                      </Box>
                    </Group>
                  </Accordion.Control>

                  <Accordion.Panel>
                    <ReadOnlyNewsContent contentJSON={p.contentJSON} />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
        )}
      </Stack>
    </Container>
  );
}
