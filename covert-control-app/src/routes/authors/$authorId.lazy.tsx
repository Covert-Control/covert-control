// src/routes/authors/$authorId.lazy.tsx
import { createLazyFileRoute, useParams, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs as getQueryDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  Skeleton,
  Text,
  Title,
  Paper,
  Button,
  Space,
  Anchor,
  Group,
  Divider,
  Stack,
  Box,
  Badge,
  TextInput,
  SegmentedControl,
  Chip,
  Transition,
} from '@mantine/core';
import {
  CircleArrowLeft,
  Book,
  Calendar,
  Eye,
  Link2,
  Filter as FilterIcon,
  Search,
  Pencil,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AdminDropdown } from '../../components/AdminDropdown';
import { useAuthStore } from '../../stores/authStore';
import StoryListCard from '../../components/StoryListCard';

// --- Types ---
interface Story {
  id: string;
  title: string;
  description: string;
  content: string;
  ownerId: string;
  username: string;
  viewCount: number;
  createdAt: Date;
  updatedAt?: Date;
  likesCount?: number;
  chapterCount?: number;
  tags?: string[];
}

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  dateCreated: Date;
  username_lc: string;
  bio?: string; // legacy
  aboutMe?: string;
  contactEmail?: string;
  discord?: string;
  patreon?: string;
  other?: string;
  banned?: boolean;
  bannedAt?: Date | null;
  bannedReason?: string | null;
}

export const Route = createLazyFileRoute('/authors/$authorId')({
  component: AuthorDetailPage,
});

// Helpers
function normalizeLink(raw?: string | null) {
  if (!raw) return undefined;
  const v = String(raw).trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(v)) return `https://${v}`;
  return v;
}
function alphaCompare(a?: string, b?: string) {
  const norm = (t?: string) => {
    const s = (t ?? '').trim().toLowerCase().replace(/^[^a-z0-9]+/i, '');
    return { first: s[0] || '', full: s };
  };
  const na = norm(a);
  const nb = norm(b);
  if (na.first !== nb.first)
    return na.first.localeCompare(nb.first, undefined, { sensitivity: 'base' });
  return na.full.localeCompare(nb.full, undefined, { sensitivity: 'base' });
}

