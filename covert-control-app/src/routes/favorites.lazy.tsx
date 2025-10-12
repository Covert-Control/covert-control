// src/routes/favorites.lazy.tsx
import { createLazyFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
    collection,
    getDocs,
    query as fsQuery,
    where,
    documentId,
    FirestoreError,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { Badge, 
    Button, 
    Chip, 
    Group, 
    Paper, 
    SegmentedControl, 
    Skeleton, 
    Space, 
    Stack, 
    Text, 
    TextInput, 
    ThemeIcon, 
    Title, 
    Transition } from '@mantine/core';
import { useMemo, useState } from 'react';
import { Heart, Search } from 'lucide-react';
import StoryListCard from '../components/StoryListCard';
import type { Story as BaseStory } from '../types/story';

type Story = BaseStory & { tags?: string[] };

export const Route = createLazyFileRoute('/favorites')({
    component: RouteComponent,
});

function RouteComponent() {
    const user = useAuthStore((s) => s.user);
    const uid = user?.uid ?? null;

    const {
        data: stories,
        isLoading,
        isError,
        error,
    } = useQuery<Story[]>({
        enabled: !!uid,
        queryKey: ['favorites', uid],
        queryFn: async () => {
            const favsSnap = await getDocs(collection(db, 'users', uid!, 'favorites'));
            // If you stored { storyId } instead of using doc.id, swap:
            // const storyIds = favsSnap.docs.map((d) => (d.data() as any).storyId).filter(Boolean);
            const storyIds = favsSnap.docs.map((d) => d.id).filter(Boolean);
            if (storyIds.length === 0) return [];

            // Chunk for Firestore 'in' queries (limit 10)
            const chunks: string[][] = [];
            for (let i = 0; i < storyIds.length; i += 10) chunks.push(storyIds.slice(i, i + 10));

            const collected: Story[] = [];
            for (const ids of chunks) {
                const q = fsQuery(collection(db, 'stories'), where(documentId(), 'in', ids));
                const snap = await getDocs(q);
                snap.forEach((doc) => {
                    const d = doc.data() as any;
                    collected.push({
                        id: doc.id,
                        title: d.title,
                        description: d.description,
                        content: d.content,
                        ownerId: d.ownerId,
                        viewCount: d.viewCount || 0,
                        username: d.username || 'Unknown',
                        createdAt: d.createdAt?.toDate?.(),
                        tags: Array.isArray(d.tags) ? d.tags : [],
                    });
                });
            }

            // Newest first
            collected.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
            return collected;
        },
        staleTime: 1000 * 60 * 5,
    });

    function alphaCompare(a?: string, b?: string) {
        const norm = (t?: string) => {
            const s = (t ?? '').trim().toLowerCase().replace(/^[^a-z0-9]+/i, '');
            return { first: s[0] || '', full: s };
        };
        const na = norm(a);
        const nb = norm(b);

        // Primary: first character (case/diacritics-insensitive)
        if (na.first !== nb.first) {
            return na.first.localeCompare(nb.first, undefined, { sensitivity: 'base' });
        }
        // Tie-breaker: full title
        return na.full.localeCompare(nb.full, undefined, { sensitivity: 'base' });
    }

    // ——— UI state: search, sort, tag filtering ———
    const [queryText, setQueryText] = useState('');
    const [sort, setSort] = useState<'new' | 'old' | 'alpha'>('new');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [matchMode, setMatchMode] = useState<'any' | 'all'>('any');

    // Build tag list with frequencies from favorites
    const tagStats = useMemo(() => {
        const m = new Map<string, number>();
        (stories ?? []).forEach((s) =>
            (s.tags ?? []).forEach((t) => {
                const k = String(t).trim().toLowerCase();
                if (!k) return;
                m.set(k, (m.get(k) ?? 0) + 1);
            })
        );
        // Sort by frequency desc, then alpha
        return Array.from(m.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
    }, [stories]);

    const visibleStories = useMemo(() => {
        let list = stories ?? [];

        // Search
        if (queryText.trim()) {
            const q = queryText.trim().toLowerCase();
            list = list.filter((s) =>
                [s.title, s.description, s.username]
                    .filter(Boolean)
                    .some((v) => String(v).toLowerCase().includes(q))
            );
        }

        // Tag filter
        if (selectedTags.length > 0) {
            list = list.filter((s) => {
                const storyTags = (s.tags ?? []).map((t) => String(t).trim().toLowerCase());
                if (matchMode === 'any') {
                    return selectedTags.some((t) => storyTags.includes(t));
                }
                // 'all'
                return selectedTags.every((t) => storyTags.includes(t));
            });
        }

        // Sort
        if (sort === 'new') list = [...list].sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
        if (sort === 'old') list = [...list].sort((a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0));
        if (sort === 'alpha') list = [...list].sort((a, b) => alphaCompare(a.title, b.title));

        return list;
    }, [stories, queryText, selectedTags, matchMode, sort]);

    // ——— Not signed in ———
    if (!uid) {
        return (
            <div style={{ padding: '20px' }}>
                <Header count={0} />
                <Space h="md" />
                <Text c="dimmed" maw={520}>
                    You need to be signed in to view your favorites.
                </Text>
                <Space h="md" />
                <Button component={Link} to="/authentication" search={{ redirect: '/favorites' }}>
                    Sign in to continue
                </Button>
            </div>
        );
    }

    // ——— Loading ———
    if (isLoading) {
        return (
            <div style={{ padding: '20px' }}>
                <Header count={0} />
                <Space h="lg" />
                <Stack gap="md">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </Stack>
            </div>
        );
    }

    // ——— Error ———
    if (isError) {
        const e = error as FirestoreError;
        return (
            <div style={{ padding: '20px' }}>
                <Header count={0} />
                <Space h="md" />
                <Text c="red">Couldn’t load favorites.</Text>
                <Text c="dimmed" size="sm">{e.message}</Text>
            </div>
        );
    }

    const count = stories?.length ?? 0;

    return (
        <div style={{ padding: '20px' }}>
            <Header count={count} />

            {/* Toolbar */}
            <Paper withBorder radius="lg" p="md" mt="md" mb="lg" style={{ backdropFilter: 'blur(4px)' }}>
                <Stack gap="sm">
                    <Group justify="space-between" wrap="wrap">
                        <TextInput
                            value={queryText}
                            onChange={(e) => setQueryText(e.currentTarget.value)}
                            placeholder="Search your favorites…"
                            leftSection={<Search size={16} />}
                            w={{ base: '100%', sm: 320 }}
                            radius="md"
                        />
                        <Group gap="xs" align="center">
                            <Text c="dimmed" size="sm">Sort by:</Text>
                            <SegmentedControl
                                value={sort}
                                onChange={(v) => setSort(v as 'new' | 'old')}
                                data={[
                                    { label: 'Newest', value: 'new' },
                                    { label: 'Oldest', value: 'old' },
                                    { label: 'A–Z', value: 'alpha' },
                                ]}
                                radius="md"
                            />
                        </Group>
                    </Group>

                    {/* Tag Chips filter */}
                    {tagStats.length > 0 && (
                    <Stack gap="xs">
                        <Group justify="space-between" align="center">
                        <Group gap="xs" align="center">
                            <Text c="dimmed" size="sm">Filter by tags:</Text>
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

                        <Chip.Group
                        multiple
                        value={selectedTags}
                        onChange={(vals) => setSelectedTags(vals as string[])}
                        >
                        <Group gap="xs">
                            {tagStats.map(({ tag, count }) => (
                            <Chip key={tag} value={tag} radius="md">
                                {tag} <Text span size="xs" c="dimmed">({count})</Text>
                            </Chip>
                            ))}
                        </Group>
                        </Chip.Group>
                    </Stack>
                    )}
                </Stack>
            </Paper>

            {/* Cards list — full-width stacked like /stories */}
            {visibleStories.length > 0 ? (
                <div style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
                    {visibleStories.map((story, i) => (
                        <Transition key={story.id} mounted transition="fade" duration={180} timingFunction="ease">
                            {(styles) => (
                                <div style={{ ...styles, transitionDelay: `${i * 30}ms` }}>
                                    <StoryListCard story={story} />
                                </div>
                            )}
                        </Transition>
                    ))}
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    );
}

/* ——— Header without invalid HTML nesting ——— */
function Header({ count }: { count: number }) {
    return (
        <Group justify="space-between" align="center">
            <Group>
                <ThemeIcon size={42} radius="xl" variant="gradient" gradient={{ from: 'pink', to: 'violet' }}>
                    <Heart />
                </ThemeIcon>
                <div>
                    <Title order={2} style={{ marginBottom: 4 }}>
                        <Text
                            inherit
                            variant="gradient"
                            gradient={{ from: 'pink', to: 'violet', deg: 45 }}
                            fw={900}
                        >
                            Your Favorites
                        </Text>
                    </Title>
                    <Group gap="xs" align="center">
                        <Badge variant="light" radius="sm">{count}</Badge>
                        <Text c="dimmed" size="sm">
                            saved {count === 1 ? 'story' : 'stories'}
                        </Text>
                    </Group>
                </div>
            </Group>
        </Group>
    );
}

/* ——— Empty state ——— */
function EmptyState() {
    return (
        <Paper withBorder radius="lg" p="xl" style={{ textAlign: 'center' }}>
            <ThemeIcon size={42} radius="xl" variant="light">
                <Heart />
            </ThemeIcon>
            <Space h="sm" />
            <Title order={4}>No favorites yet</Title>
            <Text c="dimmed" size="sm" maw={460} mx="auto">
                Save stories you love and they’ll appear here.
            </Text>
            <Space h="md" />
            <Button component={Link} to="/stories">
                Browse stories
            </Button>
        </Paper>
    );
}

/* ——— Skeleton card ——— */
function SkeletonCard() {
    return (
        <Paper withBorder radius="lg" p="lg">
            <Stack gap="sm">
                <Group justify="space-between">
                    <Skeleton height={16} width="40%" />
                    <Skeleton height={12} width={80} />
                </Group>
                <Skeleton height={12} width="70%" />
                <Skeleton height={12} width="55%" />
                <Skeleton height={12} width="85%" />
            </Stack>
        </Paper>
    );
}
