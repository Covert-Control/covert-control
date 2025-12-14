// src/routes/authors.lazy.tsx
import * as React from 'react';
import {
  createLazyFileRoute,
  Outlet,
  useLocation,
  Link,
} from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Loader,
  Text,
  Title,
  Space,
  Group,
  TextInput,
  Select,
  Button,
  Stack,
  ActionIcon,
} from '@mantine/core';
import { Search } from 'lucide-react';
import { AuthorCard, AuthorWithStory } from '../components/AuthorCard';

export const Route = createLazyFileRoute('/authors')({
  component: AuthorsListComponent,
});

type SortOption = 'name' | 'stories' | 'latest';

const PAGE_SIZE = 20;

interface AuthorsPage {
  authors: AuthorWithStory[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function buildAuthorQuery(
  authorsRef: ReturnType<typeof collection>,
  sort: SortOption,
  searchTerm: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null | undefined
) {
  const trimmedSearch = searchTerm.trim();
  const hasSearch = trimmedSearch.length > 0;

  const constraints: any[] = [];

  if (hasSearch) {
    // Simple "starts with" search on username.
    // If you later add a `usernameLowercase` field, swap to that here.
    constraints.push(orderBy('username'));
    constraints.push(startAt(trimmedSearch));
    constraints.push(endAt(trimmedSearch + '\uf8ff'));
  } else {
    switch (sort) {
      case 'stories':
        constraints.push(orderBy('storyCount', 'desc'));
        break;
      case 'latest':
        constraints.push(orderBy('lastStoryDate', 'desc'));
        break;
      case 'name':
      default:
        constraints.push(orderBy('username'));
        break;
    }
  }

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  constraints.push(limit(PAGE_SIZE));

  return query(authorsRef, ...constraints);
}

function AuthorsListComponent() {
  const authorsRef = collection(db, 'authors_with_stories');
  const location = useLocation();
  const isAtAuthorsBase = location.pathname === '/authors';

  const [sort, setSort] = React.useState<SortOption>('name');

  // What the user is *typing* vs what we actually *query* with
  const [searchInput, setSearchInput] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');

  const handleSearchApply = () => {
    setSearchTerm(searchInput.trim());
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearchApply();
    }
  };

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['authorsWithStories', { sort, search: searchTerm }],
    queryFn: async (context) => {
      const pageParam =
        (context.pageParam as QueryDocumentSnapshot<DocumentData> | null) ?? null;

      const q = buildAuthorQuery(authorsRef, sort, searchTerm, pageParam);
      const snapshot = await getDocs(q);

      const authors: AuthorWithStory[] = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          uid: doc.id,
          username: data.username || 'Unknown Author',
          storyCount: data.storyCount || 0,
          lastStoryTitle: data.lastStoryTitle || '',
          lastStoryDate: data.lastStoryDate?.toDate
            ? data.lastStoryDate.toDate()
            : data.lastStoryDate,
        };
      });

      const lastVisible =
        snapshot.docs.length > 0
          ? (snapshot.docs[snapshot.docs.length - 1] as QueryDocumentSnapshot<DocumentData>)
          : null;

      return {
        authors,
        lastVisible,
        hasMore: snapshot.docs.length === PAGE_SIZE,
      } satisfies AuthorsPage;
    },
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.lastVisible : undefined,
    staleTime: 1000 * 60 * 10,
  });

  if (!isAtAuthorsBase) {
    return <Outlet />;
  }

  if (isLoading && !data) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <Loader size="xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Text c="red">
        Error loading authors: {(error as Error)?.message || 'Unknown error'}
      </Text>
    );
  }

  const pages = (data?.pages ?? []) as AuthorsPage[];
  const authors = pages.flatMap((page) => page.authors);
  const hasAnyAuthors = authors.length > 0;

  return (
    <div style={{ padding: '20px' }}>
      <Title order={2} mb="md">
        Authors with Stories
      </Title>

      {/* Controls row: search + sort */}
      <Group
        mb="md"
        justify="space-between"
        align="flex-end"
        gap="sm"
        wrap="wrap"
      >
        <TextInput
          label="Search by name"
          placeholder="Type a name, then press Enter or click the search icon"
          value={searchInput}
          onChange={(event) => setSearchInput(event.currentTarget.value)}
          onKeyDown={handleSearchKeyDown}
          rightSectionWidth={36}
          rightSection={
            <ActionIcon
              aria-label="Search"
              variant="subtle"
              size="sm"
              onClick={handleSearchApply}
            >
              <Search size={16} />
            </ActionIcon>
          }
          style={{ flex: 1, minWidth: 220 }}
        />

        <Select
          label="Sort by"
          value={sort}
          onChange={(value) => {
            if (value) {
              setSort(value as SortOption);
            }
          }}
          data={[
            { value: 'name', label: 'Name (A–Z)' },
            { value: 'stories', label: 'Most stories' },
            { value: 'latest', label: 'Latest update' },
          ]}
          style={{ width: 220 }}
        />
      </Group>

      <Space h="xs" />

      {hasAnyAuthors ? (
        <>
          <Stack gap="sm">
            {authors.map((author) => (
              <Link
                key={author.uid}
                to="/authors/$authorId"
                params={{ authorId: author.username }}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <AuthorCard author={author} />
              </Link>
            ))}
          </Stack>

          <Group justify="center" mt="lg">
            {hasNextPage && (
              <Button
                variant="light"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                Load more authors
              </Button>
            )}
          </Group>
        </>
      ) : (
        <Text>No authors found.</Text>
      )}
    </div>
  );
}