function AuthorDetailPage() {
  const { authorId } = useParams({ from: '/authors/$authorId' }); // username
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ---------- Filters UI state MUST be before any early returns ----------
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [sort, setSort] = useState<'new' | 'old' | 'alpha'>('new');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');

  // 1) Resolve username -> uid (small cached lookup)
  const {
    data: authorRef,
    isLoading: isLoadingAuthorRef,
    error: authorRefError,
  } = useQuery<{ uid: string } | null>({
    queryKey: ['uidByUsername', authorId],
    enabled: !!authorId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!authorId) throw new Error('Author username is missing.');
      const usersCollectionRef = collection(db, 'users');
      const userQuery = query(usersCollectionRef, where('username', '==', authorId));
      const userSnapshot = await getQueryDocs(userQuery);
      if (userSnapshot.empty) return null;
      return { uid: userSnapshot.docs[0].id };
    },
  });

  const authorUid = authorRef?.uid ?? null;

  // 2) Canonical profile cache (same key as Account Settings)
  const {
    data: author,
    isLoading: isLoadingAuthor,
    error: authorError,
  } = useQuery<UserProfile | null>({
    queryKey: ['userProfile', authorUid],
    enabled: !!authorUid,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!authorUid) return null;
      const snap = await getDoc(doc(db, 'users', authorUid));
      if (!snap.exists()) return null;

      const userData: any = snap.data();
      return {
        uid: snap.id,
        username: userData?.username,
        email: userData?.email,
        dateCreated: userData?.dateCreated?.toDate?.(),
        username_lc: userData?.username_lc,
        aboutMe: userData?.aboutMe ?? userData?.bio ?? '',
        contactEmail: userData?.contactEmail ?? '',
        discord: userData?.discord ?? '',
        patreon: userData?.patreon ?? '',
        other: userData?.other ?? '',
        bio: userData?.bio ?? '',
        banned: !!userData?.banned,
        bannedAt: userData?.bannedAt?.toDate?.() ?? null,
        bannedReason: userData?.bannedReason ?? null,
      } as UserProfile;
    },
    // If userProfile is already in cache (e.g., your own profile updated), show immediately
    initialData: () => {
      if (!authorUid) return undefined;
      return qc.getQueryData<UserProfile>(['userProfile', authorUid]);
    },
  });

  // Stories by this author (ownerId === uid)
  const {
    data: stories,
    isLoading: isLoadingStories,
    error: storiesError,
  } = useQuery<Story[]>({
    queryKey: ['authorStories', authorUid],
    enabled: !!authorUid,
    staleTime: 1000 * 60 * 1,
    queryFn: async () => {
      if (!authorUid) return [];
      const storiesCollectionRef = collection(db, 'stories');
      const q = query(storiesCollectionRef, where('ownerId', '==', authorUid));
      const querySnapshot = await getQueryDocs(q);
      return querySnapshot.docs.map((d0) => {
        const d = d0.data() as any;
        return {
          id: d0.id,
          title: d.title,
          description: d.description,
          content: d.content,
          ownerId: d.ownerId,
          username: d.username,
          viewCount: d.viewCount || 0,
          likesCount: d.likesCount ?? 0,
          chapterCount: d.chapterCount ?? 1,
          createdAt: d.createdAt?.toDate?.(),
          updatedAt: d.updatedAt?.toDate?.(),
          tags: Array.isArray(d.tags) ? d.tags : [],
        } as Story;
      });
    },
  });

  const authUser = useAuthStore((s: any) => s.user ?? s.currentUser ?? null);
  const isOwnProfile = !!authUser?.uid && !!author?.uid && authUser.uid === author.uid;

  // Memos (safe on undefined)
  const tagStats = useMemo(() => {
    const m = new Map<string, number>();
    (stories ?? []).forEach((s) =>
      (s.tags ?? []).forEach((t) => {
        const k = String(t).trim().toLowerCase();
        if (!k) return;
        m.set(k, (m.get(k) ?? 0) + 1);
      })
    );
    return Array.from(m.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [stories]);

  const visibleStories = useMemo(() => {
    let list = stories ?? [];

    if (queryText.trim()) {
      const q = queryText.trim().toLowerCase();
      list = list.filter((s) =>
        [s.title, s.description, s.username]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    if (selectedTags.length > 0) {
      list = list.filter((s) => {
        const storyTags = (s.tags ?? []).map((t) => String(t).trim().toLowerCase());
        if (matchMode === 'any') return selectedTags.some((t) => storyTags.includes(t));
        return selectedTags.every((t) => storyTags.includes(t));
      });
    }

    if (sort === 'new') {
      list = [...list].sort(
        (a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)
      );
    }
    if (sort === 'old') {
      list = [...list].sort(
        (a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0)
      );
    }
    if (sort === 'alpha') list = [...list].sort((a, b) => alphaCompare(a.title, b.title));

    return list;
  }, [stories, queryText, selectedTags, matchMode, sort]);

  // ---------- Early returns AFTER all hooks ----------
  const isLoadingAny = isLoadingAuthorRef || isLoadingAuthor || isLoadingStories;
  const anyError = authorRefError || authorError || storiesError;

  if (isLoadingAny) {
    return (
      <Paper p="md" shadow="xs" radius="lg" style={{ maxWidth: 900, margin: '16px auto' }}>
        <Skeleton height={28} mb="sm" />
        <Skeleton height={16} mb="md" />
        <Skeleton height={160} radius="md" />
        <Space h="lg" />
        <Skeleton height={24} width="50%" mb="sm" />
        <Skeleton height={120} radius="md" />
      </Paper>
    );
  }

  if (anyError) {
    return (
      <Box maw={900} mx="auto" px="md" py="md">
        <Link to="/authors">
          <Button variant="subtle" size="xs" leftSection={<CircleArrowLeft size={14} />}>
            Back to all authors
          </Button>
        </Link>
        <Paper mt="md" p="md" shadow="xs" radius="lg">
          <Text c="red">
            Error loading author: {(anyError as any)?.message ?? 'Unknown error'}
          </Text>
        </Paper>
      </Box>
    );
  }

  if (!authorRef || !authorUid || !author) {
    return (
      <Box maw={900} mx="auto" px="md" py="md">
        <Link to="/authors">
          <Button variant="subtle" size="xs" leftSection={<CircleArrowLeft size={14} />}>
            Back to all authors
          </Button>
        </Link>
        <Paper mt="md" p="md" shadow="xs" radius="lg">
          <Text>Author not found.</Text>
        </Paper>
      </Box>
    );
  }

  // Derived values (non-hook)
  const patreonLink =
    author.patreon && !/^https?:\/\//i.test(author.patreon)
      ? `https://www.patreon.com/${author.patreon.replace(/^@/, '')}`
      : normalizeLink(author.patreon);

  const otherLink = normalizeLink(author.other);

  const hasContact =
    (!!author.contactEmail && author.contactEmail.trim() !== '') ||
    (!!author.discord && author.discord.trim() !== '') ||
    (!!author.patreon && author.patreon.trim() !== '') ||
    (!!author.other && author.other.trim() !== '');

  const createdStr = author.dateCreated
    ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short' }).format(author.dateCreated)
    : undefined;

  const totalViews = (stories ?? []).reduce((sum, s) => sum + (s.viewCount || 0), 0);

  // --- Contact row styles: tight on mobile, wrap long values ---
  const labelSx = {
    fontWeight: 600,
    // Narrow label width on mobile, wider on desktop
    flex: '0 0 auto',
  } as const;

  const valueSx = {
    flex: '1 1 auto',
    minWidth: 0,
    overflowWrap: 'anywhere' as const,
    wordBreak: 'break-word' as const,
  };

  return (
    <Box maw={900} mx="auto" px="md" py="md">
      <Link to="/authors">
        <Button variant="subtle" size="xs" leftSection={<CircleArrowLeft size={14} />}>
          Back to all authors
        </Button>
      </Link>

      {/* Header */}
      <Paper
        mt="sm"
        p="md"
        shadow="xs"
        radius="lg"
        withBorder
        style={{ borderColor: 'var(--mantine-color-default-border)' }}
      >
        <Group justify="space-between" align="flex-start">
          <Box style={{ minWidth: 0 }}>
            <Title order={2} style={{ lineHeight: 1.1, overflowWrap: 'anywhere' }}>
              {author.username}
            </Title>

            <Group gap="xs" mt={6} wrap="wrap">
              {createdStr && (
                <Badge variant="light" leftSection={<Calendar size={14} />}>
                  Joined {createdStr}
                </Badge>
              )}
              <Badge variant="light" leftSection={<Book size={14} />}>
                {(stories?.length || 0)} {stories && stories.length === 1 ? 'story' : 'stories'}
              </Badge>
              <Badge variant="outline" leftSection={<Eye size={14} />}>
                {totalViews} total views
              </Badge>
              {author.banned && (
                <Badge color="red" variant="filled">
                  Banned
                </Badge>
              )}
            </Group>
          </Box>

          <Group gap="xs" wrap="nowrap" justify="flex-end">
            {isOwnProfile && (
              <Link to="/account-settings" style={{ textDecoration: 'none' }}>
                <Button variant="light" size="xs" leftSection={<Pencil size={14} />}>
                  Edit Profile
                </Button>
              </Link>
            )}

            <AdminDropdown
              targetUid={author.uid}
              displayName={author.username}
              isBanned={!!author.banned}
              bannedReason={author.bannedReason ?? null}
            />
          </Group>
        </Group>

        {/* Contact section */}
        {hasContact && (
          <>
            <Divider my="md" />

            {/* Use SimpleGrid so mobile stacks nicely, desktop keeps inline feel */}
            <Stack gap={6}>
              {author.contactEmail?.trim() && (
                <Group
                  gap={8}
                  align="flex-start"
                  wrap="nowrap"
                  style={{ width: '100%' }}
                >
                  <Text style={{ ...labelSx }} miw={{ base: 60, sm: 90 }}>
                    Email:
                  </Text>
                  <Anchor
                    href={`mailto:${author.contactEmail}`}
                    style={{ ...valueSx, cursor: 'pointer' }}
                  >
                    {author.contactEmail}
                  </Anchor>
                </Group>
              )}

              {author.discord?.trim() && (
                <Group gap={8} align="flex-start" wrap="nowrap" style={{ width: '100%' }}>
                  <Text style={{ ...labelSx }} miw={{ base: 60, sm: 90 }}>
                    Discord:
                  </Text>
                  <Text style={valueSx}>{author.discord}</Text>
                </Group>
              )}

              {author.patreon?.trim() && (
                <Group gap={8} align="flex-start" wrap="nowrap" style={{ width: '100%' }}>
                  <Text style={{ ...labelSx }} miw={{ base: 60, sm: 90 }}>
                    Patreon:
                  </Text>

                  {patreonLink && /^https?:\/\//i.test(patreonLink) ? (
                    <Anchor
                      href={patreonLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...valueSx,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Link2 size={14} /> Visit
                    </Anchor>
                  ) : (
                    <Text style={valueSx}>{author.patreon}</Text>
                  )}
                </Group>
              )}

              {author.other?.trim() && (
                <Group gap={8} align="flex-start" wrap="nowrap" style={{ width: '100%' }}>
                  <Text style={{ ...labelSx }} miw={{ base: 60, sm: 90 }}>
                    Other:
                  </Text>

                  {otherLink && /^https?:\/\//i.test(otherLink) ? (
                    <Anchor
                      href={otherLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...valueSx,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Link2 size={14} /> Open link
                    </Anchor>
                  ) : (
                    <Text style={valueSx}>{author.other}</Text>
                  )}
                </Group>
              )}
            </Stack>
          </>
        )}
      </Paper>

      {/* About */}
      {author.aboutMe && author.aboutMe.trim() !== '' && (
        <Paper mt="md" p="md" shadow="xs" radius="lg" withBorder>
          <Title order={4}>About</Title>
          <Text mt="xs" size="sm" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {author.aboutMe}
          </Text>
        </Paper>
      )}

      {/* Stories header + filters */}
      <Group justify="space-between" align="center" mt="lg" mb="sm" wrap="wrap">
        <Group gap="xs" align="center">
          <Book size={22} />
          <Title order={3} style={{ margin: 0 }}>
            Stories by {author.username}
          </Title>
        </Group>

        <Button
          variant="light"
          size="xs"
          leftSection={<FilterIcon size={14} />}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Search/Filter Stories
        </Button>
      </Group>

      {/* Filters panel */}
      <Transition mounted={filtersOpen} transition="fade" duration={160} timingFunction="ease">
        {(styles) => (
          <Paper
            withBorder
            radius="lg"
            p="md"
            mt="md"
            mb="lg"
            style={{ ...styles, backdropFilter: 'blur(4px)' }}
          >
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <TextInput
                  value={queryText}
                  onChange={(e) => setQueryText(e.currentTarget.value)}
                  placeholder="Search this author's stories…"
                  leftSection={<Search size={16} />}
                  w={{ base: '100%', sm: 320 }}
                  radius="md"
                />

                <Group gap="xs" align="center">
                  <Text c="dimmed" size="sm">
                    Sort by:
                  </Text>
                  <SegmentedControl
                    value={sort}
                    onChange={(v) => setSort(v as 'new' | 'old' | 'alpha')}
                    data={[
                      { label: 'Newest', value: 'new' },
                      { label: 'Oldest', value: 'old' },
                      { label: 'A–Z', value: 'alpha' },
                    ]}
                    radius="md"
                  />
                </Group>
              </Group>

              {tagStats.length > 0 && (
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Group gap="xs" align="center" wrap="wrap">
                      <Text c="dimmed" size="sm">
                        Filter by tags:
                      </Text>
                      <SegmentedControl
                        value={matchMode}
                        onChange={(v) => setMatchMode(v as 'any' | 'all')}
                        data={[
                          { label: 'Any tag', value: 'any' },
                          { label: 'All tags', value: 'all' },
                        ]}
                        size="xs"
                        radius="md"
                      />
                    </Group>

                    {selectedTags.length > 0 && (
                      <Button variant="subtle" size="xs" onClick={() => setSelectedTags([])}>
                        Clear
                      </Button>
                    )}
                  </Group>

                  <Chip.Group multiple value={selectedTags} onChange={(vals) => setSelectedTags(vals as string[])}>
                    <Group gap="xs" wrap="wrap">
                      {tagStats.map(({ tag, count }) => (
                        <Chip key={tag} value={tag} radius="md">
                          {tag}{' '}
                          <Text span size="xs" c="dimmed">
                            ({count})
                          </Text>
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                </Stack>
              )}
            </Stack>
          </Paper>
        )}
      </Transition>

      {/* Stories */}
      {visibleStories.length > 0 ? (
        <Stack gap="sm">
          {visibleStories.map((story, i) => (
            <Transition key={story.id} mounted transition="fade" duration={180} timingFunction="ease">
              {(styles) => (
                <div
                  style={{ ...styles, transitionDelay: `${i * 25}ms`, cursor: 'pointer' }}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open story: ${story.title}`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement | null;
                    const interactive = target?.closest?.(
                      'a,button,input,textarea,select,[role="button"],[role="link"],[data-stop-card-nav="true"]'
                    );
                    if (interactive) return;

                    navigate({
                      to: '/stories/$storyId',
                      params: { storyId: story.id },
                      search: { chapter: 1 } as any,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate({
                        to: '/stories/$storyId',
                        params: { storyId: story.id },
                        search: { chapter: 1 } as any,
                      });
                    }
                  }}
                >
                  <StoryListCard story={story as any} />
                </div>
              )}
            </Transition>
          ))}
        </Stack>
      ) : (
        <Paper mt="sm" p="md" radius="md" withBorder>
          <Text c="dimmed">No stories submitted by {author.username} yet.</Text>
        </Paper>
      )}
    </Box>
  );
}
